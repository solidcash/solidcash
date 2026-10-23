---
title: Transaction Lifecycle
sidebar_label: Transaction Lifecycle
---

This guide will explain the "transaction lifecycle" of a Bitcoin Cash transaction. We'll talk about what the mempool is and how block inclusion works. Further we'll discuss the possibility of unconfirmed transaction chains and conflicting transactions to cover the full transaction lifecycle!

## Block Inclusion

Bitcoin Cash has a block-time of 10 minutes, meaning that on average every 10 minutes a new block is found which adds a collection of transactions to the ledger. On Bitcoin Cash it is standard for transactions to be included in the very next mined block.

:::tip
Commonly BCH miners are configured to accept transactions paying a minimum of 1 sat/byte, meaning a transaction of 500 bytes has to pay at least 500 satoshis in mining fee.
:::

Miners choose which transactions to include in their block. Some miners might set a higher minimum fee or mine empty blocks so transactions can remain pending in the mempool even though a new block was mined. Under normal circumstances, a 1 sat/byte fee rate will be included in the next block but this is not guaranteed.

:::note
Even if a miner sets a higher minimum fee for inclusion in his own blocks, 1 sat/byte is the standard minimum fee for nodes to relay your transaction around the network. This way it will get into the mempool of nodes across the BCH network.
:::

## Mempool

Before transactions are included in a block they are waiting for block inclusion in the mempool of the full nodes. Because transactions in the mempool are "seen" but not included in the blockchain yet, the latest state of the blockchain of who owns what is somewhat fuzzy.

In a normal scenario it's only a matter of time before a BCH transaction in the mempool gets included in a block. Where things get more complex however is if there are **competing unconfirmed transactions**. In this scenario it is **not** necessarily clear that a transaction is destined to be included in the blockchain. In other words, the latest state of the blockchain is still undecided.

:::tip
This is why many BCH indexers will allow you to query UTXOs with the option to include or exclude unconfirmed transactions. By default indexers will include unconfirmed UTXOs/unconfirmed transactions in the query result.
:::

## First-Seen Rule

The "first-seen rule" is a default mempool inclusion and relay rule for full nodes which says that for any UTXO the first seen spending transaction is the one that gets included in the node's mempool and relayed. The default relay policies on Bitcoin Cash have been designed in such a way to maximally enable "0-conf" transactions meaning transactions with zero confirmations but which can still be considered reasonably secure.

:::note
On BTC the mempool node default policy got changed to replace-by-fee, and tooling to submit your non-standard transaction directly to mining pools has become commonplace with ordinals.
:::

The first-seen rule is subjective based on time, because of this different parts of the network might enforce this rule for conflicting transactions in case of a race condition. For P2PKH transactions a trustless notification system was developed called [double-spend-proofs][double-spend-proofs] (DSPs). However DSPs unfortunately do not work for smart contract transactions.

## Unconfirmed Transaction Chains

Unconfirmed transactions can be chained after one another meaning that even an output of an unconfirmed transaction can already be spent in a new transaction. This means you can have competing unconfirmed transaction **chains** where child transactions are chained to an unconfirmed parent. A competing transaction for any of the chained unconfirmed transactions then presents a cancellation of the whole chain of dependent child transactions.

There is no maximum to the length of an unconfirmed transaction chain on BCH, software of full nodes has been upgraded to allow for arbitrary length unconfirmed tx chains. This is very important for public covenants which might have many users interacting and transacting with the same smart contract UTXO.

:::tip
On BCH it's possible to design smart contracts which use long unconfirmed transaction chains, avoiding the need to wait for blockchain confirmations.
:::

## Competing Transactions

When there are competing transactions (double spends) being propagated on the network, only one of the conflicting transactions can be included, the other transactions will in effect be cancelled. In the case of an unconfirmed transaction chain, any competing transaction for one of the transactions in this newly formed chain then presents a cancellation of all child transactions dependent on this parent transaction with a conflict.

:::note
Unlike on Ethereum, on Bitcoin Cash you can never have a transaction which has to pay fees but does not get included in the blockchain. Either it gets included and the fee is paid, or it's like it never happened.
:::

### Accidental Race-Conditions

In open contract systems competing transactions can happen organically and by accident, when 2 different users who might be on different sides of the world, interact with your on-chain system at roughly the same time. This situation can be called "UTXO contention" because 2 users simultaneously try to spend the same anyone-can-spend covenant.

:::tip
Replicated stateless verifier UTXOs can absorb independent spends. Stateful contract threads are different: each
master owns a disjoint partition of the contract's state resources, so they are not interchangeable clones of one
global state. Use [Concurrency](/docs/guides/concurrency) and [Threading](/docs/sdk/threading) to choose a partition
which matches the application's conflict domain.
:::

### Intentional Double-Spends

However, it is also possible double-spends are created intentionally. For example in the case of a DEX naively updating its price state, a rational economic actor might be incentivized to ignore the latest unconfirmed transaction chain and to **intentionally** create a competing unconfirmed transaction chain. This way they can interact with the smart contract at an earlier (more advantageous) price.

:::caution
Smart contract developers developing applications at scale should consider the game-theoretic interaction of advanced, rational economic actors who might benefit from competing against instead of cooperating on building a transaction chain.
:::

Refer to [the adversarial analysis guide](/docs/guides/adversarial) for a more in-depth guide covering the adversarial cases of intentional double spends and miner bribes.

## Chain Reorgs

A "Chain Reorganization" or reorg for short is when the full nodes discard the current chain tip of the blockchain and adopt a new longest chain. Because a chain reorg causes different blocks to be part of the canonical blockchain, it might be that different transactions got included than what was initially expected.


:::tip
A great resource to learn more details about reorgs is the ['Chain Reorganization'][chain-reorganization] page on the info website learn-me-a-bitcoin.
:::

:::note
2-block reorganisations are already super rare occurrences, so having 2+ confirmations is often enough for all practical purposes.
Many exchanges however use a 6-block confirmation policy for Bitcoin Cash deposits.
:::

Chain reorgs don't always include all the same transactions, so some transactions can get un-included from the blockchain with a reorg. In this scenario, if no competing transaction was mined then the un-included transaction will just return to the mempool waiting for inclusion in a next block.

## Stateful Contract Lifecycle

A stateful SolidCash contract is a CashToken category: a minting master NFT plus data NFTs that hold its state.
Each stage of its life is one or more ordinary transactions, so the mempool, chain and conflict rules above apply
to them as well.

```solidity
function create(sig s) public {
    require(checkSig(s, admin));
    new Child(admin);               // deploy entry, inferred from `new`
}

function migrateEntry(sig s) migrateRecords { require(checkSig(s, admin)); }
function migrate(sig s) upgrade { require(checkSig(s, admin)); }

function destroy(sig s) public {
    require(checkSig(s, admin));
    selfdestruct(beneficiary);      // statement form: pins the payout
}

function fork(int n, sig s) split(n) { require(n >= 1); require(checkSig(s, admin)); }
function join(int n, sig s) merge(n) { require(n >= 1); require(checkSig(s, admin)); }
```

- **Deploy.** A genesis transaction spends a plain `vout 0` input, and that transaction ID becomes the category. A
  stateful contract's function deploys a child with `new`: the compiler infers the deploy entry, so writing the
  `deploy` modifier is optional. See [Contract Creation & Lifecycle](/docs/language/contract-creation) and
  [Contract Deployment](/docs/guides/deployment).
- **Upgrade.** A `migrateRecords` function moves one mapping or array entry per transaction. The `upgrade`
  transaction then moves the master, re-mints the data NFTs at the new lock and moves the satoshi and token
  containers. The category stays and the address changes. `StatefulContract.upgrade` sends the whole sequence as
  one chain of transactions; each step spends the master, so hold other calls until it completes. Values kept in
  chunk NFTs do not migrate yet, and the SDK refuses an upgrade that would strand one. See
  [Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies).
- **Destroy.** `selfdestruct(to)` in a function body pins the payout: exactly one output, paid to `to`, with a fee
  below 2,000 satoshis, so all of the state must fit in one transaction. The modifier form
  (`function sweep(sig s) selfdestruct`) burns the state without a recipient pin and can be split over several
  transactions. Both need a `require`. CashTokens are not moved, so transfer them out first. Run either form with
  `StatefulContract.selfdestructTo(...)`, an alias of `StatefulContract.destroy(...)`; a plain
  `sc.call.destroy(...)` is refused. See [Contract Destruction](/docs/language/selfdestruct).
- **Split and merge.** `split(n)` mints `n` more masters beside the running one, and `merge(n)` burns `n` co-spent
  masters into it. Threads let unrelated calls avoid spending the same master. See
  [Contract Concurrency](/docs/guides/concurrency).

`deploy`, `upgrade`, `split` and `merge` entries need an unconditional `require(checkSig(s, key))` with a key the
caller cannot choose, such as a constructor argument. A direct compile rejects one without it.

```ts
import { StatefulContract } from '@solidcash/solidcash/stateful';

await factory.call.create(adminSig); // awaiting deploys the child with the connected signer

await StatefulContract.upgrade({
  provider, oldContract: sc, upgradeFunctionName: 'migrate', upgradeFunctionArgs: [adminSig],
  migrateRecordsFunctionArgs: [adminSig], newArtifact, newConstructorArgs: [adminPublicKey],
  fundingUtxo, funder, changeAddress,
});

await StatefulContract.selfdestructTo({
  provider, contract: sc, destroyFunctionName: 'destroy', destroyFunctionArgs: [adminSig],
  recipient: beneficiaryAddress,
});
```

[double-spend-proofs]: https://docs.bitcoincashnode.org/doc/dsproof-implementation-notes/
[chain-reorganization]: https://learnmeabitcoin.com/technical/blockchain/chain-reorganization/
