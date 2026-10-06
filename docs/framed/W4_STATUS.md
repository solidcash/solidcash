# W4 status: the perf lane is blocked by a red marketplace ladder at HEAD

W4 was to re-time the slowest marketplace titles against the 20-minute budget, diff artifact sizes against the W3
baseline, and land the size/perf levers the measurements justified. The first two ran; the timings stopped because
**every marketplace title fails at `02de0b9d1`, in about twenty seconds, at the shared fixture's first
`publishJobPost`**.

## The blocker

Reproduced in the worktree (not the harness copy) after a cold fixture recompile:

    cd /Code/cashscript/.worktrees/per-call
    rm -rf .marketplace/cache node_modules/.experimental-vitest-cache
    mkdir -p node_modules/.experimental-vitest-cache
    node packages/solidhat/dist/cli.js compile          # 9 sources -> 19 artifacts, 0 cache hits
    SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 npx vitest run --config vitest.marketplace.config.ts \
      -t "post job 1$|take job$|approve result$"

    Test Files  1 failed (1)
         Tests  3 failed | 63 skipped (66)
      Duration  25.34s

Each failure is the same shape:

    FAIL ... > approve result and review > approve result
    FramedCallError: the call to "publishJobPost" was refused, so nothing was broadcast:
      validator/1: Program failed an OP_VERIFY operation.
     > FramedFunctionCall.send packages/solidcash/src/framed/call/handle.ts:106:13
     > deployMarketplaceWithUsersAndJob .marketplace/project/test/marketplace.test.ts:571:34

`deployMarketplaceWithUsersAndJob` is the fixture helper every title depends on, so the whole ladder is red, not one
title. The no-proxy twin fails the same way at the same step (`FramedCompositionRefusedError`, frame
`callee-master-6` of `FakeToken.transferFrom()`, `revert ERC20InsufficientAllowance`).

This contradicts the record: `PLAN_MARKETPLACE_66.md` marks title #50 (and #51, #52) measured green 2026-10-03 with
both full M2 runs at 66/66, and `PERF_KERNEL_VS_FRAMED.md` records `approve result and review / sanity checks` as
`passed` at 1044.307 s in the W2 no-proxy measurement. So the failure was introduced after those runs.

The bisect has landed: the regression was introduced by `246cdfd74`
(`fix(sdk): expose the logical CREATE address from getAddress`, 2026-10-05 14:40:41), which changes
`ContractFactory.ts` / `StatefulContract.ts` address resolution. The full verdict table, the last good commit
(`a04d069833`) and the twenty-five-commit non-buildable window the bisect had to work around are in
`MARKETPLACE_RED_AT_HEAD.md`. What is known:

- HEAD `02de0b9d1` is bad; the title is fast-failing, not timing out (16-25 s).
- `12c011dfe` (the W2/W3-era profile commit ancestor) passes, and so do `c3b274eb5`, `7088b6d6e`, `e6138b321`,
  `fa34859806` and `abf1049ff`; `246cdfd74` is the first that fails.
- The worktree's pre-existing artifacts (compiled 2026-10-05 15:37, when HEAD was `c473ba4a0`) match the W3 framed
  baseline for every contract, so the fixture the W2/W3 numbers used is not from HEAD.

Logs: `{SCRATCH}/w4-worktree-proxied.log`, `{SCRATCH}/w4-smoke-head.log`.

## Artifact sizes against the W3 baseline

`docs/framed/SIZE_KERNEL_VS_FRAMED.md` (2026-10-05) versus a HEAD cold compile of the same 9 sources
(`scripts`-free: `asmToBytecode(artifact.bytecode).length` per artifact):

| contract | W3 framed bytes | HEAD framed bytes | delta | refused |
|---|---:|---:|---:|---:|
| FakeToken | 24303 | 24303 | 0 | 0 |
| MarketplaceDataV1 | 110050 | 110050 | 0 | 0 |
| MarketplaceV1 | 135056 | **135920** | **+864** | 0 |
| Unicrow | 56258 | 56258 | 0 | 0 |
| UnicrowClaim | 21801 | 21801 | 0 | 0 |
| UnicrowDispute | 31305 | 31305 | 0 | 0 |
| UnicrowArbitrator | 29487 | 27082 | -2405 | 0 |

Every contract but `MarketplaceV1` (and `UnicrowArbitrator`, which the same 2026-10-05 doc and the worktree's own
artifacts already disagree on) is byte-identical to the W3 baseline. `MarketplaceV1` grew 864 bytes, and
`MarketplaceV1.publishJobPost` is exactly the entry that now fails. `composition.refusedEntries` is 0 on every
artifact, so the entry is admitted and the failure is at execution, not at admission. This is the leak the plan's
merge-seam note warns about ("check framed compiles of the marketplace (sizes and `composition.refusedEntries`)
after kernel-side changes"); whether the 864 bytes are the cause or a coincidence is what the bisect decides.

Sizes: `{SCRATCH}/sizes-worktree.txt`, `{SCRATCH}/sizes-harness.txt`.

## The W4 lever, measured and parked

The slowest no-proxy titles cost 8-17 minutes, and 80.9-89.5 % of that is the machine. The composer's own share is
`boundedDebug`, and the reason is now pinned instead of guessed:

- `learnComputedValues` (`packages/solidcash/src/framed/composer/draft.ts`) replaces each unstated written view with
  the value the body computed, and it could reuse the machine's failed-close record (`recordedClose`) instead of
  re-running the master. It cannot: instrumenting the `machine.evaluate` wrapper with a
  `SOLIDC_DEBUG_RECORDED_CLOSE=1` line shows the record is never kept on this path (`close: "none"` on every
  evaluation), so each learned value pays one stepped re-run. The obvious repair (feed a plain evaluation before the
  reading so the record is populated) was implemented, measured, and produced no gain - the plain path never fails a
  verify while the stepped path does - so it was reverted. Only the diagnostic and a bounded-count test are kept.
- The lever that remains is batching several values per evaluation. That changes the reading's semantics (one close
  per run, and resuming past failed verifies would change shipped behaviour), so it is not a safe change to land
  without the measurements W4 could not take.

Test: `packages/solidcash/test/framed/composer/learned-write.test.ts` now pins the cost directly - "reads each
unstated declaration it learns without exceeding one traced reading per value", counting `boundedDebug` calls
through a wrapped machine. Verified: 18 tests in that file plus `declaration-capture.test.ts`
(`{SCRATCH}/w4-own-tests.log`).

## The budget, re-taken (both blockers fixed)

Measured at `8c4671242`, heap 6144 MB, in the worktree; logs in `{SCRATCH}`.

- no-proxy `approve result and review sanity checks`: 1044.307 s at W2, **1148.58 s** of test time now (1155.62 s
  file, `{SCRATCH}/w4-noproxy-one.log`). That is the slowest of the two and 95.7 % of a 20-minute budget; it was
  measured while the full proxied ladder ran concurrently, so an unloaded gate run is faster.
- no-proxy `refund sanity checks`: 718.767 s at W2, about 767 s now. The pair is 1915.66 s of test time against
  1763.08 s at W2 (+8.7 %, `{SCRATCH}/w4-noproxy-run.log`).
- proxied `take job`: 62.2 s at W2, 66.8 s now; proxied `approve result`: 131.8 s at W2, 144.5 s now
  (`{SCRATCH}/w4-proxied-pair.log`), so the proxied lane is 7-10 % slower. The four sampled proxied titles together
  are 629 s (`{SCRATCH}/read-fix-four.log`).

Both no-proxy titles are inside the original 20-minute budget, so the harness timeout is reverted from 40 minutes to
20 (`testTimeout` and `hookTimeout` `2_400_000` -> `1_200_000`, with the measurement in the comment), which is W4's
stated target.

## Not done, and why

- **`MarketplaceV1`'s framed artifact grew 864 bytes** against the W3 baseline (135056 -> 135920), so W4's "no
  artifact grows" target is not met. Every other framed contract is byte-identical. The growth lies somewhere in the
  150 commits between the W3 compile (2026-10-05 15:37, then HEAD `c473ba4a0`) and HEAD, and it needs its own
  compile-only bisect: each step is a forced build plus one project compile, about three minutes, with no test run.
  Not started.
- No marketplace perf or size optimization landed. The ranked candidates are in `W4_WINS.md`; the first one
  (batching the learned-value walk) changes the reading's semantics, so it wants the timings above as its baseline
  and its own measurement.

## Next

1. Both blockers are fixed: `StatefulContract.get target()` returns the framed execution lock when one exists
   (decision D22), and a framed read publishes the typed result projection (`decodeEntryValues`), which is what the
   fixture's own state comparison needed. The four sampled proxied titles now pass 4/4 (`post job 1`, `take job`,
   `approve result`, `approve result and review sanity checks`, 629 s), and the whole solidcash framed config is
   1815 passed with the 7 pre-existing `call/` failures. The W4 timings can resume: re-take the two title sets and
   compare against the W2 numbers (1044.3 s / 718.8 s no-proxy; 62.2 s / 131.8 s proxied), then decide the
   `vitest.marketplace.config.ts` timeout and re-run the size diff.
2. Re-take the two title sets: no-proxy `approve result and review sanity checks` and `refund sanity checks`,
   proxied `take job sanity checks` and `approve result and review sanity checks`, and compare against the W2
   numbers (1044.3 s / 718.8 s no-proxy; 62.2 s / 131.8 s proxied).
3. Then decide the timeout and re-run the size diff, which must come back to 135056 for `MarketplaceV1`.
