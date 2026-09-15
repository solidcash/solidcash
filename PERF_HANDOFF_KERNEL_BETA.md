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

Measured on the ten-root project compile as interleaved A/B pairs: the baseline half is
`git checkout f0ed22319 -- packages/solidc/src/compiler.ts` (the commit before the change - **not**
`HEAD~1`, see the trap below), the two halves run alternately, and each build is asserted by grepping the
emitted `packages/solidc/dist/compiler.js` for the change. CPU time (user+system, per root, median of five
pairs) is the load-independent half of the measurement and is what the verdict uses - wall clock on this
shared machine swings ±15 % between identical runs. Paired CPU deltas read −1.6 %, −22.4 %, −15.4 %,
−17.7 % and −24.5 %, so the headline is **−19.3 %**:

| | baseline | first rung | delta |
|---|---|---|---|
| total CPU (median of five pairs) | 36,794 ms | **29,688 ms** | **−19.3 %** |
| total wall (same pairs) | 21,072 ms | 16,893 ms | −19.8 % |
| MarketplaceV1 | 12,898 ms | 9,499 ms | −26.4 % |
| MarketplaceV2 | 6,184 ms | 4,866 ms | −21.3 % |
| MarketplaceV3 | 4,165 ms | 4,038 ms | −3.0 % |
| MarketplaceDataV1 | 4,073 ms | 3,270 ms | −19.7 % |
| EACCToken | 3,294 ms | 3,269 ms | −0.8 % |
| TreasurySplit | 647 ms | 588 ms | −9.1 % |
| unicrow/FakeToken | 1,142 ms | 1,002 ms | −12.3 % |
| unicrow/UnicrowDispute | 1,731 ms | 1,154 ms | −33.3 % |
| unicrow/UnicrowArbitrator | 1,758 ms | 1,525 ms | −13.3 % |
| unicrow/UnicrowClaim | 1,183 ms | 1,127 ms | −4.7 % |

Every root's non-route bytecode is **unchanged**: nine of ten match the fixture hash-for-hash
(`debug.bytecode` and the SCB1 route body), and `TreasurySplit`'s route body shrinks 1,318 → 1,279 B
(−0.9 % of a 4,430 B artifact) because it now ships the single-pass bound route instead of the two-phase
one. That is inside the ±5 % budget and the fixture was regenerated for it; the regenerated
`TreasurySplit.json`/`.artifact.ts` differ from the previous pair only in the route body and everything
derived from it (`bytecode`, `debug.bytecode`, `functionBodies['53434231']`, that function's
`debug.functionDebug` source map and require IPs) - no ABI, layout or fingerprint change.

No root regresses: the refusal path costs almost nothing, because the cheap-widest-rung gate refuses
`EACCToken` on the *pristine* AST in 5 ms (`MessageHashUtils.toEthSignedMessageHash` has an uncovered return
path, so the source is not widest-rung admissible at all) rather than paying a discarded full compile, and
its delta is −0.8 %. The
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
* **The detached verifier's two compiles per root are both required - tested, not assumed.** Round 9
  tried to remove the pre-codegen one (its program is replaced by the post-codegen specialized program at
  `compiler.ts` `singlePassVerifierSource` handling, and the placeholder lock it patches looked discardable).
  Skipping it *leaks the `b1b1…b1` placeholder lock into the shipped script*: `SOLIDC_NO_VERIFIER_PRECOMPILE=1`
  makes every artifact differ from the baseline, so the pre-codegen compile is what puts the real lock in the
  route. Cross-root memo reuse of the generic program is also unsafe: the memo key carries `rootFileId`
  because the program's locations do. Two compiles per routed root is the cost of the design, not waste.
* **`subroutineUseProbe`'s dry run is the largest remaining single item (7 % inclusive) and is not a
  rewrite target.** It is not one hot loop: its whole subtree is 415 ms of self time on the largest root,
  spread across `walk` (112 ms), `hasRuntimeLoopEntryWrite` (21 ms), `scan` (21 ms), `hasChunkableMappingWrite`
  (13 ms), `collectMappingSlots` (13 ms) and a long tail. It re-walks the contract to count subroutine uses
  *before* ids can be assigned, and it also discovers the structural-helper maps the real emission then reuses,
  so a census would have to reproduce the emission's own helper-capture decisions to be equivalent. Measured,
  understood, and left alone.

**Landed: verifier covenant locks are reused across roots** (`0a9e1a973`, round 10 - the first win the
round-9 map produced). The pre-codegen detached-verifier compile exists to produce exactly one value: the
covenant lock that `bindPlaceholderVerifierLock` patches into the route. On the kernel path its program is
replaced wholesale by the post-codegen specialized program, and the published program carries only
`{ id, name, bytecode }` per function - no locations - so the lock is the compile's only surviving product.
The lock is also not root-file dependent, which was measured rather than assumed: `TreasurySplit` and
`UnicrowClaim` have different root files *and* different verifier sources (42,124 and 43,082 chars) and
still produced the same lock (`aa2022f4a6010bda1ab367ec`). Caching the lock by verifier source plus every
option that can change the covenant script therefore lets a route shape recompiled in another root skip a
~0.2-0.4 s mini-compile. Non-kernel callers publish this program, so they always compile.

Corpus effect: **18 -> 16 verifier compiles**, five interleaved A/B pairs reading −3.33 %, −2.79 %, −2.87 %,
+0.72 %, −7.72 % CPU (median **−2.87 %**, mean −3.20 %). Output is unchanged in the strongest sense
available: all ten roots reproduce the committed fixture as a **whole-artifact JSON match** - ABI, bytecode,
debug, functionBodies, `messageBus`/`verifierProgram`, fingerprint and invocationAnalysis - and the compiler
journal gate is identical to baseline (6 failed / 1,442 passed, same six names). The saving scales with the
number of roots that share a route shape, so a project compile with many participants gains more than this
ten-root corpus shows.

### Round 11: what landed, and one plan correction

**Landed: the compile task reuses cached artifacts by default** (`07e80994b`). The compiler's artifact cache
(memory + disk, keyed by compiler build id, root source, the whole transitive import closure, the primary
declaration and every published option) was reachable only via `SOLIDC_COMPILE_CACHE=1` or an internal
option, so `solidcash compile` recompiled every `.scash` source on every invocation. The task now enables it
and points the disk layer at the project cache directory. `.sol` projects barely change - 
`compileSolidityProject` already keeps its own content-addressed per-root job cache - but `.scash` projects,
iteration compiles and job-cache misses now cost a lookup instead of a compile. Verified end to end on
`examples/testing-suite`: a cold compile and a warm (6 cache hits) compile produce **byte-identical artifact
trees**, and the artifact-freshness gate still passes. `SOLIDC_COMPILE_CACHE=0` forces a full compile, and
`__artifactCache` never reaches a published artifact because `compiler.options` is a whitelist.

**Open follow-up: remove `SOLIDC_COMPILE_CACHE`.** With the compile task passing `__artifactCache` by default,
the variable is only a legacy switch plus the test harness's way in. Marked with a `TODO(remove
SOLIDC_COMPILE_CACHE)` at both read sites (`packages/solidc/src/compiler.ts` `artifactCacheEnabled`, and the
`!== '0'` escape in `packages/testing/src/builtin-tasks.ts`). To finish it: migrate
`packages/solidcash/vitest.setup.ts` (`??= '1'`), `solidc/test/DelegateInference.test.ts` and
`solidc/test/CompileCacheDisk.test.ts` (toggle it) and `solidc/test/journal-message-bus/KernelGraphResultDependency.test.ts`
(disables it with `'0'`) to `__artifactCache`, add a `--no-cache` task flag for the escape hatch, then delete
the boolean read. `SOLIDC_COMPILE_CACHE_DIR`, `_MAX_ENTRIES` and `_BUILD_ID` are separate knobs and stay.

**Landed: `scripts/perf-ab.sh`** (`addd5a265`) - the A/B harness this branch should have had all along.
It takes a **named** baseline commit, asserts that each half's emitted `dist/compiler.js` actually gained or
lost the change's marker before timing it, alternates the halves, reports paired CPU/wall medians per root,
and says whether bytecode differs between halves. It immediately caught a bad invocation (`0a9e1a973` used
as its own baseline) that the old ad-hoc loop would have silently reported as a result.

**The probe is a required pre-pass, not removable redundancy (round 12 - item closed).** Two rounds of
planning assumed `subroutineUseProbe` could be folded into emission: first by memoising the per-body
predicates it repeats, then by emitting once with provisional ids and patching every `<id push> OP_INVOKE`
after rehoming. Both are wrong, and the second is wrong for a structural reason:

* The tally is not only an id input. `capturedSubroutineIsProfitable(id, uses, inlineEmit)` starts with
  `if (uses < 2) return false;` and its callers then **inline the helper body instead of emitting an
  `OP_DEFINE` plus an invoke** (`GenerateTargetTraversal.ts:3970`, called from the `intEncode`/frame/`MSP`/
  `MUNIQ` captures around 2681-2762). Use counts therefore decide the *shape* of the emitted script, not a
  value inside it. No byte-level patch can turn an inlined body into a shared subroutine, so "emit once and
  patch ids" cannot reproduce today's output.
* Its size was also over-stated by the phase label. The probe sets `this.preambleComputedFor = node` after
  calling `computeScalarJournalClosures` and `computeRuntimeLoopEntryOutputCountFunctions`, and
  `emitFunctionDefinesAndDispatch` skips both when that marker matches
  (`GenerateTargetTraversal.ts:3662-3666`). Those two analyses are 0.170 s + 0.110 s of the 1.395 s the probe
  subtree costs across ten roots - work the real emission needs regardless, merely performed earlier. The dry
  run's own cost is ~1.1 s per corpus (~110 ms/root, ~2.5 % of a root), and the `codegen:probe` phase label
  attributes the shared prerequisite work to it, which is where the earlier "10 %" came from.
* The memoisation alternative has no target either: `walk` self time is spread over a dozen call sites in
  `GenerateTargetTraversal` at 44 ms or less each, and the predicates visible inside the probe subtree total
  ~50 ms of its 415 ms of self time.

Remaining option, deliberately not taken: have the dry run also emit bytes and reuse them when
`rehomeHotHelperIds` relocates nothing. That saves the second traversal only for contracts where no helper is
relocated to the cheap pool - and it requires the count-driven `OP_DEFINE`-vs-inline decisions to be made
during the *same* pass, which is exactly what makes it a redesign of `visitContract`, not a saving.

### Round 13: the two unprofiled areas, measured

**Parallel root compilation pays, but sub-linearly and at a large CPU cost.** Measured by running the ten-root
corpus as N independent probe processes at once (each process is a real compile with its own startup and its
own caches, so this is the achievable number, not an idealised one):

| processes | group walls | wall | summed CPU |
|---|---|---|---|
| 1 | 16-19 s total | 16-19 s | 32,134 ms |
| 2 | 9,671 / 13,015 ms | ~13.0 s | 40,430 ms (**+26 %**) |
| 4 | 6,926 / 10,064 / 9,905 / 6,062 ms | ~10.1 s | 56,793 ms (**+77 %**) |

So four workers buy roughly **1.7x wall for 1.8x the CPU**. The shrinkage is per-process ESM startup, repeated
JIT warm-up, memory-bandwidth/GC contention, and - the one that matters for this branch - the loss of every
cross-root cache this session added (import parse cache, verifier program memo, the round-10 lock cache), all
of which are per-process. On a smaller CI box the CPU multiplier would bite before the wall win. If this is
built, it should be an opt-in `--parallel` (or `--jobs N`) on the compile task, not a default, and the job
cache means it only ever helps a cold full build.

**The split path is not a hidden cost multiplier here - it is a capacity wall.** Compiling the marketplace
roots against the real 10,000-byte input limit does not shard them; it refuses:
`SPLIT_CLOSURE_CAPACITY: Cannot split 'MarketplaceV2': indivisible closure 'approveResult' is 20,624 bytes
(limit 10,000)` and `Cannot split 'UnicrowClaim': indivisible closure 'claim' is 15,035 bytes (limit 10,000)`.
The route closures are 1.5-2x the limit as single units, so no facet packing can help. Every performance
number in this document was therefore measured on the *only* path these contracts have (the mock network's
10 MB ceiling), and the binding constraint for deploying them at consensus size is **bytecode size, not
compile speed** - which is what the kernel work exists to move. Do not spend compile-time effort on the split
path until the contracts fit.

### Round 14: what the marketplace harness actually spends (measured)

`DEBUG=vite:transform` on `post job 1` reports **381 transform events totalling 999 ms** - not the 4.4 s the
vitest summary calls "transform". The rest of that phase is resolution and plugin work, including the
`eaSrcRedirectPlugin`'s `existsSync` probing (`internalModuleStat` ~0.11 s + `getPackageScopeConfig` ~0.15 s
in the worker profile). The real transform time localises to:

| group | ms |
|---|---|
| `typechain-types/index.ts` barrel **and its transitive factories** | ~398 |
| `packages/solidcash` (`StatefulContract` 31, `StatefulTransactionBuilder` 18, rest) | ~131 |
| `@solidcash/testing` + the test file + `solidc/utils` | ~57 |

So the harness cost is not "a big module graph" in the abstract: it is one **barrel file** - the generated
`typechain-types/index.ts` re-export that drags every factory in - plus Vite resolution overhead. Two
consequences for whoever picks this up:

* The barrel lives in the *project's* test file (`.marketplace/project/test/marketplace.test.ts` imports it),
  so shrinking it means changing the imported suite, not this repository. Any real project using typechain
  barrels pays the same ~0.4 s per test file.
* The resolution overhead is addressable locally: memoising `existingSource`/`redirectEffectiveAccelerationSrc`
  in `vitest.marketplace.config.ts`'s plugin removes repeated `existsSync` probing per import. Estimated
  0.2-0.3 s of a 19 s run, i.e. ~1 % - measured cost of the change is one vitest run. **Round 15 measured the
  plugin's whole cost at 1.16 ms; this estimate was wrong. See round 15 before acting on it.**

Also closed here: per-worker signer derivation is **not** a lazy-derivation win. The 0.44 s is a single
BIP-39 PBKDF2-HMAC-SHA512 (2048 iterations) producing the seed that the first signer already needs; caching it
across workers would mean writing a seed to disk, which is not an acceptable trade for 2 % of a test run.

### Round 15: the round-14 handover list, implemented and measured

Three of the four items were carried out; two of the three turned out not to be work. The fourth was a statement
about the binding constraint (contract size, not compile speed) and stays one.

**Item 1 - the marketplace resolver memoisation: 1.16 ms, not 0.2-0.3 s. Closed, nothing landed.** The plugin in
`vitest.marketplace.config.ts` was instrumented with counters and a `process.hrtime.bigint()` accumulator
(temporary, reverted). On `post job 1`:

| plugin cost | count | ms |
|---|---|---|
| `resolveId` calls from Vite | 1,157 | - |
| `existingSource` calls | 1,161 | - |
| `existsSync` probes (the only syscalls) | **8** | **1.16** |
| `redirectEffectiveAccelerationSrc` scans | ~2,300 | 2.20 |

The redirect only ever fires for the 8 real EffectiveAcceleration sources, and every candidate resolves on the
first stat, so there is no repeated probing to memoise. Round 14's 0.2-0.3 s estimate had attributed Vite's own
`internalModuleStat`/`getPackageScopeConfig` time (0.11 + 0.15 s in the worker profile) to this plugin; that time
is inside Vite's resolver for the whole module graph, not in the plugin, and no local plugin change reaches it.
Memoising here would have been a measured no-op.

**Item 2 - the convergence loop: instrumented, fully attributed, nothing redundant to remove** (`677244060`). `_assertConvergedFinalTransaction`
reported 0.65 s per title with "iterations uninstrumented". It now reports under `SOLIDC_DEBUG_CONVERGENCE_ROUNDS=1`
(sweeps, rebuilds, preflights and refusals, repairs, fee calls, and per-stage ms). On `post job 1`, 8 calls,
591 ms total:

| stage | ms | share | note |
|---|---|---|---|
| covenant preflight (`assertFinalizedTransactionCovenants`) | 349 | 59 % | 9 attempts: 1 accepting, 8 refusing |
| computed-output repairs (`_repairComputedChunkOutput`) | 204 | 35 % | 30 attempts |
| transaction rebuilds | 20 | 3 % | 17 rebuilds |
| post-repair bookkeeping (4 passes x 22 iterations) | 8 | 1 % | strip / restore / clear / clear |
| fee adjustment (encodes the tx per sweep) | 2 | <1 % | 17 calls |

Two premises died here. The loop is **not** iterating redundantly: every call reaches one accepting preflight,
and the extra sweeps and preflights are the fee adjuster and the *refusals* which trigger each repair. And the
unaccounted time was the refused preflights: the first instrumentation pass only counted the attempt which
passed, which attributed 240 ms to nothing. 59 % is the BCH-2026 covenant verification this path exists to
perform and 35 % is the recovery work itself, so the item closes as "required work, now attributed".
`SOLIDC_DEBUG_CONVERGENCE_ROUNDS` stays as the diagnostic.

Also closed by measurement: the "nested faithful probe traces 0.47 s" item is **72 ms** on this title
(`probe-trace-faithful`, 2 traces of ~6.1 k states each). The larger figure came from a heavier fixture.

**Item 3 - `--jobs N` on the compile task: landed** (`57566b246`). `compileSolidityProject` takes an optional parallel option
and `solidcash compile --jobs N` (default 1, one process) fans the Solidity roots out over N worker threads.
Measured on the ten marketplace roots through the production path, each run with a fresh cache:

| jobs | wall (quiet box) | wall (loaded box) | process CPU | speedup |
|---|---|---|---|---|
| 1 | 21,410 / 22,695 ms | 23,607 / 26,014 ms | 37,518 / 39,040 ms | 1.00x |
| 2 | 15,193 / 15,783 ms | 19,901 ms | 47,972 / 52,602 ms | **1.36x quiet, 1.19x loaded** |
| 4 | 12,440 / 13,224 ms | 16,325 ms | 70,229 / 75,344 ms | **1.72x quiet, 1.45x loaded** |

The CPU multiplier is the stable half of this trade (+40 % for 2 jobs, +87 % for 4 jobs) and the wall win is the
part which moves with the machine: one 4-worker run taken while a sibling session was compiling took 18.5 s of
wall clock against **91.3 s** of process CPU, i.e. no wall win at all over the sequential 22.7 s / 39.0 s run, at
2.3x the CPU. **Recommend 2 jobs; the default stays 1**, and the help
text says the same. Two further limits are deliberate: only a cold build can benefit (the job cache resolves hits
in the parent before a worker is ever spawned, and the pool is skipped entirely when fewer than two jobs remain),
and `.scash` sources plus the split-bundle loop stay sequential.

Equivalence, in the order it was checked:

* The published artifacts of `jobs=1/2/4` are identical: one digest over every artifact of all ten roots with
  `updatedAt` stripped matched across all four runs (`f67cee99...`). The only field which differs between any two
  fresh compiles - sequential or parallel - is the `updatedAt` compile timestamp (top-level and inside
  `delegateArtifact`).
* A sequential `jobs=1` run over the cache a parallel `jobs=2` run had just written reported **10 cache hits and
  0 compiles**, so the parallel path writes exactly the job entries (key and payload) the sequential path looks
  for.
* Through the task, on a four-root `.sol` project: `--jobs 2` logged
  `project-parallel {workers: 2, planned: 4, jobs: 4}`, and the published `artifacts/` tree was identical to the
  `--jobs 1` tree except for the `updatedAt` line. A following plain `compile` reported 4 cache hits, 0 compiles.
* `packages/testing/test/project-compiler.test.ts` covers the fan-out: same artifacts/accounting as sequential,
  the in-process fallback for a job the parallel pre-pass cannot predict, and the options-cloneability refusal.

The parallel path is only allowed to change **where** a job runs. The skip rule which decides whether a source's
artifacts are published ("a non-canonical source whose declarations are already published is skipped") is
evaluated in the sequential merge loop, in order, for every source - including ones a worker already compiled.
The pre-pass which decides what to *compile* in parallel is a prediction built from the scanned declaration
lists; when it is wrong the merge loop simply compiles that source in process, so a wrong prediction costs time
and cannot change the artifact tree.

### The artifact-cache defect this round found

Building the equivalence gate above exposed a pre-existing bug in the persistent job cache, not in the parallel
path: **a warm project build could silently drop an artifact a cold build publishes.** Fixed in `cf6607de6`.

`MarketplaceV1.sol` imports `MarketplaceDataV1.sol` and `MarketplaceDataV1.sol` imports `MarketplaceV1.sol`, so
the two files' transitive import closures are *identical sets*. `dependencyHashes` hashed that closure, and the
job key did not include `compileDeclarations`, so both files resolved to **one job file**. The cold run compiled
both and wrote one payload over the other; the warm run read that payload for both sources, and since
`MarketplaceV1.sol`'s payload is filtered to its own declaration, the second source published nothing:

| run | job files | compiles | hits | artifacts |
|---|---|---|---|---|
| cold | **9** (10 sources) | 10 | 0 | 10 |
| warm | 9 | 0 | 10 | **9 - `MarketplaceV1` gone** |

Reproduced with `scripts`-free probes against the ten roots, and it is reachable from the CLI: the task publishes
the artifact tree from this map, so a second `solidcash compile` could publish a tree missing a contract. Fixed by
adding `declarations` to the key and bumping `artifactCacheVersion` to 4 (one-time invalidation of every existing
entry), with a regression test which fails on the old key (`expected [ 'Beta' ] to deeply equal [ 'Alpha', 'Beta' ]`)
and passes on the new one. After the fix the cold and warm runs both report 10 job files and 10 artifacts.

This is worth generalising: **a content-addressed job key must cover every input which changes the job's output,
not just the inputs which change the input files.** The closure and the options were covered; the primary
declaration set - which decides *which* artifacts the job returns - was not, and an import cycle is enough to
make the closure ambiguous.

Round 15 leaves these open, in the order they are worth doing:

1. **`--jobs` does not cover the split-bundle loop or `.scash` sources.** Both stay sequential. The split loop is
   the interesting one: it recompiles an oversized root to shard it, and on the marketplace corpus every attempt
   refuses at `SPLIT_CLOSURE_CAPACITY` (round 13), so a project pays one full compile per oversized root for a
   result it cannot use. A `--skip-split`-style capability check before the attempt would remove that, but it
   changes what the task publishes, so it needs a decision rather than a measurement.
2. **`SOLIDC_COMPILE_CACHE` is still a legacy switch** (round 11): the compile task enables the cache by default,
   so the variable is only the test harness's way in and an escape hatch. Replace it with `--no-cache`, migrate
   the four test/harness users, then delete `artifactCacheEnabled`'s environment read.
3. **The artifact cache's own coverage is now a known-sharp edge.** `declarations` was missing from the key for
   as long as the `.sol` job cache has existed. The fix is verified for the marketplace corpus, but the same
   question - "what else changes the job's output?" - should be asked of `artifactCompilerOptions`'s delete-list
   (`suppressWarnings` only) and of any option added later.
4. **Two pre-existing `packages/testing` failures** are now recorded above (the empty-function-body e2e fixture
   and the unused `source` read in the split loop). Neither is caused by this branch's work, and both are cheap
   to fix in a change which is allowed to touch that package's fixtures.

### Round 16: the vitest harness is latency-bound, not compute-bound

Rounds 14-15 closed the two harness items that were visible from the transform side (the resolver plugin at 1.16 ms,
the typechain barrel at ~0.4 s). What was left was the phase summary itself: `transform 4.4 s, setup 4.2 s,
import 2.2 s, tests 12.4 s` on a 19 s title. Profiling all three processes (worker via `test.execArgv`, main via
`NODE_OPTIONS=--cpu-prof`) explains it, and the explanation says the remaining levers are small.

**The decomposition that makes the rest measurable.** A filter matching no test still transforms the file, runs
the setup files and imports the graph, so it prices the harness on its own:

| run | vitest duration | bash wall | CPU (user+sys) | transform | setup | import | tests |
|---|---|---|---|---|---|---|---|
| `-t 'no-such-test'` (66 skipped) | 5.84 s | 6.72 s | 7.79 s | 3.79 | 3.77 | 1.86 | 0 |
| `-t 'post job 1$'` | 17.94 s | 18.51 s | 12.46 s | 3.71 | 3.56 | 1.88 | **12.31** |

So the harness floor is **~6 s wall of an ~18 s run** (and it is CPU-bound: 7.8 s of CPU over 6.7 s of wall,
because the main process and the worker overlap), while the test phase is **12.3 s wall for ~4.7 s of CPU**.
The test's own cost is therefore ~62 % waiting.

**Where the CPU actually is** (sampled self time; idle in brackets):

| process | sampled | own work | notable |
|---|---|---|---|
| main | 18.2 s (82 % idle) | 3.2 s | vite 1.34 (`visit`, `traceMappings`, `decode` - sourcemap machinery), gc 0.43, node 0.37, vitest 0.12, rollup 0.09; `getPackageScopeConfig` 194 ms + `internalModuleStat` 161 ms |
| worker | 18.6 s (69 % idle) | 5.7 s | libauth 1.94 (contract VM - real execution), SDK 0.69, structuredClone 0.40, module evaluation ~0.5, vite 0.09, gc 0.28 |
| npm wrapper | 18.5 s (98 % idle) | ~0.3 s | - |

The timelines are the interesting part: the **main** process is busy only in seconds 0-6.5 (vite transform) and
idle from 7 to 18; the **worker** is busy in 0-7 (module evaluation and fixture deployment) and 15-18 (the test's
final transactions), and runs at ~50 ms of JS per second through 8-14. Both processes are idle at the same time
for roughly 6 s. Nothing in the test, the SDK or the shims sleeps (no `setTimeout`, no `await new Promise(delay)`),
so that window is waiting on something outside the two JS stacks.

**One concrete trace of it:** the vitest processes write **~4-7 MB/s in two bursts, ~23 MB per run**, and it is not
the Vite cache (`.marketplace/vite-cache-marketplace` is 4 KB of `results.json`) and not the repo (nothing new
under `.marketplace/` or `examples/effectiveacceleration/` survives the run), so it is temp files that are deleted
again. Locating that writer is the top remaining harness item: run with `TMPDIR` pointed at a directory that is
polled during the run, or sample `/proc/<worker>/fd` for regular-file descriptors.

**Levers tested, none landed:**

| lever | result |
|---|---|
| `pool: 'threads'` | 19.83 s wall / 12.55 s CPU against the fork pool's 18.51 / 12.47 - no win, and the threads pool rejects `execArgv: ['--max-old-space-size=8192']` outright (`ERR_WORKER_INVALID_EXEC_ARGV`), so it would force that flag into `NODE_OPTIONS` for every run |
| `esbuild.sourcemap: false` + `build.sourcemap: false` | inconclusive: the run took 23.8 s wall with 8.2 s of system time, i.e. the host was doing heavy I/O; the profiled sourcemap work is inside Vite's SSR transform, which the esbuild knob does not necessarily reach. Worth one clean repeat before believing either way |
| resolver-plugin memoisation | 1.16 ms (round 15) - closed |

**Ceiling, so the next session does not re-open this:** the entire pre-test harness is ~6 s, and its largest piece
(Vite transform, 3.7 s wall) is only ~1.9 s of CPU across two processes - it is round-trip latency, not
computation. Removing *all* of the main process's sourcemap and resolution work would save about 1 s of wall. The
12.3 s test phase is the fixture deployment plus one test body, whose 4.7 s of CPU is mostly libauth VM execution
(real contract evaluation) and the SDK; the rest is the wait for whatever the ~23 MB of writes belong to. There is
no longer a large lever in the vitest configuration itself.

Judge future work with the two-run decomposition above (floor vs full, CPU and delta) rather than with the phase
labels, which overlap: their sum is ~22 s on an 18 s run, and round 14 already showed most of "transform" is not
transform.

### Incident to know about (round 11, caught before it shipped)

`scripts/perf-ab.sh` originally produced its baseline half with `git checkout <commit> -- <path>`, which
updates the **index** as well as the worktree. The next `git commit` (which commits the whole index, not just
the paths passed to `git add`) therefore reverted `compiler.ts` to the baseline inside the commit. Caught by
`git show HEAD:packages/solidc/src/compiler.ts | grep -c <marker>` returning 0, and fixed by amending. The
harness now writes the baseline with `git show <commit>:<path> > <path>`, which never touches the index. Any
script that switches revisions in a dirty tree should be checked for this: assert the *committed* state, not
just the working tree.

### Round 9: the structural map (what is left, and what blocks it)

One root's compile, by phase (`MarketplaceV1`, `SOLIDC_PROFILE=1`, total 4,247 ms; phases nest):

| phase | ms | share | note |
|---|---|---|---|
| codegen | 1,747 | 41 % | `emitBodies` 773, `outline` 489, `subroutineUseProbe` 427 |
| lowering pipeline | 1,098 | 26 % | ~40 ordered passes, none above 1.5 % on its own |
| parse + import resolve | 852 | 20 % | 21 files; root file plus its import graph |
| semantic (symbol + typecheck) | 700 | 16 % | |
| detached verifier | 624 | 15 % | two compiles: 426 pre-codegen + 198 specialized |
| route synthesis | 391 | 9 % | |

Every remaining double-digit item is blocked by something concrete, and the blockers were measured, not
assumed:

* **`subroutineUseProbe` - closed in round 12 (see the correction above).** It is a required pre-pass: its
  tally decides `OP_DEFINE`-vs-inline per helper, so it cannot be folded into emission by patching ids, and
  its own cost is ~2.5 % of a root once the prerequisite analyses it memoises for the real emission are
  discounted. Do not re-open this without a plan that addresses the count-driven capture decision.
* **The detached verifier (15 %) - both compiles are required, proven by experiment (round 9).** See the round-8
  entry below: skipping the pre-codegen compile leaks the placeholder lock into the shipped script.
* **The outline width sweep (16 %) - required for bytecode size.** Both `[12, 10]` widths run only for
  kernel message-bus contracts whose estimated size is within ±512 bytes of the 10,000-byte input limit;
  dropping the second width changes published bytecode.
* **The lowering pipeline - closed in round 12.** Measured per module on the largest root: the whole
  lowering family is **15.0 %** of the sampled compile spread over ~35 passes, and the largest single pass is
  **1.2 %** (`LowerVMapCounterLoops`, 73 ms of 6.08 s sampled). Fusing passes would still visit every node once
  per pass's semantics and could only recover the dispatch between them, so the ceiling is well under 1 % of a
  compile - against the most deliberately order-sensitive code in the repository. Not worth the risk.
* **Generated-source round trips - mostly already cached.** The exploration's item 1 is real but smaller than
  it reads: `parseMessageBusHelpers` and `parseGeneratedHostFunction` are both clone-on-hit caches keyed by the
  generated text, `compileDetachedMessageBusVerifier` has a program memo, and round 10 added the lock cache. The
  `messageBus:parseHelpers` 32 ms / `messageBus:parseRoute` 105 ms a first root shows are cache *misses* for a
  new route shape; later roots with the same shape hit. What remains is genuine first-parse work per distinct
  shape plus the per-root specialized verifier source, so an AST-direct rewrite of that generation would now
  buy well under the ~5 % it looked like.

The marketplace title itself is now **harness-dominated**, which caps what compiler and SDK work can buy
there. CPU profile of `post job 1` (`--cpu-prof` in the marketplace config's `test.execArgv`; 1 file, 1 test):
duration 19.0 s = transform 4.4 s + setup 4.2 s + import 2.2 s + tests 12.4 s, and the forked worker is
**idle for 13.0 s of its 19.0 s** - it waits while the main process transforms the module graph. Of the ~6 s
of JS the worker does run, the SDK items are all legitimate work, not waste:

| item | inclusive | what it is |
|---|---|---|
| `_sendWithoutLogicalNonce` | 0.77 s | the whole send path |
| `_deriveFullTransactionState` | 0.70 s | state derivation for the 26-input / 36-output forward |
| `_assertConvergedFinalTransaction` | 0.65 s | builds and VM-validates the exact transaction that is serialized, repairing until it converges |
| `_createBuilder` | 0.49 s | input/output construction |
| `deriveSeedFromBip39Mnemonic` | 0.44 s | PBKDF2 for the 20 test signers, once per worker |
| `evaluateEveryInput` | 0.36 s | preflight VM run |
| faithful probe traces | 0.47 s | nested delegate evaluations the sparse observer cannot see |

The one harness-side item that is clearly redundant is `blockOracleUpdater`'s `structuredClone` of the whole
mock memory storage on every deployment sync (0.32 s per title, `snapshot[memoryStorage.js]`); the resolver
plugin's per-import `existsSync` probing (`internalModuleStat` 0.11 s + `getPackageScopeConfig` 0.15 s) is the
next-largest. Both live in `packages/testing`, not in the compiler or SDK, and neither is reachable by a
compiler or SDK change.

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
    SOLIDC_DEBUG_CONVERGENCE_ROUNDS=1 npx vitest run --config vitest.marketplace.config.ts -t 'post job 1$'
    SOLIDC_DEBUG_TRACE_PARITY=1 npx vitest run --config vitest.marketplace.config.ts -t 'post two jobs$'
    node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs --kernel
    SOLIDC_PROFILE=1 node --max-old-space-size=8192 scripts/profile-marketplace-compile.mjs --kernel
    node --max-old-space-size=8192 scripts/perf-project-compile.mjs
    SOLIDC_PROFILE=1 node --max-old-space-size=8192 scripts/perf-project-compile.mjs

The worker-thread fan-out is measured through its production entry point, one fresh cache directory per run so
every root is a miss (a throwaway script is enough: import `compileSolidityProject` from
`packages/testing/dist/project-compiler.js`, pass `compileFileMulti` from `packages/solidc/dist/index.js` as the
compile function, `jobs` as the fifth argument, and hash every artifact with `updatedAt` stripped):

    node --max-old-space-size=8192 <probe> --jobs 1   # then 2 and 4, interleaved
    SOLIDC_PROFILE=1 node packages/testing/dist/cli.js compile --jobs 2

Two traps for whoever measures next:

* `NODE_OPTIONS=--cpu-prof` does not reach vitest's forked workers; put `--cpu-prof` in the marketplace
  config's `test.execArgv` (revert it afterwards).
* Run the A/B pair back-to-back on an otherwise idle machine. A sibling session's marketplace run made
  the same optimized test report 60 s (transform 27.5 s / import 29.5 s) instead of 18 s.

For a compiler A/B, produce the baseline half with `git checkout <the-commit-before-the-change> --
packages/solidc/src/compiler.ts` (restore with `git checkout HEAD -- ...`) and run the halves alternately
(`base new base new`). **Name that commit, never `HEAD~1` or `HEAD~2`**: documentation-only commits sit on
top of code changes here, so a relative revision can silently still contain the change - and `tsc -b` then
emits nothing, so the "baseline" half runs the new compiler and every delta is run-order bias. Assert each
half after building, e.g. `grep -c '<a string only the change adds>' packages/solidc/dist/compiler.js`,
before timing it. **Do not use `git stash` for this in this repository**: the stash stack is shared by every
worktree and every agent session, and `git stash push <path>` on a path with no local changes is a silent
no-op whose matching `git stash pop` then consumes whichever entry another session happens to have left on
top (see the incident below). Judge with **`totalCpuMs`/`cpuMs`**, not `totalMs`.
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

Round 15 added these gates (all after the last code change of the round):

| gate command | result |
|---|---|
| `yarn workspace @solidcash/testing vitest run test/project-compiler.test.ts` | 15 passed, including the three fan-out cases |
| `yarn workspace @solidcash/testing vitest run` | 1 failed / 59 passed: `incremental-compile.e2e.test.ts > recompiles selected declarations...` fails identically on the pre-change source (`Function changed contains no statements`), so it is pre-existing on this branch |
| `npx eslint src/project-compiler.ts src/builtin-tasks.ts test/project-compiler.test.ts` (in `packages/testing`) | 1 pre-existing error: `builtin-tasks.ts` `const source = fs.readFileSync(full, 'utf8')` in the split loop is unused, also at HEAD |
| `yarn workspace testing-suite vitest run test/artifact-freshness.test.ts` | 2 passed (exercises the now-async compile task end to end on a `.scash` project) |
| `npx vitest run --config vitest.marketplace.config.ts -t 'post job 1$'` | passes, 21.8 s (18.9 s before the `SOLIDC_DEBUG_CONVERGENCE_ROUNDS` instrumentation, i.e. wall-clock noise) |
| `yarn workspace solidcash test:fast` after the SDK instrumentation | failure set identical to a pre-change baseline build of the same worktree, diffed by `FAIL` lines (the same copy-source-in, build, run, restore dance the earlier rounds used - never `git stash`) |

* `packages/testing/src/project-compiler.ts` — the parallel option, the worker pool, the pre-pass/merge split and
  the artifact-cache key (`artifactCacheVersion: 4`).
* `packages/testing/test/fixtures/parallel-compile-stub.mjs` — worker-loadable stub compiler for the fan-out
  tests, because a closure cannot cross a thread boundary.
* `packages/solidcash/src/stateful/StatefulTransactionBuilder.ts` — `SOLIDC_DEBUG_CONVERGENCE_ROUNDS` counters in
  `_assertConvergedFinalTransaction`, silent when unset.

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

