---
title: Block Data & Oracles
---

Bitcoin Script can inspect the transaction being validated, but it cannot ask a node for the current block header.
SolidCash therefore separates block-related values into three groups:

| Group | Examples | Source |
| --- | --- | --- |
| Native transaction facts/floors | `tx.time`, `this.age`, `tx.gasprice` | Transaction introspection and locktime/sequence checks |
| Per-contract block registers | `block.number`, `block.timestamp`, `block.difficulty`, `block.coinbase` | Owner-updated state fields injected by the compiler |
| Windowed block hashes | `blockhash(n)` | A category-branded `(n, hash)` NFT which is co-spent read-only |

Choose native timelocks when all you need is a deadline. Use block registers when contract logic needs the value,
and use `blockhash(n)` only when the actual header hash is required.

## Prefer native time locks for deadlines

```solidity
require(tx.time >= unlockHeight);
require(this.age >= delay);
```

`tx.time` lowers to `OP_CHECKLOCKTIMEVERIFY`; `this.age` lowers to `OP_CHECKSEQUENCEVERIFY`. They provide
consensus-enforced lower bounds without a keeper or oracle trust assumption.

Locktime has height and timestamp domains and is only a lower bound. It cannot reveal the exact current height or
header time. See [Global Variables](../language/globals.md#global-time-lock-variables) for the source syntax.

## Per-contract `block.*` registers

Referencing a non-native block property makes the contract stateful and injects only the fields it uses, plus an
immutable oracle-owner key and an owner-authorized `__updateBlockOracle` entry point.

```solidity
contract TimeVault(uint64 unlockTime) {
    function withdraw() public {
        require(block.timestamp >= unlockTime, "still locked");
    }
}
```

The values live in the contract's own data NFT registers. Normal calls read them like other state, so there is no
shared global oracle UTXO. The updater is independently authorized to refresh those fields. It cannot alter
application state through the update route.

The available register values are:

- `block.number`: header height;
- `block.timestamp`: header `nTime` in Unix seconds;
- `block.difficulty`: raw compact `nBits`, not a randomness source;
- `block.coinbase`: locking bytecode of coinbase output 0;
- `block.size`: serialized block bytes;
- `block.totalFees`: realized transaction fees in satoshis; and
- `block.basefee`: `floor(1000 * totalFees / size)` satoshis per kB.

`block.chainid` is a `uint256` whose value is the low byte of the numeric compiler option (`chainId & 0xff`), so
it is compact on the Script stack and needs no updater. `block.prevrandao`, `gasleft()`,
`block.gaslimit`, `blobhash()`, and other compatibility shims have the limitations documented in
[Global Variables](../language/globals.md#block-properties).

:::caution
The updater owner is trusted not to under-report or lie about fields which cannot be verified from the spending
transaction. A locktime freshness floor prevents claiming a future height, but Script cannot prove that a stored
value is recent. A stale value remains possible if the keeper stops.
:::

### Deploy the register owner

Seed the compiler-injected owner and register values at deployment. The exact register set depends on which
properties the artifact uses:

```ts
import { ContractFactory } from 'solidcash';

const [keeper] = await ethers.getSigners();
const factory = new ContractFactory(timeVaultArtifact, keeper);

const vault = await factory.deploy(unlockTime, {
  initialState: {
    __block_timestamp: 0n,
    __blockOracleOwner: keeper.publicKey,
  },
});
```

Constructor inference can populate ordinary state, but injected oracle fields should be explicit in deployment
configuration so the keeper identity is auditable.

### Run one synchronization

```ts
import {
  BlockOracleUpdater,
  createRpcClient,
} from 'solidcash';

const updater = new BlockOracleUpdater({
  contract: vault.inner,
  categoryId: vault.categoryId,
  keeperKey: keeper.privateKey,
  rpc: createRpcClient('mainnet', {
    url: process.env.BCH_RPC_URL,
    rpcUser: process.env.BCH_RPC_USER,
    rpcPassword: process.env.BCH_RPC_PASSWORD,
  }),
});

await updater.syncOnce();
```

`syncOnce()` reads the node tip. If the on-chain block register is behind, it fetches the full block with BCHN
JSON-RPC, computes the requested fields, signs the synthesized update, sets the transaction locktime to the claimed
height, and broadcasts it. It returns the block-info update txid or `null` when no update was needed.

The updater's RPC client must support `getblockcount`, `getblockhash`, and `getblock(hash, 2)`. Avoid treating the
public default RPC endpoint as an availability guarantee; production applications should operate or explicitly
trust their configured data source.

### Subscribe as a keeper

```ts
const subscribed = new BlockOracleUpdater({
  contract: vault.inner,
  categoryId: vault.categoryId,
  keeperKey: keeper.privateKey,
  rpc,
  electrumHost: 'fulcrum.example.org',
});

const stop = await subscribed.start();
// Later:
await stop();
```

`start()` performs an initial sync, subscribes to Fulcrum `blockchain.headers.subscribe`, and attempts another sync
on each new tip. Notification-time errors are logged; supervise the process and alert on persistent failures.

### Testing time-dependent contracts

Mock-network time travel changes the harness tip, not the on-chain register. Bridge it and call the updater:

```ts
import {
  BlockOracleUpdater,
  mockBlockOracleRpc,
  network,
  time,
} from '@solidcash/testing';

const updater = new BlockOracleUpdater({
  contract: vault.inner,
  categoryId: vault.categoryId,
  keeperKey: keeper.privateKey,
  rpc: mockBlockOracleRpc(network.provider),
});

await time.increase(3600);
await updater.syncOnce();
```

## `blockhash(n)` result NFTs

`blockhash(n)` cannot use the scalar block register because each queried height needs its own authenticated value.
The compiler marks `artifact.usesBlockhash` and emits a `blockhashOracle` slot. The SDK resolves the address for
`n`, co-spends its NFT, recreates it byte-for-byte at the same index, supplies the hidden input index, and sets the
required locktime automatically.

The oracle NFT commitment binds:

```text
height n || 32-byte block hash
```

Its locking covenant is branded to the consuming contract's CashToken category. The read path verifies the category, height,
commitment, address, and self-preserving output. A wipe path becomes available at `n + 256`, letting anyone remove
an aged-out pair while a keeper can reclaim its dust.

Unlike the EVM, an unpublished or unavailable in-window pair is an error, not `bytes32(0)`. Returning zero when a
builder omits the NFT would make absence forgeable.

### Provision and maintain the blockhash category

The keeper needs a separately spendable minting NFT with the **same category as the consuming contract**.
Provisioning that extra baton is an advanced genesis responsibility; it is distinct from the contract's state
master and must use an unlocker controlled by the keeper. Pass both to the updater:

```ts
const updater = new BlockOracleUpdater({
  contract: consumer.inner,
  categoryId: consumer.categoryId,
  keeperKey: keeper.privateKey,
  rpc,
  blockhashOracleCategory: consumer.categoryId,
  blockhashOracleMaster: {
    utxo: oracleMintingUtxo,
    unlocker: oracleMintingUnlocker,
  },
});

await updater.mintBlockhashPair(height, hash);
await updater.sweepBlockhashPair(height - 256n);
```

`syncOnce()` calls these maintenance operations when the artifact uses `blockhash`. The mint method recreates the
minting baton at output 0 and creates the immutable pair NFT. The current updater configuration stores the supplied
baton outpoint; after every successful mint, a long-running keeper must replace it with the recreated
`{ txid: mintTxid, vout: 0, ... }` UTXO (or construct the next updater from provider discovery). It is not mutated
inside the caller-owned config automatically. Each mint also spends 1,000 satoshis on the pair and 1,000 on its
fixed fee, so provision and replenish keeper funding deliberately.

Because of that baton rotation requirement, `start()` is directly turnkey for scalar block-register updates. A
`blockhash` keeper should wrap tip notifications in its own baton-tracking loop until its operational storage has
recorded the recreated outpoint.

For manual transaction composition, `resolveBlockhashCoSpend(provider, oracleCategory, n)` returns the UTXO,
unlocker, matching recreate output, and locktime. Normal `StatefulContract` calls should rely on artifact-driven
automatic injection.

## Operational checklist

1. Prefer `tx.time`/`this.age` when an exact block field is unnecessary.
2. Record the oracle owner, RPC trust source, update cadence, and monitoring policy with the deployment.
3. Give the keeper enough BCH UTXOs for update fees without sharing application authority keys.
4. Alert when the register height lags the node tip or a blockhash pair is missing.
5. Treat `block.difficulty` and `block.prevrandao` as non-random.
6. Exercise stale, future-height, wrong-owner, missing-pair, and 256-block cleanup cases in tests.
