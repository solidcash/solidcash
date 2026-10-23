---
title: Transaction Utilities
---

The SolidCash SDK includes small deterministic UTXO-selection helpers for callers that assemble transactions
manually. They select from the array you provide; they do not query a provider, estimate fees, create change, or
lock UTXOs against a concurrent builder.

## Gathering UTXOs

Often when building transactions, you need to gather UTXOs from a list of UTXOs until the required (token or BCH) amount is reached. This is the purpose of the `gatherBchUtxos()` and `gatherFungibleTokenUtxos()` functions.

### interface GatherUtxosResult
```ts
interface GatherUtxosResult {
  utxos: Utxo[];
  totalAmount: bigint;
}
```

### gatherBchUtxos()
```ts
gatherBchUtxos(utxos: Utxo[], amount: bigint): GatherUtxosResult
```

Filters out every token-bearing UTXO, sorts the remaining UTXOs largest-first, and selects until the requested
satoshi amount is covered. It throws when the available non-token balance is insufficient.

#### Example
```ts
import { gatherBchUtxos } from '@solidcash/solidcash';

const walletUtxos = await provider.getUtxos(walletAddress);
const { utxos, totalAmount } = gatherBchUtxos(walletUtxos, 100_000n);
```

### gatherFungibleTokenUtxos()
```ts
gatherFungibleTokenUtxos(utxos: Utxo[], tokenCategory: string, amount: bigint): GatherUtxosResult
```

Filters to fungible-only UTXOs of the exact display-order category (NFT-bearing UTXOs are ignored), sorts them
largest-first by token amount, and selects until the requested amount is covered. It throws when the balance is
insufficient. BCH carried by the selected token UTXOs is not included in `totalAmount`.

#### Example
```ts
import { gatherFungibleTokenUtxos } from '@solidcash/solidcash';

const { utxos, totalAmount } = gatherFungibleTokenUtxos(walletUtxos, tokenCategory, 1000n);
```

## Test fixtures

`randomUtxo()`, `randomToken()` and `randomNFT()` create made-up UTXO and token objects for tests. Each takes an
optional partial object whose fields override the random defaults:

```ts
import { randomNFT, randomToken, randomUtxo } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';

const provider = new MockNetworkProvider();
await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100_000n }));
await provider.addUtxo(contract.tokenAddress, randomUtxo({
  satoshis: 1_000n,
  token: randomToken({ amount: 500n }),
}));
await provider.addUtxo(contract.tokenAddress, randomUtxo({
  token: randomNFT({ nft: { capability: 'mutable', commitment: '00' } }),
}));
```

`randomUtxo()` defaults to a random txid and vout and at least 100,000 satoshis. `randomToken()` returns a random
category with a fungible amount, and `randomNFT()` a random category with an immutable NFT and no fungible amount.
These objects exist only on a mock provider; a real network rejects inputs that spend them.
