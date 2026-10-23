---
title: Threading and State Management
---

Stateful threads are several master minting NFTs for one contract category. Each master authorizes calls for a
partition of the contract's data NFT indices, allowing transactions with disjoint inputs to proceed in parallel.

Threads are **partitions, not replicas**. Genesis creates the state data once, not once per master. There is no
automatic merge of divergent copies because there are no copied state registers.

See [Contract Concurrency](/docs/guides/concurrency) for protocol design and contention analysis. This page is the
SDK reference.

## Deploying several masters

```ts
import { ContractFactory } from '@solidcash/solidcash/contract-factory';
import { ThreadManager } from '@solidcash/solidcash/stateful';

const contract = await new ContractFactory(artifact, signer).deploy(adminPublicKey, {
  initialState: { west: 0n, east: 0n },
  threadCount: 2,
});

const manager = new ThreadManager(contract);
const threads = await manager.discover();
```

`threadCount` defaults to `1`. It creates that many master NFT outputs before the data NFT outputs in genesis.
Every master has the contract category, minting capability, and an empty commitment. The constructor arguments come
first, then the options object. The low-level `StatefulContract.deploy()` takes the same `threadCount` option.

The data layout must contain useful independent partitions. `external` state variables are isolated into dedicated
data NFTs; ordinary fields may share one bin-packed NFT and therefore cannot be assigned to different threads.

## `ThreadManager`

```ts
const manager = new ThreadManager(contract);
const threads = await manager.discover();

for (const thread of threads) {
  console.log(thread.threadId, thread.masterUtxo, thread.dataNftIndices);
}
```

### `discover()`

`discover(): Promise<ThreadHandle[]>` queries the root token address for all minting NFTs of the contract category,
sorts them through `StateReader`, and assigns data NFT indices round-robin:

```text
2 masters, 5 data NFTs -> [0, 2, 4], [1, 3]
3 masters, 5 data NFTs -> [0, 3], [1, 4], [2]
```

Discovery validates the ABI's `requiredNftIndices`. If no partition contains all indices required by a function,
it throws instead of returning a thread set which makes that function impossible to call.

`getThreads()` returns a copy of the manager's last discovered or created handles. It does not query the network.

### `ThreadHandle.call()`

```ts
const [westThread, eastThread] = await manager.discover();

await westThread.call('incrementWest').send();
await eastThread.call('incrementEast').send();
```

`call(functionName, ...args)` checks that the function's required data NFT indices are a subset of the handle's
partition, then builds a stateful call pinned to that handle's master UTXO. Mapping entries, chunks, containers,
external contracts, and other auxiliary inputs are still discovered normally and may cause cross-thread
contention.

### `ThreadHandle.refresh()`

```ts
await westThread.refresh();
```

A successful call spends and recreates its master. `refresh()` re-queries the current master set and replaces the
handle's outpoint. If the exact old outpoint no longer exists, it falls back to the current master at the handle's
position.

Master commitments do not carry persistent thread IDs or partition metadata. Round-robin discovery is therefore
the recoverable default. Custom partitions passed to `ThreadManager.split()` exist in the returned handles only;
if an application restarts, it must persist and reconstruct that partition assignment itself.

## Lifecycle split

Declare a compiler-verified `split` entry point:

```solidity
contract Parallel(pubkey admin) {
    external int west;
    external int east;

    function incrementWest() public {
        this.west = this.west + 1;
    }

    function incrementEast() public {
        this.east = this.east + 1;
    }

    function fork(int additional, sig signature) split(additional) {
        require(additional >= 1);
        require(checkSig(signature, admin));
    }
}
```

The current lifecycle shape preserves one existing master and creates `additional` new masters. Starting with one,
`fork(2, ...)` leaves three masters.

### Pending-call API

```ts
const tx = await contract.call.fork(2n, signature)
  .withSplitFunding(
    [fundingUtxo],
    signer.unlockP2PKH(),
    signer.getAddress(),
  )
  .withNewMintingAmount(1200n)
  .withSplitFee(explicitFee) // optional; otherwise size-derived
  .withMaxFee(20_000n)
  .send();
```

The funding inputs pay for the new master outputs and fee. `withSplitFunding()` is required; binding a signer does
not by itself select these lifecycle inputs.

### Static API

```ts
const result = await StatefulContract.split({
  provider,
  contract,
  splitFunctionName: 'fork',
  splitFunctionArgs: [2n, signature],
  fundingUtxos: [fundingUtxo],
  funder: signer.unlockP2PKH(),
  changeAddress: signer.getAddress(),
  newMintingAmount: 1200n,
  maxFee: 20_000n,
});
```

The result contains `{ tx, categoryId }`. The new masters remain in the original category.

## Lifecycle merge

`merge(n)` preserves one master and consumes/burns exactly `n` other master NFTs:

```solidity
function consolidate(int consumed, sig signature) merge(consumed) {
    require(consumed >= 1);
    require(checkSig(signature, admin));
}
```

### Pending-call API

```ts
const all = await new ThreadManager(contract).discover();
const consumed = all.slice(1).map((thread) => thread.masterUtxo);

const tx = await contract.call.consolidate(BigInt(consumed.length), signature)
  .withConsumedMasters(consumed, signer.getAddress())
  .withMergeFunding([feeUtxo], signer.unlockP2PKH())
  .withMergeFee(explicitFee) // optional
  .withMaxFee(20_000n)
  .send();
```

The consumed masters' satoshis, less the fee, are returned to the change address. `withMergeFunding()` can supply
additional fee inputs.

### Static API

```ts
const result = await StatefulContract.merge({
  provider,
  contract,
  mergeFunctionName: 'consolidate',
  mergeFunctionArgs: [BigInt(consumed.length), signature],
  consumedMasterUtxos: consumed,
  fundingUtxos: [feeUtxo],
  funder: signer.unlockP2PKH(),
  changeAddress: signer.getAddress(),
  maxFee: 20_000n,
});
```

The SDK validates the count, category, and minting capability of every consumed master and refuses to consume the
selected survivor.

## Lower-level gate split and merge

`ThreadManager.split()` and `.merge()` predate the lifecycle transaction helpers and remain useful for an explicit
authorization gate:

```solidity
function authorize(sig signature) unsafe {
    require(checkSig(signature, admin));
}
```

```ts
const manager = new ThreadManager(contract);

const { threads } = await manager.split({
  functionName: 'authorize',
  args: [signature],
  threadCount: 2,          // total outputs, not additional masters
  partitions: [[0], [1]], // optional; round-robin by default
  fee: 1_000n,
  maxFee: 10_000n,
});

const { thread } = await manager.merge(threads, {
  functionName: 'authorize',
  args: [signature],
  fee: 1_000n,
  maxFee: 10_000n,
});
```

This split consumes one master and divides that master's existing satoshis, minus the fee, across exactly
`threadCount` replacements. A default 1200-satoshi master is generally too small for several relayable outputs;
deploy with a deliberately larger `masterAmount` through the low-level deployment API if you plan to use this
form. Its gate uses `unsafe`, so the gate's authorization is security-critical: check a signature by a key the
caller cannot choose (a constructor argument, state or a constant), never a key passed in as an argument.
`split()` requires exactly one live master, and `merge()` requires at least two threads; both cap the fee at
10,000 satoshis by default.

## Reading state and masters

```ts
import { StateReader, getContractState } from '@solidcash/solidcash/stateful';

const onChain = await getContractState(contract.inner, contract.categoryId);
console.log(onChain.state);
console.log(onChain.masterUtxo);     // one selected master for compatibility
console.log(onChain.dataNftUtxos);

const reader = new StateReader(contract.inner.stateLayout!);
const rootUtxos = await provider.getUtxos(contract.inner.tokenAddress);
const masters = reader.findMasterUtxos(rootUtxos, contract.categoryId);
```

`getState()` reconstructs the global values from the data NFTs. To select a particular master for a write, use a
`ThreadHandle`, not the compatibility `masterUtxo` returned by a general state read.

## Safety checklist

- Ensure every important ABI function fits at least one partition.
- Treat `external` field placement and the resulting `stateLayout` as upgrade-critical ABI.
- Remember that vmap, chunks, containers, or external callees can remain shared inputs.
- Refresh or rediscover after every successful spend and rebuild after conflicts.
- Cap split/merge fees and validate change/dust amounts.
- Never expose an unauthenticated `unsafe` gate.
- Test two supposedly parallel calls together and assert their input outpoint sets are disjoint.
