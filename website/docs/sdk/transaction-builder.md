---
title: Transaction Builder
---

The SolidCash Transaction Builder generalizes transaction building to allow for complex transactions combining multiple different smart contracts within a single transaction or to create basic P2PKH transactions. The Transaction Builder works by adding inputs and outputs to fully specify the transaction shape.

:::info
Defining the inputs and outputs requires careful consideration because the difference in Bitcoin Cash value between in- and outputs is what's paid in transaction fees to the miners.
:::

## Instantiating a transaction builder
```ts
new TransactionBuilder(options: TransactionBuilderOptions)
```

To start, you need to instantiate a transaction builder and pass in a `NetworkProvider` instance and other options.

```ts
interface TransactionBuilderOptions {
  provider: NetworkProvider;
  maximumFeeSatoshis?: bigint;
  maximumFeeSatsPerByte?: number;
  allowImplicitFungibleTokenBurn?: boolean;
  allowImplicitNftBurn?: boolean;
  skipAutomaticCoSpends?: boolean;
}
```

#### Example
```ts
import { TransactionBuilder, Network } from '@solidcash/solidcash';
import { ElectrumNetworkProvider } from '@solidcash/solidcash/network/electrum';

const provider = new ElectrumNetworkProvider(Network.MAINNET);
const transactionBuilder = new TransactionBuilder({ provider });
```

### Constructor Options

#### provider

The `provider` option is used to specify the network provider to use when sending the transaction.

#### maximumFeeSatoshis

The `maximumFeeSatoshis` option is used to specify the maximum fee for the transaction in satoshis. If this fee is exceeded, `build()` and `send()` throw a `TransactionFeeTooHighError`. There is no limit by default.

The fee is the difference between the input and output amounts. Outputs that exceed the inputs are always refused.

#### maximumFeeSatsPerByte

The `maximumFeeSatsPerByte` option is used to specify the maximum fee per byte for the transaction. If this fee is exceeded, `build()` and `send()` throw a `TransactionFeePerByteTooHighError`. The default is 1000 satoshis per byte, which catches a large forgotten change output; set a lower value for a tighter guard.

#### allowImplicitFungibleTokenBurn

The `allowImplicitFungibleTokenBurn` option is used to specify whether implicit burning of fungible tokens is allowed (default: `false`). If this is set to `true`, the transaction builder will not throw an error when burning fungible tokens.

#### allowImplicitNftBurn

Allows an input NFT to be omitted from the outputs. The default is `false`; enable it only for an intentional
burn after reviewing the complete transaction. Mutable and minting NFTs are matched by category and capability, so a
changed commitment is not a burn. An immutable NFT must reappear with the same commitment.

#### skipAutomaticCoSpends

Disables the oracle, computation, recovery, and external-library sidecars normally added by `send()`. This is an
advanced protocol-composition option for a caller that has already placed every compiler-required co-spend at its
exact position. It does not make a contract that needs those resources executable without them.

## Transaction Building

### addInput()
```ts
transactionBuilder.addInput(utxo: Utxo, unlocker: Unlocker, options?: InputOptions): this
```

Adds a single input UTXO to the transaction that can be unlocked using the provided unlocker. The unlocker can be derived from a `SignatureTemplate` (`unlockP2PKH()`), a `Signer` (`signer.unlockP2PKH()`) or a `Contract` instance's spending functions (`contract.unlock.<function>(...args)`).

```ts
interface InputOptions {
  sequence?: number;
}
```

The `InputOptions` object sets the input's sequence number. The default is `0xfffffffe`, which keeps the transaction locktime active. Set a relative timelock here for a contract that checks `this.age`; `encodeBip68({ blocks })` and `encodeBip68({ seconds })` from `@solidcash/utils` encode the value. Adding the same outpoint twice throws.

When the UTXO states its `lockingBytecode`, building the transaction checks it against the lock a contract, P2PKH or
placeholder unlocker spends, and refuses a mismatch with an `UnlockerLockingBytecodeMismatchError` instead of
producing a transaction the network would reject.

:::note
It is possible to create custom unlockers by implementing the `Unlocker` interface. Most use cases however are covered by the `SignatureTemplate` and `Contract` classes.
:::

#### Example
```ts
import { contract, aliceTemplate, aliceAddress, transactionBuilder } from './somewhere.js';

const contractUtxos = await contract.getUtxos();
const aliceUtxos = await provider.getUtxos(aliceAddress);

transactionBuilder.addInput(contractUtxos[0], contract.unlock.spend());
transactionBuilder.addInput(aliceUtxos[0], aliceTemplate.unlockP2PKH());
```

### addInputs()
```ts
transactionBuilder.addInputs(utxos: Utxo[], unlocker: Unlocker, options?: InputOptions): this
transactionBuilder.addInputs(utxos: UnlockableUtxo[]): this
```

```ts
interface UnlockableUtxo extends Utxo {
  unlocker: Unlocker;
  options?: InputOptions;
}
```

Adds a list of input UTXOs, either with a single shared unlocker or with individual unlockers for each UTXO. The `InputOptions` object can be used to specify the sequence number of the inputs.

#### Example
```ts
import { contract, aliceTemplate, aliceAddress, transactionBuilder } from './somewhere.js';

const contractUtxos = await contract.getUtxos();
const aliceUtxos = await provider.getUtxos(aliceAddress);

// Use a single unlocker for all inputs you're adding at a time
transactionBuilder.addInputs(contractUtxos, contract.unlock.spend());
transactionBuilder.addInputs(aliceUtxos, aliceTemplate.unlockP2PKH());

// Or combine the UTXOs with their unlockers in an array
const unlockableUtxos = [
  { ...contractUtxos[0], unlocker: contract.unlock.spend() },
  { ...aliceUtxos[0], unlocker: aliceTemplate.unlockP2PKH() },
];
transactionBuilder.addInputs(unlockableUtxos);
```

### addOutput() & addOutputs()
```ts
transactionBuilder.addOutput(output: Output): this
transactionBuilder.addOutputs(outputs: Output[]): this
```

Adds a single output or a list of outputs to the transaction. The `to` field in an output can be a string representing a cash address, or a `Uint8Array` representing a locking bytecode. For `P2PKH`, `P2SH20` and `P2SH32` outputs, it is easiest to use the cash address string. For `P2S` outputs, you need to use the locking bytecode.

Each output is validated when it is added:

- `amount` must be at least the dust threshold, `444 + 3 * <serialized output size>` satoshis, unless the output is an OP_RETURN output. `MockNetworkProvider` skips this check by default, but `send()` still refuses a dust output.
- A token output sent to a cash address needs a token-aware address (`contract.tokenAddress`); otherwise it throws a `TokensToNonTokenAddressError`.
- Token amounts must be between 0 and 2^64 - 1, the category must be 64 hex characters, and an NFT commitment can be at most 128 bytes.

```ts
interface Output {
  to: string | Uint8Array;
  amount: bigint;
  token?: TokenDetails;
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
import { aliceAddress, bobAddress, transactionBuilder, tokenCategory } from './somewhere.js';

transactionBuilder.addOutput({
  to: aliceAddress,
  amount: 100_000n,
  token: {
    amount: 1000n,
    category: tokenCategory,
  }
});

transactionBuilder.addOutputs([
  { to: aliceAddress, amount: 50_000n },
  { to: bobAddress, amount: 50_000n },
]);
```

### addOpReturnOutput()
```ts
transactionBuilder.addOpReturnOutput(chunks: string[]): this
```

Adds an OP_RETURN output to the transaction with the provided data chunks in string format. If the string is `0x`-prefixed, it is treated as a hex string. Otherwise it is treated as a UTF-8 string.

#### Example
```ts
// Post "Hello World!" to memo.cash
transactionBuilder.addOpReturnOutput(['0x6d02', 'Hello World!']);
```

### Change outputs

```ts
transactionBuilder.addTokenChangeOutputIfNeeded({
  category: tokenCategory,
  to: tokenAddress,
});

transactionBuilder.addBchChangeOutputIfNeeded({
  to: changeAddress,
  feeRate: 1.0,
});
```

```ts
interface TokenChangeOutputOptions {
  category: string;
  to: string | Uint8Array;
}

interface BchChangeOutputOptions {
  to: string | Uint8Array;
  feeRate: number; // satoshis per byte
}
```

`addTokenChangeOutputIfNeeded()` adds an output to `to` that carries the surplus fungible amount of one category,
with the dust threshold as its BCH amount. It adds nothing when there is no surplus. It ignores NFTs, which must be
preserved explicitly.

`addBchChangeOutputIfNeeded()` adds an output to `to` with the BCH surplus minus a fee of `feeRate` satoshis per
byte of the final transaction. When that change would be below the dust threshold, no output is added and the
surplus goes to the fee. It throws when the surplus cannot pay the fee at that rate.

Add all inputs and explicit token outputs first. Then add token change for each category, and add BCH change last.
Once change for BCH or a category is calculated, later inputs/outputs of that asset throw an
`OutputBchChangeLockedError` or `OutputTokenChangeLockedError`, so the computed change cannot silently become stale.


### setLocktime()
```ts
transactionBuilder.setLocktime(locktime: number): this
```

Sets the locktime for the transaction to set a transaction-level absolute timelock (see [Timelock documentation][bitcoin-wiki-timelocks] for more information). The locktime can be set to a specific block height or a unix timestamp. It has to be an integer between 0 and 4294967295.

#### Example
```ts
// Set locktime one day from now
transactionBuilder.setLocktime(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
```

A contract that checks `tx.time >= t` needs a locktime of at least `t`, of the same kind (block height or timestamp).
The network accepts the transaction only once that locktime has passed.

### getTransactionSize()
```ts
transactionBuilder.getTransactionSize(): bigint
```

Returns the size of the transaction in bytes. Inputs with a placeholder P2PKH unlocker are counted at the size they
take up once the wallet signs them.

#### Example
```ts
const transactionSize = transactionBuilder.getTransactionSize();
console.log(`Transaction size: ${transactionSize} bytes`);
```

### calculateTransactionFee()
```ts
transactionBuilder.calculateTransactionFee(): { feeSats: bigint, feeSatsPerByte: number }
```

Calculates the transaction fee in satoshis and the fee per byte, at the size `getTransactionSize()` reports.

#### Example
```ts
const { feeSats, feeSatsPerByte } = transactionBuilder.calculateTransactionFee();
console.log(`Transaction fee: ${feeSats} satoshis (${feeSatsPerByte} sats/byte)`);
```

## Completing the Transaction
### send()
```ts
async transactionBuilder.send(): Promise<TransactionDetails>
async transactionBuilder.send(raw: true): Promise<string>
```

After completing a transaction, the `send()` function can be used to send the transaction to the BCH network. An incomplete transaction cannot be sent.

`send()` runs these steps in order:

1. It adds the compiler-required block-oracle, keccak, signature-recovery and external-library co-spends, unless
   `skipAutomaticCoSpends` was selected.
2. It builds and signs the transaction and applies the token burn checks.
3. It evaluates every input locally, like `debug()`, and throws the first failure, such as a `FailedRequireError`.
   A transaction built by the stateful SDK is evaluated on a best-effort basis, and a transaction with a custom
   unlocker is not evaluated.
4. It applies the fee limits and checks the finished bytes against consensus and relay rules, such as size and dust.
5. It broadcasts through the provider, checks that the returned txid matches the transaction, and fetches the
   transaction back.

A synchronous `build()` or `debug()` cannot perform network discovery; add the corresponding `addRequired*()`
resources first when using those paths.

The result is the parsed transaction (libauth `Transaction` fields) plus its id, its hex and a `wait()` helper:

```ts
interface TransactionDetails {
  version: number;
  inputs: Input[];   // libauth Input: outpointTransactionHash, outpointIndex, sequenceNumber, unlockingBytecode
  outputs: Output[]; // libauth Output: lockingBytecode, valueSatoshis, token
  locktime: number;
  txid: string;
  hex: string;
  wait?: (confirmations?: number) => Promise<TransactionDetails>;
}
```

`wait()` resolves once the provider returns the transaction. For an Electrum server that can be while it is still
unconfirmed. `wait(n)` with `n > 1` also waits until the chain has grown by `n - 1` blocks. On `MockNetworkProvider`
the transaction is mined during `send()`, so `wait()` resolves at once. `send(true)` returns the raw transaction hex
instead of the parsed details.

#### Example
```ts
import { aliceTemplate, aliceAddress, bobAddress, contract, provider } from './somewhere.js';

const contractUtxos = await contract.getUtxos();
const aliceUtxos = await provider.getUtxos(aliceAddress);
const maximumFeeSatoshis = 1000n;

const txDetails = await new TransactionBuilder({ provider, maximumFeeSatoshis })
  .addInput(contractUtxos[0], contract.unlock.spend(aliceTemplate, 1000n))
  .addInput(aliceUtxos[0], aliceTemplate.unlockP2PKH())
  .addOutput({ to: bobAddress, amount: 100_000n })
  .addOpReturnOutput(['0x6d02', 'Hello World!'])
  .send()
```

### build()
```ts
transactionBuilder.build(): string
```

After completing a transaction, the `build()` function can be used to build the entire transaction and return the signed transaction hex string. This can then be imported into other libraries or applications as necessary.

`build()` applies the token burn checks, the input locking-bytecode check and the fee limits. It does not evaluate the scripts and does not add co-spends; use `debug()` to evaluate them first.

#### Example
```ts
import { aliceTemplate, aliceAddress, bobAddress, contract, provider } from './somewhere.js';

const contractUtxos = await contract.getUtxos();
const aliceUtxos = await provider.getUtxos(aliceAddress);
const maximumFeeSatoshis = 1000n;

const txHex = new TransactionBuilder({ provider, maximumFeeSatoshis })
  .addInput(contractUtxos[0], contract.unlock.spend(aliceTemplate, 1000n))
  .addInput(aliceUtxos[0], aliceTemplate.unlockP2PKH())
  .addOutput({ to: bobAddress, amount: 100_000n })
  .addOpReturnOutput(['0x6d02', 'Hello World!'])
  .build()
```

### debug()
```ts
transactionBuilder.debug(): DebugResults
```

If you want to debug a transaction locally instead of sending it to the network, you can call the `debug()` function on the transaction. This will return intermediate values and the final result of the transaction. It will also show any logged values and `require` error messages.

`debug()` returns the VM program states of every input and prints the contract's `console.log` output. A failing input throws a `FailedRequireError` or `FailedTransactionEvaluationError` (see [Transaction errors](#transaction-errors)). Only inputs with a contract or P2PKH unlocker can be debugged; a custom unlocker makes `debug()` throw.

### getBitauthUri()
```ts
transactionBuilder.getBitauthUri(): string
```

If you prefer a lower-level debugging experience, you can call the `getBitauthUri()` function on the transaction. This will return a URI that can be opened in the BitAuth IDE. The URI embeds the private keys of the transaction's signature templates, and the call prints a warning saying so.
A failing `send()` or `debug()` attaches a copy with the private keys redacted to the error's `bitauthUri` property instead.
You can read more about debugging transactions on the [debugging page](/docs/guides/debugging).

:::caution
It is unsafe to debug transactions on mainnet using the BitAuth IDE as private keys will be exposed to BitAuth IDE and transmitted over the network.
:::

### getVmResourceUsage()
```ts
transactionBuilder.getVmResourceUsage(verbose: boolean = false): Array<VmResourceUsage>
```

The `getVmResourceUsage()` function allows you to get the VM resource usage for the transaction. This can be useful for debugging and optimization. The VM resource usage is calculated for each input individually so the result is an array of `VmResourceUsage` results corresponding to each of the transaction inputs.

```ts
interface VmResourceUsage {
  arithmeticCost: number;
  definedFunctions: number;
  hashDigestIterations: number;
  maximumOperationCost: number;
  maximumHashDigestIterations: number;
  maximumSignatureCheckCount: number;
  densityControlLength: number;
  operationCost: number;
  signatureCheckCount: number;
}
```

The verbose mode also logs the VM resource usage for each input as a table to the console. `getVmResourceUsage()` runs `debug()`, so it needs contract or P2PKH unlockers and throws on a failing input.

```
VM Resource usage by inputs:
┌─────────┬─────────────────────────────────────────────────┬─────┬──────────────────────────┬───────────┬──────────┐
│ (index) │ Contract - Function                             │ Ops │ Op Cost Budget Usage     │ SigChecks │ Hashes   │
├─────────┼─────────────────────────────────────────────────┼─────┼──────────────────────────┼───────────┼──────────┤
│ 0       │ 'SingleFunction - test_require_single_function' │ 7   │ '1,155 / 36,000 (3%)'    │ '0 / 1'   │ '2 / 22' │
│ 1       │ 'ZeroHandling - test_zero_handling'             │ 13  │ '1,760 / 40,800 (4%)'    │ '0 / 1'   │ '2 / 25' │
│ 2       │ 'P2PKH Input'                                   │ 7   │ '28,217 / 112,800 (25%)' │ '1 / 3'   │ '7 / 70' │
└─────────┴─────────────────────────────────────────────────┴─────┴──────────────────────────┴───────────┴──────────┘
```

### generateWcTransactionObject()
```ts
transactionBuilder.generateWcTransactionObject(options?: WcTransactionOptions): WcTransactionObject
```

Generates a `WcTransactionObject` that can be used to sign a transaction with a WalletConnect client. It accepts an optional `WcTransactionOptions` object to customize the transaction object with custom `broadcast` and `userPrompt` properties.

```ts
import type { TransactionCommon, Input, Output } from '@bitauth/libauth';
import type { AbiFunction, Artifact } from '@solidcash/solidcash';

interface WcTransactionOptions {
  broadcast?: boolean;
  userPrompt?: string;
}

interface WcTransactionObject {
  transaction: TransactionCommon;
  sourceOutputs: WcSourceOutput[];
  broadcast?: boolean;
  userPrompt?: string;
}

type WcSourceOutput = Input & Output & WcContractInfo;

interface WcContractInfo {
  contract?: {
    abiFunction: AbiFunction;
    redeemScript: Uint8Array;
    artifact: Partial<Artifact>;
  }
}
```

:::tip
See the [WalletConnect guide](/docs/guides/walletconnect) for more information on how to use the `WcTransactionObject` with a WalletConnect client.
:::

#### Example
```ts
import { aliceAddress, contract, provider, signWcTransaction } from './somewhere.js';
import { TransactionBuilder } from '@solidcash/solidcash';
import { placeholderP2PKHUnlocker, placeholderPublicKey, placeholderSignature } from '@solidcash/solidcash/walletconnect';

const contractUtxos = await contract.getUtxos();
const aliceUtxos = await provider.getUtxos(aliceAddress);

// Use placeholder variables which will be replaced by the user's wallet when signing the transaction with WalletConnect
const placeholderUnlocker = placeholderP2PKHUnlocker(aliceAddress);
const placeholderPubKey = placeholderPublicKey();
const placeholderSig = placeholderSignature();

// use the SolidCash SDK to construct a transaction
const transactionBuilder = new TransactionBuilder({ provider })
  .addInput(contractUtxos[0], contract.unlock.spend(placeholderPubKey, placeholderSig))
  .addInput(aliceUtxos[0], placeholderUnlocker)
  .addOutput({ to: aliceAddress, amount: 100_000n });

// Generate WalletConnect transaction object with custom 'broadcast' and 'userPrompt' options
const wcTransactionObj = transactionBuilder.generateWcTransactionObject({
  broadcast: true,
  userPrompt: "Example Contract transaction",
});

// Pass wcTransactionObj to WalletConnect client (see WalletConnect guide for more details)
const signResult = await signWcTransaction(wcTransactionObj);
```

## Transaction errors

When sending a transaction, the SolidCash SDK will throw an error if the transaction fails. All three classes below are exported from `@solidcash/solidcash`:

- `FailedRequireError`: a `require` statement failed. The error refers to the corresponding `require` statement in the contract code so you know where your contract failed.
- `FailedTransactionEvaluationError`: the script failed another way, with the artifact, input and source line when the artifact has debug information.
- `FailedTransactionError`: the base class of both, also thrown on its own when the provider rejects the broadcast. Its `reason` property holds the rejection message.

If you want more information about the underlying error, you can check the `libauthErrorMessage` property of the error.

```ts
interface FailedRequireError {
  message: string;
  reason: string;
  artifact: Artifact;
  failingInstructionPointer: number;
  requireStatement: { ip: number, line: number, message?: string };
  inputIndex: number;
  bitauthUri: string; // private keys redacted, not enumerable
  libauthErrorMessage?: string;
  callStack: { functionName?: string, sourceName: string, line: number, statement: string }[];
  errorArgs?: readonly unknown[]; // decoded arguments of a failing custom error
}
```

`callStack` lists the internal function calls that led to the failing `require`; the message shows it when the
failure is nested. Builder errors such as `TransactionFeeTooHighError`, `OutputSatoshisTooSmallError` and
`UnlockerLockingBytecodeMismatchError` are thrown before anything is broadcast.

[bitcoin-wiki-timelocks]: https://en.bitcoin.it/wiki/Timelock
