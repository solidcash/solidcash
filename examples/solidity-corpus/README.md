# solc-corpus bench

A breadth stress-test parallel to `../solidity-by-example`: attempt to compile every `.sol` in the
ethereum/solidity compiler test corpus (`../solidity`, i.e. `/Code/solidity`) with SolidCash, reusing the SBE
bench shape (`compileFile` + `solidityImportCompat` + an OK/FAIL scorecard).

```bash
node examples/solidity-corpus/bench.mjs          # full run -> scorecard on stdout + results.json
SOLC_CORPUS=/path/to/solidity node examples/solidity-corpus/bench.mjs   # override corpus path
LIMIT=200 node examples/solidity-corpus/bench.mjs                       # smoke test on N files
```

## What this bench is (and is NOT)

This is the solc **compiler conformance suite**, not curated applications. It deliberately exercises every
syntactic/semantic corner of full-EVM Solidity plus thousands of negative (deliberately-uncompilable) tests. So
the raw compile rate is not a quality score the way SBE's is; the value is the **bucketed scorecard** and the
**grouped failure reasons** as a prioritized gap list. It complements SBE (real-app portability), it does not
replace it.

Buckets (so the denominator is meaningful):
- **NEGATIVE** - the `// ----` trailer declares a compile `Error`; solc rejects it, so SolidCash rejecting is
  parity (excluded from the denominator). If SolidCash *accepts* one it is `NEG-ACCEPTED` (over-permissive).
- **MULTIFILE** - `==== Source:` harness delimiter; not a single compilable unit (excluded).
- Denominator = **OK + FAIL** (single files that should compile).

## Scorecard (2026-07, 7343 files)

After the `pragma abicoder` / `pragma experimental` unblock (grammar d0a990f9 + typo-reject 8359e4c1):

```
2107/4876 single-file in-scope compiled (~43%)   |   2769 failed   (+171 vs the 1936 pre-pragma baseline)
1699 negative correctly rejected (parity)
 491 NEG-ACCEPTED (solc rejects, we compiled) - mostly natspec / EVM-only rejection reasons
 277 multifile-skipped
```

The pragma unblock moved ~560 files past the first line; ~171 fully compile, the rest fail on the EVM content
behind it (Yul, ABIEncoderV2 structs, etc.). Running the full corpus also relies on the optimiser perf fix
(fc474241) - large fixed-array files (e.g. `uint256[500]`) previously stalled the run.

### Next cheap unblock (newly exposed)

The 277 remaining "expecting VersionLiteral" failures are NOT abicoder/experimental - they are `pragma solidity`
*version formats* the grammar rejects: `pragma solidity >=0.0;` (273) and `pragma solidity *;` (28) - 2-part
versions and wildcards. Under solidityImportCompat the version is ignored anyway, so broadening the version
grammar (or tolerating these forms) is another ~300-file parse unblock.

## Failure breakdown (the gap list)

- **ParseError: 1878 (64% of failures)** - the grammar is the wall. The ANTLR grammar does not cover Solidity's
  full syntactic breadth. Specific gaps by frequency: visibility-modifier positions
  (`public`/`internal`/`external`, ~148), stray `;` (155, assorted unsupported declaration forms), `mapping`
  positions (29), `.push` (23), `virtual`/`override` (21), `memory` location (20), `++` (19), `event` (16), and
  the `pragma abicoder`/`pragma experimental` directives (~295, "expecting VersionLiteral").
- **Yul inline assembly: 163** - fundamental (only a lowerable subset is supported; see yul-inline-assembly.md).
- **UndefinedReference: 142** - EVM-specific types/globals (`ercN`, library symbols, `uint` in odd positions).
- **MethodCallNotSupported: 128** - method calls on non-contract/interface instances.
- Type/semantic checks: StateAssignType 47, AssignType 43, MissingReturn 39, UnequalType 34, UnsupportedType 55.

## Cheapest high-value unblock

`pragma abicoder`/`pragma experimental` (~295 files) fail purely at the pragma line - solc treats them as
ignorable directives. Tolerating (parse + ignore) them would let those files reach real semantics, sharpening
the rest of the gap signal.
