---
title: Test Matchers
---

SolidCash extends Vitest with custom matchers for testing contract behavior: require failures, event emissions, reverts, and console output.

## Setup

Add the import to your test setup file:

```typescript title="vitest.setup.ts"
import '@solidcash/solidcash/vitest';
```

In your Vitest config, enable globals and reference the setup file:

```typescript title="vitest.config.ts"
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
    },
});
```

The extension registers its matchers on Vitest's global `expect`, so `globals: true` is required. The SolidHat and
`@solidcash/testing` Vitest presets enable globals and register these matchers for you.

## What to pass

The matchers take the transaction before it is sent:

- a `TransactionBuilder` with its inputs and outputs added, or
- for the matchers that accept it (see the table), a stateful call such as `sc.call.withdraw(1n)`, without
  `.send()`.

Never pass the result of `.send()`. A receipt carries nothing the matchers can evaluate: `toEmit` fails with
"Failed to build transaction", and `toFailRequire()` passes without testing anything.

| Matcher | Accepts | How it evaluates |
| --- | --- | --- |
| `toFailRequire()`, `toFailRequireWith(reason)` | `TransactionBuilder` | Local debug evaluation, synchronous |
| `toLog(value?)` | `TransactionBuilder` | Local debug evaluation, synchronous |
| `toBeRevertedWith(reason)`, `toRevert()`, `toRevertWith(reason)` | builder or stateful call | Local debug evaluation; a call is built first |
| `toBeReverted()` | builder or stateful call | Debugs a builder; sends a call |
| `toEmit(contract, event, args?)` | builder or stateful call | Builds a builder without broadcasting; sends a call |

## Require Failure Matchers

Test that a transaction fails with a specific `require` message:

```typescript
const transaction = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.transfer(badArgs))
    .addOutput({ to: contract.address, amount: 10_000n });

expect(transaction).toFailRequireWith(/Insufficient balance/);
```

Test that a transaction fails any `require` (no message check), or that it passes:

```typescript
expect(transaction).toFailRequire();
expect(validTransaction).not.toFailRequire();
```

These matchers run the builder's debug evaluation and never broadcast, so one builder can be checked several
times. They accept only a `TransactionBuilder`; for a stateful call, use the revert matchers below.

## Revert Matchers

Solidity-style matchers that also accept stateful calls:

```typescript
await expect(sc.call.withdraw(1n)).toBeReverted();
await expect(sc.call.withdraw(1n)).toBeRevertedWith(/Unauthorized/);

// Alternative naming
await expect(transaction).toRevert();
await expect(transaction).toRevertWith(/error message/);
```

Both string and RegExp patterns are accepted; a string matches as a substring of the failure message. These
matchers are asynchronous, so `await` them.

`toBeReverted()` passes only when the contract or the VM rejects the transaction. A funding, auto-derivation or
other construction failure is rethrown, so a broken test setup does not count as a revert. `toRevert()` passes on
any failure.

## Event Emission Matcher

Test that a transaction includes a specific event:

```typescript
// Check event name only
await expect(sc.call.transfer(to, amount)).toEmit(sc, 'Transfer');

// Check event name + parameters
await expect(sc.call.transfer(to, amount)).toEmit(sc, 'Transfer', {
    from: alicePkh,
    to: bobPkh,
    amount: 100n,
});
```

`toEmit` decodes the event NFTs in the transaction's outputs. A stateful call is sent, so the contract's state
changes, and one call object is one transaction: create a new call for each assertion. A `TransactionBuilder` is
built without broadcasting. Use `.not.toEmit(...)` to assert that an event is absent.

### Predicate Matchers

Use functions to test parameter values:

```typescript
await expect(sc.call.transfer(to, amount)).toEmit(sc, 'Transfer', {
    amount: (v: bigint) => v > 50n,
    to: (v: Uint8Array) => v.length === 20,
});
```

### Type Safety

The `toEmit` matcher is fully type-safe when using TypeScript artifact types. Event names auto-complete, and parameter types are inferred from the artifact.

## Console Log Matcher

Test `console.log` output (for debugging contracts):

```typescript
const transaction = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.debug(42n))
    .addOutput({ to: contract.address, amount: 10_000n });

expect(transaction).toLog('Count: 42');
expect(transaction).toLog(/Count: \d+/);
```

`toLog` runs the builder's debug evaluation and checks the contract's `console.log` output, even when the
transaction fails. Without an argument it passes when anything was logged. For a stateful call, pass its unsent
builder: `expect(await sc.call.debug(42n).build()).toLog('Count: 42')`.

## Complete Test Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import '@solidcash/solidcash/vitest';
import { SignatureTemplate } from '@solidcash/solidcash';
import { ContractFactory } from '@solidcash/solidcash/contract-factory';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';
import artifact from './Counter.artifact.js';

describe('Counter', () => {
    const provider = new MockNetworkProvider();
    let alice: any;
    let bob: any;
    let sc: any;

    beforeAll(async () => {
        [alice, bob] = await provider.getSigners(2, { fundingUtxos: 5 });
        sc = await new ContractFactory(artifact, alice).deploy(alice.publicKey, {
            initialState: { counter: 0n },
        });
    });

    it('should increment counter', async () => {
        const result = await sc.call.increment(
            alice.publicKey,
            new SignatureTemplate(alice.privateKey),
        ).send();
        expect(result.txid).toBeDefined();

        const counter = await sc.state.counter();
        expect(counter).toBe(1n);
    });

    it('should emit event on transfer', async () => {
        await expect(sc.call.transfer(bob.pkh, 100n)).toEmit(sc, 'Transfer', {
            to: bob.pkh,
            amount: 100n,
        });
    });

    it('should fail on unauthorized access', async () => {
        await expect(
            sc.call.adminOnly(
                bob.publicKey,
                new SignatureTemplate(bob.privateKey),
            ),
        ).toBeRevertedWith(/Unauthorized/);
    });
});
```

## MockNetworkProvider

For unit tests, use `MockNetworkProvider` to simulate the network:

```typescript
import { randomUtxo } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';

const provider = new MockNetworkProvider();

// Add UTXOs to test addresses
const utxo = await provider.addUtxo(contractAddress, randomUtxo({ satoshis: 100_000n }));

// Mock block height
provider.setBlockHeight(800_000);
```

`addUtxo` is asynchronous and resolves to the stored UTXO. The default mock relaxes size limits for test
harnesses; pass `consensusLimits` and `policy` to the constructor to test production limits, as shown in
[Test under real limits](/docs/tooling/solidhat#test-under-real-limits).

## Testing Utilities

```typescript
import { randomUtxo, randomToken, randomNFT } from '@solidcash/solidcash';

const utxo = randomUtxo({ satoshis: 50_000n });  // random txid and vout, 50,000 sats
const token = randomToken();                      // random category and fungible amount
const nft = randomNFT({                           // NFT with a specific commitment
    nft: { commitment: 'aabbccdd', capability: 'none' },
});
const tokenUtxo = randomUtxo({ token: nft });     // UTXO carrying that NFT
```

Each helper takes an optional partial object whose fields replace the random defaults.
