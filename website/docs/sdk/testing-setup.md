---
title: Testing Setup
---

For the ease of development, SolidCash has a `MockNetwork` environment where you can create virtual UTXOs. This has the advantages of not needing any testnet balances, not having to set up smart contract UTXOs and not having network latency. Because of this the MockNetwork environment is the ideal setup to run repeated automated tests with a testing framework for increased smart contract security.

For a complete project workflow, including whole-project compilation, funded signers, named networks, and
deployment scripts, see [SolidHat Projects](/docs/tooling/solidhat). For Hardhat/Ethers-compatible imports,
fixtures, and chai matchers, see [SolidHat Runtime](/docs/sdk/solidhat). This page focuses on using the lower-level
SDK testing primitives directly.

:::tip
For a quick start, create a project with `npm create @solidcash/solidhat@latest`. It includes a sample contract,
a test, and a Vitest configuration.
:::

## MockNetworkProvider

The `MockNetworkProvider` is a special network provider that allows you to evaluate transactions locally without interacting with the Bitcoin Cash network. This is useful when writing automated tests for your contracts, or when debugging your contract locally.

To create a new virtual UTXO use `await provider.addUtxo(address, utxo)`. It is asynchronous and resolves to the
stored UTXO. You can use the helper functions `randomUtxo()`, `randomToken()` and `randomNFT()` to generate random partial Utxo info which can be overwritten with custom values.

#### Example

```ts
import { randomUtxo, randomToken, randomNFT } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';

const provider = new MockNetworkProvider();
const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10_000n }));

const aliceUtxo = await provider.addUtxo(aliceAddress, randomUtxo({
  satoshis: 1000n,
  token: { ...randomNFT(), ...randomToken() },
}));
```

A UTXO can also be given in full: `{ txid, vout, satoshis }` plus an optional `token`.

:::note
By default, the `MockNetworkProvider` evaluates transactions locally and updates the in-memory UTXO set after a transaction is sent. This means spent UTXOs are consumed and new UTXOs are created when mocking a transaction `send` using the provider. This can be disabled by setting the `updateUtxoSet` option to `false`.
:::

:::caution Mock limits are relaxed
The default mock relaxes size limits (1,000,000-byte input scripts, stack items and NFT commitments,
10,000,000-byte transactions, relaxed hash iterations, no dust rule); only the operation-cost density is real. A
passing mock test does not prove that a transaction is valid on mainnet. Pass production values to the constructor
with `consensusLimits` and `policy`, as shown in [Test under real limits](/docs/tooling/solidhat#test-under-real-limits).
:::

## Automated testing

To make automated tests easier, the SDK provides a Vitest extension for `console.log`, `require`, revert, and event assertions:

```ts
import '@solidcash/solidcash/vitest';
```

The extension needs Vitest's `globals: true`; see [Test Matchers](/docs/sdk/test-matchers#setup) for the setup and
every matcher. For whole-project compilation, fixtures, pre-funded signers, time travel, and Hardhat/Ethers
compatibility, use [SolidHat](/docs/tooling/solidhat) and the [Testing Framework](/docs/tooling/testing-framework).

:::note
If you're using a different testing framework, you can test for `console.log` values by spying on the console output, and test for `require` error messages by asserting that an error is thrown with a specific error message.
:::

With local transaction evaluation and debugging, it is possible to write efficient automated tests for SolidCash contracts to test specific contract behaviour and check `console.log` values and `require` error messages.

### Logging values

You can log values during debug evaluation using the `console.log` statement. Any variables or primitive values (such as ints, strings, bytes, ...) can be logged.

:::note
Logging is only available in debug evaluation of a transaction. It has no impact on the compiled bytecode or regular (non-debug) execution.
:::

```ts
describe('Example contract', () => {
  it('should log the passed parameter', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [], { provider });
    const contractUtxo = await provider.addUtxo(contract.address, randomUtxo());

    const transaction = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.exampleFunction(1000n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(transaction).toLog('passed parameter: 1000');
  });
});
```

### Error messages

The `require` statement accepts an optional error message as a second argument. If the condition in the require statement is not met during debug evaluation, the error message is returned. This allows you to write automated tests that check for specific error messages.

:::note
Similar to `console.log`, the error message in a `require` statement is only available in debug evaluation of a transaction, so the error message has no impact on the compiled bytecode or regular (non-debug) execution.
:::

```ts
describe('Example contract', () => {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  let contractUtxo: Utxo;

  beforeAll(async () => {
    contractUtxo = await provider.addUtxo(contract.address, randomUtxo());
  });

  it('should fail require statement when incorrect parameter is passed', async () => {
    const transaction = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.exampleFunction(999n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(transaction).toFailRequireWith('passed parameter is not 1000');
  });

  it('should pass require statement when correct parameter is passed', async () => {
    const transaction = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.exampleFunction(1000n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(transaction).not.toFailRequire();
  });
});
```

These matchers only evaluate the transaction, so the same contract UTXO can be reused across tests.

## Full Example

```solidity title="Example contract"
contract Example() {
  function exampleFunction(int value) {
    console.log("passed parameter:", value);
    require(value == 1000, "passed parameter is not 1000");
  }
}
```

```ts title="Example test file"
import artifact from '../artifacts/example.artifact.js';
import { Contract, TransactionBuilder, randomUtxo, type Utxo } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';
import '@solidcash/solidcash/vitest';

describe('Example contract', () => {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  let contractUtxo: Utxo;

  beforeAll(async () => {
    contractUtxo = await provider.addUtxo(contract.address, randomUtxo());
  });

  it('should log the passed parameter', async () => {
    const transaction = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.exampleFunction(1000n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(transaction).toLog('passed parameter: 1000');
  });

  it('should fail require statement when incorrect parameter is passed', async () => {
    const transaction = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.exampleFunction(999n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(transaction).toFailRequireWith('passed parameter is not 1000');
  });

  it('should pass require statement when correct parameter is passed', async () => {
    const transaction = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.exampleFunction(1000n))
      .addOutput({ to: contract.address, amount: 10000n });
    expect(transaction).not.toFailRequire();
  });
});
```

The test file uses Vitest globals (`describe`, `it`, `beforeAll`, `expect`), which the matchers require anyway.
