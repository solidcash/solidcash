---
title: Mock, Regtest & Legacy Providers
---

Use `ElectrumNetworkProvider` for ordinary token-aware public-network access. The SDK also includes a deterministic
in-process provider, a live BCHN regtest adapter, and two narrower legacy backends.

## `MockNetworkProvider`

`MockNetworkProvider` evaluates and indexes transactions locally with the BCH 2026 VM. It is intended for unit and
e2e tests, not as a public network emulator or persistence layer. Every accepted transaction is mined into a block
at once.

```ts
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';

const provider = new MockNetworkProvider();
const [owner, user] = await provider.getSigners(2, {
  fundingUtxos: 5,
  satoshis: 1_000_000n,
});
```

The provider returns CashToken details, queries raw locking bytecode, records raw transactions, and updates its
UTXO set after successful broadcasts by default. The signers use the public Hardhat test mnemonic; never use them
outside isolated test networks.

`getSigners(count = 20, options)` returns `HDSigner`s, each funded once with a genesis-valid coin. The options are
`satoshis` per coin (default `1_000_000n`), `fundingUtxos` (coins per signer, default 1), `genesisFundingUtxos`
(how many of those coins sit at `vout: 0` of their own transaction, default 1), `mnemonic` and `path`.
`getSigner(index)` returns one funded signer.

### Consensus and policy profile

```ts
const productionShape = new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 100_000,
    maximumNftCommitmentBytes: 128,
  },
  policy: { enforceDust: true },
});
```

Mock defaults relax size ceilings so large protocol tests can execute, but retain the real operation-cost density
budget. The default `MOCK_CONSENSUS_LIMITS` allow 1,000,000-byte inputs, stack items and NFT commitments,
10,000,000-byte transactions and relaxed hash iterations, keep 800 operation-cost units per byte, and apply no dust
rule. Override fields deliberately when testing a boundary; each option object is merged over the defaults. The
mock accepts only whole-number hash-iteration limits, so the real fractional allowances (0.5 per byte for relay,
3.5 for consensus) cannot be set on it. Pass `operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST` only in a
harness that tests the relaxed profile itself. A green relaxed mock test is not evidence that the transaction
satisfies production script, transaction, standardness, or relay limits.

`updateUtxoSet: false` records submitted transactions without validating them or applying their outputs, and is
useful for isolated debug evaluation.

### UTXO and token fixtures

```ts
import { randomUtxo } from '@solidcash/solidcash';

await provider.addUtxo(addressOrLockingBytecode, randomUtxo({
  vout: 0,
  satoshis: 100_000n,
}));

const { categoryId, utxos } = await provider.addTokenUtxos([
  { address, satoshis: 1_200n, token: { amount: 100n } },
]);

const dynamic = await provider.addTokenUtxosDynamic((createdCategory) => [
  { address, satoshis: 1_200n, token: { amount: 0n, nft: {
    capability: 'mutable',
    commitment: deriveCommitment(createdCategory),
  } } },
]);
```

`addUtxo()` is asynchronous; it takes an address or a hex locking bytecode and preserves the supplied outpoint and
token record. Use a distinct `vout: 0` transaction when a fixture must be a valid CashToken genesis input.
`addTokenUtxos()` creates one coherent category for its output list; `addTokenUtxosDynamic(factory)` also exposes
that category while building category-dependent commitments. Both return `{ categoryId, utxos }`: the category is a
random txid, and output `i` of the list is the UTXO `categoryId:i`.

### Height, time, and snapshots

```ts
provider.setBlockHeight(900_000);
await provider.mine(3);
await provider.mineUpTo(900_010);

provider.setNextBlockTimestamp(1_900_000_000);
provider.increaseTime(3600);

const snapshot = await provider.takeSnapshot();
// ... mutate provider state
await snapshot.restore();
```

`mine()` advances the height, `increaseTime()` moves the tip timestamp at once and returns it, and
`setNextBlockTimestamp()` applies to the next mined block. `takeSnapshot()` captures the chain, the height and the
time; its `restore()` rewinds to that point and can be called repeatedly.

The EIP-1193-style `send(method, params)` surface implements the Hardhat-compatible network helpers used by
SolidHat: `evm_snapshot`, `evm_revert`, `evm_mine`, `hardhat_mine`, `evm_increaseTime`,
`evm_setNextBlockTimestamp`, `eth_blockNumber` and `eth_chainId`; `evm_setAutomine` is accepted and ignored.
`reset()` clears the UTXO set, accepted transactions and signer funding, resets the block time and re-creates the
block oracle; the block height stays.

The mock mints its own block-info oracle and writes its height and time into it as it mines, so contracts that read
`block.*` values work without setup. See [Block Data & Oracles](/docs/guides/block-oracles).

## `RegtestNetworkProvider`

`RegtestNetworkProvider` drives a real BCHN regtest node and mines after broadcasts. It is the integration-test
bridge between relaxed in-memory evaluation and real node admission.

```ts
import { RegtestNetworkProvider } from '@solidcash/solidcash';

const provider = new RegtestNetworkProvider({
  rpcUrl: 'http://localhost:18443',
  rpcUser: 'user',
  rpcPassword: 'password',
});

await provider.mine(1);
```

The values shown are the defaults, so `new RegtestNetworkProvider()` connects to the same node. The provider reads
no environment variables; a project created by SolidHat passes `REGTEST_RPC_URL`, `REGTEST_RPC_USER` and
`REGTEST_RPC_PASSWORD` to it from its config. The `consensusLimits` and `policy` options publish limits for SDK
preflight; configure the node to match them.

It imports addresses into the node wallet as needed, returns token-aware `listunspent` records, deduplicates token
and ordinary CashAddress views of the same script, and supports raw-locking-bytecode lookup where the script can be
converted to an address, plus outputs it broadcast itself. Its `addUtxo(address, utxo)` and token fixture helpers
create actual transactions and preserve genuine genesis categories rather than silently substituting labels. Each
broadcast is mined into a block at once, and the provider mints and updates its own block-info oracle as the mock
does.

`increaseTime(seconds)` is asynchronous: it sets the node's mock clock and mines a median-time window of blocks,
so that the node's median-time-past reaches the new time. `takeSnapshot()` returns a `restore()` that rewinds the
chain, and `send()` maps the same Hardhat helpers as the mock except `hardhat_mine`.

Run it only against a disposable regtest wallet. `reset()` clears the provider's caches and mock clock but does not
rewind the chain; use a snapshot, or reset the BCHN data directory, when test isolation requires it.

## `FullStackNetworkProvider`

```ts
import BCHJS from '@psf/bch-js';
import { FullStackNetworkProvider } from '@solidcash/solidcash';

const bchjs = new BCHJS({
  restURL: 'https://api.fullstack.cash/v3/',
  apiToken: process.env.FULLSTACK_TOKEN,
});
const provider = new FullStackNetworkProvider('mainnet', bchjs);
```

This adapter uses BCHJS ElectrumX and raw-transaction endpoints. It does **not** return CashToken metadata and
does not support `getUtxosForLockingBytecode()`. Do not use it for stateful contracts, token transactions, or any
builder which must avoid accidentally treating token-bearing UTXOs as BCH-only inputs.

## `BitcoinRpcNetworkProvider`

```ts
import { BitcoinRpcNetworkProvider } from '@solidcash/solidcash';

const provider = new BitcoinRpcNetworkProvider(
  'mainnet',
  'http://localhost:8332',
  { rpcUser: process.env.BCH_RPC_USER!, rpcPassword: process.env.BCH_RPC_PASSWORD! },
);
```

The generic RPC adapter uses wallet `listunspent`, so addresses must be imported before funds arrive or otherwise
be known to the node wallet. It does not return CashToken metadata and cannot query arbitrary locking bytecode.
`getClient()` returns its RPC client for other node calls. Use `RegtestNetworkProvider` for token-aware BCHN tests
and Electrum for public stateful deployments.

## Capability summary

| Provider | CashTokens | Raw script lookup | Local mutation helpers | Intended use |
| --- | --- | --- | --- | --- |
| Electrum | Yes | Yes | No | Public stateful/stateless applications |
| Mock | Yes | Yes | Yes | Fast deterministic tests |
| Regtest | Yes | Addressable scripts and its own broadcasts | Yes, on real BCHN | Node-level integration tests |
| FullStack | No | No | No | Legacy BCH-only access |
| Bitcoin RPC | No | No | No | Wallet-known BCH-only access |

See [Network Provider](/docs/sdk/network-provider) for the shared interface and
[Testing Setup](/docs/sdk/testing-setup) for fixture patterns.
