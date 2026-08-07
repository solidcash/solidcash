---
title: How the State Journal Works
---

SolidCash stores contract state in CashToken NFT commitments. A transaction consumes the old state NFTs and creates
new ones, so Bitcoin Cash never performs an in-place storage update like an account-based virtual machine.

The **state journal** is how generated contract code makes that model convenient. Think of it as a private notepad
used while one function runs:

1. Reading state uses the latest value written on the notepad, falling back to the input NFT.
2. Assigning state updates the pending value on the notepad.
3. Helpers and branches share the same pending view of state.
4. When execution finishes, SolidCash writes each final value into the appropriate output NFT commitment.
5. The covenant checks that the transaction preserved everything it did not change.

```solidity
function addTwice(int amount) {
    this.balance = this.balance + amount;
    this.balance = this.balance + amount;
    require(amount >= 0);
}
```

Although the source assigns `balance` twice, the transaction needs only one old state input and one final replacement
output. The second assignment reads the first journaled result.

## What the journal is not

It is not an event log, an off-chain database, a separate token, or globally shared memory. It exists only inside
the generated validation program for the current transaction. Events are separate on-chain records, and only the
journal's final state is committed.

## Collections

Mappings and dynamic arrays use entry NFTs. Their journal follows the same rule: reads observe earlier writes in
the call, while the final flush creates, updates, preserves, or deletes the required entry outputs. The compiler and
SDK derive those entries from the function's concrete keys; they do not scan a global database.

## Atomic failure

If any requirement fails, the transaction is invalid and none of its outputs exist. There is no partially flushed
state. This is also true when a journal participates in a multi-contract [message-bus transaction](./message-bus.md).
