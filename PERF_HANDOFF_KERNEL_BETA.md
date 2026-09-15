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
* **The lowering pipeline (26 %) - merging saves dispatch only.** The passes are each below 1.5 % and are
  deliberately order-sensitive; fusing them would still visit every node once per pass's semantics and save
  only the ~3 % visitor-dispatch floor. Not worth the risk.

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

