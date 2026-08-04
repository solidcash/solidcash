# solc-corpus bench

A breadth stress-test parallel to `../solidity-by-example`: attempt to compile every `.sol` in the
ethereum/solidity compiler test corpus (`../solidity`, i.e. `/Code/solidity`) with SolidCash, reusing the SBE
bench shape (`compileFile` + `solidityImportCompat` + an OK/FAIL scorecard).

The release compatibility denominator is intentionally limited to upstream `test/libsolidity/semanticTests/**`
and `test/libsolidity/syntaxTests/**`. Other Solidity compiler subsystem fixtures are inventoried but excluded.

```bash
node examples/solidity-corpus/bench.mjs          # full run -> scorecard on stdout + results.json
SOLC_CORPUS=/path/to/solidity node examples/solidity-corpus/bench.mjs   # override corpus path
LIMIT=200 node examples/solidity-corpus/bench.mjs                       # smoke test on N files
FIXTURE_TIMEOUT_MS=10000 node examples/solidity-corpus/bench.mjs        # override the 5s per-fixture budget
CORPUS_WORKERS=4 node examples/solidity-corpus/bench.mjs                # override the default 8 workers
CHECK_NEGATIVES=false node examples/solidity-corpus/bench.mjs          # positive-only diagnostic pass
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
- **CMDLINE** - files under `test/cmdlineTests/`; these exercise CLI modes and diagnostic rendering rather than
  positive standalone compilation. Many are intentionally invalid without a semantic-test error trailer, so both
  accepting and rejecting them are meaningless for the language-parity denominator (excluded).
- **BENCHMARK** - files under `test/benchmarks/`; these are Solidity compiler throughput/optimizer stress inputs,
  not language-conformance fixtures. They are excluded from the compatibility denominator and should be exercised
  by a separately budgeted compiler-performance gate.
- **COMPILATION** - files under `test/compilationTests/`; these are full-project/imported-application compiler
  integration fixtures rather than isolated language fixtures. They are excluded here and belong in the separately
  budgeted application-conformance gate.
- **EXTERNAL** - files under `test/externalTests/`; these are imported third-party application projects, likewise
  excluded from the language denominator and assigned to application conformance.
- **HARNESS** - all compiler-subsystem fixtures outside the semantic and syntax suites (AST/ABI JSON rendering,
  gas estimation, SMT checker, LSP, Yul optimizer, and similar). SolidCash does not advertise compatibility with
  those compiler subsystems, so they are inventoried but excluded.
- Denominator = **OK + FAIL** (single files that should compile).

Each run also writes `run-metadata.json` with the exact Solidity corpus commit, Node version, platform, and fixture
count. Release scorecards must retain this file beside `results.json`. Compilation runs in a reusable worker; a
fixture exceeding the default five-second budget is terminated, recorded as `CorpusTimeoutError`, and cannot block
the remaining scorecard.

## Scorecard (2026-07, 7343 files)

After the pragma unblocks (abicoder/experimental d0a990f9 + typo-reject 8359e4c1; version formats 5a4b6f48):

```
2349/4876 single-file in-scope compiled (~48%)   |   2527 failed   (+413 vs the 1936 pre-pragma baseline)
1699 negative correctly rejected (parity)
 491 NEG-ACCEPTED (solc rejects, we compiled) - mostly natspec / EVM-only rejection reasons
 277 multifile-skipped
```

The pragma unblocks moved ~840 files past the first line (+171 abicoder/experimental, +181 version formats);
the rest fail on the EVM content behind it (Yul, ABIEncoderV2 structs, etc.). The full corpus completes only
because of the optimiser perf fixes (fc474241 + e3e2060d) - large fixed-array files (e.g. `uint256[500]`)
previously drove the optimiser O(N^2) and hung the run; it is now O(N).

### Remaining top blockers (the gap list)

- **ParseError (still ~55% of failures)** - the grammar wall. Top specific gaps: visibility-modifier positions,
  `.push`, `mapping`/`memory` in odd positions, `event`, `++`.
- **MethodCallNotSupported (158)**, **Yul asm (164)**, type checks (StateAssign/Unequal/Assign/MissingReturn).
- **28 `TypeError: Cannot read properties of undefined`** - internal compiler crashes (should emit a proper
  diagnostic instead); a robustness follow-up worth triaging.

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
