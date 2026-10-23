---
title: Contract Deployment
sidebar_label: Contract Deployment
---

Deployment means two different things in SolidCash:

- A **stateless** contract needs no deployment transaction. Construct its locking bytecode from the artifact and
  constructor arguments, then pay one or more outputs to its address.
- A **stateful** contract needs a CashToken genesis transaction. The genesis category authenticates its master,
  state, mapping, chunk, event, and other covenant NFTs.

This guide explains the Bitcoin Cash mechanics and verification requirements of deployment. To compile and run
repeatable deployment scripts across mocknet, BCHN regtest, chipnet, and mainnet, see the
[SolidHat project tooling guide](/docs/tooling/solidhat#deployment-scripts).

For the data carried by each generated output, see
[State Storage and NFT Layout](/docs/language/storage-model).

:::tip
If your contract only enforces spending conditions, use the contract address directly. Deployment is for systems where CashTokens identify and track contract state.
:::

## Recommended: deploy with a signer

`ContractFactory` is the normal deployment API. A `Signer` supplies the provider, selects and unlocks a plain
genesis input, creates one when the wallet has no suitable `vout: 0`, sends change back to the signer, and connects
the returned contract for immediate use.

```ts
import { Signer } from '@solidcash/solidcash';
import { ContractFactory } from '@solidcash/solidcash/contract-factory';
import { ElectrumNetworkProvider } from '@solidcash/solidcash/network/electrum';
import counterArtifact from './Counter.artifact.js';

const provider = new ElectrumNetworkProvider('chipnet');
const deployer = new Signer(deployerPrivateKey, provider);
const factory = new ContractFactory(counterArtifact, deployer);

const counter = await factory.deploy(adminPublicKey, {
  initialState: { counter: 0n },
  initialBalance: 20_000n,
});

await counter.waitForDeployment();

console.log(counter.categoryId);                 // state/token category
console.log(counter.target);                     // logical CREATE address
console.log(counter.inner.address);              // physical covenant address
console.log(counter.deploymentTransaction().txid);
```

`waitForDeployment()` resolves once the provider returns the genesis transaction, which can be before it confirms.
`getContractFactory(artifact, runner)` creates the same factory. `deployContract(artifact, args, runner,
overrides)` is a one-call shortcut. `new ContractFactory(...)` and `getContractFactory(...)` take an optional third
argument: default deploy options that every `deploy` call starts from and that its own overrides replace.

```ts
import { deployContract, getContractFactory } from '@solidcash/solidcash/contract-factory';

const sameFactory = getContractFactory(counterArtifact, deployer);
const sameContract = await deployContract(
  counterArtifact,
  [adminPublicKey],
  deployer,
  { initialState: { counter: 0n } },
);
```

### Deployment arguments

Arguments declared after the contract name are baked into its redeem script:

```solidity
contract Counter(pubkey admin) {
    int public counter;

    constructor(int start) {
        this.counter = start;
    }
}
```

The factory accepts contract parameters first, followed by arguments for the explicit `constructor(...)` block,
then an optional overrides object:

```ts
const counter = await factory.deploy(adminPublicKey, 10n, {
  initialBalance: 5_000n,
});
```

For a constructor without `sig` parameters, the SDK executes a local probe and derives its state writes, mapping
entries, dynamic chunks, transfers, and events before building the real genesis transaction. A constructor with a
`sig` parameter cannot be probed with a real signature, so pass an explicit `initialState`. `initArgs` is the
override-object form of the explicit constructor-block arguments.

:::caution
Contract parameters can contain permanent authority keys, oracle identities, or dependent-contract addresses.
Review them before deployment: changing a contract parameter changes the physical covenant address.
:::

### Constructor reads from another contract

Bitcoin Cash has no on-chain constructor execution, so a Solidity constructor cannot synchronously call a
deployed contract. SolidCash adapts a zero-argument, single-value read through an interface-typed state field by
hoisting the result into a generated deploy input:

```solidity
interface IPool {
    function token0() external view returns (address);
}

contract RoutedToken() {
    IPool immutable pool;
    address immutable token0;

    constructor(address poolAddress) {
        pool = IPool(poolAddress);
        token0 = pool.token0();
    }
}
```

The compiler warns about the rewrite and records it in `artifact.stateLayout.deployReads`. Resolve those inputs
from authenticated on-chain state before deployment:

```ts
import { resolveDeployReads, StatefulContract } from '@solidcash/solidcash/stateful';

const constructorArgs = await resolveDeployReads(
  routedTokenArtifact,
  { poolAddress: pool.inner.address },
  { runner: provider, artifacts: { IPool: poolArtifact } },
);

const deployed = await StatefulContract.deploy(routedTokenArtifact, constructorArgs, deployOptions);
```

`resolveDeployReads()` attaches to the target, decodes its current state with the registered artifact, and returns
the complete positional constructor list. Reads with arguments and reads in ordinary functions remain real
co-spent external reads. Supplying the generated values manually is possible, but then the deployer, not the
target covenant, is responsible for their correctness.

## The three identifiers

A deployed stateful contract has three useful identifiers. They are related, but they are not interchangeable in
every context.

| Identifier | Meaning | Stability and use |
|---|---|---|
| `categoryId` | Txid of the plain `vout: 0` input spent by genesis | Authenticates every NFT in the state system |
| `inner.address` | Physical P2SH32 covenant address | Depends on artifact, contract args, category, and optional `salt` |
| `target` / `getAddress()` | Logical CREATE address | Stable application identity created by a signer-backed factory |

The factory derives the logical address from the deployer's CashAddress and its logical transaction nonce. Genesis
also creates an immutable category-bearing identity anchor that binds that logical address to the physical root
covenant. This lets application code keep one identity while implementations or split facets have physical
addresses of their own.

Persist all of the category ID, logical address, artifact fingerprint/version, constructor arguments, network, and
deployment txid. A P2SH address contains only a hash of the redeem script; it cannot recover constructor arguments
needed to spend the contract later.

:::note
The SDK accepts a displayed category ID and handles the byte order used inside token-aware scripts. Do not
manually reverse a category returned by a SolidCash deployment API.
:::

## What genesis creates

The genesis transaction is assembled from the compiler's artifact metadata. Every genesis starts with the category's
**BCMR identity output** at output 0, followed by a registry publication at output 1 when you pass `bcmr` (see
[CashToken metadata](#cashtoken-metadata)). Depending on the contract, it can then create:

1. One or more **master minting NFTs** at the root covenant.
2. Mutable **data NFTs** containing the fixed-width state layout.
3. Mutable **vmap HEAD and entry NFTs** for verified mappings.
4. Mutable **chunk NFTs** for dynamic strings, bytes, and eligible arrays.
5. Constructor-created **event NFTs**, plain BCH transfers, and token-container outputs.
6. Mutable **message-bus verifier NFTs** when the artifact has a composition route.
7. A plain **satoshi-container output** when `initialBalance` is non-zero.
8. The token premint and bearer supply that `nativeToken` asks for.
9. Immutable **logical identity anchors** for signer/factory deployments.
10. A `blockhash(n)` **keeper baton** when `blockhashKeeperPublicKey` is set.
11. Change to the selected change address.

The SDK calculates these outputs; application code should not manually serialize state commitments. Chunking,
vmap sentinels, output ordering, and commitment encodings are covenant protocol details.

### Deployment options

The factory's trailing overrides object supports:

| Option | Default | Purpose |
|---|---:|---|
| `initialState` | zero/default state | Explicit initial variable values |
| `initArgs` | positional constructor args | Arguments for the explicit `constructor(...)` block |
| `initialBalance` | `0n` | Initial BCH in the satoshi container |
| `threadCount` | `1` (framed: `12`) | Number of master thread NFTs created by genesis |
| `messageBusVerificationInputCount` | `1` when the artifact has a bus route, else `0` | Independently spendable message-bus verifier instances |
| `fee` | transaction-size derived | Explicit genesis transaction fee |
| `addressType` | `p2sh32` | Address type; stateful contracts require P2SH32 |
| `salt` | none | Bytes baked into the script for address separation or operation-density reserve |
| `fundingUtxo` | signer-selected | Exact plain genesis input |
| `funder` | signer unlocker | Unlocker for an explicit funding input |
| `changeAddress` | signer address | Genesis change destination |
| `identity` | deployer's lock | `{ owner }`: the lock that owns the category's BCMR identity |
| `bcmr` | none | A registry the genesis publishes at output 1 |
| `nativeToken` | none | A `BchNative` token's own category, premint, bearer supply and scale |
| `validatorCount` | `4` | Framed deployments only: validator UTXOs at the contract's address |
| `functionSplit` | none | A `split: 'func'` bundle: genesis mints a master pool at each shard's lock |

With a `NetworkProvider` runner instead of a `Signer`, pass `fundingUtxo`, `funder` and `changeAddress` yourself;
that deployment gets no logical CREATE address, so `target` is the physical address. `validatorCount` and
`functionSplit` belong to the framed convention, which is experimental in 0.14.0-beta.1 (see
[Framed Composition](/docs/guides/framed-composition)).

`StatefulContract.deploy(artifact, constructorArgs, options)` takes the same options except the signer defaults:
`provider`, `fundingUtxo`, `funder` and `changeAddress` are required. It also accepts:

| Option | Default | Purpose |
|---|---:|---|
| `masterAmount` | `1200n` | Satoshis on each master NFT |
| `dataNftAmount` | `1200n` | Satoshis on each other covenant NFT, raised to the output's dust threshold when higher |
| `maxFee` | none | Refuse a genesis whose fee is higher |
| `blockhashKeeperPublicKey` | none | Mint a [`blockhash(n)` keeper baton](/docs/guides/block-oracles#keeper-baton) at genesis |
| `blockhashKeeperAmount` | `10_000n` | Initial satoshis on the keeper baton |

Treat custom NFT amounts as an advanced policy choice: every later transaction must still satisfy relay and covenant
requirements.

### Threads and verifier capacity

`threadCount` creates multiple master NFTs. It does **not** clone one complete copy of every state variable per
master. Thread discovery partitions the existing data NFTs across those masters, so design the state layout for
independent partitions before enabling threads. Contracts can also change the master set through `split(n)` and
`merge(n)` lifecycle functions. See [Contract Concurrency](/docs/guides/concurrency) and
[Threading and State Management](/docs/sdk/threading).

`messageBusVerificationInputCount` is a separate concurrency control. Each composed transaction consumes and
recreates one verifier NFT; provisioning more instances permits more message-bus compositions to be in flight.
Message-bus composition is experimental in 0.14.0-beta.1; see [Message Bus](/docs/guides/message-bus).

## Exact-input deployment

Wallet adapters and transaction services can supply the genesis input and unlocker directly:

```ts
import { StatefulContract } from '@solidcash/solidcash/stateful';

const { contract, tx, categoryId } = await StatefulContract.deploy(
  counterArtifact,
  [adminPublicKey],
  {
    provider,
    fundingUtxo: genesisUtxo,
    funder: fundingUnlocker,
    changeAddress,
    initialState: { counter: 0n },
    maxFee: 25_000n,
  },
);
```

`genesisUtxo` must be a token-free output with index `0`. Its txid becomes `categoryId`. It must cover all covenant
outputs, constructor transfers, any initial balance, and the finalized fee. The SDK throws before broadcast if
the input is unsuitable or underfunded.

Bitcoin Cash token genesis is why an arbitrary wallet coin cannot always be used. A signer-backed factory first
searches for a suitable coin and, if needed, sends wallet funds to a fresh self-output at index zero before
deploying.

## Deploying several declarations

A source file can compile to several deployable artifacts. Register the whole `ArtifactMap` with `ContractBundle`
so child artifacts and interface implementations remain available to deployment and call composition:

```ts
import { ContractBundle } from '@solidcash/solidcash/stateful';
import artifacts from './Protocol.artifacts.js';

const bundle = ContractBundle.from(artifacts, { provider, signer: deployer });
const { contract: market } = await bundle.deploy('Market', [adminPublicKey], {
  fundingUtxo: marketGenesisUtxo,
  funder: deployer.unlockP2PKH(),
  changeAddress: deployer.getAddress(),
  initialState: { open: true },
});
```

Compiler-split contracts use `SplitContractBundle`, which deploys a root plus its facets under one logical
identity. See [Large and Split Contracts](/docs/compiler/large-contracts).

## Deploying child contracts

A function which creates a stateful child with `new C(...)` is inferred as a deploy route. It spends the parent's
state and one plain `vout: 0` funding input per child, then creates a self-pinned child category, master, state
outputs, and identity anchor atomically. Writing the `deploy` modifier on that function is optional; the artifact
records the deploy route either way.

```solidity
contract Vault(pubkey recipient) {
    bool open;

    function release(sig recipientSig) {
        require(checkSig(recipientSig, recipient));
        this.open = false;
    }
}

contract VaultFactory(pubkey admin) {
    int created;

    function createVault(pubkey recipient, sig authorization) {
        require(checkSig(authorization, admin));
        new Vault(recipient);
        this.created += 1;
    }
}
```

```ts
parent.registerArtifacts(artifacts);

// A connected signer selects/funds the child's vout: 0 genesis input.
const { child, childCategoryId } = await parent.createVault(recipient, authorization);

// Or select it explicitly:
const explicit = await parent.createVault(recipient, authorization).deploy({
  fundingUtxo: childGenesisUtxo,
  funder: deployer.unlockP2PKH(),
  changeAddress: deployer.getAddress(),
});
```

The exact builder method depends on whether the compiler can infer the child artifact and arguments. The explicit
static API is `StatefulContract.deployFrom(...)`; its options use `factory` for the parent contract and accept a
child artifact or registered artifact graph. See [Stateful Contracts](/docs/sdk/stateful-contracts#deploying-child-contracts).

## Reconnecting after deployment

Connect by logical address, physical address, or category ID:

```ts
// Resolve an address through its identity/category-bearing UTXOs.
const byAddress = await StatefulContract.at(
  savedLogicalAddress,
  counterArtifact,
  deployer,
  { constructorArgs: [adminPublicKey] },
);

// A 64-character category ID can be used directly.
const byCategory = new StatefulContract(
  savedCategoryId,
  counterArtifact,
  deployer,
  { constructorArgs: [adminPublicKey] },
);
```

A `NetworkProvider` runner is sufficient for reads. A `Signer` runner also funds and signs calls. Address-based
attachment requires a provider/indexer capable of returning the category-bearing UTXOs at that address.

## Verifying a deployment

Do not verify only the root address. Inspect the complete genesis transaction and current identity records:

1. The spent genesis input is plain, has `vout: 0`, and its txid equals the expected category.
2. The physical P2SH32 root reconstructed from the exact artifact, arguments, category, and salt matches.
3. Every token output has the expected category, amount, NFT capability, commitment, and locking bytecode.
4. The master count, data NFT count, vmap HEADs, chunks, verifier pool, and initial balance match the artifact and
   deployment configuration.
5. Every constructor-created transfer and event is expected.
6. The immutable identity anchor binds the saved logical address to the expected deployer, nonce, and physical
   root.
7. Output 0 is the category's authhead contract, and its NFT names the expected identity owner (see
   [CashToken metadata](#cashtoken-metadata)).
8. There are no unaccounted minting NFTs or category-bearing outputs controlled by an unexpected address.

Keep the verification script independent of the deployment script and publish enough inputs for another party to
run it. Test the complete flow on chipnet or regtest before using mainnet authority keys or funds.

## CashToken metadata

Every genesis the SDK builds leads with the category's [BCMR][bcmr] identity output at output 0: the category's
**authhead contract**, a small covenant whose address is unique to the category. It holds a mutable NFT of the
category whose commitment names the identity's owner: the deployer's lock by default, or the `identity.owner` you
pass (a P2PKH, P2SH20 or P2SH32 lock, as bytecode or an address). The owner is no part of the contract's state, and
the contract's calls never touch the authhead.

Only the owner spends it, with exactly one token-free coin of theirs beside it, which pays the fee. A spend does one
of four things:

| Spend | Output 0 afterwards | Effect |
| --- | --- | --- |
| update | the authhead, same owner | publishes a new registry, or carries the current one over |
| transfer | the authhead, a new owner | hands the identity to the new owner's lock |
| freeze | an unspendable lock | the current registry is final |
| burn | `OP_RETURN` | the identity ends |

Pass `bcmr` to publish a registry in the genesis itself, at output 1. For a token that implements `name()`,
`symbol()` and `decimals()`, the SDK reads them from the contract and refuses stated values that disagree.

A `BchNative` token's bearer form is a CashTokens category of its own, which the token takes as its constructor
argument. `nativeToken.funding` names a token-free coin at vout 0 whose txid becomes that category, so the genesis
creates it beside the contract's and both share the identity output; `nativeToken.reserve` premints it into the
contract's token container, `nativeToken.bearer` (`{ amount, to }`) mints a supply to a token-aware address for a token
whose ledger starts empty, and `nativeToken.scale` states a `BchNativeMultiplier` scale. The SDK refuses a contract
constructed with another category:

```ts
const tokenCoin = /* a token-free coin of yours at vout 0 */;
const token = await factory.deploy(hexToBin(tokenCoin.txid), {
  identity: { owner: 'bitcoincash:q...' }, // omit to own it with the deployer's lock
  bcmr: { description: 'A dollar ledger.', uris: { icon: 'ipfs://...', web: 'https://example.org' } },
  nativeToken: { funding: tokenCoin, reserve: 1_000_000_000n },
});
const { bytes, uris } = token.deploymentRegistry()!; // host these exact bytes at one of the URIs
```

The registry then describes two identities: the token's category, with its name, symbol, decimals and reserve, and
the contract's, which labels the contract's NFTs.

[ERC-20 Tokens](/docs/guides/erc20-tokens) walks through the token contracts, Tether's USDT and wrapped tokens.

A `BchNativeWrapper` token wraps a category that already exists, so its deployment creates no category and mints
nothing: `nativeToken.category` names it, as 64 hex characters in the order wallets print. The SDK refuses it beside
`funding`, `reserve` or `bearer`, and refuses a contract that keys its reserve by another category or whose
`totalSupply()` does not start at 0. The registry describes the contract's category alone, with the ledger's own name,
symbol and decimals and an extension naming the wrapped category and the reserve; the wrapped category's identity is
its issuer's:

```ts
const token = await factory.deploy(hexToBin(category), {
  bcmr: { description: 'Wrapped dollars.' },
  nativeToken: { category },
});
```

The publication defaults to the registry's IPFS CID, so pin the returned bytes as one raw block. Spend the identity
later with `publishMetadata` from `@solidcash/solidcash/bcmr`, passing the owner's coin and an `action` (`update`, the default,
`transfer`, `freeze` or `burn`):

```ts
import { publishMetadata, resolveIdentity, withSnapshot } from '@solidcash/solidcash/bcmr';

const identity = await resolveIdentity(provider, categoryId); // proven back to the genesis
const { identity: next } = await publishMetadata({
  provider, identity: identity!, owner: { utxo: ownerCoin, unlocker: owner.unlockP2PKH() },
  registry: withSnapshot(registry, categoryId, { name: 'Dollar v2' }, new Date().toISOString()),
  changeAddress: owner.getAddress(),
});
```

A contract under the [framed convention](/docs/guides/framed-composition) (experimental) cannot run `new C()`, so
its children are deployed from the SDK, each as a genesis of its own with its own authhead.
[A framed proxy](/docs/guides/framed-composition#proxies) whose initializer calls another contract leads its genesis
with the proxy's authhead too. BCMR metadata for a category a contract creates inside a call (a `new C()` under
the default direct convention, which runs as a `deployFrom`, and message-bus child deployments) is unsupported: that
category's identity output is the creating transaction's output 0, the factory's own participant, so do not rely on
metadata published for it. See [CashTokens](/docs/guides/cashtokens#cashtokens-bcmr-metadata).

[bcmr]: https://cashtokens.org/docs/bcmr/chip/
