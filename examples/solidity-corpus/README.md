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

```
1936/4876 single-file in-scope compiled (~40%)   |   2940 failed
1734 negative correctly rejected (parity)
 456 NEG-ACCEPTED (solc rejects, we compiled) - 428 in syntaxTests: a validation-gap surface to audit
 277 multifile-skipped
```

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
