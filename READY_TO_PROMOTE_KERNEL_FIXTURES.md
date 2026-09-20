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
- **I8** `KernelLowLevelCallCompose` — `address.call(payload)` / `__raw__` under kernel compose + unlocker/VM

## Sidecar interaction matrix (ecrecover × keccak)
- **K1a** `KernelForeignKeccakSidecarCompose` — Caller keccak256 → Sink.accept; branded sidecar recreate + tamper/omit/duplicate
- **K1b** `KernelForeignEcrecoverSidecarCompose` — Caller→Sink.ecrecoverPubKey A/B pair recreate + wrong-commitment fail-closed
- **K2a** `KernelSelfKeccakSidecarCompose` — Acc.reveal under compose (Probe co-spend); branded Acc sidecar
- **K2b** `KernelSelfEcrecoverSidecarCompose` — Acc.recover under compose; A/B on Acc category
- **K3a** `KernelProxyKeccakSidecarCompose` — deployProxy `__forward` reveal settle + compose+`executionArtifact`×keccak×Probe settle
- **K3b** `KernelProxyEcrecoverSidecarCompose` — deployProxy `__forward` recover settle + compose+`executionArtifact`×ecrecover×Probe settle with non-empty A/B recreate
- **K4a** `KernelProxyForeignKeccakCompose` — deployProxy poke settle (keccak→foreign Sink) + compose+`executionArtifact`×keccak×Sink settle
- **K4b** `KernelProxyForeignEcrecoverCompose` — deployProxy poke settle (ecrecoverPubKey→foreign Sink via `withExternalCall`) + compose+`executionArtifact`×ecrecover×Sink settle with non-empty A/B recreate + Sink.seen
- **K5** `KernelEcrecoverEvmKeccakSidecarCompose` — compose settle: A/B + keccak sidecar recreate + wrong-keccak fail-closed + Acc.counter readback (product-default cells stay PubKey)
- Marketplace touchpoints (docs only): ECDSA.recover + keccak digest prep under proxy/facade → K1b then K4b; facade hash→foreign → K3a/K4a
- **SDK fixes landed this stream:** (1) `__forward` promotes impl ABI keccak/ecrecover/`ecrecoverEvmFlags` so compute co-spends are not empty; (2) message-bus `ecrecoverEvm` handlers keep top-relative owner pick (bottom ordinal mis-read bytes32 as input index); (3) ecrecover route layouts reserve one A/B pair per syntactic call (not `maximumRows×2`) and do not treat kernel-row `ecrecoverLoopReads` as a 64-slot trailing trigger — shrinks Acc from blockSize 82→4 so proxy compose MessageBusVerifier settles


## Fence
- No `marketplace.test.ts` / `vitest.marketplace.config.ts` in this stream
- No Marketplace / Unicrow / job vocabulary in fixtures
- Do not edit `scripts/kernel-beta-manifest.json` `requiredKernelProofs` until review
