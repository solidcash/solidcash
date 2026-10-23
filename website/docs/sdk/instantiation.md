---
title: Contract Instantiation
---

`Contract` is the low-level, immutable description of one locking script. It combines a compiled artifact,
contract-level constructor arguments, a provider, and addressing options. Use it directly for stateless UTXOs and
raw transaction building; wrap stateful deployments with `StatefulContract` or `ContractFactory` so the SDK also
manages category-branded state resources.

## Construct a contract

```ts
import { Contract } from '@solidcash/solidcash';
import { ElectrumNetworkProvider } from '@solidcash/solidcash/network/electrum';
import artifact from './P2PKH.artifact.js';

const provider = new ElectrumNetworkProvider('chipnet');
const contract = new Contract(artifact, [alicePkh], {
  provider,
  addressType: 'p2sh32',
});
```

The constructor checks the artifact version, argument count, and argument types before calculating the redeem
script and address. Constructor arguments are passed in declaration order; a `pubkey` or `bytes` argument takes a
`Uint8Array`, an `int` a `bigint`.

```ts
interface ContractOptions {
  provider: NetworkProvider;
  addressType?: 'p2sh20' | 'p2sh32' | 'p2s';
  salt?: Uint8Array;
  category?: Uint8Array;
  blockOracleLock?: Uint8Array;
}
```

`provider` is required. `blockOracleLock` overrides the provider's block-oracle lock for a contract that reads block
data; most applications leave it unset.

`p2sh32` is the default and the required address type for the stateful protocol. `p2sh20` remains available for
compatible stateless scripts but has a smaller collision-security margin. `p2s` exposes the script itself as the
locking bytecode and requires a provider which can query arbitrary locking bytecode.

### Salt

`salt` adds a dead `<salt> OP_DROP` prefix to the constructed script. It changes the address without changing
function semantics and is the basis for CREATE2-style deterministic addressing and operation-density reserve.
The maximum salt is 520 bytes.

```ts
const salted = contract.withSalt(Contract.generateSalt(32));
```

### Stateful category pin

A deployed stateful covenant is self-pinned to its CashToken category. `category` bakes the displayed 32-byte
category into the prologue and verifies that the active input is that category's minting NFT:

```ts
const pinned = new Contract(statefulArtifact, constructorArgs, {
  provider,
  addressType: 'p2sh32',
  category: hexToBin(categoryId),
});

// Equivalent immutable clone:
const same = template.withCategory(hexToBin(categoryId));
```

Do not treat an unpinned stateful template address as a deployed instance. Prefer
`StatefulContract.at(addressOrCategory, artifact, runner, { constructorArgs })` or a persisted deployment record;
those paths resolve and authenticate the category.

## Addresses and bytecode

| Property | Meaning |
| --- | --- |
| `name` | Artifact contract name |
| `address` | Ordinary CashAddress for the constructed locking bytecode |
| `tokenAddress` | CashToken-aware address for the same locking bytecode |
| `lockingBytecode` | Hex locking bytecode (`scriptPubKey`), or the raw script for `p2s` |
| `bytecode` | Hex redeem script after constructor arguments, salt, and category pin |
| `bytesize` | Final redeem-script byte length |
| `opcount` | Opcode count in the final redeem script |
| `addressType` | Selected P2SH/P2S form |
| `isStateful` | Whether the artifact has a state layout |
| `stateLayout` | Artifact state layout, when present |

`address` and `tokenAddress` encode the same underlying locking bytecode. Use `tokenAddress` for wallet/indexer
queries involving CashTokens. `bytesize` includes constructor arguments and addressing prefixes, so it is the
right deployed-script check against the 10,000-byte P2SH limit.

```ts
if (contract.bytesize > 10_000) {
  throw new Error('constructed contract exceeds the P2SH script limit');
}
```

See [Script & Transaction Limits](/docs/compiler/script-limits) for the other independent VM and transaction
budgets.

## UTXOs and balance

```ts
const utxos = await contract.getUtxos();
const satoshis = await contract.getBalance();
```

`getUtxos()` queries the token-aware address, so it can return both ordinary and token-bearing UTXOs. For `p2s`,
it calls `provider.getUtxosForLockingBytecode()`. `getBalance()` sums the satoshis of every returned UTXO; it is
not the stateful satoshi-container balance unless this `Contract` specifically describes that container.

## Function unlockers

```ts
const [utxo] = await contract.getUtxos();

new TransactionBuilder({ provider })
  .addInput(utxo, contract.unlock.spend(recipient, signature))
  .addOutput({ to: recipientAddress, amount: utxo.satoshis - 1_000n });
```

`contract.unlock.<function>(...args)` returns an `Unlocker`; it does not send a transaction or infer outputs.
The argument encoder validates values against the ABI and throws on a wrong argument count or type. TypeScript
artifacts make constructor and unlocker names and argument tuples statically typed.

A `sig` parameter takes a `SignatureTemplate`, which signs the transaction when it is built. A `datasig` parameter
takes the signature bytes, for example from `SignatureTemplate.signMessageHash()`.

### Overloaded functions

Overloads with distinct argument counts also have a plain-name dispatcher:

```ts
contract.unlock.set(1n);
contract.unlock.set(1n, 2n);
```

For same-arity overloads, use the canonical ABI signature so runtime JavaScript types cannot select the wrong
one:

```ts
contract.unlock['set(uint256)'](1n);
contract.unlock['set(bytes32)'](hash);
```

The SDK exposes special functions as `unlock.fallback(...)` and `unlock.receive()`.

## Delegate implementation variant

For an artifact with inferred proxy-eligible functions, `asDelegate()` reconstructs the contract using
`artifact.delegateArtifact`:

```ts
const implementation = contract.asDelegate();
```

This is different bytecode and therefore a different address. Deploy that variant as the implementation behind a
custom proxy (experimental). The higher-level `upgrades.deployProxy()` path selects it automatically. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies).

## External target registry

Contracts with typed array calls or opaque loop dispatch need concrete co-spend instances registered off-chain:

```ts
contract.registerExternalTarget({
  address: target.lockingBytecode,
  interfaceName: 'ITarget',
  instance: target,
});
```

`registerLoopTargets()` and `registerLoopFunder()` are conveniences for opaque multi-call contracts. Ordinary
single typed calls are normally registered on a `StatefulContract` through artifact bundles or external bindings;
see [Cross-Contract Calls](/docs/language/cross-contract-calls).

## Which class to use

| Need | API |
| --- | --- |
| Spend a stateless covenant UTXO | `Contract` + `TransactionBuilder` |
| Deploy and call persistent state | `ContractFactory` / `StatefulContract` |
| Work with every contract compiled from one source | `ContractBundle` |
| Deploy a compiler-split large contract | `SplitContractBundle` |
| Deploy a state-holding delegate proxy | `upgrades.deployProxy()` |

See [TypeScript SDK](/docs/sdk/typescript-sdk) for the high-level map and
[Stateful Contracts](/docs/sdk/stateful-contracts) for state-aware calls.
