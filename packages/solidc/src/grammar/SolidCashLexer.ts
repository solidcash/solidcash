// Generated from src/grammar/SolidCash.g4 by ANTLR 4.13.2
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
import {
	ATN,
	ATNDeserializer,
	CharStream,
	DecisionState, DFA,
	Lexer,
	LexerATNSimulator,
	RuleContext,
	PredictionContextCache,
	Token
} from "antlr4";
export default class SolidCashLexer extends Lexer {
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
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
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
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "T__1", "T__2", "T__3", "T__4", "T__5", "T__6", "T__7", "T__8", 
		"T__9", "T__10", "T__11", "T__12", "T__13", "T__14", "T__15", "T__16", 
		"T__17", "T__18", "T__19", "T__20", "T__21", "T__22", "T__23", "T__24", 
		"T__25", "T__26", "T__27", "T__28", "T__29", "T__30", "T__31", "T__32", 
		"T__33", "T__34", "T__35", "T__36", "T__37", "T__38", "T__39", "T__40", 
		"T__41", "T__42", "T__43", "T__44", "T__45", "T__46", "T__47", "T__48", 
		"T__49", "T__50", "T__51", "T__52", "T__53", "T__54", "T__55", "T__56", 
		"T__57", "T__58", "T__59", "T__60", "T__61", "T__62", "T__63", "T__64", 
		"T__65", "T__66", "T__67", "T__68", "T__69", "T__70", "T__71", "T__72", 
		"T__73", "T__74", "T__75", "T__76", "T__77", "T__78", "T__79", "T__80", 
		"T__81", "T__82", "T__83", "T__84", "T__85", "T__86", "T__87", "T__88", 
		"T__89", "T__90", "T__91", "T__92", "T__93", "T__94", "T__95", "T__96", 
		"T__97", "T__98", "T__99", "T__100", "T__101", "T__102", "T__103", "T__104", 
		"T__105", "T__106", "T__107", "T__108", "T__109", "T__110", "T__111", 
		"T__112", "T__113", "T__114", "T__115", "T__116", "T__117", "T__118", 
		"T__119", "T__120", "T__121", "T__122", "T__123", "T__124", "T__125", 
		"T__126", "T__127", "T__128", "T__129", "T__130", "T__131", "T__132", 
		"T__133", "T__134", "T__135", "T__136", "T__137", "T__138", "VersionLiteral", 
		"BooleanLiteral", "NumberUnit", "BchUnit", "DecimalLiteral", "NumberLiteral", 
		"NumberPart", "ExponentPart", "PrimitiveType", "CryptoType", "UnboundedBytes", 
		"BoundedBytes", "Bound", "StringLiteral", "DateLiteral", "HexLiteral", 
		"TxVar", "UnsafeCast", "BoundedSignedInt", "BoundedUnsignedInt", "BoundedSignedFixed", 
		"BoundedUnsignedFixed", "NullaryOp", "UnicodeLiteral", "HexStringLiteral", 
		"DotValue", "DotLength", "DotPush", "DotPop", "DotSplit", "DotSlice", 
		"DotDelete", "DotCode", "DotCodehash", "DotLockingBytecode", "DotTokenCategory", 
		"DotNftCommitment", "DotTokenAmount", "DotOutpointTransactionHash", "DotOutpointIndex", 
		"DotUnlockingBytecode", "DotSequenceNumber", "Identifier", "WHITESPACE", 
		"COMMENT", "LINE_COMMENT",
	];


	// True when the next input char cannot continue an identifier, so a dotted op like `.value` is a complete
	// token rather than the prefix of a longer member name like `.values` (which must lex as `.` + `values`).
	dotOpBoundary(): boolean {
	  const c = this._input.LA(1);
	  return !((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95);
	}
	// The `.split` op is always a call `x.split(y)`, so it only wins over a member named `split`
	// (`escrow.split[i]`, `s.split = ..`) when the next non-space char is `(`. Skips whitespace before '('.
	splitOpBoundary(): boolean {
	  let i = 1;
	  let c = this._input.LA(i);
	  while (c === 32 || c === 9 || c === 13 || c === 10 || c === 12) { i++; c = this._input.LA(i); }
	  return c === 40;
	}


	constructor(input: CharStream) {
		super(input);
		this._interp = new LexerATNSimulator(this, SolidCashLexer._ATN, SolidCashLexer.DecisionsToDFA, new PredictionContextCache());
	}

	public get grammarFileName(): string { return "SolidCash.g4"; }

	public get literalNames(): (string | null)[] { return SolidCashLexer.literalNames; }
	public get symbolicNames(): (string | null)[] { return SolidCashLexer.symbolicNames; }
	public get ruleNames(): string[] { return SolidCashLexer.ruleNames; }

	public get serializedATN(): number[] { return SolidCashLexer._serializedATN; }

	public get channelNames(): string[] { return SolidCashLexer.channelNames; }

	public get modeNames(): string[] { return SolidCashLexer.modeNames; }

	// @Override
	public sempred(localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 164:
			return this.DotValue_sempred(localctx, predIndex);
		case 165:
			return this.DotLength_sempred(localctx, predIndex);
		case 166:
			return this.DotPush_sempred(localctx, predIndex);
		case 167:
			return this.DotPop_sempred(localctx, predIndex);
		case 168:
			return this.DotSplit_sempred(localctx, predIndex);
		case 169:
			return this.DotSlice_sempred(localctx, predIndex);
		case 170:
			return this.DotDelete_sempred(localctx, predIndex);
		case 171:
			return this.DotCode_sempred(localctx, predIndex);
		case 172:
			return this.DotCodehash_sempred(localctx, predIndex);
		case 173:
			return this.DotLockingBytecode_sempred(localctx, predIndex);
		case 174:
			return this.DotTokenCategory_sempred(localctx, predIndex);
		case 175:
			return this.DotNftCommitment_sempred(localctx, predIndex);
		case 176:
			return this.DotTokenAmount_sempred(localctx, predIndex);
		case 177:
			return this.DotOutpointTransactionHash_sempred(localctx, predIndex);
		case 178:
			return this.DotOutpointIndex_sempred(localctx, predIndex);
		case 179:
			return this.DotUnlockingBytecode_sempred(localctx, predIndex);
		case 180:
			return this.DotSequenceNumber_sempred(localctx, predIndex);
		}
		return true;
	}
	private DotValue_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 0:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotLength_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 1:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotPush_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 2:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotPop_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 3:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotSplit_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 4:
			return this.splitOpBoundary();
		}
		return true;
	}
	private DotSlice_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 5:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotDelete_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 6:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotCode_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 7:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotCodehash_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 8:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotLockingBytecode_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 9:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotTokenCategory_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 10:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotNftCommitment_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 11:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotTokenAmount_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 12:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotOutpointTransactionHash_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 13:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotOutpointIndex_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 14:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotUnlockingBytecode_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 15:
			return this.dotOpBoundary();
		}
		return true;
	}
	private DotSequenceNumber_sempred(localctx: RuleContext, predIndex: number): boolean {
		switch (predIndex) {
		case 16:
			return this.dotOpBoundary();
		}
		return true;
	}

	public static readonly _serializedATN: number[] = [4,0,183,2210,6,-1,2,
	0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,
	9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,2,15,7,15,2,16,
	7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,7,20,2,21,7,21,2,22,7,22,2,23,7,
	23,2,24,7,24,2,25,7,25,2,26,7,26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,
	2,31,7,31,2,32,7,32,2,33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,
	38,7,38,2,39,7,39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,
	7,45,2,46,7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,
	52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,2,58,7,58,2,59,7,59,
	2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,63,2,64,7,64,2,65,7,65,2,66,7,66,2,
	67,7,67,2,68,7,68,2,69,7,69,2,70,7,70,2,71,7,71,2,72,7,72,2,73,7,73,2,74,
	7,74,2,75,7,75,2,76,7,76,2,77,7,77,2,78,7,78,2,79,7,79,2,80,7,80,2,81,7,
	81,2,82,7,82,2,83,7,83,2,84,7,84,2,85,7,85,2,86,7,86,2,87,7,87,2,88,7,88,
	2,89,7,89,2,90,7,90,2,91,7,91,2,92,7,92,2,93,7,93,2,94,7,94,2,95,7,95,2,
	96,7,96,2,97,7,97,2,98,7,98,2,99,7,99,2,100,7,100,2,101,7,101,2,102,7,102,
	2,103,7,103,2,104,7,104,2,105,7,105,2,106,7,106,2,107,7,107,2,108,7,108,
	2,109,7,109,2,110,7,110,2,111,7,111,2,112,7,112,2,113,7,113,2,114,7,114,
	2,115,7,115,2,116,7,116,2,117,7,117,2,118,7,118,2,119,7,119,2,120,7,120,
	2,121,7,121,2,122,7,122,2,123,7,123,2,124,7,124,2,125,7,125,2,126,7,126,
	2,127,7,127,2,128,7,128,2,129,7,129,2,130,7,130,2,131,7,131,2,132,7,132,
	2,133,7,133,2,134,7,134,2,135,7,135,2,136,7,136,2,137,7,137,2,138,7,138,
	2,139,7,139,2,140,7,140,2,141,7,141,2,142,7,142,2,143,7,143,2,144,7,144,
	2,145,7,145,2,146,7,146,2,147,7,147,2,148,7,148,2,149,7,149,2,150,7,150,
	2,151,7,151,2,152,7,152,2,153,7,153,2,154,7,154,2,155,7,155,2,156,7,156,
	2,157,7,157,2,158,7,158,2,159,7,159,2,160,7,160,2,161,7,161,2,162,7,162,
	2,163,7,163,2,164,7,164,2,165,7,165,2,166,7,166,2,167,7,167,2,168,7,168,
	2,169,7,169,2,170,7,170,2,171,7,171,2,172,7,172,2,173,7,173,2,174,7,174,
	2,175,7,175,2,176,7,176,2,177,7,177,2,178,7,178,2,179,7,179,2,180,7,180,
	2,181,7,181,2,182,7,182,2,183,7,183,2,184,7,184,1,0,1,0,1,0,1,0,1,0,1,0,
	1,0,1,1,1,1,1,2,1,2,1,2,1,3,1,3,1,4,1,4,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,6,
	1,6,1,6,1,6,1,7,1,7,1,7,1,7,1,7,1,7,1,8,1,8,1,8,1,8,1,9,1,9,1,10,1,10,1,
	10,1,10,1,10,1,10,1,10,1,11,1,11,1,12,1,12,1,13,1,13,1,14,1,14,1,15,1,15,
	1,16,1,16,1,16,1,17,1,17,1,17,1,18,1,18,1,18,1,19,1,19,1,20,1,20,1,20,1,
	21,1,21,1,22,1,22,1,22,1,23,1,23,1,24,1,24,1,25,1,25,1,26,1,26,1,27,1,27,
	1,27,1,27,1,27,1,27,1,27,1,27,1,27,1,28,1,28,1,28,1,28,1,28,1,28,1,28,1,
	28,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,29,1,30,
	1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,32,1,
	32,1,32,1,32,1,32,1,32,1,32,1,32,1,33,1,33,1,33,1,33,1,33,1,33,1,34,1,34,
	1,34,1,34,1,34,1,34,1,34,1,35,1,35,1,35,1,35,1,35,1,35,1,35,1,35,1,35,1,
	35,1,36,1,36,1,36,1,36,1,36,1,36,1,37,1,37,1,37,1,37,1,37,1,37,1,37,1,37,
	1,37,1,38,1,38,1,38,1,38,1,38,1,38,1,38,1,38,1,39,1,39,1,39,1,39,1,39,1,
	39,1,39,1,39,1,39,1,39,1,39,1,40,1,40,1,40,1,40,1,40,1,40,1,40,1,41,1,41,
	1,41,1,41,1,41,1,41,1,41,1,41,1,41,1,42,1,42,1,42,1,42,1,42,1,42,1,42,1,
	42,1,42,1,42,1,43,1,43,1,44,1,44,1,44,1,44,1,44,1,44,1,44,1,44,1,44,1,44,
	1,45,1,45,1,45,1,46,1,46,1,46,1,46,1,46,1,46,1,46,1,47,1,47,1,47,1,47,1,
	47,1,47,1,47,1,47,1,47,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,49,1,49,
	1,49,1,49,1,49,1,49,1,49,1,49,1,49,1,50,1,50,1,50,1,50,1,50,1,50,1,50,1,
	50,1,50,1,51,1,51,1,51,1,51,1,51,1,51,1,52,1,52,1,53,1,53,1,54,1,54,1,54,
	1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,55,1,55,1,55,1,55,1,55,1,55,1,55,1,
	55,1,56,1,56,1,56,1,56,1,56,1,56,1,56,1,57,1,57,1,57,1,57,1,57,1,58,1,58,
	1,58,1,58,1,58,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,59,1,60,1,60,1,
	60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,60,1,61,1,61,1,61,1,61,1,61,
	1,61,1,61,1,61,1,61,1,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,1,63,1,63,1,
	63,1,63,1,63,1,63,1,63,1,63,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,64,1,65,
	1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,66,1,66,1,66,1,67,1,67,1,68,1,68,1,
	69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,69,1,70,1,70,1,71,1,71,1,71,1,71,
	1,71,1,72,1,72,1,72,1,72,1,72,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,73,1,
	73,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,74,1,75,1,75,1,75,1,76,1,76,1,76,
	1,77,1,77,1,77,1,78,1,78,1,78,1,79,1,79,1,79,1,80,1,80,1,80,1,81,1,81,1,
	81,1,82,1,82,1,82,1,83,1,83,1,83,1,83,1,84,1,84,1,84,1,84,1,85,1,85,1,85,
	1,86,1,86,1,86,1,87,1,87,1,87,1,87,1,87,1,87,1,87,1,88,1,88,1,88,1,88,1,
	88,1,89,1,89,1,89,1,89,1,89,1,89,1,89,1,90,1,90,1,90,1,90,1,90,1,91,1,91,
	1,91,1,91,1,91,1,91,1,91,1,91,1,92,1,92,1,92,1,93,1,93,1,93,1,93,1,93,1,
	94,1,94,1,94,1,95,1,95,1,95,1,96,1,96,1,96,1,97,1,97,1,97,1,97,1,97,1,97,
	1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,98,1,99,1,99,1,
	99,1,99,1,99,1,99,1,99,1,99,1,99,1,100,1,100,1,100,1,100,1,100,1,100,1,
	101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,101,1,102,1,102,1,102,1,
	102,1,103,1,103,1,103,1,104,1,104,1,104,1,104,1,104,1,104,1,104,1,105,1,
	105,1,105,1,105,1,105,1,106,1,106,1,106,1,106,1,106,1,106,1,106,1,106,1,
	107,1,107,1,107,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,108,1,109,1,
	109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,109,1,110,1,110,1,111,1,
	111,1,111,1,111,1,112,1,112,1,112,1,112,1,112,1,112,1,113,1,113,1,113,1,
	113,1,113,1,113,1,113,1,114,1,114,1,114,1,114,1,115,1,115,1,115,1,115,1,
	115,1,115,1,115,1,115,1,115,1,115,1,115,1,116,1,116,1,116,1,116,1,116,1,
	116,1,116,1,116,1,116,1,116,1,116,1,116,1,116,1,116,1,116,1,116,1,116,1,
	117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,
	117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,117,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,
	118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,118,1,119,1,
	119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,119,1,
	119,1,119,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,120,1,
	120,1,120,1,120,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,121,1,
	121,1,121,1,121,1,121,1,121,1,122,1,122,1,122,1,122,1,122,1,122,1,122,1,
	122,1,122,1,122,1,122,1,123,1,123,1,123,1,123,1,123,1,123,1,123,1,123,1,
	123,1,123,1,123,1,123,1,123,1,124,1,124,1,124,1,124,1,124,1,124,1,124,1,
	124,1,124,1,124,1,124,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,125,1,
	125,1,125,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,126,1,
	126,1,127,1,127,1,128,1,128,1,128,1,129,1,129,1,129,1,130,1,130,1,130,1,
	131,1,131,1,131,1,132,1,132,1,133,1,133,1,133,1,133,1,133,1,133,1,133,1,
	134,1,134,1,134,1,134,1,134,1,134,1,134,1,134,1,134,1,135,1,135,1,135,1,
	135,1,135,1,135,1,135,1,135,1,136,1,136,1,136,1,136,1,136,1,136,1,136,1,
	136,1,136,1,136,1,137,1,137,1,137,1,137,1,137,1,137,1,138,1,138,1,138,1,
	138,1,138,1,138,1,138,1,139,4,139,1236,8,139,11,139,12,139,1237,1,139,1,
	139,4,139,1242,8,139,11,139,12,139,1243,1,139,1,139,4,139,1248,8,139,11,
	139,12,139,1249,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,1,140,3,
	140,1261,8,140,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,
	141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,
	141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,141,1,
	141,1,141,1,141,1,141,1,141,1,141,1,141,3,141,1303,8,141,1,142,1,142,1,
	142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,
	142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,142,1,
	142,1,142,1,142,3,142,1334,8,142,1,143,1,143,1,143,4,143,1339,8,143,11,
	143,12,143,1340,1,143,3,143,1344,8,143,1,144,1,144,3,144,1348,8,144,1,145,
	4,145,1351,8,145,11,145,12,145,1352,1,145,1,145,4,145,1357,8,145,11,145,
	12,145,1358,5,145,1361,8,145,10,145,12,145,1364,9,145,1,146,1,146,3,146,
	1368,8,146,1,146,1,146,1,147,1,147,1,147,1,147,1,147,1,147,1,147,1,147,
	1,147,1,147,1,147,1,147,1,147,1,147,1,147,1,147,1,147,1,147,1,147,3,147,
	1391,8,147,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,1,148,
	1,148,1,148,1,148,1,148,1,148,1,148,3,148,1409,8,148,1,149,1,149,1,149,
	1,149,1,149,1,149,1,150,1,150,1,150,1,150,1,150,1,150,1,150,1,150,1,150,
	1,150,1,150,3,150,1428,8,150,1,151,1,151,5,151,1432,8,151,10,151,12,151,
	1435,9,151,1,152,1,152,1,152,1,152,5,152,1441,8,152,10,152,12,152,1444,
	9,152,1,152,1,152,1,152,1,152,1,152,5,152,1451,8,152,10,152,12,152,1454,
	9,152,1,152,3,152,1457,8,152,1,153,1,153,1,153,1,153,1,153,1,153,1,153,
	1,153,1,153,1,154,1,154,1,154,5,154,1471,8,154,10,154,12,154,1474,9,154,
	1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,1,155,
	1,155,1,155,1,155,3,155,1491,8,155,1,156,1,156,1,156,1,156,1,156,1,156,
	1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,
	1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,1,156,
	1,156,1,156,1,156,1,156,1,156,3,156,1528,8,156,1,156,1,156,1,156,1,156,
	1,156,1,156,1,156,1,156,1,156,1,156,1,156,3,156,1541,8,156,1,157,1,157,
	1,157,1,157,1,157,1,157,1,158,1,158,1,158,1,158,1,158,1,158,1,158,1,159,
	1,159,1,159,1,159,1,159,1,159,1,159,1,159,1,159,4,159,1565,8,159,11,159,
	12,159,1566,1,160,1,160,1,160,1,160,1,160,1,160,1,160,1,160,1,160,1,160,
	4,160,1579,8,160,11,160,12,160,1580,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,1,161,
	3,161,1901,8,161,1,162,1,162,1,162,1,162,1,162,1,162,1,162,1,162,1,162,
	1,162,1,163,1,163,1,163,1,163,1,163,1,163,5,163,1919,8,163,10,163,12,163,
	1922,9,163,1,163,1,163,1,163,1,163,1,163,1,163,1,163,5,163,1931,8,163,10,
	163,12,163,1934,9,163,1,163,3,163,1937,8,163,1,164,1,164,1,164,1,164,1,
	164,1,164,1,164,1,164,1,164,1,165,1,165,1,165,1,165,1,165,1,165,1,165,1,
	165,1,165,1,165,1,166,1,166,1,166,1,166,1,166,1,166,1,166,1,166,1,167,1,
	167,1,167,1,167,1,167,1,167,1,167,1,168,1,168,1,168,1,168,1,168,1,168,1,
	168,1,168,1,168,1,169,1,169,1,169,1,169,1,169,1,169,1,169,1,169,1,169,1,
	170,1,170,1,170,1,170,1,170,1,170,1,170,1,170,1,170,1,170,1,171,1,171,1,
	171,1,171,1,171,1,171,1,171,1,171,1,172,1,172,1,172,1,172,1,172,1,172,1,
	172,1,172,1,172,1,172,1,172,1,172,1,173,1,173,1,173,1,173,1,173,1,173,1,
	173,1,173,1,173,1,173,1,173,1,173,1,173,1,173,1,173,1,173,1,173,1,173,1,
	173,1,174,1,174,1,174,1,174,1,174,1,174,1,174,1,174,1,174,1,174,1,174,1,
	174,1,174,1,174,1,174,1,174,1,174,1,175,1,175,1,175,1,175,1,175,1,175,1,
	175,1,175,1,175,1,175,1,175,1,175,1,175,1,175,1,175,1,175,1,175,1,176,1,
	176,1,176,1,176,1,176,1,176,1,176,1,176,1,176,1,176,1,176,1,176,1,176,1,
	176,1,176,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,
	177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,177,1,
	177,1,177,1,177,1,177,1,177,1,178,1,178,1,178,1,178,1,178,1,178,1,178,1,
	178,1,178,1,178,1,178,1,178,1,178,1,178,1,178,1,178,1,178,1,179,1,179,1,
	179,1,179,1,179,1,179,1,179,1,179,1,179,1,179,1,179,1,179,1,179,1,179,1,
	179,1,179,1,179,1,179,1,179,1,179,1,179,1,180,1,180,1,180,1,180,1,180,1,
	180,1,180,1,180,1,180,1,180,1,180,1,180,1,180,1,180,1,180,1,180,1,180,1,
	180,1,181,1,181,5,181,2174,8,181,10,181,12,181,2177,9,181,1,182,4,182,2180,
	8,182,11,182,12,182,2181,1,182,1,182,1,183,1,183,1,183,1,183,5,183,2190,
	8,183,10,183,12,183,2193,9,183,1,183,1,183,1,183,1,183,1,183,1,184,1,184,
	1,184,1,184,5,184,2204,8,184,10,184,12,184,2207,9,184,1,184,1,184,3,1442,
	1452,2191,0,185,1,1,3,2,5,3,7,4,9,5,11,6,13,7,15,8,17,9,19,10,21,11,23,
	12,25,13,27,14,29,15,31,16,33,17,35,18,37,19,39,20,41,21,43,22,45,23,47,
	24,49,25,51,26,53,27,55,28,57,29,59,30,61,31,63,32,65,33,67,34,69,35,71,
	36,73,37,75,38,77,39,79,40,81,41,83,42,85,43,87,44,89,45,91,46,93,47,95,
	48,97,49,99,50,101,51,103,52,105,53,107,54,109,55,111,56,113,57,115,58,
	117,59,119,60,121,61,123,62,125,63,127,64,129,65,131,66,133,67,135,68,137,
	69,139,70,141,71,143,72,145,73,147,74,149,75,151,76,153,77,155,78,157,79,
	159,80,161,81,163,82,165,83,167,84,169,85,171,86,173,87,175,88,177,89,179,
	90,181,91,183,92,185,93,187,94,189,95,191,96,193,97,195,98,197,99,199,100,
	201,101,203,102,205,103,207,104,209,105,211,106,213,107,215,108,217,109,
	219,110,221,111,223,112,225,113,227,114,229,115,231,116,233,117,235,118,
	237,119,239,120,241,121,243,122,245,123,247,124,249,125,251,126,253,127,
	255,128,257,129,259,130,261,131,263,132,265,133,267,134,269,135,271,136,
	273,137,275,138,277,139,279,140,281,141,283,142,285,143,287,144,289,145,
	291,0,293,0,295,146,297,147,299,148,301,149,303,150,305,151,307,152,309,
	153,311,154,313,155,315,156,317,157,319,158,321,159,323,160,325,161,327,
	162,329,163,331,164,333,165,335,166,337,167,339,168,341,169,343,170,345,
	171,347,172,349,173,351,174,353,175,355,176,357,177,359,178,361,179,363,
	180,365,181,367,182,369,183,1,0,12,1,0,48,57,2,0,69,69,101,101,1,0,49,57,
	4,0,10,10,13,13,34,34,92,92,4,0,10,10,13,13,39,39,92,92,2,0,88,88,120,120,
	3,0,48,57,65,70,97,102,5,0,32,32,48,57,65,70,95,95,97,102,4,0,36,36,65,
	90,95,95,97,122,5,0,36,36,48,57,65,90,95,95,97,122,3,0,9,10,12,13,32,32,
	2,0,10,10,13,13,2279,0,1,1,0,0,0,0,3,1,0,0,0,0,5,1,0,0,0,0,7,1,0,0,0,0,
	9,1,0,0,0,0,11,1,0,0,0,0,13,1,0,0,0,0,15,1,0,0,0,0,17,1,0,0,0,0,19,1,0,
	0,0,0,21,1,0,0,0,0,23,1,0,0,0,0,25,1,0,0,0,0,27,1,0,0,0,0,29,1,0,0,0,0,
	31,1,0,0,0,0,33,1,0,0,0,0,35,1,0,0,0,0,37,1,0,0,0,0,39,1,0,0,0,0,41,1,0,
	0,0,0,43,1,0,0,0,0,45,1,0,0,0,0,47,1,0,0,0,0,49,1,0,0,0,0,51,1,0,0,0,0,
	53,1,0,0,0,0,55,1,0,0,0,0,57,1,0,0,0,0,59,1,0,0,0,0,61,1,0,0,0,0,63,1,0,
	0,0,0,65,1,0,0,0,0,67,1,0,0,0,0,69,1,0,0,0,0,71,1,0,0,0,0,73,1,0,0,0,0,
	75,1,0,0,0,0,77,1,0,0,0,0,79,1,0,0,0,0,81,1,0,0,0,0,83,1,0,0,0,0,85,1,0,
	0,0,0,87,1,0,0,0,0,89,1,0,0,0,0,91,1,0,0,0,0,93,1,0,0,0,0,95,1,0,0,0,0,
	97,1,0,0,0,0,99,1,0,0,0,0,101,1,0,0,0,0,103,1,0,0,0,0,105,1,0,0,0,0,107,
	1,0,0,0,0,109,1,0,0,0,0,111,1,0,0,0,0,113,1,0,0,0,0,115,1,0,0,0,0,117,1,
	0,0,0,0,119,1,0,0,0,0,121,1,0,0,0,0,123,1,0,0,0,0,125,1,0,0,0,0,127,1,0,
	0,0,0,129,1,0,0,0,0,131,1,0,0,0,0,133,1,0,0,0,0,135,1,0,0,0,0,137,1,0,0,
	0,0,139,1,0,0,0,0,141,1,0,0,0,0,143,1,0,0,0,0,145,1,0,0,0,0,147,1,0,0,0,
	0,149,1,0,0,0,0,151,1,0,0,0,0,153,1,0,0,0,0,155,1,0,0,0,0,157,1,0,0,0,0,
	159,1,0,0,0,0,161,1,0,0,0,0,163,1,0,0,0,0,165,1,0,0,0,0,167,1,0,0,0,0,169,
	1,0,0,0,0,171,1,0,0,0,0,173,1,0,0,0,0,175,1,0,0,0,0,177,1,0,0,0,0,179,1,
	0,0,0,0,181,1,0,0,0,0,183,1,0,0,0,0,185,1,0,0,0,0,187,1,0,0,0,0,189,1,0,
	0,0,0,191,1,0,0,0,0,193,1,0,0,0,0,195,1,0,0,0,0,197,1,0,0,0,0,199,1,0,0,
	0,0,201,1,0,0,0,0,203,1,0,0,0,0,205,1,0,0,0,0,207,1,0,0,0,0,209,1,0,0,0,
	0,211,1,0,0,0,0,213,1,0,0,0,0,215,1,0,0,0,0,217,1,0,0,0,0,219,1,0,0,0,0,
	221,1,0,0,0,0,223,1,0,0,0,0,225,1,0,0,0,0,227,1,0,0,0,0,229,1,0,0,0,0,231,
	1,0,0,0,0,233,1,0,0,0,0,235,1,0,0,0,0,237,1,0,0,0,0,239,1,0,0,0,0,241,1,
	0,0,0,0,243,1,0,0,0,0,245,1,0,0,0,0,247,1,0,0,0,0,249,1,0,0,0,0,251,1,0,
	0,0,0,253,1,0,0,0,0,255,1,0,0,0,0,257,1,0,0,0,0,259,1,0,0,0,0,261,1,0,0,
	0,0,263,1,0,0,0,0,265,1,0,0,0,0,267,1,0,0,0,0,269,1,0,0,0,0,271,1,0,0,0,
	0,273,1,0,0,0,0,275,1,0,0,0,0,277,1,0,0,0,0,279,1,0,0,0,0,281,1,0,0,0,0,
	283,1,0,0,0,0,285,1,0,0,0,0,287,1,0,0,0,0,289,1,0,0,0,0,295,1,0,0,0,0,297,
	1,0,0,0,0,299,1,0,0,0,0,301,1,0,0,0,0,303,1,0,0,0,0,305,1,0,0,0,0,307,1,
	0,0,0,0,309,1,0,0,0,0,311,1,0,0,0,0,313,1,0,0,0,0,315,1,0,0,0,0,317,1,0,
	0,0,0,319,1,0,0,0,0,321,1,0,0,0,0,323,1,0,0,0,0,325,1,0,0,0,0,327,1,0,0,
	0,0,329,1,0,0,0,0,331,1,0,0,0,0,333,1,0,0,0,0,335,1,0,0,0,0,337,1,0,0,0,
	0,339,1,0,0,0,0,341,1,0,0,0,0,343,1,0,0,0,0,345,1,0,0,0,0,347,1,0,0,0,0,
	349,1,0,0,0,0,351,1,0,0,0,0,353,1,0,0,0,0,355,1,0,0,0,0,357,1,0,0,0,0,359,
	1,0,0,0,0,361,1,0,0,0,0,363,1,0,0,0,0,365,1,0,0,0,0,367,1,0,0,0,0,369,1,
	0,0,0,1,371,1,0,0,0,3,378,1,0,0,0,5,380,1,0,0,0,7,383,1,0,0,0,9,385,1,0,
	0,0,11,387,1,0,0,0,13,389,1,0,0,0,15,398,1,0,0,0,17,404,1,0,0,0,19,408,
	1,0,0,0,21,410,1,0,0,0,23,417,1,0,0,0,25,419,1,0,0,0,27,421,1,0,0,0,29,
	423,1,0,0,0,31,425,1,0,0,0,33,427,1,0,0,0,35,430,1,0,0,0,37,433,1,0,0,0,
	39,436,1,0,0,0,41,438,1,0,0,0,43,441,1,0,0,0,45,443,1,0,0,0,47,446,1,0,
	0,0,49,448,1,0,0,0,51,450,1,0,0,0,53,452,1,0,0,0,55,454,1,0,0,0,57,463,
	1,0,0,0,59,471,1,0,0,0,61,484,1,0,0,0,63,491,1,0,0,0,65,498,1,0,0,0,67,
	506,1,0,0,0,69,512,1,0,0,0,71,519,1,0,0,0,73,529,1,0,0,0,75,535,1,0,0,0,
	77,544,1,0,0,0,79,552,1,0,0,0,81,563,1,0,0,0,83,570,1,0,0,0,85,579,1,0,
	0,0,87,589,1,0,0,0,89,591,1,0,0,0,91,601,1,0,0,0,93,604,1,0,0,0,95,611,
	1,0,0,0,97,620,1,0,0,0,99,628,1,0,0,0,101,637,1,0,0,0,103,646,1,0,0,0,105,
	652,1,0,0,0,107,654,1,0,0,0,109,656,1,0,0,0,111,666,1,0,0,0,113,674,1,0,
	0,0,115,681,1,0,0,0,117,686,1,0,0,0,119,691,1,0,0,0,121,700,1,0,0,0,123,
	712,1,0,0,0,125,721,1,0,0,0,127,729,1,0,0,0,129,737,1,0,0,0,131,745,1,0,
	0,0,133,753,1,0,0,0,135,756,1,0,0,0,137,758,1,0,0,0,139,760,1,0,0,0,141,
	769,1,0,0,0,143,771,1,0,0,0,145,776,1,0,0,0,147,781,1,0,0,0,149,790,1,0,
	0,0,151,798,1,0,0,0,153,801,1,0,0,0,155,804,1,0,0,0,157,807,1,0,0,0,159,
	810,1,0,0,0,161,813,1,0,0,0,163,816,1,0,0,0,165,819,1,0,0,0,167,822,1,0,
	0,0,169,826,1,0,0,0,171,830,1,0,0,0,173,833,1,0,0,0,175,836,1,0,0,0,177,
	843,1,0,0,0,179,848,1,0,0,0,181,855,1,0,0,0,183,860,1,0,0,0,185,868,1,0,
	0,0,187,871,1,0,0,0,189,876,1,0,0,0,191,879,1,0,0,0,193,882,1,0,0,0,195,
	885,1,0,0,0,197,891,1,0,0,0,199,903,1,0,0,0,201,912,1,0,0,0,203,918,1,0,
	0,0,205,927,1,0,0,0,207,931,1,0,0,0,209,934,1,0,0,0,211,941,1,0,0,0,213,
	946,1,0,0,0,215,954,1,0,0,0,217,957,1,0,0,0,219,965,1,0,0,0,221,975,1,0,
	0,0,223,977,1,0,0,0,225,981,1,0,0,0,227,987,1,0,0,0,229,994,1,0,0,0,231,
	998,1,0,0,0,233,1009,1,0,0,0,235,1026,1,0,0,0,237,1049,1,0,0,0,239,1073,
	1,0,0,0,241,1088,1,0,0,0,243,1101,1,0,0,0,245,1115,1,0,0,0,247,1126,1,0,
	0,0,249,1139,1,0,0,0,251,1150,1,0,0,0,253,1160,1,0,0,0,255,1171,1,0,0,0,
	257,1173,1,0,0,0,259,1176,1,0,0,0,261,1179,1,0,0,0,263,1182,1,0,0,0,265,
	1185,1,0,0,0,267,1187,1,0,0,0,269,1194,1,0,0,0,271,1203,1,0,0,0,273,1211,
	1,0,0,0,275,1221,1,0,0,0,277,1227,1,0,0,0,279,1235,1,0,0,0,281,1260,1,0,
	0,0,283,1302,1,0,0,0,285,1333,1,0,0,0,287,1335,1,0,0,0,289,1345,1,0,0,0,
	291,1350,1,0,0,0,293,1365,1,0,0,0,295,1390,1,0,0,0,297,1408,1,0,0,0,299,
	1410,1,0,0,0,301,1427,1,0,0,0,303,1429,1,0,0,0,305,1456,1,0,0,0,307,1458,
	1,0,0,0,309,1467,1,0,0,0,311,1490,1,0,0,0,313,1540,1,0,0,0,315,1542,1,0,
	0,0,317,1548,1,0,0,0,319,1555,1,0,0,0,321,1568,1,0,0,0,323,1900,1,0,0,0,
	325,1902,1,0,0,0,327,1936,1,0,0,0,329,1938,1,0,0,0,331,1947,1,0,0,0,333,
	1957,1,0,0,0,335,1965,1,0,0,0,337,1972,1,0,0,0,339,1981,1,0,0,0,341,1990,
	1,0,0,0,343,2000,1,0,0,0,345,2008,1,0,0,0,347,2020,1,0,0,0,349,2039,1,0,
	0,0,351,2056,1,0,0,0,353,2073,1,0,0,0,355,2088,1,0,0,0,357,2115,1,0,0,0,
	359,2132,1,0,0,0,361,2153,1,0,0,0,363,2171,1,0,0,0,365,2179,1,0,0,0,367,
	2185,1,0,0,0,369,2199,1,0,0,0,371,372,5,105,0,0,372,373,5,109,0,0,373,374,
	5,112,0,0,374,375,5,111,0,0,375,376,5,114,0,0,376,377,5,116,0,0,377,2,1,
	0,0,0,378,379,5,59,0,0,379,4,1,0,0,0,380,381,5,97,0,0,381,382,5,115,0,0,
	382,6,1,0,0,0,383,384,5,123,0,0,384,8,1,0,0,0,385,386,5,44,0,0,386,10,1,
	0,0,0,387,388,5,125,0,0,388,12,1,0,0,0,389,390,5,102,0,0,390,391,5,117,
	0,0,391,392,5,110,0,0,392,393,5,99,0,0,393,394,5,116,0,0,394,395,5,105,
	0,0,395,396,5,111,0,0,396,397,5,110,0,0,397,14,1,0,0,0,398,399,5,117,0,
	0,399,400,5,115,0,0,400,401,5,105,0,0,401,402,5,110,0,0,402,403,5,103,0,
	0,403,16,1,0,0,0,404,405,5,102,0,0,405,406,5,111,0,0,406,407,5,114,0,0,
	407,18,1,0,0,0,408,409,5,42,0,0,409,20,1,0,0,0,410,411,5,103,0,0,411,412,
	5,108,0,0,412,413,5,111,0,0,413,414,5,98,0,0,414,415,5,97,0,0,415,416,5,
	108,0,0,416,22,1,0,0,0,417,418,5,46,0,0,418,24,1,0,0,0,419,420,5,43,0,0,
	420,26,1,0,0,0,421,422,5,45,0,0,422,28,1,0,0,0,423,424,5,47,0,0,424,30,
	1,0,0,0,425,426,5,37,0,0,426,32,1,0,0,0,427,428,5,42,0,0,428,429,5,42,0,
	0,429,34,1,0,0,0,430,431,5,61,0,0,431,432,5,61,0,0,432,36,1,0,0,0,433,434,
	5,33,0,0,434,435,5,61,0,0,435,38,1,0,0,0,436,437,5,60,0,0,437,40,1,0,0,
	0,438,439,5,60,0,0,439,440,5,61,0,0,440,42,1,0,0,0,441,442,5,62,0,0,442,
	44,1,0,0,0,443,444,5,62,0,0,444,445,5,61,0,0,445,46,1,0,0,0,446,447,5,38,
	0,0,447,48,1,0,0,0,448,449,5,124,0,0,449,50,1,0,0,0,450,451,5,94,0,0,451,
	52,1,0,0,0,452,453,5,126,0,0,453,54,1,0,0,0,454,455,5,100,0,0,455,456,5,
	101,0,0,456,457,5,108,0,0,457,458,5,101,0,0,458,459,5,103,0,0,459,460,5,
	97,0,0,460,461,5,116,0,0,461,462,5,101,0,0,462,56,1,0,0,0,463,464,5,117,
	0,0,464,465,5,112,0,0,465,466,5,103,0,0,466,467,5,114,0,0,467,468,5,97,
	0,0,468,469,5,100,0,0,469,470,5,101,0,0,470,58,1,0,0,0,471,472,5,115,0,
	0,472,473,5,101,0,0,473,474,5,108,0,0,474,475,5,102,0,0,475,476,5,100,0,
	0,476,477,5,101,0,0,477,478,5,115,0,0,478,479,5,116,0,0,479,480,5,114,0,
	0,480,481,5,117,0,0,481,482,5,99,0,0,482,483,5,116,0,0,483,60,1,0,0,0,484,
	485,5,117,0,0,485,486,5,110,0,0,486,487,5,115,0,0,487,488,5,97,0,0,488,
	489,5,102,0,0,489,490,5,101,0,0,490,62,1,0,0,0,491,492,5,112,0,0,492,493,
	5,97,0,0,493,494,5,99,0,0,494,495,5,107,0,0,495,496,5,101,0,0,496,497,5,
	100,0,0,497,64,1,0,0,0,498,499,5,101,0,0,499,500,5,110,0,0,500,501,5,116,
	0,0,501,502,5,114,0,0,502,503,5,105,0,0,503,504,5,101,0,0,504,505,5,115,
	0,0,505,66,1,0,0,0,506,507,5,101,0,0,507,508,5,114,0,0,508,509,5,114,0,
	0,509,510,5,111,0,0,510,511,5,114,0,0,511,68,1,0,0,0,512,513,5,114,0,0,
	513,514,5,101,0,0,514,515,5,118,0,0,515,516,5,101,0,0,516,517,5,114,0,0,
	517,518,5,116,0,0,518,70,1,0,0,0,519,520,5,116,0,0,520,521,5,114,0,0,521,
	522,5,97,0,0,522,523,5,110,0,0,523,524,5,115,0,0,524,525,5,105,0,0,525,
	526,5,101,0,0,526,527,5,110,0,0,527,528,5,116,0,0,528,72,1,0,0,0,529,530,
	5,108,0,0,530,531,5,101,0,0,531,532,5,97,0,0,532,533,5,118,0,0,533,534,
	5,101,0,0,534,74,1,0,0,0,535,536,5,102,0,0,536,537,5,97,0,0,537,538,5,108,
	0,0,538,539,5,108,0,0,539,540,5,98,0,0,540,541,5,97,0,0,541,542,5,99,0,
	0,542,543,5,107,0,0,543,76,1,0,0,0,544,545,5,114,0,0,545,546,5,101,0,0,
	546,547,5,99,0,0,547,548,5,101,0,0,548,549,5,105,0,0,549,550,5,118,0,0,
	550,551,5,101,0,0,551,78,1,0,0,0,552,553,5,101,0,0,553,554,5,110,0,0,554,
	555,5,117,0,0,555,556,5,109,0,0,556,557,5,101,0,0,557,558,5,114,0,0,558,
	559,5,97,0,0,559,560,5,98,0,0,560,561,5,108,0,0,561,562,5,101,0,0,562,80,
	1,0,0,0,563,564,5,112,0,0,564,565,5,114,0,0,565,566,5,97,0,0,566,567,5,
	103,0,0,567,568,5,109,0,0,568,569,5,97,0,0,569,82,1,0,0,0,570,571,5,115,
	0,0,571,572,5,111,0,0,572,573,5,108,0,0,573,574,5,105,0,0,574,575,5,100,
	0,0,575,576,5,105,0,0,576,577,5,116,0,0,577,578,5,121,0,0,578,84,1,0,0,
	0,579,580,5,115,0,0,580,581,5,111,0,0,581,582,5,108,0,0,582,583,5,105,0,
	0,583,584,5,100,0,0,584,585,5,99,0,0,585,586,5,97,0,0,586,587,5,115,0,0,
	587,588,5,104,0,0,588,86,1,0,0,0,589,590,5,61,0,0,590,88,1,0,0,0,591,592,
	5,105,0,0,592,593,5,110,0,0,593,594,5,116,0,0,594,595,5,101,0,0,595,596,
	5,114,0,0,596,597,5,102,0,0,597,598,5,97,0,0,598,599,5,99,0,0,599,600,5,
	101,0,0,600,90,1,0,0,0,601,602,5,105,0,0,602,603,5,115,0,0,603,92,1,0,0,
	0,604,605,5,112,0,0,605,606,5,117,0,0,606,607,5,98,0,0,607,608,5,108,0,
	0,608,609,5,105,0,0,609,610,5,99,0,0,610,94,1,0,0,0,611,612,5,101,0,0,612,
	613,5,120,0,0,613,614,5,116,0,0,614,615,5,101,0,0,615,616,5,114,0,0,616,
	617,5,110,0,0,617,618,5,97,0,0,618,619,5,108,0,0,619,96,1,0,0,0,620,621,
	5,108,0,0,621,622,5,105,0,0,622,623,5,98,0,0,623,624,5,114,0,0,624,625,
	5,97,0,0,625,626,5,114,0,0,626,627,5,121,0,0,627,98,1,0,0,0,628,629,5,97,
	0,0,629,630,5,98,0,0,630,631,5,115,0,0,631,632,5,116,0,0,632,633,5,114,
	0,0,633,634,5,97,0,0,634,635,5,99,0,0,635,636,5,116,0,0,636,100,1,0,0,0,
	637,638,5,99,0,0,638,639,5,111,0,0,639,640,5,110,0,0,640,641,5,116,0,0,
	641,642,5,114,0,0,642,643,5,97,0,0,643,644,5,99,0,0,644,645,5,116,0,0,645,
	102,1,0,0,0,646,647,5,101,0,0,647,648,5,118,0,0,648,649,5,101,0,0,649,650,
	5,110,0,0,650,651,5,116,0,0,651,104,1,0,0,0,652,653,5,40,0,0,653,106,1,
	0,0,0,654,655,5,41,0,0,655,108,1,0,0,0,656,657,5,97,0,0,657,658,5,110,0,
	0,658,659,5,111,0,0,659,660,5,110,0,0,660,661,5,121,0,0,661,662,5,109,0,
	0,662,663,5,111,0,0,663,664,5,117,0,0,664,665,5,115,0,0,665,110,1,0,0,0,
	666,667,5,105,0,0,667,668,5,110,0,0,668,669,5,100,0,0,669,670,5,101,0,0,
	670,671,5,120,0,0,671,672,5,101,0,0,672,673,5,100,0,0,673,112,1,0,0,0,674,
	675,5,115,0,0,675,676,5,116,0,0,676,677,5,114,0,0,677,678,5,117,0,0,678,
	679,5,99,0,0,679,680,5,116,0,0,680,114,1,0,0,0,681,682,5,101,0,0,682,683,
	5,110,0,0,683,684,5,117,0,0,684,685,5,109,0,0,685,116,1,0,0,0,686,687,5,
	116,0,0,687,688,5,121,0,0,688,689,5,112,0,0,689,690,5,101,0,0,690,118,1,
	0,0,0,691,692,5,99,0,0,692,693,5,111,0,0,693,694,5,110,0,0,694,695,5,115,
	0,0,695,696,5,116,0,0,696,697,5,97,0,0,697,698,5,110,0,0,698,699,5,116,
	0,0,699,120,1,0,0,0,700,701,5,99,0,0,701,702,5,111,0,0,702,703,5,110,0,
	0,703,704,5,115,0,0,704,705,5,116,0,0,705,706,5,114,0,0,706,707,5,117,0,
	0,707,708,5,99,0,0,708,709,5,116,0,0,709,710,5,111,0,0,710,711,5,114,0,
	0,711,122,1,0,0,0,712,713,5,105,0,0,713,714,5,110,0,0,714,715,5,116,0,0,
	715,716,5,101,0,0,716,717,5,114,0,0,717,718,5,110,0,0,718,719,5,97,0,0,
	719,720,5,108,0,0,720,124,1,0,0,0,721,722,5,112,0,0,722,723,5,97,0,0,723,
	724,5,121,0,0,724,725,5,97,0,0,725,726,5,98,0,0,726,727,5,108,0,0,727,728,
	5,101,0,0,728,126,1,0,0,0,729,730,5,118,0,0,730,731,5,105,0,0,731,732,5,
	114,0,0,732,733,5,116,0,0,733,734,5,117,0,0,734,735,5,97,0,0,735,736,5,
	108,0,0,736,128,1,0,0,0,737,738,5,112,0,0,738,739,5,114,0,0,739,740,5,105,
	0,0,740,741,5,118,0,0,741,742,5,97,0,0,742,743,5,116,0,0,743,744,5,101,
	0,0,744,130,1,0,0,0,745,746,5,109,0,0,746,747,5,97,0,0,747,748,5,112,0,
	0,748,749,5,112,0,0,749,750,5,105,0,0,750,751,5,110,0,0,751,752,5,103,0,
	0,752,132,1,0,0,0,753,754,5,61,0,0,754,755,5,62,0,0,755,134,1,0,0,0,756,
	757,5,91,0,0,757,136,1,0,0,0,758,759,5,93,0,0,759,138,1,0,0,0,760,761,5,
	109,0,0,761,762,5,111,0,0,762,763,5,100,0,0,763,764,5,105,0,0,764,765,5,
	102,0,0,765,766,5,105,0,0,766,767,5,101,0,0,767,768,5,114,0,0,768,140,1,
	0,0,0,769,770,5,95,0,0,770,142,1,0,0,0,771,772,5,112,0,0,772,773,5,117,
	0,0,773,774,5,114,0,0,774,775,5,101,0,0,775,144,1,0,0,0,776,777,5,118,0,
	0,777,778,5,105,0,0,778,779,5,101,0,0,779,780,5,119,0,0,780,146,1,0,0,0,
	781,782,5,111,0,0,782,783,5,118,0,0,783,784,5,101,0,0,784,785,5,114,0,0,
	785,786,5,114,0,0,786,787,5,105,0,0,787,788,5,100,0,0,788,789,5,101,0,0,
	789,148,1,0,0,0,790,791,5,114,0,0,791,792,5,101,0,0,792,793,5,116,0,0,793,
	794,5,117,0,0,794,795,5,114,0,0,795,796,5,110,0,0,796,797,5,115,0,0,797,
	150,1,0,0,0,798,799,5,43,0,0,799,800,5,61,0,0,800,152,1,0,0,0,801,802,5,
	45,0,0,802,803,5,61,0,0,803,154,1,0,0,0,804,805,5,42,0,0,805,806,5,61,0,
	0,806,156,1,0,0,0,807,808,5,47,0,0,808,809,5,61,0,0,809,158,1,0,0,0,810,
	811,5,37,0,0,811,812,5,61,0,0,812,160,1,0,0,0,813,814,5,38,0,0,814,815,
	5,61,0,0,815,162,1,0,0,0,816,817,5,124,0,0,817,818,5,61,0,0,818,164,1,0,
	0,0,819,820,5,94,0,0,820,821,5,61,0,0,821,166,1,0,0,0,822,823,5,60,0,0,
	823,824,5,60,0,0,824,825,5,61,0,0,825,168,1,0,0,0,826,827,5,62,0,0,827,
	828,5,62,0,0,828,829,5,61,0,0,829,170,1,0,0,0,830,831,5,43,0,0,831,832,
	5,43,0,0,832,172,1,0,0,0,833,834,5,45,0,0,834,835,5,45,0,0,835,174,1,0,
	0,0,836,837,5,114,0,0,837,838,5,101,0,0,838,839,5,116,0,0,839,840,5,117,
	0,0,840,841,5,114,0,0,841,842,5,110,0,0,842,176,1,0,0,0,843,844,5,101,0,
	0,844,845,5,109,0,0,845,846,5,105,0,0,846,847,5,116,0,0,847,178,1,0,0,0,
	848,849,5,100,0,0,849,850,5,101,0,0,850,851,5,108,0,0,851,852,5,101,0,0,
	852,853,5,116,0,0,853,854,5,101,0,0,854,180,1,0,0,0,855,856,5,116,0,0,856,
	857,5,104,0,0,857,858,5,105,0,0,858,859,5,115,0,0,859,182,1,0,0,0,860,861,
	5,114,0,0,861,862,5,101,0,0,862,863,5,113,0,0,863,864,5,117,0,0,864,865,
	5,105,0,0,865,866,5,114,0,0,866,867,5,101,0,0,867,184,1,0,0,0,868,869,5,
	105,0,0,869,870,5,102,0,0,870,186,1,0,0,0,871,872,5,101,0,0,872,873,5,108,
	0,0,873,874,5,115,0,0,874,875,5,101,0,0,875,188,1,0,0,0,876,877,5,111,0,
	0,877,878,5,102,0,0,878,190,1,0,0,0,879,880,5,105,0,0,880,881,5,110,0,0,
	881,192,1,0,0,0,882,883,5,100,0,0,883,884,5,111,0,0,884,194,1,0,0,0,885,
	886,5,119,0,0,886,887,5,104,0,0,887,888,5,105,0,0,888,889,5,108,0,0,889,
	890,5,101,0,0,890,196,1,0,0,0,891,892,5,99,0,0,892,893,5,111,0,0,893,894,
	5,110,0,0,894,895,5,115,0,0,895,896,5,111,0,0,896,897,5,108,0,0,897,898,
	5,101,0,0,898,899,5,46,0,0,899,900,5,108,0,0,900,901,5,111,0,0,901,902,
	5,103,0,0,902,198,1,0,0,0,903,904,5,97,0,0,904,905,5,115,0,0,905,906,5,
	115,0,0,906,907,5,101,0,0,907,908,5,109,0,0,908,909,5,98,0,0,909,910,5,
	108,0,0,910,911,5,121,0,0,911,200,1,0,0,0,912,913,5,98,0,0,913,914,5,114,
	0,0,914,915,5,101,0,0,915,916,5,97,0,0,916,917,5,107,0,0,917,202,1,0,0,
	0,918,919,5,99,0,0,919,920,5,111,0,0,920,921,5,110,0,0,921,922,5,116,0,
	0,922,923,5,105,0,0,923,924,5,110,0,0,924,925,5,117,0,0,925,926,5,101,0,
	0,926,204,1,0,0,0,927,928,5,108,0,0,928,929,5,101,0,0,929,930,5,116,0,0,
	930,206,1,0,0,0,931,932,5,58,0,0,932,933,5,61,0,0,933,208,1,0,0,0,934,935,
	5,115,0,0,935,936,5,119,0,0,936,937,5,105,0,0,937,938,5,116,0,0,938,939,
	5,99,0,0,939,940,5,104,0,0,940,210,1,0,0,0,941,942,5,99,0,0,942,943,5,97,
	0,0,943,944,5,115,0,0,944,945,5,101,0,0,945,212,1,0,0,0,946,947,5,100,0,
	0,947,948,5,101,0,0,948,949,5,102,0,0,949,950,5,97,0,0,950,951,5,117,0,
	0,951,952,5,108,0,0,952,953,5,116,0,0,953,214,1,0,0,0,954,955,5,45,0,0,
	955,956,5,62,0,0,956,216,1,0,0,0,957,958,5,97,0,0,958,959,5,100,0,0,959,
	960,5,100,0,0,960,961,5,114,0,0,961,962,5,101,0,0,962,963,5,115,0,0,963,
	964,5,115,0,0,964,218,1,0,0,0,965,966,5,117,0,0,966,967,5,110,0,0,967,968,
	5,99,0,0,968,969,5,104,0,0,969,970,5,101,0,0,970,971,5,99,0,0,971,972,5,
	107,0,0,972,973,5,101,0,0,973,974,5,100,0,0,974,220,1,0,0,0,975,976,5,58,
	0,0,976,222,1,0,0,0,977,978,5,116,0,0,978,979,5,114,0,0,979,980,5,121,0,
	0,980,224,1,0,0,0,981,982,5,99,0,0,982,983,5,97,0,0,983,984,5,116,0,0,984,
	985,5,99,0,0,985,986,5,104,0,0,986,226,1,0,0,0,987,988,5,97,0,0,988,989,
	5,115,0,0,989,990,5,115,0,0,990,991,5,101,0,0,991,992,5,114,0,0,992,993,
	5,116,0,0,993,228,1,0,0,0,994,995,5,110,0,0,995,996,5,101,0,0,996,997,5,
	119,0,0,997,230,1,0,0,0,998,999,5,97,0,0,999,1000,5,98,0,0,1000,1001,5,
	105,0,0,1001,1002,5,46,0,0,1002,1003,5,101,0,0,1003,1004,5,110,0,0,1004,
	1005,5,99,0,0,1005,1006,5,111,0,0,1006,1007,5,100,0,0,1007,1008,5,101,0,
	0,1008,232,1,0,0,0,1009,1010,5,97,0,0,1010,1011,5,98,0,0,1011,1012,5,105,
	0,0,1012,1013,5,46,0,0,1013,1014,5,101,0,0,1014,1015,5,110,0,0,1015,1016,
	5,99,0,0,1016,1017,5,111,0,0,1017,1018,5,100,0,0,1018,1019,5,101,0,0,1019,
	1020,5,80,0,0,1020,1021,5,97,0,0,1021,1022,5,99,0,0,1022,1023,5,107,0,0,
	1023,1024,5,101,0,0,1024,1025,5,100,0,0,1025,234,1,0,0,0,1026,1027,5,97,
	0,0,1027,1028,5,98,0,0,1028,1029,5,105,0,0,1029,1030,5,46,0,0,1030,1031,
	5,101,0,0,1031,1032,5,110,0,0,1032,1033,5,99,0,0,1033,1034,5,111,0,0,1034,
	1035,5,100,0,0,1035,1036,5,101,0,0,1036,1037,5,87,0,0,1037,1038,5,105,0,
	0,1038,1039,5,116,0,0,1039,1040,5,104,0,0,1040,1041,5,83,0,0,1041,1042,
	5,101,0,0,1042,1043,5,108,0,0,1043,1044,5,101,0,0,1044,1045,5,99,0,0,1045,
	1046,5,116,0,0,1046,1047,5,111,0,0,1047,1048,5,114,0,0,1048,236,1,0,0,0,
	1049,1050,5,97,0,0,1050,1051,5,98,0,0,1051,1052,5,105,0,0,1052,1053,5,46,
	0,0,1053,1054,5,101,0,0,1054,1055,5,110,0,0,1055,1056,5,99,0,0,1056,1057,
	5,111,0,0,1057,1058,5,100,0,0,1058,1059,5,101,0,0,1059,1060,5,87,0,0,1060,
	1061,5,105,0,0,1061,1062,5,116,0,0,1062,1063,5,104,0,0,1063,1064,5,83,0,
	0,1064,1065,5,105,0,0,1065,1066,5,103,0,0,1066,1067,5,110,0,0,1067,1068,
	5,97,0,0,1068,1069,5,116,0,0,1069,1070,5,117,0,0,1070,1071,5,114,0,0,1071,
	1072,5,101,0,0,1072,238,1,0,0,0,1073,1074,5,97,0,0,1074,1075,5,98,0,0,1075,
	1076,5,105,0,0,1076,1077,5,46,0,0,1077,1078,5,101,0,0,1078,1079,5,110,0,
	0,1079,1080,5,99,0,0,1080,1081,5,111,0,0,1081,1082,5,100,0,0,1082,1083,
	5,101,0,0,1083,1084,5,67,0,0,1084,1085,5,97,0,0,1085,1086,5,108,0,0,1086,
	1087,5,108,0,0,1087,240,1,0,0,0,1088,1089,5,98,0,0,1089,1090,5,121,0,0,
	1090,1091,5,116,0,0,1091,1092,5,101,0,0,1092,1093,5,115,0,0,1093,1094,5,
	46,0,0,1094,1095,5,99,0,0,1095,1096,5,111,0,0,1096,1097,5,110,0,0,1097,
	1098,5,99,0,0,1098,1099,5,97,0,0,1099,1100,5,116,0,0,1100,242,1,0,0,0,1101,
	1102,5,115,0,0,1102,1103,5,116,0,0,1103,1104,5,114,0,0,1104,1105,5,105,
	0,0,1105,1106,5,110,0,0,1106,1107,5,103,0,0,1107,1108,5,46,0,0,1108,1109,
	5,99,0,0,1109,1110,5,111,0,0,1110,1111,5,110,0,0,1111,1112,5,99,0,0,1112,
	1113,5,97,0,0,1113,1114,5,116,0,0,1114,244,1,0,0,0,1115,1116,5,97,0,0,1116,
	1117,5,98,0,0,1117,1118,5,105,0,0,1118,1119,5,46,0,0,1119,1120,5,100,0,
	0,1120,1121,5,101,0,0,1121,1122,5,99,0,0,1122,1123,5,111,0,0,1123,1124,
	5,100,0,0,1124,1125,5,101,0,0,1125,246,1,0,0,0,1126,1127,5,97,0,0,1127,
	1128,5,98,0,0,1128,1129,5,105,0,0,1129,1130,5,46,0,0,1130,1131,5,100,0,
	0,1131,1132,5,101,0,0,1132,1133,5,99,0,0,1133,1134,5,111,0,0,1134,1135,
	5,100,0,0,1135,1136,5,101,0,0,1136,1137,5,65,0,0,1137,1138,5,116,0,0,1138,
	248,1,0,0,0,1139,1140,5,116,0,0,1140,1141,5,120,0,0,1141,1142,5,46,0,0,
	1142,1143,5,111,0,0,1143,1144,5,117,0,0,1144,1145,5,116,0,0,1145,1146,5,
	112,0,0,1146,1147,5,117,0,0,1147,1148,5,116,0,0,1148,1149,5,115,0,0,1149,
	250,1,0,0,0,1150,1151,5,116,0,0,1151,1152,5,120,0,0,1152,1153,5,46,0,0,
	1153,1154,5,105,0,0,1154,1155,5,110,0,0,1155,1156,5,112,0,0,1156,1157,5,
	117,0,0,1157,1158,5,116,0,0,1158,1159,5,115,0,0,1159,252,1,0,0,0,1160,1161,
	5,46,0,0,1161,1162,5,114,0,0,1162,1163,5,101,0,0,1163,1164,5,118,0,0,1164,
	1165,5,101,0,0,1165,1166,5,114,0,0,1166,1167,5,115,0,0,1167,1168,5,101,
	0,0,1168,1169,5,40,0,0,1169,1170,5,41,0,0,1170,254,1,0,0,0,1171,1172,5,
	33,0,0,1172,256,1,0,0,0,1173,1174,5,62,0,0,1174,1175,5,62,0,0,1175,258,
	1,0,0,0,1176,1177,5,60,0,0,1177,1178,5,60,0,0,1178,260,1,0,0,0,1179,1180,
	5,38,0,0,1180,1181,5,38,0,0,1181,262,1,0,0,0,1182,1183,5,124,0,0,1183,1184,
	5,124,0,0,1184,264,1,0,0,0,1185,1186,5,63,0,0,1186,266,1,0,0,0,1187,1188,
	5,109,0,0,1188,1189,5,101,0,0,1189,1190,5,109,0,0,1190,1191,5,111,0,0,1191,
	1192,5,114,0,0,1192,1193,5,121,0,0,1193,268,1,0,0,0,1194,1195,5,99,0,0,
	1195,1196,5,97,0,0,1196,1197,5,108,0,0,1197,1198,5,108,0,0,1198,1199,5,
	100,0,0,1199,1200,5,97,0,0,1200,1201,5,116,0,0,1201,1202,5,97,0,0,1202,
	270,1,0,0,0,1203,1204,5,115,0,0,1204,1205,5,116,0,0,1205,1206,5,111,0,0,
	1206,1207,5,114,0,0,1207,1208,5,97,0,0,1208,1209,5,103,0,0,1209,1210,5,
	101,0,0,1210,272,1,0,0,0,1211,1212,5,105,0,0,1212,1213,5,109,0,0,1213,1214,
	5,109,0,0,1214,1215,5,117,0,0,1215,1216,5,116,0,0,1216,1217,5,97,0,0,1217,
	1218,5,98,0,0,1218,1219,5,108,0,0,1219,1220,5,101,0,0,1220,274,1,0,0,0,
	1221,1222,5,102,0,0,1222,1223,5,105,0,0,1223,1224,5,120,0,0,1224,1225,5,
	101,0,0,1225,1226,5,100,0,0,1226,276,1,0,0,0,1227,1228,5,117,0,0,1228,1229,
	5,102,0,0,1229,1230,5,105,0,0,1230,1231,5,120,0,0,1231,1232,5,101,0,0,1232,
	1233,5,100,0,0,1233,278,1,0,0,0,1234,1236,7,0,0,0,1235,1234,1,0,0,0,1236,
	1237,1,0,0,0,1237,1235,1,0,0,0,1237,1238,1,0,0,0,1238,1239,1,0,0,0,1239,
	1241,5,46,0,0,1240,1242,7,0,0,0,1241,1240,1,0,0,0,1242,1243,1,0,0,0,1243,
	1241,1,0,0,0,1243,1244,1,0,0,0,1244,1245,1,0,0,0,1245,1247,5,46,0,0,1246,
	1248,7,0,0,0,1247,1246,1,0,0,0,1248,1249,1,0,0,0,1249,1247,1,0,0,0,1249,
	1250,1,0,0,0,1250,280,1,0,0,0,1251,1252,5,116,0,0,1252,1253,5,114,0,0,1253,
	1254,5,117,0,0,1254,1261,5,101,0,0,1255,1256,5,102,0,0,1256,1257,5,97,0,
	0,1257,1258,5,108,0,0,1258,1259,5,115,0,0,1259,1261,5,101,0,0,1260,1251,
	1,0,0,0,1260,1255,1,0,0,0,1261,282,1,0,0,0,1262,1263,5,115,0,0,1263,1264,
	5,101,0,0,1264,1265,5,99,0,0,1265,1266,5,111,0,0,1266,1267,5,110,0,0,1267,
	1268,5,100,0,0,1268,1303,5,115,0,0,1269,1270,5,109,0,0,1270,1271,5,105,
	0,0,1271,1272,5,110,0,0,1272,1273,5,117,0,0,1273,1274,5,116,0,0,1274,1275,
	5,101,0,0,1275,1303,5,115,0,0,1276,1277,5,104,0,0,1277,1278,5,111,0,0,1278,
	1279,5,117,0,0,1279,1280,5,114,0,0,1280,1303,5,115,0,0,1281,1282,5,100,
	0,0,1282,1283,5,97,0,0,1283,1284,5,121,0,0,1284,1303,5,115,0,0,1285,1286,
	5,119,0,0,1286,1287,5,101,0,0,1287,1288,5,101,0,0,1288,1289,5,107,0,0,1289,
	1303,5,115,0,0,1290,1291,5,119,0,0,1291,1292,5,101,0,0,1292,1303,5,105,
	0,0,1293,1294,5,103,0,0,1294,1295,5,119,0,0,1295,1296,5,101,0,0,1296,1303,
	5,105,0,0,1297,1298,5,101,0,0,1298,1299,5,116,0,0,1299,1300,5,104,0,0,1300,
	1301,5,101,0,0,1301,1303,5,114,0,0,1302,1262,1,0,0,0,1302,1269,1,0,0,0,
	1302,1276,1,0,0,0,1302,1281,1,0,0,0,1302,1285,1,0,0,0,1302,1290,1,0,0,0,
	1302,1293,1,0,0,0,1302,1297,1,0,0,0,1303,284,1,0,0,0,1304,1305,5,115,0,
	0,1305,1306,5,97,0,0,1306,1307,5,116,0,0,1307,1308,5,111,0,0,1308,1309,
	5,115,0,0,1309,1310,5,104,0,0,1310,1311,5,105,0,0,1311,1334,5,115,0,0,1312,
	1313,5,115,0,0,1313,1314,5,97,0,0,1314,1315,5,116,0,0,1315,1334,5,115,0,
	0,1316,1317,5,102,0,0,1317,1318,5,105,0,0,1318,1319,5,110,0,0,1319,1320,
	5,110,0,0,1320,1321,5,101,0,0,1321,1334,5,121,0,0,1322,1323,5,98,0,0,1323,
	1324,5,105,0,0,1324,1325,5,116,0,0,1325,1334,5,115,0,0,1326,1327,5,98,0,
	0,1327,1328,5,105,0,0,1328,1329,5,116,0,0,1329,1330,5,99,0,0,1330,1331,
	5,111,0,0,1331,1332,5,105,0,0,1332,1334,5,110,0,0,1333,1304,1,0,0,0,1333,
	1312,1,0,0,0,1333,1316,1,0,0,0,1333,1322,1,0,0,0,1333,1326,1,0,0,0,1334,
	286,1,0,0,0,1335,1336,3,291,145,0,1336,1338,5,46,0,0,1337,1339,7,0,0,0,
	1338,1337,1,0,0,0,1339,1340,1,0,0,0,1340,1338,1,0,0,0,1340,1341,1,0,0,0,
	1341,1343,1,0,0,0,1342,1344,3,293,146,0,1343,1342,1,0,0,0,1343,1344,1,0,
	0,0,1344,288,1,0,0,0,1345,1347,3,291,145,0,1346,1348,3,293,146,0,1347,1346,
	1,0,0,0,1347,1348,1,0,0,0,1348,290,1,0,0,0,1349,1351,7,0,0,0,1350,1349,
	1,0,0,0,1351,1352,1,0,0,0,1352,1350,1,0,0,0,1352,1353,1,0,0,0,1353,1362,
	1,0,0,0,1354,1356,5,95,0,0,1355,1357,7,0,0,0,1356,1355,1,0,0,0,1357,1358,
	1,0,0,0,1358,1356,1,0,0,0,1358,1359,1,0,0,0,1359,1361,1,0,0,0,1360,1354,
	1,0,0,0,1361,1364,1,0,0,0,1362,1360,1,0,0,0,1362,1363,1,0,0,0,1363,292,
	1,0,0,0,1364,1362,1,0,0,0,1365,1367,7,1,0,0,1366,1368,5,45,0,0,1367,1366,
	1,0,0,0,1367,1368,1,0,0,0,1368,1369,1,0,0,0,1369,1370,3,291,145,0,1370,
	294,1,0,0,0,1371,1372,5,105,0,0,1372,1373,5,110,0,0,1373,1391,5,116,0,0,
	1374,1375,5,98,0,0,1375,1376,5,105,0,0,1376,1377,5,103,0,0,1377,1378,5,
	105,0,0,1378,1379,5,110,0,0,1379,1391,5,116,0,0,1380,1381,5,98,0,0,1381,
	1382,5,111,0,0,1382,1383,5,111,0,0,1383,1391,5,108,0,0,1384,1385,5,115,
	0,0,1385,1386,5,116,0,0,1386,1387,5,114,0,0,1387,1388,5,105,0,0,1388,1389,
	5,110,0,0,1389,1391,5,103,0,0,1390,1371,1,0,0,0,1390,1374,1,0,0,0,1390,
	1380,1,0,0,0,1390,1384,1,0,0,0,1391,296,1,0,0,0,1392,1393,5,112,0,0,1393,
	1394,5,117,0,0,1394,1395,5,98,0,0,1395,1396,5,107,0,0,1396,1397,5,101,0,
	0,1397,1409,5,121,0,0,1398,1399,5,115,0,0,1399,1400,5,105,0,0,1400,1409,
	5,103,0,0,1401,1402,5,100,0,0,1402,1403,5,97,0,0,1403,1404,5,116,0,0,1404,
	1405,5,97,0,0,1405,1406,5,115,0,0,1406,1407,5,105,0,0,1407,1409,5,103,0,
	0,1408,1392,1,0,0,0,1408,1398,1,0,0,0,1408,1401,1,0,0,0,1409,298,1,0,0,
	0,1410,1411,5,98,0,0,1411,1412,5,121,0,0,1412,1413,5,116,0,0,1413,1414,
	5,101,0,0,1414,1415,5,115,0,0,1415,300,1,0,0,0,1416,1417,5,98,0,0,1417,
	1418,5,121,0,0,1418,1419,5,116,0,0,1419,1420,5,101,0,0,1420,1421,5,115,
	0,0,1421,1422,1,0,0,0,1422,1428,3,303,151,0,1423,1424,5,98,0,0,1424,1425,
	5,121,0,0,1425,1426,5,116,0,0,1426,1428,5,101,0,0,1427,1416,1,0,0,0,1427,
	1423,1,0,0,0,1428,302,1,0,0,0,1429,1433,7,2,0,0,1430,1432,7,0,0,0,1431,
	1430,1,0,0,0,1432,1435,1,0,0,0,1433,1431,1,0,0,0,1433,1434,1,0,0,0,1434,
	304,1,0,0,0,1435,1433,1,0,0,0,1436,1442,5,34,0,0,1437,1438,5,92,0,0,1438,
	1441,9,0,0,0,1439,1441,8,3,0,0,1440,1437,1,0,0,0,1440,1439,1,0,0,0,1441,
	1444,1,0,0,0,1442,1443,1,0,0,0,1442,1440,1,0,0,0,1443,1445,1,0,0,0,1444,
	1442,1,0,0,0,1445,1457,5,34,0,0,1446,1452,5,39,0,0,1447,1448,5,92,0,0,1448,
	1451,9,0,0,0,1449,1451,8,4,0,0,1450,1447,1,0,0,0,1450,1449,1,0,0,0,1451,
	1454,1,0,0,0,1452,1453,1,0,0,0,1452,1450,1,0,0,0,1453,1455,1,0,0,0,1454,
	1452,1,0,0,0,1455,1457,5,39,0,0,1456,1436,1,0,0,0,1456,1446,1,0,0,0,1457,
	306,1,0,0,0,1458,1459,5,100,0,0,1459,1460,5,97,0,0,1460,1461,5,116,0,0,
	1461,1462,5,101,0,0,1462,1463,5,40,0,0,1463,1464,1,0,0,0,1464,1465,3,305,
	152,0,1465,1466,5,41,0,0,1466,308,1,0,0,0,1467,1468,5,48,0,0,1468,1472,
	7,5,0,0,1469,1471,7,6,0,0,1470,1469,1,0,0,0,1471,1474,1,0,0,0,1472,1470,
	1,0,0,0,1472,1473,1,0,0,0,1473,310,1,0,0,0,1474,1472,1,0,0,0,1475,1476,
	5,116,0,0,1476,1477,5,104,0,0,1477,1478,5,105,0,0,1478,1479,5,115,0,0,1479,
	1480,5,46,0,0,1480,1481,5,97,0,0,1481,1482,5,103,0,0,1482,1491,5,101,0,
	0,1483,1484,5,116,0,0,1484,1485,5,120,0,0,1485,1486,5,46,0,0,1486,1487,
	5,116,0,0,1487,1488,5,105,0,0,1488,1489,5,109,0,0,1489,1491,5,101,0,0,1490,
	1475,1,0,0,0,1490,1483,1,0,0,0,1491,312,1,0,0,0,1492,1493,5,117,0,0,1493,
	1494,5,110,0,0,1494,1495,5,115,0,0,1495,1496,5,97,0,0,1496,1497,5,102,0,
	0,1497,1498,5,101,0,0,1498,1499,5,95,0,0,1499,1500,5,105,0,0,1500,1501,
	5,110,0,0,1501,1541,5,116,0,0,1502,1503,5,117,0,0,1503,1504,5,110,0,0,1504,
	1505,5,115,0,0,1505,1506,5,97,0,0,1506,1507,5,102,0,0,1507,1508,5,101,0,
	0,1508,1509,5,95,0,0,1509,1510,5,98,0,0,1510,1511,5,111,0,0,1511,1512,5,
	111,0,0,1512,1541,5,108,0,0,1513,1514,5,117,0,0,1514,1515,5,110,0,0,1515,
	1516,5,115,0,0,1516,1517,5,97,0,0,1517,1518,5,102,0,0,1518,1519,5,101,0,
	0,1519,1520,5,95,0,0,1520,1521,5,98,0,0,1521,1522,5,121,0,0,1522,1523,5,
	116,0,0,1523,1524,5,101,0,0,1524,1525,5,115,0,0,1525,1527,1,0,0,0,1526,
	1528,3,303,151,0,1527,1526,1,0,0,0,1527,1528,1,0,0,0,1528,1541,1,0,0,0,
	1529,1530,5,117,0,0,1530,1531,5,110,0,0,1531,1532,5,115,0,0,1532,1533,5,
	97,0,0,1533,1534,5,102,0,0,1534,1535,5,101,0,0,1535,1536,5,95,0,0,1536,
	1537,5,98,0,0,1537,1538,5,121,0,0,1538,1539,5,116,0,0,1539,1541,5,101,0,
	0,1540,1492,1,0,0,0,1540,1502,1,0,0,0,1540,1513,1,0,0,0,1540,1529,1,0,0,
	0,1541,314,1,0,0,0,1542,1543,5,105,0,0,1543,1544,5,110,0,0,1544,1545,5,
	116,0,0,1545,1546,1,0,0,0,1546,1547,3,303,151,0,1547,316,1,0,0,0,1548,1549,
	5,117,0,0,1549,1550,5,105,0,0,1550,1551,5,110,0,0,1551,1552,5,116,0,0,1552,
	1553,1,0,0,0,1553,1554,3,303,151,0,1554,318,1,0,0,0,1555,1556,5,102,0,0,
	1556,1557,5,105,0,0,1557,1558,5,120,0,0,1558,1559,5,101,0,0,1559,1560,5,
	100,0,0,1560,1561,1,0,0,0,1561,1562,3,303,151,0,1562,1564,5,120,0,0,1563,
	1565,7,0,0,0,1564,1563,1,0,0,0,1565,1566,1,0,0,0,1566,1564,1,0,0,0,1566,
	1567,1,0,0,0,1567,320,1,0,0,0,1568,1569,5,117,0,0,1569,1570,5,102,0,0,1570,
	1571,5,105,0,0,1571,1572,5,120,0,0,1572,1573,5,101,0,0,1573,1574,5,100,
	0,0,1574,1575,1,0,0,0,1575,1576,3,303,151,0,1576,1578,5,120,0,0,1577,1579,
	7,0,0,0,1578,1577,1,0,0,0,1579,1580,1,0,0,0,1580,1578,1,0,0,0,1580,1581,
	1,0,0,0,1581,322,1,0,0,0,1582,1583,5,116,0,0,1583,1584,5,104,0,0,1584,1585,
	5,105,0,0,1585,1586,5,115,0,0,1586,1587,5,46,0,0,1587,1588,5,97,0,0,1588,
	1589,5,99,0,0,1589,1590,5,116,0,0,1590,1591,5,105,0,0,1591,1592,5,118,0,
	0,1592,1593,5,101,0,0,1593,1594,5,73,0,0,1594,1595,5,110,0,0,1595,1596,
	5,112,0,0,1596,1597,5,117,0,0,1597,1598,5,116,0,0,1598,1599,5,73,0,0,1599,
	1600,5,110,0,0,1600,1601,5,100,0,0,1601,1602,5,101,0,0,1602,1901,5,120,
	0,0,1603,1604,5,116,0,0,1604,1605,5,104,0,0,1605,1606,5,105,0,0,1606,1607,
	5,115,0,0,1607,1608,5,46,0,0,1608,1609,5,97,0,0,1609,1610,5,99,0,0,1610,
	1611,5,116,0,0,1611,1612,5,105,0,0,1612,1613,5,118,0,0,1613,1614,5,101,
	0,0,1614,1615,5,66,0,0,1615,1616,5,121,0,0,1616,1617,5,116,0,0,1617,1618,
	5,101,0,0,1618,1619,5,99,0,0,1619,1620,5,111,0,0,1620,1621,5,100,0,0,1621,
	1901,5,101,0,0,1622,1623,5,116,0,0,1623,1624,5,104,0,0,1624,1625,5,105,
	0,0,1625,1626,5,115,0,0,1626,1627,5,46,0,0,1627,1628,5,99,0,0,1628,1629,
	5,97,0,0,1629,1630,5,116,0,0,1630,1631,5,101,0,0,1631,1632,5,103,0,0,1632,
	1633,5,111,0,0,1633,1634,5,114,0,0,1634,1635,5,121,0,0,1635,1636,5,73,0,
	0,1636,1901,5,100,0,0,1637,1638,5,116,0,0,1638,1639,5,120,0,0,1639,1640,
	5,46,0,0,1640,1641,5,105,0,0,1641,1642,5,110,0,0,1642,1643,5,112,0,0,1643,
	1644,5,117,0,0,1644,1645,5,116,0,0,1645,1646,5,115,0,0,1646,1647,5,46,0,
	0,1647,1648,5,108,0,0,1648,1649,5,101,0,0,1649,1650,5,110,0,0,1650,1651,
	5,103,0,0,1651,1652,5,116,0,0,1652,1901,5,104,0,0,1653,1654,5,116,0,0,1654,
	1655,5,120,0,0,1655,1656,5,46,0,0,1656,1657,5,111,0,0,1657,1658,5,117,0,
	0,1658,1659,5,116,0,0,1659,1660,5,112,0,0,1660,1661,5,117,0,0,1661,1662,
	5,116,0,0,1662,1663,5,115,0,0,1663,1664,5,46,0,0,1664,1665,5,108,0,0,1665,
	1666,5,101,0,0,1666,1667,5,110,0,0,1667,1668,5,103,0,0,1668,1669,5,116,
	0,0,1669,1901,5,104,0,0,1670,1671,5,116,0,0,1671,1672,5,120,0,0,1672,1673,
	5,46,0,0,1673,1674,5,118,0,0,1674,1675,5,101,0,0,1675,1676,5,114,0,0,1676,
	1677,5,115,0,0,1677,1678,5,105,0,0,1678,1679,5,111,0,0,1679,1901,5,110,
	0,0,1680,1681,5,116,0,0,1681,1682,5,120,0,0,1682,1683,5,46,0,0,1683,1684,
	5,108,0,0,1684,1685,5,111,0,0,1685,1686,5,99,0,0,1686,1687,5,107,0,0,1687,
	1688,5,116,0,0,1688,1689,5,105,0,0,1689,1690,5,109,0,0,1690,1901,5,101,
	0,0,1691,1692,5,109,0,0,1692,1693,5,115,0,0,1693,1694,5,103,0,0,1694,1695,
	5,46,0,0,1695,1696,5,115,0,0,1696,1697,5,101,0,0,1697,1698,5,110,0,0,1698,
	1699,5,100,0,0,1699,1700,5,101,0,0,1700,1901,5,114,0,0,1701,1702,5,109,
	0,0,1702,1703,5,115,0,0,1703,1704,5,103,0,0,1704,1705,5,46,0,0,1705,1706,
	5,118,0,0,1706,1707,5,97,0,0,1707,1708,5,108,0,0,1708,1709,5,117,0,0,1709,
	1901,5,101,0,0,1710,1711,5,109,0,0,1711,1712,5,115,0,0,1712,1713,5,103,
	0,0,1713,1714,5,46,0,0,1714,1715,5,115,0,0,1715,1716,5,105,0,0,1716,1901,
	5,103,0,0,1717,1718,5,109,0,0,1718,1719,5,115,0,0,1719,1720,5,103,0,0,1720,
	1721,5,46,0,0,1721,1722,5,100,0,0,1722,1723,5,97,0,0,1723,1724,5,116,0,
	0,1724,1901,5,97,0,0,1725,1726,5,116,0,0,1726,1727,5,120,0,0,1727,1728,
	5,46,0,0,1728,1729,5,111,0,0,1729,1730,5,114,0,0,1730,1731,5,105,0,0,1731,
	1732,5,103,0,0,1732,1733,5,105,0,0,1733,1901,5,110,0,0,1734,1735,5,116,
	0,0,1735,1736,5,120,0,0,1736,1737,5,46,0,0,1737,1738,5,103,0,0,1738,1739,
	5,97,0,0,1739,1740,5,115,0,0,1740,1741,5,112,0,0,1741,1742,5,114,0,0,1742,
	1743,5,105,0,0,1743,1744,5,99,0,0,1744,1901,5,101,0,0,1745,1746,5,98,0,
	0,1746,1747,5,108,0,0,1747,1748,5,111,0,0,1748,1749,5,99,0,0,1749,1750,
	5,107,0,0,1750,1751,5,46,0,0,1751,1752,5,99,0,0,1752,1753,5,104,0,0,1753,
	1754,5,97,0,0,1754,1755,5,105,0,0,1755,1756,5,110,0,0,1756,1757,5,105,0,
	0,1757,1901,5,100,0,0,1758,1759,5,98,0,0,1759,1760,5,108,0,0,1760,1761,
	5,111,0,0,1761,1762,5,99,0,0,1762,1763,5,107,0,0,1763,1764,5,46,0,0,1764,
	1765,5,110,0,0,1765,1766,5,117,0,0,1766,1767,5,109,0,0,1767,1768,5,98,0,
	0,1768,1769,5,101,0,0,1769,1901,5,114,0,0,1770,1771,5,98,0,0,1771,1772,
	5,108,0,0,1772,1773,5,111,0,0,1773,1774,5,99,0,0,1774,1775,5,107,0,0,1775,
	1776,5,46,0,0,1776,1777,5,116,0,0,1777,1778,5,105,0,0,1778,1779,5,109,0,
	0,1779,1780,5,101,0,0,1780,1781,5,115,0,0,1781,1782,5,116,0,0,1782,1783,
	5,97,0,0,1783,1784,5,109,0,0,1784,1901,5,112,0,0,1785,1786,5,98,0,0,1786,
	1787,5,108,0,0,1787,1788,5,111,0,0,1788,1789,5,99,0,0,1789,1790,5,107,0,
	0,1790,1791,5,46,0,0,1791,1792,5,100,0,0,1792,1793,5,105,0,0,1793,1794,
	5,102,0,0,1794,1795,5,102,0,0,1795,1796,5,105,0,0,1796,1797,5,99,0,0,1797,
	1798,5,117,0,0,1798,1799,5,108,0,0,1799,1800,5,116,0,0,1800,1901,5,121,
	0,0,1801,1802,5,98,0,0,1802,1803,5,108,0,0,1803,1804,5,111,0,0,1804,1805,
	5,99,0,0,1805,1806,5,107,0,0,1806,1807,5,46,0,0,1807,1808,5,115,0,0,1808,
	1809,5,105,0,0,1809,1810,5,122,0,0,1810,1901,5,101,0,0,1811,1812,5,98,0,
	0,1812,1813,5,108,0,0,1813,1814,5,111,0,0,1814,1815,5,99,0,0,1815,1816,
	5,107,0,0,1816,1817,5,46,0,0,1817,1818,5,116,0,0,1818,1819,5,111,0,0,1819,
	1820,5,116,0,0,1820,1821,5,97,0,0,1821,1822,5,108,0,0,1822,1823,5,70,0,
	0,1823,1824,5,101,0,0,1824,1825,5,101,0,0,1825,1901,5,115,0,0,1826,1827,
	5,98,0,0,1827,1828,5,108,0,0,1828,1829,5,111,0,0,1829,1830,5,99,0,0,1830,
	1831,5,107,0,0,1831,1832,5,46,0,0,1832,1833,5,98,0,0,1833,1834,5,97,0,0,
	1834,1835,5,115,0,0,1835,1836,5,101,0,0,1836,1837,5,102,0,0,1837,1838,5,
	101,0,0,1838,1901,5,101,0,0,1839,1840,5,98,0,0,1840,1841,5,108,0,0,1841,
	1842,5,111,0,0,1842,1843,5,99,0,0,1843,1844,5,107,0,0,1844,1845,5,46,0,
	0,1845,1846,5,98,0,0,1846,1847,5,108,0,0,1847,1848,5,111,0,0,1848,1849,
	5,98,0,0,1849,1850,5,98,0,0,1850,1851,5,97,0,0,1851,1852,5,115,0,0,1852,
	1853,5,101,0,0,1853,1854,5,102,0,0,1854,1855,5,101,0,0,1855,1901,5,101,
	0,0,1856,1857,5,98,0,0,1857,1858,5,108,0,0,1858,1859,5,111,0,0,1859,1860,
	5,99,0,0,1860,1861,5,107,0,0,1861,1862,5,46,0,0,1862,1863,5,103,0,0,1863,
	1864,5,97,0,0,1864,1865,5,115,0,0,1865,1866,5,108,0,0,1866,1867,5,105,0,
	0,1867,1868,5,109,0,0,1868,1869,5,105,0,0,1869,1901,5,116,0,0,1870,1871,
	5,98,0,0,1871,1872,5,108,0,0,1872,1873,5,111,0,0,1873,1874,5,99,0,0,1874,
	1875,5,107,0,0,1875,1876,5,46,0,0,1876,1877,5,112,0,0,1877,1878,5,114,0,
	0,1878,1879,5,101,0,0,1879,1880,5,118,0,0,1880,1881,5,114,0,0,1881,1882,
	5,97,0,0,1882,1883,5,110,0,0,1883,1884,5,100,0,0,1884,1885,5,97,0,0,1885,
	1901,5,111,0,0,1886,1887,5,98,0,0,1887,1888,5,108,0,0,1888,1889,5,111,0,
	0,1889,1890,5,99,0,0,1890,1891,5,107,0,0,1891,1892,5,46,0,0,1892,1893,5,
	99,0,0,1893,1894,5,111,0,0,1894,1895,5,105,0,0,1895,1896,5,110,0,0,1896,
	1897,5,98,0,0,1897,1898,5,97,0,0,1898,1899,5,115,0,0,1899,1901,5,101,0,
	0,1900,1582,1,0,0,0,1900,1603,1,0,0,0,1900,1622,1,0,0,0,1900,1637,1,0,0,
	0,1900,1653,1,0,0,0,1900,1670,1,0,0,0,1900,1680,1,0,0,0,1900,1691,1,0,0,
	0,1900,1701,1,0,0,0,1900,1710,1,0,0,0,1900,1717,1,0,0,0,1900,1725,1,0,0,
	0,1900,1734,1,0,0,0,1900,1745,1,0,0,0,1900,1758,1,0,0,0,1900,1770,1,0,0,
	0,1900,1785,1,0,0,0,1900,1801,1,0,0,0,1900,1811,1,0,0,0,1900,1826,1,0,0,
	0,1900,1839,1,0,0,0,1900,1856,1,0,0,0,1900,1870,1,0,0,0,1900,1886,1,0,0,
	0,1901,324,1,0,0,0,1902,1903,5,117,0,0,1903,1904,5,110,0,0,1904,1905,5,
	105,0,0,1905,1906,5,99,0,0,1906,1907,5,111,0,0,1907,1908,5,100,0,0,1908,
	1909,5,101,0,0,1909,1910,1,0,0,0,1910,1911,3,305,152,0,1911,326,1,0,0,0,
	1912,1913,5,104,0,0,1913,1914,5,101,0,0,1914,1915,5,120,0,0,1915,1916,1,
	0,0,0,1916,1920,5,34,0,0,1917,1919,7,7,0,0,1918,1917,1,0,0,0,1919,1922,
	1,0,0,0,1920,1918,1,0,0,0,1920,1921,1,0,0,0,1921,1923,1,0,0,0,1922,1920,
	1,0,0,0,1923,1937,5,34,0,0,1924,1925,5,104,0,0,1925,1926,5,101,0,0,1926,
	1927,5,120,0,0,1927,1928,1,0,0,0,1928,1932,5,39,0,0,1929,1931,7,7,0,0,1930,
	1929,1,0,0,0,1931,1934,1,0,0,0,1932,1930,1,0,0,0,1932,1933,1,0,0,0,1933,
	1935,1,0,0,0,1934,1932,1,0,0,0,1935,1937,5,39,0,0,1936,1912,1,0,0,0,1936,
	1924,1,0,0,0,1937,328,1,0,0,0,1938,1939,5,46,0,0,1939,1940,5,118,0,0,1940,
	1941,5,97,0,0,1941,1942,5,108,0,0,1942,1943,5,117,0,0,1943,1944,5,101,0,
	0,1944,1945,1,0,0,0,1945,1946,4,164,0,0,1946,330,1,0,0,0,1947,1948,5,46,
	0,0,1948,1949,5,108,0,0,1949,1950,5,101,0,0,1950,1951,5,110,0,0,1951,1952,
	5,103,0,0,1952,1953,5,116,0,0,1953,1954,5,104,0,0,1954,1955,1,0,0,0,1955,
	1956,4,165,1,0,1956,332,1,0,0,0,1957,1958,5,46,0,0,1958,1959,5,112,0,0,
	1959,1960,5,117,0,0,1960,1961,5,115,0,0,1961,1962,5,104,0,0,1962,1963,1,
	0,0,0,1963,1964,4,166,2,0,1964,334,1,0,0,0,1965,1966,5,46,0,0,1966,1967,
	5,112,0,0,1967,1968,5,111,0,0,1968,1969,5,112,0,0,1969,1970,1,0,0,0,1970,
	1971,4,167,3,0,1971,336,1,0,0,0,1972,1973,5,46,0,0,1973,1974,5,115,0,0,
	1974,1975,5,112,0,0,1975,1976,5,108,0,0,1976,1977,5,105,0,0,1977,1978,5,
	116,0,0,1978,1979,1,0,0,0,1979,1980,4,168,4,0,1980,338,1,0,0,0,1981,1982,
	5,46,0,0,1982,1983,5,115,0,0,1983,1984,5,108,0,0,1984,1985,5,105,0,0,1985,
	1986,5,99,0,0,1986,1987,5,101,0,0,1987,1988,1,0,0,0,1988,1989,4,169,5,0,
	1989,340,1,0,0,0,1990,1991,5,46,0,0,1991,1992,5,100,0,0,1992,1993,5,101,
	0,0,1993,1994,5,108,0,0,1994,1995,5,101,0,0,1995,1996,5,116,0,0,1996,1997,
	5,101,0,0,1997,1998,1,0,0,0,1998,1999,4,170,6,0,1999,342,1,0,0,0,2000,2001,
	5,46,0,0,2001,2002,5,99,0,0,2002,2003,5,111,0,0,2003,2004,5,100,0,0,2004,
	2005,5,101,0,0,2005,2006,1,0,0,0,2006,2007,4,171,7,0,2007,344,1,0,0,0,2008,
	2009,5,46,0,0,2009,2010,5,99,0,0,2010,2011,5,111,0,0,2011,2012,5,100,0,
	0,2012,2013,5,101,0,0,2013,2014,5,104,0,0,2014,2015,5,97,0,0,2015,2016,
	5,115,0,0,2016,2017,5,104,0,0,2017,2018,1,0,0,0,2018,2019,4,172,8,0,2019,
	346,1,0,0,0,2020,2021,5,46,0,0,2021,2022,5,108,0,0,2022,2023,5,111,0,0,
	2023,2024,5,99,0,0,2024,2025,5,107,0,0,2025,2026,5,105,0,0,2026,2027,5,
	110,0,0,2027,2028,5,103,0,0,2028,2029,5,66,0,0,2029,2030,5,121,0,0,2030,
	2031,5,116,0,0,2031,2032,5,101,0,0,2032,2033,5,99,0,0,2033,2034,5,111,0,
	0,2034,2035,5,100,0,0,2035,2036,5,101,0,0,2036,2037,1,0,0,0,2037,2038,4,
	173,9,0,2038,348,1,0,0,0,2039,2040,5,46,0,0,2040,2041,5,116,0,0,2041,2042,
	5,111,0,0,2042,2043,5,107,0,0,2043,2044,5,101,0,0,2044,2045,5,110,0,0,2045,
	2046,5,67,0,0,2046,2047,5,97,0,0,2047,2048,5,116,0,0,2048,2049,5,101,0,
	0,2049,2050,5,103,0,0,2050,2051,5,111,0,0,2051,2052,5,114,0,0,2052,2053,
	5,121,0,0,2053,2054,1,0,0,0,2054,2055,4,174,10,0,2055,350,1,0,0,0,2056,
	2057,5,46,0,0,2057,2058,5,110,0,0,2058,2059,5,102,0,0,2059,2060,5,116,0,
	0,2060,2061,5,67,0,0,2061,2062,5,111,0,0,2062,2063,5,109,0,0,2063,2064,
	5,109,0,0,2064,2065,5,105,0,0,2065,2066,5,116,0,0,2066,2067,5,109,0,0,2067,
	2068,5,101,0,0,2068,2069,5,110,0,0,2069,2070,5,116,0,0,2070,2071,1,0,0,
	0,2071,2072,4,175,11,0,2072,352,1,0,0,0,2073,2074,5,46,0,0,2074,2075,5,
	116,0,0,2075,2076,5,111,0,0,2076,2077,5,107,0,0,2077,2078,5,101,0,0,2078,
	2079,5,110,0,0,2079,2080,5,65,0,0,2080,2081,5,109,0,0,2081,2082,5,111,0,
	0,2082,2083,5,117,0,0,2083,2084,5,110,0,0,2084,2085,5,116,0,0,2085,2086,
	1,0,0,0,2086,2087,4,176,12,0,2087,354,1,0,0,0,2088,2089,5,46,0,0,2089,2090,
	5,111,0,0,2090,2091,5,117,0,0,2091,2092,5,116,0,0,2092,2093,5,112,0,0,2093,
	2094,5,111,0,0,2094,2095,5,105,0,0,2095,2096,5,110,0,0,2096,2097,5,116,
	0,0,2097,2098,5,84,0,0,2098,2099,5,114,0,0,2099,2100,5,97,0,0,2100,2101,
	5,110,0,0,2101,2102,5,115,0,0,2102,2103,5,97,0,0,2103,2104,5,99,0,0,2104,
	2105,5,116,0,0,2105,2106,5,105,0,0,2106,2107,5,111,0,0,2107,2108,5,110,
	0,0,2108,2109,5,72,0,0,2109,2110,5,97,0,0,2110,2111,5,115,0,0,2111,2112,
	5,104,0,0,2112,2113,1,0,0,0,2113,2114,4,177,13,0,2114,356,1,0,0,0,2115,
	2116,5,46,0,0,2116,2117,5,111,0,0,2117,2118,5,117,0,0,2118,2119,5,116,0,
	0,2119,2120,5,112,0,0,2120,2121,5,111,0,0,2121,2122,5,105,0,0,2122,2123,
	5,110,0,0,2123,2124,5,116,0,0,2124,2125,5,73,0,0,2125,2126,5,110,0,0,2126,
	2127,5,100,0,0,2127,2128,5,101,0,0,2128,2129,5,120,0,0,2129,2130,1,0,0,
	0,2130,2131,4,178,14,0,2131,358,1,0,0,0,2132,2133,5,46,0,0,2133,2134,5,
	117,0,0,2134,2135,5,110,0,0,2135,2136,5,108,0,0,2136,2137,5,111,0,0,2137,
	2138,5,99,0,0,2138,2139,5,107,0,0,2139,2140,5,105,0,0,2140,2141,5,110,0,
	0,2141,2142,5,103,0,0,2142,2143,5,66,0,0,2143,2144,5,121,0,0,2144,2145,
	5,116,0,0,2145,2146,5,101,0,0,2146,2147,5,99,0,0,2147,2148,5,111,0,0,2148,
	2149,5,100,0,0,2149,2150,5,101,0,0,2150,2151,1,0,0,0,2151,2152,4,179,15,
	0,2152,360,1,0,0,0,2153,2154,5,46,0,0,2154,2155,5,115,0,0,2155,2156,5,101,
	0,0,2156,2157,5,113,0,0,2157,2158,5,117,0,0,2158,2159,5,101,0,0,2159,2160,
	5,110,0,0,2160,2161,5,99,0,0,2161,2162,5,101,0,0,2162,2163,5,78,0,0,2163,
	2164,5,117,0,0,2164,2165,5,109,0,0,2165,2166,5,98,0,0,2166,2167,5,101,0,
	0,2167,2168,5,114,0,0,2168,2169,1,0,0,0,2169,2170,4,180,16,0,2170,362,1,
	0,0,0,2171,2175,7,8,0,0,2172,2174,7,9,0,0,2173,2172,1,0,0,0,2174,2177,1,
	0,0,0,2175,2173,1,0,0,0,2175,2176,1,0,0,0,2176,364,1,0,0,0,2177,2175,1,
	0,0,0,2178,2180,7,10,0,0,2179,2178,1,0,0,0,2180,2181,1,0,0,0,2181,2179,
	1,0,0,0,2181,2182,1,0,0,0,2182,2183,1,0,0,0,2183,2184,6,182,0,0,2184,366,
	1,0,0,0,2185,2186,5,47,0,0,2186,2187,5,42,0,0,2187,2191,1,0,0,0,2188,2190,
	9,0,0,0,2189,2188,1,0,0,0,2190,2193,1,0,0,0,2191,2192,1,0,0,0,2191,2189,
	1,0,0,0,2192,2194,1,0,0,0,2193,2191,1,0,0,0,2194,2195,5,42,0,0,2195,2196,
	5,47,0,0,2196,2197,1,0,0,0,2197,2198,6,183,1,0,2198,368,1,0,0,0,2199,2200,
	5,47,0,0,2200,2201,5,47,0,0,2201,2205,1,0,0,0,2202,2204,8,11,0,0,2203,2202,
	1,0,0,0,2204,2207,1,0,0,0,2205,2203,1,0,0,0,2205,2206,1,0,0,0,2206,2208,
	1,0,0,0,2207,2205,1,0,0,0,2208,2209,6,184,1,0,2209,370,1,0,0,0,37,0,1237,
	1243,1249,1260,1302,1333,1340,1343,1347,1352,1358,1362,1367,1390,1408,1427,
	1433,1440,1442,1450,1452,1456,1472,1490,1527,1540,1566,1580,1900,1920,1932,
	1936,2175,2181,2191,2205,2,6,0,0,0,1,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!SolidCashLexer.__ATN) {
			SolidCashLexer.__ATN = new ATNDeserializer().deserialize(SolidCashLexer._serializedATN);
		}

		return SolidCashLexer.__ATN;
	}


	static DecisionsToDFA = SolidCashLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}