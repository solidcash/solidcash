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
- **value** (optional): present for `mapping(K=>V)`; absent for a set / `mapping(K=>bool)` (presence == true).

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
2. **Read codegen (DONE + VM-verified end to end).** `visitMappingAccess` emits the single membership-or-non-
   membership covenant for a sorted `mapping(K=>bool)` read: compute `slot = sha256(k)` with the last byte's high
   bit cleared, pin `input[slot]` bytecode to the collection's entry P2SH, read `slot||nextKey`, and return the
   real bit (`slot==H(k)` -> 1; `slot<H(k)<nextKey` -> 0; else revert). No default-on-absent branch, so omitting
   the entry reverts. The SDK co-spends `SortedList.predecessorOf(k)` (or the k-entry) read-only for a sorted
   collection, and such a read is never getter-skipped. Proven from source in `SortedMappingCompiledRead.test.ts`:
   a compiled `require(!claimed[k])` passes for an absent key and reverts for a present one.
3. **Write codegen (DONE + VM-verified end to end).** `claimed[k]=true` on a sorted `mapping(K=>bool)` emits the
   proven insert splice: co-spend the bracketing predecessor `P[Ps|S]` at the entry slot (write path), verify
   `Ps < H(k) < S` (k absent), and pin two outputs at the collection's entry P2SH - `P' = [Ps|H(k)]` at the entry
   output slot (predecessor's next rewritten to k) and `NEW = [H(k)|S]` as a trailing mint. The SDK drives it from
   `SortedList.planInsert`: it co-spends the predecessor (write unlocker) and sets `P'`/`NEW` commitments directly
   (known exactly off-chain; the covenant pins them, so the derivation probe and the final send converge without
   VM-trace derivation). Proven from source in `SortedMappingCompiledWrite.test.ts`: a compiled `claim(k)` inserts
   the key, a re-claim of the same key reverts on `require(!claimed[k])`, and a different key still inserts - the
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
5. **Delete (fail-closed, pending).** `delete m[k]` on a sorted mapping needs a SPLICE (co-spend the node and its
   bracketing predecessor, rewrite the predecessor's next past the node, burn the node). The default soft-delete
   would leave the node in the list, so membership would still find it - unsound. The splice covenant is proven
   (`SortedMappingInsertDelete.test.ts`), but it needs a **second co-spent entry input** (the predecessor, alongside
   the node) - a block-layout slot the current insert/upsert path (which reuses the single entry slot) does not
   emit. Until that slot is added, delete throws `SortedMappingCodegenPendingError` rather than compile to the
   unsound soft-delete.

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
- **Codegen done (read + set insert + value upsert incl. update):** a sorted `mapping(K=>bool)` set and a
  `mapping(K=>int)` value mapping compile end to end from source - the membership/non-membership read
  (`SortedMappingCompiledRead.test.ts`), the value read (`SortedMappingValueRead.test.ts`), the set-insert write
  (`SortedMappingCompiledWrite.test.ts`), and the value upsert - insert **and** update - (`SortedMappingValueWrite.test.ts`),
  all VM-verified. **Delete** is the only remaining op: fail-closed with `SortedMappingCodegenPendingError` because
  a sound splice needs a second co-spent entry input (the predecessor) not yet emitted in the block layout. Value
  types other than `int`/`bool` (bytes, struct, address) also fail closed.
