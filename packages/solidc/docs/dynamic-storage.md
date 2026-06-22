# Dynamic storage (chunked string / bytes / dynamic arrays)

Status: **in progress.** The "heap" half of the register/heap state model. Fixed-size state lives in
**registers** (data NFTs, static count - see external-contract-calls.md). Variable-size state
(`string`, `bytes`, dynamic arrays) lives in **dynamic storage**: it grows and shrinks at runtime by
allocating and freeing chunk UTXOs.

> NOTE on naming: this is **storage** (persistent state), Solidity's `storage` data location - NOT the
> `memory` keyword, which in SolidCash is a no-op Solidity-compat modifier on params/returns (all
> param/local data is on-stack in the BCH VM). The two are unrelated.

## Ethereum reference

Solidity stores a dynamic `string`/`bytes` at slot `p` as a length header plus data chunks
(`docs/internals/layout_in_storage.rst`):
- **Short (< 32 bytes):** data stored inline in slot `p`; the lowest byte holds `length * 2`.
- **Long (>= 32 bytes):** slot `p` holds `length * 2 + 1`; the data is chunked into 32-byte slots at
  `keccak256(p) + i`.
- A dynamic array `T[]` stores its length at `p` and elements at `keccak256(p) + i * size`.
- Grow/shrink writes/zeroes the affected slots; the length at `p` is the authority.

## SolidCash model (BCH UTXO)

A dynamic-storage variable = a **length header** (in a register) + **data chunks** (chunk UTXOs).

### Register layout (Ethereum's slot `p`)
A dynamic var `A` gets two hidden fixed-size register fields in the contract's data NFT:
- `A$len` (int): **0 => short/inline**, **> 0 => long/chunked, value = the byte length**. Since a long
  value is always > 32 bytes, `len == 0` unambiguously marks short (the 0-sentinel doubles as the
  short/long flag, mirroring Ethereum's low-bit flag). It is the length **authority** for the long case.
- `A$inline` (bytes): the value itself when short; empty when long.

### Short / inline (Ethereum's short-string optimization)
**Inline threshold = fit-based** (the value fits the header NFT's commitment budget, ~CHUNK/120 B). A
short value is stored **inline in the data NFT** (`A$len = 0`, `A$inline = value`) - no chunk UTXOs.
This is today's single-data-NFT behavior. (Supersedes the earlier literal "32 bytes" rule: 32 is
Ethereum's *slot size*, not a portable threshold - our slot is the ~128 B commitment, so the faithful
analog is "inline while it fits one slot". See "Header NFT owns its slot" below.)

### Long / chunked (Ethereum's `keccak256(p) + i`)
A value too long to inline spills into **chunk UTXOs** (`A$len = length`, `A$inline = empty`). A chunk is
structurally an **entry NFT**:
- `key = chunkIndex` (int), `value = chunkData` (raw bytes, ~120 B - the 128-byte commitment minus the
  index + framing overhead).
- All chunks of one variable share one address `P2SH32(chunkCovenant(category, chunkHash))`, where
  `chunkHash = computeCollectionHash(varSignature)` (the entry `collectionHash` mechanism). Reuses
  `buildEntryNftCovenantScript` (Stage-2 self-pin: category C + mutable on the read path).
- The chunk's `chunkIndex` is verified in its commitment (the entry-key verification), so chunk `i`
  cannot be substituted by chunk `j` - identical to the entry-key / nftIndex-tag soundness pattern.

So a dynamic `string A` desugars to: hidden `int A$len` + `bytes A$inline` register fields + a chunk
collection `A$chunks : (int chunkIndex => bytes chunkData)`.

### Read (on-chain)
- Read `A$len`. **If 0 (short):** value = `A$inline`.
- **Else (long):** **loop** `i = 0 .. ceil(A$len / CHUNK) - 1` (`OP_BEGIN`/`OP_UNTIL`, modeled on
  `visitCollectionIteration`), co-spend chunk `i` read-only, `OP_CAT` its `chunkData`, then truncate to
  `A$len`. Unbounded (VM-limit-bounded, like EVM gas), no compile-time cap.
- Chunk `i`'s input index = `OP_INPUTINDEX + blockSize + priorIterCounts + i` (the
  `emitCollectionIterInputIndex` formula).

### Write (on-chain), grow and shrink
- **If newLen <= 32 (short):** set `A$len = 0`, `A$inline = value`, destroy all existing chunks.
- **Else (long):** set `A$len = newLen`, `A$inline = empty`; **loop-split** the value into `CHUNK`-byte
  pieces; for each chunk slot verify/emit the output chunk commitment `[i ++ data]` (entry-write
  verification); **grow** = mint chunk UTXOs for new indices, **shrink** = destroy now-extraneous ones.
- Short<->long transitions fall out of the two branches (e.g. growing past 32 moves the inline value
  into chunks; shrinking to <= 32 moves it back inline and frees the chunks).

### Off-chain (SDK)
The SDK applies the same 32-byte rule: short values set `A$inline` and free chunks; long values clear
`A$inline`, split into `CHUNK`-byte commitments, and allocate/free chunk UTXOs to match the new count.
On read it returns `A$inline` when `A$len == 0`, else fetches chunks ordered by the verified
`chunkIndex`, joins, and truncates to `A$len`. Unbounded. `findChunkNfts` discovers a variable's chunks
by category + chunk address, ordered by the in-commitment `chunkIndex` (robust against UTXO
permutation, like `findDataNfts` tag-ordering).

## Soundness
- **Chunk integrity:** the entry covenant's Stage-2 self-pin (live category == C, mutable) means only
  genuine chunk UTXOs are spendable at the address.
- **Chunk ordering:** `chunkIndex` is verified in each chunk's commitment (entry-key pattern) - a
  reader proves it read chunk `i`, so chunks cannot be permuted.
- **Length authority:** `A$len` is covenant-enforced in the register; the read concatenates exactly
  `ceil(A$len / CHUNK)` chunks and truncates to `A$len`; the write allocates/frees to match.

## Reuse map (almost entirely existing machinery)
| Need | Reuses |
| --- | --- |
| Chunk covenant + address | `buildEntryNftCovenantScript(category, chunkHash)` (state.ts) |
| Chunk commitment codec | `buildEntryCommitment` / entry decode (state.ts) |
| Loop over N chunk UTXOs | `visitCollectionIteration` loop skeleton + `emitCollectionIterInputIndex` |
| Reusable read/write routine | `OP_DEFINE`/`OP_INVOKE` functions |
| Mint (grow) / destroy (shrink) | entry mint/destroy (compiler + SDK) |
| Chunk discovery, ordered | `findEntryNfts` + tag-ordering like `findDataNfts` |
| Length header in a register | the data-NFT register read/write paths |

New logic = the length header, the value<->chunks split/concat, and the short/long transition.

## Chunks vs entry NFTs (mappings) - same primitive, different invariant

A chunk literally *is* an entry NFT: same covenant (`buildEntryNftCovenantScript`), same per-collection
address, same discovery-by-category+address, and `buildChunkCommitment` is just `buildEntryCommitment`
with `key = chunkIndex (int)`, `value = chunkData (bytes)`. Nothing new at the UTXO primitive level. What
differs is the **invariant the contract enforces over the set** of those NFTs:

| | Entry NFTs (mapping) | Dynamic chunks (string/bytes) |
| --- | --- | --- |
| Underlying UTXO | entry NFT @ collection addr | **same** entry NFT, same covenant |
| Commitment | `key ++ value` | `chunkIndex ++ chunkData` (a `key ++ value`) |
| Keyspace | **sparse**, arbitrary keys | **dense, contiguous** `0..n-1` |
| Length / count | none - not tracked on-chain | **`A$len` header** in the owning data NFT is the authority |
| Access pattern | random, by key, co-spend on demand | **whole value**: read all chunks in order, concat, truncate |
| Inline fast-path | none (every entry is its own NFT) | short value lives inline in the header NFT, **0 chunks** |
| Write enforcement | **compile-time-fixed** slot set (1 per source `m[k]=v`) | **runtime-variable** count `ceil(len/CHUNK)` + no-gaps/no-orphans |

Two genuinely-new requirements over mappings:
1. **Length authority + density.** A mapping with a missing key is valid (just absent); a string with a
   missing chunk `i` is corrupt. Chunks need `A$len` (the count authority) plus an enforced "exactly
   chunks `0..n-1`, no gaps, no orphans" invariant.
2. **Runtime-variable write count.** Mapping writes verify a fixed slot set known at compile time; chunk
   writes mint/destroy `ceil(len/CHUNK)` known only at runtime (the novel write loop + `OP_TXOUTPUTCOUNT`
   pin).

**This is Ethereum's own split.** Mapping = `keccak256(key . p)`: sparse, no length slot. Dynamic
array/string/bytes = length at slot `p`, contiguous data at `keccak256(p) + i`. Same hashed-slot
primitive; the only difference is "is there a length slot and is the data contiguous." Our design lands
identically: chunks = **entry NFTs + a length header + a contiguity/density invariant + an inline
fast-path** - a specialization of the entry-NFT mechanism, not a parallel one.

**Dynamic arrays (phase 2) are the bridge:** dense + length-tracked like a string, but
random-access-by-index like a mapping (read just chunk `i`, no whole-value concat). Same chunk
machinery: string = "read the whole run", array = "read element `i`". One UTXO primitive (entry NFT),
three disciplines: mapping (sparse, no length), array (dense, length, random access), string/bytes
(dense, length, whole-value).

### Header NFT owns its slot (Ethereum-faithful layout)
A dynamic var's `A$len + A$inline` fields are the analog of Ethereum's header **slot `p`**, and the chunk
run is the analog of `keccak256(p) + i`. Because pushdata fields are self-describing (length-prefixed),
both the SDK decoder and on-chain `emitPushdataSkip`/`emitPushdataDecode` walk fields sequentially - a
variable-length inline value never breaks a *following* field's decode (this is already true for plain
`int` fields, whose encoded length varies with value). Still, to mirror Ethereum (where a dynamic var
occupies its own whole slot and is never packed across) and to match the existing struct / unbounded-
array rule ("last in its NFT, force the next var to a new NFT"), a dynamic var **gets its own data NFT**.
This decouples neighbors (writing `A` never disturbs another var's UTXO) and removes the worst-case
inline-reserve-forces-an-extra-NFT coupling. **Inline threshold is therefore fit-based** (`~CHUNK`/the
commitment budget), not a literal 32: Ethereum inlines while the value fits *one slot* (32 B = its slot
size); our slot is the ~128 B commitment, so the faithful analog is "inline while it fits the
commitment", spilling to chunks only beyond that.

## Phasing
1. `string` / `bytes` (the motivating case): long read (loop-concat), write (loop-split + mint/destroy
   + length), short/long transitions. On-chain + off-chain. Makes
   `StringStateGrowShrink.test.ts`'s `it.todo` pass.
2. Dynamic arrays `T[]` (same machinery, element-typed chunks; element access = chunk + offset).
3. Nested dynamic types.

## Implementation recon (2026-06-22) - findings that refine the above

These are the concrete code-level facts that shape the implementation, gathered before coding.

### What reuses cleanly
- **Layout** (`SymbolTableTraversal.ts` ~490-582 bin-packing; `Artifact.ts` ~228 dataNftCount): a dynamic
  var is desugared into two hidden register fields `A$len` (int) + `A$inline` (bytes) packed like any
  other fields, plus a chunk `CollectionInfo` (reuses the mapping/`computeCollectionSignature` model,
  `buildEntryNftCovenantScript` address).
- **Read loop** has a real precedent: `visitCollectionIteration` (`GenerateTargetTraversal.ts` 2595-2813)
  + `emitCollectionIterInputIndex` (2822-2843), input index = `OP_INPUTINDEX + blockSize + sum(prior
  iter counts) + i`. Chunk read = the same skeleton, co-spend chunk i read-only, OP_CAT, truncate.
- **SDK read/discover**: `findDataNfts` nftIndex-tag ordering (`StateReader.ts` 53-80) is the template
  for `findChunkNfts` (order by verified in-commitment chunkIndex). Codec (`utils/state.ts` 970-1016)
  plugs into `readState`/`buildPushdataCommitment`.

### The novel part: the WRITE loop (no precedent)
- Existing entry-NFT write covenant `emitEntryCovenantVerification` (8523) verifies a **compile-time-fixed
  set of slots** - one per source `m[k]=v`. Chunk writes mint/destroy a **runtime-variable count**
  `ceil(len/CHUNK)`. Collection iteration only has variable trailing **inputs** (reads); variable
  trailing **outputs** is NEW. So both the write loop AND the block-layout (a variable-length trailing
  run of chunk outputs + co-spent old chunk inputs) are new machinery.
- **Soundness fork (the key decision): how to enforce "exactly the right chunk set, no orphans/extras".**
  Orphan chunks are a *correctness* risk, not just dust: a stray chunk sharing the address with a
  duplicate low index makes `findChunkNfts` ordering ambiguous and corrupts a future read. So the write
  MUST leave exactly `ceil(newLen/CHUNK)` chunk UTXOs and consume every old one. Chosen model:
  **trailing-outputs + pinned count.** Chunk outputs occupy the final outputs of the tx; the write loop
  verifies each chunk output i (commitment `[i ++ data_i]`, address, mutable category==master) and then
  pins `OP_TXOUTPUTCOUNT == firstChunkOutputIndex + nChunks` so no extra chunk output can exist. Old
  chunks are co-spent as inputs (the entry covenant's Stage-2 self-pin guarantees only genuine chunks
  are spendable at the address); consuming-all-old is enforced by reading the old len and requiring all
  `ceil(oldLen/CHUNK)` old chunk inputs present (mirrors the read loop's input enumeration).
  - Constraint this imposes: a function that does a dynamic write puts chunk outputs LAST, so it cannot
    also append arbitrary trailing outputs after them. Phase 1 = single dynamic write per function.
