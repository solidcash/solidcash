# Performance handoff — kernel-beta marketplace path

Worktree `/Code/cashscript/.worktrees/kernel-beta-perf`, branch `grok/message-bus-kernel-beta-perf`
(forked from `grok/message-bus-kernel-beta` at `46d682882`). This worktree exists because the
candidate worktree is shared with another active session; nothing here touches that tree.

Landed:

* SDK (both verified against a baseline build of this worktree):
  * `4c3485f1c perf(sdk): resolve probe traces without deep-cloning the program`
  * `f1783198e perf(sdk): probe return construction faithfully without cloning the program`
* Compiler:
  * `e531d63a0 perf(solidc): cache imported parses and add a size-bounded outline mode`
  * `ae41b056b revert(solidc): drop the size-bounded outline mode, keep the parse cache`

Compiler status: only the byte-identical parse cache is landed; the outline mode needed a new flag
and is reverted (§0). Nine candidates in total have been measured, all rejected except the cache.

## 0. Compiler work landed in rounds 4-7

**Landed: route admission compiles its first rung once, in its shipping shape** (round 7, no new option).
A speed-hint message-bus compile used to walk the ladder twice: a cheap pass with stubbed bodies that only
had to reveal which rung compiles, then a full compile of that winning shape - and for every root that
still lacked a bound verifier, a third pass through the verifier-binder. The shape the winner recompile
produces is reachable in one pass, because `__synthesizeBoundRoutePlaceholder` binds the detached verifier
inline, and a route bound in the pass that synthesized it needs no binder recompile at all. So
`compileStringUnchecked` now compiles the ladder's *first* rung (widest external route when the bus is
explicitly requested, first public-only route rung under automatic selection) with full bodies in that
shipping shape, and skips both the stubbed search and the winner recompile when it yields a route.
Anything it refuses - including a source that synthesizes no route at all - falls through to
`compileWithExternalAdmissionFallback`, which keeps ownership of attribution, per-handler quarantine
retries, and the narrower rungs; the cheap-widest-rung `rejectFreeFunctionMissingReturns` gate is applied
to the first-rung attempt so a source with an uncovered returning free helper still falls through to the
public-only rungs exactly as before.

Measured on the ten-root project compile as interleaved A/B pairs, with the baseline half produced by
`git checkout HEAD~1 -- packages/solidc/src/compiler.ts` and the two halves run alternately. CPU time
(user+system, per root, median of three pairs) is the load-independent half of the measurement and is what
the verdict uses - wall clock on this shared machine swings ±15 % between identical runs. An earlier run of
the same A/B, taken while a sibling session pushed absolute CPU ~1.6× higher, read −30.2 % as its median;
the clean pairs below read −25.7 %, −17.2 % and −14.3 %, so the honest headline is **−17.7 %**, not the
inflated earlier figure:

| | baseline | first rung | delta |
|---|---|---|---|
| total CPU (median of three clean pairs) | 33,028 ms | **27,171 ms** | **−17.7 %** |
| total wall (same pairs) | 18,553 ms | 15,433 ms | −16.8 % |
| MarketplaceV1 | 10,875 ms | 8,690 ms | −20.1 % |
| MarketplaceV2 | 5,713 ms | 4,572 ms | −20.0 % |
| MarketplaceV3 | 4,263 ms | 3,307 ms | −22.4 % |
| MarketplaceDataV1 | 2,896 ms | 3,178 ms | +9.7 % |
| EACCToken | 2,780 ms | 2,906 ms | +4.5 % |
| TreasurySplit | 530 ms | 499 ms | −5.8 % |
| unicrow/FakeToken | 1,096 ms | 817 ms | −25.5 % |
| unicrow/UnicrowDispute | 2,304 ms | 949 ms | −58.8 % |
| unicrow/UnicrowArbitrator | 1,777 ms | 1,372 ms | −22.8 % |
| unicrow/UnicrowClaim | 1,116 ms | 923 ms | −17.3 % |

Every root's non-route bytecode is **unchanged**: nine of ten match the fixture hash-for-hash
(`debug.bytecode` and the SCB1 route body), and `TreasurySplit`'s route body shrinks 1,318 → 1,279 B
(−0.9 % of a 4,430 B artifact) because it now ships the single-pass bound route instead of the two-phase
one. That is inside the ±5 % budget and the fixture was regenerated for it; the regenerated
`TreasurySplit.json`/`.artifact.ts` differ from the previous pair only in the route body and everything
derived from it (`bytecode`, `debug.bytecode`, `functionBodies['53434231']`, that function's
`debug.functionDebug` source map and require IPs) - no ABI, layout or fingerprint change.

The refusal path costs little: a source the first-rung attempt refuses pays that attempt *and* the
ordinary ladder, but the cheap-widest-rung gate refuses `EACCToken` on the *pristine* AST in 5 ms
(`MessageHashUtils.toEthSignedMessageHash` has an uncovered return path, so the source is not widest-rung
admissible at all), which is why its delta is +4.5 % rather than the +14 % an earlier build measured before
that gate existed. `MarketplaceDataV1`'s +9.7 % is of the same order as this machine's per-root spread and
is not a stable signal; the route-less/refused class as a whole stays within a few percent of baseline,
and the source is still compiled correctly - the ladder decides, exactly as before. The
first-rung attempt also only runs for callers that pass `optimizeForCompilationSpeed`, so the default test
matrix is untouched: `KERNEL`-style options (`{ forceStateful, messageBus, messageBusKernel }`) never set
`__cheapAdmissionCodegen` and are byte- and timing-identical.

The win is not marketplace-specific. Compiling the `KernelAdmission` test's own heavy stateful source
standalone takes 53.7 s / 48.7 s with the test's options; adding only `optimizeForCompilationSpeed: true`
- which is what the corpus config sets - takes it to 26.9 s / 22.9 s with the fast path active
(`admission-first-rung`, no binder pass) and 6,948 → 6,915 B of bytecode.

Gates run on the landed code: full `solidc` suite 225 failed / 4,810 passed against a 224 failed / 4,811
passed baseline. The single delta is
`KernelAdmission.test.ts > keeps resource recurrence sources fenced and exactly replays truncating and
local deltas`, a 50 s heavy compile against a 60 s per-test timeout: it passes in isolation on both builds,
and running the whole `KernelAdmission.test.ts` file alone gives the **same one failure** (a different,
713 ms test) on the baseline and on this build. That test's options never set
`optimizeForCompilationSpeed`, so the new path cannot run in it - verified by compiling its exact source
with its exact options and observing no `admission-first-rung` profile event. The earlier loaded full run
additionally timed out `KernelLoopRoute > source-ordered non-associative recurrence rows`, which passes in
isolation and whose options likewise never set the speed hint. SDK gates (`test:fast` 6 failed / 1,136
passed; journal 9 failed / 630 passed; sdk-regressions 1 failed / 188 passed), `testing-suite`
artifact-freshness (2 passed) and `@solidcash/utils` script (26 passed) are identical to their baselines,
and the four passing marketplace titles are green in one 27.3 s run (20.0 s of test time).

**Landed and kept: the cross-root parse cache** (`e531d63a0`, `parseImportedFileCached` in
`compiler.ts`, used by `ImportResolver`). A project compile resolved the same import graph once per
root; the cache keeps a bounded LRU of pristine parse trees and returns an independent clone on a
hit - the same clone-on-hit trade the multi-declaration compiler already makes with
`cloneAst(probe, 'multi-primary')`. No new option; **byte-identical**: all ten per-root route/full
hashes match the pre-change run. Measured: `parseAndResolve` 2,091 → 1,728 ms and `parseCode:file`
261 → 136 calls on the ten-root project compile. The full `solidc` suite differs from a baseline
build of this branch by exactly one 60 s timeout under full parallel load (that test passes in
isolation with the cache, twice); the compiler journal gate is unchanged.

**Landed: the ordinary outlining search stops after two rounds** (`6fc9c83e6`), with **no new option** -
an earlier `outlineThoroughness` flag was removed on instruction, so the behaviour is unconditional and
`CompilerOptions` is back to its previous shape. Rounds 2-5 recover 11.3 KB at 34 B/ms against 500+ B/ms
for round 0, and stopping after round 1 also removes the downstream work those extra outlined functions
created. Measured as CPU-profile self time, minimum of two runs each, on the ten-root project compile:

| | thorough | capped |
|---|---|---|
| `outline.js` | 2,205-2,267 ms | **1,647-1,660 ms** |
| GC | 1,709-1,752 ms | **1,310-1,409 ms** |
| busy CPU total | 21,610-22,011 ms | **19,423-19,588 ms (−10.5 %)** |

Per-root bytecode versus the previous behaviour is **equal or smaller** (MarketplaceV1/V2/V3, EACCToken
and TreasurySplit unchanged; MarketplaceDataV1 −0.26 %, Claim −0.57 %, Arbitrator −0.62 %, Dispute
−0.45 %, FakeToken +0.01 %), so this uses none of the ±5 % budget. The nested compiler-helper pass is
kept deliberately: it is pinned by `VMapBytecodeOptimizations > nests only compiler-authored helpers
while sharing composite array traversal`, and removing it was what pushed bytecode up to +4.99 %.

**Do not retry the obvious substitute.** Keying that behaviour on the existing
`optimizeForCompilationSpeed` looks equivalent and is not: `compileResolvedAst` forces
`optimizeForCompilationSpeed: true` into the codegen traversal for *every* kernel compile
(`messageBusKernel` defaults to true in `normalizeCompilerOptions`) precisely so that "bytecode size
does not depend on the front-end compilation-speed preference" (`compiler.ts:12037-12045`). Keying
on it therefore changes bytecode for every compile regardless of what the caller passed, and it
breaks `test/VMapBytecodeOptimizations.test.ts > nests only compiler-authored helpers while sharing
composite array traversal` (4 of that file's 8 tests fail in isolation), which pins the nested pass
and never sets the flag. So the outline speed-up is only reachable through a new flag - which is
exactly why it is not landed.

The marketplace fixture is restored to the artifacts this compiler produces (verified: per-root
route/full bytes match the compile exactly) and the four passing titles are green at
12.0 / 14.6 / 12.0 / 13.2 s of test time.

### Round 5: the walk sweep (what pays and what does not)

A CPU profile of the ten-root project compile is a long tail of reflective AST walks. Three rewrites were
tried; only one is kept (`4473add0d`):

| change | measured | kept |
|---|---|---|
| `isExternalCallSlotLoopNested`: one loop-context walk per body instead of one per slot | walk self 219 ms → below the top-walk threshold (~200 ms) | **yes** |
| `findExistingSerials`: `for...in` + `Object.hasOwn` instead of `Object.values` + `forEach` | **38 % slower** (minimum 213 → 295 ms over two runs) | no |
| runtime-loop effect walk: hoisted excluded-key `Set` instead of a per-node array literal | 132 → 126 ms, inside noise | no |

The lesson for whoever continues: the wins in this code are **algorithmic** (one walk answering N
queries), not enumeration micro-tuning — V8 handles `Object.entries`/`Object.values` better than a
guarded `for...in` on these node objects. Do not sweep the ~24 remaining `Object.entries` sites in
`GenerateTargetTraversal.ts` expecting a gain.

Remaining measured items after this round (project compile ≈ 21 s of CPU):

| item | size | note |
|---|---|---|
| `findCandidates` (`utils/outline.ts`) | 978 ms self, all inside one function | outline's candidate discovery; a rewrite is byte-verifiable against the per-root hashes but it is the most tuned code in the repo |
| `walkInvocationAst` | 849 ms | already allocation-free (`for...in` + chained comparisons); cost is the traversal itself, run once per AST clone (2 per root) |
| `findTupleInit` + `findLocalInit` | 193 + 120 ms | per-(body, name) searches; memoizing is only sound if the pass's in-place rewrites cannot invalidate entries |
| transfer-index walk, `walkNodes`, `inspect`, `claim` | 100-165 ms each | long tail |

### Round 6: where the remaining time actually is (all measured, none landed)

With the parse cache, the slot-walk fix and the outline speed mode in place, the ten-root project compile
is ~21 s of CPU. Everything below was measured with the CPU profiler at a 250 us interval and, for the
function-level comparisons, as the **minimum self time over two runs** (single runs on this box vary by
more than the effects being chased).

| target | measured | verdict |
|---|---|---|
| `walkInvocationAst` (977 ms, the largest single function) | replacing its 15-term chained key comparison with a module-level `Set` measured **977 → 1,183 ms** | rejected; the chained comparison on interned strings wins |
| `findExistingSerials` (267 ms) | prefix guard before the serial regex measured 267 → 260 ms minimum | neutral, reverted |
| `findCandidates` (1,322 ms across 306 calls, broken down in-function) | `extend` 449 ms, `bucket` 447 ms, `hashes` 184 ms, `rank` 122 ms, `split` 120 ms | a typed-array bucket rewrite targets ≤250 ms (≈1 % of the compile) in the most tuned code in the repo; not attempted |
| test-run async idle | `MockNetworkProvider` and the solidhat/testing network layer contain **no** `setTimeout`, `setImmediate`, `await new Promise` or queue; the focused run's ~6 s of non-test time is bootstrap (transform/setup/import) plus worker idle, not an injectable delay | nothing to remove |

The only remaining double-digit candidate is the admission fast path: run the widest rung as the
single-pass placeholder bind (what the shipping recompile already does) *before* paying the cheap
search, falling back to the existing ladder when it throws. The ungated version measured −4.6 %
end-to-end but is not equivalent (`EACCToken` has no route and fails on
`single-pass bind: missing __message_bus_verify_atomic`, and some roots' route bytes change), so a
landable version needs a message-bus-graph-edge gate plus a full-suite and fixture regeneration cycle.

### Incident to know about (no harm done)

`.marketplace/iteration/recompile.sh` has **hard-coded paths to the candidate worktree**
(`/Code/cashscript/.worktrees/kernel-beta-candidate/...`), so running it from this fork
regenerates the *other* session's fixture with the *other* session's compiler. That happened once
here. The rebuilt files differ from the pre-run snapshot only in `updatedAt` (bytecode,
fingerprints and all other keys identical), so nothing functional changed in that tree - but use a
local script for regeneration instead of that file.


### Round 8: the flat tail (measured, nothing landed)

With route admission and outlining both cut, the remaining profile is flat - no single frame above 4 % self
time - so round 8 measured the two candidates §0 and §5 had named, and both were rejected on their numbers.

A CPU profile of the ten-root project compile on the landed build (main thread, 19.7 s sampled of ~34 s
process CPU; the difference is background GC/JIT threads) has this inclusive shape:

| frame | inclusive | share |
|---|---|---|
| `compileStringUnchecked` | 15.62 s | 79 % |
| `compileResolvedAst` | 14.02 s | 71 % |
| AST visitor dispatch (`accept`) | 9.29 s | 47 % |
| codegen `visitSourceFile` | 4.51 s | 23 % |
| symbol table `visitSourceFile` | 2.15 s | 11 % |
| detached verifier compile | 2.11 s | 11 % |
| `outlineSharedFunctionBodies` | 1.64 s | 8 % |
| GC | 1.56 s | 8 % |
| `subroutineUseProbe` | 1.40 s | 7 % |
| `synthesizeMessageBusRoute` | 1.05 s | 5 % |

* **GC / young-generation tuning - no code-level win found.** Raising the semi-space
  (`--max-semi-space-size=64`) moves the corpus from 31,409/29,961 ms to 28,927/28,765 ms, i.e. about 5 %, but
  that is a runtime flag, not a change this package can make, and it is the *only* allocation-side lever that
  responded. The tail is not a few big allocators that could be pooled away.
* **`findCandidates` bucketing - rewritten, byte-identical, and still a wash.** The loop looked up three maps
  per window (a bucket map plus separate first-body/first-start maps) and leaked two lookups per unique hash.
  Replacing all three with one map whose value is either a packed first occurrence or the group array - with a
  separate `seeded` list to preserve second-occurrence bucket order exactly - is **byte-identical on all ten
  roots** (verified against the fixture), so the semantics were never in question. Measured over five
  interleaved pairs it still did not pay: paired CPU deltas −8.4 %, −5.0 %, +0.1 %, +3.9 %, +2.7 % (median
  +0.1 %, spread ±8 %). A `Map` holding mixed SMI and array values costs back roughly what the two saved
  lookups buy. Reverted, not landed - do not re-try it as a "free" change.
* **`subroutineUseProbe`'s dry run is the largest remaining single item (7 % inclusive) and is not a
  rewrite target.** It is not one hot loop: its whole subtree is 415 ms of self time on the largest root,
  spread across `walk` (112 ms), `hasRuntimeLoopEntryWrite` (21 ms), `scan` (21 ms), `hasChunkableMappingWrite`
  (13 ms), `collectMappingSlots` (13 ms) and a long tail. It re-walks the contract to count subroutine uses
  *before* ids can be assigned, and it also discovers the structural-helper maps the real emission then reuses,
  so a census would have to reproduce the emission's own helper-capture decisions to be equivalent. Measured,
  understood, and left alone.

### Incident to know about (round 7, no harm done)

A round-7 A/B script used `git stash push packages/solidc/src/compiler.ts` to produce its baseline half
after that change had already been committed. With nothing to stash, the push was a silent no-op and the
matching `git stash pop` took the top entry off the **repository-wide** stash stack - another session's
`copywithin-ab-2` (`packages/utils/src/outline.ts`, `packages/utils/test/outline.test.ts`). The pop
conflicted, so git kept the entry, and the only damage was two files in this worktree, restored with
`git checkout HEAD -- <paths>`. `git stash list` afterwards still shows all seven pre-existing entries with
the same hashes, and `git reflog show stash` shows no drop. Two lessons, both now written into the
reproduction section: the stash stack is shared across worktrees, and an A/B baseline belongs on
`git checkout HEAD~1 -- <path>`.

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
* **Multi-root project compiles re-parse the import graph per root** — landed as the cross-root parse
  cache in round 4 (`e531d63a0`), which also made the estimate below obsolete. Measure any candidate with
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

For a compiler A/B, produce the baseline half with `git checkout HEAD~1 -- packages/solidc/src/compiler.ts`
(restore with `git checkout HEAD -- ...`) and run the halves alternately (`base new base new`). **Do not
use `git stash` for this in this repository**: the stash stack is shared by every worktree and every agent
session, and `git stash push <path>` on a path with no local changes is a silent no-op whose matching
`git stash pop` then consumes whichever entry another session happens to have left on top (see the incident
below). Judge with **`totalCpuMs`/`cpuMs`**, not `totalMs`.
Both drift with the machine's external load between pairs, but CPU time is insensitive to preemption
*within* a pair, so paired CPU deltas keep their sign where paired wall-clock deltas do not. Round 7's
three pairs read −15.1 % / +14.5 % / −13.4 % in wall clock against −2.6 % / −30.2 % / −18.2 % in CPU time;
the pair with the small CPU delta is also the pair whose absolute CPU was ~1.9× the others, i.e. the one
taken while a sibling session was heaviest, where cache and memory contention inflates CPU time too.
Treat any pair whose absolute CPU is far above the others as unusable rather than averaging it in.

## 4. State of this tree

Every command in `scripts/kernel-beta-manifest.json`'s `testCommands` was run on this branch with the two
SDK commits in place:

| gate command | result |
|---|---|
| `yarn build` | clean (run repeatedly, including after the last code commit) |
| `yarn workspace testing-suite vitest run test/artifact-freshness.test.ts` | 2 passed |
| `yarn workspace @solidcash/utils vitest run test/script.test.ts` | 26 passed |
| `yarn workspace solidc vitest run test/journal-message-bus` | 6 failed / 1,442 passed (pre-existing) |
| `yarn workspace solidc vitest run` (full suite, round 7) | 225 failed / 4,810 passed vs a 224 failed / 4,811 passed baseline; the single delta is a 60 s-timeout-sensitive heavy compile that passes in isolation on both builds and whose options never set `optimizeForCompilationSpeed` (§0) |
| `yarn workspace solidcash vitest run test/journal-message-bus` + `sdk-regressions` | 10 failed / 818 passed, identical to a baseline build of this worktree (diffed by test name) |
| `yarn workspace solidcash test:fast` | 6 failed / 1,136 passed, identical to baseline (diffed by `FAIL` lines) |
| four passing marketplace titles | all pass: 17.4 s / 18.4 s / 19.7 s / 21.5 s (baseline 27-31 s); re-run together after round 7 in 27.3 s total (20.0 s of test time) |

* `scripts/perf-project-compile.mjs` — single-process multi-root project-compile probe with per-root
  bytecode hashes and per-root CPU accounting. The CPU columns are what round 7's verdict uses: wall
  clock on this shared machine swings ±15 % between identical runs, user+system time does not.
* Round 7's compiler change is in `packages/solidc/src/compiler.ts` (`compileStringUnchecked`, the
  first-rung admission block above `compileWithExternalAdmissionFallback`).

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

The SDK side of the objective is met and measured, and the compiler side has since moved: rounds 4-7
landed the cross-root parse cache, the slot-walk rewrite, the outline-round cap and the first-rung route
admission (§0). What follows is the round-2/round-6 record of what was tried and rejected, kept so the
same experiments are not repeated. Round 2 added these results (all on the ten-root project compile,
19,699 ms baseline):

| candidate | measured | verdict |
|---|---|---|
| `__cheapAdmissionCodegen: false` | 32,848 ms, bytecode differs for most roots | rejected |
| widest rung full + `__synthesizeBoundRoutePlaceholder` **for every root, with no fallback** | 18,792 ms (−4.6 %) but `EACCToken` fails (`single-pass bind: missing __message_bus_verify_atomic`) and `TreasurySplit` output changes | rejected as written; **landed in round 7** as a first-rung attempt that falls back to the ordinary ladder when it is refused (see §0) |
| cross-root parse cache | duplicate parses total **944 ms** (4.8 %, ANTLR 649 ms) before ~48 clone costs (est. 250-600 ms) → **net 2-3.5 %** | landed as `e531d63a0` (§0) |
| verifier emit memo | per root one generic host emit + one signature-policy-specialized emit, both route-specific; the specialization runs after codegen while the placeholder binding runs before it | no waste to remove |
| `analyseContractInvocations` reuse across AST clones | ~265 ms per root self, two clones per root | ≤3 % for a cache-keying change |
| `subroutineUseProbe` → direct census | already a census: `emit()` returns immediately in probe mode, so the probe's 416 ms is the decision traversal that *produces* the counts and id maps | infeasible |
| admission-shape reuse | the cheap pass parks unemitted functions; lowering them there moves work instead of removing it, so only the ~300 ms overlap is recoverable | ~6 %, deep refactor; superseded by the first-rung admission landed in round 7 (§0), which removes the whole cheap pass and the binder recompile instead of sharing work with them |
| compile ordering (JIT warm-up) | big-first 22,420/22,189 ms vs alphabetical 21,290/22,857 ms over two repetitions | no effect, noise |
| `findCandidates` single-map bucketing (round 8) | byte-identical on all ten roots, five interleaved pairs: −8.4 %, −5.0 %, +0.1 %, +3.9 %, +2.7 % CPU (median +0.1 %) | rejected, reverted |
| semi-space / GC tuning (round 8) | `--max-semi-space-size=64` 31.4/30.0 s → 28.9/28.8 s (~5 %) | runtime flag, not a package change; no code-level allocator to remove |

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

