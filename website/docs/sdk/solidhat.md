---
title: SolidHat Runtime
sidebar_label: SolidHat Runtime
description: The Hardhat and Ethers compatibility runtime for SolidCash tests and scripts - hre, ethers, contract factories, fixtures, network helpers, chai matchers, upgrades and the SolidHat entry points.
---

SolidHat's runtime gives tests and scripts the objects a Hardhat project expects: the Hardhat Runtime Environment
(`hre`), an `ethers` object with signers and contract factories, fixtures and network helpers, chai matchers, and
OpenZeppelin-style `upgrades`. Everything is backed by the SolidCash SDK and runs against the network your SolidHat
configuration selects.

This page is the runtime reference. To create a project, configure networks and accounts, and run the `solidhat`
commands, see [SolidHat Projects](/docs/tooling/solidhat). The same runtime ships in `@solidcash/testing` for
projects without SolidHat; see [Testing Framework](/docs/tooling/testing-framework).

:::info SolidHat is not an EVM
SolidHat preserves familiar project ergonomics, not EVM semantics. Contracts compile to Bitcoin Script,
transactions spend UTXOs, stateful contracts use CashToken NFTs, addresses are CashAddresses, and there is no gas,
account nonce, or mutable global EVM state.
:::

## Entry points

| Import | Provides |
| --- | --- |
| `@solidcash/solidhat/hardhat2`, `@solidcash/solidhat/hardhat3` | `hre` (also the default export), `ethers`, `network`, `config`, `run` and `upgrades` |
| `@solidcash/solidhat/ethers5` | Ethers 5 style utilities: the `utils` and `constants` namespaces, `BigNumber`, `AddressZero`, and the Ethers 6 functions |
| `@solidcash/solidhat/ethers6` | The Ethers 6 API with a CashAddress-aware `getAddress` and `Contract`, BCH `getCreateAddress` and `getCreate2Address`, and the SolidCash ABI coder |
| `@solidcash/solidhat/config` | `defineConfig`, `solidcashConfigSchema` and the configuration types |
| `@solidcash/solidhat/vitest-preset` | `solidhatPreset(target, config?, options?)` and `compatibilityAliases(target)` |
| `@solidcash/solidhat/offline-setup` | A Vitest setup file for hermetic suites, with `offlineRuntime()` and `assertNoNetworkViolations()` |
| `@solidcash/solidhat/offline-network` | `installOfflineNetwork(options?)`: a `fetch` guard that fails every request no in-process service answers |
| `@solidcash/solidhat/offline-ipfs` | `createInMemoryIpfs(options?)`: an in-memory IPFS upload service and gateway |
| `@solidcash/solidhat/offline-rpc` | `installOfflineRpcShims` and `seedOfflineRpcCode`: answers for EVM JSON-RPC calls such as `eth_getCode` |
| `@solidcash/solidhat/mock-contracts` | `installMockContracts` and `MockContractModel`: TypeScript models in place of compiled contracts |
| `@solidcash/solidhat/ported-script` | `runPortedScript(path, options?)`: runs a Hardhat-era deployment script in the test process |
| `@solidcash/solidhat/project-fixture` | `stageProjectFixture(options)`: links a ported project's sources and tests into a fixture directory |
| `@solidcash/solidhat/cashaddr` | `encodeP2pkhCashAddress(hash160, prefix?)`: the P2PKH CashAddress of a 20-byte hash |
| `@solidcash/solidhat`, `@solidcash/solidhat/init` | `initializeProject(options)` and the project detection helpers; see [Programmatic initialization](/docs/tooling/solidhat#programmatic-initialization) |

`@solidcash/solidhat/cli` and `@solidcash/solidhat/cli-options` implement the `solidhat` command and are not meant
to be imported.

The generated Vitest config aliases `hardhat` to the Hardhat entry point and `ethers` to the Ethers entry point of
the target chosen when the project was created (see [Create a project](/docs/tooling/solidhat#create-a-project)),
so ported tests keep their imports:

```ts
import { ethers, network } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
```

Both Hardhat entry points export the same names. Hardhat 2 suites use `ethers` and `network` directly; Hardhat 3
suites call `await network.connect()`.

## The runtime environment

```ts
import hre, { config, ethers, network, run, upgrades } from '@solidcash/solidhat/hardhat3';
```

These exports are live views of the active runtime environment. It is created from `solidcash.config.ts` for the
selected network: `defaultNetwork` inside Vitest, or the `--network` option of `solidhat run` and
`solidhat deploy`. Without a config file it is a mock network with default settings.

- `hre.config` is the resolved configuration. The `config` export is a Hardhat-shaped view of it: every
  `config.networks.<name>.accounts`, and a `hardhat` entry, carries `mnemonic`, `path`, `count` and `initialIndex`.
- `hre.network`, the `network` export, has `name`, `provider`, `config`, `ethers` and `networkHelpers`.
  `await network.connect(name?)`, also spelled `network.create(name?)`, returns a new connection with the same
  fields, funds its signers on mock and regtest, and points the network helpers at it. The `ethers` export stays
  bound to the original network, so use the `ethers` of the returned connection.
- `hre.ethers`, the `ethers` export, is described in [Signers and contracts](#signers-and-contracts).
- `hre.networkHelpers` holds the [network helpers](#fixtures-and-network-helpers).
- `hre.run(task, args?)`, the `run` export, runs a task. `hre.tasks.getTask(name)` and `hre.tasks.getTasks()` look
  tasks up; see [custom tasks](/docs/tooling/testing-framework#custom-tasks-and-cli).

Test files, and scripts run by `solidhat run` or `solidhat deploy`, can also read the environment as
`globalThis.hre`.

## Signers and contracts

```ts
const [owner, alice] = await ethers.getSigners();
const Counter = await ethers.getContractFactory('Counter', owner);
const counter = await Counter.deploy(owner.publicKey);
await counter.waitForDeployment();

const asAlice = await ethers.getContractAt('Counter', await counter.getAddress(), alice);
const token = await ethers.deployContract('Token', [owner.publicKey], owner);
```

- `getSigners(count?, options?)` returns `count` signers (default 20) derived from the network's mnemonic, with
  the options `satoshis` and `mnemonic`. They are funded on mock and regtest, not on Electrum or Bitcoin RPC
  networks. `getSigner(index?)` returns one signer.
- A signer has `address`, `getAddress()`, `publicKey`, `privateKey`, `pkh` and `provider`.
- `getContractFactory(nameOrArtifact, signer?)` accepts a contract name, a fully qualified name such as
  `contracts/Counter.scash:Counter`, an artifact object, or a split bundle. Without a signer the factory uses the
  first signer, or the provider on Electrum and Bitcoin RPC networks. When compile produced a split bundle for the
  name, the factory deploys the split form.
- `getContractAt(nameOrArtifact, addressOrCategory, signer?)` connects to a deployed contract by its address or
  token category.
- `deployContract(nameOrArtifact, args?, signer?, overrides?)` creates the factory and deploys in one call.
- `verifyMessage(message, signature)` recovers the signer of an Ethereum-style signed message. It returns a P2PKH
  CashAddress or an EVM address, following `compiler.ecrecover` (an EVM address under `evmCompat` by default).
  `verifyMessageP2pkh` and `verifyMessageEvm` choose explicitly.
- BCH-native classes: `ethers.Contract`, `ethers.ContractFactory`, `ethers.Signer`, `ethers.Wallet`,
  `ethers.HDSigner` and `ethers.HDNodeWallet`. `ethers.Wallet.createRandom()` returns a random HD signer on the
  active network, funded on the mock.
- Utilities: the Ethers 6 functions (`parseEther`, `keccak256`, `AbiCoder`, ...) and the Ethers 5 namespaces
  (`ethers.utils`, `ethers.constants`, `ethers.BigNumber`).

`factory.deploy(...args)` runs a real genesis deployment, funded and signed by the factory's signer. A trailing
options object sets deployment options such as `initialState`. `factory.connect(signer)` and
`factory.attach(addressOrCategory)` work as in Ethers. The deployed handle:

- `await contract.waitForDeployment()` waits until the provider knows the deployment transaction.
- `await contract.getAddress()` returns the address that identifies the contract: its stable CREATE identity when
  it has one, otherwise its CashAddress.
- `contract.deploymentTransaction()` returns the transaction details, including `txid` and serialized `hex`.
- `contract.connect(otherSigner)` switches the signer for later calls.
- Functions are called as `contract.fn(args)` or `contract.call.fn(args)`, and state is read as
  `contract.stateVar()` or `contract.state.stateVar()`; see [Stateful Contracts](/docs/sdk/stateful-contracts).

## Write a Deployment Script

A deployment script receives the configured runtime through its imports. It should identify the selected network,
deploy through a signer-bound factory, wait for the genesis transaction, and persist enough data to reproduce and
verify the deployment.

```ts title="scripts/deploy.ts"
import { writeFile } from 'node:fs/promises';
import { ethers, network } from '@solidcash/solidhat/hardhat3';

const [deployer] = await ethers.getSigners(1);
console.log(`Deploying on ${network.name} from ${deployer.address}`);

const Marketplace = await ethers.getContractFactory('Marketplace', deployer);
const marketplace = await Marketplace.deploy(
  deployer.publicKey,
  1931n,
);
await marketplace.waitForDeployment();

const transaction = marketplace.deploymentTransaction();
const deployment = {
  network: network.name,
  deployer: deployer.address,
  address: await marketplace.getAddress(),
  transaction: transaction.txid,
  constructorArguments: [deployer.publicKey, '1931'],
};

await writeFile(
  `deployment.${network.name}.json`,
  `${JSON.stringify(deployment, null, 2)}\n`,
  { flag: 'wx' },
);

console.log(deployment);
```

Run it with `npx solidhat deploy --network <name>`. [Deployment scripts](/docs/tooling/solidhat#deployment-scripts)
describes the command and the promotion from mock through regtest and chipnet to mainnet.

For multi-contract systems, deploy in dependency order and pass earlier addresses or token categories to later
constructors. Keep the deployment script deterministic where possible and write a separate verification script.
See [Contract Deployment](/docs/guides/deployment) for CashToken genesis design, initial state, BCMR metadata,
concurrency outputs, and deployment verification.

## Fixtures and network helpers

```ts
import { loadFixture, mine, time } from '@nomicfoundation/hardhat-network-helpers';

async function deployFixture() {
  const [owner] = await ethers.getSigners(1);
  const counter = await ethers.deployContract('Counter', [owner.publicKey], owner);
  return { owner, counter };
}

it('starts from a fresh deployment', async () => {
  const { counter } = await loadFixture(deployFixture);
  await time.increase(time.duration.days(7));
  await mine(3);
});
```

Under the SolidHat preset this import resolves to `@solidcash/testing/network-helpers`. Without the alias, use
`hre.networkHelpers` or the `networkHelpers` of a connection.

- `loadFixture(fixture)` runs a named fixture once and snapshots the chain. Later calls with the same function
  restore the snapshot and return the same objects. The function is the cache key, so an anonymous function throws.
  `clearSnapshots()` empties the cache.
- `takeSnapshot()` returns a restorer whose `restore()` rewinds the chain. On the mock, a restore can be repeated
  and does not invalidate other snapshots.
- `mine(blocks?)` and `mineUpTo(height)` mine blocks.
- `time.latest()` and `time.latestBlock()` return the tip's timestamp and height. `time.increase(seconds)` and
  `time.increaseTo(timestamp)` move the clock and mine one block. `time.setNextBlockTimestamp(timestamp)` sets the
  next block's time without mining. Timestamps are Unix seconds or a `Date`.
- `time.duration`, also exported as `duration`, converts `seconds`, `minutes`, `hours`, `days`, `weeks` and
  `years` to seconds.
- `setBalance(address, satoshis)` adds a UTXO of that value. BCH has no account balance slot, so it cannot reduce
  an address to an exact balance.
- `impersonateAccount()` and `getImpersonatedSigner()` throw. There is no BCH equivalent of asking a node to sign as
  an arbitrary account; use `getSigners()` or a `SignatureTemplate`.

The helpers act on the active network: the in-memory mock, or BCHN on regtest, where a restore invalidates the
blocks mined since the snapshot and time uses the node's mock clock. Electrum and Bitcoin RPC networks do not
support them.

Contracts read Solidity-style `block.number` and `block.timestamp` from a shared block-oracle covenant. The mock
chain writes its height and time into that oracle whenever it mines, so these helpers move `block.*` as Hardhat's
do; see [Block Data & Oracles](/docs/guides/block-oracles#testing-on-the-mock-network).

## Chai matchers

```ts
import { expect } from 'chai'; // the BCH chai shim under the SolidHat preset

await expect(counter.increment(sig)).to.emit(counter, 'Incremented').withArgs(1n);
await expect(counter.increment(badSig)).to.be.revertedWith('not owner');
await expect(vault.withdraw(1_000n)).to.be.revertedWithCustomError(vault, 'InsufficientBalance');
await expect(() => shop.pay(sig)).to.changeBchBalance(seller, 1_000n);
await expect(() => token.transfer(alice, 10n)).to.changeTokenBalance(token, alice, 10n);
```

The shim supports common equality, numeric and deep assertions, `reverted`, `revertedWith`,
`revertedWithCustomError(...).withArgs(...)`, `emit(...).withArgs(...)`, promise `rejected` and `rejectedWith`,
`changeBchBalance(s)`, `changeTokenBalance(s)`, `properAddress`, `properHex` and `hexEqual`. Byte arrays,
CashAddresses, bigints, and BigNumber-compatible values are normalized for comparison.

- The value under test is usually a contract call, which the matcher evaluates or sends. A promise or a receipt
  also works. Balance matchers take the call itself or a function that performs the action.
- `reverted` passes only when the contract or the VM rejects the transaction. A funding, auto-derivation or other
  construction failure is rethrown, so a broken setup does not count as a revert.
- `revertedWith(reason)` matches a string as a substring of the failure message, or a RegExp.
- `revertedWithCustomError(contract, name).withArgs(...)` checks the arguments only when the failure carries the
  error's argument tuple. Otherwise `.withArgs` fails instead of passing unchecked.
- `changeBchBalance(account, delta)` compares the sum of the account's UTXO values before and after, so the delta
  includes any fee the account paid.
- `changeTokenBalance(token, account, delta)` reads `token.balanceOf(account)` when the token has that function.
  Pass a CashToken category instead to sum the account's fungible token amounts.

The native SolidCash matchers (`toBeRevertedWith`, `toEmit` and the rest) are registered as well, on Vitest's global
`expect` rather than the chai shim; see [Test Matchers](/docs/sdk/test-matchers).

## Upgrades and proxies

```ts
const Box = await ethers.getContractFactory('Box', owner);

const box = await upgrades.deployProxy(Box, [42n]); // runs initialize(42n) through the proxy
await box.store(7n);                                 // calls forward to the implementation

const seeded = await upgrades.deployProxy(Box, { value: 42n }, { initializer: false }); // state set at genesis
```

`upgrades.deployProxy(factory, initialState?, options?)` deploys the implementation and the built-in proxy, and
returns a handle whose calls forward through the proxy.

- With an initializer, `initialState` is its argument list. The default initializer is the implementation's
  `initialize` function, when it has one; `initializer: 'name'` picks another.
- With `{ initializer: false }`, or when there is no initializer, `initialState` is a state record that seeds the
  proxy's state at genesis.
- `implementationConstructorArgs` supplies the implementation's constructor arguments. `runner` selects the
  signer, by default the factory's. `proxyOverrides` and `implementationOverrides` are deploy options for the two
  genesis transactions.
- A split implementation is deployed directly, without an extra proxy. It accepts no custom proxy and no named
  initializer.

The built-in proxy pins its implementation and cannot be upgraded in place.

:::caution Experimental
Custom proxy contracts (the `proxy`, `forwardFunction` and `auth` options) and
`upgrades.upgradeProxy(proxy, newFactory, options?)` are experimental. `upgradeProxy` works only with a custom
proxy whose forwarder takes the implementation as a parameter, and only when the new implementation decodes the
proxy's existing state commitments unchanged. The options for framed deployments (`initializeAs`, `callerFunding`)
belong to the experimental framed convention.
:::

## Vitest integration

```ts title="vitest.solidhat.config.ts"
import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

export default defineConfig(solidhatPreset({ hardhat: 3, ethers: 6 }, {
  test: { include: ['test/**/*.test.{ts,js}'] },
}));
```

`solidhatPreset(target, config?, options?)` returns your Vitest config with:

- Vitest globals and the Node environment;
- a setup file that loads `solidcash.config.*` for its `defaultNetwork`, funds the mock signers, sets
  `globalThis.hre`, and registers the chai shim and the native matchers;
- Mocha conventions for unmodified Hardhat suites: `before` and `after`, a `this` context shared by hooks and
  tests, `context`, `specify`, `xdescribe` and `xit`;
- exact-match aliases that send `hardhat`, `hardhat/config`, `ethers`, `chai`, `@nomicfoundation/hardhat-ethers`,
  `@nomiclabs/hardhat-ethers`, `@nomicfoundation/hardhat-network-helpers`,
  `@nomicfoundation/hardhat-toolbox/network-helpers`, `@nomicfoundation/hardhat-chai-matchers` and
  `@openzeppelin/hardhat-upgrades` to the BCH runtime. `chai-as-promised` and `chai-subset` become no-op plugins, and
  `hardhat/types` an empty module. Exact matching leaves subpaths such as `ethers/crypto` alone.

Your own `setupFiles` run after the preset's, and your aliases are added after its aliases. `{ offline: true }` as
the third argument adds the offline setup described below. Run this config through `solidhat test`; a native
Hardhat suite can keep its original runner. If Vitest runs from a directory other than the project, set
`SOLIDCASH_PROJECT_ROOT` to the directory that holds `solidcash.config.ts`.

## Hermetic ported suites

A ported Hardhat project often calls services the EVM toolchain took for granted. With `{ offline: true }`, the
preset adds `@solidcash/solidhat/offline-setup`, which:

1. registers an in-memory IPFS upload service and gateway;
2. replaces `fetch` with a guard that fails any request no in-process service answers;
3. answers the EVM JSON-RPC calls that ported deployment scripts make, such as `eth_getCode`.

`offlineRuntime()` returns the installed services, and `assertNoNetworkViolations()` throws when the guard blocked or
recorded a real network request. `SOLIDCASH_OFFLINE_MODE=record` records violations instead of throwing,
`SOLIDCASH_OFFLINE_ALLOW` lists comma-separated URLs or `/regex/` patterns that may reach the network,
`SOLIDCASH_MOCK_IPFS_SECRET` makes the IPFS service require that upload secret, and `IPFS_UPLOAD_SERVICE_URL` and
`IPFS_GATEWAY_URL` move its endpoints.

Other helpers for ported projects:

- `runPortedScript(path, options?)` runs a Hardhat-era deployment script in the test process, with `require`,
  `__dirname` and `__filename` available and `process.exit` turned into a completion signal.
- `installMockContracts` replaces `getContractFactory`, `getContractAt` and `upgrades.deployProxy` with TypeScript
  models of the contracts, to test application logic without compiling. A contract without a model is refused.
- `stageProjectFixture(options)` links a project's contract sources, tests and other trees into a fixture
  directory (`.solidhat` by default) with relative symlinks.

## What is not emulated

SolidHat does not emulate behavior that has no safe Bitcoin Cash equivalent:

- Account impersonation: `impersonateAccount()` throws.
- Account balances: `setBalance()` adds a UTXO.
- EVM frames where an internal call returns `success=false` and execution continues. A failed BCH covenant
  invalidates the whole transaction.
- The `hardhat-deploy` plugin; see [Deployment scripts](/docs/tooling/solidhat#deployment-scripts).

Review the [Solidity parity guide](/docs/basics/solidity-parity) and
[platform differences](/docs/basics/platform-differences) when porting an EVM project.
