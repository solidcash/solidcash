# W9 inventory refresh (no removals)

Taken 2026-10-05 against `feat/per-call` `57dfa942e`. `git rev-list --count feat/per-call..HEAD` per worktree. Nothing was removed, archived, or checked out.

| worktree | branch | not in HEAD | dirty | last commit |
|---|---|---:|---:|---|
| /Code/cashscript | detached | 27 | 6 | 2026-10-03 cac34c86d |
| .worktrees/affine-verify-final-rAUwjd | detached | 0 | 4 | 2026-09-09 d427f7c71 |
| .worktrees/eacc-batch1-gate | grok/eacc-batch1-gate | 52 | 6 | 2026-08-25 bfe645326 |
| .worktrees/eacc-boundary-c2 | detached | 0 | 1 | 2026-08-24 c2b9b15ff |
| .worktrees/eacc-boundary-d5 | detached | 0 | 1 | 2026-08-24 d5adbb07f |
| .worktrees/eacc-noproxy | codex/eacc-noproxy | 20 | 0 | 2026-10-02 162c1b724 |
| .worktrees/eacc-noproxy-kernel-beta | codex/eacc-noproxy-on-kernel-beta | 0 | 0 | 2026-10-04 cb948391f |
| .worktrees/effectiveacceleration-marketplace | codex/effectiveacceleration-marketplace | 6 | 149 | 2026-08-29 c8ec0d1de |
| .worktrees/effectiveacceleration-performance | grok/message-bus-kernel | 62 | 436 | 2026-09-10 baff91147 |
| .worktrees/kernel-beta-candidate | grok/message-bus-kernel-beta | 0 | 0 | 2026-10-04 d7f3c7ad6 |
| .worktrees/kernel-beta-perf | grok/message-bus-kernel-beta-perf | 1 | 0 | 2026-09-15 b85a9d738 |
| .worktrees/kernel-comprehensive-fixtures | grok/kernel-comprehensive-fixtures | 0 | 2587 | 2026-09-25 e61f8c737 |
| .worktrees/kernel-perf-baseline | detached | 0 | 8 | 2026-08-25 0b723a6bf |
| .worktrees/kernel-perf-tip | detached | 0 | 5 | 2026-08-27 24af483ee |
| .worktrees/kernel-return-helper-isolated | detached | 22 | 3 | 2026-09-09 7dc8238b2 |
| .worktrees/noproxy-integration-TnMN8e | codex/eacc-noproxy-integration | 0 | 0 | 2026-10-02 557ea0176 |
| .worktrees/per-call | feat/per-call | 0 | 0 | 2026-10-05 57dfa942e |
| .worktrees/release-readiness | codex/release-readiness-final | 1 | 0 | 2026-08-11 cf9bdd3ff |
| .worktrees/solidhat-marketplace-mock | codex/solidhat-marketplace-mock | 2 | 0 | 2026-09-16 729ed5874 |
| /root/.grok/worktrees/code-cashscript/2026-10-01-ce834b2b | detached | 19 | 6 | 2026-10-02 308e291c5 |

Unsated trees that stay until a recorded approval: eacc-batch1-gate (52 commits), effectiveacceleration-performance (62 commits, 436 dirty), kernel-comprehensive-fixtures (2,587 dirty), main checkout (27 commits, 6 dirty). The Grok worktree is not touched.

`.worktrees/release-readiness` still has 1 commit not in HEAD (`cf9bdd3ff test: allow live iterable mapping setup`). Read it before any later removal. No removal in this refresh.
