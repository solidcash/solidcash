# Mapping omission and negative guards (C2)

> **Resolution (2026-07-22): fixed by mandatory C2.** The omission-prone entry model described below has been
> removed. Every mapping now uses the authenticated sorted-linked-list backend, and there is no compiler opt-out.
> Reads prove either exact membership or adjacent non-membership; unsupported source shapes fail compilation.
> This document is retained as the vulnerability analysis and design rationale. The normative current protocol is
> [`sorted-mapping-c2.md`](sorted-mapping-c2.md).

## Historical vulnerability

A mapping read `m[k]` compiles to a live introspection of whether an entry NFT sits at the entry slot's
input index: present -> read its committed value; absent -> read the type **default** (`false` / `0` / empty).
This mirrors Solidity's "unset key = default value" semantics.

The hazard is that **BCH Script cannot force a spender to co-spend a particular UTXO**, and there is no
entry-set accumulator (count / merkle root / nullifier) committed in the master NFT that could require an
existing entry to be presented. So a spender can always **omit** an entry that actually exists on-chain and
make the covenant read the default.

## Negative guards are bypassable

A guard that passes when the value is the default is defeated by omission:

```solidity
mapping(address => bool) claimed;

function claim(address me) external {
    require(!this.claimed[me]);   // BYPASSABLE: omit the claimed[me] entry -> reads false -> passes
    this.claimed[me] = true;
    payout(me);                   // second claim mints a duplicate claimed[me] entry -> drain
}
```

The same shape defeats `require(!hasVoted[u])`, `require(!blacklisted[u])`, and nonce/replay maps
(`require(nonces[u] == 0)`).

**Positive guards are fail-safe.** `require(this.balances[k] >= amt)` or `require(this.allowed[u])` read the
default (`0` / `false`) on omission, which *fails* the guard - the worst case is a spender denying themselves.

## Historical compiler diagnostic

The compiler warns (`SECURITY-AUDIT C2`) when a `require()` condition is a direct negative guard on a mapping
read: `require(!m[k])`, `require(m[k] == false)`, or `require(m[k] == 0)` (and the mirror image). Rewrite the
guard to be positive, or - for full soundness - commit an entry-set accumulator (a count or merkle/nullifier
root) into the master commitment and require an inclusion/consumption proof on each read (a covenant redesign).

The authors already chose "absent = ERROR" for blockhash oracles for exactly this reason (see
`block-and-transaction-properties.md`); mappings intentionally keep Solidity's default-on-absent semantics, so
negative guards need author awareness.

## Lineage: why an earlier audit called this sound

The entry-NFT model has carried this gap since the `future` branch (proven by code trace: `emitSlotExistsCheck`
introspects a token at a fixed slot, `OP_ELSE` pushes the default, and nothing - `emitMintingNftUniqueness`
counts only the `0x02` master, no `0x01` conservation loop, no per-mapping entry count - forces an existing
entry to be present). The `SECURITY_AUDIT_2026_03_06.md` pass nonetheless called the covenant system
"well-designed": it verified entry **integrity-when-present** (category / capability / commitment / LBC / value
all pinned when co-spent - all correct) but its threat model was entirely **presence-based** (injection, forgery,
drain, downgrade, extra-output). It has no absence/omission class; it even treats "not included as inputs, so it
can't be modified" as a *safety* property - the exact inverse of this attack. Omission is the structural blind
spot of covenant auditing: a covenant cannot see what was left out, and neither did a threat model built only
from presence questions. Both are consistent - integrity-when-present is sound; entry-set completeness is not.

## The sound solution

**Why C2 is harder than C1.** C1 needed to prove a delegate is *present* - cheap (co-spend it, pin
`OP_UTXOBYTECODE`). C2's dangerous case proves a key is *absent* - a non-membership statement, which
permissionlessly requires an authenticated set. There is no BCH shortcut, because consensus arbitrates
spend-once and input-unspent, not inclusion, and Script cannot query the UTXO set.

Three cases, exhaustive:

1. **Positive guards** (`require(m[k] >= x)`, `== expected`) - already sound. Omission reads the default, which
   fails the guard. No change, O(1), scales to millions (ERC20 balances).

2. **Consume-once actions with provisioned eligibility** (claim / vote / redeem, eligibility minted up front) -
   **nullifier**. Represent the right as a unique UTXO; the action *spends* it; consensus double-spend
   prevention enforces once-ness. The covenant only does an O(1) identity pin on the consumed input (the C1
   trick); no accumulator, no absence proof. This is the native BCH idiom (airdrop claim tokens, ballots,
   pre-issued rights). Requires the coupon to exist before the action, so it does **not** cover lazy first-touch
   creation or persistent readable flags (a read consumes nothing).

3. **Persistent readable negative flags** (blacklist / allowlist / isRegistered) and **lazy unbounded negative
   guards** - a **non-existence proof against an authenticated commitment**. Several structures work (sorted
   Merkle tree, sorted linked list of entry-UTXOs, a baked Bloom filter, ...), each with a different
   contention/read-write profile - a global mutable root is *not* the right default because it serializes reads
   and writes. The full design space, resource costs, the contention analysis, and a decision matrix are in
   `mapping-soundness-research.md`.

**Rollout.** The fix is the sound *mechanisms* (nullifier / authenticated set) - they make the bug not exist
regardless of how the guard is phrased. The C2 diagnostic escalating from warning to a hard **error** is only a
fail-closed **backstop for the shapes it recognizes** (`require(!m[k])` and friends): it is a syntactic filter
over a semantic hole, dodgeable by `if (!m[k]) {...}`, a laundering local, or indirect data flow, so it is *not*
a guarantee and is worth turning on only once a sound alternative exists to point authors at. Positive-guard
mappings compile unchanged. Suggested phases: (1) nullifier primitive (reuses the C1 identity-pin machinery);
(2) the authenticated-set mapping type(s) matched to the access pattern (the heavy lift, the only irreducibly
authenticated-data-structure piece); (3) the diagnostic-as-error backstop, once (1)/(2) give a redirect.

## Current status: shipped end to end

The B2 sorted-linked-list authenticated set (case 3) is **implemented and proven end to end**
(`sorted-mapping-c2.md`). Absence of `k` is witnessed by co-spending the bracketing predecessor `P` with
`P.slot < k < P.nextKey`; there is **no default-on-absent branch to omit** - a missing/invalid witness reverts.
The compiler, artifact metadata, SDK planning, transaction construction, hostile-provider validation, batching,
iteration, computed values, compound values, and root-addressed large-value chunks are all integrated. Adversarial
tests cover fabricated predecessors, omission, malformed/disconnected lists, incorrect splices, shared-gap batches,
swap-remove aliasing, and corrupted chunks. Slots and links remain full-width 32-byte values. The old compiler
options and legacy mapping-entry backend no longer exist.
