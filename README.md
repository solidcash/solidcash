# SolidCash

[![Build Status](https://github.com/solidcash/solidcash/actions/workflows/github-actions.yml/badge.svg)](https://github.com/solidcash/solidcash/actions/workflows/github-actions.yml)
[![Coverage Status](https://img.shields.io/codecov/c/github/solidcash/solidcash.svg)](https://codecov.io/gh/solidcash/solidcash/)
[![NPM Version](https://img.shields.io/npm/v/solidcash.svg)](https://www.npmjs.com/package/solidcash)
[![NPM Monthly Downloads](https://img.shields.io/npm/dm/solidcash.svg)](https://www.npmjs.com/package/solidcash)
[![NPM License](https://img.shields.io/npm/l/solidcash.svg)](https://www.npmjs.com/package/solidcash)

SolidCash is a high-level programming language for smart contracts on Bitcoin Cash. It offers a strong abstraction layer over Bitcoin Cash' native virtual machine, Bitcoin Script. Its syntax is based on Ethereum's smart contract language Solidity, but its functionality is very different since smart contracts on Bitcoin Cash differ greatly from smart contracts on Ethereum. For a detailed comparison of them, refer to the blog post [_Smart Contracts on Ethereum, Bitcoin and Bitcoin Cash_](https://kalis.me/smart-contracts-eth-btc-bch/).

This repository contains the code for the SolidCash compiler & command line tool under [`packages/solidc/`](/packages/solidc). This repository also contains the code for the SolidCash TypeScript SDK under [`packages/solidcash/`](/packages/solidcash). The source code of the [SolidCash.org](https://solidcash.org) website is included under [`website/`](/website). Visit the website for a detailed [Documentation](https://solidcash.org/docs/) on the SolidCash language and SDK.

## The SolidCash Language

SolidCash is a high-level language that allows you to write Bitcoin Cash smart contracts in a straightforward and familiar way. Its syntax is inspired by Ethereum's Solidity language, but its functionality is different since the underlying systems have very different fundamentals. See the [language documentation](https://solidcash.org/docs/language/) for a full reference of the language.

## The SolidCash Compiler

SolidCash features a compiler as a standalone command line tool, called `solidc`. It can be installed through npm and used to compile `.scash` files into `.json` (or `.ts`) artifact files. These artifact files can be imported into the SolidCash TypeScript SDK (or other SDKs in the future). The `solidc` NPM package can also be imported inside JavaScript files to compile `.scash` files without using the command line tool.

### Installation

```bash
npm install -g solidc
```

### Usage

```bash
Usage: solidc [options] [source_file]

Options:
  -V, --version          Output the version number.
  -o, --output <path>    Specify a file to output the generated artifact.
  -h, --hex              Compile the contract to hex format rather than a full artifact.
  -A, --asm              Compile the contract to ASM format rather than a full artifact.
  -c, --opcount          Display the number of opcodes in the compiled bytecode.
  -s, --size             Display the size in bytes of the compiled bytecode.
  -f, --format <format>  Specify the format of the output. (choices: "json", "ts", default: "json")
  -?, --help             Display help
```

## The SolidCash SDK

The main way to interact with SolidCash contracts and integrate them into applications is using the SolidCash SDK. This SDK allows you to import `.json` (or `.ts`) artifact files that were compiled using the `solidc` compiler and convert them to `Contract` objects. These objects are used to create new contract instances. These instances are used to interact with the contracts using the functions that were implemented in the `.scash` file. For more information on the SolidCash SDK, refer to the [SDK documentation](https://solidcash.org/docs/sdk/).

### Installation

```bash
npm install solidcash
```

### Usage

```ts
import { Contract, ... } from 'solidcash';
```

Using the SolidCash SDK, you can import contract artifact files, create new instances of these contracts, and interact with these instances:

```ts
...
  // Import the P2PKH artifact
  import P2PKH from './p2pkh-artifact.json' with { type: 'json' };

  // Instantiate a network provider for SolidCash's network operations
  const provider = new ElectrumNetworkProvider('chipnet');

  // Create a new P2PKH contract with constructor arguments: { pkh: pkh }
  const contract = new Contract(P2PKH, [pkh], {provider});

  // Fetch contract utxos
  const contractUtxos = await contract.getUtxos();

  // Log contract output address + contract utxos
  console.log('contract address:', contract.address);
  console.log('contract utxos', contractUtxos);

  // Specify the contract UTXO
  const selectedContractUtxo = contractUtxos[0]

  // Start building the transaction
  // Call the spend function with the owner's signature
  // And use it to send 0. 000 100 00 BCH back to the contract's address
  const txDetails = await new TransactionBuilder({ provider })
    .addInput(selectedContractUtxo, contract.unlock.spend(new SignatureTemplate(keypair)))
    .addOutput({
      to: contract.address,
      amount: 10000n
    })
    .send();

  console.log(txDetails);
```

## Composition conventions and sender binding

A stateful contract compiles under one of two composition conventions, selected by `composition` in
`solidcash.config.ts`:

- **`direct`** (the default) composes several contracts into one transaction with the fewest UTXOs. Its
  `msg.sender` is **not authenticated**: for an external call the emitted check takes the locking bytecode of the
  only co-spent minting token of the category the caller supplies, and never proves that contract made the call
  (audit finding F1); a nested kernel row binds the caller slot by block offset, `require(sourceOffset < ownerSize)`
  (F10). The same convention exposes satoshi and token containers, mapping-entry NFTs, and shared keccak,
  ecrecover, and library side-cars to any spend that co-spends a minting NFT of the contract category or that
  reaches the side-car's public lock. Those holes do not need `msg.sender`. Do not treat `msg.sender` as an
  authorization check under this convention - use a signature (`checkSig`) or a framed contract instead.
  Current findings and fix status are in `docs/security/security-audit-2026-10-16.md`; the earlier
  `docs/framed/TRIAGE_SECURITY.md` is the 2026-10-05 snapshot of the same findings.
- **`framed`** binds the sender on chain at the validator (V5 in `packages/solidc/src/framed/.../validator/program.ts`;
  master head at `master-head.ts`), at the cost of a larger deployment (one UTXO per master and validator, 12
  masters and 4 validators by default) and larger scripts.

Size is the practical limit for both. The marketplace-scale fixture exceeds the BCH per-input script limit of
10,000 bytes - 7 of its 19 compiled artifacts do, and a composed call's largest unlocking script measures 24,937
bytes - so its lanes run against a mock network with relaxed limits and only two small applications are proven on
a real regtest node. Current mock-versus-real limits and the relaxed-node path are in
`docs/marketplace/bchn-marketplace-consensus-relaxation.md`; the matrix runs are in
`docs/marketplace/marketplace-matrix-2026-10-14.md`. The 2026-10 snapshots `docs/framed/REGTEST_AT_HEAD.md` and
`docs/framed/PERF_KERNEL_VS_FRAMED.md` hold the detailed measurements. Treat this release as a **mocknet beta**
for anything at marketplace scale.

## Examples

If you want to see SolidCash in action and check out its usage, there are several example contracts in the [`examples/`](/examples) directory. The `.scash` files contain example contracts, and the `.ts` files contain example usage of the SolidCash SDK to interact with these contracts.

The "Hello World" of SolidCash contracts is defining the P2PKH pattern inside a contract, which can be found under [`examples/p2pkh.scash`](/examples/p2pkh.scash). Its usage can be found under [`examples/p2pkh.ts`](/examples/p2pkh.ts).

### Running the examples

To run the examples, clone this repository and navigate to the `examples/` directory. Since the examples depend on the SDK, be sure to run `npm install` or `yarn` inside the `examples/` directory, which installs all required packages.

```bash
git clone git@github.com:solidcash/solidcash.git
cd solidcash/examples
npm install
```

All `.ts` files in the [`examples/`](/examples) directory can then be executed with `tsx`.

```bash
npm install -g tsx
tsx p2pkh.ts
```

All `.js` files can be executed with `node`.

```bash
node p2pkh.js
```
