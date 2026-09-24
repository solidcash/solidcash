# Kernel improvement backlog (authority audit → prioritized list)

**Implementation status (fixtures `grok/kernel-comprehensive-fixtures`):** items **1–13 MVP landed** with shipped modules + unit proofs. **Audit #1 / recommended step 1 (transaction-global layout + slot exclusivity)** landed — see Post-audit layout tranche below. Full GTT rewrite / every-DEFINE symbolic verify / mega-class phase migration / beta take-job (F1) remain follow-on depth — see status lines under each item.

**Evidence worktree:** `.worktrees/kernel-beta-candidate`  
**Anchor log:** `{SCRATCH}/kernel-improvement-anchors.log`  
**Central theme:** authority still sometimes flows backward (failed VM frames, inferred names, reconstructed coordinates) instead of forward from one compiler-authored execution plan.

---

## Recommended order

Execute **items 1 → 4 first** (OBJECTIVE four-first), then protocol/metadata **5–8**, planning/convergence **9–11**, capacity/admission **12–13**. Look-ahead invariant suites run in parallel as each phase lands.

| Phase | Items | Intent |
|-------|-------|--------|
| **P0** | 1, 4 | Stop name/env-dependent planning and production semantics |
| **P1** | 2 | Finish layout-resolver as sole coordinate + ownership authority |
| **P2** | 3 | Typed handler-frame ABI + stack-effect validation |
| **P3a** | 5, 6, 7, 8 | Versioned KernelExecutionPlan, stable IDs, tagged sentinels |
| **P3b** | 9, 10, 11 | Recipes over trace-repair; monotone phases; immutable pipeline |
| **P3c** | 12, 13 | Multidimensional budgets; pure speculative admission |

---

## Items 1–13

### 1. Remove application- and source-name heuristics from planning — **DONE (MVP + F5′)**
- **Status:** `legacy-planning-heuristics.ts`; kernel `seedOptimisticScalarWrites` skips name regexes; JobEvent / `publishJobEvent` planning compares only via `legacyIsPublishJobEventName` / `legacyGroupLooksLikePublishJobEvent` behind `_permitsLegacyNamedValueChunkFallback`; tests `LegacyPlanningHeuristics` + `LegacyJobEventNamePurge`.
- **Follow-on:** Marketplace-named STB helper API retired via F29/D15 (`legacy-job-event-helpers`). Planning compares go through `legacyIsPublishJobEventName` / `legacyGroupLooksLikePublishJobEvent`; the only remaining `'publishJobEvent'` equality lives inside `legacy-planning-heuristics.ts` (the adapter). Proof `LegacyJobEventHelpersAdapter` + `kimp-non-d10-focused.log`.

### 2. Make the layout resolver the only coordinate authority — **DONE (ownership + resolve + STB/preflight wire)**
- **Status:** Stronger `assertUniqueOwnership`; compose resolve+apply; STB `assignValueChunkOutputBaseFromResolve` / resolve-gated `refreshCapturedValueChunkOutputBase`; preflight `assertAssemblyLayoutWitnessesMatchResolve` (F3′ non-zero bandOffset via published trailing slots + F31 PredOut claims threaded from compose). Proofs `LayoutOwnershipAuthority`, `LayoutResolveAuthorityWire`, `PreflightBandOffsetAuthority`, `PredOutSentinelComposeSync`, `NameAuthorityLeftovers` (F31).
- **Follow-on closed on fixtures:** F3′ + F31 (non-zero bandOffset / PredOut physical in preflight). Alias normalize **F4 DONE**. Remaining: beta port (**F2′**, other agent).

### 3. Replace implicit stack bookkeeping with a typed handler-frame ABI — **DONE (DEFINE emission + helper effects)**
- **Status:** `@solidcash/utils` `handler-frame-abi`; GTT `emitFunctionDefine` calls `validateDefineEmission` (same entry as tests); **per-arg / per-band `helperEffects`** recorded into DEFINE validation; `DefineFrameEmission.test.ts` drives `compileString` → real DEFINE path; fail-closed on injected anonymous live; D11 all DEFINE kinds. Proof `{SCRATCH}/kimp-item5-f23-item3-solidc2.log`.
- **Follow-on closed (thin):** finer per-helper stack-effect recording for args/bands; further opcode-level helper effects optional.

### 4. Remove environment-dependent production semantics — **DONE (registry + F7′)**
- **Status:** `solidc-env-registry.ts`; `ownerAltAnchor` / `handlerBandModel` on `CompilerOptions` + cache identity; GTT reads options not raw env; **F28** registration + **F7′** `SOLIDC_STRICT_UNKNOWN_ENV` / `enforceSolidcEnvPolicy` on `compileString`. Proof `SolidcEnvRegistry.test.ts` + `kimp-f7prime-strict-ci.log`.
- **Follow-on closed:** classify remaining SOLIDC names + strict unknown-reject CI (F28/F7′).

### 5. Publish one versioned, digest-bound KernelExecutionPlan — **DONE (compose + compile SCKP)**
- **Status:** `authorizeComposeParticipantLayout` builds plan + digest; digest stamped into `publishedRelocations`; **F21** SCKP bytecode markers; **Item-5 follow-on** create/digest shared in `@solidcash/utils` and **compile-time** `stampKernelExecutionPlanDigestsAtCompile` embeds digests into `artifact.bytecode` + `messageBus.kernelExecutionPlans`. Proofs `KernelExecutionPlanBytecodeAndVersion` + `kimp-item5-*.log`.
- **Follow-on closed:** embed digest in route bytecode (compile + compose).

### 6. Stop overloading `undefined` as both legacy and empty — **DONE (enforced on compose path + F22)**
- **Status:** `assertKernelPlanComplete` inside `authorizeComposeParticipantLayout` (compose calls it); over-budget/incomplete fail closed; **F22** `readKernelExecutionPlans` / `assertReadableKernelExecutionPlans` gate on `kernelPlanVersion` + SCKP bytecode. Proof `ComposeKernelAuthorityLive` + `KernelExecutionPlanBytecodeAndVersion`.
- **Follow-on closed:** gate StatefulContract reader on `kernelPlanVersion` (F22).

### 7. Use stable IDs everywhere — **DONE (selector-keyed + F5″/F17/F18)**
- **Status:** `handlerSelector` (ABI selector hex) is `StableId.id`; diagnostic name only in `diagnosticName`; alpha-rename proof in `ComposeKernelAuthorityLive`; graph joins selector-first via `graph-handler-join.ts` (F5″); compose joins **F17**; `bindConsumerCallsites` selector-first **F18**.
- **Follow-on closed:** name-first attribution leftovers (F17/F18).

### 8. Replace magic sentinels with tagged internal values — **DONE (MVP + D7 + R5 depth)**
- **Status:** `decodeLayoutCoordinate` in apply; tagged rebase in resolve; **D7** PredOut/sentinel compose sync; **R5** PredOut `concreteLocalSlot` never authority (any disagreement fails closed; resolved surface omits field). Proof `kimp-item8.log` + `LayoutResolver` + `kimp-r5-predout-*.log`.
- **Follow-on closed:** full PredOut path through tagged / physical-only values (D7 + R5).

### 9. Make VM execution validation-only, not the normal state planner — **DONE (recipe gate + F9′ default)**
- **Status:** `refuseVmExtractedRepairsIfRecipe` before applying VM-mined proposals; default mode **`recipe` (F9′)**; `devOracle` explicit opt-in; proof `RecipeDefaultMaterialization` + `ComposeKernelAuthorityLive`.
- **Follow-on:** marketplace titles that still need converge must call `setMaterializationMode('devOracle')` explicitly.

### 10. Make all convergence monotone — **DONE (MVP + D2 COVERED thin)**
- **Status:** `MonotoneCell` placeholder→resolve + `freezeGeometry` on converge exit for fixed-state resources; **value-chunk** / **dynamic-chunk** / semantic claim / **ConstraintFixpointSession** + OTC weighted rank. Proofs `kimp-item10.log` + `ChunkConvergeMonotoneLattice` / `ConstraintFixpointSession` / `ResourceOtcConflictRank` + `kimp-d1-d2-d3-stretch-*.log`.
- **Follow-on closed (thin):** broader constraint/fixpoint solver (D2 COVERED); deeper domains optional.

### 11. Separate planning phases with immutable data — **DONE (compose authority)**
- **Status:** `authorizeComposeParticipantLayout` advances to `absoluteLayout` + `assertGeometryFrozen`; proof `ComposeKernelAuthorityLive`.
- **Follow-on:** migrate mega-classes onto phase boundaries (**D10** PARTIAL paused; **D4** remains the long-horizon rewrite).

### 12. Publish multidimensional resource budgets — **DONE (compose + D12)**
- **Status:** `assertWithinKernelBudgets` inside `authorizeComposeParticipantLayout`; **D12** compiler-published `messageBus.resourceBudgets` via `buildMessageBusResourceBudgets`. Proof `ComposeKernelAuthorityLive` + `ResourceBudgetsPublish.test.ts`.
- **Follow-on closed:** compiler publish worst-case bounds onto artifacts (D12).

### 13. Make speculative admission a pure analysis pass — **DONE (span gate + F8)**
- **Status:** Span-based analysis (`admissionSource: 'attribution-spans'`) with `refusedHandlerIds`; unique modifier-only selfdestruct stays admitted, selfdestruct *swarms* stay `KERNEL_LIFECYCLE`; **F8** `kernel-admission-catalog.ts` / `throwKernelCatalogDiagnostic`. Proof `{SCRATCH}/kimp-item13.log` + `KernelAdmissionCatalog.test.ts`.
- **Follow-on closed:** replace retry ladder with analyzer-first decisions (F8 catalog).

**Items 5–13 evidence bundle:** `{SCRATCH}/kimp-items-5-13-inventory.md` + `{SCRATCH}/kimp-items-5-13-proof.log` + per-item `kimp-item{N}.log`.

---

## Look-ahead tests (property / metamorphic suites)

Add suites that look ahead of individual bugfixes (land alongside P0–P3):

1. **Alpha-renaming:** renaming contracts, functions, state vars, collections cannot change admission, layout, or semantics.
2. **Declaration reorder:** reordering unrelated state/handlers either preserves the plan or bumps an explicit layout-version.
3. **Inactive sibling:** adding unreachable/inactive sibling cannot change active resource mutation.
4. **Participant permutation:** participant order permutations yield equivalent transaction semantics.
5. **Compile determinism:** cold / cached / one-job / four-job compiles produce identical artifact hashes.
6. **Plan digest integrity:** removing, reordering, or transplanting one execution-plan descriptor → digest/refusal failure.
7. **Boundary matrices:** 0/1/max rows; 119/120/121-byte chunks; 127/128-byte commitments; empty/nonempty dyn state; every sentinel encoding.
8. **Hostile layouts:** overlapping ownership/coordinate claims rejected by the resolver **before** VM execution.
9. **Kernel/legacy differential fuzz:** shared supported subset observable parity.
10. **Symbolic stack verification:** every emitted `OP_DEFINE` (inactive branches + nested returns) proves frame entry/exit, joins, invoke arity, no live anonymous cells, alt-stack balance.

---

## Related trackers

| Tracker | Overlap | Gap vs this backlog |
|---------|---------|---------------------|
| `KERNEL_EXTENSION_INVENTORY.md` (beta + fixtures) | Inventory 1–6 beta wedges; 7–18 fences; architectural invariants (stable callsite ID, no name-based support, fresh compile no hidden speculative errors) | Inventory is **admission-feature** oriented; this backlog is **authority/architecture** oriented (heuristics, layout sole authority, frame ABI, env registry, plan digest, monotone phases). |
| `GOAL_KERNEL_LAYOUT_OWNERSHIP_FOLD.md` (fixtures) | Direct precursor to **item 2** (resolver + ownership + fold); Gate A′ compose cutover started | Fold goal does **not** finish sole-authority cutover across preflight/STB, nor stronger ownership (coordinate collisions, range overlap, suffix crossing). |
| `GOAL_KERNEL_COMPLETE_RESIDUALS.md` | Phased residual closure by proof object | Residuals close missing proofs; this list prioritizes removing backward authority even when a residual already “admits.” |
| Family-1 / fence maps | Typed stream metadata reduces some name heuristics | Does not remove Marketplace-shaped JobEvent paths or SOLIDC production switches. |

**Fence reminder:** foreign delegate (#15), true signature circularity, and Marketplace/`requiredKernelProofs` product greening remain out of scope for implementing these items unless a separate goal reopens them.

---

## Implementation note

Fixtures MVP for items **1–13** is landed (see status under each item). Depth follow-ons (full GTT DEFINE emission, preflight/STB sole-layout cutover, graph name-join purge, beta Gate A / Marketplace greening) stay explicitly deferred — not claimed complete by this MVP.

---

## Followups (near-term, after or beside P0–P1)

These are concrete next wedges that either unlock item 2/9 or close open gates already started.

| ID | Followup | Why | Depends on / feeds |
|----|----------|-----|--------------------|
| **F1** | **Beta Gate A verify** — `take job$` + `take job take job` green; no 203↔222 / 163↔161 drift | Layout-fold Gate A′ is on fixtures; marketplace proof still open on beta | Layout fold Gate A′ done; do **not** grind eacc from fixtures implementer |
| **F2** | **Port layout-resolver sole-authority cutover onto beta** (compose already; preflight + STB materialization still reconstruct) | Fixtures Gate A′ is not beta tip; PredOut/dyn drift classes live on marketplace path | Items **2**, **9** |
| **F3** | **Strengthen `assertUniqueOwnership`** — same I/O coordinate, conflicting roles, overlapping variable-width ranges, cross-participant / fixed-suffix | **DONE** — live in `layout-resolver.ts` (conflicting-roles / coordinate-collision / overlapping-range / participant-boundary / fixed-suffix-crossing); alias normalize remains **F4** | Item **2** |
| **F4** | **Alias normalize** (layout-fold phase 3) — unify collection/carrier aliases before ownership claims | **DONE** — `normalizeOwnershipCollectionAlias` / `normalizeOwnershipClaim`; `assertUniqueOwnership` normalizes before identity keys; `this.balances`≡`balances`; proof `LayoutOwnershipAuthority` F4 + `kimp-f4-alias-normalize.log` | Item **2** / **7** |
| **F5** | **Replace `bindConsumerCallsites` name-first attribution** — graph.ts acknowledges by-name/first-match collapse for same-name callsites | Same failure class as item **1**/**7** on the graph path | Items **1**, **7** |
| **F6** | **Retire deferred-compute / VM discovery as default planner** — `compose.ts` `deferredComputeCache` + preflight converge/repair | **DONE** — `allowsDeferredComputeVmDiscovery()` false under recipe; compose skips deferredComputeCache get/set and refuses unresolved VM-discovery resolve under recipe (`devOracle` retains discovery); proof `DeferredComputeRecipeGate.test.ts` + `kimp-f6-*.log`; keccak/staticcall/I4 peers green | Items **9**, **10** |
| **F7** | **Compile-cache / artifact identity audit** — `SOLIDC_COMPILE_CACHE*` + option bits in cache key; ensure execution-affecting env never silent | **DONE** — exported `buildArtifactCacheKey`; execution options (`messageBusKernel` / `ownerAltAnchor`) change identity; `SOLIDC_COMPILE_CACHE_DIR` observation-only; distinct options → distinct cache entries; proof `CompileCacheIdentity.test.ts` + `kimp-f7-proof.log` (peers SolidcEnvRegistry + CompileCacheDisk) | Items **4**, **5** |
| **F8** | **Unify `KERNEL_*` catalog vs legacy diagnostic strings** — fence map notes plain `Error` / pre-catalog strings still appear | **DONE** — `kernel-admission-catalog.ts` + `throwKernelCatalogDiagnostic`; LowerCollectionJournalHelpers share-one-exit / early-return / unstable-key / missing-journal throws are `SolidcDiagnosticError` with `KERNEL_*`; compiler uses `normalizeKernelAdmissionReason`; proof `KernelAdmissionCatalog.test.ts` + `kimp-f8-kernel-catalog.log` | Item **13**, fence map |

---

## Deferrals (pay-as-you-go; do not start before P0–P2 unless forced)

| ID | Deferred work | Tracker home | Trigger to un-defer |
|----|---------------|--------------|---------------------|
| **D1** | Path-effect IR (thin; fold activations) | Layout-fold phase 5 | **COVERED (thin)** — fold/path + schedules + EC + multi-kind + opaque-control + handlerInput*/boolParamEq/namedInput*/state*/call*/stateCallCmp + ternary/member + **array-index/cast namedSideName**. Proofs `ResourceFold` (17) + `kimp-d1-d2-d3-stretch-sdk.log`. Further expression shapes are optional stretch only |
| **D2** | Constraint / fixpoint solver | Layout-fold phase 6; backlog item **10** | **COVERED (thin)** — lattices + live domains + speculative admit/converge + multi-proposal + accumulate-all OTC→rankMany + cross-output joint fingerprint + **weighted OTC scoring** (`weight` > input/ip/lex). Proofs `ResourceOtcConflictRank` (3) + `ConstraintFixpointSession` (11) + `kimp-d1-d2-d3-stretch-*.log`. Deeper solver domains are optional stretch only |
| **D3** | Typed ExecutionContext | Layout-fold phase 7; backlog item **11** | **COVERED (thin)** — lifecycle + multi-kind + batch/fold + emit/transfer env + planEffects + slot cover + slotInventory→admit + prune + kind-specific sidecar + dense sidecar remap + **dense event/transfer/runtime width remap**. Proofs `ComposeSlotEffectPlans` (7) + `kimp-d1-d2-d3-stretch-sdk.log`. Further slot kinds are optional stretch only |
| **D4** | Full phase pipeline rewrite of four mega-classes | Backlog item **11** | After items 1–4 prove authority direction |
| **D5** | Multidimensional budgets beyond rows/blob | Backlog item **12** | After KernelExecutionPlan (item **5**) exists to hang bounds on |
| **D6** | Speculative admission → pure analyzer | Backlog item **13** | After stable IDs + KERNEL_* catalog (items **7**, **F8**) |
| **D7** | Tagged sentinel internal values / PredOut relocatable sync | **DONE** — see Post-MVP D7 (`layoutWitnessIsActiveCoordinate` + compose gate) | Item **8** follow-on |
| **D8** | AOT Wave I/J Kernel\* proofs (three-hop, fan-in/out, staticcall, proxy shapes, …) | **COVERED (thin optional only)** — I1–I10 + J1–J9 green settles (I4/I5/J6/J7 incl. SelfToProxy sticky). Diamond return fan-in: `KernelDiamondReturnCompose` **VM settle green** (`kimp-d8-diamond-green.log`; prior residual was false `testSuccess` pin). E3 emitting-delegate/scalar-return remain negative fences. Proofs `kimp-d8-proxy-emit-*.log` + `kimp-d8-diamond-green.log` | Ladder-agnostic coverage; **not** Marketplace greening; after layout authority stable |
| **D9** | Inventory beta 1–6 product re-verify on marketplace titles | Inventory + REEVAL next-goal queue | Separate from architecture backlog; beta-agent owned |

---

## Residuals (honest fences / still-open cells)

### R1 — Permanent fences (do not schedule as improvements)

- **Foreign delegate** (inventory **#15**) — `KERNEL_FOREIGN_DELEGATE`
- **True signature circularity** — detached/mutated leaves rewriting signed preimage / participant-changing lifecycle
- **Marketplace / `requiredKernelProofs` product greening** — out of architecture backlog scope

### R2 — Inventory fences 7–18 (post-beta unless title-forced)

| # | Residual shape (admitted subset already exists where noted) | Catalog |
|---|-------------------------------------------------------------|---------|
| 7 | Runtime `break`/`continue` needing execution mask | `KERNEL_UNBOUNDED_KEY` |
| 8 | Unbounded / multi-arm constructed key vectors (hash160 constructed-key UPDATE admitted) | `KERNEL_UNBOUNDED_KEY` / `KERNEL_LAYOUT` |
| 9 | Multi-op / early-return chunkable mixed streams (bytes+mapping + former untransported helper/loop mixes admitted; Fence #9 locked) | `KERNEL_LAYOUT` |
| 10 | Residual aggregate getters / recursive structs (mixed nested ABI returns admitted) | `KERNEL_LAYOUT` / `KERNEL_TX_SIGNATURE` |
| 11 | Varying/unlowered recursive mapping reads (nested foreign vmap admitted) | `KERNEL_LAYOUT` |
| 12 | Runtime-count / escaping / ambiguous deploy loops (typed Yul CREATE + straight-line deploy admitted; Fence #12 locked) | `KERNEL_LAYOUT` / `KERNEL_LIFECYCLE` |
| 13 | Detached lifecycle `sig` leaves | `KERNEL_TX_SIGNATURE` |
| 14 | Opaque / stack-divergent / active-bytecode assembly (stack-neutral native admitted; Fence #14 locked) | `KERNEL_OPAQUE_EFFECT` |
| 15 | Foreign delegate (Fence #15 locked; permanent) | `KERNEL_FOREIGN_DELEGATE` |
| 16 | Collection/event/blockhash/write-bearing lifecycle; `unsafe` 0/1 | `KERNEL_LIFECYCLE` |
| 17 | Fully relocatable multi-span blocks; non-bool / counter-derived selection beyond admitted trailing-band subset | `KERNEL_LAYOUT` |
| 18 | Both-arms non-loop chunkable; non-bool selection; zero-width coordinate shifts; early-return bypass (bool-param selected emit admitted) | `KERNEL_LAYOUT` |

Authoritative gate/fixture map: `FENCE_MAP_7_18.md`.

### R3 — REEVAL still-open (non-inventory)

- ~~**DualRuntimeSet-width × keccak density**~~ **SETTLED** — `KernelDualRuntimeKeccakCompose` former density-wall case greens; proxy DualRuntimeSet density reject remains `KernelDensityBoundedCompose`
- **Collection/event/blockhash-bearing selfdestruct** — honest `KERNEL_LIFECYCLE`; product path remains multi-tx `StatefulContract.destroy()`
- **Detached `sig` on lifecycle handlers** — honest `KERNEL_TX_SIGNATURE`

### R4 — Layout-fold / family-1 leftovers

- Family-1 A/B/C **admitted** on fixtures (hetero loop, same-iter selection, event beside ≥2 streams) — treat as **regression anchors**, not open residuals
- Layout-fold open: **Gate A (beta)** + deferred phases **3/5/6/7** (alias, path-effect IR, fixpoint, ExecutionContext) — see Followups/Deferrals
- Multi-row fold residual negative (Dual writeBoth → `KERNEL_LAYOUT`) **kept** — do not “green” by widening admission without proof object

### R5 — Additional architectural residuals (not in items 1–13, still real)

| Residual | Evidence | Maps to |
|----------|----------|---------|
| Graph handler/result joins still fall back to **function name** / selector | **Mostly closed** — F5″/`findMessageBusHandlerForInvocation`, F17 compose joins, F18 `bindConsumerCallsites` selector/`sourceCallsiteId` first (name collapse fail-closed under kernel). Remaining: legacy rows without published identity | Items **1**, **7**, **F5**, **F18** |
| **Legacy vs kernel** provenance (`legacy-logical` source callsite, omitted empty metadata) | **CLOSED (R5 thin)** — `assertExplicitSourceCallsiteProvenance` on `planCompiledGraph`: sourceCallsiteId requires stamped provenance; kernel parents refuse `legacy-logical`. Proof `SourceCallsiteProvenance` (4) + AtomicMessageBusGraph collapsed-callsite peer + `kimp-r5-prov-*.log` | Items **5**, **6** |
| **Concrete vs physical** PredOut still threaded as optional `concreteLocalSlot` | **CLOSED (R5/D7 depth)** — any disagreeing `concreteLocalSlot` fails closed; resolved PredOut omits the field; compose no longer threads unlocker concrete into resolve. Proof `LayoutResolver` + `kimp-r5-predout-*.log` | Items **2**, **8**, **D7** |
| Effect-class **heuristic** budgets (`invocations + 5` style) | compose — **D14** published ceiling | Item **12**, **D14** |
| Item 9 fence throws **plain `Error`** (“do not share one exit”) not `KERNEL_*` | **CLOSED** — F8 `throwKernelCatalogDiagnostic` on journal-exit-split / early-return / unstable-key; `KernelAdmissionCatalog` proves helpers have no plain `Error` fence throws | **F8**, item **13** |

---

## Suggested sequencing (architecture + residuals)

```
P0: 1, 4, F7          → name/env out of production semantics
P1: 2, F2, F3, F4     → sole layout + ownership + beta port + alias
    F1 in parallel    → beta take-job verify (other agent)
P2: 3                 → typed frame ABI
P3a: 5, 6, 7, 8, F5, F8
P3b: 9, 10, 11, F6, D1–D3 as forced
P3c: 12, 13, D5–D6
Parallel coverage: D8 (AOT I/J) only after P1 layout stable
Never: R1 permanent fences / Marketplace greening as architecture proof
```

---

## Source map for this addendum

| Doc | Used for |
|-----|----------|
| `GOAL_KERNEL_LAYOUT_OWNERSHIP_FOLD.md` | F1–F4, D1–D3, R4 |
| `KERNEL_EXTENSION_INVENTORY.md` + `FENCE_MAP_7_18.md` | R1–R2, D9 |
| `REEVAL_STILL_OPEN.md` | R3, next-goal queue |
| `GOAL_KERNEL_COMPLETE_RESIDUALS.md` | Proof-object phase order vs this authority backlog |
| `KERNEL_AHEAD_OF_TIME_COMPOSE_PROXY.md` | D8 Waves I–J |
| `GOAL_FAMILY1_MULTI_STREAM_RESIDUALS.md` | R4 regression anchors |
| Live beta `graph.ts` / `compose.ts` / `layout-resolver.ts` / `StatefulContract.ts` | F5–F8, R5 |

---

## Post-MVP scan (after items 1–13 landed)

Fresh pass over fixtures tip + trackers. Items 1–13 stay **DONE (MVP)**; this section lists what is still open.

### New / refreshed followups (next goals)

| ID | Followup | Evidence now | Why next |
|----|----------|--------------|----------|
| **F1′** | Beta Gate A verify (`take job$` / `take job take job`) | **OPEN (advanced)** — refreshed marketplace artifacts (`initialize` now eligible). Past minting OP_SPLIT-96. Current: `take job$` fails at input 117 `MarketplaceV1.__message_bus1` OP_EQUALVERIFY (`layout dynamicChunkInputBase=53`, `graphFixedSize=53`). Evidence `kimp-f1-take-job-after-recompile.log`, `kimp-f1-take-job-dyn53.log` | Only marketplace proof that layout absolutes survive tip |
| **F2′** | Port sole-layout + compose authority onto **beta** | **DONE (thin)** on `kernel-beta-candidate`: ported `kernel-brands`, F45 diagnostics, fixtures `layout-resolver` (F3/F4/F33/F42 + `onlyIndices`), compose deferred `deferredLayoutClaims` → `resolveComposeTransactionLayoutAuthority` batch; layout units 39/39 green (`kimp-f2-layout-units-after2.log`) | Unblocks F1′ from missing-authority false failures |
| **F5′** | Purge remaining `publishJobEvent` / JobEvent string compares in STB | **DONE** — `legacyGroupLooksLikePublishJobEvent`; kernel `_permitsLegacyNamedValueChunkFallback` gates; proofs `LegacyJobEventNamePurge` + `kimp-f5prime-jobevent-purge.log` | Completes item 1 depth |
| **F5″** | Replace `graph.ts` `handlers.find(name === …)` joins with selector/`requireStableId` | **DONE** — `graph-handler-join.ts` `findMessageBusHandlerForInvocation` selector-first for `kernel-row-loop`; proof `GraphStableHandlerJoin` + `kimp-f5dprime-graph-stable-join.log` | Completes item 7 depth |
| **F7′** | Finish SOLIDC registry coverage / strict unknown-reject CI | **DONE** — `enforceSolidcEnvPolicy` / `assertNoUnknownSolidcEnvKeys` / `SOLIDC_STRICT_UNKNOWN_ENV`; `compileString` enforces when strict; cache/dump/oracle + residual DEBUG reads via `solidcEnvFlagEnabled`/`solidcEnvValue`; proof `SolidcEnvRegistry.test.ts` + `kimp-f7prime-strict-ci.log` | Item 4 depth |
| **F9′** | Cut over default materialization mode to `recipe` | **DONE** — default `recipe`; value/dyn converge refuse only would-apply OTC via `gateWouldApply*RepairsIfRecipe`; proof `RecipeDefaultMaterialization` + `kimp-f9prime-recipe-default.log` | Item 9 production semantics |
| **F8′** | Analyzer-first admission (retire retry ladder) | **DONE** — `recoverCompileByMonotoneRefusal` is compile recovery only; stamps stay `attribution-spans`; proof `AnalyzerFirstAdmission` + `kimp-f8prime-analyzer-first.log` | Item 13 depth |
| **F13′** | Eliminate `published-fallback` admission stamp | **DONE** — type + stamp path retired; kernel fails closed without spans; proof `AnalyzerFirstAdmission` + `kimp-f13prime-no-published-fallback.log` | Keeps item 13 honest on every contract shape |
| **F3′** | Preflight non-zero `valueChunkBandOffset` + independent PredOut physical | **DONE** — `publishedValueChunkBandOffsetFromGeometry` + optional PredOut claims; proof `PreflightBandOffsetAuthority` + `kimp-f3prime-preflight-bandoffset.log` (PredOut without published claims stays compose-path) | Item 2 depth |
| **F16′** | Document/test unique-selfdestruct rule | **DONE** — compiler `selfdestructEntryCount === 1`; proofs `UniqueSelfdestructAdmission` + ExternalAdmissionRetry/LifecycleTopology + `kimp-f16prime-unique-selfdestruct.log` | Avoid regressing ExternalAdmissionRetry vs KernelSelfdestructStateCompose |

### Deferrals (unchanged intent; priority after F1′/F2′)

| ID | Deferred | Trigger |
|----|----------|---------|
| **D1–D3** | Alias normalize, path-effect IR, fixpoint, ExecutionContext | Layout-fold phases 3/5/6/7 |
| **D4** | Mega-class phase rewrite | After F9′ prove authority direction |
| **D5–D6** | Compiler-published multi-axis budgets; pure admission ladder | After F8′ / plan digest-in-bytecode |
| **D7** | Full PredOut/sentinel adoption in compose relocatable sync | **DONE** — `layoutWitnessIsActiveCoordinate` gates compose relocatable PredOut/dyn; proof `PredOutSentinelComposeSync` + `kimp-d7-predout-sentinel-compose.log` |
| **D8** | AOT Waves I–J (I1–I10, J1–J9) | After F2′ layout port stable |
| **D9** | Inventory 1–6 marketplace re-verify | Beta-agent; pairs with F1′ |

### Residuals (still honest / still open)

**R1 permanent (unchanged):** foreign delegate (#15 — Fence #15 locked in `KernelFence15ForeignDelegateResiduals`), true sig circularity, Marketplace/`requiredKernelProofs` greening.

**R2 inventory 7–18 (unchanged fences; admitted subsets stand):** break/continue masks (#7 — Fence #7 locked), unbounded key vectors (#8 — Fence #8 locked in `KernelFence8ConstructedKeyResiduals`), mixed stream exits (#9 — Fence #9 locked in `KernelFence9MixedStreamResiduals`; former untransported helper/loop mixes now admit), residual aggregates (#10 — Fence #10 locked), varying recursive maps (#11 — Fence #11 locked in `KernelFence11RecursiveMappingResiduals`), runtime deploy loops (#12 — Fence #12 locked in `KernelFence12DeployResiduals`), detached lifecycle sig (#13 — Fence #13 locked), opaque assembly (#14 — Fence #14 locked in `KernelFence14OpaqueAssemblyResiduals`), collection/event/blockhash lifecycle (#16 — Fence #16 locked), relocatable multi-span / non-bool loop selection (#17 — Fence #17 locked), both-arms / non-bool / early-return bypass (#18 — Fence #18 locked). Permanent #15 foreign delegate locked in `KernelFence15ForeignDelegateResiduals`.

**R3 REEVAL:** DualRuntimeSet×keccak density **SETTLED** (`KernelDualRuntimeKeccakCompose`); collection/event/blockhash selfdestruct (Fence #16 negatives locked); detached lifecycle `sig` (Fence #13 negatives locked for split/merge/selfdestruct). Proxy DualRuntimeSet density reject remains `KernelDensityBoundedCompose`.

**R4 layout-fold leftovers:** Gate A (beta); phase 3 alias normalize (F4 depth); phases 5/6/7 D1/D2/D3 **COVERED (thin)**; MultiRow Dual residual negative kept.

**R6 post-MVP residuals:** see **Post-audit residual scan → R10**. Short list: F4/F6/F7/F7′/F8/F18/F21–F24/F27/F29/F31/F32/F38–F45 DONE; F33–F37 + F42–F44 DONE; D15/D16/D17 DONE; D11 DONE; AOT D8 I1–I10+J1–J9 covered (I5/I4/J6/J7 green settles; counter+emit incl. SelfToProxy sticky); still open — F1′/F2′ beta. D12/D14 DONE.

### Suggested next goal order (post-MVP)

```
1. F1′ + F2′   — beta port + take-job verify (other agent)
Never as architecture proof: R1 / Marketplace greening
Landed: audit step 1; F4/F6/F7/F7′/F8; F18/F21–F24/F27/F29/F31/F32; F33–F45; D15/D16/D17; D11 DONE; D8 I1–I10+J1–J9; D13 DONE (I4/I5/J6/J7 green; counter+emit incl. SelfToProxy sticky); F5′…F30 wedges
```


---

## Post-F5′/F5″/F16′ scan (fresh residual pass)

Live fixtures tip after name-authority tranche. Items 1–13 MVP and F5′/F5″/F16′ stay **DONE**. New rows below are additive; they do not reopen closed MVP claims.

### New followups (fixtures-implementable unless noted)

| ID | Followup | Evidence now | Why next |
|----|----------|--------------|----------|
| **F17** | Route `compose.ts` handler joins through selector/`findMessageBusHandlerForInvocation` | **DONE** — compose call sites use `findMessageBusHandlerForInvocation`; proof `ComposeStableHandlerJoin` + `kimp-f17-compose-stable-join.log` | Same failure class as F5″ on the compose authority path |
| **F18** | Replace `bindConsumerCallsites` name-first / first-match attribution | **DONE** — prefer `sourceCallsiteId`/selector; kernel `requireUniqueAttribution` fails closed on same-name collapse; proof `NameAuthorityLeftovers.test.ts` + `kimp-f18-callsite-attribution.log` | Original **F5** depth beyond handler join |
| **F19** | Route remaining `StatefulContract` `publishJobEvent` literals through legacy adapter | **DONE** — `legacyIsPublishJobEventName` / `legacyGroupLooksLikePublishJobEvent` in SC; proof `StatefulContractJobEventNamePurge` + `kimp-f19-sc-jobevent-purge.log` | Completes F5′ surface beyond STB |
| **F20** | Register remaining `SOLIDC_*` reads + strict unknown-reject CI mode | **DONE via F28 + F7′** — registration 49/49; strict CI + residual compiler reads routed through registry helpers | Item **4** / **F7′** depth |
| **F21** | Embed KernelExecutionPlan digest in route bytecode | **DONE** — SCKP push/drop commitment (`kernel-execution-plan-commitment.ts`); `stampKernelExecutionPlanCommitment` embeds digest in ASM; compose stamps `__kernel_plan_bytecode__` + `bytecodeCommitment`; proof `KernelExecutionPlanBytecodeAndVersion.test.ts` + `kimp-f21-digest-bytecode.log` | Prevents transplanting plan metadata without bytecode change |
| **F22** | Gate StatefulContract plan readers on `kernelPlanVersion` | **DONE** — `assertReadableKernelExecutionPlans` + SC `readKernelExecutionPlans` / `requireKernelExecutionPlanDigest` refuse missing publication, wrong version, and uncommitted digests; proof same suite + `kimp-f22-plan-version-gate.log` | Closes omitted-empty / legacy-missing plan ambiguity at SDK boundary |
| **F23** | Inventory **#9** token-container co-layout proof object | **DONE (read + transfer+dyn admit)** — bytes+TC **read** admits; **transfer+dyn** admits (plan graph effect frames before unframed refuse reserves `tokenContainer`+`tcTransfer`); stamps `tokenContainer-tcTransfer-plus-trailing-dyn`; proof `TokenContainerCoLayout` (6) + `kimp-f23-admit-*.log` | Transitive dual-journal / untransported mixed streams remain fenced |
| **F24** | Land look-ahead property suites (alpha-rename, reorder, digest integrity, hostile layout) | **DONE** — `look-ahead-properties.ts` runners over production digest/authorize/resolve/hostile generators; suite `KernelLookAheadProperties.test.ts` covers all four axes + aggregate; proof `kimp-f24-lookahead-suites.log` | Catches authority regressions the unit wedges miss |
| **F3** *(prior)* | Strengthen `assertUniqueOwnership` beyond identity key | **DONE (depth)** — conflicting-roles, coordinate-collision, overlapping-range, participant-boundary, fixed-suffix-crossing live in `layout-resolver.ts`; alias normalize still **F4**/D1 | Pairs with F3′ preflight bandOffset depth |
| **F8** *(prior)* | Unify plain `Error` / legacy diagnostic strings → `KERNEL_*` | **DONE** — see Followups F8; item 9 share-one-exit is `SolidcDiagnosticError`/`KERNEL_LAYOUT` | Stable refuse reasons for analyzer-first admission |

### New / refreshed deferrals

| ID | Deferred | Trigger |
|----|----------|---------|
| **D10** | Split mega-classes (`StatefulContract` ~42k LOC, STB ~23k, `compose` ~5.6k) onto phase boundaries | **PARTIAL (paused)** — STB→7160 / SC→**15454** / compose→275. Last greened: upsert domain/keys + key-topology. Proofs `kimp-d10-upsert-{domain,counter}-*.log`. **LOC grind paused by request**; residual early createBuilder entryAccesses + upsert value/fold mid-body remain when resumed. F1′/F2′ beta elsewhere |
| **D11** | Fail-closed DEFINE validation for **all** DEFINE kinds (not only route emission) | **DONE** — kernel fail-closes every DEFINE (user, route-physical, `__…`); return-aware leftover `anonymousLive = max(0, leftover - returnArity)` is the exact model for returns and for `__message_bus_verify_atomic*` / `__message_bus_parse_row` (`(value)` leftovers match return arity); proof `DefineFrameEmission.test.ts` + `kimp-d11-internals-done-proof.log` |
| **D12** | Compiler-published worst-case multi-axis budgets on artifacts | **DONE** — `messageBus.resourceBudgets` stamped via `buildMessageBusResourceBudgets`; kernel compose `authorizeComposeParticipantLayout` requires published budgets; proof `ResourceBudgetsPublish.test.ts` + `kimp-d12-resource-budgets-proof.log` |
| **D13** | AOT priority subset: **I3** fan-out → **J1** proxy view `__forward` → **I1** three-hop (+ diamond fan-in) | **DONE** — FanOut / ProxyViewReturn / ThreeHop / Diamond green under shared `messageBusVmAccepts` (`stateSuccess`); proofs `kimp-d13-aot-suite.log` + `kimp-d13-vm-accepts-unit.log` |
| **D14** | Effect-class heuristic budgets (`invocations + 5` style) → plan-published bounds | **DONE** — usage remains `mutableClaimCount + 2`; ceiling is compiler-published `resourceBudgets.maximumSemanticDerivationPasses` (compose refuses over-ceiling); proof same D12 suite + peers |
| **D1–D6, D8–D9** | Unchanged (alias / path-effect / fixpoint / ExecutionContext / AOT full / inventory re-verify); **D7** PredOut/sentinel compose sync DONE | As before |

### New residuals (honest; do not schedule as “quick greens”)

**R7 — Post-name-authority residuals**

| Residual | Notes |
|----------|-------|
| Compose name joins | F17 DONE — selector-first helper on compose path |
| `bindConsumerCallsites` guess | F18; capacity path already guess-free |
| SC JobEvent literals | F19 DONE — adapter-only; kernel gate unchanged |
| Unregistered `SOLIDC_*` | F28 registered 49/49; F7′ strict unknown-reject CI remains |
| Plan digest not in bytecode | F21 |
| `kernelPlanVersion` ungated at SC reader | F22 |
| #9 token-container co-layout | F23 DONE (read subset + proof) |
| Look-ahead suites | F24 DONE |
| Ownership identity-only | F3 prior |
| Plain `Error` refuse paths | F8 prior |
| Concrete vs physical PredOut optional threading | F3′/D7: physical via resolve; tagged sentinels gate relocatable sync; concreteLocal diagnostic |
| Effect-class heuristic budgets | D14 DONE |
| DEFINE fail-closed all kinds | D11 DONE |
| DualRuntimeSet×keccak; collection/event/blockhash selfdestruct; detached lifecycle sig | R3 unchanged |
| Inventory 7–18 residual shapes | R2 / `FENCE_MAP_7_18.md` unchanged |
| AOT I/J thin Kernel* (staticcall, LLC, returning-delegate profile, schema isolation) | D8/D13 |

**R1 permanent fences unchanged:** foreign delegate (#15), true sig circularity, Marketplace/`requiredKernelProofs`.

### Suggested next goal order (updated)

```
1. F1′ + F2′         — beta port + take-job verify (other agent / handoff)
2. F18 + F27 + F21/F22 — callsite attribution + delegate join + digest/plan-version
3. F31 + F7′         — PredOut preflight thread + SOLIDC strict CI
4. F23 / F24 / F29   — #9 token-container; look-ahead suites; JobEvent API migrate
5. D13 ⊂ D8          — AOT I3→J1→I1 once layout on beta
Never: R1 / Marketplace greening as architecture proof
Landed: items 1–13 MVP; F5′; F5″; F16′; F17; F19; F25; F26; F28; F3′; D7; F9′; F8′; F13′; F30; F3 ownership depth
```

### Source map for this scan

| Probe | Finding |
|-------|---------|
| `compose.ts` `handlers.find` | F17 DONE — routed through `findMessageBusHandlerForInvocation` |
| `StatefulContract.ts` `'publishJobEvent'` | F19 DONE — adapter-only under legacy gate |
| `SOLIDC_*` tree vs registry | 48 vs 25 → 23 unregistered → **F20** |
| `graph.ts` `bindConsumerCallsites` | name-first guess comment still live → **F18** |
| `materialization-mode.ts` | F9′ DONE — default `recipe` |
| `compiler.ts` `published-fallback` / `retryMonotoneAttribution` | F13′/F8′ DONE — fallback retired; `recoverCompileByMonotoneRefusal` |
| `preflight.ts` `assertAssemblyLayoutWitnessesMatchResolve` | F3′ DONE — non-zero bandOffset + optional PredOut claims |
| `KernelAdmission` token-container co-layout lock | → **F23 DONE** |
| `KERNEL_AHEAD_OF_TIME_COMPOSE_PROXY.md` leverage order | → **D13** |
| Mega-class `wc -l` | SC 42k / STB 23k / compose 5.6k → **D10** |

---

## Post-F17/F19 scan (fresh residual pass)

Live fixtures tip after compose + StatefulContract name-authority leftovers. Prior DONE rows stay closed. New findings below are additive.

### New followups

| ID | Followup | Evidence now | Why next |
|----|----------|--------------|----------|
| **F25** | Make `resolveMessageBusAbiFunction` / `resolveMessageBusHandler` selector-first under `kernel-row-loop` | **DONE** — selector authority under kernel; proof `ResolveMessageBusSelectorFirst` + `kimp-f25-resolve-selector-first.log` | F17 fixed `handlers.find`; this is the shared ABI/handler resolver still on the name path |
| **F26** | Prepared-call ↔ plan invocation gate by selector (name diagnostic only) under kernel | **DONE** — `preparedCallMatchesPlanInvocation` in compose; proof `PreparedCallSelectorGate` + `kimp-f26-prepared-call-selector-gate.log` | Same alpha-rename class; blocks F25 benefits at the compose descriptor boundary |
| **F27** | Proxy/delegate `findFunction` selector-aware join | **DONE** — `findDelegateAbiFunction` selector-first (+ messageBus handler selector bridge); name-only legacy fallback; proof `NameAuthorityLeftovers.test.ts` + `kimp-f27-delegate-selector.log` | Proxy implementation binding can miss renamed impl entry points |
| **F28** | Split F20: register **production-affecting** `SOLIDC_*` first | **DONE** — hot-set registered + `solidcEnvFlagEnabled` wires skip-binder/no-optimise; proof `SolidcEnvRegistry` F28 suite + `kimp-f28-production-solidc-registry.log` | Narrower than full F20; closes silent production/cache identity leaks sooner |
| **F29** | Migrate Marketplace-shaped JobEvent **helper API surface** onto adapter module | **DONE** — `legacy-job-event-helpers.ts` facade (neutral `legacy*` + JobEvent aliases); SC band/persist imports via adapter; proof `LegacyJobEventHelpersAdapter.test.ts` + `kimp-f29-jobevent-api.log`; D15 still retires Marketplace spellings later | Item 1 follow-on / feeds D10 mega-class split |

### Prior open (unchanged intent)

| ID | Status note |
|----|-------------|
| **F18** | `bindConsumerCallsites` name-first guess still documented live |
| **F20** | F28 hot-set landed; remaining DEBUG_*/strict unknown-reject CI still open (F7′) |
| **F21–F22** | **DONE** — SCKP bytecode commitment + SC `kernelPlanVersion` reader gate |
| **F23** | **DONE** — #9 token-container co-layout proof |
| **F24** | **DONE** — look-ahead property suites |
| **F3′** | **DONE** — non-zero bandOffset via published trailing slots; PredOut via optional published claims |
| **F1′/F2′** | beta Gate A + layout port (other agent) |
| **F7′/F8′/F9′/F13′** | F7′/F8′/F9′/F13′ DONE — strict unknown CI + recipe/admission wedges |
| **F3** | ownership strengthen **DONE**; residual alias normalize = F4 |
| **F8** | **DONE** — catalog diagnostic throws |

### New / refreshed deferrals

| ID | Deferred | Trigger |
|----|----------|---------|
| **D15** | Rename/retire JobEvent-branded STB public helpers (`getPublishJobEventsBand`, `persistedJobEvents*`, …) after F29 adapter cover | **DONE** — JobEvent-branded public aliases deleted; only `legacy*` neutrals exported from STB / adapter / `stateful/index`; fixtures tests migrated; proof `LegacyJobEventHelpersAdapter` + `JobEventsPersistReset` / `AssignPhysicalReturnIndices` / `CompositionSettlementSession` / `ValueChunkDescriptorAuthority` + `kimp-d15-proof2.log`. Beta titles must import neutrals before consuming this tip |
| **D16** | Unify `resolveMessageBus*` and `findMessageBusHandlerForInvocation` into one selector-authority module | **DONE** — `handler-selector-authority.ts` owns kernel selector joins; `resolveMessageBusHandler` + `findMessageBusHandlerForInvocation` funnel through it; proof `HandlerSelectorAuthority.test.ts` + `kimp-d16-selector-authority.log` |
| **D10–D14** | D11/D12/D14 DONE; D10 PARTIAL (compose-recipes + value-chunk-geometry + value-chunk-persist/F35); D13 AOT subset remain | D13 after F2′ |

### Residuals (R8 — post F17/F19)

| Residual | Notes |
|----------|-------|
| Name-first `resolveMessageBus*` | F25 DONE — selector-first under kernel |
| Prepared-call name equality gate | F26 DONE — `preparedCallMatchesPlanInvocation` |
| Delegate name-only ABI find | **F27** |
| Production `SOLIDC_*` unregistered | F28 DONE — hot-set registered; F20/F7′ strict CI remainder |
| JobEvent-branded helper API | **F29** / D15 |
| `bindConsumerCallsites` guess | F18 |
| bandOffset-0-only preflight | F3′ DONE — non-zero via published trailing slots |
| `devOracle` default / `published-fallback` / retry ladder | F9′/F13′/F8′ DONE — recipe default; no published-fallback; retry is compile recovery |
| #9 token-container co-layout | F23 |
| DualRuntimeSet×keccak; collection/event/blockhash selfdestruct; detached lifecycle sig | R3 |
| Inventory 7–18 residual shapes | R2 / fence map |
| AOT thin Kernel* (I1/I3/J1, staticcall, LLC, returning-delegate) | D8/D13 |
| Unique-selfdestruct N named kill paths | product proof object still needed (F16′ covered count===1) |
| Alias normalize | F4 / D1 (ownership depth otherwise DONE) |

**R1 permanent fences unchanged.**

### Suggested next goal order (updated)

```
1. F1′ + F2′           — beta port + take-job verify (other agent)
2. F18 + F27 + F21/F22 — callsite attribution + delegate join + digest/plan-version
3. F31 + F7′           — PredOut preflight thread + SOLIDC strict CI
4. F29 → D15; F23/F24  — JobEvent API migrate; #9 proof; look-ahead suites
5. D13 ⊂ D8            — AOT I3→J1→I1 once layout on beta
Never: R1 / Marketplace greening as architecture proof
Landed: 1–13 MVP; F5′; F5″; F16′; F17; F19; F25; F26; F28; F3′; D7; F9′; F8′; F13′; F30; F3 ownership depth
```

### Source map for this scan

| Probe | Finding |
|-------|---------|
| `resolveMessageBusAbiFunction` name-filter-first | F25 DONE — selector-first under kernel |
| `compose` `supplied.functionName !== invocation.function` | F26 DONE — `preparedCallMatchesPlanInvocation` |
| `delegate.ts` `findFunction` name-only | → **F27** |
| Unregistered production `SOLIDC_*` hot set | F28 DONE — registered + `solidcEnvFlagEnabled` |
| STB/SC JobEvent mention counts (~452/~128) | → **F29** |
| `assertUniqueOwnership` role/range/suffix checks | F3 DONE |
| `handlers.find` in compose | still none (F17 holds) |
| SC `'publishJobEvent'` literals | still none (F19 holds) |

---

## Post-F9′/F8′/F13′ scan (fresh residual pass)

Live fixtures tip after recipe default + analyzer-first admission + published-fallback retirement. Prior DONE rows stay closed. New findings below are additive.

### New followups

| ID | Followup | Evidence now | Why next |
|----|----------|--------------|----------|
| **F30** | Resource-converge recipe gate: refuse only **would-apply** proposals | **DONE** — `gateWouldApplyResourceRepairsIfRecipe` respects `canApply…skip`; proof `ResourceWouldApplyRecipeGate` + `kimp-f30-resource-would-apply.log` | Same bug class F9′ just fixed for value/dyn; fixtures-small parity |
| **F31** | Thread compose PredOut physical claims into preflight assert | **DONE** — compose `assembledPredOutClaimsByParticipant` from deferred layout claims; `preflightMessageBusTransaction` forwards into `assertAssemblyLayoutWitnessesMatchResolve`; proof `NameAuthorityLeftovers.test.ts` + `kimp-f31-predout-preflight.log` | Completes F3′ PredOut half on the finalized-tx gate |
| **F32** | Legacy messageBus stamp without spans | **DONE** — non-kernel path stamps `admissionSource: 'legacy-eligibility'` (never silent unset); `resolveMessageBusAdmissionSourceAuthority` fails closed on pre-F32 unstamped ids; proof `KernelLegacyAdmissionSource.test.ts` + `kimp-f32-admission-source.log` | Closes ambiguous “unstamped but has ids” SDK reads |
| **F7′** *(refresh)* | Strict unknown-reject CI + registry-routed reads | **DONE** — strict CI via `SOLIDC_STRICT_UNKNOWN_ENV` + `enforceSolidcEnvPolicy` on `compileString`; residual cache/dump/oracle/DEBUG routed through registry helpers; proof `SolidcEnvRegistry.test.ts` + `kimp-f7prime-strict-ci.log` | Item 4 depth after F28 registration |

### Prior open (unchanged intent)

| ID | Status note |
|----|-------------|
| **F18** | `bindConsumerCallsites` name-first guess still documented live |
| **F27** | `delegate.ts` `findFunction` name-only ABI lookup |
| **F21** | **DONE** — SCKP bytecode commitment + compose `__kernel_plan_bytecode__` stamp |
| **F22** | **DONE** — SC `readKernelExecutionPlans` gates on `kernelPlanVersion` + bytecode commitment |
| **F23** | **DONE** — co-layout proof + admitted bytes+TC read |
| **F24** | **DONE** — `look-ahead-properties.ts` + `KernelLookAheadProperties.test.ts` |
| **F29** | **DONE** — adapter facade; SC imports via `legacy-job-event-helpers` |
| **F1′/F2′** | Beta Gate A + layout port (other agent) |
| **F8** | Plain `Error` → `KERNEL_*` (e.g. “do not share one exit”) |

### New / refreshed deferrals

| ID | Deferred | Trigger |
|----|----------|---------|
| **D17** | Unify all converge recipe gates through one `gateWouldApply*RepairsIfRecipe` family (resource + value + dyn) | **DONE** — `gateWouldApplyRepairsIfRecipe` in `materialization-mode.ts`; resource/value/dyn domain gates funnel through it; proof `GateWouldApplyRecipeFamily.test.ts` + `kimp-d17-gate-family.log` |
| **D18** | Fail-closed DEFINE for all DEFINE kinds (item 3 follow-on) | **DONE via D11** — all DEFINE kinds fail-closed under kernel |
| **D10–D16** | Unchanged (mega-class split, budgets, AOT subset, JobEvent API retire, resolver unify) | As before |

### Residuals (R9 — post F9′/F8′/F13′)

| Residual | Notes |
|----------|-------|
| Resource converge would-apply parity | F30 DONE — `gateWouldApplyResourceRepairsIfRecipe` |
| PredOut preflight claims unthreaded | **F31** |
| Legacy unstamped admissionSource | **F32 DONE** — `legacy-eligibility` stamp |
| Strict unknown SOLIDC CI | **F7′** (registration complete) |
| `bindConsumerCallsites` guess | F18 |
| Delegate name-only find | F27 |
| Digest not in bytecode / plan-version ungated | F21 / F22 |
| #9 token-container co-layout | F23 |
| Look-ahead suites | F24 DONE |
| JobEvent helper API | F29 DONE; D15 spelling retire |
| DualRuntimeSet×keccak; collection/event/blockhash selfdestruct; detached lifecycle sig | R3 |
| Inventory 7–18 residual shapes | R2 / fence map |
| AOT thin Kernel* | D8/D13 **DONE** (I3→J1→I1+diamond under `messageBusVmAccepts`) |
| Plain `Error` refuse paths | F8 |

**R1 permanent fences unchanged.**

### Suggested next goal order (updated)

```
1. F1′ + F2′           — beta port + take-job verify (other agent)
2. F18 + F27 + F21/F22 — callsite attribution + delegate join + digest/plan-version
3. F31 + F7′           — PredOut preflight thread + SOLIDC strict CI
4. F23 / F24 / F29     — #9 proof; look-ahead suites; JobEvent API migrate
5. D13 ⊂ D8            — AOT I3→J1→I1 once layout on beta
Never: R1 / Marketplace greening as architecture proof
Landed: … + F9′ + F8′ + F13′ + F30 (+ F3 ownership depth)
```

### Source map for this scan

| Probe | Finding |
|-------|---------|
| `preflight.ts` `refuseVmExtractedRepairsIfRecipe(proposals.size)` before skip | F30 DONE — would-apply gate |
| Value/dyn `gateWouldApply*RepairsIfRecipe` | F9′ DONE |
| `predOutClaimsByParticipant` unused by default preflight | → **F31** |
| Legacy stamp deletes `admissionSource` | → **F32** |
| SOLIDC tree vs registry | 49 vs 49 → F28 DONE; F7′ = strict CI |
| GTT `process.env.SOLIDC_*` | 0 raw reads |
| `bindConsumerCallsites` guess comment | F18 live |
| `delegate.ts` findFunction name-only | F27 live |
| SC `kernelPlanVersion` | no hits → F22 |
| Fence #9 token-container | F23 DONE (read + proof; transfer residual) |

---

## Post-audit layout tranche (recommended step 1)

**DONE** on fixtures: transaction-global layout packing + slot exclusivity for audit highest-priority item 1.

| Deliverable | Evidence |
|-------------|----------|
| Distinct `inputBase` / `outputBase` (+ `absoluteInput` / `absoluteOutput`) | `layout-resolver.ts` `ResolvedParticipantLayout` / `ResolvedLayout` |
| Duplicate participant ids, band overlaps, invalid dimensions | `assertParticipantTopology` |
| Cross-claim slot exclusivity (dyn / valueChunk / entry NEW) | `assertResolvedClaimSlotExclusivity` |
| PredOut concrete-vs-physical fail-closed | throws `pred-out-concrete-vs-physical` |
| Compose consumes transaction-global packing + ownership claims | `resolveComposeParticipantLayoutAuthority` for every publishedBase including 0 |
| Ownership output-space bounds | `assertUniqueOwnership` uses `outputBase` for outputSlot/produceOutput |
| Production helper | `resolveTransactionLayoutWitnesses` / `resolveComposeParticipantLayoutAuthority` |
| Unit proofs | `TransactionGlobalLayoutAuthority` (base-0 collision + asymmetric prefix) + LayoutResolver / Ownership / ComposeLayoutAuthority; `{SCRATCH}/kimp-global-layout-resolve.log`, `kimp-layout-slot-exclusivity.log`, `kimp-global-layout-compile.log` |

**Still deferred (audit recommended steps 2–7 / items 2–14):** see **Post-audit residual scan** below.

---

## Post-audit residual scan (after layout step 1)

Live fixtures tip after transaction-global layout + exclusivity. Audit recommended step **1 DONE**; this section maps steps **2–7** and leftover layout depth to followups.

### New followups (audit-ordered)

| ID | Followup | Evidence now | Why next |
|----|----------|--------------|----------|
| **F33** | One deferred multi-claim batch resolve for all participants | **DONE** — `resolveComposeTransactionLayoutAuthority` merges all participant claims into one `resolveTransactionLayout`; compose defers via `deferredLayoutClaims` then batch resolve+apply; single-participant helper delegates to batch; proof `BatchLayoutResolveApply.test.ts` + `kimp-f33-batch-resolve.log` | Completes audit #1 “resolve the complete transaction once” |
| **F34** | Compiler `resourceFoldPlans` as sole SDK fold authority | **DONE** — `findPublishedResourceFoldPlan` / `instantiateResourceFoldPlan`; SC `buildChunkablePushFoldPlan` / `foldLeadingRouteArrayPushes` prefer `artifact.messageBus.resourceFoldPlans` (fail closed on miss); `foldChunkableResource` honest push/assign/update; proof `ResourceFoldPublishedAuthority.test.ts` + `kimp-f34-fold-authority.log` | Audit #2 / recommended step 3 |
| **F35** | `CompositionSession` / `BuildContext` for settlement state | **DONE** — `CompositionSettlementSession` owns settlement maps + embeds `ValueChunkWriteStagingSession`; helpers accept optional session / `runWith…`; proof `CompositionSettlementSession.test.ts` + `kimp-f35-composition-session.log` | Audit #3 / recommended step 2 — highest fragility under concurrency/tests |
| **F36** | VM preflight mutation-free (validator only) | **DONE** — `_assertConvergedFinalTransaction` gates on `allowsFinalizationVmRepairs` / `refuseFinalizationVmRepairsIfRecipe` before `_repairComputedChunkOutput`; recipe fails closed (validator only); `devOracle` retains repair loop; proof `VmFinalizationValidatorOnly.test.ts` + `kimp-f36-vm-validator.log` | Audit #4 / recommended step 4 |
| **F37** | Deployability / budget certificates on artifacts | **DONE** — `DeployabilityCertificate` on `messageBus.deployability`; compiler stamps via `buildDeployabilityCertificate` (asserted \| over-budget vs `P2SH_BYTECODE_LIMIT`); beta manifest uses concrete certificates (Marketplace over-budget, unicrow asserted); proof `DeployabilityCertificate.test.ts` + `kimp-f37-deployability.log` | Audit #5 / recommended step 5 |
| **F38** | Kernel admission on finalized typed effect IR | **DONE** — `finalized-typed-effect-ir.ts` + thin `PathEffectSchedule`; `assertPublishedChildDeploymentEffectIr` on kernel publish; analysis may use pre-final bridges but publication fails closed without `resultType`; proof `FinalizedTypedEffectIr.test.ts` + `kimp-f38-typed-effect-ir.log` | Audit #6 |
| **F39** | Explicit kernel capability schema + absence semantics | **DONE** — `kernel-capability-schema.ts` + `messageBus.capabilitySchema`; statuses asserted\|legacy\|unsupported\|inactive\|incomplete; `resolveKernelCapability` / `assertKernelCapabilityStatus`; compiler `stampKernelCapabilitySchema`; proof `KernelCapabilitySchema.test.ts` + `kimp-f39-capability-schema.log` | Audit #7 |
| **F40** | Canonical binary fingerprints (domain-separated) | **DONE** — `domain-separated-fingerprint.ts`; journal disposition + worklist artifact identity use domain-tagged length-prefixed SHA-256 (no raw JSON identity digests); proof `DomainSeparatedFingerprint.test.ts` + `kimp-f40-fingerprints.log` | Audit #8 |
| **F41** | Branded identity / coordinate types | **DONE** — `kernel-brands.ts` (`ParticipantId`, `AbsoluteInputIndex`, `AbsoluteOutputIndex`, `LocalSlotOffset`, `CategoryId`, `CollectionName`); layout-resolver resolved surfaces + `absoluteInput`/`absoluteOutput` return brands; proof `KernelBrandedTypes.test.ts` + `kimp-f41-branded-types.log` | Audit #9 |
| **F42** | Validate-all-then-write in `applyParticipantAbsoluteWitnesses` | **DONE** — stage all intended writes, validate every slot, commit only after full validation; late PredOut failure leaves earlier params untouched; proof `BatchLayoutResolveApply.test.ts` + `kimp-f42-validate-then-write.log` | Audit #10 residual |
| **F43** | Independent kernel reference interpreter + metamorphic suite | **DONE** — `kernel-reference-model.ts`: independent plan acceptance + length-prefixed digest + participant-base packing; agrees with production asserts/layout; proof `KernelReferenceAndHostilePlans.test.ts` + `kimp-f43-reference-model.log` | Audit #11 / recommended step 6 |
| **F44** | Hostile negative generators from positive plans | **DONE** — `hostile-plan-generators.ts`: hostile kernel plans / layouts / digest-integrity mutations from positives; production assert+compose+resolve refuse; proof same suite + `kimp-f44-hostile-generators.log` | Audit #12 |
| **F45** | Structured composition plan failure report | **DONE** — `CompositionPlanFailureReport` + `buildCompositionPlanFailureReport` / `formatCompositionPlanFailureReport` / `parseCompositionPlanFailureTrailer`; `layoutInvariantError` and `formatLayoutInvariant` emit structured trailer; compose throws carry `planFailure`; proof `KernelCompositionPlanFailure.test.ts` + `kimp-f45-structured-diagnostics.log` | Audit #13 |

### Prior open (unchanged intent)

| ID | Status note |
|----|-------------|
| **F1′/F2′** | Beta Gate A + layout port (other agent) |
| **F18** | DONE — sourceCallsiteId/selector + kernel unique attribution |
| **F27** | DONE — `findDelegateAbiFunction` selector-first |
| **F21/F22** | DONE — SCKP bytecode commitment + SC plan-version reader |
| **F23** | DONE — #9 token-container co-layout proof |
| **F29** | DONE — JobEvent helper API adapter facade |
| **F24** | DONE — look-ahead property suites |
| **F31** | DONE — compose PredOut claims threaded into default preflight |
| **F32** | DONE — `legacy-eligibility` stamp |
| **F7′** | DONE — `SOLIDC_STRICT_UNKNOWN_ENV` + `enforceSolidcEnvPolicy` on compile |
| **F8** | DONE — KERNEL_* catalog diagnostics |
| **D10 / A14** | Mega-class split along protocol boundaries |

### Residuals (R10 — post layout step 1)

| Residual | Notes |
|----------|-------|
| Per-participant compose resolve | F33 DONE — deferred multi-claim batch resolve |
| Fold rediscovery + append-shaped assign/update | F34 DONE — published plans preferred; honest push/assign/update |
| Module-level STB settlement maps | F35 DONE — `CompositionSettlementSession` + default/runWith |
| VM repair-as-planner loop | F36 DONE — recipe gates finalization repair; validator only |
| Deployability not-asserted | F37 DONE — concrete asserted\|over-budget certificates |
| JSON.stringify identity digests | F40 DONE — domain-separated binary fingerprints |
| Mid-apply param mutation | F42 DONE — validate-all-then-write |
| DualRuntimeSet×keccak; collection/event/blockhash selfdestruct; detached lifecycle sig | R3 |
| Inventory 7–18 residual shapes | R2 |
| AOT thin Kernel* | D8/D13 **DONE** (I3→J1→I1+diamond under `messageBusVmAccepts`) |

**R1 permanent fences unchanged.**

### Suggested next goal order (post-audit)

```
1. F1′ + F2′     — beta port + take-job verify (other agent; unblocks title confidence)
Never: R1 / Marketplace greening; widen KERNEL_* families before remaining audit depth
Landed: audit step 1; F4/F6/F7/F7′/F8; F18/F21–F24/F27/F29/F31/F32; F33–F45; D15/D16/D17; D11 DONE; D8 I1–I10+J1–J9 (I4/I5/J6/J7 green; counter+emit incl. SelfToProxy sticky); prior F5′…F30 wedges
```


### Source map for this scan

| Probe | Finding |
|-------|---------|
| `compose` `resolveComposeParticipantLayoutAuthority` per participant | F33 DONE — `resolveComposeTransactionLayoutAuthority` batch |
| `resourceFoldPlans` publish vs SC rebuild + append assign | F34 DONE — prefer published / fail closed on miss |
| STB `persistedJobEvents*` / observed chunk module maps | F35 DONE — session-owned |
| STB computed-output repair / finalization mutate loop | F36 DONE — recipe refuses before `_repairComputedChunkOutput` |
| `kernel-beta-manifest.json` deployability not-asserted | F37 DONE — concrete certificates on artifacts + manifest |
| `worklist.ts` / `kernel-journal-disposition.ts` JSON.stringify | F40 DONE — domain-separated fingerprints |
| `applyParticipantAbsoluteWitnesses` incremental `params[index]=` | F42 DONE — validate-all-then-write |
| `bindConsumerCallsites` guess comment | F18 live |
| `foldChunkableResource` non-initial → appendElement | F34 DONE — assign replaces; update requires applicator |
