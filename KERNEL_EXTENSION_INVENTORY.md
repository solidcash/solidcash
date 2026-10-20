# Kernel extension inventory (goal session)

Branch: `grok/kernel-comprehensive-fixtures`  
Scope: full inventory below. **Beta implement order: 1–6.** Items **7–18** are explicit fences / post-beta unless a Marketplace title proves immediate need.

Stay clear of Marketplace vocabulary in fixtures, `requiredKernelProofs`, and plan-wave labels in product code.

## Immediate, evidence-backed extensions (beta)

### 1. Compiler-published caller identity per callsite
Publish caller lock, participant-local authentication offset, and identity role explicitly. Do **not** infer it from proxy/delegate state.

### 2. Multiple transported continuation resources
Replace the remaining one-resource composer fence (`one routed participant cannot publish multiple continuation resource lanes`) with ordered per-resource claims: owner, collection signature, key slot, digest, chunk count, and band offset.

### 3. Multi-row argument framing
Fix mixed-handler routes where the decoder computes a split beyond the encoded payload. Each row needs authoritative calldata start/length metadata.

### 4. Batched callsite identity
Preserve the distinction among physical callsite ID, source callsite ID, batch logical index, and occurrence throughout discovery, composition, and result consumption.

### 5. Multi-producer result dependencies
Handle two calls producing results consumed by later rows, including fan-in, sibling outState, repeated calls to the same selector, and conditional producers. Consumers must reference **producer IDs**, never cloned call nodes.

### 6. Multiple computed writes by one participant
Cover distinct collections, distinct keys in one collection, repeated writes to one key, and mixed INSERT/UPDATE resources in source order.

## Known compiler admission extensions (fence / post-beta)

| # | Extension | Notes |
|---|---|---|
| 7 | `break` / `continue` in runtime counter loops | Needs authenticated execution mask or row-domain; permutation alone cannot represent skipped iterations |
| 8 | Runtime-constructed key vectors | Authenticate array length, element order, aliases, mutation points, and exact iteration snapshot per row |
| 9 | Mixed dynamic state and collection writes | Generalize bytes/string-plus-mapping layout fence with explicit non-overlapping output span descriptors |
| 10 | Whole-struct and aggregate getters | Whole structs, `Record[]`, nested dynamic members, fixed/dynamic struct arrays; segmented result framing when >1 NFT commitment |
| 11 | Recursive and nested mappings | Complete key-path metadata; authenticate every mapping level |
| 12 | Child creation inside kernel rows | `new Child`, multiple/conditional sites, `create2` with salt, ctor args, category provenance, output topology |
| 13 | Transaction-signature rows | Extend `sig` / `checkSig` / `checkMultiSig` only with explicit per-row provenance + frame ownership; detached leaves stay fenced |
| 14 | Typed assembly effects | Admit Yul only with verified stack/effect summary; opaque `OP_*` blocks remain refused |
| 15 | Foreign delegate execution | Four explicit roles: state owner, implementation, caller, executor; authenticate impl bytecode; no silent foreign state ownership |
| 16 | Dynamic lifecycle topology | split/merge/upgrade/selfdestruct/deploy/unsafe on dynamic resources only after published ownership/retirement topology |
| 17 | Variable-width participant blocks | Relocatable continuation/dynamic/event/return/sidecar/lifecycle spans without incidental output-order coordinates |
| 18 | Conditional and zero-width effects | Absent event/transfer/result/continuation at runtime without shifting later coordinates or placeholder authority |

## Cross-cutting matrix (every extension)

For each closable item, fixtures must cover where applicable:

- Direct owner, CREATE identity, proxy, and delegate execution
- High-level call, raw call, and static call
- Same selector at multiple callsites
- Conditional / repeated occurrences
- Fan-in and fan-out
- INSERT, UPDATE, DELETE, and read-after-write
- Inline versus chunked values
- Kernel / legacy observable parity
- Kernel size growth proportional to handler logic, not maximum row count
- Fresh compilation with no hidden speculative stack/codegen failure

## Architectural invariants (from beta handoff)

1. Every graph call has exactly one stable callsite identity.
2. Later calls consume authenticated producer-result IDs, never cloned call AST nodes.
3. Graph handlers stay behind one consistent `OP_INVOKE` boundary.
4. Fresh successful compilation has no hidden speculative errors.
5. Support is expressed by type/effect/flow/layout properties, never names or application shapes.
6. Differential tests compare kernel/legacy observable semantics; route-size tests prove size ∝ row logic.

## Post-beta / fenced admissions (7–18)

Authoritative gate/fixture map: [`FENCE_MAP_7_18.md`](./FENCE_MAP_7_18.md). Do not widen beta for these unless a Marketplace title forces the wedge. Locked admission negatives (one residual shape each):

| # | Catalog | Primary negative fixture(s) |
|---|---|---|
| 7 | `KERNEL_UNBOUNDED_KEY` | `KernelEscapeControlPredicates` runtime-selected / reachable non-progressing `continue` |
| 8 | `KERNEL_UNBOUNDED_KEY` / `KERNEL_LAYOUT` | Runtime fill / multi-arm residuals: `KernelRuntimeArrayFillKeys`, … Admitted settle: hash160 constructed-key UPDATE (`KernelConstructedKeyCompose`) |
| 9 | `KERNEL_LAYOUT` | Conditional / early-return / untransported chunkable mixed streams. Admitted: independently indexed bytes+mapping journal (`KernelMixedBytesMappingJournal`) |
| 10 | `KERNEL_LAYOUT` / `KERNEL_TX_SIGNATURE` | Residual aggregate getters. Admitted settle: mixed nested ABI returns (`KernelReturnAggregateCompose`) |
| 11 | `KERNEL_LAYOUT` | Residual recursive derived invariants. Admitted settle: nested foreign vmap (`KernelNestedForeignVmapCompose`) |
| 12 | `KERNEL_LAYOUT` / `KERNEL_LIFECYCLE` | Residual runtime-count deploy loops. Admitted settle: typed Yul CREATE (`KernelTypedYulCreateCompose`) |
| 13 | `KERNEL_TX_SIGNATURE` | Residual circular / lifecycle sig. Admitted settle: data-only sig result (`KernelDataOnlySignatureResultCompose`) |
| 14 | `KERNEL_OPAQUE_EFFECT` | Residual opaque/divergent assembly. Admitted settle: closed pure assembly (`KernelSafeNativeAssemblyCompose`) |
| 15 | `KERNEL_FOREIGN_DELEGATE` | `KernelAdmission` `refuses foreign delegatecall as KERNEL_FOREIGN_DELEGATE` |
| 16 | `KERNEL_LIFECYCLE` | `KernelLifecycleTopology` collection-bearing + statement-form state selfdestruct; `KernelAdmission` unsafe(0/1) |
| 17 | `KERNEL_LAYOUT` | Relocatable multi-span blocks; loop-nested external value-chunk trailing slots under atomic compose. Admitted: unconditional/bool-param multi-resource fixed chunkable; hetero loop streams with compose inline ≤60B **and ≥61B** + batch long chunks (`KernelHeteroLoopStreamsCompose`); bool-param same-iter selection (`KernelSameIterSelectionCompose`) |
| 18 | `KERNEL_LAYOUT` | Both-arms non-loop chunkable selection; non-bool selection; early-return bypass. Admitted: unconditional emit beside ≥2 mutation streams (`KernelMultiStreamEventCompose`); bool-param empty-else fixed-chunkable; bool-param-selected emit beside journal (`KernelSelectedEventCompose`) |

## Session status

Post-beta planning follows the missing-proof-object order (resource-indexed multi-stream → path/effect schedules → key-domain → aggregates → lifecycle → assembly/signature; foreign delegate stays fenced).

| Item | Status |
|---|---|
| 1 | **Landed + re-verified** — `KernelCallsiteCallerIdentityCompose`, `KernelBatchedCallsiteIdentityCompose`, `KernelCallsiteCallerIdentityProxyDelegateCompose` (proxy + own-impl delegate) |
| 2 | **Landed + verified** — multi-resource fixed chunkable + bool-param activation; family-1 A/B/C loop residuals (`KernelHeteroLoopStreamsCompose`, `KernelSameIterSelectionCompose`, `KernelMultiStreamEventCompose`) |
| 3 | **Landed** — `encodeMessageBatch` publishes per-row `calldataStart`/`calldataLength`; mixed-arity settle (`KernelMixedHandlerRowFramingCompose`, `MessageBatchEncoding`) |
| 4 | **Landed on tip** (`9137ab4cc`) — batched callsite four-tuple |
| 5 | **Landed** — multi-producer result fan-in under compose (`KernelMultiProducerResultCompose`); swapped-lane fail-closed |
| 6 | **Landed** — multi-write claims: dual scalar collections + terminal same-key collapse (`KernelMultiCollectionWriteCompose`); chunkable multi-resource already via `KernelMultiContinuationResourceCompose` |
| 7–18 | **Partially admitted / residual** — see [`FENCE_MAP_7_18.md`](./FENCE_MAP_7_18.md) and per-row admitted columns below. Still fenced: #7 maskable break/continue, #15 foreign delegate, #17 relocatable multi-span beyond trailing-band loop chunks, #18 both-arms/non-bool/early-return; #9 token-container co-layout residual; true sig circularity |

**Family 1 status:** A (hetero int+bytes loops), B (bool-param same-iter selection), C (unconditional emit beside ≥2 streams) admitted under resource-indexed stream metadata. Mixed scalar+rawbytes groups stay on the per-row mint path (scalar journal dirtying disabled when a rawbytes sibling shares the execution group). Compose settles inline (≤60B) **and external (≥61B)** loop-nested chunkable tails once the route publishes `__internal__valueChunkOutputBase` + a balanced trailing band and composed loop mints occupy in-band `valueChunkOutputs` (same path as fixed-key COND). Batch long chunks remain a direct-settlement regression. Still fenced under #17: relocatable multi-span blocks beyond that admitted trailing-band subset.

Proof dir: `/tmp/grok-goal-6d38cca74b23/implementer/ext-plans/`

## Marketplace-motivated general gaps (fixtures)

See [`KERNEL_MARKETPLACE_MOTIVATED_GENERAL_GAPS.md`](./KERNEL_MARKETPLACE_MOTIVATED_GENERAL_GAPS.md).
**G2 landed:** nested returning address → later graph-emission address arg settles under solidity-compat ABI address **value** lanes (`KernelNestedReturningGraphArgCompose`); call-target address params stay native.
**G2b landed:** address fields inside structs on graph-emission / message-bus args project to ABI words; settle `KernelNestedReturningStructAddressCompose`. G3/G4/G2c deferred. Does not widen inventory #15 foreign delegate.
