---
title: Mock, Regtest & Legacy Providers
---

Use `ElectrumNetworkProvider` for ordinary token-aware public-network access. The SDK also includes a deterministic
in-process provider, a live BCHN regtest adapter, and two narrower legacy backends.

## `MockNetworkProvider`

`MockNetworkProvider` evaluates and indexes transactions locally with the BCH 2026 VM. It is intended for unit and
e2e tests, not as a public network emulator or persistence layer.

```ts
import { MockNetworkProvider } from 'solidcash';

const provider = new MockNetworkProvider();
const [owner, user] = await provider.getSigners(2, {
  fundingUtxos: 5,
  satoshis: 1_000_000n,
});
```

The provider returns CashToken details, queries raw locking bytecode, records raw transactions, and updates its
UTXO set after successful broadcasts by default. The signers use the public Hardhat test mnemonic; never use them
outside isolated test networks.

### Consensus and policy profile

```ts
const productionShape = new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumNftCommitmentBytes: 128,
  },
  policy: { enforceDust: true },
});
```

Mock defaults relax size ceilings so large protocol tests can execute, but retain the real operation-cost density
budget. Override the exported `MOCK_CONSENSUS_LIMITS` fields deliberately when testing a boundary. A green relaxed
mock test is not evidence that the transaction satisfies production script, transaction, standardness, or relay
limits.

`updateUtxoSet: false` keeps submitted transactions without applying their outputs and is useful for isolated
debug evaluation.

### UTXO and token fixtures

```ts
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

`addUtxo()` preserves the supplied outpoint and token record. Use a distinct `vout: 0` transaction when a fixture
must be a valid CashToken genesis input. `addTokenUtxos()` creates one coherent category for its output list;
`addTokenUtxosDynamic(factory)` also exposes that category while building category-dependent commitments. Both
return `{ categoryId, utxos }` rather than pretending an arbitrary label is a real on-chain genesis category.

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

The EIP-1193-style `send(method, params)` surface implements the Hardhat-compatible network helpers used by
SolidHat. `reset()` clears UTXOs, transactions, signer funding, time, and snapshots.

## `RegtestNetworkProvider`

`RegtestNetworkProvider` drives a real BCHN regtest node and mines after broadcasts. It is the integration-test
bridge between relaxed in-memory evaluation and real node admission.

```ts
import { RegtestNetworkProvider } from 'solidcash';

const provider = new RegtestNetworkProvider({
  rpcUrl: 'http://localhost:18443',
  rpcUser: 'user',
  rpcPassword: 'password',
});

await provider.mine(1);
```

It imports addresses into the node wallet as needed, returns token-aware `listunspent` records, deduplicates token
and ordinary CashAddress views of the same script, and supports raw-locking-bytecode lookup where the script can be
converted to an address. Its `addUtxo`/token fixture helpers create actual transactions and preserve genuine
genesis categories rather than silently substituting labels.

Run it only against a disposable regtest wallet. `reset()` is intentionally a no-op on the external chain; reset
the BCHN data directory or RPC fixture explicitly when test isolation requires it.

## `FullStackNetworkProvider`

```ts
import BCHJS from '@psf/bch-js';
import { FullStackNetworkProvider } from 'solidcash';

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
import { BitcoinRpcNetworkProvider } from 'solidcash';

const provider = new BitcoinRpcNetworkProvider(
  'mainnet',
  'http://localhost:8332',
  { rpcUser: process.env.BCH_RPC_USER!, rpcPassword: process.env.BCH_RPC_PASSWORD! },
);
```

The generic RPC adapter uses wallet `listunspent`, so addresses must be imported before funds arrive or otherwise
be known to the node wallet. It does not return CashToken metadata and cannot query arbitrary locking bytecode.
Use `RegtestNetworkProvider` for token-aware BCHN tests and Electrum for public stateful deployments.

## Capability summary

| Provider | CashTokens | Raw script lookup | Local mutation helpers | Intended use |
| --- | --- | --- | --- | --- |
| Electrum | Yes | Yes | No | Public stateful/stateless applications |
| Mock | Yes | Yes | Yes | Fast deterministic tests |
| Regtest | Yes | Addressable scripts | Yes, on real BCHN | Node-level integration tests |
| FullStack | No | No | No | Legacy BCH-only access |
| Bitcoin RPC | No | No | No | Wallet-known BCH-only access |

See [Network Provider](/docs/sdk/network-provider) for the shared interface and
[Testing Setup](/docs/sdk/testing-setup) for fixture patterns.
