# SolidCash

[![Build Status](https://github.com/CashScript/cashscript/actions/workflows/github-actions.yml/badge.svg)](https://github.com/CashScript/cashscript/actions/workflows/github-actions.yml)
[![Coverage Status](https://img.shields.io/codecov/c/github/CashScript/cashscript.svg)](https://codecov.io/gh/CashScript/cashscript/)
[![NPM Version](https://img.shields.io/npm/v/solidcash.svg)](https://www.npmjs.com/package/solidcash)
[![NPM Monthly Downloads](https://img.shields.io/npm/dm/solidcash.svg)](https://www.npmjs.com/package/solidcash)
[![NPM License](https://img.shields.io/npm/l/solidcash.svg)](https://www.npmjs.com/package/solidcash)

SolidCash is a high-level programming language for smart contracts on Bitcoin Cash. It offers a strong abstraction layer over Bitcoin Cash' native virtual machine, Bitcoin Script. Its syntax is based on Ethereum's smart contract language Solidity, but its functionality is very different since smart contracts on Bitcoin Cash differ greatly from smart contracts on Ethereum. For a detailed comparison of them, refer to the blog post [*Smart Contracts on Ethereum, Bitcoin and Bitcoin Cash*](https://kalis.me/smart-contracts-eth-btc-bch/).

See the [GitHub repository](https://github.com/CashScript/cashscript) and the [SolidCash website](https://solidcash.org) for full documentation and usage examples.

## The SolidCash Language
SolidCash is a high-level language that allows you to write Bitcoin Cash smart contracts in a straightforward and familiar way. Its syntax is inspired by Ethereum's Solidity language, but its functionality is different since the underlying systems have very different fundamentals. See the [language documentation](https://solidcash.org/docs/language/) for a full reference of the language.

## The SolidCash Compiler
SolidCash features a compiler as a standalone command line tool, called `solidc`. It can be installed through npm and used to compile `.scash` files into `.json` (or `.ts`)artifact files. These artifact files can be imported into the SolidCash TypeScript SDK (or other SDKs in the future). The `solidc` NPM package can also be imported inside JavaScript files to compile `.scash` files without using the command line tool.

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
