# Why the no-proxy marketplace ladder runs ~4x the proxied ladder

**Provenance.** Produced 2026-10-10 by a read-only investigation worker in the session that landed the
`addressForm` work (README-style report; the worker's scratch under `/tmp/af-noproxy-speed/` is not durable, the
tables below are the record).

**Read-only investigation.** No ladder was run, no repository file was modified. Every number below comes from
already-captured logs, the on-disk `.marketplace/artifacts` each lane left behind, the lane/config tooling, and the
framed design docs. Scratch files are under `/tmp/af-noproxy-speed/`.

**Revision worked against.** `git -C /Code/cashscript/.worktrees/per-call rev-parse --short HEAD` =
**`d8e59ae7b`** (landing worktree `/Code/cashscript/.worktrees/per-call`). All reads used the full worktree path.

**Revisions the logs and artifacts are from** (the worktree HEAD is newer than any of them):

| log | lane | revision | titles | vitest Duration |
|---|---|---|---:|---:|
| `ladder-head.log` | proxied | `d4fe519ed` | 66 | 2508.31 s |
| `gate-ladder-proxied.log` | proxied | `40b437c60` | 66 | 2752.02 s |
| `gate2-ladder-proxied.log` | proxied | `270ff36d3` | 66 | 2587.56 s |
| `gate3-ladder-noproxy.log` | noproxy | `40b437c60` | 65 | 9958.39 s |

`gate-ladder-proxied.log` and `gate3-ladder-noproxy.log` are the clean **same-revision** pair (`40b437c60`), so the
per-title table below uses `ladder-head.log` (`d4fe519ed`) for the proxied column together with `gate3`
(`40b437c60`); the three proxied runs are within 10% of each other per title (median table at the end).

---

## 1. Wall time and per-title comparison

### Totals

| lane | titles | sum of per-test ms | vitest `tests` | vitest `Duration` | wall (incl. compile) |
|---|---:|---:|---:|---:|---:|
| proxied (`d4fe519ed`) | 66 | 2,502,820 | 2502.84 s | 2508.31 s | 2509 s (documented) |
| noproxy (`40b437c60`) | 65 | 9,952,769 | 9952.79 s | 9958.39 s | 10165 s (`start 18:02:18Z` -> `end 20:51:43Z`) |

- **Matched on title text**: 65 of 65 noproxy titles match a proxied title; the proxied lane's one extra title is
  `admin > can not call initializer` (86 ms), which exists only because the proxied suite has `initialize` /
  `Initializable`. It is 0.003% of the proxied total, so the two totals are directly comparable without
  title-count weighting.
- **Matched-title totals**: proxied 2,502,733 ms vs noproxy 9,952,769 ms = **ratio 3.98**, difference **+7,450 s**.
- Every matched title has a positive difference except the trivial admin/register/params/mece-tags rows, which are
  at parity or slightly *faster* in noproxy (see the table).

### Concentration of the difference

The excess is carried by a handful of titles; the rest is a long tail:

| top N | cumulative excess | share of the 7,450 s excess | share of the proxied total |
|---:|---:|---:|---:|
| 1 (`approve result and review > sanity checks`, +901.5 s) | 901 s | 12.1% | 36.0% |
| 2 (+ `refund > sanity checks`) | 1,494 s | 20.1% | 59.7% |
| 5 | 2,527 s | 33.9% | 101.0% |
| 10 | 4,156 s | 55.8% | 166.1% |
| 15 | 5,642 s | 75.7% | 225.4% |
| 20 | 6,633 s | 89.0% | 265.0% |

There is no single runaway outlier: the largest single title (`approve result and review > sanity checks`,
+901.5 s, the ~1,265,000 ms row the task named) is 12% of the excess, and the excess is spread across the
composition-heavy flow titles (`take job`, `post thread message`, `deliver result`, the `arbitrate` family,
`dispute`, `refund`, `refuse arbitration > job taken`) at 2.4x-7.2x each.

### Matched-title table (proxied order)

| # | title | proxied ms (head) | noproxy ms | ratio | diff s |
|---:|---|---:|---:|---:|---:|
| 1 | admin > transfer owner | 3912 | 2841 | 0.73 | -1.1 |
| 2 | admin > non owner cannot transfer owner | 93 | 59 | 0.63 | -0.0 |
| 3 | admin > pause/unpause | 540 | 343 | 0.64 | -0.2 |
| 4 | admin > non pauser cannot pause | 88 | 53 | 0.60 | -0.0 |
| 5 | admin > non pauser cannot unpause | 316 | 197 | 0.62 | -0.1 |
| 6 | admin > set version | 240 | 154 | 0.64 | -0.1 |
| 7 | admin > non owner cannot set version | 82 | 53 | 0.65 | -0.0 |
| 8 | register user > register user | 1213 | 1203 | 0.99 | -0.0 |
| 9 | register user > update user | 997 | 817 | 0.82 | -0.2 |
| 10 | register arbitrator > register arbitrator | 1133 | 1071 | 0.95 | -0.1 |
| 11 | register arbitrator > update arbitrator | 957 | 827 | 0.86 | -0.1 |
| 12 | unicrow params > set unicrow markeplace address | 333 | 236 | 0.71 | -0.1 |
| 13 | unicrow params > set unicrow contract addresses | 339 | 224 | 0.66 | -0.1 |
| 14 | mece tags > read mece tag | 67 | 61 | 0.91 | -0.0 |
| 15 | mece tags > update mece tag | 690 | 474 | 0.69 | -0.2 |
| 16 | mece tags > remove mece tag | 403 | 280 | 0.69 | -0.1 |
| 17 | job posting > post job 1 | 3529 | 12426 | 3.52 | 8.9 |
| 18 | job posting > post two jobs | 15730 | 53282 | 3.39 | 37.6 |
| 19 | job posting > post job with whitelist | 8484 | 22502 | 2.65 | 14.0 |
| 20 | job posting > post job with arbitrator same as creator | 2984 | 17643 | 5.91 | 14.7 |
| 21 | job posting > post job with invalid token | 1260 | 3595 | 2.85 | 2.3 |
| 22 | job posting > post job with invalid amount | 5852 | 45585 | 7.79 | 39.7 |
| 23 | job posting > post job with invalid deadline | 412 | 340 | 0.83 | -0.1 |
| 24 | job posting > post job with invalid title | 3594 | 31925 | 8.88 | 28.3 |
| 25 | job posting > post job with invalid delivery method | 4179 | 40742 | 9.75 | 36.6 |
| 26 | job posting > post job from unregistered user | 1791 | 19895 | 11.11 | 18.1 |
| 27 | job posting > post job with invalid mece tags | 12280 | 61790 | 5.03 | 49.5 |
| 28 | job posting > post job with unregistered arbitrator | 10883 | 45457 | 4.18 | 34.6 |
| 29 | job worker whitelisting > should whitelist worker | 11038 | 30209 | 2.74 | 19.2 |
| 30 | job updates > update job | 18232 | 79819 | 4.38 | 61.6 |
| 31 | job updates > update job arbitrator | 15796 | 43020 | 2.72 | 27.2 |
| 32 | job updates > update job tags | 13095 | 41745 | 3.19 | 28.6 |
| 33 | job updates > update job amounts | 20891 | 61642 | 2.95 | 40.8 |
| 34 | job updates > update job many times, get history | 76272 | 189428 | 2.48 | 113.2 |
| 35 | close job > close job before timeout | 9489 | 30228 | 3.19 | 20.7 |
| 36 | close job > close job after timeout | 10602 | 31775 | 3.00 | 21.2 |
| 37 | reopen job > reopen job before timeout | 11761 | 33796 | 2.87 | 22.0 |
| 38 | reopen job > reopen job after timeout | 11569 | 34215 | 2.96 | 22.6 |
| 39 | withdraw collateral > withdraw collateral | 11903 | 35117 | 2.95 | 23.2 |
| 40 | take job > sanity checks | 42199 | 137899 | 3.27 | 95.7 |
| 41 | take job > take job | 65246 | 415382 | 6.37 | 350.1 |
| 42 | take job > take job multiple | 13176 | 45071 | 3.42 | 31.9 |
| 43 | pay start job > sanity checks | 59052 | 98683 | 1.67 | 39.6 |
| 44 | pay start job > pay start job | 40268 | 173308 | 4.30 | 133.0 |
| 45 | post thread message > sanity checks | 62975 | 400233 | 6.36 | 337.3 |
| 46 | post thread message > post thread message | 9628 | 31229 | 3.24 | 21.6 |
| 47 | deliver result > sanity checks | 53396 | 385573 | 7.22 | 332.2 |
| 48 | deliver result > deliver result | 53210 | 384113 | 7.22 | 330.9 |
| 49 | approve result and review > sanity checks | 363296 | 1264795 | 3.48 | 901.5 |
| 50 | approve result and review > approve result | 133295 | 478146 | 3.59 | 344.9 |
| 51 | refund > sanity checks | 186085 | 779051 | 4.19 | 593.0 |
| 52 | refund > refund | 70196 | 374638 | 5.34 | 304.4 |
| 53 | dispute > sanity checks no arbitrator | 40129 | 220291 | 5.49 | 180.2 |
| 54 | dispute > sanity checks with arbitrator | 56674 | 344087 | 6.07 | 287.4 |
| 55 | dispute > sanity checks closed job | 9787 | 30121 | 3.08 | 20.3 |
| 56 | dispute > dispute creator | 55265 | 338551 | 6.13 | 283.3 |
| 57 | dispute > dispute worker | 53197 | 334702 | 6.29 | 281.5 |
| 58 | arbitrate > sanity checks | 214058 | 503179 | 2.35 | 289.1 |
| 59 | arbitrate > arbitrate 80-20 | 145907 | 469001 | 3.21 | 323.1 |
| 60 | arbitrate > arbitrate 0-100 | 123502 | 450650 | 3.65 | 327.1 |
| 61 | arbitrate > arbitrate 100-0 | 102808 | 419074 | 4.08 | 316.3 |
| 62 | refuse arbitration > job closed | 9377 | 29203 | 3.11 | 19.8 |
| 63 | refuse arbitration > job not taken | 9670 | 28972 | 3.00 | 19.3 |
| 64 | refuse arbitration > job taken | 72973 | 371820 | 5.10 | 298.8 |
| 65 | integration test > integration test | 164335 | 469928 | 2.86 | 305.6 |
| | **TOTAL (65 matched)** | **2502733** | **9952769** | **3.98** | **7450.0** |

Two patterns in the table:

- **Trivial titles are at parity.** `admin > *`, `register user`, `register arbitrator`, `unicrow params`, and the
  `mece tags` rows are 0.6-1.0x (noproxy equal or *faster*). These titles exercise one small call plus the shared
  deploy fixture, so they bound the per-title harness/deploy cost as small and, if anything, cheaper in noproxy.
- **Every composition-heavy title is 2.4x-7.2x.** The largest ratios are titles dominated by a single
  cross-contract entry: `job posting > post job from unregistered user` 11.1x, `post job with invalid delivery
  method` 9.75x, `invalid title` 8.88x, `invalid amount` 7.79x, `deliver result` 7.22x, `take job` 6.37x.

---

## 2. Compile vs execution

The fixture compile is a **separate step** that runs before vitest (`node packages/solidhat/dist/cli.js compile`);
the configured `globalSetup` (`scripts/marketplace-fixture-fresh.mjs`) only *checks* staleness, it does not compile.
So the fixture compile is **not** inside the vitest `Duration`.

| | proxied | noproxy | ratio |
|---|---:|---:|---:|
| fixture compile (documented; `archive/docs:docs/framed/LADDER_AT_HEAD.md` / `archive/docs:docs/framed/LADDER_NOPROXY_AT_HEAD.md`) | 127 s | 158 s | 1.24 |
| fixture shape | 9 sources -> 19 artifacts | 22 sources -> 26 artifacts | - |
| vitest `transform` + `setup` + `import` | 3.36 + 5.00 s + 295 ms | 3.55 + 5.07 s + 382 ms | ~1.0 |
| vitest `tests` | 2502.84 s | 9952.79 s | **3.98** |
| vitest `Duration` | 2508.31 s | 9958.39 s | 3.97 |
| wall incl. compile+prep | ~2867 s (`gate-ladder-proxied`, start 17:09:35Z -> end 17:57:22Z) | ~10165 s (`gate3`, start 18:02:18Z -> end 20:51:43Z) | 3.55 |

- The fixture compile is **4.8%** of the proxied wall (127 / 2635) and **1.6%** of the noproxy wall (158 / 10116).
- Compile ratio is **1.24x**; the run ratio is **3.98x**. Removing compile entirely (comparing vitest `tests` only)
  leaves 2502.84 s vs 9952.79 s.
- **Conclusion: the 4x is execution time, not a compile artifact.** Only ~5 s of the vitest `Duration` is
  transform/setup/import; the rest is the test bodies driving the SDK/VM.

---

## 3. Shape evidence

### Deployed set (identical in both lanes)

Both logs show the same seven contract deploys: `Unicrow`, `UnicrowDispute`, `UnicrowArbitrator`, `UnicrowClaim`,
`Marketplace`, `MarketplaceData`, `FakeToken`. The only difference is the pattern:

- **proxied**: `Marketplace` and `MarketplaceData` are deployed with `upgrades.deployProxy` (test
  `marketplace.test.ts:155`, `:169`), so the test calls the OZ proxy addresses; the impl constructs use
  `OwnableUpgradeable` / `PausableUpgradeable` / `Initializable` and carry a `uint256[41] __gap`.
- **noproxy**: `Marketplace` and `MarketplaceData` are deployed directly with `.deploy` (test `:185`, `:199`); the
  impl constructs use `Ownable` / `Pausable`.

Everything else in the two `marketplace.test.ts` files is byte-for-byte the same task. The other 24 lines of
difference are the noproxy suite's in-memory IPFS `fetch` mock and the `OwnableUpgradeable` -> `Ownable`
`revertedWithCustomError` interface swap; neither touches call volume.

### Artifact files and emitted bytecode

`.marketplace/artifacts` left by the proxied gate run (worktree, 17:11) and the noproxy gate run (harness, 18:05),
both at `40b437c60`, read with `scripts/artifact-sizes.mjs`:

| artifact | count proxied/noproxy | proxied bytecode (B) | noproxy bytecode (B) |
|---|---:|---:|---:|
| MarketplaceV1 | 1 / 1 | 135,953 | 126,749 |
| MarketplaceDataV1 | 1 / 1 | 110,050 | 105,852 |
| Unicrow | 1 / 1 | 56,258 | 56,258 |
| UnicrowArbitrator | 1 / 1 | 27,082 | 27,082 |
| UnicrowClaim | 1 / 1 | 21,801 | 21,801 |
| UnicrowDispute | 1 / 1 | 31,305 | 31,305 |
| FakeToken | 1 / 1 | 24,260 | 24,260 |
| **total artifacts in dir** | **19 / 26** | | |
| noproxy-only | | | MarketplaceV2 148,653; MarketplaceV3 148,580; EACCToken 37,942; MockSablierLockup 9,832; TreasurySplit 7,049 |

- **The noproxy scripts are not larger.** `MarketplaceV1` is 9 KB *smaller* in noproxy, `MarketplaceDataV1` 4 KB
  smaller, and the Unicrow/FakeToken scripts are byte-identical. The 26-vs-19 artifact gap is the noproxy project
  compiling V2/V3/EACCToken/etc., none of which the ladder deploys.
- Entries per deployed contract: `MarketplaceV1` 40 ABI entries proxied / 39 noproxy (the extra is `initialize`);
  `MarketplaceDataV1` 47 / 46; `Unicrow` and the other four identical. The framed composition metadata
  (`composition.convention = 'framed'`, 4 placeholders, 2 stop-site blocks) is the same in both lanes.

### Composed-transaction shape (from `archive/docs:docs/framed/PERF_KERNEL_VS_FRAMED.md`, measured 2026-10-05)

`SOLIDCASH_TX_TRACE=1` broadcast traces, against the same two projects:

| lane / title | composed tx (largest) | inputs | outputs | unlocking bytes | broadcasts/title |
|---|---|---:|---:|---:|---:|
| proxied, `take job` | 40,451 B | 6 | 8 | 24,937 | 21 total (4 composed) |
| noproxy, `approve result and review > sanity checks` | 1,314,520 B | 45 | 71 | 133,320 | 33 |
| noproxy, `refund > sanity checks` | 989,220 B | 40 | 61 | 130,101 | 10 |

Caveat: these are different titles, so they bound the size difference but do not by themselves prove a per-call
protocol-size effect. They are consistent with the no-proxy lane composing larger, more frame/input-heavy
transactions.

### CPU split (same `archive/docs:docs/framed/PERF_KERNEL_VS_FRAMED.md` run, one worker each)

| bucket | proxied (`take job` + `approve result`) | noproxy (`approve sanity` + `refund sanity`) |
|---|---:|---:|
| VM (`libauth` + `runPhases`) | 78,475 samples (80.9%) | 758,756 samples (89.5%) |
| derivation bookkeeping | 6,033 (6.2%) | 20,649 (2.4%) |
| garbage collection (of "other") | 6,942 (7.2%) | 51,474 (6.1%) |
| compile | 95 (0.1%) | 98 (0.0%) |

The dominant bucket in both lanes is the VM. The "derivation" bucket is only *bookkeeping*; the repeated
re-derivation described below is itself VM work and lands in the VM bucket.

---

## 4. Mechanism hypothesis, ranked

### H1 (primary, pinned): the plain framed call path re-derives the whole composition per learned value; the proxied hop does not

**Claim.** The proxied lane routes every `Marketplace`/`MarketplaceData` call through an OZ proxy, so it exercises the
framed **hop** (`packages/solidcash/src/framed/proxy/deploy.ts`, `callFramedProxyEntry` / `settleCallees`). The
no-proxy lane calls the implementation directly, so it exercises the framed **plain path**
(`packages/solidcash/src/framed/call/call.ts`, `callFramedEntry`). The two paths converge on the same result but with
different composition complexity:

- **Hop** (`deploy.ts`): one loop *per callee*, deepest frame first; each frame has its own budget
  (`MAXIMUM_HOP_ATTEMPTS = 4`, `deploy.ts:242`); each iteration **re-plans and re-derives only the frame under
  judgement**, seeded from the callees already settled (`settleHopCallees`, `calleeSettlement`, `deploy.ts:2069-2100`).
  Complexity `O(SUM over learners x that learner's own frame)`.
- **Plain** (`call.ts`): one **global** loop whose budget is a *sum over every learner in the composition*
  (`maximumAttempts`, `call.ts:1340`); every iteration runs `buildPlan(...)` -> `createComposedDerivationHost(...)` ->
  `deriveComposition([...payeeRequests, root], ...)`, i.e. it **re-plans and re-derives the whole composition, payees
  included**, however many iterations ago they last changed; four paths recurse through `callInShape` and each
  recursion restarts that global loop with a fresh plan and host. Complexity
  `O(all learners x whole composition)`, growing with the square of the frame count.
- Separately, each *learned value* inside a master pays its own traced re-run: `learnComputedValues`
  (`composer/draft.ts:741-793`) explicitly documents "the walk pays one trace per value learned. Batching the walk is
  the W4 lever."

**Evidence supporting it.**
- `archive/docs:docs/framed/PLAIN_PATH_SETTLE_SCOPING.md` states the measured gap directly: **"`take job` takes ~740 s on the plain
  path against ~100 s through the hop. The difference is not the machine; it is how much composition each iteration
  re-derives"**, and names the complexity as **"That is the 7x, and it grows with the square of a composition's frame
  count."**
- Our measured `take job` ladder ratio is **6.37x** (proxied 65,246 ms vs noproxy 415,382 ms) - close to the
  documented 7x.
- The ratio scales exactly as predicted: trivial/no-composition titles are at parity; composition-heavy titles are
  2.4x-7.2x; the largest ratios are single-call titles (11.1x, 9.75x, 8.88x) where the one composed call is the whole
  title.
- The mechanism is VM-bound (89.5% VM share in noproxy), and the repeated re-derivation *is* VM work.
- The proxied hop is not cheaper by construction - `SPEC_FRAMED_TRANSACTION.md` section 11 says a proxied entry costs
  **one more master** - yet it wins ~7x on loop complexity, so the win is the loop shape, not a smaller transaction.

**Evidence that would falsify it.**
- Instrument per-composed-call `buildPlan` / `createComposedDerivationHost` / `deriveComposition` invocation counts:
  if the plain path does *not* call them far more often per logical call than the hop, H1 is wrong.
- Port only the loop scoping (`archive/docs:docs/framed/PLAIN_PATH_SETTLE_SCOPING.md` shape) without changing codegen and re-time `take job`: if
  it stays ~740 s, H1's stated cause is wrong.
- Run a title with no external calls (e.g. `admin > set version`): it is already at parity, which is consistent.

### H2 (secondary, coupled): no-proxy composes larger, more input/output-heavy transactions

**Claim.** The plain path composes the whole reachable graph (callees and payees) into the transaction, so a no-proxy
composed call carries more masters/records -> more inputs/outputs and a much larger unlocking script, which the VM
then re-verifies on every input on every re-derivation.

**Evidence for.** The `archive/docs:docs/framed/PERF_KERNEL_VS_FRAMED.md` traces (section 3): proxied composed call 6 in / 8 out, 24,937 B
unlocking; noproxy composed calls 40-45 in / 61-71 out, 130 KB unlocking. The framed protocol runs the validator over
every consumer's unlocking bytecode, so larger transactions multiply VM work.

**Evidence that would falsify it.** Trace the *same* title in both lanes. If noproxy `take job` also composes ~6 in /
8 out (i.e. the 45-in/71-out shapes are title-specific, not lane-specific), then the size difference is not a driver
and H2 collapses into H1.

### H3 (falsified): "more VM steps per call because scripts are larger"

Noproxy scripts are *smaller*: `MarketplaceV1` 126,749 B vs 135,953 B; `MarketplaceDataV1` 105,852 vs 110,050; the
Unicrow contracts are byte-identical. So script size cannot explain noproxy being slower.

### H4 (falsified/minor): more transactions or deployments per title

Both lanes deploy the same 7 contracts; the proxied lane's `deployProxy` is *three* transactions per proxy
(spec section 19) whereas noproxy is one, and the trivial titles confirm noproxy deploys cheaper
(`admin > transfer owner` 2,841 ms noproxy vs 3,912 ms proxied, 0.73x). So deploy count works *against* the observed
direction. A broadcast-count difference inside the composition-heavy titles is possible but not evidenced here.

### H5 (minor): ladder-specific harness cost

The noproxy test adds an in-memory IPFS `fetch` mock, and both lanes pay the deferred fixture funding and receipt
folding. The trivial titles are at parity, which bounds the per-title harness overhead as negligible relative to the
4x. Not a driver.

### Ranked summary

1. **H1** - plain-path global learning loop re-derives the whole composition per iteration (documented ~7x on
   `take job`; our ladder ratio 3.98x overall, 6.37x on that title). This is the explanation.
2. **H2** - larger composed transactions in the no-proxy lane (observational; different titles).
3. H3/H4/H5 - refuted or negligible for the direction observed.

---

## 5. What to measure next (smallest decisive set; do not run these here)

1. **Same-title transaction shape.** One run per lane of `take job$` with `SOLIDCASH_TX_TRACE=1`:
   `SOLIDCASH_TX_TRACE=1 npx vitest run --config vitest.marketplace.config.ts -t 'take job$'`.
   Compare broadcasts, inputs/outputs, and largest unlocking script. Proxied `take job` is already known (6 in / 8 out,
   40,451 B, 24,937 B unlocking). Decides H2: if noproxy `take job` is also ~6/8, H2 is out and H1 stands alone.
2. **Loop-iteration counts.** A debug counter on `buildPlan` / `createComposedDerivationHost` /
   `deriveComposition` (or `machine.evaluate`) invoked per composed call, run for the same `take job$` title in both
   lanes. Expected under H1: tens of whole-composition re-derivations in noproxy vs a per-frame count in proxied.
   This is the direct H1 test.
3. **Same-title CPU profile.** `SOLIDCASH_MARKETPLACE_CPU_PROFILE_DIR=<dir>` on `take job$` in both lanes; compare VM
   sample counts per title. Under H1 the noproxy VM sample count should be ~6-7x, not ~1x.
4. **Compare a proxied-only title.** `admin > can not call initializer` exists only in the proxied lane; running the
   same `initialize` through the no-proxy implementation would test whether the path, not the contract, is the cause.
5. **Port the plain loop (`archive/docs:docs/framed/PLAIN_PATH_SETTLE_SCOPING.md` shape) and re-time `take job`** against the 740 s baseline -
   this is the fix, and its measurement is the confirmation, but it is a code change, not a probe.

Do not re-run the full ladders to answer this question; items 1-3 each fit one title and settle the ranking.

---

## Appendix: proxied within-lane variance (3 runs) per matched title

| title | median ms | min ms | max ms |
|---|---:|---:|---:|
| admin > transfer owner | 3912 | 3579 | 3914 |
| admin > non owner cannot transfer owner | 91 | 86 | 93 |
| admin > pause/unpause | 527 | 475 | 540 |
| admin > non pauser cannot pause | 88 | 83 | 89 |
| admin > non pauser cannot unpause | 322 | 316 | 325 |
| admin > set version | 240 | 240 | 242 |
| admin > non owner cannot set version | 81 | 80 | 82 |
| admin > can not call initializer | 86 | 84 | 87 |
| register user > register user | 1203 | 1140 | 1213 |
| register user > update user | 997 | 886 | 1013 |
| register arbitrator > register arbitrator | 1081 | 1054 | 1133 |
| register arbitrator > update arbitrator | 905 | 875 | 957 |
| unicrow params > set unicrow markeplace address | 333 | 303 | 378 |
| unicrow params > set unicrow contract addresses | 339 | 329 | 348 |
| mece tags > read mece tag | 68 | 67 | 70 |
| mece tags > update mece tag | 690 | 657 | 694 |
| mece tags > remove mece tag | 367 | 352 | 403 |
| job posting > post job 1 | 3253 | 2818 | 3529 |
| job posting > post two jobs | 15232 | 15067 | 15730 |
| job posting > post job with whitelist | 6670 | 6535 | 8484 |
| job posting > post job with arbitrator same as creator | 2297 | 2272 | 2984 |
| job posting > post job with invalid token | 1124 | 1061 | 1260 |
| job posting > post job with invalid amount | 5063 | 4595 | 5852 |
| job posting > post job with invalid deadline | 344 | 319 | 412 |
| job posting > post job with invalid title | 3105 | 2793 | 3594 |
| job posting > post job with invalid delivery method | 3454 | 3200 | 4179 |
| job posting > post job from unregistered user | 1671 | 1535 | 1791 |
| job posting > post job with invalid mece tags | 10361 | 9483 | 12280 |
| job posting > post job with unregistered arbitrator | 9556 | 8701 | 10883 |
| job worker whitelisting > should whitelist worker | 10397 | 9427 | 11038 |
| job updates > update job | 17063 | 15648 | 18232 |
| job updates > update job arbitrator | 13060 | 12140 | 15796 |
| job updates > update job tags | 11449 | 10471 | 13095 |
| job updates > update job amounts | 19193 | 17658 | 20891 |
| job updates > update job many times, get history | 69121 | 64306 | 76272 |
| close job > close job before timeout | 9319 | 8688 | 9489 |
| close job > close job after timeout | 9471 | 8931 | 10602 |
| reopen job > reopen job before timeout | 10704 | 10080 | 11761 |
| reopen job > reopen job after timeout | 11200 | 10298 | 11569 |
| withdraw collateral > withdraw collateral | 11408 | 10363 | 11903 |
| take job > sanity checks | 40344 | 37762 | 42199 |
| take job > take job | 61736 | 57239 | 65246 |
| take job > take job multiple | 12851 | 12028 | 13176 |
| pay start job > sanity checks | 59052 | 54570 | 60560 |
| pay start job > pay start job | 40268 | 38534 | 41410 |
| post thread message > sanity checks | 62975 | 60855 | 66250 |
| post thread message > post thread message | 9628 | 9615 | 10161 |
| deliver result > sanity checks | 53396 | 51411 | 56322 |
| deliver result > deliver result | 53210 | 51045 | 55969 |
| approve result and review > sanity checks | 363296 | 359891 | 412055 |
| approve result and review > approve result | 133295 | 132091 | 152598 |
| refund > sanity checks | 208784 | 186085 | 209575 |
| refund > refund | 76410 | 70196 | 77456 |
| dispute > sanity checks no arbitrator | 43868 | 40129 | 45108 |
| dispute > sanity checks with arbitrator | 63423 | 56674 | 64303 |
| dispute > sanity checks closed job | 10992 | 9787 | 11206 |
| dispute > dispute creator | 63176 | 55265 | 63260 |
| dispute > dispute worker | 61659 | 53197 | 64677 |
| arbitrate > sanity checks | 246768 | 214058 | 250959 |
| arbitrate > arbitrate 80-20 | 171554 | 145907 | 175073 |
| arbitrate > arbitrate 0-100 | 137080 | 123502 | 138478 |
| arbitrate > arbitrate 100-0 | 116212 | 102808 | 132574 |
| refuse arbitration > job closed | 10061 | 9377 | 10936 |
| refuse arbitration > job not taken | 10452 | 9670 | 11904 |
| refuse arbitration > job taken | 80049 | 72973 | 82654 |
| integration test > integration test | 167065 | 164335 | 174336 |

---

## 6. The instrument (added 2026-10-10)

§5 asked for loop-iteration counts as the direct test of H1. They now exist:
`SOLIDC_DEBUG_FRAMED_COUNTS=1` (documented in `docs/kernel-diagnostics.md`) counts the plain path's attempts, the
hosts it builds, its whole-composition and scoped derivations, the hop's per-frame attempts, and each declaration
read split by which answer took it. The totals are logged as one `framed-composer-counts {...}` line every 128
plain-path attempts, from inside the run - a test runner drops what a worker writes while it tears down, so an
exit-time report would never reach a lane log. A test reads the same totals through `framedComposerCounts()` in
`packages/solidcash/src/framed/composer/counters.ts`.

### The reading on the lane itself (2026-10-10)

`take job > take job`, no-proxy lane, one title, same fixture, matched load (~5.0):

| revision | tests |
|---|---:|
| `40965a138` (before the instrument) | 323.9 s, 302.6 s, 303.0 s |
| instrument + `evaluateClose` + memos | 430.0 s, 424.0 s, 418.0 s |
| instrument + memos (no `evaluateClose`) | 304.4 s |

The counters for one `take job` (they are deterministic - three runs gave identical totals): **128 plain-path
attempts**, 127 hosts, **60 whole-composition derivations against 67 scoped ones**, 0 hop attempts (this lane
calls the implementation directly), **2120 declaration reads** - 664 answered from a close the machine had already
recorded and **1456 that walked the program** - 2362 program evaluations and 1457 walks.

Two findings follow, and the second is why `evaluateClose` is not in the tree.

- One `take job` makes ~3800 full program runs (2362 evaluations + 1456 walks), and the declaration walks are
  ~38% of them. The composer reads a declaration ~17 times per attempt, and only a third of those reads find a
  close; the rest are the composer being told there is nothing to learn **at the cost of a whole program run**.
  That is the largest single lever the instrument has found, and it is independent of the loop's shape.
- Reading a close by running the program plainly *first* and falling back to the walk (a middle answer,
  `evaluateClose`) **costs more than it saves**: 869 of the 2120 reads are not closes, so they paid a wasted run
  and then the walk. It moved `take job` from ~305 s to ~420 s, a 38% regression, and it was reverted. Note what
  that implies: `boundedDebug`'s manual `stateStepMutate` walk is *not* meaningfully slower per program than the
  compiled loop, so swapping one for the other buys nothing.

A diagnostic switch with a before/after on one title is what caught it; a "faster-looking" change here is worth
nothing until it is measured.

Use the counters before and after any change to the loop, on one title, with `-t '<title>$'`; a full ladder is only
worth taking once a single title has moved.

---

## 7. One title on both lanes, then the port (2026-10-11)

### The same title, both lanes, at `21409821f`

`take job > take job`, one run per lane, each in its own scratch copy of the worktree with a cold fixture (9 -> 19
proxied, 22 -> 26 no-proxy), on the same quiet box, with the composer counters, a worker CPU profile, and a trace of
every broadcast at `MockNetworkProvider.sendRawTransaction` (the only place both lanes broadcast through):

| | proxied (hop) | no-proxy (plain) | ratio |
|---|---:|---:|---:|
| title | 70.3 s | 383.1 s | 5.45x |
| `publishJobPost` composition | 6.9 s | 23.9 s | 3.5x |
| `takeJob` composition | 47.4 s | 324.6 s | 6.85x |
| `takeJob` attempts | 62 hop (18 frame derivations) | 92 plain (36 whole, 56 scoped) | |
| `takeJob` stepped walks / evaluations | 319 / 985 | 1406 / 2242 | |

What this corrects in the sections above:

- **H2 is refuted** on one title: the proxied `takeJob` composes the larger transaction (727 KB, 48 inputs, 66
  outputs, against 672 KB, 40 and 58). Section 3's size gap compared different titles.
- **The walks are not the plain loop's per-attempt callee reads.** In the profile, `learnCalleeValue`'s reads are
  1.2 s of 138.1 s of stepped walks; the rest is `learnComputedValues` inside the derivations, which each attempt runs
  again, from the root, for every master it passes.
- **Scoping recovered little.** A derivation that stops at the judged frame cost 1.75 s against 2.15 s for a whole
  one (-19%): it still runs everything before the frame from the root.
- Both lanes are VM-bound (77% and 90% of the profile); plans, hosts and the mock node's own checks are negligible.

### The port

The plain path now settles its callee frames through the hop's `settleCallees` (`callInShape`): deepest first, each
judged from its own subtree against what the frames below it answered, seeded from the call's callee values and read
back into them. The continuous derivation still learns the entry's own values, and any callee value a settle defers
or leaves owed. The hooks the plain path sets are opt-in; the proxied `take job` runs with every counter identical
to before. Two defects made a first version save only 17% (317.2 s):

- the plain plan states its own candidate in a callee's `retval` slot (`calleeRetvalPlaceholder`), which the hop's
  loop did not recognise, so every returning callee was deferred to the old loop (fixed by `retvalPlaceholder`);
- a callee that makes calls was left settled once its subtree derived, so a view its body closes after its calls
  was never read and fell back to a derivation from the root (fixed by `judgeDerivedFrames`).

| `take job`, no-proxy | before | ported |
|---|---:|---:|
| title | 383.1 s | 61.1 s |
| `publishJobPost` / `takeJob` compositions | 23.9 / 324.6 s | 4.9 / 45.3 s |
| evaluations / stepped walks, whole title | 3047 / 1782 | 1014 / 274 |
| scoped derivations | 83 | 0 |

The transactions are byte-identical. The proxied `take job`, run beside the ported no-proxy one, took 52.1 s, so the
no-proxy lane is ~1.2x the proxied one where it was 5.45x. Five more no-proxy titles pass with the port, against the
no-proxy ladder at `40b437c60` (a loaded box, so indicative): `post thread message > sanity checks` 82.0 s (400.2 s),
`deliver result` 53.3 s (384.1 s), `approve result` 86.3 s (478.1 s), `refund` 61.1 s (374.6 s), `arbitrate 80-20`
103.1 s (469.0 s).

### Measuring a lane

- The box varied by 27% between two runs of the proxied title doing identical work (70.3 s, then 51.3 s an hour
  later): compare lanes measured side by side, and the counters, not one lane across hours.
- `SOLIDCASH_TX_TRACE` misses the hop's broadcasts (`broadcastHop` sends without `traceBroadcast`), and the composer
  counters are printed only every 128 plain-path attempts, so a proxied title prints none. A test reads them
  through `framedComposerCounts()`.
