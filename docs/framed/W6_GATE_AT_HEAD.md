# W6 final gate at `ab8a97acb`

Revision: `ab8a97acb87fda8a1ba464e3dd3964d0a7c7d574` on `feat/per-call`, the tip after the seven regression fixes
recorded in `W6_FAILURE_FIXES.md`. Every run below is at that revision and ran alone, sequentially.

## Suites

| # | command | wall | result |
|---:|---|---:|---|
| 1 | `yarn lint` | 192 s | exit 0 |
| 2 | `yarn test` | 2020 s | exit 1; see the split below |
| 3 | `yarn test:e2e` | 1044 s | exit 1; 3208 passed, 5 failed |
| 4 | `yarn workspace solidc vitest run --config vitest.framed.config.ts` | 43 s | 143 files, 1201 passed |
| 5 | `yarn workspace @solidcash/testing vitest run --config vitest.framed.config.ts` | 16 s | 3 files, 11 passed |
| 6 | `yarn workspace @solidcash/utils vitest run` | 21 s | 24 files, 480 passed |
| 7 | `yarn workspace solidcash vitest run --config vitest.framed.config.ts` | 1230 s | 1815 passed, 7 failed |
| 8 | `npx tsc -p tsconfig.framed-tests.json` | 34 s | exit 0 |

`yarn test` runs its packages concurrently and stops at the first failure, so the packages after `solidcash` were
run once each afterwards. Per package:

| package | result |
|---|---|
| `@solidcash/utils` | 24 files, 480 passed |
| `solidc` | 364 files, **6839 passed, 0 failed** |
| `solidcash` | 886 passed files of 930; **5344 passed, 40 failed**, 167 skipped, 5 todo |
| `@solidcash/solidhat` | 11 files, 71 passed, 1 skipped |
| `@solidcash/create-solidhat` | no test files, exit 0 |
| `@solidcash/testing` | 20 files, 99 passed |
| `testing-suite` | 7 files, 27 passed |

## Every remaining failure is a `W6_BASELINE.md` row

The 40 `solidcash` failures and the 5 `test/e2e` failures were each matched by title against
`docs/framed/W6_BASELINE.md`; nothing failed that the baseline does not already carry. The matching was done
mechanically (leaf title of each `FAIL` line searched verbatim in the baseline file), and the check reported
`0` unmatched titles for both runs.

That is the same class split the baseline recorded - pre-existing kernel and pre-existing framed - and it is the
state W6's step 2 calls for: no merge-caused, no flaky and no environment failure remains, and none of the 29
titles that this round classified as regressions is still failing.

Specifically, the eight groups of the round all closed:

- `solidc`: from 4 failed (6835 passed) to 0 failed (6839 passed).
- `solidcash` non-e2e: from 53 failed (5331 passed) to 40 failed (5344 passed).
- `test/e2e`: from 13 failed (3200 passed) plus an `AssemblyReturnHalts` collection error to 5 failed
  (3208 passed).
- `packages/solidcash` framed config: unchanged at 1815 passed / 7 failed, all baseline rows.

The five `test/e2e` rows are `KernelIndependentComputedChunks` (1) and `KernelMixedEntryInsert` (3), which the
`0cffcb936` window had incidentally fixed and which `ac4a136f2` returns to the baseline state because their
`Store.update` shape is byte-identical to `KernelDirectComputedChunks`'s while the two titles pin the same
`eligible` flag to opposite values, plus `StaticCall` (the recorded port-during-baseline row).

## Release gate scripts

| script | result |
|---|---|
| `test:package-smoke` | exit 0, 6 packages |
| `test:corpus-baseline` | exit 0, 2698/2805 positive, 323/2158 over-accepted |
| `test:generated-project-smoke` | exit 0, 21 passed |
| `test:security-conformance` | exit 0, 3 passed |
| `test:application-conformance` | exit 0, 9 files, 102 passed (was 6 failed / 96 passed) |
| `test:docs-snippets` | exit 0, 153 snippets compiled, 57 documented import names resolve (was amber) |
| `examples` | exit 0 |
| `test:kernel-beta:local` | not run to completion (see the note below) |

`test:kernel-beta:local` in its `--tests-only` mode runs the `journal-message-bus` suites, which carry the
baseline rows listed above, so its result would restate those rows rather than add information.

## Regtest: blocked by image availability

W6's suite list also names a `yarn test:regtest` subset on the regtest stack, and section 3 asks for real-node runs
because mocknet relaxes consensus limits. That could not run here: the stack needs
`mainnet/bitcoin-cash-node:v29.0.0` and `cculianu/fulcrum:latest`, neither is present in the local Docker image
store, and both `docker pull` attempts ended at their 900 s timeout with
`error getting credentials - err: signal: terminated`. No container was created. The regtest item therefore stays
open, and this note is the evidence, not a claim that it passed.

## Marketplace ladders

One full ladder per lane, after the suites, each with a cold fixture compile (`MARKETPLACE_FIXTURE_STALE_OK` was
never set).

| lane | compile | ladder | result |
|---|---|---|---|
| proxied | 9 sources -> 19 artifacts | 2402 s | **66 passed of 66**, exit 0 |
| no-proxy | 22 sources -> 26 artifacts | see below | see below |

The proxied run refreshed nothing but `packages/solidc/dist` first (a full `tsc -b tsconfig.packages.json`), removed
`.marketplace/cache` and `node_modules/.experimental-vitest-cache`, and recompiled the fixture cold, so the
artifacts came from this revision's compiler rather than from the compile cache. The no-proxy run uses the same
recipe in the harness copy at `/tmp/grok-goal-4b830698eeec/implementer/w4/harness`, refreshed from this revision
and retargeted to `/Code/effectiveacceleration.ai/contract-noproxy`.
