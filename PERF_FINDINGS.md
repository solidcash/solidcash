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

**Rejected: `copyWithin` as a drop-in `splice` replacement.** A span of `spanLength` becomes exactly
`id OP_INVOKE`, so the tail shift is one native `copyWithin` plus a length trim, which looks like an exact
in-place equivalent. In this tree it proved unreliable to validate: the check run failed to finish within
7 minutes on a compile that normally takes 20–40 s. The host was heavily contended at the time (multiple
long-running node processes from other work; a second `tsc -b` had to be killed), and the compiler itself
was verified healthy in the same window (78 ms for a small contract), so this is *unresolved*, not proven
bad. It is recorded here as untried-but-suspicious rather than as a finding either way. The committed
`in-place suffix scan` for anchors (section 14) is the version that is verified.

**Re-verified after the revert.** With the committed state rebuilt (`--force`), the identity check
reproduces `routeBytes 40019`, `fullBytes 115274`, `fullHash ed6cfff8760a3ca8`. `scripts/verify-id.mjs`
makes this a one-command gate.

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
