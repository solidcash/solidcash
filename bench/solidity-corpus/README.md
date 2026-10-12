# solc-corpus bench

A breadth stress-test parallel to `../solidity-by-example`: attempt to compile every `.sol` in the
ethereum/solidity compiler test corpus (`../solidity`, i.e. `/Code/solidity`) with SolidCash, reusing the SBE
bench shape (`compileFile` + `evmCompat` + an OK/FAIL scorecard). The harness states
`enforceFinalRequire: false` because it measures language/source conformance on unmodified Solidity, while the
final-require rule is a CashScript covenant-safety policy checked by the compiler suite and the app benches.

The release compatibility denominator is intentionally limited to upstream `test/libsolidity/semanticTests/**`
and `test/libsolidity/syntaxTests/**`. Other Solidity compiler subsystem fixtures are inventoried but excluded.

```bash
node bench/solidity-corpus/bench.mjs          # full run -> scorecard on stdout + results.json
SOLC_CORPUS=/path/to/solidity node bench/solidity-corpus/bench.mjs   # override corpus path
LIMIT=200 node bench/solidity-corpus/bench.mjs                       # smoke test on N files
FIXTURE_TIMEOUT_MS=10000 node bench/solidity-corpus/bench.mjs        # override the 5s per-fixture budget
CORPUS_WORKERS=4 node bench/solidity-corpus/bench.mjs                # override the default 8 workers
CHECK_NEGATIVES=false node bench/solidity-corpus/bench.mjs          # positive-only diagnostic pass
RETRY_TIMEOUT_MS=60000 RETRY_WORKERS=2 node bench/solidity-corpus/bench.mjs  # isolated retry tier
RETRY_TIMEOUTS_FROM_RESULTS=true RETRY_TIMEOUT_MS=60000 RETRY_WORKERS=2 \
  node bench/solidity-corpus/bench.mjs                               # resume only retained timeouts
RETRY_TIMEOUTS_FROM_RESULTS=true RETRY_TIMEOUTS=false RETRY_ERROR_NAMES=Error,RangeError \
  RETRY_TIMEOUT_MS=60000 node bench/solidity-corpus/bench.mjs        # reclassify selected error names
CHECK_NEGATIVES_FROM_RESULTS=true NEGATIVE_TIMEOUT_MS=30000 NEGATIVE_WORKERS=4 \
  node bench/solidity-corpus/bench.mjs                               # audit only unchecked/timeout negatives
RECHECK_ACCEPTED_NEGATIVES=true NEGATIVE_TIMEOUT_MS=30000 NEGATIVE_WORKERS=4 \
  node bench/solidity-corpus/bench.mjs                               # recheck retained over-accepted negatives
CORPUS_OUTPUT_DIR=/tmp/corpus-run node bench/solidity-corpus/bench.mjs      # alternate artifact directory
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
the remaining scorecard. Release runs should configure `RETRY_TIMEOUT_MS`: every primary timeout is then compiled
again in a fresh worker under the larger budget, so worker cache growth and parallel contention do not decide the
accepted count. `RETRY_TIMEOUTS_FROM_RESULTS=true` resumes that isolated tier from matching retained artifacts
without repeating the primary sweep. Set `RETRY_TIMEOUTS=false` with a comma-separated `RETRY_ERROR_NAMES` list to
recompile selected diagnostic classes after hardening their compiler boundary.
`CHECK_NEGATIVES_FROM_RESULTS=true` preserves the retained positive result and compiles only negative fixtures
that are unchecked or previously timed out. Negative timeouts remain explicitly unresolved rather than counting
as safe rejection; repeat the command with a larger `NEGATIVE_TIMEOUT_MS` to resolve them. Metadata retains every
negative-audit pass alongside its worker and timeout budget.
`RECHECK_ACCEPTED_NEGATIVES=true` similarly preserves every other result and recompiles only negatives that the
retained run accepted. Use it after semantic hardening to update the negative score without repeating all 2,158
fixtures; the pass and its resulting accepted count are appended to the same metadata history.

## Runtime parity: `semantic-runner.mjs`

`bench.mjs` only asks "does it compile". `semantic-runner.mjs` executes the corpus's own semantic expectations
(the `// ----` trailer of `test/libsolidity/semanticTests`) on the BCH VM, for two deliberately narrow slices: the
pure first slice below, and the stateful slice after it.

- **Fixtures**: `results.json` status `OK`, single source, the last definition is a plain `contract` (the target),
  no state variables in any contract, no constructor parameters.
- **Lines**: `f(types): args -> rets`, `f() -> rets` and `... -> FAILURE` (any revert, payload ignored) over
  `uintN`/`intN`/`bool`/`bytesN` values (decimal, negative, hex, `left()`/`right()`, `true`/`false`); `gas` lines
  are ignored. Call options, events, builtins, `library:`/`constructor()` lines, strings/bytes/arrays/structs/
  address, or anything unparsed skip the whole fixture (reason recorded). Arguments that are not clean values of
  the declared type (ABI-decoder validation tests) and stateful artifacts skip the line.
- **Execution**: per (fixture, signature) one wrapper `contract __Check is <Target>` with
  `__check(args, expected, bool cmp)` is appended and compiled (`evmCompat: true`, `enforceFinalRequire: false`
  as in `bench.mjs`); an `external` target function is respelled `public` so the wrapper can call it. Each line
  is one spend on a fresh `MockNetworkProvider` (the `conformance/bch.ts` shape). `cmp=false` on FAILURE lines, so
  a call that returns normally is a mismatch; a FAILURE line needs a VM failure (`FailedTransactionError`), not a
  build error. A target with a custom storage layout (`contract C layout at N`), which solc forbids inheriting
  from, gets the check function inserted into a copy of its own body instead (the same contract plus a public
  function; storage is untouched); the shape is recorded per check (`shape`) and tallied in the scorecard. A
  derived wrapper refused the way the stateful slice retries (below) is compiled again that way too.
- **keccak256 side-cars**: keccak256 runs in compute side-cars a deployer funds, so each spend places them first,
  as `conformance/bch.ts` does: `max(1, minInstances)` mutable NFTs (category `ee..ee`) at
  `keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, false)`, read from the artifact's `keccak256`
  `externalLibraries` entry; when that entry is `unbounded` (a dynamic keccak loop), also 65 at the STATEFUL
  covenant `keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, true)`, since the SDK probe co-spends N + 1 for N
  iterations, capped at 64.
- **Density reserve**: a spend stopped by the operation-cost density limit is retried once behind a 512-byte
  reserve (`new Contract(artifact, [], { provider, salt })`: a dropped redeem-script push, max 520 bytes, that
  raises the input's operation budget) and scored as `matched-with-density-reserve` or
  `mismatched-with-density-reserve`, so op-cost limits stay visible instead of folding into plain results. FAILURE
  lines are retried too: a revert that only the density limit causes never counts as a plain match.
- **Size limits**: the mock's own profile (`MOCK_CONSENSUS_LIMITS`) keeps the real operation-cost budget but relaxes
  the input, stack item and NFT commitment limits to 1,000,000 bytes, so a line could match with a 2-kilobyte state
  commitment no node accepts. Every spend therefore runs on `new MockNetworkProvider({ consensusLimits })` with the
  real BCH-2026 values (`maximumInputBytes` 10,000, `maximumStackItemBytes` 10,000, `maximumNftCommitmentBytes`
  128; everything else as before). A line stopped by one of them (read from the whole error text: `input` for an
  unlocking bytecode over the maximum bytecode length or a byte-gate `consensus-unlocking-bytes` refusal, `stack
  item` for a pushed item over the maximum stack item length, `commitment` for a state or token commitment over the
  limit) runs again under the relaxed limits and is scored `matched-under-mock-size-limits` or
  `mismatched-under-mock-size-limits`, recording the limit (`sizeLimit`) and the real run's outcome
  (`realOutcome`); a density reserve the relaxed run needed becomes a flag (`densityReserve`). Like reserve lines,
  they count as executed and never as matched. A line the relaxed run stops on a size limit too keeps its real
  outcome: `create_memory_array_too_large` allocates 10^77 bytes in both, and a plain `TransactionBuilder.send()`
  meets the SDK's finalized byte gate, which applies the real 10,000-byte input limit whatever the provider's
  profile (no gate receipt is registered for it).
- **Runtime under real limits**: the mock's fast VM paths (`createVirtualMachine.ts` cached P2SH and invoke
  evaluators and operation-limit check, the prepared transaction verifier) follow its `simulator` flag and enforce
  the published limits. Probe derivation still keys on `maximumInputBytes > 10,000` (`evaluateProbeTrace` in
  `faithful-probe-trace.ts`, the send discovery probe and the deploy probe take libauth `debug()` traces at or
  below it), so a real-limit run takes the live-network derivation and is still slower than a relaxed one. The
  default `FIXTURE_TIMEOUT_MS` is 600 s (was 120 s).
- **Limits of the wrapper**: the target is reached through an internal call, so entry-point-only paths can refuse
  or differ for wrapper reasons; those show up as refusals or mismatches with their reason, not as silent passes.
- **Self-call for `msg.sig`/`msg.data`**: both are the entry's across internal calls (solc semantics, which the
  compiler follows), so a target reached from `__check` would see `__check`'s selector and calldata, while the
  expectation was written for a direct call. A fixture whose code (comments and strings aside) reads either calls
  its target as `this.f(args)` instead: an external self-call, which the compiler runs as the callee's own entry
  (its own selector; `msg.data` rebuilt as that selector plus the encoded arguments). Such a wrapper respells no
  `external` function (`this.f` reaches it as in solc), its checks are at least `view` (`this` reads the
  environment) and a getter is still read directly. It works in both slices; the fixture records `selfCall`, and
  the scorecard lists its lines per slice (`SELF-CALL WRAPPER`).

**Stateful slice** (scored in its own section; the pure slice above is unchanged):

- **Fixtures**: those WITH state variables, otherwise the same fixture and line restrictions (no constructor
  parameters; a parameterless constructor runs at deploy). The getter of an elementary `public` state variable is
  callable too: its mapping keys and array indices become parameters and the wrapper reads the variable directly
  (`m[__a0]`), since a derived contract cannot call a getter internally; struct/enum/string getters skip. A getter
  wins over a base function it overrides (`uint public override test` over an `external` `test()`), so that
  function is not respelled `public` (which would break the override).
- **Execution**: one wrapper `contract __Check is <Target>` with a `__check_<k>(args, expected, bool cmp)` per
  called signature, compiled with `forceStateful: true` added to the bench options, deployed ONCE per fixture with
  `getContractFactory(artifact, signer).deploy()` on a fresh `MockNetworkProvider` (fresh funding txid, so a fresh
  category; the mock reset hooks are fired). Every runnable line then runs in file order as its own `send()`, so
  state carries from line to line as in solc's runner. A `layout at` target gets the checks inside a copy of its
  own body, as in the pure slice. A derived wrapper the lifecycle policy refuses (`UnauthorizedLifecycleError`: a
  `__check_<k>` reaches a child deploy and has no trusted-key signature check) or that hits `MESSAGE_BUS_REQUIRED`
  (`various/write_storage_external`: repeated calls to the same state owner) is compiled again that way: the
  compiler's message-bus auto-selection reads only the root contract's own functions, before inheritance is
  expanded, so behind a derived wrapper the target's call-graph edges are invisible, the wrapper is narrowed to
  direct mode, and there the policy applies; inside the target the edges are seen as when the target compiles
  alone. So is one refused with `UndefinedReferenceError` or `AssignTypeError`: names the target resolves as the
  root contract fail behind a derived one (`C.x` in `base_access_to_function_type_variables`, `this.s()` in
  `skip_dynamic_types_for_structs`, the external function values `this.ext` in `copy_struct_invalid_ir_bug` and
  `this.g` in `member_external_function_v2`, the `find` overload set `storage_array_ref` spreads over two
  contracts), and every candidate compiles alone (`results.json` OK). The fixture records `shape`, and the
  scorecard tallies the reasons. A deploying check's children compile from the source that compiled.
- **Routed fixtures**: a pure fixture with a line whose plain unlock stops at `No value for '__internal__...'` (a
  compiler-owned witness of an external call or `msg.sender` that only StatefulContract transaction building
  fills) runs again here, as a stateful fixture: one wrapper, deployed once, lines in order. It is scored in this
  slice (pure skip reason `routed-to-stateful: external-call witnesses`), counted apart in the header
  (`+ N routed from the pure slice`), and its lines are listed in their own block. With no state variables it
  cannot diverge, so its lines are never tagged `afterDivergence`. Routing follows the pure run: `SLICE=stateful`
  leaves routed fixtures out.
- **FAILURE lines** must fail with a VM error (`FailedTransactionError`, or the SDK's
  `preflight failed at input N:` message) and broadcast nothing (a send counter on the provider); a revert after a
  partial broadcast is a mismatch (`state changed`). A value line that reverts is re-sent with `cmp=false`: success
  there scores `wrong value`, and that send advances state the way solc's call did.
- **Divergence**: a line executed after a mismatch, or after a skipped value line of a state-writing function,
  carries `afterDivergence` and is counted apart; the headline percentage covers the lines before any divergence.
- **Density reserve**: a density-limit stop replays the WHOLE fixture behind the 512-byte deploy salt
  (`deploy({ salt })`), since state must replay too; lines from the first stopped one take the replay's results
  with the `-with-density-reserve` suffix.
- **Size limits**: the deploy and every line run under the same real limits. A deploy stopped by one, or the first
  line stopped by one that the relaxed limits do not stop, replays the whole fixture under the relaxed limits; lines
  from that point take the replay's results with the `-under-mock-size-limits` suffix and the stop's limit and
  outcome. A deploy refused in both runs stays `refused-at-deploy` with the real refusal.
- **Refusals**: a wrapper that does not compile refuses all the fixture's lines (`refused-at-compile`), a failed
  deploy `refused-at-deploy`.

**Pipeline-specific expectations** (scored in their own section, outside both rates): a fixture whose `// ====`
settings carry `compileViaYul: true` (via-IR) or `false` (legacy) holds expectations of ONE solc pipeline, and solc
ships twins whose expectations disagree (`modifiers/function_modifier_loop.sol` returns 10 on legacy,
`function_modifier_loop_viair.sol` 1 on via-IR), so one side of a twin pair always mismatches. Such fixtures run
in their slice as usual (`compileViaYul: also` is not pipeline-specific), but their lines leave both headers and
all slice blocks. The third header line and the section after the stateful one give per pipeline the clean
executed lines matched (as in the slice headers), the lines by pipeline, slice and status, and every line not
matched. Twin pairs are the legacy/via-IR fixtures with the same name once a pipeline suffix (`_viair`, `_viaIR`,
`_viaYul`, `_via_yul`, `_ir`, `_legacy`, `_OldCodeGen`/`_newCodeGen`) is stripped; each gets the verdict `legacy`,
`via-IR`, `both` (every executed line of that side matched), `neither` or `unmeasured` (a side executed nothing).
`RESCORE=true` re-derives the pipeline tag from the corpus source for results older than it.

**Older-EVM fixtures** are skipped (`evm-version:older`): a fixture whose settings pin `EVMVersion: <X`, `<=X` or
`=X` expects behaviour the current EVM no longer has (e.g. `various/staticcall_for_view_and_pure_pre_byzantium.sol`
calls through a view interface before STATICCALL existed); its current-EVM twin is measured instead.

```bash
CORPUS_RESULTS=/path/to/results.json node bench/solidity-corpus/semantic-runner.mjs  # default ./results.json
LIMIT=20 node bench/solidity-corpus/semantic-runner.mjs           # first N selected fixtures
FILTER=arithmetics/ node bench/solidity-corpus/semantic-runner.mjs # path substring
SELECT_ONLY=true node bench/solidity-corpus/semantic-runner.mjs   # selection summary only (SELECT_ONLY=list: per file)
SLICE=stateful node bench/solidity-corpus/semantic-runner.mjs     # one slice only (pure | stateful)
RESCORE=true node bench/solidity-corpus/semantic-runner.mjs       # rebuild both reports from semantic-results.json
```

Output: `semantic-results.json` (per fixture and line: matched / matched-with-density-reserve / mismatched /
mismatched-with-density-reserve / matched-under-mock-size-limits / mismatched-under-mock-size-limits /
refused-at-compile / skipped with reason / error for timeouts; `meta.sizeLimits` holds the limits applied) and
`semantic-scorecard.txt` (counts, mismatch shapes, the lines matched behind a reserve, the mock-size lines by
limit and status and by fixture and limit plus the matched ones, then every mismatch, a reserve one tagged
`(with density reserve)` and a mock-size one `(under mock size limits: <limit>)`; the stateful header is its
second line and the stateful section, with `refused-at-deploy`, the revert reasons that matched FAILURE lines, the
routed lines and `(after divergence)` tags, follows the pure one; the pipeline header is the third line, its section
comes last). First run (2026-10-11, corpus
816d9b2a, 6 workers, 140 s): 489 fixtures / 1,778 lines selected; 1,332 of 1,612 executed lines matched (82.6%), 280
mismatched, 4 refused at compile, 154 skipped, 8 timed out. With side-cars and the reserve (2026-10-11, 8 workers,
140 s): 1,344 of 1,612 matched (83.4%), 8 matched with a reserve (5 of them FAILURE lines that still stop on the
density limit), 250 mismatched, 10 mismatched with a reserve (all still over the density limit). Of the 25 lines
that lacked side-cars, 14 match; 11 stop at keccak probe errors (no side-car read in the probe trace, a 4-block
batch, no convergence).

Stateful slice, first run (2026-10-11, corpus 816d9b2a, 8 workers, 147 s for both slices): 333 of the 621 fixtures
with state variables selected, 871 lines. Before any divergence 499 of 576 executed lines match (86.6%), 6 match
behind a reserve, 63 mismatch (29 value lines that revert on an OP_VERIFY, 14 wrong values, 4 auto-derivation
errors) and 8 mismatch behind a reserve (still over the density limit); after a divergence 36 of 88 match. 156
lines are refused at compile (91 of them, 25 fixtures, because a derived wrapper cannot inherit a custom storage
layout; 25 because the lifecycle policy flags a wrapper that reaches a child deploy) and 51 at deploy (byte rules,
derivation oscillation, constructor vmap keys). The pure slice in the same run: 1,346 of 1,612 matched.

Wrapper refusals removed (2026-10-11, 8 workers, 150 s for both slices): `layout at` targets (25 stateful
fixtures / 91 lines, 1 pure line) and lifecycle refusals (11 fixtures / 25 lines) run with the checks inside the
target, and the overriding getter of `public_state_overridding` runs (3 of 3 match). Stateful: 570 of 659 executed
lines match before any divergence (86.49%), 6 behind a reserve, 74 mismatch and 9 mismatch behind a reserve; after
a divergence 46 of 112 match; 38 lines are refused at compile and 62 at deploy. The layout fixtures match 57 of 67
clean lines (7 of the 10 misses are wrong `.slot`/`.offset` or slot-addressed `sload`/`sstore` values), the
lifecycle ones 6 of 13 (6 OP_VERIFY reverts on lines that deploy a fresh child, 1 keccak probe error; 6 more
lines refused at deploy, 1 at compile on Yul `create`). Pure: 1,480 of 1,613 (91.75%). Refusals the wrapper still
causes: an internal call to a returning dynamic-array state helper (10 lines), to an overloaded function
(`storage_array_ref`, 16), to a function ending in an assembly `return` (2), and `MESSAGE_BUS_REQUIRED` on a
derived `__check_0` (`write_storage_external`, 3: the same hidden call-graph edges as the lifecycle refusal);
6 more lines fail inside the target's own code (undefined `x`/`s`, an assign type) though the target compiles
alone, so likely on the derived shape (not diagnosed).

Pipeline split and witness routing (2026-10-11, 8 workers, 158 s for both slices): 84 compiled candidates are
pipeline-specific and 43 run (17 legacy, 26 via-IR); legacy matches 26 of 30 clean executed lines, via-IR 93 of 103.
Of the 8 twin pairs SolidCash meets legacy on 3 (`function_modifier_loop`, `function_modifier_multi_invocation`,
`uninitialized_internal_storage_function`), via-IR on 1 (`cleanup_bytes_types_shortening`), both on 2, neither on
1 (`dirty_memory_bytes_to_storage_copy`); 1 is unmeasured (constructor parameters). Pure: 1,369 of 1,479 (92.56%)
without the 124 pipeline lines and the 10 routed ones. The 8 routed fixtures (10 lines) match 2 lines, both FAILURE
lines on unrelated reverts; 8 mismatch: 4 read output index -1 (a call to an address without a contract, or to a
`new` child), `testLowLevel` stops on an OP_VERIFY, `msg_sender` on an OP_SPLIT at 20 of an 18-byte item,
`revert_return_area` returns a wrong value and `library_on_interface` (a self call through an interface) fails
derivation on a duplicate stateful input. Stateful: 637 of 707 clean lines (90.10%), after divergence 28 of 65, 35
refused at compile and 64 at deploy; `write_storage_external` now compiles in the target and stops at deploy
(derivation oscillation). 12 more stateful fixtures match through this branch's newer compiler
(`storageLayoutSpecifier` slots and offsets, `interfaceID/interfaces`, `base_base_overload`), not the runner.

Real size limits (2026-10-11, corpus 816d9b2a, 8 workers, 646 s for both slices, was 151 s): every spend and deploy
runs under the real input, stack item and commitment limits. 45 lines stop on one and run again under the mock's
limits: 39 on `commitment`, all at deploy (`Commitment for NFT index N exceeds limit`: `fixed_arrays_in_storage` 9,
`fixed_out_of_bounds_array_access` 8, `state_variable_reference_types_slot_offset` 5,
`nested_array_memory_to_storage` 4, 12 more array and struct copy fixtures with 13 lines, one pipeline-specific),
6 on `input` (`copy_struct_array_from_storage` 4: a 10,049-byte constructor probe; `storage_memory_nested_struct`
1: 13,061 bytes; 1 pure line), none on `stack item`. 14 of them matched under the relaxed limits before, 30 were
refused at deploy in the previous scorecard and now deploy only under the relaxed limits. Stateful: 638 of 750
clean executed lines match (85.07%; 89.99% without the 41 mock-size lines, of which 37 match and 4 mismatch), after
divergence 27 of 66, 18 refused at deploy (was 56: 29 of those 30, and 9 `deployedCodeExclusion` lines that deploy
through this branch's newer SDK, the same under the relaxed limits). Pure: 1,373 of 1,489 (92.21%). Every line of
`all_possible_user_defined_value_types_with_operators` (8, timeouts at 120 s before, 562 s now) is over the input
limit (12,262 to 12,870 bytes): one reverts on its own under the relaxed limits
(`mismatched-under-mock-size-limits`), the other 7 stop at the SDK byte gate in both runs and stay plain mismatches.

Self-call and name retries (2026-10-12, corpus 816d9b2a, 8 workers, 642 s for both slices): the 5 fixtures reading
`msg.sig`/`msg.data` call their target as `this.f()` and all 7 lines match (4 pure `msg.sig` lines mismatched on
`__check`'s selector before, `abi_decode_slice` was refused with `MsgDataInSubroutineError`, the 2 stateful lines
of `unused_store_storage_removal_bug` matched already). The in-target retry of `UndefinedReferenceError` and
`AssignTypeError` measures 23 refused lines: the 21 undefined-reference ones match (`storage_array_ref` 16,
`base_access_to_function_type_variables` 4, `skip_dynamic_types_for_structs` 1); `copy_struct_invalid_ir_bug`
fails its `assert` (OP_VERIFY), and `member_external_function_v2` routes to the stateful slice (external-call
witnesses) and reads output index -1. Pure: 1,375 of 1,475 (93.22%, was 92.94%), 1 line refused at compile.
Stateful: 706 of 782 (90.28%, was 90.12%), 4 lines refused at compile (was 26: 2 assembly returns, a dynamic-array
state helper, Yul `create`), after divergence 21 of 54. One more stateful line matches with an unchanged wrapper
(`erc7201_layout_specifier_slot_match_comptime`, an OP_VERIFY revert in the 6-worker run before).

## Retained release scorecard (2026-08, 7,343 files)

The retained baseline on Solidity corpus revision `816d9b2a` is 2,698/2,805 positive fixtures compiled, 107
named failures, and zero residual timeouts. All 2,158 negative fixtures were checked: 1,835 reject and 323 are
over-accepted. The full methodology and retry tiers are recorded in `run-metadata.json`; `scorecard.txt` contains
the reviewed failure buckets.

`yarn test:corpus-baseline` is the release gate for these retained artifacts. It rejects a positive regression,
an increase in over-accepted negatives, unresolved negative fixtures, a corpus-revision mismatch, or any change
to the reviewed grouped-failure snapshot. Updating `release-baseline.json` is therefore an explicit review act,
not an automatic side effect of running the bench.

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
