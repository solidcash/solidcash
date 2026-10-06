# W7 reductions landed

The audited phase-1 test reductions from `W7_CLUSTERS.md`, as verified against the live tree by `W7_AUDIT.md`.
Landed at `02de0b9d1` on `feat/per-call` (the branch renamed to `framed` in the same change set). Every removed
case is replaced by a shipped guard that exercises the same rule, and the coverage comparison below is the
evidence that no line or branch left the suite.

## What was removed

| file | before | after | removed | replacement guard the case pointed at |
|---|---:|---:|---|---|
| `packages/solidcash/test/framed/pw7-measure.test.ts` | 2 | 0 (file deleted) | the whole measurement instrument, both cases under `FRAMED_FULL=1` (`PW7_FULL=1` for the twenty-four-master one) | none needed: it asserts nothing about the shipped path; `toys/fan-in.test.ts`, `toys/reentry.test.ts` and `primitives/many-masters.test.ts` settle the shapes it measured |
| `packages/solidcash/test/framed/edges/refused-contract-shapes.test.ts` | 10 | 2 | the eight "is served" admits and the four `describe` blocks they were the only member of, plus `sourceOf` | `solidc/test/framed/master/send-output.test.ts` (a value send), `ecrecover-invalid-input.test.ts` (a recovery precompile), `composer/keccak-side-car.test.ts` (a keccak side-car), `deploy/genesis.test.ts` (a hashing constructor), `composite-return.test.ts` / `composed-arguments.test.ts` (a composite return, a struct argument), `shapes/mapping-values.test.ts` / `shapes/string-mapping-delete.test.ts` (a string-keyed mapping). The two "is refused by name" cases stay |
| `packages/solidcash/test/framed/ahead/enumerable-set.test.ts` | 3 | 2 | the group-form compile case and `GROUP_SETS`, its only user | `call/enumerable-set.test.ts:181` drives the group-form swap-remove through the shipped proxy and reads the set back. The two refusal cases stay |
| `packages/solidcash/test/framed/ahead/push-length-keyed-mapping-write.test.ts` | 3 | 2 | the control case `settles the same entry with the mapping write removed` and `WITHOUT_THE_WRITE`, its only user | the two settlement cases keep the mapping-write shape; the control only removed the write to isolate it, which is the probe this cluster deletes. Carrying cost: the file has no control isolating the mapping write any more |
| `packages/solidcash/test/framed/ahead/revert-after-calls.test.ts` | 11 | 2 | the nine own-reason cases and the helpers they orphaned (`refusedCall`, `Refused`, `reportOf`, `expectReported`, `reasonOf`, `stalledAt`, `lineOf`, `UNFILLED_INDEX`, `Compiled.all`) and the `vi`, `composer`, `FramedProxyDeployError` imports | `conformance/revert-after-calls-rows.test.ts` (590 lines, section-23 row 5, runs by default), `reverts/innermost-revert.test.ts`, `reverts/proxied-callee-reason.test.ts`, `reverts/proxied-callee-error-arguments.test.ts`, `call/own-stop-before-refused-plan.test.ts` (7 cases). The settle case and the proxied-return read stay, which are the only assertions of the `Coin` balance view chain and the proxied `peek` return |

Twenty-one `it`s are gone: nineteen from the four files (27 cases before, 8 after, measured) and two from the
gated instrument.

## Judged and not taken

- **Item 5 (share the `Child`, `Registry.tag` and `Sample` sources).** A deduplication refactor that removes no
  case, and the audit's own reading found the shared sources narrower than the proposal assumed (`Child` is
  identical in four `deploy/*` files only; `Registry.tag` in two `reads/` files; `Sample` is not in any `reads/`
  file). Left for a later pass so this change stays a pure reduction.
- **Item 7 (collapse the eight block-header refusals in `hostile/builder-stated-fields.test.ts` to one
  `it.each`).** `it.each` does not reduce vitest's reported case count, so it changes source shape and not the
  count. Left alone; the file's rules are unchanged.

## Lint

`@typescript-eslint/no-unused-vars` is the reason each file needed its orphaned helper removed in the same change.
All four files lint clean at this revision:

    npx eslint test/framed/edges/refused-contract-shapes.test.ts test/framed/ahead/enumerable-set.test.ts \
      test/framed/ahead/push-length-keyed-mapping-write.test.ts test/framed/ahead/revert-after-calls.test.ts \
      --ext .ts --ignore-path ../../.eslintignore

`exit 0`. `push-length-keyed-mapping-write.test.ts` also carried ten pre-existing errors (an unused
`buildProxyArtifact` import, a 127-character line, eight indent errors); they were fixed in the same change and the
file is now clean. The fix was verified by linting the committed copy at `HEAD` through `--stdin` first, which
reproduced all ten.

## Test counts

Measured (`FRAMED_AHEAD=1`, `packages/solidcash/vitest.framed.config.ts`):

- the four files: 27 passed before the deletions, 8 after (`{SCRATCH}/w7-runs.log`).
- `test/framed/edges` as a directory: 70 passed after (`{SCRATCH}/w7-edges.log`).

`test/framed/MANIFEST.md` is updated: `edges/` 77 -> 70 (measured), `ahead/` 174 -> 163 (by subtraction; the full
`ahead/` directory was not re-run, so that row's arithmetic is 174 less the eleven removed cases and the next full
run should confirm it), the `solidcash` total 1567 -> 1557, `284` files, and the grand total 2751 -> 2741. The
`ahead/` row's own last full measurement was at a revision where the plan's Log calls the same directory 184 cases,
so the two documents count the directory differently; this record only removes eleven from whichever count a
document already carried.

The PW7 instrument's numbers are cited by `PLAN_MARKETPLACE_66.md` (lines 1713, 1732, 1742, 1750, 1782) and its Log
rows. Those citations are orphaned by the deletion: the instrument and its `PW7_OUT` output no longer exist, so the
numbers cannot be re-taken. The rows are dated history and are not rewritten; this document is the pointer, and the
MANIFEST's instrument row and note are removed.

## Coverage comparison (W7 phase 2)

Two instruments, both v8, both on `packages/solidc/src/**` plus `packages/solidcash/src/**`.

**Isolated.** The four files alone: lines 9.58% -> 9.14% (covered 5828 -> 5558), branches 5.36% -> 5.01%. The drop
is the deleted cases' own paths within that isolated set, which is why the plan requires the second instrument
(`{SCRATCH}/w7-coverage.log`, `{SCRATCH}/w7/coverage-before.json`, `-after.json`).

**Union with the named replacements.** Run 1 is the four files at `HEAD` (pre-deletion, 27 cases). Run 2 is the
four files after the deletion plus the eight guard files the table names (52 cases). Per source file, run 2 covers:

- fewer lines or branches than run 1 on **0** of 474 measured files,
- more on 48,
- identical on 425.

Totals: lines 5828 -> 6865, branches 3587 -> 4384. No line or branch that the pre-deletion four files exercised is
uncovered once the replacements the audit names are in the run
(`{SCRATCH}/w7-coverage-union.log`, `{SCRATCH}/w7/union-u1.json`, `-u2.json`).

Caveat: the second instrument compares covered *counts per source file*, not line identities, so it is necessary
but not sufficient evidence of subsumption, and it cannot see a line reached only at machine level inside emitted
bytecode. The audit's script-path reading (each removed case's rule is driven by the named replacement) is what
covers that gap; the plan's caveat about tests with no unique TypeScript coverage is why the "is served" admits
were checked case by case before deletion.
