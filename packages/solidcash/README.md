# SolidCash

[![Build Status](https://github.com/solidcash/solidcash/actions/workflows/github-actions.yml/badge.svg)](https://github.com/solidcash/solidcash/actions/workflows/github-actions.yml)
[![Coverage Status](https://img.shields.io/codecov/c/github/solidcash/solidcash.svg)](https://codecov.io/gh/solidcash/solidcash/)
[![NPM Version](https://img.shields.io/npm/v/@solidcash/solidcash.svg)](https://www.npmjs.com/package/@solidcash/solidcash)
[![NPM Monthly Downloads](https://img.shields.io/npm/dm/@solidcash/solidcash.svg)](https://www.npmjs.com/package/@solidcash/solidcash)
[![NPM License](https://img.shields.io/npm/l/@solidcash/solidcash.svg)](https://www.npmjs.com/package/@solidcash/solidcash)

SolidCash is a high-level programming language for smart contracts on Bitcoin Cash. It offers a strong abstraction layer over Bitcoin Cash' native virtual machine, Bitcoin Script. Its syntax is based on Ethereum's smart contract language Solidity, but its functionality is very different since smart contracts on Bitcoin Cash differ greatly from smart contracts on Ethereum. For a detailed comparison of them, refer to the blog post [*Smart Contracts on Ethereum, Bitcoin and Bitcoin Cash*](https://kalis.me/smart-contracts-eth-btc-bch/).

See the [GitHub repository](https://github.com/solidcash/solidcash) and the [SolidCash website](https://solidcash.org) for full documentation and usage examples.

## The SolidCash Language
SolidCash is a high-level language that allows you to write Bitcoin Cash smart contracts in a straightforward and familiar way. Its syntax is inspired by Ethereum's Solidity language, but its functionality is different since the underlying systems have very different fundamentals. See the [language documentation](https://solidcash.org/docs/language/) for a full reference of the language.

## The SolidCash SDK
The main way to interact with SolidCash contracts and integrate them into applications is using the SolidCash SDK. This SDK allows you to import `.json` (or `.ts`) artifact files that were compiled using the `solidc` compiler and convert them to `Contract` objects. These objects are used to create new contract instances. These instances are used to interact with the contracts using the functions that were implemented in the `.scash` file. For more information on the SolidCash SDK, refer to the [SDK documentation](https://solidcash.org/docs/sdk/).

### Installation
```bash
npm install @solidcash/solidcash
```

### Usage
```ts
import { Contract, ... } from '@solidcash/solidcash';
```

Using the SolidCash SDK, you can import contract artifact files, create new instances of these contracts, and interact with these instances:

```ts
...
  // Import the P2PKH artifact
  import P2PKH from './p2pkh-artifact.json' with { type: 'json' };

  // Instantiate a network provider for SolidCash's network operations
  const provider = new ElectrumNetworkProvider('mainnet');

  // Create a new P2PKH contract with constructor arguments: { pkh: pkh }
  const contract = new Contract(P2PKH, [pkh], { provider });

  // Get contract balance & output address + balance
  console.log('contract address:', contract.address);
  console.log('contract balance:', await contract.getBalance());

  const transactionBuilder = new TransactionBuilder({ provider });
  const contractUtxos = await contract.getUtxos();

  const sendAmount = 10_000n;
  const destinationAddress = '... some address ...';

  // Calculate the change amount, accounting for a miner fee of 1000 satoshis
  const changeAmount = contractUtxos[0].satoshis - sendAmount - 1000n;

  // Construct a transaction with the transaction builder
  const txDetails = await transactionBuilder
    // Add a contract input that spends from the contract using the 'spend' function
    .addInput(contractUtxos[0], contract.unlock.spend(pk, new SignatureTemplate(keypair)))
    // Add an output that sends 0. 000 100 00 BCH back to the destination address
    .addOutput({ to: destinationAddress, amount: sendAmount })
    // Add a change output that sends the change back to the contract's address
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();

  console.log(txDetails);
...
```
