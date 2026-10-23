---
title: Stateful Contracts
---

The `StatefulContract` class manages the full lifecycle of stateful contracts: deployment, state reading, function calls, upgrades, and destruction. `StatefulContract`, `ContractFactory`, `ContractBundle` and `ThreadManager` come from `@solidcash/solidcash/stateful`; the package root exports only the stateless surface.

## Deploying with a signer

```typescript
import { Signer } from '@solidcash/solidcash';
import { ContractFactory } from '@solidcash/solidcash/contract-factory';
import { ElectrumNetworkProvider } from '@solidcash/solidcash/network/electrum';
import artifact from './Counter.artifact.js';

const provider = new ElectrumNetworkProvider('chipnet');
const signer = new Signer(adminPrivateKey, provider);

const factory = new ContractFactory(artifact, signer);
const contract = await factory.deploy(adminPub, {
    initialState: { counter: 0n },
});

await contract.waitForDeployment();
console.log('Category:', contract.categoryId);
console.log('TX:', contract.deploymentTransaction().txid);
```

`deploy()` takes the constructor arguments in order, then an optional options object. A `Signer` runner finds or
creates a plain genesis-valid `vout: 0` UTXO, funds and signs the deployment, connects the returned contract to
itself, and creates an authenticated logical CREATE identity. A `NetworkProvider` runner cannot fund a genesis: pass
`fundingUtxo`, `funder` and `changeAddress` in the options. `factory.connect(runner)` returns the factory bound to
another runner. `await factory.attach(addressOrCategoryId)` connects to a deployed instance of a contract without
contract-level parameters; otherwise use `StatefulContract.at()` with `constructorArgs`. `getContractFactory()` and
`deployContract()` expose the same flow as convenience functions.

```typescript
import { deployContract, getContractFactory } from '@solidcash/solidcash/contract-factory';

const sameFactory = getContractFactory(artifact, signer);
const sameContract = await deployContract(artifact, [adminPub], signer, {
    initialState: { counter: 0n },
});
```

### Explicit deployment

Use the lower-level API when a wallet or transaction service supplies the exact genesis input and unlocker:

```typescript
import { StatefulContract } from '@solidcash/solidcash/stateful';

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
| `threadCount` | `number` | `1` | Number of master NFTs (threads); 12 for a framed artifact |
| `initialBalance` | `bigint` | `0n` | Initial satoshi container balance |
| `messageBusVerificationInputCount` | `number` | `1` when required | Message-bus verifier instances provisioned at genesis (experimental) |
| `validatorCount` | `number` | `4` for a framed artifact | Validator UTXOs a framed genesis mints (experimental) |
| `salt` | `Uint8Array` | none | CREATE/address salt and optional operation-density reserve |
| `initArgs` | `FunctionArgument[]` | inferred/none | Arguments for an explicit `constructor(...)` block |
| `blockhashKeeperPublicKey` | `Uint8Array` | none | Mint a blockhash keeper baton; only for an artifact that reads `blockhash` |
| `blockhashKeeperAmount` | `bigint` | `10_000n` | Initial keeper baton balance (at least 3,000 satoshis) |
| `identity`, `bcmr`, `nativeToken` | object | deployer owns the identity | BCMR identity owner, registry publication, and the ledger token's own category |

The `ContractFactory` options object takes the same fields except `provider`, `masterAmount`, `dataNftAmount`,
`maxFee` and the keeper fields; its funding fields default to the signer. See
[Contract Deployment](/docs/guides/deployment#cashtoken-metadata) for the BCMR identity and the ledger token, and
[Block Data & Oracles](/docs/guides/block-oracles) for the blockhash keeper. An artifact compiled with
`composition: 'framed'` (experimental) deploys a pool of masters and validators; see
[Framed Composition](/docs/guides/framed-composition).

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
    externals: { ICounter: counterContract },
});

// From artifact directly
const fromArtifact = StatefulContract.from(
    artifact,
    constructorArgs,
    { provider, addressType: 'p2sh32' },
    categoryId,
);
```

A P2SH address commits to the redeem script but does not reveal it. Supply `constructorArgs` whenever the SDK may
need to spend the contract. The runner decides what an instance can do: a `NetworkProvider` runner reads state,
and a `Signer` runner also funds and signs calls. Without a signer, only `MockNetworkProvider` and
`RegtestNetworkProvider` can supply test fee coins.

```typescript
const asBob = sc.connect(bob);                     // same target, funded and signed by bob
const viaNode = sc.withProvider(regtestProvider);  // same target and signer, another provider
const other = sc.attach(otherCategoryId);          // same artifact and provider, another category
```

`target`/`getAddress()`, `runner`, `interface`, `attach()`, and `withProvider()` mirror the ethers contract
surface. `categoryId`, `address` and `inner` (the underlying `Contract`) are also available.

### External Contract Binding

When your contract reads or calls external contracts, bind them at connect time:

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

In the contract, a call target is an `address`: the callee master's locking bytecode, not a category ID. `externals`
maps an interface name to the connected instance the SDK co-spends. `externalContracts` builds those instances from
an artifact and category, and infers constructor arguments from ABI metadata when you omit them. For one call with a
dynamic target, pass the connected callee to the pending call with `.withExternalCall(callee)`; see
[Transaction Auto-Derivation](/docs/sdk/auto-derivation#dependency-discovery).

:::caution Experimental
State-changing calls into other contracts (composed external state mutation) are experimental in this release.
Reading another contract's state is not.
:::

## Calling Functions

Stateful functions are available through a typed direct method and the explicit `call` namespace:

```typescript
// Direct thenable call: awaiting builds, funds and sends.
const result = await sc.increment(alicePub, aliceSig);

// Keep the pending call to configure or inspect it first.
const receipt = await sc.call.increment(alicePub, aliceSig).send();
console.log(receipt.txid, receipt.events); // events: [{ event, eventSignature, args }]

// Build the transaction without sending it.
const builder = await sc.call.increment(alicePub, aliceSig).build();

// Read a return value without sending a transaction.
const total = await sc.call.total().staticCall();

// Build the lower-level stateful transaction builder.
const statefulBuilder = await sc.functions.increment(alicePub, aliceSig);
const sent = await statefulBuilder.send();
```

Awaiting a call sends it, with one exception: a function that returns a value and provably writes no state
resolves to its decoded return value, as in ethers. `.staticCall()` and `sc.callStatic.total()` always read, and
`.send()` always sends. Sent transaction details include `txid`, `hex`, `wait(confirmations?)` and, for a stateful
call, the transaction's decoded `events`.

If a contract function collides with a framework member, use `sc.getFunction('connect')(...args)`. An overloaded
function is reachable by its signature, for example `sc.call['set(int)']`; the bare name works when the argument
count selects one overload.

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

Other pending-call methods:

| Method | Effect |
| --- | --- |
| `.withValue(amount)` | Deposit satoshis into the satoshi container (`payable` functions only; `msg.value`) |
| `.withMaxFee(satoshis)` | Refuse a transaction whose fee exceeds this ceiling |
| `.setLocktime(locktime)` | Set the transaction's nLocktime, for `tx.time` checks |
| `.emitReturn()` | Publish the return value in a return-event output that off-chain readers can decode |
| `.buildUnsigned()` | Return the covenant transaction without funding or signatures, for an external wallet to complete |

### Batching calls (experimental)

```typescript
await counter.batch([
    { function: 'add', args: [1n] },
    { function: 'add', args: [2n] },
]).send();
```

`sc.batch()` runs several public functions of one contract against one master input through the compiler's
message-bus route. It works only when the artifact publishes a message bus whose selected handlers are eligible.
`messageBus.compose()` from `@solidcash/solidcash/message-bus` composes calls to several contracts in one transaction. Both
are experimental; see [Atomic Calls with the Message Bus](/docs/guides/message-bus).

## Reading State

```typescript
// All state variables
const state = await sc.getState();
console.log(state.counter);  // 5n

// Individual variable
const counter = await sc.state.counter();

// Short-form
const sameCounter = await sc.counter();

// Public fixed-array elements
const item = await sc.state.items(3);

// Mapping value by key; a missing key reads as the value type's default
const balance = await sc.state.balances(alicePkh);

// Satoshi container balance
const sats = await sc.getBalance();
```

The short form works when no framework member has the same name. `getFullState()` also returns the UTXOs behind
the values: `{ state, masterUtxo, dataNftUtxos, entryNftUtxos }`.

## Events

```typescript
// Events of a transaction you sent
const receipt = await sc.call.transfer(to, amount).send();
for (const e of receipt.events ?? []) console.log(e.event, e.args);

// Unspent event outputs of the contract: [{ eventName, eventSignature, args, txid, vout }]
const logs = await sc.queryFilter('Transfer');
const fromAlice = await sc.queryFilter(sc.filters.Transfer(alicePkh)); // filter on indexed arguments

// Poll for new events
const onTransfer = (from, to, amount, log) => console.log(log.txid);
await sc.on('Transfer', onTransfer);
await sc.off('Transfer', onTransfer);
```

An event is an NFT output, not a log entry. `queryFilter()` returns the event outputs that are unspent now, and
`'*'` queries every event. Anyone may spend an event output for cleanup 144 blocks after it was created, so persist
the events you need. The block-range arguments of `queryFilter()` are accepted for ethers compatibility and
ignored. `on()` polls every `pollingInterval` milliseconds (4,000 by default) and passes the decoded arguments
followed by the log; `once()`, `removeAllListeners()` and `listenerCount()` work as in ethers.

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

// Deposit: add the token input yourself and declare the amount the container keeps
await sc.call.deposit(tokenCategory, amount)
    .tokenContainerDeposit(tokenCategory, amount)
    .addInput(tokenUtxo, tokenUnlocker)
    .send();

// Container address and holdings for one category
const containerAddress = sc.getTokenContainerAddress(tokenCategory);
const held = await sc.tokens[tokenCategory].getAmount();
```

Transfers are usually derived from the covenant trace; the explicit forms above are overrides. See
[Token Containers](/docs/language/token-containers) for deposits, the `sc.tokens[category]` accessor, and the
multiple-UTXO rules.

## Satoshi Transfers

```typescript
// Usually auto-derived from VM trace
await sc.call.sendFunds(sig, recipient, 5000n).send();

// Manual override
await sc.call.sendFunds(sig, recipient, 5000n)
    .transfer(recipientLockingBytecode, 5000n)
    .send();

// Pay into the satoshi container through a payable function
await sc.call.deposit().withValue(5000n).send();
```

## Upgrading

Move a contract to new bytecode while preserving the category ID. The old contract needs a function with the
`upgrade` modifier, and one with the `migrateRecords` modifier when it keeps mapping or array entries:

```typescript
import newArtifact from './CounterV2.artifact.js';

const { contract: upgraded, tx, leftBehind } = await StatefulContract.upgrade({
    provider,
    oldContract: sc,
    upgradeFunctionName: 'migrate',
    upgradeFunctionArgs: [adminSig],
    migrateRecordsFunctionArgs: [adminSig],   // only when the contract keeps entries
    newArtifact,
    newConstructorArgs: [adminPub],
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: signer.getAddress(),
});
```

The upgrade carries the contract's state records to the new lock:

- **State variables.** The data NFTs are re-minted with their values. Keep the new layout an extension of the old
  one: the SDK refuses a removed, moved or retyped variable, and appended variables start at their defaults.
- **Containers.** The satoshi and token containers move with the master. Name foreign token-container categories
  in `tokenContainerCategoryIds`. A surplus coin at a container address blocks the upgrade until you name it
  (`txid:vout`) in `leaveBehind`; the result's `leftBehind` lists each abandoned coin.
- **Mapping and array entries.** They move first, one transaction each, through the `migrateRecords` function.
  Pass its arguments in `migrateRecordsFunctionArgs`, and `migrateRecordsFunctionName` when the contract declares
  several.
- **Chunk values.** Dynamic values and long mapping values do not migrate. The SDK refuses the upgrade while one
  is live.

`fundingUtxo` and `funder` pay for extra data NFTs and every entry migration; every network except the mock needs
them for the upgrade fee too. The result is `{ contract, tx, categoryId, leftBehind }`. The category stays stable
while the physical contract address changes.

A proxy keeps the address instead: `upgrades.deployProxy()` from `@solidcash/solidcash/stateful` is the stable profile, while
custom proxies and `upgrades.upgradeProxy()` are experimental. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) for both models.

## Destroying

Permanently destroy a contract, burning all NFTs and reclaiming satoshis:

```typescript
const { txs, totalReclaimed, leftBehind } = await StatefulContract.destroy({
    provider,
    contract: sc,
    destroyFunctionName: 'destroy',
    destroyFunctionArgs: [adminSig],
    recipient: adminAddress,
    maxFee: 10000n,
});

console.log(`reclaimed ${totalReclaimed} satoshis in ${txs.length} transaction(s)`);
```

The function must be a `selfdestruct` entry: it has the `selfdestruct` modifier, or a `selfdestruct(to)`
statement directly in its body, in which case `recipient` must be that address. `StatefulContract.selfdestructTo()`
is an alias that takes the same options. A plain `sc.call.destroy(...)` is refused, because an ordinary call keeps
the master. See [Contract Destruction](/docs/language/selfdestruct).

:::caution
Destruction is irreversible and may require several transactions. The result contains `txs`, `totalReclaimed`
and `leftBehind`. Event NFTs whose 144-block cleanup delay has not elapsed cannot be swept yet. Name token
containers in `tokenContainerCategoryIds` to spend them: the destroy pays only satoshis to `recipient`, so
CashTokens still in a named container are burned. Transfer tokens out first. Other coins at a container address
are left in place and listed in `leftBehind`. Use `maxInputsPerTx` to lower the default batching limit (about
200 inputs); `fee` and `maxFee` apply per transaction.
:::

## Deploying Child Contracts

Factory pattern - deploy a child contract from a parent:

```typescript
// Preferred: awaiting the deploy function funds the child's genesis from the connected signer.
factory.registerChild(childArtifact);
const { child, childCategoryId } = await factory.call.createChild(adminSig);

// Explicit genesis funding
const second = await factory.call.createChild(adminSig).deploy({
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: adminAddress,
});

// Static form
const { factory: updatedFactory, child: third, tx } = await StatefulContract.deployFrom({
    provider,
    factory,
    deployFunctionName: 'createChild',
    deployFunctionArgs: [adminSig],
    childArtifact,
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: adminAddress,
});
```

Each form returns `{ factory, child, tx, childCategoryId }`: the factory with its updated state, the connected
child, the transaction, and the child's category, which is the funding UTXO's txid. The funding UTXO must be a
plain `vout: 0` output. The child's constructor arguments and salt come from the `new Child(...)` expression unless
you pass `childConstructorArgs` or `childSalt`. `childValue` and `childTokenTransfers` declare value the deploy
moves out of the factory's containers, and a deploy in a loop takes one `fundingUtxos` entry per child. When the
`new` sits in a branch these arguments do not take, `.send()` and `.build()` run the plain, non-deploying call.

Register the child artifact with `factory.registerChild(childArtifact)`, or compile the file with
`compileFileMulti()` and use `ContractBundle` so typed `new Child(...)` targets resolve automatically.

## Multi-contract artifact bundles

```typescript
import { ContractBundle } from '@solidcash/solidcash/stateful';
import { compileFileMulti } from '@solidcash/solidc';

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

## Threads, split and merge

`ThreadManager` partitions a contract's data NFTs across several master NFTs, and `split`/`merge` functions change
the number of masters through `StatefulContract.split()`, `StatefulContract.merge()` or the pending-call methods
`withSplitFunding()` and `withConsumedMasters()`. See [Threading and State Management](/docs/sdk/threading).

## Debugging

```typescript
// A pending stateful call has no debug(): build it, then debug the builder.
const builder = await sc.call.myFunc(args).build();
const debugResults = builder.debug();

// VM resource usage per input
const usage = builder.getVmResourceUsage(true);
```

See [Debugging](/docs/guides/debugging) for failing-require messages, `console.log` output and BitAuth IDE links.

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
