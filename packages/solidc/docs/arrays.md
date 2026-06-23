# Array variations in SolidCash

This is the reference for **every array form** SolidCash supports (and the one proposed but not yet built).
Keep it actualized as the array surface changes - it is the single place that reconciles the local/memory
arrays, the two on-chain state-array representations, and the proposed chunk-packed array.

Related: dynamic-storage.md (the chunk machinery, currently `string`/`bytes`) and external-contract-calls.md
(the register/heap state model). Arrays touch all three.

## The dimensions

An "array" in SolidCash is one of four things depending on three independent choices:

1. **Where it lives** - a **local/memory** array (on the VM stack, transient, gone at end of evaluation) or
   a **state** array (persisted in UTXOs across transactions).
2. **State representation** (state arrays only) - **collection** (one entry NFT per element), **packed**
   (one inline blob in a data NFT), or **chunk-packed** (proposed: a length header + elements spread over
   chunk UTXOs).
3. **Bounded vs unbounded** - `T[N]` (fixed length, known at compile time) or `T[]` (runtime length).

These combine into the forms below. The defining axis on-chain is *dense + length-tracked* (a real
`push`/`length` array) vs *sparse* (an `int`-keyed mapping wearing array syntax).

## Summary matrix

| Form | Declaration | Lives in | Representation | index r/w | `delete` | `push`/`pop` | `.length` | `for ... of` | Size limit | Persisted |
| --- | --- | --- | --- | :-: | :-: | :-: | :-: | :-: | --- | :-: |
| **Local** | `int[] a = ...` (in a function) | VM stack | length-prefixed blob on the stack | ✅ | ✅ | ✅ | ✅ | n/a | ~10 KB stack-element limit | ❌ (transient) |
| **State, non-packed** | `int[] a;` (state var) | entry NFTs | one entry NFT per **set** index (`mapping(int=>T)`) | ✅ | ✅ | ❌ | ❌ | ✅ | unbounded indices | ✅ |
| **State, packed** | `int[] packed a;` / `int[N] packed a;` | one data NFT | inline length-prefixed blob | ✅ | ✅ | ✅ | ✅ | ❌ | **bounded** (~120 B commitment) | ✅ |
| **State, chunk-packed** *(proposed)* | `int[] a;` (new default backend) | data NFT header + chunk UTXOs | `uint32 len` header + elements packed across 120 B chunks | ✅ | ✅ | ✅ | ✅ | ✅ | unbounded | ✅ |

Key takeaway: **no shipped state form is simultaneously dense (`push`/`length`), unbounded, and persisted.**
`packed` is dense but capped at one commitment; non-packed is unbounded but sparse (no `push`/`length`). The
proposed chunk-packed array fills exactly that gap.

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

## 2. State, non-packed `T[]` (default) - sparse entry-NFT collection

The default for a state-level `T[]` (no `packed` modifier). It is **not** a dense array - it is a
`mapping(int => T)` with array syntax.

- **AST:** a `CollectionNode` (not a `StateVariableNode`); `AstBuilder.ts:1681` ("Non-packed array: store as
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
- **Operations:** the full dense API - index read/write, `push`, `pop`, `.length`, `delete` (splice). **No
  `for ... of`** (it is not a collection; iterate by index + `.length`).
- **Size:** **bounded by the commitment limit** (128 B default, `commitmentLimit`, `compiler.ts:28`). The
  count plus every element must fit in that ~120 B; encoding throws past it (`utils/state.ts:857`).
- **Use when:** a small, dense array you push/pop and read `.length` on (addresses, a short list).

## 4. State, chunk-packed array - PROPOSED (not built)

The missing form: a **dense, length-tracked, unbounded, persisted** array. It would reuse the dynamic-storage
chunk machinery (the same one shipped for `string`/`bytes`), packing many elements per 120 B chunk UTXO.

- **Representation:** a hidden `uint32 len` header in the owning data NFT (the count authority, exactly like
  `A$len` for strings) + the elements encoded into a contiguous run of 120 B **chunk UTXOs** -
  `chunk_i = entry NFT(key = chunkIndex, value = packed elements for that chunk)`.
- **Density vs the non-packed collection:** the collection uses **one UTXO per element**; chunk-packed uses
  **one UTXO per ~120 B of elements** (e.g. a `uint256[]` packs ~3-4 elements/chunk). Far fewer UTXOs for
  many small elements, while staying unbounded.
- **Random access:** for **fixed-width** elements, `this.a[i]` reads only the chunk holding element `i`
  (`floor(i*width / CHUNK)`) plus the offset within it - O(1), it does **not** reassemble the whole value
  (unlike a `string` read, which concatenates every chunk). For **variable-width** elements there is no fixed
  offset, so v1 would likely restrict to fixed-width element types (or fall back to a whole-run read). This is
  the "arrays are the bridge" point: dense + length-tracked like a string, random-access by index like a mapping.
- **Write / grow / shrink:** the dynamic-storage write loop generalized to element-typed chunks - split the
  elements into chunks, verify each chunk output, and apply the same **orphan-bound + old-chunk consumption**
  scans (`emitVerifyChunkUtxoCount`) that already make `string`/`bytes` writes leave the exact chunk set.
- **Status:** designed only. The `string`/`bytes` chunk path (phase 1) is shipped and green; arrays are
  phase 2 in dynamic-storage.md. It would most naturally become the new backend for the **default** state
  `T[]` (or a third explicit modifier) - to be decided when built.

## Choosing a state array

| Need | Use |
| --- | --- |
| `push`/`pop`/`.length`, small total (~120 B) | `packed T[]` |
| Sparse / random keyed-by-int, no `push`/`length`, iterable | non-packed `T[]` (collection) |
| Dense `push`/`.length` **and** unbounded | chunk-packed (proposed) - until then, `packed` (capped) or a non-packed collection + a manual length field |
| Transient scratch in a function | local `int[]` |

## Maintenance notes

- This doc must stay consistent with: `AstBuilder.ts` (packed vs collection routing ~1666-1687),
  `SymbolTableTraversal.ts` (array bin-packing ~543-569), `GenerateTargetTraversal.ts` (`visitStateArray*`,
  local-array ops), and dynamic-storage.md (chunk machinery the proposed form reuses).
- The operation matrix above was verified empirically by compiling each op against each form. Re-verify if
  the array op routing changes.
- When the chunk-packed array is built, move section 4 from "proposed" to "shipped", record which syntax
  selects it (new default vs modifier), and add its `.length`/random-access codegen entry points here.
