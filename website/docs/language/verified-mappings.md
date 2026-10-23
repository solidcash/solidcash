---
title: Verified Mappings (Vmaps)
---

Every SolidCash `mapping(K => V)` is a **verified mapping**, or **vmap**. Vmaps preserve Solidity's rule that an
unset key reads as the value type's default while also proving that the key is really absent from the on-chain
collection.

This proof is essential on a UTXO chain. A transaction author chooses which UTXOs to spend; a covenant can inspect
an included input, but it cannot ask the global UTXO set whether a hidden entry exists. A mapping which interpreted
"no matching input" as zero would allow an attacker to omit a nonzero balance, a used replay nonce, or a revoked
permission and make it appear unset.

SolidCash never silently falls back to that omission-prone model. If the compiler cannot authenticate a mapping
access shape, compilation fails.

## Source-level mapping behavior

Mappings use Solidity-compatible declaration and access syntax:

```solidity
contract Ledger() {
    mapping(address => uint256) public balances;
    mapping(address owner => mapping(address spender => uint256 amount)) allowances;

    function set(address account, uint256 amount) public {
        this.balances[account] = amount;
    }

    function add(address account, uint256 amount) public {
        this.balances[account] += amount;
    }

    function clear(address account) public {
        delete this.balances[account];
    }
}
```

- Reading an absent key returns the type default.
- Assignment is an authenticated upsert: update an existing node or insert a new one.
- Compound assignment is an authenticated read-modify-write.
- `delete mapping[key]` assigns the default value; it does not promise physical node removal.
- Nested mappings derive one composite authenticated slot from all key components.
- Other contracts read a mapping through an interface that declares it, with the same membership proof. Under
  `evmCompat`, a `public` mapping also gets a Solidity getter function.
- Bare access (`balances[account] += amount`) compiles to the same bytecode as the `this.` form.

## Authenticated sorted-list model

Each mapping is stored as a sorted, singly linked list of mutable entry NFTs. The list begins with a mandatory
HEAD sentinel at slot zero:

```text
HEAD(0) --> K1 --> K2 --> ... --> Kn --> 0 (+infinity)
```

Every node belongs to all of these domains:

- the deployed contract's CashToken category;
- the mapping's collection signature and P2SH32 entry covenant; and
- its hashed key slot and successor link.

An NFT paid to the same address with another category, or an entry from a sibling mapping with the same types, does
not authenticate as a node in this collection.

### Slot derivation

For one key:

```text
slot = positive255(sha256(canonicalKeyEncoding))
```

For nested mappings:

```text
slot = positive255(sha256(sha256(k0) || sha256(k1) || ... || sha256(kn)))
```

`positive255` clears the high bit of the final byte. Slots are 32-byte little-endian values; the cleared sign bit
lets Bitcoin Script compare the full domain as non-negative numbers. Slot zero is reserved for HEAD.

The key encoding is type-aware. An `address` key hashes its canonical locking bytecode, not its CashAddress text.
Under `evmCompat`, an `address` key is hashed by its 20-byte identity instead (except under the experimental
[framed convention](/docs/guides/framed-composition)). The compiler and SDK use the same codec before hashing.

### Node commitments

Every vmap node begins with exactly 64 structural bytes:

```text
slot[32] || nextSlot[32] || valueTail[0..64]
```

- `slot` identifies this key.
- `nextSlot` identifies the next occupied slot.
- `nextSlot == 0` means the positive-infinity end of the list.
- `valueTail` contains the value or its authenticated large-value descriptor.

The empty mapping still has one node:

```text
HEAD = 0[32] || 0[32]
```

Deployment creates a HEAD entry for each mapping. For every non-tail link, `slot < nextSlot`. The authenticated
HEAD and successor links are what turn a set of independently discoverable UTXOs into one complete logical map.

## Membership and non-membership proofs

For a read of `m[key]`, the SDK hashes `key`, validates the list it received from the provider, and selects one
witness node.

### Present key

The exact node is co-spent:

```text
node.slot == requestedSlot
```

The covenant verifies the node's category, capability, entry address, slot, and commitment encoding before using
its value.

### Absent key

The strict predecessor is co-spent:

```text
predecessor.slot < requestedSlot
and (predecessor.nextSlot == 0 or requestedSlot < predecessor.nextSlot)
```

This proves there is no occupied slot at the requested position. Omitting an existing exact node cannot help an
attacker: its predecessor link points to that node and no longer brackets the requested slot.

The proof makes default-on-absent reads safe for balances, allowlists, claim-once state, replay protection, and
negative authorization checks.

## State transitions

### Update

An update consumes the exact node and recreates it with:

- the same slot;
- the same `nextSlot`; and
- the newly encoded value.

The mapping address and category are preserved. A builder cannot rename the key, reorder the node, or splice out a
successor while updating its value.

### Insert

An insert consumes the strict predecessor `P` and produces two authenticated nodes:

```text
before: P.slot --> P.nextSlot

after:  P.slot --> requestedSlot --> old P.nextSlot
```

The covenant verifies the ordering inequalities, the predecessor's unchanged value, both output addresses and
categories, and the exact new links. This prevents insertion from replacing, skipping, or detaching an existing
node.

### Delete and nullification

Solidity defines `delete m[k]` as assigning `V`'s default value. SolidCash follows that observable rule and may
leave the node linked with an empty/zero/false value. Code must not use physical node presence as an application
signal; use the decoded value or store an explicit `exists` field when presence has distinct meaning.

Large-value updates also consume or make collectible the chunks belonging to the old root so stale data is not
accepted as part of the new value.

## Values which exceed one commitment

The structural `slot` and `nextSlot` fields leave 64 commitment bytes for a value. Fixed-width encodings of at
most 64 bytes fit inline. Variable-width values (strings, bytes, dynamic arrays, chunkable structs, and oversized
signatures) use a length-aware representation.

### Inline variable value

At 60 bytes or fewer:

```text
slot[32] || nextSlot[32] || lengthLE32[4] || value[0..60]
```

### Root-addressed value chunks

Above 60 bytes, the entry fills its 128-byte commitment with:

```text
slot[32] || nextSlot[32] || lengthLE32[4] || root[32] || headData[28]

root = sha256(fullValue)
```

The remaining bytes live in continuation NFTs. Their locking bytecode commits to the contract category,
collection, slot, and root, while each commitment contains:

```text
chunkIndexLE16[2] || chunkData[1..126]
```

For length `L > 60`, reconstruction expects exactly `ceil((L - 28) / 126)` chunks. The codec allows up to 32,768
chunks, but a value assembled on chain must still fit the 10,000-byte stack-item limit. Indexes must be consecutive
from zero; every non-final chunk must contain 126 bytes; the final chunk must have the exact remainder; the result
must have length `L`; and its SHA-256 must equal `root`.

The address changes when the slot or value root changes, so chunks from another key or an older value version
cannot be substituted. These 126-byte **value chunks** are distinct from the 120-byte dense chunks used by a
top-level dynamic state variable. See [State Storage & Data Encoding](./storage-model.md#large-values-inside-mappings).

## Mapping iteration

Mappings are non-iterable by default, matching Solidity's source model, and iterating a plain mapping is a compile
error that names the fix. Opt in explicitly with `enumerable`. The visibility may come before `enumerable` or after
the mapping type, so `public enumerable mapping(address => uint256) balances;` also parses.

```solidity
contract Registry() {
    enumerable mapping(address => uint256) public balances;

    function sum() public returns (uint256 total) {
        for (uint256 balance of this.balances) {
            total += balance;
        }
    }

    function count() public returns (uint256 total) {
        for (address holder in this.balances) {
            total += 1;
        }
    }

    function audit() public {
        for (address holder, uint256 balance of this.balances.entries) {
            require(holder != address(0) || balance == 0);
        }
    }
}
```

The three modes are:

| Syntax | Iteration value |
| --- | --- |
| `for (V value of this.m)` | Values |
| `for (K key in this.m)` | Keys |
| `for (K key, V value of this.m.entries)` | Key/value pairs |

The loop source is always written with `this.`. Declaring a mapping `enumerable` does not change the storage or
security model; plain and enumerable mappings are both vmaps.

Iteration co-spends the reachable list and verifies the HEAD, ordering, links, category, collection address, and
completeness. A missing middle node breaks the predecessor-to-successor link check. Values are stored in the entry
commitments. Keys are not: before a key or entry loop, the caller supplies every original canonical key through the
SDK and the covenant proves `keyToSlot(key) == node.slot` for each linked node.

```ts
ledger.setIterationKeys('balances', [aliceLockingBytecode, bobLockingBytecode]);
await ledger.call.audit().send();
```

Pass canonical **encoded key bytes**, not JavaScript values or CashAddress text. For example, a `bytes20` key is
its 20 raw bytes, an `address` key is its locking bytecode, and an integer key uses canonical Script-number bytes
(such as `bigIntToVmNumber(n)` from libauth). Each encoded key must be at most 255 bytes because the hidden key
blob uses a one-byte length prefix. The array order is irrelevant; the SDK hashes the supplied encodings and
matches them to ascending slots.

Key and entry iteration currently supports a mapping with one key dimension. A nested/composite mapping uses a
slot derived from several independent key hashes and is rejected for these two modes because there is no single
preimage to provide. Values-only iteration supports the authenticated list without raw keys. The cost grows with
the number of entries, so do not use unbounded iteration on a mapping an attacker can grow without limit.

Runtime-bounded batch writes and iteration are accepted only for shapes the compiler can settle safely. Unsupported
dynamic key, aliasing, loop, or large-value combinations fail closed rather than emitting a weaker transition.

### Windowed iteration

A values loop can walk a bounded page per call instead of the whole list, so a large mapping can be processed over
several transactions:

```solidity
bytes32 cursor;                                   // slot of the last entry visited
uint256 total;
enumerable mapping(bytes32 => uint256) amounts;

function sumPage() public {
    for (uint256 amount of this.amounts.window(cursor, 10)) {
        this.total += amount;
    }
}
```

- The form is `for (V value of this.m.window(cursor, N))` on an `enumerable` mapping. It yields values only.
- `cursor` names a `bytes32` state variable; any other type is a compile error. It holds the 32-byte slot of the
  last entry visited, not a key. Zero means the start of the list.
- `N` is a positive integer literal: the most entries one call visits.
- Each call co-spends the entry whose slot equals the stored cursor (the HEAD sentinel when the cursor is zero) and
  at most `N` entries after it, stopping at the end of the list. It then writes the slot of the last entry visited
  back to `cursor`. The covenant checks that the first entry matches the stored cursor and that the entries are
  consecutive links, so a spender cannot skip an entry.
- The walk follows slot order (key hashes), not insertion order. An entry inserted behind the cursor is not
  visited until the walk starts again.
- Once the cursor reaches the last entry, later calls visit nothing. Assign `bytes32(0)` to the cursor (for
  example in an authorized reset function) to start again from the head.
- The SDK reads the stored cursor and selects the window. No iteration keys are needed.

## Structs, arrays, and storage references

Values can be structs and arrays. Field and element operations have normal read-modify-write semantics:

```solidity
struct User {
    string name;
    uint256 score;
}

mapping(address => User) users;

function rename(address who, string name) public {
    this.users[who].name = name;
}
```

The compiler may coalesce several writes to the same entry so they observe earlier writes and settle one final
value. Storage-reference helpers such as `User storage user = users[who]` or an internal
`mapping(K => V) storage` parameter alias the authenticated entry; they do not create an independent in-memory
copy unless the source explicitly requests `memory`.

## Off-chain SDK APIs

Normal function calls resolve required mapping witnesses automatically from artifact access metadata. Public
getters and `getEntries()` provide off-chain reads:

```ts
const balance = await ledger.balances(aliceAddress);

const entries = await ledger.getEntries('balances');
for (const entry of entries) {
  console.log(entry.slot, entry.value);
}
```

`getEntries()` currently returns `slot`/`value` records decoded from category/capability-filtered UTXOs at the
collection address. Its result type reserves optional `key` and `keys` fields for key-aware tooling, but the current
reader does not reconstruct them. It is a provider-view convenience, not an on-chain completeness proof: malformed
entries are skipped with a warning, and a dishonest provider can omit a UTXO. Normal call construction and
on-chain iteration rebuild and validate the complete `SortedList` before using it.

Never assume a 32-byte slot is reversible to the original key. Hashing is one-way, so applications that need
off-chain key enumeration should retain keys in values, events, or an application index. Feed those retained,
canonically encoded keys to `setIterationKeys()` when a contract executes a keys/entries loop.

Low-level helpers are exported for tooling and audits:

```ts
import {
  SortedList,
  keyToSlot,
  encodeEntryCommitment,
  decodeEntryCommitment,
  getEntryNftAddress,
  getValueChunkAddress,
} from '@solidcash/solidcash/stateful';
```

`SortedList` validates and plans membership, non-membership, insert, update, and delete transitions. Application
code should normally let `StatefulContract` use it through auto-derivation.

If a key expression cannot be inferred from function arguments or state, the pending-call escape hatches
`withEntryKey(slotIndex, key)` and `withExternalEntryKey(slotIndex, key)` can provide discovery data. They do not
bypass the on-chain hashed-slot and link verification.

## Cross-contract reads and calls

An external mapping read co-spends the callee's entry witness and authenticates it against the callee's self-pinned
address and collection layout. A stateful external call can update the mapping as part of the callee's block. The
caller should register the concrete callee through connect-time `externals` or `withExternalCall()` so the SDK can
find the right collection UTXOs.

:::caution Experimental
Updating another contract's state through a composed call, and message-bus composition, are experimental in this
release. Test every composed shape under real limits before relying on it. See
[Atomic Calls with the Message Bus](/docs/guides/message-bus).
:::

When several logical invocations of one participant use the same mapping in a message-bus transaction, the
participant's collection journal preserves sequential semantics: later rows observe earlier pending writes and one
final list transition is settled. Graphs whose key identities or settlement authority cannot be proved are rejected
with a message-bus admission diagnostic.

## Supported and fail-closed shapes

Point reads, ordinary upserts/nullification, compound value operations, fixed multi-key batches, common ERC-20
transfer/allowance patterns, authenticated iteration, nested keys, and chunked values are implemented. Several
dynamic shapes remain deliberately rejected rather than compiled with weaker proofs:

- a varying-key loop whose assigned value is an unsupported loop-local computation such as `m[keys[i]] = i`;
- writes to several different vmap collections inside one runtime loop;
- repeated keys in a varying-key array-mutation loop (`push`, `pop`, or indexed element assignment), where one
  physical entry would need sequential mutation;
- some consecutive straight-line scalar read-modify-writes to the same entry which cannot be proven to coalesce;
  and
- cross-contract or message-bus combinations whose key identity, effect summary, or single settlement authority
  cannot be published by the compiler.

Supported loop sources include bounded parameter/literal values and aligned key/value arrays for recognized forms.
Compile the actual application shape and keep a regression test around it; do not infer support for a new loop
merely because a simpler vmap access compiles. These boundaries raise `SortedMappingCodegenPendingError` or a more
specific admission diagnostic.

## Security and availability guarantees

A valid vmap transition proves:

1. An existing key cannot be presented as absent.
2. An absent key cannot be presented as present.
3. A node cannot come from another contract or collection.
4. An update cannot change the node's slot or successor.
5. An insertion cannot skip or detach existing nodes.
6. Iteration cannot silently omit a reachable node.
7. A large value cannot be truncated, reordered, or assembled from another root's chunks.

Vmaps guarantee integrity, not provider availability. A provider can hide a required UTXO and prevent a client from
building a call, but it cannot make the covenant accept a different value. Use redundant providers or your own
indexer for applications which require strong read availability.

## Cost guidance

- A point read spends and recreates one exact node or predecessor witness, plus any value chunks it needs.
- Updating an existing small value normally rewrites one entry node.
- Inserting rewrites the predecessor and creates a new node.
- A long-value operation carries its root-addressed continuation chunks.
- Iteration scales linearly with the complete reachable list.
- Each live NFT carries dust and adds transaction bytes, so a vmap is not a free database.

Prefer a vmap for sparse keyed state and authenticated absence. Prefer a dense state array for ordered indices and
`length`/`push` semantics. For large records, consider splitting frequently modified fields across mappings so a
small update does not rewrite an unrelated large chunked value.

## Related documentation

- [Stateful Contracts](./stateful-contracts.md): source declarations and operations
- [State Storage & Data Encoding](./storage-model.md): all NFT families and codecs
- [How the State Journal Works](/docs/guides/state-journal): read-after-write and final settlement
- [Cross-Contract Calls & Results](./cross-contract-calls.md): authenticated external state access
- [Concurrency](/docs/guides/concurrency): UTXO contention and contract threads
