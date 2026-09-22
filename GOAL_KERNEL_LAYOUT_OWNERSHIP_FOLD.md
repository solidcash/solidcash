# Goal — kernel layout + ownership + multi-row fold

**Register with:** `/goal --budget 48 $(cat /tmp/goal-kernel-layout-ownership-fold.txt)`

**Implement WT:** `.worktrees/kernel-comprehensive-fixtures` (`grok/kernel-comprehensive-fixtures`)  
**Gate A verify WT:** `.worktrees/kernel-beta-candidate` — **other agent only** (no edits / no eacc grind from implementer)  
**Maps:** this file; session `plan.md`; `HANDOFF_ACCIDENTAL_BETA_EDITS.md`; `/tmp/goal-kernel-layout-ownership-fold.txt`

## Why

49/66 is a historical high-water mark, not a contiguous green on the current candidate. Highest-priority pair: canonical layout planner + multi-row resource folding. Stabilize layout/ownership before advancing past title 49.

## Gates

- [x] **A′** Fixtures: single `resolveTransactionLayout` / `resolveParticipantAbsoluteWitnesses` + `applyParticipantAbsoluteWitnesses`; unique ownership; five-field layout invariants; focused units green. Compose unlocker match: `KernelComposeLayoutWitnesses` (valueChunk UPDATE + PredOut INSERT physical absolute); dyn: `KernelLocalProbeWitnessRebase`; apply unit: `ComposeLayoutAuthority`.
- [ ] **A** Beta agent: `take job$` + `take job take job` green; no 203-vs-222 / 163-vs-161 class drift — handoff at `{SCRATCH}/kext-beta-verify-handoff.md`
- [x] **B** `KernelMultiRowChunkableFoldCompose` settle; fold authority (not `encodeLeadingRouteArrayPushes`); residual negative kept (solidc Dual writeBoth)
- [x] **C** Symbolic claims published; layout failures always carry participant/resource/expected/actual/invariantId — resolver + `L3_LAYOUT_INVARIANT` + units landed

## Fences

No beta edits / no marketplace grind from this agent. Foreign delegate (#15), true sig circularity, Marketplace product greening / `requiredKernelProofs`. Full path-effect / ExecutionContext / fixpoint only pay-as-you-go.

## Phases

- [x] 0 Baseline + MDV1@223 diagnosis (pad 163 vs entry 161; missing absolute dyn base)
- [x] 1 Ownership MVP + attribution
- [x] 1b Dyn-base injection + absolute-base codegen on fixtures; `KernelDynamicChunkInputBase` 2/2
- [x] 2 Layout resolver cutover → Gate A′
- [ ] 3 Alias normalize (as needed for A′/B)
- [x] 4 Multi-row fold → Gate B — fold authority + resourceFoldPlans + KernelMultiRowChunkableFoldCompose e2e
- [ ] 5 Path-effect IR (thin; fold activations)
- [ ] 6 Constraint/fixpoint (pay-as-you-go)
- [ ] 7 Typed ExecutionContext (pay-as-you-go)
