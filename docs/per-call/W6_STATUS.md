# W6 status at `89a09a273`

Inventory of the kernel failures left after the fixes below. Each entry names the file, the failing title, the
class, and the evidence. "Cleared" rows are gone from the suite.

## Cleared in this round

| file | titles | fix |
|---|---|---|
| `KernelDefaultEmissionBandCompose` | 1 | constructor-arg resolution; forwarding assertion |
| `KernelLateTransitiveConditionalGraphCompose` | 3 | same; stale `OP_INVOKE` assertions replaced |
| `KernelStructAddressTargetDiscovery` | 2 | same |
| `KernelNestedReturningGraphArgCompose` | 2 | byte/hex argument comparison for a prepared edge |
| `KernelNestedReturningStructAddressCompose` | 2 | same |
| `KernelDelegateDualRuntimeSet` | 1 | `blockLayout` re-pinned 389/259 -> 134/4 |
| `KernelNestedReturnSlotCoordinates` | 1 | two-slot block layout re-pinned |
| `KernelTwoHopReturnProbe` | 1 | key-pool alternative lane re-pinned (8 slots) |
| `KernelLateTransitiveSparseLoopCompose` | 1 of 2 | refusal message re-pinned; see below for the second |

## Remaining, by class

### Fixed: the silent omission of a reached direct inferred-delegate callee

`sc-materialize-create-builder-low-level-stateful-call.ts` filtered a guarded loop callsite by evaluating its
condition once, at occurrence zero. A sparse loop whose first row is skipped
(`values = [0, 2, 3]`, `if (values[i] != 0) Sink(sink).add(values[i])`) therefore lost the callsite entirely:
no callee input was co-spent and every `__internal__extcallMasterIdx*` witness resolved to -1, so the composed
transaction omitted the callee instead of co-spending or refusing it. The filter now asks the shipped occurrence
planner (`_planExternalCallOccurrences`), which walks the compiler's iteration domain and evaluates the guard per
occurrence, and retains the call when the planner cannot answer.

Evidence: `KernelLateTransitiveSparseLoopCompose` "preserves zero, sparse, and full source order for a direct
inferred-delegate loop" passes the three kernel `run` legs (participant counts 0/1/1, `vmAccepts`, `send`,
totals 0/23/23456), the second parity leg and the unconnected-target refusal, and now fails at line 292 in the
**legacy** leg with a different error. That title is still red.

### Legacy path: result-dependent loop without a compiler iteration domain

`KernelLateTransitiveSparseLoopCompose` — the tail of the same title, and the tail of "requires target resources
only for rows that are actually reached". The legacy leg (`messageBusKernel: false`,
`messageBusGraphContext: false`, convention `legacy-unroll`) throws

    Error: messageBus: result-dependent loop has no compiler iteration domain

from `compose-result-topology.ts:435` (`rebuildCallTopology`), reached through
`prepareTypedCallbackGraph` (`sc-send-without-logical-nonce.ts`). The missing-master leg of the second title
fails differently: the build resolves where the test expects a refusal.

### The delegate group map (context for the entry above)

The omission surfaced in `sc-fix-create-builder-delegate-unlockers.ts`, where `nestedGroups` is empty, so
`__internal__extcallMasterIdx*` takes the documented no-group branch and returns -1 for a non-`once` callsite.
`delegateExternalGroupIndices` is populated from the delegate branch of `StatefulContract._createBuilder`
(`delegateExternalGroupIndices.set(delegateGroupIndex, nestedIndices)`), which is fed by
`materializeCreateBuilderLowLevelStatefulCallImpl`'s `nestedExternalCalls` — the list the fix above corrects.

### The direct inferred-delegate shape

The build is a proxy forward, not a plain route call: `upgrades.deployProxy` returns a `wrapDispatch` Proxy
(`upgrades.ts`), so `proxy.relay(...)` becomes `forward('relay', ...)` and then
`builder.withDelegatecall(implSc, 'relay', ...)`. The compiler publishes the callsite completely
(`occurrence: 'loop'`, `addressParam: 'sink'`, `addressSource: { kind: 'forward', paramIndex: 0 }`,
`argSources: [{ kind: 'arrayElement', paramIndex: 1, counterName: 'i', indexValue: 0, indexStepValue: 1 }]`,
`condition: values[i] != 0`, `iterationDomain: { counterName: 'i', ... , maximumIterations: 65535 }`,
`maximumOccurrences: 65535`, `occurrenceBoundSource: 'guard'`). Nothing is missing from the metadata, and the
test is not at fault: it drives the shipped path end to end (`upgrades.deployProxy`, the dispatch proxy,
`call.build()`), asserting the participant list before the VM leg.

With `SOLIDC_DEBUG_ROUTE_CONCISE=1` the failing run logs `delegate-function-selection` and
`delegate-encoded-args` from `sc-fix-create-builder-delegate-unlockers.ts` while
`delegateExternalGroupIndices.get(groupLocalIdx)` is empty (`nestedGroups = []`, that file's line 273) — the
symptom, not the cause, of the filter fixed above. The late-transitive path is live for a co-spent participant:
the sibling title "requires target resources only for rows that are actually reached" logs 8 `atomic-node-push`
entries, all for the coordinator's `run` callsite, where the sink arrives as a **constructor argument** rather
than a forwarded one.

### Production defects (unchanged)

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
