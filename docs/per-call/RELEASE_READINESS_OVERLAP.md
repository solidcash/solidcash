# release-readiness vs section 3

Read 2026-10-05. Worktree `.worktrees/release-readiness`, branch `codex/release-readiness-final`, HEAD `cf9bdd3ff` (2026-08-11), clean. One commit is not in `feat/per-call`. Nothing was deleted or cherry-picked.

`cf9bdd3ff` changes one line of `packages/solidcash/test/e2e/IterableMappingSet.test.ts`, raising that `it` to 300 seconds. `feat/per-call` still has no `300_000` in that file. The suite default stays 120 seconds, or 180 on regtest. Do not drop the worktree on the theory that the commit is already present.

This branch is an August 0.13.1 candidate. It has no per-call convention.

| section 3 item | on this branch |
|---|---|
| 1 Model B | The public rule is already a full locking script. There is no identity20 mode and no deferred-migration note, because the branch never left that rule. |
| 2 msg.sender audit | Absent. The September forgeability list is not in this tree. |
| 2 state-bus findings | The July `SECURITY-AUDIT.md` remediation is here. A per-call validator transcript is not. |
| 2 lenient `revertedWith` | Contradicted by this branch's own notes: a relaxed mock is described as ignoring the reason, while `examples/testing-suite/MIGRATION.md` says the reason is matched. |
| 3 regtest, both conventions | Absent. Older single-convention regtest smoke is not that matrix. |
| 4 hygiene | Absent. The later long lines and debug hooks are not in this smaller tree either. |
| 5 packaging | The six packages, migration notes, pack smoke, and a clean install plus build are covered. Two-convention docs and the libauth fork are not. No tag. |
| 6 bus-off compile | Absent. |
| 7 fixture determinism | Contradicted: a clean build still changes `updatedAt`. No CI refusal of a stale fixture. |
| 8 CI | Lint, build, and a small regtest smoke are covered. Sharding and nightly dual ladders are not. |
| 9 compatibility matrix | Absent. |
| 10 examples | A narrow set that CI runs is covered. A full `examples/*` pack sweep is not. `examples/package.json` on that branch is still 0.13.0. |
