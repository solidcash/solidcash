# Ready-to-promote (Wave G–H / Tier-2) — do NOT widen production manifest yet

Waves A–F fixtures landed green on `grok/kernel-comprehensive-fixtures`. Production `scripts/kernel-beta-manifest.json` `requiredKernelProofs` stays unchanged until review.

## Wave A–F proof IDs (candidates after review)
- `kernel-two-hop-return-probe` — `packages/solidcash/test/journal-message-bus/e2e/KernelTwoHopReturnProbe.test.ts`
- `kernel-sorted-insert-predout-compose` — `packages/solidcash/test/journal-message-bus/e2e/KernelSortedInsertPredOutCompose.test.ts`
- `kernel-local-probe-witness-rebase` — `packages/solidcash/test/journal-message-bus/e2e/KernelLocalProbeWitnessRebase.test.ts`
- `kernel-funder-gap-two-participant` — `packages/solidcash/test/journal-message-bus/e2e/KernelFunderGapTwoParticipant.test.ts`
- `kernel-compute-sidecar-non-empty` — `packages/solidcash/test/journal-message-bus/e2e/KernelComputeSidecarNonEmpty.test.ts`
- Strengthened units: `ComputedOutputRepair` lengthening/cycle; `DynamicChunkInputBase` slide rebase; PredOut displace-after-master (existing AssignPhysicalReturnIndices)

## Wave H / Tier-2A candidates (document only)
- `PostTestConstructedKeyDomain`
- `NonzeroPostTestConstructedKeyDomain`
- `KernelDeadContinueDomain`

## Wave H / Tier-2F candidates (document only)
- `MessageBusDelegateClassesE3`
- `ReviewA13DelegateE3`

## Wave G / H3 / H4 (opportunistic, not gating)
- G1: refused batch grouping (compiler/journal named proof)
- H3: dynamic view after foreign write → unresolved key fail closed
- H4: oversized fixed ABI word / fat bytes32 framing SDK validation error

## Fence
- No `marketplace.test.ts` / `vitest.marketplace.config.ts` runs in this stream
- Ladder agent owns marketplace suite green on `kernel-beta-candidate`
