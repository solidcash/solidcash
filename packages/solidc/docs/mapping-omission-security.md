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
