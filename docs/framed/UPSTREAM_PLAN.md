# Plan: feat/framed into solidcash_v0.13.1 (pre-release readiness)

Written 2026-10-05 for the agents that carry it out. Each workstream (W1-W10) is self-contained: read section 0 and 1
first, then your workstream. Additional readiness items the plan proposes are in section 3; sequencing in section 4.

## 0. Where things stand

**Branches.**
- `feat/framed` (worktree `/Code/cashscript/.worktrees/framed`) is at `1f818ffd0`, the merge of the message-bus
  kernel beta (`grok/message-bus-kernel-beta` at `d7f3c7ad6`, worktree `.worktrees/kernel-beta-candidate`) into the
  framed lane (`d8166489d`). Merge base was `ea7a48e27`; 716 kernel commits met 1202 framed commits.
- `solidcash_v0.13.1` is at `9fd8cd52b` (2026-09-29) and is an ANCESTOR of `feat/framed` (1922 commits behind, 0
  ahead): landing can be a fast-forward or a merge commit; nothing on it needs merging back.
- Remotes: `mew` (github.com/mainnet-pat/solidcash), `private` (gitlab.com/mainnet-pat/cashscript-private). No
  CashScript upstream remote is configured. Local `master` (`b7119e195`, 2026-06-09) is the CashScript-era base; the
  fork point is `a34616620` (2026-05-26); `master` has 8 commits not in HEAD; HEAD is 7342 commits ahead of it.
- Patched libauth: `/Code/libauth`, branch `perf-vm-fixes`, version `3.1.0-next.8-solidcash.1` (upstream
  `next@v3.1.0-next.8`): `7d141363` encodeDataPush copies once, `20df1db2` function table shared by reference with a
  CONDITIONAL copy-on-write (an unconditional copy at OP_DEFINE was an 82x quadratic regression: every framed program
  defines ~441 functions), `5549fdb4` dup-family ops push references, `40fa1c3f` OP_SPLIT returns views. Not yet
  consumed by the repo. Yarn 1 `resolutions` do not reach downstream consumers; consume it through an npm alias
  (`"@bitauth/libauth": "npm:<scope>/libauth@..."`) or a published fork.

**Two composition conventions** (compiler option `composition`, published as `artifact.composition.convention`):
- default / direct with the message-bus KERNEL: an atomic multi-contract transaction through one compiler-generated
  route (kernel lane, `docs/` and `MESSAGE_BUS_*.md` at the repo root).
- `framed`: every entry point is a master program; a transaction composes one frame per call (plain path
  `callFramedEntry`, proxied hop `callFramedProxyEntry`). Spec: `docs/framed/SPEC_FRAMED_TRANSACTION.md`;
  decisions: `docs/framed/DECISIONS.md`; kernel comparison: `docs/framed/EVAL_FRAMED_VS_KERNEL.md`; test map:
  `packages/solidcash/test/framed/MANIFEST.md`.

**Marketplace (EffectiveAcceleration, the release benchmark).** Sources: `/Code/effectiveacceleration.ai/contract`
(proxied, 66 titles in `test/marketplace.test.ts`) and `.../contract-noproxy` (no-proxy, 65 titles). Pre-merge: framed
proxied 66/66, framed no-proxy 65/65 (ladder #4, 2026-10-04), kernel beta 66/66 (lenient: its `revertedWith` ignores
reasons under relaxed limits). Post-merge: representative titles only - no-proxy 4/4 (post job 1, should whitelist
worker, close job before timeout, take job multiple), proxied 3/3 (post job 1, take job, approve result). Full ladders
have NOT run on the merged tree. Slowest titles pre-merge: no-proxy approve sanity ~1264 s, refund sanity ~1160 s (the
harness timeout was raised to 40 min for them, `abd68b38f`).

**Merge seams (read before touching codegen).** The framed fixture config (`messageBus: true`, `messageBusKernel:
true`, `messageBusGraphContext: true`, `optimizeForCompilationSpeed: true`, `composition: 'framed'`) makes the
kernel's whole bus pipeline run inside framed compiles; framed reads nothing from `artifact.messageBus` and is hit
only through lowering/codegen. The merge kept these kernel features for the direct convention only (framed keeps its
pre-merge behaviour): identity20 address mapping keys (`emitMappingKeyIdentity`, `addressKeyEncoding`); the return
preimage operand (stripped in `framed/master/support.ts` `isExternalCallParameter`); graph-free auto narrowing
(framed: `messageBus=false` only, `messageBusKernel` kept); the indivisible entry-output coordinate marking
(`emitEntryOutputIndex`) and the speed-hinted trace-stable outline skip (`outlineSharedFunctionBodies`) - both had
stopped the outliner sharing framed bodies, growing marketplace artifacts 2-2.5x; the sibling-loop fallback runtime
count (`LowerVMapCounterLoops`, refused `updateJobWhitelist`). Any new kernel change can leak into framed the same
way: check framed compiles of the marketplace (sizes and `composition.refusedEntries`) after kernel-side changes.

**Decisions to respect.** Address representation: the user chose model B (an address is the full locking script end
to end; results carry the lock; mapping keys and `==` compare raw bytes; only explicit `uint160`/`bytes20` narrows) -
DEFERRED; until it is scheduled, do NOT adopt the kernel's identity20 keys in framed. Open design questions otherwise
follow the kernel lane's precedent (record a row in `docs/framed/DECISIONS.md`).

**Known pre-existing failures** (seen in the 17 solidc files that ran before a memory kill; the rest is unknown):
- fail on the kernel beta alone (9): storage-collections "compiles a single-tail-return external-call helper with a
  field-name-colliding local"; DelegateInference "reads state-pinned external-call targets from proxy storage, not
  executor-adjacent NFTs"; ExternalCalls "publishes the live arithmetic progression for a loop-dependent argument",
  "routes a method call on a tuple-ternary-destructured interface var", "does not publish a lowered constant
  placeholder around a returning external call", "publishes a replayable necessary conjunct before a later call";
  calls-abi "encodes a self external-function member stored in a struct blob"; StructsMappings "conditional local
  pointer m = c?a:b: publishes the same authenticated entry route as branch/ternary"; KernelDominatedStateBranchAdmission
  "ignores scalar update arms excluded by dominating terminal guards".
- fail on feat/framed alone (5): LargeContractSplitting "forwards the proxy master witness across calls between
  delegate facet entries"; storage-collections "returning bare totals[k].addElastic(e), statement + expression";
  ExternalCalls "compiles a LOCAL-indexed struct-field chain via the array co-spend loop"; libraries-imports "mixes a
  using-for external-call method and a genuine interface method on the same field", "using-for method spelling
  this.m[k].addElastic(e), both positions".

**Scale.** Source lines: solidc ~197k, solidcash ~180k, utils ~12k. Test files: solidc 363, solidcash 1398, utils 24,
testing 19 (framed: 502); about 13.7k `it`/`test` calls.

## 1. Rules for every agent

- Testing rule (user, strict): do not run tests unnecessarily. Work the fix out from the code. You may run ONE
  reproduction before the fix and ONE final run of your own new or changed test file(s) after it - nothing else: no
  neighbour or "plus" lists, no suites, no corpus or marketplace compiles (the coordinator checks identity at landing),
  no repeated runs. Keep the task short: if it grows past its item, stop and report what you have. (Tightened since:
  no reproduction runs - reason from the code; one final run of your own file; a failure is fixed by reading and
  reported unverified.) Exceptions are explicit in a workstream (W1-W3 measure, W6 runs suites).
- Full suites and full ladders only where a workstream says so: one run per gate, sequentially, `--maxWorkers=2..3`.
  The box has 19 GB; running the framed and solidc suites at once was killed for low memory.
- Never kill processes by pattern (ladders of other sessions share the box; check `/proc/<pid>/cwd`); never bare
  `git stash` (shared stash stack; tag your entry and apply by sha).
- Work in your own worktree or scratch copy; do not edit another agent's worktree. In the shared `feat/framed`
  worktree commit requested edits at once, by path. Commit trailer: `Co-Authored-By:` your model line.
- Code style: ASCII only (no em-dashes), lines <= 125, explicit return types, ESM imports with `.js`. No marketplace
  names (EACC, Unicrow, ...) in `packages/*/src` or tests: name shapes, use neutral replicas; commit messages and docs
  may cite titles. Do not modify mem-cash sources.
- After ANY parser regeneration re-pin the decision constants in `compiler.ts`; pin ANTLR 4.13.2.
- Check the code, not its comment, before stating behaviour; find walls by reading the code's shape, confirm with one
  targeted run.

**Marketplace harness recipe** (a harness is a full repo copy with a real `.marketplace`; scratch examples from the
merge: `/tmp/claude-0/-Code-cashscript/7d9e436e-7b78-4478-a4be-bd9ecdc098ab/scratchpad/mktKNP` (no-proxy) and
`.../mktKH2` (proxied), both at HEAD sources; `/tmp` copies can vanish - make your own):
1. Lay the sources you test over the copy, `npx tsc -b tsconfig.packages.json` there (the harness runs the SDK from
   `packages/*/dist`, not src).
2. RECOMPILE THE FIXTURE: `rm -rf .marketplace/cache node_modules/.experimental-vitest-cache && mkdir
   node_modules/.experimental-vitest-cache && node packages/solidhat/dist/cli.js compile` (60-100 s). Check the
   artifact mtimes in `.marketplace/artifacts/solidcash`. `MARKETPLACE_FIXTURE_STALE_OK=1` silences the staleness
   check - a run with a stale fixture mixes the old compiler's artifacts with the new SDK and proves nothing.
3. Titles: `npx vitest run --config vitest.marketplace.config.ts -t "<regex>"`. The pattern matches the full name with
   SPACES between describe/it names; anchor with `$` (`"post job 1$|take job$"`); ` > ` never matches.
4. Profiling: `SOLIDCASH_MARKETPLACE_CPU_PROFILE_DIR=<dir>` writes a CPU profile per worker.

## 2. Workstreams

### W1. Performance with the patched libauth
- Goal: measure `/Code/libauth` `perf-vm-fixes` against stock `3.1.0-next.8` on our workloads, decide adoption.
- Overlap: `packages/solidcash/src/network/createVirtualMachine.ts` already overrides operations (zero-copy stack
  operations, zero-copy OP_ACTIVEBYTECODE/OP_INPUTBYTECODE, OP_SPLIT with a bigint index, one operation-limit check).
  Measure the fork with these overrides on and off; remove what the fork makes redundant.
- Matrix: {stock, fork} x {SDK overrides on, off}. Workloads: one VM micro-benchmark per hot opcode family bucketed by
  operand size (framed copy work is byte-dominated by operands over 4 KB), the framed unit subset that took
  longest, marketplace titles on both lanes (approve sanity, refund sanity no-proxy; approve result, take job proxied),
  and the same titles on the kernel lane.
- Correctness: libauth's own test suite on the fork; identical title outcomes (and identical transactions where
  deterministic).
- Deliverable: a table in `docs/framed/PERF_LIBAUTH.md` (wall time, VM share), a decision (adopt via npm alias /
  publish / upstream PR to libauth), and the dependency change if adopted.
- Fork review (2026-10-05, by reading): what it has is correct - no aliasing hazard found (libauth's mutating ops
  work on fresh copies, `DataView` reads honour `byteOffset`, the alternate and control stacks are shallow-cloned,
  our SDK mutates no stack item in place), the copy-on-write marker is a non-enumerable `Symbol.for` key, and the
  CHANGELOG states the new immutability contract. It is NOT complete:
  - our SDK already overrides the dup family and OP_SPLIT (`installZeroCopyStackOperations` in
    `createVirtualMachine.ts`), so for SolidCash the fork only adds the function-table copy-on-write and
    `encodeDataPush`;
  - the fork's OP_SPLIT still converts the index with `Number(value)` on the one-item list (a decimal string per
    split; the SDK override fixes it);
  - with views, OP_DEFINE now stores a view as a function body and pins its whole parent buffer (the SDK stores
    `body.slice()`): add a compact copy in OP_DEFINE;
  - generic VM speedups still only in the SDK: cached OP_INVOKE decoding, cached OP_ACTIVEBYTECODE, zero-copy
    OP_INPUTBYTECODE, cached P2SH evaluation, the operation-limit check, the token-commitment introspection overrides
    (SDK-specific hooks stay in the SDK: sparse probe branch skips, step trace, failed-close recorder); the vmNumber
    fast path (~19% self time) is not done anywhere;
  - unverified: run libauth's full suite including the VMB consensus vectors for the 2025 and 2026 sets, and its
    benchmarks;
  - packaging: still named `@bitauth/libauth` (cannot be published under that scope); publish as e.g.
    `@solidcash/libauth` and consume as `"@bitauth/libauth": "npm:@solidcash/libauth@..."` so the SDK's deep
    imports (`@bitauth/libauth/build/lib/vm/...`) keep resolving; not wired into the monorepo yet.

### W2. Performance: kernel vs framed
- Goal: the same marketplace flows on both conventions at HEAD: framed proxied and no-proxy vs the kernel lane's
  proxied harness (built from the kernel worktree's config at HEAD, not the stale `d7f3c7ad6` tree).
- Metrics per title: wall time, CPU profile split (VM / derivation / compile), transactions and bytes per flow, fee,
  inputs per transaction, compile time of the fixture.
- Make the comparison fair: the kernel 66/66 ignores revert reasons under relaxed limits; run both with the same
  limits and assertion strictness, or report the difference.
- Note the post-merge framed titles ran ~1.5-2x faster than the pre-merge ladder (close job before timeout 27 s vs
  49 s); find out why (kernel-side VM work arriving with the merge, or box load) before quoting numbers.
- Deliverable: `docs/framed/PERF_KERNEL_VS_FRAMED.md`.

### W3. Artifact sizes: kernel vs framed
- Goal: compile the marketplace, the MistSwap fixtures and the solidity corpus (`examples/solidity-corpus`) under both
  conventions at HEAD; compare whole bytecode, summed function bodies, per-entry master program size, the largest
  input script per deployment (BCH limit 10,000 bytes per input; mocknet relaxes it), UTXOs per deployment and per
  call, and refused entries.
- Method: post-merge framed marketplace artifacts are within a few percent of pre-merge (MarketplaceV1 268k/287k ASM
  characters no-proxy/proxied vs 280k/299k). Compare JSON artifacts field by field (`bytecode`, `functionBodies`,
  `composition.refusedEntries`); a framed compile without the bus took over 30 minutes and was abandoned.
- Deliverable: `docs/framed/SIZE_KERNEL_VS_FRAMED.md` plus a reusable comparison script under `scripts/`.

### W4. Per-call performance and size optimizations (after W1-W3 baselines)
- Known levers, ranked by measured weight: (1) the plain path re-derives the whole composition for each learned value -
  learn several values per evaluation (structural batch learning); (2) the vmNumber conversion fast path (~19% self
  time in profiles; postponed by the user once - confirm before starting); (3) witness-block reads and other framed
  spans must stay outlinable (the merge showed what happens when they are not); (4) op-cost density caps size cuts
  (the corpus is near the operation-cost limit; do not trade op-cost for bytes blindly).
- Targets: slowest no-proxy titles back under the original 20-minute budget, then revert the harness timeout from 40
  to 20 minutes; no artifact grows.
- Each change lands with tsc, its own test, and 2-4 representative titles on both lanes after a fixture recompile.

### W5. Rename the convention to "framed" - DONE 2026-10-06, as a complete rename
- Footprint (as measured): 2704 lines in 120 src files plus their tests; directories
  `packages/{solidc,solidcash,utils}/src/framed` and their `test/framed`, `packages/testing/test/framed`,
  `docs/framed`, `packages/*/vitest.framed.config.ts`, `tsconfig.framed-tests.json`; public surface: the option
  value `composition: 'framed'`, the published `artifact.composition.convention`, error classes `Framed*Error`
  and codes `FRAMED_*`, exported functions (`callFramedEntry`, `callFramedProxyEntry`,
  `deployFramedStatefulContract`, `readFramedEntry`, ...), the fixture configs that set `composition`.
- Plan: scripted codemod (letter-guarded substitutions + `git mv`), two commits (moves, then content).
- **As executed (2026-10-06, `391208e7a` moves / `369b34419` content / `88c026992` fix).** The user chose a
  complete rename: there is **no deprecated alias**. `'per-call'` is refused as an unknown convention (pinned by
  `composition-convention.test.ts`), the artifact type publishes and reads only `'framed'`, and no `perCall*`
  export remains. This supersedes the original plan's "keep `'per-call'` accepted as a deprecated alias ... for
  one release", and the plan's text itself was renamed by the codemod, so treat this bullet as the record.
  Generated fixtures were renamed by the same codemod, consistent with what the compiler now emits; `yarn build`
  and `tsc -p tsconfig.framed-tests.json` pass; the framed suites sampled solidc, solidcash and testing pass.
- Timing: done before W8 at the user's direction (2026-10-06) rather than after it.

### W6. All suites green
- Suites: `yarn test` projects (solidc, solidcash incl. e2e and framed, utils, testing), `vitest.framed.config.ts`,
  the marketplace ladders (one full ladder per lane at the gate), `yarn test:regtest` subset on the regtest stack,
  `yarn lint`, `tsc -b`.
- Steps: (1) baseline run of each suite once, sequentially, at HEAD; (2) classify every failure: merge-caused (passes
  on one side's pre-merge commit), pre-existing on the kernel side, pre-existing on the framed side, flaky,
  environment (memory, timeouts); (3) fix in small batches by agents (one item each, own test file only); (4) a test
  that pins superseded behaviour is updated or removed with a reason in the commit message; nothing is skipped
  silently; (5) final gate: each suite once more, sequentially.
- Pitfall: compile caches key on compiler source hashes; harness fixtures do not (see the recipe).
- Status, 2026-10-06 (pointers, not decisions). The marketplace lane was red at HEAD for two reasons, both fixed:
  `246cdfd74` made a framed deployment report the logical CREATE address at `getAddress()` (`cee831dc2`, row D22), and
  a framed read never published the typed result projection, which `7088b6d6e` then exposed by removing the matcher's
  bridge for untyped byte pairs (`8c4671242`). Both are recorded in `MARKETPLACE_RED_AT_HEAD.md`.
- What is green now: `yarn lint` exit 0 (407 errors cleared, lerna had hidden 318 of them); `tsc -b` clean; the framed
  configs of solidc, utils and testing 1331 tests green; `packages/solidcash` framed 1815 passed with seven
  pre-existing `call/` failures; the proxied marketplace ladder 66/66 in 2509 s (`LADDER_AT_HEAD.md`); the no-proxy
  twin functionally 65/65, its two cap-induced timeouts passing alone (`LADDER_NOPROXY_AT_HEAD.md`); and four of the
  nine release gate scripts green, with the artifact-size item closed at `598b92837` (`W4_SIZE_GROWTH.md`).
- What is still open for the gate: nothing in the suites. The 29 unrecorded failures are closed - see the status
  block below - and every remaining failure in `yarn test` (40 in `solidcash`) and `yarn test:e2e` (5) is a
  `W6_BASELINE.md` row, checked mechanically by title. The release gate scripts are green except
  `test:kernel-beta:local`, whose `--tests-only` mode would restate those same baseline rows.
- Also open, from W4: the slowest no-proxy title needs 19 to 23 minutes depending on load, so W4's 20-minute budget
  target is unmet; the ranked perf work is in `W4_WINS.md` and its baseline needs an idle box.
- Status, 2026-10-07 (pointers, not decisions). All 29 unrecorded failures are classified
  (`W6_NEW_FAILURE_CLASSIFICATION.md`: 28 regressions, 1 load-induced timeout) and all 28 are fixed
  (`W6_FAILURE_FIXES.md`). The regressions were seven commits: `ce2f7bba1` (reverted and then reinstated with a
  guard, `add6f3c71` + `510bb6ec0`), `b6ee86a3f` (`07950282c`), `a2bcdb614` (`27108b19b`), `598b92837` +
  `0cffcb936` + `db0551317` (`ac4a136f2`), `d532aa32a` (`3d90af923`) and `fcb3aff77` + `f4a00d3ff` (`da3b9d2ac`).
  The gate itself is `W6_GATE_AT_HEAD.md`; at `ab8a97acb`, `solidc` is 6839/6839, `utils` 480/480, `testing`
  99/99, `solidhat` 71/71 and `testing-suite` 27/27, `solidcash` is 5344 passed with its 40 baseline rows,
  `test/e2e` is 3208 passed with its 5 baseline rows, both framed configs hold their baseline rows, `tsc` and
  `yarn lint` are clean, and the proxied marketplace ladder is 66/66 in 2402 s. The No-proxy twin is the last
  gate item.
- Two gate items are deliberately not satisfied: `KernelIndependentComputedChunks` and three
  `KernelMixedEntryInsert` titles are `W6_BASELINE.md` pre-existing kernel rows that `0cffcb936` had incidentally
  fixed; `ac4a136f2` returns them to that state because their `Store.update` shape is byte-identical to
  `KernelDirectComputedChunks`'s while the titles pin the same `eligible` flag to opposite values.

### W7. Test count reduction
- Phase 1, by the shape of the code (no coverage tools yet): cluster test files by subject using
  `test/framed/MANIFEST.md`, test titles and the sources they compile; find (a) identical contracts compiled with
  identical options in several files, (b) "wall" tests pinning intermediate refusals a later feature removed, (c) e2e
  tests that only re-assert what a unit test of the same code already pins, (d) loops of near-identical `it`s that
  should be one `it.each`, (e) probe/diagnostic tests left from investigations. Propose merges/deletions per cluster
  with the reason; land per cluster.
- Phase 2, coverage: `vitest --coverage` (v8) per package; per-file marginal coverage to find tests adding no unique
  lines/branches. Caveat: VM-level behaviour lives in emitted bytecode, not in TypeScript lines - a test with no unique
  TS coverage can still be the only one executing a script path; keep such tests (check the script, not just lines).
- Target to agree with the user (e.g. -30..40% of `it`s) with no loss of line/branch coverage and green ladders.

### W8. Rebase onto the most recent CashScript
- Status, 2026-10-07: **deferred by the user** ("keep the brief only; no merge this session"). The brief is
  `W8_MERGE_PREP.md`; it records that the `cashscript` remote already exists and is reachable, that the distance is
  22 upstream commits against 7,489 of ours with 65 paths changed on both sides, and that the rename makes the work
  a port rather than a merge resolution. Nothing was merged.
- A literal rebase of 7342 commits is not practical; merge upstream into the branch instead (or cherry-pick).
- Steps: the remote already exists and is fetched (see the status line); otherwise
  `git remote add cashscript https://github.com/CashScript/cashscript.git && git fetch cashscript`. Then list the
  upstream commits since the fork point `a34616620` (and the 8 local `master` commits not in HEAD); classify them
  (grammar/compiler features, SDK/network providers, utils, libauth bumps, docs, tooling); decide per class
  (merge / adapt / skip with reason); do the merge in a scratch worktree; resolve in parallel by area (the kernel-beta
  merge used five agents by path area: generation+grammar+ast, semantic+artifact+utils, stateful SDK, tests,
  the rest).
- Pitfalls: grammar changes need an ANTLR 4.13.2 regeneration AND re-pinned decision constants in `compiler.ts`;
  libauth version alignment with W1; package names differ (solidcash vs cashscript); generated fixtures regenerate.
- Gate: W6's suites plus representative titles on both lanes, then the full ladders once.

### W9. Revise all worktrees and remove them after the merge
- When: after `feat/framed` has landed on `solidcash_v0.13.1` (section 4, phase 3).
- Inventory at 2026-10-05 (commits not in `feat/framed` HEAD / uncommitted files / last commit):

| worktree | branch | not in HEAD | dirty | last |
|---|---|---|---|---|
| /Code/cashscript (main checkout) | detached | 27 | 6 | 2026-10-03 |
| .worktrees/affine-verify-final-rAUwjd | detached | 0 | 4 | 2026-09-09 |
| .worktrees/eacc-batch1-gate | grok/eacc-batch1-gate | 52 | 6 | 2026-08-25 |
| .worktrees/eacc-boundary-c2 | detached | 0 | 1 | 2026-08-24 |
| .worktrees/eacc-boundary-d5 | detached | 0 | 1 | 2026-08-24 |
| .worktrees/eacc-noproxy | codex/eacc-noproxy | 20 | 0 | 2026-10-02 |
| .worktrees/eacc-noproxy-kernel-beta | codex/eacc-noproxy-on-kernel-beta | 0 | 0 | 2026-10-04 |
| .worktrees/effectiveacceleration-marketplace | codex/effectiveacceleration-marketplace | 6 | 149 | 2026-08-29 |
| .worktrees/effectiveacceleration-performance | grok/message-bus-kernel | 62 | 436 | 2026-09-10 |
| .worktrees/kernel-beta-candidate | grok/message-bus-kernel-beta | 0 | 0 | 2026-10-04 |
| .worktrees/kernel-beta-perf | grok/message-bus-kernel-beta-perf | 1 | 0 | 2026-09-15 |
| .worktrees/kernel-comprehensive-fixtures | grok/kernel-comprehensive-fixtures | 0 | 2587 | 2026-09-25 |
| .worktrees/kernel-perf-baseline | detached | 0 | 8 | 2026-08-25 |
| .worktrees/kernel-perf-tip | detached | 0 | 5 | 2026-08-27 |
| .worktrees/kernel-return-helper-isolated | detached | 22 | 3 | 2026-09-09 |
| .worktrees/noproxy-integration-TnMN8e | codex/eacc-noproxy-integration | 0 | 0 | 2026-10-02 |
| .worktrees/framed | feat/framed | 0 | 0 | 2026-10-05 |
| .worktrees/release-readiness | codex/release-readiness-final | 1 | 0 | 2026-08-11 |
| .worktrees/solidhat-marketplace-mock | codex/solidhat-marketplace-mock | 2 | 0 | 2026-09-16 |
| /root/.grok/worktrees/code-cashscript/2026-10-01-ce834b2b | detached | 19 | 6 | 2026-10-02 |

- Steps per worktree: (1) check nothing runs in it (`/proc/<pid>/cwd`; never kill other sessions' processes); (2)
  classify: merged and clean -> remove; unmerged commits -> review each (cherry-pick what the release needs, otherwise
  archive with a tag `archive/<name>` pushed to `private`); uncommitted files -> save `git diff` plus the untracked
  list as a patch under an archive directory before removal; (3) `git worktree remove <path>` (never `--force` on a
  dirty tree before its patch is saved); (4) delete merged branches; (5) `git worktree prune`.
- `.worktrees/release-readiness` (`codex/release-readiness-final`) holds earlier readiness work: read it first, it may
  overlap section 3. The Grok worktree belongs to another tool; coordinate before touching it. The main checkout
  `/Code/cashscript` is not removed; move it to a branch after its 27 commits and 6 files are triaged.
- Also clean: session scratch copies under `/tmp/claude-0/*/scratchpad` (harness copies `mkt*`, built trees `st*`,
  `land-*`), stale branches (`codex/*`, `grok/*`) and stash entries (inspect; never pop another session's entry).
- Ask the user before deleting anything with unmerged commits or uncommitted files: deletion cannot be undone.

### W11. Port the rescued kernel-lane fixes (`rescue/main-checkout-2026-10-03`)
- What: 27 commits (to `cac34c86d`, 2026-10-01 21:46 .. 10-03 06:19, +4501/-224 in 47 files) made on a detached HEAD
  in the main checkout `/Code/cashscript`, branched from `solidcash_v0.13.1` like the kernel beta, and in neither
  `feat/framed` nor the kernel beta (`git cherry`: 27 missing, 0 equivalent). Pinned by the branch above. Shape:
  kernel-lane (default composition) SDK work for a ported project - block bands, dynamic chunk runs, aliased return
  channels, a multi-writer carrier union, the atomic composer for a standalone owner's repeated calls, emission order
  by source callsites, value-chunk claims, runtime-loop entry coordinates, external view reads, vmap numeric-key
  hashing, struct getter tuples - plus small codegen fixes (dynamic-chunk band anchor, runtime mapping entries vs a
  same-call dynamic write, runtime cardinality for source-array upsert loops, call source positions) and the testing
  package's ported-project config. No framed code.
- Evidence on `57dfa942e` (its 23 test files, run once): 4 pass (the kernel beta covers them: constructor chunked
  write, placeholder convergence, chunkable arity, chunk band alignment); 12 fail only because they unit-test helpers
  this line introduced; behavioural failures: e2e `VmapNumericKeySlot` and `VmapStructGetterTuple` (BCH-2026 preflight,
  OP_VERIFY), `journal-message-bus/e2e/KernelDynamicWriteEntryBand` (2/3), solidc `DynamicChunkAnchorWitness` and
  `DynamicChunkBaseStepDown`, `AliasReturnChannel`, `SharedViewAliasReturnChannel`, `ComposeLayoutAuthority` (layout
  invariant), testing `physical-identity` (address mismatch). HEAD's kernel lane still has these bugs.
- How: do not merge the line wholesale - it rewrote the files the kernel beta rewrote (`StatefulContract.ts`,
  `StatefulTransactionBuilder.ts`, `message-bus/compose.ts`). Port per behavioural test: copy the test, find the
  commit(s) whose change makes it pass, adapt to HEAD, land with that test; take helpers only where the fix needs
  them. Compiler-side ports reach framed compiles too: check the framed fixtures' sizes and `refusedEntries`
  (section 0). Schedule with W6.
- Port items, in order (one agent per item; items touching `StatefulContract.ts`/`StatefulTransactionBuilder.ts`
  land one after another; the failing evidence is the 2026-10-05 run, so no reproduction runs):
  - P1 `d55a5e9bf` vmap numeric key hashed as its canonical VM number (`StatefulContract.ts`); test
    `e2e/VmapNumericKeySlot` (preflight OP_VERIFY on HEAD). Small. Per-call already keys numbers as VM numbers.
  - P2 `785fc7189` multi-output struct getter read as a named tuple (`StatefulContract.ts`); test
    `e2e/VmapStructGetterTuple` (preflight). Small.
  - P3 `e6ce62cf1` dynamic-chunk band anchored on the last returned event (GenerateTargetTraversal); test solidc
    `DynamicChunkAnchorWitness`. Compiler: framed fixture check.
  - P4 `6eb0c9732` the writer's own return ABI, no unmaterialized-return chunk step (GenerateTargetTraversal,
    `StatefulTransactionBuilder.ts`); tests solidc `DynamicChunkBaseStepDown`, sdk `WriterReturnAbi`. Compiler check.
  - P5 `1ec288a10`, testing-package part only (`packages/testing/src/config.ts`, `hre.ts`); test testing
    `physical-identity`. Do NOT take its root `solidcash.config.ts` change (that file is the framed fixture config);
    its constructor-frame part is already covered on HEAD.
  - P6 aliased return channels, as one unit: `9ec41b74a` carrier union, `26df19f6e` fill the aliased read-only
    callsite's return channel (it also touched testing-suite example artifacts: regenerate them, do not copy),
    `39c5b0df2`, `3196a56f9` an output coordinate per channel; tests `SharedViewAliasReturnChannel`,
    `AliasReturnChannel`, `MultiWriterCarrierUnion`. Medium-large.
  - P7 `cac34c86d` participant-declared materialized value-chunk base (`message-bus/compose.ts`,
    `layout-resolver.ts`); test `ComposeLayoutAuthority` (the rescued cases). Small-medium.
  - P8 runtime loops beside dynamic writes, as one unit: `308e291c5` runtime cardinality for source-array upsert loops
    (`compiler.ts`; reconcile with the kernel beta's `eee4fc1a6` fallback cardinality and keep the framed gate in
    `LowerVMapCounterLoops`), `a26ee78d1` runtime mapping entries not shifted by a same-call dynamic write,
    `721d7d857`, `c2108a8e0` an external view read instead of sent, `42e034bc7`, `22ee5dbe9`, `e220dd726`; test
    `journal-message-bus/e2e/KernelDynamicWriteEntryBand` (2/3 fail: preflight, and "typed loop callsite 0 requires
    atomic composition", which may need P9). Compiler check. Large.
  - P9 only if P8 or W6 shows a behaviour needing it: `37df575b2` a standalone owner's repeated calls promoted to
    the atomic composer (large; changes the artifact schema in `utils/src/artifact.ts`), `3241b90f4`, `cf34b6417`
    call source positions and unreached conditional entries, `21c446e8f`, `6b54ed8c8` (new `worklist.ts`). Its tests
    are helper-level today.
  - P10 helper-level fixes (`7b07c050e`, `dcb29f1a9`, `1ed403081`, `cd7891b12`): port one only after writing a
    behavioural test from its commit message that fails on HEAD.
  - Skip: `ced497d54` and the constructor tests of `1ec288a10` (they pass on HEAD).
- Gate: the ported tests; the 20 framed files of the merge; representative titles on both framed lanes after a
  fixture recompile (after compiler items); representative kernel-lane marketplace titles.
- Status 2026-10-05:
  - Landed, each with its test passing:
    - P1 `920cf4ad8`;
    - P2 `84e349830`: the ABI route reads the tuple; a getter's bare name keeps HEAD's state-accessor struct;
    - P3 `bdcef843d`: OP_MAX anchor with HEAD's no-call fallback;
    - P4 `1c63087ed`: the step-down after a witnessed anchor is gated on "no returning call ran", HEAD's SDK
      compaction rule; the test was adapted;
    - P5 `c3b274eb5`.
  - P3/P4 leave both framed marketplace fixtures byte-identical (recompiled and compared), so no framed titles
    were needed.
  - P7: superseded. HEAD's `compose-assemble.ts` already accepts a participant's own materialized value-chunk band
    without a transported claim, and validates it against the physical outputs.
  - P8 and P6 failed identically on the pre-merge kernel beta (`d7f3c7ad6`): long-standing kernel-lane bugs in code
    the kernel beta rewrote. They were fixed fresh inside HEAD's design, not ported:
    - P8 test 1 `bb01e8fdc`: HEAD's direct-loop rule (`0b737d6c1`) minted the entry at the predecessor's INPUT
      index; the covenant's output base counts no old chunk of an array the call writes, so each such chunk
      co-spent ahead of the predecessor now compacts it (`getLoopEntryOutputBase`). `721d7d857` (legacy input
      order) does not reach this dense path.
    - P8 test 3 `c3e9052ce`: HEAD already had the per-occurrence resolver and replacement pass; only the
      "requires atomic composition" refusal ran before the builder knew it was a return probe. A probe now admits a
      repeated typed loop that publishes a result array; the direct group push still refuses when no resolver
      attaches. Sends keep the refusal.
    - P8 `a26ee78d1`: already on HEAD. Test 2 passed on HEAD. The test file landed whole (marketplace name removed).
    - P6 `fa3485980`: `3196a56f9`'s three placement invariants in `physical-return-layout.ts`,
      `stb-place-tail-return.ts` and `stb-inblock-writer-returns.ts` (one output per tail family; reserve a
      writer's built slot, not its stale plan; binding a writer alias leaves its view owner's tail and witnesses).
      Test `unit/AliasReturnChannel` (rescued cases, neutral names, plus the witness case).
    - P6 not ported: `26df19f6e`'s alias-channel fill (a probe already precomputes every group, an alias's too; a
      plain callee's two returning methods are refused for a send by design; a routed callee's send composes both
      rows) and the `9ec41b74a`/`39c5b0df2` carrier union (moved no title in its own measurement; HEAD refuses that
      shape fail-closed). The framed SDK does not use the stateful builder, so framed is unaffected.
  - Found while checking P6, fixed `eb282b4e6`: a VIEW reading two different methods of one routed participant
    (`readBoth() { a = s.flag(); b = s.paused(); }`) failed its return probe at the second callsite's selector check
    (the probe builder lets only the first callsite own the participant's input), while the same shape SENDS through
    the atomic composer (`mayRepeatOwner`). A top-level read of such a function now builds that composition without
    broadcasting it and takes the root invocation's result, which the composer records per admitted builder
    (`compose-invocation-results.ts`). Caller: the connected signer, else a throwaway key. Loops, nested frames and
    framed artifacts keep their paths. Test `e2e/SharedViewAliasRead`. (A probe-only copy of the callee block
    was tried first and reverted: the builder's duplicate-stateful-input guard and outpoint-keyed maps.)
  - P9/P10: still no behavioural evidence on HEAD; not ported.
- Uncommitted work in the main checkout (2026-10-03 09:17-09:40): an unfinished kernel feature, row-local route
  witnesses (per-row witness bands for read-only argument keys in batched rows): `compiler.ts` +137,
  `LowerCollectionJournalHelpers.ts` +130, `StatefulContract.ts` +20, `KernelCutoverRoute.test.ts`, new
  `KernelRowLocalRouteWitness.test.ts`. Pinned as `rescue/main-checkout-wip-2026-10-03` (`32e7016f4`, a snapshot
  commit on `cac34c86d` made through a temporary index; the checkout itself is untouched). Leave the feature to its
  owner (two grok processes and a Claude session run in that checkout); port it like P1-P10 once it is finished.

### W10. Land on solidcash_v0.13.1
- After W6's final gate (and W5, W8 if they are in scope for the release): fast-forward `solidcash_v0.13.1` to the
  release commit (or a merge commit if the branch moved), tag it, push to `mew` and `private` with the user's go-ahead.

## 3. Additional pre-release items (proposed)

1. Model B address representation (decided, deferred): it changes D13, address results and mapping keys - a breaking
   ABI/artifact change. Decide whether it ships before this release; after it, it needs a migration story.
2. Security triage: the msg.sender forgeability finding (`docs/framed/AUDIT_MSG_SENDER.md`), the state-bus
   transcript findings, the kernel's lenient `revertedWith`; each fixed or documented as a known limitation.
3. Consensus realism: mocknet relaxes the operation-cost and input-size limits and runs a different derivation path
   than production. Run representative marketplace titles on the regtest stack (BCHN + Fulcrum,
   `docker-compose.regtest.yml`) for both conventions; check standardness (transaction size, per-input script size,
   fee rate, unconfirmed chain depth).
4. Release hygiene: remove debug hooks from src (`SOLIDC_DEBUG_*` console output such as `sorted-key-missing-param` in
   GenerateTargetTraversal, temporary `SC_*`/env switches), non-ASCII characters (an em-dash near compiler.ts:14746),
   lines over 125 columns (LowerVMapCounterLoops ~4459/4547, compiler.ts ~984/11297/12122), and the root-level working
   notes (`GOAL_*.md`, `HANDOFF_*.md`, `NEXT_SESSION_*.md`, `FENCE_MAP_*.md`, ...): archive under `docs/archive/`.
5. Packaging: versions and changelog, migration guide (start from `examples/testing-suite/MIGRATION.md`), docs for
   both conventions and how to choose, `npm pack` dry runs, a clean-clone `yarn && yarn build`, the libauth fork
   consumption (W1), license and package metadata.
6. Compile time: the marketplace fixture compiles in 60-100 s per lane, but a framed compile with the bus off took
   over 30 minutes; find the pathological path before users hit it.
7. Determinism: generated fixtures (MistSwap artifacts, testing-suite golden_token, marketplace typechain) regenerate
   byte-identically from a clean build; CI refuses stale fixtures (never `MARKETPLACE_FIXTURE_STALE_OK` in a gate).
8. CI: suites sharded to fit memory, nightly ladders for both conventions, a regtest job, lint and tsc.
9. Convention compatibility matrix: keep the list of kernel features gated off for framed (section 0, merge seams)
   in `docs/framed/DECISIONS.md` or its own doc, so the next kernel merge checks them first.
10. Example projects (`examples/*`): compile and test against the release packages; remove or fix stale ones.

## 4. Sequencing

- Phase 0, baselines (parallel, read-mostly): W6 step 1 (suite baseline, sequential), W1/W2/W3 measurements, W7
  phase 1 analysis, W8 upstream survey, W9 inventory refresh (no removals), section 3 items 2 and 4 triage.
- Phase 1, fix and optimize: W6 fixes, W4 (guided by W1-W3), W1 adoption, W7 landings per cluster, section 3 items
  3, 6, 7.
- Phase 2, big mechanical changes in quiet windows: W8 upstream merge, then W5 rename (one owner each, nothing else
  landing meanwhile), then model B if it is in scope.
- Phase 3, release gate: W6 final gate (all suites once, both full ladders once, regtest titles), section 3 item 5,
  W10 landing, then W9 removals.
