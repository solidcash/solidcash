# Performance handoff — kernel-beta marketplace path

Worktree `/Code/cashscript/.worktrees/kernel-beta-perf`, branch `grok/message-bus-kernel-beta-perf`
(forked from `grok/message-bus-kernel-beta` at `46d682882`). This worktree exists because the
candidate worktree is shared with another active session; nothing here touches that tree.

Landed (SDK only, both verified against a baseline build of this worktree):

* `4c3485f1c perf(sdk): resolve probe traces without deep-cloning the program`
* `f1783198e perf(sdk): probe return construction faithfully without cloning the program`

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
  compile at 55 %). The only ≥20 % win is to make the winning admission's lowered AST reusable by the
  final compile, or to make the cheap admission cheaper still. Deep and correctness-adjacent; the cheap
  pass must still synthesize the route and emit its own verifier program because the "is this artifact
  shippable" decision reads `artifact.messageBus.verifierProgram`.
* **`subroutineUseProbe` dry-runs the whole emission** (416 ms per root) purely to count subroutine
  sites. It cannot simply skip byte appends: `emitWithSpan`, `sub.output.length` checks and the
  dead-DEFINE splice all read the emitted length while probing. The self-contained target is a direct
  census over the lowered AST, or memoizing the census on a stable contract identity.
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

The SDK side of the objective is met and measured. The compiler side is profiled but not yet moved, and
the evidence above says the remaining wins are concentrated in the **discarded cheap admission compile
(29 % of a project compile)** and the **shipping compile's codegen (30 %)** — not in parsing (10 %) and
not in any single hot function. Ranked, with the guardrails that make each safe:

1. **Reuse the admission winner's lowered AST** (target: 20-30 % of the project compile). The cheap pass
   currently stubs bodies, so the final compile re-runs lowering, symbols and semantics. Removing the
   stubbing would make the admission expensive, so the change has to keep the cheap decision cheap while
   giving the final compile a valid prefix to resume from. Validate with the per-root bytecode hashes in
   `scripts/perf-project-compile.mjs` plus `yarn workspace solidc vitest run test/journal-message-bus`
   (the manifest's compiler gate) and the marketplace titles.
2. **Replace `subroutineUseProbe` with a direct census** (target: ~8 % of a compile, 416 ms per root).
   Self-contained, but the probe's emission decisions read the emitted length, so the census has to be
   proven to produce the same `subroutineUseCount` and the same id assignments before it can replace the
   dry run. The double-entry cache pattern already used by `functionReferenceIds`/`invokedFunctionIds` is
   the precedent to follow.
3. **Leave the verifier emits and the parse path alone** unless a measurement says otherwise: the verifier
   sources differ per attempt (memo misses are legitimate and the per-emit cost falls to ~75 ms warm),
   and cross-root parsing is ~10 % with a ~5 % ceiling for a real AST-sharing change.

