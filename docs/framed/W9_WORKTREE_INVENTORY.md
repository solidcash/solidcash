# W9: worktree inventory, archive plan, and removal gate

Produced at `feat/framed` = `f5f2453bd` (2026-10-06). Read-only investigation; **nothing was removed, checked
out, stashed, or cleaned**. Removal needs the user's approval for every worktree that holds unsaved work (see
"Approval required"), because four of them do.

Reference points: `feat/framed` = `f5f2453bd`; main checkout `/Code/cashscript` = detached `cac34c86d`
(2026-10-03).

## 0. Read `.worktrees/release-readiness` first (done)

Branch `codex/release-readiness-final`, HEAD `cf9bdd3ff` (2026-08-11), clean, one commit not in `feat/framed`:
`cf9bdd3ff test: allow live iterable mapping setup` - a single `300_000` per-test timeout added to the last
`it()` of `packages/solidcash/test/e2e/IterableMappingSet.test.ts`. Its parent `4f7cd4dc0` is the merge base and
is in `feat/framed`, so all 16 earlier readiness commits (19 files, +450/-249, dated 2026-08-11) already landed.
`git merge-base --is-ancestor cf9bdd3ff feat/framed` is false only because of that timeout line; the readiness
documents themselves (`RELEASE_READINESS.md`, `RELEASE_READINESS_HANDOFF.md`, `RELEASE_NOTES_0.13.1.md`,
`TEST_DEFERRALS_0.13.1.md`, `SOLIDITY_COMPATIBILITY_0.13.1.md`, `SECURITY-AUDIT.md`) are byte-identical in
`feat/framed`.

What that work stream left open, and what the release gate must therefore still do (from
`RELEASE_READINESS_HANDOFF.md` and `RELEASE_READINESS.md`):

- `RELEASE_READINESS.md` line 6 still says "NO-GO for `0.13.1` on the current findings-fix worktree"; two exit
  items are unchecked: "Clean-checkout CI and BCHN regtest gates pass" and "Exact release commit, test results,
  scorecard, and known deferrals are recorded".
- The final fresh-chain BCHN matrix is incomplete: an authoritative fail-fast run stopped at 128/482 files
  (16/61 batches) at `4f0d1bb53`.
- Prescribed sequence for the release pass: confirm a clean worktree and record the candidate commit; rerun both
  NativeUSDT halves if compiler/tests changed; `yarn lint` and one one-shot `yarn build` at the final doc commit;
  wipe and restart the regtest chain (`docker compose -p release-readiness -f docker-compose.regtest.yml down -v`,
  then up) and run `REGTEST_CONTINUE_ON_FAILURE=true yarn test:regtest`, then a non-continue run for final
  evidence; update the BCHN row with the exact final commit/totals/chain-reset procedure/skips; run the
  clean-checkout install/CI-ordering rehearsal; audit every unchecked exit item. "Do not tag 0.13.1 merely
  because the branch merge, build, or lint is green."
- Already verified on that branch (candidate evidence to re-record, not to re-derive): compiler 3,240/3,240; SDK
  non-e2e 1,204 passed / 19 skipped / 5 todo; e2e 348 files / 2,742 passed; corpus positives 2,698/2,805 with 107
  named failures and all 2,158 negatives checked; package smoke 6 tarballs plus golden path 3/3; generated
  project 21/21; application mock 95/95 and serial BCHN 9/9; integrity 81/81; `yarn build` and `yarn lint` pass.

## 1. Inventory (the 20 registered worktrees besides the main checkout)

`git worktree list` reports 22 entries: the main checkout `/Code/cashscript`, 19 worktrees under
`/Code/cashscript/.worktrees/`, `/Code/framed-libauth`, and one under `/root/.grok/worktrees/` that is off
limits (owned by the Grok CLI). The table covers the 19 plus `/Code/framed-libauth`. The main checkout's own
unmerged work is described in section 2.

Short names below drop the `.worktrees/` prefix. `uPC` = commits reachable from HEAD but not from
`feat/framed`; dirty = `git status --porcelain` lines as `total (untracked / modified)`.

Identity:

| worktree | branch | HEAD | date |
|---|---|---|---|
| affine-verify-final-rAUwjd | detached | `d427f7c71` | 2026-09-09 |
| eacc-batch1-gate | `grok/eacc-batch1-gate` | `bfe645326` | 2026-08-25 |
| eacc-boundary-c2 | detached | `c2b9b15ff` | 2026-08-24 |
| eacc-boundary-d5 | detached | `d5adbb07f` | 2026-08-24 |
| eacc-noproxy | `codex/eacc-noproxy` | `162c1b724` | 2026-10-02 |
| eacc-noproxy-kernel-beta | `codex/eacc-noproxy-on-kernel-beta` | `cb948391f` | 2026-10-04 |
| effectiveacceleration-marketplace | `codex/effectiveacceleration-marketplace` | `c8ec0d1de` | 2026-08-29 |
| effectiveacceleration-performance | `grok/message-bus-kernel` | `baff91147` | 2026-09-10 |
| kernel-beta-candidate | `grok/message-bus-kernel-beta` | `d7f3c7ad6` | 2026-10-04 |
| kernel-beta-perf | `grok/message-bus-kernel-beta-perf` | `b85a9d738` | 2026-09-15 |
| kernel-comprehensive-fixtures | `grok/kernel-comprehensive-fixtures` | `e61f8c737` | 2026-09-25 |
| kernel-perf-baseline | detached | `0b723a6bf` | 2026-08-25 |
| kernel-perf-tip | detached | `24af483ee` | 2026-08-27 |
| kernel-return-helper-isolated | detached | `7dc8238b2` | 2026-09-09 |
| noproxy-integration-TnMN8e | `codex/eacc-noproxy-integration` | `557ea0176` | 2026-10-02 |
| framed | `feat/framed` | `f5f2453bd` | 2026-10-06 |
| framed-noproxy-measure | detached | `d326e325b` | 2026-10-05 |
| release-readiness | `codex/release-readiness-final` | `cf9bdd3ff` | 2026-08-11 |
| solidhat-marketplace-mock | `codex/solidhat-marketplace-mock` | `729ed5874` | 2026-09-16 |
| `/Code/framed-libauth` | `measure/libauth-alias` | `12c011dfe` | 2026-10-05 |

State and verdict:

| worktree | uPC | dirty | verdict |
|---|---|---|---|
| affine-verify-final-rAUwjd | 0 | 4 (0/4) | dirty, 0 unique commits |
| eacc-batch1-gate | 52 | 6 (6/0) | dirty, 52 unique commits |
| eacc-boundary-c2 | 0 | 1 (0/1) | dirty, 0 unique commits |
| eacc-boundary-d5 | 0 | 1 (0/1) | dirty, 0 unique commits |
| eacc-noproxy | 20 | 0 | clean, unmerged |
| eacc-noproxy-kernel-beta | 0 | 0 | clean, merged |
| effectiveacceleration-marketplace | 6 | 149 (18/131) | dirty, 6 unique commits |
| effectiveacceleration-performance | 62 | 436 (404/32) | dirty, 62 unique commits |
| kernel-beta-candidate | 0 | 0 | clean, merged |
| kernel-beta-perf | 1 | 0 | clean, unmerged |
| kernel-comprehensive-fixtures | 0 | 2587 (2585/2) | dirty, 0 unique commits |
| kernel-perf-baseline | 0 | 8 (2/6) | dirty, 0 unique commits |
| kernel-perf-tip | 0 | 5 (1/4) | dirty, 0 unique commits |
| kernel-return-helper-isolated | 22 | 3 (0/3) | dirty, 22 unique commits |
| noproxy-integration-TnMN8e | 0 | 0 | clean, merged |
| framed | 0 | 0 | the active branch |
| framed-noproxy-measure | 0 | 2 (1/1) | dirty, 0 unique commits |
| release-readiness | 1 | 0 | clean, 1 unique commit |
| solidhat-marketplace-mock | 2 | 0 | clean, 2 unique commits |
| `/Code/framed-libauth` | 0 | 2 (0/2) | dirty, 0 unique commits |

Folder and branch names disagree in two places: `effectiveacceleration-performance` holds
`grok/message-bus-kernel`, and `eacc-noproxy-kernel-beta` holds `codex/eacc-noproxy-on-kernel-beta`. No two
worktrees share a branch name. Repo-wide there are 360 real local branches, 190 of them fully merged into
`feat/framed`; the branches with the most unmerged commits are `future` (327), `mocknet_rework` (242),
`backup/perf-101-pre-squash` (225), `backup/kernel-beta-pre-history-squash-20260920` (138),
`backup/perf-128-pre-squash` (128).

## 2. What the unsaved work actually is

- `eacc-batch1-gate` (52 commits, 22 files): an August compiler-outlining perf line (`perf: port packed
  outlining engine`, `perf: share int-decode helpers in delegate bodies`). It rewrites the same outlining files
  (`packages/utils/src/outline.ts`, `solidc/src/compiler.ts`, `GenerateTargetTraversal.ts`, the outline tests)
  that `feat/framed` later rewrote its own way on 2026-08-27..09-06. No commit is patch-equivalent and no
  subject repeats, so it is a *superseded parallel take*, not a duplicate; `2cb4daa5e` (the 649-line port) and its
  `preflight.ts` / `StatefulContract.ts` touches have no counterpart in `feat/framed`.
- `effectiveacceleration-performance` (`grok/message-bus-kernel`, 62 commits): 71 of its 72 files are also touched
  by `feat/framed`'s kernel carrier/journal commits; one file is unique (`packages/solidc/test/CompileCacheDisk.test.ts`).
  Its 436 dirty files are generated build output (404 untracked `.js`/`.js.map`/`.d.ts`, 26 deleted TypeChain
  files, 6 modified generated files); the only hand-written working-tree edits are
  `packages/solidc/src/semantic/DesugarPostfixExpressions.ts` (+25),
  `packages/solidc/src/semantic/LowerVMapCounterLoops.ts` (+140), the untracked test
  `packages/solidc/test/journal-message-bus/InheritedPrivatePostfixRoute.test.ts` and
  `scripts/autoderive-bench.mjs`.
- `kernel-comprehensive-fixtures` is an ancestor of `feat/framed` (0 unique commits) and its 2,587 dirty files
  are generated in-place `tsc` emit beside every `.ts` source plus one generated `packages/testing/src/builtin-tasks.js`.
  Nothing hand-written is uncommitted there.
- The main checkout `/Code/cashscript` (detached `cac34c86d`, 27 commits not in `feat/framed`): framed SDK
  composition (participant/route/alias/band/chunk). 12 of the 27 shas are named in `feat/framed` commit
  messages and 5 are explicitly marked `(rescued <sha>)`; 15 are not explicitly referenced. Two rescue refs
  (`rescue/main-checkout-2026-10-03`, `rescue/main-checkout-wip-2026-10-03`) already hold them, the second adding
  a `WIP: kernel row-local route witnesses` commit.
- `kernel-return-helper-isolated` (22 commits) is contained in `grok/message-bus-kernel` (the same lane as
  `effectiveacceleration-performance`), so it adds no unique content beyond that lane.
- `kernel-perf-baseline`, `kernel-perf-tip`, `eacc-boundary-c2`, `eacc-boundary-d5`,
  `affine-verify-final-rAUwjd`, `framed-noproxy-measure` and `/Code/framed-libauth` all have 0 unique commits
  versus `feat/framed`; their dirty files are small (1-8 files) and were not inspected file by file.

## 3. Removal plan (execute only after the release merge lands)

Order, per the plan:

1. **Archive before delete.** For every worktree with unique commits or dirty files, keep the content reachable
   without the worktree: the commits already live on their branches, and the dirty files need one of
   - a `git -C <path> diff > <archive>/<name>.patch` plus `git -C <path> status --porcelain` listing (for the
     small dirty sets: `affine-verify-final-rAUwjd`, `eacc-boundary-c2`, `eacc-boundary-d5`, `kernel-perf-baseline`,
     `kernel-perf-tip`, `kernel-return-helper-isolated`, `framed-noproxy-measure`, `/Code/framed-libauth`,
     `effectiveacceleration-marketplace`), or
   - a tagged commit on a rescue branch (for `eacc-batch1-gate`, `effectiveacceleration-performance`, and the
     main checkout, all three of which already have their own branch or rescue refs).
   Store archives under a path the user chooses; do not write archives into the repository.
2. **Remove only the clean+merged worktrees first** (no content can be lost):
   `eacc-noproxy-kernel-beta`, `kernel-beta-candidate`, `noproxy-integration-TnMN8e`,
   `kernel-comprehensive-fixtures` (0 unique commits; its 2,585 untracked files are regenerable build output -
   confirm with the user before deleting generated output that has no commit).
3. **Then the clean+unmerged ones**, after their branches are confirmed kept:
   `eacc-noproxy` (20), `kernel-beta-perf` (1), `release-readiness` (1), `solidhat-marketplace-mock` (2).
4. **Last, with explicit approval**, the worktrees holding unsaved work: `eacc-batch1-gate`,
   `effectiveacceleration-performance`, `kernel-return-helper-isolated`, the main checkout, and the small dirty
   ones.
5. Keep `.worktrees/framed` (the release branch) until after landing; it is the worktree this work runs in.
6. Never touch `/root/.grok/worktrees/code-cashscript/2026-10-01-ce834b2b`; it is owned by the Grok CLI.

Removal command per worktree, after archiving: `git -C /Code/cashscript worktree remove <path>` (add `--force`
only for a worktree whose dirty files were just archived and confirmed).

## 4. Approval required

Per the plan and the standing rule, the user must confirm before anything with unsaved work is deleted. The four
the plan named are all confirmed to hold unsaved content: `eacc-batch1-gate` (52 commits, 6 untracked),
`effectiveacceleration-performance` (62 commits, 436 dirty), `kernel-comprehensive-fixtures` (0 commits, 2,585
untracked generated files), and the main checkout (27 commits, already rescue-ref'd). Two more hold unmerged
unique commits: `kernel-return-helper-isolated` (22) and, on the clean side, `eacc-noproxy` (20),
`solidhat-marketplace-mock` (2), `kernel-beta-perf` (1), `release-readiness` (1).
