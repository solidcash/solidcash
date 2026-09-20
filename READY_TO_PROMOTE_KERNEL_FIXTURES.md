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

## Follow-up settle (goal stream)
- **3a** `KernelProxyForeignVmapRmwCompose` — `messageBus.compose` + `executionArtifact` + `_registerResolvedExternal('IBank')`; unlocker PredOut + VM + Bank bal 10→15 (event omitted; M1a three-axis still characterization)
- **3b** `KernelReturningStaticcallCompose` — value-returning foreign view under compose + SDK `.staticCall()`
- **self RMW** `KernelSelfVmapRmwCompose` — self mapping UPDATE + INSERT-on-absent `+=`
- **proxy-owned RMW** `KernelProxyOwnedVmapRmwCompose` — Acc mapping UPDATE through `__forward`; unlocker+VM + bal readback
- **nested foreign** `KernelNestedForeignVmapCompose` — Caller→Bank nested allowance-class write under compose
- **J1** `KernelProxyViewReturnCompose` — grafted `stored()` view sugar + delegate-eligible `bump().emitReturn()` non-OP_RETURN return NFT (pure view getters remain non-delegate)

## Wave I/J expansion (post settle-list)
- **I7** `KernelSortedUpdatePredOutCompose` — UPDATE PredOut inactive; rewritten entry content-matches slot/next/value
- **I2** `KernelFanOutTwoCalleeCompose` — Caller.fire co-spends Emitter.ping + Registry.set
- **J3** `KernelProxySortedInsertPredOutCompose` — deployProxy INSERT: P′ rewrite + NEW on proxy-owned outputs (compose×proxy×foreign×event still OP_VERIFY)
- **I3** `KernelFanInSharedCalleeCompose` — two callers sequentially poke shared Registry; entries consistent
- **I4** `KernelSiblingOutStateCompose` — Mid projects Leaf.outState after Leaf.write
- **J4** `KernelProxyBytecodePinRefuseForeign` — honest pin settles; foreign co-spend refused at proxy input 0

## Fence
- No `marketplace.test.ts` / `vitest.marketplace.config.ts` in this stream
- No Marketplace / Unicrow / job vocabulary in fixtures
- Do not edit `scripts/kernel-beta-manifest.json` `requiredKernelProofs` until review
