# W6 status at `24ff05101`

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
| `KernelLateTransitiveSparseLoopCompose` | 3 | loop guard over occurrences; legacy cardinality; master-UTXO refusal |
| `KernelDualRuntimeKeccakCompose` | 4 | kernel admission accepts a row-argument key beside a graph tail |

## Remaining, by class

### Fixed: `KernelLateTransitiveSparseLoopCompose` (3 titles, file green)

Three defects in the same shape, each fixed on the shipped path:

1. **The silent omission.** `sc-materialize-create-builder-low-level-stateful-call.ts` filtered a guarded loop
   callsite by evaluating its condition once, at occurrence zero. A sparse loop whose first row is skipped
   (`values = [0, 2, 3]`, `if (values[i] != 0) Sink(sink).add(values[i])`) therefore lost the callsite entirely:
   no callee input was co-spent and every `__internal__extcallMasterIdx*` witness resolved to -1, so the composed
   transaction omitted the callee instead of co-spending or refusing it. The filter now asks the shipped
   occurrence planner (`_planExternalCallOccurrences`), which walks the compiler's iteration domain and evaluates
   the guard per occurrence, and retains the call when the planner cannot answer. Evidence: the three kernel
   `run` legs build, accept at the VM, send, and land totals 0/23/23456.
2. **The legacy leg.** The legacy convention unrolls a loop and publishes no `iterationDomain`, so
   `compose-result-topology` threw `result-dependent loop has no compiler iteration domain` on send. It now
   enumerates candidate occurrences from the published array cardinality
   (`externalCallReachedOccurrenceIndices`) and lets the per-occurrence guard decide, keeping the fail-closed
   refusal for an unprovable cardinality, a lone nested domain, and a candidate set above the row limit. Evidence:
   the legacy relay settles and reaches the same single-row total as the kernel one.
3. **The missing master UTXO.** The late-transitive expander skipped a reached callee whose state has no master
   UTXO with a bare `continue`. Every frame at that point is a reached occurrence, so the skip composed a
   transaction the route refuses at spend time. It now refuses at build time, naming the callsite, the occurrence
   and the category, matching the ordinary transitive discovery path.

Context, still useful when reading those three sites:

- The symptom surfaced in `sc-fix-create-builder-delegate-unlockers.ts`, where `nestedGroups` was empty, so
  `__internal__extcallMasterIdx*` took the documented no-group branch and returned -1 for a non-`once` callsite.
  `delegateExternalGroupIndices` is fed from the delegate branch of `StatefulContract._createBuilder` by
  `materializeCreateBuilderLowLevelStatefulCallImpl`'s `nestedExternalCalls` — the list fix 1 corrects.
- The build is a proxy forward: `upgrades.deployProxy` returns a `wrapDispatch` Proxy (`upgrades.ts`), so
  `proxy.relay(...)` becomes `forward('relay', ...)` and then `builder.withDelegatecall(implSc, 'relay', ...)`.
  The compiler publishes the callsite completely (`occurrence: 'loop'`, `addressSource: { kind: 'forward',
  paramIndex: 0 }`, `argSources: [{ kind: 'arrayElement', paramIndex: 1 }]`, `condition: values[i] != 0`,
  `occurrenceBoundSource: 'guard'`); only the **legacy** convention omits `iterationDomain`, which is what fix 2
  handles. The late-transitive path is live for a co-spent participant: the sibling title logs 8
  `atomic-node-push` entries for the coordinator's `run` callsite, where the sink arrives as a constructor
  argument rather than a forwarded one.

### Production defects (unchanged)

- `MessageBusDelegateClassesE3` — both titles, and the covenant is right; the SDK is what emits the wrong value.
  `spendProxy` builds a `StatefulTransactionBuilder` spend of `E3CondProxy.up(bytes input, bool flag)` (source:
  `if (flag) { impl.delegatecall(input); }`) with `.setState('counter', settledCounter)`.

  - The forged title (`[false]`, request 999, implementation not co-spent) must settle as `ACCEPTED counter=5`:
    the covenant preserves the proxy's data NFT on a path that did not reach the delegate edge, so the requested
    forged value is never emitted. `SOLIDC_DEBUG_FAILURE_POINT=1` shows the refusal at input 0 in
    `E3CondProxy.up` at ip 200/201 inside `OP_IF ... OP_VERIFY` — the not-taken preserve check — with the input
    Data NFT commitment `55` and the emitted output commitment `02e703` (= marker `02` + little-endian 999, the
    requested value). The covenant refused the transaction the SDK built.
  - Published metadata that distinguishes the shape: `fn.writesState === true` with `lowLevelCalls[0] =
    { callMode: 'delegatecall', occurrence: 'conditional', maximumOccurrences: 1, target: { kind:
    'constructorArg', name: 'impl' } }`, and `readStateEffect(entry)` reports `ownStateEvidence: []` with the
    delegate/low-level call only under `otherEffectEvidence` — no published evidence that this handler changes
    its own state variable. No guard expression is published for the low-level call, so the SDK cannot evaluate
    "flag is false" from metadata; the taken/not-taken decision has to come from the VM trace
    (`sc-derive-full-phase2-*`, `computed-output-repair`, `trace-verified-value-helpers` — the "exact footprint
    derivation" the test's own comment names).
  - The siblings constrain any fix: `[false]`, request 5, no implementation settles (`ACCEPTED counter=5`, passes
    today); `[true]`, request 6, implementation co-spent settles; `[true]`, request 999, no implementation
    refuses at input 0 (passes today). The second failing title's `wrote` case (`[false]`, request 6,
    implementation co-spent) must refuse at input **2**, the implementation, and currently refuses at input 0 —
    i.e. the same root cause, surfaced one input earlier.
  - Not attempted: the only shape-level fix is to treat a stated state change as unproven when the handler's own
    state has no published writer other than a conditional delegate edge, and to take the emitted commitment
    from the trace instead. That silently drops a caller's explicit `setState` for every handler matching the
    pattern, so it needs the kernel author's intent and a wider net than one file, not a local patch.
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
