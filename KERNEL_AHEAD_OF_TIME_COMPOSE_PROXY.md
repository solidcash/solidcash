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
**Status:** **COVERED** — `KernelThreeHopReturnCompose` (Leaf→Mid→Root; VM + non-empty return commitments per hop). Diamond return fan-in stretch: `KernelDiamondReturnCompose` Root←Left/Right view fan-in **VM + non-empty return commitments green** (`kimp-d8-diamond-green.log`). Prior “VM residual” was a false pin: helper called absent `testSuccess` (catch→false); fixed to `stateSuccess` like ThreeHop.

### I2 — Fan-out: one caller, two distinct callees
**Shape:** `Caller.fire()` co-spends `Emitter.ping` and `Registry.set` in one compose; contiguous blocks; both callees authenticate.
**Why:** Dense placement with **heterogeneous** callees (event + mapping), not just Caller→one Emitter.
**Status:** **COVERED** — `KernelFanOutTwoCalleeCompose`.

### I3 — Fan-in: two callers, one shared callee
**Shape:** Two independent callers invoke the same Registry in one aggregate (or sequential compose); shared category PredOut/entries stay consistent.
**Why:** Shared Unicrow/registry-style participant reused by multiple parents.
**Status:** **COVERED** — `KernelFanInSharedCalleeCompose`.

### I4 — Call then `outState` then mutate (post-call projection)
**Shape:** Already have pre-call `outState` (`KernelPreCallOutStateCompose`). Missing: mutate → read `outState` of **another** participant’s post-write in the same tx, or Mid reads Leaf.outState after Leaf.write in graph order.
**Why:** Cross-contract “see your sibling’s final state” without app names.
**Status:** **COVERED (green settle)** — `KernelSiblingOutStateCompose` (Mid projects Leaf.outState after Leaf.write under recipe). Mid local scalar write beside outState green: `KernelSiblingOutStateMidLocalCompose` (compose sticky assigns the unique no-emit int arg onto Mid.seen when a message-bus shell left `00`/`51`; Mid local-without-outState remains green).

### I5 — `staticcall` / view-only foreign read under compose
**Shape:** Caller `staticcall`s / view-reads foreign getter; return commitment authenticates; no state write on callee.
**Why:** Facade view paths; distinct from mutating `.call`.
**Status:** **COVERED (green settle)** — `KernelStaticcallViewCompose` 3/3 green: explicit void `.staticcall()` peek settles under kernel compose; typed Leaf→Root view + SDK `.staticCall()` remain green; mutating-via-staticcall refuse remains. Fix: graph planner restores `callMode: 'staticcall'` on per-owner SCB2 batch rows so `encodeMessageBatch` emits the mode byte (parent SCB1 call rows stay mode-free; detached verifier `batchModeWidth == 0` still requires `callManifestMode == 0`). L5 `AtomicMessageBusCompose` `authenticates staticcall mode` also green on the same path.

### I6 — Refused / unknown selector batch slot (Wave G)
**Shape:** Caller groups a repeated external selector the callee kernel route refuses → drop or compile/build fail closed.
**Why:** Admission boundary for batched external groups.
**Status:** **COVERED** — `KernelRefusedBatchSlot`.

### I7 — Cross-contract UPDATE PredOut (not only INSERT)
**Shape:** B2 covers INSERT P′+NEW. Still want UPDATE: PredOut/exact entry content-match under Caller→Registry compose when key present.
**Why:** Symmetric to INSERT; ladder hits both.
**Status:** **COVERED** — `KernelSortedUpdatePredOutCompose`.

### I8 — Nested LLC / low-level `address.call` under kernel compose
**Shape:** Caller uses `address(target).call(data)` / encodeWithSelector rather than typed interface; graph still binds callsite + returns.
**Why:** Low-level call path ≠ typed externalCalls metadata.
**Status:** **COVERED** — `KernelLowLevelCallCompose`.

### I9 — Token-container foreign transfer under Caller→Token compose
**Shape:** Partial coverage in `KernelExternalTokenContainerCompose` / cutover FT rows. Still want: Caller invokes Token.transferFrom-style path; invalid-only surplus strip; minting-master PredOut gates as **named Kernel*** (units exist in AssignPhysicalReturnIndices).
**Suggest:** Promote unit geometry into `KernelForeignTokenInsertCompose` without ERC/Marketplace names (RegistryToken / Balances).
**Status:** **COVERED** — `KernelForeignTokenTransferCompose` (Caller→Token.transfer; recipient payment + remainder; amount-tamper fail-closed). Route TC identity verification resolves `__message_bus_token_category*` (STT remap + GTT fallback). Insert/minting-master PredOut remain optional follow-ons.

### I10 — Schema-name isolation under multi-contract compose
**Shape:** `KernelSchemaNameIsolation` exists; ensure compose of two contracts with colliding Solidity names / alpha-renamed writes still isolates journals.
**Suggest:** Strengthen or add compose-leg if only single-contract today.
**Status:** **COVERED** — `KernelSchemaNameIsolation` single-contract legs + fan-out compose of colliding `append` spellings (event Ledger + mapping Catalog) with category-isolated effects.

---

## Wave J — proxy / delegate interaction shapes (new)

E3 + X1 + DualRuntimeSet cover admission and some runtime. Gaps are **compose-time** proxy graphs and view/return through `__forward`.

### J1 — Proxy `__forward` view return materialization
**Shape:** `upgrades.deployProxy` + implementation `view` / returning getter; caller (or SDK) reads through proxy; authenticated return on proxy block (not OP_RETURN); non-empty commitment.
**Why:** Facade `getX` / register-style views; ladder “not registered” class.
**Status:** **COVERED** — `KernelProxyViewReturnCompose` (grafted view sugar + delegate-eligible emitReturn).

### J2 — Proxy mutating entry + foreign callee in one compose
**Shape:** Proxy→impl writes local mapping **and** impl external-calls Probe/Registry in same graph (`executionArtifact` + second preparedCall), like DualRuntimeSet but assert PredOut/returns/event funding.
**Why:** Delegated MarketplaceData-style “write local + touch foreign”.
**Gap:** DualRuntimeSet focuses on key streams; InactiveDynamicWrite stops at density limit.
**Suggest:** `KernelProxyForeignCallCompose` (keep block tiny to stay under density).
**Status:** **COVERED** — `KernelProxyForeignVmapRmwCompose` (deployProxy poke→Bank.credit under compose with executionArtifact).

### J3 — Proxy sorted INSERT PredOut on implementation executor
**Shape:** Implementation `delegate` handler INSERTs mapping; PredOut absolute index content-matches P′ on **proxy-owned** state outputs; executor input is impl.
**Why:** PredOut under proxy state ownership ≠ plain Registry.
**Suggest:** `KernelProxySortedInsertPredOutCompose`.
**Status:** **COVERED** — `KernelProxySortedInsertPredOutCompose` (INSERT via deployProxy seed; P′ rewrite + NEW entry on proxy-owned outputs).

### J4 — Bytecode-pinned proxy refuses foreign implementation (runtime Kernel*)
**Shape:** E3/A13 gate + some VM legs exist; promote a slim **Kernel*** that: honest pin settles; foreign impl substitution fails at known input (no Marketplace names).
**Suggest:** `KernelProxyBytecodePinRefuseForeign` wrapping the A13-1c control as Kernel-prefixed proof for manifest.
**Status:** **COVERED** — `KernelProxyBytecodePinRefuseForeign`.

### J5 — Returning delegate + `.emitReturn()` under kernel messageBus
**Shape:** X1 covers adjacency/emitReturn; MessageBus E3 still **refuses** `scalar-return` / `emitting-delegate` classes at the gate. Clarify: which returning-delegate profiles are admitted under **kernel-row-loop** + `deployProxy` today, and land one green Kernel* for the admitted profile only.
**Suggest:** Characterize first (`KernelProxyReturningDelegateAdmission`), then one settle proof if admitted.
**Status:** **COVERED (admitted profile)** — `KernelReturningStaticcallCompose` + `KernelProxyViewReturnCompose` (J1) cover admitted returning/view paths. Emitting-delegate / scalar-return E3 refusals remain negative fences.

### J6 — Proxy event funder slot under compose (not only direct STB)
**Shape:** X1 settles event funder on delegated call via STB; need same under `messageBus.compose` with `executionArtifact`.
**Suggest:** `KernelProxyEventFunderCompose`.
**Status:** **COVERED (green settle)** — `KernelProxyEventFunderCompose` (dispatch `.send()` + event-only compose+executionArtifact×Probe). Non-proxy counter+emit green: `KernelCounterEmitCompose`. Proxy+executionArtifact counter+emit green: `KernelSelfToProxyEventCompose` — compose `stickyKernelLeftoverScalarWrites` runs immediately before aggregate publish; writer metadata for leftover +1 is resolved from `descriptor.executionArtifact` (impl `ping`) while NFT commitments stay on the proxy participant layout, so recipe converge sees `51` without extract-from-failed-VM. Proofs `kimp-d8-proxy-emit-{green,peers,compile,sticky-unit}.log`.

### J7 — Inactive union width: unselected proxy handler must not reserve chunks
**Shape:** `KernelDelegateInactiveDynamicWrite` expects density-limit throw today — that is a **characterization of overload**, not a green settle. Ahead-of-time goal: either slim the fixture until build succeeds with zero chunks for unselected handler, or pin a named “fails at density with reason X” proof.
**Suggest:** Split into `KernelProxyInactiveUnionSettle` (green path) vs density fence note.
**Status:** **COVERED** — green slim settle `KernelProxyInactiveUnionSettle` (admit-only `run`; inactive mapping sibling; compose+Probe; zero dyn chunks) + negative `KernelDelegateInactiveDynamicWrite` (proxy+`address[]` full-admission density). Incomplete-chunk stubs for inactive dyn vars filtered to active handler `dynamicWrites` (SC) + `dynamicChunkPlaceholdersRemain` empty-run fix.

### J8 — Nested resolution / promoted owner frame under compose
**Shape:** Units in `KernelDelegateForwarding` cover payload/owner frame; missing e2e: proxy forwards selector that itself has an external call; nested callsite IDs rebase onto proxy participant span.
**Suggest:** `KernelProxyNestedCallsiteRebase` (combine J2 + C1).
**Status:** **COVERED** — `KernelProxyNestedCallsiteCompose` (deployProxy poke→Probe.touch with delegate callsite under compose).

### J9 — Upgrade-through-proxy compose
**Shape:** `KernelUpgradeCompose` is in-place append on a contract; proxy `setImpl` / upgrades path is separate (`ProxyPattern`, `UpgradesDeployProxy`). Need Kernel*: proxy points at V1, upgrade to V2 artifact, one mutating row through new impl in compose.
**Suggest:** `KernelProxyUpgradeThenCompose` (Tier-2 adjacent; keep out of Tier 3 split/merge).
**Status:** **COVERED** — `KernelProxyUpgradeThenCompose` (param-mode V1→V2; baked SolidCashProxy refuse + retarget characterization).

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
