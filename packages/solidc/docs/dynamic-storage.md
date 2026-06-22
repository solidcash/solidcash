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

### Length header (Ethereum's slot `p`)
A hidden fixed-size field in the contract's data NFT (a register field). It holds the byte length and
a short/long marker (mirroring Ethereum's `*2` / `*2+1`). The register is the length **authority**.

### Short / inline (Ethereum's short-string optimization)
If the value fits in the register's remaining commitment budget, it is stored **inline in the data
NFT** - no chunk UTXOs. This is today's single-data-NFT behavior. The marker says "short".

### Long / chunked (Ethereum's `keccak256(p) + i`)
A long value spills into **chunk UTXOs**. A chunk is structurally an **entry NFT**:
- `key = chunkIndex` (int), `value = chunkData` (raw bytes, ~120 B - the 128-byte commitment minus the
  index + framing overhead).
- All chunks of one variable share one address `P2SH32(chunkCovenant(category, chunkHash))`, where
  `chunkHash = computeCollectionHash(varSignature)` (the entry `collectionHash` mechanism). Reuses
  `buildEntryNftCovenantScript` (Stage-2 self-pin: category C + mutable on the read path).
- The chunk's `chunkIndex` is verified in its commitment (the entry-key verification), so chunk `i`
  cannot be substituted by chunk `j` - identical to the entry-key / nftIndex-tag soundness pattern.

So a dynamic `string A` desugars to: a hidden `int A.len` register field + a chunk collection
`A.chunks : (int chunkIndex => bytes chunkData)`.

### Read (on-chain)
- Read `A.len` from the register; check the short/long marker.
- Short: the inline bytes are the value.
- Long: **loop** `i = 0 .. ceil(len / CHUNK) - 1` (`OP_BEGIN`/`OP_UNTIL`, modeled on
  `visitCollectionIteration`), co-spend chunk `i` read-only, `OP_CAT` its `chunkData`, then truncate to
  `len`. Unbounded (VM-limit-bounded, like EVM gas), no compile-time cap.
- Chunk `i`'s input index = `OP_INPUTINDEX + blockSize + priorIterCounts + i` (the
  `emitCollectionIterInputIndex` formula).

### Write (on-chain), grow and shrink
- Compute the new value's chunk count `n = ceil(newLen / CHUNK)`.
- **Loop-split** the value into `CHUNK`-byte pieces; for each chunk slot, verify/emit the output chunk
  commitment `[i ++ data]` (the entry-write verification).
- **Grow:** mint new chunk UTXOs for indices beyond the old count (entry mint).
- **Shrink:** destroy the now-extraneous chunk UTXOs (entry destroy).
- Update `A.len` (and short/long marker) in the register (the data-NFT write path).
- Short<->long transitions move data between the inline register and chunks.

### Off-chain (SDK)
The SDK chunks a value on write (split into `CHUNK`-byte commitments, allocate/free chunk UTXOs to
match the new count) and concatenates on read (fetch chunks ordered by the verified `chunkIndex`,
join, truncate to `len`). Unbounded. `findChunkNfts` discovers a variable's chunks by category +
chunk address, ordered by the in-commitment `chunkIndex` (robust against UTXO permutation, like
`findDataNfts` tag-ordering).

## Soundness
- **Chunk integrity:** the entry covenant's Stage-2 self-pin (live category == C, mutable) means only
  genuine chunk UTXOs are spendable at the address.
- **Chunk ordering:** `chunkIndex` is verified in each chunk's commitment (entry-key pattern) - a
  reader proves it read chunk `i`, so chunks cannot be permuted.
- **Length authority:** `A.len` is covenant-enforced in the register; the read concatenates exactly
  `ceil(len / CHUNK)` chunks and truncates to `len`; the write allocates/frees to match.

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

## Phasing
1. `string` / `bytes` (the motivating case): long read (loop-concat), write (loop-split + mint/destroy
   + length), short/long transitions. On-chain + off-chain. Makes
   `StringStateGrowShrink.test.ts`'s `it.todo` pass.
2. Dynamic arrays `T[]` (same machinery, element-typed chunks; element access = chunk + offset).
3. Nested dynamic types.
