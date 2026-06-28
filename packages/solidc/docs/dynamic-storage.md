# Dynamic storage (chunked string / bytes / dynamic arrays)

Status: **multi-chunk write + full on-chain read (read-after-write AND persisted chunk read loop) shipped
& green.** The "heap" half of the register/heap state model. Fixed-size state lives in **registers** (data NFTs, static count - see
external-contract-calls.md). Variable-size state (`string`, `bytes`, dynamic arrays) lives in **dynamic
storage**: it grows and shrinks at runtime by allocating and freeing chunk UTXOs.

> **Implementation status (2026-06-23):** A dynamic `string`/`bytes` state var of **any length** works
> **end-to-end** (layout desugar + SDK read + on-chain write covenant + SDK builder/derivation),
> mock-proven over a full grow/shrink sequence: empty -> 3 chunks -> 2 chunks -> 1 chunk -> 3 chunks ->
> empty. The codegen `OP_BEGIN`/`OP_UNTIL` write loop over `i` builds `pushdata(i)++pushdata(slice_i)`
> per chunk via the tight `<expected> <idx> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY` pattern, modeled on
> `visitCollectionIteration` so the loop body is runtime-stack-neutral by construction. Two SDK
> derivation bugs the inline-OTC-in-a-loop exposed (both fixed): (a) the trace extractor read phantom
> `OP_OUTPUTTOKENCOMMITMENT` steps inside the loop's not-taken exit branch - now filtered by libauth's
> `controlStack` (skip steps with a `false`); (b) the `findLastIndex(ip === 0)` redeem-script-start
> heuristic landed inside an `OP_INVOKE` subroutine (each chunk invokes int-encode + cat-base), dropping
> earlier chunks - now `findRedeemScriptStart` anchors on the redeem script's own (longest) instruction
> array. **Orphan-bound + old-chunk consumption + the persisted read loop are now also shipped** (see
> below): a write pins exactly `ceil(A$len/CHUNK)` chunk-address outputs and forces all `ceil(oldLen/CHUNK)`
> old chunks to be co-spent (output-scan + input-scan, `emitVerifyChunkUtxoCount`), and `this.dynVar`
> reads reassemble the value from co-spent chunks. Phase-1 coexistence limits are guarded (clean compile
> errors). See memory dynamic_storage_chunks for the precise state.

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
- **Read-after-write (implemented):** reading a dynamic var in the *same function that writes it* returns
  the raw new value still on the stack (`valueStackName`) - cheap and exact, no chunk read needed. E.g.
  `this.s = v; require(this.s == v)` works for any length.
- **Persisted read (planned - currently a compile-time error):** reading a dynamic var that was *not*
  written in this function needs the chunk read loop below; until it lands, the compiler rejects it (the
  data NFT holds only `A$len`, so decoding it as the value would be silently wrong). The full value is
  always readable off-chain via the SDK `getState()`.
- **Read loop (planned):** read `A$len`. **If 0:** value = empty bytes (no chunks co-spent). **Else:**
  **loop** `i = 0 .. ceil(A$len / CHUNK) - 1` (`OP_BEGIN`/`OP_UNTIL`, modeled on `visitCollectionIteration`),
  co-spend chunk `i` read-only, verify its `chunkIndex == i`, `OP_CAT` its `chunkData`, then truncate to
  `A$len`. Unbounded (VM-limit-bounded, like EVM gas), no compile-time cap. Chunk `i`'s input index =
  `OP_INPUTINDEX + blockSize + priorIterCounts + i` (the `emitCollectionIterInputIndex` formula).

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
(dense, length, whole-value). **NOTE:** the existing on-chain array forms (non-packed `T[]` = sparse
entry-NFT collection; `packed T[]` = bounded inline blob) and how this chunk-packed array would relate to
them are catalogued in **arrays.md** - the chunk-packed form is the only dense+length-tracked+unbounded
array, the gap the others leave.

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

## Coexistence limits (W1 + W5 lifted; W2/W3/W4 remain)
The read/write loops apply the collection-iteration shared trailing-counter arithmetic: read var R reads at
`blockSize + sum(prior read-var chunk counts) + i` (GTT `emitDynamicReadLoop`), and written var W's new
chunks verify at `blockSize + sum(prior written-var counts) + i` in state-var DECLARATION order (GTT
`emitDynamicWriteVerification`, matching the SDK's `dynamicChunkVars` placement). Status:
- **W1 (multiple persisted reads) - DONE** (commit df125a7b). Reading 2+ distinct dynamic vars works;
  e2e: two vars, different chunk counts.
- **W5 (multiple distinct writes) - DONE** (this work). Writing 2+ distinct dynamic vars works; the SDK
  already accumulated `chunkOffset += nNew` per var, so no SDK change. e2e: two writes, reverse source
  order, different chunk counts, verified off-chain + on-chain. Was a latent collision; now correct.
- **W2 (write + persisted read of a DIFFERENT var) - DONE** (this work). Read-only chunks are preserved as
  outputs at their input index `[blockSize, blockSize+count)` (covenant pins output==input), so the written
  var's new chunks now start AFTER them: the SDK emits iteration-entry (preserved read) outputs before chunk
  outputs and `getChunkOutputBase += iterationEntryInputs.length`; the codegen write output offset adds the
  foreign-read chunk count (ceil(A$len/CHUNK) per read var not also written). e2e: read a 3-chunk var
  (preserved) while writing a 2-chunk var. Backward-compatible (0 foreign reads -> +0).
- **W3 (same var written twice, e.g. `arr.push();arr.push()`, idx-write + `pop()`, or re-assignment) -
  DONE** (this work). COALESCED to one final-value write: `emitRegisterDynamicWrite`, when the var is
  already pending, drops the prior pending value + A$len and re-registers the new value (which already
  incorporates the prior via read-after-write). Layout-neutral (one write var). Guards at
  `emitWriteStateArrayBlob` + `visitStateAssign` removed. e2e: push;push, push x3 across a chunk boundary,
  idx-write + pop. Unblocks Structs.sol + ArrayReplaceFromEnd.sol.
- **W4 (dynamic op + collection iteration) - still rejected** (~9097/~9281). Same trailing-space
  unification as W2 generalized to iterations.

Still allowed beyond W1/W5: a single read, read-after-write (same var), reading the same var twice.

## Phasing
1. `string` / `bytes` (the motivating case): read (loop-concat), write (loop-split + mint/destroy +
   `A$len`), empty <-> non-empty. On-chain + off-chain. **SHIPPED & GREEN** (write, read-after-write,
   persisted read loop; phase-1 coexistence guarded).
2. Coexistence + dynamic arrays - see "Phase 2 scope" below.
3. Nested dynamic types.

## Phase 2 scope (2026-06-28)

Recon done; no code written. Grounding probes (single ops on a chunk-packed `uint256[]`): single `push`,
single `pop`, single `arr[i]=v`, single `arr[i]` read **all already work**; `unpackFixedWidthArray`
already reads chunk-packed arrays SDK-side. **So "dynamic arrays `T[]`" as a type is largely shipped.**
What's missing for the corpus is OPERATING on dynamic state more than once per function (coexistence) and
in loops - plus one grammar gap. The SDK already loops over `dynamicReads`/`dynamicWrites` arrays and
accumulates `chunkOffset` per var (`StatefulContract.ts` ~3144, ~3676, ~4854), so the bulk of phase 2 is
**compiler-only**.

The root mechanism: every variable-count trailing input/output today assumes its own run starts at
`blockSize`. Collection iteration already solved this for trailing INPUTS via `emitCollectionIterInputIndex`
(`blockSize + sum(prior __internal__collectionIterCount_j) + i`, synthetic count params injected by
SymbolTableTraversal, passed by the SDK). Phase 2 = generalize that **shared trailing-counter** to ALL
trailing consumers (chunk reads, old-chunk co-spends, new-chunk write outputs, collection iterations) so
their runs stack instead of colliding.

### P2a - Coexistence (the shared trailing-counter generalization) [foundational, highest ROI]
Closes W1-W5. Compiler-only (SDK ready). Work:
1. **Trailing-run manifest** in the artifact / `FunctionBlockLayout`: the ordered list of trailing runs a
   function uses (each persisted dyn-read var; each written var's old-chunk co-spend run; each written
   var's new-chunk output run; each collection iteration), so codegen and SDK share ONE source of truth
   for offsets (the W5 bug is exactly these two drifting apart).
2. **Synthetic count params** for the runtime-counted INPUT runs: `__internal__dynamicReadCount_R` (chunks
   of read var R) and `__internal__dynamicWriteOldCount_W` (old chunks of written var W), modeled on
   `__internal__collectionIterCount_N`. New-chunk OUTPUT counts are derived on-chain (live `(dyn_nnew)`),
   so they accumulate from stack values, not params.
3. **Read loop** (GTT 9479) + **write loop** (GTT 9181): replace the literal `blockSize + i` with
   `blockSize + sum(prior-run counts) + i`, reusing `emitCollectionIterInputIndex`'s accumulation. Inputs
   (reads + iterations + old-chunk co-spends) share the trailing-input space; outputs (new chunks) share
   the trailing-output space.
4. **Same-var multiple writes** (W3: `push;push`, idx-write + `pop`): these are N mutations of ONE value,
   not N chunk-sets. **Recommend coalescing**: track the live on-stack value per dyn var across the body
   (extends what read-after-write already does), fold each push/pop/idx-write into it, emit ONE write loop
   at function end. Simpler than sequencing, and it is the lever P2c needs.
5. **Orphan-bound** (`emitVerifyChunkUtxoCount`): already per-address, so distinct-var writes are fine once
   offsets stack; coalescing collapses same-var writes to one count pin.
6. Drop guards W1-W4; remove the W5 hole.

Hard parts: keeping codegen offsets and SDK placement in lockstep (solved by the shared manifest);
choosing coalesce vs sequence for same-var writes (recommend coalesce).

### P2b - grammar: complex index expressions [small, orthogonal]
`arr[arr.length - 1]` (and any member/expression index) currently parse-errors ("Missing ';' at '['");
`arr[i]`, `arr[0]`, `arr[i]=arr[j]` work. Fix the index-expression grammar rule. Needed by
ArrayReplaceFromEnd, ArrayRemoveByShifting.

### P2c - write-in-loop [DONE]
`for(...) arr.push()` / `arr[i]=arr[i+1]` then `pop()`. A dynamic write inside a loop breaks the
pending-value model (emitted once, runs N times). DONE as a pre-semantic AST pass `CacheDynamicArrayInLoop`
(wired after `InlineStoragePointerCalls`): a dynamic array V written inside a loop is desugared to
**read-once / mutate-local / write-once** - prepend `T[] __dlcache_V = V`, redirect every V access to the
local (state-array write nodes StateArrayPush/Pop/Assign/Delete -> local Array* nodes; bare `V[i]=`/reads
are ArrayAssign/Identifier/MappingAccess that resolve to the local by name after a rename), append
`V = __dlcache_V`. Local array ops update an on-stack slot in place (stack-neutral) so they work in loops.
The target was validated as a manual pattern before building. e2e: push-in-loop + shift-remove-in-loop
(ChunkedArrays.test.ts). Unblocks ArrayRemoveByShifting + MerkleTree (bench 75->77). Bare (Solidity-style)
access only; `this.V` whole-reads (StateAccessNode) inside a loop-cached fn are not redirected (corpus uses
bare access).

### Corpus impact (examples/solidity-by-example, single-wall unless noted)
- P2a: Structs (`push` x3), MyToken (verify - two-string-WRITE already compiles but is W5; if it READS two
  strings it is W1). + ArrayReplaceFromEnd once P2b lands.
- P2c: ArrayRemoveByShifting, MerkleTree.
- EventsAdvanced: multi-wall (also needs external-call-on-state-array).
- Full phase 2 ~= 5-6 single-wall contracts.

### Recommended order
1. **P2a first** - foundational, mostly compiler-only, closes the W5 latent bug, unblocks the static
   multi-op contracts. Adopt the coalesce-to-one-write-per-var model.
2. **P2b** alongside - tiny grammar fix.
3. **P2c** - reuses P2a's coalescing; unblocks the loop-array contracts.
4. Dynamic arrays `T[]` as a dedicated type: **already shipped** for single ops; no separate workstream.

If phase 2 is deferred, still add the W5 guard (reject >1 distinct written dynamic var) so the hole errors
cleanly instead of compiling to a runtime collision.

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
Status (2026-06-23): **SHIPPED & GREEN.** Read-after-write returns the raw on-stack value; a persisted
read runs the chunk read loop below. Chunk preservation is ENFORCED on-chain (the chunk entry covenant's
flag=0 read-only path requires output==input), so a read cannot destroy the value. As-built notes:
`emitDynamicReadLoop` (GTT) wired from `visitStateAccess` records `node.dynamicReads`; the artifact
surfaces `AbiFunction.dynamicReads`; the SDK (`StatefulContract._createBuilder`) fetches each read var's
chunks, orders them by chunkIndex, and co-spends them as read-only `iterationEntryInputs`
(`createReadOnlyDynamicChunkUnlocker`, flag=0) which the builder recreates as preserving outputs - and the
write-path `dynamicVarInfos` now excludes read-only vars (else the chunk is double-added). The design below
matches the implementation:

**Codegen** (`emitDynamicReadLoop(sv)`, call from `visitStateAccess` persisted branch, replacing the
guard `throw`; leaves the value bytes on the stack as `(value)`):
1. **Read `A$len`** (the uint32 field): `emitMasterInputIndex` + `compactOffsetMap.get(nftIndex)` +
   `OP_UTXOTOKENCOMMITMENT`, skip nftIndex tag (multi-NFT) + preceding fields, decode THIS field as
   `new IntType(false, 32)` (NOT `sv.type`). Track `(dyn_rlen)`.
2. **Chunk address** `(dyn_rchunkaddr)`: same as the write loop
   (`emitP2sh32FromCovenant(cat => buildEntryNftCovenantScript(cat, chunkHash))`,
   `chunkHash = computeCollectionHash(computeCollectionSignature(sv.name, sv.type.toString()))`).
3. **`count = ceil(A$len/CHUNK)`** `(dyn_rcount)` = `(len + 119) OP_DIV 120` (0 when empty). **Accumulator**
   `(dyn_racc)` = `OP_0` (empty). **Counter** `(dyn_ri)` = 0. Derive count ON-CHAIN (no injected param);
   the SDK still positions the chunk inputs at `[blockSize, blockSize+count)`.
4. **Loop** (mirror `visitCollectionIteration`: `OP_BEGIN`/cond `i<count`/`OP_IF`/snapshot
   `stackBeforeBody`/body/`removeScopedVariables`/in-place increment via `emitReplace`/`OP_0`/`OP_ELSE`
   reset `this.stack`/`OP_1`/`OP_ENDIF`/`OP_UNTIL`). Body for chunk i (untracked working values, like the
   write verify; `emitPushdataDecode` is tracker-neutral):
   - `inputIdx = OP_INPUTINDEX + blockSize + i`.
   - **Genuineness (read soundness):** `OP_UTXOBYTECODE(inputIdx) == chunkAddr`; category base == master +
     mutable (`OP_UTXOTOKENCATEGORY`, 32 `OP_SPLIT` `OP_NIP`, `0x01` cap, `emitVerifyCatBaseEqMaster`).
   - `commitment = OP_UTXOTOKENCOMMITMENT(inputIdx)`; `emitPushdataDecode(IntType(false,32))` -> chunkIndex
     + remainder; `OP_EQUALVERIFY` chunkIndex == i; `emitPushdataDecodeLastField(BytesType)` -> chunkData.
   - **Accumulate:** `acc = acc ++ chunkData` in place (pick `(dyn_racc)`, CAT chunkData, `emitReplace`).
     (Chunks store exactly `value[i*120:...]` so the concat == the value; truncation is defensive.)
5. After loop: truncate `(dyn_racc)` to `A$len` (`OP_SPLIT`+`OP_DROP`; also asserts len >= A$len). Push as
   `(value)`. Empty when `A$len==0` (count 0 -> loop skipped -> acc empty).
- **Preservation:** a read-only chunk co-spend MUST be recreated (output==input) or the value is destroyed.
  The SDK recreates the chunks (like `iterationEntryInputs`). On-chain preservation ENFORCEMENT (per-chunk
  `OUTPUTTOKENCOMMITMENT/BYTECODE/CATEGORY/VALUE == input`) is deferred to the same permissionless-hardening
  bucket as the write orphan-bound (not exploitable in the signed model). If enforced inline, the SDK
  extractor's controlStack + `findRedeemScriptStart` fixes (already landed) apply to the loop's OTC checks.

**Semantic** (`SymbolTableTraversal`): pre-scan the body for persisted dynamic reads (a `StateAccessNode`
with `sv.isDynamic` NOT written in the same function), record `node.dynamicReads: string[]` (like
`collectionIterations`); surface in the artifact ABI. Phase 1: one dynamic read per function, no coexisting
collection iteration (shared trailing-input offset). **SDK** (`StatefulContract._createBuilder` /
`StatefulTransactionBuilder`): for each `dynamicReads` var, fetch its chunks (`findChunkNfts` via
`getDynamicChunkAddress`), order by chunkIndex, co-spend as trailing read-only inputs at
`[blockSize, blockSize+count)`, and recreate them as preserving outputs at the same indices; the
auto-derivation already provides the chunk UTXOs so the loop's `OP_UTXOTOKENCOMMITMENT` reads them.

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
