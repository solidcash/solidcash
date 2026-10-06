# W6 status at `750514246`

Inventory of the kernel failures left after the fixes below. Each entry names the file, the failing title, the
class, and the evidence. "Cleared" rows are gone from the suite.

## Cleared in this round

| file | titles | fix |
|---|---|---|
| `KernelDefaultEmissionBandCompose` | 1 | `fix(solidcash)` constructor-arg resolution + published delegate-forwarding assertion |
| `KernelLateTransitiveConditionalGraphCompose` | 3 | same fix; the two stale `OP_INVOKE` assertions became the published forwarding check |
| `KernelStructAddressTargetDiscovery` | 2 | same fix |
| `KernelNestedReturningGraphArgCompose` | 2 | `fix(solidcash)` canonical byte/hex comparison for a hand-prepared edge, result positions exempt |
| `KernelNestedReturningStructAddressCompose` | 2 | same fix |
| `KernelDelegateDualRuntimeSet` | 1 | re-pinned `blockLayout` 389/259 -> 134/4 (per-row return lanes no longer reserved) |
| `KernelNestedReturnSlotCoordinates` | 1 | re-pinned the two-slot block layout |
| `KernelTwoHopReturnProbe` | 1 | re-pinned the read handler's key-pool alternative lane (8 slots) |
| `KernelLateTransitiveSparseLoopCompose` | 1 of 2 | the refusal message now reads "published target ... does not match a connected ... callee" |

## Remaining, by class

### Stale production message, assertion updated, deeper defect behind it

- `KernelLateTransitiveSparseLoopCompose` — "preserves zero, sparse, and full source order for a direct
  inferred-delegate loop" and the tail of "requires target resources only for rows that are actually reached".
  A reached direct inferred-delegate sparse row builds a transaction with **no callee participant**: the
  planner omits it silently instead of co-spending or refusing. Same shape in both titles.

  What was established (each with an env-gated log, run on the failing title and, where noted, on a passing
  sibling):

  - The compiler publishes the callsite completely. `DirectSparseRelay.relay` carries
    `externalCalls[0] = { callsiteId: 0, interfaceName: 'IDirectSparseSink', functionName: 'add',
    occurrence: 'loop', addressParam: 'sink', addressSource: { kind: 'forward', paramIndex: 0 },
    argSources: [{ kind: 'arrayElement', paramIndex: 1, counterName: 'i', indexValue: 0, indexStepValue: 1 }],
    condition: values[i] != 0, iterationDomain: { counterName: 'i', ... , maximumIterations: 65535 },
    maximumOccurrences: 65535, occurrenceBoundSource: 'guard' }`. Nothing is missing from the metadata.
  - The build is a proxy forward, not a plain route call. `upgrades.deployProxy` returns a
    `wrapDispatch` Proxy (`upgrades.ts`), so `proxy.relay(...)` becomes `forward('relay', ...)` and then
    `builder.withDelegatecall(implSc, 'relay', ...)`: the implementation body runs as a delegatecall inside the
    proxy's composition.
  - The delegate unlocker fixer does run, and that is where the callee disappears. With
    `SOLIDC_DEBUG_ROUTE_CONCISE=1` the run logs `delegate-function-selection` and `delegate-encoded-args` from
    `sc-fix-create-builder-delegate-unlockers.ts`, while `delegateExternalGroupIndices.get(groupLocalIdx)` is
    empty (`nestedGroups = []` at that file's line 273). Every `__internal__extcallMasterIdx*` witness then takes
    the documented no-group branch (`call.occurrence !== 'once'` -> `-1`), so the callee is never co-spent.
  - Four candidate sites were instrumented and are NOT entered on this title: the nested-compose orchestration
    (`nested-compose-start`, `nested-callsite-start`), the graph occurrence callback in
    `compose-plan-graph.ts` (the typed-edge count source), the direct-group precompute log
    (`SOLIDC_DEBUG_RETURN`), and the late-transitive frame loop in
    `sc-expand-create-builder-late-transitive.ts` (neither the `late-target` nor the `late-guard` probe fired).
    Two of those negatives are weak: the passing sibling also logs zero for `nested-compose-start` and for
    `atomic-node-push`, so they do not by themselves localize the omission.
  - The late-transitive path IS live for a co-spent participant: the sibling title "requires target resources
    only for rows that are actually reached" logs 8 `atomic-node-push` entries, all for the coordinator's `run`
    callsite, where the sink is a **constructor argument**. The failing shape differs in two ways at once: the
    callsite lives in the **delegated implementation body** and its target arrives as a **forwarded call
    argument**. The next place to look is therefore whichever code collects a delegate group's callsites into
    `delegateExternalGroupIndices` before the late-transitive expansion runs
    (`StatefulContract.ts` around the `delegateExternalGroupIndices.set(...)` at the end of the delegate
    branch), since that map is what the fixer consults.

  The test is not at fault: it drives the shipped path end to end (`upgrades.deployProxy`, the dispatch proxy,
  `call.build()`), asserts the participant list before the VM leg, and the same shape settles when the target is
  a constructor argument instead of a forwarded one.

### Production defects

- `KernelDualRuntimeKeccakCompose` — "settles fixed dual-key add+remove under compose". Compiling the test's
  `Acc` source with its options yields `artifact.messageBus === undefined` while the ABI still carries
  `__internal__vmapBatch*` params, so `compose-participant-helpers.participantOf` classifies it as a direct
  participant and refuses with "direct participant 'Acc' lacks V5 authority". The compiler marks the handler
  batch-shaped but emits no route; `compiler.ts` assigns `artifact.messageBus` only when some handler has
  `messageBusRoute`.
- `MessageBusDelegateClassesE3` — both titles. The not-taken conditional-delegate spend that requests a forged
  commitment now refuses at input 0 instead of settling on the preserved value; the sibling not-taken spend
  that requests nothing still settles.
- `KernelPhysicalCallerWithScidCompose` — OP_VERIFY at input 4 in `CallerCheck.touch` line 5
  (`require(msg.sender == expected)`): the proxy's `address(this)` does not satisfy `msg.sender` for the
  nested-caller-beside-SCID shape.
- `KernelSegmentedHandlerReturnWidths` — OP_VERIFY at batch input 0 for a batch mixing a void, a one-value and
  a two-value handler over one mapping. No `requireStatement` metadata is published, so the failing
  instruction is unidentified.
- `KernelChunkedMappingStructCompose` — "graph-produced oversized scalar struct insert" throws
  `L3_LAYOUT_INVARIANT` / `pred-out-unresolved`: an active `__internal__vmapBatchPredOut_0` slot has no
  `predOuts` witness. The second title fails an OP_VERIFY in `Store` at ip 2274.

### Known capacity defects

- `KernelLegacyObservableParity` — "preserves payload event effects across fresh route compiles". The kernel
  event route needs 257 inputs and its input 0 exceeds the BCH-2026 operation-cost density limit
  (1_932_000 allowed, 1_932_080 reached). Named as an outstanding compiler task in `3854028e8`.

### Upgrade route

- `KernelUpgradeCompose` (4) and `KernelUpgradeSignature` (3): see `W6_UPGRADE_ROUTE_FINDING.md`. The upgrade
  route's `require(countMutableInputsWithMyCategory == 1)` cannot be satisfied by a composition that also
  co-spends the detached verifier NFT under the same category.

### Harness funding

- `KernelMultiContinuationResourceCompose` — both failing titles build a 43.5 KB transaction through
  `call.send()` with the provider's automatic funding and are refused by the relay-fee check (fee 33353,
  required 43528). `vmAccepts(await call.build())` passes, so the route itself is accepted; the sibling titles
  in the same file that pass supply `createBareP2pkhFeeFunder(provider, 500_000n)` explicitly.

### Pre-existing, not kernel-specific

- `AtomicMessageBusCompose` — 3 titles, recorded in `W6_BASELINE.md` as pre-existing kernel rows; they fail in
  the deferred-compute materialization path ("recipe mode forbids deferred-compute VM discovery as planner
  authority; unresolved participant(s) 1 (keccak 0/0, ecrecover 1/1)").
