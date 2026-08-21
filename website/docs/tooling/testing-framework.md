---
title: Testing Framework
---

`@solidcash/testing` is the test-runtime layer beneath SolidHat. It provides a Hardhat-shaped runtime environment,
pre-funded BCH signers, artifact factories, an in-process network, fixtures and time helpers, chai-compatible
assertions, a task runner, and a Vitest preset for porting Hardhat suites.

For new projects, start with [SolidHat](./solidhat.md). Use `@solidcash/testing` directly when you need a custom
runner/configuration or want to embed the harness in other tooling.

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
    cache: 'cache',
  },
  networks: { mock: { type: 'mock' } },
  defaultNetwork: 'mock',
});
```

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
`require('hardhat')` forms used by older suites.

For a normal SolidCash test which does not need Hardhat import aliases, add `import 'solidcash/vitest'` to the
setup file. The SDK publishes a Vitest extension; there is no separate `solidcash/jest` package export.

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
- BCH-native `Contract`, `ContractFactory`, `Signer`, `HDSigner`, and `Wallet` classes;
- `upgrades` for proxy deployment and upgrades; and
- common ethers utilities and compatibility values.

The mock network funds deterministic HD signers from the configured mnemonic. A real Electrum, RPC, or regtest
provider does not manufacture funds; arrange UTXOs and credentials appropriate to that network.

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

`time.increase()` and `time.increaseTo()` advance time and mine a block. `setNextBlockTimestamp()` changes only
the next block timestamp. These operations affect the mock chain.

Contracts read Solidity-style `block.number` and `block.timestamp` through a deployed block-oracle side-car. Time
travel alone does not update that contract. Bridge and synchronize it explicitly:

```ts
import {
  mockBlockOracleRpc,
  BlockOracleUpdater,
} from '@solidcash/testing';

const rpc = mockBlockOracleRpc(network.provider);
const updater = new BlockOracleUpdater({
  rpc,
  contract: blockOracle.inner,
  categoryId: blockOracle.categoryId,
  keeperKey: owner.privateKey,
});

await time.increase(60);
await updater.syncOnce();
```

See [Global Variables](../language/globals.md#block-properties) for the contract-side oracle model.

## Balance helpers and BCH differences

`setBalance(address, amount)` adds a new BCH UTXO on the mock provider. It is additive; it cannot reduce an
address to an exact account balance because BCH has no account balance slot.

`impersonateAccount()` and `getImpersonatedSigner()` deliberately throw. There is no BCH equivalent of asking a
local node to sign as an arbitrary account. Use a real test key, `getSigners()`, or `SignatureTemplate`.

The compatibility layer also cannot reproduce EVM frame behavior where an internal call returns `success=false`
and execution continues. A failed BCH covenant invalidates the whole transaction.

## Assertions

For native Vitest style, import the SDK extension:

```ts
import 'solidcash/vitest';

await expect(contract.call.withdraw(amount).send())
  .toBeRevertedWith(/insufficient balance/i);

const result = await contract.call.transfer(to, 10n).send();
await expect(result).toEmit(contract, 'Transfer', { to, amount: 10n });
```

The native matchers include require/revert failures, typed event assertions, and debug `console.log` output. See
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

The shim supports common equality/numeric/deep assertions, `reverted`, `revertedWith`, best-effort custom-error
matching, `emit(...).withArgs(...)`, promise rejection assertions, BCH-balance changes, and CashToken balance
changes. Byte arrays, CashAddresses, bigints, and ethers BigNumber-compatible values are normalized for the
ported comparison forms.

## Custom tasks and CLI

```ts
import { task } from '@solidcash/testing/tasks';

task('accounts', 'Print test addresses')
  .addFlag('quiet')
  .setAction(async ({ quiet }, hre) => {
    const signers = await hre.ethers.getSigners();
    if (!quiet) signers.forEach((signer) => console.log(signer.getAddress()));
  });
```

The task builder supports required/optional named parameters, flags, positional parameters, and a variadic final
positional parameter. `hre.run(name, args)` invokes a task programmatically.

The package's compatibility CLI binary is named `solidcash`:

```sh
npx solidcash compile
npx solidcash test
npx solidcash run scripts/deploy.ts --network mock
npx solidcash clean
```

New applications should prefer the `solidhat` command, which exposes the same runtime through the clearer
project-tooling package boundary.

## Safe test limits

The mock provider intentionally supports relaxed consensus limits for large compatibility suites. That is useful
for behavioral testing but is not evidence that an artifact or transaction is valid under current BCH consensus
and policy. Before release, compile with real commitment/input limits and run the relevant SDK preflight or regtest
suite.
