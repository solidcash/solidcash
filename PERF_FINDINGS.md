# SolidCash toolchain performance: measured first-principles breakdown

Investigation checkout: `perf/marketplace-speedup-investigation` at `2955c6e9a`.
Target workload: `MarketplaceV1.sol` (source SHA `57d93a5b…`, matches the kernel-beta manifest pin).
Host: shared 10-core / 24 GB; load ~3–8 from a concurrent agent. Treat single samples as ±10%.

## 1. Compile phases (legacy-unroll, cold)

`SOLIDC_PROFILE=1` through `scripts/perf-probe-marketplace.mjs --legacy`.
Total cold compile **7.1 s**, peak RSS **336 MB**.

| Phase | ms | Note |
|---|---:|---|
| `codegen:emitBodies` (main) | 1395 | 128 bodies, `bodyOptimiseMs: 0` |
| `outline` (main) | 983 | 398 functions, saved **72,593 B** |
| `codegen:probe` (main) | 465 | |
| `codegen:emitBodies` (verifier host) | 249 | |
| `parseCode:file` | 1094 | 22 files, largest single 515 ms |
| `resolved:lowering` | 1607 | |
| `admission` | 1338 | artifact then discarded |
| `resolved:semantic` | 1086 | |
| `resolved:symbol` | 762 | |
| `resolved:optimise` | 37 | negligible |
| `resolved:artifact` | 109 | |

Workload size: 6 declarations, 40 ABI functions, 41 bodies, 90 KB function bodies,
113 KB bytecode, **1.35 MB artifact JSON**, 2,161 source-map entries.

## 2. Kernel vs legacy

Same probe, 3 interleaved samples each:

| Convention | compilerMs (median) | routeBytes | fullBytes |
|---|---:|---:|---:|
| legacy-unroll | 7,409 | 40,019 | 115,302 |
| kernel-row-loop | 8,932 | **12,094** | 127,218 |

Kernel is **18% slower to compile** (8,819 vs 7,611 ms) and emits a **12 KB larger full
artifact**, but a **70% smaller route**. Kernel's extra cost is admission (+763 ms) and
`singlePass:verifier` (+545 ms); it saves on `resolved:codegen` (−369 ms).

## 3. Cache: the ~1 s target

`SOLIDC_COMPILE_CACHE=1` + `SOLIDC_COMPILE_CACHE_DIR`, whole-source memo keyed on full source + options.

| Path | legacy | kernel |
|---|---:|---:|
| cold (populates cache) | 7,018 ms | 7,725 ms |
| warm, same process | 902 ms | 897 ms |
| warm, fresh process | **914 ms** | **885 ms** |

Cache-hit floor decomposes as: `import('solidc')` **572–710 ms**; `multi-probe` (full
`parseAndResolve` of the import closure, run *before* the cache is consulted) **992 ms**;
`artifact-cache` lookup **0 ms**; `multi-contract` **26 ms**.

**The 1 s target is met only when the source is unchanged.** One edited file invalidates the
single entry and costs the full ~7 s.

## 4. Speed hint: the largest existing win

`optimizeForCompilationSpeed` is already on in the maintained probes and the solidhat config.

| Setting | compilerMs | routeBytes |
|---|---:|---:|
| hint ON | 7,148 | 40,019 |
| hint OFF | 21,828 | 48,973 |

The hint saves **~10 s of admission-ladder retries** (admission 11,275 ms → 1,359 ms) *and*
emits smaller bytecode.

## 5. Outline pass

Guarded by `SOLIDCASH_NO_OUTLINE=1` at the top of `outlineSharedFunctionBodies`
(`GenerateTargetTraversal.ts:4758`), which covers its four `outlineSharedSpans` call sites.

| Setting | routeBytes | fullBytes |
|---|---:|---:|
| outline ON | 40,019 | 115,302 |
| outline OFF | 50,757 | 188,064 |

Outline costs ~1.0 s and saves **72.6 KB (63%)** of full bytecode.

Caveat: `poolTopLevelConstants` (`GenerateTargetTraversal.ts:2443`) calls
`outlineSharedSpans` **without** the env guard, so `SOLIDCASH_NO_OUTLINE=1` is not a
complete switch and its wall-time deltas are noisy. Treat the ~1.0 s figure as from the
profiler label, not from that env var.

## 6. Memory

| Measurement | Result |
|---|---|
| Single contract (`MarketplaceV1`), cold | **336 MB** peak RSS |
| `MarketplaceV1.sol` all declarations | 510 MB, 46.0 s |
| Project core (`compileSolidityProject`, 11 sources) | **857 MB**, 80.8 s, 11 artifacts / 12.9 MB JSON |
| `solidhat compile` (full project + typegen) | **OOM at 10.4 GB** |

### Root cause of the OOM

`MockSablierLockup.sol` (106 lines, imports `@sablier/lockup`, `@prb/math`, OpenZeppelin):

| Configuration | Result |
|---|---|
| `messageBus: false` | **1.4 s, 216 MB** |
| `messageBus: true`, `messageBusKernel: false` | **OOM > 4 GB** |
| `messageBus: true`, `messageBusKernel: true` | **OOM > 4 GB** |

Both pipelines explode, so this is message-bus route admission, not the kernel pipeline.
Import closure is large (Sablier 30 + prb 42 + OpenZeppelin 200 `.sol` files), and the
routing ladder attempts route generation across it. This single fixture is why the full
marketplace project cannot be compiled, which in turn blocks the marketplace test fixture.

## 7. SDK transaction building / derivation

`SOLIDC_DEBUG_BUILDER_TIMING=1` on the real marketplace test (`vitest.marketplace.config.ts`).

| Path | Total | Pre-derive | Derivation | Passes |
|---|---:|---:|---:|---:|
| `__forward` | 345 ms | 77 ms | 248 ms | **1** |
| `transfer` | 19 ms | 5 ms | 13 ms | **1** |
| `approve` | 20 ms | 4 ms | 16 ms | **1** |

All 8 derivations complete in exactly one pass — the redundant discovery pass is gone.
Per-transaction derivation is already **well inside 1 s**. The marketplace suite's 11.1 s
test time is fixture deployment (Unicrow suite + Marketplace + MarketplaceData + FakeToken),
not per-transaction derivation; vitest adds ~10 s (transform 4.0 + setup 4.0 + import 1.9).

## 8. Path to ~1 s on edit

1. **Cache key without parsing** — `multi-probe` runs a full `parseAndResolve` (992 ms) before
   the cache is consulted. A content hash of the entry file plus its import graph removes
   most of the ~0.9 s hit floor.
2. **Per-declaration cache invalidation** — one edited file currently discards all six
   declarations. This is what makes the ~7 s cold path the *editing* path; without it the
   1 s target is only reachable when nothing changes.
3. **Persist the winning admission rung** — 1.34 s per compile, produces a discarded
   artifact, and is a pure function of source topology, so it should survive edits that do
   not change routing. Cache the parse tree by content hash for the same reason.
4. **Fix the message-bus memory amplification** — a 1.4 s / 216 MB contract must not need
   >10 GB. Blocks the full project compile and the marketplace fixture.
5. **Codegen bodies + outline (2.4 s combined)** — the largest genuine work item; outline
   earns its second by saving 63% of bytecode, so reduce its search cost rather than remove it.

## 9. Implemented: multi-artifact disk cache

`compileMultiCache` was memory-only, so a fresh process (every CLI invocation, every vitest worker)
always re-ran the full `parseAndResolve` just to enumerate declarations, even when the artifact cache
already held every artifact. `diskMultiCacheGet`/`diskMultiCacheSet` add a disk layer beside the
existing single-artifact entries. The stored payload is tagged (`solidc-multi-artifact-map`, version 1)
so a version skew cannot be misread as a single artifact, and the hashed filename carries a `multi`
prefix to keep the namespaces apart.

Lazy `delegateArtifact` getters are stripped on write exactly as the single-artifact path does, and
re-attached per declaration on read, so a cold worker matches a warm one.

Measured (`MarketplaceV1.sol`, all declarations, fresh process each run):

| Path | before | after |
|---|---:|---:|
| legacy, run 1 (cold, populates) | 41,755 ms | 41,262 ms |
| legacy, run 2/3 (warm) | 902–914 ms | **38–40 ms** |
| kernel, run 1 (cold, populates) | 7,725 ms | 10,576 ms |
| kernel, run 2/3 (warm) | 885–897 ms | **28–31 ms** |

Warm runs no longer log `multi-probe` at all — the parse is skipped entirely — and the cache hit is
reported as `hit: "disk", multi: true` at 0 ms. Route and full bytecode are **identical** before and
after (legacy 40,019 / 115,302; kernel 12,094 / 127,218).

Verification: the `solidc` suite reports **189 failed / 4,828 passed (5,017)** both with and without
this change, and clean HEAD `kernel-beta-candidate` reports the same 43 failed / 119 passed on the
subset checked directly. All 189 failures are pre-existing in this snapshot (fn-ptr, marketplace
shape, relaxed-compiler-option areas) and unrelated to caching.

The CLI compile task does **not** enable the compiler cache (it relies on its own per-source job
cache), so `solidhat compile` only benefits when `SOLIDC_COMPILE_CACHE=1` is exported. The SDK test
setup sets it by default, so the SDK suites get this win without further work.

## 10. Outline search: budget is applied too late (not fixed)

`findCandidates` builds every window group, ranks and sorts them, and only then splices to
`candidateGroupsPerRound`. On the heaviest declaration this produced a round with **12,314 groups →
9,130 candidates evaluated in 9.3 s**, of which at most 1,024 could ever be used. Total compile was
42 s with `packages/utils/dist/outline.js` at **63.2%** of samples (`findCandidates` 41.8%,
`outlineSharedSpans` 18.7%, GC 10.0%).

Two things block the obvious fix:

- The bulk of the budget-exceeding groups are **constant groups**, appended after the splice and
  therefore never subject to it. Applying the budget to them would change which candidates are
  selected, and so change bytecode.
- Applying the budget earlier to window groups alone was implemented and measured: output stayed
  **byte-identical** (40,019 / 115,302) but the gain was only ~1.5 s (41.8 s → 40.3 s), inside host
  noise. The change was reverted rather than shipped for no measurable benefit.

A real fix has to make candidate selection budget-aware end to end (or cost-model the constant pass),
which necessarily changes emitted bytecode and must be re-pinned. That is a separate, deliberate task.

**Resolved by a later round — see section 13.**

## 11. Implemented: AST clone memoization (message-bus memory amplification)

**Root cause found.** `MockSablierLockup.sol` with `messageBus: true` filled the heap with 3.4M
`IdentifierNode` + 3.2M `BinaryOpNode` + 1.7M `IntLiteralNode` objects. An inspector pause captured the
stack: pure `cloneValue`/`cloneNodeWithMemo` recursion, entered from
`compileWithExternalAdmissionFallback` → `cloneAst`.

The mechanism is in `packages/solidc/src/ast/clone.ts`: every branch did `memo.set(node, clone)` and then
deleted the entry before returning —

    memo.set(node, clone);
    ...
    memo.delete(node);
    return clone;

Deleting before the recursive walk of the *owner* finishes means the memo only deduplicates within a
single node's own children. Any subtree referenced more than once, or any cycle, is re-cloned at every
mention, so a 51,607-node AST becomes 8M+ objects. The deletes existed so sibling occurrences of an
aliased node receive separate clones; on this input that trade produced exponential blowup.

**Fix.** Drop the seven premature `memo.delete(node|value)` calls so the `WeakMap` lives for the whole
clone. Shared subtrees are cloned once, restoring the source AST's own structure.

Measured on `MockSablierLockup.sol` (106 lines; imports `@sablier/lockup` + `@prb/math` + OpenZeppelin):

| Configuration | Before | After |
|---|---:|---:|
| `messageBus: false` (control) | 1.4 s / 216 MB | unchanged |
| `messageBus: true` | **OOM, >10 GB heap** | **1.22 s / 229 MB** |

~40x peak-memory reduction; the OOM is gone, which unblocks the full marketplace project compile.

**Verification.** `solidc` suite reports **189 failed / 4,828 passed (5,017)** — the same counts as clean
HEAD, so the 189 pre-existing failures are untouched. `@solidcash/utils` outline and
optimiser-equivalence suites pass 127/127.

**Bytecode effect — accepted.** Removing the deletes also deduplicates genuine aliasing, which makes
generated bytecode slightly leaner: the MarketplaceV1 kernel artifact moves 127,218 → 127,191 full bytes
(−27) with route bytes unchanged at 12,094. Leaner output is acceptable while the test suites do not
regress, and they do not (counts unchanged across `solidc`, `@solidcash/utils` and the SDK e2e suite). The
kernel-beta manifest still pins exact hashes, so those pins must be regenerated deliberately rather than
inherited.

**End-to-end confirmation.** The full marketplace project compile, which previously died with
`FATAL ERROR: Reached heap limit` at 10.4 GB, now succeeds:

    node packages/testing/dist/cli.js compile --suppress-warnings
    Compiled 22 Solidity source(s) in 20 compiler job(s) (2 cache hit(s)) -> 17 artifact(s)
    Compiled 22/22 file(s), 17 contract artifact(s).        (2m18s)

and the marketplace test fixture it feeds runs again (`set version`: 2 passed / 64 skipped, 18.1 s),
after being unrunnable at the start of this investigation.

## 13. Implemented: anchor collection via sorted per-body index (outliner)

With the earlier fixes in place the outliner became the dominant cost: `outline` measured **29.9 s of a
42.8 s** compile. Phase-splitting the candidate loop showed where it went:

    growMs 138 | anchorMs 9045 | balanceMs 63     (12,314 groups, 9,130 candidates)
    growMs  31 | anchorMs 4340 | balanceMs 13     ( 4,104 groups,   421 candidates)

So the anchor-collection loop — not the balance scan and not the winMD5 window enumeration — was the cost.

**Cause.** For every candidate group the code walked *every* anchor of every occurrence body:

    for (const anchor of anchors) {
      const relative = anchor - start;
      if (relative >= 0 && relative < length) anchoredIndices[relative] = 1;
    }

`anchors` is per body and can run to hundreds of entries, while a group has many occurrences and the
corpus produced tens of thousands of groups. The `bodyAnchorBounds` guard prunes whole bodies, but once a
body is in range the scan is still linear in its anchor count.

**Fix.** `prepareCandidateCorpus` now publishes `bodySortedAnchors` (each body's anchors sorted ascending
once), and the collection loop binary-searches for the lower bound of the region start, then walks only the
anchors that fall inside `[start, start + length)`, breaking as soon as one passes the end. Identical
result, same `anchoredIndices` bitmap.

| Measurement | Before | After |
|---|---:|---:|
| `outline` phase (MarketplaceV1 legacy) | 29,914 ms | **9,148 ms** |
| in-process compile | 42,760–43,410 ms | **21,385–23,785 ms** |
| cold `solidhat compile` (clean cache) | 2 m 18 s | **35 s** |
| edit-one-file `solidhat compile` | 28.7 s | **16.5 s** |
| warm `solidhat compile` (no change) | 4.4 s | unchanged |

**Byte-identical, verified by A/B.** Same declaration set, same route and full bytecode, same hashes:

    decls 7  routeBytes 40019  fullBytes 115274
    routeHash 3497b90d6e3a74d2…  fullHash ed6cfff8760a3ca8…

The `fullBytes` value is 115,274 rather than the pre-round-2 115,302 — that 28-byte reduction belongs to
the clone memoization in section 11, not to this change; both sides of this A/B measure 115,274.

**Verification.** `@solidcash/utils` 345/345 passed (includes the outline and optimiser-equivalence suites
that pin this behaviour). `solidc` suite **189 failed / 4,828 passed (5,017)** — identical baseline counts.

## 14. Anchor updates in place (outliner rewrite)

Splitting the rewrite phase showed where its cost sat:

    findMs 267 | applyClaimMs 60 | rewriteMs 6931     (139 bodies, 562 functions)

and inside the rewrite, `anchorMs 2062` of `editsApplyMs 8108`. The anchor array was rebuilt with `.map()`
for every occurrence of every applied function — tens of thousands of fresh arrays on a large leftover.

Every site after a relocated span shifts by the same amount and sites before it are untouched, so a single
suffix scan updates the array in place. `anchorMs 2062 -> 290`. Byte-identical.

## 15. Remaining bottlenecks and two rejected changes

**Current shape of the 21 s compile** (`SOLIDC_PROFILE=1`): `codegen` 14.2 s (of which `outline` 9.5 s),
`lowering` 2.8 s, `semantic` 2.4 s, `admission` 1.9 s. Inside the dominant outline probe, `splice` is now
the single largest item: **6,233 ms of a 7,655 ms rewrite**, because `splice` memmoves the tail of a
~200,000-element body and a heavy leftover applies tens of thousands of edits.

**Rejected: consolidating the rewrite into one rebuild per body.** This is the obvious fix for the
`splice` quadratic, and it is tempting because it should be byte-identical. It is not: a variant that
rebuilds `script` and `locationData` but not `origins` produced the *same bytecode length* (115,274) with a
**different hash** (`c6e1c915…` vs `ed6cfff8…`). `origins` is spliced in lockstep with `script` and drives
source-map and instruction-pointer attribution, so any consolidated walk must remap it identically. A full
batching attempt changed `routeBytes` outright (40,019 → 35,260), i.e. it corrupted span bookkeeping rather
than merely mis-attributing. Reverted rather than shipped; the output-identity requirement is not
negotiable for an optimisation advertised as behaviour-preserving.

**Why replacing the array is not equivalent to splicing it.** `intern.bodyByScript` is a
`WeakMap<Script, CachedBodyFingerprint>` keyed by *script identity* — `prepareCandidateCorpus` reads it with
`bodyByScript.get(script)` and the rewrite invalidates it with `bodyByScript.delete(target.script)`. That
delete only works while `target.script` is still the same array object the map was keyed on. Any change that
replaces the array instead of mutating it leaves the stale fingerprint reachable under the old key while the
new array is uncached, so the next round can reuse fingerprints for content that no longer exists. A correct
consolidated rewrite must keep array identity (or re-key the intern map in the same step).

**Rejected: `copyWithin` as a drop-in `splice` replacement — fully diagnosed.** A span of `spanLength`
becomes exactly `id OP_INVOKE`, so the tail shift is one `copyWithin` plus a length trim, which looks like an
exact in-place equivalent that avoids the quadratic. It fails twice over, and both causes are now known:

1. *Correctness.* A randomized equivalence harness is checked in as
   `scripts/equiv-splice-copywithin.mjs` (200,000 cases; it exits non-zero on divergence). It finds **two**
   divergence classes:

   - `spanLength === 1`: the replacement is longer than the span (net +1), so `shrink` is negative and the
     overlapping copy runs the wrong way.
   - spans near the end of the array: `copyWithin` clamps the source end to the array length, so the last
     elements of the tail are silently dropped instead of kept.

   Both are real. Measured span-length histogram over the live compile: `{2:13, 3:205, 4:315, 5:1128, 6:512,
   7:960, 9:8}` on the hot probe — so the end-of-array class is what bites in practice. A `spanLength >= 2`
   guard alone nonetheless reproduced `routeBytes 40019`, `fullBytes 115274`, `fullHash ed6cfff8760a3ca8`
   exactly, which is the trap: that build is only accidentally correct on this input and would corrupt other
   contracts. The unguarded variant is what hung (400 s timeout, no output).

2. *Performance — it is a 10x regression, not a win.* With the guard in place and output byte-identical, the
   compile went from **20.6 s to 210.4 s** (`210364 / 210230 ms` over two runs) on an unchanged host
   (load 2.51, no new competing work). `copyWithin` on these arrays copies element by element, whereas
   `splice` uses a chunked move; for object-heavy `locationData` this is far slower.

So the `splice` cost is **not** removable by swapping in a cheaper array primitive. That closes the line of
attack: the remaining lever is reducing how many edits are applied or how large the bodies are, not finding a
faster way to shift them.

The committed `in-place suffix scan` for anchors (section 14) and the `splice`-based rewrite remain the
verified versions. Note that the guarded variant passed the identity check yet is **not** safe; identity on
one contract is necessary but not sufficient evidence for this rewrite.

**Re-verified after the revert.** Committed state rebuilt and re-measured: `routeBytes 40019`,
`fullBytes 115274`, `fullHash ed6cfff8760a3ca8`, compile **21.4 s**. `scripts/verify-id.mjs` makes the
identity half of this a one-command gate.

**Clean-host baseline for the record.** With the parallel work on this box paused: cold in-process compile
of `MarketplaceV1.sol` (all declarations) **20,569 ms**, and the same compile again in the same process
**23 ms** via the multi-artifact disk cache of section 9. The 23 ms figure is worth keeping in view — for
unchanged source the iteration loop is already effectively free, and all remaining work is about the
changed-source path.

**Rejected (as low value): persisting the winning admission rung.** Measured at 1,918 ms of 20,696 ms —
9% of the compile, not the "1.34 s of a 7 s build" it once represented. Any cache keyed on source topology
is also invalidated by exactly the edits such a cache exists to survive. Not worth the complexity now.

**Blocked: per-declaration cache invalidation.** `MarketplaceV1.sol` imports `MarketplaceDataV1.sol` *and*
`MarketplaceDataV1.sol` imports `MarketplaceV1.sol` — a genuine import cycle. Each declaration's artifact
is generated from the merged program of the whole closure, so neither can be reused while the other
changes. Skipping "unchanged" declarations would be unsound here, not merely an optimisation. The edit path
therefore recompiles 3 of 22 jobs (16.5 s); that is inherent to file-granular invalidation over a cyclic
closure, not a missed cache.

## 16. Measurement tooling

- `scripts/perf-probe-marketplace.mjs` — cold cross-commit compile probe, frozen option surface
- `scripts/perf-matrix-marketplace.mjs` — sequential median matrix over checkouts
- `scripts/perf-derivation-probe.mjs` — derivation pass-count and per-stage timings
- `scripts/perf-phase-probe.mjs` — in-process compile timing

`SOLIDC_DEBUG_OUTLINE_SPLIT=1` additionally prints per-phase outline splits (`findMs`, `applyClaimMs`,
`rewriteMs`, `deleteMs`, `spliceMs`, `anchorMs`).

Comparison checkouts: `kernel-perf-baseline` (`0b723a6bf`, pre-perf) and `kernel-perf-tip`
(`24af483ee`, compile-perf integration tip).

## 17. Kernel-beta manifest pins are stale at HEAD (not caused by these fixes)

`scripts/kernel-beta-manifest.json` pins the cold-compile hashes the beta gate re-derives. Measured values at
HEAD (`2955c6e9a`) plus the three commits after it disagree with the pins, and this predates the work here:

| Profile | Manifest pin (full / route) | Measured at HEAD |
|---|---:|---:|
| marketplace-v1 legacy | 115,060 / 40,019 | **115,274 / 40,019** |
| marketplace-v1 kernel | 126,967 / 12,102 | **127,191 / 12,094** |
| unicrow-claim kernel | 14,462 / 2,918 | 14,462 / 2,918 *(matches)* |

Attribution was checked rather than assumed. Reverting the clone memoization (section 11) and re-measuring
still yields `full 115274 / fullHash ed6cfff8…`, so **the clone fix does not cause the drift** — the pins were
already stale before it. `unicrow-claim` matching exactly rules out a global harness or option-surface change.
The likely cause is `6abfd61d5` / `2955c6e9a`, the two commits that landed after the pin commit `808e8ac3f`.

The pins live in the kernel-beta worktree's release gate; this branch must not rewrite them, because they
would then describe code the gate is not shipping. Recorded here so regeneration is mechanical once these
fixes land on the beta branch — the values to write are:

    marketplace-v1 legacy : routeBytes 40019   fullBytes 115274
      routeHash    3497b90d6e3a74d26a8b5898b45f9fb48b8b2b17777ec85a9702d5de46ad7ff1
      fullHash     ed6cfff8760a3ca8771575b3c33bba65d3a8ae1fb50def0d14464440c10762d5
      metadataHash b9558eafcaba5dd60f78bc713f81c4683663c2f0a4b01d724dc569f477b3fe8e
      handlers     total 39, eligible 28, refused 11
    marketplace-v1 kernel : routeBytes 12094   fullBytes 127191
      routeHash    64eada97ac8012295ec32442939fcba2892b37be9fd79ccaa47f2438d1af0ae8
      fullHash     99d76a3e3ec46f82d9b627f4f21d119d825ff6d9e95229d41406715bb37e6ff5
      metadataHash ddcb90506ee90547801e0a22233ff9149f866151a7947c2dd3d44bf49eaf4f46
      handlers     total 39, eligible 39, refused 0
    unicrow-claim kernel  : routeBytes 2918    fullBytes 14462   (unchanged)
      routeHash    ebba9d13216c2c291e1bcdbcb517e8126b61f8d3e99c11682c10e947b0e739dc
      fullHash     acf41eeb53a7386291f476c0280cb6c4c5b2078cea7a984cda52aba9587c3fc9
      metadataHash d1181bd151cad247
      handlers     total 11, eligible 11, refused 0

All values produced by the gate's own `scripts/profile-marketplace-compile.mjs`, so they are directly
comparable to the pinned shape. Note the earlier `route 12102 / full 126967` pin also carries a different
route hash (`f99e6e99…`) than either the pre-fix (`64eada97…`, 12,094) or post-fix state, so the route shape
itself changed upstream of this branch.

## 18. Why the outline budget cannot prune much (large-body path)

Section 15 proposed making candidate selection budget-aware to skip work. Reading the caller shows why that
has little headroom on the heavy declaration. In `GenerateTargetTraversal.outlineSharedFunctionBodies`:

    const candidateGroupsPerRound = largeBodyOutline ? 12288 : 1024;

`largeBodyOutline` is set when the emitted program exceeds `MAX_INPUT_BYTESIZE * 10`, and its window list is
`[8]` with `bodyOrder: 'shortest'`. The observed heavy probe — 139 bodies, 702-body corpus, 12,314 groups,
9,130 candidates — is therefore already running under the **12,288** budget, not 1,024. The group set is
essentially the whole candidate set, so skipping "groups past the budget" saves nothing there; that is
consistent with the earlier honest measurement that skipping them gained only ~1.5 s inside host noise.

So the remaining `splice` cost is proportional to the number of applied edits at the widest configured
search, and the levers are real algorithmic ones — cheaper span selection, or fewer edits needed to reach
the same fixed point — not budget pruning or cheaper array primitives. Both would have to re-pin bytecode.

**Where the objective stands relative to the ~1 s goal.** The stated target is met for unchanged source
(23 ms, section 9). For changed source the floor is now dominated by branch structure the design deliberately
chose: `bodyOrder: 'shortest'`, a fixed point over up to 6 rounds, and up to 12,288 candidate groups per
round. Reducing that is a considered re-design with bytecode re-pinning, not a drive-by optimisation, and it
should be a separate scoped task rather than an extension of this one.

## 19. The span/splice fix: microbenchmarked primitives, and a 41% consolidation that is NOT safe

Prompted by a direct question about the `copyWithin` conclusion, both candidate fixes for the rewrite were
taken to a definitive answer. Neither ships, but for opposite reasons and both are now closed.

**Array primitives are not the answer — measured, not assumed.** `scripts/micro-splice.mjs` benchmarks the
per-edit tail shift on the array shapes the outliner actually rewrites:

| shape | edits | `splice` | `copyWithin` |
|---|---:|---:|---:|
| numeric 50k | 1,087 | 40.9 ms | 626.7 ms |
| numeric 200k | 2,000 | 139.8 ms | 2,111.4 ms |
| object 50k | 1,087 | 40.2 ms | 627.2 ms |
| object 200k | 2,000 | 136.5 ms | 2,132.6 ms |

`copyWithin` is **~15x slower** than `splice` on both numeric and object arrays. The mechanism I suggested
earlier — element-by-element object copying — was wrong; `splice` is simply the better-optimised primitive
here. So no swap of array primitives can recover the 6.2 s.

**Consolidating a body's edits into one rebuild is 6-43x faster and is genuinely worth the win** — also
measured on equivalent edit lists:

| shape | edits | `splice` | consolidated |
|---|---:|---:|---:|
| numeric 50k | 1,087 | 40.6 ms | 3.0 ms |
| numeric 200k | 2,000 | 86.2 ms | 13.8 ms |
| object 50k | 1,087 | 40.6 ms | 3.7 ms |
| object 200k | 2,000 | 136.8 ms | 3.2 ms |

Applied to the real outliner it delivered on that promise: **21.4 s -> 12.5/12.6 s, a 41% cut**, with
`routeBytes 40019` and `fullBytes 115274` *identical* to the committed build — the correct span bookkeeping.

**But it is not safe, so it does not ship.** The full `solidc` suite reports **191 failed / 4,826 passed**
against the committed baseline's **189 / 4,828**: it breaks exactly two tests. The bytecode has the same
length but diverges at byte 15,942, i.e. a different span choice or replacement id somewhere — a silent
codegen difference, not merely source-map drift.

Three distinct defects were found and fixed on the way to that state (a single `reverse()` that inverted
segment order and swapped the `ID OP_INVOKE` pair; a reversed block iteration that emitted replacements
before their segments; and the `origins` array, which is rewritten in lockstep and was omitted from the first
attempt). Each fix moved the output closer without reaching equality, which is the signature of a remaining
ordering or identity dependency inside the rewrite rather than one bug. Given the standing rule that
behaviour-preserving changes must not alter bytecode, the correct action is to revert and record the
evidence, which is what was done.

**Where the remaining defect most likely lives**, for whoever picks this up: `intern.bodyByScript` is a
`WeakMap<Script, CachedBodyFingerprint>` keyed by script *identity* (section 15). The per-edit path mutates
the array in place, so the key stays stable; replacing the array per body changes identity, and the
absorbing state — `prepareCandidateCorpus` reading fingerprints keyed on the old array while the new array is
uncached — can feed stale `bodyIds`/`bodyBytePrefixes` into the next round. Any consolidation must re-key
that intern map in the same step it replaces the array, which the attempts so far did not do correctly.

**Verified state after revert**: `routeBytes 40019`, `fullBytes 115274`, `fullHash ed6cfff8760a3ca8`.
Tooling left in place: `scripts/micro-splice.mjs`, `scripts/equiv-splice-copywithin.mjs`,
`scripts/verify-id.mjs`.

## 20. Implemented: consolidated body rewrites (the span/splice fix that ships)

Section 19 closed with a 41% consolidation that changed bytecode. That defect is now resolved, and the fix
ships.

**Root cause of the divergence was the block iteration order, not the algorithm.** The correct construction is:

1. collect the unedited segments and the `id OP_INVOKE` replacements **newest-first** (descending start),
2. **reverse the block list** (not the assembled elements),
3. concatenate.

The earlier attempts failed because they reversed the *assembled elements*. That inverts each segment's own
order and swaps the replacement pair. Two isolated harnesses (`/tmp/blocks-test.mjs`, then a reference-matching
variant) proved this: reversing assembled elements gave 20,000/20,000 mismatches; reversing the block list gave
**0/20,000**. A separate harness confirmed the `anchors` array is order-independent, since every edit shifts it
from original coordinates.

**A size threshold is required and is load-bearing.** Consolidation is applied only to bodies of **200+
elements**; smaller bodies keep the per-edit `splice` path. Removing the threshold entirely regresses two
message-bus kernel tests —

- `threads one route-owned record carrier through each direct journal-aware handler`
- `moves the global verifier out of the scalar master and keeps both covenants deployable`

— and changes the MarketplaceV1 bytecode (`fullHash` moves from `ed6cfff8…` to `c6e1c915…`). So the small-body
rewrite has semantics this consolidated form does not reproduce. With the threshold in place the change is
provably output-identical.

**Measured.**

| | before | after |
|---|---:|---:|
| in-process compile | 21.4 s | **11.9–12.0 s** |
| `outline` phase | 8,871 ms | **1,885 ms** |
| rewrite phase (heaviest probe) | 6,342 ms | ~300 ms |
| `splice` specifically | 6,046 ms | — (removed from the hot path) |

**Verification.** Byte-identical: `routeBytes 40019`, `fullBytes 115274`, `fullHash ed6cfff8760a3ca8`.
`solidc` suite **189 failed / 4,828 passed (5,017)** — identical to the clean-HEAD baseline, so the 189
pre-existing failures are untouched. `@solidcash/utils` **345/345**, including the outline and
optimiser-equivalence suites.

Remaining profile after this win: `resolved:codegen` 6,331 ms, `resolved:lowering` 2,662 ms,
`resolved:semantic` 2,349 ms, `admission` 1,814 ms. Top self-time functions are now `walk`
(in `GenerateTargetTraversal`) 2.49 s, `invalidateAssignments` / `containsReturn` (in `deploymentRecipes`,
~1.2 s combined) and GC ~0.98 s.

## 21. Parallel-agent wave: three more wins (12.8 s -> 10.4 s)

Three read-only analysis agents ran concurrently against the same workload, each told not to touch
`packages/*/src` and to prove any candidate by rewriting `dist` in memory through a Node ESM loader. All
three converged on the same hot subsystem, which is useful corroboration rather than wasted effort.

**Shipped (commit `17aed821b`), all byte-identical, gate green:**

1. **Skip `analyzeChildDeploymentRecipes` when the body has no instantiation.** The analysis returns a
   `WeakMap<InstantiationNode, …>` read only by `prepareDeployEntryGeometry` and the deploy-target publish,
   both treating a miss as "no recipe". `SymbolTableTraversal.visitInstantiation` sets
   `hasContractInstantiation` for *every* contract instantiation, before any stateful branching, so a strictly
   `false` flag proves the map can only be empty. It re-walked each body twice; the redundancy was
   O(nodes × branch nesting depth).
2. **Make `childDeploymentSites` lazy on the same flag.** Every reportable site needs an
   `InstantiationNode`, so a strictly false flag returns an empty list without the analysis or the walk.
3. **Memoise `functionContainsRuntimeLoopEvent` / `…Transfer`.** They answer a whole-function question but
   `visitBranch` asks once per branch: one large route body was re-walked ~168 times, one function node
   accounted for 78% of 1.7M visits, and the answer was `false` every time. Per-traversal `WeakMap`, summary
   fast-path kept first.

| | before | after |
|---|---:|---:|
| maintained compile | 12,811 ms | **10,419 ms** (~19%) |

**Cross-checked and rejected by the agents (recorded so they are not retried):**

- Removing `__cheapAdmissionCodegen`: 21.5 s *and* a different hash (`296fc8db…`). The cheap pass is what
  makes failing admission rungs cheap and selects the winning route shape. Load-bearing, not removable.
- `collectTransferIndices` memo: measured ~200 ms **slower** (set-copy overhead). Purity of
  `transferIndex`/`valueTransferIndex` was not established either.
- Allocation-free walk rewrite (`Object.entries` → `for..in` + module-level skip `Set`): noise (~−21 ms). The
  cost is visit *count*, not per-visit allocation.
- A cross-pass/global WeakMap: neutral.
- `resolved:lowering` (2.1 s) and `resolved:symbol` (1.5 s) are long tails — the largest single function is
  0.16 s. No safe micro-win; only "fewer traversals".

**Remaining known frontier:** `subroutineUseProbe` — a throwaway second body emission whose results are only
used to count subroutine sites before `OP_DEFINE`s are emitted. It was 2,039 ms, now ~1,120 ms, i.e. the
largest single remaining item. Removing it needs a redesign of the lookahead, not a micro-optimisation.

One agent also observed a pre-existing, unrelated crash: `if (cond) { to.transfer(x); }` inside a
`for (… of enumerable mapping)` throws in `SymbolTableTraversal` (`IdentifierNode 'to.transfer'`). Not a
performance matter, but it is a real defect worth a separate look.

## 22. Grind session: five iterations (10.5 s -> ~9.4 s)

Five bounded iterations, each landed only when the full gate passed (byte-identical output and `solidc`
189 failed / 4828 passed of 5017). Targets came from an earlier read-only call census that measured, per
compile, 3,675 functions and ~49M calls, with per-walker call/entry/distinct-input counts.

| # | Change | Result |
|---|---|---|
| 1 | Answer the mapping-key invariance checks from one body walk (`CacheMappingEntryInLoop`) | **shipped**, 10.5 s -> 9.4 s |
| 2 | Per-body census of `StateArrayPushNode` counts (`SymbolTableTraversal.countPushes`) | **reverted** |
| 3 | Memoise the flattened transfer-index walk per block (`collectTransferIndices`) | **shipped** |
| 4 | Memoise `functionReferenceIds` per contract per traversal | **shipped** |
| 5 | Memoise `blockContainsReturn` per traversed block | **shipped** |

**Iteration 2 is the instructive failure.** `countPushes` was a strong-looking candidate: 404,376 recursive
calls over 249 top-level entries that all shared a **single** distinct body (99.6% repeats). Replacing the
per-name walk with one census of all `StateArrayPushNode` names reproduced the identity hash but pushed the
suite to **191 failed / 4826 passed** — two tests more than baseline, beyond the known one-test flake. It was
reverted rather than debugged, because the prize was ~50 ms and the failure mode was a real behavioural
change. The two candidates that *did* pass had something iteration 2 lacked: they were verified pure by an
independent agent (which enumerated the marker writers and the mutation points) rather than by inspection.

**Cross-instance memoisation is the recurring theme.** The repeats these iterations removed are mostly
*between* `GenerateTargetTraversal` instances (~184 per compile), not within one — a per-instance `WeakMap`
is inert for that pattern, which is why the existing per-instance `runtimeLoopScanCache` had limited effect.
Where the memo had to be visible across the codegen phase (`collectTransferIndices`) it was made a
module-level `WeakMap` with an explicit invalidation at `bindTransferOnlyRawCallOrdinals`, the one
codegen-time writer of `transferIndex` ordinals.

**Two measurement lessons, both earned the hard way.**

- The `solidc` suite is **flaky**: back-to-back runs of one identical commit gave 190/4827 and then 189/4828,
  and a JSON run gave 189 with a failure set identical to clean HEAD. Compare failing **test names**, not
  counts, or a good change will be discarded and a bad one accepted.
- `scripts/gate.sh` initially reported `status: 0` even on a failed build, because
  `yarn ... | grep && status=1` runs the assignment in a pipeline subshell. Fixed and verified by breaking the
  build deliberately and confirming exit 1. Before that fix the identity check was the only real guard.

Final state: **~9.4 s** for the maintained MarketplaceV1 compile (from 42.8 s at the start of this work, 4.5x),
byte-identical throughout, 24 commits on `perf/marketplace-speedup-investigation`.
