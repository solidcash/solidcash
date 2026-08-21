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
const { utxos, totalAmount } = gatherBchUtxos(utxos, 100000n);
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
const { utxos, totalAmount } = gatherFungibleTokenUtxos(utxos, tokenCategory, 1000n);
```
