---
title: Block Data & Oracles
---

Bitcoin Script can inspect the transaction being validated, but it cannot ask a node for the current block header.
SolidCash therefore separates block-related values into three groups:

| Group | Examples | Source |
| --- | --- | --- |
| Native facts and shims | `tx.time`, `this.age`, `tx.gasprice`, `block.chainid` | Introspection, locktime checks, constants |
| Block-info oracle | `block.number`, `block.timestamp`, `block.difficulty`, `block.coinbase` | The reader's own oracle NFT, of its category |
| Blockhash oracle | `blockhash(n)` | One `(n, hash)` NFT per block, of the reader's own category |

Choose native time locks when all you need is a deadline. Use the block-info oracle when contract logic needs the
value, and `blockhash(n)` only when the actual header hash is required. Shims such as `block.prevrandao`,
`block.gaslimit` and `blobhash()` are covered in [Global Variables](../language/globals.md#block-properties).

Any `block.*` property or `blockhash(n)` makes a contract stateful: both oracles are NFTs of the contract's own
category, which only a deployed master gives it. A contract that needs no oracle and no state can use the native
time locks below.

## Prefer native time locks for deadlines

```solidity
require(tx.time >= unlockHeight);
require(this.age >= delay);
```

`tx.time` lowers to `OP_CHECKLOCKTIMEVERIFY`; `this.age` lowers to `OP_CHECKSEQUENCEVERIFY`. They provide
consensus-enforced lower bounds without a keeper or oracle trust assumption.

Locktime has height and timestamp domains and is only a lower bound. It cannot reveal the exact current height or
header time. See [Global Variables](../language/globals.md#global-time-lock-variables) for the source syntax.

## The block-info oracle

Every contract that reads one of these fields owns its block-info oracle: one mutable NFT of the contract's own
category at the lock a raw P2SH32 covenant gives that category (`blockOracleLockingBytecode(category)` in
`@solidcash/utils`). The NFT holds the whole record:

```text
ownerPkh(20) | number(5) | timestamp(5) | difficulty(5) | size(5) | totalFees(5) | coinbaseLen(1) | coinbase(<= 80)
```

Each numeric field is a `uint32` as 4 little-endian bytes plus a trailing `0x00`. The covenant bakes the category, so
its lock names the contract's oracle. The owner is the public-key hash at the front of the commitment. Only the
contract's own transactions spend its oracle, so unrelated contracts never contend for it; the contract's own
transactions that read or update it conflict, so build them in sequence.

| Property | Type | Value |
| --- | --- | --- |
| `block.number` | `uint32` | Height the owner last wrote, at most the chain tip when written |
| `block.timestamp` | `uint32` | Time the owner last wrote, below the median time past then (about an hour behind) |
| `block.difficulty` | `uint32` | Raw compact `nBits`, not a randomness source |
| `block.size` | `uint32` | Serialized block bytes |
| `block.totalFees` | `uint32` | Coinbase outputs minus the block subsidy, in satoshis |
| `block.coinbase` | `address` | Locking bytecode of coinbase output 0 |
| `block.basefee` | `uint32` | Derived: `Floor(1000 * totalFees / size)` satoshis per kB; `block.blobbasefee` aliases it |

### Reading block fields

A reader just uses the property:

```solidity
contract TimeVault(pubkey owner, uint64 unlockTime) {
    function withdraw(sig ownerSig) {
        require(block.timestamp >= unlockTime, "still locked");
        require(checkSig(ownerSig, owner));
    }
}
```

The compiler makes the contract stateful and adds no state variable and no update function. Each function that
reads one of these fields, or calls a function that does, gets a hidden `__internal__blockOracleInputIndex`
parameter, a `blockInfoOracle` block-layout slot and `usesBlockOracle` in its ABI entry. The generated code reads
that input, requires its locking bytecode to equal the contract's own oracle lock and slices the field out of its
commitment. The artifact publishes `usesBlockOracle` and `blockOracleLockSlots`, the offsets of a 35-byte lock
placeholder that the SDK overwrites with the contract's own oracle lock once its category is known.

Every function of a reader, `split`, `merge` and `unsafe(1)` and above included, refuses an output at that lock
unless it recreates the input at its index unchanged. The master holds the category's minting NFT, so without that
check any call could mint a look-alike oracle with forged fields.

The SDK spends the oracle on its read path, which recreates it unchanged, with at least its value, at the same
output index, and fills the index on every call path: `StatefulContract` calls,
[framed entries](/docs/guides/framed-composition) and [framed proxies](/docs/guides/framed-composition#proxies)
(experimental), delegate calls, and [message-bus routes](/docs/guides/message-bus) (experimental). Readers of one
contract in a composed transaction share its oracle input; each other reading contract co-spends its own. A call
that cannot forward the index is refused at compile time with `BlockOracleIndexNotForwardedError`: read `block.*`
in the caller as well, or pass the value in as an argument.

### Deploy a reader

`StatefulContract.deploy` mints the oracle in the reader's genesis, after its records, naming the key that updates
it:

```ts
import { SignatureTemplate } from '@solidcash/solidcash';
import { StatefulContract } from '@solidcash/solidcash/stateful';

const vault = await StatefulContract.deploy(timeVaultArtifact, [ownerPublicKey, unlockTime], {
  provider, fundingUtxo, funder: new SignatureTemplate(deployerPrivateKey).unlockP2PKH(), changeAddress,
  blockOracleOwnerPublicKey: keeperPublicKey,
});
```

On a live network `blockOracleOwnerPublicKey` is required, and the oracle starts at zero until the keeper's first
update. `MockNetworkProvider` and a `solidhat node` devnet name their own key when it is omitted, start the oracle
at their current height and time, and keep it current. `blockOracleAmount` sets the oracle's satoshis (default: the
data NFT amount). The owner hash cannot change after genesis: replacing the owner key means a native upgrade or a
new deployment.

### Owner updates

Only the owner updates the oracle, by spending the covenant with `<pubkey> <sig> <newCommitment> 1`. The covenant
requires `hash160(pubkey)` to equal the owner hash already in the commitment, the new commitment to keep that hash,
a valid signature, and the output at the same index to carry the new commitment at the same lock and category,
with at least the oracle's value. Because nLockTime is either a height or a time, one update anchors one field to
the chain and keeps the other:

- **Height update** (nLockTime below 500,000,000): `number` stays below 500,000,000, does not rewind, and
  `tx.time >= number` is checked with CLTV. `timestamp` is unchanged.
- **Timestamp update** (time-type nLockTime): `timestamp` does not rewind and `tx.time >= timestamp` is checked with
  CLTV. A time locktime is final only below the median time past, so `timestamp` is at most MTP - 1. `number` is
  unchanged.

The other fields are the owner's word. Equal values are admitted.

:::caution
The owner is trusted not to under-report or lie about any field. The covenant stops a claimed height above the tip,
a timestamp at or above the median time past, and rewinds, but Script cannot prove a value is recent: if the keeper
stops, readers see the last write, and a deadline written against `block.timestamp` stays open until the owner
updates. The compiler warns on `block.number` and `block.timestamp` for this reason. Where a stale value would
benefit the spender, use a native `tx.time` floor.
:::

### Run the keeper

`BlockOracleUpdater` keeps one reader's oracle current, signing with the owner key. Configure it with the reader
(for a stateful deployment, its `.inner`) and the reader's category; run one updater per reader:

```ts
import { BlockOracleUpdater, createRpcClient } from '@solidcash/solidcash/oracle';

const rpc = createRpcClient('mainnet', {
  url: process.env.BCH_RPC_URL,
  rpcUser: process.env.BCH_RPC_USER,
  rpcPassword: process.env.BCH_RPC_PASSWORD,
});
const updater = new BlockOracleUpdater({
  contract: vault.contract.inner,
  categoryId: vault.categoryId,
  keeperKey: keeperPrivateKey,
  rpc,
});

await updater.syncOnce();
```

`syncOnce()` reads the tip with BCHN JSON-RPC (`getblockcount`, `getblockhash`, `getblock(hash, 2)`). When the chain
is ahead of `number` it pushes a height update with the tip height as nLockTime. Then, when the last final second,
`min(header time, mediantime - 1)`, is ahead of `timestamp`, it pushes a timestamp update with that second as
nLockTime. It returns the last update txid, or `null` when the oracle was current. `pushUpdate(fields, locktime)`
sends one update directly.

`start()` performs an initial sync, subscribes to Fulcrum `blockchain.headers.subscribe` on `electrumHost`, and syncs
on every new tip. It returns a `stop()` function. Notification-time errors are logged, so supervise the process and
alert on persistent failures. Without `url`, `createRpcClient('mainnet')` uses a public BCHN endpoint; production
keepers should use a node they operate or explicitly trust.

:::note
Every spend of the oracle, read or update, must recreate it with at least its value, so no reader can drain it.
`pushUpdate` pays its 2,000-satoshi fee from the largest token-free coin at the keeper key's P2PKH address and sends
the change back there. Fund that address before the first update.
:::

### Testing on the mock network

A reader deployed on `MockNetworkProvider` without `blockOracleOwnerPublicKey` names `provider.blockOracleOwnerKey`.
The mock keeps every oracle that names that key: it writes its own height and time into each whenever it mines, so
`mine()` and `time.increase()` move `block.number` and `block.timestamp`, and it gives that key's P2PKH a coin for
update fees. `provider.setBlockOracleFields(fields, categoryId)` writes exact fields into one reader's oracle (every
kept oracle without `categoryId`); they hold until the mock next mines. Once an owner update replaces a commitment,
the mock stops writing its clock into that oracle and the owner's values stand.

To exercise the keeper, seed older fields and sync against the mock chain:

```ts
import { hexToBin } from '@bitauth/libauth';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';
import { BlockOracleUpdater } from '@solidcash/solidcash/oracle';
import { StatefulContract } from '@solidcash/solidcash/stateful';
import { mockBlockOracleRpc } from '@solidcash/testing';

const provider = new MockNetworkProvider();
const vault = await StatefulContract.deploy(timeVaultArtifact, [ownerPublicKey, unlockTime], {
  provider, fundingUtxo, funder, changeAddress,
});
provider.setBlockOracleFields({
  number: 100n, timestamp: 1n, difficulty: 0n, size: 1n, totalFees: 0n,
  coinbase: hexToBin(`76a914${'00'.repeat(20)}88ac`),
}, vault.categoryId);

const updater = new BlockOracleUpdater({
  contract: vault.contract.inner,
  categoryId: vault.categoryId,
  keeperKey: provider.blockOracleOwnerKey,
  rpc: mockBlockOracleRpc(provider),
});

await updater.syncOnce(); // a height update to the mock tip, then a timestamp update
```

## `blockhash(n)`

Each queried height needs its own authenticated value, so `blockhash(n)` reads a separate oracle: one
capability-none NFT per block, all at one lock per category (`blockhashOracleLockingBytecode(category)`), with the
commitment

```text
n (4 bytes, little-endian) || 32-byte block hash
```

The NFTs carry the reading contract's own category, so `blockhash` makes the contract stateful and the artifact sets
`usesBlockhash`. The reader checks that the co-spent NFT's category is its master's, that `commitment.n == n`, and
`tx.time >= n`, then returns the hash. Each distinct `n` in a function rides its own input slot, and a computed `n`
such as `block.number - 1` is resolved from the SDK's probe of the covenant itself.

Calls go through `StatefulContract`, which finds the pair, co-spends it read-only and sets the locktime; the base
`Contract`/`TransactionBuilder` path throws. A missing pair is an error, not `bytes32(0)`: returning zero when a
builder omits the NFT would make absence forgeable. A contract that wants the EVM's "too old means zero" branch checks
`block.number - n` against the window itself. Once `tx.time >= n + 256`, anyone may wipe a pair, which keeps the set
bounded even if the keeper stalls.

### Keeper baton

The keeper mints pairs from a minting NFT of the contract's category held at the keeper baton covenant,
`blockhashKeeperBatonLockingBytecode(category, keeperPublicKey)`. A baton spend needs the keeper's signature,
recreates the baton at output 0 and mints exactly one pair at the category's blockhash lock under `tx.time >= n`, so
the baton cannot stand in for the contract's master. The genesis that creates the contract's category must also
mint this baton. Pass `blockhashKeeperPublicKey` to `StatefulContract.deploy` to mint it at the confined covenant;
`blockhashKeeperAmount` sets its initial balance (default 10,000 satoshis). Both direct and framed genesis support
this option. It requires an artifact that reads `blockhash`; omitting it preserves existing deployment behavior.

```ts
import { StatefulContract } from '@solidcash/solidcash/stateful';

const { contract: consumer } = await StatefulContract.deploy(consumerArtifact, [], {
  provider, fundingUtxo, funder, changeAddress,
  blockhashKeeperPublicKey: keeperPublicKey,
  blockhashKeeperAmount: 1_000_000n,
});
```

Each pair currently spends 1,000 satoshis plus a 1,000-satoshi fee from that balance. Replenish the baton before
its balance runs out; the keeper key is supplied only to the updater, never to deployment.

```ts
const keeper = new BlockOracleUpdater({
  contract: consumer.inner,
  categoryId: consumer.categoryId,
  keeperKey: keeperPrivateKey,
  rpc,
  blockhashOracleCategory: consumer.categoryId,
});

await keeper.mintBlockhashPair(height, hash);
await keeper.sweepBlockhashPair(height - 256n);
```

`syncOnce()` mints the tip's pair and sweeps the pairs that left the 256-block window when the artifact uses
`blockhash`. A sweep reclaims every aged pair (up to 100) to the keeper's P2PKH in one transaction, paying 1 sat/byte
out of the reclaimed satoshis; a batch that cannot leave an output above dust waits for a later sweep. The keeper
finds the baton at its covenant on every mint; `blockhashOracleMaster` overrides the baton UTXO and unlocker, and
then the caller tracks the recreated baton itself. Each mint spends 2,000 satoshis of the baton's value (1,000 on
the pair and a 1,000 fee), so fund it accordingly.

## Operational checklist

1. Prefer `tx.time`/`this.age` when an exact block field is unnecessary.
2. Record each reader's oracle owner, RPC trust source, update cadence, and monitoring policy with the deployment.
3. Keep the owner key safe for the oracle's life: rotating it takes a native upgrade or a new deployment.
4. Alert when the oracle height lags the node tip, when the keeper's P2PKH runs low, or when a blockhash pair is
   missing.
5. Treat `block.difficulty` and `block.prevrandao` as non-random; the builder picks `n` for `blockhash(n)`.
6. Exercise stale, rewound, over-reported, wrong-owner, missing-pair and 256-block cleanup cases in tests.
