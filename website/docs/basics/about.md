---
title: What is SolidCash?
sidebar_label: About SolidCash
---

SolidCash is a high-level smart contract language for Bitcoin Cash that brings near-complete Solidity feature parity to the BCH ecosystem. It is designed to let **EVM developers feel at home** - if you can write Solidity, you can write SolidCash.

SolidCash comes with a powerful TypeScript SDK for creating, debugging and testing smart contract transactions on BCH. The SDK has an integrated networkProvider API to fetch data from the BCH blockchain. With all this functionality, the Typescript SDK makes it easy to use SolidCash contracts in applications in the browser or on the server in a type-safe way.

:::tip
To see what kind of things can be built with SolidCash, you can look at the [Showcase](/docs/showcase) or [Examples](/docs/language/examples).

To just dive into SolidCash, refer to the [Getting Started page](/docs/basics/getting-started).
:::

## SolidCash and CashScript

SolidCash is a **fork of CashScript** - but it is not CashScript anymore. It is a leap forward.

CashScript is a lower-level language that maps closely to BCH Script capabilities. It serves its purpose well for developers who want fine-grained control over Bitcoin Cash opcodes and covenant construction. SolidCash takes a fundamentally different approach: instead of exposing the UTXO model's complexity, it abstracts it away behind familiar Solidity patterns so that the vast pool of EVM developers can transition to Bitcoin Cash without learning an entirely new programming paradigm.

### What SolidCash adds beyond CashScript

SolidCash introduces features that do not exist in CashScript and that close the gap between Ethereum and Bitcoin Cash:

- **Stateful contracts** - persistent state via CashToken NFT commitments, with mappings, dynamic arrays, and structs
- **Full inheritance** - single, multiple, and diamond inheritance with `virtual`/`override`, abstract contracts, and interfaces with EIP-165-style `interfaceId`
- **Custom modifiers** - reusable `modifier` blocks with `_` placeholders, just like Solidity
- **Events** - `event` definitions and `emit` statements, stored as persistent on-chain NFTs
- **Custom errors & revert** - structured `error` types with `revert ErrorName(args)`
- **Enums with custom values** - `enum Priority { LOW = 1, HIGH = 10 }`
- **Fixed-point decimals** - `fixed128x18` with full arithmetic (Solidity declared this type but never implemented it)
- **Mapping iteration** - `for (key, value of mapping.entries)` - impossible in Solidity
- **Switch statements, unchecked blocks, using-for, try-catch**
- **Contract lifecycle** - `deploy`, `upgrade`, `selfdestruct`, `split`/`merge` modifiers
- **Delegatecall & proxy patterns** - upgradeable contract architecture
- **Cross-contract calls** - external state reads and function calls via interfaces
- **ABI encoding** - `abi.encode`, `abi.decode`, `abi.encodeWithSelector`, `abi.encodeCall`
- **Token containers** - native CashToken FT/NFT management within contracts
- **Test matchers** - `toEmit`, `toBeReverted`, `toFailRequireWith` for Vitest/Jest

### Our relationship with CashScript

SolidCash and CashScript serve different audiences. CashScript is a solid foundation for developers who prefer working closer to the metal. SolidCash is for developers who want the productivity and familiarity of Solidity without sacrificing the benefits of Bitcoin Cash's UTXO model - low fees, instant confirmations, and native tokens.

The CashScript project is welcome to port back any of our innovations at whatever pace they choose. We believe a rising tide lifts all boats, and BCH benefits from having multiple smart contract languages at different abstraction levels.

## Why Bitcoin Cash?

Smart contracts on Bitcoin Cash differ from Ethereum in several important ways. You can read more on the ['About Bitcoin Cash' page](./about-bch.md). The key advantages:

- **No gas fees** - flat per-byte transaction fees, orders of magnitude cheaper than Ethereum
- **Instant confirmations** - transactions are usable in seconds (0-conf), finalized in ~10 minutes
- **Native tokens** - CashTokens (FT + NFT) are a protocol-level feature, not smart contracts
- **Arbitrary-precision integers** - no 256-bit overflow concerns (since May 2025 BigInt activation)
- **Transaction introspection** - contracts can inspect all inputs and outputs, enabling covenant patterns impossible on Ethereum
