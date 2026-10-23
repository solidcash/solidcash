# SolidCash documentation archive

This orphan branch holds internal documents that were removed from `master` as closed, superseded, or
historical. Files keep the path they had, so an old citation resolves with one command:

    git show archive/docs:<path>
    git grep -n -i <term> archive/docs

The branch is append-only: one commit per archive batch, never rewritten. Archived text is history, not
instructions. Check the current code and the live ledgers before acting on anything written here.

Current ledgers:

- `docs/framed/DECISIONS.md` — per-call decisions and authorizations
- `packages/solidc/docs/deferrals.md` — implementation deferrals and residuals
- `RELEASE_DECISION_0.13.1.md` — release recommendation and gate evidence
- `docs/security-audit-2026-10-16.md` — current security findings and fix status
- `docs/marketplace-matrix-2026-10-14.md` — marketplace matrix baseline and reruns

The only file that also remains on `master` is `RELEASE_READINESS.md`: its full 2026-08-09 body is here, and
`master` now carries a short pointer to the current release decision.

## Batch 2026-10-20

Archived from `master` at `a3a883fc5` (2026-10-20). 87 files.

| path | kind | first seen | last active | last commit | open items now live in |
| --- | --- | --- | --- | --- | --- |
| `HANDOFF_ACCIDENTAL_BETA_EDITS.md` | handoff / session log | 2026-09-22 | 2026-09-22 | `f18ef5cd3` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `HANDOFF_KERNEL_BETA_CURRENT.md` | handoff / session log | 2026-09-19 | 2026-10-10 | `ebe07e7e6` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `HANDOFF_KERNEL_BETA_NEXT_AGENT.md` | handoff / session log | 2026-09-15 | 2026-10-10 | `ebe07e7e6` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `HANDOFF_KERNEL_BETA_ROUND_NEXT.md` | handoff / session log | 2026-09-16 | 2026-10-10 | `903818105` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `HANDOFF_MAPPING_WRITE_ADMISSION.md` | handoff / session log | 2026-09-19 | 2026-10-10 | `903818105` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `HANDOFF_NEXT_SESSION.md` | handoff / session log | 2026-09-19 | 2026-09-19 | `e25368e9e` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `NEXT_SESSION_TAKE_JOB_PROBE_ORDER.md` | handoff / session log | 2026-09-19 | 2026-09-19 | `e25368e9e` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `NEXT_SESSION_TAKE_JOB_ROW_STALE_READ.md` | handoff / session log | 2026-09-19 | 2026-10-10 | `ebe07e7e6` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `NEXT_SESSION_VALUE_CHUNK_FIX.md` | handoff / session log | 2026-09-19 | 2026-10-06 | `369b34419` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `SESSION_FINDINGS_QUEUE_ITEMS_1_2.md` | handoff / session log | 2026-09-19 | 2026-09-19 | `e25368e9e` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `PERF_HANDOFF_KERNEL_BETA.md` | handoff / session log | 2026-09-14 | 2026-10-10 | `ebe07e7e6` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md` | handoff / session log | 2026-09-19 | 2026-09-19 | `e25368e9e` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `GOAL_CONDITIONAL_MULTI_CONTINUATION.md` | kernel plan / snapshot | 2026-09-21 | 2026-09-21 | `1a1641838` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `GOAL_FAMILY1_MULTI_STREAM_RESIDUALS.md` | kernel plan / snapshot | 2026-09-21 | 2026-09-21 | `bfd69af2f` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `GOAL_KERNEL_COMPLETE_RESIDUALS.md` | kernel plan / snapshot | 2026-09-21 | 2026-09-21 | `354e84b2f` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `GOAL_KERNEL_LAYOUT_OWNERSHIP_FOLD.md` | kernel plan / snapshot | 2026-09-22 | 2026-09-24 | `6b071b3c7` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `READY_TO_PROMOTE_KERNEL_FIXTURES.md` | kernel plan / snapshot | 2026-09-19 | 2026-09-21 | `fff25e732` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `REEVAL_STILL_OPEN.md` | kernel plan / snapshot | 2026-09-20 | 2026-09-24 | `e4ba26dc4` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `FENCE_MAP_7_18.md` | kernel plan / snapshot | 2026-09-21 | 2026-09-24 | `6b071b3c7` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `KERNEL_AHEAD_OF_TIME_COMPOSE_PROXY.md` | kernel plan / snapshot | 2026-09-19 | 2026-09-24 | `e4ba26dc4` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `KERNEL_IMPROVEMENT_BACKLOG.md` | kernel plan / snapshot | 2026-09-22 | 2026-09-24 | `6b071b3c7` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `KERNEL_EXTENSION_INVENTORY.md` | kernel plan / snapshot | 2026-09-21 | 2026-09-25 | `e61f8c737` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `KERNEL_MARKETPLACE_MOTIVATED_GENERAL_GAPS.md` | kernel plan / snapshot | 2026-09-24 | 2026-10-03 | `bc3770cf6` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `MESSAGE_BUS_BYTECODE_IMPLEMENTATION_PLAN.md` | message-bus plan / audit | 2026-08-12 | 2026-08-12 | `3b2fcc82d` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `MESSAGE_BUS_ENFORCEMENT_MATRIX.md` | message-bus plan / audit | 2026-08-12 | 2026-08-12 | `3b2fcc82d` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `FEATURES_SINCE_NEXT.md` | feature inventory snapshot | 2026-06-11 | 2026-07-25 | `1d516022c` | FEATURES.md; SOLIDITY_COMPATIBILITY_0.13.1.md |
| `RELEASE_READINESS_HANDOFF.md` | release status snapshot | 2026-08-10 | 2026-08-11 | `9dce62478` | RELEASE_DECISION_0.13.1.md |
| `TEST_DEFERRALS_0.13.1.md` | release status snapshot | 2026-08-05 | 2026-08-05 | `e06727e95` | RELEASE_DECISION_0.13.1.md |
| `RELEASE_READINESS.md` | release status snapshot | 2026-08-04 | 2026-10-10 | `ebe07e7e6` | RELEASE_DECISION_0.13.1.md |
| `docs/framed/W4_FRAME_COST_PROFILE.md` | workstream status / snapshot | 2026-10-08 | 2026-10-08 | `bcbfd0c2e` | docs/framed/DECISIONS.md (D26); packages/solidc/docs/deferrals.md |
| `docs/framed/W4_FRAME_COST_PROJECT.md` | workstream status / snapshot | 2026-10-08 | 2026-10-14 | `acffacab3` | docs/framed/DECISIONS.md (D26); packages/solidc/docs/deferrals.md |
| `docs/framed/W4_SIZE_GROWTH.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `eb8f193d5` | docs/framed/DECISIONS.md (D26); packages/solidc/docs/deferrals.md |
| `docs/framed/W4_STATUS.md` | workstream status / snapshot | 2026-10-06 | 2026-10-07 | `563310b8f` | docs/framed/DECISIONS.md (D26); packages/solidc/docs/deferrals.md |
| `docs/framed/W4_WINS.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `25ace0370` | docs/framed/DECISIONS.md (D26); packages/solidc/docs/deferrals.md |
| `docs/framed/W6_BASELINE.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_BASELINE_FIXES.md` | workstream status / snapshot | 2026-10-07 | 2026-10-10 | `ebe07e7e6` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_BASELINE_NEXT.md` | workstream status / snapshot | 2026-10-07 | 2026-10-07 | `2584a39d5` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_CHUNKED_INSERT_FINDING.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `391208e7a` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_FAILURE_FIXES.md` | workstream status / snapshot | 2026-10-06 | 2026-10-07 | `ab8a97acb` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_FULL_SUITE_AT_HEAD.md` | workstream status / snapshot | 2026-10-06 | 2026-10-10 | `903818105` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_GATE_AT_HEAD.md` | workstream status / snapshot | 2026-10-07 | 2026-10-07 | `5206374c8` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_HEAD_STATUS.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `0bf4c4241` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_KNOWN_FAILURES.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_NEW_FAILURE_CLASSIFICATION.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `c39a89a9b` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_STATUS.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_TITLE_SWEEP.md` | workstream status / snapshot | 2026-10-08 | 2026-10-08 | `68e4d86fd` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W6_UPGRADE_ROUTE_FINDING.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W7_AUDIT.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W7_CLUSTERS.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W7_PHASE2_CANDIDATES.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `09f3c1c25` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W7_REDUCTIONS.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `8a7ed04a4` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W8_MERGE_PREP.md` | workstream status / snapshot | 2026-10-06 | 2026-10-07 | `31574849a` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W8_PORT_DECISION.md` | workstream status / snapshot | 2026-10-07 | 2026-10-07 | `ecf2793de` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W8_UPSTREAM_SURVEY.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W9_INVENTORY.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/W9_WORKTREE_INVENTORY.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/BETA_BLOCKERS.md` | measurement / status snapshot | 2026-10-07 | 2026-10-07 | `135fec4ac` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/BUS_OFF_PATH.md` | evaluation / design | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/DESIGN_REACHED_STATE_PLANNING.md` | evaluation / design | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/EVAL_FRAMED_VS_KERNEL.md` | evaluation / design | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/EVAL_REMOVE_BATCH_ENTRYPOINT.md` | evaluation / design | 2026-10-06 | 2026-10-10 | `ebe07e7e6` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/GATE_REPORT.md` | plan / handoff | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/HANDOFF_PARALLEL.md` | plan / handoff | 2026-10-06 | 2026-10-10 | `ebe07e7e6` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/LADDER_AT_HEAD.md` | measurement / status snapshot | 2026-10-06 | 2026-10-06 | `19f6c28b5` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/LADDER_NOPROXY_AT_HEAD.md` | measurement / status snapshot | 2026-10-06 | 2026-10-10 | `40965a138` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/MARKETPLACE_RED_AT_HEAD.md` | measurement / status snapshot | 2026-10-06 | 2026-10-06 | `d4fe519ed` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/NEXT_BRANCH.md` | evaluation / design | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/PERF_LIBAUTH.md` | measurement / status snapshot | 2026-10-06 | 2026-10-10 | `7c548ec85` | docs/framed/DECISIONS.md (D26); packages/solidc/docs/deferrals.md |
| `docs/framed/PLACEHOLDER_OUTPUTS_INVENTORY.md` | evaluation / design | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/PLAIN_PATH_SETTLE_SCOPING.md` | evaluation / design | 2026-10-06 | 2026-10-11 | `790561eb9` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/PLAN_MARKETPLACE_66.md` | plan / handoff | 2026-10-06 | 2026-10-10 | `ebe07e7e6` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/RELEASE_GATE_AT_HEAD.md` | measurement / status snapshot | 2026-10-06 | 2026-10-06 | `2e6192b31` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/RELEASE_HYGIENE.md` | measurement / status snapshot | 2026-10-06 | 2026-10-10 | `680138aca` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/RELEASE_READINESS_OVERLAP.md` | measurement / status snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/SIZE_KERNEL_VS_FRAMED.md` | measurement / status snapshot | 2026-10-06 | 2026-10-10 | `ebe07e7e6` | docs/framed/DECISIONS.md (D26); packages/solidc/docs/deferrals.md |
| `docs/framed/TRIAGE_HYGIENE.md` | measurement / status snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/UPSTREAM_0140_PORT.md` | plan / handoff | 2026-10-11 | 2026-10-11 | `bf40aaa62` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/UPSTREAM_PLAN.md` | plan / handoff | 2026-10-06 | 2026-10-10 | `ebe07e7e6` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/WALLS_AHEAD.md` | workstream status / snapshot | 2026-10-06 | 2026-10-06 | `369b34419` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/framed/probes/LADDER_TIMES.md` | measurement snapshot | 2026-10-06 | 2026-10-06 | `391208e7a` | docs/framed/DECISIONS.md; RELEASE_DECISION_0.13.1.md; docs/marketplace-matrix-2026-10-14.md |
| `docs/kernel-beta-readiness.md` | kernel status snapshot | 2026-09-21 | 2026-10-13 | `ad15e599c` | packages/solidc/docs/message-bus-kernel.md; docs/framed/DECISIONS.md; packages/solidc/docs/deferrals.md |
| `docs/security-reaudit-working-tree.md` | audit working note | 2026-10-15 | 2026-10-15 | `b1ef5d064` | docs/security-audit-2026-10-16.md; SECURITY-AUDIT-2026-10.md |
| `docs/transcript-followups-2026-10.md` | workstream log | 2026-10-14 | 2026-10-15 | `d3bbc9b6e` | docs/security-audit-2026-10-16.md; packages/solidc/docs/deferrals.md |
| `packages/solidc/docs/expression-statements-plan.md` | completed plan | 2026-07-05 | 2026-07-05 | `a89a53140` | packages/solidc/docs/arrays.md; packages/solidc/docs/deferrals.md |
| `packages/solidc/docs/large-contract-splitting-implementation-plan.md` | implementation plan | 2026-07-26 | 2026-08-09 | `875366745` | packages/solidc/docs/large-contract-splitting.md; packages/solidc/docs/deferrals.md |
| `packages/solidc/docs/message-bus-external-audit-handoff-opus.md` | audit handoff | 2026-08-03 | 2026-08-04 | `29498006b` | packages/solidc/docs/deferrals.md; packages/solidc/docs/journal-and-message-bus.md |
| `packages/solidc/docs/vmap-size-survey-2026-08.md` | measurement snapshot | 2026-08-11 | 2026-10-10 | `ebe07e7e6` | packages/solidc/docs/deferrals.md; packages/solidc/docs/journal-and-message-bus.md |

## Recorded path moves

From git rename history for Markdown files. A citation to the old path can be checked with the new path on
this branch or on `master`.

| old path | new path |
| --- | --- |
| `docs/cashc.md` | `website/docs/basics/cli.md` |
| `docs/per-call/AUDIT_MSG_SENDER.md` | `docs/framed/AUDIT_MSG_SENDER.md` |
| `docs/per-call/BUS_OFF_PATH.md` | `docs/framed/BUS_OFF_PATH.md` |
| `docs/per-call/DECISIONS.md` | `docs/framed/DECISIONS.md` |
| `docs/per-call/DESIGN_REACHED_STATE_PLANNING.md` | `docs/framed/DESIGN_REACHED_STATE_PLANNING.md` |
| `docs/per-call/EVAL_PER_CALL_VS_KERNEL.md` | `docs/framed/EVAL_FRAMED_VS_KERNEL.md` |
| `docs/per-call/EVAL_REMOVE_BATCH_ENTRYPOINT.md` | `docs/framed/EVAL_REMOVE_BATCH_ENTRYPOINT.md` |
| `docs/per-call/GATE_REPORT.md` | `docs/framed/GATE_REPORT.md` |
| `docs/per-call/HANDOFF_PARALLEL.md` | `docs/framed/HANDOFF_PARALLEL.md` |
| `docs/per-call/MARKETPLACE_SHAPES.md` | `docs/framed/MARKETPLACE_SHAPES.md` |
| `docs/per-call/NEXT_BRANCH.md` | `docs/framed/NEXT_BRANCH.md` |
| `docs/per-call/PERF_KERNEL_VS_PERCALL.md` | `docs/framed/PERF_KERNEL_VS_FRAMED.md` |
| `docs/per-call/PERF_LIBAUTH.md` | `docs/framed/PERF_LIBAUTH.md` |
| `docs/per-call/PLACEHOLDER_OUTPUTS_INVENTORY.md` | `docs/framed/PLACEHOLDER_OUTPUTS_INVENTORY.md` |
| `docs/per-call/PLAIN_PATH_SETTLE_SCOPING.md` | `docs/framed/PLAIN_PATH_SETTLE_SCOPING.md` |
| `docs/per-call/PLAN_MARKETPLACE_66.md` | `docs/framed/PLAN_MARKETPLACE_66.md` |
| `docs/per-call/RELEASE_HYGIENE.md` | `docs/framed/RELEASE_HYGIENE.md` |
| `docs/per-call/RELEASE_READINESS_OVERLAP.md` | `docs/framed/RELEASE_READINESS_OVERLAP.md` |
| `docs/per-call/SIZE_KERNEL_VS_PERCALL.md` | `docs/framed/SIZE_KERNEL_VS_FRAMED.md` |
| `docs/per-call/SPEC_PER_CALL_TRANSACTION.md` | `docs/framed/SPEC_FRAMED_TRANSACTION.md` |
| `docs/per-call/TRIAGE_HYGIENE.md` | `docs/framed/TRIAGE_HYGIENE.md` |
| `docs/per-call/TRIAGE_SECURITY.md` | `docs/framed/TRIAGE_SECURITY.md` |
| `docs/per-call/UPSTREAM_PLAN.md` | `docs/framed/UPSTREAM_PLAN.md` |
| `docs/per-call/W6_BASELINE.md` | `docs/framed/W6_BASELINE.md` |
| `docs/per-call/W6_CHUNKED_INSERT_FINDING.md` | `docs/framed/W6_CHUNKED_INSERT_FINDING.md` |
| `docs/per-call/W6_KNOWN_FAILURES.md` | `docs/framed/W6_KNOWN_FAILURES.md` |
| `docs/per-call/W6_STATUS.md` | `docs/framed/W6_STATUS.md` |
| `docs/per-call/W6_UPGRADE_ROUTE_FINDING.md` | `docs/framed/W6_UPGRADE_ROUTE_FINDING.md` |
| `docs/per-call/W7_AUDIT.md` | `docs/framed/W7_AUDIT.md` |
| `docs/per-call/W7_CLUSTERS.md` | `docs/framed/W7_CLUSTERS.md` |
| `docs/per-call/W8_MERGE_PREP.md` | `docs/framed/W8_MERGE_PREP.md` |
| `docs/per-call/W8_UPSTREAM_SURVEY.md` | `docs/framed/W8_UPSTREAM_SURVEY.md` |
| `docs/per-call/W9_INVENTORY.md` | `docs/framed/W9_INVENTORY.md` |
| `docs/per-call/W9_WORKTREE_INVENTORY.md` | `docs/framed/W9_WORKTREE_INVENTORY.md` |
| `docs/per-call/WALLS_AHEAD.md` | `docs/framed/WALLS_AHEAD.md` |
| `docs/per-call/WALLS_BEYOND_LADDER.md` | `docs/framed/WALLS_BEYOND_LADDER.md` |
| `docs/per-call/probes/LADDER_TIMES.md` | `docs/framed/probes/LADDER_TIMES.md` |
| `ecrecover-poc/README.md` | `research/ecrecover-poc/README.md` |
| `examples/Browser/README.md` | `examples/webapp/README.md` |
| `examples/solidity-by-example/SBE_SOURCE.md` | `bench/solidity-by-example/SBE_SOURCE.md` |
| `examples/solidity-corpus/ATTENTION.md` | `bench/solidity-corpus/ATTENTION.md` |
| `examples/solidity-corpus/BEHAVIORAL_COVERAGE.md` | `bench/solidity-corpus/BEHAVIORAL_COVERAGE.md` |
| `examples/solidity-corpus/NEGATIVE_AUDIT.md` | `bench/solidity-corpus/NEGATIVE_AUDIT.md` |
| `examples/solidity-corpus/PROGRESS.md` | `bench/solidity-corpus/PROGRESS.md` |
| `examples/solidity-corpus/README.md` | `bench/solidity-corpus/README.md` |
| `keccak-poc/INTEGRATION.md` | `research/keccak-poc/INTEGRATION.md` |
| `keccak-poc/README.md` | `research/keccak-poc/README.md` |
| `keccak-poc/SIDECAR.md` | `research/keccak-poc/SIDECAR.md` |
| `packages/solidc/docs/archive/journal-message-bus/layer3-benchmark-history.md` | `packages/solidc/docs/archive/journal-message-bus/message-bus-benchmark-history.md` |
| `packages/solidc/docs/archive/journal-message-bus/layer3-implementation-record.md` | `packages/solidc/docs/archive/journal-message-bus/message-bus-implementation-record.md` |
| `packages/solidc/docs/c2-codegen-optimization.md` | `packages/solidc/docs/vmap-codegen-optimization.md` |
| `packages/solidc/docs/layer3-coverage-matrix.md` | `packages/solidc/docs/message-bus-coverage-matrix.md` |
| `packages/solidc/docs/layer3-external-audit-handoff-opus.md` | `packages/solidc/docs/message-bus-external-audit-handoff-opus.md` |
| `packages/solidc/docs/layer3-semantic-test-profile.md` | `packages/solidc/docs/message-bus-semantic-test-profile.md` |
| `packages/solidc/docs/layer3-single-transaction-bus-progress.md` | `packages/solidc/docs/archive/journal-message-bus/layer3-implementation-record.md` |
| `packages/solidc/docs/layer3-single-transaction-bus-protocol.md` | `packages/solidc/docs/atomic-message-bus-protocol.md` |
| `packages/solidc/docs/layer3-target-corpus.md` | `packages/solidc/docs/archive/journal-message-bus/layer3-benchmark-history.md` |
| `packages/solidc/docs/sorted-mapping-c2.md` | `packages/solidc/docs/verified-mappings.md` |
| `packages/solidc/docs/state-bus-audit-handoff.md` | `packages/solidc/docs/archive/journal-message-bus/state-journal-review-handoff.md` |
| `packages/solidc/docs/state-journal-audit.md` | `packages/solidc/docs/archive/journal-message-bus/state-journal-audit-findings.md` |
| `packages/solidcash/test/per-call/MANIFEST.md` | `packages/solidcash/test/framed/MANIFEST.md` |
| `packages/solidhat/docs/compatibility-roadmap.md` | `packages/solidhat/docs/viem-wagmi-research.md` |
| `website/docs/basics/cli.md` | `website/docs/basics/compiler.md` |
| `website/docs/basics/compiler.md` | `website/docs/compiler/compiler.md` |
| `website/docs/compiler/vmlimits.md` | `website/docs/compiler/vm-limits.md` |
| `website/docs/guides/syntax-highlighting.md` | `website/docs/language/syntax-highlighting.md` |
| `website/docs/language/artifacts.md` | `website/docs/compiler/artifacts.md` |
| `website/docs/language/grammar.md` | `website/docs/compiler/grammar.md` |
| `website/docs/sdk/debugging.md` | `website/docs/sdk/testing-setup.md` |
| `website/docs/sdk/transactions-advanced.md` | `website/docs/sdk/transaction-builder.md` |
| `website/docs/sdk/transactions.md` | `website/docs/sdk/legacy-transaction-builder.md` |

## Previously deleted documents (restored 2026-10-20)

These paths were deleted before this archive existed. Their last content is restored here so an old
citation resolves without editing the citing document. They are history; the same warning applies.

| path | last active | last content commit | deleted in |
| --- | --- | --- | --- |
| `HANDOFF_OPUS.md` | 2026-08-27 | `608e35a20` | `608e35a20` |
| `SOLIDITY_GAP_ANALYSIS.md` | 2026-02-24 | `dc15dd638` | `dc15dd638` |
| `docs/framed/DEPRECATIONS.md` | 2026-10-06 | `02de0b9d1` | `02de0b9d1` |
| `docs/language.md` | 2020-05-25 | `a95cdc1b8` | `a95cdc1b8` |
| `docs/sdk.md` | 2020-05-25 | `a95cdc1b8` | `a95cdc1b8` |
| `examples/effectiveacceleration/BYTECODE_OPTIMIZATION_BASELINE.md` | 2026-10-10 | `a07eee905` | `a07eee905` |
| `examples/effectiveacceleration/PROGRESS.md` | 2026-10-10 | `a07eee905` | `a07eee905` |
| `examples/webapp/README.md` | 2023-05-26 | `704ed2b38` | `704ed2b38` |
| `functions-todos.md` | 2026-07-07 | `78c433583` | `78c433583` |
| `packages/cashc/README.md` | 2026-06-11 | `414833ae3` | `414833ae3` |
| `packages/cashscript/README.md` | 2026-06-11 | `03d03d4d9` | `03d03d4d9` |
| `packages/solidc/docs/block-oracle.md` | 2026-06-26 | `85f7b2d12` | `85f7b2d12` |
| `packages/solidc/docs/compiler-hidden-batch-v1-audit.md` | 2026-08-02 | `51bd28ec4` | `51bd28ec4` |
| `packages/solidc/docs/compiler-hidden-batch-v1-review-handoff.md` | 2026-08-02 | `51bd28ec4` | `51bd28ec4` |
| `packages/solidc/docs/compiler-hidden-batch-v1.md` | 2026-08-02 | `51bd28ec4` | `51bd28ec4` |
| `packages/solidc/docs/invocation-transcript-v1-audit.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/invocation-transcript-v1.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/journal-bus-implementation-status.md` | 2026-08-02 | `51bd28ec4` | `51bd28ec4` |
| `packages/solidc/docs/journal-message-bus-docs-todo.md` | 2026-08-03 | `a09e789d8` | `a09e789d8` |
| `packages/solidc/docs/layer3-binding-spike-handoff.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-corpus-fit-f3.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-erc20-continuation-handoff.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-production-api.md` | 2026-08-03 | `a09e789d8` | `a09e789d8` |
| `packages/solidc/docs/layer3-production-audit.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-production-envelope.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-production-reaudit.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-real-composition.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-regtest-validation.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-required-path-audit.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-required-path-resolution-audit.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-required-path-resolution.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-review-fixes-audit.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-review-package.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-single-transaction-bus-handoff.md` | 2026-08-03 | `a09e789d8` | `a09e789d8` |
| `packages/solidc/docs/layer3-single-transaction-bus-requirements.md` | 2026-08-03 | `a09e789d8` | `a09e789d8` |
| `packages/solidc/docs/layer3-spike-audit-findings.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/layer3-spike-audit-handoff.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/message-bus-HANDOFF.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/message-bus-completion-ledger.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/message-bus-external-review-guide.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/message-bus-opus-completion-handoff.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/message-bus-parallel-work-plan.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/message-bus-security-review-l2.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidc/docs/pre-message-bus-work-scope.md` | 2026-08-02 | `b990c4823` | `b990c4823` |
| `packages/solidhat-cli/README.md` | 2026-07-21 | `914da8a23` | `914da8a23` |

## Previously deleted documents (restored 2026-10-20)

These paths were deleted before this archive existed. Their last content is restored here so an old
citation resolves without editing the citing document. They are history; the same warning applies.

| path | last active | last content commit | deleted in |
| --- | --- | --- | --- |
| `HANDOFF_OPUS.md` | 2026-08-27 | `32b5fa6dd` | `608e35a20` |
| `SOLIDITY_GAP_ANALYSIS.md` | 2026-02-24 | `5f97ca21e` | `dc15dd638` |
| `docs/framed/DEPRECATIONS.md` | 2026-10-06 | `3d866ac4e` | `02de0b9d1` |
| `docs/language.md` | 2020-05-25 | `c943a9d30` | `a95cdc1b8` |
| `docs/sdk.md` | 2020-05-25 | `c943a9d30` | `a95cdc1b8` |
| `examples/effectiveacceleration/BYTECODE_OPTIMIZATION_BASELINE.md` | 2026-10-10 | `ddc4394d5` | `a07eee905` |
| `examples/effectiveacceleration/PROGRESS.md` | 2026-10-10 | `ddc4394d5` | `a07eee905` |
| `examples/webapp/README.md` | 2023-05-26 | `a0b72cef8` | `704ed2b38` |
| `functions-todos.md` | 2026-07-07 | `16c55d7c9` | `78c433583` |
| `packages/cashc/README.md` | 2026-06-11 | `4162a7647` | `414833ae3` |
| `packages/cashscript/README.md` | 2026-06-11 | `414833ae3` | `03d03d4d9` |
| `packages/solidc/docs/block-oracle.md` | 2026-06-26 | `617530aea` | `85f7b2d12` |
| `packages/solidc/docs/compiler-hidden-batch-v1-audit.md` | 2026-08-02 | `f78570e37` | `51bd28ec4` |
| `packages/solidc/docs/compiler-hidden-batch-v1-review-handoff.md` | 2026-08-02 | `f78570e37` | `51bd28ec4` |
| `packages/solidc/docs/compiler-hidden-batch-v1.md` | 2026-08-02 | `f78570e37` | `51bd28ec4` |
| `packages/solidc/docs/invocation-transcript-v1-audit.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/invocation-transcript-v1.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/journal-bus-implementation-status.md` | 2026-08-02 | `f78570e37` | `51bd28ec4` |
| `packages/solidc/docs/journal-message-bus-docs-todo.md` | 2026-08-03 | `07447e691` | `a09e789d8` |
| `packages/solidc/docs/layer3-binding-spike-handoff.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-corpus-fit-f3.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-erc20-continuation-handoff.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-production-api.md` | 2026-08-03 | `07447e691` | `a09e789d8` |
| `packages/solidc/docs/layer3-production-audit.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-production-envelope.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-production-reaudit.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-real-composition.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-regtest-validation.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-required-path-audit.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-required-path-resolution-audit.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-required-path-resolution.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-review-fixes-audit.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-review-package.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-single-transaction-bus-handoff.md` | 2026-08-03 | `07447e691` | `a09e789d8` |
| `packages/solidc/docs/layer3-single-transaction-bus-requirements.md` | 2026-08-03 | `07447e691` | `a09e789d8` |
| `packages/solidc/docs/layer3-spike-audit-findings.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/layer3-spike-audit-handoff.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/message-bus-HANDOFF.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/message-bus-completion-ledger.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/message-bus-external-review-guide.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/message-bus-opus-completion-handoff.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/message-bus-parallel-work-plan.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/message-bus-security-review-l2.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidc/docs/pre-message-bus-work-scope.md` | 2026-08-02 | `87e45bb82` | `b990c4823` |
| `packages/solidhat-cli/README.md` | 2026-07-21 | `cc3c41333` | `914da8a23` |

## Recovered untracked documents (2026-10-20)

These files were never tracked on `master`; they are restored from the copies named in the workstream notes.

| path | source | note |
| --- | --- | --- |
| `docs/framed/SOLIDITY_COMPAT_UNGATE_PLAN.md` | `/tmp/grok-goal-4b830698eeec/implementer/removed-SOLIDITY_COMPAT_UNGATE_PLAN.md` | 2026-10-08 ungate plan, removed from `docs/framed/` before the archive existed |

## Trimmed logs (2026-10-20)

Full copies of the two long-running logs before their master versions were trimmed.

| path | source | note |
| --- | --- | --- |
| `bench/solidity-corpus/PROGRESS_2026-10-12.md` | `bench/solidity-corpus/PROGRESS.md` at `66f6839ea` | full session log through 2026-10-12 |
| `packages/solidc/docs/deferrals_2026-10-20.md` | `packages/solidc/docs/deferrals.md` at `66f6839ea` | full deferral log before resolved-entry trim |

## Batch 2026-10-23

Archived from `master` at `803659e76`. 16 file(s).

| path | kind | first seen | last active | last commit | open items now live in |
| --- | --- | --- | --- | --- | --- |
| `docs/framed/PERF_KERNEL_VS_FRAMED.md` | historical snapshot | 2026-10-06 | 2026-10-23 | `ee594bc31` | docs/README.md |
| `docs/framed/TRIAGE_SECURITY.md` | historical snapshot | 2026-10-06 | 2026-10-20 | `cec06b30e` | docs/README.md |
| `docs/design/COMPARISON.md` | historical snapshot | 2026-10-20 | 2026-10-20 | `b1df6be93` | docs/README.md |
| `docs/design/PERF_FINDINGS.md` | historical snapshot | 2026-10-20 | 2026-10-20 | `b1df6be93` | docs/README.md |
| `docs/security/security-audit-2026-10-15.md` | historical snapshot | 2026-10-20 | 2026-10-20 | `b1df6be93` | docs/README.md |
| `docs/security/security-audit-2026-10-feat-parity.md` | historical snapshot | 2026-10-20 | 2026-10-20 | `b1df6be93` | docs/README.md |
| `packages/solidc/docs/message-bus-semantic-test-profile.md` | historical snapshot | 2026-08-03 | 2026-08-03 | `9d9a42b3d` | docs/README.md |
| `packages/solidc/docs/buffered-state-and-message-bus-research.md` | historical snapshot | 2026-07-26 | 2026-08-09 | `875366745` | docs/README.md |
| `packages/solidc/docs/mapping-soundness-research.md` | historical snapshot | 2026-07-08 | 2026-08-09 | `875366745` | docs/README.md |
| `packages/solidc/docs/delegate-modifier-drop-evaluation.md` | historical snapshot | 2026-07-25 | 2026-07-25 | `0c579efc9` | docs/README.md |
| `packages/solidc/docs/solidity-gap-analysis.md` | historical snapshot | 2026-06-17 | 2026-10-23 | `ee594bc31` | docs/README.md |
| `packages/solidcash/test/SKIPPED-TESTS.md` | historical snapshot | 2026-07-23 | 2026-08-09 | `875366745` | docs/README.md |
| `research/keccak-poc/README.md` | historical snapshot | 2026-07-22 | 2026-07-22 | `09fa261be` | docs/README.md |
| `research/keccak-poc/SIDECAR.md` | historical snapshot | 2026-07-22 | 2026-07-22 | `09fa261be` | docs/README.md |
| `research/keccak-poc/INTEGRATION.md` | historical snapshot | 2026-07-22 | 2026-08-03 | `9d9a42b3d` | docs/README.md |
| `research/ecrecover-poc/README.md` | historical snapshot | 2026-07-22 | 2026-07-22 | `09fa261be` | docs/README.md |
