---
title: Transactions and Receipts
---

SolidCash exposes the same transaction lifecycle through both raw and stateful APIs:

1. Describe a pending call or add explicit inputs and outputs.
2. Build locally to inspect serialized bytes, or send to run preflight and broadcast.
3. Receive `TransactionDetails`, inspect decoded events, and optionally wait for confirmations.

The removed single-contract fluent API (`.to()`, `.from()`, `.withHardcodedFee()`) is documented separately under
[Legacy APIs](/docs/sdk/legacy-transaction-builder).

## Raw transactions

`TransactionBuilder` is synchronous while a transaction is being assembled. `build()` returns signed transaction
hex without broadcasting; `send()` performs automatic required co-spends, local safety checks, broadcasts, and
returns transaction details.

```ts
const builder = new TransactionBuilder({
  provider,
  maximumFeeSatoshis: 10_000n,
  maximumFeeSatsPerByte: 5,
});

builder
  .addInput(contractUtxo, contract.unlock.release(signature))
  .addInput(fundingUtxo, signer.unlockP2PKH())
  .addOutput({ to: recipient, amount: 50_000n })
  .addBchChangeOutputIfNeeded({ to: signer.getAddress(), feeRate: 1.0 });

const hex = builder.build();       // local only
const sent = await builder.send(); // broadcasts
```

`send(true)` returns the raw transaction hex fetched back from the provider. Most callers should use the normal
result because it retains the txid, parsed transaction, and `wait()` helper.

## Stateful calls

A stateful call is a pending, thenable `StatefulFunctionCall`:

```ts
const pending = counter.call.increment(signature);

// Optional call-level configuration.
pending.withMaxFee(12_000n);

const rawBuilder = await pending.build();
const localHex = rawBuilder.build();
const receipt = await pending.send();
```

`build()` is asynchronous because the SDK must fetch the master, data, mapping, chunk, oracle, external-call, and
other protocol UTXOs required by that ABI route. It returns the lower-level `TransactionBuilder` after deriving
the authenticated output layout.

For normal state-changing functions, `await contract.fn(args)` is shorthand for `.send()`. For a pure/read-only
value-returning route, the direct await may resolve the decoded value. Use `.send()` and `.staticCall()` explicitly
when the distinction should be obvious in code.

```ts
const tx = await counter.call.increment(signature).send();
const value = await counter.call.current().staticCall();
```

`staticCall()` runs a local covenant probe against current state and does not broadcast. A single return value
resolves to that value; several return values resolve to an array with named fields. `.emitReturn().send()` instead
publishes a disposable return-event NFT for an off-chain consumer. See
[Cross-Contract Calls and Results](/docs/language/cross-contract-calls#return-event-nfts).

## Transaction details

```ts
interface TransactionDetails extends Transaction {
  txid: string;
  hex: string;
  wait?: (confirmations?: number) => Promise<TransactionDetails>;
  events?: ReceiptEvent[];
  logs?: ReceiptEvent[];
}
```

The inherited transaction fields contain `version`, `locktime`, parsed `inputs`, and parsed `outputs`.

Stateful sends decode event NFT outputs produced by that transaction and attach them to both `events` and `logs`:

```ts
const tx = await token.call.transfer(to, amount).send();

for (const event of tx.events ?? []) {
  console.log(event.event, event.eventSignature, event.args);
}

const transfer = tx.events?.find((event) => event.event === 'Transfer');
console.log(transfer?.args.from, transfer?.args.to, transfer?.args.amount);
```

Named fields are enumerable on `args`; numeric indices and `toObject()` are available for ethers/typechain-style
compatibility. Receipt events describe only NFT outputs in this transaction. Historical/current event queries use
`queryFilter()` and are subject to the event NFT's cleanup lifecycle.

## Waiting

```ts
const tx = await counter.call.increment(signature).send();
await tx.wait?.();   // provider knows/mined the transaction
await tx.wait?.(3);  // plus two subsequent blocks
```

`wait()` polls through the provider and resolves once the provider returns the transaction; on an Electrum server
that can happen while the transaction is still unconfirmed. It resolves immediately on `MockNetworkProvider`, which
mines accepted transactions during `send()`. It is not a finality guarantee and it does not prevent a conflicting
transaction from replacing or invalidating an unconfirmed chain under network policy.

Deployment results use the same mechanism:

```ts
const deployed = await factory.deploy();
await deployed.waitForDeployment();
const genesis = deployed.deploymentTransaction();
```

## Fee and burn guards

Always set a fee ceiling when transaction inputs or outputs can be influenced by untrusted data:

```ts
const builder = new TransactionBuilder({
  provider,
  maximumFeeSatoshis: 25_000n,
  maximumFeeSatsPerByte: 5,
});

await contract.call.execute(args)
  .withMaxFee(25_000n)
  .send();
```

The raw builder refuses implicit fungible-token and NFT burns by default. `allowImplicitFungibleTokenBurn` and
`allowImplicitNftBurn` are explicit opt-outs for intentional burns. A fee is the BCH input/output difference;
omitting or mis-sizing change can turn the entire remainder into a miner fee, so fee caps are a last-line guard,
not merely an estimate.

Before broadcast, `send()` also checks the finished transaction bytes against consensus and relay rules, such as
transaction and script sizes and dust. Contracts remain the final authority for covenant output preservation.

## Errors and debugging

`send()` rejects before or during broadcast with structured errors including:

- `FailedRequireError` for a source-mapped `require` failure;
- `FailedTransactionEvaluationError` for another VM failure with artifact/input context;
- `FailedTransactionError` for provider or broadcast rejection;
- output/token validation errors for dust, invalid token amounts, or token-aware address mistakes.

```ts
import { FailedRequireError } from '@solidcash/solidcash';

try {
  await counter.call.increment(signature).send();
} catch (error) {
  if (error instanceof FailedRequireError) {
    console.error(error.requireStatement.message, error.inputIndex);
  }
  throw error;
}
```

`TransactionBuilder.debug()` runs a local VM trace for standard unlockers, and `getVmResourceUsage(true)` reports
per-input execution metrics. `getBitauthUri()` creates a BitAuth IDE template. A stateful call has no `debug()` of
its own: build it first and debug the resulting builder.

```ts
const builder = await counter.call.increment(signature).build();
builder.debug();
builder.getVmResourceUsage(true);
```

:::danger
A URI from `getBitauthUri()` contains the private keys of the transaction's signature templates. Do not paste or
upload one produced with real keys. The `bitauthUri` attached to transaction errors has the private keys redacted
and is not enumerable, but it still holds the full transaction and unlocking data.
:::

See [Debugging](/docs/guides/debugging) and [Transaction Builder](/docs/sdk/transaction-builder) for the detailed
builder surface.
