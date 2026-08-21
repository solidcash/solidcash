---
title: Test Matchers
---

SolidCash extends Vitest with custom matchers for testing contract behavior: require failures, event emissions, reverts, and console output.

## Setup

Add the import to your test setup file:

```typescript title="vitest.setup.ts"
import 'solidcash/vitest';
```

In your Vitest config, reference the setup file:

```typescript title="vitest.config.ts"
export default defineConfig({
    test: {
        setupFiles: ['./vitest.setup.ts'],
    },
});
```

## Require Failure Matchers

Test that a transaction fails with a specific `require` message:

```typescript
await expect(contract.call.transfer(badArgs).send())
    .toFailRequireWith(/Insufficient balance/);
```

Test that a transaction fails any `require` (no message check):

```typescript
await expect(contract.call.transfer(badArgs).send())
    .toFailRequire();
```

## Revert Matchers

Solidity-style aliases for the same behavior:

```typescript
await expect(tx.send()).toBeReverted();
await expect(tx.send()).toBeRevertedWith(/Unauthorized/);

// Alternative naming
await expect(tx.send()).toRevert();
await expect(tx.send()).toRevertWith(/error message/);
```

Both string and RegExp patterns are accepted.

## Event Emission Matcher

Test that a transaction result includes a specific event:

```typescript
const result = await contract.call.transfer(to, amount).send();

// Check event name only
await expect(result).toEmit(contract, 'Transfer');

// Check event name + parameters
await expect(result).toEmit(contract, 'Transfer', {
    from: alicePkh,
    to: bobPkh,
    amount: 100n,
});
```

### Predicate Matchers

Use functions to test parameter values:

```typescript
await expect(result).toEmit(contract, 'Transfer', {
    amount: (v: bigint) => v > 50n,
    to: (v: Uint8Array) => v.length === 20,
});
```

### Type Safety

The `toEmit` matcher is fully type-safe when using TypeScript artifact types. Event names auto-complete, and parameter types are inferred from the artifact.

## Console Log Matcher

Test `console.log` output (for debugging contracts):

```typescript
await expect(contract.call.debug(42).send())
    .toLog("Count: 42");

await expect(contract.call.debug(42).send())
    .toLog(/Count: \d+/);
```

## Complete Test Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import 'solidcash/vitest';
import {
    ContractFactory,
    MockNetworkProvider,
    SignatureTemplate,
} from 'solidcash';
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
        const result = await sc.call.transfer(bob.pkh, 100n).send();
        await expect(result).toEmit(sc, 'Transfer', {
            to: bob.pkh,
            amount: 100n,
        });
    });

    it('should fail on unauthorized access', async () => {
        await expect(
            sc.call.adminOnly(
                bob.publicKey,
                new SignatureTemplate(bob.privateKey),
            ).send()
        ).toBeRevertedWith(/Unauthorized/);
    });
});
```

## MockNetworkProvider

For unit tests, use `MockNetworkProvider` to simulate the network:

```typescript
const provider = new MockNetworkProvider();

// Add UTXOs to test addresses
const utxo = randomUtxo({ satoshis: 100_000n });
provider.addUtxo(contractAddress, utxo);

// Mock block height
provider.setBlockHeight(800_000);
```

## Testing Utilities

```typescript
import { randomUtxo, randomToken, randomNFT } from 'solidcash';

const utxo = randomUtxo(50_000n);       // random UTXO with 50k sats
const token = randomToken();              // random 32-byte category
const nft = randomNFT('aabbccdd');        // NFT with specific commitment
```
