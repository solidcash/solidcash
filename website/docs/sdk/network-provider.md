---
title: Network Provider
---

The SolidCash SDK needs to connect to the BCH network to perform certain operations, like retrieving the contract's balance, or sending transactions. The recommended network provider to use blockchain network functionality is the `ElectrumNetworkProvider`, however for local development it is recommended to use a `MockNetworkProvider`.

:::tip
SolidCash NetworkProviders have a standardized interface, this allows different network providers to be used by the SDK and makes it easy to swap out dependencies.
:::

## Interface NetworkProvider

### Network
```ts
type Network = 'mainnet' | 'chipnet' | 'mocknet' | 'testnet3' | 'testnet4' | 'regtest';
```

The network parameter can be one of 6 different options.

#### Example
```ts
const connectedNetwork = provider.network;
```

### getUtxos()
```ts
async provider.getUtxos(address: string): Promise<Utxo[]>;
```
Returns all UTXOs on specific address. Both confirmed and unconfirmed UTXOs are included.

```ts
interface Utxo {
  txid: string;
  vout: number;
  satoshis: bigint;
  token?: TokenDetails;
  blockHeight?: number;
  confirmations?: number;
}

interface TokenDetails {
  amount: bigint;
  category: string;
  nft?: {
    capability: 'none' | 'mutable' | 'minting';
    commitment: string;
  };
}
```

#### Example
```ts
const userUtxos = await provider.getUtxos(userAddress)
```

### getUtxosForLockingBytecode()

```ts
async provider.getUtxosForLockingBytecode(
  lockingBytecode: Uint8Array | string,
): Promise<Utxo[]>;
```

Queries a raw locking script. `ElectrumNetworkProvider`, mock, and regtest implement this through script hashes or
address conversion. Legacy FullStack and generic RPC adapters throw because their backends only expose
address/watch-wallet queries. This method is required for `p2s` and non-addressable covenant resources.

### getBlockHeight()
```ts
async provider.getBlockHeight(): Promise<number>;
```
Get the current blockHeight.

#### Example
```ts
const currentBlockHeight = await provider.getBlockHeight()
```

### getRawTransaction()
```ts
async provider.getRawTransaction(txid: string): Promise<string>;
```

Retrieve the Hex transaction details for a given transaction ID.

#### Example
```ts
const rawTransaction = await provider.getRawTransaction(txid)
```

### sendRawTransaction()
```ts
async provider.sendRawTransaction(txHex: string): Promise<string>;
```
Broadcast a raw hex transaction to the network.

#### Example
```ts
const txId = await provider.sendRawTransaction(txHex)
```

## Custom NetworkProviders

A custom indexer or node adapter implements the exported `NetworkProvider` interface. Stateful SDK operation
requires token-aware UTXOs—including category, amount, NFT capability, and commitment—and generally requires raw
locking-bytecode lookup, so implement those semantics rather than returning token outputs as BCH-only coins.

You can create a PR to add your custom `NetworkProvider` to the SolidCash codebase to share this functionality with others. It is required to have basic automated tests for any new `NetworkProvider`.

## Provider-Specific functionality

Beyond the standardized `NetworkProvider` interface each provider can have its own provider-specific functionality. This can either be done by extending the `NetworkProvider` interface or by providing a more full-featured networking client to create the `NetworkProvider`.

## Limits and relay policy

Providers may publish `consensusLimits` and `policy` so the builder can preflight script, transaction, NFT
commitment, operation-density, hash-iteration, and dust boundaries. Omitted profiles use production BCH limits.
Relaxed mock limits are test-only and do not make an oversized transaction relayable on mainnet.

`blockHeight` and `confirmations` on a `Utxo` are optional because not every backend returns them. A provider is a
current UTXO/indexer view, not a finality oracle: applications remain responsible for detecting conflicts,
reorganizations, and stale cached state. See [Transaction Lifecycle](/docs/guides/lifecycle).
