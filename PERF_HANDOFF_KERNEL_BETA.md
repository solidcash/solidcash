# Performance handoff — kernel-beta marketplace path

Worktree `/Code/cashscript/.worktrees/kernel-beta-perf`, branch `grok/message-bus-kernel-beta-perf`
(forked from `grok/message-bus-kernel-beta` at `46d682882`). This worktree exists because the
candidate worktree is shared with another active session; nothing here touches that tree.

Landed (SDK only, both verified against a baseline build of this worktree):

* `4c3485f1c perf(sdk): resolve probe traces without deep-cloning the program`
* `f1783198e perf(sdk): probe return construction faithfully without cloning the program`

Compiler status: profiled end to end, seven optimisation candidates measured, all rejected — see §2 and
§5. No byte-identical compiler win is currently available; the one remaining lever (§5 item 2) is a ~10 %
admission refactor that changes the parking design.

## 1. SDK transaction building — landed, measured

Target workload: the passing marketplace title `job posting > post job 1`, which builds the routed
26-input / 36-output `__forward` transaction (the state-derivation path).

| metric (same machine, same build options) | baseline | `4c3485f1c` | `f1783198e` |
|---|---|---|---|
| vitest `Duration` for `post job 1` | 26.72 s | 18.31 s | **17.05 s** |
| vitest reported `tests` time | 21.89 s | 13.39 s | **11.75 s** |
| `__forward` derive passes (`SOLIDC_DEBUG_BUILDER_TIMING=1`) | 10 860 ms | 2 470 ms | **805 ms** |
| derive pass 1 (slow invocation) | 5 209 ms | 1 824 ms | **205 ms** |
| derive pass 2 (same invocation) | 5 480 ms | 495 ms | **450 ms** |

Both costs were found with a CPU profile of the marketplace worker (`--cpu-prof` routed through the
marketplace vitest config's `execArgv`; `NODE_OPTIONS` alone does not reach vitest's fork pool).

1. **Exception-driven pushdata rejection (≈3.2 s).** `selectEvmScalarReturnCommitment` /
   `extractPendingReturnCommitment` / `selectEvmReturnCommitment` try `decodePushdataValue(candidate, 0,
   'bytes')` on every stack item of the last 32–96 trace states. Ordinary frame items (state values,
   hashes, scripts) are not pushes, so `decodeGenericPushdata` *throws*, and each throw captures a stack
   trace. `peekPushdataEncodedLength` resolves the push length from the prefix alone, so a rejection is a
   byte comparison. Verified equivalent: it mirrors the decoder's acceptance exactly (including the
   one-byte constant opcodes) and only survivors reach the decoder. `Uint8Array.from` copies of the
   candidates were also unnecessary — the extractors only read them.

2. **`debug()` deep-clones the program at every instruction (≈4.8 s).** The faithful path in
   `evaluateProbeTrace` (`forceFullDebug`, taken for runtime-loop transfers above ordinary capacity)
   used libauth's `vm.debug()`. `partiallyCloneProgramState` `structuredClone`s every state key outside
   `instructions`/`program` and the four shallow arrays — and on BCH-2026 the state carries
   `functionTable`, the whole OP_DEFINE'd body table. A 6,132-state probe measured **2,400 ms**, ~99 %
   of it inside `structuredClone`.

   `createFaithfulTraceVmForProvider` (new, `network/createVirtualMachine.ts`) observes every opcode of
   the *same* instruction set with shallow state snapshots that mirror `partiallyCloneProgramState`
   except for the append-only `functionTable`, disables the sparse observer's inactive-branch skip, and
   reports each evaluation phase's exit state. The resulting trace is state-for-state identical to
   `debug()`'s, in **36 ms** for the same 6,132 states (~65×).

3. **Two `debug()` return-probe fallbacks (≈1.5 s).** `_deriveFullTransactionState` re-probes a return
   program with `vm.debug()` when the sparse observer cannot expose the return commitment (before the
   return output comparison and after an event install). Both now call `evaluateFaithfulOrDebugTrace`,
   which uses the shallow recorder above ordinary capacity and keeps `debug()` below it — the recorder is
   only equivalent while the cached P2SH evaluator supplies the phase exits, and that evaluator is
   installed exactly when `maximumInputBytes > 10_000`, so a live network is untouched.


### Evidence

* `SOLIDC_DEBUG_TRACE_PARITY=1` runs both producers and compares every state's `ip`, instruction count,
  `error`, stack, alternate stack, and control-stack depth. Parity held on every trace measured on the
  passing titles: `post job 1` (6,132 / 6,080 states, plus the return-probe fallback added by
  `f1783198e`), `post two jobs` (6,463 / 6,411 / 5,991 ×2 / 1,649 ×4), `post job with whitelist`
  (6,463 / 6,411), `post job with invalid mece tags` (6,286 / 6,196 / 6,506 ×2 / 6,454 ×2) — all
  `{ equal: true }`.
* `yarn workspace solidcash test:fast`: 6 failed / 1,136 passed — **identical** to the baseline build of
  the same worktree (same 6 tests, verified by diffing the `FAIL` lines).
* `test/journal-message-bus` + the manifest's `sdk-regressions` selection: 10 failed / 818 passed —
  **identical** to baseline (diffed by test name).

Remaining SDK headroom (not done): the derivation still runs twice per slow invocation (655 ms of the
805 ms). The second pass exists because pass 1 reports `vmErrored` / `dynamicLayoutChanged`; collapsing
it is a correctness-sensitive change, not a pure perf change.

## 2. Compiler — profiled, no change landed yet

`node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs --kernel` →
**6.05–6.53 s** for `MarketplaceV1` (route 12,136 B, full bytecode 125,939 B, 39/39 handlers eligible).
This is the metric `scripts/marketplace-scoreboard.mjs` uses.

**The compiler is not on the critical path of a marketplace test run while the artifact cache is warm** —
verified by checking that no file under `.marketplace/artifacts` is rewritten during a run. The one
60 s outlier observed here was Vite `transform` 27.5 s + `import` 29.5 s under a concurrent sibling test,
not compilation. A *compiler* change invalidates the artifact context
(`compilerJavaScriptFingerprint` over `solidc` + `@solidcash/utils` dist) and then pays one full project
compile.

`scripts/perf-project-compile.mjs` (new) compiles all ten compiling marketplace roots **in one
process**, with both artifact caches disabled, and prints per-root bytecode hashes:

    total 19,699 ms over 10 roots
      MarketplaceV1.sol            5790 ms   full=125939 hash=554bc928d66a074d
      MarketplaceV2.sol            3188 ms   full=132379 hash=cbf327743ea0213d
      MarketplaceV3.sol            2703 ms   full=132221 hash=954760ffc7fc0570
      MarketplaceDataV1.sol        2370 ms   full= 47514 hash=9e7933bd4080414f
      EACCToken.sol                1768 ms   full= 16135 hash=6a0c5789fb670710
      TreasurySplit.sol             363 ms   full=  4430 hash=08f450b7730320cb
      unicrow/FakeToken.sol         727 ms   full= 13187 hash=c3ad4e30c98faff2
      unicrow/UnicrowDispute.sol    885 ms   full= 16031 hash=26ac453ad76d617f
      unicrow/UnicrowArbitrator.sol 1082 ms  full= 14469 hash=679981b007d4ec6b
      unicrow/UnicrowClaim.sol      817 ms   full= 14642 hash=5050603c265910cb

Aggregated `SOLIDC_PROFILE=1` labels for that run (overlapping, so they do not sum to the total):

    multi-contract (sum of roots)    17,899 ms
      full-recompile (9 of 10)       10,872 ms   55 %
      admission (10, discarded)       5,757 ms   29 %
      resolved:codegen                5,909 ms   30 %
      resolved:lowering               5,166 ms   26 %
      codegen:emitBodies              4,464 ms   23 %
      singlePass:verifier (24 emits)  2,497 ms   13 %
      resolved:semantic               2,441 ms   12 %
      resolved:symbol                 2,100 ms   11 %
      parseAndResolve/multi-probe     2,091 ms   11 %
      outline                         2,638 ms   13 %

The single-root phase tree (`scripts/profile-marketplace-compile.mjs --kernel`) is:

    compileStringUnchecked                                4,983 ms
      compileWithExternalAdmissionFallback (discarded)    1,559 ms
      compileResolvedAst (the shipped artifact)           3,413 ms
        GenerateTargetTraversal emission                  1,205 ms
          emitFunctionDefinesAndDispatch                    699 ms
            outlineSharedFunctionBodies / outlineSharedSpans 461 ms
          subroutineUseProbe                                416 ms
            (a second, dry-run emitFunctionDefinesAndDispatch 344 ms)
        SymbolTableTraversal                                529 ms
        synthesizeMessageBusRoute                           313 ms
        GC                                                  309 ms
      parseAndResolve                                       763 ms
      compileDetachedMessageBusVerifier                     400 ms

The self-time profile is flat (per file: codegen 14.9 %, antlr4 12.4 %, GC 4.6 %, outline 9.5 %,
symbol table 9.3 %; largest single function `outlineSharedSpans` 4.0 %), so there is no hot function to
fix. The large items are structural:

* **The source is compiled twice per root** (a discarded cheap admission at 29 %, then the shipping
  compile at 55 %). This looks like free money and is not: `--no-cheap-admission` on
  `scripts/perf-project-compile.mjs` (which sets `__cheapAdmissionCodegen: false`, i.e. one ladder with
  full codegen instead of a cheap search followed by a full recompile of the winner) measured **32,848 ms
  vs 19,699 ms** and **changed the emitted bytecode for most roots** (`MarketplaceV1` route
  `9e14bab0…`/full `229fdc7e…` instead of the shipped `554bc928…`; `MarketplaceDataV1` route 12,169 B
  instead of 12,130 B). The cheap pass is what lets the ladder pick a winning shape without replaying
  rungs as full compiles, and it lands on a different (smaller) winner than the naive ladder. Do not
  revisit this without reading `compileWithExternalAdmissionFallback` end to end.
* **`subroutineUseProbe` dry-runs the whole emission** (416 ms per root, ~8 % of a compile) purely to
  count subroutine sites. It cannot simply skip byte appends: `emitWithSpan`, `sub.output.length` checks
  and the dead-DEFINE splice all read the emitted length while probing. The self-contained target is a
  direct census over the lowered AST, or memoizing the census on a stable contract identity.
* **The detached verifier is emitted 24 times for 10 roots** (2.4 per root, 13 %) with *different*
  generated sources per attempt (measured: 46,098 / 46,098 / 46,298 bytes, three distinct hashes for one
  root), so the existing memo legitimately misses. Only reusing the winning attempt's verifier source
  removes it. Note the per-emit cost falls from ~275 ms to ~75 ms once the process is warm, so this is
  JIT-heavy work, not redundant work across roots.
* **Multi-root project compiles re-parse the import graph per root** — but that is only ~10 % of the
  project compile (`parseAndResolve` 2,091 ms / 19,699 ms), so a cross-root parse cache would buy ~5 %
  at most for a nontrivial AST-sharing change. Measure any candidate with
  `scripts/perf-project-compile.mjs` and check the per-root bytecode hashes above are unchanged.

## 3. Reproducing the measurements

    cd /Code/cashscript/.worktrees/kernel-beta-perf
    yarn build
    npx vitest run --config vitest.marketplace.config.ts -t 'post job 1$'
    SOLIDC_DEBUG_BUILDER_TIMING=1 npx vitest run --config vitest.marketplace.config.ts -t 'post job 1$'
    SOLIDC_DEBUG_TRACE_PARITY=1 npx vitest run --config vitest.marketplace.config.ts -t 'post two jobs$'
    node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs --kernel
    SOLIDC_PROFILE=1 node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs --kernel
    node --max-old-space-size=8192 scripts/perf-project-compile.mjs
    SOLIDC_PROFILE=1 node --max-old-space-size=8192 scripts/perf-project-compile.mjs

Two traps for whoever measures next:

* `NODE_OPTIONS=--cpu-prof` does not reach vitest's forked workers; put `--cpu-prof` in the marketplace
  config's `test.execArgv` (revert it afterwards).
* Run the A/B pair back-to-back on an otherwise idle machine. A sibling session's marketplace run made
  the same optimized test report 60 s (transform 27.5 s / import 29.5 s) instead of 18 s.

## 4. State of this tree

Every command in `scripts/kernel-beta-manifest.json`'s `testCommands` was run on this branch with the two
SDK commits in place:

| gate command | result |
|---|---|
| `yarn build` | clean (run repeatedly, including after the last code commit) |
| `yarn workspace testing-suite vitest run test/artifact-freshness.test.ts` | 2 passed |
| `yarn workspace @solidcash/utils vitest run test/script.test.ts` | 26 passed |
| `yarn workspace solidc vitest run test/journal-message-bus` | 6 failed / 1,442 passed (pre-existing) |
| `yarn workspace solidcash vitest run test/journal-message-bus` + `sdk-regressions` | 10 failed / 818 passed, identical to a baseline build of this worktree (diffed by test name) |
| `yarn workspace solidcash test:fast` | 6 failed / 1,136 passed, identical to baseline (diffed by `FAIL` lines) |
| four passing marketplace titles | all pass: 17.4 s / 18.4 s / 19.7 s / 21.5 s (baseline 27-31 s) |

* `4c3485f1c` — fast pushdata rejection + faithful shallow trace recorder
  (`stateful/StatefulContract.ts`, `network/createVirtualMachine.ts`).
* `f1783198e` — the two `debug()` return-probe fallbacks use the faithful recorder
  (`stateful/StatefulContract.ts`).
* `scripts/perf-project-compile.mjs` — new single-process multi-root project-compile probe with per-root
  bytecode hashes (untracked until the compiler work lands).
* `solidcash.config.ts` — copied from the candidate worktree so this fork compiles kernel-mode.
* `examples/testing-suite/artifacts/golden_token.*` — regenerated by `yarn build` here
  (`sourceEffectOrder: "linear"` added by the current compiler); unrelated to the perf change.
* Temporary profiling hooks: none left in tracked files. The diagnostics kept in the SDK are env-gated
  (`SOLIDC_DEBUG_PROBE_TRACE_TIMING`, `SOLIDC_DEBUG_TRACE_PARITY`) and cost nothing when unset.

## 5. What the next round should do about the compiler

The SDK side of the objective is met and measured. The compiler side is profiled but not moved: every
candidate measured so far is either rejected by its own numbers or needs a refactor whose validation cost
exceeds its upside. Round 2 added these results (all on the ten-root project compile, 19,699 ms baseline):

| candidate | measured | verdict |
|---|---|---|
| `__cheapAdmissionCodegen: false` | 32,848 ms, bytecode differs for most roots | rejected |
| widest rung full + `__synthesizeBoundRoutePlaceholder` | 18,792 ms (−4.6 %) but `EACCToken` fails (`single-pass bind: missing __message_bus_verify_atomic`) and `TreasurySplit` output changes | rejected |
| cross-root parse cache | duplicate parses total **944 ms** (4.8 %, ANTLR 649 ms) before ~48 clone costs (est. 250-600 ms) → **net 2-3.5 %** | not worth an AST-sharing change |
| verifier emit memo | per root one generic host emit + one signature-policy-specialized emit, both route-specific; the specialization runs after codegen while the placeholder binding runs before it | no waste to remove |
| `analyseContractInvocations` reuse across AST clones | ~265 ms per root self, two clones per root | ≤3 % for a cache-keying change |
| `subroutineUseProbe` → direct census | already a census: `emit()` returns immediately in probe mode, so the probe's 416 ms is the decision traversal that *produces* the counts and id maps | infeasible |
| admission-shape reuse | the cheap pass parks unemitted functions; lowering them there moves work instead of removing it, so only the ~300 ms overlap is recoverable | ~6 %, deep refactor |
| compile ordering (JIT warm-up) | big-first 22,420/22,189 ms vs alphabetical 21,290/22,857 ms over two repetitions | no effect, noise |

Two operational facts for whoever picks this up:

* **The normal project compile cannot run in this worktree at all — for two independent reasons.**
  `node packages/testing/dist/cli.js compile` fails on `MockSablierLockup.sol`
  (`Cannot resolve import '@sablier/lockup/src/types/DataTypes.sol'`); with that source moved aside it then
  fails on `unicrow/Unicrow.sol` with `Maximum call stack size exceeded` (the compiler crashes on that
  source both inside the project compile and in the single-source probe). The task discards its temporary
  output transactionally, so the marketplace fixture can only be regenerated through
  `.marketplace/iteration/recompile.sh` (per-source `--iteration`). Any compiler change that alters
  bytecode therefore cannot be validated by the ordinary compile path here.
* **Compiler gate baseline on this branch:** `yarn workspace solidc vitest run test/journal-message-bus`
  → 6 failed / 1,442 passed (3 failed files of 74). Pre-existing: this branch has no compiler changes, and
  the SDK commits cannot affect `solidc` tests.
* **Compile ordering is not a lever** (round 3). The project compile's root order looked worth ~25 % in
  single runs (big-first 19.7 s vs alphabetical 26.2 s), but two repetitions each gave big-first
  22,420 / 22,189 ms and alphabetical 21,290 / 22,857 ms — machine noise, not ordering. `--smallest-first`
  is kept in the probe with that annotation so the experiment is not repeated.

Ranked, with the guardrails that make each safe:

1. **`subroutineUseProbe` census — CLOSED, the census already exists.** `emit()` returns immediately when
   `isSubroutineUseProbe` is set (`GenerateTargetTraversal.ts:1689-1693`: "The usage probe only needs
   helper-site counts and compact-id allocation. Appending discarded opcodes and location records
   dominated throwaway body generation on large contracts."), so the probe emits nothing today. Its
   416 ms per root is the *decision traversal*: `emitFunctionDefinesAndDispatch` → `compileBody` /
   `emitFunctionDefine` visit every body, and it is those visitor call sites
   (`invokeSubroutineIfDefined` → `bumpSubroutineUse`, and the id-allocation helpers such as struct-field
   extract / array element / state decode) that produce `subroutineUseCount` and the id maps. A "direct
   census" would have to reimplement that visitor's allocation and profitability decisions — an
   unverifiable duplicate of codegen, not a cheaper counter. The 47 probe runs in a project compile are
   2-3 per contract (one per compile attempt), not repeats of the same work.
2. **Admission-shape reuse — ceiling ≈10 %, not 29 %.** The cheap pass is cheap because it *parks* the
   functions it does not emit (`stubCheapAdmissionBodies` + `parkCheapAdmissionUnkeptMessageBusFunctions`
   skip memory / fn-ptr / assembly / extcall lowering for them). Lowering everything in the admission to
   make its AST reusable would move that work into the admission rather than remove it, so the only
   recoverable part is the overlap (prefix + synthesis + semantic, ~1 s). That is a deep refactor of the
   parking design with a ~10 % payoff.
3. **Nothing else is worth the risk**: parse caching is ≤3.5 % net, the verifier emits are necessary
   (one generic host emit + one signature-policy-specialized emit per root, both route-specific), and
   every remaining self-time entry is a long tail (largest single function 4 %).

**Round-2 conclusion: no compiler optimisation has been found that is both byte-identical and worth
landing.** Anything further changes emitted bytecode (a size/speed trade that needs the fixture
regenerated through `recompile.sh` and the corpus re-baselined) or requires the admission refactor in
item 2. The measurements to reproduce that judgement are all in this file and in
`scripts/perf-project-compile.mjs`.

The one *large* compiler number available is a size/speed trade, recorded here so it is a decision rather
than a discovery: `outlineSharedFunctionBodies` runs several strategy probes per emission and the
follow-up probes on `MarketplaceV1` add 5,512 bytes of savings (117,877 vs 112,365) for ~240 ms. Skipping
them under `optimizeForCompilationSpeed` would buy roughly 4 % compile time for a 4.4 % larger script
(125,939 B → ~131 KB) on every root — and for kernel routes the route bytecode is the covenant's active
bytecode, so that is not a free trade.

Every compiler candidate must be measured with `scripts/perf-project-compile.mjs` (total **and** per-root
hashes) before and after, then held to `yarn workspace solidc vitest run test/journal-message-bus` (the
manifest's compiler gate) and the four passing marketplace titles.

