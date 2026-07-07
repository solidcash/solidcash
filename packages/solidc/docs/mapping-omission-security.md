# Mapping omission and negative guards (C2)

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

## Compiler diagnostic

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
   guards** - **authenticated set**. The master commits a sorted / indexed-Merkle root over the entry set; every
   insert/delete updates the root (covenant-verified, like count integrity, so no off-book entry can exist). A
   negative-guard read supplies a **non-membership proof** - a bracketing low leaf with `low.key < k <
   low.nextKey`, checked against the root - which is O(log N) and carries only the local witness, not the set.
   Membership proofs serve positive access + write-uniqueness. This is EVM's storage-trie model, except the
   caller supplies the witness instead of a validator holding the whole trie.

**Rollout.** The C2 diagnostic escalates from warning to a hard **error** for a negative-guarded mapping that is
backed by neither a nullifier nor an authenticated set - so the unsound shape cannot ship (fail-closed).
Positive-guard mappings compile unchanged. Suggested phases: (0) escalate the diagnostic; (1) nullifier
primitive (reuses the C1 identity-pin machinery); (2) authenticated-set / indexed-Merkle mapping type (master
root + proof-verification codegen + SDK tree maintenance) - the heavy lift, and the only piece that is
irreducibly an authenticated-data-structure problem.
