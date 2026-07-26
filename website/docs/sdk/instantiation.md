---
title: Contract Instantiation
---

Before interacting with a smart contract on the BCH network, the SolidCash SDK needs to instantiate a `Contract` object. This is done by providing the contract's information and constructor arguments. After this instantiation, the SolidCash SDK can interact with the BCH contract.

## Creating a Contract
The `Contract` class is used to represent a SolidCash contract in a JavaScript object. These objects can be used to retrieve information such as the contract's address and balance. Contract objects can be used to interact with the contract by generating an `Unlocker` by calling the contract's unlocker functions.

### Constructor
```ts
new Contract(
  artifact: Artifact,
  constructorArgs: ConstructorArgument[],
  options : {
    provider: NetworkProvider,
    addressType?: 'p2sh20' | 'p2sh32',
  }
)
```

A SolidCash contract can be instantiated by providing an `Artifact` object, a list of constructor arguments, and optionally an options object configuring `NetworkProvider` and `addressType`.

An `Artifact` object is the result of compiling a SolidCash contract. Compilation can be done using the standalone [`solidc` CLI](/docs/compiler/compiler) or programmatically with the `solidc` NPM package (see [SolidCash Compiler](/docs/compiler/compiler#javascript-compilation)).

:::tip
If compilation is done using the `solidc` CLI with the <span style={{ display: 'inline-block' }}>`--format ts`</span> option to output TypeScript Artifacts, you will get explicit types and type checking for the constructor arguments and function arguments of the `Contract` class.
:::

The `NetworkProvider` option is used to manage network operations for the SolidCash contract. By default, a mainnet `ElectrumNetworkProvider` is used, but the network providers can be configured. See the docs on [NetworkProvider](/docs/sdk/network-provider).

The `addressType` option is used to choose between a `p2sh20` and `p2sh32` address type for the SolidCash contract. By default `p2sh32` is used because it has increased cryptographic security - but it is not yet supported by all wallets.

:::caution
p2sh32 was introduced because p2sh20 is cryptographically insecure for a large subset of smart contracts. For contracts holding large sums of BCH this provides an incentive to find a hash collision and hack the contract.
:::

#### Example
```ts
import { Contract, ElectrumNetworkProvider } from 'solidcash';
import { compileFile } from 'solidc';

// Import the artifact JSON
import P2PKH from './p2pkh.json' with { type: 'json' };

// Or compile a contract file
const P2PKH = compileFile(new URL('p2pkh.scash', import.meta.url));

const contractArguments = [alicePkh]

const provider = new ElectrumNetworkProvider('chipnet');
const options = { provider, addressType: 'p2sh20' }
const contract = new Contract(P2PKH, contractArguments, options);
```

## Contract Properties

### address
```ts
contract.address: string
```

A contract's regular address (without token-support) can be retrieved through the `address` member field.

:::note
Wallets will not allow you to send CashTokens to this address. For that you must use the [tokenAddress](#tokenaddress) below. Wallets which have not upgraded might not recognize this new address type.
:::

#### Example
```ts
console.log(contract.address)
```

### tokenAddress
```ts
contract.tokenAddress: string
```

A contract's token-supporting address can be retrieved through the `tokenAddress` member field.

#### Example
```ts
console.log(contract.tokenAddress)
```

### bytecode
```ts
contract.bytecode: string
```

Returns the contract's redeem script encoded as a hex string.

#### Example
```ts
console.log(contract.bytecode)
```

### bytesize
```ts
contract.bytesize: number
```

The size of the contract's bytecode in bytes can be retrieved through the `bytesize` member field. This is useful to ensure that the contract is not too big, since the Bitcoin Cash consensus limit for P2SH contract bytecode is 10,000 bytes.

:::tip
Using `contract.bytesize` is the best way to get the size of contract bytecode, as it includes the constructor arguments.
The size outputs of the `solidc` compiler are based on the bytecode without constructor arguments so are always an underestimate.
:::

#### Example
```ts
// make sure the contract bytesize is within consensus limits
assert(contract.bytesize <= 10_000)
```

### opcount
```ts
contract.opcount: number
```

The number of opcodes in the contract's bytecode can be retrieved through the `opcount` member field.

#### Example
```ts
console.log(contract.opcount)
```

## Contract Methods

### getBalance()
```ts
async contract.getBalance(): Promise<bigint>
```

Returns the total balance of the contract in satoshis. Both confirmed and unconfirmed balance is included in this figure.

#### Example
```ts
const contractBalance = await contract.getBalance()
```

### getUtxos()
```ts
async contract.getUtxos(): Promise<Utxo[]>
```

Returns all UTXOs that can be spent by the contract. Both confirmed and unconfirmed UTXOs are included.

```ts
interface Utxo {
  txid: string;
  vout: number;
  satoshis: bigint;
  token?: TokenDetails;
}
```

#### Example
```ts
const utxos = await contract.getUtxos()
```

### Contract unlockers

```ts
contract.unlock.<functionName>(...args: FunctionArgument[]): Unlocker
```

Once a smart contract has been instantiated, you can invoke a contract function on a smart contract UTXO to use the '[Transaction Builder](/docs/sdk/transaction-builder)' by calling the function name under the `unlock` member field of a contract object.
To call these functions successfully, the provided parameters must match the function signature defined in the SolidCash code.

:::tip
When using a TypeScript contract Artifact, you will get explicit types and type checking for the function name and arguments.
:::

These contract functions return an incomplete `transactionBuilder` object, which needs to be completed by providing outputs of the transaction. For more information see the [transaction-builder](/docs/sdk/transaction-builder) page.

```ts
import { contract, transactionBuilder } from './somewhere.js';

const contractUtxos = await contract.getUtxos();

transactionBuilder.addInput(contractUtxos[0], contract.unlock.spend());
```

