# Current implementation plan

This plan covers the next SolidHat compatibility work. It deliberately excludes Viem, Wagmi, ABI projection, BCH
public clients, and WalletConnect. Those subjects are preserved as [future research](./viem-wagmi-research.md),
but do not block or expand this scope.

## Principles

- Preserve the current SolidCash ABI unless TypeChain work finds a separately justified defect.
- Generate types from artifacts through an internal model; do not depend on a Viem ABI projection.
- Keep Ethers 5 and Ethers 6 targets separate and tree-shakeable.
- Treat generated directories as compiler-owned, incremental outputs.
- Validate against existing EACC Hardhat tests and scripts.

## P0: artifact inventory and TypeChain requirements

1. Inventory artifact data for constructors, functions, structs, arrays, events, errors, state, lifecycle, selectors,
   and source identity.
2. Inventory TypeChain imports and runtime factory uses in `examples/effectiveacceleration`.
3. Define the minimum internal model needed to generate those types without changing the public ABI.
4. Diagnose unsupported or ambiguous SolidCash constructs explicitly.
5. Add fixtures for overloads, nested tuples/arrays, aliases, enums, events, errors, and stateful contracts.

## P1: incremental generator framework

1. Add a target-independent artifact-to-TypeScript generator interface.
2. Key output by artifact hash, generator/target versions, relevant configuration, and layout.
3. Atomically replace only the configured generated tree and remove its stale files.
4. Preserve source paths to disambiguate equal contract names.
5. Add `typegen` configuration and a command, then generate after successful compilation.

```ts
export default defineConfig({
  typegen: {
    targets: [{ target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' }],
  },
});
```

## P2: SolidCash-native typed contracts

1. Generate constructors, functions, returns, structs, tuples, events, errors, and state types.
2. Generate typed SolidCash contract and factory bases before compatibility layouts.
3. Generate contract-name maps so HRE string lookup preserves known types.
4. Type SolidCash state and lifecycle operations without forcing them into EVM concepts.
5. Verify generated modules are side-effect free.

## P3: TypeChain-compatible targets

1. Emit familiar `typechain-types/contracts`, `factories`, `common.ts`, and barrel layouts.
2. Implement Ethers 6-compatible contracts and `__factory` exports first.
3. Implement Ethers 5 as a separate emitter and entry point.
4. Support `abi`, `createInterface()`, `connect()`, typed deployment, events, filters, and errors where semantics map.
5. Keep runtime behavior SolidCash-native; factories never encode or deploy EVM bytecode.

## P4: fixture migration and hardening

1. Replace handwritten EACC TypeChain stand-ins with generated output.
2. Type-check and execute applicable EACC tests, fixtures, and deployment scripts.
3. Add deterministic snapshot/API tests under Ethers 5 and Ethers 6.
4. Test collisions, stale output, rollback, cache invalidation, and bundle isolation.
5. Document unsupported compatibility cases and migration guidance.

## Completion criteria

- EACC needs no handwritten TypeChain stand-ins.
- Ethers 5 and Ethers 6 targets type-check independently.
- Factories and HRE lookup execute through the SolidCash runtime.
- Incremental generation changes only affected outputs.
- Compile-only users load no Ethers, React, Viem, Wagmi, or WalletConnect code.
- The SolidCash ABI remains unchanged unless a separately reviewed change is necessary.
