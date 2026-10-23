---
title: Getting Started
description: Create a SolidHat project, then write your first SolidCash contract and build a transaction for it.
---

{/* Hidden until the playground is deployed.

## Try SolidCash Online

To get started with writing SolidCash smart contracts quickly, it is recommended to try out the [SolidCash Playground](https://playground.solidcash.org/), a web application which lets you easily write and create contracts!

The Playground has a code-editor and SolidCash compiler easily accessible, without any prerequisites. Further, the playground allows to easily create contracts, wallets and build transactions.

:::tip
The [SolidCash Playground](https://playground.solidcash.org/) is a great way to get started without doing any JavaScript/TypeScript coding, this way you can focus on learning just SolidCash!
:::

The Playground supports 'Mocknet', this is the recommended way to get started developing. This way you can create virtual UTXOs for testing without having to get Testnet coins and set up a Testnet wallet.

Here are the 5 simple steps for creating your first smart contract transaction with the Playground:
1. Compile a contract, for example the default `TransferWithTimeout` contract.
2. Create a new contract in the 'New Contract' tab by providing the contract arguments.
3. Add mock UTXOs to the smart contract address and the wallets used for testing.
4. Next, go to the TransactionBuilder select the contract UTXO and the function to invoke on it
5. Finally, specify the in- and outputs for the transaction and click 'Evaluate'!
*/}

## Create a Project

The quickest local start is a SolidHat project. SolidHat is the Hardhat-style project tool for SolidCash: it
compiles every contract in the project, runs tests on an in-process mock network, and deploys with named networks.
It needs Node.js 22 or newer.

```bash
npm create @solidcash/solidhat@latest my-app
cd my-app
npm run solidhat:compile
npm run solidhat:test
```

In a terminal, the scaffolder asks for the template, package manager, sample files and whether to install.
Add `-- --yes` to accept the defaults and install the dependencies without prompts. Other options, also after
`--`: `--template typescript|javascript|empty`, `--package-manager npm|yarn|pnpm`, `--hardhat 2|3`,
`--ethers 5|6`, `--dry-run`, `--force` and `--no-install`. Without a terminal there are no prompts, and
dependencies are installed only with `--yes` or `--install`.

A new project contains:

| File | Purpose |
| --- | --- |
| `solidcash.config.ts` | Compiler options, paths, typed-binding targets, accounts and networks (`mock`, `regtest`, `chipnet`, `mainnet`) |
| `vitest.solidhat.config.ts` | Vitest configuration with the SolidHat preset |
| `contracts/Counter.scash` | A sample contract |
| `test/Counter.test.ts` | A sample test |
| `scripts/deploy.ts` | A deployment script: `npm run solidhat:deploy -- --network regtest` |
| `package.json` | The `solidhat:compile`, `solidhat:typegen`, `solidhat:test`, `solidhat:deploy` and `solidhat:clean` scripts |

Answer no to the sample prompt, or pass `--no-sample`, to leave out the three sample files (the `empty` template
also skips them when there is no prompt). The `javascript` template writes `.js` files.
Compiled artifacts go to `artifacts/solidcash/`. To add SolidHat to an existing project, for example a Hardhat
project, run `npx @solidcash/solidhat --init` (add `--dry-run` to preview the changes).

:::note The generated config enables `evmCompat`
New projects set `compiler: { evmCompat: true }` in `solidcash.config.ts`. Project compiles then run in Solidity
compatibility mode: `.sol` sources and `pragma solidity` are accepted, and the ABI uses EVM encoding and keccak256
selectors. Remove the option for native mode, which has a more compact ABI and sha256-derived selectors. Choose the
mode before the first deployment, because it changes ABI bytes, selectors and some storage layouts. See
[Solidity Import Compatibility](/docs/compiler/solidity-import-compat).
:::

:::tip Working with an AI coding agent
Give your AI coding agent the SolidCash agent reference at https://solidcash.org/AGENTS.md. It summarizes the
language, the differences from Solidity, the SDK and SolidHat for agents that write or port contracts.
:::

See [SolidHat Projects](/docs/tooling/solidhat) for configuration, tasks and networks.

## Creating a SolidCash Contract

To get started coding locally we will use a code editor and learn how to work with the `solidc` compiler to create SolidCash contract artifacts.

:::tip Project tooling
This page demonstrates the compiler and SDK directly so each layer is visible. A SolidHat project, as created
above, adds whole-project compilation, testing, generated bindings, named networks, and deployment scripts. See
the [SolidHat guide](/docs/tooling/solidhat).
:::

### Prerequisites

To write SolidCash smart contracts locally you use a code editor. For the best developer experience, we recommend to use VS Code with the SolidCash extension. This way it will automatically recognize `.scash` files and offer highlighting and autocompletion.

:::note prerequisites
- Basic familiarity with the command line
- Node.js installed (v22 or newer)
- A code editor (VS Code recommended)
:::

:::tip
To set up your SolidCash developer environment, see the [Syntax Highlighting](/docs/language/syntax-highlighting) guide.
:::

### Installing the SolidCash compiler
The command line SolidCash compiler `solidc` can be installed from NPM.

```bash
npm install -g @solidcash/solidc
```

### Writing your first contract

We can start from a basic `TransferWithTimeout` smart contract, a simple contract for tips which allows the recipient to claim their gift at any time, but if they don't claim within some time, the sender can reclaim it.

Open your code editor to start writing your first SolidCash smart contract. Then create a new file `TransferWithTimeout.scash` and copy over the smart contracts code from below.
```solidity
pragma solidcash ^0.14.0;

contract TransferWithTimeout(pubkey sender, pubkey recipient, int timeout) {
    // Allow the recipient to claim their received money
    function transfer(sig recipientSig) {
        require(checkSig(recipientSig, recipient));
    }

    // Allow the sender to reclaim their sent money after the timeout is reached
    function timeout(sig senderSig) {
        require(checkSig(senderSig, sender));
        require(tx.time >= timeout);
    }
}
```

Let's take some time to understand the contract structure.
At the top, the smart contract declares the SolidCash language version it's using with `pragma`.
Then a `TransferWithTimeout` is declared which takes in 3 contract arguments and has 2 contract functions: `transfer` and `timeout`.
These contract functions both have `require` statements necessary to be met to be able to spend BCH from the contract.

:::tip
There are some other examples available on the [Examples page](/docs/language/examples) that can be used to take inspiration from. Further examples of the TypeScript and JavaScript integration can be found on [GitHub](https://github.com/solidcash/solidcash/tree/master/examples).
:::

### Compiling your contract

The next step after writing your smart contract is using the command line compiler to create a contract artifact, so that it can be imported into the SolidCash SDK.

```bash
solidc ./TransferWithTimeout.scash --output ./TransferWithTimeout.json
```

This will create an artifact file `TransferWithTimeout.json` from your SolidCash file. The `bytecode` property on the artifact holds the BCH script generated by the `solidc` compiler, written as ASM text: a selector dispatch over the two functions, with checks such as `OP_CHECKSIG` and `OP_CHECKLOCKTIMEVERIFY`. To print only the script, run:

```bash
solidc ./TransferWithTimeout.scash --asm
```

## Creating a SolidCash Transaction

After creating a contract artifact, we can now use the TypeScript SDK to initialise the smart contract and to create a transaction spending from the smart contract UTXO. We'll continue with the `TransferWithTimeout` artifact generated earlier.

:::info
The SolidCash SDK is written in TypeScript meaning that you can either use TypeScript or vanilla JavaScript to use the SDK.
It's recommended to use TypeScript for full type-safety of all your contract logic.
:::

### Installing the TypeScript SDK
The TypeScript SDK can be installed into your project with NPM. Note that SolidCash is a [pure ESM package](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c).

```bash
npm install @solidcash/solidcash
```

### Initialising a Contract

To initialise a contract with the SDK we will need 3 things: the contract artifact, the contract constructor arguments and a NetworkProvider.

To do this, we import the `ElectrumNetworkProvider` and `Contract` classes from the SolidCash SDK. We also need to import the contract artifact. Lastly, we need public keys from a generated key-pair to use as contract constructor arguments.

:::tip
For a code example of how to generate key-pairs with Libauth, see the [SolidCash Examples' `common.ts`](https://github.com/solidcash/solidcash/blob/master/examples/common.ts) file where Alice and Bob's key-pairs are created.
:::

With the instantiated contract, we can now get the contract address and get the contract balance and UTXOs in the following way:

```javascript
import { Contract } from '@solidcash/solidcash';
import { ElectrumNetworkProvider } from '@solidcash/solidcash/network/electrum';
import artifact from './TransferWithTimeout.json' with { type: 'json' };
import { alicePub, bobPub } from './keys.js';

// Initialise a network provider for network operations
const provider = new ElectrumNetworkProvider('chipnet');

// Instantiate a new TransferWithTimeout contract
const contractArguments = [alicePub, bobPub, 100000n];
const contract = new Contract(artifact, contractArguments, {provider});

// Get the contract address and info about its balance
console.log("Contract address: " + contract.address);
console.log("Contract balance: " + await contract.getBalance());
console.log("Contract UTXOs: " + await contract.getUtxos());
```

Next, to spend from the smart contract we've initialised, you would need to make sure there is an actual contract balance on the smart contract address.

To make development easier we'll use the `MockNetworkProvider` instead so you can simulate transactions in a 'mock' network environment.

### Creating a Transaction

Finally to create a transaction spending from the smart contract UTXO we use the `TransactionBuilder` to add in- and outputs to the transaction. The difference between the total BCH amount in the in- and outputs is the transaction fee.

To spend from an input you specify the `UTXO` together with an `Unlocker` to actually provide the 'unlock' script matching the input's locking bytecode. For the initialized smart contract the `Unlockers` are available as methods on the `Contract` instance. Below we will invoke the `transfer` function on the contract utxo through `contract.unlock.transfer(...)`.

```javascript
import { Contract, SignatureTemplate, TransactionBuilder, randomUtxo } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';
import { alicePub, bobPriv, bobPub } from './keys.js';
import artifact from './TransferWithTimeout.json' with { type: 'json' };

// Initialise a mock network provider for easy testing
const provider = new MockNetworkProvider();

// Instantiate a new TransferWithTimeout contract
const contractArguments = [alicePub, bobPub, 100000n];
const contract = new Contract(artifact, contractArguments, {provider});

// Create a mocknet UTXO for testing
const contractMockUtxo = await provider.addUtxo(contract.address, randomUtxo());

// Create the signatureTemplate for bob to sign the contract input
const bobSignatureTemplate = new SignatureTemplate(bobPriv)

// Start building the transaction
const transferDetails = await new TransactionBuilder({ provider })
  .addInput(contractMockUtxo, contract.unlock.transfer(bobSignatureTemplate))
  .addOutput({
    to: 'bitcoincash:qrhea03074073ff3zv9whh0nggxc7k03ssh8jv9mkx',
    amount: 10000n
  })
  .send();

console.log(transferDetails);
```

Congrats! You've successfully created a transaction spending from a Bitcoin Cash smart contract!

To use the `timeout` function you need to use Alice as signer for the spending condition. Secondly you also need to use `.setLocktime()` with a valid argument during the transaction building to pass the `tx.time` check of the `timeout` function.
