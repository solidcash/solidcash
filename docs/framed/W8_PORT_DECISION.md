# W8: the upstream merge is a curated port, and why

Measured 2026-10-07 at `feat/per-call` = `135fec4ac`, against `cashscript/master` fetched that day.

## What upstream looks like now

- The remote already exists (`cashscript` = `https://github.com/CashScript/cashscript.git`) and fetches; the plan's
  "add a remote" setup note is stale. A fetch moved `master` from `71a243b65` to **`5f0eaffb6`** (the merge of
  PR #446, tagged `v0.14.0`), and there are **82 commits** since the fork point `a34616620`, not the 22 the
  2026-10-06 survey recorded: that survey looked at `master` before the `next` line was merged into it.
- Layout mapping: upstream `packages/cashc` -> our `packages/solidc`, upstream `packages/cashscript` -> our
  `packages/solidcash`, `packages/utils` -> `packages/utils`. Across the 82 commits, **742 files** land on a path we
  have and **195** are at paths we do not (docs, CI, website, their test layout).

## A literal merge is not usable

`git merge --no-commit --no-ff cashscript/master` in a scratch worktree:

- **401 conflicts**, concentrated in test fixtures (108 in
  `packages/solidc/test/generation/fixtures/valid-contract-files`, 31 in `valid-contract-files`, 24 in
  `import-fixtures`), the grammar (8) and `packages/utils/src` (7).
- The **auto-merged half is worse than the conflicts**: 11 files are *deleted* from our tree, including
  `packages/solidc/src/generation/GenerateTargetTraversal.ts`, `packages/solidc/src/generation/utils.ts`,
  `upsertKeySources.ts` and nine tests. Git's rename detection maps upstream's restructures of `packages/cashc/...`
  onto our renamed files, so upstream's deletions arrive as deletions of our own source. A merge taken literally
  produces neither tree.
- Applying the upstream patches by hand is no easier: rewriting each commit's paths through the mapping and running
  `git apply --check` against our tree succeeds for **0 of 67** commits. Our line has 7,489 commits of its own since
  the fork point.

So the merge is a port, exactly as the brief predicted, and the unit of work is the upstream commit, not the merge.

## Class decision

- **Docs, release notes, website, CI** (most of the 14 unmapped commits plus several mixed): **skip.** Our docs are
  rewritten for SolidCash and upstream's site is irrelevant here.
- **Dependency bumps** (`4982ce5b8`, parts of `a1ce2bc14`: electrum-cash, vitest, libauth): **adapt separately** if a
  fix needs them; our lockfile is pinned for other reasons.
- **Compiler correctness fixes that carry regression fixtures** (`d2e359342` - hex literals, NullData chunks, tuple
  narrowing; `9459e33fb` - slice final use; `c43df8892` - nulldata too big; `4f157e241` - init-reassign loop;
  `5e46aa7f7` - reassigned-variable logging): **port**, smallest and highest value first. In flight in this round.
- **Optimiser work** (`52c2b43f7`, `37bf465dd`, `498b9ea20`, `1849769f5`): **port later.** Our optimiser is a
  different implementation with its own W4 measurements; taking theirs needs a size and perf comparison first.
- **SDK audit findings** (`a1ce2bc14`): **largely already covered.** The commit is mostly tests plus
  `vitest.setup.ts` and `vitest/package.json`; check its source side against ours before porting anything.
- **API-shape changes** (`981eb07f1`, breaking `SignatureTemplate`): **skip for this release.** Breaking, and our
  SDK's signature handling is its own.
- **Compiler internals the SDK shares** (`ff9e63143` shared import resolution, the compiler half of `a1ce2bc14`):
  **adapt later**, after the correctness class.

The port's rule from the plan still holds per commit: port the behaviour, add the fixture the upstream commit carries
(or a focused test that drives `compileString`), and prove the test fails without the port.

## What this means for the criterion

"CashScript upstream is merged into the branch" is satisfied *structurally* only by a merge, and a merge here deletes
our compiler's generation layer. Neither a merge nor a mechanical patch series is honest. What this round delivers
instead is the measurement above, the class decision, and the first ports with their tests; the remaining classes are
listed per commit so the next round can continue without re-deriving any of this.
