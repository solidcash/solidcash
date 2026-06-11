---
title: Threading & State Management
---

Threading allows a single stateful contract to be split into multiple parallel instances, each operating independently. This enables concurrent transaction processing on a single contract.

## Overview

A stateful contract normally has one **master NFT** controlling all state. Threading creates multiple master NFTs, each with its own partition of state data NFTs. Transactions on different threads do not conflict, enabling parallel execution.

## Deploying with Threads

```typescript
const { contract } = await StatefulContract.deploy({
    artifact,
    constructorArgs: [adminPub],
    provider,
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: adminAddress,
    initialState: { counter: 0n },
    threadCount: 3,  // create 3 parallel threads
});
```

## ThreadManager

The `ThreadManager` class discovers and manages threads:

```typescript
const threadManager = await contract.getThreadManager();
await threadManager.load();

// Access individual threads
const thread0 = threadManager.thread(0);
const thread1 = threadManager.thread(1);
const allThreads = threadManager.threads();
```

### Calling Functions on a Thread

```typescript
const result = await thread0.call('increment', alicePub, aliceSig).send();

// Refresh thread state after the call
await thread0.refresh();
```

## Splitting (1 -> N)

Split a single-threaded contract into multiple threads using a function with the `split` modifier:

```solidity
// In .scash file
function fork(int n, sig s) split(n) {
    require(n >= 1);
    require(checkSig(s, admin));
}
```

```typescript
await StatefulContract.split({
    contract: sc,
    functionName: 'fork',
    functionArgs: [3n, adminSig],
    threadCount: 3,
    fee: 1000n,
    maxFee: 10000n,
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: adminAddress,
});
```

Split creates new master NFTs. Each thread gets a round-robin partition of data NFTs.

## Merging (N -> 1)

Consolidate threads back to a single master using a function with the `merge` modifier:

```solidity
function consolidate(int n, sig s) merge(n) {
    require(n >= 1);
    require(checkSig(s, admin));
}
```

```typescript
await StatefulContract.merge({
    contract: sc,
    functionName: 'consolidate',
    functionArgs: [3n, adminSig],
    fee: 1000n,
    maxFee: 10000n,
});
```

Merge burns the consumed master NFTs and reclaims their satoshis.

## State Reading

### Read State from Chain

```typescript
import { StateReader, getContractState } from 'solidcash';

// Full state including UTXOs
const onChainState = await getContractState(contract.inner, categoryId);
// onChainState.state = { counter: 5n, label: ... }
// onChainState.masterUtxo
// onChainState.dataNftUtxos
// onChainState.entryNftUtxos
```

### Read Individual Variables

```typescript
const counter = await sc.state.counter();
const allState = await sc.getState();
```

## Reading Events

```typescript
import {
    readEventsFromChain,
    readAnonymousEventsFromChain,
    getEventNftAddress,
    getAnonymousEventNftAddress,
} from 'solidcash';

// Named events
const eventAddr = getEventNftAddress(contract.inner, categoryId, 'Transfer');
const transferDef = artifact.abi.find(e => e.name === 'Transfer');
const events = await readEventsFromChain(provider, eventAddr, categoryId, transferDef);

for (const evt of events) {
    console.log(`${evt.values.from} -> ${evt.values.to}: ${evt.values.amount}`);
}

// Anonymous events
const anonAddr = getAnonymousEventNftAddress(contract.inner, categoryId);
const anonEvents = await readAnonymousEventsFromChain(
    provider, anonAddr, categoryId, anonymousEventDefs
);
```

### Event Object Shape

```typescript
interface ParsedEvent {
    txid: string;                        // transaction that emitted the event
    vout: number;                        // output index
    values: Record<string, StateValue>;  // decoded parameters
    eventName?: string;                  // for anonymous: matched event name
}
```

## Covenant Address Helpers

The SDK provides functions to compute the addresses of each covenant NFT type:

```typescript
import {
    getDataNftAddress,
    getEntryNftAddress,
    getEventNftAddress,
    getAnonymousEventNftAddress,
    getTokenContainerAddress,
    getSatoshiContainerAddress,
} from 'solidcash';

const dataNftAddr = getDataNftAddress(contract.inner, categoryId);
const entryAddr = getEntryNftAddress(contract.inner, categoryId, 'balances');
const eventAddr = getEventNftAddress(contract.inner, categoryId, 'Transfer');
const anonEventAddr = getAnonymousEventNftAddress(contract.inner, categoryId);
const tokenAddr = getTokenContainerAddress(contract.inner, categoryId, tokenCat);
const satoshiAddr = getSatoshiContainerAddress(contract.inner, categoryId);
```

## Auto-Derivation Deep Dive

When you call `sc.call.myFunc(args).send()`, the SDK performs iterative auto-derivation:

1. **Phase 1 - External contracts**: If the function reads or calls external contracts, derive their state and return values first.
2. **Phase 2 - This contract**: Iteratively derive state changes, entry modifications, event emissions, and transfers.
3. **Convergence**: Each iteration re-runs the VM with updated state until the output matches the previous iteration (or max 20 iterations).
4. **Oscillation detection**: If state oscillates between two values, the derivation fails with a descriptive error.

The key safety property: **the VM script is the final arbiter**. If auto-derivation produces wrong state, the transaction will simply fail (script returns false), not produce a wrong transaction.

:::tip
Auto-derivation works automatically for most cases. Manual overrides (`.setState()`, `.withEntryKey()`, `.transfer()`) are needed when:
- Mapping keys are computed from expressions (not direct parameters)
- Multiple external contracts interact in complex ways
- You want to override the auto-derived transfer amounts
:::
