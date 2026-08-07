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

**Default backend selection** for a bare `T[]` state var (no `packed` keyword): an **unbounded chunk-packable**
element type -> **chunk-packed** (fixed-width `uintN`/`bytesN`/`bool`/`pubkey`/`fixedNxM` and
fixed-width **structs** via flat-stream, OR variable-width leaf `int`/`string`/`bytes`/`address` and
variable-width **structs** via single-blob framing); a **nested-array** element, or a **bounded** `T[N]`,
-> **collection**. (`address` is variable-width on BCH - a locking bytecode of 23/25/35 B - so it framed-packs
like `bytes`, not flat like the fixed-width types.)
`packed` always selects the inline blob.
The selecting predicate is `arrayT.bound === undefined && isChunkPackableElementType(elementType)`
(`AstBuilder.ts`), behind the `chunkedArrays` compiler option which now **defaults on**.

## Summary matrix

| Form | Declaration | Lives in | Representation | index r/w | `delete` | `push`/`pop` | `.length` | `for ... of` | Size limit | Persisted |
| --- | --- | --- | --- | :-: | :-: | :-: | :-: | :-: | --- | :-: |
| **Local** | `int[] a = ...` (in a function) | VM stack | length-prefixed blob on the stack | ✅ | ✅ | ✅ | ✅ | n/a | ~10 KB stack-element limit | ❌ (transient) |
| **State, non-packed** | bounded / nested-array `T[]` (e.g. `uint256[5] a;`, `int[][] a;`) | entry NFTs | one entry NFT per **set** index (`mapping(int=>T)`) | ✅ | ✅ | ❌ | ❌ | ✅ | unbounded indices | ✅ |
| **State, packed** | `int[] packed a;` / `int[N] packed a;` | one data NFT | inline length-prefixed blob | ✅ | ✅ | ✅ | ✅ | ✅ | **bounded** (~120 B commitment) | ✅ |
| **State, chunk-packed** *(default for unbounded `T[]` with a chunk-packable element)* | `uint256[] a;`, `string[] a;`, `int[] a;`, `bytes[] a;`, `Person[] a;` | data NFT header + chunk UTXOs | `uint32 len` header + elements packed across 120 B chunks | ✅ | ✅ | ✅ | ✅ | ✅ | unbounded | ✅ |

Key takeaway: **chunk-packed is the first state form that is simultaneously dense (`push`/`length`),
unbounded, and persisted** - it is now the default for any unbounded `T[]` with a chunk-packable element
(fixed-width, or simple variable-width `int`/`string`/`bytes`). `packed` stays dense but capped at one
commitment; the non-packed collection stays unbounded-but-sparse (no `push`/`length`), used for the element
types chunk-packing does not yet cover (nested array) and for bounded `T[N]`.

## 1. Local / memory arrays (on the stack)

Ordinary in-function arrays - `int[] a = new int[](n)`, literals `[1, 2, 3]`, fixed `int[3]`. They are the
Solidity-`memory` analog (transient, not persisted).

- **Representation:** a single length-prefixed blob on the VM stack -
  `pushdata(count) ++ elem_0 ++ elem_1 ++ ...`. **Fixed-width** element types (bounded ints `uint8`..`int256`,
  `fixed`, `bool`, `pubkey`, `bytesN`) are packed tightly to their byte width (`emitEncodeElementPacked`,
  `isFixedWidthType` in `generation/utils.ts:242`); **variable-width** types (`bigint`, unbounded `bytes`,
  `string`, `address`, structs) use per-element pushdata framing. The same encoding is reused for the packed state blob.
- **Full API:** `new T[](n)`, literals, index read/write, `push`, `pop`, `.length`, fixed `T[N]`.
- **Size:** bounded only by the ~10 KB stack-element limit; effectively unbounded for realistic sizes.
- **Codegen:** array AST nodes in `GenerateTargetTraversal.ts` (`ArrayNode`, `NewArrayNode`, the
  `visitStateArray*` helpers reuse the same blob ops).

## 2. State, non-packed `T[]` - sparse entry-NFT collection

The backend for a state-level `T[]` (no `packed` modifier) whose element type is **not yet chunk-packable**
(a **nested array**) or whose length is **bounded** (`T[N]`). It is **not** a dense array - it
is a `mapping(int => T)` with array syntax. (An unbounded `T[]` with a chunk-packable element - fixed-width,
variable-width `int`/`string`/`bytes`, or a struct - instead defaults to the chunk-packed form in section 4.)

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
- **Size:** **bounded by the commitment limit** (128 B default, `commitmentLimit` in `compiler.ts`). The
  count plus every element must fit in that ~120 B; encoding throws past it (see `buildPushdataCommitment`
  in `utils/state.ts`).
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
- **Fixed-width** elements (`uintN`/`intN`, `bytesN`, `bool`, `address`, `fixedNxM`) - including > 120 B like
  `bytes200` - use **flat-stream** (count = A$len/width, no count field). SHIPPED.
- **Simple variable-width** leaf elements (`bigint`, `string`, unbounded `bytes`) use **single-blob framed** (the
  whole array is one dynamic value `pushdata(count) ++ pushdata(elem_0) ++ ...`; the count is kept in the blob;
  element access scans). SHIPPED.
- **Struct** elements chunk-pack too: fixed-width structs via flat-stream, variable-width structs (a `string`/
  `bytes`/`bigint` field) via the framed layout (navigated by walking each element's inner field frames).
  Element-field writes desugar to a whole-element rebuild. SHIPPED. **Nested-array** elements stay on the
  collection backend for now (future work).

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

### Single-blob framed (simple variable-width) - SHIPPED
`string[]`/`int[]`/`bytes[]` store the **whole array as one dynamic value** (one `A$len` header, one chunk
run), exactly like a `string` - the blob is the standard `pushdata(count) ++ pushdata(elem_0) ++ ...` framing
(the count is kept in the blob, since it cannot be derived from `A$len`). Because it is a single dynamic value,
there is **no per-element withholding surface** (all chunks are co-spent together, like a string's). Element
access reuses the packed-array **variable-width scan** codegen; `.length` reassembles the blob and decodes the
count prefix. The only codegen difference from flat-stream is count handling (keep vs strip), gated on
`isFixedWidthType(elementType)`; the SDK decodes via `decodePushdataValue`. Tradeoff: like all chunk-packed
reads, the whole array reassembles on-stack (~10 KB practical cap).

A future **element-keyed / nested** layout (each element its own dynamic value, keyed `(elementIndex,
chunkIndex)`, with always-co-spent per-element length authority to defeat the per-element withholding attack)
would lift the per-element on-stack cap for arrays of large strings - but it is strictly an efficiency
optimization over the shipped single-blob form, so it is deferred. Struct / nested-array elements also land
in future work (they stay on the collection backend today).

### Migration
- `T[]` semantics change: **sparse int-map -> dense array** (gains `push`/`pop`/`.length`; loses arbitrary
  gaps). Sparse use -> `mapping(uint=>T)`. The flip was a near no-op in practice (almost no test declared a
  bare unbounded state array on the old collection backend).
- `packed T[]` unchanged. Breaking state-layout change (length header + chunked storage) - fine pre-1.0.

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
2. **Phase 3** - DONE (single-blob framed): `string[]`/`int[]`/`bytes[]` chunk-pack as one dynamic value,
   reusing the dynamic-storage machinery + the packed variable-width scan codegen. Routing widened via
   `isChunkPackableElementType`; count handling gated on `isFixedWidthType`; SDK decodes with
   `decodePushdataValue`. Struct / nested-array elements + the element-keyed/nested optimization are future
   work. Compiler 1226 + full SDK 1738 green.

## Choosing a state array

| Need | Use |
| --- | --- |
| Dense `push`/`pop`/`.length`/index/`for..of`, **unbounded** (fixed-width OR `int`/`string`/`bytes` elements) | **bare `T[]`** (chunk-packed default, e.g. `uint256[]`, `string[]`) |
| Dense `push`/`pop`/`.length`, small total (~120 B), cheapest (one commitment) | `packed T[]` |
| Sparse / random keyed-by-int, OR nested-array elements, OR bounded `T[N]` | non-packed `T[]` (collection) |
| Transient scratch in a function | local `int[]` |

## Mapping whose value is an array (`mapping(K => T[])`, `mapping(K => T[][])`)

Element access into a mapping's array value works at any depth. A single array index `m[k][i]` is resolved
directly (the symbol table pops the lone `arrayIndex`). Two or more array indices `m[k][i][j]` are lowered by
`DesugarNestedArrayWrite` (pre-semantic) to the proven whole-value read/write + local nested-array paths:

- write: `m[k][i][j] = v`  ->  `T[][] t = m[k]; t[i][j] = v; m[k] = t;`
- read:  `m[k][i][j]`      ->  hoist `T[][] t = m[k]` before the statement, use `t[i][j]` in place

Handles nested mapping keys (the first `keyCount` indices are keys, the rest are array dimensions) and reads in
any expression position (per-statement hoist, save/restored across nested blocks). No new covenant code - it
reduces to the whole-value C2 RW + the existing local nested-array desugar. VM roundtrip: solidcash
`MappingArray2dWrite.test.ts`.

## Maintenance notes

- This doc must stay consistent with: `AstBuilder.ts` (packed/chunk-packed vs collection routing + `for..of`
  desugar), `SymbolTableTraversal.ts` (array bin-packing, state-array element visitors),
  `GenerateTargetTraversal.ts` (`visitStateArray*`, `emitReadStateArrayBlob`/`emitWriteStateArrayBlob`,
  `emitReadDynamicScalar`/`emitRegisterDynamicWrite`), and dynamic-storage.md (chunk machinery this form reuses).
- The operation matrix above was verified empirically by compiling each op against each form. Re-verify if
  the array op routing changes.
- Chunk-packed is the default for any unbounded `T[]` with a chunk-packable element (`chunkedArrays` defaults
  on); structs (fixed- and variable-width) chunk-pack as of #15. Remaining array work, all optional
  optimizations / extensions: (1) **nested-array** element chunk-packing; (2) **element-keyed/nested** layout
  for variable-width (lifts the per-element on-stack cap); (3) **partial-chunk rewrite** (element ops currently
  rewrite all of a var's chunks). Update this doc when any lands.
