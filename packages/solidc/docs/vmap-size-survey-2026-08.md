# Vmap bytecode-size survey (2026-08-11)

This survey re-evaluates the vmap size work on current `solidcash_v0.13.1` HEAD (`9d37eae24`) and separately on
`codex/eacc-general-compile-perf` (`dc31a3dd1`). It treats the
authenticated membership/exclusion semantics in `verified-mappings.md` as non-negotiable and looks for reuse that
does not restore the omission-prone entry model.

The reproducible probes are:

- `yarn -s tsx scripts/vmap-size-survey.ts`
- `SOLIDCASH_NO_OUTLINE=1 yarn -s tsx scripts/vmap-size-survey.ts`
- `yarn -s tsx scripts/vmap-covenant-size.ts`

Sizes below use `artifact.debug.bytecode`, the actual hex-encoded binary. `artifact.bytecode` is assembly text, so
its character count is not a contract-byte count. Some older size notes and tests use `artifact.bytecode.length / 2`
as a drift proxy; that number must not be compared with the 10,000-byte consensus limit.

## Implemented result

The selected compatible changes are now implemented on this worktree. The tables below retain the pre-change
baseline for reproducibility; the measured post-change result is:

| Shape | Before | After | Saving |
|---|---:|---:|---:|
| One scalar vmap read | 368 | 355 | 13 (3.5%) |
| One scalar vmap write | 552 | 541 | 11 (2.0%) |
| One scalar vmap RMW | 632 | 617 | 15 (2.4%) |
| Fixed writes 2 | 1,658 | 1,226 | 432 (26.1%) |
| Fixed writes 3 | 2,915 | 1,717 | 1,198 (41.1%) |
| Fixed writes 4 | 4,672 | 2,267 | 2,405 (51.5%) |
| Fixed writes 5 | 6,829 | 2,789 | 4,040 (59.2%) |
| Fixed writes 6 | 9,259 | 3,303 | 5,956 (64.3%) |
| Fixed writes 7 | 12,119 | 3,841 | 8,278 (68.3%) |

The linear batch path is selected for straight-line fixed writes without topology-owning operations. Runtime keys
can still alias, so the covenant treats ranks as an explicitly checked permutation: it bounds and pairwise
distinguishes them, then binds every runtime slot to its unique sorted `(slot,next)` row. Aliasing consequently fails
closed. It also verifies exact blob size, strict row order, successor links, predecessor recreation, categories,
capabilities, commitments, and exact predecessor-output cardinality.

The entry covenant is 104 bytes versus 142 before (38 bytes smaller when revealed). It embeds the category once,
keeps the read-path mutable/category self-pin, and retains the write-path master-category comparison. The digested,
domain-separated value-chunk covenant is 116 bytes versus 210 (94 bytes smaller). Removing the category pin was
rejected: P2SH32 authenticates the redeem script, not the token category.

Against the historical `contracts-scash` mirror in `.worktrees/effectiveacceleration-marketplace`, compiled with
the same current options on `codex/eacc-general-compile-perf` and this worktree, `MarketplaceDataV1` fell from 4,997
to 4,771 debug bytes (226 bytes, 4.5%) and from 5,207 to 4,999 release bytes (208 bytes, 4.0%). `MarketplaceV1`,
which has no affected vmap shape in this mirror, remained exactly 1,971/2,122 bytes.

### Security-audit validation

The hostile-witness review found one material omission in the first linear verifier draft: ranks were range-checked
but not required to be distinct. Honest SDK construction always produced a permutation, but a malicious witness
combined with runtime-aliasing keys could reuse a rank and leave another row unbound. The emitted covenant now
checks every rank pair for inequality before row binding, and adversarial tests cover aliasing, invalid ranks,
reordered/duplicated rows, forged links, wrong proofs, wrong predecessor indices, wrong commitments, capability and
category substitution, missing/reordered/redirected nodes, and orphan outputs.

The factored entry write path explicitly authenticates the current NFT as mutable and category-pinned before it
compares that category with the minting master. The generated value-chunk address additionally refuses compilation
unless its category and domain placeholders each occur exactly once in the covenant template. Residual security
assumptions are the existing hash collision resistance, CashToken introspection semantics, and P2SH32 script-hash
authentication; no category identity is inferred from P2SH32 itself.

## Pre-change executive result

The proposed optimization list divides into three groups:

1. **Already substantially implemented:** cross-function subroutine extraction, collection-address sharing,
   common sorted-output verification, same-entry metadata coalescing, pending-value
   caching, fixed-write batching, and broad whole-script outlining.
2. **Still valuable:** replace the quadratic fixed-write transition verifier, cache repeated scalar reads within one
   entry point, use a rolling cursor for long values, and fuse repeated input/output scans.
3. **Format replacement before first release:** factored single-category-pinned covenants save 38 bytes from every
   revealed entry or chunk covenant and remove runtime category-specialized address construction. There is no
   released state to migrate, so the current format can be replaced outright. An unsafe mapping class can be smaller
   but changes language security semantics and should not be an inferred optimization.

The single largest pre-change blocker was the fixed-write batch verifier. Seven distinct straight-line writes produced a
12,119-byte contract and were rejected at compilation. Cross-function duplication was no longer the leading problem:
the general outliner reduces repeated entry points by 32-46% in the measured cases.

## Current binary baseline

All cases are direct-route, forced-stateful, optimized one-contract probes.

| Shape | Binary bytes | Useful comparison |
|---|---:|---|
| Empty stateful entry point | 101 | shared scaffold floor |
| Scalar state read | 253 | |
| Scalar state write | 255 | |
| Declared but unused mapping | 101 | zero contract-byte premium |
| One scalar vmap read | 368 | +115 vs scalar read |
| One scalar vmap write | 552 | +297 vs scalar write |
| One scalar vmap RMW | 632 | +80 vs vmap write |
| One dynamic-bytes state read | 446 | |
| One vmap-bytes read | 394 | 52 smaller in this probe |
| One dynamic-bytes state write | 622 | |
| One vmap-bytes write | 792 | +170 vs dynamic state bytes |

The old claim that a simple vmap read is 479 bytes is stale. It is 368 bytes in the equivalent current probe after
the later helper allocator, peephole, constant pooling, and whole-script outlining changes.

### Marginal reads in one entry point

| Shape | Bytes | Marginal bytes |
|---|---:|---:|
| One key | 368 | - |
| Two distinct keys | 557 | +189 |
| Three distinct keys | 716 | +159 |
| Same key read twice | 444 | +76 over one read |
| Same key read three times | 497 | +53 over two reads |

The semantic/layout pass already collapses repeated identical keys to one `entryAccess`. It does not fully reuse the
decoded scalar value, so repeated source reads retain a measurable 53-76 byte marginal cost. This is the cleanest
remaining compatible cache target. Cache invalidation is local: invalidate on a pending write to the same slot;
branch joins require either identical cached definitions or no cache. External calls do not mutate the already
co-spent input state, though `outState` reads are a different source and must never alias this cache.

### Cross-function sharing

| Shape | Outlining on | `SOLIDCASH_NO_OUTLINE=1` | Saving |
|---|---:|---:|---:|---:|
| Two equivalent read entry points | 487 | 717 | 230 (32.1%) |
| Three equivalent read entry points | 545 | 1,007 | 462 (45.9%) |
| Two equivalent write entry points | 855 | 1,270 | 415 (32.7%) |

The outliner creates a 143-byte shared read span in the two-read case and a 109-byte shared write span in the
two-write case, plus smaller shared spans. Therefore, adding another hand-written whole-read/whole-write helper is
unlikely to beat the existing measured whole-script outliner. New explicit helpers should target data that is not
byte-identical at call sites, such as depth-sensitive frames or same-function repeated reads separated by source
logic.

### Fixed-write batch growth

| Distinct writes | Binary bytes | Increment |
|---:|---:|---:|
| 1 | 552 | - |
| 2 | 1,658 | +1,106 |
| 3 | 2,915 | +1,257 |
| 4 | 4,672 | +1,757 |
| 5 | 6,829 | +2,157 |
| 6 | 9,259 | +2,430 |
| 7 | 12,119 | +2,860; rejected |

This confirms quadratic growth on current HEAD. The batch is security-critical—it handles shared predecessors,
adjacent insert chains, mixed update/insert transitions, exact cardinality, and aliases—but its pairwise rank and
minimality proofs should not be unrolled per pair.

The preferred replacement is a single authenticated loop over an SDK-supplied, slot-sorted transition blob:

1. Bind every logical write's runtime `H(key)` to one blob row and prove a bounded rank/permutation.
2. Validate row slots strictly increase once.
3. Validate each original proof node once and each adjacent output link once.
4. Accumulate or compare the exact distinct predecessor and emitted-node counts once.
5. Bind computed values to their ranked output rows.

This changes an O(N^2) set of pairwise comparisons into O(N) row/link checks. The blob cannot be trusted for
ordering merely because the SDK produced it; the covenant must verify ordering, permutation, and linkage. A dynamic
`OP_BEGIN`/`OP_UNTIL` verifier also makes static bytecode nearly independent of N, which is more important than a
small constant-factor cleanup of the existing unrolled path.

## `codex/eacc-general-compile-perf` comparison

The EACC branch is not merely a compile-time optimization branch. It contains vmap correctness changes for routed
physical batch slots and deliberately removes the authenticated-absence helper from mapping reads. The helper copied
`[H(k), slot, next]` into a canonical `OP_INVOKE` frame; in an outlined route handler that progressive `OP_PICK`
sequence could capture the wrong handler context and replace `next` with `H(k)`. EACC keeps the proof inline and
anchors every proof instruction against outlining. Any optimization proposed here must preserve that restriction or
replace it with an explicitly passed, route-safe frame proven by VM tests.

Current HEAD and EACC agree exactly on the important fixed-write and one-access results:

| Shape | Current HEAD | EACC | Delta |
|---|---:|---:|---:|
| One vmap read | 368 | 368 | 0 |
| One vmap write | 552 | 552 | 0 |
| One vmap RMW | 632 | 632 | 0 |
| Fixed writes 2/3/4/5/6/7 | 1,658/2,915/4,672/6,829/9,259/12,119 | identical | 0 |
| Same key twice | 444 | 451 | +7 |
| Same key three times | 497 | 521 | +24 |
| Two distinct reads, one function | 557 | 564 | +7 |
| Three distinct reads, one function | 716 | 740 | +24 |
| Two read entry points | 487 | 496 | +9 |
| Three read entry points | 545 | 569 | +24 |
| Two write entry points | 855 | 855 | 0 |

The small read growth is the intentional cost of keeping the absence proof in its original frame and source-debug
space. It raises the repeated-scalar-read cache opportunity to 83 bytes for the second same-key read and 70 for the
third on the EACC branch. It does not change the priority ordering: the quadratic batch verifier remains dominant.

EACC also caches initial outliner candidate discovery across ranking strategies, interns constant/opcode keys, reuses
outline byte prefixes and ordered occurrences, and avoids copying candidate regions. These reduce compiler work; they
do not license a different bytecode cost model. The comparison above uses the branch's emitted bytes, so the survey's
outlining conclusions include its actual safety anchors and selection behavior.

### EffectiveAcceleration Marketplace integration snapshot

The separate `.worktrees/effectiveacceleration-marketplace` worktree was inspected too. It is not a clean branch
snapshot: four compiler/SDK files have uncommitted integration work, and its generated artifacts were refreshed at
different times on 2026-08-11. The following is therefore application evidence from that live worktree, not a
reproducible commit-to-commit compiler benchmark.

Using each artifact's actual hex `debug.bytecode` rather than the stale assembly-character metric in
`examples/effectiveacceleration/BYTECODE_OPTIMIZATION_BASELINE.md`:

| Contract | Whole binary | Mapping collections | ABI entry accesses |
|---|---:|---:|---:|
| MarketplaceV1 | 408,050 | 1 | 5 |
| MarketplaceV2 | 138,046 | 2 | 8 |
| MarketplaceV3 | 138,022 | 2 | 8 |
| MarketplaceDataV1 | 92,352 | 6 | 40 |
| Unicrow | 15,337 | 1 | 9 |
| EACCToken | 13,960 | 3 | 14 |
| UnicrowArbitrator | 8,205 | 1 | 6 |
| UnicrowDispute | 7,432 | 2 | 8 |
| FakeToken | 6,798 | 2 | 10 |

This separates two phenomena. MarketplaceV1's largest functions have zero vmap entry accesses, so vmap removal
would not make that 408 KB monolith fit consensus; it needs route/facet splitting and general structural reduction.
MarketplaceDataV1 is different: its `initialize` has eight vmap accesses, all in one fixed batch, and its function
body alone is 31,252 bytes. That real application shape strongly validates the synthetic fixed-batch priority.
Ordinary one-entry vmap methods in the same artifact are much smaller (roughly 1.4-3.7 KB), while the eight-write
initializer is the outlier.

EACCToken also shows the normal operating range: `transfer` has two batched entries and a 1,411-byte body;
`transferFrom` has three and a 1,918-byte body; public one-entry reads are about 131-139 bytes after contract-wide
helper sharing. The fixed-batch explosion is therefore sensitive to transition/value complexity, not merely the
number of mapping declarations.

The marketplace worktree's handoff history also documents that aggressive raw outlining repeatedly conflicted with
route frame discovery and SDK trace extraction. This reinforces the survey's recommendation to move those consumers
to explicit metadata before lowering the outliner window, and to treat EACC's inline absence-proof anchors as a
correctness constraint rather than removable overhead.

## Survey of each proposed optimization

### 1. Shared generated subroutines

**Status: mature, with narrow remaining gaps.** The compiler already has cost-gated helpers for category equality,
sorted value outputs, and one collection-specific entry-address derivation. Current main also has an authenticated
absence helper, but EACC correctly disables it for routed-handler frame safety. The compiler then runs a
whole-script repeated-span outliner across entry-point and helper bodies and separately across the top-level script.
Helper IDs are assigned from the one-byte script-number pool by measured hotness.

Remaining opportunities:

- Design a route-safe absence-proof interface. Do not restore the old three-`PICK` helper unchanged. Either retain
  EACC's inline proof or pass a fully explicit proof frame whose values are copied before entering an outlined
  handler context and VM-test it on routed/delegate layouts.
- Canonicalize the delegate sorted-output frame. Delegate writes currently keep the verifier inline because
  `OP_INVOKE` changes the altstack return frame around the proxy-master index. Passing the proxy master index as an
  explicit ordinary-stack field would make the helper safe and collection-independent.
- Make SDK derivation consume explicit debug metadata rather than rediscovering short instruction shapes. The
  outliner currently cannot use its theoretically optimal 5-instruction window because script-shape readers break;
  ordinary contracts probe down to 7/10 while message-bus routes remain at 12. Removing structural coupling would
  unlock more small repeated fragments globally, including vmap fragments.
- Preserve source attribution for failures inside shared helpers. Today attributed verify/split operations are
  anchors. A helper-aware instruction-pointer mapping would permit spans containing those operations without losing
  error locations.

These are general compiler improvements. They are worthwhile, but the measured cross-function numbers show that the
present outliner has already captured most large byte-identical vmap duplication.

### 2. Deduplicate equivalent access paths

**Status: strong across functions, partial within one function.** Structural entry identity already coalesces the
same collection/key to one ABI slot, and pending writes provide read-after-write semantics. Whole-function outlining
deduplicates equivalent entry points.

The remaining concrete target is a per-entry-point scalar authenticated-read cache keyed by `entrySlotIndex` and
read source (input state versus finalized `outState`). The measured upper bound is 76 bytes for the second identical
read and another 53 for the third. It should cache the materialized value, not only `H(key)` or the address, because
the latter are already shared or have much smaller remaining premiums.

Do not merge:

- input-state reads with `outState` reads;
- two runtime-alias slots merely because they can select the same predecessor;
- reads across a write unless the cache is updated to the pending value;
- branch-local caches at a join unless both branches define the same value.

### 3. Cache hash, address, and authenticated entry data

**Status: mixed.** Collection-address computation is already a cost-gated helper; same-slot writes retain encoded
key/value registers; compound values have `sortedCompositeValueCache`; repeated field writes are coalesced into one
whole-value RMW.

Further stack-lifetime caching of a collection address is not automatically better than the existing helper. It
saves repeated runtime hashing but adds a long-lived stack cell and `PICK`/cleanup operations whose depths vary.
Benchmark it only on same-function multi-key accesses. The cache should be function-local and enabled only when its
measured use count repays setup and cleanup.

`H(key)` caching is most attractive for one RMW slot. A scalar RMW costs only 80 bytes beyond a pure write now, so
the historical expectation of saving a full second vmap read is no longer valid. Thread the already computed hash
through the pending-write flush rather than creating an independent global hash cache.

### 4. Batch fixed writes and shared absence proofs

**Status: semantically complete, size-critical.** The shipped atomic batch closes shared-gap and alias attacks, but
the table above proves it is now the dominant bytecode problem. This is Priority 1 for implementation.

The linear transition-blob verifier should be prototyped before micro-optimizing the current pairwise code. Required
differential tests include every adversarial mutation in `VMapBatchAdversarial`, shared predecessor inserts,
adjacent chains, mixed updates/inserts, duplicate slots, rank duplication/omission, conditional no-ops,
swap-remove aliases, computed values, and forged output cardinality.

### 5. Avoid unnecessary HEAD sentinels

**Status: no contract-byte issue; possible deployment-state optimization.** An unused mapping adds zero bytes to the
measured contract (101 bytes with or without the declaration), but deployment currently creates one HEAD UTXO for
every sorted collection.

Skipping HEAD for a merely unused mapping is not a free optimization: a future upgrade that begins using the same
declared collection cannot perform its first authenticated insert without an anchor. Safe choices are:

- prune a private/internal mapping only when the artifact also removes it from the upgrade-visible storage schema;
- add an authenticated upgrade-time collection-initialization transition; or
- keep the current eager HEAD for upgrade compatibility.

This saves one genesis output, one mutable NFT, and its covenant reveal later—not contract bytecode. It ranks below
the verifier and covenant-format work unless deployment footprint itself is the objective.

### 6. Rolling cursor for long values

**Status: not implemented.** Both vmap value chunks and ordinary dynamic chunks currently copy the full value and
compute `HEAD + i*chunkSize`, then split from the beginning on every iteration. Maintain `remaining` as loop state,
split its next chunk, and replace it with the tail. This removes multiplication, offset addition, and prefix
traversal from each runtime iteration. The loop must prove `remaining` is empty at exit and retain the exact chunk
count and deterministic commitment/index checks.

Static savings are modest because the current logic is one runtime loop, not unrolled per chunk. Runtime savings
grow with value length, so this is Priority 3 after the batch verifier and scalar-read cache.

### 7. Fuse chunk/address cardinality scans

**Status: not generally fused.** `emitVerifyChunkUtxoCount` emits a full transaction scan for orphan bounds and old
chunk consumption. Several vmap collections or chunked values can therefore traverse the same input/output vector
repeatedly.

Use one scan with a compact table of `(address, expectedInputCount, expectedOutputCount)` and counters. Each UTXO
must be compared against the relevant addresses, so runtime comparison work remains O(outputs * addresses), but the
loop/control and introspection scaffolding is emitted once. Fuse only addresses live in the same route; do not use a
global exact-output-count shortcut because transfers, events, calls, returns, and change outputs are legitimate.

This is Priority 4. It composes naturally with the linear transition blob, which already needs collection-level
exact cardinality.

### 8. Single-category-pinned, collection-specific entry covenants

**Status: measured prototype; immediate pre-release format replacement.** `scripts/vmap-covenant-size.ts` measures
both the safe single-pin design and the fully category-independent alternative:

| Redeem script | Current | Single pin | Factored/digested | Saving | No category pin |
|---|---:|---:|---:|---:|---:|
| Entry | 142 | 108 | 104 | 38 bytes (26.8%) | 75 |
| Root-addressed value chunk | 210 | 176 | 116 | 94 bytes (44.8%) | 143 |

The recommended entry prototype factors the mutable current-input capability/category check before the branch. The
write branch compares the retained entry base directly to the supplied minting master's base; the read branch drops
that retained base and preserves the exact input category, bytecode, commitment, token amount, and satoshis. This
embeds the category only once and measures four bytes smaller than merely deleting the write branch's duplicate.

The chunk prototype additionally replaces three executed-and-dropped salts—fixed-width
`"value-chunk" || collectionHash || slot || root`—with their HASH256 digest. The tagged concatenation is unambiguous
(fixed-width 20 + 32 + 32 byte fields), and collision resistance remains 256-bit. The outer P2SH32 still
authenticates the complete covenant. This removes 56 more redeem-script bytes while binding the same tuple.

P2SH32 only authenticates the redeem script; it does not bind CashToken metadata. A fully category-independent
address is therefore not a safe local replacement: the current read/absence verifier relies in part on the
category-specialized address, so a foreign-category fake predecessor could be accepted unless every access path
adds an explicit category-base check. It would also make all contracts with the same collection signature share a
provider-visible P2SH32 address, aggregating unrelated history and spam. Keep one category pin even if all compiler
paths are later hardened independently.

This saves transaction bytes on every revealed covenant and shortens category-specialized address reconstruction.
It changes every entry/chunk P2SH32 address, but SolidCash has no released deployments whose state must remain
spendable. Replace the current format everywhere:

- make the single-category-pinned builder the sole entry/chunk covenant builder;
- shorten compiler runtime address reconstruction consistently;
- update deploy, query, transaction-builder, trace-derivation, and test fixtures together;
- regenerate artifacts and reject the old format implicitly by no longer recognizing its addresses.

Do not add format markers, dual readers, migration covenants, or mixed-version handling. They would add code and test
surface for compatibility that does not exist. This is the largest available constant-factor reduction and should
land before further work creates more fixtures around the category-specialized format.

#### Estimated replacement wins

The redeem-script reduction is exact. Including the push opcode that reveals a P2SH redeem script, a normal entry
input falls from 144 bytes (`OP_PUSHDATA1 + length + 142`) to 106 bytes: **38 bytes saved per co-spent mapping proof
input**. A value-chunk reveal falls from 212 to 118 bytes: **94 bytes saved per consumed chunk**.

The compiled contract currently reconstructs one category-specialized entry address through an approximately
97-byte fragment. The single-pin design removes one 32-byte constant plus nearby comparison scaffolding, but the
exact static saving needs a compiler prototype; do not count the 61-byte constant-address estimate from the unsafe
fully independent variant.

| Operation | Proof inputs | Entry reveal saving |
|---|---:|---:|
| One mapping read/write | 1 | 38 bytes |
| ERC20-style transfer | 2 | 76 bytes |
| ERC20-style transferFrom | 3 | 114 bytes |
| Eight-entry initializer/batch | 8 | 304 bytes |

Every long-value chunk later consumed saves another 94 witness bytes. Output locking bytecodes remain 35-byte P2SH32
programs, so there is no corresponding output-byte reduction.

Do not claim a whole-contract percentage until the single-pin builder is wired into code generation and measured.
Its transaction-size saving above is exact; its static saving is separate and likely smaller than the previously
estimated fully independent constant-address variant.

### 8a. Instruction-level vmap primitive audit

**Status: measured micro-prototypes, subordinate to the linear verifier.** Four stack-algebra reductions are valid
without changing the vmap model:

| Primitive | Current | Lean form | Raw saving |
|---|---:|---:|---:|
| Absence bracket | 22 | 19 | 3 bytes |
| Four-item read presence test | 5 | 2 | 3 bytes |
| Read input-address pin + commitment load | 8 | 5 | 3 bytes |
| Write input-address pin + commitment load | 6 | 4 | 2 bytes |

- The absence bracket retains normalized `H(k)` across both comparisons rather than `OP_PICK` + `OP_BIN2NUM` a
  second time.
- A read frame `[H, slot, next, value]` can use `OP_2OVER OP_EQUAL` instead of two depth-specific copies.
- An authenticated input pair `[address, inputIndex]` can use `OP_2DUP`, introspect the copied index, and compare
  the copied address. The read then uses `OP_NIP`; writes retain the original address.

A temporary compiler prototype of the first three changes built successfully and passed
`VMapBytecodeOptimizations`, `SortedMappingRead`, `SortedMappingInsertDelete`, and `SortedMappingFullTx` (31 tests).
After existing outlining, the whole-contract reductions were smaller than the raw sum: scalar read 368 -> 364,
RMW 632 -> 628, two different mapping reads 580 -> 574, and two-mapping RMW 1055 -> 1049. Preserve EACC's inline
absence-proof attribution/anchors and rerun routed/delegate adversarial tests before landing; these micro-edits are
not a substitute for the linear batch transition verifier.

Several tempting reductions do not survive review: caching `OP_INPUTINDEX` replaces one-byte introspection calls
with duplicates plus cleanup; removing the category pin breaks domain isolation; shortening the 32-byte slot hash
weakens collision resistance; removing collection cardinality checks reopens forged-node insertion; and changing
read-only FT preservation from `>=` to exact equality changes the supported token-funding semantics for only one
byte.

### 9. Explicit unsafe mapping storage

**Status: technically possible, not recommended as automatic inference.** Legacy non-vmap codegen and SDK handling
still exist defensively, but the compiler forces every mapping to `sorted = true`. An opt-in unsafe storage class
would avoid exclusion proofs for contracts that accept omission semantics.

It must be source-visible and loud, for example `mapping(...) unsafe`, not inferred from current guards. Whole-program
positive-only analysis is invalidated by public getters, internal helpers, inheritance, external/final-state reads,
and later upgrades. The unsafe class must specify that omitted existing entries read as default and must forbid or
separately authenticate insertion/RMW shapes that could create duplicate logical keys.

Because this changes observable/security semantics rather than preserving them, it should be evaluated as a language
feature with adversarial documentation—not counted as a normal vmap optimizer.

## Ranked implementation plan

1. **Linear fixed-write transition verifier.** Removes the only measured path that crosses 10 KB at seven ordinary
   writes and changes quadratic code size to near-constant/linear.
2. **Replace entry/chunk covenants with the factored single-category-pinned format.** Saves 38 bytes per entry and
   94 bytes per digested-domain chunk reveal without weakening category isolation; no migration/version layer is
   required pre-release.
3. **Same-slot scalar authenticated-read cache.** Small, compatible, and directly bounded by measured 53-76 byte
   repeated-read premiums.
4. **Rolling long-value cursor.** Best runtime improvement for large values with modest static savings.
5. **Fuse route-local input/output address-count scans.** Reduces repeated transaction traversal and loop scaffold.
6. **Make derivation/debug metadata helper-aware.** Unlocks more aggressive general outlining and removes brittle
   coupling to emitted instruction shapes.
7. **HEAD pruning only with upgrade-aware initialization/removal.** Deployment-state saving, not contract-size work.
8. **Unsafe mapping class only by explicit language decision.** Never an inferred optimizer.

## Verification bar

Every preserving optimization must retain exact category/collection authentication, membership or adjacent
exclusion, slot/link preservation, insertion splice integrity, chunk completeness, orphan bounds, old-root
consumption, read-only self-preservation, and fail-closed unsupported shapes. Size assertions alone are insufficient:
run the existing hostile transaction mutations before and after each rewrite and compare both accepted and rejected
VM outcomes.
