# The proxied marketplace ladder at HEAD

First full run of the proxied marketplace fixture since the two fixes landed (`cee831dc2`, `8c4671242`). The
ladder is green at `d4fe519ed`.

## Setup

- Commit measured: `d4fe519ed` (`docs(framed): record the residual as a missing typed read projection`), branch
  `feat/per-call`.
- Harness: a full repo copy at `/tmp/grok-goal-4b830698eeec/implementer/w4/harness`, refreshed from that commit.
  The refresh deleted `packages/*/src`, `packages/*/dist`, `packages/*/test`, `examples`, `docs` and every
  `*.tsbuildinfo` outside `node_modules`, then laid down the commit's files with
  `git -C /Code/cashscript/.worktrees/per-call archive d4fe519ed`.
- Build: `npx tsc -b tsconfig.packages.json --force`, exit 0.
- Config is the proxied lane: `solidcash.config.ts` sets `contracts: '.marketplace/contracts'`,
  `tests: '/Code/effectiveacceleration.ai/contract/test'`, `composition: 'framed'`; the fixture
  `.marketplace/project/test/marketplace.test.ts` is a symlink to
  `/Code/effectiveacceleration.ai/contract/test/marketplace.test.ts` and its target exists.
- Fixture compile, cold (cache removed first):

      rm -rf .marketplace/cache node_modules/.experimental-vitest-cache
      mkdir -p node_modules/.experimental-vitest-cache
      node packages/solidhat/dist/cli.js compile

  Output line: `Compiled 9 Solidity source(s) in 9 compiler job(s) (0 cache hit(s)) -> 19 artifact(s)`
  (`Compiled 9/9 file(s), 19 contract artifact(s).`), 127 s. `MARKETPLACE_FIXTURE_STALE_OK` was NOT set.
- Ladder, heap setting and command:

      SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 timeout 14400 \
        npx vitest run --config vitest.marketplace.config.ts

- Log: `/tmp/grok-goal-4b830698eeec/implementer/ladder-head.log`.
- Wall time: 2509 s (start epoch 1791296986, end epoch 1791299495, exit 0). Vitest's own `Duration` is
  2508.31 s.

## Result: green

    Test Files  1 passed (1)
         Tests  66 passed (66)
      Duration  2508.31s (transform 3.36s, setup 5.00s, import 295ms, tests 2502.84s, environment 0ms)

Every one of the 66 titles passed; no title failed, so no per-title re-run was needed. The stderr traces in the
log (`Fetching encrypted data failed ... Session key is required to decrypt the message`) are expected error paths
inside passing tests, not failures. The full-config run above is the ladder.

## Slowest ten titles (per-test durations as vitest reports them)

Full names, top-level suite included:

| # | title | time |
|---:|---|---:|
| 1 | Marketplace Unit Tests > approve result and review > sanity checks | 363.3 s |
| 2 | Marketplace Unit Tests > arbitrate > sanity checks | 214.1 s |
| 3 | Marketplace Unit Tests > refund > sanity checks | 186.1 s |
| 4 | Marketplace Unit Tests > integration test > integration test | 164.3 s |
| 5 | Marketplace Unit Tests > arbitrate > arbitrate 80-20 | 145.9 s |
| 6 | Marketplace Unit Tests > approve result and review > approve result | 133.3 s |
| 7 | Marketplace Unit Tests > arbitrate > arbitrate 0-100 | 123.5 s |
| 8 | Marketplace Unit Tests > arbitrate > arbitrate 100-0 | 102.8 s |
| 9 | Marketplace Unit Tests > job updates > update job many times, get history | 76.3 s |
| 10 | Marketplace Unit Tests > refuse arbitration > job taken | 73.0 s |

Sum of the ten slowest: 1582531 ms = 1582.5 s (63 percent of the 2502.8 s the whole ladder spent in tests).

## Verdict

- W6 marketplace gate: the proxied lane passes its full ladder at `d4fe519ed` (66/66 in 2509 s wall), so the
  W6 proxied-marketplace gate is green from this run; the no-proxy lane was not exercised here.
- W10 readiness: from this run alone the proxied marketplace fixture poses no blocker to landing; W10 still needs
  the no-proxy ladder and the other W6 suites, which this run did not cover.
