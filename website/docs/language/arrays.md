---
title: Arrays
---

SolidCash supports fixed-size and dynamic arrays, array literals, nested arrays, arrays of structs, and the usual
indexing and mutation operations. The important distinction is where an array lives: a local array is one transient
VM value, while a state array can use one of three persistent UTXO layouts.

## Syntax and local arrays

```solidity
uint256[3] fixedValues = [uint256(10), 20, 30];
uint256[] memory values = new uint256[](3);

values[0] = 10;
values.push(40);
values.pop();
uint256 count = values.length;
```

Parameters, locals, and return values live on the VM stack; `memory` is accepted but normally optional. Their
logical encoding begins with an element count. Fixed-width elements are tightly packed, while variable-width
elements are individually pushdata-framed.

Local dynamic arrays support indexed reads and writes, `.length`, `.push(value)`, `.push()` with the element
default, `.pop()`, and `.delete(index)`. SolidCash's `.delete(index)` is an efficient unordered removal: it moves
the last element into the removed position and shortens the array. It does **not** preserve order.

```solidity
uint256[] values = [10, 20, 30];
values.delete(0); // [30, 20]
```

`delete values` resets the whole local array to its default value. Indexes are bounds-checked.

## State-array backend selection

The compiler selects a state layout from the declaration, element type, and compiler compatibility mode:

| Source form | Native SolidCash backend | Shape |
| --- | --- | --- |
| Unbounded `T[]` with a recursively chunk-packable element | Chunk-packed dynamic state | Dense, growable, length-tracked |
| `T[] packed` or `T[N] packed` | Inline packed data-NFT field | Dense and length-tracked, but commitment-bounded |
| Top-level non-packed `T[N]` | Entry-NFT collection keyed by index | Sparse/mapping-like; no runtime length |
| A form excluded from chunk packing | Entry-NFT collection keyed by index | Sparse/mapping-like |

Chunk-packable elements include bounded integers, fixed bytes, `bool`, `pubkey`, fixed-point and value types;
variable-width `bigint`, `string`, `bytes`, and `address`; structs; and nested arrays whose leaf type is supported.
Fixed-width values use a flat stream and variable-width values use framing.

Two compiler options intentionally alter selection:

- `chunkedArrays: false` sends otherwise eligible unbounded arrays to the legacy entry-collection backend.
- `solidityImportCompat: true` represents a supported bounded `T[N]` as one packed field, matching Solidity's
  contiguous fixed-array behavior. Native `.scash` compilation keeps a non-packed bounded array as a collection.

Because these choices change state layout and available operations, keep them stable for an already deployed
contract.

## Chunk-packed dynamic arrays

The default state backend for an eligible unbounded `T[]` is a hidden `uint32 <name>$len` field plus a dense run of
120-byte chunk NFTs:

```solidity
struct Task {
    uint256 id;
    string label;
}

contract Queue() {
    Task[] public tasks;
    uint256[][] public rows;

    function add(Task task) public {
        this.tasks.push(task);
    }

    function removeUnordered(uint256 index) public {
        this.tasks.delete(index);
    }
}
```

The hidden length is a byte length for a flat fixed-width stream. For a framed array it is the size of the encoded
array blob, whose own prefix carries the element count. Chunk commitments authenticate consecutive chunk indexes;
the data-NFT header authenticates the exact required count, preventing suffix omission or reordering.

The dense API includes whole-array assignment and reads, `.length`, indexed reads and writes, `.push()`,
`.push(value)`, `.pop()`, `.delete(index)`, and `for (T value of this.items)`. Nested indexing and struct-field
updates rebuild the affected logical value.

Current element reads reassemble the complete chunk run, and mutations rewrite the complete run. Random access is
therefore logically indexed but currently **O(n)** in the encoded array size. The reconstructed value must also fit
within Bitcoin Cash's stack-item limit. Chunking removes the 128-byte NFT-commitment limit; it does not make an
arbitrarily large value cheap or readable in one VM operation.

## Inline `packed` arrays

`packed` stores the complete dense array as one field in a data NFT:

```solidity
bytes20[] packed public committee;
uint32[4] packed public weights;
```

Only fixed-width element types are accepted. The API is the same dense API as for chunk-packed state arrays, but
the complete encoding must fit the 128-byte commitment budget. An unbounded packed array receives its own data NFT
because its maximum encoded size is unknown; a bounded packed array must be the last field in its data NFT.

Use this layout for small arrays where avoiding chunk UTXOs is worth a hard size limit. Use an ordinary unbounded
`T[]` when the array must grow beyond one commitment.

## Collection-backed arrays

A native, non-packed top-level `T[N]` is represented by the verified-entry machinery also used by mappings. Only
written indexes need entry NFTs, so this is a sparse integer-keyed collection rather than a dense blob.

```solidity
contract SparseSlots() {
    uint256[1000] slots;

    function set(uint256 index, uint256 value) public {
        this.slots[index] = value;
    }
}
```

Collection-backed arrays support authenticated index reads/writes, deletion/defaulting, and collection iteration.
They do not expose dense `.length`, `.push()`, or `.pop()` semantics. Each touched index carries entry-NFT and dust
overhead. If the desired abstraction is genuinely sparse, a `mapping(uint256 => T)` often communicates that intent
more clearly.

## Iteration and ordering

Dense state arrays can be iterated directly:

```solidity
uint256 sum = 0;
for (uint256 value of this.values) {
    sum += value;
}
```

The compiler caches the dense state value once and lowers the loop to indexed local-array access. Collection-backed
arrays instead use authenticated entry iteration. As with every unbounded on-chain loop, application logic must
keep the reachable size within transaction and VM limits.

Remember that `.delete(index)` is swap-with-last removal. Use an explicit shift loop if stable ordering is required,
and account for its linear cost.

## State reads in the SDK

`StatefulContract.getState()` reconstructs dense arrays from their data header and ordered chunks, and returns
decoded JavaScript arrays. Normal stateful calls use artifact metadata to discover the old chunks or entry witnesses
and create the required replacement outputs; applications should not manually encode or number chunk NFTs.

For the physical formats, see [State Storage & Data Encoding](./storage-model.md). For arrays held as mapping
values, including root-addressed continuation chunks, see [Verified Mappings](./verified-mappings.md).
