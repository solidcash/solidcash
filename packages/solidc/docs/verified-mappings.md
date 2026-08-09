# Verified mappings (vmaps)

This document is the normative specification for mapping storage in SolidCash. Every mapping is a verified mapping,
or **vmap** for short. Vmaps use authenticated sorted linked lists. There is no
compiler option selecting another mapping backend and no soundness fallback to the legacy, omission-prone entry
model. An unsupported access shape must produce a compiler error rather than weaker bytecode.

A verified mapping preserves Solidity's observable rule that an unset key reads as its type's default while proving
that the key is actually absent. It also makes mappings enumerable when the source requests iteration.

## 1. Threat model and security goal

A mapping entry is a UTXO. Bitcoin Script can authenticate an input that is present, but it cannot query the UTXO
set or force a transaction author to include an arbitrary UTXO. A mapping implementation of the form

```
entry input present ? committed value : default value
```

is therefore unsound. A spender can omit an existing entry and make `m[k]` appear to be zero, false, or empty.
This breaks negative guards, replay maps, claim-once maps, read-modify-write, and any logic whose result differs
between “absent” and “present with a non-default value.”

A vmap requires an authenticated proof for both possible results:

- Membership: spend the unique node whose `slot == H(key)`.
- Non-membership: spend the unique predecessor whose link brackets `H(key)`.

The required security properties are:

1. An existing key cannot be presented as absent.
2. An absent key cannot be presented as present.
3. A node cannot be substituted from another contract or collection.
4. An update cannot change the node's key or link.
5. An insertion cannot skip, replace, or detach an existing node.
6. A malformed, incomplete, cyclic, duplicated, or disconnected off-chain list is rejected.
7. Large values are reconstructed completely and authenticated by their entry root.

The adversary controls transaction construction, input/output order outside fixed covenant slots, witnesses,
provider responses, and all UTXOs not protected by the contract's category and covenants.

## 2. Authenticated set

Each mapping is a sorted, singly-linked list of mutable NFTs. All nodes use the contract's CashToken category and
the collection-specific entry P2SH32 covenant.

### 2.1 Slot derivation

For a single key:

```
slot = positive255(sha256(canonicalKeyEncoding))
```

For nested mappings:

```
slot = positive255(sha256(sha256(k0) || sha256(k1) || ... || sha256(kn)))
```

`positive255` clears the high bit of the final byte. Slots are 32-byte little-endian values. Clearing the sign bit
allows BCH `OP_BIN2NUM` and numeric comparison opcodes to order the full 255-bit domain without interpreting half
of the hashes as negative numbers.

Hashing every nested key independently makes the composition unambiguous. Address keys use their canonical locking
bytecode, not a display string. The compiler and SDK must use the same type encoding before hashing.

Slot zero is reserved for the HEAD sentinel. Reaching it through hashing has negligible probability, but SDK and
list validation still treat it as reserved. SHA-256 collision resistance is the security bound for slots and value
roots; links remain 32 bytes.

For `q` independently distributed occupied slots, the approximate probability of any slot collision is
`q(q-1) / 2^256` (the 255-bit masked domain has `2^255` points and the birthday denominator is twice that). The
probability that any key lands on reserved slot zero is approximately `q / 2^255`. Even at one billion distinct
keys, these are roughly `8.6 * 10^-60` and `1.7 * 10^-68`, respectively. Practical limits are reached many orders
of magnitude earlier. Root collisions retain the full SHA-256 bound.

### 2.2 Node commitment

Every node begins with:

```
slot[32] || nextSlot[32] || valueTail[0..64]
```

- `slot` is this node's slot.
- `nextSlot` is the next node's slot.
- `nextSlot == 0` means positive infinity/end of list.
- `valueTail` encodes the mapped value.

The empty mapping contains exactly one node:

```
HEAD = 0[32] || 0[32]
```

Deployment creates one HEAD per mapping collection. For every reachable non-tail node, `slot < nextSlot`. The
last node has `nextSlot == 0`.

```
HEAD(0) ──▶ K1 ──▶ K2 ──▶ ... ──▶ Kn ──▶ 0 (+infinity)
```

### 2.3 Collection and contract authentication

An entry is accepted only when all of these match:

- the contract's token category;
- mutable NFT capability;
- the collection-specific entry covenant locking bytecode;
- the block-layout input assigned to that access.

The collection hash domain-separates mappings that use identical key and value types. The category prevents an
attacker from manufacturing a node for another contract and presenting it as part of this list.

## 3. Value encoding

The 64 bytes after `slot || nextSlot` are the complete value for fixed/small types or an authenticated descriptor
for variable-width values.

### 3.1 Inline fixed and bounded values

Values whose canonical storage encoding is at most 64 bytes are stored directly. Examples include:

- bool and integers, using canonical/minimal numeric encoding where applicable;
- `bytes1` through `bytes32`;
- addresses and public keys;
- fixed/ufixed and user-defined value types through their underlying type;
- `datasig`, whose 64 bytes fill the commitment exactly;
- internal function identifiers.

A Schnorr transaction signature can be 65 bytes and is therefore chunkable. A Schnorr data signature is 64 bytes
and fits exactly: `32 + 32 + 64 = 128`.

Solidity `delete m[k]` means assignment of the type default. It does not physically remove the node. A bool node
may therefore remain present with an empty/false value tail. Reads distinguish membership internally but return
false for both absent and present-false, as Solidity requires.

### 3.2 Variable-width values

Strings, unbounded bytes, chunkable structs/arrays, signatures over 64 bytes, and other variable-width encodings use
a four-byte unsigned little-endian length prefix.

For values of at most 60 bytes:

```
lengthLE32[4] || value[0..60]
```

For values longer than 60 bytes, the entry commitment is exactly 128 bytes:

```
slot[32] || nextSlot[32] || lengthLE32[4] || root[32] || headData[28]
```

where:

```
root     = sha256(fullValue)
headData = fullValue[0:28]
```

The 28-byte authenticated head uses every remaining commitment byte. The rest is stored in root-addressed chunk
NFTs.

### 3.3 Root-addressed chunks

The chunk locking bytecode commits to:

```
contract category || collection hash || slot || root
```

Its P2SH32 address is therefore unique to one version of one mapping value. Overwriting the same slot with a new
root produces a different chunk address and allows the old version to be collected without ambiguity.

Each chunk commitment is exactly:

```
chunkIndexLE16[2] || chunkData[1..126]
```

The first chunk starts at full-value offset 28. Every non-final chunk contains exactly 126 data bytes. The final
chunk contains exactly the remaining number of bytes. There are no pushdata frames, repeated slots, or repeated
roots inside commitments; those fields are authenticated by the address.

For a full value of length `L > 60`:

```
chunkCount = ceil((L - 28) / 126)
chunk[i]   = value[28 + 126*i : min(L, 28 + 126*(i+1))]
```

The two-byte positive Script-number index supports indices `0..32767`, hence at most 32,768 chunks. The practical
format limit is:

```
28 + 32768 * 126 = 4,128,796 bytes
```

This is far above practical transaction and covenant execution limits; applications will usually encounter
transaction size, UTXO count, fee, or script-operation limits first.

### 3.4 Strict reconstruction

The SDK must reject a chunk set unless all conditions hold:

1. `L > 60` and `headData.length == 28`.
2. The number of chunks equals `ceil((L - 28) / 126)` exactly.
3. Sorted indexes are precisely `0, 1, ..., count-1`, with no duplicates or gaps.
4. Every non-final chunk contains 126 bytes.
5. The final chunk has exactly the expected remaining length.
6. Reconstruction produces exactly `L` bytes, with no truncation or trailing bytes.
7. `sha256(reconstructed) == root`.

The on-chain writer independently pins the chunk output bytecodes and commitments to the value on the stack. A
malicious provider can make a value unavailable by hiding or corrupting chunks, but cannot make the covenant accept
a different value.

## 4. Read algorithm

The SDK rebuilds and validates the collection, hashes the requested key, and supplies one entry input:

- exact node if the slot exists;
- strict predecessor otherwise.

The covenant authenticates the entry address/category, splits its commitment, and executes:

```
if node.slot == requestedSlot:
    decode and return node.value
else:
    require(node.slot < requestedSlot)
    require(node.nextSlot == 0 || requestedSlot < node.nextSlot)
    return default(V)
```

The second branch is the exclusion proof. If the requested node actually exists, no adjacent predecessor can
bracket it because the real predecessor links directly to it. Omitting the node therefore does not create a valid
absence witness.

For a long value, the SDK supplies the reconstructed full value as an internal witness and the covenant verifies
its SHA-256 root before using it.

Constructor/genesis reads require no entry input because mappings are known to be empty before deployment. They
materialize the type default, while deployment creates the HEAD nodes needed by later calls.

## 5. Write algorithm

Every source-level mapping assignment is an upsert. The SDK supplies either the exact node or the predecessor, and
the covenant selects the path from the authenticated input commitment.

| Operation | Authenticated entry inputs | Entry outputs | Essential invariant |
|---|---:|---:|---|
| Present read | exact node | preserved read-only node | `node.slot == H(key)` |
| Absent read | predecessor | preserved read-only predecessor | `P.slot < H(key) < P.nextSlot` |
| Update | exact node | updated node | slot and link unchanged |
| Insert | predecessor | rewritten predecessor + NEW | old successor preserved |
| Delete | exact node or predecessor | default-valued upsert | Solidity nullification semantics |

### 5.1 Update

Given existing node `N = [K, S, oldValue]`, produce:

```
N' = [K, S, newValue]
```

The covenant pins `K` and `S` unchanged. Only the value may change.

### 5.2 Insert

Given predecessor `P = [Ps, S, predValue]` and `Ps < K < S` (with `S == 0` as infinity), produce:

```
P'  = [Ps, K, predValue]
NEW = [K,  S, newValue]
```

Both output commitments and their positions are pinned. This is one atomic splice: it cannot skip the old successor,
change the predecessor's value, or create a detached node.

The compiler assigns each required entry input/output a deterministic block-layout slot. The predecessor rewrite
occupies its corresponding entry output slot; an inserted NEW node precedes that write site's trailing chunk region.
Read-only entry inputs are recreated unchanged. Layout-relative indexes are used so unrelated fee/change handling
cannot shift a covenant-managed output into the expected position.

### 5.3 Delete/nullify

`delete m[k]` is encoded as an upsert of `default(V)`, matching Solidity. Nodes are not physically spliced out by
ordinary source-level delete. This avoids changing observable semantics and keeps default-valued keys available for
iteration according to the stored-node model.

### 5.4 Long-value writes and garbage collection

Before the entry update/insert check, the covenant derives the value root, root-addressed P2SH32 locking bytecode,
chunk count, each two-byte index, and each data slice. It verifies the corresponding trailing outputs' locking
bytecodes and commitments.

For direct ABI values, the SDK can construct these outputs immediately. For computed values, it seeds placeholders
and derives the covenant-pinned bytecodes/commitments from VM traces until transaction construction converges.

When overwriting a long value, the SDK co-spends all old chunks using the old `(collection, slot, root)` covenant.
No old-root chunk UTXOs remain as storage dust after a successful update.

## 6. Read-modify-write and compound values

Operations such as `m[k] += x`, struct-field assignment, array-element assignment, `push`, and `pop` materialize the
authenticated old value, modify it on the stack or in a cached local, and perform one upsert.

Multiple logical writes to the same key in one transaction must coalesce into one physical upsert because a UTXO
cannot be spent twice. Compiler caching passes redirect same-entry operations to a local value and flush a single
upsert at the function tail and return paths.

Chunking is transparent to these operations. An array or struct can cross the 60-byte boundary in either direction;
the result is re-encoded, re-rooted, rechunked, and the obsolete chunks are collected.

## 7. Iteration and batch writes

Iteration follows authenticated `nextSlot` links from HEAD to the tail. The SDK supplies the reachable entries in
link order, and the covenant verifies adjacency and termination. Key iteration additionally requires caller-supplied
original keys whose canonical hashes match the stored slots because the hash-derived slot cannot be inverted.

Straight-line writes to two or more distinct keys in one collection are one atomic transition. The SDK plans all
targets against the original list, deduplicates shared proof inputs, and rebuilds the final union. The covenant
binds each hidden slot to `H(key)`, authenticates every proof input, proves each final successor is the nearest
batch target or the original successor, preserves non-target predecessor values, pins target/predecessor outputs,
and scans the transaction for the exact number of outputs at the collection address. This covers shared HEAD/gap
predecessors, three-or-more target chains, and mixed existing-node updates plus adjacent inserts without double-
spending or conflicting predecessor rewrites.

Swap-remove patterns require one additional authenticated case. In
`indexOf[lastKey] = index; delete indexOf[key]`, the computed write and delete can resolve to the same slot when
`key == lastKey`. The compiler marks that relationship, binds both hidden slots to their independently computed
`H(key)` values, and executes the write only when the slots differ. The SDK uses predecessor-output sentinel `-2`
exactly on the equal-slot path; the covenant proves the biconditional `(slots equal) == (sentinel == -2)`. The
delete owner remains authenticated against its fixed input slot and old successor. A neutral `OP_TRUE` positional
placeholder is used for omitted fixed outputs so placeholders cannot inflate the exact collection-address output
count.

An early-return guard such as `if (!inserted[key]) return` receives the real authenticated predecessor when the key
is absent. Presence is tested by commitment-slot equality, never merely by “this input has a token” (a predecessor
is also a token). If absent, batch planning emits no target or predecessor outputs and the topology verifier is
skipped; state, chunks, and entries are preserved. The topology verifier runs after state and dynamic-chunk checks,
so VM-based output derivation can converge without weakening any final transaction check.

Runtime-loop machinery handles updates, inserts, same-gap insertion chains, credited-predecessor merges, sender-
debit merges, duplicate recipients, self-transfers, and canonical counter-key delete-to-default. The exclusion
proof is always anchored in a real input node's old link.

Batch size is bounded by transaction size, input/output count, fees, and VM resource limits. Larger batches must be
paginated across transactions.

## 8. SDK validation and planning

`SortedList.fromUtxos` treats provider data as hostile. It validates:

- commitment length and field structure;
- exactly one HEAD;
- unique slots;
- strict ascending links;
- every non-zero link resolves to exactly one node;
- no cycles;
- no disconnected/orphan nodes;
- termination at `nextSlot == 0`;
- category/address filtering performed by the caller.

Planning operations refuse impossible states:

- membership/update of an absent slot;
- non-membership/insert of a present slot;
- insertion at reserved slot zero;
- deletion of HEAD;
- any plan based on an invalid list.

The SDK chooses witnesses and proposes commitments; the covenant remains authoritative and pins all security-critical
fields on chain.

## 9. Compiler and artifact contract

All `MappingType` collections are marked `sorted: true`. The artifact records collection signatures, key/value types,
entry accesses, block slots, key sources, iteration requirements, and whether values are chunkable. The SDK uses this
metadata to select entries and construct outputs.

There is no `sortedMappings` or `sortedMappingsAll` compiler option. Tests and integrations must not seed or expect
the old key/value entry commitment format.

Unsupported vmap shapes raise `SortedMappingCodegenPendingError`. This error is a safety boundary: code generation may
not route the access through an omission-prone implementation.

## 10. Security invariants and failure behavior

The implementation relies on these invariants:

1. **Identity:** every accepted node belongs to the expected category and collection covenant.
2. **Uniqueness:** a valid list has one reachable node per slot and one HEAD.
3. **Order:** every non-tail link increases strictly.
4. **Completeness:** every supplied list node is reachable from HEAD and every non-zero link resolves.
5. **Exclusion:** absence requires an authenticated adjacent bracket.
6. **Update preservation:** an update preserves slot and next link.
7. **Splice preservation:** insertion preserves predecessor value and old successor.
8. **Value binding:** long-value entry root, head, address, indexes, chunk lengths, and reconstructed bytes agree.
9. **Atomicity:** all required entry and chunk inputs/outputs are part of the same transaction.

Malformed commitments, missing witnesses, wrong addresses, incorrect categories, bad brackets, duplicate/gapped
chunks, wrong roots, output misplacement, and unsupported compiler shapes all fail closed. Availability is not
guaranteed: a provider or UTXO owner can withhold required data/inputs and prevent progress, but cannot cause an
incorrect mapping result to be accepted.

### 10.1 Implementation status and remaining fail-closed gaps

The vmap omission vulnerability is fixed and the authenticated backend is mandatory. That security status is
different from complete Solidity-compatible support for every mapping program. As of 2026-07-24, these shapes remain
intentionally fail-closed:

- A varying-key runtime loop whose assigned value is computed directly from the induction variable or another
  unsupported loop-local expression, for example `m[ks[i]] = i`. Parameter, literal, and aligned value-array
  sources are supported.
- Writes to multiple vmap collections within one runtime loop. The current covenant owns one collection address and
  one trailing entry-output region.
- Repeated keys in a varying-key array-mutation loop (`m[ks[i]].push`, `.pop`, or indexed assignment). Correct
  Solidity semantics require applying the mutations sequentially to one co-spent entry; the SDK rejects the
  ambiguous request rather than accepting a last-write approximation.
- Consecutive straight-line scalar RMWs of the same entry may revert because each generated transition attempts to
  co-spend the same input. Array/composite cases and invariant-key loops have dedicated coalescing, but the general
  scalar straight-line case is not yet guaranteed to coalesce.
- Cross-contract extensions not covered by the current caller/callee entry planner remain separately scoped. Basic
  cross-contract vmap reads/writes and `msg.sender`-keyed calls have dedicated coverage; do not infer support for every
  loop, value type, sidecar, or composition shape.

These are completeness/availability limitations, not fallback paths. The compiler or SDK rejects them before an
omission-prone transaction can be accepted.

## 11. Cost model

A point read or update requires one entry input. An insert requires one predecessor input and two entry outputs.
Long values additionally require `ceil((L - 28) / 126)` chunk outputs; overwrites consume the old chunk set.

The on-chain cost of root-addressed chunks includes deriving one P2SH32 address from category, collection, slot, and
root, then looping over chunk indexes to verify output bytecode and commitment. Keeping 32-byte links avoids a second
collision assumption and avoids runtime truncation logic. A narrower link can be revisited only as a versioned format
change with an explicit collision/risk and covenant-cost analysis.

Link computation itself is one canonical key encoding, one SHA-256 per key (plus one final SHA-256 for composite
keys), a high-bit mask, and numeric comparisons. The root-addressed chunk covenant adds constant address derivation
per value version and linear verification in the number of chunks. Compared with the former repeated-metadata chunk
layout, it moves `slot || root` from every commitment into one P2SH32 address derivation and recovers 126 data bytes
per chunk. It does not shorten the authenticated mapping links or weaken their collision bound.

## 12. Implementation and tests

Primary implementation locations:

- Compiler covenant generation: `packages/solidc/src/generation/GenerateTargetTraversal.ts`
- Compiler mapping selection/artifacts: `packages/solidc/src/compiler.ts`, `packages/solidc/src/artifact/Artifact.ts`
- SDK planning and transaction construction: `packages/solidcash/src/stateful/StatefulContract.ts`
- Hostile-list validation: `packages/solidcash/src/stateful/SortedList.ts`
- Entry/chunk covenant helpers: `packages/solidcash/src/stateful/covenant-helpers.ts`
- Shared commitment codecs: `packages/utils/src/state.ts`

Important coverage includes:

- membership/non-membership and claim-once;
- insert/update/RMW/nullify;
- nested and address keys;
- HEAD deployment and iteration completeness;
- same-key coalescing and distinct-key runtime loops;
- atomic straight-line shared-predecessor batches and forged proof/link/predecessor/orphan rejection;
- swap-remove computed-key aliasing, absent-key guarded no-ops, and forged alias/non-alias sentinel rejection;
- arrays, structs, push/pop, and inline/chunked transitions;
- varying-key array push/pop/index assignment with authenticated per-entry old-value witnesses;
- invariant and per-key values above 60 bytes in runtime loops, using authenticated reverse-suffix chunk outputs;
- long direct and computed values, tampered chunks, strict reconstruction, and overwrite collection;
- malformed, cyclic, duplicated, and disconnected sorted lists.

See `mapping-omission-security.md` for the original vulnerability and `mapping-soundness-research.md` for the design
alternatives that led to vmap. See `vmap-codegen-optimization.md` for measured bytecode/runtime overhead and the ranked
optimization plan.

For runtime-loop values above 60 bytes, the output layout ends in
`[reverse-ordered value chunks][one terminal suffix]`. The terminal suffix is the external-library sidecar
recreation when one is required, otherwise a zero-value OP_RETURN anchor. Fee change is inserted before this region.
This is a compiler/SDK invariant: covenant indexing uses `OP_TXOUTPUTCOUNT - 1 - priorChunks - valueChunks`, so SDK
transaction builders must not append another output after the suffix.
