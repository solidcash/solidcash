# vmap codegen optimization research

Status: historical research and implementation guidance. The factored entry/chunk covenants, stack micro-
optimizations, and linear non-aliasing fixed-batch verifier described by the 2026-08 survey are implemented. The
normative storage and security specification is
`verified-mappings.md`.

> **Current measurements:** this note predates later helper allocation, whole-script outlining, and routed-handler
> safety work. See [`vmap-size-survey-2026-08.md`](vmap-size-survey-2026-08.md) for current-HEAD and
> `codex/eacc-general-compile-perf` measurements, implemented-versus-open status, and the revised priority order.

This note evaluates how to reduce vmap contract bytecode, runtime covenant work, and transaction size without
weakening exclusion proofs or shortening the 32-byte `slot` and `nextSlot` links.

## Baseline measurements

Measurements were taken from optimized compiler output at commit `b17e0cc9`, using one-function contracts to avoid
selector-dispatch and unrelated application differences.

| Case | Optimized contract bytecode |
|---|---:|
| Stateful scalar read | 352 B |
| vmap scalar read | 479 B |
| Stateful scalar write | 354 B |
| vmap scalar write | 526 B |
| vmap scalar read-modify-write | 764 B |
| vmap nested-key read | 561 B |
| Dynamic state-bytes write | 626 B |
| vmap chunk-capable bytes write | 729 B |
| vmap bytes read | 428 B |

Approximate premiums in these examples:

- vmap scalar read: 127 bytes over a scalar state read.
- vmap scalar write: 172 bytes over a scalar state write.
- vmap chunk-capable bytes write: 103 bytes over a dynamic state-bytes write.
- RMW is disproportionately large because it contains both authenticated read and upsert machinery.

The common stateful master/value-preservation scaffold remains a large part of every contract. These figures should
not be interpreted as the cost of the linked list alone.

Cross-function sharing is currently limited:

| Contract shape | Optimized bytecode |
|---|---:|
| One vmap read function | 479 B |
| Two equivalent vmap read functions | 948 B |
| One vmap write function | 526 B |
| Two equivalent vmap write functions | 1,024 B |
| One vmap chunk-capable write | 729 B |
| Two equivalent chunk-capable writes | 1,430 B |

The nearly linear growth makes collection-address and output-verifier sharing worthwhile.

### Atomic fixed-batch verifier (2026-07-22)

The complete shared-predecessor verifier adds nearest-link proofs, predecessor preservation, and an exact
collection-address output scan. Optimized one-function measurements on the accepted implementation are:

| Distinct straight-line writes | Contract bytecode |
|---:|---:|
| 1 (ordinary upsert, no batch verifier) | 451 B |
| 2 | 2,849 B |
| 3 | 5,460 B |
| 4 | 8,957 B |
| 5 | 13,333 B (over the 10 KB contract limit) |

The current verifier is quadratic because it proves target membership/minimality pairwise. It is sound and useful
for the common two-party transfer and small atomic-update cases, but it is the dominant remaining bytecode target.
A linear successor should use an SDK-supplied sorted `(slot,next,proof,predOut)` blob plus a bounded rank per logical
write: bind each `H(key)` to `blob[rank]`, prove ranks form a permutation, validate adjacent links once, and validate
each distinct predecessor once. This retains full-width 32-byte links and all current adversarial guarantees while
moving ordering from O(N^2) unrolled comparisons to O(N) fixed-field checks (or one covenant loop).

## Where the current cost concentrates

### Category-specialized entry address construction

`buildEntryNftCovenantScript` currently produces a 142-byte redeem script containing the category twice. Because the
category is known only at deployment/runtime, each mapping access reconstructs the script on the stack and hashes it
to obtain the P2SH32 locking bytecode.

For the current entry covenant:

- redeem script: 142 bytes;
- runtime address-derivation fragment: 97 contract bytes;
- pushing a compile-time P2SH32 locking bytecode would require 36 bytes;
- potential saving per derivation: 61 contract bytes.

The redeem script is also revealed in every entry input, so its size directly affects transaction size.

### Repeated read/upsert work

A vmap RMW commonly computes the same `H(key)` and collection entry address once for the read and again for the write.
Struct-field and mapping-array mutations follow the same materialize-modify-upsert pattern.

### Repeated sorted-output verification

The upsert emits substantially similar verification for:

- an update output;
- an insertion predecessor rewrite;
- an insertion NEW node.

Each verifies locking bytecode, mutable capability, category base, and commitment, but uses different manually
calculated stack depths.

### Chunk slicing and orphan counting

The long-value writer currently:

1. copies the full value for every chunk;
2. computes `28 + i * 126`;
3. splits from the start to that offset;
4. measures and splits the remaining data;
5. verifies each deterministic chunk output;
6. scans every output again to prove that no extra output uses the root-specific chunk address.

The final scan is required for unambiguous reconstruction, but it duplicates transaction traversal already performed
by other stateful invariants.

## Priority 1: compatible per-function caching

Cache the following for each accessed mapping collection/key descriptor:

- `H(key)`;
- collection entry locking bytecode;
- where useful, the authenticated entry category base and split commitment.

RMW should pass the captured slot into its nested read rather than hashing the key twice. Multiple accesses to the
same collection should derive the entry address once near function setup and reuse it via tracked stack values.

Expected effects:

- eliminate one SHA-256 and high-bit-mask sequence per repeated key;
- save almost the full 97-byte derivation fragment for each repeated entry address, minus a small `PICK`/cleanup cost;
- reduce runtime hashing and script concatenation;
- reduce fragile stack-depth arithmetic.

This does not change addresses, commitments, artifacts, or on-chain state and should be the first implementation.

An alternative is a collection-specific address-derivation subroutine. That saves static contract bytes but repeats
the runtime hashing. Stack caching saves both.

## Priority 2: common sorted-output verifier

Refactor output verification so call sites explicitly arrange:

```
entryAddress, field1, field2, field3, outputIndex
```

and invoke one helper/subroutine. The helper verifies:

1. output locking bytecode;
2. mutable capability;
3. category base equals master;
4. output commitment equals `field1 || field2 || field3`.

This should replace the three depth-parameterized copies in a normal upsert. Estimated saving is approximately
25–50 bytes per write path, depending on call-site packing and whether the helper is shared across function bodies.

Besides size, this removes manually maintained depth constants from a security-critical fragment.

## Priority 3: rolling chunk cursor

Replace offset-from-start slicing with a mutable remaining-tail value:

```
remaining = fullValue[28:]

for i in 0..<chunkCount:
    chunkSize = min(126, remaining.length)
    chunk, remaining = split(remaining, chunkSize)
    verify(indexLE16(i) || chunk)
```

This removes per-chunk multiplication, offset addition, prefix splitting, and repeated traversal from the beginning
of the value. It should save several opcodes per chunk and provide the most meaningful runtime improvement for large
values while retaining the exact current commitment format.

The loop must finish with `remaining` empty in addition to the existing exact chunk-count pin.

## Priority 4: fuse chunk-address counting

The root-specific address count prevents an attacker from minting extra same-root chunks that make strict SDK
reconstruction ambiguous or unavailable. It must not simply be removed.

Prefer carrying a chunk-address counter through an existing transaction output scan rather than executing a second
standalone scan. The expected counter remains `ceil((length - 28) / 126)`.

Likely effects:

- remove roughly 30–45 bytes of standalone loop machinery;
- remove one full traversal of transaction outputs;
- retain the same orphan-prevention invariant.

An exact `tx.outputs.length == managedEnd` check is smaller but is safe only if every transfer, event, sidecar, return
output, and permitted trailing output is included in the compiler's exact layout. Scan fusion is more composable.

Old-chunk input counting can be fused with an existing input scan under the same constraints.

## Priority 5: single-category-pinned, collection-specific entry covenants

This is the largest individual constant-factor saving. It changes every entry and value-chunk address, but no
SolidCash storage format has been released, so the current format can be replaced outright without versioning.

The category should remain embedded once. P2SH32 authenticates the redeem script, not the CashToken category, and
the current read/absence path partly relies on the category-specialized address. Removing the category entirely is
safe only after every read, write, iteration, `outState`, delegate, and SDK path independently pins the token
category. It would also collapse equal collection layouts across contracts onto one provider-visible address.

The duplicate category occurrence can be removed while retaining the category as the read-only branch's domain
separator:

### Write path

1. Read the claimed master input category.
2. Require minting capability.
3. Read the current entry input category.
4. Require mutable capability.
5. Require entry category base equals master category base.

### Read-only path and address domain

1. Require the current input has mutable NFT capability.
2. Require its category base equals the single embedded category.
3. Preserve locking bytecode, exact category, commitment, FT amount, satoshis, and output position.

### Calling contract

The main contract continues to require the supplied entry category base equals its master and the input locking
bytecode equals the expected collection address.

The collection hash must remain embedded. Removing it would give multiple mappings in the same category the same
address and permit cross-collection entry substitution because ordinary node commitments do not contain a collection
identifier.

A factored prototype is 104 bytes rather than 142 bytes. Root-addressed chunks additionally digest their tagged,
fixed-width `"value-chunk" || collectionHash || slot || root` domain to one HASH256 salt, retaining 256-bit binding while
avoiding three separate executed-and-dropped pushes:

| Component | Current | Proposed | Saving |
|---|---:|---:|---:|
| Entry redeem script | 142 B | 104 B | 38 B/input |
| Root-addressed chunk redeem script | 210 B | 116 B | 94 B/input |

Including redeem-script push framing, the exact transaction saving is 38 bytes per revealed entry and 94 bytes per
revealed chunk. Static compiler savings require a code-generation prototype; the address remains
category-specialized, but constructing its covenant loses one category occurrence and chunk construction handles
one dynamic digest rather than three independent salts.

The address remains category- and collection-specific P2SH32. Category binding remains full-width and the exclusion
proof retains its current domain separation.

Pre-release replacement requirements:

- replace the entry/chunk covenant builders and every compiler/SDK address derivation together;
- regenerate artifacts and fixtures;
- update deploy, upgrade, provider query, trace derivation, and adversarial tests;
- remove the old format rather than adding dual-format compatibility.

No format marker, migration covenant, or mixed-list handling is needed because there are no released lists.

## Lower-priority improvements

- Reuse already split entry fields between membership selection and output verification.
- Consolidate numeric normalization in the absence bracket.
- Arrange commitment fields contiguously to replace some depth-based `PICK` operations.
- Extend contract-wide subroutine extraction to collection-address and sorted-output helpers.
- Correct stale code comments that still describe the former repeated `slot || digest || framed chunk` layout.

These changes offer smaller returns and should follow the structural optimizations.

## Security constraints

Any optimization must continue to prove:

1. input category base equals the active master category;
2. input locking bytecode identifies the expected collection;
3. exact membership or authenticated adjacent exclusion;
4. update preserves slot and link;
5. insertion preserves predecessor value and old successor;
6. every expected long-value chunk is pinned at its deterministic output index;
7. no extra output uses the same root-specific chunk address;
8. old-root chunks are completely consumed on overwrite;
9. read-only entry spends preserve the entry even if another input attempts the entry covenant's write path;
10. unsupported codegen shapes fail rather than bypassing a check.

Optimizations should add differential VM tests comparing accepted/rejected transaction mutations before and after
the rewrite, not only bytecode-size assertions.

## Recommendation

Implementation order:

1. Cache `H(key)` and entry addresses within functions.
2. Factor the common sorted-output verifier.
3. Convert chunk verification to a rolling cursor.
4. Fuse chunk-address counts with existing transaction scans.
5. Replace the unreleased two-category-constant format with single-category-pinned, collection-specific covenants.

Keep `slot` and `nextSlot` at 32 bytes. The optimizations above save more contract and transaction bytes without
introducing a narrower-link collision bound or runtime truncation logic.

## Straight-line multi-key writes: required batch transition

**Implementation status (2026-07-22): shipped.** The accepted implementation adds fixed-batch metadata to the AST
and artifact, plans a deduplicated original-list proof in the SDK, and emits an authenticated final-union verifier.
It covers shared predecessors, adjacent insert chains, mixed updates/inserts, exact collection-output cardinality,
conditional no-op paths, and computed-key swap-remove aliasing. `VMapBatchMetadata`, `VMapBatchAdversarial`, and
`IterableMappingRemove` contain the metadata, topology-mutation, and alias-sentinel regression coverage. The design
notes below explain the failure mode that required batching and the constraints used by the implementation; future-
tense statements describe the original implementation plan, not an open soundness gap.

The July 2026 merge audit found that two fixed writes to distinct absent keys are not merely an SDK duplicate-input
case. If both keys occupy the same original gap, both fixed upserts currently select the same predecessor, and both
also address the single `master + blockSize` trailing NEW-node output. Deduplicating the input alone is therefore
incorrect: the two independently emitted covenants still demand incompatible predecessor rewrites and NEW nodes.

The compact, sound implementation is a function-exit batch transition:

1. Cache every invariant-key scalar entry used by the function once. Preserve source-order reads and writes against
   the locals, including read-after-write dependencies such as `m[a] = 5; m[b] = m[a]`.
2. Flush distinct dirty entries as one vmap batch. The SDK sorts absent slots within each original gap and groups
   present updates separately.
3. Co-spend each present node and each untouched bracketing predecessor exactly once.
4. For a gap containing new slots `k1 < ... < kn`, verify and emit exactly
   `P' = P.slot || k1 || P.value`, then `k1 || k2 || v1`, ..., `kn || P.oldNext || vn`.
5. Assign a unique block-layout output to every emitted node. Do not use the existing single-upsert convention where
   every insertion places NEW at `master + blockSize`.
6. Pin the number of entry-address inputs and outputs for the batch, and reject duplicate slots before transaction
   construction. Existing-key assignments remain updates and must preserve their original link unless that node is
   the predecessor of an inserted chain, in which case its one recreated output carries the new first link.

This is implemented as a dedicated artifact/codegen shape, not an extension of `sortedUpsertLoopInfo`. A prototype that
described counter keys as a synthetic key array reached the upsert-loop body but failed its per-iteration slot proof:
array-driven upserts and straight-line/range insertion have different stack and output-index invariants.

The transformation must recurse through return paths and conditionals in the same way as the existing invariant-entry
cache. A conditional dirty bit is required when a write is not guaranteed to execute; otherwise the batch would turn
a skipped source assignment into an on-chain write. Long values additionally need unique chunk-output bases computed
after the batch's variable entry-output count.

### Dormant range-splice warning

`findSortedInsertLoopWrite` intentionally returns no match, so ordinary loops continue to use the more capable active
multi-gap upsert covenant. The retained first-cut range-splice is nevertheless hardened for future reuse: its SDK
planner reorders the invariant-value key-array argument by hashed slot and writes that order into the encoded call
arguments, while the covenant body independently proves every chain-node slot equals `H(runtimeKey)`. The existing
duplicate/present-key checks make this reorder semantics-preserving for the splice's insert-only, invariant-value
scope. Counter-key loops cannot use this technique because there is no reorderable key-array argument.
