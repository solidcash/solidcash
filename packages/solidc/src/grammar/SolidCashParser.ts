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
	public static readonly RULE_forStatement = 92;
	public static readonly RULE_forInit = 93;
	public static readonly RULE_forCondition = 94;
	public static readonly RULE_forUpdate = 95;
	public static readonly RULE_doWhileStatement = 96;
	public static readonly RULE_whileStatement = 97;
	public static readonly RULE_consoleStatement = 98;
	public static readonly RULE_assemblyStatement = 99;
	public static readonly RULE_yulBlock = 100;
	public static readonly RULE_yulStatement = 101;
	public static readonly RULE_yulVariableDeclaration = 102;
	public static readonly RULE_yulAssignment = 103;
	public static readonly RULE_yulIf = 104;
	public static readonly RULE_yulSwitch = 105;
	public static readonly RULE_yulCase = 106;
	public static readonly RULE_yulDefault = 107;
	public static readonly RULE_yulForLoop = 108;
	public static readonly RULE_yulFunctionDefinition = 109;
	public static readonly RULE_yulExpression = 110;
	public static readonly RULE_yulFunctionCall = 111;
	public static readonly RULE_yulFunctionName = 112;
	public static readonly RULE_yulIdentifier = 113;
	public static readonly RULE_yulPath = 114;
	public static readonly RULE_yulLiteral = 115;
	public static readonly RULE_uncheckedStatement = 116;
	public static readonly RULE_switchStatement = 117;
	public static readonly RULE_switchCase = 118;
	public static readonly RULE_switchDefault = 119;
	public static readonly RULE_tryCatchStatement = 120;
	public static readonly RULE_tryReturns = 121;
	public static readonly RULE_catchClause = 122;
	public static readonly RULE_breakStatement = 123;
	public static readonly RULE_continueStatement = 124;
	public static readonly RULE_requireMessage = 125;
	public static readonly RULE_revertStatement = 126;
	public static readonly RULE_assertStatement = 127;
	public static readonly RULE_consoleParameter = 128;
	public static readonly RULE_consoleParameterList = 129;
	public static readonly RULE_functionCall = 130;
	public static readonly RULE_namedArg = 131;
	public static readonly RULE_expressionList = 132;
	public static readonly RULE_callArgument = 133;
	public static readonly RULE_callOptions = 134;
	public static readonly RULE_callOption = 135;
	public static readonly RULE_typeList = 136;
	public static readonly RULE_typeListItem = 137;
	public static readonly RULE_expression = 138;
	public static readonly RULE_typeIntrospectionBase = 139;
	public static readonly RULE_abiEncodeCallArguments = 140;
	public static readonly RULE_bareAbiFunctionReferenceStatement = 141;
	public static readonly RULE_memberName = 142;
	public static readonly RULE_modifier = 143;
	public static readonly RULE_dataLocation = 144;
	public static readonly RULE_literal = 145;
	public static readonly RULE_numberLiteral = 146;
	public static readonly RULE_decimalLiteral = 147;
	public static readonly RULE_typeName = 148;
	public static readonly RULE_functionType = 149;
	public static readonly RULE_functionTypeParameter = 150;
	public static readonly RULE_functionTypeReturnParameter = 151;
	public static readonly RULE_typeCast = 152;
	public static readonly RULE_arrayCastType = 153;
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
		"selfdestructStatement", "emitStatement", "variableDefinition", "functionArrayType", 
		"tupleAssignment", "nestedTupleAssignment", "nestedTuplePattern", "nestedTuplePatternItem", 
		"tupleSlot", "pushArgument", "deleteStatement", "timeOpStatement", "requireStatement", 
		"ifStatement", "loopStatement", "forOfEntriesStatement", "forInStatement", 
		"forOfStatement", "forStatement", "forInit", "forCondition", "forUpdate", 
		"doWhileStatement", "whileStatement", "consoleStatement", "assemblyStatement", 
		"yulBlock", "yulStatement", "yulVariableDeclaration", "yulAssignment", 
		"yulIf", "yulSwitch", "yulCase", "yulDefault", "yulForLoop", "yulFunctionDefinition", 
		"yulExpression", "yulFunctionCall", "yulFunctionName", "yulIdentifier", 
		"yulPath", "yulLiteral", "uncheckedStatement", "switchStatement", "switchCase", 
		"switchDefault", "tryCatchStatement", "tryReturns", "catchClause", "breakStatement", 
		"continueStatement", "requireMessage", "revertStatement", "assertStatement", 
		"consoleParameter", "consoleParameterList", "functionCall", "namedArg", 
		"expressionList", "callArgument", "callOptions", "callOption", "typeList", 
		"typeListItem", "expression", "typeIntrospectionBase", "abiEncodeCallArguments", 
		"bareAbiFunctionReferenceStatement", "memberName", "modifier", "dataLocation", 
		"literal", "numberLiteral", "decimalLiteral", "typeName", "functionType", 
		"functionTypeParameter", "functionTypeReturnParameter", "typeCast", "arrayCastType",
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

	// Tokens reserved by the Solidity grammar remain ordinary identifiers inside Yul. Consume them through a
	// predicate + wildcard rather than spelling them as literals in yulIdentifier: new literal alternatives would
	// make previously non-reserved words into lexer tokens throughout the whole Solidity grammar.
	isYulSolidityKeyword(text: string): boolean {
	  return new Set([
	    'abstract', 'anonymous', 'as', 'assembly', 'catch', 'constant', 'constructor', 'contract', 'delete', 'do',
	    'else', 'enum', 'emit', 'event', 'external', 'fallback', 'indexed', 'interface', 'internal', 'immutable',
	    'import', 'is', 'library', 'mapping', 'memory', 'modifier', 'new', 'override', 'payable', 'public', 'pragma',
	    'private', 'pure', 'receive', 'returns', 'storage', 'calldata', 'struct', 'throw', 'try', 'unicode', 'using',
	    'view', 'virtual', 'while', 'wei', 'gwei', 'ether', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'years',
	    'int', 'uint', 'bytes', 'string', 'address', 'bool', 'fixed', 'ufixed', 'after', 'alias', 'apply', 'auto', 'copyof',
	    'define', 'final', 'implements', 'in', 'inline', 'macro', 'match', 'mutable', 'null', 'of', 'partial',
	    'promise', 'reference', 'relocatable', 'sealed', 'sizeof', 'static', 'supports', 'typedef', 'typeof',
	    'unchecked', 'var',
	  ]).has(text);
	}

	// True when the tuple-assignment LHS contains a nested tuple item, including forms whose first item is plain:
	// `(a, (b, c))`. The older two-token check recognized only `((a, b), c)`. Restrict the scan to an opening
	// parenthesis immediately after the outer `(` or a depth-one comma, so parentheses inside an index/call do not
	// redirect an ordinary complex-lvalue tuple assignment to the nested-pattern rule.
	hasNestedTuplePatternAhead(): boolean {
	  let depth = 0;
	  let itemStart = false;
	  for (let i = 1; i < 4096; i++) {
	    const text = this._input.LT(i).text;
	    if (text === '<EOF>' || text === '=') return false;
	    if (text === '(') {
	      if (depth === 1 && itemStart) return true;
	      depth++;
	      itemStart = depth === 1;
	      continue;
	    }
	    if (text === ')') {
	      depth--;
	      itemStart = false;
	      continue;
	    }
	    if (text === ',' && depth === 1) {
	      itemStart = true;
	      continue;
	    }
	    if (depth === 1) itemStart = false;
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
			this.state = 311;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 308;
					this.pragmaDirective();
					}
					}
				}
				this.state = 313;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 0, this._ctx);
			}
			this.state = 318;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===1) {
				{
				this.state = 316;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 1, this._ctx) ) {
				case 1:
					{
					this.state = 314;
					this.importDirective();
					}
					break;
				case 2:
					{
					this.state = 315;
					this.experimentalStdImport();
					}
					break;
				}
				}
				this.state = 320;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 335;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 947422209) !== 0) || ((((_la - 89)) & ~0x1F) === 0 && ((1 << (_la - 89)) & 7) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 333;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 3, this._ctx) ) {
				case 1:
					{
					this.state = 321;
					this.pragmaDirective();
					}
					break;
				case 2:
					{
					this.state = 322;
					this.constantDefinition();
					}
					break;
				case 3:
					{
					this.state = 323;
					this.enumDefinition();
					}
					break;
				case 4:
					{
					this.state = 324;
					this.structDefinition();
					}
					break;
				case 5:
					{
					this.state = 325;
					this.typeDefinition();
					}
					break;
				case 6:
					{
					this.state = 326;
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 327;
					this.errorDefinition();
					}
					break;
				case 8:
					{
					this.state = 328;
					this.eventDefinition();
					}
					break;
				case 9:
					{
					this.state = 329;
					this.interfaceDefinition();
					}
					break;
				case 10:
					{
					this.state = 330;
					this.freeFunctionDefinition();
					}
					break;
				case 11:
					{
					this.state = 331;
					this.libraryDefinition();
					}
					break;
				case 12:
					{
					this.state = 332;
					this.contractDefinition();
					}
					break;
				}
				}
				this.state = 337;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 338;
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
			this.state = 366;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 7, this._ctx) ) {
			case 1:
				localctx = new WildcardImportContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 340;
				this.match(SolidCashParser.T__0);
				this.state = 341;
				this.match(SolidCashParser.StringLiteral);
				this.state = 342;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new NamespaceImportContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 343;
				this.match(SolidCashParser.T__0);
				this.state = 344;
				this.match(SolidCashParser.StringLiteral);
				this.state = 345;
				this.match(SolidCashParser.T__2);
				this.state = 346;
				this.match(SolidCashParser.Identifier);
				this.state = 347;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new SelectiveImportContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 348;
				this.match(SolidCashParser.T__0);
				this.state = 349;
				this.match(SolidCashParser.T__3);
				this.state = 350;
				this.importBinding();
				this.state = 355;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 351;
						this.match(SolidCashParser.T__4);
						this.state = 352;
						this.importBinding();
						}
						}
					}
					this.state = 357;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 5, this._ctx);
				}
				this.state = 359;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 358;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 361;
				this.match(SolidCashParser.T__5);
				this.state = 362;
				this.match(SolidCashParser.Identifier);
				this.state = 363;
				this.match(SolidCashParser.StringLiteral);
				this.state = 364;
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
			this.state = 368;
			this.match(SolidCashParser.Identifier);
			this.state = 371;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 369;
				this.match(SolidCashParser.T__2);
				this.state = 370;
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
			this.state = 418;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 12, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 373;
				this.match(SolidCashParser.T__0);
				this.state = 374;
				this.match(SolidCashParser.Identifier);
				this.state = 375;
				this.match(SolidCashParser.T__6);
				this.state = 376;
				this.match(SolidCashParser.Identifier);
				this.state = 377;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 378;
				this.match(SolidCashParser.T__0);
				this.state = 379;
				this.match(SolidCashParser.Identifier);
				this.state = 380;
				this.match(SolidCashParser.T__6);
				this.state = 381;
				this.match(SolidCashParser.Identifier);
				this.state = 382;
				this.match(SolidCashParser.T__2);
				this.state = 383;
				this.match(SolidCashParser.Identifier);
				this.state = 384;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 385;
				this.match(SolidCashParser.T__0);
				this.state = 386;
				this.match(SolidCashParser.T__7);
				this.state = 387;
				this.match(SolidCashParser.T__2);
				this.state = 388;
				this.match(SolidCashParser.Identifier);
				this.state = 389;
				this.match(SolidCashParser.Identifier);
				this.state = 390;
				this.match(SolidCashParser.Identifier);
				this.state = 391;
				this.match(SolidCashParser.T__6);
				this.state = 392;
				this.match(SolidCashParser.Identifier);
				this.state = 393;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 394;
				this.match(SolidCashParser.T__0);
				this.state = 395;
				this.match(SolidCashParser.T__3);
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

				this.state = 409;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 401;
					this.match(SolidCashParser.T__4);
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

					}
					}
					this.state = 411;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 412;
				this.match(SolidCashParser.T__5);
				this.state = 413;
				this.match(SolidCashParser.Identifier);
				this.state = 414;
				this.match(SolidCashParser.Identifier);
				this.state = 415;
				this.match(SolidCashParser.T__6);
				this.state = 416;
				this.match(SolidCashParser.Identifier);
				this.state = 417;
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
			this.state = 420;
			this.match(SolidCashParser.T__8);
			this.state = 421;
			this.functionName();
			this.state = 422;
			this.parameterList();
			this.state = 427;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 29)) & ~0x1F) === 0 && ((1 << (_la - 29)) & 12582919) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0) || _la===180) {
				{
				this.state = 425;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
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
					this.state = 423;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 424;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 429;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 431;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 430;
				this.returnType();
				}
			}

			this.state = 433;
			this.match(SolidCashParser.T__3);
			this.state = 437;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 16, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 434;
					this.statement();
					}
					}
				}
				this.state = 439;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 16, this._ctx);
			}
			this.state = 440;
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
			this.state = 481;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 23, this._ctx) ) {
			case 1:
				localctx = new UsingLibraryForContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 442;
				this.match(SolidCashParser.T__9);
				this.state = 443;
				this.match(SolidCashParser.Identifier);
				this.state = 444;
				this.match(SolidCashParser.T__10);
				this.state = 449;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 17, this._ctx) ) {
				case 1:
					{
					this.state = 445;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 446;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 447;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 448;
					this.match(SolidCashParser.T__7);
					}
					break;
				}
				this.state = 452;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 451;
					this.match(SolidCashParser.T__11);
					}
				}

				this.state = 454;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new UsingFunctionsForContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 455;
				this.match(SolidCashParser.T__9);
				this.state = 456;
				this.match(SolidCashParser.T__3);
				this.state = 457;
				this.usingFunctionBinding();
				this.state = 462;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 19, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 458;
						this.match(SolidCashParser.T__4);
						this.state = 459;
						this.usingFunctionBinding();
						}
						}
					}
					this.state = 464;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 19, this._ctx);
				}
				this.state = 466;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 465;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 468;
				this.match(SolidCashParser.T__5);
				this.state = 469;
				this.match(SolidCashParser.T__10);
				this.state = 474;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 21, this._ctx) ) {
				case 1:
					{
					this.state = 470;
					this.arrayType(0);
					}
					break;
				case 2:
					{
					this.state = 471;
					this.mappingType();
					}
					break;
				case 3:
					{
					this.state = 472;
					this.typeName();
					}
					break;
				case 4:
					{
					this.state = 473;
					this.match(SolidCashParser.T__7);
					}
					break;
				}
				this.state = 477;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===12) {
					{
					this.state = 476;
					this.match(SolidCashParser.T__11);
					}
				}

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
	public usingFunctionBinding(): UsingFunctionBindingContext {
		let localctx: UsingFunctionBindingContext = new UsingFunctionBindingContext(this, this._ctx, this.state);
		this.enterRule(localctx, 12, SolidCashParser.RULE_usingFunctionBinding);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 483;
			this.match(SolidCashParser.Identifier);
			this.state = 486;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7) {
				{
				this.state = 484;
				this.match(SolidCashParser.T__6);
				this.state = 485;
				this.match(SolidCashParser.Identifier);
				}
			}

			this.state = 490;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===3) {
				{
				this.state = 488;
				this.match(SolidCashParser.T__2);
				this.state = 489;
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
			this.state = 492;
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
			this.state = 514;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 26, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 494;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 495;
				this.match(SolidCashParser.T__27);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 496;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 497;
				this.match(SolidCashParser.T__29);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 498;
				this.match(SolidCashParser.T__30);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 499;
				this.match(SolidCashParser.T__31);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 500;
				this.match(SolidCashParser.T__32);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 501;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 502;
				this.match(SolidCashParser.T__11);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 503;
				this.match(SolidCashParser.T__34);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 504;
				this.match(SolidCashParser.T__35);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 505;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 506;
				this.match(SolidCashParser.T__37);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 507;
				this.match(SolidCashParser.T__38);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 508;
				this.match(SolidCashParser.T__39);
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 509;
				this.match(SolidCashParser.T__40);
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 510;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 511;
				this.match(SolidCashParser.BchUnit);
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 512;
				if (!(this.isMalformedBoundedTypeName(this._input.LT(1).text ?? ''))) {
					throw this.createFailedPredicateException("this.isMalformedBoundedTypeName(this._input.LT(1).text ?? '')");
				}
				this.state = 513;
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
			this.state = 519;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 27, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 516;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 517;
				this.match(SolidCashParser.T__41);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 518;
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
			this.state = 535;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 29, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 521;
				this.match(SolidCashParser.T__43);
				this.state = 522;
				this.pragmaName();
				this.state = 523;
				this.pragmaValue();
				this.state = 524;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 526;
				this.match(SolidCashParser.T__43);
				this.state = 527;
				this.match(SolidCashParser.Identifier);
				this.state = 531;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===45 || ((((_la - 140)) & ~0x1F) === 0 && ((1 << (_la - 140)) & 2081) !== 0) || _la===180) {
					{
					{
					this.state = 528;
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
					this.state = 533;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 534;
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
			this.state = 537;
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
			this.state = 548;
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
				this.state = 539;
				this.versionAlternative();
				this.state = 544;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===47) {
					{
					{
					this.state = 540;
					this.match(SolidCashParser.T__46);
					this.state = 541;
					this.versionAlternative();
					}
					}
					this.state = 546;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 547;
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
			this.state = 559;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 33, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 550;
				this.versionConstraint();
				this.state = 551;
				this.match(SolidCashParser.T__13);
				this.state = 552;
				this.versionConstraint();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 555;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 554;
					this.versionConstraint();
					}
					}
					this.state = 557;
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
			this.state = 562;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 20)) & ~0x1F) === 0 && ((1 << (_la - 20)) & 268435663) !== 0)) {
				{
				this.state = 561;
				this.versionOperator();
				}
			}

			this.state = 564;
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
			this.state = 566;
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
			this.state = 568;
			this.match(SolidCashParser.T__48);
			this.state = 569;
			this.match(SolidCashParser.Identifier);
			this.state = 579;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 570;
				this.match(SolidCashParser.T__49);
				this.state = 571;
				this.match(SolidCashParser.Identifier);
				this.state = 576;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 572;
					this.match(SolidCashParser.T__4);
					this.state = 573;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 578;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 581;
			this.match(SolidCashParser.T__3);
			this.state = 594;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 944111633) !== 0)) {
				{
				this.state = 592;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 37, this._ctx) ) {
				case 1:
					{
					this.state = 582;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 583;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 584;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 585;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 586;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 587;
					this.usingForDirective();
					}
					break;
				case 7:
					{
					this.state = 588;
					this.interfaceStateVariable();
					}
					break;
				case 8:
					{
					this.state = 589;
					this.interfaceCollection();
					}
					break;
				case 9:
					{
					this.state = 590;
					this.interfaceFunction();
					}
					break;
				case 10:
					{
					this.state = 591;
					this.interfaceFallbackDefinition();
					}
					break;
				}
				}
				this.state = 596;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 597;
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
			this.state = 609;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 39, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 599;
				this.interfaceStateVariableVisibility();
				this.state = 600;
				this.mappingType();
				this.state = 601;
				this.match(SolidCashParser.Identifier);
				this.state = 602;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 604;
				this.interfaceStateVariableVisibility();
				this.state = 605;
				this.arrayType(0);
				this.state = 606;
				this.match(SolidCashParser.Identifier);
				this.state = 607;
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
			this.state = 611;
			this.interfaceStateVariableVisibility();
			this.state = 612;
			this.typeName();
			this.state = 613;
			this.match(SolidCashParser.Identifier);
			this.state = 614;
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
			this.state = 616;
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
			this.state = 618;
			this.match(SolidCashParser.T__8);
			this.state = 619;
			this.functionName();
			this.state = 620;
			this.parameterList();
			this.state = 624;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 29)) & ~0x1F) === 0 && ((1 << (_la - 29)) & 12582919) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0)) {
				{
				{
				this.state = 621;
				this.functionModifier();
				}
				}
				this.state = 626;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 628;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 627;
				this.returnType();
				}
			}

			this.state = 630;
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
			this.state = 632;
			this.match(SolidCashParser.T__37);
			this.state = 633;
			this.parameterList();
			this.state = 637;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 634;
				this.fallbackModifier();
				}
				}
				this.state = 639;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 640;
			this.match(SolidCashParser.T__51);
			this.state = 644;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 641;
				this.fallbackModifier();
				}
				}
				this.state = 646;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 648;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 647;
				this.returnType();
				}
			}

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
	public libraryDefinition(): LibraryDefinitionContext {
		let localctx: LibraryDefinitionContext = new LibraryDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 44, SolidCashParser.RULE_libraryDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 652;
			this.match(SolidCashParser.T__52);
			this.state = 653;
			this.match(SolidCashParser.Identifier);
			this.state = 654;
			this.match(SolidCashParser.T__3);
			this.state = 667;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 944111681) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 59006977) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 665;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 45, this._ctx) ) {
				case 1:
					{
					this.state = 655;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 656;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 657;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 658;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 659;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 660;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 661;
					this.stateVariableDeclaration();
					}
					break;
				case 8:
					{
					this.state = 662;
					this.usingForDirective();
					}
					break;
				case 9:
					{
					this.state = 663;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 664;
					this.freeFunctionDefinition();
					}
					break;
				}
				}
				this.state = 669;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
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
	public contractDefinition(): ContractDefinitionContext {
		let localctx: ContractDefinitionContext = new ContractDefinitionContext(this, this._ctx, this.state);
		this.enterRule(localctx, 46, SolidCashParser.RULE_contractDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 673;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===54) {
				{
				this.state = 672;
				this.match(SolidCashParser.T__53);
				}
			}

			this.state = 675;
			this.match(SolidCashParser.T__54);
			this.state = 676;
			this.anyIdentifier();
			this.state = 678;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 677;
				this.parameterList();
				}
			}

			this.state = 689;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===50) {
				{
				this.state = 680;
				this.match(SolidCashParser.T__49);
				this.state = 681;
				this.inheritanceSpecifier();
				this.state = 686;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 682;
					this.match(SolidCashParser.T__4);
					this.state = 683;
					this.inheritanceSpecifier();
					}
					}
					this.state = 688;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 691;
			this.match(SolidCashParser.T__3);
			this.state = 708;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===9 || _la===10 || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3091595377) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 59006977) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 706;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 51, this._ctx) ) {
				case 1:
					{
					this.state = 692;
					this.enumDefinition();
					}
					break;
				case 2:
					{
					this.state = 693;
					this.structDefinition();
					}
					break;
				case 3:
					{
					this.state = 694;
					this.typeDefinition();
					}
					break;
				case 4:
					{
					this.state = 695;
					this.eventDefinition();
					}
					break;
				case 5:
					{
					this.state = 696;
					this.errorDefinition();
					}
					break;
				case 6:
					{
					this.state = 697;
					this.constantDefinition();
					}
					break;
				case 7:
					{
					this.state = 698;
					this.usingForDirective();
					}
					break;
				case 8:
					{
					this.state = 699;
					this.stateVariableDeclaration();
					}
					break;
				case 9:
					{
					this.state = 700;
					this.modifierDefinition();
					}
					break;
				case 10:
					{
					this.state = 701;
					this.constructorDefinition();
					}
					break;
				case 11:
					{
					this.state = 702;
					this.functionDefinition();
					}
					break;
				case 12:
					{
					this.state = 703;
					this.abstractFunctionDefinition();
					}
					break;
				case 13:
					{
					this.state = 704;
					this.fallbackDefinition();
					}
					break;
				case 14:
					{
					this.state = 705;
					this.receiveDefinition();
					}
					break;
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
	public inheritanceSpecifier(): InheritanceSpecifierContext {
		let localctx: InheritanceSpecifierContext = new InheritanceSpecifierContext(this, this._ctx, this.state);
		this.enterRule(localctx, 48, SolidCashParser.RULE_inheritanceSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 713;
			this.match(SolidCashParser.Identifier);
			this.state = 715;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 714;
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
			this.state = 717;
			this.match(SolidCashParser.T__8);
			this.state = 718;
			this.functionName();
			this.state = 719;
			this.parameterList();
			this.state = 724;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 29)) & ~0x1F) === 0 && ((1 << (_la - 29)) & 12582919) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0) || _la===180) {
				{
				this.state = 722;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
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
					this.state = 720;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 721;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 726;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 728;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 727;
				this.returnType();
				}
			}

			this.state = 730;
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
			this.state = 732;
			this.match(SolidCashParser.T__55);
			this.state = 735;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 57, this._ctx) ) {
			case 1:
				{
				this.state = 733;
				this.anyIdentifier();
				}
				break;
			case 2:
				{
				this.state = 734;
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
			this.state = 737;
			this.match(SolidCashParser.T__56);
			this.state = 749;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 738;
				this.eventParameter();
				this.state = 743;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 739;
						this.match(SolidCashParser.T__4);
						this.state = 740;
						this.eventParameter();
						}
						}
					}
					this.state = 745;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 58, this._ctx);
				}
				this.state = 747;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 746;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 751;
			this.match(SolidCashParser.T__57);
			this.state = 753;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===59) {
				{
				this.state = 752;
				this.match(SolidCashParser.T__58);
				}
			}

			this.state = 755;
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
			this.state = 759;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 62, this._ctx) ) {
			case 1:
				{
				this.state = 757;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 758;
				this.arrayType(0);
				}
				break;
			}
			this.state = 762;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 63, this._ctx) ) {
			case 1:
				{
				this.state = 761;
				this.match(SolidCashParser.T__59);
				}
				break;
			}
			this.state = 765;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 64, this._ctx) ) {
			case 1:
				{
				this.state = 764;
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
			this.state = 767;
			this.match(SolidCashParser.T__33);
			this.state = 768;
			this.anyIdentifier();
			this.state = 769;
			this.match(SolidCashParser.T__56);
			this.state = 781;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 770;
				this.errorParameter();
				this.state = 775;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 65, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 771;
						this.match(SolidCashParser.T__4);
						this.state = 772;
						this.errorParameter();
						}
						}
					}
					this.state = 777;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 65, this._ctx);
				}
				this.state = 779;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 778;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 783;
			this.match(SolidCashParser.T__57);
			this.state = 784;
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
			this.state = 794;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 70, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 786;
				this.typeName();
				this.state = 788;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 68, this._ctx) ) {
				case 1:
					{
					this.state = 787;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 790;
				this.arrayType(0);
				this.state = 792;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 69, this._ctx) ) {
				case 1:
					{
					this.state = 791;
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
			this.state = 796;
			this.match(SolidCashParser.T__60);
			this.state = 797;
			this.anyIdentifier();
			this.state = 798;
			this.match(SolidCashParser.T__3);
			this.state = 800;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			do {
				{
				{
				this.state = 799;
				this.structField();
				}
				}
				this.state = 802;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			} while (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180);
			this.state = 804;
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
			this.state = 809;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 72, this._ctx) ) {
			case 1:
				{
				this.state = 806;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 807;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 808;
				this.mappingType();
				}
				break;
			}
			this.state = 811;
			this.anyIdentifier();
			this.state = 812;
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
			this.state = 814;
			this.match(SolidCashParser.T__61);
			this.state = 815;
			this.anyIdentifier();
			this.state = 816;
			this.match(SolidCashParser.T__3);
			this.state = 817;
			this.enumMember();
			this.state = 822;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 73, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 818;
					this.match(SolidCashParser.T__4);
					this.state = 819;
					this.enumMember();
					}
					}
				}
				this.state = 824;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 73, this._ctx);
			}
			this.state = 826;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 825;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 828;
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
			this.state = 830;
			this.anyIdentifier();
			this.state = 833;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===48) {
				{
				this.state = 831;
				this.match(SolidCashParser.T__47);
				this.state = 832;
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
			this.state = 835;
			this.match(SolidCashParser.T__62);
			this.state = 836;
			this.anyIdentifier();
			this.state = 837;
			this.match(SolidCashParser.T__49);
			this.state = 838;
			this.typeName();
			this.state = 839;
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
			this.state = 841;
			this.typeName();
			this.state = 842;
			this.match(SolidCashParser.T__63);
			this.state = 843;
			this.anyIdentifier();
			this.state = 844;
			this.match(SolidCashParser.T__47);
			this.state = 845;
			this.expression(0);
			this.state = 846;
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
			this.state = 848;
			this.match(SolidCashParser.T__64);
			this.state = 849;
			this.parameterList();
			this.state = 853;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 850;
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
				this.state = 855;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 76, this._ctx);
			}
			this.state = 859;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 77, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 856;
					this.parentInvocation();
					}
					}
				}
				this.state = 861;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 77, this._ctx);
			}
			this.state = 865;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 98307) !== 0)) {
				{
				{
				this.state = 862;
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
				this.state = 867;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 871;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 868;
				this.customModifierInvocation();
				}
				}
				this.state = 873;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 874;
			this.match(SolidCashParser.T__3);
			this.state = 878;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 80, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 875;
					this.statement();
					}
					}
				}
				this.state = 880;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 80, this._ctx);
			}
			this.state = 881;
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
			this.state = 883;
			this.match(SolidCashParser.T__37);
			this.state = 884;
			this.parameterList();
			this.state = 888;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 885;
				this.fallbackModifier();
				}
				}
				this.state = 890;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 891;
			this.match(SolidCashParser.T__51);
			this.state = 895;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 67)) & ~0x1F) === 0 && ((1 << (_la - 67)) & 1048579) !== 0)) {
				{
				{
				this.state = 892;
				this.fallbackModifier();
				}
				}
				this.state = 897;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 901;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===180) {
				{
				{
				this.state = 898;
				this.customModifierInvocation();
				}
				}
				this.state = 903;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 905;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 904;
				this.returnType();
				}
			}

			this.state = 907;
			this.match(SolidCashParser.T__3);
			this.state = 911;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 85, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 908;
					this.statement();
					}
					}
				}
				this.state = 913;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 85, this._ctx);
			}
			this.state = 914;
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
			this.state = 919;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 67:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 916;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 917;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 918;
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
			this.state = 989;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 97, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 921;
				this.match(SolidCashParser.T__38);
				this.state = 922;
				this.match(SolidCashParser.T__56);
				this.state = 923;
				this.match(SolidCashParser.T__57);
				this.state = 927;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 924;
					this.receiveModifier();
					}
					}
					this.state = 929;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 930;
				this.match(SolidCashParser.T__51);
				this.state = 934;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 931;
					this.receiveModifier();
					}
					}
					this.state = 936;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 937;
				this.match(SolidCashParser.T__66);
				this.state = 941;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 938;
					this.receiveModifier();
					}
					}
					this.state = 943;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 953;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 944;
					this.match(SolidCashParser.T__3);
					this.state = 948;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 90, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 945;
							this.statement();
							}
							}
						}
						this.state = 950;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 90, this._ctx);
					}
					this.state = 951;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 952;
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
				this.state = 955;
				this.match(SolidCashParser.T__38);
				this.state = 956;
				this.match(SolidCashParser.T__56);
				this.state = 957;
				this.match(SolidCashParser.T__57);
				this.state = 961;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 958;
					this.receiveModifier();
					}
					}
					this.state = 963;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 964;
				this.match(SolidCashParser.T__66);
				this.state = 968;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 965;
					this.receiveModifier();
					}
					}
					this.state = 970;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 971;
				this.match(SolidCashParser.T__51);
				this.state = 975;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===68 || _la===87) {
					{
					{
					this.state = 972;
					this.receiveModifier();
					}
					}
					this.state = 977;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 987;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 4:
					{
					this.state = 978;
					this.match(SolidCashParser.T__3);
					this.state = 982;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 95, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 979;
							this.statement();
							}
							}
						}
						this.state = 984;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 95, this._ctx);
					}
					this.state = 985;
					this.match(SolidCashParser.T__5);
					}
					break;
				case 2:
					{
					this.state = 986;
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
			this.state = 993;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 68:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 991;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 992;
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
			this.state = 995;
			this.match(SolidCashParser.Identifier);
			this.state = 996;
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
			this.state = 1080;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 116, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 999;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 268468227) !== 0)) {
					{
					this.state = 998;
					this.stateVariableVisibility();
					}
				}

				this.state = 1001;
				this.typeName();
				this.state = 1006;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 1004;
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
							this.state = 1002;
							this.modifier();
							}
							break;
						case 87:
							{
							this.state = 1003;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 1008;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 101, this._ctx);
				}
				this.state = 1009;
				this.anyIdentifier();
				this.state = 1016;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1010;
					this.match(SolidCashParser.T__47);
					this.state = 1011;
					this.expression(0);
					this.state = 1014;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
						{
						this.state = 1012;
						localctx._sop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
						    localctx._sop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1013;
						this.assignChain();
						}
					}

					}
				}

				this.state = 1018;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1020;
				this.typeName();
				this.state = 1025;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===32 || _la===36 || _la===64 || _la===87 || ((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 15) !== 0)) {
					{
					this.state = 1023;
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
						this.state = 1021;
						this.modifier();
						}
						break;
					case 87:
						{
						this.state = 1022;
						this.overrideSpecifier();
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1027;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1028;
				this.stateVariableVisibility();
				this.state = 1033;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						this.state = 1031;
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
							this.state = 1029;
							this.modifier();
							}
							break;
						case 87:
							{
							this.state = 1030;
							this.overrideSpecifier();
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						}
					}
					this.state = 1035;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 107, this._ctx);
				}
				this.state = 1036;
				this.anyIdentifier();
				this.state = 1043;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1037;
					this.match(SolidCashParser.T__47);
					this.state = 1038;
					this.expression(0);
					this.state = 1041;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
						{
						this.state = 1039;
						localctx._sop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
						    localctx._sop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1040;
						this.assignChain();
						}
					}

					}
				}

				this.state = 1045;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1048;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 268468227) !== 0)) {
					{
					this.state = 1047;
					this.stateVariableVisibility();
					}
				}

				this.state = 1051;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===40) {
					{
					this.state = 1050;
					this.match(SolidCashParser.T__39);
					}
				}

				this.state = 1053;
				this.mappingType();
				this.state = 1057;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1054;
						this.collectionModifier();
						}
						}
					}
					this.state = 1059;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 112, this._ctx);
				}
				this.state = 1060;
				this.anyIdentifier();
				this.state = 1061;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1064;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 51)) & ~0x1F) === 0 && ((1 << (_la - 51)) & 268468227) !== 0)) {
					{
					this.state = 1063;
					this.stateVariableVisibility();
					}
				}

				this.state = 1066;
				this.arrayType(0);
				this.state = 1070;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1067;
						this.collectionModifier();
						}
						}
					}
					this.state = 1072;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 114, this._ctx);
				}
				this.state = 1073;
				this.anyIdentifier();
				this.state = 1076;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1074;
					this.match(SolidCashParser.T__47);
					this.state = 1075;
					this.expression(0);
					}
				}

				this.state = 1078;
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
			this.state = 1085;
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
				this.state = 1082;
				this.modifier();
				}
				break;
			case 51:
			case 52:
			case 66:
			case 79:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1083;
				this.stateVariableVisibility();
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1084;
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
			this.state = 1087;
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
			this.state = 1128;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 124, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1089;
				this.match(SolidCashParser.T__79);
				this.state = 1090;
				this.match(SolidCashParser.T__56);
				this.state = 1091;
				this.typeName();
				this.state = 1093;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 118, this._ctx) ) {
				case 1:
					{
					this.state = 1092;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1095;
				this.match(SolidCashParser.T__80);
				this.state = 1096;
				this.typeName();
				this.state = 1098;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 119, this._ctx) ) {
				case 1:
					{
					this.state = 1097;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1100;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1102;
				this.match(SolidCashParser.T__79);
				this.state = 1103;
				this.match(SolidCashParser.T__56);
				this.state = 1104;
				this.typeName();
				this.state = 1106;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 120, this._ctx) ) {
				case 1:
					{
					this.state = 1105;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1108;
				this.match(SolidCashParser.T__80);
				this.state = 1109;
				this.mappingType();
				this.state = 1111;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 121, this._ctx) ) {
				case 1:
					{
					this.state = 1110;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1113;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1115;
				this.match(SolidCashParser.T__79);
				this.state = 1116;
				this.match(SolidCashParser.T__56);
				this.state = 1117;
				this.typeName();
				this.state = 1119;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 122, this._ctx) ) {
				case 1:
					{
					this.state = 1118;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1121;
				this.match(SolidCashParser.T__80);
				this.state = 1122;
				this.arrayType(0);
				this.state = 1124;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 123, this._ctx) ) {
				case 1:
					{
					this.state = 1123;
					this.anyIdentifier();
					}
					break;
				}
				this.state = 1126;
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
			this.state = 1152;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 128, this._ctx) ) {
			case 1:
				{
				this.state = 1131;
				this.functionType();
				this.state = 1132;
				this.match(SolidCashParser.T__81);
				this.state = 1134;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 125, this._ctx) ) {
				case 1:
					{
					this.state = 1133;
					this.expression(0);
					}
					break;
				}
				this.state = 1136;
				this.match(SolidCashParser.T__82);
				}
				break;
			case 2:
				{
				this.state = 1138;
				this.typeName();
				this.state = 1139;
				this.match(SolidCashParser.T__81);
				this.state = 1141;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 126, this._ctx) ) {
				case 1:
					{
					this.state = 1140;
					this.expression(0);
					}
					break;
				}
				this.state = 1143;
				this.match(SolidCashParser.T__82);
				}
				break;
			case 3:
				{
				this.state = 1145;
				this.mappingType();
				this.state = 1146;
				this.match(SolidCashParser.T__81);
				this.state = 1148;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 127, this._ctx) ) {
				case 1:
					{
					this.state = 1147;
					this.expression(0);
					}
					break;
				}
				this.state = 1150;
				this.match(SolidCashParser.T__82);
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 1162;
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
					this.state = 1154;
					if (!(this.precpred(this._ctx, 1))) {
						throw this.createFailedPredicateException("this.precpred(this._ctx, 1)");
					}
					this.state = 1155;
					this.match(SolidCashParser.T__81);
					this.state = 1157;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 129, this._ctx) ) {
					case 1:
						{
						this.state = 1156;
						this.expression(0);
						}
						break;
					}
					this.state = 1159;
					this.match(SolidCashParser.T__82);
					}
					}
				}
				this.state = 1164;
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
			this.state = 1165;
			this.match(SolidCashParser.T__83);
			this.state = 1166;
			this.match(SolidCashParser.Identifier);
			this.state = 1168;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1167;
				this.parameterList();
				}
			}

			this.state = 1174;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===68 || _la===87) {
				{
				this.state = 1172;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case 68:
					{
					this.state = 1170;
					this.match(SolidCashParser.T__67);
					}
					break;
				case 87:
					{
					this.state = 1171;
					this.overrideSpecifier();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1176;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1186;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 4:
				{
				this.state = 1177;
				this.match(SolidCashParser.T__3);
				this.state = 1181;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1178;
						this.modifierStatement();
						}
						}
					}
					this.state = 1183;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 134, this._ctx);
				}
				this.state = 1184;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				{
				this.state = 1185;
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
			this.state = 1190;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 136, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1188;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1189;
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
			this.state = 1192;
			this.match(SolidCashParser.T__42);
			this.state = 1193;
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
			this.state = 1195;
			this.match(SolidCashParser.T__8);
			this.state = 1196;
			this.functionName();
			this.state = 1197;
			this.parameterList();
			this.state = 1202;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 29)) & ~0x1F) === 0 && ((1 << (_la - 29)) & 12582919) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 3678215) !== 0) || _la===180) {
				{
				this.state = 1200;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
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
					this.state = 1198;
					this.functionModifier();
					}
					break;
				case 180:
					{
					this.state = 1199;
					this.customModifierInvocation();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 1204;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1206;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===88) {
				{
				this.state = 1205;
				this.returnType();
				}
			}

			this.state = 1208;
			this.match(SolidCashParser.T__3);
			this.state = 1212;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1209;
					this.statement();
					}
					}
				}
				this.state = 1214;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 140, this._ctx);
			}
			this.state = 1215;
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
			this.state = 1219;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 141, this._ctx) ) {
			case 1:
				{
				this.state = 1217;
				this.match(SolidCashParser.Identifier);
				this.state = 1218;
				this.match(SolidCashParser.T__6);
				}
				break;
			}
			this.state = 1221;
			this.match(SolidCashParser.Identifier);
			this.state = 1223;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1222;
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
			this.state = 1237;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 85:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1225;
				this.match(SolidCashParser.T__84);
				}
				break;
			case 86:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1226;
				this.match(SolidCashParser.T__85);
				}
				break;
			case 66:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1227;
				this.match(SolidCashParser.T__65);
				}
				break;
			case 52:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1228;
				this.match(SolidCashParser.T__51);
				}
				break;
			case 51:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1229;
				this.match(SolidCashParser.T__50);
				}
				break;
			case 79:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1230;
				this.match(SolidCashParser.T__78);
				}
				break;
			case 67:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1231;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 87:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1232;
				this.overrideSpecifier();
				}
				break;
			case 68:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1233;
				this.match(SolidCashParser.T__67);
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1234;
				this.unsafeModifier();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1235;
				this.match(SolidCashParser.T__28);
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1236;
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
		this.enterRule(localctx, 106, SolidCashParser.RULE_overrideSpecifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1239;
			this.match(SolidCashParser.T__86);
			this.state = 1250;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 145, this._ctx) ) {
			case 1:
				{
				this.state = 1240;
				this.match(SolidCashParser.T__56);
				this.state = 1241;
				this.match(SolidCashParser.Identifier);
				this.state = 1246;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1242;
					this.match(SolidCashParser.T__4);
					this.state = 1243;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1248;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1249;
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
			this.state = 1252;
			this.match(SolidCashParser.T__30);
			this.state = 1256;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 1253;
				this.match(SolidCashParser.T__56);
				this.state = 1254;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 1255;
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
			this.state = 1258;
			this.match(SolidCashParser.T__87);
			this.state = 1259;
			this.match(SolidCashParser.T__56);
			this.state = 1260;
			this.returnParam();
			this.state = 1265;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 147, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1261;
					this.match(SolidCashParser.T__4);
					this.state = 1262;
					this.returnParam();
					}
					}
				}
				this.state = 1267;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 147, this._ctx);
			}
			this.state = 1269;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 1268;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 1271;
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
			this.state = 1303;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 155, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1273;
				this.typeName();
				this.state = 1277;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1274;
						this.modifier();
						}
						}
					}
					this.state = 1279;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 149, this._ctx);
				}
				this.state = 1281;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 150, this._ctx) ) {
				case 1:
					{
					this.state = 1280;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1283;
				this.arrayType(0);
				this.state = 1287;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 151, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1284;
						this.modifier();
						}
						}
					}
					this.state = 1289;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 151, this._ctx);
				}
				this.state = 1291;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 152, this._ctx) ) {
				case 1:
					{
					this.state = 1290;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1293;
				this.mappingType();
				this.state = 1297;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1294;
						this.modifier();
						}
						}
					}
					this.state = 1299;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 153, this._ctx);
				}
				this.state = 1301;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 154, this._ctx) ) {
				case 1:
					{
					this.state = 1300;
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
			this.state = 1305;
			this.match(SolidCashParser.T__56);
			this.state = 1317;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 1306;
				this.parameter();
				this.state = 1311;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1307;
						this.match(SolidCashParser.T__4);
						this.state = 1308;
						this.parameter();
						}
						}
					}
					this.state = 1313;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 156, this._ctx);
				}
				this.state = 1315;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1314;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 1319;
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
			this.state = 1351;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 165, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1321;
				this.typeName();
				this.state = 1325;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1322;
						this.modifier();
						}
						}
					}
					this.state = 1327;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 159, this._ctx);
				}
				this.state = 1329;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 160, this._ctx) ) {
				case 1:
					{
					this.state = 1328;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1331;
				this.arrayType(0);
				this.state = 1335;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1332;
						this.modifier();
						}
						}
					}
					this.state = 1337;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 161, this._ctx);
				}
				this.state = 1339;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 162, this._ctx) ) {
				case 1:
					{
					this.state = 1338;
					this.anyIdentifier();
					}
					break;
				}
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1341;
				this.mappingType();
				this.state = 1345;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1342;
						this.modifier();
						}
						}
					}
					this.state = 1347;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 163, this._ctx);
				}
				this.state = 1349;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 164, this._ctx) ) {
				case 1:
					{
					this.state = 1348;
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
			this.state = 1362;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 167, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1353;
				this.match(SolidCashParser.T__3);
				this.state = 1357;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1354;
						this.statement();
						}
						}
					}
					this.state = 1359;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 166, this._ctx);
				}
				this.state = 1360;
				this.match(SolidCashParser.T__5);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1361;
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
			this.state = 1364;
			this.match(SolidCashParser.T__3);
			this.state = 1368;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 168, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1365;
					this.statement();
					}
					}
				}
				this.state = 1370;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 168, this._ctx);
			}
			this.state = 1371;
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
			this.state = 1404;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 169, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1373;
				this.placeholderStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1374;
				this.blockStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1375;
				this.bareTypeExpressionStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1376;
				this.primitiveTypeReferenceStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1377;
				this.userDefinedArrayTypeReferenceStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1378;
				this.variableDefinition();
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1379;
				this.nestedTupleAssignment();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1380;
				this.tupleAssignment();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1381;
				this.prefixIncDecStatement();
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1382;
				this.timeOpStatement();
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1383;
				this.requireStatement();
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 1384;
				this.ifStatement();
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 1385;
				this.loopStatement();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 1386;
				this.consoleStatement();
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 1387;
				this.emitStatement();
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 1388;
				this.returnStatement();
				}
				break;
			case 17:
				this.enterOuterAlt(localctx, 17);
				{
				this.state = 1389;
				this.selfdestructStatement();
				}
				break;
			case 18:
				this.enterOuterAlt(localctx, 18);
				{
				this.state = 1390;
				this.assemblyStatement();
				}
				break;
			case 19:
				this.enterOuterAlt(localctx, 19);
				{
				this.state = 1391;
				this.tryCatchStatement();
				}
				break;
			case 20:
				this.enterOuterAlt(localctx, 20);
				{
				this.state = 1392;
				this.revertStatement();
				}
				break;
			case 21:
				this.enterOuterAlt(localctx, 21);
				{
				this.state = 1393;
				this.assertStatement();
				}
				break;
			case 22:
				this.enterOuterAlt(localctx, 22);
				{
				this.state = 1394;
				this.deleteStatement();
				}
				break;
			case 23:
				this.enterOuterAlt(localctx, 23);
				{
				this.state = 1395;
				this.uncheckedStatement();
				}
				break;
			case 24:
				this.enterOuterAlt(localctx, 24);
				{
				this.state = 1396;
				this.switchStatement();
				}
				break;
			case 25:
				this.enterOuterAlt(localctx, 25);
				{
				this.state = 1397;
				this.breakStatement();
				}
				break;
			case 26:
				this.enterOuterAlt(localctx, 26);
				{
				this.state = 1398;
				this.continueStatement();
				}
				break;
			case 27:
				this.enterOuterAlt(localctx, 27);
				{
				this.state = 1399;
				this.bareAbiFunctionReferenceStatement();
				}
				break;
			case 28:
				this.enterOuterAlt(localctx, 28);
				{
				this.state = 1400;
				this.bareCallOptionsStatement();
				}
				break;
			case 29:
				this.enterOuterAlt(localctx, 29);
				{
				this.state = 1401;
				this.bareNewWithOptionsStatement();
				}
				break;
			case 30:
				this.enterOuterAlt(localctx, 30);
				{
				this.state = 1402;
				this.parenthesizedArrayPopStatement();
				}
				break;
			case 31:
				this.enterOuterAlt(localctx, 31);
				{
				this.state = 1403;
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
			this.state = 1433;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 89:
			case 90:
			case 91:
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
				this.state = 1406;
				this.elementaryTypeToken();
				this.state = 1414;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===82) {
					{
					{
					this.state = 1407;
					this.match(SolidCashParser.T__81);
					this.state = 1409;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 170, this._ctx) ) {
					case 1:
						{
						this.state = 1408;
						this.expression(0);
						}
						break;
					}
					this.state = 1411;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1416;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1417;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 57:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1419;
				this.match(SolidCashParser.T__56);
				this.state = 1420;
				this.elementaryTypeToken();
				this.state = 1426;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1421;
					this.match(SolidCashParser.T__81);
					this.state = 1423;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 172, this._ctx) ) {
					case 1:
						{
						this.state = 1422;
						this.expression(0);
						}
						break;
					}
					this.state = 1425;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1428;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 1430;
				this.match(SolidCashParser.T__57);
				this.state = 1431;
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
			this.state = 1435;
			this.match(SolidCashParser.Identifier);
			this.state = 1443;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 176, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 1436;
					this.match(SolidCashParser.T__81);
					this.state = 1438;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 175, this._ctx) ) {
					case 1:
						{
						this.state = 1437;
						this.expression(0);
						}
						break;
					}
					this.state = 1440;
					this.match(SolidCashParser.T__82);
					}
					}
				}
				this.state = 1445;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 176, this._ctx);
			}
			this.state = 1446;
			this.match(SolidCashParser.T__81);
			this.state = 1447;
			this.match(SolidCashParser.T__82);
			this.state = 1455;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===82) {
				{
				{
				this.state = 1448;
				this.match(SolidCashParser.T__81);
				this.state = 1450;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 177, this._ctx) ) {
				case 1:
					{
					this.state = 1449;
					this.expression(0);
					}
					break;
				}
				this.state = 1452;
				this.match(SolidCashParser.T__82);
				}
				}
				this.state = 1457;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1458;
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
			this.state = 1474;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 146:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1460;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 147:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1461;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 149:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1462;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 148:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1463;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 156:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1464;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 157:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1465;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 158:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 1466;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 159:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 1467;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 89:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 1468;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 90:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 1469;
				this.match(SolidCashParser.T__89);
				}
				break;
			case 91:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 1470;
				this.match(SolidCashParser.T__90);
				this.state = 1472;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===67) {
					{
					this.state = 1471;
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
			this.state = 1476;
			this.match(SolidCashParser.T__62);
			this.state = 1477;
			this.match(SolidCashParser.T__56);
			this.state = 1478;
			this.typeName();
			this.state = 1479;
			this.match(SolidCashParser.T__57);
			this.state = 1480;
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
			this.state = 1482;
			this.expression(0);
			this.state = 1483;
			this.match(SolidCashParser.T__6);
			this.state = 1484;
			this.match(SolidCashParser.Identifier);
			this.state = 1485;
			this.callOptions();
			this.state = 1487;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===7) {
				{
				this.state = 1486;
				this.callOptionsFunctionMember();
				}
			}

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
	public callOptionsFunctionMember(): CallOptionsFunctionMemberContext {
		let localctx: CallOptionsFunctionMemberContext = new CallOptionsFunctionMemberContext(this, this._ctx, this.state);
		this.enterRule(localctx, 134, SolidCashParser.RULE_callOptionsFunctionMember);
		try {
			this.state = 1495;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 182, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1491;
				this.match(SolidCashParser.T__6);
				this.state = 1492;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1493;
				this.match(SolidCashParser.T__6);
				this.state = 1494;
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
			this.state = 1497;
			this.match(SolidCashParser.T__91);
			this.state = 1498;
			this.match(SolidCashParser.Identifier);
			this.state = 1499;
			this.callOptions();
			this.state = 1500;
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
			this.state = 1502;
			this.match(SolidCashParser.T__56);
			this.state = 1505;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===42) {
				{
				this.state = 1503;
				this.match(SolidCashParser.T__41);
				this.state = 1504;
				this.match(SolidCashParser.T__6);
				}
			}

			this.state = 1507;
			this.match(SolidCashParser.Identifier);
			this.state = 1508;
			this.match(SolidCashParser.DotPop);
			this.state = 1509;
			this.match(SolidCashParser.T__57);
			this.state = 1510;
			this.match(SolidCashParser.T__56);
			this.state = 1511;
			this.match(SolidCashParser.T__57);
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
	public expressionStatement(): ExpressionStatementContext {
		let localctx: ExpressionStatementContext = new ExpressionStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 140, SolidCashParser.RULE_expressionStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1514;
			this.expression(0);
			this.state = 1595;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 191, this._ctx) ) {
			case 1:
				{
				this.state = 1515;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1516;
				this.assignChain();
				}
				break;
			case 2:
				{
				this.state = 1517;
				this.match(SolidCashParser.DotPush);
				this.state = 1518;
				this.match(SolidCashParser.T__56);
				this.state = 1519;
				this.match(SolidCashParser.T__57);
				this.state = 1520;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1521;
				this.match(SolidCashParser.T__56);
				this.state = 1522;
				this.match(SolidCashParser.T__57);
				this.state = 1523;
				localctx._third = this.match(SolidCashParser.DotPush);
				this.state = 1524;
				this.match(SolidCashParser.T__56);
				this.state = 1525;
				this.match(SolidCashParser.T__57);
				this.state = 1528;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1526;
					this.match(SolidCashParser.T__47);
					this.state = 1527;
					this.expression(0);
					}
				}

				}
				break;
			case 3:
				{
				this.state = 1530;
				this.match(SolidCashParser.DotPush);
				this.state = 1531;
				this.match(SolidCashParser.T__56);
				this.state = 1532;
				this.match(SolidCashParser.T__57);
				this.state = 1533;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1534;
				this.match(SolidCashParser.T__56);
				this.state = 1535;
				this.match(SolidCashParser.T__57);
				this.state = 1536;
				this.match(SolidCashParser.T__47);
				this.state = 1537;
				this.expression(0);
				this.state = 1546;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1538;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1539;
					this.match(SolidCashParser.T__56);
					this.state = 1540;
					this.match(SolidCashParser.T__57);
					this.state = 1544;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1541;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1542;
						this.match(SolidCashParser.T__56);
						this.state = 1543;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				}
				break;
			case 4:
				{
				this.state = 1548;
				this.match(SolidCashParser.DotPush);
				this.state = 1549;
				this.match(SolidCashParser.T__56);
				this.state = 1550;
				this.match(SolidCashParser.T__57);
				this.state = 1551;
				localctx._second = this.match(SolidCashParser.DotPush);
				this.state = 1552;
				this.match(SolidCashParser.T__56);
				this.state = 1554;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 187, this._ctx) ) {
				case 1:
					{
					this.state = 1553;
					this.pushArgument();
					}
					break;
				}
				this.state = 1556;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 5:
				{
				this.state = 1557;
				this.match(SolidCashParser.DotPush);
				this.state = 1558;
				this.match(SolidCashParser.T__56);
				this.state = 1559;
				this.match(SolidCashParser.T__57);
				this.state = 1560;
				this.match(SolidCashParser.T__6);
				this.state = 1561;
				localctx._pushField = this.anyIdentifier();
				this.state = 1562;
				this.match(SolidCashParser.T__47);
				this.state = 1563;
				this.expression(0);
				}
				break;
			case 6:
				{
				this.state = 1565;
				this.match(SolidCashParser.DotPush);
				this.state = 1566;
				this.match(SolidCashParser.T__56);
				this.state = 1567;
				this.match(SolidCashParser.T__57);
				this.state = 1568;
				localctx._pushAssignOp = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._pushAssignOp = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1569;
				this.expression(0);
				this.state = 1578;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1570;
					localctx._rhsPush = this.match(SolidCashParser.DotPush);
					this.state = 1571;
					this.match(SolidCashParser.T__56);
					this.state = 1572;
					this.match(SolidCashParser.T__57);
					this.state = 1576;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1573;
						localctx._rhsPush2 = this.match(SolidCashParser.DotPush);
						this.state = 1574;
						this.match(SolidCashParser.T__56);
						this.state = 1575;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				}
				break;
			case 7:
				{
				this.state = 1580;
				this.match(SolidCashParser.DotPush);
				this.state = 1581;
				this.match(SolidCashParser.T__56);
				this.state = 1583;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 190, this._ctx) ) {
				case 1:
					{
					this.state = 1582;
					this.pushArgument();
					}
					break;
				}
				this.state = 1585;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 8:
				{
				this.state = 1586;
				this.match(SolidCashParser.DotPop);
				this.state = 1587;
				this.match(SolidCashParser.T__56);
				this.state = 1588;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 9:
				{
				this.state = 1589;
				this.match(SolidCashParser.DotDelete);
				this.state = 1590;
				this.match(SolidCashParser.T__56);
				this.state = 1591;
				this.expression(0);
				this.state = 1592;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 10:
				{
				this.state = 1594;
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
	public assignChain(): AssignChainContext {
		let localctx: AssignChainContext = new AssignChainContext(this, this._ctx, this.state);
		this.enterRule(localctx, 142, SolidCashParser.RULE_assignChain);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1599;
			this.expression(0);
			this.state = 1602;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 192, this._ctx) ) {
			case 1:
				{
				this.state = 1600;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1601;
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
			this.state = 1604;
			localctx._op = this._input.LT(1);
			_la = this._input.LA(1);
			if(!(_la===93 || _la===94)) {
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
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
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
			this.state = 1649;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 196, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1608;
				this.match(SolidCashParser.T__94);
				this.state = 1609;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1610;
				this.match(SolidCashParser.T__94);
				this.state = 1611;
				localctx._pushBase = this.match(SolidCashParser.Identifier);
				this.state = 1612;
				this.match(SolidCashParser.DotPush);
				this.state = 1613;
				this.match(SolidCashParser.T__56);
				this.state = 1614;
				this.match(SolidCashParser.T__57);
				this.state = 1615;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1616;
				this.match(SolidCashParser.T__94);
				this.state = 1617;
				this.expression(0);
				this.state = 1618;
				localctx._rop = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._rop = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 1619;
				this.assignChain();
				this.state = 1620;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1622;
				this.match(SolidCashParser.T__94);
				this.state = 1623;
				this.expression(0);
				this.state = 1628;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 1624;
					this.match(SolidCashParser.T__4);
					this.state = 1625;
					this.expression(0);
					}
					}
					this.state = 1630;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 1631;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1633;
				this.match(SolidCashParser.T__94);
				this.state = 1634;
				this.match(SolidCashParser.T__56);
				this.state = 1635;
				this.expression(0);
				this.state = 1640;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 194, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1636;
						this.match(SolidCashParser.T__4);
						this.state = 1637;
						this.expression(0);
						}
						}
					}
					this.state = 1642;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 194, this._ctx);
				}
				this.state = 1644;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 1643;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 1646;
				this.match(SolidCashParser.T__57);
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
	public selfdestructStatement(): SelfdestructStatementContext {
		let localctx: SelfdestructStatementContext = new SelfdestructStatementContext(this, this._ctx, this.state);
		this.enterRule(localctx, 148, SolidCashParser.RULE_selfdestructStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 1651;
			this.match(SolidCashParser.T__29);
			this.state = 1652;
			this.match(SolidCashParser.T__56);
			this.state = 1653;
			this.expression(0);
			this.state = 1654;
			this.match(SolidCashParser.T__57);
			this.state = 1655;
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
			this.state = 1690;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 202, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1657;
				this.match(SolidCashParser.T__95);
				this.state = 1658;
				this.match(SolidCashParser.Identifier);
				this.state = 1661;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 1659;
					this.match(SolidCashParser.T__6);
					this.state = 1660;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1663;
				this.match(SolidCashParser.T__56);
				this.state = 1664;
				this.match(SolidCashParser.T__3);
				this.state = 1676;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 1665;
					this.namedArg();
					this.state = 1670;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 198, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 1666;
							this.match(SolidCashParser.T__4);
							this.state = 1667;
							this.namedArg();
							}
							}
						}
						this.state = 1672;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 198, this._ctx);
					}
					this.state = 1674;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 1673;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 1678;
				this.match(SolidCashParser.T__5);
				this.state = 1679;
				this.match(SolidCashParser.T__57);
				this.state = 1680;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1681;
				this.match(SolidCashParser.T__95);
				this.state = 1682;
				this.match(SolidCashParser.Identifier);
				this.state = 1685;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 1683;
					this.match(SolidCashParser.T__6);
					this.state = 1684;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 1687;
				this.expressionList();
				this.state = 1688;
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
			this.state = 1765;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 214, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1692;
				this.functionArrayType();
				this.state = 1696;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 203, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1693;
						this.modifier();
						}
						}
					}
					this.state = 1698;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 203, this._ctx);
				}
				this.state = 1699;
				this.anyIdentifier();
				this.state = 1707;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1700;
					this.match(SolidCashParser.T__47);
					this.state = 1701;
					this.expression(0);
					this.state = 1705;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1702;
						this.match(SolidCashParser.DotPush);
						this.state = 1703;
						this.match(SolidCashParser.T__56);
						this.state = 1704;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				this.state = 1709;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1711;
				this.arrayType(0);
				this.state = 1715;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1712;
						this.modifier();
						}
						}
					}
					this.state = 1717;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 206, this._ctx);
				}
				this.state = 1718;
				this.anyIdentifier();
				this.state = 1726;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1719;
					this.match(SolidCashParser.T__47);
					this.state = 1720;
					this.expression(0);
					this.state = 1724;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===165) {
						{
						this.state = 1721;
						this.match(SolidCashParser.DotPush);
						this.state = 1722;
						this.match(SolidCashParser.T__56);
						this.state = 1723;
						this.match(SolidCashParser.T__57);
						}
					}

					}
				}

				this.state = 1728;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1730;
				this.typeName();
				this.state = 1734;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 209, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1731;
						this.modifier();
						}
						}
					}
					this.state = 1736;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 209, this._ctx);
				}
				this.state = 1737;
				this.anyIdentifier();
				this.state = 1747;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1738;
					this.match(SolidCashParser.T__47);
					this.state = 1739;
					this.expression(0);
					this.state = 1745;
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
						this.state = 1740;
						localctx._iop = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
						    localctx._iop = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 1741;
						this.assignChain();
						}
						break;
					case 165:
						{
						this.state = 1742;
						this.match(SolidCashParser.DotPush);
						this.state = 1743;
						this.match(SolidCashParser.T__56);
						this.state = 1744;
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

				this.state = 1749;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1751;
				this.mappingType();
				this.state = 1755;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1752;
						this.modifier();
						}
						}
					}
					this.state = 1757;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 212, this._ctx);
				}
				this.state = 1758;
				this.anyIdentifier();
				this.state = 1761;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 1759;
					this.match(SolidCashParser.T__47);
					this.state = 1760;
					this.expression(0);
					}
				}

				this.state = 1763;
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
			this.state = 1767;
			this.functionType();
			this.state = 1773;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 1768;
					this.match(SolidCashParser.T__81);
					this.state = 1770;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 215, this._ctx) ) {
					case 1:
						{
						this.state = 1769;
						this.expression(0);
						}
						break;
					}
					this.state = 1772;
					this.match(SolidCashParser.T__82);
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 1775;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 216, this._ctx);
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
			this.state = 1853;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 223, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1777;
				this.typeName();
				this.state = 1778;
				this.match(SolidCashParser.Identifier);
				this.state = 1783;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1779;
					this.match(SolidCashParser.T__4);
					this.state = 1780;
					this.typeName();
					this.state = 1781;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 1785;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1787;
				this.match(SolidCashParser.T__47);
				this.state = 1788;
				this.expression(0);
				this.state = 1789;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1791;
				this.match(SolidCashParser.T__56);
				this.state = 1792;
				this.tupleSlot();
				this.state = 1795;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1793;
					this.match(SolidCashParser.T__4);
					this.state = 1794;
					this.tupleSlot();
					}
					}
					this.state = 1797;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1799;
				this.match(SolidCashParser.T__57);
				this.state = 1800;
				this.match(SolidCashParser.T__47);
				this.state = 1801;
				this.match(SolidCashParser.T__56);
				this.state = 1802;
				this.expression(0);
				this.state = 1805;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1803;
					this.match(SolidCashParser.T__4);
					this.state = 1804;
					this.expression(0);
					}
					}
					this.state = 1807;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1809;
				this.match(SolidCashParser.T__57);
				this.state = 1810;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1812;
				this.match(SolidCashParser.T__56);
				this.state = 1813;
				this.tupleSlot();
				this.state = 1816;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1814;
					this.match(SolidCashParser.T__4);
					this.state = 1815;
					this.tupleSlot();
					}
					}
					this.state = 1818;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 1820;
				this.match(SolidCashParser.T__57);
				this.state = 1821;
				this.match(SolidCashParser.T__47);
				this.state = 1822;
				this.expression(0);
				this.state = 1823;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1825;
				this.match(SolidCashParser.T__56);
				this.state = 1826;
				this.typeName();
				this.state = 1830;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1827;
						this.modifier();
						}
						}
					}
					this.state = 1832;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 221, this._ctx);
				}
				this.state = 1833;
				this.anyIdentifier();
				this.state = 1834;
				this.match(SolidCashParser.T__57);
				this.state = 1835;
				this.match(SolidCashParser.T__47);
				this.state = 1836;
				this.expression(0);
				this.state = 1837;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1839;
				this.match(SolidCashParser.T__56);
				this.state = 1840;
				this.arrayType(0);
				this.state = 1844;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1841;
						this.modifier();
						}
						}
					}
					this.state = 1846;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 222, this._ctx);
				}
				this.state = 1847;
				this.anyIdentifier();
				this.state = 1848;
				this.match(SolidCashParser.T__57);
				this.state = 1849;
				this.match(SolidCashParser.T__47);
				this.state = 1850;
				this.expression(0);
				this.state = 1851;
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
			this.state = 1855;
			if (!(this.hasNestedTuplePatternAhead())) {
				throw this.createFailedPredicateException("this.hasNestedTuplePatternAhead()");
			}
			this.state = 1856;
			this.nestedTuplePattern();
			this.state = 1857;
			this.match(SolidCashParser.T__47);
			this.state = 1858;
			this.expression(0);
			this.state = 1859;
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
			this.state = 1861;
			this.match(SolidCashParser.T__56);
			this.state = 1863;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 224, this._ctx) ) {
			case 1:
				{
				this.state = 1862;
				this.nestedTuplePatternItem();
				}
				break;
			}
			this.state = 1871;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 1865;
				this.match(SolidCashParser.T__4);
				this.state = 1867;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 225, this._ctx) ) {
				case 1:
					{
					this.state = 1866;
					this.nestedTuplePatternItem();
					}
					break;
				}
				}
				}
				this.state = 1873;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 1874;
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
			this.state = 1910;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 231, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1876;
				this.typeName();
				this.state = 1880;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1877;
						this.modifier();
						}
						}
					}
					this.state = 1882;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 227, this._ctx);
				}
				this.state = 1883;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1885;
				this.arrayType(0);
				this.state = 1889;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1886;
						this.modifier();
						}
						}
					}
					this.state = 1891;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 228, this._ctx);
				}
				this.state = 1892;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1894;
				this.anyIdentifier();
				this.state = 1906;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===7 || _la===82 || _la===165) {
					{
					this.state = 1904;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 82:
						{
						this.state = 1895;
						this.match(SolidCashParser.T__81);
						this.state = 1896;
						this.expression(0);
						this.state = 1897;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 7:
						{
						this.state = 1899;
						this.match(SolidCashParser.T__6);
						this.state = 1900;
						this.anyIdentifier();
						}
						break;
					case 165:
						{
						this.state = 1901;
						this.match(SolidCashParser.DotPush);
						this.state = 1902;
						this.match(SolidCashParser.T__56);
						this.state = 1903;
						this.match(SolidCashParser.T__57);
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1908;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1909;
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
			this.state = 1946;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 236, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1912;
				this.typeName();
				this.state = 1916;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1913;
						this.modifier();
						}
						}
					}
					this.state = 1918;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 232, this._ctx);
				}
				this.state = 1919;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1921;
				this.arrayType(0);
				this.state = 1925;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 233, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 1922;
						this.modifier();
						}
						}
					}
					this.state = 1927;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 233, this._ctx);
				}
				this.state = 1928;
				this.anyIdentifier();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1930;
				this.anyIdentifier();
				this.state = 1942;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===7 || _la===82 || _la===165) {
					{
					this.state = 1940;
					this._errHandler.sync(this);
					switch (this._input.LA(1)) {
					case 82:
						{
						this.state = 1931;
						this.match(SolidCashParser.T__81);
						this.state = 1932;
						this.expression(0);
						this.state = 1933;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 7:
						{
						this.state = 1935;
						this.match(SolidCashParser.T__6);
						this.state = 1936;
						this.anyIdentifier();
						}
						break;
					case 165:
						{
						this.state = 1937;
						this.match(SolidCashParser.DotPush);
						this.state = 1938;
						this.match(SolidCashParser.T__56);
						this.state = 1939;
						this.match(SolidCashParser.T__57);
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					}
					this.state = 1944;
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
			this.state = 1948;
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
			this.state = 2055;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 246, this._ctx) ) {
			case 1:
				localctx = new DeletePushContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 1950;
				this.match(SolidCashParser.T__96);
				this.state = 1951;
				this.match(SolidCashParser.Identifier);
				this.state = 1952;
				this.match(SolidCashParser.DotPush);
				this.state = 1953;
				this.match(SolidCashParser.T__56);
				this.state = 1954;
				this.match(SolidCashParser.T__57);
				this.state = 1958;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===165) {
					{
					this.state = 1955;
					(localctx as DeletePushContext)._second = this.match(SolidCashParser.DotPush);
					this.state = 1956;
					this.match(SolidCashParser.T__56);
					this.state = 1957;
					this.match(SolidCashParser.T__57);
					}
				}

				this.state = 1960;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				localctx = new DeleteLocalContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 1961;
				this.match(SolidCashParser.T__96);
				this.state = 1962;
				this.match(SolidCashParser.Identifier);
				this.state = 1963;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				localctx = new DeleteParenthesizedContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 1964;
				this.match(SolidCashParser.T__96);
				this.state = 1965;
				this.match(SolidCashParser.T__56);
				this.state = 1966;
				this.expression(0);
				this.state = 1967;
				this.match(SolidCashParser.T__57);
				this.state = 1968;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				localctx = new DeleteStateContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 1970;
				this.match(SolidCashParser.T__96);
				this.state = 1971;
				this.match(SolidCashParser.T__41);
				this.state = 1972;
				this.match(SolidCashParser.T__6);
				this.state = 1973;
				this.match(SolidCashParser.Identifier);
				this.state = 1974;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 5:
				localctx = new DeleteMappingEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 1975;
				this.match(SolidCashParser.T__96);
				this.state = 1976;
				this.match(SolidCashParser.T__41);
				this.state = 1977;
				this.match(SolidCashParser.T__6);
				this.state = 1978;
				this.match(SolidCashParser.Identifier);
				this.state = 1983;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1979;
					this.match(SolidCashParser.T__81);
					this.state = 1980;
					this.expression(0);
					this.state = 1981;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1985;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 1987;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 6:
				localctx = new DeleteDeepMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 1989;
				this.match(SolidCashParser.T__96);
				this.state = 1990;
				this.match(SolidCashParser.Identifier);
				this.state = 1995;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1991;
					this.match(SolidCashParser.T__81);
					this.state = 1992;
					this.expression(0);
					this.state = 1993;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 1997;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2010;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 1999;
					this.match(SolidCashParser.T__6);
					this.state = 2000;
					this.match(SolidCashParser.Identifier);
					this.state = 2007;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					while (_la===82) {
						{
						{
						this.state = 2001;
						this.match(SolidCashParser.T__81);
						this.state = 2002;
						this.expression(0);
						this.state = 2003;
						this.match(SolidCashParser.T__82);
						}
						}
						this.state = 2009;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					}
					}
					}
					this.state = 2012;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 2014;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 7:
				localctx = new DeleteIndexedContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2016;
				this.match(SolidCashParser.T__96);
				this.state = 2017;
				this.match(SolidCashParser.Identifier);
				this.state = 2022;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2018;
					this.match(SolidCashParser.T__81);
					this.state = 2019;
					this.expression(0);
					this.state = 2020;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2024;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2026;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 8:
				localctx = new DeleteMemberEntryContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2028;
				this.match(SolidCashParser.T__96);
				this.state = 2029;
				this.match(SolidCashParser.Identifier);
				this.state = 2032;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2030;
					this.match(SolidCashParser.T__6);
					this.state = 2031;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 2034;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 2040;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2036;
					this.match(SolidCashParser.T__81);
					this.state = 2037;
					this.expression(0);
					this.state = 2038;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2042;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2044;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 9:
				localctx = new DeleteMemberContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2046;
				this.match(SolidCashParser.T__96);
				this.state = 2047;
				this.match(SolidCashParser.Identifier);
				this.state = 2050;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2048;
					this.match(SolidCashParser.T__6);
					this.state = 2049;
					this.match(SolidCashParser.Identifier);
					}
					}
					this.state = 2052;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===7);
				this.state = 2054;
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
			this.state = 2057;
			this.match(SolidCashParser.T__40);
			this.state = 2058;
			this.match(SolidCashParser.T__56);
			this.state = 2059;
			this.match(SolidCashParser.TxVar);
			this.state = 2060;
			this.match(SolidCashParser.T__22);
			this.state = 2061;
			this.expression(0);
			this.state = 2064;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2062;
				this.match(SolidCashParser.T__4);
				this.state = 2063;
				this.requireMessage();
				}
			}

			this.state = 2066;
			this.match(SolidCashParser.T__57);
			this.state = 2067;
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
			this.state = 2069;
			this.match(SolidCashParser.T__40);
			this.state = 2070;
			this.match(SolidCashParser.T__56);
			this.state = 2071;
			this.expression(0);
			this.state = 2074;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2072;
				this.match(SolidCashParser.T__4);
				this.state = 2073;
				this.requireMessage();
				}
			}

			this.state = 2076;
			this.match(SolidCashParser.T__57);
			this.state = 2077;
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
			this.state = 2079;
			this.match(SolidCashParser.T__97);
			this.state = 2080;
			this.match(SolidCashParser.T__56);
			this.state = 2081;
			this.expression(0);
			this.state = 2082;
			this.match(SolidCashParser.T__57);
			this.state = 2083;
			localctx._ifBlock = this.block();
			this.state = 2086;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 249, this._ctx) ) {
			case 1:
				{
				this.state = 2084;
				this.match(SolidCashParser.T__98);
				this.state = 2085;
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
			this.state = 2094;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 250, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2088;
				this.doWhileStatement();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2089;
				this.whileStatement();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2090;
				this.forStatement();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2091;
				this.forOfEntriesStatement();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2092;
				this.forInStatement();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2093;
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
		this.enterRule(localctx, 178, SolidCashParser.RULE_forOfEntriesStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2096;
			this.match(SolidCashParser.T__10);
			this.state = 2097;
			this.match(SolidCashParser.T__56);
			this.state = 2098;
			this.typeName();
			this.state = 2099;
			this.match(SolidCashParser.Identifier);
			this.state = 2100;
			this.match(SolidCashParser.T__4);
			this.state = 2101;
			this.typeName();
			this.state = 2102;
			this.match(SolidCashParser.Identifier);
			this.state = 2103;
			this.match(SolidCashParser.T__99);
			this.state = 2104;
			this.match(SolidCashParser.T__41);
			this.state = 2105;
			this.match(SolidCashParser.T__6);
			this.state = 2106;
			this.match(SolidCashParser.Identifier);
			this.state = 2107;
			this.match(SolidCashParser.T__6);
			this.state = 2108;
			this.match(SolidCashParser.T__32);
			this.state = 2109;
			this.match(SolidCashParser.T__57);
			this.state = 2110;
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
			this.state = 2112;
			this.match(SolidCashParser.T__10);
			this.state = 2113;
			this.match(SolidCashParser.T__56);
			this.state = 2114;
			this.typeName();
			this.state = 2115;
			this.match(SolidCashParser.Identifier);
			this.state = 2116;
			this.match(SolidCashParser.T__100);
			this.state = 2117;
			this.match(SolidCashParser.T__41);
			this.state = 2118;
			this.match(SolidCashParser.T__6);
			this.state = 2119;
			this.match(SolidCashParser.Identifier);
			this.state = 2120;
			this.match(SolidCashParser.T__57);
			this.state = 2121;
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
			this.state = 2123;
			this.match(SolidCashParser.T__10);
			this.state = 2124;
			this.match(SolidCashParser.T__56);
			this.state = 2125;
			this.typeName();
			this.state = 2126;
			this.match(SolidCashParser.Identifier);
			this.state = 2127;
			this.match(SolidCashParser.T__99);
			this.state = 2128;
			this.match(SolidCashParser.T__41);
			this.state = 2129;
			this.match(SolidCashParser.T__6);
			this.state = 2130;
			this.match(SolidCashParser.Identifier);
			this.state = 2131;
			this.match(SolidCashParser.T__57);
			this.state = 2132;
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
		this.enterRule(localctx, 184, SolidCashParser.RULE_forStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2134;
			this.match(SolidCashParser.T__10);
			this.state = 2135;
			this.match(SolidCashParser.T__56);
			this.state = 2136;
			this.forInit();
			this.state = 2137;
			this.forCondition();
			this.state = 2139;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 251, this._ctx) ) {
			case 1:
				{
				this.state = 2138;
				this.forUpdate();
				}
				break;
			}
			this.state = 2141;
			this.match(SolidCashParser.T__57);
			this.state = 2142;
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
		this.enterRule(localctx, 186, SolidCashParser.RULE_forInit);
		let _la: number;
		try {
			this.state = 2189;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 257, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2144;
				this.typeName();
				this.state = 2148;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===32 || _la===36 || _la===64 || ((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 15) !== 0)) {
					{
					{
					this.state = 2145;
					this.modifier();
					}
					}
					this.state = 2150;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2151;
				this.match(SolidCashParser.Identifier);
				this.state = 2154;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===48) {
					{
					this.state = 2152;
					this.match(SolidCashParser.T__47);
					this.state = 2153;
					this.expression(0);
					}
				}

				this.state = 2156;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2158;
				this.match(SolidCashParser.Identifier);
				this.state = 2159;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2160;
				this.expression(0);
				this.state = 2161;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2163;
				this.match(SolidCashParser.T__56);
				this.state = 2164;
				this.tupleSlot();
				this.state = 2167;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2165;
					this.match(SolidCashParser.T__4);
					this.state = 2166;
					this.tupleSlot();
					}
					}
					this.state = 2169;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2171;
				this.match(SolidCashParser.T__57);
				this.state = 2172;
				this.match(SolidCashParser.T__47);
				this.state = 2184;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 256, this._ctx) ) {
				case 1:
					{
					this.state = 2173;
					this.match(SolidCashParser.T__56);
					this.state = 2174;
					this.expression(0);
					this.state = 2177;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 2175;
						this.match(SolidCashParser.T__4);
						this.state = 2176;
						this.expression(0);
						}
						}
						this.state = 2179;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 2181;
					this.match(SolidCashParser.T__57);
					}
					break;
				case 2:
					{
					this.state = 2183;
					this.expression(0);
					}
					break;
				}
				this.state = 2186;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2188;
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
		this.enterRule(localctx, 188, SolidCashParser.RULE_forCondition);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2192;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 258, this._ctx) ) {
			case 1:
				{
				this.state = 2191;
				this.expression(0);
				}
				break;
			}
			this.state = 2194;
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
		this.enterRule(localctx, 190, SolidCashParser.RULE_forUpdate);
		let _la: number;
		try {
			this.state = 2227;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 262, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2196;
				this.match(SolidCashParser.Identifier);
				this.state = 2197;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2198;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2199;
				this.match(SolidCashParser.Identifier);
				this.state = 2200;
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
				this.state = 2201;
				localctx._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===93 || _la===94)) {
				    localctx._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2202;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2203;
				this.match(SolidCashParser.T__56);
				this.state = 2204;
				this.tupleSlot();
				this.state = 2207;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2205;
					this.match(SolidCashParser.T__4);
					this.state = 2206;
					this.tupleSlot();
					}
					}
					this.state = 2209;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2211;
				this.match(SolidCashParser.T__57);
				this.state = 2212;
				this.match(SolidCashParser.T__47);
				this.state = 2224;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 261, this._ctx) ) {
				case 1:
					{
					this.state = 2213;
					this.match(SolidCashParser.T__56);
					this.state = 2214;
					this.expression(0);
					this.state = 2217;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					do {
						{
						{
						this.state = 2215;
						this.match(SolidCashParser.T__4);
						this.state = 2216;
						this.expression(0);
						}
						}
						this.state = 2219;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
					} while (_la===5);
					this.state = 2221;
					this.match(SolidCashParser.T__57);
					}
					break;
				case 2:
					{
					this.state = 2223;
					this.expression(0);
					}
					break;
				}
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2226;
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
		this.enterRule(localctx, 192, SolidCashParser.RULE_doWhileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2229;
			this.match(SolidCashParser.T__101);
			this.state = 2230;
			this.block();
			this.state = 2231;
			this.match(SolidCashParser.T__102);
			this.state = 2232;
			this.match(SolidCashParser.T__56);
			this.state = 2233;
			this.expression(0);
			this.state = 2234;
			this.match(SolidCashParser.T__57);
			this.state = 2235;
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
		this.enterRule(localctx, 194, SolidCashParser.RULE_whileStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2237;
			this.match(SolidCashParser.T__102);
			this.state = 2238;
			this.match(SolidCashParser.T__56);
			this.state = 2239;
			this.expression(0);
			this.state = 2240;
			this.match(SolidCashParser.T__57);
			this.state = 2241;
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
		this.enterRule(localctx, 196, SolidCashParser.RULE_consoleStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2243;
			this.match(SolidCashParser.T__103);
			this.state = 2244;
			this.consoleParameterList();
			this.state = 2245;
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
		this.enterRule(localctx, 198, SolidCashParser.RULE_assemblyStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2247;
			this.match(SolidCashParser.T__104);
			this.state = 2249;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===151) {
				{
				this.state = 2248;
				this.match(SolidCashParser.StringLiteral);
				}
			}

			this.state = 2261;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===57) {
				{
				this.state = 2251;
				this.match(SolidCashParser.T__56);
				this.state = 2252;
				this.match(SolidCashParser.StringLiteral);
				this.state = 2257;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2253;
					this.match(SolidCashParser.T__4);
					this.state = 2254;
					this.match(SolidCashParser.StringLiteral);
					}
					}
					this.state = 2259;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 2260;
				this.match(SolidCashParser.T__57);
				}
			}

			this.state = 2263;
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
		this.enterRule(localctx, 200, SolidCashParser.RULE_yulBlock);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2265;
			this.match(SolidCashParser.T__3);
			this.state = 2269;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2266;
					this.yulStatement();
					}
					}
				}
				this.state = 2271;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 266, this._ctx);
			}
			this.state = 2272;
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
		this.enterRule(localctx, 202, SolidCashParser.RULE_yulStatement);
		try {
			this.state = 2287;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 267, this._ctx) ) {
			case 1:
				localctx = new YulNestedBlockStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2274;
				this.yulBlock();
				}
				break;
			case 2:
				localctx = new YulVarDeclStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2275;
				this.yulVariableDeclaration();
				}
				break;
			case 3:
				localctx = new YulAssignStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2276;
				this.yulAssignment();
				}
				break;
			case 4:
				localctx = new YulIfStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2277;
				this.yulIf();
				}
				break;
			case 5:
				localctx = new YulSwitchStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2278;
				this.yulSwitch();
				}
				break;
			case 6:
				localctx = new YulForStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2279;
				this.yulForLoop();
				}
				break;
			case 7:
				localctx = new YulFunctionDefStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2280;
				this.yulFunctionDefinition();
				}
				break;
			case 8:
				localctx = new YulBreakStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2281;
				this.match(SolidCashParser.T__105);
				}
				break;
			case 9:
				localctx = new YulContinueStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2282;
				this.match(SolidCashParser.T__106);
				}
				break;
			case 10:
				localctx = new YulLeaveStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 2283;
				this.match(SolidCashParser.T__36);
				}
				break;
			case 11:
				localctx = new YulCallStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 2284;
				this.yulFunctionCall();
				}
				break;
			case 12:
				localctx = new YulPathStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 2285;
				this.yulPath();
				}
				break;
			case 13:
				localctx = new YulLiteralStmtContext(this, localctx);
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 2286;
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
		this.enterRule(localctx, 204, SolidCashParser.RULE_yulVariableDeclaration);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2289;
			this.match(SolidCashParser.T__107);
			this.state = 2290;
			this.yulIdentifier();
			this.state = 2295;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2291;
					this.match(SolidCashParser.T__4);
					this.state = 2292;
					this.yulIdentifier();
					}
					}
				}
				this.state = 2297;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 268, this._ctx);
			}
			this.state = 2300;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 269, this._ctx) ) {
			case 1:
				{
				this.state = 2298;
				this.match(SolidCashParser.T__108);
				this.state = 2299;
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
		this.enterRule(localctx, 206, SolidCashParser.RULE_yulAssignment);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2302;
			this.yulPath();
			this.state = 2307;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===5) {
				{
				{
				this.state = 2303;
				this.match(SolidCashParser.T__4);
				this.state = 2304;
				this.yulPath();
				}
				}
				this.state = 2309;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2310;
			this.match(SolidCashParser.T__108);
			this.state = 2311;
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
		this.enterRule(localctx, 208, SolidCashParser.RULE_yulIf);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2313;
			this.match(SolidCashParser.T__97);
			this.state = 2314;
			this.yulExpression();
			this.state = 2315;
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
		this.enterRule(localctx, 210, SolidCashParser.RULE_yulSwitch);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2317;
			this.match(SolidCashParser.T__109);
			this.state = 2318;
			this.yulExpression();
			this.state = 2328;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 111:
				{
				this.state = 2320;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2319;
						this.yulCase();
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2322;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 271, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				this.state = 2325;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 272, this._ctx) ) {
				case 1:
					{
					this.state = 2324;
					this.yulDefault();
					}
					break;
				}
				}
				break;
			case 112:
				{
				this.state = 2327;
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
		this.enterRule(localctx, 212, SolidCashParser.RULE_yulCase);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2330;
			this.match(SolidCashParser.T__110);
			this.state = 2331;
			this.yulLiteral();
			this.state = 2332;
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
		this.enterRule(localctx, 214, SolidCashParser.RULE_yulDefault);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2334;
			this.match(SolidCashParser.T__111);
			this.state = 2335;
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
		this.enterRule(localctx, 216, SolidCashParser.RULE_yulForLoop);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2337;
			this.match(SolidCashParser.T__10);
			this.state = 2338;
			this.yulBlock();
			this.state = 2339;
			this.yulExpression();
			this.state = 2340;
			this.yulBlock();
			this.state = 2341;
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
		this.enterRule(localctx, 218, SolidCashParser.RULE_yulFunctionDefinition);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2343;
			this.match(SolidCashParser.T__8);
			this.state = 2344;
			this.yulIdentifier();
			this.state = 2345;
			this.match(SolidCashParser.T__56);
			this.state = 2354;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 275, this._ctx) ) {
			case 1:
				{
				this.state = 2346;
				this.yulIdentifier();
				this.state = 2351;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2347;
					this.match(SolidCashParser.T__4);
					this.state = 2348;
					this.yulIdentifier();
					}
					}
					this.state = 2353;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			}
			this.state = 2356;
			this.match(SolidCashParser.T__57);
			this.state = 2366;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===113) {
				{
				this.state = 2357;
				this.match(SolidCashParser.T__112);
				this.state = 2358;
				this.yulIdentifier();
				this.state = 2363;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2359;
					this.match(SolidCashParser.T__4);
					this.state = 2360;
					this.yulIdentifier();
					}
					}
					this.state = 2365;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 2368;
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
		this.enterRule(localctx, 220, SolidCashParser.RULE_yulExpression);
		try {
			this.state = 2373;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 278, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2370;
				this.yulFunctionCall();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2371;
				this.yulPath();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2372;
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
		this.enterRule(localctx, 222, SolidCashParser.RULE_yulFunctionCall);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2375;
			this.yulFunctionName();
			this.state = 2376;
			this.match(SolidCashParser.T__56);
			this.state = 2385;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 280, this._ctx) ) {
			case 1:
				{
				this.state = 2377;
				this.yulExpression();
				this.state = 2382;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 2378;
					this.match(SolidCashParser.T__4);
					this.state = 2379;
					this.yulExpression();
					}
					}
					this.state = 2384;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
				break;
			}
			this.state = 2387;
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
		this.enterRule(localctx, 224, SolidCashParser.RULE_yulFunctionName);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2389;
			_la = this._input.LA(1);
			if(!(_la===30 || _la===35 || _la===91 || _la===95 || _la===149 || _la===180)) {
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
		this.enterRule(localctx, 226, SolidCashParser.RULE_yulIdentifier);
		try {
			this.state = 2394;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 281, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2391;
				this.anyIdentifier();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2392;
				if (!(this.isYulSolidityKeyword(this._input.LT(1).text ?? ''))) {
					throw this.createFailedPredicateException("this.isYulSolidityKeyword(this._input.LT(1).text ?? '')");
				}
				this.state = 2393;
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
		this.enterRule(localctx, 228, SolidCashParser.RULE_yulPath);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2396;
			this.yulIdentifier();
			this.state = 2404;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 283, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					this.state = 2402;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 282, this._ctx) ) {
					case 1:
						{
						this.state = 2397;
						this.match(SolidCashParser.T__6);
						this.state = 2398;
						this.yulIdentifier();
						}
						break;
					case 2:
						{
						this.state = 2399;
						this.match(SolidCashParser.DotLength);
						}
						break;
					case 3:
						{
						this.state = 2400;
						this.match(SolidCashParser.T__6);
						this.state = 2401;
						this.match(SolidCashParser.T__90);
						}
						break;
					}
					}
				}
				this.state = 2406;
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
		this.enterRule(localctx, 230, SolidCashParser.RULE_yulLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2407;
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
		this.enterRule(localctx, 232, SolidCashParser.RULE_uncheckedStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2409;
			this.match(SolidCashParser.T__113);
			this.state = 2410;
			this.match(SolidCashParser.T__3);
			this.state = 2414;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 284, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2411;
					this.statement();
					}
					}
				}
				this.state = 2416;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 284, this._ctx);
			}
			this.state = 2417;
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
		this.enterRule(localctx, 234, SolidCashParser.RULE_switchStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2419;
			this.match(SolidCashParser.T__109);
			this.state = 2420;
			this.match(SolidCashParser.T__56);
			this.state = 2421;
			this.expression(0);
			this.state = 2422;
			this.match(SolidCashParser.T__57);
			this.state = 2423;
			this.match(SolidCashParser.T__3);
			this.state = 2427;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===111) {
				{
				{
				this.state = 2424;
				this.switchCase();
				}
				}
				this.state = 2429;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 2431;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===112) {
				{
				this.state = 2430;
				this.switchDefault();
				}
			}

			this.state = 2433;
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
		this.enterRule(localctx, 236, SolidCashParser.RULE_switchCase);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2435;
			this.match(SolidCashParser.T__110);
			this.state = 2436;
			this.expression(0);
			this.state = 2437;
			this.match(SolidCashParser.T__114);
			this.state = 2441;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 287, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2438;
					this.statement();
					}
					}
				}
				this.state = 2443;
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
		this.enterRule(localctx, 238, SolidCashParser.RULE_switchDefault);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2444;
			this.match(SolidCashParser.T__111);
			this.state = 2445;
			this.match(SolidCashParser.T__114);
			this.state = 2449;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 288, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2446;
					this.statement();
					}
					}
				}
				this.state = 2451;
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
		this.enterRule(localctx, 240, SolidCashParser.RULE_tryCatchStatement);
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2452;
			this.match(SolidCashParser.T__115);
			this.state = 2453;
			this.expression(0);
			this.state = 2455;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 289, this._ctx) ) {
			case 1:
				{
				this.state = 2454;
				this.tryReturns();
				}
				break;
			}
			this.state = 2457;
			localctx._tryBlock = this.block();
			this.state = 2459;
			this._errHandler.sync(this);
			_alt = 1;
			do {
				switch (_alt) {
				case 1:
					{
					{
					this.state = 2458;
					this.catchClause();
					}
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				this.state = 2461;
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
		this.enterRule(localctx, 242, SolidCashParser.RULE_tryReturns);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2463;
			this.match(SolidCashParser.T__87);
			this.state = 2464;
			this.match(SolidCashParser.T__56);
			this.state = 2476;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 2465;
				this.parameter();
				this.state = 2470;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 291, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2466;
						this.match(SolidCashParser.T__4);
						this.state = 2467;
						this.parameter();
						}
						}
					}
					this.state = 2472;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 291, this._ctx);
				}
				this.state = 2474;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2473;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2478;
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
		this.enterRule(localctx, 244, SolidCashParser.RULE_catchClause);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2480;
			this.match(SolidCashParser.T__116);
			this.state = 2482;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 294, this._ctx) ) {
			case 1:
				{
				this.state = 2481;
				this.match(SolidCashParser.Identifier);
				}
				break;
			}
			this.state = 2499;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 298, this._ctx) ) {
			case 1:
				{
				this.state = 2484;
				this.match(SolidCashParser.T__56);
				this.state = 2496;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
					{
					this.state = 2485;
					this.parameter();
					this.state = 2490;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 295, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2486;
							this.match(SolidCashParser.T__4);
							this.state = 2487;
							this.parameter();
							}
							}
						}
						this.state = 2492;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 295, this._ctx);
					}
					this.state = 2494;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2493;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2498;
				this.match(SolidCashParser.T__57);
				}
				break;
			}
			this.state = 2501;
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
		this.enterRule(localctx, 246, SolidCashParser.RULE_breakStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2503;
			this.match(SolidCashParser.T__105);
			this.state = 2504;
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
		this.enterRule(localctx, 248, SolidCashParser.RULE_continueStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2506;
			this.match(SolidCashParser.T__106);
			this.state = 2507;
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
		this.enterRule(localctx, 250, SolidCashParser.RULE_requireMessage);
		try {
			this.state = 2513;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 299, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2509;
				this.match(SolidCashParser.StringLiteral);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2510;
				this.match(SolidCashParser.Identifier);
				this.state = 2511;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2512;
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
		this.enterRule(localctx, 252, SolidCashParser.RULE_revertStatement);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2559;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 305, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2515;
				this.match(SolidCashParser.T__34);
				this.state = 2516;
				this.anyIdentifier();
				this.state = 2519;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 2517;
					this.match(SolidCashParser.T__6);
					this.state = 2518;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2521;
				this.match(SolidCashParser.T__56);
				this.state = 2522;
				this.match(SolidCashParser.T__3);
				this.state = 2534;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2523;
					this.namedArg();
					this.state = 2528;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 301, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2524;
							this.match(SolidCashParser.T__4);
							this.state = 2525;
							this.namedArg();
							}
							}
						}
						this.state = 2530;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 301, this._ctx);
					}
					this.state = 2532;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2531;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2536;
				this.match(SolidCashParser.T__5);
				this.state = 2537;
				this.match(SolidCashParser.T__57);
				this.state = 2538;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2540;
				this.match(SolidCashParser.T__34);
				this.state = 2541;
				this.anyIdentifier();
				this.state = 2544;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===7) {
					{
					this.state = 2542;
					this.match(SolidCashParser.T__6);
					this.state = 2543;
					this.match(SolidCashParser.Identifier);
					}
				}

				this.state = 2546;
				this.expressionList();
				this.state = 2547;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2549;
				this.match(SolidCashParser.T__34);
				this.state = 2550;
				this.match(SolidCashParser.T__56);
				this.state = 2551;
				this.expression(0);
				this.state = 2552;
				this.match(SolidCashParser.T__57);
				this.state = 2553;
				this.match(SolidCashParser.T__1);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2555;
				this.match(SolidCashParser.T__34);
				this.state = 2556;
				this.match(SolidCashParser.T__56);
				this.state = 2557;
				this.match(SolidCashParser.T__57);
				this.state = 2558;
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
		this.enterRule(localctx, 254, SolidCashParser.RULE_assertStatement);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2561;
			this.match(SolidCashParser.T__117);
			this.state = 2562;
			this.match(SolidCashParser.T__56);
			this.state = 2563;
			this.expression(0);
			this.state = 2564;
			this.match(SolidCashParser.T__57);
			this.state = 2565;
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
		this.enterRule(localctx, 256, SolidCashParser.RULE_consoleParameter);
		try {
			this.state = 2569;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 180:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2567;
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
				this.state = 2568;
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
		this.enterRule(localctx, 258, SolidCashParser.RULE_consoleParameterList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2571;
			this.match(SolidCashParser.T__56);
			this.state = 2583;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 141)) & ~0x1F) === 0 && ((1 << (_la - 141)) & 3152921) !== 0) || _la===180) {
				{
				this.state = 2572;
				this.consoleParameter();
				this.state = 2577;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 307, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2573;
						this.match(SolidCashParser.T__4);
						this.state = 2574;
						this.consoleParameter();
						}
						}
					}
					this.state = 2579;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 307, this._ctx);
				}
				this.state = 2581;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2580;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2585;
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
		this.enterRule(localctx, 260, SolidCashParser.RULE_functionCall);
		let _la: number;
		try {
			let _alt: number;
			this.state = 2651;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 316, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2587;
				this.match(SolidCashParser.Identifier);
				this.state = 2588;
				this.expressionList();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2589;
				this.match(SolidCashParser.T__30);
				this.state = 2590;
				this.expressionList();
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2591;
				this.match(SolidCashParser.Identifier);
				this.state = 2592;
				this.callOptions();
				this.state = 2593;
				this.expressionList();
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 2595;
				this.match(SolidCashParser.T__42);
				this.state = 2596;
				this.expressionList();
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 2597;
				this.match(SolidCashParser.Identifier);
				this.state = 2598;
				this.match(SolidCashParser.T__6);
				this.state = 2599;
				this.match(SolidCashParser.Identifier);
				this.state = 2600;
				this.expressionList();
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 2601;
				this.match(SolidCashParser.Identifier);
				this.state = 2602;
				this.match(SolidCashParser.T__56);
				this.state = 2603;
				this.match(SolidCashParser.T__3);
				this.state = 2615;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2604;
					this.namedArg();
					this.state = 2609;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 310, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2605;
							this.match(SolidCashParser.T__4);
							this.state = 2606;
							this.namedArg();
							}
							}
						}
						this.state = 2611;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 310, this._ctx);
					}
					this.state = 2613;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2612;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2617;
				this.match(SolidCashParser.T__5);
				this.state = 2618;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 2619;
				this.match(SolidCashParser.T__56);
				this.state = 2620;
				this.match(SolidCashParser.Identifier);
				this.state = 2621;
				this.match(SolidCashParser.T__57);
				this.state = 2622;
				this.expressionList();
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 2623;
				this.match(SolidCashParser.T__56);
				this.state = 2624;
				this.match(SolidCashParser.Identifier);
				this.state = 2625;
				this.match(SolidCashParser.T__6);
				this.state = 2626;
				this.match(SolidCashParser.Identifier);
				this.state = 2627;
				this.match(SolidCashParser.T__57);
				this.state = 2628;
				this.expressionList();
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 2629;
				this.match(SolidCashParser.T__56);
				this.state = 2630;
				this.match(SolidCashParser.Identifier);
				this.state = 2631;
				this.match(SolidCashParser.T__6);
				this.state = 2632;
				this.match(SolidCashParser.Identifier);
				this.state = 2633;
				this.match(SolidCashParser.T__57);
				this.state = 2634;
				this.match(SolidCashParser.T__56);
				this.state = 2635;
				this.match(SolidCashParser.T__3);
				this.state = 2647;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===180) {
					{
					this.state = 2636;
					this.namedArg();
					this.state = 2641;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 313, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2637;
							this.match(SolidCashParser.T__4);
							this.state = 2638;
							this.namedArg();
							}
							}
						}
						this.state = 2643;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 313, this._ctx);
					}
					this.state = 2645;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2644;
						this.match(SolidCashParser.T__4);
						}
					}

					}
				}

				this.state = 2649;
				this.match(SolidCashParser.T__5);
				this.state = 2650;
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
		this.enterRule(localctx, 262, SolidCashParser.RULE_namedArg);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2653;
			this.match(SolidCashParser.Identifier);
			this.state = 2654;
			this.match(SolidCashParser.T__114);
			this.state = 2655;
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
		this.enterRule(localctx, 264, SolidCashParser.RULE_expressionList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2657;
			this.match(SolidCashParser.T__56);
			this.state = 2669;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 319, this._ctx) ) {
			case 1:
				{
				this.state = 2658;
				this.callArgument();
				this.state = 2663;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 317, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2659;
						this.match(SolidCashParser.T__4);
						this.state = 2660;
						this.callArgument();
						}
						}
					}
					this.state = 2665;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 317, this._ctx);
				}
				this.state = 2667;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2666;
					this.match(SolidCashParser.T__4);
					}
				}

				}
				break;
			}
			this.state = 2671;
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
		this.enterRule(localctx, 266, SolidCashParser.RULE_callArgument);
		let _la: number;
		try {
			this.state = 2682;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 321, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2673;
				localctx._pushBase = this.match(SolidCashParser.Identifier);
				this.state = 2674;
				this.match(SolidCashParser.DotPush);
				this.state = 2675;
				this.match(SolidCashParser.T__56);
				this.state = 2676;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2677;
				this.expression(0);
				this.state = 2680;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
					{
					this.state = 2678;
					localctx._aop = this._input.LT(1);
					_la = this._input.LA(1);
					if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
					    localctx._aop = this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					this.state = 2679;
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
		this.enterRule(localctx, 268, SolidCashParser.RULE_callOptions);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2684;
			this.match(SolidCashParser.T__3);
			this.state = 2685;
			this.callOption();
			this.state = 2690;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 322, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 2686;
					this.match(SolidCashParser.T__4);
					this.state = 2687;
					this.callOption();
					}
					}
				}
				this.state = 2692;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 322, this._ctx);
			}
			this.state = 2694;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===5) {
				{
				this.state = 2693;
				this.match(SolidCashParser.T__4);
				}
			}

			this.state = 2696;
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
		this.enterRule(localctx, 270, SolidCashParser.RULE_callOption);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2698;
			this.match(SolidCashParser.Identifier);
			this.state = 2699;
			this.match(SolidCashParser.T__114);
			this.state = 2700;
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
		this.enterRule(localctx, 272, SolidCashParser.RULE_typeList);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2702;
			this.match(SolidCashParser.T__56);
			this.state = 2714;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || _la===57 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 2703;
				this.typeListItem();
				this.state = 2708;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 324, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 2704;
						this.match(SolidCashParser.T__4);
						this.state = 2705;
						this.typeListItem();
						}
						}
					}
					this.state = 2710;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 324, this._ctx);
				}
				this.state = 2712;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2711;
					this.match(SolidCashParser.T__4);
					}
				}

				}
			}

			this.state = 2716;
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
		this.enterRule(localctx, 274, SolidCashParser.RULE_typeListItem);
		let _la: number;
		try {
			this.state = 2733;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 329, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 2718;
				this.typeName();
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 2719;
				this.arrayType(0);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 2720;
				this.match(SolidCashParser.T__56);
				this.state = 2721;
				this.typeListItem();
				this.state = 2722;
				this.match(SolidCashParser.T__57);
				this.state = 2730;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===82) {
					{
					{
					this.state = 2723;
					this.match(SolidCashParser.T__81);
					this.state = 2725;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 327, this._ctx) ) {
					case 1:
						{
						this.state = 2724;
						this.expression(0);
						}
						break;
					}
					this.state = 2727;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2732;
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
		let _startState: number = 276;
		this.enterRecursionRule(localctx, 276, SolidCashParser.RULE_expression, _p);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 2929;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 341, this._ctx) ) {
			case 1:
				{
				localctx = new AssignmentExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;

				this.state = 2736;
				this.match(SolidCashParser.T__56);
				this.state = 2737;
				this.match(SolidCashParser.Identifier);
				this.state = 2738;
				(localctx as AssignmentExpressionContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
				    (localctx as AssignmentExpressionContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2739;
				this.expression(0);
				this.state = 2740;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 2:
				{
				localctx = new InstantiationWithOptionsContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2742;
				this.match(SolidCashParser.T__56);
				this.state = 2743;
				this.match(SolidCashParser.T__91);
				this.state = 2744;
				this.match(SolidCashParser.Identifier);
				this.state = 2745;
				this.match(SolidCashParser.T__57);
				this.state = 2746;
				this.callOptions();
				this.state = 2747;
				this.expressionList();
				}
				break;
			case 3:
				{
				localctx = new ParenthesisedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2749;
				this.match(SolidCashParser.T__56);
				this.state = 2750;
				this.expression(0);
				this.state = 2751;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 4:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2753;
				this.match(SolidCashParser.T__56);
				this.state = 2754;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 5:
				{
				localctx = new TupleExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2755;
				this.match(SolidCashParser.T__56);
				this.state = 2756;
				this.expression(0);
				this.state = 2759;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2757;
					this.match(SolidCashParser.T__4);
					this.state = 2758;
					this.expression(0);
					}
					}
					this.state = 2761;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===5);
				this.state = 2763;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 6:
				{
				localctx = new CastContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2765;
				this.arrayCastType();
				this.state = 2766;
				this.match(SolidCashParser.T__56);
				this.state = 2767;
				(localctx as CastContext)._castable = this.expression(0);
				this.state = 2769;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===5) {
					{
					this.state = 2768;
					this.match(SolidCashParser.T__4);
					}
				}

				this.state = 2771;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 7:
				{
				localctx = new ChainedFunctionCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2773;
				this.functionCall();
				this.state = 2775;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2774;
						this.expressionList();
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2777;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 332, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 8:
				{
				localctx = new FunctionCallExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2779;
				this.functionCall();
				}
				break;
			case 9:
				{
				localctx = new ParenthesizedFunctionCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2780;
				this.match(SolidCashParser.T__56);
				this.state = 2781;
				this.expression(0);
				this.state = 2782;
				this.match(SolidCashParser.T__57);
				this.state = 2783;
				this.expressionList();
				}
				break;
			case 10:
				{
				localctx = new InstantiationContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2785;
				this.match(SolidCashParser.T__91);
				this.state = 2786;
				this.match(SolidCashParser.Identifier);
				this.state = 2788;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (_la===4) {
					{
					this.state = 2787;
					this.callOptions();
					}
				}

				this.state = 2790;
				this.expressionList();
				}
				break;
			case 11:
				{
				localctx = new NewArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2791;
				this.match(SolidCashParser.T__91);
				this.state = 2792;
				this.typeName();
				this.state = 2798;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				do {
					{
					{
					this.state = 2793;
					this.match(SolidCashParser.T__81);
					this.state = 2795;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===145) {
						{
						this.state = 2794;
						this.match(SolidCashParser.NumberLiteral);
						}
					}

					this.state = 2797;
					this.match(SolidCashParser.T__82);
					}
					}
					this.state = 2800;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				} while (_la===82);
				this.state = 2802;
				this.match(SolidCashParser.T__56);
				this.state = 2803;
				this.expression(0);
				this.state = 2804;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 12:
				{
				localctx = new NewDynamicBytesContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2806;
				this.match(SolidCashParser.T__91);
				this.state = 2807;
				this.match(SolidCashParser.UnboundedBytes);
				this.state = 2808;
				this.match(SolidCashParser.T__56);
				this.state = 2809;
				this.expression(0);
				this.state = 2810;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 13:
				{
				localctx = new NewDynamicStringContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2812;
				this.match(SolidCashParser.T__91);
				this.state = 2813;
				this.match(SolidCashParser.PrimitiveType);
				this.state = 2814;
				this.match(SolidCashParser.T__56);
				this.state = 2815;
				this.expression(0);
				this.state = 2816;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 14:
				{
				localctx = new TypeIntrospectionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2818;
				this.typeIntrospectionBase();
				this.state = 2819;
				this.match(SolidCashParser.T__6);
				this.state = 2820;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				{
				localctx = new AbiEncodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2822;
				this.match(SolidCashParser.T__118);
				this.state = 2823;
				this.expressionList();
				}
				break;
			case 16:
				{
				localctx = new AbiEncodePackedContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2824;
				this.match(SolidCashParser.T__119);
				this.state = 2825;
				this.expressionList();
				}
				break;
			case 17:
				{
				localctx = new AbiEncodeWithSelectorContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2826;
				this.match(SolidCashParser.T__120);
				this.state = 2827;
				this.expressionList();
				}
				break;
			case 18:
				{
				localctx = new AbiEncodeWithSignatureContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2828;
				this.match(SolidCashParser.T__121);
				this.state = 2829;
				this.expressionList();
				}
				break;
			case 19:
				{
				localctx = new AbiEncodeCallContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2830;
				this.match(SolidCashParser.T__122);
				this.state = 2831;
				this.match(SolidCashParser.T__56);
				this.state = 2843;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 336, this._ctx) ) {
				case 1:
					{
					this.state = 2832;
					_la = this._input.LA(1);
					if(!(_la===42 || _la===180)) {
					this._errHandler.recoverInline(this);
					}
					else {
						this._errHandler.reportMatch(this);
					    this.consume();
					}
					this.state = 2833;
					this.match(SolidCashParser.T__6);
					this.state = 2834;
					this.match(SolidCashParser.Identifier);
					}
					break;
				case 2:
					{
					this.state = 2835;
					this.match(SolidCashParser.Identifier);
					this.state = 2836;
					this.match(SolidCashParser.T__81);
					this.state = 2837;
					this.match(SolidCashParser.NumberLiteral);
					this.state = 2838;
					this.match(SolidCashParser.T__82);
					}
					break;
				case 3:
					{
					this.state = 2839;
					this.match(SolidCashParser.Identifier);
					}
					break;
				case 4:
					{
					this.state = 2840;
					this.match(SolidCashParser.Identifier);
					this.state = 2841;
					this.match(SolidCashParser.T__56);
					this.state = 2842;
					this.match(SolidCashParser.T__57);
					}
					break;
				}
				this.state = 2845;
				this.match(SolidCashParser.T__4);
				this.state = 2846;
				this.abiEncodeCallArguments();
				this.state = 2847;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 20:
				{
				localctx = new BytesConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2849;
				this.match(SolidCashParser.T__123);
				this.state = 2850;
				this.expressionList();
				}
				break;
			case 21:
				{
				localctx = new StringConcatContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2851;
				this.match(SolidCashParser.T__124);
				this.state = 2852;
				this.expressionList();
				}
				break;
			case 22:
				{
				localctx = new AbiDecodeContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2853;
				this.match(SolidCashParser.T__125);
				this.state = 2854;
				this.match(SolidCashParser.T__56);
				this.state = 2855;
				this.expression(0);
				this.state = 2856;
				this.match(SolidCashParser.T__4);
				this.state = 2857;
				this.typeList();
				this.state = 2858;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 23:
				{
				localctx = new AbiDecodeAtContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2860;
				this.match(SolidCashParser.T__126);
				this.state = 2861;
				this.match(SolidCashParser.T__56);
				this.state = 2862;
				this.expression(0);
				this.state = 2863;
				this.match(SolidCashParser.T__4);
				this.state = 2864;
				this.typeList();
				this.state = 2865;
				this.match(SolidCashParser.T__4);
				this.state = 2866;
				this.match(SolidCashParser.NumberLiteral);
				this.state = 2867;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 24:
				{
				localctx = new BareAbiReferenceExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2869;
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
			case 25:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2870;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__127);
				this.state = 2871;
				this.match(SolidCashParser.T__81);
				this.state = 2872;
				this.expression(0);
				this.state = 2873;
				this.match(SolidCashParser.T__82);
				this.state = 2874;
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
			case 26:
				{
				localctx = new UnaryIntrospectionOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2876;
				(localctx as UnaryIntrospectionOpContext)._scope = this.match(SolidCashParser.T__128);
				this.state = 2877;
				this.match(SolidCashParser.T__81);
				this.state = 2878;
				this.expression(0);
				this.state = 2879;
				this.match(SolidCashParser.T__82);
				this.state = 2880;
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
			case 27:
				{
				localctx = new PrefixOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2882;
				(localctx as PrefixOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===93 || _la===94)) {
				    (localctx as PrefixOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2883;
				this.expression(22);
				}
				break;
			case 28:
				{
				localctx = new UnaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2884;
				(localctx as UnaryOpContext)._op = this._input.LT(1);
				_la = this._input.LA(1);
				if(!(_la===14 || _la===27 || _la===131)) {
				    (localctx as UnaryOpContext)._op = this._errHandler.recoverInline(this);
				}
				else {
					this._errHandler.reportMatch(this);
				    this.consume();
				}
				this.state = 2885;
				this.expression(21);
				}
				break;
			case 29:
				{
				localctx = new ArrayContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2886;
				this.match(SolidCashParser.T__81);
				this.state = 2898;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 339, this._ctx) ) {
				case 1:
					{
					this.state = 2887;
					this.expression(0);
					this.state = 2892;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 337, this._ctx);
					while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
						if (_alt === 1) {
							{
							{
							this.state = 2888;
							this.match(SolidCashParser.T__4);
							this.state = 2889;
							this.expression(0);
							}
							}
						}
						this.state = 2894;
						this._errHandler.sync(this);
						_alt = this._interp.adaptivePredict(this._input, 337, this._ctx);
					}
					this.state = 2896;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
					if (_la===5) {
						{
						this.state = 2895;
						this.match(SolidCashParser.T__4);
						}
					}

					}
					break;
				}
				this.state = 2900;
				this.match(SolidCashParser.T__82);
				}
				break;
			case 30:
				{
				localctx = new OutStateMappingFieldAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2901;
				this.match(SolidCashParser.T__41);
				this.state = 2902;
				this.match(SolidCashParser.T__6);
				this.state = 2903;
				this.match(SolidCashParser.Identifier);
				this.state = 2904;
				this.match(SolidCashParser.T__6);
				this.state = 2905;
				this.match(SolidCashParser.Identifier);
				this.state = 2906;
				this.match(SolidCashParser.T__81);
				this.state = 2907;
				this.expression(0);
				this.state = 2908;
				this.match(SolidCashParser.T__82);
				this.state = 2909;
				this.memberName();
				}
				break;
			case 31:
				{
				localctx = new MappingAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2911;
				this.match(SolidCashParser.T__41);
				this.state = 2912;
				this.match(SolidCashParser.T__6);
				this.state = 2913;
				this.match(SolidCashParser.Identifier);
				this.state = 2918;
				this._errHandler.sync(this);
				_alt = 1;
				do {
					switch (_alt) {
					case 1:
						{
						{
						this.state = 2914;
						this.match(SolidCashParser.T__81);
						this.state = 2915;
						this.expression(0);
						this.state = 2916;
						this.match(SolidCashParser.T__82);
						}
						}
						break;
					default:
						throw new NoViableAltException(this);
					}
					this.state = 2920;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 340, this._ctx);
				} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
				}
				break;
			case 32:
				{
				localctx = new StateAccessContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2922;
				this.match(SolidCashParser.T__41);
				this.state = 2923;
				this.match(SolidCashParser.T__6);
				this.state = 2924;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 33:
				{
				localctx = new ThisExprContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2925;
				this.match(SolidCashParser.T__41);
				}
				break;
			case 34:
				{
				localctx = new NullaryOpContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2926;
				this.match(SolidCashParser.NullaryOp);
				}
				break;
			case 35:
				{
				localctx = new IdentifierContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2927;
				this.anyIdentifier();
				}
				break;
			case 36:
				{
				localctx = new LiteralExpressionContext(this, localctx);
				this._ctx = localctx;
				_prevctx = localctx;
				this.state = 2928;
				this.literal();
				}
				break;
			}
			this._ctx.stop = this._input.LT(-1);
			this.state = 3100;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 358, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = localctx;
					{
					this.state = 3098;
					this._errHandler.sync(this);
					switch ( this._interp.adaptivePredict(this._input, 357, this._ctx) ) {
					case 1:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2931;
						if (!(this.precpred(this._ctx, 20))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 20)");
						}
						this.state = 2932;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__16);
						this.state = 2933;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 2:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2934;
						if (!(this.precpred(this._ctx, 19))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 19)");
						}
						this.state = 2935;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 98560) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2936;
						(localctx as BinaryOpContext)._right = this.expression(20);
						}
						break;
					case 3:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2937;
						if (!(this.precpred(this._ctx, 18))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 18)");
						}
						this.state = 2938;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===13 || _la===14)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2939;
						(localctx as BinaryOpContext)._right = this.expression(19);
						}
						break;
					case 4:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2940;
						if (!(this.precpred(this._ctx, 17))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 17)");
						}
						this.state = 2941;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===132 || _la===133)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2942;
						(localctx as BinaryOpContext)._right = this.expression(18);
						}
						break;
					case 5:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2943;
						if (!(this.precpred(this._ctx, 16))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 16)");
						}
						this.state = 2944;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__23);
						this.state = 2945;
						(localctx as BinaryOpContext)._right = this.expression(17);
						}
						break;
					case 6:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2946;
						if (!(this.precpred(this._ctx, 15))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 15)");
						}
						this.state = 2947;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__25);
						this.state = 2948;
						(localctx as BinaryOpContext)._right = this.expression(16);
						}
						break;
					case 7:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2949;
						if (!(this.precpred(this._ctx, 14))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 14)");
						}
						this.state = 2950;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__24);
						this.state = 2951;
						(localctx as BinaryOpContext)._right = this.expression(15);
						}
						break;
					case 8:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2952;
						if (!(this.precpred(this._ctx, 13))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 13)");
						}
						this.state = 2953;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 15728640) !== 0))) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2954;
						(localctx as BinaryOpContext)._right = this.expression(14);
						}
						break;
					case 9:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2955;
						if (!(this.precpred(this._ctx, 12))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 12)");
						}
						this.state = 2956;
						(localctx as BinaryOpContext)._op = this._input.LT(1);
						_la = this._input.LA(1);
						if(!(_la===18 || _la===19)) {
						    (localctx as BinaryOpContext)._op = this._errHandler.recoverInline(this);
						}
						else {
							this._errHandler.reportMatch(this);
						    this.consume();
						}
						this.state = 2957;
						(localctx as BinaryOpContext)._right = this.expression(13);
						}
						break;
					case 10:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2958;
						if (!(this.precpred(this._ctx, 11))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 11)");
						}
						this.state = 2959;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__133);
						this.state = 2960;
						(localctx as BinaryOpContext)._right = this.expression(12);
						}
						break;
					case 11:
						{
						localctx = new BinaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as BinaryOpContext)._left = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2961;
						if (!(this.precpred(this._ctx, 10))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 10)");
						}
						this.state = 2962;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.T__46);
						this.state = 2963;
						(localctx as BinaryOpContext)._right = this.expression(11);
						}
						break;
					case 12:
						{
						localctx = new IndexRangeSliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexRangeSliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2964;
						if (!(this.precpred(this._ctx, 40))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 40)");
						}
						this.state = 2965;
						this.match(SolidCashParser.T__81);
						this.state = 2967;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 342, this._ctx) ) {
						case 1:
							{
							this.state = 2966;
							(localctx as IndexRangeSliceContext)._start = this.expression(0);
							}
							break;
						}
						this.state = 2969;
						this.match(SolidCashParser.T__114);
						this.state = 2971;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 343, this._ctx) ) {
						case 1:
							{
							this.state = 2970;
							(localctx as IndexRangeSliceContext)._end = this.expression(0);
							}
							break;
						}
						this.state = 2973;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 13:
						{
						localctx = new TupleIndexOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2974;
						if (!(this.precpred(this._ctx, 39))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 39)");
						}
						this.state = 2975;
						this.match(SolidCashParser.T__81);
						this.state = 2976;
						(localctx as TupleIndexOpContext)._index = this.match(SolidCashParser.NumberLiteral);
						this.state = 2977;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 14:
						{
						localctx = new ArrayAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2978;
						if (!(this.precpred(this._ctx, 38))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 38)");
						}
						this.state = 2979;
						this.match(SolidCashParser.T__81);
						this.state = 2980;
						this.expression(0);
						this.state = 2981;
						this.match(SolidCashParser.T__82);
						}
						break;
					case 15:
						{
						localctx = new UnaryOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2983;
						if (!(this.precpred(this._ctx, 35))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 35)");
						}
						this.state = 2984;
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
						this.state = 2985;
						if (!(this.precpred(this._ctx, 34))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 34)");
						}
						this.state = 2986;
						(localctx as BinaryOpContext)._op = this.match(SolidCashParser.DotSplit);
						this.state = 2987;
						this.match(SolidCashParser.T__56);
						this.state = 2988;
						(localctx as BinaryOpContext)._right = this.expression(0);
						this.state = 2989;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 17:
						{
						localctx = new SliceContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as SliceContext)._element = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2991;
						if (!(this.precpred(this._ctx, 33))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 33)");
						}
						this.state = 2992;
						this.match(SolidCashParser.DotSlice);
						this.state = 2993;
						this.match(SolidCashParser.T__56);
						this.state = 2994;
						(localctx as SliceContext)._start = this.expression(0);
						this.state = 2995;
						this.match(SolidCashParser.T__4);
						this.state = 2996;
						(localctx as SliceContext)._end = this.expression(0);
						this.state = 2997;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 18:
						{
						localctx = new LegacyCallOptionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 2999;
						if (!(this.precpred(this._ctx, 32))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 32)");
						}
						this.state = 3000;
						this.match(SolidCashParser.T__6);
						this.state = 3001;
						this.match(SolidCashParser.Identifier);
						this.state = 3005;
						this._errHandler.sync(this);
						switch (this._input.LA(1)) {
						case 7:
							{
							this.state = 3002;
							this.match(SolidCashParser.T__6);
							this.state = 3003;
							this.match(SolidCashParser.Identifier);
							}
							break;
						case 163:
							{
							this.state = 3004;
							this.match(SolidCashParser.DotValue);
							}
							break;
						default:
							throw new NoViableAltException(this);
						}
						this.state = 3007;
						this.match(SolidCashParser.T__56);
						this.state = 3008;
						this.expression(0);
						this.state = 3009;
						this.match(SolidCashParser.T__57);
						this.state = 3010;
						this.expressionList();
						}
						break;
					case 19:
						{
						localctx = new MethodCallNamedContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3012;
						if (!(this.precpred(this._ctx, 31))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 31)");
						}
						this.state = 3013;
						this.match(SolidCashParser.T__6);
						this.state = 3014;
						this.match(SolidCashParser.Identifier);
						this.state = 3016;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3015;
							this.callOptions();
							}
						}

						this.state = 3018;
						this.match(SolidCashParser.T__56);
						this.state = 3019;
						this.match(SolidCashParser.T__3);
						this.state = 3031;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===180) {
							{
							this.state = 3020;
							this.namedArg();
							this.state = 3025;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 346, this._ctx);
							while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
								if (_alt === 1) {
									{
									{
									this.state = 3021;
									this.match(SolidCashParser.T__4);
									this.state = 3022;
									this.namedArg();
									}
									}
								}
								this.state = 3027;
								this._errHandler.sync(this);
								_alt = this._interp.adaptivePredict(this._input, 346, this._ctx);
							}
							this.state = 3029;
							this._errHandler.sync(this);
							_la = this._input.LA(1);
							if (_la===5) {
								{
								this.state = 3028;
								this.match(SolidCashParser.T__4);
								}
							}

							}
						}

						this.state = 3033;
						this.match(SolidCashParser.T__5);
						this.state = 3034;
						this.match(SolidCashParser.T__57);
						}
						break;
					case 20:
						{
						localctx = new ChainedMethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3035;
						if (!(this.precpred(this._ctx, 30))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 30)");
						}
						this.state = 3036;
						this.match(SolidCashParser.T__6);
						this.state = 3037;
						this.match(SolidCashParser.Identifier);
						this.state = 3039;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3038;
							this.callOptions();
							}
						}

						this.state = 3041;
						this.expressionList();
						this.state = 3043;
						this._errHandler.sync(this);
						_alt = 1;
						do {
							switch (_alt) {
							case 1:
								{
								{
								this.state = 3042;
								this.expressionList();
								}
								}
								break;
							default:
								throw new NoViableAltException(this);
							}
							this.state = 3045;
							this._errHandler.sync(this);
							_alt = this._interp.adaptivePredict(this._input, 350, this._ctx);
						} while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER);
						}
						break;
					case 21:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3047;
						if (!(this.precpred(this._ctx, 29))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 29)");
						}
						this.state = 3048;
						this.match(SolidCashParser.DotLength);
						this.state = 3050;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3049;
							this.callOptions();
							}
						}

						this.state = 3052;
						this.expressionList();
						}
						break;
					case 22:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3053;
						if (!(this.precpred(this._ctx, 28))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 28)");
						}
						this.state = 3054;
						this.match(SolidCashParser.DotValue);
						this.state = 3056;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3055;
							this.callOptions();
							}
						}

						this.state = 3058;
						this.expressionList();
						}
						break;
					case 23:
						{
						localctx = new MethodCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3059;
						if (!(this.precpred(this._ctx, 27))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 27)");
						}
						this.state = 3060;
						this.match(SolidCashParser.T__6);
						this.state = 3061;
						this.match(SolidCashParser.Identifier);
						this.state = 3063;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3062;
							this.callOptions();
							}
						}

						this.state = 3065;
						this.expressionList();
						}
						break;
					case 24:
						{
						localctx = new CallOptionsMemberContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3066;
						if (!(this.precpred(this._ctx, 26))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 26)");
						}
						this.state = 3067;
						this.match(SolidCashParser.T__6);
						this.state = 3068;
						this.match(SolidCashParser.Identifier);
						this.state = 3069;
						this.callOptions();
						this.state = 3070;
						this.memberName();
						}
						break;
					case 25:
						{
						localctx = new IndexedFunctionCallContext(this, new ExpressionContext(this, _parentctx, _parentState));
						(localctx as IndexedFunctionCallContext)._base = _prevctx;
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3072;
						if (!(this.precpred(this._ctx, 25))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 25)");
						}
						this.state = 3073;
						this.match(SolidCashParser.T__81);
						this.state = 3074;
						(localctx as IndexedFunctionCallContext)._index = this.expression(0);
						this.state = 3075;
						this.match(SolidCashParser.T__82);
						this.state = 3077;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (_la===4) {
							{
							this.state = 3076;
							this.callOptions();
							}
						}

						this.state = 3079;
						this.expressionList();
						}
						break;
					case 26:
						{
						localctx = new FieldAccessContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3081;
						if (!(this.precpred(this._ctx, 24))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 24)");
						}
						this.state = 3082;
						this.memberName();
						}
						break;
					case 27:
						{
						localctx = new PostfixOpContext(this, new ExpressionContext(this, _parentctx, _parentState));
						this.pushNewRecursionContext(localctx, _startState, SolidCashParser.RULE_expression);
						this.state = 3083;
						if (!(this.precpred(this._ctx, 23))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 23)");
						}
						this.state = 3084;
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
						this.state = 3085;
						if (!(this.precpred(this._ctx, 9))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 9)");
						}
						this.state = 3086;
						this.match(SolidCashParser.T__134);
						this.state = 3087;
						(localctx as TernaryOpContext)._ifTrue = this.expression(0);
						this.state = 3090;
						this._errHandler.sync(this);
						_la = this._input.LA(1);
						if (((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0)) {
							{
							this.state = 3088;
							(localctx as TernaryOpContext)._tOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
							    (localctx as TernaryOpContext)._tOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 3089;
							(localctx as TernaryOpContext)._tVal = this.assignChain();
							}
						}

						this.state = 3092;
						this.match(SolidCashParser.T__114);
						this.state = 3093;
						(localctx as TernaryOpContext)._ifFalse = this.expression(0);
						this.state = 3096;
						this._errHandler.sync(this);
						switch ( this._interp.adaptivePredict(this._input, 356, this._ctx) ) {
						case 1:
							{
							this.state = 3094;
							(localctx as TernaryOpContext)._fOp = this._input.LT(1);
							_la = this._input.LA(1);
							if(!(((((_la - 48)) & ~0x1F) === 0 && ((1 << (_la - 48)) & 2145386497) !== 0))) {
							    (localctx as TernaryOpContext)._fOp = this._errHandler.recoverInline(this);
							}
							else {
								this._errHandler.reportMatch(this);
							    this.consume();
							}
							this.state = 3095;
							(localctx as TernaryOpContext)._fVal = this.assignChain();
							}
							break;
						}
						}
						break;
					}
					}
				}
				this.state = 3102;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 358, this._ctx);
			}
			}
		}
		catch (re) {
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
		this.enterRule(localctx, 278, SolidCashParser.RULE_typeIntrospectionBase);
		try {
			this.state = 3115;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 63:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3103;
				this.match(SolidCashParser.T__62);
				this.state = 3104;
				this.match(SolidCashParser.T__56);
				this.state = 3105;
				this.typeName();
				this.state = 3106;
				this.match(SolidCashParser.T__57);
				}
				break;
			case 57:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3108;
				this.match(SolidCashParser.T__56);
				this.state = 3109;
				this.match(SolidCashParser.T__62);
				this.state = 3110;
				this.match(SolidCashParser.T__56);
				this.state = 3111;
				this.typeName();
				this.state = 3112;
				this.match(SolidCashParser.T__57);
				this.state = 3113;
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
		this.enterRule(localctx, 280, SolidCashParser.RULE_abiEncodeCallArguments);
		try {
			this.state = 3125;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 360, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3117;
				this.match(SolidCashParser.T__56);
				this.state = 3118;
				localctx._target = this.match(SolidCashParser.Identifier);
				this.state = 3119;
				this.match(SolidCashParser.T__57);
				this.state = 3120;
				localctx._aop = this.match(SolidCashParser.T__47);
				this.state = 3121;
				this.expression(0);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3122;
				this.expression(0);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3123;
				this.match(SolidCashParser.T__56);
				this.state = 3124;
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
		this.enterRule(localctx, 282, SolidCashParser.RULE_bareAbiFunctionReferenceStatement);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3127;
			_la = this._input.LA(1);
			if(!(((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 287) !== 0))) {
			this._errHandler.recoverInline(this);
			}
			else {
				this._errHandler.reportMatch(this);
			    this.consume();
			}
			this.state = 3128;
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
		this.enterRule(localctx, 284, SolidCashParser.RULE_memberName);
		try {
			this.state = 3147;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 361, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3130;
				this.match(SolidCashParser.T__6);
				this.state = 3131;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3132;
				this.match(SolidCashParser.T__6);
				this.state = 3133;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3134;
				this.match(SolidCashParser.T__6);
				this.state = 3135;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3136;
				this.match(SolidCashParser.DotValue);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3137;
				this.match(SolidCashParser.DotLockingBytecode);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3138;
				this.match(SolidCashParser.DotTokenCategory);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3139;
				this.match(SolidCashParser.DotNftCommitment);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3140;
				this.match(SolidCashParser.DotTokenAmount);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3141;
				this.match(SolidCashParser.DotOutpointTransactionHash);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3142;
				this.match(SolidCashParser.DotOutpointIndex);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3143;
				this.match(SolidCashParser.DotUnlockingBytecode);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3144;
				this.match(SolidCashParser.DotSequenceNumber);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3145;
				this.match(SolidCashParser.DotCode);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3146;
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
		this.enterRule(localctx, 286, SolidCashParser.RULE_modifier);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3149;
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
		this.enterRule(localctx, 288, SolidCashParser.RULE_dataLocation);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3151;
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
		this.enterRule(localctx, 290, SolidCashParser.RULE_literal);
		try {
			let _alt: number;
			this.state = 3179;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case 141:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3153;
				this.match(SolidCashParser.BooleanLiteral);
				}
				break;
			case 145:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3154;
				this.numberLiteral();
				}
				break;
			case 144:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3155;
				this.decimalLiteral();
				}
				break;
			case 151:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3156;
				this.match(SolidCashParser.StringLiteral);
				this.state = 3160;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 362, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3157;
						this.match(SolidCashParser.StringLiteral);
						}
						}
					}
					this.state = 3162;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 362, this._ctx);
				}
				}
				break;
			case 161:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3163;
				this.match(SolidCashParser.UnicodeLiteral);
				this.state = 3167;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 363, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3164;
						this.match(SolidCashParser.UnicodeLiteral);
						}
						}
					}
					this.state = 3169;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 363, this._ctx);
				}
				}
				break;
			case 162:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3170;
				this.match(SolidCashParser.HexStringLiteral);
				this.state = 3174;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 364, this._ctx);
				while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
					if (_alt === 1) {
						{
						{
						this.state = 3171;
						this.match(SolidCashParser.HexStringLiteral);
						}
						}
					}
					this.state = 3176;
					this._errHandler.sync(this);
					_alt = this._interp.adaptivePredict(this._input, 364, this._ctx);
				}
				}
				break;
			case 152:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3177;
				this.match(SolidCashParser.DateLiteral);
				}
				break;
			case 153:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3178;
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
		this.enterRule(localctx, 292, SolidCashParser.RULE_numberLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3181;
			this.match(SolidCashParser.NumberLiteral);
			this.state = 3183;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 366, this._ctx) ) {
			case 1:
				{
				this.state = 3182;
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
		this.enterRule(localctx, 294, SolidCashParser.RULE_decimalLiteral);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3185;
			this.match(SolidCashParser.DecimalLiteral);
			this.state = 3187;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 367, this._ctx) ) {
			case 1:
				{
				this.state = 3186;
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
		this.enterRule(localctx, 296, SolidCashParser.RULE_typeName);
		try {
			this.state = 3208;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 368, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3189;
				this.match(SolidCashParser.T__90);
				this.state = 3190;
				this.match(SolidCashParser.T__66);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3191;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3192;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3193;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3194;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3195;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3196;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3197;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3198;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3199;
				this.match(SolidCashParser.T__89);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3200;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3201;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3202;
				this.functionType();
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3203;
				this.match(SolidCashParser.Identifier);
				this.state = 3204;
				this.match(SolidCashParser.T__6);
				this.state = 3205;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 15:
				this.enterOuterAlt(localctx, 15);
				{
				this.state = 3206;
				this.match(SolidCashParser.T__33);
				}
				break;
			case 16:
				this.enterOuterAlt(localctx, 16);
				{
				this.state = 3207;
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
		this.enterRule(localctx, 298, SolidCashParser.RULE_functionType);
		let _la: number;
		try {
			let _alt: number;
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3210;
			this.match(SolidCashParser.T__8);
			this.state = 3211;
			this.match(SolidCashParser.T__56);
			this.state = 3220;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la===9 || _la===34 || ((((_la - 80)) & ~0x1F) === 0 && ((1 << (_la - 80)) & 3585) !== 0) || ((((_la - 146)) & ~0x1F) === 0 && ((1 << (_la - 146)) & 15375) !== 0) || _la===180) {
				{
				this.state = 3212;
				this.functionTypeParameter();
				this.state = 3217;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 3213;
					this.match(SolidCashParser.T__4);
					this.state = 3214;
					this.functionTypeParameter();
					}
					}
					this.state = 3219;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				}
			}

			this.state = 3222;
			this.match(SolidCashParser.T__57);
			this.state = 3226;
			this._errHandler.sync(this);
			_alt = this._interp.adaptivePredict(this._input, 371, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					{
					{
					this.state = 3223;
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
				this.state = 3228;
				this._errHandler.sync(this);
				_alt = this._interp.adaptivePredict(this._input, 371, this._ctx);
			}
			this.state = 3241;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 373, this._ctx) ) {
			case 1:
				{
				this.state = 3229;
				this.match(SolidCashParser.T__87);
				this.state = 3230;
				this.match(SolidCashParser.T__56);
				this.state = 3231;
				this.functionTypeReturnParameter();
				this.state = 3236;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				while (_la===5) {
					{
					{
					this.state = 3232;
					this.match(SolidCashParser.T__4);
					this.state = 3233;
					this.functionTypeReturnParameter();
					}
					}
					this.state = 3238;
					this._errHandler.sync(this);
					_la = this._input.LA(1);
				}
				this.state = 3239;
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
		this.enterRule(localctx, 300, SolidCashParser.RULE_functionTypeParameter);
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3246;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 374, this._ctx) ) {
			case 1:
				{
				this.state = 3243;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 3244;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 3245;
				this.mappingType();
				}
				break;
			}
			this.state = 3249;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 375, this._ctx) ) {
			case 1:
				{
				this.state = 3248;
				this.dataLocation();
				}
				break;
			}
			this.state = 3252;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 376, this._ctx) ) {
			case 1:
				{
				this.state = 3251;
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
		this.enterRule(localctx, 302, SolidCashParser.RULE_functionTypeReturnParameter);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3257;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 377, this._ctx) ) {
			case 1:
				{
				this.state = 3254;
				this.typeName();
				}
				break;
			case 2:
				{
				this.state = 3255;
				this.arrayType(0);
				}
				break;
			case 3:
				{
				this.state = 3256;
				this.mappingType();
				}
				break;
			}
			this.state = 3260;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 136)) & ~0x1F) === 0 && ((1 << (_la - 136)) & 7) !== 0)) {
				{
				this.state = 3259;
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
		this.enterRule(localctx, 304, SolidCashParser.RULE_typeCast);
		try {
			this.state = 3277;
			this._errHandler.sync(this);
			switch ( this._interp.adaptivePredict(this._input, 379, this._ctx) ) {
			case 1:
				this.enterOuterAlt(localctx, 1);
				{
				this.state = 3262;
				this.match(SolidCashParser.PrimitiveType);
				}
				break;
			case 2:
				this.enterOuterAlt(localctx, 2);
				{
				this.state = 3263;
				if (!(this._input.LT(1).text === 'uint')) {
					throw this.createFailedPredicateException("this._input.LT(1).text === 'uint'");
				}
				this.state = 3264;
				this.match(SolidCashParser.Identifier);
				}
				break;
			case 3:
				this.enterOuterAlt(localctx, 3);
				{
				this.state = 3265;
				this.match(SolidCashParser.CryptoType);
				}
				break;
			case 4:
				this.enterOuterAlt(localctx, 4);
				{
				this.state = 3266;
				this.match(SolidCashParser.UnboundedBytes);
				}
				break;
			case 5:
				this.enterOuterAlt(localctx, 5);
				{
				this.state = 3267;
				this.match(SolidCashParser.BoundedBytes);
				}
				break;
			case 6:
				this.enterOuterAlt(localctx, 6);
				{
				this.state = 3268;
				this.match(SolidCashParser.UnsafeCast);
				}
				break;
			case 7:
				this.enterOuterAlt(localctx, 7);
				{
				this.state = 3269;
				this.match(SolidCashParser.BoundedSignedInt);
				}
				break;
			case 8:
				this.enterOuterAlt(localctx, 8);
				{
				this.state = 3270;
				this.match(SolidCashParser.BoundedUnsignedInt);
				}
				break;
			case 9:
				this.enterOuterAlt(localctx, 9);
				{
				this.state = 3271;
				this.match(SolidCashParser.T__88);
				}
				break;
			case 10:
				this.enterOuterAlt(localctx, 10);
				{
				this.state = 3272;
				this.match(SolidCashParser.T__89);
				}
				break;
			case 11:
				this.enterOuterAlt(localctx, 11);
				{
				this.state = 3273;
				this.match(SolidCashParser.BoundedSignedFixed);
				}
				break;
			case 12:
				this.enterOuterAlt(localctx, 12);
				{
				this.state = 3274;
				this.match(SolidCashParser.BoundedUnsignedFixed);
				}
				break;
			case 13:
				this.enterOuterAlt(localctx, 13);
				{
				this.state = 3275;
				this.match(SolidCashParser.T__90);
				}
				break;
			case 14:
				this.enterOuterAlt(localctx, 14);
				{
				this.state = 3276;
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
		this.enterRule(localctx, 306, SolidCashParser.RULE_arrayCastType);
		let _la: number;
		try {
			this.enterOuterAlt(localctx, 1);
			{
			this.state = 3279;
			this.typeCast();
			this.state = 3287;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la===82) {
				{
				{
				this.state = 3280;
				this.match(SolidCashParser.T__81);
				this.state = 3282;
				this._errHandler.sync(this);
				switch ( this._interp.adaptivePredict(this._input, 380, this._ctx) ) {
				case 1:
					{
					this.state = 3281;
					this.expression(0);
					}
					break;
				}
				this.state = 3284;
				this.match(SolidCashParser.T__82);
				}
				}
				this.state = 3289;
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
		case 113:
			return this.yulIdentifier_sempred(localctx as YulIdentifierContext, predIndex);
		case 138:
			return this.expression_sempred(localctx as ExpressionContext, predIndex);
		case 152:
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
	private expression_sempred(localctx: ExpressionContext, predIndex: number): boolean {
		switch (predIndex) {
		case 4:
			return this.precpred(this._ctx, 20);
		case 5:
			return this.precpred(this._ctx, 19);
		case 6:
			return this.precpred(this._ctx, 18);
		case 7:
			return this.precpred(this._ctx, 17);
		case 8:
			return this.precpred(this._ctx, 16);
		case 9:
			return this.precpred(this._ctx, 15);
		case 10:
			return this.precpred(this._ctx, 14);
		case 11:
			return this.precpred(this._ctx, 13);
		case 12:
			return this.precpred(this._ctx, 12);
		case 13:
			return this.precpred(this._ctx, 11);
		case 14:
			return this.precpred(this._ctx, 10);
		case 15:
			return this.precpred(this._ctx, 40);
		case 16:
			return this.precpred(this._ctx, 39);
		case 17:
			return this.precpred(this._ctx, 38);
		case 18:
			return this.precpred(this._ctx, 35);
		case 19:
			return this.precpred(this._ctx, 34);
		case 20:
			return this.precpred(this._ctx, 33);
		case 21:
			return this.precpred(this._ctx, 32);
		case 22:
			return this.precpred(this._ctx, 31);
		case 23:
			return this.precpred(this._ctx, 30);
		case 24:
			return this.precpred(this._ctx, 29);
		case 25:
			return this.precpred(this._ctx, 28);
		case 26:
			return this.precpred(this._ctx, 27);
		case 27:
			return this.precpred(this._ctx, 26);
		case 28:
			return this.precpred(this._ctx, 25);
		case 29:
			return this.precpred(this._ctx, 24);
		case 30:
			return this.precpred(this._ctx, 23);
		case 31:
			return this.precpred(this._ctx, 9);
		}
		return true;
	}
	private typeCast_sempred(localctx: TypeCastContext, predIndex: number): boolean {
		switch (predIndex) {
		case 32:
			return this._input.LT(1).text === 'uint';
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,1,183,3291,2,0,7,0,
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
	7,151,2,152,7,152,2,153,7,153,1,0,5,0,310,8,0,10,0,12,0,313,9,0,1,0,1,0,
	5,0,317,8,0,10,0,12,0,320,9,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,
	0,1,0,5,0,334,8,0,10,0,12,0,337,9,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,5,1,354,8,1,10,1,12,1,357,9,1,1,1,3,1,360,8,1,1,
	1,1,1,1,1,1,1,1,1,3,1,367,8,1,1,2,1,2,1,2,3,2,372,8,2,1,3,1,3,1,3,1,3,1,
	3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,3,1,
	3,1,3,1,3,1,3,3,3,400,8,3,1,3,1,3,1,3,1,3,3,3,406,8,3,5,3,408,8,3,10,3,
	12,3,411,9,3,1,3,1,3,1,3,1,3,1,3,1,3,3,3,419,8,3,1,4,1,4,1,4,1,4,1,4,5,
	4,426,8,4,10,4,12,4,429,9,4,1,4,3,4,432,8,4,1,4,1,4,5,4,436,8,4,10,4,12,
	4,439,9,4,1,4,1,4,1,5,1,5,1,5,1,5,1,5,1,5,1,5,3,5,450,8,5,1,5,3,5,453,8,
	5,1,5,1,5,1,5,1,5,1,5,1,5,5,5,461,8,5,10,5,12,5,464,9,5,1,5,3,5,467,8,5,
	1,5,1,5,1,5,1,5,1,5,1,5,3,5,475,8,5,1,5,3,5,478,8,5,1,5,1,5,3,5,482,8,5,
	1,6,1,6,1,6,3,6,487,8,6,1,6,1,6,3,6,491,8,6,1,7,1,7,1,8,1,8,1,8,1,8,1,8,
	1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,3,8,515,8,8,
	1,9,1,9,1,9,3,9,520,8,9,1,10,1,10,1,10,1,10,1,10,1,10,1,10,1,10,5,10,530,
	8,10,10,10,12,10,533,9,10,1,10,3,10,536,8,10,1,11,1,11,1,12,1,12,1,12,5,
	12,543,8,12,10,12,12,12,546,9,12,1,12,3,12,549,8,12,1,13,1,13,1,13,1,13,
	1,13,4,13,556,8,13,11,13,12,13,557,3,13,560,8,13,1,14,3,14,563,8,14,1,14,
	1,14,1,15,1,15,1,16,1,16,1,16,1,16,1,16,1,16,5,16,575,8,16,10,16,12,16,
	578,9,16,3,16,580,8,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,1,16,
	1,16,5,16,593,8,16,10,16,12,16,596,9,16,1,16,1,16,1,17,1,17,1,17,1,17,1,
	17,1,17,1,17,1,17,1,17,1,17,3,17,610,8,17,1,18,1,18,1,18,1,18,1,18,1,19,
	1,19,1,20,1,20,1,20,1,20,5,20,623,8,20,10,20,12,20,626,9,20,1,20,3,20,629,
	8,20,1,20,1,20,1,21,1,21,1,21,5,21,636,8,21,10,21,12,21,639,9,21,1,21,1,
	21,5,21,643,8,21,10,21,12,21,646,9,21,1,21,3,21,649,8,21,1,21,1,21,1,22,
	1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,1,22,5,22,666,8,
	22,10,22,12,22,669,9,22,1,22,1,22,1,23,3,23,674,8,23,1,23,1,23,1,23,3,23,
	679,8,23,1,23,1,23,1,23,1,23,5,23,685,8,23,10,23,12,23,688,9,23,3,23,690,
	8,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,23,1,
	23,1,23,5,23,707,8,23,10,23,12,23,710,9,23,1,23,1,23,1,24,1,24,3,24,716,
	8,24,1,25,1,25,1,25,1,25,1,25,5,25,723,8,25,10,25,12,25,726,9,25,1,25,3,
	25,729,8,25,1,25,1,25,1,26,1,26,1,26,3,26,736,8,26,1,26,1,26,1,26,1,26,
	5,26,742,8,26,10,26,12,26,745,9,26,1,26,3,26,748,8,26,3,26,750,8,26,1,26,
	1,26,3,26,754,8,26,1,26,1,26,1,27,1,27,3,27,760,8,27,1,27,3,27,763,8,27,
	1,27,3,27,766,8,27,1,28,1,28,1,28,1,28,1,28,1,28,5,28,774,8,28,10,28,12,
	28,777,9,28,1,28,3,28,780,8,28,3,28,782,8,28,1,28,1,28,1,28,1,29,1,29,3,
	29,789,8,29,1,29,1,29,3,29,793,8,29,3,29,795,8,29,1,30,1,30,1,30,1,30,4,
	30,801,8,30,11,30,12,30,802,1,30,1,30,1,31,1,31,1,31,3,31,810,8,31,1,31,
	1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,5,32,821,8,32,10,32,12,32,824,9,
	32,1,32,3,32,827,8,32,1,32,1,32,1,33,1,33,1,33,3,33,834,8,33,1,34,1,34,
	1,34,1,34,1,34,1,34,1,35,1,35,1,35,1,35,1,35,1,35,1,35,1,36,1,36,1,36,5,
	36,852,8,36,10,36,12,36,855,9,36,1,36,5,36,858,8,36,10,36,12,36,861,9,36,
	1,36,5,36,864,8,36,10,36,12,36,867,9,36,1,36,5,36,870,8,36,10,36,12,36,
	873,9,36,1,36,1,36,5,36,877,8,36,10,36,12,36,880,9,36,1,36,1,36,1,37,1,
	37,1,37,5,37,887,8,37,10,37,12,37,890,9,37,1,37,1,37,5,37,894,8,37,10,37,
	12,37,897,9,37,1,37,5,37,900,8,37,10,37,12,37,903,9,37,1,37,3,37,906,8,
	37,1,37,1,37,5,37,910,8,37,10,37,12,37,913,9,37,1,37,1,37,1,38,1,38,1,38,
	3,38,920,8,38,1,39,1,39,1,39,1,39,5,39,926,8,39,10,39,12,39,929,9,39,1,
	39,1,39,5,39,933,8,39,10,39,12,39,936,9,39,1,39,1,39,5,39,940,8,39,10,39,
	12,39,943,9,39,1,39,1,39,5,39,947,8,39,10,39,12,39,950,9,39,1,39,1,39,3,
	39,954,8,39,1,39,1,39,1,39,1,39,5,39,960,8,39,10,39,12,39,963,9,39,1,39,
	1,39,5,39,967,8,39,10,39,12,39,970,9,39,1,39,1,39,5,39,974,8,39,10,39,12,
	39,977,9,39,1,39,1,39,5,39,981,8,39,10,39,12,39,984,9,39,1,39,1,39,3,39,
	988,8,39,3,39,990,8,39,1,40,1,40,3,40,994,8,40,1,41,1,41,1,41,1,42,3,42,
	1000,8,42,1,42,1,42,1,42,5,42,1005,8,42,10,42,12,42,1008,9,42,1,42,1,42,
	1,42,1,42,1,42,3,42,1015,8,42,3,42,1017,8,42,1,42,1,42,1,42,1,42,1,42,5,
	42,1024,8,42,10,42,12,42,1027,9,42,1,42,1,42,1,42,5,42,1032,8,42,10,42,
	12,42,1035,9,42,1,42,1,42,1,42,1,42,1,42,3,42,1042,8,42,3,42,1044,8,42,
	1,42,1,42,1,42,3,42,1049,8,42,1,42,3,42,1052,8,42,1,42,1,42,5,42,1056,8,
	42,10,42,12,42,1059,9,42,1,42,1,42,1,42,1,42,3,42,1065,8,42,1,42,1,42,5,
	42,1069,8,42,10,42,12,42,1072,9,42,1,42,1,42,1,42,3,42,1077,8,42,1,42,1,
	42,3,42,1081,8,42,1,43,1,43,1,43,3,43,1086,8,43,1,44,1,44,1,45,1,45,1,45,
	1,45,3,45,1094,8,45,1,45,1,45,1,45,3,45,1099,8,45,1,45,1,45,1,45,1,45,1,
	45,1,45,3,45,1107,8,45,1,45,1,45,1,45,3,45,1112,8,45,1,45,1,45,1,45,1,45,
	1,45,1,45,3,45,1120,8,45,1,45,1,45,1,45,3,45,1125,8,45,1,45,1,45,3,45,1129,
	8,45,1,46,1,46,1,46,1,46,3,46,1135,8,46,1,46,1,46,1,46,1,46,1,46,3,46,1142,
	8,46,1,46,1,46,1,46,1,46,1,46,3,46,1149,8,46,1,46,1,46,3,46,1153,8,46,1,
	46,1,46,1,46,3,46,1158,8,46,1,46,5,46,1161,8,46,10,46,12,46,1164,9,46,1,
	47,1,47,1,47,3,47,1169,8,47,1,47,1,47,5,47,1173,8,47,10,47,12,47,1176,9,
	47,1,47,1,47,5,47,1180,8,47,10,47,12,47,1183,9,47,1,47,1,47,3,47,1187,8,
	47,1,48,1,48,3,48,1191,8,48,1,49,1,49,1,49,1,50,1,50,1,50,1,50,1,50,5,50,
	1201,8,50,10,50,12,50,1204,9,50,1,50,3,50,1207,8,50,1,50,1,50,5,50,1211,
	8,50,10,50,12,50,1214,9,50,1,50,1,50,1,51,1,51,3,51,1220,8,51,1,51,1,51,
	3,51,1224,8,51,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,52,1,
	52,3,52,1238,8,52,1,53,1,53,1,53,1,53,1,53,5,53,1245,8,53,10,53,12,53,1248,
	9,53,1,53,3,53,1251,8,53,1,54,1,54,1,54,1,54,3,54,1257,8,54,1,55,1,55,1,
	55,1,55,1,55,5,55,1264,8,55,10,55,12,55,1267,9,55,1,55,3,55,1270,8,55,1,
	55,1,55,1,56,1,56,5,56,1276,8,56,10,56,12,56,1279,9,56,1,56,3,56,1282,8,
	56,1,56,1,56,5,56,1286,8,56,10,56,12,56,1289,9,56,1,56,3,56,1292,8,56,1,
	56,1,56,5,56,1296,8,56,10,56,12,56,1299,9,56,1,56,3,56,1302,8,56,3,56,1304,
	8,56,1,57,1,57,1,57,1,57,5,57,1310,8,57,10,57,12,57,1313,9,57,1,57,3,57,
	1316,8,57,3,57,1318,8,57,1,57,1,57,1,58,1,58,5,58,1324,8,58,10,58,12,58,
	1327,9,58,1,58,3,58,1330,8,58,1,58,1,58,5,58,1334,8,58,10,58,12,58,1337,
	9,58,1,58,3,58,1340,8,58,1,58,1,58,5,58,1344,8,58,10,58,12,58,1347,9,58,
	1,58,3,58,1350,8,58,3,58,1352,8,58,1,59,1,59,5,59,1356,8,59,10,59,12,59,
	1359,9,59,1,59,1,59,3,59,1363,8,59,1,60,1,60,5,60,1367,8,60,10,60,12,60,
	1370,9,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,
	61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,
	1,61,1,61,1,61,1,61,1,61,1,61,3,61,1405,8,61,1,62,1,62,1,62,3,62,1410,8,
	62,1,62,5,62,1413,8,62,10,62,12,62,1416,9,62,1,62,1,62,1,62,1,62,1,62,1,
	62,3,62,1424,8,62,1,62,4,62,1427,8,62,11,62,12,62,1428,1,62,1,62,1,62,3,
	62,1434,8,62,1,63,1,63,1,63,3,63,1439,8,63,1,63,5,63,1442,8,63,10,63,12,
	63,1445,9,63,1,63,1,63,1,63,1,63,3,63,1451,8,63,1,63,5,63,1454,8,63,10,
	63,12,63,1457,9,63,1,63,1,63,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,
	64,1,64,1,64,1,64,3,64,1473,8,64,3,64,1475,8,64,1,65,1,65,1,65,1,65,1,65,
	1,65,1,66,1,66,1,66,1,66,1,66,3,66,1488,8,66,1,66,1,66,1,67,1,67,1,67,1,
	67,3,67,1496,8,67,1,68,1,68,1,68,1,68,1,68,1,69,1,69,1,69,3,69,1506,8,69,
	1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1529,8,70,1,70,1,70,1,70,1,70,1,70,
	1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1545,8,70,3,70,1547,8,
	70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1555,8,70,1,70,1,70,1,70,1,70,1,70,
	1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,
	70,3,70,1577,8,70,3,70,1579,8,70,1,70,1,70,1,70,3,70,1584,8,70,1,70,1,70,
	1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,3,70,1596,8,70,1,70,1,70,1,71,1,
	71,1,71,3,71,1603,8,71,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,
	1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,5,73,1627,8,
	73,10,73,12,73,1630,9,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,5,73,1639,8,
	73,10,73,12,73,1642,9,73,1,73,3,73,1645,8,73,1,73,1,73,1,73,3,73,1650,8,
	73,1,74,1,74,1,74,1,74,1,74,1,74,1,75,1,75,1,75,1,75,3,75,1662,8,75,1,75,
	1,75,1,75,1,75,1,75,5,75,1669,8,75,10,75,12,75,1672,9,75,1,75,3,75,1675,
	8,75,3,75,1677,8,75,1,75,1,75,1,75,1,75,1,75,1,75,1,75,3,75,1686,8,75,1,
	75,1,75,1,75,3,75,1691,8,75,1,76,1,76,5,76,1695,8,76,10,76,12,76,1698,9,
	76,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1706,8,76,3,76,1708,8,76,1,76,1,76,
	1,76,1,76,5,76,1714,8,76,10,76,12,76,1717,9,76,1,76,1,76,1,76,1,76,1,76,
	1,76,3,76,1725,8,76,3,76,1727,8,76,1,76,1,76,1,76,1,76,5,76,1733,8,76,10,
	76,12,76,1736,9,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,1,76,3,76,1746,8,
	76,3,76,1748,8,76,1,76,1,76,1,76,1,76,5,76,1754,8,76,10,76,12,76,1757,9,
	76,1,76,1,76,1,76,3,76,1762,8,76,1,76,1,76,3,76,1766,8,76,1,77,1,77,1,77,
	3,77,1771,8,77,1,77,4,77,1774,8,77,11,77,12,77,1775,1,78,1,78,1,78,1,78,
	1,78,1,78,4,78,1784,8,78,11,78,12,78,1785,1,78,1,78,1,78,1,78,1,78,1,78,
	1,78,1,78,4,78,1796,8,78,11,78,12,78,1797,1,78,1,78,1,78,1,78,1,78,1,78,
	4,78,1806,8,78,11,78,12,78,1807,1,78,1,78,1,78,1,78,1,78,1,78,1,78,4,78,
	1817,8,78,11,78,12,78,1818,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,5,78,
	1829,8,78,10,78,12,78,1832,9,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,1,78,
	1,78,5,78,1843,8,78,10,78,12,78,1846,9,78,1,78,1,78,1,78,1,78,1,78,1,78,
	3,78,1854,8,78,1,79,1,79,1,79,1,79,1,79,1,79,1,80,1,80,3,80,1864,8,80,1,
	80,1,80,3,80,1868,8,80,5,80,1870,8,80,10,80,12,80,1873,9,80,1,80,1,80,1,
	81,1,81,5,81,1879,8,81,10,81,12,81,1882,9,81,1,81,1,81,1,81,1,81,5,81,1888,
	8,81,10,81,12,81,1891,9,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,1,81,
	1,81,1,81,1,81,5,81,1905,8,81,10,81,12,81,1908,9,81,1,81,3,81,1911,8,81,
	1,82,1,82,5,82,1915,8,82,10,82,12,82,1918,9,82,1,82,1,82,1,82,1,82,5,82,
	1924,8,82,10,82,12,82,1927,9,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,1,82,
	1,82,1,82,1,82,1,82,5,82,1941,8,82,10,82,12,82,1944,9,82,1,82,3,82,1947,
	8,82,1,83,1,83,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,3,84,1959,8,84,1,
	84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,
	1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,4,84,1984,8,84,11,84,12,84,1985,
	1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,4,84,1996,8,84,11,84,12,84,1997,
	1,84,1,84,1,84,1,84,1,84,1,84,5,84,2006,8,84,10,84,12,84,2009,9,84,4,84,
	2011,8,84,11,84,12,84,2012,1,84,1,84,1,84,1,84,1,84,1,84,1,84,1,84,4,84,
	2023,8,84,11,84,12,84,2024,1,84,1,84,1,84,1,84,1,84,1,84,4,84,2033,8,84,
	11,84,12,84,2034,1,84,1,84,1,84,1,84,4,84,2041,8,84,11,84,12,84,2042,1,
	84,1,84,1,84,1,84,1,84,1,84,4,84,2051,8,84,11,84,12,84,2052,1,84,3,84,2056,
	8,84,1,85,1,85,1,85,1,85,1,85,1,85,1,85,3,85,2065,8,85,1,85,1,85,1,85,1,
	86,1,86,1,86,1,86,1,86,3,86,2075,8,86,1,86,1,86,1,86,1,87,1,87,1,87,1,87,
	1,87,1,87,1,87,3,87,2087,8,87,1,88,1,88,1,88,1,88,1,88,1,88,3,88,2095,8,
	88,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,89,
	1,89,1,89,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,90,1,91,1,
	91,1,91,1,91,1,91,1,91,1,91,1,91,1,91,1,91,1,91,1,92,1,92,1,92,1,92,1,92,
	3,92,2140,8,92,1,92,1,92,1,92,1,93,1,93,5,93,2147,8,93,10,93,12,93,2150,
	9,93,1,93,1,93,1,93,3,93,2155,8,93,1,93,1,93,1,93,1,93,1,93,1,93,1,93,1,
	93,1,93,1,93,1,93,4,93,2168,8,93,11,93,12,93,2169,1,93,1,93,1,93,1,93,1,
	93,1,93,4,93,2178,8,93,11,93,12,93,2179,1,93,1,93,1,93,3,93,2185,8,93,1,
	93,1,93,1,93,3,93,2190,8,93,1,94,3,94,2193,8,94,1,94,1,94,1,95,1,95,1,95,
	1,95,1,95,1,95,1,95,1,95,1,95,1,95,1,95,4,95,2208,8,95,11,95,12,95,2209,
	1,95,1,95,1,95,1,95,1,95,1,95,4,95,2218,8,95,11,95,12,95,2219,1,95,1,95,
	1,95,3,95,2225,8,95,1,95,3,95,2228,8,95,1,96,1,96,1,96,1,96,1,96,1,96,1,
	96,1,96,1,97,1,97,1,97,1,97,1,97,1,97,1,98,1,98,1,98,1,98,1,99,1,99,3,99,
	2250,8,99,1,99,1,99,1,99,1,99,5,99,2256,8,99,10,99,12,99,2259,9,99,1,99,
	3,99,2262,8,99,1,99,1,99,1,100,1,100,5,100,2268,8,100,10,100,12,100,2271,
	9,100,1,100,1,100,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,
	1,101,1,101,1,101,1,101,3,101,2288,8,101,1,102,1,102,1,102,1,102,5,102,
	2294,8,102,10,102,12,102,2297,9,102,1,102,1,102,3,102,2301,8,102,1,103,
	1,103,1,103,5,103,2306,8,103,10,103,12,103,2309,9,103,1,103,1,103,1,103,
	1,104,1,104,1,104,1,104,1,105,1,105,1,105,4,105,2321,8,105,11,105,12,105,
	2322,1,105,3,105,2326,8,105,1,105,3,105,2329,8,105,1,106,1,106,1,106,1,
	106,1,107,1,107,1,107,1,108,1,108,1,108,1,108,1,108,1,108,1,109,1,109,1,
	109,1,109,1,109,1,109,5,109,2350,8,109,10,109,12,109,2353,9,109,3,109,2355,
	8,109,1,109,1,109,1,109,1,109,1,109,5,109,2362,8,109,10,109,12,109,2365,
	9,109,3,109,2367,8,109,1,109,1,109,1,110,1,110,1,110,3,110,2374,8,110,1,
	111,1,111,1,111,1,111,1,111,5,111,2381,8,111,10,111,12,111,2384,9,111,3,
	111,2386,8,111,1,111,1,111,1,112,1,112,1,113,1,113,1,113,3,113,2395,8,113,
	1,114,1,114,1,114,1,114,1,114,1,114,5,114,2403,8,114,10,114,12,114,2406,
	9,114,1,115,1,115,1,116,1,116,1,116,5,116,2413,8,116,10,116,12,116,2416,
	9,116,1,116,1,116,1,117,1,117,1,117,1,117,1,117,1,117,5,117,2426,8,117,
	10,117,12,117,2429,9,117,1,117,3,117,2432,8,117,1,117,1,117,1,118,1,118,
	1,118,1,118,5,118,2440,8,118,10,118,12,118,2443,9,118,1,119,1,119,1,119,
	5,119,2448,8,119,10,119,12,119,2451,9,119,1,120,1,120,1,120,3,120,2456,
	8,120,1,120,1,120,4,120,2460,8,120,11,120,12,120,2461,1,121,1,121,1,121,
	1,121,1,121,5,121,2469,8,121,10,121,12,121,2472,9,121,1,121,3,121,2475,
	8,121,3,121,2477,8,121,1,121,1,121,1,122,1,122,3,122,2483,8,122,1,122,1,
	122,1,122,1,122,5,122,2489,8,122,10,122,12,122,2492,9,122,1,122,3,122,2495,
	8,122,3,122,2497,8,122,1,122,3,122,2500,8,122,1,122,1,122,1,123,1,123,1,
	123,1,124,1,124,1,124,1,125,1,125,1,125,1,125,3,125,2514,8,125,1,126,1,
	126,1,126,1,126,3,126,2520,8,126,1,126,1,126,1,126,1,126,1,126,5,126,2527,
	8,126,10,126,12,126,2530,9,126,1,126,3,126,2533,8,126,3,126,2535,8,126,
	1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,3,126,2545,8,126,1,126,
	1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,
	3,126,2560,8,126,1,127,1,127,1,127,1,127,1,127,1,127,1,128,1,128,3,128,
	2570,8,128,1,129,1,129,1,129,1,129,5,129,2576,8,129,10,129,12,129,2579,
	9,129,1,129,3,129,2582,8,129,3,129,2584,8,129,1,129,1,129,1,130,1,130,1,
	130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,
	130,1,130,1,130,1,130,1,130,1,130,5,130,2608,8,130,10,130,12,130,2611,9,
	130,1,130,3,130,2614,8,130,3,130,2616,8,130,1,130,1,130,1,130,1,130,1,130,
	1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,1,130,
	1,130,1,130,1,130,1,130,1,130,5,130,2640,8,130,10,130,12,130,2643,9,130,
	1,130,3,130,2646,8,130,3,130,2648,8,130,1,130,1,130,3,130,2652,8,130,1,
	131,1,131,1,131,1,131,1,132,1,132,1,132,1,132,5,132,2662,8,132,10,132,12,
	132,2665,9,132,1,132,3,132,2668,8,132,3,132,2670,8,132,1,132,1,132,1,133,
	1,133,1,133,1,133,1,133,1,133,1,133,3,133,2681,8,133,3,133,2683,8,133,1,
	134,1,134,1,134,1,134,5,134,2689,8,134,10,134,12,134,2692,9,134,1,134,3,
	134,2695,8,134,1,134,1,134,1,135,1,135,1,135,1,135,1,136,1,136,1,136,1,
	136,5,136,2707,8,136,10,136,12,136,2710,9,136,1,136,3,136,2713,8,136,3,
	136,2715,8,136,1,136,1,136,1,137,1,137,1,137,1,137,1,137,1,137,1,137,3,
	137,2726,8,137,1,137,5,137,2729,8,137,10,137,12,137,2732,9,137,3,137,2734,
	8,137,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,4,138,2760,8,138,11,138,12,138,2761,1,138,1,138,1,138,1,138,1,138,
	1,138,3,138,2770,8,138,1,138,1,138,1,138,1,138,4,138,2776,8,138,11,138,
	12,138,2777,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,3,138,
	2789,8,138,1,138,1,138,1,138,1,138,1,138,3,138,2796,8,138,1,138,4,138,2799,
	8,138,11,138,12,138,2800,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,3,138,2844,8,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,5,138,2891,8,138,
	10,138,12,138,2894,9,138,1,138,3,138,2897,8,138,3,138,2899,8,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,4,138,2919,8,138,11,138,12,138,2920,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,3,138,2930,8,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,3,138,2968,8,138,
	1,138,1,138,3,138,2972,8,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,3,138,3006,8,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,3,138,3017,8,138,1,138,1,138,1,138,1,138,1,138,5,138,3024,8,138,10,
	138,12,138,3027,9,138,1,138,3,138,3030,8,138,3,138,3032,8,138,1,138,1,138,
	1,138,1,138,1,138,1,138,3,138,3040,8,138,1,138,1,138,4,138,3044,8,138,11,
	138,12,138,3045,1,138,1,138,1,138,3,138,3051,8,138,1,138,1,138,1,138,1,
	138,3,138,3057,8,138,1,138,1,138,1,138,1,138,1,138,3,138,3064,8,138,1,138,
	1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,3,138,
	3078,8,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,1,138,
	1,138,3,138,3091,8,138,1,138,1,138,1,138,1,138,3,138,3097,8,138,5,138,3099,
	8,138,10,138,12,138,3102,9,138,1,139,1,139,1,139,1,139,1,139,1,139,1,139,
	1,139,1,139,1,139,1,139,1,139,3,139,3116,8,139,1,140,1,140,1,140,1,140,
	1,140,1,140,1,140,1,140,3,140,3126,8,140,1,141,1,141,1,141,1,142,1,142,
	1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,
	1,142,1,142,1,142,3,142,3148,8,142,1,143,1,143,1,144,1,144,1,145,1,145,
	1,145,1,145,1,145,5,145,3159,8,145,10,145,12,145,3162,9,145,1,145,1,145,
	5,145,3166,8,145,10,145,12,145,3169,9,145,1,145,1,145,5,145,3173,8,145,
	10,145,12,145,3176,9,145,1,145,1,145,3,145,3180,8,145,1,146,1,146,3,146,
	3184,8,146,1,147,1,147,3,147,3188,8,147,1,148,1,148,1,148,1,148,1,148,1,
	148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,
	148,1,148,3,148,3209,8,148,1,149,1,149,1,149,1,149,1,149,5,149,3216,8,149,
	10,149,12,149,3219,9,149,3,149,3221,8,149,1,149,1,149,5,149,3225,8,149,
	10,149,12,149,3228,9,149,1,149,1,149,1,149,1,149,1,149,5,149,3235,8,149,
	10,149,12,149,3238,9,149,1,149,1,149,3,149,3242,8,149,1,150,1,150,1,150,
	3,150,3247,8,150,1,150,3,150,3250,8,150,1,150,3,150,3253,8,150,1,151,1,
	151,1,151,3,151,3258,8,151,1,151,3,151,3261,8,151,1,152,1,152,1,152,1,152,
	1,152,1,152,1,152,1,152,1,152,1,152,1,152,1,152,1,152,1,152,1,152,3,152,
	3278,8,152,1,153,1,153,1,153,3,153,3283,8,153,1,153,5,153,3286,8,153,10,
	153,12,153,3289,9,153,1,153,0,2,92,276,154,0,2,4,6,8,10,12,14,16,18,20,
	22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,
	70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,
	114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,
	150,152,154,156,158,160,162,164,166,168,170,172,174,176,178,180,182,184,
	186,188,190,192,194,196,198,200,202,204,206,208,210,212,214,216,218,220,
	222,224,226,228,230,232,234,236,238,240,242,244,246,248,250,252,254,256,
	258,260,262,264,266,268,270,272,274,276,278,280,282,284,286,288,290,292,
	294,296,298,300,302,304,306,0,30,2,0,8,8,13,27,2,0,149,149,156,159,5,0,
	45,45,140,140,145,145,151,151,180,180,1,0,45,46,2,0,140,140,144,145,3,0,
	20,23,26,27,48,48,1,0,51,52,1,0,42,43,2,0,51,52,66,67,2,0,48,48,69,78,3,
	0,51,52,66,66,79,79,2,0,165,166,169,169,1,0,93,94,6,0,30,30,35,35,91,91,
	95,95,149,149,180,180,5,0,141,141,145,145,151,151,153,153,162,162,2,0,42,
	42,180,180,2,0,118,122,126,126,2,0,163,163,172,175,2,0,163,163,172,179,
	3,0,14,14,27,27,131,131,2,0,8,8,15,16,1,0,13,14,1,0,132,133,1,0,20,23,1,
	0,18,19,2,0,130,130,164,164,4,0,32,32,36,36,64,64,136,139,1,0,136,138,1,
	0,142,143,3,0,52,52,66,67,85,86,3811,0,311,1,0,0,0,2,366,1,0,0,0,4,368,
	1,0,0,0,6,418,1,0,0,0,8,420,1,0,0,0,10,481,1,0,0,0,12,483,1,0,0,0,14,492,
	1,0,0,0,16,514,1,0,0,0,18,519,1,0,0,0,20,535,1,0,0,0,22,537,1,0,0,0,24,
	548,1,0,0,0,26,559,1,0,0,0,28,562,1,0,0,0,30,566,1,0,0,0,32,568,1,0,0,0,
	34,609,1,0,0,0,36,611,1,0,0,0,38,616,1,0,0,0,40,618,1,0,0,0,42,632,1,0,
	0,0,44,652,1,0,0,0,46,673,1,0,0,0,48,713,1,0,0,0,50,717,1,0,0,0,52,732,
	1,0,0,0,54,759,1,0,0,0,56,767,1,0,0,0,58,794,1,0,0,0,60,796,1,0,0,0,62,
	809,1,0,0,0,64,814,1,0,0,0,66,830,1,0,0,0,68,835,1,0,0,0,70,841,1,0,0,0,
	72,848,1,0,0,0,74,883,1,0,0,0,76,919,1,0,0,0,78,989,1,0,0,0,80,993,1,0,
	0,0,82,995,1,0,0,0,84,1080,1,0,0,0,86,1085,1,0,0,0,88,1087,1,0,0,0,90,1128,
	1,0,0,0,92,1152,1,0,0,0,94,1165,1,0,0,0,96,1190,1,0,0,0,98,1192,1,0,0,0,
	100,1195,1,0,0,0,102,1219,1,0,0,0,104,1237,1,0,0,0,106,1239,1,0,0,0,108,
	1252,1,0,0,0,110,1258,1,0,0,0,112,1303,1,0,0,0,114,1305,1,0,0,0,116,1351,
	1,0,0,0,118,1362,1,0,0,0,120,1364,1,0,0,0,122,1404,1,0,0,0,124,1433,1,0,
	0,0,126,1435,1,0,0,0,128,1474,1,0,0,0,130,1476,1,0,0,0,132,1482,1,0,0,0,
	134,1495,1,0,0,0,136,1497,1,0,0,0,138,1502,1,0,0,0,140,1514,1,0,0,0,142,
	1599,1,0,0,0,144,1604,1,0,0,0,146,1649,1,0,0,0,148,1651,1,0,0,0,150,1690,
	1,0,0,0,152,1765,1,0,0,0,154,1767,1,0,0,0,156,1853,1,0,0,0,158,1855,1,0,
	0,0,160,1861,1,0,0,0,162,1910,1,0,0,0,164,1946,1,0,0,0,166,1948,1,0,0,0,
	168,2055,1,0,0,0,170,2057,1,0,0,0,172,2069,1,0,0,0,174,2079,1,0,0,0,176,
	2094,1,0,0,0,178,2096,1,0,0,0,180,2112,1,0,0,0,182,2123,1,0,0,0,184,2134,
	1,0,0,0,186,2189,1,0,0,0,188,2192,1,0,0,0,190,2227,1,0,0,0,192,2229,1,0,
	0,0,194,2237,1,0,0,0,196,2243,1,0,0,0,198,2247,1,0,0,0,200,2265,1,0,0,0,
	202,2287,1,0,0,0,204,2289,1,0,0,0,206,2302,1,0,0,0,208,2313,1,0,0,0,210,
	2317,1,0,0,0,212,2330,1,0,0,0,214,2334,1,0,0,0,216,2337,1,0,0,0,218,2343,
	1,0,0,0,220,2373,1,0,0,0,222,2375,1,0,0,0,224,2389,1,0,0,0,226,2394,1,0,
	0,0,228,2396,1,0,0,0,230,2407,1,0,0,0,232,2409,1,0,0,0,234,2419,1,0,0,0,
	236,2435,1,0,0,0,238,2444,1,0,0,0,240,2452,1,0,0,0,242,2463,1,0,0,0,244,
	2480,1,0,0,0,246,2503,1,0,0,0,248,2506,1,0,0,0,250,2513,1,0,0,0,252,2559,
	1,0,0,0,254,2561,1,0,0,0,256,2569,1,0,0,0,258,2571,1,0,0,0,260,2651,1,0,
	0,0,262,2653,1,0,0,0,264,2657,1,0,0,0,266,2682,1,0,0,0,268,2684,1,0,0,0,
	270,2698,1,0,0,0,272,2702,1,0,0,0,274,2733,1,0,0,0,276,2929,1,0,0,0,278,
	3115,1,0,0,0,280,3125,1,0,0,0,282,3127,1,0,0,0,284,3147,1,0,0,0,286,3149,
	1,0,0,0,288,3151,1,0,0,0,290,3179,1,0,0,0,292,3181,1,0,0,0,294,3185,1,0,
	0,0,296,3208,1,0,0,0,298,3210,1,0,0,0,300,3246,1,0,0,0,302,3257,1,0,0,0,
	304,3277,1,0,0,0,306,3279,1,0,0,0,308,310,3,20,10,0,309,308,1,0,0,0,310,
	313,1,0,0,0,311,309,1,0,0,0,311,312,1,0,0,0,312,318,1,0,0,0,313,311,1,0,
	0,0,314,317,3,2,1,0,315,317,3,6,3,0,316,314,1,0,0,0,316,315,1,0,0,0,317,
	320,1,0,0,0,318,316,1,0,0,0,318,319,1,0,0,0,319,335,1,0,0,0,320,318,1,0,
	0,0,321,334,3,20,10,0,322,334,3,70,35,0,323,334,3,64,32,0,324,334,3,60,
	30,0,325,334,3,68,34,0,326,334,3,10,5,0,327,334,3,56,28,0,328,334,3,52,
	26,0,329,334,3,32,16,0,330,334,3,8,4,0,331,334,3,44,22,0,332,334,3,46,23,
	0,333,321,1,0,0,0,333,322,1,0,0,0,333,323,1,0,0,0,333,324,1,0,0,0,333,325,
	1,0,0,0,333,326,1,0,0,0,333,327,1,0,0,0,333,328,1,0,0,0,333,329,1,0,0,0,
	333,330,1,0,0,0,333,331,1,0,0,0,333,332,1,0,0,0,334,337,1,0,0,0,335,333,
	1,0,0,0,335,336,1,0,0,0,336,338,1,0,0,0,337,335,1,0,0,0,338,339,5,0,0,1,
	339,1,1,0,0,0,340,341,5,1,0,0,341,342,5,151,0,0,342,367,5,2,0,0,343,344,
	5,1,0,0,344,345,5,151,0,0,345,346,5,3,0,0,346,347,5,180,0,0,347,367,5,2,
	0,0,348,349,5,1,0,0,349,350,5,4,0,0,350,355,3,4,2,0,351,352,5,5,0,0,352,
	354,3,4,2,0,353,351,1,0,0,0,354,357,1,0,0,0,355,353,1,0,0,0,355,356,1,0,
	0,0,356,359,1,0,0,0,357,355,1,0,0,0,358,360,5,5,0,0,359,358,1,0,0,0,359,
	360,1,0,0,0,360,361,1,0,0,0,361,362,5,6,0,0,362,363,5,180,0,0,363,364,5,
	151,0,0,364,365,5,2,0,0,365,367,1,0,0,0,366,340,1,0,0,0,366,343,1,0,0,0,
	366,348,1,0,0,0,367,3,1,0,0,0,368,371,5,180,0,0,369,370,5,3,0,0,370,372,
	5,180,0,0,371,369,1,0,0,0,371,372,1,0,0,0,372,5,1,0,0,0,373,374,5,1,0,0,
	374,375,5,180,0,0,375,376,5,7,0,0,376,377,5,180,0,0,377,419,5,2,0,0,378,
	379,5,1,0,0,379,380,5,180,0,0,380,381,5,7,0,0,381,382,5,180,0,0,382,383,
	5,3,0,0,383,384,5,180,0,0,384,419,5,2,0,0,385,386,5,1,0,0,386,387,5,8,0,
	0,387,388,5,3,0,0,388,389,5,180,0,0,389,390,5,180,0,0,390,391,5,180,0,0,
	391,392,5,7,0,0,392,393,5,180,0,0,393,419,5,2,0,0,394,395,5,1,0,0,395,396,
	5,4,0,0,396,399,5,180,0,0,397,398,5,3,0,0,398,400,5,180,0,0,399,397,1,0,
	0,0,399,400,1,0,0,0,400,409,1,0,0,0,401,402,5,5,0,0,402,405,5,180,0,0,403,
	404,5,3,0,0,404,406,5,180,0,0,405,403,1,0,0,0,405,406,1,0,0,0,406,408,1,
	0,0,0,407,401,1,0,0,0,408,411,1,0,0,0,409,407,1,0,0,0,409,410,1,0,0,0,410,
	412,1,0,0,0,411,409,1,0,0,0,412,413,5,6,0,0,413,414,5,180,0,0,414,415,5,
	180,0,0,415,416,5,7,0,0,416,417,5,180,0,0,417,419,5,2,0,0,418,373,1,0,0,
	0,418,378,1,0,0,0,418,385,1,0,0,0,418,394,1,0,0,0,419,7,1,0,0,0,420,421,
	5,9,0,0,421,422,3,18,9,0,422,427,3,114,57,0,423,426,3,104,52,0,424,426,
	3,102,51,0,425,423,1,0,0,0,425,424,1,0,0,0,426,429,1,0,0,0,427,425,1,0,
	0,0,427,428,1,0,0,0,428,431,1,0,0,0,429,427,1,0,0,0,430,432,3,110,55,0,
	431,430,1,0,0,0,431,432,1,0,0,0,432,433,1,0,0,0,433,437,5,4,0,0,434,436,
	3,122,61,0,435,434,1,0,0,0,436,439,1,0,0,0,437,435,1,0,0,0,437,438,1,0,
	0,0,438,440,1,0,0,0,439,437,1,0,0,0,440,441,5,6,0,0,441,9,1,0,0,0,442,443,
	5,10,0,0,443,444,5,180,0,0,444,449,5,11,0,0,445,450,3,92,46,0,446,450,3,
	90,45,0,447,450,3,296,148,0,448,450,5,8,0,0,449,445,1,0,0,0,449,446,1,0,
	0,0,449,447,1,0,0,0,449,448,1,0,0,0,450,452,1,0,0,0,451,453,5,12,0,0,452,
	451,1,0,0,0,452,453,1,0,0,0,453,454,1,0,0,0,454,482,5,2,0,0,455,456,5,10,
	0,0,456,457,5,4,0,0,457,462,3,12,6,0,458,459,5,5,0,0,459,461,3,12,6,0,460,
	458,1,0,0,0,461,464,1,0,0,0,462,460,1,0,0,0,462,463,1,0,0,0,463,466,1,0,
	0,0,464,462,1,0,0,0,465,467,5,5,0,0,466,465,1,0,0,0,466,467,1,0,0,0,467,
	468,1,0,0,0,468,469,5,6,0,0,469,474,5,11,0,0,470,475,3,92,46,0,471,475,
	3,90,45,0,472,475,3,296,148,0,473,475,5,8,0,0,474,470,1,0,0,0,474,471,1,
	0,0,0,474,472,1,0,0,0,474,473,1,0,0,0,475,477,1,0,0,0,476,478,5,12,0,0,
	477,476,1,0,0,0,477,478,1,0,0,0,478,479,1,0,0,0,479,480,5,2,0,0,480,482,
	1,0,0,0,481,442,1,0,0,0,481,455,1,0,0,0,482,11,1,0,0,0,483,486,5,180,0,
	0,484,485,5,7,0,0,485,487,5,180,0,0,486,484,1,0,0,0,486,487,1,0,0,0,487,
	490,1,0,0,0,488,489,5,3,0,0,489,491,3,14,7,0,490,488,1,0,0,0,490,491,1,
	0,0,0,491,13,1,0,0,0,492,493,7,0,0,0,493,15,1,0,0,0,494,515,5,180,0,0,495,
	515,5,28,0,0,496,515,5,29,0,0,497,515,5,30,0,0,498,515,5,31,0,0,499,515,
	5,32,0,0,500,515,5,33,0,0,501,515,5,34,0,0,502,515,5,12,0,0,503,515,5,35,
	0,0,504,515,5,36,0,0,505,515,5,37,0,0,506,515,5,38,0,0,507,515,5,39,0,0,
	508,515,5,40,0,0,509,515,5,41,0,0,510,515,5,147,0,0,511,515,5,143,0,0,512,
	513,4,8,0,0,513,515,7,1,0,0,514,494,1,0,0,0,514,495,1,0,0,0,514,496,1,0,
	0,0,514,497,1,0,0,0,514,498,1,0,0,0,514,499,1,0,0,0,514,500,1,0,0,0,514,
	501,1,0,0,0,514,502,1,0,0,0,514,503,1,0,0,0,514,504,1,0,0,0,514,505,1,0,
	0,0,514,506,1,0,0,0,514,507,1,0,0,0,514,508,1,0,0,0,514,509,1,0,0,0,514,
	510,1,0,0,0,514,511,1,0,0,0,514,512,1,0,0,0,515,17,1,0,0,0,516,520,3,16,
	8,0,517,520,5,42,0,0,518,520,5,43,0,0,519,516,1,0,0,0,519,517,1,0,0,0,519,
	518,1,0,0,0,520,19,1,0,0,0,521,522,5,44,0,0,522,523,3,22,11,0,523,524,3,
	24,12,0,524,525,5,2,0,0,525,536,1,0,0,0,526,527,5,44,0,0,527,531,5,180,
	0,0,528,530,7,2,0,0,529,528,1,0,0,0,530,533,1,0,0,0,531,529,1,0,0,0,531,
	532,1,0,0,0,532,534,1,0,0,0,533,531,1,0,0,0,534,536,5,2,0,0,535,521,1,0,
	0,0,535,526,1,0,0,0,536,21,1,0,0,0,537,538,7,3,0,0,538,23,1,0,0,0,539,544,
	3,26,13,0,540,541,5,47,0,0,541,543,3,26,13,0,542,540,1,0,0,0,543,546,1,
	0,0,0,544,542,1,0,0,0,544,545,1,0,0,0,545,549,1,0,0,0,546,544,1,0,0,0,547,
	549,5,8,0,0,548,539,1,0,0,0,548,547,1,0,0,0,549,25,1,0,0,0,550,551,3,28,
	14,0,551,552,5,14,0,0,552,553,3,28,14,0,553,560,1,0,0,0,554,556,3,28,14,
	0,555,554,1,0,0,0,556,557,1,0,0,0,557,555,1,0,0,0,557,558,1,0,0,0,558,560,
	1,0,0,0,559,550,1,0,0,0,559,555,1,0,0,0,560,27,1,0,0,0,561,563,3,30,15,
	0,562,561,1,0,0,0,562,563,1,0,0,0,563,564,1,0,0,0,564,565,7,4,0,0,565,29,
	1,0,0,0,566,567,7,5,0,0,567,31,1,0,0,0,568,569,5,49,0,0,569,579,5,180,0,
	0,570,571,5,50,0,0,571,576,5,180,0,0,572,573,5,5,0,0,573,575,5,180,0,0,
	574,572,1,0,0,0,575,578,1,0,0,0,576,574,1,0,0,0,576,577,1,0,0,0,577,580,
	1,0,0,0,578,576,1,0,0,0,579,570,1,0,0,0,579,580,1,0,0,0,580,581,1,0,0,0,
	581,594,5,4,0,0,582,593,3,64,32,0,583,593,3,60,30,0,584,593,3,68,34,0,585,
	593,3,52,26,0,586,593,3,56,28,0,587,593,3,10,5,0,588,593,3,36,18,0,589,
	593,3,34,17,0,590,593,3,40,20,0,591,593,3,42,21,0,592,582,1,0,0,0,592,583,
	1,0,0,0,592,584,1,0,0,0,592,585,1,0,0,0,592,586,1,0,0,0,592,587,1,0,0,0,
	592,588,1,0,0,0,592,589,1,0,0,0,592,590,1,0,0,0,592,591,1,0,0,0,593,596,
	1,0,0,0,594,592,1,0,0,0,594,595,1,0,0,0,595,597,1,0,0,0,596,594,1,0,0,0,
	597,598,5,6,0,0,598,33,1,0,0,0,599,600,3,38,19,0,600,601,3,90,45,0,601,
	602,5,180,0,0,602,603,5,2,0,0,603,610,1,0,0,0,604,605,3,38,19,0,605,606,
	3,92,46,0,606,607,5,180,0,0,607,608,5,2,0,0,608,610,1,0,0,0,609,599,1,0,
	0,0,609,604,1,0,0,0,610,35,1,0,0,0,611,612,3,38,19,0,612,613,3,296,148,
	0,613,614,5,180,0,0,614,615,5,2,0,0,615,37,1,0,0,0,616,617,7,6,0,0,617,
	39,1,0,0,0,618,619,5,9,0,0,619,620,3,18,9,0,620,624,3,114,57,0,621,623,
	3,104,52,0,622,621,1,0,0,0,623,626,1,0,0,0,624,622,1,0,0,0,624,625,1,0,
	0,0,625,628,1,0,0,0,626,624,1,0,0,0,627,629,3,110,55,0,628,627,1,0,0,0,
	628,629,1,0,0,0,629,630,1,0,0,0,630,631,5,2,0,0,631,41,1,0,0,0,632,633,
	5,38,0,0,633,637,3,114,57,0,634,636,3,76,38,0,635,634,1,0,0,0,636,639,1,
	0,0,0,637,635,1,0,0,0,637,638,1,0,0,0,638,640,1,0,0,0,639,637,1,0,0,0,640,
	644,5,52,0,0,641,643,3,76,38,0,642,641,1,0,0,0,643,646,1,0,0,0,644,642,
	1,0,0,0,644,645,1,0,0,0,645,648,1,0,0,0,646,644,1,0,0,0,647,649,3,110,55,
	0,648,647,1,0,0,0,648,649,1,0,0,0,649,650,1,0,0,0,650,651,5,2,0,0,651,43,
	1,0,0,0,652,653,5,53,0,0,653,654,5,180,0,0,654,667,5,4,0,0,655,666,3,64,
	32,0,656,666,3,60,30,0,657,666,3,68,34,0,658,666,3,52,26,0,659,666,3,56,
	28,0,660,666,3,70,35,0,661,666,3,84,42,0,662,666,3,10,5,0,663,666,3,94,
	47,0,664,666,3,8,4,0,665,655,1,0,0,0,665,656,1,0,0,0,665,657,1,0,0,0,665,
	658,1,0,0,0,665,659,1,0,0,0,665,660,1,0,0,0,665,661,1,0,0,0,665,662,1,0,
	0,0,665,663,1,0,0,0,665,664,1,0,0,0,666,669,1,0,0,0,667,665,1,0,0,0,667,
	668,1,0,0,0,668,670,1,0,0,0,669,667,1,0,0,0,670,671,5,6,0,0,671,45,1,0,
	0,0,672,674,5,54,0,0,673,672,1,0,0,0,673,674,1,0,0,0,674,675,1,0,0,0,675,
	676,5,55,0,0,676,678,3,16,8,0,677,679,3,114,57,0,678,677,1,0,0,0,678,679,
	1,0,0,0,679,689,1,0,0,0,680,681,5,50,0,0,681,686,3,48,24,0,682,683,5,5,
	0,0,683,685,3,48,24,0,684,682,1,0,0,0,685,688,1,0,0,0,686,684,1,0,0,0,686,
	687,1,0,0,0,687,690,1,0,0,0,688,686,1,0,0,0,689,680,1,0,0,0,689,690,1,0,
	0,0,690,691,1,0,0,0,691,708,5,4,0,0,692,707,3,64,32,0,693,707,3,60,30,0,
	694,707,3,68,34,0,695,707,3,52,26,0,696,707,3,56,28,0,697,707,3,70,35,0,
	698,707,3,10,5,0,699,707,3,84,42,0,700,707,3,94,47,0,701,707,3,72,36,0,
	702,707,3,100,50,0,703,707,3,50,25,0,704,707,3,74,37,0,705,707,3,78,39,
	0,706,692,1,0,0,0,706,693,1,0,0,0,706,694,1,0,0,0,706,695,1,0,0,0,706,696,
	1,0,0,0,706,697,1,0,0,0,706,698,1,0,0,0,706,699,1,0,0,0,706,700,1,0,0,0,
	706,701,1,0,0,0,706,702,1,0,0,0,706,703,1,0,0,0,706,704,1,0,0,0,706,705,
	1,0,0,0,707,710,1,0,0,0,708,706,1,0,0,0,708,709,1,0,0,0,709,711,1,0,0,0,
	710,708,1,0,0,0,711,712,5,6,0,0,712,47,1,0,0,0,713,715,5,180,0,0,714,716,
	3,264,132,0,715,714,1,0,0,0,715,716,1,0,0,0,716,49,1,0,0,0,717,718,5,9,
	0,0,718,719,3,18,9,0,719,724,3,114,57,0,720,723,3,104,52,0,721,723,3,102,
	51,0,722,720,1,0,0,0,722,721,1,0,0,0,723,726,1,0,0,0,724,722,1,0,0,0,724,
	725,1,0,0,0,725,728,1,0,0,0,726,724,1,0,0,0,727,729,3,110,55,0,728,727,
	1,0,0,0,728,729,1,0,0,0,729,730,1,0,0,0,730,731,5,2,0,0,731,51,1,0,0,0,
	732,735,5,56,0,0,733,736,3,16,8,0,734,736,7,7,0,0,735,733,1,0,0,0,735,734,
	1,0,0,0,736,737,1,0,0,0,737,749,5,57,0,0,738,743,3,54,27,0,739,740,5,5,
	0,0,740,742,3,54,27,0,741,739,1,0,0,0,742,745,1,0,0,0,743,741,1,0,0,0,743,
	744,1,0,0,0,744,747,1,0,0,0,745,743,1,0,0,0,746,748,5,5,0,0,747,746,1,0,
	0,0,747,748,1,0,0,0,748,750,1,0,0,0,749,738,1,0,0,0,749,750,1,0,0,0,750,
	751,1,0,0,0,751,753,5,58,0,0,752,754,5,59,0,0,753,752,1,0,0,0,753,754,1,
	0,0,0,754,755,1,0,0,0,755,756,5,2,0,0,756,53,1,0,0,0,757,760,3,296,148,
	0,758,760,3,92,46,0,759,757,1,0,0,0,759,758,1,0,0,0,760,762,1,0,0,0,761,
	763,5,60,0,0,762,761,1,0,0,0,762,763,1,0,0,0,763,765,1,0,0,0,764,766,3,
	16,8,0,765,764,1,0,0,0,765,766,1,0,0,0,766,55,1,0,0,0,767,768,5,34,0,0,
	768,769,3,16,8,0,769,781,5,57,0,0,770,775,3,58,29,0,771,772,5,5,0,0,772,
	774,3,58,29,0,773,771,1,0,0,0,774,777,1,0,0,0,775,773,1,0,0,0,775,776,1,
	0,0,0,776,779,1,0,0,0,777,775,1,0,0,0,778,780,5,5,0,0,779,778,1,0,0,0,779,
	780,1,0,0,0,780,782,1,0,0,0,781,770,1,0,0,0,781,782,1,0,0,0,782,783,1,0,
	0,0,783,784,5,58,0,0,784,785,5,2,0,0,785,57,1,0,0,0,786,788,3,296,148,0,
	787,789,3,16,8,0,788,787,1,0,0,0,788,789,1,0,0,0,789,795,1,0,0,0,790,792,
	3,92,46,0,791,793,3,16,8,0,792,791,1,0,0,0,792,793,1,0,0,0,793,795,1,0,
	0,0,794,786,1,0,0,0,794,790,1,0,0,0,795,59,1,0,0,0,796,797,5,61,0,0,797,
	798,3,16,8,0,798,800,5,4,0,0,799,801,3,62,31,0,800,799,1,0,0,0,801,802,
	1,0,0,0,802,800,1,0,0,0,802,803,1,0,0,0,803,804,1,0,0,0,804,805,5,6,0,0,
	805,61,1,0,0,0,806,810,3,296,148,0,807,810,3,92,46,0,808,810,3,90,45,0,
	809,806,1,0,0,0,809,807,1,0,0,0,809,808,1,0,0,0,810,811,1,0,0,0,811,812,
	3,16,8,0,812,813,5,2,0,0,813,63,1,0,0,0,814,815,5,62,0,0,815,816,3,16,8,
	0,816,817,5,4,0,0,817,822,3,66,33,0,818,819,5,5,0,0,819,821,3,66,33,0,820,
	818,1,0,0,0,821,824,1,0,0,0,822,820,1,0,0,0,822,823,1,0,0,0,823,826,1,0,
	0,0,824,822,1,0,0,0,825,827,5,5,0,0,826,825,1,0,0,0,826,827,1,0,0,0,827,
	828,1,0,0,0,828,829,5,6,0,0,829,65,1,0,0,0,830,833,3,16,8,0,831,832,5,48,
	0,0,832,834,5,145,0,0,833,831,1,0,0,0,833,834,1,0,0,0,834,67,1,0,0,0,835,
	836,5,63,0,0,836,837,3,16,8,0,837,838,5,50,0,0,838,839,3,296,148,0,839,
	840,5,2,0,0,840,69,1,0,0,0,841,842,3,296,148,0,842,843,5,64,0,0,843,844,
	3,16,8,0,844,845,5,48,0,0,845,846,3,276,138,0,846,847,5,2,0,0,847,71,1,
	0,0,0,848,849,5,65,0,0,849,853,3,114,57,0,850,852,7,8,0,0,851,850,1,0,0,
	0,852,855,1,0,0,0,853,851,1,0,0,0,853,854,1,0,0,0,854,859,1,0,0,0,855,853,
	1,0,0,0,856,858,3,82,41,0,857,856,1,0,0,0,858,861,1,0,0,0,859,857,1,0,0,
	0,859,860,1,0,0,0,860,865,1,0,0,0,861,859,1,0,0,0,862,864,7,8,0,0,863,862,
	1,0,0,0,864,867,1,0,0,0,865,863,1,0,0,0,865,866,1,0,0,0,866,871,1,0,0,0,
	867,865,1,0,0,0,868,870,3,102,51,0,869,868,1,0,0,0,870,873,1,0,0,0,871,
	869,1,0,0,0,871,872,1,0,0,0,872,874,1,0,0,0,873,871,1,0,0,0,874,878,5,4,
	0,0,875,877,3,122,61,0,876,875,1,0,0,0,877,880,1,0,0,0,878,876,1,0,0,0,
	878,879,1,0,0,0,879,881,1,0,0,0,880,878,1,0,0,0,881,882,5,6,0,0,882,73,
	1,0,0,0,883,884,5,38,0,0,884,888,3,114,57,0,885,887,3,76,38,0,886,885,1,
	0,0,0,887,890,1,0,0,0,888,886,1,0,0,0,888,889,1,0,0,0,889,891,1,0,0,0,890,
	888,1,0,0,0,891,895,5,52,0,0,892,894,3,76,38,0,893,892,1,0,0,0,894,897,
	1,0,0,0,895,893,1,0,0,0,895,896,1,0,0,0,896,901,1,0,0,0,897,895,1,0,0,0,
	898,900,3,102,51,0,899,898,1,0,0,0,900,903,1,0,0,0,901,899,1,0,0,0,901,
	902,1,0,0,0,902,905,1,0,0,0,903,901,1,0,0,0,904,906,3,110,55,0,905,904,
	1,0,0,0,905,906,1,0,0,0,906,907,1,0,0,0,907,911,5,4,0,0,908,910,3,122,61,
	0,909,908,1,0,0,0,910,913,1,0,0,0,911,909,1,0,0,0,911,912,1,0,0,0,912,914,
	1,0,0,0,913,911,1,0,0,0,914,915,5,6,0,0,915,75,1,0,0,0,916,920,5,67,0,0,
	917,920,5,68,0,0,918,920,3,106,53,0,919,916,1,0,0,0,919,917,1,0,0,0,919,
	918,1,0,0,0,920,77,1,0,0,0,921,922,5,39,0,0,922,923,5,57,0,0,923,927,5,
	58,0,0,924,926,3,80,40,0,925,924,1,0,0,0,926,929,1,0,0,0,927,925,1,0,0,
	0,927,928,1,0,0,0,928,930,1,0,0,0,929,927,1,0,0,0,930,934,5,52,0,0,931,
	933,3,80,40,0,932,931,1,0,0,0,933,936,1,0,0,0,934,932,1,0,0,0,934,935,1,
	0,0,0,935,937,1,0,0,0,936,934,1,0,0,0,937,941,5,67,0,0,938,940,3,80,40,
	0,939,938,1,0,0,0,940,943,1,0,0,0,941,939,1,0,0,0,941,942,1,0,0,0,942,953,
	1,0,0,0,943,941,1,0,0,0,944,948,5,4,0,0,945,947,3,122,61,0,946,945,1,0,
	0,0,947,950,1,0,0,0,948,946,1,0,0,0,948,949,1,0,0,0,949,951,1,0,0,0,950,
	948,1,0,0,0,951,954,5,6,0,0,952,954,5,2,0,0,953,944,1,0,0,0,953,952,1,0,
	0,0,954,990,1,0,0,0,955,956,5,39,0,0,956,957,5,57,0,0,957,961,5,58,0,0,
	958,960,3,80,40,0,959,958,1,0,0,0,960,963,1,0,0,0,961,959,1,0,0,0,961,962,
	1,0,0,0,962,964,1,0,0,0,963,961,1,0,0,0,964,968,5,67,0,0,965,967,3,80,40,
	0,966,965,1,0,0,0,967,970,1,0,0,0,968,966,1,0,0,0,968,969,1,0,0,0,969,971,
	1,0,0,0,970,968,1,0,0,0,971,975,5,52,0,0,972,974,3,80,40,0,973,972,1,0,
	0,0,974,977,1,0,0,0,975,973,1,0,0,0,975,976,1,0,0,0,976,987,1,0,0,0,977,
	975,1,0,0,0,978,982,5,4,0,0,979,981,3,122,61,0,980,979,1,0,0,0,981,984,
	1,0,0,0,982,980,1,0,0,0,982,983,1,0,0,0,983,985,1,0,0,0,984,982,1,0,0,0,
	985,988,5,6,0,0,986,988,5,2,0,0,987,978,1,0,0,0,987,986,1,0,0,0,988,990,
	1,0,0,0,989,921,1,0,0,0,989,955,1,0,0,0,990,79,1,0,0,0,991,994,5,68,0,0,
	992,994,3,106,53,0,993,991,1,0,0,0,993,992,1,0,0,0,994,81,1,0,0,0,995,996,
	5,180,0,0,996,997,3,264,132,0,997,83,1,0,0,0,998,1000,3,88,44,0,999,998,
	1,0,0,0,999,1000,1,0,0,0,1000,1001,1,0,0,0,1001,1006,3,296,148,0,1002,1005,
	3,286,143,0,1003,1005,3,106,53,0,1004,1002,1,0,0,0,1004,1003,1,0,0,0,1005,
	1008,1,0,0,0,1006,1004,1,0,0,0,1006,1007,1,0,0,0,1007,1009,1,0,0,0,1008,
	1006,1,0,0,0,1009,1016,3,16,8,0,1010,1011,5,48,0,0,1011,1014,3,276,138,
	0,1012,1013,7,9,0,0,1013,1015,3,142,71,0,1014,1012,1,0,0,0,1014,1015,1,
	0,0,0,1015,1017,1,0,0,0,1016,1010,1,0,0,0,1016,1017,1,0,0,0,1017,1018,1,
	0,0,0,1018,1019,5,2,0,0,1019,1081,1,0,0,0,1020,1025,3,296,148,0,1021,1024,
	3,286,143,0,1022,1024,3,106,53,0,1023,1021,1,0,0,0,1023,1022,1,0,0,0,1024,
	1027,1,0,0,0,1025,1023,1,0,0,0,1025,1026,1,0,0,0,1026,1028,1,0,0,0,1027,
	1025,1,0,0,0,1028,1033,3,88,44,0,1029,1032,3,286,143,0,1030,1032,3,106,
	53,0,1031,1029,1,0,0,0,1031,1030,1,0,0,0,1032,1035,1,0,0,0,1033,1031,1,
	0,0,0,1033,1034,1,0,0,0,1034,1036,1,0,0,0,1035,1033,1,0,0,0,1036,1043,3,
	16,8,0,1037,1038,5,48,0,0,1038,1041,3,276,138,0,1039,1040,7,9,0,0,1040,
	1042,3,142,71,0,1041,1039,1,0,0,0,1041,1042,1,0,0,0,1042,1044,1,0,0,0,1043,
	1037,1,0,0,0,1043,1044,1,0,0,0,1044,1045,1,0,0,0,1045,1046,5,2,0,0,1046,
	1081,1,0,0,0,1047,1049,3,88,44,0,1048,1047,1,0,0,0,1048,1049,1,0,0,0,1049,
	1051,1,0,0,0,1050,1052,5,40,0,0,1051,1050,1,0,0,0,1051,1052,1,0,0,0,1052,
	1053,1,0,0,0,1053,1057,3,90,45,0,1054,1056,3,86,43,0,1055,1054,1,0,0,0,
	1056,1059,1,0,0,0,1057,1055,1,0,0,0,1057,1058,1,0,0,0,1058,1060,1,0,0,0,
	1059,1057,1,0,0,0,1060,1061,3,16,8,0,1061,1062,5,2,0,0,1062,1081,1,0,0,
	0,1063,1065,3,88,44,0,1064,1063,1,0,0,0,1064,1065,1,0,0,0,1065,1066,1,0,
	0,0,1066,1070,3,92,46,0,1067,1069,3,86,43,0,1068,1067,1,0,0,0,1069,1072,
	1,0,0,0,1070,1068,1,0,0,0,1070,1071,1,0,0,0,1071,1073,1,0,0,0,1072,1070,
	1,0,0,0,1073,1076,3,16,8,0,1074,1075,5,48,0,0,1075,1077,3,276,138,0,1076,
	1074,1,0,0,0,1076,1077,1,0,0,0,1077,1078,1,0,0,0,1078,1079,5,2,0,0,1079,
	1081,1,0,0,0,1080,999,1,0,0,0,1080,1020,1,0,0,0,1080,1048,1,0,0,0,1080,
	1064,1,0,0,0,1081,85,1,0,0,0,1082,1086,3,286,143,0,1083,1086,3,88,44,0,
	1084,1086,3,106,53,0,1085,1082,1,0,0,0,1085,1083,1,0,0,0,1085,1084,1,0,
	0,0,1086,87,1,0,0,0,1087,1088,7,10,0,0,1088,89,1,0,0,0,1089,1090,5,80,0,
	0,1090,1091,5,57,0,0,1091,1093,3,296,148,0,1092,1094,3,16,8,0,1093,1092,
	1,0,0,0,1093,1094,1,0,0,0,1094,1095,1,0,0,0,1095,1096,5,81,0,0,1096,1098,
	3,296,148,0,1097,1099,3,16,8,0,1098,1097,1,0,0,0,1098,1099,1,0,0,0,1099,
	1100,1,0,0,0,1100,1101,5,58,0,0,1101,1129,1,0,0,0,1102,1103,5,80,0,0,1103,
	1104,5,57,0,0,1104,1106,3,296,148,0,1105,1107,3,16,8,0,1106,1105,1,0,0,
	0,1106,1107,1,0,0,0,1107,1108,1,0,0,0,1108,1109,5,81,0,0,1109,1111,3,90,
	45,0,1110,1112,3,16,8,0,1111,1110,1,0,0,0,1111,1112,1,0,0,0,1112,1113,1,
	0,0,0,1113,1114,5,58,0,0,1114,1129,1,0,0,0,1115,1116,5,80,0,0,1116,1117,
	5,57,0,0,1117,1119,3,296,148,0,1118,1120,3,16,8,0,1119,1118,1,0,0,0,1119,
	1120,1,0,0,0,1120,1121,1,0,0,0,1121,1122,5,81,0,0,1122,1124,3,92,46,0,1123,
	1125,3,16,8,0,1124,1123,1,0,0,0,1124,1125,1,0,0,0,1125,1126,1,0,0,0,1126,
	1127,5,58,0,0,1127,1129,1,0,0,0,1128,1089,1,0,0,0,1128,1102,1,0,0,0,1128,
	1115,1,0,0,0,1129,91,1,0,0,0,1130,1131,6,46,-1,0,1131,1132,3,298,149,0,
	1132,1134,5,82,0,0,1133,1135,3,276,138,0,1134,1133,1,0,0,0,1134,1135,1,
	0,0,0,1135,1136,1,0,0,0,1136,1137,5,83,0,0,1137,1153,1,0,0,0,1138,1139,
	3,296,148,0,1139,1141,5,82,0,0,1140,1142,3,276,138,0,1141,1140,1,0,0,0,
	1141,1142,1,0,0,0,1142,1143,1,0,0,0,1143,1144,5,83,0,0,1144,1153,1,0,0,
	0,1145,1146,3,90,45,0,1146,1148,5,82,0,0,1147,1149,3,276,138,0,1148,1147,
	1,0,0,0,1148,1149,1,0,0,0,1149,1150,1,0,0,0,1150,1151,5,83,0,0,1151,1153,
	1,0,0,0,1152,1130,1,0,0,0,1152,1138,1,0,0,0,1152,1145,1,0,0,0,1153,1162,
	1,0,0,0,1154,1155,10,1,0,0,1155,1157,5,82,0,0,1156,1158,3,276,138,0,1157,
	1156,1,0,0,0,1157,1158,1,0,0,0,1158,1159,1,0,0,0,1159,1161,5,83,0,0,1160,
	1154,1,0,0,0,1161,1164,1,0,0,0,1162,1160,1,0,0,0,1162,1163,1,0,0,0,1163,
	93,1,0,0,0,1164,1162,1,0,0,0,1165,1166,5,84,0,0,1166,1168,5,180,0,0,1167,
	1169,3,114,57,0,1168,1167,1,0,0,0,1168,1169,1,0,0,0,1169,1174,1,0,0,0,1170,
	1173,5,68,0,0,1171,1173,3,106,53,0,1172,1170,1,0,0,0,1172,1171,1,0,0,0,
	1173,1176,1,0,0,0,1174,1172,1,0,0,0,1174,1175,1,0,0,0,1175,1186,1,0,0,0,
	1176,1174,1,0,0,0,1177,1181,5,4,0,0,1178,1180,3,96,48,0,1179,1178,1,0,0,
	0,1180,1183,1,0,0,0,1181,1179,1,0,0,0,1181,1182,1,0,0,0,1182,1184,1,0,0,
	0,1183,1181,1,0,0,0,1184,1187,5,6,0,0,1185,1187,5,2,0,0,1186,1177,1,0,0,
	0,1186,1185,1,0,0,0,1187,95,1,0,0,0,1188,1191,3,98,49,0,1189,1191,3,122,
	61,0,1190,1188,1,0,0,0,1190,1189,1,0,0,0,1191,97,1,0,0,0,1192,1193,5,43,
	0,0,1193,1194,5,2,0,0,1194,99,1,0,0,0,1195,1196,5,9,0,0,1196,1197,3,18,
	9,0,1197,1202,3,114,57,0,1198,1201,3,104,52,0,1199,1201,3,102,51,0,1200,
	1198,1,0,0,0,1200,1199,1,0,0,0,1201,1204,1,0,0,0,1202,1200,1,0,0,0,1202,
	1203,1,0,0,0,1203,1206,1,0,0,0,1204,1202,1,0,0,0,1205,1207,3,110,55,0,1206,
	1205,1,0,0,0,1206,1207,1,0,0,0,1207,1208,1,0,0,0,1208,1212,5,4,0,0,1209,
	1211,3,122,61,0,1210,1209,1,0,0,0,1211,1214,1,0,0,0,1212,1210,1,0,0,0,1212,
	1213,1,0,0,0,1213,1215,1,0,0,0,1214,1212,1,0,0,0,1215,1216,5,6,0,0,1216,
	101,1,0,0,0,1217,1218,5,180,0,0,1218,1220,5,7,0,0,1219,1217,1,0,0,0,1219,
	1220,1,0,0,0,1220,1221,1,0,0,0,1221,1223,5,180,0,0,1222,1224,3,264,132,
	0,1223,1222,1,0,0,0,1223,1224,1,0,0,0,1224,103,1,0,0,0,1225,1238,5,85,0,
	0,1226,1238,5,86,0,0,1227,1238,5,66,0,0,1228,1238,5,52,0,0,1229,1238,5,
	51,0,0,1230,1238,5,79,0,0,1231,1238,5,67,0,0,1232,1238,3,106,53,0,1233,
	1238,5,68,0,0,1234,1238,3,108,54,0,1235,1238,5,29,0,0,1236,1238,5,30,0,
	0,1237,1225,1,0,0,0,1237,1226,1,0,0,0,1237,1227,1,0,0,0,1237,1228,1,0,0,
	0,1237,1229,1,0,0,0,1237,1230,1,0,0,0,1237,1231,1,0,0,0,1237,1232,1,0,0,
	0,1237,1233,1,0,0,0,1237,1234,1,0,0,0,1237,1235,1,0,0,0,1237,1236,1,0,0,
	0,1238,105,1,0,0,0,1239,1250,5,87,0,0,1240,1241,5,57,0,0,1241,1246,5,180,
	0,0,1242,1243,5,5,0,0,1243,1245,5,180,0,0,1244,1242,1,0,0,0,1245,1248,1,
	0,0,0,1246,1244,1,0,0,0,1246,1247,1,0,0,0,1247,1249,1,0,0,0,1248,1246,1,
	0,0,0,1249,1251,5,58,0,0,1250,1240,1,0,0,0,1250,1251,1,0,0,0,1251,107,1,
	0,0,0,1252,1256,5,31,0,0,1253,1254,5,57,0,0,1254,1255,5,145,0,0,1255,1257,
	5,58,0,0,1256,1253,1,0,0,0,1256,1257,1,0,0,0,1257,109,1,0,0,0,1258,1259,
	5,88,0,0,1259,1260,5,57,0,0,1260,1265,3,112,56,0,1261,1262,5,5,0,0,1262,
	1264,3,112,56,0,1263,1261,1,0,0,0,1264,1267,1,0,0,0,1265,1263,1,0,0,0,1265,
	1266,1,0,0,0,1266,1269,1,0,0,0,1267,1265,1,0,0,0,1268,1270,5,5,0,0,1269,
	1268,1,0,0,0,1269,1270,1,0,0,0,1270,1271,1,0,0,0,1271,1272,5,58,0,0,1272,
	111,1,0,0,0,1273,1277,3,296,148,0,1274,1276,3,286,143,0,1275,1274,1,0,0,
	0,1276,1279,1,0,0,0,1277,1275,1,0,0,0,1277,1278,1,0,0,0,1278,1281,1,0,0,
	0,1279,1277,1,0,0,0,1280,1282,3,16,8,0,1281,1280,1,0,0,0,1281,1282,1,0,
	0,0,1282,1304,1,0,0,0,1283,1287,3,92,46,0,1284,1286,3,286,143,0,1285,1284,
	1,0,0,0,1286,1289,1,0,0,0,1287,1285,1,0,0,0,1287,1288,1,0,0,0,1288,1291,
	1,0,0,0,1289,1287,1,0,0,0,1290,1292,3,16,8,0,1291,1290,1,0,0,0,1291,1292,
	1,0,0,0,1292,1304,1,0,0,0,1293,1297,3,90,45,0,1294,1296,3,286,143,0,1295,
	1294,1,0,0,0,1296,1299,1,0,0,0,1297,1295,1,0,0,0,1297,1298,1,0,0,0,1298,
	1301,1,0,0,0,1299,1297,1,0,0,0,1300,1302,3,16,8,0,1301,1300,1,0,0,0,1301,
	1302,1,0,0,0,1302,1304,1,0,0,0,1303,1273,1,0,0,0,1303,1283,1,0,0,0,1303,
	1293,1,0,0,0,1304,113,1,0,0,0,1305,1317,5,57,0,0,1306,1311,3,116,58,0,1307,
	1308,5,5,0,0,1308,1310,3,116,58,0,1309,1307,1,0,0,0,1310,1313,1,0,0,0,1311,
	1309,1,0,0,0,1311,1312,1,0,0,0,1312,1315,1,0,0,0,1313,1311,1,0,0,0,1314,
	1316,5,5,0,0,1315,1314,1,0,0,0,1315,1316,1,0,0,0,1316,1318,1,0,0,0,1317,
	1306,1,0,0,0,1317,1318,1,0,0,0,1318,1319,1,0,0,0,1319,1320,5,58,0,0,1320,
	115,1,0,0,0,1321,1325,3,296,148,0,1322,1324,3,286,143,0,1323,1322,1,0,0,
	0,1324,1327,1,0,0,0,1325,1323,1,0,0,0,1325,1326,1,0,0,0,1326,1329,1,0,0,
	0,1327,1325,1,0,0,0,1328,1330,3,16,8,0,1329,1328,1,0,0,0,1329,1330,1,0,
	0,0,1330,1352,1,0,0,0,1331,1335,3,92,46,0,1332,1334,3,286,143,0,1333,1332,
	1,0,0,0,1334,1337,1,0,0,0,1335,1333,1,0,0,0,1335,1336,1,0,0,0,1336,1339,
	1,0,0,0,1337,1335,1,0,0,0,1338,1340,3,16,8,0,1339,1338,1,0,0,0,1339,1340,
	1,0,0,0,1340,1352,1,0,0,0,1341,1345,3,90,45,0,1342,1344,3,286,143,0,1343,
	1342,1,0,0,0,1344,1347,1,0,0,0,1345,1343,1,0,0,0,1345,1346,1,0,0,0,1346,
	1349,1,0,0,0,1347,1345,1,0,0,0,1348,1350,3,16,8,0,1349,1348,1,0,0,0,1349,
	1350,1,0,0,0,1350,1352,1,0,0,0,1351,1321,1,0,0,0,1351,1331,1,0,0,0,1351,
	1341,1,0,0,0,1352,117,1,0,0,0,1353,1357,5,4,0,0,1354,1356,3,122,61,0,1355,
	1354,1,0,0,0,1356,1359,1,0,0,0,1357,1355,1,0,0,0,1357,1358,1,0,0,0,1358,
	1360,1,0,0,0,1359,1357,1,0,0,0,1360,1363,5,6,0,0,1361,1363,3,122,61,0,1362,
	1353,1,0,0,0,1362,1361,1,0,0,0,1363,119,1,0,0,0,1364,1368,5,4,0,0,1365,
	1367,3,122,61,0,1366,1365,1,0,0,0,1367,1370,1,0,0,0,1368,1366,1,0,0,0,1368,
	1369,1,0,0,0,1369,1371,1,0,0,0,1370,1368,1,0,0,0,1371,1372,5,6,0,0,1372,
	121,1,0,0,0,1373,1405,3,98,49,0,1374,1405,3,120,60,0,1375,1405,3,130,65,
	0,1376,1405,3,124,62,0,1377,1405,3,126,63,0,1378,1405,3,152,76,0,1379,1405,
	3,158,79,0,1380,1405,3,156,78,0,1381,1405,3,144,72,0,1382,1405,3,170,85,
	0,1383,1405,3,172,86,0,1384,1405,3,174,87,0,1385,1405,3,176,88,0,1386,1405,
	3,196,98,0,1387,1405,3,150,75,0,1388,1405,3,146,73,0,1389,1405,3,148,74,
	0,1390,1405,3,198,99,0,1391,1405,3,240,120,0,1392,1405,3,252,126,0,1393,
	1405,3,254,127,0,1394,1405,3,168,84,0,1395,1405,3,232,116,0,1396,1405,3,
	234,117,0,1397,1405,3,246,123,0,1398,1405,3,248,124,0,1399,1405,3,282,141,
	0,1400,1405,3,132,66,0,1401,1405,3,136,68,0,1402,1405,3,138,69,0,1403,1405,
	3,140,70,0,1404,1373,1,0,0,0,1404,1374,1,0,0,0,1404,1375,1,0,0,0,1404,1376,
	1,0,0,0,1404,1377,1,0,0,0,1404,1378,1,0,0,0,1404,1379,1,0,0,0,1404,1380,
	1,0,0,0,1404,1381,1,0,0,0,1404,1382,1,0,0,0,1404,1383,1,0,0,0,1404,1384,
	1,0,0,0,1404,1385,1,0,0,0,1404,1386,1,0,0,0,1404,1387,1,0,0,0,1404,1388,
	1,0,0,0,1404,1389,1,0,0,0,1404,1390,1,0,0,0,1404,1391,1,0,0,0,1404,1392,
	1,0,0,0,1404,1393,1,0,0,0,1404,1394,1,0,0,0,1404,1395,1,0,0,0,1404,1396,
	1,0,0,0,1404,1397,1,0,0,0,1404,1398,1,0,0,0,1404,1399,1,0,0,0,1404,1400,
	1,0,0,0,1404,1401,1,0,0,0,1404,1402,1,0,0,0,1404,1403,1,0,0,0,1405,123,
	1,0,0,0,1406,1414,3,128,64,0,1407,1409,5,82,0,0,1408,1410,3,276,138,0,1409,
	1408,1,0,0,0,1409,1410,1,0,0,0,1410,1411,1,0,0,0,1411,1413,5,83,0,0,1412,
	1407,1,0,0,0,1413,1416,1,0,0,0,1414,1412,1,0,0,0,1414,1415,1,0,0,0,1415,
	1417,1,0,0,0,1416,1414,1,0,0,0,1417,1418,5,2,0,0,1418,1434,1,0,0,0,1419,
	1420,5,57,0,0,1420,1426,3,128,64,0,1421,1423,5,82,0,0,1422,1424,3,276,138,
	0,1423,1422,1,0,0,0,1423,1424,1,0,0,0,1424,1425,1,0,0,0,1425,1427,5,83,
	0,0,1426,1421,1,0,0,0,1427,1428,1,0,0,0,1428,1426,1,0,0,0,1428,1429,1,0,
	0,0,1429,1430,1,0,0,0,1430,1431,5,58,0,0,1431,1432,5,2,0,0,1432,1434,1,
	0,0,0,1433,1406,1,0,0,0,1433,1419,1,0,0,0,1434,125,1,0,0,0,1435,1443,5,
	180,0,0,1436,1438,5,82,0,0,1437,1439,3,276,138,0,1438,1437,1,0,0,0,1438,
	1439,1,0,0,0,1439,1440,1,0,0,0,1440,1442,5,83,0,0,1441,1436,1,0,0,0,1442,
	1445,1,0,0,0,1443,1441,1,0,0,0,1443,1444,1,0,0,0,1444,1446,1,0,0,0,1445,
	1443,1,0,0,0,1446,1447,5,82,0,0,1447,1455,5,83,0,0,1448,1450,5,82,0,0,1449,
	1451,3,276,138,0,1450,1449,1,0,0,0,1450,1451,1,0,0,0,1451,1452,1,0,0,0,
	1452,1454,5,83,0,0,1453,1448,1,0,0,0,1454,1457,1,0,0,0,1455,1453,1,0,0,
	0,1455,1456,1,0,0,0,1456,1458,1,0,0,0,1457,1455,1,0,0,0,1458,1459,5,2,0,
	0,1459,127,1,0,0,0,1460,1475,5,146,0,0,1461,1475,5,147,0,0,1462,1475,5,
	149,0,0,1463,1475,5,148,0,0,1464,1475,5,156,0,0,1465,1475,5,157,0,0,1466,
	1475,5,158,0,0,1467,1475,5,159,0,0,1468,1475,5,89,0,0,1469,1475,5,90,0,
	0,1470,1472,5,91,0,0,1471,1473,5,67,0,0,1472,1471,1,0,0,0,1472,1473,1,0,
	0,0,1473,1475,1,0,0,0,1474,1460,1,0,0,0,1474,1461,1,0,0,0,1474,1462,1,0,
	0,0,1474,1463,1,0,0,0,1474,1464,1,0,0,0,1474,1465,1,0,0,0,1474,1466,1,0,
	0,0,1474,1467,1,0,0,0,1474,1468,1,0,0,0,1474,1469,1,0,0,0,1474,1470,1,0,
	0,0,1475,129,1,0,0,0,1476,1477,5,63,0,0,1477,1478,5,57,0,0,1478,1479,3,
	296,148,0,1479,1480,5,58,0,0,1480,1481,5,2,0,0,1481,131,1,0,0,0,1482,1483,
	3,276,138,0,1483,1484,5,7,0,0,1484,1485,5,180,0,0,1485,1487,3,268,134,0,
	1486,1488,3,134,67,0,1487,1486,1,0,0,0,1487,1488,1,0,0,0,1488,1489,1,0,
	0,0,1489,1490,5,2,0,0,1490,133,1,0,0,0,1491,1492,5,7,0,0,1492,1496,5,91,
	0,0,1493,1494,5,7,0,0,1494,1496,5,180,0,0,1495,1491,1,0,0,0,1495,1493,1,
	0,0,0,1496,135,1,0,0,0,1497,1498,5,92,0,0,1498,1499,5,180,0,0,1499,1500,
	3,268,134,0,1500,1501,5,2,0,0,1501,137,1,0,0,0,1502,1505,5,57,0,0,1503,
	1504,5,42,0,0,1504,1506,5,7,0,0,1505,1503,1,0,0,0,1505,1506,1,0,0,0,1506,
	1507,1,0,0,0,1507,1508,5,180,0,0,1508,1509,5,166,0,0,1509,1510,5,58,0,0,
	1510,1511,5,57,0,0,1511,1512,5,58,0,0,1512,1513,5,2,0,0,1513,139,1,0,0,
	0,1514,1595,3,276,138,0,1515,1516,7,9,0,0,1516,1596,3,142,71,0,1517,1518,
	5,165,0,0,1518,1519,5,57,0,0,1519,1520,5,58,0,0,1520,1521,5,165,0,0,1521,
	1522,5,57,0,0,1522,1523,5,58,0,0,1523,1524,5,165,0,0,1524,1525,5,57,0,0,
	1525,1528,5,58,0,0,1526,1527,5,48,0,0,1527,1529,3,276,138,0,1528,1526,1,
	0,0,0,1528,1529,1,0,0,0,1529,1596,1,0,0,0,1530,1531,5,165,0,0,1531,1532,
	5,57,0,0,1532,1533,5,58,0,0,1533,1534,5,165,0,0,1534,1535,5,57,0,0,1535,
	1536,5,58,0,0,1536,1537,5,48,0,0,1537,1546,3,276,138,0,1538,1539,5,165,
	0,0,1539,1540,5,57,0,0,1540,1544,5,58,0,0,1541,1542,5,165,0,0,1542,1543,
	5,57,0,0,1543,1545,5,58,0,0,1544,1541,1,0,0,0,1544,1545,1,0,0,0,1545,1547,
	1,0,0,0,1546,1538,1,0,0,0,1546,1547,1,0,0,0,1547,1596,1,0,0,0,1548,1549,
	5,165,0,0,1549,1550,5,57,0,0,1550,1551,5,58,0,0,1551,1552,5,165,0,0,1552,
	1554,5,57,0,0,1553,1555,3,166,83,0,1554,1553,1,0,0,0,1554,1555,1,0,0,0,
	1555,1556,1,0,0,0,1556,1596,5,58,0,0,1557,1558,5,165,0,0,1558,1559,5,57,
	0,0,1559,1560,5,58,0,0,1560,1561,5,7,0,0,1561,1562,3,16,8,0,1562,1563,5,
	48,0,0,1563,1564,3,276,138,0,1564,1596,1,0,0,0,1565,1566,5,165,0,0,1566,
	1567,5,57,0,0,1567,1568,5,58,0,0,1568,1569,7,9,0,0,1569,1578,3,276,138,
	0,1570,1571,5,165,0,0,1571,1572,5,57,0,0,1572,1576,5,58,0,0,1573,1574,5,
	165,0,0,1574,1575,5,57,0,0,1575,1577,5,58,0,0,1576,1573,1,0,0,0,1576,1577,
	1,0,0,0,1577,1579,1,0,0,0,1578,1570,1,0,0,0,1578,1579,1,0,0,0,1579,1596,
	1,0,0,0,1580,1581,5,165,0,0,1581,1583,5,57,0,0,1582,1584,3,166,83,0,1583,
	1582,1,0,0,0,1583,1584,1,0,0,0,1584,1585,1,0,0,0,1585,1596,5,58,0,0,1586,
	1587,5,166,0,0,1587,1588,5,57,0,0,1588,1596,5,58,0,0,1589,1590,5,169,0,
	0,1590,1591,5,57,0,0,1591,1592,3,276,138,0,1592,1593,5,58,0,0,1593,1596,
	1,0,0,0,1594,1596,7,11,0,0,1595,1515,1,0,0,0,1595,1517,1,0,0,0,1595,1530,
	1,0,0,0,1595,1548,1,0,0,0,1595,1557,1,0,0,0,1595,1565,1,0,0,0,1595,1580,
	1,0,0,0,1595,1586,1,0,0,0,1595,1589,1,0,0,0,1595,1594,1,0,0,0,1595,1596,
	1,0,0,0,1596,1597,1,0,0,0,1597,1598,5,2,0,0,1598,141,1,0,0,0,1599,1602,
	3,276,138,0,1600,1601,7,9,0,0,1601,1603,3,142,71,0,1602,1600,1,0,0,0,1602,
	1603,1,0,0,0,1603,143,1,0,0,0,1604,1605,7,12,0,0,1605,1606,3,276,138,0,
	1606,1607,5,2,0,0,1607,145,1,0,0,0,1608,1609,5,95,0,0,1609,1650,5,2,0,0,
	1610,1611,5,95,0,0,1611,1612,5,180,0,0,1612,1613,5,165,0,0,1613,1614,5,
	57,0,0,1614,1615,5,58,0,0,1615,1650,5,2,0,0,1616,1617,5,95,0,0,1617,1618,
	3,276,138,0,1618,1619,7,9,0,0,1619,1620,3,142,71,0,1620,1621,5,2,0,0,1621,
	1650,1,0,0,0,1622,1623,5,95,0,0,1623,1628,3,276,138,0,1624,1625,5,5,0,0,
	1625,1627,3,276,138,0,1626,1624,1,0,0,0,1627,1630,1,0,0,0,1628,1626,1,0,
	0,0,1628,1629,1,0,0,0,1629,1631,1,0,0,0,1630,1628,1,0,0,0,1631,1632,5,2,
	0,0,1632,1650,1,0,0,0,1633,1634,5,95,0,0,1634,1635,5,57,0,0,1635,1640,3,
	276,138,0,1636,1637,5,5,0,0,1637,1639,3,276,138,0,1638,1636,1,0,0,0,1639,
	1642,1,0,0,0,1640,1638,1,0,0,0,1640,1641,1,0,0,0,1641,1644,1,0,0,0,1642,
	1640,1,0,0,0,1643,1645,5,5,0,0,1644,1643,1,0,0,0,1644,1645,1,0,0,0,1645,
	1646,1,0,0,0,1646,1647,5,58,0,0,1647,1648,5,2,0,0,1648,1650,1,0,0,0,1649,
	1608,1,0,0,0,1649,1610,1,0,0,0,1649,1616,1,0,0,0,1649,1622,1,0,0,0,1649,
	1633,1,0,0,0,1650,147,1,0,0,0,1651,1652,5,30,0,0,1652,1653,5,57,0,0,1653,
	1654,3,276,138,0,1654,1655,5,58,0,0,1655,1656,5,2,0,0,1656,149,1,0,0,0,
	1657,1658,5,96,0,0,1658,1661,5,180,0,0,1659,1660,5,7,0,0,1660,1662,5,180,
	0,0,1661,1659,1,0,0,0,1661,1662,1,0,0,0,1662,1663,1,0,0,0,1663,1664,5,57,
	0,0,1664,1676,5,4,0,0,1665,1670,3,262,131,0,1666,1667,5,5,0,0,1667,1669,
	3,262,131,0,1668,1666,1,0,0,0,1669,1672,1,0,0,0,1670,1668,1,0,0,0,1670,
	1671,1,0,0,0,1671,1674,1,0,0,0,1672,1670,1,0,0,0,1673,1675,5,5,0,0,1674,
	1673,1,0,0,0,1674,1675,1,0,0,0,1675,1677,1,0,0,0,1676,1665,1,0,0,0,1676,
	1677,1,0,0,0,1677,1678,1,0,0,0,1678,1679,5,6,0,0,1679,1680,5,58,0,0,1680,
	1691,5,2,0,0,1681,1682,5,96,0,0,1682,1685,5,180,0,0,1683,1684,5,7,0,0,1684,
	1686,5,180,0,0,1685,1683,1,0,0,0,1685,1686,1,0,0,0,1686,1687,1,0,0,0,1687,
	1688,3,264,132,0,1688,1689,5,2,0,0,1689,1691,1,0,0,0,1690,1657,1,0,0,0,
	1690,1681,1,0,0,0,1691,151,1,0,0,0,1692,1696,3,154,77,0,1693,1695,3,286,
	143,0,1694,1693,1,0,0,0,1695,1698,1,0,0,0,1696,1694,1,0,0,0,1696,1697,1,
	0,0,0,1697,1699,1,0,0,0,1698,1696,1,0,0,0,1699,1707,3,16,8,0,1700,1701,
	5,48,0,0,1701,1705,3,276,138,0,1702,1703,5,165,0,0,1703,1704,5,57,0,0,1704,
	1706,5,58,0,0,1705,1702,1,0,0,0,1705,1706,1,0,0,0,1706,1708,1,0,0,0,1707,
	1700,1,0,0,0,1707,1708,1,0,0,0,1708,1709,1,0,0,0,1709,1710,5,2,0,0,1710,
	1766,1,0,0,0,1711,1715,3,92,46,0,1712,1714,3,286,143,0,1713,1712,1,0,0,
	0,1714,1717,1,0,0,0,1715,1713,1,0,0,0,1715,1716,1,0,0,0,1716,1718,1,0,0,
	0,1717,1715,1,0,0,0,1718,1726,3,16,8,0,1719,1720,5,48,0,0,1720,1724,3,276,
	138,0,1721,1722,5,165,0,0,1722,1723,5,57,0,0,1723,1725,5,58,0,0,1724,1721,
	1,0,0,0,1724,1725,1,0,0,0,1725,1727,1,0,0,0,1726,1719,1,0,0,0,1726,1727,
	1,0,0,0,1727,1728,1,0,0,0,1728,1729,5,2,0,0,1729,1766,1,0,0,0,1730,1734,
	3,296,148,0,1731,1733,3,286,143,0,1732,1731,1,0,0,0,1733,1736,1,0,0,0,1734,
	1732,1,0,0,0,1734,1735,1,0,0,0,1735,1737,1,0,0,0,1736,1734,1,0,0,0,1737,
	1747,3,16,8,0,1738,1739,5,48,0,0,1739,1745,3,276,138,0,1740,1741,7,9,0,
	0,1741,1746,3,142,71,0,1742,1743,5,165,0,0,1743,1744,5,57,0,0,1744,1746,
	5,58,0,0,1745,1740,1,0,0,0,1745,1742,1,0,0,0,1745,1746,1,0,0,0,1746,1748,
	1,0,0,0,1747,1738,1,0,0,0,1747,1748,1,0,0,0,1748,1749,1,0,0,0,1749,1750,
	5,2,0,0,1750,1766,1,0,0,0,1751,1755,3,90,45,0,1752,1754,3,286,143,0,1753,
	1752,1,0,0,0,1754,1757,1,0,0,0,1755,1753,1,0,0,0,1755,1756,1,0,0,0,1756,
	1758,1,0,0,0,1757,1755,1,0,0,0,1758,1761,3,16,8,0,1759,1760,5,48,0,0,1760,
	1762,3,276,138,0,1761,1759,1,0,0,0,1761,1762,1,0,0,0,1762,1763,1,0,0,0,
	1763,1764,5,2,0,0,1764,1766,1,0,0,0,1765,1692,1,0,0,0,1765,1711,1,0,0,0,
	1765,1730,1,0,0,0,1765,1751,1,0,0,0,1766,153,1,0,0,0,1767,1773,3,298,149,
	0,1768,1770,5,82,0,0,1769,1771,3,276,138,0,1770,1769,1,0,0,0,1770,1771,
	1,0,0,0,1771,1772,1,0,0,0,1772,1774,5,83,0,0,1773,1768,1,0,0,0,1774,1775,
	1,0,0,0,1775,1773,1,0,0,0,1775,1776,1,0,0,0,1776,155,1,0,0,0,1777,1778,
	3,296,148,0,1778,1783,5,180,0,0,1779,1780,5,5,0,0,1780,1781,3,296,148,0,
	1781,1782,5,180,0,0,1782,1784,1,0,0,0,1783,1779,1,0,0,0,1784,1785,1,0,0,
	0,1785,1783,1,0,0,0,1785,1786,1,0,0,0,1786,1787,1,0,0,0,1787,1788,5,48,
	0,0,1788,1789,3,276,138,0,1789,1790,5,2,0,0,1790,1854,1,0,0,0,1791,1792,
	5,57,0,0,1792,1795,3,164,82,0,1793,1794,5,5,0,0,1794,1796,3,164,82,0,1795,
	1793,1,0,0,0,1796,1797,1,0,0,0,1797,1795,1,0,0,0,1797,1798,1,0,0,0,1798,
	1799,1,0,0,0,1799,1800,5,58,0,0,1800,1801,5,48,0,0,1801,1802,5,57,0,0,1802,
	1805,3,276,138,0,1803,1804,5,5,0,0,1804,1806,3,276,138,0,1805,1803,1,0,
	0,0,1806,1807,1,0,0,0,1807,1805,1,0,0,0,1807,1808,1,0,0,0,1808,1809,1,0,
	0,0,1809,1810,5,58,0,0,1810,1811,5,2,0,0,1811,1854,1,0,0,0,1812,1813,5,
	57,0,0,1813,1816,3,164,82,0,1814,1815,5,5,0,0,1815,1817,3,164,82,0,1816,
	1814,1,0,0,0,1817,1818,1,0,0,0,1818,1816,1,0,0,0,1818,1819,1,0,0,0,1819,
	1820,1,0,0,0,1820,1821,5,58,0,0,1821,1822,5,48,0,0,1822,1823,3,276,138,
	0,1823,1824,5,2,0,0,1824,1854,1,0,0,0,1825,1826,5,57,0,0,1826,1830,3,296,
	148,0,1827,1829,3,286,143,0,1828,1827,1,0,0,0,1829,1832,1,0,0,0,1830,1828,
	1,0,0,0,1830,1831,1,0,0,0,1831,1833,1,0,0,0,1832,1830,1,0,0,0,1833,1834,
	3,16,8,0,1834,1835,5,58,0,0,1835,1836,5,48,0,0,1836,1837,3,276,138,0,1837,
	1838,5,2,0,0,1838,1854,1,0,0,0,1839,1840,5,57,0,0,1840,1844,3,92,46,0,1841,
	1843,3,286,143,0,1842,1841,1,0,0,0,1843,1846,1,0,0,0,1844,1842,1,0,0,0,
	1844,1845,1,0,0,0,1845,1847,1,0,0,0,1846,1844,1,0,0,0,1847,1848,3,16,8,
	0,1848,1849,5,58,0,0,1849,1850,5,48,0,0,1850,1851,3,276,138,0,1851,1852,
	5,2,0,0,1852,1854,1,0,0,0,1853,1777,1,0,0,0,1853,1791,1,0,0,0,1853,1812,
	1,0,0,0,1853,1825,1,0,0,0,1853,1839,1,0,0,0,1854,157,1,0,0,0,1855,1856,
	4,79,2,0,1856,1857,3,160,80,0,1857,1858,5,48,0,0,1858,1859,3,276,138,0,
	1859,1860,5,2,0,0,1860,159,1,0,0,0,1861,1863,5,57,0,0,1862,1864,3,162,81,
	0,1863,1862,1,0,0,0,1863,1864,1,0,0,0,1864,1871,1,0,0,0,1865,1867,5,5,0,
	0,1866,1868,3,162,81,0,1867,1866,1,0,0,0,1867,1868,1,0,0,0,1868,1870,1,
	0,0,0,1869,1865,1,0,0,0,1870,1873,1,0,0,0,1871,1869,1,0,0,0,1871,1872,1,
	0,0,0,1872,1874,1,0,0,0,1873,1871,1,0,0,0,1874,1875,5,58,0,0,1875,161,1,
	0,0,0,1876,1880,3,296,148,0,1877,1879,3,286,143,0,1878,1877,1,0,0,0,1879,
	1882,1,0,0,0,1880,1878,1,0,0,0,1880,1881,1,0,0,0,1881,1883,1,0,0,0,1882,
	1880,1,0,0,0,1883,1884,3,16,8,0,1884,1911,1,0,0,0,1885,1889,3,92,46,0,1886,
	1888,3,286,143,0,1887,1886,1,0,0,0,1888,1891,1,0,0,0,1889,1887,1,0,0,0,
	1889,1890,1,0,0,0,1890,1892,1,0,0,0,1891,1889,1,0,0,0,1892,1893,3,16,8,
	0,1893,1911,1,0,0,0,1894,1906,3,16,8,0,1895,1896,5,82,0,0,1896,1897,3,276,
	138,0,1897,1898,5,83,0,0,1898,1905,1,0,0,0,1899,1900,5,7,0,0,1900,1905,
	3,16,8,0,1901,1902,5,165,0,0,1902,1903,5,57,0,0,1903,1905,5,58,0,0,1904,
	1895,1,0,0,0,1904,1899,1,0,0,0,1904,1901,1,0,0,0,1905,1908,1,0,0,0,1906,
	1904,1,0,0,0,1906,1907,1,0,0,0,1907,1911,1,0,0,0,1908,1906,1,0,0,0,1909,
	1911,3,160,80,0,1910,1876,1,0,0,0,1910,1885,1,0,0,0,1910,1894,1,0,0,0,1910,
	1909,1,0,0,0,1911,163,1,0,0,0,1912,1916,3,296,148,0,1913,1915,3,286,143,
	0,1914,1913,1,0,0,0,1915,1918,1,0,0,0,1916,1914,1,0,0,0,1916,1917,1,0,0,
	0,1917,1919,1,0,0,0,1918,1916,1,0,0,0,1919,1920,3,16,8,0,1920,1947,1,0,
	0,0,1921,1925,3,92,46,0,1922,1924,3,286,143,0,1923,1922,1,0,0,0,1924,1927,
	1,0,0,0,1925,1923,1,0,0,0,1925,1926,1,0,0,0,1926,1928,1,0,0,0,1927,1925,
	1,0,0,0,1928,1929,3,16,8,0,1929,1947,1,0,0,0,1930,1942,3,16,8,0,1931,1932,
	5,82,0,0,1932,1933,3,276,138,0,1933,1934,5,83,0,0,1934,1941,1,0,0,0,1935,
	1936,5,7,0,0,1936,1941,3,16,8,0,1937,1938,5,165,0,0,1938,1939,5,57,0,0,
	1939,1941,5,58,0,0,1940,1931,1,0,0,0,1940,1935,1,0,0,0,1940,1937,1,0,0,
	0,1941,1944,1,0,0,0,1942,1940,1,0,0,0,1942,1943,1,0,0,0,1943,1947,1,0,0,
	0,1944,1942,1,0,0,0,1945,1947,1,0,0,0,1946,1912,1,0,0,0,1946,1921,1,0,0,
	0,1946,1930,1,0,0,0,1946,1945,1,0,0,0,1947,165,1,0,0,0,1948,1949,3,276,
	138,0,1949,167,1,0,0,0,1950,1951,5,97,0,0,1951,1952,5,180,0,0,1952,1953,
	5,165,0,0,1953,1954,5,57,0,0,1954,1958,5,58,0,0,1955,1956,5,165,0,0,1956,
	1957,5,57,0,0,1957,1959,5,58,0,0,1958,1955,1,0,0,0,1958,1959,1,0,0,0,1959,
	1960,1,0,0,0,1960,2056,5,2,0,0,1961,1962,5,97,0,0,1962,1963,5,180,0,0,1963,
	2056,5,2,0,0,1964,1965,5,97,0,0,1965,1966,5,57,0,0,1966,1967,3,276,138,
	0,1967,1968,5,58,0,0,1968,1969,5,2,0,0,1969,2056,1,0,0,0,1970,1971,5,97,
	0,0,1971,1972,5,42,0,0,1972,1973,5,7,0,0,1973,1974,5,180,0,0,1974,2056,
	5,2,0,0,1975,1976,5,97,0,0,1976,1977,5,42,0,0,1977,1978,5,7,0,0,1978,1983,
	5,180,0,0,1979,1980,5,82,0,0,1980,1981,3,276,138,0,1981,1982,5,83,0,0,1982,
	1984,1,0,0,0,1983,1979,1,0,0,0,1984,1985,1,0,0,0,1985,1983,1,0,0,0,1985,
	1986,1,0,0,0,1986,1987,1,0,0,0,1987,1988,5,2,0,0,1988,2056,1,0,0,0,1989,
	1990,5,97,0,0,1990,1995,5,180,0,0,1991,1992,5,82,0,0,1992,1993,3,276,138,
	0,1993,1994,5,83,0,0,1994,1996,1,0,0,0,1995,1991,1,0,0,0,1996,1997,1,0,
	0,0,1997,1995,1,0,0,0,1997,1998,1,0,0,0,1998,2010,1,0,0,0,1999,2000,5,7,
	0,0,2000,2007,5,180,0,0,2001,2002,5,82,0,0,2002,2003,3,276,138,0,2003,2004,
	5,83,0,0,2004,2006,1,0,0,0,2005,2001,1,0,0,0,2006,2009,1,0,0,0,2007,2005,
	1,0,0,0,2007,2008,1,0,0,0,2008,2011,1,0,0,0,2009,2007,1,0,0,0,2010,1999,
	1,0,0,0,2011,2012,1,0,0,0,2012,2010,1,0,0,0,2012,2013,1,0,0,0,2013,2014,
	1,0,0,0,2014,2015,5,2,0,0,2015,2056,1,0,0,0,2016,2017,5,97,0,0,2017,2022,
	5,180,0,0,2018,2019,5,82,0,0,2019,2020,3,276,138,0,2020,2021,5,83,0,0,2021,
	2023,1,0,0,0,2022,2018,1,0,0,0,2023,2024,1,0,0,0,2024,2022,1,0,0,0,2024,
	2025,1,0,0,0,2025,2026,1,0,0,0,2026,2027,5,2,0,0,2027,2056,1,0,0,0,2028,
	2029,5,97,0,0,2029,2032,5,180,0,0,2030,2031,5,7,0,0,2031,2033,5,180,0,0,
	2032,2030,1,0,0,0,2033,2034,1,0,0,0,2034,2032,1,0,0,0,2034,2035,1,0,0,0,
	2035,2040,1,0,0,0,2036,2037,5,82,0,0,2037,2038,3,276,138,0,2038,2039,5,
	83,0,0,2039,2041,1,0,0,0,2040,2036,1,0,0,0,2041,2042,1,0,0,0,2042,2040,
	1,0,0,0,2042,2043,1,0,0,0,2043,2044,1,0,0,0,2044,2045,5,2,0,0,2045,2056,
	1,0,0,0,2046,2047,5,97,0,0,2047,2050,5,180,0,0,2048,2049,5,7,0,0,2049,2051,
	5,180,0,0,2050,2048,1,0,0,0,2051,2052,1,0,0,0,2052,2050,1,0,0,0,2052,2053,
	1,0,0,0,2053,2054,1,0,0,0,2054,2056,5,2,0,0,2055,1950,1,0,0,0,2055,1961,
	1,0,0,0,2055,1964,1,0,0,0,2055,1970,1,0,0,0,2055,1975,1,0,0,0,2055,1989,
	1,0,0,0,2055,2016,1,0,0,0,2055,2028,1,0,0,0,2055,2046,1,0,0,0,2056,169,
	1,0,0,0,2057,2058,5,41,0,0,2058,2059,5,57,0,0,2059,2060,5,154,0,0,2060,
	2061,5,23,0,0,2061,2064,3,276,138,0,2062,2063,5,5,0,0,2063,2065,3,250,125,
	0,2064,2062,1,0,0,0,2064,2065,1,0,0,0,2065,2066,1,0,0,0,2066,2067,5,58,
	0,0,2067,2068,5,2,0,0,2068,171,1,0,0,0,2069,2070,5,41,0,0,2070,2071,5,57,
	0,0,2071,2074,3,276,138,0,2072,2073,5,5,0,0,2073,2075,3,250,125,0,2074,
	2072,1,0,0,0,2074,2075,1,0,0,0,2075,2076,1,0,0,0,2076,2077,5,58,0,0,2077,
	2078,5,2,0,0,2078,173,1,0,0,0,2079,2080,5,98,0,0,2080,2081,5,57,0,0,2081,
	2082,3,276,138,0,2082,2083,5,58,0,0,2083,2086,3,118,59,0,2084,2085,5,99,
	0,0,2085,2087,3,118,59,0,2086,2084,1,0,0,0,2086,2087,1,0,0,0,2087,175,1,
	0,0,0,2088,2095,3,192,96,0,2089,2095,3,194,97,0,2090,2095,3,184,92,0,2091,
	2095,3,178,89,0,2092,2095,3,180,90,0,2093,2095,3,182,91,0,2094,2088,1,0,
	0,0,2094,2089,1,0,0,0,2094,2090,1,0,0,0,2094,2091,1,0,0,0,2094,2092,1,0,
	0,0,2094,2093,1,0,0,0,2095,177,1,0,0,0,2096,2097,5,11,0,0,2097,2098,5,57,
	0,0,2098,2099,3,296,148,0,2099,2100,5,180,0,0,2100,2101,5,5,0,0,2101,2102,
	3,296,148,0,2102,2103,5,180,0,0,2103,2104,5,100,0,0,2104,2105,5,42,0,0,
	2105,2106,5,7,0,0,2106,2107,5,180,0,0,2107,2108,5,7,0,0,2108,2109,5,33,
	0,0,2109,2110,5,58,0,0,2110,2111,3,118,59,0,2111,179,1,0,0,0,2112,2113,
	5,11,0,0,2113,2114,5,57,0,0,2114,2115,3,296,148,0,2115,2116,5,180,0,0,2116,
	2117,5,101,0,0,2117,2118,5,42,0,0,2118,2119,5,7,0,0,2119,2120,5,180,0,0,
	2120,2121,5,58,0,0,2121,2122,3,118,59,0,2122,181,1,0,0,0,2123,2124,5,11,
	0,0,2124,2125,5,57,0,0,2125,2126,3,296,148,0,2126,2127,5,180,0,0,2127,2128,
	5,100,0,0,2128,2129,5,42,0,0,2129,2130,5,7,0,0,2130,2131,5,180,0,0,2131,
	2132,5,58,0,0,2132,2133,3,118,59,0,2133,183,1,0,0,0,2134,2135,5,11,0,0,
	2135,2136,5,57,0,0,2136,2137,3,186,93,0,2137,2139,3,188,94,0,2138,2140,
	3,190,95,0,2139,2138,1,0,0,0,2139,2140,1,0,0,0,2140,2141,1,0,0,0,2141,2142,
	5,58,0,0,2142,2143,3,118,59,0,2143,185,1,0,0,0,2144,2148,3,296,148,0,2145,
	2147,3,286,143,0,2146,2145,1,0,0,0,2147,2150,1,0,0,0,2148,2146,1,0,0,0,
	2148,2149,1,0,0,0,2149,2151,1,0,0,0,2150,2148,1,0,0,0,2151,2154,5,180,0,
	0,2152,2153,5,48,0,0,2153,2155,3,276,138,0,2154,2152,1,0,0,0,2154,2155,
	1,0,0,0,2155,2156,1,0,0,0,2156,2157,5,2,0,0,2157,2190,1,0,0,0,2158,2159,
	5,180,0,0,2159,2160,7,9,0,0,2160,2161,3,276,138,0,2161,2162,5,2,0,0,2162,
	2190,1,0,0,0,2163,2164,5,57,0,0,2164,2167,3,164,82,0,2165,2166,5,5,0,0,
	2166,2168,3,164,82,0,2167,2165,1,0,0,0,2168,2169,1,0,0,0,2169,2167,1,0,
	0,0,2169,2170,1,0,0,0,2170,2171,1,0,0,0,2171,2172,5,58,0,0,2172,2184,5,
	48,0,0,2173,2174,5,57,0,0,2174,2177,3,276,138,0,2175,2176,5,5,0,0,2176,
	2178,3,276,138,0,2177,2175,1,0,0,0,2178,2179,1,0,0,0,2179,2177,1,0,0,0,
	2179,2180,1,0,0,0,2180,2181,1,0,0,0,2181,2182,5,58,0,0,2182,2185,1,0,0,
	0,2183,2185,3,276,138,0,2184,2173,1,0,0,0,2184,2183,1,0,0,0,2185,2186,1,
	0,0,0,2186,2187,5,2,0,0,2187,2190,1,0,0,0,2188,2190,5,2,0,0,2189,2144,1,
	0,0,0,2189,2158,1,0,0,0,2189,2163,1,0,0,0,2189,2188,1,0,0,0,2190,187,1,
	0,0,0,2191,2193,3,276,138,0,2192,2191,1,0,0,0,2192,2193,1,0,0,0,2193,2194,
	1,0,0,0,2194,2195,5,2,0,0,2195,189,1,0,0,0,2196,2197,5,180,0,0,2197,2198,
	7,9,0,0,2198,2228,3,276,138,0,2199,2200,5,180,0,0,2200,2228,7,12,0,0,2201,
	2202,7,12,0,0,2202,2228,5,180,0,0,2203,2204,5,57,0,0,2204,2207,3,164,82,
	0,2205,2206,5,5,0,0,2206,2208,3,164,82,0,2207,2205,1,0,0,0,2208,2209,1,
	0,0,0,2209,2207,1,0,0,0,2209,2210,1,0,0,0,2210,2211,1,0,0,0,2211,2212,5,
	58,0,0,2212,2224,5,48,0,0,2213,2214,5,57,0,0,2214,2217,3,276,138,0,2215,
	2216,5,5,0,0,2216,2218,3,276,138,0,2217,2215,1,0,0,0,2218,2219,1,0,0,0,
	2219,2217,1,0,0,0,2219,2220,1,0,0,0,2220,2221,1,0,0,0,2221,2222,5,58,0,
	0,2222,2225,1,0,0,0,2223,2225,3,276,138,0,2224,2213,1,0,0,0,2224,2223,1,
	0,0,0,2225,2228,1,0,0,0,2226,2228,3,276,138,0,2227,2196,1,0,0,0,2227,2199,
	1,0,0,0,2227,2201,1,0,0,0,2227,2203,1,0,0,0,2227,2226,1,0,0,0,2228,191,
	1,0,0,0,2229,2230,5,102,0,0,2230,2231,3,118,59,0,2231,2232,5,103,0,0,2232,
	2233,5,57,0,0,2233,2234,3,276,138,0,2234,2235,5,58,0,0,2235,2236,5,2,0,
	0,2236,193,1,0,0,0,2237,2238,5,103,0,0,2238,2239,5,57,0,0,2239,2240,3,276,
	138,0,2240,2241,5,58,0,0,2241,2242,3,118,59,0,2242,195,1,0,0,0,2243,2244,
	5,104,0,0,2244,2245,3,258,129,0,2245,2246,5,2,0,0,2246,197,1,0,0,0,2247,
	2249,5,105,0,0,2248,2250,5,151,0,0,2249,2248,1,0,0,0,2249,2250,1,0,0,0,
	2250,2261,1,0,0,0,2251,2252,5,57,0,0,2252,2257,5,151,0,0,2253,2254,5,5,
	0,0,2254,2256,5,151,0,0,2255,2253,1,0,0,0,2256,2259,1,0,0,0,2257,2255,1,
	0,0,0,2257,2258,1,0,0,0,2258,2260,1,0,0,0,2259,2257,1,0,0,0,2260,2262,5,
	58,0,0,2261,2251,1,0,0,0,2261,2262,1,0,0,0,2262,2263,1,0,0,0,2263,2264,
	3,200,100,0,2264,199,1,0,0,0,2265,2269,5,4,0,0,2266,2268,3,202,101,0,2267,
	2266,1,0,0,0,2268,2271,1,0,0,0,2269,2267,1,0,0,0,2269,2270,1,0,0,0,2270,
	2272,1,0,0,0,2271,2269,1,0,0,0,2272,2273,5,6,0,0,2273,201,1,0,0,0,2274,
	2288,3,200,100,0,2275,2288,3,204,102,0,2276,2288,3,206,103,0,2277,2288,
	3,208,104,0,2278,2288,3,210,105,0,2279,2288,3,216,108,0,2280,2288,3,218,
	109,0,2281,2288,5,106,0,0,2282,2288,5,107,0,0,2283,2288,5,37,0,0,2284,2288,
	3,222,111,0,2285,2288,3,228,114,0,2286,2288,3,230,115,0,2287,2274,1,0,0,
	0,2287,2275,1,0,0,0,2287,2276,1,0,0,0,2287,2277,1,0,0,0,2287,2278,1,0,0,
	0,2287,2279,1,0,0,0,2287,2280,1,0,0,0,2287,2281,1,0,0,0,2287,2282,1,0,0,
	0,2287,2283,1,0,0,0,2287,2284,1,0,0,0,2287,2285,1,0,0,0,2287,2286,1,0,0,
	0,2288,203,1,0,0,0,2289,2290,5,108,0,0,2290,2295,3,226,113,0,2291,2292,
	5,5,0,0,2292,2294,3,226,113,0,2293,2291,1,0,0,0,2294,2297,1,0,0,0,2295,
	2293,1,0,0,0,2295,2296,1,0,0,0,2296,2300,1,0,0,0,2297,2295,1,0,0,0,2298,
	2299,5,109,0,0,2299,2301,3,220,110,0,2300,2298,1,0,0,0,2300,2301,1,0,0,
	0,2301,205,1,0,0,0,2302,2307,3,228,114,0,2303,2304,5,5,0,0,2304,2306,3,
	228,114,0,2305,2303,1,0,0,0,2306,2309,1,0,0,0,2307,2305,1,0,0,0,2307,2308,
	1,0,0,0,2308,2310,1,0,0,0,2309,2307,1,0,0,0,2310,2311,5,109,0,0,2311,2312,
	3,220,110,0,2312,207,1,0,0,0,2313,2314,5,98,0,0,2314,2315,3,220,110,0,2315,
	2316,3,200,100,0,2316,209,1,0,0,0,2317,2318,5,110,0,0,2318,2328,3,220,110,
	0,2319,2321,3,212,106,0,2320,2319,1,0,0,0,2321,2322,1,0,0,0,2322,2320,1,
	0,0,0,2322,2323,1,0,0,0,2323,2325,1,0,0,0,2324,2326,3,214,107,0,2325,2324,
	1,0,0,0,2325,2326,1,0,0,0,2326,2329,1,0,0,0,2327,2329,3,214,107,0,2328,
	2320,1,0,0,0,2328,2327,1,0,0,0,2329,211,1,0,0,0,2330,2331,5,111,0,0,2331,
	2332,3,230,115,0,2332,2333,3,200,100,0,2333,213,1,0,0,0,2334,2335,5,112,
	0,0,2335,2336,3,200,100,0,2336,215,1,0,0,0,2337,2338,5,11,0,0,2338,2339,
	3,200,100,0,2339,2340,3,220,110,0,2340,2341,3,200,100,0,2341,2342,3,200,
	100,0,2342,217,1,0,0,0,2343,2344,5,9,0,0,2344,2345,3,226,113,0,2345,2354,
	5,57,0,0,2346,2351,3,226,113,0,2347,2348,5,5,0,0,2348,2350,3,226,113,0,
	2349,2347,1,0,0,0,2350,2353,1,0,0,0,2351,2349,1,0,0,0,2351,2352,1,0,0,0,
	2352,2355,1,0,0,0,2353,2351,1,0,0,0,2354,2346,1,0,0,0,2354,2355,1,0,0,0,
	2355,2356,1,0,0,0,2356,2366,5,58,0,0,2357,2358,5,113,0,0,2358,2363,3,226,
	113,0,2359,2360,5,5,0,0,2360,2362,3,226,113,0,2361,2359,1,0,0,0,2362,2365,
	1,0,0,0,2363,2361,1,0,0,0,2363,2364,1,0,0,0,2364,2367,1,0,0,0,2365,2363,
	1,0,0,0,2366,2357,1,0,0,0,2366,2367,1,0,0,0,2367,2368,1,0,0,0,2368,2369,
	3,200,100,0,2369,219,1,0,0,0,2370,2374,3,222,111,0,2371,2374,3,228,114,
	0,2372,2374,3,230,115,0,2373,2370,1,0,0,0,2373,2371,1,0,0,0,2373,2372,1,
	0,0,0,2374,221,1,0,0,0,2375,2376,3,224,112,0,2376,2385,5,57,0,0,2377,2382,
	3,220,110,0,2378,2379,5,5,0,0,2379,2381,3,220,110,0,2380,2378,1,0,0,0,2381,
	2384,1,0,0,0,2382,2380,1,0,0,0,2382,2383,1,0,0,0,2383,2386,1,0,0,0,2384,
	2382,1,0,0,0,2385,2377,1,0,0,0,2385,2386,1,0,0,0,2386,2387,1,0,0,0,2387,
	2388,5,58,0,0,2388,223,1,0,0,0,2389,2390,7,13,0,0,2390,225,1,0,0,0,2391,
	2395,3,16,8,0,2392,2393,4,113,3,0,2393,2395,9,0,0,0,2394,2391,1,0,0,0,2394,
	2392,1,0,0,0,2395,227,1,0,0,0,2396,2404,3,226,113,0,2397,2398,5,7,0,0,2398,
	2403,3,226,113,0,2399,2403,5,164,0,0,2400,2401,5,7,0,0,2401,2403,5,91,0,
	0,2402,2397,1,0,0,0,2402,2399,1,0,0,0,2402,2400,1,0,0,0,2403,2406,1,0,0,
	0,2404,2402,1,0,0,0,2404,2405,1,0,0,0,2405,229,1,0,0,0,2406,2404,1,0,0,
	0,2407,2408,7,14,0,0,2408,231,1,0,0,0,2409,2410,5,114,0,0,2410,2414,5,4,
	0,0,2411,2413,3,122,61,0,2412,2411,1,0,0,0,2413,2416,1,0,0,0,2414,2412,
	1,0,0,0,2414,2415,1,0,0,0,2415,2417,1,0,0,0,2416,2414,1,0,0,0,2417,2418,
	5,6,0,0,2418,233,1,0,0,0,2419,2420,5,110,0,0,2420,2421,5,57,0,0,2421,2422,
	3,276,138,0,2422,2423,5,58,0,0,2423,2427,5,4,0,0,2424,2426,3,236,118,0,
	2425,2424,1,0,0,0,2426,2429,1,0,0,0,2427,2425,1,0,0,0,2427,2428,1,0,0,0,
	2428,2431,1,0,0,0,2429,2427,1,0,0,0,2430,2432,3,238,119,0,2431,2430,1,0,
	0,0,2431,2432,1,0,0,0,2432,2433,1,0,0,0,2433,2434,5,6,0,0,2434,235,1,0,
	0,0,2435,2436,5,111,0,0,2436,2437,3,276,138,0,2437,2441,5,115,0,0,2438,
	2440,3,122,61,0,2439,2438,1,0,0,0,2440,2443,1,0,0,0,2441,2439,1,0,0,0,2441,
	2442,1,0,0,0,2442,237,1,0,0,0,2443,2441,1,0,0,0,2444,2445,5,112,0,0,2445,
	2449,5,115,0,0,2446,2448,3,122,61,0,2447,2446,1,0,0,0,2448,2451,1,0,0,0,
	2449,2447,1,0,0,0,2449,2450,1,0,0,0,2450,239,1,0,0,0,2451,2449,1,0,0,0,
	2452,2453,5,116,0,0,2453,2455,3,276,138,0,2454,2456,3,242,121,0,2455,2454,
	1,0,0,0,2455,2456,1,0,0,0,2456,2457,1,0,0,0,2457,2459,3,118,59,0,2458,2460,
	3,244,122,0,2459,2458,1,0,0,0,2460,2461,1,0,0,0,2461,2459,1,0,0,0,2461,
	2462,1,0,0,0,2462,241,1,0,0,0,2463,2464,5,88,0,0,2464,2476,5,57,0,0,2465,
	2470,3,116,58,0,2466,2467,5,5,0,0,2467,2469,3,116,58,0,2468,2466,1,0,0,
	0,2469,2472,1,0,0,0,2470,2468,1,0,0,0,2470,2471,1,0,0,0,2471,2474,1,0,0,
	0,2472,2470,1,0,0,0,2473,2475,5,5,0,0,2474,2473,1,0,0,0,2474,2475,1,0,0,
	0,2475,2477,1,0,0,0,2476,2465,1,0,0,0,2476,2477,1,0,0,0,2477,2478,1,0,0,
	0,2478,2479,5,58,0,0,2479,243,1,0,0,0,2480,2482,5,117,0,0,2481,2483,5,180,
	0,0,2482,2481,1,0,0,0,2482,2483,1,0,0,0,2483,2499,1,0,0,0,2484,2496,5,57,
	0,0,2485,2490,3,116,58,0,2486,2487,5,5,0,0,2487,2489,3,116,58,0,2488,2486,
	1,0,0,0,2489,2492,1,0,0,0,2490,2488,1,0,0,0,2490,2491,1,0,0,0,2491,2494,
	1,0,0,0,2492,2490,1,0,0,0,2493,2495,5,5,0,0,2494,2493,1,0,0,0,2494,2495,
	1,0,0,0,2495,2497,1,0,0,0,2496,2485,1,0,0,0,2496,2497,1,0,0,0,2497,2498,
	1,0,0,0,2498,2500,5,58,0,0,2499,2484,1,0,0,0,2499,2500,1,0,0,0,2500,2501,
	1,0,0,0,2501,2502,3,118,59,0,2502,245,1,0,0,0,2503,2504,5,106,0,0,2504,
	2505,5,2,0,0,2505,247,1,0,0,0,2506,2507,5,107,0,0,2507,2508,5,2,0,0,2508,
	249,1,0,0,0,2509,2514,5,151,0,0,2510,2511,5,180,0,0,2511,2514,3,264,132,
	0,2512,2514,3,276,138,0,2513,2509,1,0,0,0,2513,2510,1,0,0,0,2513,2512,1,
	0,0,0,2514,251,1,0,0,0,2515,2516,5,35,0,0,2516,2519,3,16,8,0,2517,2518,
	5,7,0,0,2518,2520,5,180,0,0,2519,2517,1,0,0,0,2519,2520,1,0,0,0,2520,2521,
	1,0,0,0,2521,2522,5,57,0,0,2522,2534,5,4,0,0,2523,2528,3,262,131,0,2524,
	2525,5,5,0,0,2525,2527,3,262,131,0,2526,2524,1,0,0,0,2527,2530,1,0,0,0,
	2528,2526,1,0,0,0,2528,2529,1,0,0,0,2529,2532,1,0,0,0,2530,2528,1,0,0,0,
	2531,2533,5,5,0,0,2532,2531,1,0,0,0,2532,2533,1,0,0,0,2533,2535,1,0,0,0,
	2534,2523,1,0,0,0,2534,2535,1,0,0,0,2535,2536,1,0,0,0,2536,2537,5,6,0,0,
	2537,2538,5,58,0,0,2538,2539,5,2,0,0,2539,2560,1,0,0,0,2540,2541,5,35,0,
	0,2541,2544,3,16,8,0,2542,2543,5,7,0,0,2543,2545,5,180,0,0,2544,2542,1,
	0,0,0,2544,2545,1,0,0,0,2545,2546,1,0,0,0,2546,2547,3,264,132,0,2547,2548,
	5,2,0,0,2548,2560,1,0,0,0,2549,2550,5,35,0,0,2550,2551,5,57,0,0,2551,2552,
	3,276,138,0,2552,2553,5,58,0,0,2553,2554,5,2,0,0,2554,2560,1,0,0,0,2555,
	2556,5,35,0,0,2556,2557,5,57,0,0,2557,2558,5,58,0,0,2558,2560,5,2,0,0,2559,
	2515,1,0,0,0,2559,2540,1,0,0,0,2559,2549,1,0,0,0,2559,2555,1,0,0,0,2560,
	253,1,0,0,0,2561,2562,5,118,0,0,2562,2563,5,57,0,0,2563,2564,3,276,138,
	0,2564,2565,5,58,0,0,2565,2566,5,2,0,0,2566,255,1,0,0,0,2567,2570,5,180,
	0,0,2568,2570,3,290,145,0,2569,2567,1,0,0,0,2569,2568,1,0,0,0,2570,257,
	1,0,0,0,2571,2583,5,57,0,0,2572,2577,3,256,128,0,2573,2574,5,5,0,0,2574,
	2576,3,256,128,0,2575,2573,1,0,0,0,2576,2579,1,0,0,0,2577,2575,1,0,0,0,
	2577,2578,1,0,0,0,2578,2581,1,0,0,0,2579,2577,1,0,0,0,2580,2582,5,5,0,0,
	2581,2580,1,0,0,0,2581,2582,1,0,0,0,2582,2584,1,0,0,0,2583,2572,1,0,0,0,
	2583,2584,1,0,0,0,2584,2585,1,0,0,0,2585,2586,5,58,0,0,2586,259,1,0,0,0,
	2587,2588,5,180,0,0,2588,2652,3,264,132,0,2589,2590,5,31,0,0,2590,2652,
	3,264,132,0,2591,2592,5,180,0,0,2592,2593,3,268,134,0,2593,2594,3,264,132,
	0,2594,2652,1,0,0,0,2595,2596,5,43,0,0,2596,2652,3,264,132,0,2597,2598,
	5,180,0,0,2598,2599,5,7,0,0,2599,2600,5,180,0,0,2600,2652,3,264,132,0,2601,
	2602,5,180,0,0,2602,2603,5,57,0,0,2603,2615,5,4,0,0,2604,2609,3,262,131,
	0,2605,2606,5,5,0,0,2606,2608,3,262,131,0,2607,2605,1,0,0,0,2608,2611,1,
	0,0,0,2609,2607,1,0,0,0,2609,2610,1,0,0,0,2610,2613,1,0,0,0,2611,2609,1,
	0,0,0,2612,2614,5,5,0,0,2613,2612,1,0,0,0,2613,2614,1,0,0,0,2614,2616,1,
	0,0,0,2615,2604,1,0,0,0,2615,2616,1,0,0,0,2616,2617,1,0,0,0,2617,2618,5,
	6,0,0,2618,2652,5,58,0,0,2619,2620,5,57,0,0,2620,2621,5,180,0,0,2621,2622,
	5,58,0,0,2622,2652,3,264,132,0,2623,2624,5,57,0,0,2624,2625,5,180,0,0,2625,
	2626,5,7,0,0,2626,2627,5,180,0,0,2627,2628,5,58,0,0,2628,2652,3,264,132,
	0,2629,2630,5,57,0,0,2630,2631,5,180,0,0,2631,2632,5,7,0,0,2632,2633,5,
	180,0,0,2633,2634,5,58,0,0,2634,2635,5,57,0,0,2635,2647,5,4,0,0,2636,2641,
	3,262,131,0,2637,2638,5,5,0,0,2638,2640,3,262,131,0,2639,2637,1,0,0,0,2640,
	2643,1,0,0,0,2641,2639,1,0,0,0,2641,2642,1,0,0,0,2642,2645,1,0,0,0,2643,
	2641,1,0,0,0,2644,2646,5,5,0,0,2645,2644,1,0,0,0,2645,2646,1,0,0,0,2646,
	2648,1,0,0,0,2647,2636,1,0,0,0,2647,2648,1,0,0,0,2648,2649,1,0,0,0,2649,
	2650,5,6,0,0,2650,2652,5,58,0,0,2651,2587,1,0,0,0,2651,2589,1,0,0,0,2651,
	2591,1,0,0,0,2651,2595,1,0,0,0,2651,2597,1,0,0,0,2651,2601,1,0,0,0,2651,
	2619,1,0,0,0,2651,2623,1,0,0,0,2651,2629,1,0,0,0,2652,261,1,0,0,0,2653,
	2654,5,180,0,0,2654,2655,5,115,0,0,2655,2656,3,276,138,0,2656,263,1,0,0,
	0,2657,2669,5,57,0,0,2658,2663,3,266,133,0,2659,2660,5,5,0,0,2660,2662,
	3,266,133,0,2661,2659,1,0,0,0,2662,2665,1,0,0,0,2663,2661,1,0,0,0,2663,
	2664,1,0,0,0,2664,2667,1,0,0,0,2665,2663,1,0,0,0,2666,2668,5,5,0,0,2667,
	2666,1,0,0,0,2667,2668,1,0,0,0,2668,2670,1,0,0,0,2669,2658,1,0,0,0,2669,
	2670,1,0,0,0,2670,2671,1,0,0,0,2671,2672,5,58,0,0,2672,265,1,0,0,0,2673,
	2674,5,180,0,0,2674,2675,5,165,0,0,2675,2676,5,57,0,0,2676,2683,5,58,0,
	0,2677,2680,3,276,138,0,2678,2679,7,9,0,0,2679,2681,3,142,71,0,2680,2678,
	1,0,0,0,2680,2681,1,0,0,0,2681,2683,1,0,0,0,2682,2673,1,0,0,0,2682,2677,
	1,0,0,0,2683,267,1,0,0,0,2684,2685,5,4,0,0,2685,2690,3,270,135,0,2686,2687,
	5,5,0,0,2687,2689,3,270,135,0,2688,2686,1,0,0,0,2689,2692,1,0,0,0,2690,
	2688,1,0,0,0,2690,2691,1,0,0,0,2691,2694,1,0,0,0,2692,2690,1,0,0,0,2693,
	2695,5,5,0,0,2694,2693,1,0,0,0,2694,2695,1,0,0,0,2695,2696,1,0,0,0,2696,
	2697,5,6,0,0,2697,269,1,0,0,0,2698,2699,5,180,0,0,2699,2700,5,115,0,0,2700,
	2701,3,276,138,0,2701,271,1,0,0,0,2702,2714,5,57,0,0,2703,2708,3,274,137,
	0,2704,2705,5,5,0,0,2705,2707,3,274,137,0,2706,2704,1,0,0,0,2707,2710,1,
	0,0,0,2708,2706,1,0,0,0,2708,2709,1,0,0,0,2709,2712,1,0,0,0,2710,2708,1,
	0,0,0,2711,2713,5,5,0,0,2712,2711,1,0,0,0,2712,2713,1,0,0,0,2713,2715,1,
	0,0,0,2714,2703,1,0,0,0,2714,2715,1,0,0,0,2715,2716,1,0,0,0,2716,2717,5,
	58,0,0,2717,273,1,0,0,0,2718,2734,3,296,148,0,2719,2734,3,92,46,0,2720,
	2721,5,57,0,0,2721,2722,3,274,137,0,2722,2730,5,58,0,0,2723,2725,5,82,0,
	0,2724,2726,3,276,138,0,2725,2724,1,0,0,0,2725,2726,1,0,0,0,2726,2727,1,
	0,0,0,2727,2729,5,83,0,0,2728,2723,1,0,0,0,2729,2732,1,0,0,0,2730,2728,
	1,0,0,0,2730,2731,1,0,0,0,2731,2734,1,0,0,0,2732,2730,1,0,0,0,2733,2718,
	1,0,0,0,2733,2719,1,0,0,0,2733,2720,1,0,0,0,2734,275,1,0,0,0,2735,2736,
	6,138,-1,0,2736,2737,5,57,0,0,2737,2738,5,180,0,0,2738,2739,7,9,0,0,2739,
	2740,3,276,138,0,2740,2741,5,58,0,0,2741,2930,1,0,0,0,2742,2743,5,57,0,
	0,2743,2744,5,92,0,0,2744,2745,5,180,0,0,2745,2746,5,58,0,0,2746,2747,3,
	268,134,0,2747,2748,3,264,132,0,2748,2930,1,0,0,0,2749,2750,5,57,0,0,2750,
	2751,3,276,138,0,2751,2752,5,58,0,0,2752,2930,1,0,0,0,2753,2754,5,57,0,
	0,2754,2930,5,58,0,0,2755,2756,5,57,0,0,2756,2759,3,276,138,0,2757,2758,
	5,5,0,0,2758,2760,3,276,138,0,2759,2757,1,0,0,0,2760,2761,1,0,0,0,2761,
	2759,1,0,0,0,2761,2762,1,0,0,0,2762,2763,1,0,0,0,2763,2764,5,58,0,0,2764,
	2930,1,0,0,0,2765,2766,3,306,153,0,2766,2767,5,57,0,0,2767,2769,3,276,138,
	0,2768,2770,5,5,0,0,2769,2768,1,0,0,0,2769,2770,1,0,0,0,2770,2771,1,0,0,
	0,2771,2772,5,58,0,0,2772,2930,1,0,0,0,2773,2775,3,260,130,0,2774,2776,
	3,264,132,0,2775,2774,1,0,0,0,2776,2777,1,0,0,0,2777,2775,1,0,0,0,2777,
	2778,1,0,0,0,2778,2930,1,0,0,0,2779,2930,3,260,130,0,2780,2781,5,57,0,0,
	2781,2782,3,276,138,0,2782,2783,5,58,0,0,2783,2784,3,264,132,0,2784,2930,
	1,0,0,0,2785,2786,5,92,0,0,2786,2788,5,180,0,0,2787,2789,3,268,134,0,2788,
	2787,1,0,0,0,2788,2789,1,0,0,0,2789,2790,1,0,0,0,2790,2930,3,264,132,0,
	2791,2792,5,92,0,0,2792,2798,3,296,148,0,2793,2795,5,82,0,0,2794,2796,5,
	145,0,0,2795,2794,1,0,0,0,2795,2796,1,0,0,0,2796,2797,1,0,0,0,2797,2799,
	5,83,0,0,2798,2793,1,0,0,0,2799,2800,1,0,0,0,2800,2798,1,0,0,0,2800,2801,
	1,0,0,0,2801,2802,1,0,0,0,2802,2803,5,57,0,0,2803,2804,3,276,138,0,2804,
	2805,5,58,0,0,2805,2930,1,0,0,0,2806,2807,5,92,0,0,2807,2808,5,148,0,0,
	2808,2809,5,57,0,0,2809,2810,3,276,138,0,2810,2811,5,58,0,0,2811,2930,1,
	0,0,0,2812,2813,5,92,0,0,2813,2814,5,146,0,0,2814,2815,5,57,0,0,2815,2816,
	3,276,138,0,2816,2817,5,58,0,0,2817,2930,1,0,0,0,2818,2819,3,278,139,0,
	2819,2820,5,7,0,0,2820,2821,5,180,0,0,2821,2930,1,0,0,0,2822,2823,5,119,
	0,0,2823,2930,3,264,132,0,2824,2825,5,120,0,0,2825,2930,3,264,132,0,2826,
	2827,5,121,0,0,2827,2930,3,264,132,0,2828,2829,5,122,0,0,2829,2930,3,264,
	132,0,2830,2831,5,123,0,0,2831,2843,5,57,0,0,2832,2833,7,15,0,0,2833,2834,
	5,7,0,0,2834,2844,5,180,0,0,2835,2836,5,180,0,0,2836,2837,5,82,0,0,2837,
	2838,5,145,0,0,2838,2844,5,83,0,0,2839,2844,5,180,0,0,2840,2841,5,180,0,
	0,2841,2842,5,57,0,0,2842,2844,5,58,0,0,2843,2832,1,0,0,0,2843,2835,1,0,
	0,0,2843,2839,1,0,0,0,2843,2840,1,0,0,0,2844,2845,1,0,0,0,2845,2846,5,5,
	0,0,2846,2847,3,280,140,0,2847,2848,5,58,0,0,2848,2930,1,0,0,0,2849,2850,
	5,124,0,0,2850,2930,3,264,132,0,2851,2852,5,125,0,0,2852,2930,3,264,132,
	0,2853,2854,5,126,0,0,2854,2855,5,57,0,0,2855,2856,3,276,138,0,2856,2857,
	5,5,0,0,2857,2858,3,272,136,0,2858,2859,5,58,0,0,2859,2930,1,0,0,0,2860,
	2861,5,127,0,0,2861,2862,5,57,0,0,2862,2863,3,276,138,0,2863,2864,5,5,0,
	0,2864,2865,3,272,136,0,2865,2866,5,5,0,0,2866,2867,5,145,0,0,2867,2868,
	5,58,0,0,2868,2930,1,0,0,0,2869,2930,7,16,0,0,2870,2871,5,128,0,0,2871,
	2872,5,82,0,0,2872,2873,3,276,138,0,2873,2874,5,83,0,0,2874,2875,7,17,0,
	0,2875,2930,1,0,0,0,2876,2877,5,129,0,0,2877,2878,5,82,0,0,2878,2879,3,
	276,138,0,2879,2880,5,83,0,0,2880,2881,7,18,0,0,2881,2930,1,0,0,0,2882,
	2883,7,12,0,0,2883,2930,3,276,138,22,2884,2885,7,19,0,0,2885,2930,3,276,
	138,21,2886,2898,5,82,0,0,2887,2892,3,276,138,0,2888,2889,5,5,0,0,2889,
	2891,3,276,138,0,2890,2888,1,0,0,0,2891,2894,1,0,0,0,2892,2890,1,0,0,0,
	2892,2893,1,0,0,0,2893,2896,1,0,0,0,2894,2892,1,0,0,0,2895,2897,5,5,0,0,
	2896,2895,1,0,0,0,2896,2897,1,0,0,0,2897,2899,1,0,0,0,2898,2887,1,0,0,0,
	2898,2899,1,0,0,0,2899,2900,1,0,0,0,2900,2930,5,83,0,0,2901,2902,5,42,0,
	0,2902,2903,5,7,0,0,2903,2904,5,180,0,0,2904,2905,5,7,0,0,2905,2906,5,180,
	0,0,2906,2907,5,82,0,0,2907,2908,3,276,138,0,2908,2909,5,83,0,0,2909,2910,
	3,284,142,0,2910,2930,1,0,0,0,2911,2912,5,42,0,0,2912,2913,5,7,0,0,2913,
	2918,5,180,0,0,2914,2915,5,82,0,0,2915,2916,3,276,138,0,2916,2917,5,83,
	0,0,2917,2919,1,0,0,0,2918,2914,1,0,0,0,2919,2920,1,0,0,0,2920,2918,1,0,
	0,0,2920,2921,1,0,0,0,2921,2930,1,0,0,0,2922,2923,5,42,0,0,2923,2924,5,
	7,0,0,2924,2930,5,180,0,0,2925,2930,5,42,0,0,2926,2930,5,160,0,0,2927,2930,
	3,16,8,0,2928,2930,3,290,145,0,2929,2735,1,0,0,0,2929,2742,1,0,0,0,2929,
	2749,1,0,0,0,2929,2753,1,0,0,0,2929,2755,1,0,0,0,2929,2765,1,0,0,0,2929,
	2773,1,0,0,0,2929,2779,1,0,0,0,2929,2780,1,0,0,0,2929,2785,1,0,0,0,2929,
	2791,1,0,0,0,2929,2806,1,0,0,0,2929,2812,1,0,0,0,2929,2818,1,0,0,0,2929,
	2822,1,0,0,0,2929,2824,1,0,0,0,2929,2826,1,0,0,0,2929,2828,1,0,0,0,2929,
	2830,1,0,0,0,2929,2849,1,0,0,0,2929,2851,1,0,0,0,2929,2853,1,0,0,0,2929,
	2860,1,0,0,0,2929,2869,1,0,0,0,2929,2870,1,0,0,0,2929,2876,1,0,0,0,2929,
	2882,1,0,0,0,2929,2884,1,0,0,0,2929,2886,1,0,0,0,2929,2901,1,0,0,0,2929,
	2911,1,0,0,0,2929,2922,1,0,0,0,2929,2925,1,0,0,0,2929,2926,1,0,0,0,2929,
	2927,1,0,0,0,2929,2928,1,0,0,0,2930,3100,1,0,0,0,2931,2932,10,20,0,0,2932,
	2933,5,17,0,0,2933,3099,3,276,138,20,2934,2935,10,19,0,0,2935,2936,7,20,
	0,0,2936,3099,3,276,138,20,2937,2938,10,18,0,0,2938,2939,7,21,0,0,2939,
	3099,3,276,138,19,2940,2941,10,17,0,0,2941,2942,7,22,0,0,2942,3099,3,276,
	138,18,2943,2944,10,16,0,0,2944,2945,5,24,0,0,2945,3099,3,276,138,17,2946,
	2947,10,15,0,0,2947,2948,5,26,0,0,2948,3099,3,276,138,16,2949,2950,10,14,
	0,0,2950,2951,5,25,0,0,2951,3099,3,276,138,15,2952,2953,10,13,0,0,2953,
	2954,7,23,0,0,2954,3099,3,276,138,14,2955,2956,10,12,0,0,2956,2957,7,24,
	0,0,2957,3099,3,276,138,13,2958,2959,10,11,0,0,2959,2960,5,134,0,0,2960,
	3099,3,276,138,12,2961,2962,10,10,0,0,2962,2963,5,47,0,0,2963,3099,3,276,
	138,11,2964,2965,10,40,0,0,2965,2967,5,82,0,0,2966,2968,3,276,138,0,2967,
	2966,1,0,0,0,2967,2968,1,0,0,0,2968,2969,1,0,0,0,2969,2971,5,115,0,0,2970,
	2972,3,276,138,0,2971,2970,1,0,0,0,2971,2972,1,0,0,0,2972,2973,1,0,0,0,
	2973,3099,5,83,0,0,2974,2975,10,39,0,0,2975,2976,5,82,0,0,2976,2977,5,145,
	0,0,2977,3099,5,83,0,0,2978,2979,10,38,0,0,2979,2980,5,82,0,0,2980,2981,
	3,276,138,0,2981,2982,5,83,0,0,2982,3099,1,0,0,0,2983,2984,10,35,0,0,2984,
	3099,7,25,0,0,2985,2986,10,34,0,0,2986,2987,5,167,0,0,2987,2988,5,57,0,
	0,2988,2989,3,276,138,0,2989,2990,5,58,0,0,2990,3099,1,0,0,0,2991,2992,
	10,33,0,0,2992,2993,5,168,0,0,2993,2994,5,57,0,0,2994,2995,3,276,138,0,
	2995,2996,5,5,0,0,2996,2997,3,276,138,0,2997,2998,5,58,0,0,2998,3099,1,
	0,0,0,2999,3000,10,32,0,0,3000,3001,5,7,0,0,3001,3005,5,180,0,0,3002,3003,
	5,7,0,0,3003,3006,5,180,0,0,3004,3006,5,163,0,0,3005,3002,1,0,0,0,3005,
	3004,1,0,0,0,3006,3007,1,0,0,0,3007,3008,5,57,0,0,3008,3009,3,276,138,0,
	3009,3010,5,58,0,0,3010,3011,3,264,132,0,3011,3099,1,0,0,0,3012,3013,10,
	31,0,0,3013,3014,5,7,0,0,3014,3016,5,180,0,0,3015,3017,3,268,134,0,3016,
	3015,1,0,0,0,3016,3017,1,0,0,0,3017,3018,1,0,0,0,3018,3019,5,57,0,0,3019,
	3031,5,4,0,0,3020,3025,3,262,131,0,3021,3022,5,5,0,0,3022,3024,3,262,131,
	0,3023,3021,1,0,0,0,3024,3027,1,0,0,0,3025,3023,1,0,0,0,3025,3026,1,0,0,
	0,3026,3029,1,0,0,0,3027,3025,1,0,0,0,3028,3030,5,5,0,0,3029,3028,1,0,0,
	0,3029,3030,1,0,0,0,3030,3032,1,0,0,0,3031,3020,1,0,0,0,3031,3032,1,0,0,
	0,3032,3033,1,0,0,0,3033,3034,5,6,0,0,3034,3099,5,58,0,0,3035,3036,10,30,
	0,0,3036,3037,5,7,0,0,3037,3039,5,180,0,0,3038,3040,3,268,134,0,3039,3038,
	1,0,0,0,3039,3040,1,0,0,0,3040,3041,1,0,0,0,3041,3043,3,264,132,0,3042,
	3044,3,264,132,0,3043,3042,1,0,0,0,3044,3045,1,0,0,0,3045,3043,1,0,0,0,
	3045,3046,1,0,0,0,3046,3099,1,0,0,0,3047,3048,10,29,0,0,3048,3050,5,164,
	0,0,3049,3051,3,268,134,0,3050,3049,1,0,0,0,3050,3051,1,0,0,0,3051,3052,
	1,0,0,0,3052,3099,3,264,132,0,3053,3054,10,28,0,0,3054,3056,5,163,0,0,3055,
	3057,3,268,134,0,3056,3055,1,0,0,0,3056,3057,1,0,0,0,3057,3058,1,0,0,0,
	3058,3099,3,264,132,0,3059,3060,10,27,0,0,3060,3061,5,7,0,0,3061,3063,5,
	180,0,0,3062,3064,3,268,134,0,3063,3062,1,0,0,0,3063,3064,1,0,0,0,3064,
	3065,1,0,0,0,3065,3099,3,264,132,0,3066,3067,10,26,0,0,3067,3068,5,7,0,
	0,3068,3069,5,180,0,0,3069,3070,3,268,134,0,3070,3071,3,284,142,0,3071,
	3099,1,0,0,0,3072,3073,10,25,0,0,3073,3074,5,82,0,0,3074,3075,3,276,138,
	0,3075,3077,5,83,0,0,3076,3078,3,268,134,0,3077,3076,1,0,0,0,3077,3078,
	1,0,0,0,3078,3079,1,0,0,0,3079,3080,3,264,132,0,3080,3099,1,0,0,0,3081,
	3082,10,24,0,0,3082,3099,3,284,142,0,3083,3084,10,23,0,0,3084,3099,7,12,
	0,0,3085,3086,10,9,0,0,3086,3087,5,135,0,0,3087,3090,3,276,138,0,3088,3089,
	7,9,0,0,3089,3091,3,142,71,0,3090,3088,1,0,0,0,3090,3091,1,0,0,0,3091,3092,
	1,0,0,0,3092,3093,5,115,0,0,3093,3096,3,276,138,0,3094,3095,7,9,0,0,3095,
	3097,3,142,71,0,3096,3094,1,0,0,0,3096,3097,1,0,0,0,3097,3099,1,0,0,0,3098,
	2931,1,0,0,0,3098,2934,1,0,0,0,3098,2937,1,0,0,0,3098,2940,1,0,0,0,3098,
	2943,1,0,0,0,3098,2946,1,0,0,0,3098,2949,1,0,0,0,3098,2952,1,0,0,0,3098,
	2955,1,0,0,0,3098,2958,1,0,0,0,3098,2961,1,0,0,0,3098,2964,1,0,0,0,3098,
	2974,1,0,0,0,3098,2978,1,0,0,0,3098,2983,1,0,0,0,3098,2985,1,0,0,0,3098,
	2991,1,0,0,0,3098,2999,1,0,0,0,3098,3012,1,0,0,0,3098,3035,1,0,0,0,3098,
	3047,1,0,0,0,3098,3053,1,0,0,0,3098,3059,1,0,0,0,3098,3066,1,0,0,0,3098,
	3072,1,0,0,0,3098,3081,1,0,0,0,3098,3083,1,0,0,0,3098,3085,1,0,0,0,3099,
	3102,1,0,0,0,3100,3098,1,0,0,0,3100,3101,1,0,0,0,3101,277,1,0,0,0,3102,
	3100,1,0,0,0,3103,3104,5,63,0,0,3104,3105,5,57,0,0,3105,3106,3,296,148,
	0,3106,3107,5,58,0,0,3107,3116,1,0,0,0,3108,3109,5,57,0,0,3109,3110,5,63,
	0,0,3110,3111,5,57,0,0,3111,3112,3,296,148,0,3112,3113,5,58,0,0,3113,3114,
	5,58,0,0,3114,3116,1,0,0,0,3115,3103,1,0,0,0,3115,3108,1,0,0,0,3116,279,
	1,0,0,0,3117,3118,5,57,0,0,3118,3119,5,180,0,0,3119,3120,5,58,0,0,3120,
	3121,5,48,0,0,3121,3126,3,276,138,0,3122,3126,3,276,138,0,3123,3124,5,57,
	0,0,3124,3126,5,58,0,0,3125,3117,1,0,0,0,3125,3122,1,0,0,0,3125,3123,1,
	0,0,0,3126,281,1,0,0,0,3127,3128,7,16,0,0,3128,3129,5,2,0,0,3129,283,1,
	0,0,0,3130,3131,5,7,0,0,3131,3148,5,180,0,0,3132,3133,5,7,0,0,3133,3148,
	5,34,0,0,3134,3135,5,7,0,0,3135,3148,5,91,0,0,3136,3148,5,163,0,0,3137,
	3148,5,172,0,0,3138,3148,5,173,0,0,3139,3148,5,174,0,0,3140,3148,5,175,
	0,0,3141,3148,5,176,0,0,3142,3148,5,177,0,0,3143,3148,5,178,0,0,3144,3148,
	5,179,0,0,3145,3148,5,170,0,0,3146,3148,5,171,0,0,3147,3130,1,0,0,0,3147,
	3132,1,0,0,0,3147,3134,1,0,0,0,3147,3136,1,0,0,0,3147,3137,1,0,0,0,3147,
	3138,1,0,0,0,3147,3139,1,0,0,0,3147,3140,1,0,0,0,3147,3141,1,0,0,0,3147,
	3142,1,0,0,0,3147,3143,1,0,0,0,3147,3144,1,0,0,0,3147,3145,1,0,0,0,3147,
	3146,1,0,0,0,3148,285,1,0,0,0,3149,3150,7,26,0,0,3150,287,1,0,0,0,3151,
	3152,7,27,0,0,3152,289,1,0,0,0,3153,3180,5,141,0,0,3154,3180,3,292,146,
	0,3155,3180,3,294,147,0,3156,3160,5,151,0,0,3157,3159,5,151,0,0,3158,3157,
	1,0,0,0,3159,3162,1,0,0,0,3160,3158,1,0,0,0,3160,3161,1,0,0,0,3161,3180,
	1,0,0,0,3162,3160,1,0,0,0,3163,3167,5,161,0,0,3164,3166,5,161,0,0,3165,
	3164,1,0,0,0,3166,3169,1,0,0,0,3167,3165,1,0,0,0,3167,3168,1,0,0,0,3168,
	3180,1,0,0,0,3169,3167,1,0,0,0,3170,3174,5,162,0,0,3171,3173,5,162,0,0,
	3172,3171,1,0,0,0,3173,3176,1,0,0,0,3174,3172,1,0,0,0,3174,3175,1,0,0,0,
	3175,3180,1,0,0,0,3176,3174,1,0,0,0,3177,3180,5,152,0,0,3178,3180,5,153,
	0,0,3179,3153,1,0,0,0,3179,3154,1,0,0,0,3179,3155,1,0,0,0,3179,3156,1,0,
	0,0,3179,3163,1,0,0,0,3179,3170,1,0,0,0,3179,3177,1,0,0,0,3179,3178,1,0,
	0,0,3180,291,1,0,0,0,3181,3183,5,145,0,0,3182,3184,7,28,0,0,3183,3182,1,
	0,0,0,3183,3184,1,0,0,0,3184,293,1,0,0,0,3185,3187,5,144,0,0,3186,3188,
	7,28,0,0,3187,3186,1,0,0,0,3187,3188,1,0,0,0,3188,295,1,0,0,0,3189,3190,
	5,91,0,0,3190,3209,5,67,0,0,3191,3209,5,91,0,0,3192,3209,5,146,0,0,3193,
	3209,5,147,0,0,3194,3209,5,149,0,0,3195,3209,5,148,0,0,3196,3209,5,156,
	0,0,3197,3209,5,157,0,0,3198,3209,5,89,0,0,3199,3209,5,90,0,0,3200,3209,
	5,158,0,0,3201,3209,5,159,0,0,3202,3209,3,298,149,0,3203,3204,5,180,0,0,
	3204,3205,5,7,0,0,3205,3209,5,180,0,0,3206,3209,5,34,0,0,3207,3209,5,180,
	0,0,3208,3189,1,0,0,0,3208,3191,1,0,0,0,3208,3192,1,0,0,0,3208,3193,1,0,
	0,0,3208,3194,1,0,0,0,3208,3195,1,0,0,0,3208,3196,1,0,0,0,3208,3197,1,0,
	0,0,3208,3198,1,0,0,0,3208,3199,1,0,0,0,3208,3200,1,0,0,0,3208,3201,1,0,
	0,0,3208,3202,1,0,0,0,3208,3203,1,0,0,0,3208,3206,1,0,0,0,3208,3207,1,0,
	0,0,3209,297,1,0,0,0,3210,3211,5,9,0,0,3211,3220,5,57,0,0,3212,3217,3,300,
	150,0,3213,3214,5,5,0,0,3214,3216,3,300,150,0,3215,3213,1,0,0,0,3216,3219,
	1,0,0,0,3217,3215,1,0,0,0,3217,3218,1,0,0,0,3218,3221,1,0,0,0,3219,3217,
	1,0,0,0,3220,3212,1,0,0,0,3220,3221,1,0,0,0,3221,3222,1,0,0,0,3222,3226,
	5,58,0,0,3223,3225,7,29,0,0,3224,3223,1,0,0,0,3225,3228,1,0,0,0,3226,3224,
	1,0,0,0,3226,3227,1,0,0,0,3227,3241,1,0,0,0,3228,3226,1,0,0,0,3229,3230,
	5,88,0,0,3230,3231,5,57,0,0,3231,3236,3,302,151,0,3232,3233,5,5,0,0,3233,
	3235,3,302,151,0,3234,3232,1,0,0,0,3235,3238,1,0,0,0,3236,3234,1,0,0,0,
	3236,3237,1,0,0,0,3237,3239,1,0,0,0,3238,3236,1,0,0,0,3239,3240,5,58,0,
	0,3240,3242,1,0,0,0,3241,3229,1,0,0,0,3241,3242,1,0,0,0,3242,299,1,0,0,
	0,3243,3247,3,296,148,0,3244,3247,3,92,46,0,3245,3247,3,90,45,0,3246,3243,
	1,0,0,0,3246,3244,1,0,0,0,3246,3245,1,0,0,0,3247,3249,1,0,0,0,3248,3250,
	3,288,144,0,3249,3248,1,0,0,0,3249,3250,1,0,0,0,3250,3252,1,0,0,0,3251,
	3253,3,16,8,0,3252,3251,1,0,0,0,3252,3253,1,0,0,0,3253,301,1,0,0,0,3254,
	3258,3,296,148,0,3255,3258,3,92,46,0,3256,3258,3,90,45,0,3257,3254,1,0,
	0,0,3257,3255,1,0,0,0,3257,3256,1,0,0,0,3258,3260,1,0,0,0,3259,3261,3,288,
	144,0,3260,3259,1,0,0,0,3260,3261,1,0,0,0,3261,303,1,0,0,0,3262,3278,5,
	146,0,0,3263,3264,4,152,32,0,3264,3278,5,180,0,0,3265,3278,5,147,0,0,3266,
	3278,5,148,0,0,3267,3278,5,149,0,0,3268,3278,5,155,0,0,3269,3278,5,156,
	0,0,3270,3278,5,157,0,0,3271,3278,5,89,0,0,3272,3278,5,90,0,0,3273,3278,
	5,158,0,0,3274,3278,5,159,0,0,3275,3278,5,91,0,0,3276,3278,5,67,0,0,3277,
	3262,1,0,0,0,3277,3263,1,0,0,0,3277,3265,1,0,0,0,3277,3266,1,0,0,0,3277,
	3267,1,0,0,0,3277,3268,1,0,0,0,3277,3269,1,0,0,0,3277,3270,1,0,0,0,3277,
	3271,1,0,0,0,3277,3272,1,0,0,0,3277,3273,1,0,0,0,3277,3274,1,0,0,0,3277,
	3275,1,0,0,0,3277,3276,1,0,0,0,3278,305,1,0,0,0,3279,3287,3,304,152,0,3280,
	3282,5,82,0,0,3281,3283,3,276,138,0,3282,3281,1,0,0,0,3282,3283,1,0,0,0,
	3283,3284,1,0,0,0,3284,3286,5,83,0,0,3285,3280,1,0,0,0,3286,3289,1,0,0,
	0,3287,3285,1,0,0,0,3287,3288,1,0,0,0,3288,307,1,0,0,0,3289,3287,1,0,0,
	0,382,311,316,318,333,335,355,359,366,371,399,405,409,418,425,427,431,437,
	449,452,462,466,474,477,481,486,490,514,519,531,535,544,548,557,559,562,
	576,579,592,594,609,624,628,637,644,648,665,667,673,678,686,689,706,708,
	715,722,724,728,735,743,747,749,753,759,762,765,775,779,781,788,792,794,
	802,809,822,826,833,853,859,865,871,878,888,895,901,905,911,919,927,934,
	941,948,953,961,968,975,982,987,989,993,999,1004,1006,1014,1016,1023,1025,
	1031,1033,1041,1043,1048,1051,1057,1064,1070,1076,1080,1085,1093,1098,1106,
	1111,1119,1124,1128,1134,1141,1148,1152,1157,1162,1168,1172,1174,1181,1186,
	1190,1200,1202,1206,1212,1219,1223,1237,1246,1250,1256,1265,1269,1277,1281,
	1287,1291,1297,1301,1303,1311,1315,1317,1325,1329,1335,1339,1345,1349,1351,
	1357,1362,1368,1404,1409,1414,1423,1428,1433,1438,1443,1450,1455,1472,1474,
	1487,1495,1505,1528,1544,1546,1554,1576,1578,1583,1595,1602,1628,1640,1644,
	1649,1661,1670,1674,1676,1685,1690,1696,1705,1707,1715,1724,1726,1734,1745,
	1747,1755,1761,1765,1770,1775,1785,1797,1807,1818,1830,1844,1853,1863,1867,
	1871,1880,1889,1904,1906,1910,1916,1925,1940,1942,1946,1958,1985,1997,2007,
	2012,2024,2034,2042,2052,2055,2064,2074,2086,2094,2139,2148,2154,2169,2179,
	2184,2189,2192,2209,2219,2224,2227,2249,2257,2261,2269,2287,2295,2300,2307,
	2322,2325,2328,2351,2354,2363,2366,2373,2382,2385,2394,2402,2404,2414,2427,
	2431,2441,2449,2455,2461,2470,2474,2476,2482,2490,2494,2496,2499,2513,2519,
	2528,2532,2534,2544,2559,2569,2577,2581,2583,2609,2613,2615,2641,2645,2647,
	2651,2663,2667,2669,2680,2682,2690,2694,2708,2712,2714,2725,2730,2733,2761,
	2769,2777,2788,2795,2800,2843,2892,2896,2898,2920,2929,2967,2971,3005,3016,
	3025,3029,3031,3039,3045,3050,3056,3063,3077,3090,3096,3098,3100,3115,3125,
	3147,3160,3167,3174,3179,3183,3187,3208,3217,3220,3226,3236,3241,3246,3249,
	3252,3257,3260,3277,3282,3287];

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
