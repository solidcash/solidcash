# Sorted-linked-list mappings (the C2 fix)

C2 (`mapping-omission-security.md`) is that a negative guard `require(!m[k])`, or any read-then-write of `m[k]`,
is bypassable: BCH cannot force a spender to co-spend a particular UTXO, so a spender omits an existing entry, the
covenant reads the type default (`0`/`false`), and the guard passes (or a `+=` resets a balance). The sound fix
(design B2 in `mapping-soundness-research.md`) makes non-existence **provable**: entries are a sorted singly-linked
list, and absence of `k` is witnessed by co-spending the bracketing predecessor. There is no default-on-absent
branch to omit - a missing witness reverts.

This design is **VM-proven sound end to end** (raw-VM tests, no compiler/SDK needed yet):
`packages/solidcash/test/e2e/SortedMappingNonMembership.test.ts`, `SortedMappingInsertDelete.test.ts`,
`SortedMappingClaimOnce.test.ts` (19 tests). The remaining work is the compiler sugar + SDK plumbing to emit and
drive these covenants from ordinary source; the covenant logic itself is fixed and proven.

## Entry layout

Each entry is a mutable (0x01) NFT of the contract's category, at the existing per-collection entry P2SH32
(`buildEntryNftCovenantScript` - reused unchanged; the linked-list logic lives in the contract's function
covenant, not the entry covenant). Commitment (fixed-width, so the covenant splits it with `OP_SPLIT`):

```
slot(32) ++ nextKey(32) [++ value]
```

- **slot = H(key) with the high bit masked** (`slot = sha256(key) mod 2^255`). Fixed 32-byte, type-agnostic,
  collision-resistant. The mask keeps it a **positive** script number so `OP_BIN2NUM` + `OP_LESSTHAN` compare
  slots as **unsigned** (BCH numbers are little-endian sign-magnitude; an unmasked hash would read as negative
  half the time). Proven at full width in `SortedMappingNonMembership.test.ts` with 2^200 / 2^254-1 slots.
- **Sentinels:** `nextKey = 0` = +infinity; a reserved head entry `slot = 0` anchors the low end. The empty map
  is one entry `HEAD[0|0]`.
- **value** (optional): the mapped value for `mapping(K=>V)`. A bool set stores a 1-bit value (`true` = `0x01`
  tail, `false` = empty tail) so `m[k]=false`/`delete` can nullify without removing the node; a present entry with
  an empty tail reads false. The value is the last field, so a fixed-width or empty tail is unambiguous.

## The covenant (proven)

All three ops authenticate every co-spent/produced entry by `category base == the contract's` (an attacker cannot
mint that category - it is master-guarded), then:

| Op | Co-spends | Produces | Checks (all fields pinned) |
|---|---|---|---|
| **Non-membership** `!m[k]` | predecessor `P` (read-only) | - | `P.slot < k < P.nextKey` (nextKey 0 = +inf). No default branch. |
| **Membership** `m[k]` present | entry `k` (read-only) | - | `entry.slot == k` -> its value. |
| **Insert** (absent upsert) | predecessor `P` | `P'[Ps|k]`, `NEW[k|S]` | bracket `Ps<k<S`; `P'` = P with next->k; `NEW` = k->S (P's old next). |
| **Update** (present upsert) | entry `k` | `k'[k|S|v']` | slot+next preserved, value only. |
| **Delete** | `P[Ps|k]` + node `k[k|S]` | `P'[Ps|S]` | `P.next==k==node.slot`; `P'` splices k out. |

Links move only on insert/delete, each a single splice touching only the predecessor; the covenant pins every
32-byte field, so skip-node / corrupt-predecessor / non-adjacent / dangling-link / present-key attacks all revert
(proven). A claim-once (`require(!claimed[a]); claimed[a]=true`) is just an insert - proven end to end in
`SortedMappingClaimOnce.test.ts`.

## Block layout (compiler)

Sorted ops need input/output slots beyond the current fixed entry slot:

- **Non-membership read:** 1 read-only predecessor **input** (co-spent, preserved) at a `sortedPred` slot; no
  output beyond preservation.
- **Insert:** the predecessor **input** + two entry **outputs** (`P'` at the predecessor slot, `NEW` as a
  trailing mint - the runtime counter machinery is not needed; insert count is static per write site).
- **Delete:** predecessor + node **inputs**, one `P'` **output**.

These are static per write site (unlike the loop-write trailing region), so they fit the existing 1:1 block
layout with new slot kinds (`sortedPred`, `sortedNew`). The SDK fills them by predecessor lookup.

## SDK list management (SHIPPED)

`SortedList` (`packages/solidcash/src/stateful/SortedList.ts`, exported from the SDK) maintains the off-chain image
of the list: a sorted array of `(slot, nextKey, value, utxo)` rebuilt from the collection's entry NFTs via
`SortedList.fromUtxos`. `keyToSlot` = `sha256(key)` with the high bit masked (positive 255-bit, little-endian) so
the covenant's `OP_BIN2NUM`/`OP_LESSTHAN` compare as unsigned. Operations:

- `predecessorOf(k)` = the entry with the greatest `slot < k` (the bracketing predecessor; `HEAD` for the low gap).
- `planNonMembership(k)` / `planMembership(k)`: the entry to co-spend (read).
- `planInsert(k, value?)`: predecessor to co-spend + the `P'` (next->k) and `NEW` (k->old next) commitments.
- `planUpdate(k, value)`: the entry + new commitment (link preserved, value only).
- `planDelete(k)`: predecessor + node to co-spend + the `P'` (next->node.next) commitment.
- Impossible proofs (non-membership of a present key, insert of a present key, ...) are refused off-chain.

Every plan is **VM-verified against the proven covenants** (`SortedListSdk.test.ts`): the plan's co-spends +
commitments, assembled into a transaction, are accepted by the insert/delete/update/non-membership covenants; and
chained inserts evolve the list correctly. Commitments are still derived from the VM trace (as today), so the SDK
need not reconstruct pushdata encodings; it only chooses which entries to co-spend and the link targets.

## Compiler codegen plan

1. **Opt-in (DONE).** `CollectionNode.sorted` set from `CompilerOptions.sortedMappings`; the artifact carries
   `sorted: true` in the collection metadata. Only sorted collections use this backend; the existing entry model
   is untouched.
2. **Read codegen (DONE + VM-verified end to end).** `visitMappingAccess` co-spends ONE entry (the exact k-entry if
   present, else the bracketing predecessor) and returns the real value: compute `slot = sha256(k)` high-bit-masked,
   pin `input[slot]` bytecode to the collection's entry P2SH, read `slot||nextKey||value`, and if `slot==H(k)`
   return the value tail (int/bool `OP_BIN2NUM`-normalized, `bytesN` verbatim), else prove `slot<H(k)<nextKey` and
   return the type default. No default-on-absent branch, so omitting the entry reverts. The SDK co-spends the
   k-entry (or predecessor) read-only, never getter-skipped. Proven in `SortedMappingCompiledRead.test.ts` (a
   compiled `require(!claimed[k])` passes for absent, reverts for present) + `SortedMappingValueRead.test.ts`.
3. **Write codegen (DONE + VM-verified end to end).** Every sorted write `m[k]=v` is an UPSERT (`emitSortedValueUpsert`):
   co-spend one entry and branch at runtime on `slot==H(k)`. Present -> UPDATE: pin the entry output `k' =
   slot||nextKey||v` (link preserved, value set). Absent -> INSERT: verify `slot<H(k)<nextKey`, pin `P' =
   slot||H(k)||predValue` at the entry output + a trailing `NEW = H(k)||nextKey||v`. The SDK co-spends the exact
   entry (update) or predecessor (insert, `P'` injected + pinned); the value-carrying outputs (`k'`/`NEW`) derive
   from the VM trace. Proven from source in `SortedMappingCompiledWrite.test.ts` (claim-once): a compiled `claim(k)`
   inserts the key, a re-claim reverts on `require(!claimed[k])`, and a different key still inserts - the
   C2 negative-guard attack closed end-to-end for writes.
4. **Value read + write / upsert (DONE + VM-verified end to end).** A value-typed sorted `mapping(K=>int)` compiles
   its read `bal[k]` (present -> the raw value tail; absent -> the type default, proven-absent via the bracket) and
   its write `bal[k]=v` as an **upsert**: the covenant branches at runtime on `slot==H(k)` - present -> UPDATE (pin
   the entry output `k' = link||v`, link preserved); absent -> INSERT (`P' = slot||H(k)||predValue` + trailing
   `NEW = H(k)||next||v`). The value is stored raw (minimal script number) in the commitment tail. The SDK
   co-spends the exact entry (update) or predecessor (insert); the value-carrying outputs derive from the VM trace
   (the covenant pins them). Proven from source in `SortedMappingValueRead.test.ts` / `SortedMappingValueWrite.test.ts`
   (insert, update, second insert, reads). Two SDK derivation subtleties: a known `P'` is **pinned** so it is not
   re-derived (the covenant's input-commitment read would otherwise oscillate it), and an UPDATE's zero trailing
   outputs are not re-seeded (which oscillated the loop count 0<->1).
5. **Read-modify-write (DONE + VM-verified).** `bal[k] += v` / `bal[k] -= v` on a value mapping just work: the read
   (RHS) and the write co-spend the SAME entry (the exact entry if present, else the predecessor), so a present-key
   RMW is an UPDATE with the old value read from the co-spent entry, and an absent-key RMW is an INSERT of `0+v`.
   This is the original C2-blocked pattern (a `+=` was resettable by omitting the entry). Proven in
   `SortedMappingRMW.test.ts`. Unblocks balances / vote counts / accumulators.
6. **Delete = NULLIFY (DONE + VM-verified) - Solidity parity.** Solidity `delete m[k]` **assigns the type default**
   to `m[k]` (`libsolidity` compiles it to `storageSetToZero`); it does **not** physically remove the entry
   (mappings have no length/enumeration). So `delete m[k]` and `m[k] = <default>` are the same op - an upsert to the
   default. A **value** mapping (`mapping(K=>int)`, `bytesN`) nullifies to `0` (present -> update to 0, absent ->
   insert 0). A **bool set** is just a value mapping over a 1-bit value: `true` = a `0x01` value tail, `false` /
   `delete` = an **empty** value tail. So `claimed[k]=true/false` and `delete claimed[k]` are all upserts, the entry
   **stays** in the list (nullified, not removed), and the read returns the value (present-false and absent both
   read false; only a present-true entry reads true). No splice, and C2 still holds - omitting a present-true entry
   can't satisfy the bracket. Proven in `SortedMappingValueDelete.test.ts` + `SortedMappingBoolNullify.test.ts`.

## Status

- **Proven & done:** the FULL covenant op set - non-membership, membership, insert, delete, update, and the
  combined **read** (one covenant returns the real membership bit: `slot==H(k)` -> 1, `slot<H(k)<nextKey` -> 0,
  neither/no-co-spend -> revert; `SortedMappingRead.test.ts`), plus full-width unsigned slot comparison and the
  claim-once application. The design is sound; C2 has a fix, and the codegen now only has to emit proven fragments.
- **SDK done:** `SortedList` (rebuild from chain, predecessor lookup, the full plan op set) - each plan
  VM-verified against the proven covenants (`SortedListSdk.test.ts`). Full-transaction composition (contract
  master-preservation + insert splice + entry-address pinning + the REAL entry-NFT covenant on the predecessor)
  is VM-verified, and a live `MockNetworkProvider` round-trip drives real sends end to end (genesis -> fetch ->
  plan -> submit -> persisted entry NFT, multi-claim sequence, re-claim refused) - `SortedMappingFullTx.test.ts`.
- **Codegen done (read + set insert + value upsert/RMW + value delete):** a sorted `mapping(K=>bool)` set and a
  `mapping(K=>int)` value mapping compile end to end from source - the membership/non-membership read
  (`SortedMappingCompiledRead.test.ts`), the value read (`SortedMappingValueRead.test.ts`), the set-insert write
  (`SortedMappingCompiledWrite.test.ts`), the value upsert - insert **and** update (`SortedMappingValueWrite.test.ts`),
  read-modify-write (`SortedMappingRMW.test.ts`), and value delete == set-to-default (`SortedMappingValueDelete.test.ts`),
  read-modify-write (`SortedMappingRMW.test.ts`), value delete/nullify (`SortedMappingValueDelete.test.ts`), and
  bool-set true/false/delete nullify (`SortedMappingBoolNullify.test.ts`), all VM-verified. Every op - read, write,
  RMW, delete - is a **read and/or upsert over one linked-list value entry**; there is no physical-removal splice
  (Solidity `delete` nullifies, so the node stays). Value types: `bool` (1-bit value), `int`/`uint` (raw minimal
  number tail), fixed-width `bytesN` (raw N-byte tail, e.g. `bytes32` - `SortedMappingBytesValue.test.ts`), `address`
  (locking bytecode) and `struct` (encoded blob) stored verbatim in the tail, and unbounded `bytes`/`string` of ANY
  practical length (P5b): `len(4 B) ++ value` inline for <= 60 B, `len(4 B) ++ sha256(value)` with the full value in
  per-(collection, slot, digest) chunk NFTs for > 60 B (a read reassembles + verifies the witness against the hash -
  `SortedMappingLongValue.test.ts` + migrated `SortedMappingDynBytesValue.test.ts`). Array-valued `mapping(K => T[])` is
  also C2-backed: element read/write (`m[k][i]`), `push`/`pop` across the inline<->chunked boundary, and whole-array
  assign all route through the chunk-aware upsert (`emitMappingArrayElementAssign` in `sortedRmw` mode), and multiple
  writes to the SAME entry in one call coalesce to one upsert (`CacheMappingEntryInLoop`). What is NOT yet supported is
  multi-KEY writes in a runtime loop - see "Multiple writes in one transaction" below.
- **Nested / composite-key mappings (DONE + VM-verified):** `mapping(A => mapping(B => V))` (e.g. ERC20 allowances,
  ERC1155 balances) works - the slot for `m[a][b]...` is `sha256(sha256(a) ++ sha256(b) ++ ...)` high-bit-masked
  (`emitSortedKeyHash` / SDK `keyToSlotMulti`). Each key is hashed independently to 32 bytes, so the concatenation
  is unambiguous for any key type; a single key reduces to `sha256(k)`. Proven in `SortedMappingNested.test.ts`
  (`allow[a][b]` upsert/read/RMW, distinct pairs independent, `(20,10) != (10,20)`). Multi-key with an expression
  key (not a plain param) fails closed.
- **Key types:** `int`/`uint`, fixed-width `bytesN`, and `address` (hashed as its locking bytecode; the SDK matches
  via `addressToLockScript`) all work as (single or composite) keys - so `mapping(address => uint)` (ERC20 balances)
  and `mapping(address => mapping(address => uint))` (allowances) compile and run. VM-verified in
  `SortedMappingAddressKey.test.ts`.

## Multiple writes in one transaction (same value vs. same range)

Writing more than one thing per call splits into two independent problems, and the split is forced by a hard BCH rule:
**a transaction cannot spend an output it creates in the same transaction.** So N sequential state transitions of one
UTXO are impossible in one tx, while N transitions of N distinct UTXOs are fine.

### Same value - N writes to the SAME entry `m[k]` (same key) - DONE

Because the entry is a single UTXO, one tx can produce exactly ONE new version of it. Two upserts of the same entry in
one tx would co-spend the same (now already-spent) input twice and the covenant `OP_VERIFY`s fail. So N logical writes
to `m[k]` must COALESCE to one physical upsert. `CacheMappingEntryInLoop` (a pre-semantic pass) does this: it reads
`m[k]` once into a local, redirects every access of `m[k]` (element write/read, `push`/`pop`, whole assign) to the
local, and flushes a single `m[k] = local` upsert before each return and at the tail. This makes loops
(`for (..) m[k][j] = v`), consecutive writes (`m[k][0] = x; m[k][2] = z`), and read-after-write (`m[k][j] = m[k][j-1] +
1`, which reads the value being built) all work with correct values. The loop stays a runtime loop over the LOCAL
array - it is never unrolled, so the covenant does not grow with N. This is the ceiling that physics allows in one tx;
truly separate physical upserts of one entry require N transactions. Residual gaps are compiler COVERAGE only (a key
reassigned mid-function, a `delete` interleaved with element writes, multi-collection entanglement), not a covenant
limitation.

### Same range - N writes to DIFFERENT keys - largely SHIPPED

N different keys are N different entry UTXOs, so they CAN all be co-spent and re-emitted in one tx (N inputs -> N
outputs), bounded only by transaction size / input count. Most of this is now shipped via the **per-iteration UPSERT
loop** (`emitSortedUpsertLoop{Setup,Body,Teardown}`), which co-spends one entry per recipient (its own entry for an
UPDATE, or its bracketing predecessor for an INSERT) and mints the result, with dual counters (co-spends vs cumulative
mints) so update (mint 1) and insert (mint P'+NEW) coexist. What ships:

1. **Batch update of N existing keys - SHIPPED** (`941dd7de`). `for(i) m[k[i]] += v[i]` (and `-=`, `= vs[i]`) reads each
   key's current value and mints the updated node with `next` preserved. Source order == counter order = no permutation.
2. **Batch insert into DISTINCT gaps - SHIPPED** (`125cb014`). Each new recipient co-spends its own bracketing
   predecessor and mints P' + NEW; 1:1 co-spend/mint per recipient. Duplicate / same-predecessor conflicts fail closed.
3. **Loop-invariant value + delete + set - SHIPPED.** Fixed-amount airdrop `+= amount` (param) / `+= 100` (literal)
   (`7673bc51`), absolute `= vs[i]` (op=set, `644532b1`), batch nullify `delete m[k[i]]` (op=delete, `bbc280a1`). All ops.
4. **The FULL ERC-20 multiTransfer - SHIPPED** (`090f4e35` + `5856dfc5` + `69d1ed93`). The cached `bal[msg.sender] -=`
   DEBIT and the credit loop coexist; a NEW recipient whose predecessor is UNTOUCHED works, and a NEW recipient whose
   predecessor is the DEBITED msg.sender works too via the **merge**: the debit entry is co-spent once and re-pointed to
   the new node (a re-point register set by the loop, applied by the debit flush; the covenant's in-gap check vs the
   debit's real input is the omission anchor; two-in-gap fails closed). Adversarially VM-proven (`MsgSenderMerge`).

**Still fail-closed (sound, needs a batch-upsert covenant redesign).** Two shapes remain, both requiring a new structure
that co-spends each DISTINCT touched entry once and mints its final (value, nextKey) together - the per-iteration loop
can't express them: (a) a NEW recipient whose bracketing predecessor is ANOTHER CREDITED recipient (couples that
entry's value-update and its link-re-point across different iterations - unlike the msg.sender case, there's no
after-loop coordination point); (b) two-or-more new recipients CHAINING in one gap (a forward reference - the first
node's `next` is a later-minted node). N per tx is capped by transaction size; larger N needs paginated writes across
txs. Cross-cutting for the redesign: the exclusion proof must survive the batch (rejecting forged / omitted / misordered
/ duplicated entries), since a bug reopens the C2 exclusion-proof hole. Tracked in `deferrals.md`.
