# Release hygiene triage (section 3 item 4)

Surveyed 2026-10-05 on `feat/per-call` at `57dfa942e`. Nothing in this list is deleted here. Phase 3 cleans a row or leaves it, with the reason, before the tag.

## Debug hooks

`SOLIDC_DEBUG_*` is read from the environment in compiler, SDK, and harness code. The reads are gated: they print only when the variable is set. They are still debug hooks in `packages/*/src` and should leave the release sources. Representative sites:

| area | examples |
|---|---|
| `packages/solidc/src/generation/GenerateTargetTraversal.ts` | `SOLIDC_DEBUG_COMPUTE_BASE`, `SOLIDC_DEBUG_ENTRY_INPUT_INDEX`, `SOLIDC_DEBUG_EMIT_TRAP`, `SOLIDC_DEBUG_NO_OUTLINE`, `SOLIDC_DEBUG_OUTLINE_TIMING`, `SOLIDC_DEBUG_CALL_INDEX`, `SOLIDC_DEBUG_DYNAMIC_FRAME` |
| `packages/solidc/src/artifact/Artifact.ts` | `SOLIDC_DEBUG_TRANSFER_EFFECTS` |
| `packages/solidcash/src/network/createVirtualMachine.ts` | `SOLIDC_DEBUG_SPLIT_FAILURE` (step probe, `console.error` of `split-failure` and `pick-count-layout`) |
| `packages/solidcash/src/tx-trace.ts` | `SOLIDCASH_TX_TRACE` (one JSON line per broadcast: bytes, inputs, outputs, fee, largest unlocking script). Measurement hook. Remove before the tag. |
| `packages/solidcash/src/stateful/stb-submit-final-transaction.ts` | `SOLIDC_DEBUG_REPAIR_CONVERGENCE`, `SOLIDC_DEBUG_EXTERNAL_ARGS` |
| `packages/testing/src` | `SOLIDC_DEBUG_HARNESS_TIMING`, `SOLIDC_DEBUG_ROUTE_CONCISE`, `SOLIDC_DEBUG_EMIT_MATCH` |

`sorted-key-missing-param` is the plan's example. It is live at `GenerateTargetTraversal.ts` around line 25008, inside `emitSortedKeyHash`, and it prints only when `SOLIDC_DEBUG_ROUTE=1`. Cleanup is: delete the probes and the `console.error` paths, and keep behaviour that does not read those variables.

## Non-ASCII in `packages/solidc/src/compiler.ts`

23 lines contain a character outside ASCII. The em dash the plan points at is line 14754 (`convention — where each contract...`), not 14746. Other characters on those lines: em dash (U+2014) on 17 lines, arrow (U+2192) on 6 lines, and logical signs on 4976 (`¬`, `…`, `⇔`, `∨`) and 17381 (`≥`). Cleanup is an ASCII rewrite of those comments. No string literal in the list is user-facing bytecode.

## Lines over 125 columns

| file | lines over 125 | the ones the plan names |
|---|---:|---|
| `packages/solidc/src/compiler.ts` | 26 | 984 (292), 11297 (127), 12122 (135) |
| `packages/solidc/src/semantic/LowerVMapCounterLoops.ts` | 2 | 4459 (131), 4547 (131) |
| `packages/solidc/src/generation/GenerateTargetTraversal.ts` | 37 | not named by the plan; same cleanup |

Cleanup is a wrap, not a behaviour change. Do it in the release-hygiene commit so a kernel merge does not have to re-resolve the same lines twice. If a wrap would touch a line a phase-2 merge also edits, do the wrap after the merge.

## Root-level working notes

34 markdown files at the worktree root are working notes, not the project README. Archive them under `docs/archive/` in one commit. Do not archive `README.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE`, `DEVELOPMENT.md`, `FEATURES.md`, or `COMPARISON.md`.

Notes to archive:

`CONCEPT_VALIDATION.md`, `FEATURES_SINCE_NEXT.md`, `FENCE_MAP_7_18.md`, `GOAL_CONDITIONAL_MULTI_CONTINUATION.md`, `GOAL_FAMILY1_MULTI_STREAM_RESIDUALS.md`, `GOAL_KERNEL_COMPLETE_RESIDUALS.md`, `GOAL_KERNEL_LAYOUT_OWNERSHIP_FOLD.md`, `HANDOFF_ACCIDENTAL_BETA_EDITS.md`, `HANDOFF_KERNEL_BETA_CURRENT.md`, `HANDOFF_KERNEL_BETA_NEXT_AGENT.md`, `HANDOFF_KERNEL_BETA_ROUND_NEXT.md`, `HANDOFF_MAPPING_WRITE_ADMISSION.md`, `HANDOFF_NEXT_SESSION.md`, `KERNEL_AHEAD_OF_TIME_COMPOSE_PROXY.md`, `KERNEL_EXTENSION_INVENTORY.md`, `KERNEL_IMPROVEMENT_BACKLOG.md`, `KERNEL_MARKETPLACE_MOTIVATED_GENERAL_GAPS.md`, `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md`, `MESSAGE_BUS_BYTECODE_IMPLEMENTATION_PLAN.md`, `MESSAGE_BUS_ENFORCEMENT_MATRIX.md`, `NEXT_SESSION_TAKE_JOB_PROBE_ORDER.md`, `NEXT_SESSION_TAKE_JOB_ROW_STALE_READ.md`, `NEXT_SESSION_VALUE_CHUNK_FIX.md`, `PERF_FINDINGS.md`, `PERF_HANDOFF_KERNEL_BETA.md`, `READY_TO_PROMOTE_KERNEL_FIXTURES.md`, `REEVAL_STILL_OPEN.md`, `RELEASE_NOTES_0.13.1.md`, `RELEASE_READINESS.md`, `RELEASE_READINESS_HANDOFF.md`, `SECURITY-AUDIT.md`, `SESSION_FINDINGS_QUEUE_ITEMS_1_2.md`, `SOLIDITY_COMPATIBILITY_0.13.1.md`, `TEST_DEFERRALS_0.13.1.md`.

`RELEASE_NOTES_0.13.1.md` and `SECURITY-AUDIT.md` move with the rest. The release changelog and the security triage (`TRIAGE_SECURITY.md`) are the documents the tag points at. The audit file stays reachable under `docs/archive/` so the finding ids are not lost.
