---
title: Stateful Contracts
---

The `StatefulContract` class manages the full lifecycle of stateful contracts: deployment, state reading, function calls, upgrades, and destruction.

## Deploying with a signer

```typescript
import { Signer } from 'solidcash';
import { ContractFactory } from 'solidcash/contract-factory';
import { ElectrumNetworkProvider } from 'solidcash/network/electrum';
import artifact from './Counter.artifact.js';

const provider = new ElectrumNetworkProvider('chipnet');
const signer = new Signer(adminPrivateKey, provider);

const factory = new ContractFactory(artifact, signer);
const contract = await factory.deploy(adminPub, {
    initialState: { counter: 0n },
    messageBusVerificationInputCount: 2,
});

await contract.waitForDeployment();
console.log('Category:', contract.categoryId);
console.log('TX:', contract.deploymentTransaction().txid);
```

A `Signer` runner finds or creates a plain genesis-valid `vout: 0` UTXO, funds and signs the deployment, connects
the returned contract to itself, and creates an authenticated logical CREATE identity. `getContractFactory()` and
`deployContract()` expose the same flow as convenience functions.

```typescript
import { deployContract, getContractFactory } from 'solidcash/contract-factory';

const sameFactory = getContractFactory(artifact, signer);
const sameContract = await deployContract(artifact, [adminPub], signer, {
    initialState: { counter: 0n },
});
```

### Explicit deployment

Use the lower-level API when a wallet or transaction service supplies the exact genesis input and unlocker:

```typescript
import { StatefulContract } from 'solidcash/stateful';

const { contract, tx, categoryId } = await StatefulContract.deploy(
    artifact,
    [adminPub],
    {
        provider,
        fundingUtxo: myVoutZeroUtxo,
        funder: fundingUnlocker,
        changeAddress: adminAddress,
        initialState: { counter: 0n },
    },
);
```

The explicit `fundingUtxo` must be a plain output at `vout: 0`; its txid becomes the CashToken category. The
category is baked into the deployed covenant, so the final stateful address depends on the artifact, constructor
arguments, category, and optional salt.

### Deploy Options

`artifact` and `constructorArgs` are the first two positional arguments to `StatefulContract.deploy()`; the
following fields belong to its third `options` argument.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `NetworkProvider` | required | Network connection |
| `fundingUtxo` | `Utxo` | required | Funding UTXO (must be vout 0) |
| `funder` | `Unlocker` | required | Unlocker for the funding UTXO |
| `changeAddress` | `string` | required | Address for change output |
| `initialState` | `Record<string, any>` | `{}` | Initial state variable values |
| `masterAmount` | `bigint` | `1200n` | Satoshis per master NFT |
| `dataNftAmount` | `bigint` | `1200n` | Satoshis per data NFT |
| `fee` | `bigint` | size-derived | Explicit transaction fee; the default includes the revealed redeem script |
| `maxFee` | `bigint` | none | Refuse a deployment whose selected fee exceeds this ceiling |
| `addressType` | `AddressType` | `'p2sh32'` | Must be `'p2sh32'` |
| `threadCount` | `number` | `1` | Number of parallel threads |
| `initialBalance` | `bigint` | `0n` | Initial satoshi container balance |
| `messageBusVerificationInputCount` | `number` | `1` when required | Independently spendable verifier instances provisioned at genesis |
| `salt` | `Uint8Array` | none | CREATE/address salt and optional operation-density reserve |
| `initArgs` | `FunctionArgument[]` | inferred/none | Arguments for an explicit `constructor(...)` block |

## Connecting to an Existing Contract

```typescript
// Ethers-style: resolves the category lazily on the first asynchronous operation.
const lazy = new StatefulContract(address, artifact, provider, {
    constructorArgs,
});

// Eager attach by physical/logical address or by a 64-character category ID.
const connected = await StatefulContract.at(address, artifact, signer, {
    constructorArgs,
});

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

A P2SH address commits to the redeem script but does not reveal it. Supply `constructorArgs` whenever the SDK may
need to spend the contract. A provider runner supports reads and self-funded calls; `connect(signer)` binds funding
and signing. `target`/`getAddress()`, `runner`, `interface`, `attach()`, and `withProvider()` mirror the ethers
contract surface.

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

Stateful functions are available through a typed direct method and the explicit `call` namespace:

```typescript
// Direct thenable call: awaiting builds and sends.
const result = await sc.increment(alicePub, aliceSig);

// Keep the pending call to configure or inspect it first.
const result = await sc.call.increment(alicePub, aliceSig).send();

// Build the lower-level stateful transaction builder.
const builder = await sc.functions.increment(alicePub, aliceSig);
const result = await builder.send();
```

If a contract function collides with a framework member, use `sc.getFunction('connect')(...args)`. Sent transaction
details include `txid`, `hex`, and `wait(confirmations?)`.

### Chained Builder Methods

```typescript
const result = await sc.call.transfer(to, amount)
    .setState('counter', 5n)          // override state
    .transfer(recipientLbc, 1000n)    // manual satoshi transfer
    .emitEvent('Transfer', from, to, amount)  // emit event
    .send();
```

Overrides are escape hatches for values the compiler trace cannot derive. They do not relax the generated
covenant; an incorrect state, event, or transfer output still fails validation.

## Reading State

```typescript
// All state variables
const state = await sc.getState();
console.log(state.counter);  // 5n

// Individual variable
const counter = await sc.state.counter();

// Short-form
const counter = await sc.counter();

// Public fixed-array elements
const item = await sc.state.items(3);
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

// Off-chain provider view of slot/value records.
const entries = await sc.getEntries('balances');
```

`getEntries()` cannot reverse a hashed vmap slot into its source key. Retain keys in application indexes/events
when off-chain key enumeration is required. It is also not an on-chain completeness proof: normal call building
reconstructs and validates the sorted list before the covenant consumes it.

Keys/entries iteration needs those retained keys because the NFT stores only their hashes:

```typescript
sc.setIterationKeys('balances', [alicePkh, bobPkh]);
await sc.call.auditBalances().send();
```

Supply canonical encoded `Uint8Array` keys. The order is irrelevant; the SDK matches them to sorted slots and the
covenant proves every preimage. Values-only iteration does not require `setIterationKeys()`. See
[Verified Mappings](/docs/language/verified-mappings) for the codecs, 255-byte key limit, single-key-dimension
restriction, and fail-closed iteration rules.

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

The new artifact can append state variables. Existing layout positions and values are preserved, new fields receive
their type defaults, and additional data-NFT outputs require `fundingUtxo` plus `funder`. The category stays stable
while the physical contract address changes. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) for the complete migration and proxy APIs.

## Destroying

Permanently destroy a contract, burning all NFTs and reclaiming satoshis:

```typescript
const { txs, totalReclaimed } = await StatefulContract.destroy({
    provider,
    contract: sc,
    destroyFunctionName: 'destroy',
    destroyFunctionArgs: [adminSig],
    recipient: adminAddress,
    maxFee: 10000n,
});

console.log(`reclaimed ${totalReclaimed} satoshis in ${txs.length} transaction(s)`);
```

:::caution
Destruction is irreversible and may require several transactions. The result contains `txs` and
`totalReclaimed`. Event NFTs whose 144-block cleanup delay has not elapsed cannot be swept yet; token containers
must be named with `tokenContainerCategoryIds` if they should be reclaimed. Use `maxInputsPerTx` to lower the
default batching limit (about 200 inputs); `fee` and `maxFee` apply per transaction.
:::

## Deploying Child Contracts

Factory pattern - deploy a child contract from a parent:

```typescript
const { contract: child, tx } = await StatefulContract.deployFrom({
    provider,
    factory,
    deployFunctionName: 'createChild',
    deployFunctionArgs: [adminSig],
    childArtifact,
    childConstructorArgs: [],
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: adminAddress,
});
```

The preferred call sugar is `factory.call.createChild(args).deploy(options)`. Register the child artifact with
`factory.registerChild(childArtifact)`, or compile the file with `compileFileMulti()` and use `ContractBundle` so
typed `new Child(...)` targets resolve automatically.

## Multi-contract artifact bundles

```typescript
import { ContractBundle } from 'solidcash/stateful';
import { compileFileMulti } from 'solidc';

const artifacts = compileFileMulti('Protocol.scash');
const protocol = ContractBundle.from(artifacts, { provider, signer });

const { contract: factory } = await protocol.deploy('Factory', [owner], deployOptions);
const token = await protocol.attach('Token', tokenAddress, tokenConstructorArgs);
```

The bundle carries artifacts, provider, and optional signer as implicit dependency context. `deploy()`,
`withCategory()`, and `attach()` register the complete artifact map on the connected instance. `attach()` resolves
the live category from UTXOs at the address; constructor arguments remain required to reconstruct the P2SH redeem
script.

For root/facet code sharding, use [Large Contracts & Split Bundles](/docs/compiler/large-contracts).

## Debugging

```typescript
// Debug a function call
const debugResults = await sc.call.myFunc(args).debug();

// VM resource usage
const builder = await sc.call.myFunc(args).build();
const usage = builder.getVmResourceUsage();
```

## Auto-Derivation

The SDK derives the complete UTXO transaction from compiler effect metadata and repeated local evaluation of the
actual covenant. It discovers required state/proof UTXOs, external participants, sidecars and effects, then fills
the compiler's synthetic position/count witnesses and iterates until commitments converge. The default
`maxDerivationIterations` is 20; most calls settle in three to five probes.

:::tip
Auto-derivation handles most scenarios automatically. Use manual overrides (`.setState()`, `.transfer()`,
`.withEntryKey()`) only when auto-derivation cannot determine the correct values.
:::

See [Transaction Auto-Derivation](./auto-derivation.md) for the compiler/SDK protocol, dependency registration,
failure modes and every override.
