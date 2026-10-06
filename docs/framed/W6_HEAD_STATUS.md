# W6 head status: framed suites of solidc, utils and testing

Scope: the packages this worker owns only (`packages/solidc`, `packages/utils`, `packages/testing`). The
`packages/solidcash` framed suites, the marketplace fixture and the ahead lane are owned elsewhere and are not run
here.

- Worktree: `/Code/cashscript/.worktrees/per-call`, branch `feat/per-call`
- HEAD: `a0ce264c7` (`docs(framed): record that the marketplace ladder is red at HEAD`)
- Date: 2026-10-06
- Compiler disk cache: `SOLIDC_COMPILE_CACHE_DIR=/tmp/grok-goal-4b830698eeec/implementer/w6head/cache`
  (a private directory, so no collision with the solidcash-framed worker)
- Logs: `/tmp/grok-goal-4b830698eeec/implementer/w6head/`

Each gate was run once, sequentially. All four exit 0 with no failures.

## Result per package

| package | exit | Test Files | Tests | duration |
|---|---:|---|---:|---:|
| `solidc` framed config | 0 | 143 passed (143) | 1201 passed (1201) | 43 s |
| `@solidcash/utils` `test/framed` | 0 | 6 passed (6) | 119 passed (119) | 3 s |
| `@solidcash/testing` framed config | 0 | 3 passed (3) | 11 passed (11) | 16 s |
| typecheck `tsconfig.framed-tests.json` | 0 | n/a | n/a | 34 s |

The exact command lines are in the per-run sections below.

Totals: 152 test files, 1331 tests, all passing.

## Per-run evidence

### solidc framed suite

- Log: `/tmp/grok-goal-4b830698eeec/implementer/w6head/solidc-framed.log`
- Command: `yarn workspace solidc vitest run --config vitest.framed.config.ts`
- Config: `packages/solidc/vitest.framed.config.ts` (include `test/framed/**/*.test.ts`, `maxWorkers: 3`).
- Summary lines: `Test Files  143 passed (143)` and `Tests  1201 passed (1201)`.
- Duration line: `Duration  42.19s (transform 39.50s, setup 0ms, import 86.97s, tests 37.23s, environment 16ms)`.
- Runner line: `EXIT=0 DURATION_S=43 START=12:05:26 END=12:06:09`.

### utils framed suite

- Log: `/tmp/grok-goal-4b830698eeec/implementer/w6head/utils-framed.log`
- Command: `yarn workspace @solidcash/utils vitest run test/framed`
- The utils package has no framed config; the default `packages/utils/vitest.config.ts` is used with the
  positional filter `test/framed`, as the manifest documents.
- Summary lines: `Test Files  6 passed (6)` and `Tests  119 passed (119)`.
- Runner line: `EXIT=0 DURATION_S=3 START=12:06:14 END=12:06:17`.

### testing framed suite

- Log: `/tmp/grok-goal-4b830698eeec/implementer/w6head/testing-framed.log`
- Command: `yarn workspace @solidcash/testing vitest run --config vitest.framed.config.ts`
- Config: `packages/testing/vitest.framed.config.ts` (include `test/framed/**/*.test.ts`, `maxWorkers: 3`).
- Summary lines: `Test Files  3 passed (3)` and `Tests  11 passed (11)`.
- Runner line: `EXIT=0 DURATION_S=16 START=12:06:20 END=12:06:36`.

### Typecheck

- Log: `/tmp/grok-goal-4b830698eeec/implementer/w6head/tsc-framed-tests.log`
- Command from the manifest: `npx tsc -p tsconfig.framed-tests.json` at the repository root.
- The log holds only `EXIT=0 DURATION_S=34`; no diagnostics. Exit 0 as expected.

## Failures

None. Every test in all three runs passed, so:

- new failures: none.
- failures matching a `W6_KNOWN_FAILURES.md` row: none.
- failures matching a `W6_BASELINE.md` row: none.

There is nothing to classify. The per-test `FAIL` lines that `W6_BASELINE.md` recorded for solidc and testing do
not appear at HEAD.

## Baseline rows inside the covered paths

`W6_BASELINE.md` (at `295f6eed6`) listed five solidc framed test files as failing, all pre-existing framed. All
five are now green at HEAD, each times as reported in `solidc-framed.log`:

| file | baseline class | at HEAD |
|---|---|---|
| `test/framed/master/branched-call-entry.test.ts` (2 titles) | pre-existing framed | 6 tests passed |
| `test/framed/master/direct-path-identity.test.ts` (2 titles) | pre-existing framed | 4 tests passed |
| `test/framed/master/entry-append-source.test.ts` (1 title) | pre-existing framed | 13 tests passed |
| `test/framed/master/inlined-literal-branch.test.ts` (2 titles) | pre-existing framed | 2 tests passed |
| `test/framed/master/mapping-delete-write.test.ts` (1 title) | pre-existing framed | 5 tests passed |

The baseline's testing failures and `physical-identity` failure are in `packages/testing/test/`, outside the
framed config's `test/framed/**` include, so this status neither covers nor claims them. The 14 rows of
`W6_KNOWN_FAILURES.md` are in solidc files outside `test/framed/` (for example `test/ExternalCalls.test.ts`,
`test/solidity-compat/storage-collections.test.ts`), so they are outside the framed suite as well and are not run
here. No row in either note lives under the framed include globs and fails at HEAD.

## Note on test counts

The manifest's solidc row totals 1054 checks across 122 files, while the config at HEAD discovers 143 files and
1201 tests. The observed counts from the run logs are the ones reported above; the manifest figure is older and
is not restated as current.

## `packages/solidcash` framed: full-config run at `8c4671242`

A full-config run of `vitest.framed.config.ts` in `packages/solidcash` at `8c4671242`: **1815 passed, 7 failed,
148 skipped (1970 tests, 358 files)** in 225 s (`{SCRATCH}/w6-solidcash-framed.log`). The seven failures are the
`call/` set below, all pre-existing and none a `W6_BASELINE.md` row; `deploy/address-identity.test.ts` is green after
the `target()` fix. The section below keeps the per-directory reading that the W7 phase-2 worker measured, which is
where the failing files were first seen.

The solidcash framed suite was owned by another worker, which ran 17 directory baselines for its coverage work
(`docs/framed/W7_PHASE2_CANDIDATES.md`, logs in `/tmp/grok-goal-4b830698eeec/implementer/w7p2/*-base.log`). Those
baselines are the only whole-package reading at HEAD, so they are recorded here. They were taken across the window in
which the `target()` fix landed, so every failure was re-checked afterwards in the A/B below.

- 15 of the 17 directories are fully green.
- `deploy/`: 1 failed | 40 passed. The failure is `deploy/address-identity.test.ts` ("reports addrV(category), and the
  registry and the genesis agree"), which the `target()` fix resolves: it fails without the fix, passes with it.
  That guard is the framed convention's own statement of the invariant the fix restores.
- `call/`: 5 failed | 116 passed, 7 failing cases, all still failing after the fix:
  - `call/branch-predicate-after-arm-write.test.ts` (2): "publishes the predicate as it stands where the branch
    starts", "accepts the plan the published predicate gives".
  - `call/plain-caller-identity.test.ts` (1): "carries the caller's reported address whole inside a long packed
    payload, to the receipt and the chain". The file's other case is fixed by the `target()` change.
  - `call/proxy-external-calls-published.test.ts` (1): "states one call per published site the caller's own facts
    reach".
  - `call/skipped-batch-write.test.ts` (2): "mints, transfers and burns, the balances and the total supply read
    back", "publishes the condition each balance write runs under".
  - `call/write-segments-settlement.test.ts` (1): "settles a refund-like entry: a call, a mapping write in a later
    segment, and a dynamic write after the last call".

A/B over the six files with any failure, at `cee831dc2` and with the getter restored to its pre-fix form
(`/tmp/grok-goal-4b830698eeec/implementer/fixab/with2.log`, `without2.log`): 9 failed without the fix, 7 with it, and
the two that flip are the deploy case above and one `call/plain-caller-identity` case. None of the seven is a
`W6_BASELINE.md` or `W6_KNOWN_FAILURES.md` row, so they are new to this list. Whether they predate the whole
logical-identity window is not established here; the marketplace titles were green on 2026-10-03 while these fail
today, so the window the marketplace bisect covers is the place to look next.

## What this does not cover

The `solidcash` framed suite is not a fresh full-config run here (its 1557 cases include the `ahead/` lane and the
gated cases), the marketplace ladder is tracked in `MARKETPLACE_RED_AT_HEAD.md`, and no kernel/direct-convention
suite was run.
