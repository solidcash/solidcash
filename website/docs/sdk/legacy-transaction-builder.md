---
title: Old Transaction Builder
---

:::caution
This page describes the old 'Simple Transaction Builder', which operated on a single contract. It was **removed in
v0.12**: none of the methods below exist in the current SDK. The page remains only as a reference for migrating old
code to the [Transaction Builder](/docs/sdk/transaction-builder). See also the
[migration notes](/docs/releases/migration-notes#sdk-transaction-builder).
:::

Old code called a contract function through `contract.functions.<name>(...args)`, which returned an incomplete
transaction object. Chained methods added outputs and options, and `send()` selected the contract UTXOs, added BCH
and token change, and broadcast the transaction.

The current `Contract` has no `functions` property. `contract.unlock.<name>(...args)` returns an unlocker for one
input, and a `TransactionBuilder` takes every input and output explicitly. Nothing is selected or added
automatically: no contract UTXOs, no funding inputs and no change outputs.

## Method mapping

| Old method | Replacement on `TransactionBuilder` |
|---|---|
| `contract.functions.<name>(...args)` | `.addInput(utxo, contract.unlock.<name>(...args))` for each contract UTXO |
| `.to(to, amount, token?)`, `.to(recipients)` | `.addOutput({ to, amount, token })`, `.addOutputs(outputs)` |
| `.withOpReturn(chunks)` | `.addOpReturnOutput(chunks)` |
| `.from(utxos)` | `.addInputs(utxos, contract.unlock.<name>(...args))` |
| `.fromP2PKH(utxos, template)` | `.addInputs(utxos, template.unlockP2PKH())` |
| `.withFeePerByte(feePerByte)` | `.addBchChangeOutputIfNeeded({ to, feeRate: feePerByte })` |
| `.withHardcodedFee(fee)` | Size the outputs yourself: the fee is the input total minus the output total |
| `.withMinChange(minChange)`, `.withoutChange()` | Add or leave out the change output; `addBchChangeOutputIfNeeded()` leaves out change below the dust threshold |
| `.withoutTokenChange()` | Leave out `addTokenChangeOutputIfNeeded()` and set `allowImplicitFungibleTokenBurn: true` |
| `.withAge(age)` | `.addInput(utxo, unlocker, { sequence })` with a BIP68 sequence number |
| `.withTime(time)` | `.setLocktime(time)` |
| `.send()` | `.send()` |
| `.build()` (asynchronous) | `.build()` (synchronous) |
| `.debug()`, `.bitauthUri()` | `.debug()`, `.getBitauthUri()` |

`TransactionBuilder` options replace the remaining settings: `maximumFeeSatoshis` and `maximumFeeSatsPerByte` cap
the fee, and `allowImplicitFungibleTokenBurn` and `allowImplicitNftBurn` permit burns.

## Notes on the old behavior

### to()

`to()` accepted either a single `to`/`amount` pair, with an optional `TokenDetails` object, or a list of
`Recipient` objects. The `Output` object of `addOutput()` has the same `to`, `amount` and `token` fields, and `to`
can now also be a locking bytecode.

### from() and fromP2PKH()

Without `from()`, the old builder selected contract UTXOs automatically for BCH and fungible tokens. NFTs always
needed manual selection. Now every input is added explicitly; `gatherBchUtxos()` and `gatherFungibleTokenUtxos()`
(see [Transaction Utilities](/docs/sdk/transaction-utilities)) select coins from a list.

### withFeePerByte(), withHardcodedFee() and the change methods

The old builder added a BCH change output by default, at a fee rate of 1.0 satoshis per byte, and a token change
output for fungible tokens. `withHardcodedFee()` fixed the fee for covenants that check it, `withMinChange()` set a
threshold below which change went to the fee, and `withoutChange()` and `withoutTokenChange()` turned change off.
Now `addTokenChangeOutputIfNeeded()` and `addBchChangeOutputIfNeeded()` add change only when called. A covenant
that expects a fixed fee needs outputs sized for that fee.

### withAge() and withTime()

`withAge(age)` set the input sequence numbers for `this.age` (formerly `tx.age`) checks, following [BIP68][bip68].
Pass the sequence per input with `{ sequence }`; `encodeBip68({ blocks })` and `encodeBip68({ seconds })` from
`@solidcash/utils` encode it.

`withTime(time)` set the locktime that `tx.time` checks, and the old builder defaulted it to the latest block height.
The new builder's locktime defaults to `0`, so a contract that checks `tx.time` needs `setLocktime()`.

### send(), build() and debug()

The old `send()` resolved to a `TransactionDetails` object with the txid and hex, as the new one does; `build()`
was asynchronous and returned the transaction hex. `bitauthUri()` is now `getBitauthUri()`.

## Example

```js
// Old (removed)
const txDetails = await contract.functions
  .transfer(new SignatureTemplate(alicePrivateKey))
  .withOpReturn(['0x6d02', 'Hello World!'])
  .to('bitcoincash:qrhea03074073ff3zv9whh0nggxc7k03ssh8jv9mkx', 200000n)
  .withHardcodedFee(1000n)
  .send();
```

```ts
// Current
import { SignatureTemplate, TransactionBuilder } from '@solidcash/solidcash';

const [contractUtxo] = await contract.getUtxos();

const txDetails = await new TransactionBuilder({ provider })
  .addInput(contractUtxo, contract.unlock.transfer(new SignatureTemplate(alicePrivateKey)))
  .addOpReturnOutput(['0x6d02', 'Hello World!'])
  .addOutput({ to: 'bitcoincash:qrhea03074073ff3zv9whh0nggxc7k03ssh8jv9mkx', amount: 200000n })
  .addOutput({ to: changeAddress, amount: contractUtxo.satoshis - 200000n - 1000n }) // leaves a 1000-satoshi fee
  .send();
```

## Transaction errors

The old builder threw the same error classes as the current one: `FailedRequireError`,
`FailedTransactionEvaluationError` and `FailedTransactionError`. See
[Transaction errors](/docs/sdk/transaction-builder#transaction-errors).

[bip68]: https://github.com/bitcoin/bips/blob/master/bip-0068.mediawiki
