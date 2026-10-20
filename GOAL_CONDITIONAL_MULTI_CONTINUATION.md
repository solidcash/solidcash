# Goal — conditional fixed-chunkable multi-continuation (family 1 residual)

**Register with:** paste `/tmp/goal-conditional-multi-continuation.txt` into `/goal` (or the objective block below).

**Worktree:** `.worktrees/kernel-comprehensive-fixtures`  
**Branch:** `grok/kernel-comprehensive-fixtures`  
**Handoff family:** 1 — resource-indexed multi-stream metadata (path-selected band)

## Objective (canonical)

Close the bool-param-activated second fixed-chunkable resource under `messageBus.compose`: admit `left[k]=a; if (writeRight) right[k]=b;`, settle compose for both activation values on the seeded UPDATE path, keep unconditional multi-continuation regression green, document the admitted subset, leave hetero-loop / both-arms / multi-stream+event fenced.

## Skeptic checklist

| # | Claim | Repro |
|---|---|---|
| A | Admission eligible + activation published | `yarn workspace solidc vitest run test/journal-message-bus/KernelAdmission.test.ts -t 'bool-param-activated\|both branch arms\|unconditional fixed chunkable'` |
| B | Conditional compose settles true/false | `yarn workspace solidcash vitest run test/journal-message-bus/e2e/KernelConditionalMultiContinuationCompose.test.ts` |
| C | Unconditional multi-continuation regression | `yarn workspace solidcash vitest run test/journal-message-bus/e2e/KernelMultiContinuationResourceCompose.test.ts test/unit/KernelValueChunkLane.test.ts` |
| D | Build clean | `yarn build` |
| E | No marketplace / requiredKernelProofs in diff | `git diff --name-only` / grep |

Scratch logs: `/tmp/cond-admission.log`, `/tmp/cond-e2e.log`, `/tmp/cond-build.log`.

## Non-goals

Heterogeneous loop streams; same-iter selection; events beside ≥2 mutation streams; inventory 3/1; Marketplace ladder.
