---
title: Contract Destruction
---

`selfdestruct` permanently consumes a stateful contract's master NFT and state UTXOs without recreating them.
There is no recovery transaction: after the minting master is gone, the instance cannot perform another ordinary
state transition.

SolidCash supports two forms with different security properties:

- `selfdestruct(recipient)` in a function body pins the released satoshis to that locking bytecode.
- A modifier-only `function destroy(...) selfdestruct` collapses state but does not covenant-pin a source-level
  recipient. It exists for compatibility and large batched cleanup; the transaction builder's recipient choice is
  not an on-chain authorization policy.

Prefer the expression form when a contract holds BCH.

## Destination-pinned destruction

```solidity
contract Vault(pubkey admin, address beneficiary) {
    uint256 withdrawals;

    function destroy(sig authorization) public {
        require(checkSig(authorization, admin));
        selfdestruct(beneficiary);
    }
}
```

The statement implies the lifecycle modifier; do not write both. Its covenant requires:

```text
tx.outputs.length == 1
tx.outputs[0].lockingBytecode == recipient
sum(tx.inputs.value) - tx.outputs[0].value < 2000 satoshis
```

The address pin prevents redirection, the one-output rule prevents a second payout, and the fixed fee ceiling
prevents most of the balance being burned as miner fee. At least the sum of the transaction inputs minus 1,999
satoshis reaches the recipient.

The destination is a BCH locking bytecode. It may be a stored `address` or a construction such as
`new LockingBytecodeP2PKH(hash160(admin))`.

:::caution
The current compiler visits the recipient expression but does not statically require its type to be `address` or
locking bytecode. A nonsensical type can compile and then fail the output-bytecode check at runtime.
:::

## Authorization rules

Destruction must be direct and terminal. A selfdestruct function must contain a final `require`, and a statement
nested inside a branch, loop, or `unchecked` block is rejected. A meaningless `require(true)` satisfies only the
structural final-require rule; it is not authentication.

The compiler additionally rejects a caller-controlled destination unless it can recognize a genuine signature
guard. This is unsafe:

```solidity
function destroy(address recipient) public {
    require(true);
    selfdestruct(recipient); // caller chooses where the balance goes
}
```

So is a check in which the caller chooses both key and signature:

```solidity
function destroy(address recipient, pubkey key, sig authorization) public {
    require(checkSig(authorization, key)); // proves only possession of the caller's own key
    selfdestruct(recipient);
}
```

A constructor argument, state field, constant, literal, or key selected from authenticated contract state counts as
key authority. A parameter key also works when an unconditional earlier requirement binds it to committed state,
for example `hash160(key) == this.adminPkh`. `allowUnsafeOperations` is an explicit compiler escape hatch, not a
security guarantee.

If the recipient comes from state, every function able to change that state controls the final destination. Audit
those writers as carefully as the destroy function.

## SDK execution

Use `StatefulContract.selfdestructTo()` (an intention-revealing alias of `destroy()`):

```ts
const result = await StatefulContract.selfdestructTo({
  provider,
  contract: vault,
  destroyFunctionName: 'destroy',
  destroyFunctionArgs: [new SignatureTemplate(adminPrivateKey)],
  recipient: beneficiaryAddress,
  maxFee: 2_000n,
});

console.log(result.txs, result.totalReclaimed);
```

For `selfdestruct(recipient)`, the SDK `recipient` must resolve to the same locking bytecode as the source-level
expression. The helper discovers master threads, data NFTs, vmap entries, the satoshi container, and expired event
NFTs; it then spends them with their protocol unlockers and sends the reclaimable satoshis to the recipient.

Destroy through `StatefulContract.destroy` or `selfdestructTo`: the ordinary call path (`sc.destroy(...)` on the
function itself) is refused, because it cannot burn the master. The covenant does not require the satoshi or token
containers in the destroying transaction, so a container left out stays at its address and can never be spent again;
the helper spends them in its final transaction. A `selfdestruct` entry admits an output carrying a mutable or
minting NFT of the contract's category only in place of the same input (same index, lock and commitment), so a
destroy can neither mint, nor move the master elsewhere, nor rewrite a record it carries.

Event cleanup is best-effort because event NFTs have a 144-block relative lock. Unexpired event NFTs do not block
master destruction: they may remain at their event addresses and become cleanable after their delay. Plan event
retention and indexer behavior around that asynchronous tail.

## Tokens are not transferred

`selfdestruct` moves native satoshis; it does not choose recipients for CashTokens. Token containers that are not
explicitly emptied remain at now-dead covenant addresses, and blindly including them can imply an unintended token
burn. Transfer every fungible token and NFT under explicit contract logic before the terminal call.

## Single-transaction and batched forms

`destroy()` defaults to roughly 200 inputs per transaction and can batch modifier-only destruction by preserving a
master between intermediate sweeps. The destination-pinned statement cannot use that shape: every invocation
requires exactly one output and the sub-2,000-satoshi total fee. If all state cannot fit in one transaction,
`selfdestruct(recipient)` is not executable.

This is a deployment-time capacity decision. Bound the number of vmap entries, chunks, events, and threads if the
contract promises a destination-pinned end-of-life path. The modifier-only fallback supports batching but gives up
the statement's destination and fee covenant, so it should not be presented as equivalent.

`selfdestruct` cannot combine with `pure`, `view`, `internal`, `private`, `unsafe`, `upgrade`, child deployment,
`split`, or `merge`, and it is not eligible for delegate execution.

For the SDK lifecycle calls around it, see [Stateful Contracts](../sdk/stateful-contracts.md#destroying). For native
upgrades and proxies, see [Upgrades, Proxies & Delegatecall](./upgrades-proxies.md).
