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

## SDK list management

The SDK maintains an off-chain image of the list (proven in miniature as `ListModel` in
`SortedMappingClaimOnce.test.ts`): a `slot -> nextKey` map rebuilt by scanning the collection's entry NFTs
(each commitment gives `(slot, nextKey)`). Operations:

- `predecessorOf(k)` = the entry with the greatest `slot < k` (the bracketing predecessor; `HEAD` for the low
  gap). O(log N) with a sorted index.
- `insert(k)`: co-spend `predecessorOf(k)`, emit `P'` (next->k) and `NEW` (k->old next).
- `delete(k)`: co-spend `predecessorOf(k)` + the `k` node, emit `P'` (next->k.next).
- `has(k)` / read: co-spend `k`'s entry (membership) or `predecessorOf(k)` (non-membership).

Commitments are still derived from the VM trace (as today), so the SDK need not reconstruct pushdata encodings;
it only chooses which entries to co-spend and the link targets.

## Compiler codegen plan (remaining)

1. **Opt-in.** `CollectionNode.sorted` flag (set from `CompilerOptions.sortedMappings` initially; a `sorted`
   mapping keyword later). Only sorted collections use this backend; the existing entry model is untouched.
2. **Classify accesses.** A negative guard on a sorted mapping (`require(!m[k])`, `== false`, `== 0`) -> emit
   non-membership. A read that gates an effect -> membership-or-non-membership by case. A write -> upsert
   (insert if absent, update if present; the SDK picks the branch and the covenant validates it).
3. **Emit** the proven covenant fragments (bracket + splice) at the access site, indexed by the new block-layout
   slots. Key -> slot via `OP_SHA256` + high-bit mask.
4. **SDK** fills predecessor/node inputs and P'/NEW outputs from the off-chain list; auto-derivation supplies the
   commitments.

## Status

- **Proven & done:** the covenant logic (non-membership, insert, delete, membership), full-width unsigned slot
  comparison, and the claim-once application - 19 VM tests. The design is sound; C2 has a fix.
- **Remaining (engineering, no soundness risk):** the compiler opt-in + codegen (step 1-3) and the SDK
  list-management + auto-derivation wiring (generalize `ListModel`). Tracked for a follow-on.
