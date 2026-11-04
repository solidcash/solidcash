---
title: Block Data & Oracles
---

Bitcoin Script can inspect the transaction being validated, but it cannot ask a node for the current block header.
SolidCash therefore separates block-related values into three groups:

| Group | Examples | Source |
| --- | --- | --- |
| Native facts and shims | `tx.time`, `this.age`, `tx.gasprice`, `block.chainid` | Introspection, locktime checks, constants |
| Block fields | `block.number`, `block.timestamp`, `block.difficulty`, `block.coinbase` | A block-info coin of an oracle pool |
| Block hashes | `blockhash(n)` | A ring slot of an oracle pool |

Choose native time locks when all you need is a deadline. Read a block field when contract logic needs the value,
and `blockhash(n)` only when the actual header hash is required. Shims such as `block.prevrandao`,
`block.gaslimit` and `blobhash()` are covered in [Global Variables](../language/globals.md#block-properties).

## Prefer native time locks for deadlines

```solidity
require(tx.time >= unlockHeight);
require(this.age >= delay);
```

`tx.time` lowers to `OP_CHECKLOCKTIMEVERIFY`; `this.age` lowers to `OP_CHECKSEQUENCEVERIFY`. They provide
consensus-enforced lower bounds without a keeper or oracle trust assumption.

Locktime has height and timestamp domains and is only a lower bound. It cannot reveal the exact current height or
header time. See [Global Variables](../language/globals.md#global-time-lock-variables) for the source syntax.

## Oracle pools

An oracle pool is one CashToken category of mutable NFTs that publish block data for any contract to read:

- **block-info coins**, each holding the fields of one block;
- **ring slots**, each holding one block's height and hash;
- one **baton**, a minting NFT through which the pool's owner adds coins.

No contract owns oracle coins. A contract reads a pool by spending one of its coins in the same transaction. The
coin's covenant requires the output at the coin's own index to recreate it exactly, with at least its value, so a
read leaves the pool as it found it. Each kind of coin sits at its own P2SH32 covenant, pinned to the pool's
category, and holds 1,200 satoshis.

A reader checks a coin's category and kind, not its lock. That is enough because the pool's covenants keep every
NFT of the category at a pool lock, with a commitment they admitted.

A block-info coin commits to

```text
flags(1) | owner(20) | number(5) | timestamp(5) | difficulty(5) | size(5) | totalFees(5) | coinbaseLen(1) | coinbase
```

and a ring slot to

```text
flags(1) | n(4) | hash(32) | owner(20) | depth(2)
```

Numbers are little-endian. Each block field is 4 bytes and a `0x00`, and `coinbase` is at most 81 bytes. Bit 7 of
`flags` is the kind (clear for a block-info coin, set for a slot), and the low bits mark a stopped coin, so a read
accepts only `0x00` or `0x80`. `owner` is the hash160 of the owner's public key, the one key that writes, stops,
sweeps or rotates the coin.

| Property | Type | Value |
| --- | --- | --- |
| `block.number` | `uint32` | Height the keeper last wrote, at most the chain tip when written |
| `block.timestamp` | `uint32` | Time the keeper last wrote, below the median time past then (about an hour behind) |
| `block.difficulty` | `uint32` | Raw compact `nBits`, not a randomness source |
| `block.size` | `uint32` | Serialized block bytes |
| `block.totalFees` | `uint32` | Block fees in satoshis |
| `block.coinbase` | `address` | Locking bytecode of coinbase output 0 |
| `block.basefee` | `uint32` | Derived: `Floor(1000 * totalFees / size)` satoshis per kB; `block.blobbasefee` aliases it |

Each read spends a coin, so two transactions that read the same coin conflict. A pool can hold several block-info
coins and several slots per block, so that readers can run side by side. The SDK picks a random live coin.

## Bind a contract to a pool

A reader just uses the property:

```solidity
contract TimeVault(pubkey owner, uint64 unlockTime) {
    function withdraw(sig ownerSig) {
        require(block.timestamp >= unlockTime, "still locked");
        require(checkSig(ownerSig, owner));
    }
}
```

The compiler adds no state and no update function. A contract that reads `block.*` or `blockhash`, or creates a
contract that does, takes a hidden last constructor input, `__oraclePool`: the pool every read checks a coin
against. The SDK fills it, so callers leave it out:

- with the `oraclePool` option, a category in display byte order, on `new Contract(...)`, `ContractFactory`
  deployments and `StatefulContract.deploy`, framed deployments included;
- else with the provider's pool, `provider.oraclePoolCategory`.

```ts
import { Contract, SignatureTemplate, TransactionBuilder } from '@solidcash/solidcash';
import { ElectrumNetworkProvider } from '@solidcash/solidcash/network/electrum';

const provider = new ElectrumNetworkProvider('mainnet', { oraclePoolCategory: poolCategory });
const vault = new Contract(timeVaultArtifact, [ownerPublicKey, unlockTime], { provider });
// vault.oraclePool === poolCategory; { provider, oraclePool: otherPool } binds another pool

await new TransactionBuilder({ provider })
  .addInput(vaultUtxo, vault.unlock.withdraw(new SignatureTemplate(ownerPrivateKey)))
  .addOutput({ to: ownerAddress, amount: vaultUtxo.satoshis - 2_000n })
  .send(); // adds a live block-info coin of the pool, its recreation and the hidden index
```

The binding is part of the bytecode, so a reader's address depends on its pool, and a deployed reader keeps it.
Building a reader with neither an `oraclePool` nor a provider pool fails. A contract passes its own binding to every
contract it creates, so a child reads its creator's pool, whatever pool the provider names. A framed master carries
the pool in its bytecode rather than as an input, and its deployment writes it in.

The SDK co-spends the coins on every call path: a `Contract` with `TransactionBuilder`, `StatefulContract` calls,
delegate calls, [framed entries](/docs/guides/framed-composition) and
[message-bus routes](/docs/guides/message-bus) (both experimental), where the readers of one pool share one coin.
A function that reads `block.*` takes the coin's input index from its caller as a hidden argument. A call that
cannot forward it is refused at compile time with `BlockOracleIndexNotForwardedError`: read `block.*` in the caller
as well, or pass the value in as an argument.

A body reached through a function pointer takes no index: it reads the first block-info coin of its pool among the
inputs, and for `blockhash(n)` the first slot there that answers n, with the hash or the zero a direct read gives.
The artifact marks each entry that may reach such a body (`indirectPoolReads`), and the SDK co-spends what the body
reads on every call of that entry. A call of it from another contract, a delegate call included, gets the
block-info coin but no slot. A message-bus route cannot carry such a body, so a message-bus build that reaches one
is refused with `MESSAGE_BUS_ORACLE_POOL_INDIRECT_READ`. Call the reader directly.

## Create a pool

`createOraclePool` mints a pool by two ordinary transactions. The first moves a coin of the funder to output 0. The
second spends it, so the pool's category is the first transaction's id, and mints the block-info coins at the tip's
fields, `slotReplicas` slots for each of the last `ringDepth` blocks, and the baton:

```ts
import { hexToBin } from '@bitauth/libauth';
import { createOraclePool } from '@solidcash/solidcash/oracle';

const pool = await createOraclePool(provider, {
  ownerKey,              // private key: its hash owns every coin
  funder: ownerKey,      // its P2PKH pays for the pool and takes the change
  infoCoins: 4,
  ringDepth: 256,        // 1 to 256: the ring holds the last ringDepth blocks
  slotReplicas: 1,       // slots per block (the default); 0 mints no ring
  tip,                   // { number, timestamp, difficulty, size, totalFees, coinbase } of the newest block
  blockHash: async (n) => hexToBin(await node.getBlockHash(Number(n))),
});
```

`tip` is required on a live network. `blockHash`, in display byte order, is required where the provider has no
`getBlockHash`, as `ElectrumNetworkProvider` has none. A simulator supplies both. The pool above holds
`(4 + 256 + 1) * 1,200 = 313,200` satoshis, and `pool.category` is the category to name in `oraclePoolCategory` or
`oraclePool`.

### Mint a pool with the deployment

A stateful or `ContractFactory` deployment can mint its own pool, in transactions sent before its genesis so that
its constructor can read it. Pass `oraclePool: 'new'`, or `{ create: { ... } }` to set options:

```ts
const clock = await clockFactory.deploy({ initialState: { reads: 0n }, oraclePool: 'new' });
const hashes = await hashesFactory.deploy({
  initialState: { reads: 0n },
  oraclePool: { create: { ringDepth: 16, slotReplicas: 2, ownerKey } },
});
```

The pool's shape follows what the contract and the contracts it creates read. The compiler publishes the children's
reads in the creator's artifact as `createdPoolReads`.

- Block-info coins are minted only if something in the tree reads `block.*`: `infoCoins` of them, by default one
  per master of the deployment, or one for a stateless contract.
- Ring slots are minted only if something reads `blockhash`: `slotReplicas` per block (default 1) for the last
  `ringDepth` blocks (default 256, or 1 for `'now'`).
- The baton holds `ringDepth`.

The deployment and every contract it creates bind the new pool. `ownerKey` signs the pool's owner paths, and its
P2PKH pays for the pool unless `funder` is given. It defaults to `provider.oraclePoolOwnerKey`, which the mock and
regtest providers have. On any other provider, `'new'` without `ownerKey` is refused, and a live network also needs
`tip`, and `blockHash` where the provider has no `getBlockHash`, as `createOraclePool` does. A tree that reads no
block data mints no pool.

## Run the keeper

`PoolKeeper` signs the owner's transactions. Run it with `start`, or call its steps from your own loop on each new
block. Either way, read the fields from a node you operate or explicitly trust.

```ts
import { PoolKeeper } from '@solidcash/solidcash/oracle';

const keeper = new PoolKeeper({
  provider, category: pool.category, ownerKey,
  fields: async (height) => readBlockFields(height), // a live network needs it; a simulator supplies its own
});
const stop = keeper.start(10_000); // looks for a new block every 10 seconds (default: every second)
// ...
await stop();

// Or, from your own loop, on each new block:
await keeper.refreshInfo({ number, timestamp, difficulty, size, totalFees, coinbase });
await keeper.writeNewestSlot(number, hash);
```

- `start(intervalMs?, { onError?, onStep? })` steps at once, then on each tick that finds a new block. A step calls
  `refreshInfo` with the tip's fields and writes the slot of every block since the last step, up to the tip. A block
  mined by the keeper's own transactions, as a simulator's sends are, does not trigger a step. A failed step goes to
  `onError` (logged by default), and the next block tries again. The returned stop function resolves once the
  running step ends. The block hashes come from the `blockHash` option, or else the provider's `getBlockHash`.

- `refreshInfo(fields)` updates every live block-info coin the key owns. One height-locked transaction raises
  `number` and writes the block's other fields, then one time-locked transaction raises `timestamp`, so every coin
  reads one clock. A time-type locktime is final only below the median time past, so `timestamp` is at most MTP - 1.
  A step already published is skipped. It returns the txids it sent.
- `writeNewestSlot(n, hash)` moves the live slots of block n's residue (`n mod depth`) forward to n, in one
  transaction locked at height n. `writeSlots(blocks)` catches up after a gap: each slot moves to the newest block
  of its residue among `blocks`.
- `growInfo(k)` mints k copies of a live block-info coin through the baton, and `growSlots(blocks)` mints slots with
  the baton's owner and depth.
- `setDepth(depth)` changes the baton's depth, 1 to 256, through its update path. Slots minted afterwards take the
  new depth. To retune a ring, set the depth, grow slots at it, then sweep the old ones.
- `stop`, `sweep` and `rotate` are described [below](#stop-and-sweep).

Every keeper transaction pays 1 satoshi per byte from the largest token-free coin at the owner's P2PKH address and
returns the change there. Fund that address before the first update.

## Freshness

The covenants bound every write. A height update cannot claim a height above its own locktime, so not above the
chain tip, and a time update cannot claim a time at or above the median time past. Neither rewinds. A slot moves
only forward, by a multiple of its depth, to a height not above its locktime.

Nothing bounds how old a value is. `block.number` and `block.timestamp` are the keeper's last write, and the
keeper's cycle is the only bound on their age: if the keeper stops, readers keep reading the last write, and a
deadline written against `block.timestamp` stays open until the next update. The compiler warns on both reads for
this reason.

:::caution
Where a stale value would benefit the spender, use a native `tx.time` floor. A reader may spend any live coin of its
pool, so a coin the keeper left behind is as readable as a current one; `refreshInfo` moves every live coin the key
owns together.
:::

## `blockhash(n)`

A ring of depth d holds the last d blocks: each slot keeps one residue `n mod d`, and the keeper moves it forward d
blocks at a time. A read of `blockhash(n)` co-spends a slot of the bound pool, and:

- returns the slot's hash when the slot holds n;
- returns zero when the slot holds a block of n's residue at least 256 blocks newer, as n has left the EVM's
  256-block window;
- fails otherwise: for a block the pool has not written yet, and for one its ring overwrote less than 256 blocks ago.

A current ring of depth 256 answers every block: its hash inside the window, zero beyond it. A shallower ring holds
only its last d blocks; an older block reads zero once the slot of its residue is at least 256 blocks newer, and
fails before that. A zero is never the absence of a coin: it takes a real slot of the pool that shows the block is
too old. The hash is in display byte order, as a node's `getblockhash` prints it.

A read also requires `tx.time >= n`, which the SDK meets by raising the transaction's height locktime. Each
distinct `n` in a function co-spends its own slot, and a computed `n` such as `block.number - 1` is found by the
SDK's probe of the covenant. Reading `blockhash` makes a contract stateful, and framed contracts do not serve it.

## Stop and sweep

- `stop(coins)` sets a coin's stop bits and changes nothing else. Readers refuse a stopped coin, the SDK no longer
  selects it, and `refreshInfo` skips it. Use it to take coins out of service.
- `sweep(coins)` burns coins, the baton included. The owner takes their satoshis, and the transaction may carry no
  output of the pool's category, so a burn cannot free a mint. Sweeping the baton ends the pool's growth.
- `rotate(newKey)` names a new owner in every coin the key owns and in the baton. The last transaction's change goes
  to the new key's P2PKH, and the keeper signs with the new key from then on.

Readers cannot move to another pool. A pool whose block-info coins are all stopped or swept halts the `block.*`
reads of every contract bound to it, and one with no live slots halts their `blockhash` reads.

## Testing on the mock network

`MockNetworkProvider` mints its pool the first time `provider.oraclePoolCategory` is read, which building a reader
without `oraclePool` does, so a test that reads no block field pays for no pool. The pool has two block-info coins
at the tip's fields, a depth-256 ring with one slot per block, and the baton, owned by `provider.oraclePoolOwnerKey`.
Block n hashes to the SHA-256 of its 4-byte little-endian height, which `provider.getBlockHash(n)` returns.

After every mined block (`mine()`, `mineUpTo()`, `time.increase()`, `evm_increaseTime`, and each send, which mines
one), the mock's keeper moves every live block-info coin to the tip's height and the tip time less one second, and
writes the slot of each block mined since. Its transactions wait in the mempool for the next block, as a live
keeper's would. A failed refresh leaves the pool behind and is kept in `provider.oraclePoolRefreshError`. `reset()`
drops the pool, and the next read mints a new one. A VM profile older than BCH 2026 has no pool, as the pool
covenants loop.

The mock keeps every pool owned by `provider.oraclePoolOwnerKey` current in the same way: a pool a deployment mints
with `oraclePool: 'new'`, and any pool `createOraclePool` mints with that key. That key's P2PKH address holds a coin on
every fresh chain, which pays for those pools.

A test that needs chosen fields mints a pool of its own and binds a reader to it:

```ts
import { hexToBin } from '@bitauth/libauth';
import { Contract, randomUtxo } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';
import { PoolKeeper, createOraclePool } from '@solidcash/solidcash/oracle';

const provider = new MockNetworkProvider();
await provider.addUtxo(ownerAddress, randomUtxo({ satoshis: 10_000_000n })); // the owner key's P2PKH address
const pool = await createOraclePool(provider, {
  ownerKey, funder: ownerKey, infoCoins: 1, ringDepth: 4,
  tip: {
    number: 120_000n, timestamp: 1_690_000_000n, difficulty: 0n, size: 1_000n, totalFees: 0n,
    coinbase: hexToBin(`76a914${'11'.repeat(20)}88ac`),
  },
});
const vault = new Contract(timeVaultArtifact, [ownerPublicKey, unlockTime], { provider, oraclePool: pool.category });
const keeper = new PoolKeeper({ provider, category: pool.category, ownerKey }); // moves only when called
```

`RegtestNetworkProvider` mints a pool of the mock's shape when it first connects and refreshes it as it mines.
`solidhat node` mints a pool of the same shape when it starts and keeps it current on every tip change. It
advertises the pool as `server.features.devnet.oracle_pool`, which `MemCashNetworkProvider` takes as its default, so
readers on the devnet bind it without options. The devnet's owner key stays in the node, so `oraclePool: 'new'` there
needs `ownerKey`, and that pool needs a keeper of your own, such as `PoolKeeper.start`.

## Trust: the owner key

A pool is as trustworthy as its owner key, and a reader trusts the pool it binds:

- the owner writes `difficulty`, `size`, `totalFees`, `coinbase` and every slot's hash, none of which a script can
  check;
- the owner decides how far `block.number` and `block.timestamp` lag, which no script bounds (see
  [Freshness](#freshness));
- the owner can stop or sweep coins, which halts the pool's readers.

The owner cannot claim a height above the tip or a time at or above the median time past, rewind a field, move a
slot backward or off its residue, change a coin's kind, or mint a coin except through the baton, which checks it.
The owner is a single key; replace it with `rotate`.

The pool's genesis is trusted as well. A genesis transaction may mint NFTs of its category at any lock, so a pool is
sound only when its genesis put every NFT at a pool lock and minted one baton, as `createOraclePool` does. Bind a
pool whose owner and genesis you trust, or create and keep your own.

## Operational checklist

1. Prefer `tx.time`/`this.age` when an exact block field is unnecessary.
2. Record the pool category, owner, node trust source, keeper cadence and monitoring policy with each deployment.
3. Keep the owner key safe, and rotate it if it may be exposed.
4. Alert when the block-info coins lag the node tip, when the owner's P2PKH runs low, or when a slot write fails.
5. Size the pool for its readers: more block-info coins and slot replicas let more transactions read in one block.
6. Treat `block.difficulty` and `block.prevrandao` as non-random; the builder picks `n` for `blockhash(n)`.
