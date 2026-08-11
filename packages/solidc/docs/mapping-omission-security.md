# Mapping omission and negative guards (historical finding vmap)

> **Resolution (2026-07-22): fixed by mandatory verified mappings (vmaps).** The omission-prone entry model described below has been
> removed. Every mapping now uses the authenticated sorted-linked-list backend, and there is no compiler opt-out.
> Reads prove either exact membership or adjacent non-membership; unsupported source shapes fail compilation.
> This document is retained as the vulnerability analysis and design rationale. The normative current protocol is
> [`verified-mappings.md`](verified-mappings.md).

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

Before verified mappings shipped, the compiler diagnostic recognized direct negative guards such as
`require(!m[k])`, `require(m[k] == false)`, and `require(m[k] == 0)`. It warned that an unauthenticated entry
could be omitted. That warning was only a syntactic backstop and was never the security boundary.

The helper remains in the compiler for defensive compatibility with any internally constructed non-vmap
collection. Ordinary mappings are always vmaps, so their membership or absence proof suppresses the warning;
negative guards require no special rewrite.

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

**Why fixing vmap is harder than fixing C1.** C1 needed to prove a delegate is *present* - cheap (co-spend it, pin
`OP_UTXOBYTECODE`). vmap's dangerous case proves a key is *absent* - a non-membership statement, which
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

**Historical rollout reasoning.** The proposed fix was a sound mechanism—either a nullifier or an authenticated
set—rather than stronger pattern matching for negative guards. Mandatory verified mappings implemented the
authenticated-set path. The diagnostic therefore remains a defensive backstop, not a user-facing restriction or
part of the current mapping model.

## Current status: shipped end to end

The B2 sorted-linked-list authenticated set (case 3) is **implemented and proven end to end**
(`verified-mappings.md`). Absence of `k` is witnessed by co-spending the bracketing predecessor `P` with
`P.slot < k < P.nextKey`; there is **no default-on-absent branch to omit** - a missing/invalid witness reverts.
The compiler, artifact metadata, SDK planning, transaction construction, hostile-provider validation, batching,
iteration, computed values, compound values, and root-addressed large-value chunks are all integrated. Adversarial
tests cover fabricated predecessors, omission, malformed/disconnected lists, incorrect splices, shared-gap batches,
swap-remove aliasing, and corrupted chunks. Slots and links remain full-width 32-byte values. The old compiler
options and legacy mapping-entry backend no longer exist.
