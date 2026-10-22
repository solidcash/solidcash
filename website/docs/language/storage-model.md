---
title: State Storage & Data Encoding
---

SolidCash state is a set of covenant-controlled Bitcoin Cash UTXOs. There is no account record and no opcode that
updates a storage slot in place. A state transition consumes the UTXOs containing the old state and creates the
UTXOs containing the new state; the contract verifies the replacement set before the transaction can succeed.

This page describes the physical model behind state variables, verified mappings, arrays, chunk NFTs, events, and
return values. Most applications use the high-level language and `StatefulContract` APIs and never construct these
commitments directly, but the model matters for cost, concurrency, and security reviews.

## Contract identity and the master NFT

Deploying a stateful contract creates a new CashToken category and a **master NFT** with `minting` capability. The
deployed contract bytecode is salted with that category. This makes the final locking bytecode self-pinning: an
output at the same apparent covenant address but with another category cannot impersonate the contract's state.

The master is the authority for legitimate changes to the contract's other NFTs. Ordinary calls preserve it at the
contract's locking bytecode. Lifecycle operations deliberately change that rule: `split` creates additional
threads, `merge` consolidates them, `upgrade` changes the protected bytecode, and `selfdestruct` consumes the
contract permanently.

An `upgrade` re-mints the data NFTs on the new bytecode, and the satoshi and token containers move with the master.
Mapping entries follow one per transaction through a `migrateRecords` function. Values kept in chunk NFTs do not
migrate yet, and the SDK refuses an upgrade that would strand one. See
[Upgrades, Proxies & Delegatecall](./upgrades-proxies.md).

:::important
Stateful contracts use `p2sh32`. A contract **address** is the self-pinned master locking bytecode and is the handle
used for cross-contract interaction. The category identifies the CashToken family; the address binds that category
to the contract code and constructor arguments.
:::

## The contract's UTXO families

One logical contract can own several kinds of UTXO. Its own NFT families share the contract's category; the
containers hold BCH or another category's tokens. Each kind has its own covenant, commitment format, and lifetime.

| UTXO | CashToken capability | Purpose | Typical transition |
| --- | --- | --- | --- |
| Master NFT | `minting` | Contract identity and state-transition authority | Preserved, except during lifecycle operations |
| Data NFT | `mutable` | Fixed-size state fields and dynamic-value length headers | Consumed and recreated when its fields change |
| Vmap entry NFT | `mutable` | One authenticated sorted-list node | Read-preserved, updated, or inserted |
| Dynamic chunk NFT | `mutable` | A dense 120-byte slice of a state `string`, `bytes`, or chunk-packed array | Recreated as the value grows, shrinks, or changes |
| Vmap value-chunk NFT | `mutable` | Continuation data for one large mapping value version | Root-addressed; replaced or garbage-collected on update |
| Event NFT | `none` | A typed emitted event record | Created by `emit`; spendable for cleanup after 144 blocks |
| Return-event NFT | `none` | An authenticated cross-contract or explicitly emitted return value | Created as an `OP_TRUE` output and disposable after use |
| Token container | The held token's own (fungible amount, an optional NFT, or both) | Custody of a selected foreign CashToken category | Preserved, credited, or pays an authenticated token output |
| Satoshi container | No token | Contract-controlled BCH | Preserved, credited, or pays an authenticated BCH output |
| Oracle/compute side-car | varies | Blockhash, keccak256, ecrecover, or message-bus support | Co-spent and normally self-preserved with a new result |

These are implementation families, not source-level types. For example, assigning a long `string` still looks like
one state assignment even though the transaction may rewrite several chunk NFTs.

## Data NFTs and state layout

CashToken NFT commitments are limited to 128 bytes. The compiler therefore bin-packs ordinary state fields across
one or more data NFTs and publishes the result as `artifact.stateLayout`.

Each field has a data-NFT index and a field index. Fields are encoded in declaration/layout order. If a contract
needs more than one data NFT, every commitment begins with its encoded NFT index; both the compiler and SDK verify
that tag so sibling data NFTs cannot be swapped.

A field with no fixed width is isolated too: a `bigint`, and a struct or fixed-size array that holds a `bigint`, a
`string` or an unbounded `bytes`, gets a data NFT of its own, so a value that grows cannot overflow a neighbour's
commitment. Its value still has to fit that one commitment; a top-level `string` or `bytes` uses the chunk backend
below and has no such bound.

An `external` state variable is deliberately isolated in its own data NFT. Contract threads partition data NFTs, so
`external` variables let functions that touch different variables run on different threads; see
[Concurrency](/docs/guides/concurrency#design-state-for-partitions). Struct values without mapping or
dynamic-array fields are stored as ordinary data-NFT fields; structs containing either are recursively flattened
into independently backed fields. Struct fields and packed arrays are placed last in a data NFT when their
composite footprint would make safe following-field offsets ambiguous.

```solidity
contract Profile() {
    uint64 visits;
    bool enabled;
    bytes20 owner;
    string label; // data NFT stores label$len; chunk NFTs store the UTF-8 bytes
}
```

`constant` values are compiled into the bytecode and occupy no state. `immutable` values are fixed during
construction but still occupy a data-NFT field. `transient` variables occupy nothing: each call starts them at
their default value and drops them when it ends. A dynamic field occupies a hidden `uint32 <name>$len` header in the
data layout; its value bytes live in chunks.

### Canonical state encoding

The storage codec is shared by the compiler and `@solidcash/utils`. It uses canonical Bitcoin Script pushdata
framing, not Ethereum ABI words:

| Value | Commitment encoding |
| --- | --- |
| `false` / `true` | `OP_0` / `OP_1` |
| Integer, enum, fixed-point | Minimal BCH VM number (little-endian sign-magnitude), canonically pushed |
| `bytesN`, `pubkey`, `sig`, `datasig` | Exact byte value with canonical pushdata framing |
| `string` | UTF-8 bytes with canonical pushdata framing |
| Struct | Fields concatenated in declaration order, each using its own type encoding |
| Array value | Element count followed by elements; fixed-width elements are tightly packed |
| User-defined value type | Encoding of its underlying type |
| `address` | The locking bytecode, not a CashAddress display string |

Bounded integers and fixed-point values are range-checked while encoding and decoding. A fixed-point value is the
scaled integer defined by its decimal precision. `bytesN` and public keys must have the declared exact length.

This storage codec is intentionally different from `abi.encode`. ABI data is an interchange/call format;
pushdata commitments are the compact, Script-native state format. Use the matching decoder for the format you are
reading. See [ABI Encoding & Call Data](./abi-encoding.md) for native and EVM-compatible ABI modes.

## Verified mappings

Every `mapping(K => V)` is a [**verified mapping** (vmap)](./verified-mappings.md). A transaction author controls which UTXOs to include, so
"entry absent from this transaction" is not proof that a key is unset. SolidCash solves this with an authenticated,
sorted linked list.

For a single key, the logical slot is derived from its canonical key encoding:

```text
slot = positive255(sha256(canonicalKeyEncoding))
```

Nested mappings hash every key component before deriving the composite slot. Slot zero is reserved for the HEAD
sentinel. Each node commitment begins with:

```text
slot[32] || nextSlot[32] || valueTail[0..64]
```

An existing-key read co-spends that exact node. An absent-key read co-spends the unique predecessor whose
`slot < requestedSlot < nextSlot` link proves non-membership. The covenant also binds the node to the contract
category and the mapping-specific entry address. Hiding an existing entry, substituting another collection's node,
or breaking the links fails validation.

`delete this.map[key]` has Solidity semantics: it assigns the value type's default. It need not physically remove
the node. Declaring a mapping `enumerable` allows the compiler to follow and verify the complete linked list; it
does not change this storage or authentication model.

## Dynamic chunk NFTs

State `string`, unbounded `bytes`, and most unbounded `T[]` values use a dense chunk backend. A hidden `uint32`
header in a data NFT is the authoritative byte length. The bytes are split into chunks of at most 120 bytes:

```text
data NFT:       <name>$len
chunk 0 NFT:    push(chunkIndex=0) || push(data[0:120])
chunk 1 NFT:    push(chunkIndex=1) || push(data[120:240])
...
```

All chunks for one variable share a collection-specific P2SH32 covenant address and the contract's category. The
transaction must present exactly the dense sequence `0..ceil(length / 120)-1`. The length header prevents a
spender from withholding a suffix and pretending the value is shorter; verified indexes prevent reordering or
substitution.

Writing the value rewrites its chunk run. Growing can mint additional mutable chunks; shrinking consumes obsolete
chunks; assigning empty bytes leaves a zero length and no chunks. Reads concatenate the authenticated chunks and
truncate to the authoritative length. Read-after-write within one execution uses the journaled value directly.

:::note
"Chunk NFT" is a storage implementation term. There is no `chunk` keyword, and applications should not create or
number these UTXOs themselves. `StatefulContract` discovers, orders, validates, and recreates them.
:::

### Dense array backends

State arrays have several representations, selected from their declaration and element type:

| Declaration/form | Backend | Main trade-off |
| --- | --- | --- |
| Unbounded `T[]` with a chunk-packable element | Length header + 120-byte chunks (default) | Dense and growable; an update currently rewrites the chunk run |
| `T[] packed` or `T[N] packed` | One inline data-NFT blob | Cheapest for small arrays; bounded by the commitment budget |
| Native bounded non-packed `T[N]` or an ineligible form | Entry-NFT collection keyed by index | Sparse and individually addressable; no dense length authority |
| Local/memory array | One transient stack value | Not persisted; bounded by VM stack-item limits |

Chunk-packed fixed-width arrays store a tight element stream. Variable-width leaves, structs, and supported nested
arrays use framed element encoding. Dense arrays expose `.length`, index access, `push`, `pop`, iteration, and
swap-with-last `.delete(index)`; collection-backed arrays instead have sparse mapping-like operations.

The `chunkedArrays` compiler option defaults to `true`. Disabling it selects the legacy collection backend for
otherwise chunk-packable unbounded arrays and changes the available dense-array behavior; treat that as a deliberate
compatibility choice, not a storage optimization toggle. Under `evmCompat`, a bounded `T[N]` is one packed field,
or a chunk-packed value created with all `N` elements when it does not fit one commitment.

See [Arrays](./arrays.md) for the complete selection and operation matrix.

## Large values inside mappings

A mapping value has only 64 bytes after its `slot` and `nextSlot`. Small fixed values are stored directly.
Variable-width values use a different chunk format from dynamic state variables:

- Up to 60 bytes: `lengthLE32 || value` is stored inline in the entry.
- More than 60 bytes: the entry stores `lengthLE32 || sha256(fullValue) || first28Bytes`.
- Remaining data is stored in 126-byte continuation chunks whose commitments are
  `chunkIndexLE16 || chunkData`.

The continuation address commits to the contract category, collection, mapping slot, and value root. It therefore
names one version of one value. Reconstruction requires the exact chunk count, consecutive indexes, exact chunk
sizes, exact total length, and a matching SHA-256 root. These **root-addressed value chunks** must not be confused
with the 120-byte dense chunks used by top-level dynamic state.

## Events, returns, and compute results are not state fields

All three use NFT commitments to move data, but their semantics differ:

- An **event NFT** is an immutable, typed log at an event-specific covenant address. It can be cleaned up after a
  144-block relative delay. It is not read by later contract state unless the application explicitly co-spends it.
- A **return-event NFT** is an `OP_TRUE`, immutable result carrier. A caller verifies its category against the
  co-spent callee and decodes its commitment. It is disposable, not a historical event stream.
- A **compute result NFT** (for example a keccak256 side-car) is normally mutable and self-preserving. The side-car
  executes the expensive primitive in its own input budget and recreates itself with the authenticated result in
  its commitment.

See [Events & Errors](./events-errors.md), [Cross-Contract Calls](./cross-contract-calls.md), and
[Cryptography](./cryptography.md) for those protocols.

## What the SDK derives

The artifact records the state layout, collections, dynamic read/write footprints, block slots, events, external
calls, and auxiliary side-cars required by each ABI function. The SDK uses that metadata and a local BCH VM probe
to discover concrete commitments and positions, then builds a transaction whose outputs the on-chain covenant
independently verifies.

The division of responsibility is important:

- The SDK finds UTXOs, orders chunks and entries, derives outputs, estimates fees, and provides witnesses.
- The contract bytecode authenticates categories, addresses, commitments, counts, links, and permitted effects.

A buggy or malicious builder may fail to produce a transaction, but it cannot redefine a valid state transition.

## Cost and design consequences

- Touching more NFT families means more inputs, outputs, bytes, dust, and fees.
- A vmap random access generally needs the requested node or its predecessor; complete iteration needs the list.
- Reading or rewriting a dynamic value currently co-spends its chunk run, so very large values are expensive.
- One master UTXO serializes ordinary calls. Use `split`/`merge` when the application needs explicit parallel
  threads, and design independent data across mappings/chunks where possible.
- The 128-byte commitment limit is a layout constraint, while the 10,000-byte stack-item, transaction-size,
  standardness, and per-input operation-density limits constrain a complete call.

For the source-level APIs, continue with [Stateful Contracts](./stateful-contracts.md). For transaction-local
read-after-write behavior, see [How the State Journal Works](/docs/guides/state-journal).
