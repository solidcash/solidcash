# The no-proxy marketplace ladder at HEAD

First full run of the no-proxy twin of the marketplace fixture since the two fixes landed (`cee831dc2`,
`8c4671242`). The ladder is NOT green: two titles time out at the 20-minute per-title cap, and both pass when run
alone. So the failures are a budget/load effect, not a functional one.

## Setup

- Commit measured: `19f6c28b5` (`docs(framed): the proxied marketplace ladder is 66/66 at HEAD`), branch
  `feat/per-call`. That commit carries the reverted 20-minute per-title timeout (`ba005c658`,
  `testTimeout: 1_200_000`).
- Harness: the same repo copy at `/tmp/grok-goal-4b830698eeec/implementer/w4/harness`, refreshed from that commit.
  The refresh deleted `packages/*/src`, `packages/*/dist`, `packages/*/test`, `examples`, `docs` and every
  `*.tsbuildinfo` outside `node_modules`, then laid down the commit's files with
  `git -C /Code/cashscript/.worktrees/per-call archive 19f6c28b5`.
- Build: `npx tsc -b tsconfig.packages.json --force`, exit 0.

## Retarget to the no-proxy project

The same edits the worktree script applies. In `solidcash.config.ts`:

    contracts: '/Code/effectiveacceleration.ai/contract-noproxy/contracts',
    tests: '/Code/effectiveacceleration.ai/contract-noproxy/test',

(they replace `contracts: '.marketplace/contracts',` and `tests: '/Code/effectiveacceleration.ai/contract/test',`).
And the fixture symlink is repointed:

    rm -f .marketplace/project/test/marketplace.test.ts
    ln -s /Code/effectiveacceleration.ai/contract-noproxy/test/marketplace.test.ts \
      .marketplace/project/test/marketplace.test.ts

Confirmed by `grep` (both paths show the `contract-noproxy` form) and `readlink` (the target exists). `composition`
stays `'framed'`.

## Fixture compile (cold) and run

    rm -rf .marketplace/cache node_modules/.experimental-vitest-cache
    mkdir -p node_modules/.experimental-vitest-cache
    node packages/solidhat/dist/cli.js compile

Output: `Compiled 22 Solidity source(s) in 22 compiler job(s) (0 cache hit(s)) -> 26 artifact(s)`
(`Compiled 22/22 file(s), 26 contract artifact(s).`), 158 s. `MARKETPLACE_FIXTURE_STALE_OK` was NOT set. Ladder:

    SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 timeout 14400 \
      npx vitest run --config vitest.marketplace.config.ts

Heap setting: `SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144`. Log:
`/tmp/grok-goal-4b830698eeec/implementer/ladder-noproxy.log`. Wall time: 12178 s (3 h 23 m; start epoch
1791303561, end epoch 1791315739, exit 1). Vitest's own `Duration` is 12177.01 s.

## Result

    Test Files  1 failed (1)
         Tests  2 failed | 63 passed (65)
      Duration  12177.01s (transform 3.32s, setup 4.82s, import 351ms, tests 12171.66s, environment 0ms)

## Failing titles

Both fail by TIMEOUT at the reverted 20-minute cap (`testTimeout: 1_200_000` ms), each with the message
`Test timed out in 1200000ms.`. Neither is a functional failure: each passes when run alone on the same fixture.
The titles below carry the full `Marketplace Unit Tests > ` prefix; it is omitted here for width.

| title | full-ladder elapsed | alone |
|---|---:|---|
| approve result and review > sanity checks | 1360986 ms | PASS, 1123034 ms |
| arbitrate > sanity checks | 1246706 ms | PASS, 456855 ms |

In-ladder failure frames: `marketplace.test.ts:2312` (approve result and review) and `marketplace.test.ts:2814`
(arbitrate), both surfaced through `packages/testing/src/vitest-setup.ts:58`.

Isolated re-runs, one at a time with `-t "<title>$"`:

- `/tmp/grok-goal-4b830698eeec/implementer/noproxy-fail-approve-sanity.log`
  (`Test Files 1 passed (1)`, `Tests 1 passed | 64 skipped (65)`, `Duration 1130.34s`, 1131 s wall).
- `/tmp/grok-goal-4b830698eeec/implementer/noproxy-fail-arbitrate-sanity.log`
  (`Test Files 1 passed (1)`, `Tests 1 passed | 64 skipped (65)`, `Duration 461.92s`, 462 s wall).

The approve-sanity title alone consumes 1123 s of the 1200 s cap, 94 percent of it. In the full ladder, on a box
that has already run the preceding titles, it came in above the cap (1361 s). That is why it times out only
in-ladder.

## Slowest ten titles (per-test durations as vitest reports them)

| # | title | time |
|---:|---|---:|
| 1 | Marketplace Unit Tests > approve result and review > sanity checks (timed out) | 1361.0 s |
| 2 | Marketplace Unit Tests > arbitrate > sanity checks (timed out) | 1246.7 s |
| 3 | Marketplace Unit Tests > arbitrate > arbitrate 80-20 | 1001.8 s |
| 4 | Marketplace Unit Tests > refund > sanity checks | 839.9 s |
| 5 | Marketplace Unit Tests > arbitrate > arbitrate 0-100 | 681.4 s |
| 6 | Marketplace Unit Tests > integration test > integration test | 631.7 s |
| 7 | Marketplace Unit Tests > arbitrate > arbitrate 100-0 | 545.5 s |
| 8 | Marketplace Unit Tests > refuse arbitration > job taken | 495.8 s |
| 9 | Marketplace Unit Tests > approve result and review > approve result | 489.5 s |
| 10 | Marketplace Unit Tests > take job > take job | 437.7 s |

Sum of the ten slowest: 7730898 ms = 7730.9 s (64 percent of the 12171.7 s the whole ladder spent in tests). Note
that `refund > sanity checks` (item 4) passed at 839.9 s, well under the cap, so the cap only bites on
approve-sanity in practice.

## Verdict

- W6 no-proxy gate: NOT green as a single full run. 63 of 65 titles pass; the two failures are per-title timeouts
  at the 20-minute cap, and both titles pass in isolation (approve sanity 1123 s, arbitrate sanity 457 s). No
  functional defect is shown by this run; the pair that the fixes were meant to unblock both execute and pass.
- The 20-minute cap is NOT the right budget from what I measured. approve-sanity alone uses 94 percent of it and
  exceeds it under full-ladder load; arbitrate-sanity alone is 457 s but 1247 s in-ladder. Keep the previous
  40-minute budget (`abd68b38f`) or at least 30 minutes for this lane, or run the heavy titles first, so a
  loaded box cannot turn a passing title into a timeout.

## Addendum (coordinator, after this run)

The cap the run was made under was reverted too far and is already corrected: `vitest.marketplace.config.ts` now
uses 30 minutes (`testTimeout` and `hookTimeout` `1_800_000`) at `3fc4c2fe9`, with both readings in its comment. On
this run's numbers a 30-minute cap holds for both timed-out titles with about seven minutes to spare (approve sanity
1361 s in-ladder, arbitrate sanity 1247 s), so the functional result of this ladder is 65 of 65. What the run does
not establish is a clean total duration: it ran on a box loaded by four concurrent suites (load average 7.8), and
its 3 h 23 m wall time must not be read as this lane's own cost. Re-take the lane once, alone, at the release gate.

There is also no earlier full-run duration for this lane to compare against: the 3119 s and 5161 s ladders in
`PLAN_MARKETPLACE_66.md` (and the two-run, 2 h 11 m window of 2026-10-04) are the **proxied** 66-title lane, which
compiles 9 sources to 7 artifacts, while this twin compiles 22 to 26 and was only ever sampled by representative
titles before. By the per-title costs above, a lightly loaded run of this lane is on the order of two hours on its
own, and the two slowest titles are the arbitrate family, not only the sanity pair.
