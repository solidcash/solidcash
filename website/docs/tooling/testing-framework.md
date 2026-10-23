---
title: Testing Framework
---

`@solidcash/testing` is the test-runtime layer beneath SolidHat. It provides a Hardhat-shaped runtime environment,
pre-funded BCH signers, artifact factories, an in-process network, fixtures and time helpers, chai-compatible
assertions, a task runner, a `solidcash` CLI, and a Vitest preset for porting Hardhat suites.

For new projects, start with [SolidHat](./solidhat.md). Use `@solidcash/testing` directly when you need a custom
runner/configuration or want to embed the harness in other tooling. SolidHat re-exports this runtime, so
[SolidHat Runtime](/docs/sdk/solidhat) is the full reference for `hre`, `ethers`, fixtures, matchers and `upgrades`.

## Install and configure directly

```sh
npm install --save-dev @solidcash/testing vitest
```

```ts title="solidcash.config.ts"
import { defineConfig } from '@solidcash/testing/config';

export default defineConfig({
  paths: {
    contracts: 'contracts',
    tests: 'test',
    artifacts: 'artifacts',
  },
  networks: { mock: { type: 'mock' } },
  defaultNetwork: 'mock',
});
```

The configuration format is the one SolidHat uses; see [Configuration](/docs/tooling/solidhat#configuration). The
compile cache defaults to `~/.cache/solidcash`. Compile trusts its entries as compiled output, so a `paths.cache`
inside the project is used only with `trustProjectCache: true`.

Config discovery skips a `solidcash.config.*`, `package.json` or `.git` that another user owns, or that sits in a
world-writable directory without the sticky bit, and warns. A container running as root over a checkout mounted from
another uid can trust it with `SOLIDCASH_TRUST_CONFIG_OWNER=1`.

For a Hardhat-style port, apply the preset:

```ts title="vitest.config.ts"
import { defineConfig } from 'vitest/config';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';

export default defineConfig(solidcashHardhatPreset({
  test: { include: ['test/**/*.test.ts'] },
}));
```

The preset loads `solidcash.config.ts`, enables Vitest globals, registers SolidCash and chai-style matchers, and
aliases supported Hardhat/Ethers imports to the BCH runtime. It also adapts common top-level CommonJS
`require('hardhat')` forms used by older suites. Unlike SolidHat's preset, it always maps `ethers` to the Ethers 6
surface, and maps `ethers/lib/utils` to the Ethers 5 utilities.

For a normal SolidCash test which does not need Hardhat import aliases, add `import '@solidcash/solidcash/vitest'` to the
setup file and enable Vitest globals; see [Test Matchers](/docs/sdk/test-matchers#setup). The SDK publishes a Vitest
extension; there is no separate `@solidcash/solidcash/jest` package export.

## Entry points

| Import | Provides |
| --- | --- |
| `@solidcash/testing` | `hre` (also the default export), `ethers`, `network`, `config`, `run`, `upgrades`, the task registry, the config helpers, the network helpers, the Ethers utilities, and block-oracle helpers (`mockBlockOracleRpc`, `BlockOracleUpdater`, `fetchBlockOracleFields`) |
| `@solidcash/testing/config` | `defineConfig`, `solidcashConfigSchema`, `resolveConfig`, `loadConfig`, `findConfigFile`, `findHardhatConfigFile`, `migrateHardhatConfig` |
| `@solidcash/testing/hre` | `initHre`, `createHardhatRuntimeEnvironment`, `getActiveHre`, `createProvider`, `loadArtifactByName` and the runtime types |
| `@solidcash/testing/network-helpers` | `loadFixture`, `takeSnapshot`, `clearSnapshots`, `mine`, `mineUpTo`, `time`, `duration`, `setBalance`, `impersonateAccount`, `getImpersonatedSigner` |
| `@solidcash/testing/chai` | the chai shim: `expect`, `assert` and the default `chai` export |
| `@solidcash/testing/tasks` | `task`, `subtask`, `runTask`, `getTask`, `getTasks`, `parseTaskArgs` |
| `@solidcash/testing/ethers` | Ethers 5 style utilities; the same module as `@solidcash/solidhat/ethers5` |
| `@solidcash/testing/ethers-shim` | the Ethers 6 API with BCH overrides; the same module as `@solidcash/solidhat/ethers6` |
| `@solidcash/testing/vitest-preset` | `solidcashHardhatPreset(config?)` and `hardhatAliases()` |
| `@solidcash/testing/vitest-setup` | the setup file the preset adds |

## Runtime environment

```ts
import hre, { ethers, network, run } from '@solidcash/testing';

const [owner, alice] = await ethers.getSigners();
const Counter = ethers.getContractFactory('Counter', owner);
const counter = await Counter.deploy();
await counter.waitForDeployment();
```

The main entry point exposes:

- `hre.config`, `hre.network`, `hre.ethers`, `hre.networkHelpers`, and `hre.run()`;
- `ethers.getSigners()`, `getSigner()`, `getContractFactory()`, `getContractAt()`, and `deployContract()`;
- BCH-native classes on `ethers`: `Contract`, `ContractFactory`, `Signer`, `Wallet`, `HDSigner` and `HDNodeWallet`;
- `upgrades` for proxy deployment and upgrades; and
- common ethers utilities and compatibility values.

The runtime is created from `solidcash.config.ts` by `initHre()`, which the CLI and the Vitest setup file call.
Without it, the exports fall back to a mock network with default settings.

The mock network funds deterministic HD signers from the configured mnemonic. On regtest, `getSigners()` funds them
from the BCHN node's wallet. Electrum and Bitcoin RPC providers do not manufacture funds; arrange UTXOs and
credentials appropriate to that network.

Factories accept an artifact object, split-artifact bundle, short contract name, or fully qualified
`source.scash:Contract` name. Short-name ambiguity is an error. Contract names resolve beneath
`artifacts/solidcash`, leaving any EVM artifact tree untouched.

## Fixtures and snapshots

```ts
import { loadFixture, takeSnapshot } from '@solidcash/testing/network-helpers';

async function deployFixture() {
  const [owner] = await ethers.getSigners();
  const token = await ethers.deployContract('Token', [], owner);
  return { owner, token };
}

it('restores the chain', async () => {
  const { token } = await loadFixture(deployFixture);
  // The same named function reference is executed once, then restored.
});
```

`loadFixture` requires a named function because the function identity is its cache key. A later call restores the
provider snapshot and returns the cached object graph. `clearSnapshots()` drops the fixture cache, while
`takeSnapshot()` returns an independently reusable `SnapshotRestorer`.

## Mining and time travel

```ts
import { mine, mineUpTo, time, duration } from '@solidcash/testing/network-helpers';

await mine(3);
await mineUpTo(900_000);
await time.increase(duration.days(7));
await time.setNextBlockTimestamp(new Date('2027-01-01T00:00:00Z'));
```

`time.increase()` and `time.increaseTo()` advance time and mine a block. `time.setNextBlockTimestamp()` changes
only the next block timestamp. These operations affect the mock chain, or the BCHN node on regtest. Electrum and
Bitcoin RPC networks do not support them.

Contracts read Solidity-style `block.number` and `block.timestamp` from one shared block-oracle covenant. The mock
chain writes its own height and time into that oracle whenever it mines, so these helpers move `block.*` as
Hardhat's do, with no keeper. To drive a keeper against the mock chain, see
[Block Data & Oracles](../guides/block-oracles.md#testing-on-the-mock-network).

## Balance helpers and BCH differences

`setBalance(address, amount)` adds a new BCH UTXO on the active provider. It is additive; it cannot reduce an
address to an exact account balance because BCH has no account balance slot.

`impersonateAccount()` and `getImpersonatedSigner()` deliberately throw. There is no BCH equivalent of asking a
local node to sign as an arbitrary account. Use a real test key, `getSigners()`, or `SignatureTemplate`.

The compatibility layer also cannot reproduce EVM frame behavior where an internal call returns `success=false`
and execution continues. A failed BCH covenant invalidates the whole transaction.

## Assertions

For native Vitest style, import the SDK extension and pass the unsent call or `TransactionBuilder`:

```ts
import '@solidcash/solidcash/vitest';

await expect(contract.call.withdraw(amount))
  .toBeRevertedWith(/insufficient balance/i);

await expect(contract.call.transfer(to, 10n))
  .toEmit(contract, 'Transfer', { to, amount: 10n });
```

Do not pass the result of `.send()`: `toEmit` sends a stateful call itself, and on a receipt it fails. The native
matchers include require/revert failures, typed event assertions, and debug `console.log` output. See
[Test Matchers](../sdk/test-matchers.md) for the complete native examples.

For an unmodified Hardhat/chai style:

```ts
import { expect } from '@solidcash/testing/chai';

await expect(contract.transfer(to, 10n))
  .to.emit(contract, 'Transfer')
  .withArgs(ownerAddress, to, 10n);

await expect(contract.adminCall()).to.be.revertedWith('Unauthorized');
await expect(() => contract.pay()).to.changeBchBalance(recipient, 1_000n);
```

The shim supports common equality/numeric/deep assertions, `reverted`, `revertedWith`, `revertedWithCustomError`
(arguments are checked only when the failure carries them), `emit(...).withArgs(...)`, promise rejection
assertions, BCH-balance changes, and CashToken balance changes. Byte arrays, CashAddresses, bigints, and ethers
BigNumber-compatible values are normalized for the ported comparison forms. See
[Chai matchers](/docs/sdk/solidhat#chai-matchers) for the details.

## Custom tasks and CLI

```ts title="solidcash.config.ts"
import { defineConfig } from '@solidcash/testing/config';
import { task } from '@solidcash/testing/tasks';

task('accounts', 'Print test addresses')
  .addFlag('quiet')
  .setAction(async ({ quiet }, hre) => {
    const signers = await hre.ethers.getSigners();
    if (!quiet) signers.forEach((signer) => console.log(signer.getAddress()));
  });

export default defineConfig({ defaultNetwork: 'mock' });
```

Declare tasks in `solidcash.config.ts`: the CLI loads the config before it looks up a task, so
`npx solidcash accounts --quiet` (or `npx solidhat accounts --quiet`) runs it. The task builder supports required
and optional named parameters (`addParam`, `addOptionalParam`), flags (`addFlag`), positional parameters
(`addPositionalParam`), and a variadic final positional parameter (`addVariadicPositionalParam`). Values from the
command line arrive as strings and flags as booleans. `hre.run(name, args)` invokes a task programmatically.

The package's compatibility CLI binary is named `solidcash`:

```sh
npx solidcash compile
npx solidcash test
npx solidcash run scripts/deploy.ts --network mock
npx solidcash clean
```

It runs the same built-in tasks as `solidhat`: `compile`, `test`, `deploy`, `run`, `typegen`, `doctor`, `clean`,
`init --from-hardhat` and `node`; [Commands](/docs/tooling/solidhat#commands) lists their flags.
`npx solidcash help` lists them with any tasks your config declares. `--network <name>` selects a configured
network. Unlike `solidhat test`, `solidcash test` does not compile first, so run `npx solidcash compile` before it.

`solidcash compile <sources...>` recompiles only the named sources and keeps the rest of the last complete build.
After a compiler change it rebuilds everything instead, unless you add `--iteration`, which compiles only the named
sources and marks the artifact tree stale until the next full compile.

New applications should prefer the `solidhat` command, which exposes the same runtime through the clearer
project-tooling package boundary.

## Safe test limits

The mock provider intentionally relaxes size limits for large compatibility suites: 1,000,000-byte input scripts,
stack items and NFT commitments, 10,000,000-byte transactions, relaxed hash iterations, and no dust rule. Only the
operation-cost density is real. That is useful for behavioral testing but is not evidence that an artifact or
transaction is valid under current BCH consensus and policy. Before release, give the mock production limits,
compile with real commitment and input limits, and run the relevant flows on BCHN regtest; see
[Test under real limits](/docs/tooling/solidhat#test-under-real-limits).
