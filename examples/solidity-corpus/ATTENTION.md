# Items requiring user attention (autonomous grind, 2026-07-06+)

Collected during non-stop corpus grinding. Each item is a decision, soundness caveat, or deferred feature
that the user should review. Grinding continues past these with a documented default choice.

## Soundness caveats (accepted defaults, flag for review)

- **erc7201 -> uint256(sha256(id))** (82e03969): NOT byte-identical to Ethereum's keccak-based ERC-7201 slot.
  Sound only for internal, same-contract slot derivation; a cross-chain contract relying on the exact Ethereum
  slot would diverge. Warned at compile time. DEFAULT: alias accepted (matches the keccak256->sha256 policy).
- **payable(bytes) / payable(this)** (b2830cc5): `payable` is a no-op cosmetic distinction on BCH (every address
  receives value), so `bytes -> address` is allowed regardless of the payable flag. Over-accepts vs solc's
  stricter payable typing, but the resulting address is identical. DEFAULT: accepted.
- **bytes calldata element write**: rejected (matches solc's read-only calldata), though on BCH there is no
  read-only calldata (all data is on-stack). Kept the rejection to match solc. Reconsider if a port needs it.

## FIXED 2026-07-07 (public function called internally with a used return) - commit 721c8e14

Was: calling a PUBLIC function INTERNALLY (bare `f()`) with a used return value left extra stack items. ROOT
CAUSE (found): the internal-call subroutine skips the synthetic `__internal__returnOutputIdx` param during setup
(unused for a raw return), and a function-pointer call never pushes it - but a DIRECT internal call DID push it
(TypeCheck's forwardInternalReturnOutputIdx forwarded it for the arity check). The subroutine never cleaned it ->
leak. FIX: visitUserFunctionCall no longer pushes the returnOutputIdx arg (matching the subroutine skip + the
function-pointer path). VM-verified single/chained/multi-return + public overloads. This UNBLOCKED sound public
overloads and the function-pointer-ABI corpus files (which call public functions internally). The suspected "VOID
public function called internally still fails (OP_SPLIT on empty)" sub-issue was a FALSE ALARM: it reproduced only
because the test used a plain UTXO for a STATEFUL contract (whose entry covenant reads the state NFT commitment - a
32-byte split that fails on an absent NFT). With a proper state NFT (setupStatefulUtxos) a void public helper called
internally in a stateful contract runs correctly - guarded in solidcash/test/PublicInternalCall.test.ts. NO
remaining void-internal-call bug. Anchor: GenerateTargetTraversal visitUserFunctionCall + visitReturn raw-return.

## Deferred features (feature-scale, not yet done)

- **abicoder `msg.data` / `abi.decode(msg.data[4:], ..)` (DEFERRED - revisit, NOT fundamental):** my first pass
  called this fundamental; it is NOT. msg.data in a REGULAR (non-fallback) function fails only because the
  redeemPushSize reconstruction is threaded into the fallback path alone (regular entry functions + their
  subroutine forms never push __internal__redeemPushSize). TWO sound angles were dismissed too fast:
  (A) `return msg.data` / `keccak256(msg.data)` in a regular function is a real, SOUND value on BCH
  (OP_INPUTBYTECODE + redeemPushSize reconstructs the input's unlocking bytecode) - it just needs redeemPushSize
  threaded into regular entry functions + their internal-call subroutines (same pre-populate as
  emitEntryPointFunctionDefine ~1208, missing in emitFunctionDefine).
  (B) `abi.decode(msg.data[k : k + N*32], (types))` on a function's OWN calldata == the function's DECLARED
  params - the values are ALREADY on the stack, so a param-aligned msg.data slice/decode can DESUGAR straight to
  the declared params (no EVM-ABI byte decode, no reconstruction). e.g. abi_decode_slice.sol: `f(uint a,uint b)`
  decodes `msg.data[4:]`->(a,b), `msg.data[4:4+32]`->a, `msg.data[4+32:4+64]`->b. A pre-semantic desugar keyed on
  (msg.data slice with constant param-aligned bounds) -> the matching declared param(s) is byte-sound.
  The genuinely-harder remainder = abi.decode/encode of COMPLEX types (dynamic arrays / structs) THROUGH msg.data
  (EVM-ABI memory layout). `abi.encodeWithSelector` string->bytes4 (the clean slice) is DONE (ee49a0c8, +5).
- **Whole-struct-to-mapping copy `m[k] = s`** and **state-flattened struct array-field write `s.a = x`**:
  in the parallel agent's mapping-struct flattening area. `s.a = x` is byte-sound + trivially addable but +0
  alone (multi-wall on `m[k] = s`). Deferred to avoid a 0-yield change in the contested area.
- **Modifiers with local variables**: `VariableRedefinition` + undefined-symbol clusters involve modifier
  inlining (a modifier local colliding with a function local, or `function f() public m(x)` modifier calls).
  Feature area with uncertain scope - not yet investigated deeply.

## Robustness edges (synthetic, no corpus hit)

- **`this.<unsynthesized-getter>()` codegen crash**: calling a public getter we do NOT synthesize (enum / 2D-array
  / struct public vars) via `this.x(args)` reaches codegen and crashes in encodeDataPush ("reading length")
  instead of a clean error. Needs a guard in the `this.x(args)` call-resolution when no getter/fn matches.

## Fundamental walls (confirmed out of scope for single-file compile)

Yul EVM-memory/storage/calldata model (offset/length, variable-offset mstore/mload), genuine EVM signedness
(int+uint mixing, solc rejects too) + fixed-point, external-call-target-must-be-param + deploy-then-call,
runtime function-pointer `.selector`, ABIEncoderV2 calldata structs, gnosis `using Math` circular-import,
super/C3 inheritance, multifile symbol resolution.

## Deferred (added during autonomous grind)

- **2D/nested array element delete + increment** (`delete x[3][2]`, `s.a[0][1]++`, `m.a[0][1]++`): ~5 files. The
  nested-array write desugar (DesugarNestedArrayWrite) handles `a[i][j] = v` but delete/increment on a nested
  element are not routed through it. In the parallel agent's nested-array area - deferred.

- **abi.decode with contract types** (`abi.decode(x, (O))` / `(O[])`): abi.decode's schema rejects a contract type
  ("Unsupported type O"); the array form types-mismatches (O[] vs address[]). ~2 files. Contract-as-address in the
  abi.decode schema + return-type compat - deferred (deeper schema change).

- **Array slices on non-bytes arrays** (`int[] b[start:end]`, ~10 files): bytes slices work; array slices need
  element-width offset-scaling + fixed-width-element gate + calldata-array blob-framing care. Deferred (representation
  subtleties). Omitted-bound slices DONE for bytes.
- **Tuple for-init** (`for((uint x, uint y) = (0,1); ..)`, ~2 files): forInit lacks a tuple-declaration form.

## DONE 2026-07-07 (was in this list, now shipped + VM-verified, 3436->3495)

- **Array slices on non-bytes arrays** DONE (86247db3, +17): visitSlice codegen for fixed-width ArrayType elements,
  VM-verified (ArraySlice.test). Struct-element arrays correctly rejected.
- **Computed array dimension** DONE (509cb858, +17): grammar `typeName '[' expression? ']'` + AstBuilder const-eval.
  The feared ANTLR OOM did NOT materialize (dimension expression is `]`-bounded; no ambiguity warnings). Bigger yield
  than the "~3 small" estimate (computed dims appear widely). Non-const dim = clean ParseError.
- **Inherited modifier override + event/error overload** DONE (092de2a6, +18): false-collision bug fix.
- **Modifier local vars per application** DONE (5f0f78b0, +5): alpha-rename, VM-verified.
- **Bare block statements `{ }`** DONE (70d7bfb8, +11): nested scopes, VM-verified. NOTE: a block local shadowing a
  LIVE outer local stays REJECTED (codegen slots by name -> would miscompile; tried allowing it, VM-proved unsound,
  reverted). Sound accept needs alpha-renaming the shadow like modifier locals (deferred, ~3-5 files, low yield).

## Remaining tractable-but-complex veins (need your greenlight / VM verification)

At 3495/4876 the CLEAN veins are RE-exhausted. What remains, honest verdicts from this session's scan:

- **Free functions** already WORK (grammar freeFunctionDefinition + SourceFileNode.freeFunctions + injection). The
  ~20 "free function" parse-fails actually fail on their BODIES: bare tuple/function-reference expression statements
  (`(abi.encode, "");`, `free1;`) = the reverted bare-expr-statement-for-tuples + function-pointer walls. NOT a
  free-function gap.
- **Tuple for-init** (`for((uint x, uint y) = (0,1); ..)`, ~2-3 files): forInit needs a tuple-destructure alt.
- **Soft keywords as identifiers** (`enum error {}`, `contract transient {}`, `function fallback()`, ~10-15 files):
  needs anyIdentifier extended + used for enum/contract/struct/type names. Ambiguity risk (transient/fallback/layout
  collide with their keyword uses); some are solc-warning/negative edge cases. Fiddly, low confidence.
- **Scientific-notation decimal mantissa / negative exponent** (`2.5e10`, `200e-2`, ~1-3 files): lexer handles
  integer-mantissa `2e10` but not decimal-mantissa or `e-N`; interacts with fixed-point. Small/fiddly.
- **Sound live-outer-local shadow** (~3-5 files, most also fail on assembly/activation): alpha-rename the shadow.
- **abi.decode with contract types** / **nested-array element delete+increment** / **public struct getter tuples**
  / **whole-struct-to-mapping copy `m[k]=s`** / **no-arg struct-array push `Data[] d; d.push()`** (element type
  resolves undefined, ~2 files): parallel agent's flattening/struct area or need schema work.

## Fundamental (need EVM features BCH lacks - would be research-level or unsound)
Function-pointer ABI (function-type params, fun.selector/.address, array-of-function-pointers - dominate the
remaining parse `(`/`memory`/FunctionTypeNotEncodable clusters), genuine int+uint signedness (solc rejects too),
fixed-point (5.2), external-call-on-array-element, deploy-then-call `new C().m()`, ABIEncoderV2 calldata structs,
super/C3, Yul EVM-memory/storage/calldata, multifile symbols, gnosis circular-import.

## 2026-07-19 re-survey of the top FAIL buckets (scorecard 4014/4876; memory-model unification is corpus-neutral)

Context: the memory-model primitive-lowering unification (`bd9822ee` + `f1445136`, LowerMemoryModel/
LowerInlineAssembly delegate to `YulMemPrimitives`) is BYTE-IDENTICAL - a per-file corpus diff vs the pre-change
baseline was 0 OK<->FAIL / 0 error drift across 4876. So the inline-assembly/memory FAIL buckets below are unchanged
by it; they are pre-existing and fundamental. Re-bucketed the current top FAILs to confirm no clean sound win remains:

- **UnsupportedInlineAssembly (71) - CORRECTED 2026-07-19: NOT wholesale fundamental; the storage-slot SYSTEM is
  grindable (user steer).** BCH assigns EVM-parity storage slots (keccak/erc7201 + P3/P4 layout, conformance-tested),
  so slot-addressed assembly has a sound model. Sub-buckets: `.slot`/`.offset` on a state var or a storage-pointer
  local (ARRAY pointer landed 2026-07-19 `6125c53a`); `sstore`/`sload` to a declared scalar / packed slot / literal
  slot ALREADY WORK; the mapping-keccak-slot idiom routes to the high-level mapping (P4). LANDED 2026-07-19 (VM-proven incl. high-bit values, corpus 0-regress): array storage-pointer `.slot`/`.offset`
  `6125c53a`; UDVT-int (`type T is intN`) slot fields `f67b4f91` (unwrap-read/wrap-write + pack by underlying width;
  `dirty_uint8_read` +1; sound because int truncation `uintN(word)`=word mod 2^N has NO byte cast); dynamic-ARRAY
  `.slot` READ `36dc743e` (sload=length register; WRITE/resize fail-closed).
  **KEY: bytesN slot fields VIA THE TWO'S-COMPLEMENT TRICK (user steer) - sub-word DONE `2f40c4f1`.** First naive
  attempt (`2b685b3c` bytes32) was UNSOUND and REVERTED (`17e7a36b`): a bare `bytesN(uint)` cast goes through
  OP_NUM2BIN = sign-magnitude, so `uint256(bytesN(x))!=x` for a high-bit value (VM-caught: bytes2 on 0xaaaa, bytes32
  on 0xff00..00; my first test used only low values 0x1234 and missed it). FIX (reuse the ABI-parity trick
  emitEvmWordFromUint): write = `bytes(N+1)(word)[0:N]` (NUM2BIN to N+1 bytes fits a positive value, drop the sign
  byte); read = prepend a 0x00 byte before uint256/BIN2NUM (read unsigned). Now ALL bytesN (bytes1..bytes32) +
  UDVT-over-bytes round-trip HIGH-BIT values (VM-proven: mixed slot 0xccccbbbbaaaa `2f40c4f1`, bytes32 0xff..00
  `cbe2f745`); `dirty_slot` compiles, corpus +2 (4027). bytes32 write splits the word into two bytes16 halves (each
  via the N=16 trick) + concat since NUM2BIN(33) isn't a valid bytesN cast; read prepends 0x00 then uint256.
  REMAINING gaps: (a) VARIABLE-WIDTH slot fields - address AND dynamic bytes/string (user-corrected: NOT "address
  overflows the slot = fundamental"). A BCH address is variable-length locking bytecode (25B p2pkh / 35B p2sh32,
  framed like `bytes` per isChunkPackableElementType); dynamic bytes/string are variable too. A >32-byte value is not
  fundamental - it SPILLS (fixed composites take consecutive slots) or CHUNKS (dynamic values). A slot field for these
  needs the dynamic-value slot model (EVM length-slot + keccak data, or a BCH chunk), NOT the fixed int-word cast - so
  address/bytes/string slot fields are ONE not-yet-implemented bucket (fail-closed, verified, no silent miscompile).
  DESIGN to move address OUT of this bucket: rescope address to BOUNDED bytes (35B ceiling for p2pkh/p2sh32) so it
  becomes a fixed 2-word field + packs inline in the 128B commitment - spec + address-keyed-mapping soundness in
  docs/bounded-address.md (key preimage = canonical sha256(lbc), must round-trip exact; ceiling fail-closed).
  (The 20-byte stateVarByteWidth for address is EVM slot-LAYOUT parity for neighbour packing, not the value's width.);
  (a2) COMPOSITE (struct/fixed-array) SUB-SLOT field reads - the layout is EVM-exact (64B value = slots [p, p+1], next
  var at p+2, VM-verified) but `sload(p+i)`/`sstore(p+i)` on a composite's own sub-slots FAIL CLOSED (`33765964` -
  was a silent __evm_storage read, now caught by a compositeRanges check; mapping p+i -> the actual struct field is a
  future feature); (b) dynamic-array RESIZE (`sstore(a.slot,n)`)
  + element slots (`sstore(keccak256(0,32)+i, v)`) = array copy/delete (`array/*`), deep; (c) EVM transient storage +
  sparse/computed raw slots with no declared var (correctly fail-closed),
  `tstore`/`tload` (no tx-scoped storage). 6 = calldata `.offset`/`.length`: `.length` WORKS; `.offset` applies only
  to DYNAMIC calldata params (bytes/string/array) whose head/tail our one-word-per-param model
  (`selector ++ bytes32(p_i)`) can't represent - NOT fundamental (the ABI encoders exist, user's point), but needs
  the calldata model rebuilt on real ABI head/tail encoding, a substantial + delicate change (must keep
  `calldataload`/`calldatacopy`/`calldatasize` consistent). 7 = Yul user-`function` defs (recursion not in Script).
  2 = fn-ptr `.selector`. So: storage SYSTEM grindable incrementally; calldata dynamic-`.offset` = scoped model work.
- **ParseError (273).** Top slices: erc7201 non-literal namespace (16, niche); `mapping(K=>V)[]` array-of-mappings
  type (14+, PARSEABLE but BCH cannot soundly store an array of mappings -> grammar fix alone just moves the failure
  downstream, so not a real win); `.push`/`.pop`/`.delete` cluster (~38, mostly ref-returning `push()` = documented
  wall needing reference semantics); `f()()` call-of-call + deeply nested `function()->function()` types (deep);
  tuple-from-ternary / chained-tuple-assign (our own semantic rejections). ONE trivial-but-low-value lead: bare
  `data.pop;` / `data.push;` (no parens) is a Solidity no-op statement we reject with `Mismatched input ';'
  expecting '('` (`array_pop_isolated`, `byte_array_pop_isolated`, 2 files) - would need the grammar to accept a
  bare `.push`/`.pop`/`.delete` member ref as a no-op statement.
- **"Expected variable '..' does not exist on the stack" (11).** The known epilogue-co-spend capture bug class
  (partially fixed 2026-07-11 by `CaptureBranchExternalCallTargets`, f0bdc31b). Remaining variants are the DEEP
  external-call intersection already flagged fundamental: `__deploy_category_0` x6 = `D[] ds; ds.push(new D());
  ds[0].x()` (array-of-contracts + deploy-then-call + per-iteration array dispatch), `market` x2 (FutarchyOracle
  getter/alias chains), `__chaincall_3`, `arrayA`. FAIL-CLOSED (loud, not a miscompile); fixing risks regressing the
  VM-proven deploy-fold / array-extcall paths, so NOT a safe autonomous change.

VERDICT (revised 2026-07-19 per user steer): the STORAGE-SLOT system is grindable incrementally for correctness (NOT
fundamental) - one increment landed (`6125c53a`), UDVT + dynamic-array-slot next. Calldata dynamic-`.offset` needs a
scoped calldata-model rebuild on ABI head/tail encoding (not fundamental). Genuinely hard/deferred remainder: EVM
transient storage + sparse computed raw slots (fail-closed), Yul recursion, reference semantics (ref-returning push,
array-of-mappings), delicate external-call codegen. So: grind storage-slot patterns incrementally; the calldata and
external-call pieces are larger scoped changes, not quick wins.
