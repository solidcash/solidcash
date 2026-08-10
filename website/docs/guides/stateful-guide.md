---
title: Building Stateful Contracts
---

This guide walks through building a complete ERC20-like token contract with SolidCash, from design to deployment to testing. By the end, you'll understand how stateful contracts work, how state is stored, and how the SDK manages everything automatically.

## What Are Stateful Contracts?

In standard SolidCash (and original CashScript), contracts are **stateless** - they can only check conditions on a transaction. Stateful contracts go further: they store **persistent state** that survives across transactions.

### How State Works on Bitcoin Cash

Bitcoin Cash doesn't have EVM-style storage slots. Instead, SolidCash uses **CashToken NFTs** to store state:

- Each contract gets a **master NFT** (minting capability) that identifies it
- **Data NFTs** store state variable values in their commitments (128 bytes each)
- **Entry NFTs** form verified mappings (vmaps), proving both present and absent keys
- **Event NFTs** record emitted events permanently

Every state-modifying transaction consumes these NFTs as inputs and produces updated versions as outputs. The contract bytecode verifies that the output commitments match the expected new state - this is the covenant.

## Step 1: Design the Contract

```solidity title="SimpleToken.scash"
pragma solidcash >=0.8.0;

event Transfer(bytes20 indexed from, bytes20 indexed to, int amount);

contract SimpleToken(pubkey admin) {
    int public totalSupply;
    mapping(bytes20 => int) public balances;

    constructor() {
        this.totalSupply = 1_000_000;
    }

    modifier onlyAdmin(sig s) {
        require(checkSig(s, admin));
        _;
    }

    function mint(bytes20 to, int amount, sig s) onlyAdmin(s) {
        this.balances[to] = this.balances[to] + amount;
        this.totalSupply = this.totalSupply + amount;
        emit Transfer(bytes20(0), to, amount);
    }

    function transfer(bytes20 from, bytes20 to, int amount, sig s) {
        require(checkSig(s, admin));
        require(this.balances[from] >= amount, "Insufficient balance");

        this.balances[from] = this.balances[from] - amount;
        this.balances[to] = this.balances[to] + amount;
        emit Transfer(from, to, amount);
    }

    function migrate(sig s) upgrade onlyAdmin(s) { }
    function destroy(sig s) selfdestruct onlyAdmin(s) { }
    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
```

Key design decisions:
- **`pubkey admin`** - constructor parameter for access control
- **`totalSupply`** - data NFT state variable
- **`balances`** - verified mapping backed by authenticated, linked entry NFTs
- **`Transfer`** event - persistent on-chain event log
- **`onlyAdmin`** modifier - reusable auth check
- **`migrate`** - upgrade modifier for future versioning
- **`authorize`** - unsafe function for administrative transactions

## Step 2: Compile

```bash
npx solidc SimpleToken.scash
```

This produces `SimpleToken.json` and optionally `SimpleToken.artifact.ts` (with `-A` flag) containing the bytecode, ABI, state layout, and debug information.

## Step 3: Deploy

```typescript title="deploy.ts"
import { StatefulContract, ElectrumNetworkProvider, SignatureTemplate } from 'solidcash';
import artifact from './SimpleToken.json' assert { type: 'json' };

const provider = new ElectrumNetworkProvider('chipnet');
const adminKey = hexToUint8Array('...'); // your private key
const admin = new SignatureTemplate(adminKey);
const adminPub = admin.getPublicKey();

// Get a funding UTXO (must be at vout 0!)
const utxos = await provider.getUtxos(adminAddress);
const fundingUtxo = utxos.find(u => u.vout === 0);

const { contract, categoryId, tx } = await StatefulContract.deploy({
    artifact,
    constructorArgs: [adminPub],
    provider,
    fundingUtxo,
    funder: admin.unlockP2PKH(),
    changeAddress: adminAddress,
    initialState: { totalSupply: 1_000_000n },
    addressType: 'p2sh32',
});

console.log('Deployed!');
console.log('Category ID:', categoryId);
console.log('Transaction:', tx.txid);
console.log('Contract address:', contract.address);
```

:::caution
The funding UTXO must be at **vout 0** because its transaction ID becomes the CashToken category ID for the contract.
:::

## Step 4: Interact

### Mint Tokens

```typescript
const adminSig = new SignatureTemplate(adminKey);

await contract.call.mint(
    bobPkh,           // recipient
    1000n,            // amount
    adminSig,         // admin signature
).send();

console.log('Minted 1000 tokens to Bob');
```

### Transfer Tokens

```typescript
await contract.call.transfer(
    bobPkh,           // from
    carolPkh,         // to
    500n,             // amount
    adminSig,         // admin signature
).send();
```

### Read State

```typescript
const totalSupply = await contract.state.totalSupply();
console.log('Total supply:', totalSupply);

const allState = await contract.getState();
console.log('All state:', allState);
```

## Step 5: Read Events

```typescript
import { readEventsFromChain, getEventNftAddress } from 'solidcash';

const transferDef = artifact.abi.find(e => e.name === 'Transfer');
const eventAddr = getEventNftAddress(contract.inner, categoryId, 'Transfer');

const events = await readEventsFromChain(
    provider, eventAddr, categoryId, transferDef
);

for (const evt of events) {
    console.log(
        `${evt.values.from} -> ${evt.values.to}: ${evt.values.amount}`
    );
}
```

## Step 6: Upgrade

When you need to add features, create a V2 contract with the new state layout:

```solidity title="SimpleTokenV2.scash"
contract SimpleTokenV2(pubkey admin) {
    int public totalSupply;
    mapping(bytes20 => int) public balances;
    bool public paused;                  // NEW field

    function mint(bytes20 to, int amount, sig s) onlyAdmin(s) {
        require(!this.paused, "Contract paused");
        // ... same as before
    }

    function pause(sig s) onlyAdmin(s) {
        this.paused = true;
    }

    // ... rest of functions
}
```

```typescript
import v2Artifact from './SimpleTokenV2.json' assert { type: 'json' };

const { contract: upgraded } = await StatefulContract.upgrade({
    provider,
    oldContract: contract,
    upgradeFunctionName: 'migrate',
    upgradeFunctionArgs: [adminSig],
    newArtifact: v2Artifact,
    newConstructorArgs: [adminPub],
});
```

The category ID is preserved. Existing state (`totalSupply`, `balances`) carries over. The new `paused` field defaults to `false`.

## Step 7: Test

```typescript title="SimpleToken.test.ts"
import { describe, it, expect, beforeAll } from 'vitest';
import 'solidcash/vitest';
import {
    StatefulContract,
    MockNetworkProvider,
    SignatureTemplate,
    randomUtxo,
} from 'solidcash';
import artifact from './SimpleToken.json' assert { type: 'json' };

describe('SimpleToken', () => {
    const provider = new MockNetworkProvider();
    const adminKey = new Uint8Array(32).fill(1);
    const admin = new SignatureTemplate(adminKey);
    const adminPub = admin.getPublicKey();
    let sc: any;

    beforeAll(async () => {
        const { contract } = await StatefulContract.deploy({
            artifact,
            constructorArgs: [adminPub],
            provider,
            fundingUtxo: randomUtxo(),
            funder: admin.unlockP2PKH(),
            changeAddress: 'bchtest:qq...',
            initialState: { totalSupply: 1_000_000n },
        });
        sc = contract;
    });

    it('should have initial supply', async () => {
        const supply = await sc.state.totalSupply();
        expect(supply).toBe(1_000_000n);
    });

    it('should mint tokens', async () => {
        const result = await sc.call.mint(bobPkh, 1000n, admin).send();
        expect(result.txid).toBeDefined();
    });

    it('should emit Transfer on mint', async () => {
        const result = await sc.call.mint(carolPkh, 500n, admin).send();
        await expect(result).toEmit(sc, 'Transfer', {
            to: carolPkh,
            amount: 500n,
        });
    });

    it('should fail transfer with insufficient balance', async () => {
        await expect(
            sc.call.transfer(emptyPkh, bobPkh, 999999n, admin).send()
        ).toFailRequireWith(/Insufficient balance/);
    });
});
```

## Architecture Summary

```
+----------------------------------------------+
|              Transaction                      |
|                                               |
|  INPUTS:                    OUTPUTS:          |
|  +-----------------+       +----------------+|
|  | Master NFT      |------>| Master NFT     ||
|  | (minting cap)   |       | (preserved)    ||
|  +-----------------+       +----------------+|
|  +-----------------+       +----------------+|
|  | Data NFT #0     |------>| Data NFT #0    ||
|  | old commitment  |       | new commitment ||
|  +-----------------+       +----------------+|
|  +-----------------+       +----------------+|
|  | Entry NFT (key) |------>| Entry NFT (key)||
|  | old value       |       | new value      ||
|  +-----------------+       +----------------+|
|                             +----------------+|
|                             | Event NFT      ||
|                             | Transfer(...)  ||
|                             +----------------+|
|  +-----------------+       +----------------+|
|  | Funding UTXO    |       | Change output  ||
|  +-----------------+       +----------------+|
+----------------------------------------------+
```

## Best Practices

1. **Always use `p2sh32`** - the only address type supported for stateful contracts.
2. **Keep state minimal** - each data NFT holds 128 bytes. Large state requires multiple NFTs and increases transaction size.
3. **Use events for audit logs** - events are persistent NFTs, cheaper than state variables for write-once data.
4. **Implement access control** - always gate sensitive operations with `checkSig` or similar checks.
5. **Plan for upgrades** - include an `upgrade` modifier function from the start so you can evolve the contract.
6. **Use the `unsafe` modifier sparingly** - it allows raw transaction introspection but relaxes covenant safety checks.
7. **Test with MockNetworkProvider** - fast, deterministic, no network dependency.
