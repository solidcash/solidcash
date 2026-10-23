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

The same rule holds through internal helpers, storage aliases, branches, and supported loops. Source order is the
observable order: the compiler may coalesce physical writes, but it may not change which value a later expression
sees.

## What the journal is not

It is not an event log, an off-chain database, a separate token, or globally shared memory. It exists only inside
the generated validation program for the current transaction. Events are separate on-chain records, and only the
journal's final state is committed.

There is no journal API, token, server, or artifact you deploy. It is a compiler-generated execution strategy inside
the spending covenant. The SDK helps supply the input state and derive replacement commitments, but the on-chain
script is the authority for a valid flush.

## Logical locations

The journal assigns one pending value to each logical state location:

| State form | Journal identity |
| --- | --- |
| Scalar or fixed field | Compiler-assigned data-NFT field slot |
| Struct field | Flattened field path and slot |
| Mapping value | Collection plus canonical hashed runtime key |
| Mapping struct/array member | Mapping entry plus member path |
| Dense dynamic state | State field plus authenticated chunk run |
| Sparse array entry | Collection plus integer key |

Two accepted aliases to the same location must share one pending value. For example, a `storage` reference to
`users[who]` and a direct `this.users[who]` access cannot maintain independent copies. When key or alias identity
cannot be canonicalized safely, the compiler rejects the shape instead of flushing competing versions.

```solidity
struct Account { uint256 credit; uint256 debit; }
mapping(address => Account) accounts;

function settle(address who, uint256 amount) public {
    Account storage account = this.accounts[who];
    account.credit += amount;
    this.accounts[who].debit += amount / 2;
    require(account.credit >= account.debit); // sees both pending writes
}
```

## Control flow and helper calls

Branches update the shared logical journal on the path actually executed. A conditional write does not authorize an
unreached output mutation, and an early return evaluates its return value against the pending state before the
function's final settlement.

Internal, private, free, and eligible library helpers are inlined or compiled as subroutines while retaining the
caller's journal semantics. A returning helper can both change state and hand a value back to its caller; later code
observes both effects in source order.

Recursive and runtime-sized shapes need bounded resource metadata. The compiler and SDK preflight the concrete
transaction; unsupported early exits, ambiguous aliases, or unbounded resource use fail with a diagnostic rather
than producing a partially journaled route.

## Collections

Mappings and collection-backed arrays use entry NFTs. Their journal follows the same rule: reads observe earlier writes in
the call, while the final flush creates, updates, preserves, or deletes the required entry outputs. The compiler and
SDK derive those entries from the function's concrete keys; they do not scan a global database.

For a vmap, "create" means authenticated insertion between a strict predecessor and successor; "update" preserves
the existing node's slot and link; and Solidity `delete` writes the default value. Repeated writes to one key
coalesce into one final transition while every read still observes the latest pending value.

Dynamic `string`, `bytes`, and chunk-packed array values keep their logical pending bytes in the journal. On flush,
the data-NFT length header and exact chunk set are derived from that final value. Growing, shrinking, or assigning
empty state cannot leave an unauthenticated gap or orphan that the covenant would accept.

See [Verified Mappings](/docs/language/verified-mappings) and
[State Storage & Data Encoding](/docs/language/storage-model) for their physical proofs.

## Effects beside the journal

Events, BCH transfers, token-container transfers, return-event NFTs, blockhash/cryptographic side-cars, and child
deployments are ordered effects adjacent to the journal. They are not values stored in it. Generated code reserves
and verifies their own output/resource slots while the journal settles application state.

This distinction matters when auditing code: changing `this.balance` twice can coalesce to one state output, but
emitting the same event twice remains two distinct event outputs.

## Journal semantics in the message bus

In a direct call, one function invocation owns the contract's journal. A message-bus transaction (experimental in
0.14.0-beta.1) can execute several logical rows for the same physical participant while spending that participant's master only once. Those
rows share one participant-local pending view in authenticated call-manifest order:

```text
Token.transfer(A, B, 10)  -> balances[A] -= 10; balances[B] += 10
Token.transfer(B, C, 4)   -> reads pending balances[B], then writes B and C
flush                     -> one final authenticated Token vmap transition
```

Every participant still has its own journal. The message envelope authenticates cross-participant order, arguments,
results, and settlement authority; it does not turn all contracts into shared memory. A graph with a future-result
dependency, duplicate settlement authority, ambiguous key identity, or another effect the compiler cannot
summarize is refused.

## Atomic failure

If any requirement fails, the transaction is invalid and none of its outputs exist. There is no partially flushed
state. This is also true when a journal participates in a multi-contract [message-bus transaction](./message-bus.md).

## Builder derivation versus covenant enforcement

The SDK uses artifact metadata and local VM probes to find the old UTXOs and derive the commitments which satisfy a
call. That derivation can be iterative when a branch, loop, return value, or external call determines the concrete
resource set. The finished transaction is then preflighted before broadcast.

None of this makes the probe trusted consensus. The real transaction inputs independently execute their generated
covenants and verify the final commitments, links, categories, addresses, counts, and effect positions. A stale
provider or incorrect derivation causes construction or validation to fail; it cannot commit a different journal.

## Audit checklist

When reviewing state-heavy code, ask:

1. Which logical locations can the function touch, including through helpers and aliases?
2. Can two source expressions name the same mapping entry or chunk-backed value?
3. Does a loop or branch make the number of entries, chunks, side-cars, or effects runtime-dependent?
4. Are external results consumed only after their authenticated producer row?
5. Is the complete transaction still within size, stack-item, and per-input operation-density limits?

The compiler rejects many unsupported shapes, but explicit bounds and small state footprints remain good contract
design. The journal gives sequential semantics; it does not make an unbounded database cheap.
