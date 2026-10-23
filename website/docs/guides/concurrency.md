---
title: Contract Concurrency
sidebar_label: Contract Concurrency
---

Two Bitcoin Cash transactions conflict when they spend the same UTXO. Concurrency is therefore a property of the
**input sets** a protocol requires, not simply its number of addresses or contract instances.

```
call A inputs: master A + state 0 + entry X
call B inputs: master B + state 1 + entry Y   -> independent

call C inputs: master A + state 0 + entry X
call D inputs: master B + state 1 + entry X   -> conflict on entry X
```

SolidCash offers master threading for stateful contracts, but it cannot make a genuinely shared UTXO parallel.
Start by minimizing shared state, then add threads only where the state model has independent partitions.

## Stateless parallelism

A stateless covenant has no unique state authority. Any number of independent payments can use the same locking
bytecode, and users spend different outputs in parallel:

```ts
const utxos = await vault.getUtxos();
const selected = utxos[Math.floor(Math.random() * utxos.length)];

await new TransactionBuilder({ provider })
  .addInput(selected, vault.unlock.release(signature))
  .addOutput({ to: recipient, amount: selected.satoshis - 1_000n })
  .send();
```

This is not a stateful thread: each UTXO is simply an independent instance of the same spending rule. Escrows,
offers, per-user vaults, and receipts often scale best by keeping each user's state in a separate covenant output.

Do not always select the first provider result. Random, round-robin, or reservation-based selection reduces
accidental collisions. A backend can maintain short-lived outpoint reservations, but it must still rebuild from a
fresh UTXO set after a mempool conflict.

## Stateful master threads

A stateful deployment normally has one master minting NFT and one or more mutable data NFTs. Threading creates
several master NFTs under the **same category** and assigns each a disjoint subset of data NFT indices.

```
master 0 -> data NFTs [0, 2]
master 1 -> data NFTs [1, 3]
```

A call on a `ThreadHandle` is admitted only if all of the function's compiler-published `requiredNftIndices` are
inside that handle's partition. This prevents a client from selecting a thread which cannot supply the function's
state registers.

### Design state for partitions

Normal fixed-width state fields are bin-packed together until the commitment budget is full. Declare an
`external` state variable to force it into its own dedicated data NFT. That data NFT is the unit threads
partition:

```solidity
contract ShardedCounters(pubkey admin) {
    external int west;
    external int east;

    function incrementWest() {
        this.west = this.west + 1;
    }

    function incrementEast() {
        this.east = this.east + 1;
    }

    function authorize(sig signature) unsafe {
        require(checkSig(signature, admin));
    }
}
```

Here each increment needs one data NFT and can be assigned to a different master. A function which reads both
variables needs both indices and cannot run on either one-NFT partition. `authorize` is the gate the
[`ThreadManager` gate operations](#threadmanager-gate-operations) use.

:::caution
`external` is both state visibility and a storage-layout instruction: it generates a getter and isolates the
variable in a data NFT. Changing it changes the state layout and can break upgrade/delegate compatibility.
:::

## Provisioning and discovering threads

Create several masters at genesis with `threadCount`. State data is created once; it is not copied for every
master.

```ts
import { ContractFactory } from '@solidcash/solidcash/contract-factory';
import { ThreadManager } from '@solidcash/solidcash/stateful';

const contract = await new ContractFactory(artifact, signer).deploy(adminPublicKey, {
  initialState: { west: 0n, east: 0n },
  threadCount: 2,
});

const manager = new ThreadManager(contract);
const threads = await manager.discover();

console.log(threads[0].dataNftIndices); // [0]
console.log(threads[1].dataNftIndices); // [1]

await threads[0].call('incrementWest').send();
await threads[1].call('incrementEast').send();
```

`discover()` finds all current master minting NFTs and applies round-robin partitioning by default. It validates
that every function with explicit state requirements can be served by at least one partition. `getThreads()`
returns the last discovered/created handles; `refresh()` updates a handle after its master was spent and recreated.

Thread numbers are an SDK view over the currently discovered master set, not permanent identifiers committed in
the empty master commitments. Persist protocol-level shard identity in the partitioned state itself when identity
must survive rediscovery.

## Creating and retiring masters

There are two related SDK surfaces with different count semantics.

### Lifecycle modifiers

The compiler-authenticated lifecycle form uses `split(n)` and `merge(n)`:

```solidity
function fork(int additional, sig signature) split(additional) {
    require(additional >= 1);
    require(checkSig(signature, admin));
}

function join(int consumed, sig signature) merge(consumed) {
    require(consumed >= 1);
    require(checkSig(signature, admin));
}
```

In the current transaction layout, `split(additional)` preserves the selected master and creates `additional`
new masters. Starting from one master, `fork(3, ...)` leaves four. `merge(consumed)` preserves one surviving
master and burns exactly the supplied `consumed` masters.

The compiler enforces these rules:

- The modifier argument names an integer parameter of the function.
- The body needs an unconditional `require(checkSig(s, key))` with a key the caller cannot choose: a constructor
  argument, state or a constant. A direct compile rejects one without it (`UnauthorizedLifecycleError`).
- The body follows the `unsafe(1)` restrictions: it cannot write state, touch entries, emit events, move satoshis or
  tokens, call or read other contracts, or deploy.
- `split` and `merge` combine with no other lifecycle modifier, `unsafe`, `pure`, `view`, `internal` or `private`.

The high-level call path keeps the lifecycle call and its funding configuration together:

```ts
await contract.call.fork(3n, signature)
  .withSplitFunding(
    [splitFundingUtxo],
    signer.unlockP2PKH(),
    signer.getAddress(),
  )
  .withNewMintingAmount(1200n)
  .send();

const masters = (await new ThreadManager(contract).discover());
await contract.call.join(3n, signature)
  .withConsumedMasters(
    masters.slice(1).map((thread) => thread.masterUtxo),
    signer.getAddress(),
  )
  .withMergeFunding([mergeFeeUtxo], signer.unlockP2PKH())
  .send();
```

If funding or consumed masters must be chosen manually, use `StatefulContract.split({...})` and
`StatefulContract.merge({...})`. These APIs require explicit funding UTXOs, unlockers, change address, and fee
limits.

### `ThreadManager` gate operations

`ThreadManager.split({ threadCount })` is a lower-level alternative for a contract with exactly one existing
master and an `unsafe` (tier 0) authorization gate. Its `threadCount` is the **total** number of output masters;
it consumes the old master and divides its satoshis across that many replacements. Optional `partitions` must be
disjoint and cover every data NFT index.

```ts
const manager = new ThreadManager(contract);
const { threads } = await manager.split({
  functionName: 'authorize',
  args: [signature],
  threadCount: 2,
  partitions: [[0], [1]],
  maxFee: 10_000n,
});

const { thread: consolidated } = await manager.merge(threads, {
  functionName: 'authorize',
  args: [signature],
  maxFee: 10_000n,
});
```

Tier 0 skips every covenant check, so whoever passes the gate can also steal, duplicate or burn the masters and
rewrite state. Check a signature by a key the caller cannot choose, as `authorize` does with `admin`, and audit the
gate like any `unsafe` path. Prefer lifecycle modifiers where their transaction shape fits the protocol.

## What threading does not partition

A master/data partition does not automatically partition every side covenant. Calls still conflict if they share:

- the same vmap entry or HEAD/predecessor entry;
- the same dynamic chunk NFT;
- one token container or satoshi container;
- one external contract master/state input;
- one block oracle or computation sidecar instance;
- one message-bus verifier NFT; or
- any ordinary funding input selected by both clients.

Verified mappings make this especially concrete: two writes to distant keys can use different entry NFTs, while
inserts near the same predecessor both need that predecessor. Design key ranges, per-user child contracts, or
separate collections when predictable write isolation matters. See [Verified Mappings](/docs/language/verified-mappings).

## Choosing a strategy

Use the smallest concurrency mechanism that removes the actual shared input:

| Workload | Useful model |
|---|---|
| Independent user agreements | Separate stateless or stateful contract instances |
| Independent scalar/register updates | Master threads with isolated data NFTs |
| Per-key records | Vmap entries; contention follows keys and predecessor paths |
| Independent atomic workflows | Child contracts or separate categories |
| Several known contracts in one atomic action | Message bus; provision verifier instances |
| Globally shared liquidity/counter/order | Serialize, batch, or redesign; extra masters alone do not help |

More masters increase discovery, funding, and operational complexity. Too many partitions can also make an ABI
function uncallable because no partition contains all required indices. Validate the actual artifact layout and
run concurrent transaction tests before deployment.

## Collision handling

A robust client treats a spent-input/mempool conflict as a reason to restart construction:

1. Re-query the relevant UTXOs.
2. Discard every signature and builder derived from the old input set.
3. Select an available master/instance and all dependent state inputs again.
4. Rebuild, re-sign, and broadcast with a bounded retry policy.

Do not retry identical bytes: they still name the spent outpoint. With a wallet-broadcast flow, the application
may not receive enough detail to retry automatically; prompt the user only after rebuilding a fresh request.

For double-spend and adversarial contention analysis, see [Adversarial Analysis](/docs/guides/adversarial).
