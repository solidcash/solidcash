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

## Deferred features (feature-scale, not yet done)

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

## Remaining tractable-but-complex veins (need your greenlight / VM verification)

At 3431/4876 the CLEAN peel/coercion/resolution veins are mined out. These remain, each with a sketch:

- **Array slices on non-bytes arrays** (`int[] b[start:end]`, ~10 files): the array blob is `pushdata(length) ++
  elements_blob`, elements at byte i*elemWidth (fixed-width). A slice = decode length -> bytes-slice
  elements_blob[start*W : end*W] -> re-frame `pushdata(end-start) ++ slice`. New codegen in visitSlice (gated on a
  fixed-width ArrayType element); NEEDS VM VERIFICATION (I won't commit array codegen unverified). Biggest single vein.
- **Tuple for-init** (`for((uint x, uint y) = (0,1); ..)`, ~2-3 files): forInit needs a tuple-destructure alt; the
  builder must replicate visitTupleAssignment (parenthesised slots + N-expr / tuple-valued / ternary RHS). Moderate.
- **Computed array dimension** (`uint[2**10]`, `uint[(a/b)*b]`, ~3 small): array-size grammar allows only
  NumberLiteral|Identifier. Full `expression` in the dimension risks the ANTLR ALL(*) OOM (see expr-statement note);
  a narrow const-arith sub-rule would be safe. Most `2**N` are oversized (hit the array cap) so low yield.
- **Parenthesized call** (`(free2)()`, `(L.g)()`, ~2 files): calling a parenthesized expression - function-pointer
  adjacent grammar (`expression '(' args ')'`); risk of ambiguity.
- **abi.decode with contract types** / **nested-array element delete+increment** / **public struct getter tuples**
  / **whole-struct-to-mapping copy `m[k]=s`**: all in the parallel agent's flattening/struct area or need schema work.

## Fundamental (need EVM features BCH lacks - would be research-level or unsound)
Function-pointer ABI (function-type params, fun.selector/.address, array-of-function-pointers - dominate the
remaining parse `(`/`memory`/FunctionTypeNotEncodable clusters), genuine int+uint signedness (solc rejects too),
fixed-point (5.2), external-call-on-array-element, deploy-then-call `new C().m()`, ABIEncoderV2 calldata structs,
super/C3, Yul EVM-memory/storage/calldata, multifile symbols, gnosis circular-import.
