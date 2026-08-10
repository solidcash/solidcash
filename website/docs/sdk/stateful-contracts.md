---
title: Stateful Contracts
---

The `StatefulContract` class manages the full lifecycle of stateful contracts: deployment, state reading, function calls, upgrades, and destruction.

## Deploying

```typescript
import { StatefulContract, ElectrumNetworkProvider, SignatureTemplate } from 'solidcash';
import artifact from './Counter.artifact.js';

const provider = new ElectrumNetworkProvider('chipnet');
const signer = new SignatureTemplate(adminPrivateKey);

const { contract, tx, categoryId } = await StatefulContract.deploy({
    artifact,
    constructorArgs: [adminPub],
    provider,
    fundingUtxo: myUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: adminAddress,
    initialState: { counter: 0n },
    masterAmount: 1200n,
    dataNftAmount: 1200n,
    fee: 1000n,
    addressType: 'p2sh32',
});

console.log('Category:', categoryId);
console.log('TX:', tx.txid);
```

:::caution
The `fundingUtxo` **must** be at vout 0 (the first output of its parent transaction) because the funding transaction's ID becomes the CashToken category ID for the contract.
:::

### Deploy Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `artifact` | `Artifact` | required | Compiled contract artifact |
| `constructorArgs` | `any[]` | required | Constructor parameter values |
| `provider` | `NetworkProvider` | required | Network connection |
| `fundingUtxo` | `Utxo` | required | Funding UTXO (must be vout 0) |
| `funder` | `Unlocker` | required | Unlocker for the funding UTXO |
| `changeAddress` | `string` | required | Address for change output |
| `initialState` | `Record<string, any>` | `{}` | Initial state variable values |
| `masterAmount` | `bigint` | `1200n` | Satoshis per master NFT |
| `dataNftAmount` | `bigint` | `1200n` | Satoshis per data NFT |
| `fee` | `bigint` | `1000n` | Transaction fee |
| `addressType` | `AddressType` | `'p2sh32'` | Must be `'p2sh32'` |
| `threadCount` | `number` | `1` | Number of parallel threads |
| `initialBalance` | `bigint` | `0n` | Initial satoshi container balance |

## Connecting to an Existing Contract

```typescript
// From a Contract instance + category ID
const sc = StatefulContract.withCategory(innerContract, categoryId, {
    externals: { ICounter: otherContract },
});

// From artifact directly
const sc = StatefulContract.from(
    artifact,
    constructorArgs,
    { provider, addressType: 'p2sh32' },
    categoryId,
);
```

### External Contract Binding

When your contract reads external contracts, bind them at connect time:

```typescript
const sc = StatefulContract.withCategory(innerA, catA, {
    externals: { ICounter: counterContract },
});

// Or with explicit specification
const sc = StatefulContract.withCategory(innerA, catA, {
    externalContracts: {
        ICounter: {
            artifact: counterArtifact,
            categoryId: catB,
            constructorArgs: [adminPub],
        },
    },
});
```

## Calling Functions

Three equivalent patterns for calling stateful functions:

```typescript
// Pattern 1: Direct call (recommended)
const result = await sc.call.increment(alicePub, aliceSig).send();

// Pattern 2: Short-form (if no name collision with class methods)
const result = await sc.increment(alicePub, aliceSig).send();

// Pattern 3: Function builder (manual control)
const builder = await sc.functions.increment(alicePub, aliceSig);
const result = await builder.send();
```

All patterns return a `TransactionDetails` with `txid` and `hex` fields.

### Chained Builder Methods

```typescript
const result = await sc.call.transfer(to, amount)
    .setState('counter', 5n)          // override state
    .transfer(recipientLbc, 1000n)    // manual satoshi transfer
    .emitEvent('Transfer', from, to, amount)  // emit event
    .send();
```

## Reading State

```typescript
// All state variables
const state = await sc.getState();
console.log(state.counter);  // 5n

// Individual variable
const counter = await sc.state.counter();

// Short-form
const counter = await sc.counter();
```

## Working with Verified Mappings

The SDK manages verified mappings (vmaps) automatically. It hashes each requested key, fetches and validates the
authenticated entry list, and supplies either the exact entry or its bracketing predecessor as the proof. Normal
calls do not need to manually locate entry NFTs.

```typescript
// Insert or update an entry. The SDK derives the membership/non-membership proof.
await sc.call.setBalance(bobPkh, 1000n).send();

// Solidity delete semantics: assign the value type's default.
await sc.call.removeAccount(bobPkh).send();
```

For an unusual key expression that auto-derivation cannot resolve, `.withEntryKey(slotIndex, key)` supplies the
logical key for a compiler-authored entry slot. It is an advanced override, not a way to bypass vmap validation:

```typescript
await sc.call.setDerivedBalance(seed, amount)
    .withEntryKey(0, derivedKey)
    .send();
```

## Token Container Operations

```typescript
// Fungible token transfer
await sc.call.withdraw(tokenCategory, recipient, amount)
    .tokenContainerTransfer(tokenCategory, recipientLbc, amount)
    .send();

// NFT transfer
await sc.call.withdrawNft(nftCategory, recipient, commitment)
    .tokenContainerTransferNft(nftCategory, recipientLbc, commitment, 'none')
    .send();
```

## Satoshi Transfers

```typescript
// Usually auto-derived from VM trace
await sc.call.sendFunds(sig, recipient, 5000n).send();

// Manual override
await sc.call.sendFunds(sig, recipient, 5000n)
    .transfer(recipientLockingBytecode, 5000n)
    .send();
```

## Upgrading

Deploy a new version while preserving the category ID and state:

```typescript
import newArtifact from './CounterV2.artifact.js';

const { contract: upgraded, tx } = await StatefulContract.upgrade({
    provider,
    oldContract: sc,
    upgradeFunctionName: 'migrate',
    upgradeFunctionArgs: [adminSig],
    newArtifact,
    newConstructorArgs: [adminPub],
});
```

The new artifact can have additional state variables appended. Existing state values are preserved; new fields default to zero.

## Destroying

Permanently destroy a contract, burning all NFTs and reclaiming satoshis:

```typescript
const { tx } = await StatefulContract.destroy({
    provider,
    contract: sc,
    destroyFunctionName: 'destroy',
    destroyFunctionArgs: [adminSig],
    recipientAddress: adminAddress,
    maxFee: 10000n,
});
```

:::caution
Destruction is irreversible. All state, entries, events, and tokens are permanently lost.
:::

## Deploying Child Contracts

Factory pattern - deploy a child contract from a parent:

```typescript
const { contract: child, tx } = await StatefulContract.deployFrom({
    provider,
    parentContract: factory,
    deployFunctionName: 'createChild',
    deployFunctionArgs: [adminSig],
    childArtifact,
    childConstructorArgs: [],
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: adminAddress,
});
```

## Debugging

```typescript
// Debug a function call
const debugResults = await sc.call.myFunc(args).debug();

// VM resource usage
const builder = await sc.call.myFunc(args).build();
const usage = builder.getVmResourceUsage();
```

## Auto-Derivation

The SDK automatically derives the full transaction from your function call:

1. Runs the contract bytecode in a local VM
2. Inspects which state variables are read/written
3. Discovers required vmap membership or absence proofs, entry NFTs, event outputs, and transfers
4. Constructs the complete transaction with all covenant outputs
5. Iterates up to 20 times until the state converges

:::tip
Auto-derivation handles most scenarios automatically. Use manual overrides (`.setState()`, `.transfer()`,
`.withEntryKey()`) only when auto-derivation cannot determine the correct values.
:::
