# Viem, Wagmi, and BCH WalletConnect research

> **Research status:** this records design findings only. ABI projection, Viem clients/actions, Wagmi adapters,
> and WalletConnect are excluded from the current SolidHat implementation plan. Nothing here is a scheduled public
> API.

The motivating application is `effectiveacceleration.ai/website`, while the incomplete sibling `wagmi-test`
experiment explores conformant BCH chains, Electrum transports, typed RPC schemas, client extensions,
subscriptions, accounts, and wallet actions.

## Goals

- Preserve Hardhat, Ethers, TypeChain, Viem, and Wagmi patterns where their semantics map safely to BCH.
- Keep BCH identities, UTXOs, CashTokens, fees, transactions, and signing explicit at protocol boundaries.
- Use BCH WalletConnect v2 namespaces and methods; do not require MetaMask or EIP-1193 injection.
- Generate every typed integration from one versioned contract schema.
- Keep optional integrations independently importable and tree-shakeable.
- Diagnose EVM operations that have no safe BCH equivalent.

## Architecture and ownership

```text
.scash sources
  -> solidc semantic model
  -> versioned SolidCash contract schema
       -> canonical artifact and ABI
       -> TypeChain-compatible Ethers bindings
       -> readonly Viem/Wagmi ABI modules
  -> SolidCash runtime
       -> BCH public client and Electrum/Chaingraph transports
       -> Viem-style contract actions
       -> Wagmi-compatible core and React adapters
       -> BCH WalletConnect v2 signing connector
```

| Layer | Responsibility |
| --- | --- |
| Compiler schema | Types, functions, errors, events, state, selectors, and BCH metadata |
| SolidHat | Compilation, caching, artifacts, generation, configuration, and migration |
| TypeChain target | Ethers tests, scripts, factories, and contract-instance compatibility |
| BCH public client | Reads, subscriptions, UTXOs, CashTokens, fees, broadcast, and confirmation |
| Viem target | Typed clients/actions following Viem composition and inference |
| Wagmi adapter | Connector state, TanStack Query behavior, and React hooks |
| WalletConnect connector | BCH sessions, accounts, capabilities, and wallet-authorized signing |

WalletConnect is not the chain-data provider. Reads and broadcast use the BCH public client; the wallet supplies
accounts, authorization, and signatures.

## ABI projection without changing SolidCash ABI

The preferred experiment preserves the canonical SolidCash ABI. A generator projects only the information Wagmi
and ABIType consume into conventional entries: names, inputs, outputs, mutability, tuples, arrays, events, errors,
constructors, selectors, and getter-shaped entries for public state variables.

This readonly projection can enable inference without changing the compiler ABI. It does **not** contain enough
execution information to construct a SolidCash transaction and does not authorize EVM calldata encoding.

### Type projection

| SolidCash type | ABI projection |
| --- | --- |
| `bool`, `string`, `bytes`, `bytes1` through `bytes32` | unchanged |
| `int`, `uint` | `int256`, `uint256` |
| bounded integers | matching `intN` or `uintN` |
| struct | `tuple` with `components` |
| fixed/dynamic arrays | matching ABI array notation |
| enum | selected unsigned integer representation |

Lossy or BCH-specific types preserve their meaning in `internalType` and versioned SolidCash metadata:

| SolidCash type | ABI-safe projection | Reason |
| --- | --- | --- |
| `pubkey`, `sig`, `datasig` | `bytes` | Protocol-specific representations |
| BCH `address` | `bytes` | Locking bytecode is not an EVM 20-byte address |
| `bigint` | `bytes` | Not bounded to an EVM integer width |
| fixed-point | selected integer type | Scale and signedness require metadata |
| contract/category locator | `bytes32` or `bytes` | Depends on locator kind |

Mappings, persistent arrays, lifecycle modifiers, state layout, CashToken containers, bytecode, and debug data
remain in the unmodified SolidCash artifact rather than being forced into the projected ABI.

### Encoding boundary

Generic tools may inspect a generated readonly ABI. Execution consumes the complete artifact through SolidCash
actions and the BCH stack encoder. Viem's EVM `encodeFunctionData` must never silently encode a SolidCash call.

```ts
export const counterAbi = [/* compatible entries */] as const;
export const counterArtifact = {/* ABI plus SolidCash metadata */} as const;
```

Schema validation and negative tests must reject accidental EVM addresses, calldata, gas fields, and unsupported
RPC methods.

## One generator, multiple targets

Artifacts are normalized once and fed to target emitters; independent TypeChain and Viem parsers would drift.

```ts
export default defineConfig({
  typegen: {
    targets: [
      { target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' },
      { target: 'viem', outDir: 'wagmi' },
    ],
  },
});
```

Generation is incremental. Cache keys include schema fingerprint, target/version, generator version, relevant
configuration, and layout. Successful generation atomically replaces only its owned output tree.

### TypeChain target

The TypeChain layout serves Ethers tests, fixtures, scripts, and backend code:

```text
typechain-types/
  common.ts
  contracts/Counter.ts
  factories/contracts/Counter__factory.ts
  index.ts
```

It provides typed constructors, functions, outputs, structs, tuple accessors, events, filters, custom errors,
`createInterface()`, `__factory.abi`, `connect()`, deployment, and typed contract-name maps. Ethers 5 and Ethers 6
are distinct targets. Factories call SolidCash runtime code and never deploy EVM bytecode.

### Viem clients and contract actions

The BCH layer follows Viem's extension model: chain definitions, RPC schemas, transports, clients, decorators,
and standalone actions. The incomplete `wagmi-test` experiment—Electrum transport, subscriptions, BCH accounts,
and `client.extend(actions)`—is the initial fixture.

Public actions cover blocks, balances, UTXOs, CashTokens, subscriptions, fees, transactions, broadcast, and
confirmation. Contract actions add `readContract`, `simulateContract`, `writeContract`, `deployContract`, lifecycle
operations, event decoding, and `getContract`.

Viem-shaped values are retained only when truthful. BCH contract locators must not be typed as Viem's 20-byte
`Address`; fees and confirmations must not be disguised as gas and EVM receipts.

### Wagmi portability

The adapter targets configuration, connector state, stable TanStack Query keys/invalidation, and hooks actually
used by `effectiveacceleration.ai/website`: account/connect/disconnect, balances, contract reads, simulation,
writes, confirmation waiting, and watchers. Unsupported EVM options produce migration diagnostics. Coverage grows
from measured application needs rather than cloning unused Wagmi APIs.

### BCH WalletConnect v2

The connector implements established BCH namespaces and methods for proposal, approval, restoration, update,
expiry, disconnect, accounts, networks, capabilities, message signing, transaction signing, and change events. It
validates returned transactions against authorized requests. QR/deep-link presentation remains separate from the
protocol connector.

## Package and tree-shaking rules

SolidHat invokes generators and writes configuration; it must not pull React, Wagmi, Viem, WalletConnect, or
Ethers into compile-only applications. Integrations use explicit entry points/packages, optional peers,
`sideEffects: false`, and type-only imports. Dependencies flow from schema to TypeChain/Viem, then from Viem to
Wagmi and WalletConnect—never back into the compiler.

## Open research questions

- Can ABIType infer every representable tuple, array, overload, event, and error without widening types?
- Which state variables should become getter-shaped entries, and which require SolidCash-only state APIs?
- Can Wagmi core be adapted safely, or is a source-compatible `@solidcash/wagmi` surface preferable?
- What stable BCH locator covers locking bytecode, category IDs, networks, and evolving state?
- Which BCH WalletConnect v2 methods and capabilities interoperate across the target wallets?
- Which result shapes remain portable without misrepresenting fees, confirmations, or replacement?

These questions should be answered with `wagmi-test` and the EACC website before packages or timelines are
proposed.
