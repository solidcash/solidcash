# Solidity alignment notes (2026-07-06 session)

Outcomes of aligning solidcash's Solidity-compat mode with `../solidity` (the ethereum/solidity reference) on
four items: the ABI-coder pragmas, super/C3 inheritance, fixed-point, and signedness/casts.

## 1. `pragma experimental ABIEncoderV2` / `pragma abicoder v2` are no-ops (DONE)

**Confirmed in solc source:** `docs/080-breaking-changes.rst` - "ABI coder v2 is activated by default." Since
Solidity 0.8.0, v2 is the default; `pragma abicoder v1` is deprecated ("ABI coder v1 is deprecated and scheduled
for removal. Use ABI coder v2 instead." - `libsolidity/analysis/SyntaxChecker.cpp`). So `experimental ABIEncoderV2`
and `abicoder v2` select the already-active default = no-ops.

**solidcash:** already a no-op. The tolerant pragma grammar alternative parses `pragma <ident> <ident>*;` and the
AstBuilder ignores an `abicoder` / `experimental` pragma (`visitPragmaDeclaration`). Verified: all three of
`experimental ABIEncoderV2`, `abicoder v2`, `abicoder v1` compile as no-ops. Guard test in CorpusGapFixes.test.ts.
(The corpus ABIEncoderV2 *failures* are the v2 struct-calldata *encoding feature*, not the pragma - unrelated.)
