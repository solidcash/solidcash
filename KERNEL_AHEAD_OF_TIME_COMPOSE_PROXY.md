# Ahead-of-time Kernel cases — inter-contract compose + proxy

Ladder-agnostic shapes still thin or missing as named `Kernel*` proofs. Derived from in-tree compose/proxy patterns and the interaction classes marketplace/Unicrow climb hits, **without** app vocabulary in fixtures.

Workspace: `grok/kernel-comprehensive-fixtures`. Do not widen `requiredKernelProofs` until green + review.

## Already covered (Waves A–F + strong existing Kernel*)

| Shape | Proof |
| --- | --- |
| Two-hop return materialization | `KernelTwoHopReturnProbe` |
| Sorted INSERT PredOut under compose | `KernelSortedInsertPredOutCompose` |
| Local↔aggregate witness rebase | `KernelLocalProbeWitnessRebase` |
| Repair lengthening/cycle | `ComputedOutputRepair` unit |
| Compute sidecar non-empty | `KernelComputeSidecarNonEmpty` |
| Dense funder-gap / event funding | `KernelFunderGapTwoParticipant` |
| Nested return absolute indices | `KernelNestedReturnSlotCoordinates` |
| Aggregate / struct / dynamic result compose | `KernelReturnAggregateCompose`, `Kernel*StructArray*Compose`, `KernelWholeStructStateGetterCompose` |
| Pre-call `outState` | `KernelPreCallOutStateCompose` |
| Cutover multi-row mapping / FT | `KernelCutoverCompose` |
| Upgrade / unsafe-tier2 / signatures | `KernelUpgradeCompose`, `KernelUnsafeTier2Compose`, `Kernel*Signature*` |
| Delegate dual mapping-set + inactive dynamic | `KernelDelegateDualRuntimeSet`, `KernelDelegateInactiveDynamicWrite` |
| E3 admission gate (many classes) | `MessageBusDelegateClassesE3`, `ReviewA13DelegateE3` |
| Slot adjacency / emitReturn on delegate | `X1DelegateSlotAdjacency` (e2e, not Kernel*-prefixed) |
| Forwarding planner units | `KernelDelegateForwarding` |

---

## Wave I — inter-contract composable communication (new)

First-principles multi-contract graphs beyond A–F. Prefer tiny `compileString` + `messageBus.compose`.

### I1 — Three-hop / diamond return chain
**Shape:** `Leaf → Mid → Root` (or Root reads Mid which reads Leaf); every hop’s return commitment non-empty; absolute `__internal__returnOutputIdx` per participant.
**Why:** Two-hop is proven; marketplace-style facade→data→token is three+ hops.
**Gap:** No `KernelThreeHopReturnProbe` / diamond.
**Suggest:** Extend TwoHop pattern; assert VM on all route inputs + non-`00` commitments.

### I2 — Fan-out: one caller, two distinct callees
**Shape:** `Caller.fire()` co-spends `Emitter.ping` and `Registry.set` in one compose; contiguous blocks; both callees authenticate.
**Why:** Dense placement with **heterogeneous** callees (event + mapping), not just Caller→one Emitter.
**Gap:** F1 is single callee; Cutover is same-contract multi-row.
**Suggest:** `KernelFanOutTwoCalleeCompose`.

### I3 — Fan-in: two callers, one shared callee
**Shape:** Two independent callers invoke the same Registry in one aggregate (or sequential compose); shared category PredOut/entries stay consistent.
**Why:** Shared Unicrow/registry-style participant reused by multiple parents.
**Gap:** No Kernel* fan-in.
**Suggest:** `KernelFanInSharedCalleeCompose` (may need two prepared call graphs or staged sends + one compose).

### I4 — Call then `outState` then mutate (post-call projection)
**Shape:** Already have pre-call `outState` (`KernelPreCallOutStateCompose`). Missing: mutate → read `outState` of **another** participant’s post-write in the same tx, or Mid reads Leaf.outState after Leaf.write in graph order.
**Why:** Cross-contract “see your sibling’s final state” without app names.
**Suggest:** `KernelSiblingOutStateCompose`.

### I5 — `staticcall` / view-only foreign read under compose
**Shape:** Caller `staticcall`s / view-reads foreign getter; return commitment authenticates; no state write on callee.
**Why:** Facade view paths; distinct from mutating `.call`.
**Gap:** Result-compose proofs often use provisional commitments on mutating or pure returns; thin on explicit staticcall graph + fail-closed if callee writes.
**Suggest:** `KernelStaticCallReturnCompose` (+ negative: forged return).

### I6 — Refused / unknown selector batch slot (Wave G)
**Shape:** Caller groups a repeated external selector the callee kernel route refuses → drop or compile/build fail closed.
**Why:** Admission boundary for batched external groups.
**Suggest:** Compiler journal + thin `KernelRefusedBatchSlot`.

### I7 — Cross-contract UPDATE PredOut (not only INSERT)
**Shape:** B2 covers INSERT P′+NEW. Still want UPDATE: PredOut/exact entry content-match under Caller→Registry compose when key present.
**Why:** Symmetric to INSERT; ladder hits both.
**Suggest:** `KernelSortedUpdatePredOutCompose` (seed key, then poke same key).

### I8 — Nested LLC / low-level `address.call` under kernel compose
**Shape:** Caller uses `address(target).call(data)` / encodeWithSelector rather than typed interface; graph still binds callsite + returns.
**Why:** Low-level call path ≠ typed externalCalls metadata.
**Gap:** Typed compose dominates Kernel*; LLC under kernel row-loop is thinner.
**Suggest:** `KernelLowLevelCallCompose` (keep tiny).

### I9 — Token-container foreign transfer under Caller→Token compose
**Shape:** Partial coverage in `KernelExternalTokenContainerCompose` / cutover FT rows. Still want: Caller invokes Token.transferFrom-style path; invalid-only surplus strip; minting-master PredOut gates as **named Kernel*** (units exist in AssignPhysicalReturnIndices).
**Suggest:** Promote unit geometry into `KernelForeignTokenInsertCompose` without ERC/Marketplace names (RegistryToken / Balances).

### I10 — Schema-name isolation under multi-contract compose
**Shape:** `KernelSchemaNameIsolation` exists; ensure compose of two contracts with colliding Solidity names / alpha-renamed writes still isolates journals.
**Suggest:** Strengthen or add compose-leg if only single-contract today.

---

## Wave J — proxy / delegate interaction shapes (new)

E3 + X1 + DualRuntimeSet cover admission and some runtime. Gaps are **compose-time** proxy graphs and view/return through `__forward`.

### J1 — Proxy `__forward` view return materialization
**Shape:** `upgrades.deployProxy` + implementation `view` / returning getter; caller (or SDK) reads through proxy; authenticated return on proxy block (not OP_RETURN); non-empty commitment.
**Why:** Facade `getX` / register-style views; ladder “not registered” class.
**Gap:** TwoHop is direct contracts; DualRuntimeSet checks `__forward` arity but not view-return probe under compose.
**Suggest:** `KernelProxyViewReturnProbe` (impl getter + proxy forward + emitReturn/staticCall).

### J2 — Proxy mutating entry + foreign callee in one compose
**Shape:** Proxy→impl writes local mapping **and** impl external-calls Probe/Registry in same graph (`executionArtifact` + second preparedCall), like DualRuntimeSet but assert PredOut/returns/event funding.
**Why:** Delegated MarketplaceData-style “write local + touch foreign”.
**Gap:** DualRuntimeSet focuses on key streams; InactiveDynamicWrite stops at density limit.
**Suggest:** `KernelProxyForeignCallCompose` (keep block tiny to stay under density).

### J3 — Proxy sorted INSERT PredOut on implementation executor
**Shape:** Implementation `delegate` handler INSERTs mapping; PredOut absolute index content-matches P′ on **proxy-owned** state outputs; executor input is impl.
**Why:** PredOut under proxy state ownership ≠ plain Registry.
**Suggest:** `KernelProxySortedInsertPredOutCompose`.

### J4 — Bytecode-pinned proxy refuses foreign implementation (runtime Kernel*)
**Shape:** E3/A13 gate + some VM legs exist; promote a slim **Kernel*** that: honest pin settles; foreign impl substitution fails at known input (no Marketplace names).
**Suggest:** `KernelProxyBytecodePinRefuseForeign` wrapping the A13-1c control as Kernel-prefixed proof for manifest.

### J5 — Returning delegate + `.emitReturn()` under kernel messageBus
**Shape:** X1 covers adjacency/emitReturn; MessageBus E3 still **refuses** `scalar-return` / `emitting-delegate` classes at the gate. Clarify: which returning-delegate profiles are admitted under **kernel-row-loop** + `deployProxy` today, and land one green Kernel* for the admitted profile only.
**Suggest:** Characterize first (`KernelProxyReturningDelegateAdmission`), then one settle proof if admitted.

### J6 — Proxy event funder slot under compose (not only direct STB)
**Shape:** X1 settles event funder on delegated call via STB; need same under `messageBus.compose` with `executionArtifact`.
**Suggest:** `KernelProxyEventFunderCompose`.

### J7 — Inactive union width: unselected proxy handler must not reserve chunks
**Shape:** `KernelDelegateInactiveDynamicWrite` expects density-limit throw today — that is a **characterization of overload**, not a green settle. Ahead-of-time goal: either slim the fixture until build succeeds with zero chunks for unselected handler, or pin a named “fails at density with reason X” proof.
**Suggest:** Split into `KernelProxyInactiveUnionSettle` (green path) vs density fence note.

### J8 — Nested resolution / promoted owner frame under compose
**Shape:** Units in `KernelDelegateForwarding` cover payload/owner frame; missing e2e: proxy forwards selector that itself has an external call; nested callsite IDs rebase onto proxy participant span.
**Suggest:** `KernelProxyNestedCallsiteRebase` (combine J2 + C1).

### J9 — Upgrade-through-proxy compose
**Shape:** `KernelUpgradeCompose` is in-place append on a contract; proxy `setImpl` / upgrades path is separate (`ProxyPattern`, `UpgradesDeployProxy`). Need Kernel*: proxy points at V1, upgrade to V2 artifact, one mutating row through new impl in compose.
**Suggest:** `KernelProxyUpgradeThenCompose` (Tier-2 adjacent; keep out of Tier 3 split/merge).

---

## Priority sprint (after A–F)

Highest leverage for ladder-parallel dual-track, still general:

1. **I7** Sorted UPDATE PredOut compose (pair with existing B2 INSERT)
2. **J1** Proxy view return probe through `__forward`
3. **I1** Three-hop return chain
4. **I5** StaticCall return compose
5. **J3** Proxy sorted INSERT PredOut
6. **I2** Fan-out two callees
7. **J4** Bytecode-pin refuse foreign (Kernel* wrap)
8. **I6 / G1** Refused batch slot

Defer / fence: Tier 3 lifecycle; E3-unadmitted classes (emitting-delegate, collection-writing-delegate, caller-chosen, conditional/iterated edges) except as **negative** Kernel* pins; 10k/chipnet.

## Naming / fence
- Prefix runtime e2es `Kernel*`
- No Marketplace / Unicrow / job vocabulary
- Prefer `messageBus.compose` + `executionArtifact` for proxy graphs
- Units OK when geometry-only (PredOut, forwarding planner); always pair with one Kernel* settle when the ladder hits the shape
