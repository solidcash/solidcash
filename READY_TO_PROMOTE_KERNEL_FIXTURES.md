# Ready-to-promote Kernel* proofs — do NOT widen production manifest yet

Branch: `grok/kernel-comprehensive-fixtures`  
Worktree: `.worktrees/kernel-comprehensive-fixtures`

## Wave A–F (baseline)
- `KernelTwoHopReturnProbe`
- `KernelSortedInsertPredOutCompose`
- `KernelLocalProbeWitnessRebase`
- `KernelComputeSidecarNonEmpty`
- `KernelFunderGapTwoParticipant`
- Units: `ComputedOutputRepair` lengthening/cycle; `DynamicChunkInputBase` slide rebase

## Active sprint (this goal)
- **M1a** `KernelProxyForeignRmwEventCompose` — fan-out settle with Bank PredOut unlocker, funded Ping, bal=15 readback; full deployProxy×foreign×event characterized fail-closed
- **K5/K6** `KernelForeignVmapRmwCompose` — foreign `+=` UPDATE + INSERT PredOut under compose
- **M2a** `KernelThreeHopReturnCompose` — Leaf→Mid→Root non-empty returns
- **L5** `KernelStaticcallViewCompose` — void `.staticcall()` peek + typed view compose + SDK `.staticCall()`
- **M3a** `KernelDensityBoundedCompose` — DualRuntimeSet-width compose hits `operation cost density limit`; small batch settles
- **K14** `KernelLocalKeyVmapRmwCompose` — local-key `+=` under KERNEL

## Fence
- No `marketplace.test.ts` / `vitest.marketplace.config.ts` in this stream
- No Marketplace / Unicrow / job vocabulary in fixtures
- Do not edit `scripts/kernel-beta-manifest.json` `requiredKernelProofs` until review
