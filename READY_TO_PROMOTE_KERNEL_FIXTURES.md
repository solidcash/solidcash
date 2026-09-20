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
- `KernelProxyEventOnlyCompose` — event-only Solidity deployProxy: compiler injects `__messageBusHold` dataNft + state-writing `initialize`; dispatch `.send()` **and** compose+`executionArtifact`×Probe settle Ping on proxy category
- `KernelProxyUnusedStateEventCompose` — unused scalar + emit-only (no writing `initialize`) under deployProxy compose×Probe **settles** after MessageBusVerifier `resourceVerificationMode` includes contracts that own state/collections
- `KernelDirectSendExternalEntryOrder` — plain `.send()` mapping RMW / dual-key add+remove + Probe: entry NFTs stay immediately after master/data; callee deferred past the caller's block

## Topology × resource matrix (core cells)

Legend: **S** = settle fixture · **F** = honest fence · **—** = deferred / thin coverage elsewhere · DualRuntimeSet-width density remains **inherent F** (not relaxed).

| Topology \\ Resource | vmaps | chunks | strings | structs | chunked structs | events | lifecycle |
|---|---|---|---|---|---|---|---|
| self | S `KernelSelfVmapRmwCompose` | S `KernelMixedBytesMappingJournal` | S `KernelLoopCompose` (note) | landing / adjacent foreign struct | S `KernelPooledDynamicArrayWriter` | S `KernelDualRuntimeKeccakCompose` Ping | S upgrade `KernelUpgradeCompose`; F split/merge skip; F selfdestruct |
| proxy-self | S `KernelProxyOwnedVmapRmwCompose` | landing | landing | landing | — | S EventFunder / EventOnly / UnusedStateEvent | S/F `KernelProxyUpgradeThenCompose` |
| self→foreign | S `KernelForeignVmapRmwCompose` | — | thin return/string | S `KernelWholeStructStateGetterCompose` | S `KernelRepeatedPooledAppendParity` | S fan-out / funder-gap | S `KernelTypedYulCreateCompose` |
| self→proxy | landing `KernelSelfToProxyVmapRmwCompose` | — | — | — | — | — | — |
| proxy→foreign | S `KernelProxyForeignVmapRmwCompose` | F adjacent `KernelDelegateInactiveDynamicWrite` | — | — | — | S `KernelProxyForeignRmwEventCompose` | F density `KernelDensityBoundedCompose` |
| proxy→foreign-proxy | landing `KernelProxyToProxyVmapRmwCompose` | — | — | — | — | — | — |

Peers already settled: fan-in/out, nested callsite, sidecar self/foreign/proxy/proxy×foreign, DirectSend entry order. DualRuntimeSet-width × keccak = inherent density fence in `KernelDualRuntimeKeccakCompose`.

## Product gaps closed this stream
- **Mapping RMW × keccak:** graph-owned keccak now sets `deferUnresolved` like ecrecover (`StatefulContract` `_createBuilder`); single-key `bal[k]+=v` + keccak under compose settles (`KernelDualRuntimeKeccakCompose`).
- **Fixed dual-key add+remove under compose:** `singleTargetRowBatch` incorrectly treated distinct-key multi-slot writes as alias-arm inserts (P′/NEW collision). Gate on `uniqueBatchTargets.size === 1` so distinct-key add+remove keeps the trailing-predecessor model (`KernelDualRuntimeKeccakCompose`).
- **`upgrades.upgradeProxy`:** published for **param-mode** proxies (re-wrap same state holder + append-only layout check); baked `SolidCashProxy` refuses with a clear pin/migration error (`KernelProxyUpgradeThenCompose`).
- **DualRuntimeSet-width × keccak density:** closed as an **inherent** BCH-2026 density fence (`trailingCapacity≈130`); not relaxed. Closable dual-runtime×sidecar proof is single-key mapping×keccak above.
- **Event-only default proxy:** regenerated `SolidCashProxy` without hardcoded `__proxySlot` dataNft at master+1 (collided with event pads when impl `dataNftCount=0`). Dispatch settle in `KernelProxyEventOnlyCompose`.
- **Plain `.send()` external-call entry ordering:** dense input placement no longer requires auto-funders when external groups exist; callees defer past the caller's entry slots (`StatefulTransactionBuilder`). Settles in `KernelDirectSendExternalEntryOrder`.
- **Event-only compose MessageBusVerifier:** before route synthesis, inject public `__messageBusHold` (dataNft@1 / events@2+) and eligible `initialize() { this.__messageBusHold = 0; }` when a message-bus contract has events but no state/collections. Emit-only handlers alone fail verifier census; a state-writing initialize sibling (even unused under `initializer: false`) matches write+emit geometry. SCID v1 commitments excluded from physical event census. Settles in `KernelProxyEventOnlyCompose`.
- **Unused-state emit-only compose MessageBusVerifier:** `resourceVerificationMode` now includes contracts that own state variables or collections, not only handlers whose footprint reads/writes. Physical mutable dataNft endpoints were always counted; without resource mode, SDK kind1 mode0 preservation rows were ignored (`activeResourceEndpoints` stayed 0 → 0==2 OP_VERIFY). Settles in `KernelProxyUnusedStateEventCompose`.

## Product gap closed: proxy×event and proxy×foreign×event compose
- **Root cause:** atomic `omitLocalFeeTail` layout pads used a bare P2PKH as the first structural funder so probes could establish `tx.origin`. With output-only event slots that pad sits before the canonical fee tail and **becomes** authenticated `tx.origin`, so MessageBusVerifier `require(rowSubject == tx.origin)` OP_VERIFYs.
- **Fix:** all structural pads under `omitLocalFeeTail` use the OP_TRUE dummy covenant; only the composition fee tail is bare P2PKH (`StatefulContract` funder install).
- **Settles:**
  - `KernelProxyEventFunderCompose` compose+`executionArtifact` Ping
  - `KernelProxyForeignRmwEventCompose` deployProxy poke→Bank.credit+Ping under compose (bal=15 + count + event NFT)

## Still open / fence
- DualRuntimeSet-width density wall (inherent)
- Matrix landing cells still in flight / thin: self→proxy, proxy→foreign-proxy, proxy-self chunks/strings/structs, self fixed-struct write, self→foreign bytes RMW, proxy→foreign positive chunk write (see matrix table)

## Fence
- No `marketplace.test.ts` / `vitest.marketplace.config.ts` in this stream
- No Marketplace / Unicrow / job vocabulary in fixtures
- Do not edit `scripts/kernel-beta-manifest.json` `requiredKernelProofs` until review
- Fixture source comments must not use plan-wave shorthand (I/J/K/L/M numbered cells); keep those labels in this tracking doc only
