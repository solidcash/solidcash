---
title: TypeScript SDK
---

The `solidcash` package is the application SDK for compiled SolidCash artifacts. It covers stateless covenant
inputs, stateful contract deployment and calls, transaction construction, signing, network access, events,
contract composition, and testing providers. It works in TypeScript and JavaScript in Node.js or browser-capable
bundlers.

Generated TypeScript artifacts provide the strongest experience: contract parameters, function arguments, state
getters, events, and return values flow into SDK types without maintaining a second ABI declaration.

## Choose the right contract API

| Contract shape | Primary API | Transaction model |
|---|---|---|
| Stateless spending covenant | `Contract` | Select a UTXO, create an unlocker, specify outputs |
| Stateful application contract | `ContractFactory` + `StatefulContract` | SDK discovers authenticated NFTs and derives outputs |
| Several declarations in one source graph | `ContractBundle` | Registers all child/interface artifacts together |
| Compiler-split large contract | `SplitContractBundle` | One logical root with branded code facets |

A stateless `Contract` is ready when its artifact and constructor arguments are known. A `StatefulContract` must
also be attached to its CashToken category or deployed through a genesis transaction.

## Stateful quick start

```ts
import { Signer } from 'solidcash';
import { ContractFactory } from 'solidcash/contract-factory';
import { ElectrumNetworkProvider } from 'solidcash/network/electrum';
import counterArtifact from './Counter.artifact.js';

const provider = new ElectrumNetworkProvider('chipnet');
const signer = new Signer(privateKey, provider);
const factory = new ContractFactory(counterArtifact, signer);

const counter = await factory.deploy(adminPublicKey, {
  initialState: { counter: 0n },
});

await counter.increment(signature);              // build, sign, and send
const current = await counter.counter();         // public state getter
const events = await counter.queryFilter('Increment');

console.log(counter.target, counter.categoryId, current, events);
```

The connected signer funds ordinary calls and child genesis inputs. Keep a pending call when you need builder
configuration:

```ts
const pending = counter.call.increment(signature);
const transaction = await pending.send();
await transaction.wait(1);
```

See [Stateful Contracts](/docs/sdk/stateful-contracts), [Contract Deployment](/docs/guides/deployment), and
[State Storage](/docs/language/storage-model).

## Stateless quick start

```ts
import { Contract, SignatureTemplate, TransactionBuilder } from 'solidcash';
import { ElectrumNetworkProvider } from 'solidcash/network/electrum';
import vaultArtifact from './Vault.artifact.js';

const provider = new ElectrumNetworkProvider('chipnet');
const vault = new Contract(vaultArtifact, [ownerPublicKey], { provider });
const [vaultUtxo] = await vault.getUtxos();

const tx = await new TransactionBuilder({
  provider,
  maximumFeeSatoshis: 10_000n,
})
  .addInput(vaultUtxo, vault.unlock.release(new SignatureTemplate(ownerPrivateKey)))
  .addOutput({ to: recipientAddress, amount: vaultUtxo.satoshis - 1_000n })
  .send();

await tx.wait(1);
```

For a stateless covenant, the SDK does not invent the transaction shape: the contract validates the inputs and
outputs you supply. See [Contract Instantiation](/docs/sdk/instantiation) and
[Transaction Builder](/docs/sdk/transaction-builder).

## Main SDK layers

### Artifacts and contracts

- `Contract` constructs a locking script, exposes `address`, `tokenAddress`, bytecode metrics, UTXO queries, and
  typed `unlock.<function>()` factories.
- `StatefulContract` attaches an artifact to a category, reads state, derives covenant co-spends and outputs,
  handles events, and implements upgrade/deploy/split/merge/destroy workflows.
- `ContractFactory` deploys a stateful contract through a `Signer` or explicit genesis funding.
- `ContractBundle` carries an `ArtifactMap` so typed child deployment and cross-contract resolution can find every
  declaration in the compiler output.
- `SplitContractBundle` and `SplitContract` expose a large compiler-split program as one logical application.

### Runners and signing

- A `NetworkProvider` runner supports chain queries and read-oriented attachment.
- A `Signer` combines a private key with a provider, supplies P2PKH funding, and tracks logical CREATE identities.
- `HDSigner`, `HDPublicSigner`, and `signersFromMnemonic` provide HD-wallet derivation.
- `SignatureTemplate` creates transaction signatures and P2PKH unlockers for manually assembled transactions.

`Signer` intentionally does not emulate account-chain operations such as gas estimation, ENS, EIP-712, or generic
`eth_sendTransaction`: Bitcoin Cash calls are explicit UTXO transactions.

### Transactions

- `TransactionBuilder` is the general raw builder for several inputs, covenants, P2PKH funding, CashTokens,
  OP_RETURN outputs, locktime, sequence numbers, fee limits, debugging, and broadcast.
- `StatefulTransactionBuilder` is produced by `sc.functions.<name>()`; it owns the authenticated state layout and
  should normally be reached through `sc.call.<name>()`.
- `gatherBchUtxos()` and `gatherFungibleTokenUtxos()` perform deterministic amount gathering from an existing UTXO
  list; they do not query or lock coins.
- `TransactionDetails` returns the txid and serialized transaction and has `wait(confirmations?)` when broadcast
  through an SDK provider.

The removed single-contract fluent transaction API is documented only for migration under
[Legacy APIs](/docs/sdk/legacy-transaction-builder).

### Providers

`ElectrumNetworkProvider` is the normal public-network provider. The package also includes full-stack, Bitcoin
RPC, regtest, mock, and intentionally failing mock providers for integration and adversarial tests. Provider
capability matters: address/category resolution, event queries, and current-state discovery require complete UTXO
results for the relevant locking bytecodes.

See [Network Providers](/docs/sdk/network-provider) and
[Other Network Providers](/docs/sdk/other-network-providers).

### Stateful protocols

The stateful exports also include:

- `StateReader`, state-layout encoders/decoders, and covenant-address helpers;
- `ThreadManager` and `ThreadHandle` for partitioned masters;
- event parsing/query helpers and the ethers-flavored event facade;
- external contract registration, result-event calls, and message-bus composition;
- lifecycle helpers for child deployment, upgrade/proxy administration, split/merge, and destruction;
- block-register and blockhash-oracle co-spend helpers.

Prefer the high-level contract method which owns the invariant. Low-level commitment builders and covenant-address
helpers are useful for indexers, verification, and custom wallet integrations, but manually reproducing SDK output
ordering is easy to get wrong.

## TypeScript artifacts

Compile to TypeScript for type-preserving imports:

```bash
solidc contracts/Counter.scash --format ts --output-dir artifacts
```

```ts
import { Counter } from './artifacts/Counter.js';

const factory = new ContractFactory(Counter, signer);
const counter = await factory.deploy(adminPublicKey);
await counter.increment(signature);
```

JSON artifacts are fully supported, but their imported type is usually widened to the generic ABI surface. The
compiler artifact contains more than bytecode: constructor inputs, ABI selectors, state layout, event definitions,
source maps, composition routes, split metadata, and security requirements may all be consumed by the SDK.

## Package entry points

```ts
import { Contract, utils } from 'solidcash';
import { StatefulContract } from 'solidcash/stateful';
import * as messageBus from 'solidcash/message-bus';
import { expect } from 'vitest';
import 'solidcash/vitest';
```

- The package root is the stateless runtime SDK: `Contract`, `TransactionBuilder`, `Signer`, `SignatureTemplate`,
  the errors, and the `utils` namespace. Keep importing it for those.
- Everything stateful lives on `solidcash/stateful` (`StatefulContract`, `StateReader`, `ContractBundle`, the
  covenant helpers, entry-commitment codecs, and `upgrades`). The factory entry `ContractFactory`,
  `getContractFactory`, and `deployContract` have their own `solidcash/contract-factory` subpath.
- Other subpaths: `solidcash/message-bus` (composition and preflight namespace), `solidcash/framed`,
  `solidcash/oracle`, `solidcash/network/electrum`, `solidcash/network/mock`, `solidcash/hdsigner`,
  `solidcash/loop-call`, and `solidcash/walletconnect`.
- `solidcash/vitest` installs SolidCash-aware Vitest matchers.
- The `utils` namespace re-exports shared artifact, bytecode, encoding, and state-layout utilities.

For a complete project environment, use [SolidHat](/docs/tooling/solidhat). For direct test harness use, see
[`@solidcash/testing`](/docs/tooling/testing-framework).

## Advanced non-SolidCash scripts

`TransactionBuilder` and providers can be used without the compiler. A hand-written script can either be described
by a compatible artifact and instantiated as a `Contract`, or supplied through a custom `Unlocker`. In both cases,
the application owns ABI encoding, output safety, and script correctness. See
[Hand-Optimizing Bytecode](/docs/guides/optimization#advanced-hand-optimizing-bytecode).
