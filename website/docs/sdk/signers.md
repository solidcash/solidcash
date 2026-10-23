---
title: Signers and HD Wallets
---

A `Signer` is a private-key-backed P2PKH funding identity bound to a `NetworkProvider`. It answers three questions
the stateful SDK needs: which address supplies `msg.sender`/`tx.origin`, which UTXOs can fund a call, and how those
P2PKH inputs are unlocked.

It is not an account-chain signer. Bitcoin Cash has no gas account, account transaction nonce, ENS, or generic
`eth_sendTransaction`; contract and transaction builders own the input/output shape.

## Single-key signer

```ts
import { Network, Signer } from '@solidcash/solidcash';
import { ElectrumNetworkProvider } from '@solidcash/solidcash/network/electrum';

const provider = new ElectrumNetworkProvider('chipnet');
const signer = new Signer(privateKeyOrWif, provider);

console.log(signer.address);
console.log(signer.publicKey);
console.log(signer.pkh);
```

The constructor accepts a 32-byte `Uint8Array`, 64-character hex (optionally `0x`-prefixed), or WIF. It derives a
compressed public key and P2PKH CashAddress. `privateKey` stays readable but is not enumerable, so
`JSON.stringify(signer)` and console output show only the public key.

### Address and UTXOs

```ts
const address = signer.getAddress();
const testnetAddress = signer.getAddress(Network.CHIPNET);
const lockingBytecode = signer.getLockingBytecode();
const utxos = await signer.getUtxos();
```

`getUtxos()` delegates to the bound provider. It does not perform coin locking or reservations; concurrent callers
must avoid selecting the same outpoint.

### Funding raw transactions

```ts
const [funding] = await signer.getUtxos();

await new TransactionBuilder({ provider })
  .addInput(funding, signer.unlockP2PKH())
  .addOutput({ to: recipient, amount: funding.satoshis - 1_000n })
  .send();
```

`unlockP2PKH()` is a convenience over a default `SignatureTemplate`. Connecting a signer to a stateful contract
lets the SDK select funding inputs and produce the same unlocker automatically:

```ts
const writable = readOnlyContract.connect(signer);
await writable.call.update(value).send();
```

A contract function's explicit `sig` argument is separate. Pass a `SignatureTemplate` for that parameter even
when the contract is connected to the same signer:

```ts
await contract.call.authorizedUpdate(
  value,
  new SignatureTemplate(signer.privateKey),
).send();
```

### Connecting and deployment

```ts
const otherNetwork = signer.connect(otherProvider);
const factory = new ContractFactory(artifact, signer);
const deployed = await factory.deploy(constructorArg);
```

For a single-key `Signer`, `connect()` returns a new signer for the same key and copies the current local logical
nonce. Separate signer objects do not coordinate future nonce reservations, so queue operations on one signer or
persist and restore nonce state deliberately. A signer-backed factory finds
or creates a plain `vout: 0` genesis input, funds and signs deployment, binds the returned contract to the signer,
and creates a logical CREATE identity.

## Logical transaction nonce

`Signer.getNonce()` is an SDK-local logical nonce, not a consensus or mempool account nonce. A top-level stateful
deployment/call reserves one value; all subordinate BCH transactions in that logical operation share it, and the
nonce commits only when the operation succeeds.

```ts
const next = await signer.getNonce();
```

One signer object permits only one active logical nonce reservation at a time. This prevents two in-process
operations from deriving the same logical identity, but it also means callers should queue top-level operations
per signer.

The nonce is not discovered from the blockchain and a newly constructed `Signer` starts at zero. Long-running
deployment services must persist the next value with their deployment records. The underscored
`_getTransactionNonceState()` and `_setTransactionNonceState(value)` hooks exist for snapshots and explicit
compatibility restoration; they are low-level state-management hooks, not on-chain nonce synchronization.

## Message signing

```ts
const signatureBase64 = signer.signMessage('approve login');
const digest = Signer.hashMessage('approve login');
```

This is the standard Bitcoin Cash/Bitcoin Signed Message format: magic-prefixed, length-delimited, double-SHA256,
then a recoverable compact signature encoded as base64. It is distinct from:

- a transaction `sig`, produced after a transaction's inputs and outputs are known; and
- an `OP_CHECKDATASIG` `datasig`, produced with `SignatureTemplate.signMessageHash()` over the contract's expected
  SHA-256 digest.

## Unsupported ethers account methods

For compatibility, `Signer` has recognizable methods such as `estimateGas`, `call`, `sendTransaction`,
`signTransaction`, `signTypedData`, `resolveName`, and authorization-population methods. They throw a clear
"no equivalent on Bitcoin Cash" error. Use `TransactionBuilder`, `StatefulContract`, and `SignatureTemplate` for
the corresponding UTXO workflow.

## `HDSigner`

`HDSigner` extends `Signer` with BIP-39 mnemonic and BIP-32 key-tree support. It is accepted anywhere a `Signer`
runner is accepted.

```ts
import {
  BCH_ACCOUNT_BRANCH, BCH_DEFAULT_HD_PATH, HDPublicSigner, HDSigner, signersFromMnemonic,
} from '@solidcash/solidcash/hdsigner';

const wallet = HDSigner.fromPhrase(mnemonic, provider);
const child = wallet.deriveChild(1);

console.log(BCH_DEFAULT_HD_PATH); // m/44'/145'/0'/0/0
console.log(BCH_ACCOUNT_BRANCH);  // m/44'/145'/0'/0
console.log(wallet.derivationPath);
console.log(wallet.extendedKey);  // xprv on mainnet, tprv on test networks
```

Factories:

```ts
HDSigner.fromPhrase(mnemonic, provider, path?, passphrase?);
HDSigner.fromSeed(seed, provider, path?);
HDSigner.fromExtendedKey(xprv, provider);
HDSigner.createRandom(provider, path?);
```

`deriveChild(number | string)` supports relative normal and hardened paths, such as `1` or `"1'"`. An extended
private key does not encode its original path or mnemonic, so `derivationPath` is `null` after re-import.

:::danger
`mnemonic`, `privateKey`, and `extendedKey` are secrets. Never include them in browser logs, deployment records,
error reports, source control, or BitAuth debug URIs.
:::

## Batch mnemonic accounts

`signersFromMnemonic()` efficiently derives an indexed receive branch once and returns child signers:

```ts
const accounts = signersFromMnemonic(mnemonic, provider, {
  path: BCH_ACCOUNT_BRANCH,
  initialIndex: 0,
  count: 20,
  passphrase,
});
```

The default path uses SLIP-44 coin type 145 for Bitcoin Cash. Wallets using a different derivation convention must
pass that exact path; using the right mnemonic with the wrong path produces unrelated addresses.

## Watch-only HD signer

```ts
const watch = wallet.neuter();
console.log(watch.extendedKey); // xpub/tpub

const account5 = watch.deriveChild(5);
const balanceUtxos = await account5.getUtxos();

const imported = HDPublicSigner.fromExtendedKey(xpub, provider);
```

`HDPublicSigner` can derive only non-hardened children, calculate P2PKH addresses, and query UTXOs. It holds no
private key and cannot fund/sign a `ContractFactory` or stateful call. `signersFromMnemonic` and `HDPublicSigner`
come from `@solidcash/solidcash/hdsigner`, like `HDSigner`.

## Local test signers

`MockNetworkProvider` provides deterministic, pre-funded HD accounts:

```ts
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';

const provider = new MockNetworkProvider();
const [owner, user] = await provider.getSigners();
const third = await provider.getSigner(2);
```

`getSigners(count = 20, { satoshis, mnemonic, fundingUtxos, genesisFundingUtxos, path })` derives the accounts from
a fixed test mnemonic (`m/44'/145'/0'/0/i`) and funds each address on that mock provider, by default with one UTXO of
1,000,000 satoshis. `fundingUtxos` gives each account several coins. Only output zero of a funding transaction is a
token-genesis candidate; `genesisFundingUtxos` spreads the coins over that many funding transactions when a test
needs several genesis inputs. SolidHat exposes the same idea as `hre.ethers.getSigners()`.

See [Signature Templates](/docs/sdk/signature-templates) for transaction signature algorithms and sighash policy,
and [Contract Deployment](/docs/guides/deployment) for signer-backed genesis.
