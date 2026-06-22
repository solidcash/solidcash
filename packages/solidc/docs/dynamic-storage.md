# Dynamic storage (chunked string / bytes / dynamic arrays)

Status: **single-chunk shipped & green; multi-chunk in progress.** The "heap" half of the register/heap
state model. Fixed-size state lives in **registers** (data NFTs, static count - see
external-contract-calls.md). Variable-size state (`string`, `bytes`, dynamic arrays) lives in **dynamic
storage**: it grows and shrinks at runtime by allocating and freeing chunk UTXOs.

> **Implementation status (2026-06-22):** A dynamic `string`/`bytes` state var of length <= one chunk
> (120 B) works **end-to-end** (layout desugar + SDK read + on-chain write covenant + SDK builder/
> derivation), mock-proven: deploy empty -> grow -> shrink -> empty. Remaining: (1) the **multi-chunk
> write loop** (> 120 B; the SDK derivation/builder already handle N chunks - only the codegen
> `OP_BEGIN`/`OP_UNTIL` loop over `i` remains, building `pushdata(i)++pushdata(slice_i)` per chunk via
> the tight `<expected> <idx> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY` pattern); (2) the **orphan-bound**
> (the strict `OP_TXOUTPUTCOUNT` pin was dropped because it forbade a trailing change output - replace
> with an output-scan bound before permissionless dynamic writes); (3) the **on-chain read loop** (for
> `this.dynVar` in contract logic - not needed for write-only functions). See memory
> dynamic_storage_chunks for the precise state.

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
A dynamic var `A` gets **one** hidden fixed-size register field in a contract data NFT:
- `A$len` (**`uint32`**): the byte length of the value. `0` => empty (no chunks). It is the length
  **authority**, and the count authority for chunks (`nChunks = ceil(A$len / CHUNK)`).

There is **no inline field.** All data lives in chunks; the register holds only the length. (Decision
2026-06-22: dropping `A$inline` keeps the register footprint minimal - just `A$len` - and makes
empty/short handling uniform. See "Why uint32" and the chunks-vs-entry-NFTs comparison below.) `A$len`
is `uint32` not plain `int`: plain `int` is `int256` (~34 B bin-packing reserve, the EVM
"length-is-a-uint256-slot" habit that is *free* on EVM but wasteful on BCH); `uint32` reserves ~6 B,
is range-validated at encode, and 4.29e9 dwarfs any realizable length (a whole-string on-chain read is
capped at the ~10,000-byte stack-element limit, ~84 chunks). The on-wire encoded size is minimal and
value-dependent regardless of the bound (e.g. `len = 150` is 3 bytes); the bound only sets the
bin-packing reserve and the validation ceiling. `uint32` also gives phase-2 dynamic arrays
(`A$len` = element count) headroom.

`A$len` is a normal packed register field - it does **not** get its own data NFT and is **not** stored
in the (always-empty) minting NFT; it packs with sibling fields like any `uint32`.

### Storage (Ethereum's `keccak256(p) + i`)
- **Empty (`A$len == 0`):** zero chunk UTXOs.
- **Non-empty:** the value is split into `nChunks = ceil(A$len / CHUNK)` **chunk UTXOs**, each
  structurally an **entry NFT**:
  - `key = chunkIndex` (int), `value = chunkData` (raw bytes, `CHUNK` = 120 B - the 128-byte commitment
    minus the index + framing overhead). Chunk `i` carries bytes `[i*CHUNK : (i+1)*CHUNK]`; the last is
    short. No length is duplicated in the chunks - `A$len` in the register is the sole authority.
  - All chunks of one variable share one address `P2SH32(chunkCovenant(category, chunkHash))`, where
    `chunkHash = computeCollectionHash(varSignature)` (the entry `collectionHash` mechanism). Reuses
    `buildEntryNftCovenantScript` (Stage-2 self-pin: category C + mutable on the read path).
  - The chunk's `chunkIndex` is verified in its commitment (the entry-key verification), so chunk `i`
    cannot be substituted by chunk `j` - identical to the entry-key / nftIndex-tag soundness pattern.

So a dynamic `string A` desugars to: hidden `uint32 A$len` register field + a chunk collection
`A$chunks : (int chunkIndex => bytes chunkData)`.

### Read (on-chain)
- Read `A$len`. **If 0:** value = empty bytes (no chunks co-spent).
- **Else:** **loop** `i = 0 .. ceil(A$len / CHUNK) - 1` (`OP_BEGIN`/`OP_UNTIL`, modeled on
  `visitCollectionIteration`), co-spend chunk `i` read-only, verify its `chunkIndex == i`, `OP_CAT` its
  `chunkData`, then truncate to `A$len`. Unbounded (VM-limit-bounded, like EVM gas), no compile-time cap.
- Chunk `i`'s input index = `OP_INPUTINDEX + blockSize + priorIterCounts + i` (the
  `emitCollectionIterInputIndex` formula).

### Write (on-chain), grow and shrink
- Set `A$len = newLen` in the register.
- **If newLen == 0:** destroy all existing chunks (no chunk outputs).
- **Else:** **loop-split** the value into `CHUNK`-byte pieces; for each chunk slot `i` verify/emit the
  output chunk commitment `[i ++ data_i]` (entry-write verification, address + mutable category ==
  master); **grow** = mint chunk UTXOs for new indices, **shrink** = destroy now-extraneous ones.
- **No-orphan / exact-count enforcement (the novel part):** chunk outputs are the **trailing** outputs;
  after the write loop, pin `OP_TXOUTPUTCOUNT == firstChunkOutputIndex + nChunks` so no extra chunk
  output can exist, and the old chunks are all co-spent as inputs (Stage-2 self-pin guarantees only
  genuine chunks are spendable). Phase 1 = one dynamic write per function (chunk outputs go last).

### Off-chain (SDK)
- **Encode:** set `A$len = byteLength`; split the value into `CHUNK`-byte commitments; allocate/free
  chunk UTXOs so the live set is exactly `ceil(len / CHUNK)` (mint new high indices on grow, destroy
  extraneous ones on shrink). `len == 0` => free all chunks.
- **Read:** return empty bytes when `A$len == 0`; else fetch chunks ordered by the verified
  `chunkIndex`, join, and truncate to `A$len`. Unbounded. `findChunkNfts` discovers a variable's chunks
  by category + chunk address, ordered by the in-commitment `chunkIndex` (robust against UTXO
  permutation, like `findDataNfts` tag-ordering).

## Soundness
- **Chunk integrity:** the entry covenant's Stage-2 self-pin (live category == C, mutable) means only
  genuine chunk UTXOs are spendable at the address.
- **Chunk ordering:** `chunkIndex` is verified in each chunk's commitment (entry-key pattern) - a
  reader proves it read chunk `i`, so chunks cannot be permuted.
- **Length authority:** `A$len` lives in an always-co-spent register data NFT (never the empty minting
  NFT), covenant-enforced; the read concatenates exactly `ceil(A$len / CHUNK)` chunks and truncates to
  `A$len`; the write allocates/frees to match and pins the trailing chunk-output count. Because the
  length lives in always-present state (not in a chunk), a withholding spender cannot make a non-empty
  value read as empty/truncated - the chunk count is fixed by `A$len`, and each chunk's `chunkIndex` is
  checked, so the exact set must be presented.

## Reuse map (almost entirely existing machinery)
| Need | Reuses |
| --- | --- |
| Chunk covenant + address | `buildEntryNftCovenantScript(category, chunkHash)` (state.ts) |
| Chunk commitment codec | `buildEntryCommitment` / entry decode (state.ts) |
| Loop over N chunk UTXOs | `visitCollectionIteration` loop skeleton + `emitCollectionIterInputIndex` |
| Reusable read/write routine | `OP_DEFINE`/`OP_INVOKE` functions |
| Mint (grow) / destroy (shrink) | entry mint/destroy (compiler + SDK) |
| Chunk discovery, ordered | `findEntryNfts` + tag-ordering like `findDataNfts` |
| Length header (`uint32 A$len`) in a register | the data-NFT register read/write paths |

New logic = the `uint32 A$len` header, the value<->chunks split/concat, and the empty<->non-empty
transition (grow/shrink the chunk run).

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
identically: chunks = **entry NFTs + a length header + a contiguity/density invariant** - a
specialization of the entry-NFT mechanism, not a parallel one.

**Dynamic arrays (phase 2) are the bridge:** dense + length-tracked like a string, but
random-access-by-index like a mapping (read just chunk `i`, no whole-value concat). Same chunk
machinery: string = "read the whole run", array = "read element `i`". One UTXO primitive (entry NFT),
three disciplines: mapping (sparse, no length), array (dense, length, random access), string/bytes
(dense, length, whole-value).

### Layout: `A$len` packs as a normal register field (no inline, no dedicated NFT)
`A$len` (uint32) is the analog of Ethereum's header **slot `p`**, and the chunk run is the analog of
`keccak256(p) + i`. We considered an inline fast-path (a short value lives in the data NFT, 0 chunks) on
a dedicated header NFT - Ethereum-faithful and cheaper for short strings - but **dropped it** in favor of
the simplest sound model: a single `A$len` register field plus pure data chunks. Consequences:
- **No inline**, so a non-empty value of any length costs `ceil(len/CHUNK)` chunk UTXOs; empty costs
  zero. (Trade-off accepted: short strings no longer ride free in a register. The win is a tiny, uniform
  register footprint and no short/long branch.)
- **No dedicated NFT**: `A$len` packs with sibling fields like any `uint32` (pushdata is self-describing,
  so a following field's decode is never broken by `A$len`'s value - already true for any `int` field).
- **Length authority stays in a register** (not in chunk 0), which is what makes withhold/empty attacks
  impossible without a mandatory-chunk-0 dance: empty is simply `A$len == 0` with no chunks.

Rejected alternatives (recorded for posterity):
- *Inline + dedicated header NFT* (short = 0 chunks): cheaper for short-heavy fields, but a dedicated NFT
  per dynamic var and a short/long branch everywhere. Revisit if short strings dominate.
- *Length in chunk 0, zero register footprint*: sound **only** if empty is a mandatory chunk-0
  (`len=0`, empty data) so reads can force-co-spend it; otherwise a spender withholds chunk 0 and a
  non-empty value reads as empty. Costs >= 1 chunk for every string incl. empty. Not chosen.

## Phasing
1. `string` / `bytes` (the motivating case): read (loop-concat), write (loop-split + mint/destroy +
   `A$len`), empty <-> non-empty. On-chain + off-chain. Makes
   `StringStateGrowShrink.test.ts`'s `it.todo` pass.
2. Dynamic arrays `T[]` (same machinery, element-typed chunks; element access = chunk + offset).
3. Nested dynamic types.

## Implementation recon (2026-06-22) - findings that refine the above

These are the concrete code-level facts that shape the implementation, gathered before coding.

### What reuses cleanly
- **Layout** (`SymbolTableTraversal.ts` ~490-582 bin-packing; `Artifact.ts` ~228 dataNftCount): a dynamic
  var is desugared into one hidden register field `A$len` (`uint32`) packed like any other field, plus a
  chunk `CollectionInfo` (reuses the mapping/`computeCollectionSignature` model, `buildEntryNftCovenantScript`
  address). No inline field; all data lives in chunks.
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

## Codegen implementation plan (2026-06-22, block-layout facts gathered)

State of play: layout desugar + SDK read path are committed and validated. The remaining work is the
on-chain codegen (read loop, write loop) + the SDK write path. These facts make it executable.

### Block-layout facts (from `SymbolTableTraversal.computeBlockLayout` ~5452 + GTT finalize ~1222)
- A function's `FunctionBlockLayout = { blockSize, slots[] }` (utils/artifact.ts 66-79). `slots` are the
  fixed compile-time inputs/outputs (master, dataNft per required nftIndex, reads, entries, containers,
  transfers, events...). **1:1 layout: output index == input index == slot.offset.**
- `compactOffsetMap` (GTT ~1190): nftIndex -> 1-based position among co-spent data NFTs; a register read
  is `OP_INPUTINDEX + compactOffset` then `OP_UTXOTOKENCOMMITMENT` (see `emitReadCurrentStateValueEncoded`
  2262 - skips nftIndex tag + preceding fields via `emitPushdataSkip`, then decodes).
- **Variable trailing INPUTS** (collection iteration): live AFTER `blockSize`; entry i index =
  `OP_INPUTINDEX + blockSize + sum(prior __internal__collectionIterCount_j) + i`
  (`emitCollectionIterInputIndex` 2822). The count is an injected synthetic param
  `__internal__collectionIterCount_N` (SymbolTableTraversal 969-989), passed by the SDK.
- **Variable trailing OUTPUTS: do not exist.** Output slots are always compile-time-fixed. The write
  loop must introduce them. `OP_TXOUTPUTCOUNT` is only used today for minting-count checks
  (split/merge/delegate ~10172/10360/9941), never to bound a covenant output region.

### Read loop (`this.dynVar` in contract logic) - models collection iteration
NOTE: not needed by the motivating `setText` test (it only writes). Needed when a function *reads* a
dynamic var. Plan:
1. Detect a dynamic-var read; treat its chunks as a variable trailing input run (one run per dynamic
   read), reusing the collection-iteration trailing-input machinery (shared counter space; if a function
   has both, order them and accumulate counts).
2. Count = `ceil(A$len / CHUNK)` computed on-chain from the decoded `A$len` (NOT an SDK-passed param, but
   the SDK must still POSITION the chunk inputs at the trailing offsets and pass nothing - or, simpler
   for v1, reuse an injected `__internal__dynReadChunkCount_N` param to avoid mixing derived counts with
   the iteration counter arithmetic).
3. Loop i=0..count-1: input index = `OP_INPUTINDEX + blockSize + (prior trailing counts) + i`;
   `OP_UTXOTOKENCOMMITMENT`; decode chunk key, `OP_EQUALVERIFY i`; `OP_CAT` chunkData onto an accumulator.
   After loop: truncate accumulator to `A$len` (`OP_SPLIT`+`OP_DROP`). Empty when `A$len==0` (skip loop).

### Write loop (`this.dynVar = expr`) - the novel core
1. **Detect** dynamic writes in the function (scan body for `StateAssignNode` whose target is a dynamic
   var); record on the function node (new field, e.g. `dynamicWrites: string[]`), like entryAccesses.
2. **Block layout**: a dynamic-write function (a) co-spends its OLD chunks as variable trailing INPUTS
   (count = `ceil(oldLen/CHUNK)`, oldLen read from the old data NFT), and (b) emits NEW chunks as
   variable trailing OUTPUTS (count = `ceil(newLen/CHUNK)`). Both runs sit after `blockSize`. For phase 1
   (single dynamic write, chunk outputs last) the new mechanism is: chunk outputs occupy
   `[firstChunkOut .. firstChunkOut + nNew)` where `firstChunkOut = blockSize` (output side), and the
   loop pins `OP_TXOUTPUTCOUNT == blockSize + nNew`.
3. **Codegen** (at the write site / function epilogue):
   - Compute `newLen = OP_SIZE(value)`; `nNew = (newLen + CHUNK-1) / CHUNK` (int div via OP_DIV).
   - Write `A$len = newLen` into the new data NFT commitment field (the register write path already
     reconstructs the data NFT commitment; the dynamic field contributes `encodeInt(newLen)` as uint32).
   - **Output loop** i=0..nNew-1 (OP_BEGIN/OP_UNTIL): slice `value[i*CHUNK : min((i+1)*CHUNK, newLen)]`;
     build expected commitment `encodeInt(i) ++ pushdata(slice)`; verify
     `OP_OUTPUTTOKENCOMMITMENT(blockSize+i) == expected`, `OP_OUTPUTBYTECODE(blockSize+i) == chunkAddr`
     (reconstruct via `emitP2sh32FromCovenant(cat => buildEntryNftCovenantScript(cat, chunkHash))`,
     chunkHash = computeCollectionHash("<name>:<type>")), and category base == master + mutable.
   - **Pin** `OP_TXOUTPUTCOUNT == blockSize + nNew` (no extra/orphan chunk outputs).
   - **Old chunks**: read `oldLen` from old data NFT, co-spend `ceil(oldLen/CHUNK)` old chunk inputs as a
     trailing input run (forces their consumption; Stage-2 self-pin makes only genuine chunks spendable).
     Grow = some new outputs have no corresponding old input (mint); shrink = some old inputs have no new
     output (destroy). No explicit per-index pairing needed: outputs are fully verified, inputs are fully
     consumed, counts are pinned.
4. **SDK write** (StatefulTransactionBuilder): position old chunk UTXOs as trailing inputs; create new
   chunk outputs (commitment via `buildChunkCommitment`) as trailing outputs; auto-derivation feeds the
   value so codegen probes pass; fee-account the net chunk dust delta.

### Open sub-decisions for the codegen session
- Whether the chunk count is on-chain-derived (`ceil(A$len/CHUNK)`) or SDK-injected. On-chain-derived is
  cleaner (no SDK/loop counter coupling) but needs the trailing-input/output index arithmetic to use a
  derived count rather than a picked param. Recommend: derive on-chain; the SDK only positions UTXOs.
- Block-layout representation of the variable chunk run (new slot kind `chunk` with a runtime count, vs a
  separate post-block region). Recommend a dedicated post-block region anchored at `blockSize` since only
  one dynamic write is allowed in phase 1.
