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

- **abicoder `msg.data` / `abi.decode(msg.data[4:], ..)` (FUNDAMENTAL - EVM calldata model):** msg.data in a
  REGULAR (non-fallback) function fails - the redeemPushSize reconstruction is only threaded into the fallback
  path (regular entry functions + their subroutine forms don't push __internal__redeemPushSize). Threading it is
  a codegen fix, BUT the 7 corpus files all `abi.decode(msg.data[4:], (uint,uint))` = decode EVM-ABI-encoded
  calldata by BYTE OFFSET, which does NOT map to BCH's push-based param structure (params arrive as separate
  data pushes, not a packed ABI blob). Faking it would silently miscompile (hollow). NOT soundly fixable without
  an EVM-calldata emulation layer. `abi.encodeWithSelector` string->bytes4 (the clean abicoder slice) IS done
  (ee49a0c8, +5). The rest of abicoder = this + function-type ABI + Yul + struct-with-function-fields.
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
