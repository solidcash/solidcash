# Goal — kernel-complete residuals (leftovers, followups, fences)

**Register with:** paste `/tmp/goal-kernel-complete-residuals.txt` into `/goal` (optional `--budget` for multi-phase).

**Worktree:** `.worktrees/kernel-comprehensive-fixtures`  
**Branch:** `grok/kernel-comprehensive-fixtures`  
**Baseline tip:** `bfd69af2f` (family-1 A/B/C settle; compose inline ≤60B; batch long chunks)  
**Phase-0 tip:** pending commit — compose ≥61B loop-nested chunks via in-band trailing placement + route `__internal__valueChunkOutputBase`  
**Maps:** `KERNEL_EXTENSION_INVENTORY.md`, `FENCE_MAP_7_18.md`, `REEVAL_STILL_OPEN.md`  
**Plans:** `ITEMS_3_4_PLAN.md`, `ITEMS_5_6_PLAN.md`

## Why this order (missing proof objects)

| Phase | Proof object | Closes |
|---|---|---|
| 0 | Trailing continuation slots on multi-stream loops | Family-1 / #17 leftover — compose ≥61B chunks |
| 1 | Row calldata framing + producer IDs + multi-write claims | Beta inventory 3, 5, 6 (+ re-verify 1) |
| 2 | Authenticated path / effect / zero-width schedule | Family 2; #7/#18 residuals (events, selection, transfers) |
| 3 | Key-vector snapshot | Family 3; #8 |
| 4 | Non-overlapping span descriptors + relocatable bands | #9, #17 |
| 5 | Segmented aggregate framing + recursive key-path | Family 4; #10, #11 |
| 6 | Ownership / retirement / deploy geometry | Family 5; #12, #16 |
| 7 | Non-circular sig provenance + verified assembly summary | Family 6–7; #13, #14 |

**Stay fenced forever (for this goal):** foreign delegate (#15), true signature circularity, Marketplace / `requiredKernelProofs`.

## Phase checklist

- [x] **0** Loop-nested external value-chunk compose (hetero ≥61B Caller→Store) — route publishes `valueChunkOutputBase` + trailing band; composed loop mints use in-band `valueChunkOutputs` (COND path) instead of late suffix append
- [ ] **1a** Item 3 multi-row argument framing
- [ ] **1b** Re-verify item 1 caller identity
- [ ] **1c** Item 5 multi-producer result dependencies
- [ ] **1d** Item 6 multiple computed writes / ordered claims
- [ ] **2** Path/effect: selected events, non-bool selection, both-arms chunkable, maskable break/continue, bounded transfers-beside-journal
- [ ] **3** Bounded constructed-key domain settle
- [ ] **4** Mixed dynamic+collection spans; relocatable trailing bands
- [ ] **5** Aggregate / recursive mapping admits+settle
- [ ] **6** Broader deploy + write-bearing lifecycle subset
- [ ] **7** Bounded sig + typed assembly expansions
- [ ] Docs/inventory/fence/`message-bus-kernel.md` updated per phase; `yarn build`; GREP_CLEAN

## Already green (regression anchors)

- Family-1: `KernelHeteroLoopStreamsCompose`, `KernelSameIterSelectionCompose`, `KernelMultiStreamEventCompose`
- Chunkable: `KernelMultiContinuationResourceCompose`, `KernelConditionalMultiContinuationCompose`, `KernelValueChunkLane`
- Lifecycle subset in `REEVAL_STILL_OPEN.md` (resource-free / read-bearing split-merge-selfdestruct, V4 KTS beside lifecycle)

## Budget guidance

- **Short:** Phase 0 + Phase 1 only → “beta inventory complete + family-1 compose long chunks”
- **Medium:** through Phase 2 → path/effect schedules unlocked
- **Full:** Phases 0–7 → kernel-complete under permanent fences above
