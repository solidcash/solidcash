# Solidity alignment notes (2026-07-06 session)

Outcomes of aligning solidcash's Solidity-compat mode with `../solidity` (the ethereum/solidity reference) on
four items: the ABI-coder pragmas, super/C3 inheritance, fixed-point, and signedness/casts.

**Summary of outcomes:**
1. **ABI-coder pragmas** - CONFIRMED already no-ops (v2 is the solc 0.8 default). Guard test added.
2. **super/C3** - DISCREPANCY FOUND + FIXED: super/Base calls in the constructor/fallback/receive were not
   rewritten (a direct `super.f()` in a constructor failed). +4 corpus.
3. **Fixed-point** - solc leaves it unimplemented; solidcash implements it (decimal-scaled int). Kept our
   implementation, added a one-time "differs from Solidity" warning.
4. **Signedness** - ASSESSED: not a cast problem. Explicit int/uint casts already compile + are value-preserving;
   implicit int+uint mixing is rejected by both (not a discrepancy). Only EVM overflow-wrap / negative->unsigned
   two's-complement reinterpretation diverges (fundamental BCH sign-magnitude, by-design). No code change needed.

## 1. `pragma experimental ABIEncoderV2` / `pragma abicoder v2` are no-ops (DONE)

**Confirmed in solc source:** `docs/080-breaking-changes.rst` - "ABI coder v2 is activated by default." Since
Solidity 0.8.0, v2 is the default; `pragma abicoder v1` is deprecated ("ABI coder v1 is deprecated and scheduled
for removal. Use ABI coder v2 instead." - `libsolidity/analysis/SyntaxChecker.cpp`). So `experimental ABIEncoderV2`
and `abicoder v2` select the already-active default = no-ops.

**solidcash:** already a no-op. The tolerant pragma grammar alternative parses `pragma <ident> <ident>*;` and the
AstBuilder ignores an `abicoder` / `experimental` pragma (`visitPragmaDeclaration`). Verified: all three of
`experimental ABIEncoderV2`, `abicoder v2`, `abicoder v1` compile as no-ops. Guard test in CorpusGapFixes.test.ts.
(The corpus ABIEncoderV2 *failures* are the v2 struct-calldata *encoding feature*, not the pragma - unrelated.)

## 2. super / C3 inheritance (DISCREPANCY FIXED)

super/C3 is largely supported (InheritanceExpansionTransformation flattens the hierarchy, preserves each
overridden parent body under a mangled `__base_` name, and rewrites `super.f()`/`Base.f()` to it against the C3
linearization). Verified matching solc for: linear super, super with args, super in an expression, diamond super
in a function body, `override(A, B)` base lists.

**Discrepancy found + fixed:** `resolveSuperAndBaseCalls` only rewrote super/Base calls in `contract.functions`,
NOT in the constructor / fallback / receive. So a direct `super.f()` in a constructor (e.g. the diamond
`super_in_constructor.sol` -> 15 via the D->B->C->A MRO) failed with "Undefined reference to symbol super.f". Now
the constructor/fallback/receive bodies are rewritten too (against the current contract's linearization position),
and the preserved impls they call are reachability roots so they are not pruned. +4 corpus. Remaining super
failures are `super.f` as a function POINTER (fundamental - runtime function pointers) and bare `super;` (a
solc-negative test).

## 3. Fixed-point (DIFFERENCE DOCUMENTED + WARNING ADDED; keep our implementation)

**solc:** fixed-point types are declared but NOT implemented - any real use emits `UnimplementedFeatureError 1834:
Fixed point types not implemented` (confirmed in the corpus test trailers + `libsolidity/ast/Types.cpp`). The docs
recommend a UDVT workaround (`UFixed256x18`).

**solidcash:** fully implements fixed-point (`FixedType(signed, bits M, decimals N)`), stored as a DECIMAL-scaled
integer (value * 10^N, same on-chain encoding as an int of the same bit width). `fixed`/`ufixed` default to
128x18. Arithmetic (`+ - *`, negate), comparisons, and decimal literals (`1.5`) work.

**Decision (per the session brief): keep solidcash's implementation as-is; it is finished and solc has nothing to
match.** Since a Solidity dev would expect fixed-point to be a compile ERROR (unimplemented), solidcash now emits a
one-time compiler warning whenever a `fixed`/`ufixed` type or a genuine decimal literal is used, flagging that our
fixed-point is a solidcash-specific extension that must not be assumed to have cross-compiler parity (added in
AstBuilder: warnFixedPointOnce, wired to validateFixedType + the decimal-literal builder; module-level flag so the
class shape is untouched - a class-field there tips the deep recursive-function inliner over the V8 stack limit).

Known solidcash-internal limitation (NOT a solc discrepancy, since solc has no fixed-point): mixed fixed/int
arithmetic with an int literal (`1.5 * 2`) is an "unequal types" error - use `1.5 * 2.0` or an explicit cast.

## 4. Signedness / int representation (ASSESSED - the issue is NOT about casts; already compatible)

solidcash ints are the BCH VM integer (sign-magnitude, arbitrary precision); EVM ints are 256-bit two's complement.
Assessment of whether the corpus "signedness" failures are about implicit/explicit casts:

- **Explicit casts already compile + are behaviorally compatible.** `int256(uint256)`, `uint256(int256)`,
  `int8(uint16)`, `uint128(int64)`, etc. all compile (like solc). int/uint/bigint share ONE BCH integer
  representation (see Casts.test.ts "uint256 <-> int compatibility"), so an in-range cast is a value-preserving
  re-label + bounds check - behaviorally identical to solc for in-range values.
- **Implicit int/uint MIXING is rejected by BOTH.** `int + uint` ("unequal types") is a solc error too
  (Solidity requires an explicit cast) - NOT a discrepancy. The corpus UnequalType "signedness" lines are this
  (both reject = negative tests), plus fixed-point (`5.2 % 3`, `uint64(1)+ufixed(2)` - see section 3) and Yul
  cross-type punning - none are a cast we wrongly reject. Confirmed: zero corpus files reject an int/uint cast solc
  accepts.
- **Where the two representations are observable, solidcash already matches EVM two's complement:** bitwise
  `& | ^` and fixed-bytes conversions go through emitToTwosComplementBytes/emitFromTwosComplementBytes; checked
  arithmetic (the Solidity 0.8 default) reverts on overflow like solc. `unchecked { }` parses.

**Conclusion:** the signedness issue is not an implicit/explicit-cast compile problem - those are already
compatible. The only genuine divergence is EVM's modular-WRAP semantics (2^256 overflow, negative->unsigned
two's-complement reinterpretation) vs BCH's exact sign-magnitude arithmetic with checked bounds. That is
fundamental to the BCH VM and by-design (safer); a port relying on EVM overflow-wrapping in `unchecked` blocks or
`uint(negativeValue)` two's-complement reinterpretation would differ. No code change needed for cast compatibility.
