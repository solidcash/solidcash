# Compatibility architecture and roadmap

SolidHat aims to move existing Hardhat applications to Bitcoin Cash without immediately rewriting their tests,
deployment scripts, and browser integrations. TypeScript API compatibility does not imply EVM execution or EVM
wire encoding. Items in this document are planned until their entry points are exported as public API.

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

## ABI convergence: the foundation

ABI convergence comes first because TypeChain, Viem, Wagmi, documentation, and explorers all depend on it.
Where semantics overlap, the canonical ABI uses conventional fields: `type`, `name`, `inputs`, `outputs`,
`stateMutability`, tuple `components`, event `indexed`, constructors, functions, events, errors, and deterministic
canonical selector types.

This structure enables ABIType/Viem inference. It does **not** authorize an EVM ABI encoder to construct
SolidCash unlocking bytecode.

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

Mappings, persistent arrays, lifecycle modifiers, state layout, and CashToken containers live in a versioned
`solidcash` artifact section or `x-solidcash` ABI extensions.

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

## Implementation priority

### P0: schema and ABI convergence

1. Inventory artifacts and define the normalized, versioned schema.
2. Specify types, tuples, mutability, events, errors, constructors, selectors, and BCH extensions.
3. Update compiler emission with schema validation and fixtures for every type/member.
4. Verify ABIType/Viem inference and enforce the EVM-encoding boundary.

This blocks all reliable generated shims and therefore comes first.

### P1: generator framework and TypeChain targets

1. Build the shared artifact-to-TypeScript IR and incremental generator.
2. Emit SolidCash-native typed contracts/factories.
3. Add TypeChain-compatible Ethers 6 output, then Ethers 5.
4. Connect generated name maps to SolidHat HRE helpers.
5. Replace EACC's handwritten TypeChain stand-ins and type-check its tests/scripts.

TypeChain validates the complete contract model before React and wallet lifecycle are introduced.

### P2: Viem ABI target and BCH public client

1. Emit readonly `as const` ABI/artifact modules.
2. Promote `wagmi-test` chain, transport, schemas, accounts, subscriptions, and actions into tested modules.
3. Add contract read, simulation, write, deployment, lifecycle, and confirmation actions.
4. Keep Viem optional and enforce per-entry-point bundle isolation.

### P3: BCH WalletConnect v2 connector

1. Implement BCH session/capability mapping.
2. Connect simulation to wallet signing, validate responses, and broadcast through the public client.
3. Test restoration, rejection, expiry, account/network changes, malformed responses, and real-wallet interop.

### P4: Wagmi core and React shims
