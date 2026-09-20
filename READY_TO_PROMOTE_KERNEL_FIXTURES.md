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


## Leftovers landed this stream (descriptive names only in fixtures)
- `KernelRefusedBatchSlot` — repeated selector drop vs refused-handler compose fail-closed (`KERNEL_OPAQUE_EFFECT`)
- `KernelProxyEventFunderCompose` — deployProxy Ping via dispatch `.send()` **and** `messageBus.compose`+`executionArtifact` settle none-cap event NFT on proxy category (event-pad `tx.origin` fix)
- `KernelForeignTokenTransferCompose` — Caller→Token FT transfer under compose; remainder + tamper fail-closed
- `KernelProxyNestedCallsiteCompose` — deployProxy scalar write + Probe.touch via compose+`executionArtifact` settle
- `KernelProxyUpgradeThenCompose` — published `upgrades.upgradeProxy` param-mode V1→V2 settle (same address); baked `SolidCashProxy` refuses upgradeProxy; baked compose executor retarget fails closed (`Compiler-authenticated delegate forwarding target is not materialized`)
- `KernelProxyForeignRmwEventCompose` — deployProxy poke→Bank.credit+Ping via `withExternalCall` **and** `messageBus.compose`+`executionArtifact` settle; fan-out Caller×Bank×Ping under compose settles
- `KernelDualRuntimeKeccakCompose` — Ping emit + keccak settles; single-key mapping RMW + keccak settles; **fixed dual-key add+remove under compose settles**; DualRuntimeSet-width arrays+keccak inherent density fence
- `KernelProxyEventOnlyCompose` — event-only Solidity deployProxy (dataNftCount 0): dispatch `.send()` Ping settles; compose+`executionArtifact`×Probe deepened MessageBusVerifier fence (see Still open)
- `KernelDirectSendExternalEntryOrder` — plain `.send()` mapping RMW / dual-key add+remove + Probe: entry NFTs stay immediately after master/data; callee deferred past the caller's block

## Product gaps closed this stream
- **Mapping RMW × keccak:** graph-owned keccak now sets `deferUnresolved` like ecrecover (`StatefulContract` `_createBuilder`); single-key `bal[k]+=v` + keccak under compose settles (`KernelDualRuntimeKeccakCompose`).
- **Fixed dual-key add+remove under compose:** `singleTargetRowBatch` incorrectly treated distinct-key multi-slot writes as alias-arm inserts (P′/NEW collision). Gate on `uniqueBatchTargets.size === 1` so distinct-key add+remove keeps the trailing-predecessor model (`KernelDualRuntimeKeccakCompose`).
- **`upgrades.upgradeProxy`:** published for **param-mode** proxies (re-wrap same state holder + append-only layout check); baked `SolidCashProxy` refuses with a clear pin/migration error (`KernelProxyUpgradeThenCompose`).
- **DualRuntimeSet-width × keccak density:** closed as an **inherent** BCH-2026 density fence (`trailingCapacity≈130`); not relaxed. Closable dual-runtime×sidecar proof is single-key mapping×keccak above.
- **Event-only default proxy:** regenerated `SolidCashProxy` without hardcoded `__proxySlot` dataNft at master+1 (collided with event pads when impl `dataNftCount=0`). Dispatch settle in `KernelProxyEventOnlyCompose`.
- **Plain `.send()` external-call entry ordering:** dense input placement no longer requires auto-funders when external groups exist; callees defer past the caller's entry slots (`StatefulTransactionBuilder`). Settles in `KernelDirectSendExternalEntryOrder`.

## Product gap closed: proxy×event and proxy×foreign×event compose
- **Root cause:** atomic `omitLocalFeeTail` layout pads used a bare P2PKH as the first structural funder so probes could establish `tx.origin`. With output-only event slots that pad sits before the canonical fee tail and **becomes** authenticated `tx.origin`, so MessageBusVerifier `require(rowSubject == tx.origin)` OP_VERIFYs.
- **Fix:** all structural pads under `omitLocalFeeTail` use the OP_TRUE dummy covenant; only the composition fee tail is bare P2PKH (`StatefulContract` funder install).
- **Settles:**
  - `KernelProxyEventFunderCompose` compose+`executionArtifact` Ping
  - `KernelProxyForeignRmwEventCompose` deployProxy poke→Bank.credit+Ping under compose (bal=15 + count + event NFT)

## Still open / fence
- DualRuntimeSet-width density wall (inherent)
- Event-only Solidity proxy compose+`executionArtifact`×Probe (`KernelProxyEventOnlyCompose`): **honest fence, not a missing-event bug**. Dispatch settles; compose places none-cap event NFT (effect `57`) at offset 1 and Acc/`__forward` accept, then `MessageBusVerifier_00000000` OP_VERIFYs via NUMEQUAL empty vs `01` (cardinality 0==1). Contrast settling `KernelProxyEventFunderCompose`: dataNft @1 shifts events to @2..9 (blockSize 12 vs 11); funder manifest has kind1 mode0 dataNft + kind1 mode4 Acc-executor + kind2 @2, while event-only has only kind1 mode4 Acc-executor @9 + kind2 @1. `tx.origin`/suppliedCallers is the fee-tail P2PKH. Residual product gap is verifier cardinality under zero-dataNft event-at-1 geometry — state-holding Coordinators remain the compose settle proofs.

## Fence
- No `marketplace.test.ts` / `vitest.marketplace.config.ts` in this stream
- No Marketplace / Unicrow / job vocabulary in fixtures
- Do not edit `scripts/kernel-beta-manifest.json` `requiredKernelProofs` until review
- Fixture source comments must not use plan-wave shorthand (I/J/K/L/M numbered cells); keep those labels in this tracking doc only
