# Kernel improvement backlog (authority audit → prioritized list)

**Implementation status (fixtures `grok/kernel-comprehensive-fixtures`):** items **1–13 MVP landed** with shipped modules + unit proofs. Full GTT rewrite / every-DEFINE symbolic verify / mega-class phase migration / beta take-job (F1) remain follow-on depth — see status lines under each item.

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
- **Follow-on:** migrate remaining Marketplace-named STB helper surfaces fully onto the adapter module (API rename depth).

### 2. Make the layout resolver the only coordinate authority — **DONE (ownership + resolve + STB/preflight wire)**
- **Status:** Stronger `assertUniqueOwnership`; compose resolve+apply; STB `assignValueChunkOutputBaseFromResolve` / resolve-gated `refreshCapturedValueChunkOutputBase`; preflight `assertAssemblyLayoutWitnessesMatchResolve` on bandOffset-0 fills; tests `LayoutOwnershipAuthority` + `LayoutResolveAuthorityWire`.
- **Follow-on:** non-zero bandOffset / PredOut independent physical in preflight; alias normalize (F4); beta port (F2).

### 3. Replace implicit stack bookkeeping with a typed handler-frame ABI — **DONE (DEFINE emission wired)**
- **Status:** `@solidcash/utils` `handler-frame-abi`; GTT `emitFunctionDefine` calls `validateDefineEmission` (same entry as tests); `DefineFrameEmission.test.ts` drives `compileString` → real DEFINE path; fail-closed on injected anonymous live. Proof `{SCRATCH}/kimp-item3-frame-abi.log`.
- **Follow-on:** finer per-helper stack-effect recording inside DEFINE bodies; fail-closed for all DEFINE kinds.

### 4. Remove environment-dependent production semantics — **DONE (registry)**
- **Status:** `solidc-env-registry.ts`; `ownerAltAnchor` / `handlerBandModel` on `CompilerOptions` + cache identity; GTT reads options not raw env; unknown `SOLIDC_*` ignored; tests `SolidcEnvRegistry.test.ts`.
- **Follow-on:** classify remaining ~200 SOLIDC names; reject unknown in strict CI mode.

### 5. Publish one versioned, digest-bound KernelExecutionPlan — **DONE (compose authority)**
- **Status:** `authorizeComposeParticipantLayout` builds plan + digest; digest stamped into `publishedRelocations`; proof `ComposeKernelAuthorityLive` / `kimp-behavioral-live.log`.
- **Follow-on:** embed digest in route bytecode.

### 6. Stop overloading `undefined` as both legacy and empty — **DONE (enforced on compose path)**
- **Status:** `assertKernelPlanComplete` inside `authorizeComposeParticipantLayout` (compose calls it); over-budget/incomplete fail closed; proof `ComposeKernelAuthorityLive`.
- **Follow-on:** gate StatefulContract reader on `kernelPlanVersion`.

### 7. Use stable IDs everywhere — **DONE (selector-keyed + F5″ graph)**
- **Status:** `handlerSelector` (ABI selector hex) is `StableId.id`; diagnostic name only in `diagnosticName`; alpha-rename proof in `ComposeKernelAuthorityLive`; graph joins selector-first via `graph-handler-join.ts` (F5″).
- **Follow-on:** `bindConsumerCallsites` name-first attribution (F18); compose joins landed as F17.

### 8. Replace magic sentinels with tagged internal values — **DONE (MVP + apply live)**
- **Status:** `decodeLayoutCoordinate` in apply; tagged rebase in resolve; proof `kimp-item8.log`.
- **Follow-on:** full PredOut path through tagged values only — compose relocatable gate landed as **D7**.

### 9. Make VM execution validation-only, not the normal state planner — **DONE (recipe gate + F9′ default)**
- **Status:** `refuseVmExtractedRepairsIfRecipe` before applying VM-mined proposals; default mode **`recipe` (F9′)**; `devOracle` explicit opt-in; proof `RecipeDefaultMaterialization` + `ComposeKernelAuthorityLive`.
- **Follow-on:** marketplace titles that still need converge must call `setMaterializationMode('devOracle')` explicitly.

### 10. Make all convergence monotone — **DONE (MVP + preflight live)**
- **Status:** `MonotoneCell` placeholder→resolve + `freezeGeometry` on converge exit; proof `kimp-item10.log`.
- **Follow-on:** drive all repair loops through the lattice.

### 11. Separate planning phases with immutable data — **DONE (compose authority)**
- **Status:** `authorizeComposeParticipantLayout` advances to `absoluteLayout` + `assertGeometryFrozen`; proof `ComposeKernelAuthorityLive`.
- **Follow-on:** migrate mega-classes onto phase boundaries (D4).

### 12. Publish multidimensional resource budgets — **DONE (enforced on compose path)**
- **Status:** `assertWithinKernelBudgets` inside `authorizeComposeParticipantLayout`; proof `ComposeKernelAuthorityLive` over-budget throw.
- **Follow-on:** compiler publish worst-case bounds onto artifacts.

### 13. Make speculative admission a pure analysis pass — **DONE (non-tautological span gate)**
- **Status:** Span-based analysis (`admissionSource: 'attribution-spans'`) with `refusedHandlerIds`; unique modifier-only selfdestruct stays admitted, selfdestruct *swarms* stay `KERNEL_LIFECYCLE` (ExternalAdmissionRetry); `assertPublishedHandlersMatchAdmission` + gate counter; proof `{SCRATCH}/kimp-item13.log`.
- **Follow-on:** replace retry ladder with analyzer-first decisions (F8).

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
| **F4** | **Alias normalize** (layout-fold phase 3) — unify collection/carrier aliases before ownership claims | Deferred in `GOAL_KERNEL_LAYOUT_OWNERSHIP_FOLD.md` | Item **2** / **7** |
| **F5** | **Replace `bindConsumerCallsites` name-first attribution** — graph.ts acknowledges by-name/first-match collapse for same-name callsites | Same failure class as item **1**/**7** on the graph path | Items **1**, **7** |
| **F6** | **Retire deferred-compute / VM discovery as default planner** — `compose.ts` `deferredComputeCache` + preflight converge/repair | Dev oracle OK; production path should be recipe-once | Items **9**, **10** |
| **F7** | **Compile-cache / artifact identity audit** — `SOLIDC_COMPILE_CACHE*` + option bits in cache key; ensure execution-affecting env never silent | Overlaps item **4** + look-ahead cold/cached hash suite | Items **4**, **5** |
| **F8** | **Unify `KERNEL_*` catalog vs legacy diagnostic strings** — fence map notes plain `Error` / pre-catalog strings still appear | Fail-closed reasons must be stable for pure admission (item **13**) | Item **13**, fence map |

---

## Deferrals (pay-as-you-go; do not start before P0–P2 unless forced)

| ID | Deferred work | Tracker home | Trigger to un-defer |
|----|---------------|--------------|---------------------|
| **D1** | Path-effect IR (thin; fold activations) | Layout-fold phase 5 | Multi-row fold needs activation schedules beyond bool-param |
| **D2** | Constraint / fixpoint solver | Layout-fold phase 6; backlog item **10** | Residual non-monotone repair cycles after sole-layout cutover |
| **D3** | Typed ExecutionContext | Layout-fold phase 7; backlog item **11** | Frame ABI (item **3**) lands first |
| **D4** | Full phase pipeline rewrite of four mega-classes | Backlog item **11** | After items 1–4 prove authority direction |
| **D5** | Multidimensional budgets beyond rows/blob | Backlog item **12** | After KernelExecutionPlan (item **5**) exists to hang bounds on |
| **D6** | Speculative admission → pure analyzer | Backlog item **13** | After stable IDs + KERNEL_* catalog (items **7**, **F8**) |
| **D7** | Tagged sentinel internal values / PredOut relocatable sync | **DONE** — see Post-MVP D7 (`layoutWitnessIsActiveCoordinate` + compose gate) | Item **8** follow-on |
| **D8** | AOT Wave I/J Kernel\* proofs (three-hop, fan-in/out, staticcall, proxy shapes, …) | `KERNEL_AHEAD_OF_TIME_COMPOSE_PROXY.md` | Ladder-agnostic coverage; **not** Marketplace greening; after layout authority stable |
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
| 9 | Conditional/early-return / untransported chunkable mixed streams (independent bytes+mapping journal admitted) | `KERNEL_LAYOUT` |
| 10 | Residual aggregate getters / recursive structs (mixed nested ABI returns admitted) | `KERNEL_LAYOUT` / `KERNEL_TX_SIGNATURE` |
| 11 | Varying/unlowered recursive mapping reads (nested foreign vmap admitted) | `KERNEL_LAYOUT` |
| 12 | Runtime-count / escaping deploy loops (typed Yul CREATE admitted) | `KERNEL_LAYOUT` / `KERNEL_LIFECYCLE` |
| 13 | Detached lifecycle `sig` leaves | `KERNEL_TX_SIGNATURE` |
| 14 | Opaque / unverified assembly | `KERNEL_OPAQUE_EFFECT` |
| 15 | Foreign delegate | permanent |
| 16 | Collection/event/blockhash/write-bearing lifecycle; `unsafe` 0/1 | `KERNEL_LIFECYCLE` |
| 17 | Fully relocatable multi-span blocks; non-bool / counter-derived selection beyond admitted trailing-band subset | `KERNEL_LAYOUT` |
| 18 | Both-arms non-loop chunkable; non-bool selection; zero-width coordinate shifts; early-return bypass (bool-param selected emit admitted) | `KERNEL_LAYOUT` |

Authoritative gate/fixture map: `FENCE_MAP_7_18.md`.

### R3 — REEVAL still-open (non-inventory)

- **DualRuntimeSet-width × keccak density** — inherent trailing-capacity margin (probe max trailing 130)
- **Collection/event/blockhash-bearing selfdestruct** — honest `KERNEL_LIFECYCLE`; product path remains multi-tx `StatefulContract.destroy()`
- **Detached `sig` on lifecycle handlers** — honest `KERNEL_TX_SIGNATURE`

### R4 — Layout-fold / family-1 leftovers

- Family-1 A/B/C **admitted** on fixtures (hetero loop, same-iter selection, event beside ≥2 streams) — treat as **regression anchors**, not open residuals
- Layout-fold open: **Gate A (beta)** + deferred phases **3/5/6/7** (alias, path-effect IR, fixpoint, ExecutionContext) — see Followups/Deferrals
- Multi-row fold residual negative (Dual writeBoth → `KERNEL_LAYOUT`) **kept** — do not “green” by widening admission without proof object

### R5 — Additional architectural residuals (not in items 1–13, still real)

| Residual | Evidence | Maps to |
|----------|----------|---------|
| Graph handler/result joins still fall back to **function name** / selector | `graph.ts` `handlers.find(… name === …)`, `bindConsumerCallsites` name-first comment | Items **1**, **7**, **F5** |
| **Legacy vs kernel** provenance (`legacy-logical` source callsite, omitted empty metadata) | `graph.ts` / `StatefulContract.ts` ~32641 | Items **5**, **6** |
| **Concrete vs physical** PredOut still threaded as optional `concreteLocalSlot` | `layout-resolver.ts` / `compose.ts` PredOut physical path | Items **2**, **8** |
| Effect-class **heuristic** budgets (`invocations + 5` style comments in compose) | `compose.ts` ~5004 | Item **12** |
| Item 9 fence throws **plain `Error`** (“do not share one exit”) not `KERNEL_*` | `FENCE_MAP_7_18.md` notes | **F8**, item **13** |

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
| **F1′** | Beta Gate A verify (`take job$` / `take job take job`) | Layout-fold Gate A still unchecked; handoff exists | Only marketplace proof that layout absolutes survive tip |
| **F2′** | Port sole-layout + compose authority onto **beta** | Fixtures-only; beta tip may lack resolver/apply/stamp | Without port, F1′ can fail for missing code not for drift |
| **F5′** | Purge remaining `publishJobEvent` / JobEvent string compares in STB | **DONE** — `legacyGroupLooksLikePublishJobEvent`; kernel `_permitsLegacyNamedValueChunkFallback` gates; proofs `LegacyJobEventNamePurge` + `kimp-f5prime-jobevent-purge.log` | Completes item 1 depth |
| **F5″** | Replace `graph.ts` `handlers.find(name === …)` joins with selector/`requireStableId` | **DONE** — `graph-handler-join.ts` `findMessageBusHandlerForInvocation` selector-first for `kernel-row-loop`; proof `GraphStableHandlerJoin` + `kimp-f5dprime-graph-stable-join.log` | Completes item 7 depth |
| **F7′** | Finish SOLIDC registry coverage / strict unknown-reject CI | Registry **49/49** (F28); GTT 0 raw `process.env.SOLIDC_*`; remainder = strict CI reject + residual compiler raw reads | Item 4 depth |
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

**R1 permanent (unchanged):** foreign delegate (#15), true sig circularity, Marketplace/`requiredKernelProofs` greening.

**R2 inventory 7–18 (unchanged fences; admitted subsets stand):** break/continue masks (#7), unbounded key vectors (#8), mixed stream exits (#9), residual aggregates (#10), varying recursive maps (#11), runtime deploy loops (#12), detached lifecycle sig (#13), opaque assembly (#14), collection/event/blockhash lifecycle (#16), relocatable multi-span / non-bool selection (#17), both-arms / early-return / zero-width (#18).

**R3 REEVAL still-open:** DualRuntimeSet×keccak density; collection/event/blockhash selfdestruct; detached lifecycle `sig`.

**R4 layout-fold leftovers:** Gate A (beta); phases 3/5/6/7; MultiRow Dual residual negative kept.

**R6 post-MVP residuals:** see **Post-F9′/F8′/F13′ scan → R9** for the latest table. Short list: F30 DONE; still open — F18 callsite guess; F27 delegate name join; F7′ strict CI; F21–F24; F23 #9; F29 JobEvent API; F31 PredOut preflight; F32 legacy stamp; F1′/F2′ beta; AOT D8.

### Suggested next goal order (post-MVP)

```
1. F1′ + F2′   — beta port + take-job verify (unblocks title ladder confidence)
2. F18 + F27 + F21/F22 — callsite attribution + delegate join + digest/plan-version
3. F31 + F7′   — PredOut preflight thread + SOLIDC strict CI
4. F23/F24/F29 — #9 token-container; look-ahead suites; JobEvent API
5. D8 AOT I/J  — coverage proofs once layout authority is on beta
Landed: F5′ + F5″ + F16′ + F17 + F19 + F25 + F26 + F28 + F3′ + D7 + F9′ + F8′ + F13′ + F30 (+ F3 ownership depth)
Never as architecture proof: R1 / Marketplace greening
```

---

## Post-F5′/F5″/F16′ scan (fresh residual pass)

Live fixtures tip after name-authority tranche. Items 1–13 MVP and F5′/F5″/F16′ stay **DONE**. New rows below are additive; they do not reopen closed MVP claims.

### New followups (fixtures-implementable unless noted)

| ID | Followup | Evidence now | Why next |
|----|----------|--------------|----------|
| **F17** | Route `compose.ts` handler joins through selector/`findMessageBusHandlerForInvocation` | **DONE** — compose call sites use `findMessageBusHandlerForInvocation`; proof `ComposeStableHandlerJoin` + `kimp-f17-compose-stable-join.log` | Same failure class as F5″ on the compose authority path |
| **F18** | Replace `bindConsumerCallsites` name-first / first-match attribution | `graph.ts` still documents by-name guess that collapses same-name callsites; surplus capacity deliberately guess-free | Original **F5** depth beyond handler join |
| **F19** | Route remaining `StatefulContract` `publishJobEvent` literals through legacy adapter | **DONE** — `legacyIsPublishJobEventName` / `legacyGroupLooksLikePublishJobEvent` in SC; proof `StatefulContractJobEventNamePurge` + `kimp-f19-sc-jobevent-purge.log` | Completes F5′ surface beyond STB |
| **F20** | Register remaining `SOLIDC_*` reads + strict unknown-reject CI mode | **Registration DONE via F28** (49/49 names). Remainder is **F7′** strict unknown-reject CI + route residual raw reads through registry helpers | Item **4** / **F7′** depth |
| **F21** | Embed KernelExecutionPlan digest in route bytecode | Digest stamped into `publishedRelocations` only (item 5 follow-on) | Prevents transplanting plan metadata without bytecode change |
| **F22** | Gate StatefulContract plan readers on `kernelPlanVersion` | Item 6 follow-on still open | Closes omitted-empty / legacy-missing plan ambiguity at SDK boundary |
| **F23** | Inventory **#9** token-container co-layout proof object | `KernelAdmission` locks dynamic-bytes + `tokens[category]` as residual (missing `tokenContainer` block slot); fence map #9 partial column | Honest #9 residual; needs non-overlapping span descriptor before admit |
| **F24** | Land look-ahead property suites (alpha-rename, reorder, digest integrity, hostile layout) | Suites listed under “Look-ahead tests”; only fragments exist via ComposeKernelAuthorityLive / LegacyJobEventNamePurge | Catches authority regressions the unit wedges miss |
| **F3** *(prior)* | Strengthen `assertUniqueOwnership` beyond identity key | **DONE (depth)** — conflicting-roles, coordinate-collision, overlapping-range, participant-boundary, fixed-suffix-crossing live in `layout-resolver.ts`; alias normalize still **F4**/D1 | Pairs with F3′ preflight bandOffset depth |
| **F8** *(prior)* | Unify plain `Error` / legacy diagnostic strings → `KERNEL_*` | Fence map: item 9 “do not share one exit” still plain `Error` | Stable refuse reasons for analyzer-first admission |

### New / refreshed deferrals

| ID | Deferred | Trigger |
|----|----------|---------|
| **D10** | Split mega-classes (`StatefulContract` ~42k LOC, STB ~23k, `compose` ~5.6k) onto phase boundaries | After F9′/F17 prove authority direction; supersedes vague D4 sizing |
| **D11** | Fail-closed DEFINE validation for **all** DEFINE kinds (not only route emission) | After F21 digest-in-bytecode; item 3 follow-on |
| **D12** | Compiler-published worst-case multi-axis budgets on artifacts | After F8′ analyzer-first; item 12 follow-on |
| **D13** | AOT priority subset: **I3** fan-out → **J1** proxy view `__forward` → **I1** three-hop (from AOT doc leverage order) | After F2′ layout port; narrows D8 |
| **D14** | Effect-class heuristic budgets (`invocations + 5` style) → plan-published bounds | After D12 |
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
| #9 token-container co-layout | F23 / inventory #9 |
| Look-ahead suites thin | F24 |
| Ownership identity-only | F3 prior |
| Plain `Error` refuse paths | F8 prior |
| Concrete vs physical PredOut optional threading | F3′/D7: physical via resolve; tagged sentinels gate relocatable sync; concreteLocal diagnostic |
| Effect-class heuristic budgets | D14 |
| DEFINE soft for non-route | D11 |
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
| `KernelAdmission` token-container co-layout lock | → **F23** |
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
| **F27** | Proxy/delegate `findFunction` selector-aware join | `delegate.ts` ~311 `artifact.abi.find(name === …)` name-only | Proxy implementation binding can miss renamed impl entry points |
| **F28** | Split F20: register **production-affecting** `SOLIDC_*` first | **DONE** — hot-set registered + `solidcEnvFlagEnabled` wires skip-binder/no-optimise; proof `SolidcEnvRegistry` F28 suite + `kimp-f28-production-solidc-registry.log` | Narrower than full F20; closes silent production/cache identity leaks sooner |
| **F29** | Migrate Marketplace-shaped JobEvent **helper API surface** onto adapter module | STB still ~452 `JobEvent`/`publishJob` mentions; SC ~128 — planning compares purged (F5′/F19), public helper names remain | Item 1 follow-on / feeds D10 mega-class split |

### Prior open (unchanged intent)

| ID | Status note |
|----|-------------|
| **F18** | `bindConsumerCallsites` name-first guess still documented live |
| **F20** | F28 hot-set landed; remaining DEBUG_*/strict unknown-reject CI still open (F7′) |
| **F21–F24** | digest-in-bytecode; `kernelPlanVersion` SC gate; #9 token-container; look-ahead suites |
| **F3′** | **DONE** — non-zero bandOffset via published trailing slots; PredOut via optional published claims |
| **F1′/F2′** | beta Gate A + layout port (other agent) |
| **F7′/F8′/F9′/F13′** | F8′/F9′/F13′ DONE; F7′ SOLIDC strict unknown-reject CI still open |
| **F3** | ownership strengthen **DONE**; residual alias normalize = F4 |
| **F8** | plain `Error` → `KERNEL_*` still open |

### New / refreshed deferrals

| ID | Deferred | Trigger |
|----|----------|---------|
| **D15** | Rename/retire JobEvent-branded STB public helpers (`getPublishJobEventsBand`, `persistedJobEvents*`, …) after F29 adapter cover | After F29 + marketplace beta titles no longer import old names |
| **D16** | Unify `resolveMessageBus*` and `findMessageBusHandlerForInvocation` into one selector-authority module | After F25/F26 land; avoid dual resolvers drifting |
| **D10–D14** | Unchanged (mega-class split, all-DEFINE fail-closed, artifact budgets, AOT I3→J1→I1, effect-class budgets) | As before |

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
| **F31** | Thread compose PredOut physical claims into preflight assert | F3′ added optional `predOutClaimsByParticipant`; default `preflightMessageBusTransaction` never supplies it — PredOut check stays compose-path unless claims are threaded | Completes F3′ PredOut half on the finalized-tx gate |
| **F32** | Legacy messageBus stamp without spans | Non-kernel path leaves `admissionSource` unset and copies published eligible ids (F13′). Product may want documented legacy stamp or fail-closed for all conventions | Closes ambiguous “unstamped but has ids” SDK reads |
| **F7′** *(refresh)* | Strict unknown-reject CI + registry-routed reads | Registry coverage **49/49**; GTT has **0** raw `process.env.SOLIDC_*` (options-routed). Remaining: `unknownSolidcEnvKeys` reject mode in CI; residual compiler raw reads for debug/cache | Item 4 depth after F28 registration |

### Prior open (unchanged intent)

| ID | Status note |
|----|-------------|
| **F18** | `bindConsumerCallsites` name-first guess still documented live |
| **F27** | `delegate.ts` `findFunction` name-only ABI lookup |
| **F21** | Plan digest in `publishedRelocations` / authority results only — not route bytecode |
| **F22** | No `kernelPlanVersion` gate in StatefulContract readers |
| **F23** | #9 token-container co-layout still locked (missing block slot) |
| **F24** | Look-ahead property suites still thin (fragments only) |
| **F29** | JobEvent-branded helper API surface (~452 STB / ~128 SC) |
| **F1′/F2′** | Beta Gate A + layout port (other agent) |
| **F8** | Plain `Error` → `KERNEL_*` (e.g. “do not share one exit”) |

### New / refreshed deferrals

| ID | Deferred | Trigger |
|----|----------|---------|
| **D17** | Unify all converge recipe gates through one `gateWouldApply*RepairsIfRecipe` family (resource + value + dyn) | After F30 |
| **D18** | Fail-closed DEFINE for all DEFINE kinds (item 3 follow-on) | After F21 |
| **D10–D16** | Unchanged (mega-class split, budgets, AOT subset, JobEvent API retire, resolver unify) | As before |

### Residuals (R9 — post F9′/F8′/F13′)

| Residual | Notes |
|----------|-------|
| Resource converge would-apply parity | F30 DONE — `gateWouldApplyResourceRepairsIfRecipe` |
| PredOut preflight claims unthreaded | **F31** |
| Legacy unstamped admissionSource | **F32** |
| Strict unknown SOLIDC CI | **F7′** (registration complete) |
| `bindConsumerCallsites` guess | F18 |
| Delegate name-only find | F27 |
| Digest not in bytecode / plan-version ungated | F21 / F22 |
| #9 token-container co-layout | F23 |
| Look-ahead suites thin | F24 |
| JobEvent helper API | F29 |
| DualRuntimeSet×keccak; collection/event/blockhash selfdestruct; detached lifecycle sig | R3 |
| Inventory 7–18 residual shapes | R2 / fence map |
| AOT thin Kernel* | D8/D13 |
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
| Fence #9 token-container | F23 live |
