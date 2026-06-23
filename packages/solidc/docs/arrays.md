# Array variations in SolidCash

This is the reference for **every array form** SolidCash supports. Keep it actualized as the array surface
changes - it is the single place that reconciles the local/memory arrays and the three on-chain state-array
representations (collection, packed, chunk-packed).

Related: dynamic-storage.md (the chunk machinery, currently `string`/`bytes`) and external-contract-calls.md
(the register/heap state model). Arrays touch all three.

## The dimensions

An "array" in SolidCash is one of four things depending on three independent choices:

1. **Where it lives** - a **local/memory** array (on the VM stack, transient, gone at end of evaluation) or
   a **state** array (persisted in UTXOs across transactions).
2. **State representation** (state arrays only) - **collection** (one entry NFT per element), **packed**
   (one inline blob in a data NFT), or **chunk-packed** (a length header + elements spread over chunk UTXOs).
3. **Bounded vs unbounded** - `T[N]` (fixed length, known at compile time) or `T[]` (runtime length).

These combine into the forms below. The defining axis on-chain is *dense + length-tracked* (a real
`push`/`length` array) vs *sparse* (an `int`-keyed mapping wearing array syntax).

**Default backend selection** for a bare `T[]` state var (no `packed` keyword): an **unbounded fixed-width**
element type (`uintN`/`bytesN`/`bool`/`pubkey`/`address`/`fixedNxM`) -> **chunk-packed**; **variable-width**
(`int`/`string`/`bytes`/struct) or **bounded** `T[N]` -> **collection**. `packed` always selects the inline
blob. The selecting predicate is `arrayT.bound === undefined && isFixedWidthType(elementType)`
(`AstBuilder.ts`), behind the `chunkedArrays` compiler option which now **defaults on**.

## Summary matrix

| Form | Declaration | Lives in | Representation | index r/w | `delete` | `push`/`pop` | `.length` | `for ... of` | Size limit | Persisted |
| --- | --- | --- | --- | :-: | :-: | :-: | :-: | :-: | --- | :-: |
| **Local** | `int[] a = ...` (in a function) | VM stack | length-prefixed blob on the stack | ✅ | ✅ | ✅ | ✅ | n/a | ~10 KB stack-element limit | ❌ (transient) |
| **State, non-packed** | variable-width / bounded `T[]` (e.g. `int[] a;`, `uint256[5] a;`) | entry NFTs | one entry NFT per **set** index (`mapping(int=>T)`) | ✅ | ✅ | ❌ | ❌ | ✅ | unbounded indices | ✅ |
| **State, packed** | `int[] packed a;` / `int[N] packed a;` | one data NFT | inline length-prefixed blob | ✅ | ✅ | ✅ | ✅ | ✅ | **bounded** (~120 B commitment) | ✅ |
| **State, chunk-packed** *(default for unbounded fixed-width `T[]`)* | `uint256[] a;`, `bytes20[] a;`, `bool[] a;` | data NFT header + chunk UTXOs | `uint32 len` header + elements packed across 120 B chunks | ✅ | ✅ | ✅ | ✅ | ✅ | unbounded | ✅ |

Key takeaway: **chunk-packed is the first state form that is simultaneously dense (`push`/`length`),
unbounded, and persisted** - it is now the default for unbounded fixed-width `T[]`. `packed` stays dense but
capped at one commitment; the non-packed collection stays unbounded-but-sparse (no `push`/`length`), used for
variable-width or bounded arrays where chunk-packing does not (yet) apply.

## 1. Local / memory arrays (on the stack)

Ordinary in-function arrays - `int[] a = new int[](n)`, literals `[1, 2, 3]`, fixed `int[3]`. They are the
Solidity-`memory` analog (transient, not persisted).

- **Representation:** a single length-prefixed blob on the VM stack -
  `pushdata(count) ++ elem_0 ++ elem_1 ++ ...`. **Fixed-width** element types (bounded ints `uint8`..`int256`,
  `fixed`, `bool`, `pubkey`, `bytesN`) are packed tightly to their byte width (`emitEncodeElementPacked`,
  `isFixedWidthType` in `generation/utils.ts:242`); **variable-width** types (plain `int`, unbounded `bytes`,
  `string`, structs) use per-element pushdata framing. The same encoding is reused for the packed state blob.
- **Full API:** `new T[](n)`, literals, index read/write, `push`, `pop`, `.length`, fixed `T[N]`.
- **Size:** bounded only by the ~10 KB stack-element limit; effectively unbounded for realistic sizes.
- **Codegen:** array AST nodes in `GenerateTargetTraversal.ts` (`ArrayNode`, `NewArrayNode`, the
  `visitStateArray*` helpers reuse the same blob ops).

## 2. State, non-packed `T[]` - sparse entry-NFT collection

The backend for a state-level `T[]` (no `packed` modifier) whose element type is **variable-width**
(`int`/`string`/`bytes`/struct) or whose length is **bounded** (`T[N]`) - i.e. the cases chunk-packing does
not (yet) cover. It is **not** a dense array - it is a `mapping(int => T)` with array syntax. (An unbounded
fixed-width `T[]` instead defaults to the chunk-packed form in section 4.)

- **AST:** a `CollectionNode` (not a `StateVariableNode`); `AstBuilder.ts` ("Non-packed array: store as
  entry NFTs (collection)"). `keyType = int`, `valueType = elementType`, artifact `kind: "array"`.
- **Storage:** one **entry NFT per set index** (same machinery as mappings; see dynamic-storage.md's
  "Chunks vs entry NFTs" table). The keyspace is sparse - only written indices exist as UTXOs.
- **Operations:** index read/write (`this.a[i]`), `delete(i)`, and collection iteration `for (T v of this.a)`
  / `for (int k, T v of this.a.entries)`. **No `push`, no `.length`** (there is no on-chain length authority;
  it is sparse).
- **Size:** unbounded number of indices; each element is its own UTXO (dust + a co-spend per touched element).
- **Use when:** a large, sparse, or random-access keyed-by-int collection where you never need `push`/`length`
  and touch few elements per tx.

## 3. State, `packed T[]` / `T[N] packed` - inline blob

Add the `packed` modifier to get a **dense, length-tracked** array - the real `push`/`pop`/`.length` array -
stored inline.

- **AST:** a `StateVariableNode` with `isPacked = true` (`AstBuilder.ts:1671`). The whole array is one field.
- **Storage:** a length-prefixed blob **inline in a data NFT commitment**, same encoding as a local array.
  An unbounded `packed T[]` is forced to **its own** data NFT (size unknown); a bounded `T[N] packed`
  bin-packs but must be last in its NFT (`SymbolTableTraversal.ts:543-569`).
- **Operations:** the full dense API - index read/write, `push`, `pop`, `.length`, `delete` (splice), and
  `for (T v of this.a)` (desugared in `AstBuilder` to an index loop over a once-cached local, since it is a
  state variable, not a collection - shared with the chunk-packed form).
- **Size:** **bounded by the commitment limit** (128 B default, `commitmentLimit`, `compiler.ts:28`). The
  count plus every element must fit in that ~120 B; encoding throws past it (`utils/state.ts:857`).
- **Use when:** a small, dense array you push/pop and read `.length` on (addresses, a short list).

## 4. State, chunk-packed array - SHIPPED (default for unbounded fixed-width `T[]`)

A **dense, length-tracked, unbounded, persisted** array. It reuses the dynamic-storage chunk machinery (the
same one shipped for `string`/`bytes`), packing many elements per 120 B chunk UTXO. It is the **default**
backend for an unbounded fixed-width `T[]` state var.

- **Representation:** a hidden `uint32 len` header in the owning data NFT (the byte-length authority, exactly
  like `A$len` for strings) + the **tight element stream** `elem_0 ++ elem_1 ++ ...` (each element exactly
  `width = getFixedWidth(T)` bytes, the same `emitEncodeElementPacked` packing as a packed/local array) spread
  over a contiguous run of 120 B **chunk UTXOs**. `n = A$len / width` is the count; no separate count field.
- **AST/codegen:** a `StateVariableNode` with `isDynamic = true` (NOT a `CollectionNode`). All element ops
  reuse the packed-array codegen by making the two blob primitives dynamic-aware (`emitReadStateArrayBlob` ->
  `emitReadDynamicScalar`; `emitWriteStateArrayBlob` -> `emitRegisterDynamicWrite`): a reassembled chunk array
  has the **same on-stack form** `pushdata(count)++elems` as a packed array.
- **Density vs the non-packed collection:** the collection uses **one UTXO per element**; chunk-packed uses
  **one UTXO per ~120 B of elements** (e.g. a `uint256[]` packs ~3-4 elements/chunk). Far fewer UTXOs for
  many small elements, while staying unbounded.
- **Random access (current impl = reassemble-then-slice, O(n)):** `this.a[i]` reassembles the whole element
  blob from the co-spent chunks (the dynamic read loop) then slices `[i*width, (i+1)*width)` and decodes.
  Elements straddling a 120 B chunk boundary fall out naturally (the slice is over the reassembled blob).
  This is simpler than true partial-chunk access and reuses the tested read loop; **true O(1) partial-chunk
  access** (touch only `floor(i*width/CHUNK)`) is a **deferred optimization**.
- **Write / grow / shrink (rewrite-all-chunks):** an element write reads the whole array, modifies it
  on-stack, and rewrites **all** chunks via the dynamic-storage write loop (orphan-bound + old-chunk
  consumption scans, `emitVerifyChunkUtxoCount`, leave the exact chunk set). Element WRITES are
  read-modify-write of the same var in one tx: the read loop reassembles from the **same** chunk inputs the
  write consumes (co-spent once; the SDK skips the read-only co-spend for written vars and sorts the chunk
  inputs by chunkIndex). `push`/`pop` across chunk-count transitions (1<->2 chunks) are handled.
- **`delete this.a[i]`:** swap-with-last + `pop` (same semantics as a packed array - it reuses
  `visitStateArrayDelete`), NOT a zero-fill.
- **`for (T v of this.a)`:** desugared to an index loop over a once-cached local (section 3 note), so it works
  here too.
- **Status:** **SHIPPED & default** (commits b8b9a7e4 string single-chunk -> ea628742 for..of; flip in this
  phase). `chunkedArrays` compiler option defaults on; pass `chunkedArrays: false` to force the old collection
  backend.

## Decision (2026-06-23) and implementation spec

**Decision:** the default state `T[]` becomes a dense, length-tracked, **unbounded chunk-packed array**.
The layout is chosen by element type. `packed T[]` stays (inline, bounded, cheapest); the sparse use-case
moves to `mapping(uint=>T)`. Rationale: today's non-packed `T[]` is a sparse int-map (no `push`/`.length`) -
surprising for a Solidity-targeting language; and for the common small-element case the flat-stream layout
is also 3-6x denser than one-entry-NFT-per-element.

### Layout by element type
- **Fixed-width** elements (`uintN`/`intN`, `bytesN`, `bool`, `address`, `fixedNxM`, fixed-width struct) -
  including > 120 B like `bytes200` - use **flat-stream** (phase 2).
- **Variable-width** elements (`string`, `bytes`, dynamic struct) use **element-keyed / nested** (phase 3).

### Flat-stream (fixed-width) - phase 2
Storage is the shipped `string`/`bytes` dynamic-storage machinery reused verbatim: a `uint32` byte-length
header `A$len` in the data NFT + a chunk run. The chunk blob is the **tight-packed** element stream
`elem_0 ++ elem_1 ++ ...`, each element exactly `width = getFixedWidth(T)` bytes (sign-magnitude `OP_NUM2BIN`
packing, `width` from `IntType.byteWidth = ceil((bits+1)/8)`, same as `emitEncodeElementPacked`). Therefore:
- `n = A$len / width` is the count; `.length` reads the header and divides (no separate count field).
- element `i` occupies blob bytes `[i*width, (i+1)*width)` - **computable** -> O(1) random access.

| Op | Mechanism (as shipped) |
| --- | --- |
| `this.a.length` | read `A$len`, `/ width` (persisted) or `OP_SIZE(blob)/width` (read-after-write) |
| `this.a[i]` (read) | reassemble the whole blob (read loop), slice `[i*width,(i+1)*width)`, decode |
| `this.a[i] = v` | reassemble, splice element `i`, rewrite **all** chunks (read-modify-write, same var) |
| `this.a.push(v)` | reassemble, append `v` (`A$len += width`), rewrite all chunks (mint one if it spills) |
| `this.a.pop()` | reassemble, drop last element (`A$len -= width`), rewrite all chunks (drop one if emptied) |
| `this.a.delete(i)` | reassemble, swap element `i` with the last + `pop` (packed semantics), rewrite all chunks |
| whole read `this.a` | dynamic read loop -> blob -> decode all |
| `for (T v of this.a)` | desugar to `{ T[] t = this.a; for i in 0..t.length: v = t[i]; body }` (one reassembly) |

Note: `this.a[i] = v` / `push` / `pop` / `delete` currently **rewrite all chunks** (correct, O(n)); true
partial-chunk rewrite is a deferred optimization. Solidity-style `delete` here is swap-with-last (matching the
packed array), not a zero-fill.
| whole write `this.a = [..]` | encode -> tight blob -> dynamic write loop |
| `for (T v of this.a)` | iterate `i = 0..n-1`, read element `i` |

Covenant reuses the shipped dynamic write loop + orphan-bound + old-chunk consumption (`emitVerifyChunkUtxoCount`).
The novel codegen is **partial-chunk access**: element ops target the chunk(s) for one element's byte range
instead of the whole run (a new read/write narrower than the whole-value string read/write).

### Element-keyed / nested (variable-width) - phase 3
Each element `i` is its own dynamic value (own length authority + own chunk sub-run), keyed
`(elementIndex, chunkIndex)` via `buildEntryCommitmentMultiKey`. Per-element length authority lives in
always-co-spent state (a length-index in the data NFT, or each element as a nested dynamic value) to defeat
the per-element withholding attack. `string[]`/`bytes[]` land here. Deferred.

### Migration
- `T[]` semantics change: **sparse int-map -> dense array** (gains `push`/`pop`/`.length`; loses arbitrary
  gaps). Sparse use -> `mapping(uint=>T)`. Existing non-packed-array tests update to the dense model.
- `packed T[]` unchanged. Breaking state-layout change (length header + chunked storage) - fine pre-1.0.
- **Interim** (until phase 3): variable-width `T[]` (`string[]`, `bytes[]`) stays on today's collection
  model; only fixed-width `T[]` flips to flat-stream in phase 2.

### Phasing / build order
1. **Phase 2 (in progress)** - flat-stream fixed-width arrays:
   (a) DONE - utils: `isFixedWidthType`/`fixedWidthBytes` + tight-pack codec (`pack`/`unpack` array <-> blob);
   (b) DONE - layout/desugar: fixed-width `T[]` -> dynamic-storage (`A$len` header + chunk collection);
   (c) DONE - codegen: whole-array read/write + `.length`. Includes shrink-to-empty (`this.a = []`) and
       multiple dynamic vars per contract: a function records which dynamic vars it WRITES (`dynamicWrites`
       in the ABI) so the SDK consumes/recreates only those chunks - a `.length`-only or untouched var keeps
       its chunks. Cross-field reads use the **physical** field type (a dynamic var's data-NFT field is a
       `uint32 A$len` header, not its declared type), so skipping `a` to read `b` no longer mis-parses;
   (d) DONE - codegen: element ops (index r/w, `push`, `pop`, `this.a.delete(i)`). Reuses the packed-array
       element codegen verbatim by making BOTH blob primitives (read + write) dynamic-aware: read reassembles
       chunks -> `pushdata(count)++elems` (elements straddling a 120 B chunk boundary fall out of the byte
       offset naturally), write strips the count and registers a chunk write. Element WRITES read AND write
       the same var in one tx (read-modify-write): the phase-1 read/write guard now allows reads that are a
       subset of writes, and the SDK co-spends the var's chunks ONCE (the read loop reassembles from the same
       inputs the write consumes; chunk inputs sorted by chunkIndex so input blockSize+i is chunk i). Push/pop
       across chunk-count transitions (1<->2 chunks) verified. NOT partial-chunk: a write still rewrites all
       chunks (correct, O(n); true partial access is a later optimization);
   (e) SDK: whole-array store/read + element positioning DONE; dust fee accounting as needed;
   (g) DONE - `for (T v of this.a)`: desugared in `AstBuilder` to `{ T[] tmp = this.a; int i = 0; while (i <
       tmp.length) { T v = tmp[i]; <body>; i++; } }` - one reassembly into a local, then ordinary local-array
       indexing (also enables `for..of` on packed arrays). The loop var may go unused (allowUnused flag ->
       self-reference), matching collection iteration;
   (f) DONE - flipped the default (`chunkedArrays` -> on); the migration was a no-op (only the self-referential
       layout test needed updating - no other test/fixture declares an unbounded fixed-width state array except
       the explicit ChunkedArrays suites). Compiler 1225 + full SDK 1736 green with the default on.
2. **Phase 3** - variable-width (`string[]`, `bytes[]`) via element-keyed/nested (still collection-backed).

## Choosing a state array

| Need | Use |
| --- | --- |
| Dense `push`/`pop`/`.length`/index/`for..of`, **unbounded**, fixed-width elements | **bare `T[]`** (chunk-packed default, e.g. `uint256[]`) |
| Dense `push`/`pop`/`.length`, small total (~120 B), cheapest (one commitment) | `packed T[]` |
| Sparse / random keyed-by-int, OR variable-width elements (`int[]`/`string[]`), OR bounded `T[N]` | non-packed `T[]` (collection) |
| Transient scratch in a function | local `int[]` |

## Maintenance notes

- This doc must stay consistent with: `AstBuilder.ts` (packed/chunk-packed vs collection routing + `for..of`
  desugar), `SymbolTableTraversal.ts` (array bin-packing, state-array element visitors),
  `GenerateTargetTraversal.ts` (`visitStateArray*`, `emitReadStateArrayBlob`/`emitWriteStateArrayBlob`,
  `emitReadDynamicScalar`/`emitRegisterDynamicWrite`), and dynamic-storage.md (chunk machinery this form reuses).
- The operation matrix above was verified empirically by compiling each op against each form. Re-verify if
  the array op routing changes.
- Chunk-packed is now the default for unbounded fixed-width `T[]` (`chunkedArrays` defaults on). The next
  array work is **phase 3** (variable-width `string[]`/`bytes[]` chunk-packing) and the deferred **partial-chunk
  rewrite** optimization (element ops currently rewrite all chunks). Update this doc when either lands.
