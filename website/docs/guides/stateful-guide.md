---
title: Building Stateful Contracts
---

This guide walks through building a complete ERC20-like token contract with SolidCash, from design to deployment to testing. By the end, you'll understand how stateful contracts work, how state is stored, and how the SDK manages everything automatically.

## What Are Stateful Contracts?

A contract without state only validates the transaction which spends it. A stateful SolidCash contract additionally
stores **persistent state** that survives across transactions.

### How State Works on Bitcoin Cash

Bitcoin Cash doesn't have EVM-style storage slots. Instead, SolidCash uses **CashToken NFTs** to store state:

- Each contract gets a **master NFT** (minting capability) that identifies it
- **Data NFTs** store state variable values in their commitments (128 bytes each)
- **Entry NFTs** form verified mappings (vmaps), proving both present and absent keys
- **Chunk NFTs** store dynamic strings, bytes, arrays, and large vmap values
- **Event NFTs** record emitted events in the live UTXO set and become cleanup-spendable after 144 blocks

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
}
```

Key design decisions:
- **`pubkey admin`** - constructor parameter for access control
- **`totalSupply`** - data NFT state variable
- **`balances`** - verified mapping backed by authenticated, linked entry NFTs and omission proofs
- **`Transfer`** event - persistent on-chain event log
- **`onlyAdmin`** modifier - reusable auth check
- **`migrate`** - upgrade modifier for future versioning

## Step 2: Compile

```bash
npx solidc SimpleToken.scash
```

This produces `SimpleToken.json` and optionally `SimpleToken.artifact.ts` (with `-A` flag) containing the bytecode, ABI, state layout, and debug information.

## Step 3: Deploy

```typescript title="deploy.ts"
import {
    ContractFactory,
    ElectrumNetworkProvider,
    SignatureTemplate,
    Signer,
} from 'solidcash';
import artifact from './SimpleToken.json' assert { type: 'json' };

const provider = new ElectrumNetworkProvider('chipnet');
const adminKey = hexToUint8Array('...'); // your private key
const signer = new Signer(adminKey, provider);
const adminPub = signer.publicKey;

const factory = new ContractFactory(artifact, signer);
const contract = await factory.deploy(adminPub, {
    addressType: 'p2sh32',
});
const categoryId = contract.categoryId;
const tx = contract.deploymentTransaction();

console.log('Deployed!');
console.log('Category ID:', categoryId);
console.log('Transaction:', tx.txid);
console.log('Contract address:', contract.address);
```

:::caution
Stateful genesis requires a plain **vout 0** input because its transaction ID becomes the CashToken category. A
signer-backed factory selects one, or creates a fan-out transaction and then selects its output zero. Use the
[exact-input deployment API](/docs/guides/deployment#exact-input-deployment) when a wallet supplies the exact
funding outpoint and unlocker.
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
const events = await contract.queryFilter('Transfer');

for (const evt of events) {
    console.log(
        `${evt.args.from} -> ${evt.args.to}: ${evt.args.amount}`
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

    modifier onlyAdmin(sig s) {
        require(checkSig(s, admin));
        _;
    }

    function mint(bytes20 to, int amount, sig s) onlyAdmin(s) {
        require(!this.paused, "Contract paused");
        // ... same as before
    }

    function pause(sig s) onlyAdmin(s) {
        this.paused = true;
    }

    function migrate(sig s) upgrade onlyAdmin(s) { }
    // ... retain the other V1 entry points
}
```

```typescript
import v2Artifact from './SimpleTokenV2.json' assert { type: 'json' };

const [upgradeFunding] = await signer.getUtxos();

const { contract: upgraded } = await StatefulContract.upgrade({
    provider,
    oldContract: contract,
    upgradeFunctionName: 'migrate',
    upgradeFunctionArgs: [adminSig],
    newArtifact: v2Artifact,
    newConstructorArgs: [adminPub],
    fundingUtxo: upgradeFunding,
    funder: signer.unlockP2PKH(),
    changeAddress: signer.address,
});
```

The category ID is preserved while the physical contract address changes. Existing state (`totalSupply`,
`balances`) carries over and the appended `paused` field defaults to `false`. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies).

## Step 7: Test

```typescript title="SimpleToken.test.ts"
import { describe, it, expect, beforeAll } from 'vitest';
import 'solidcash/vitest';
import {
    ContractFactory,
    MockNetworkProvider,
    SignatureTemplate,
} from 'solidcash';
import artifact from './SimpleToken.json' assert { type: 'json' };

describe('SimpleToken', () => {
    const provider = new MockNetworkProvider();
    let admin;
    let adminSig;
    let sc: any;

    beforeAll(async () => {
        [admin] = await provider.getSigners(1, { fundingUtxos: 5 });
        adminSig = new SignatureTemplate(admin.privateKey);
        sc = await new ContractFactory(artifact, admin).deploy(admin.publicKey);
    });

    it('should have initial supply', async () => {
        const supply = await sc.state.totalSupply();
        expect(supply).toBe(1_000_000n);
    });

    it('should mint tokens', async () => {
        const result = await sc.call.mint(bobPkh, 1000n, adminSig).send();
        expect(result.txid).toBeDefined();
    });

    it('should emit Transfer on mint', async () => {
        const result = await sc.call.mint(carolPkh, 500n, adminSig).send();
        await expect(result).toEmit(sc, 'Transfer', {
            to: carolPkh,
            amount: 500n,
        });
    });

    it('should fail transfer with insufficient balance', async () => {
        await expect(
            sc.call.transfer(emptyPkh, bobPkh, 999999n, adminSig).send()
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
3. **Index durable audit history** - event NFTs are easy to query while unspent, but anyone may clean them up after
   144 blocks. Persist them in an application index if history must outlive the current UTXO set.
4. **Implement access control** - always gate sensitive operations with `checkSig` or similar checks.
5. **Plan for upgrades** - include an `upgrade` modifier function from the start so you can evolve the contract.
6. **Use the `unsafe` modifier sparingly** - it allows raw transaction introspection but relaxes covenant safety checks.
7. **Test with MockNetworkProvider** - fast, deterministic, no network dependency.

For the underlying model, see [State Storage & Data Encoding](/docs/language/storage-model),
[Verified Mappings](/docs/language/verified-mappings), and [Events & Errors](/docs/language/events-errors).
