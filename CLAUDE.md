# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SolidCash is a high-level language for Bitcoin Cash smart contracts. The repository is a monorepo with three packages under `packages/`:

- **solidc** — Compiler: `.scash` source → artifact (JSON/TS with bytecode)
- **solidcash** — TypeScript SDK: artifact → contract interaction → transactions
- **@solidcash/utils** — Shared types, bytecode utilities, optimizations

## Common Commands

```bash
# Install all dependencies (also runs bootstrap + build via postinstall)
yarn

# Build all packages (required after code changes to propagate across packages)
yarn build

# Run all tests
yarn test

# Run specific tests by describe/it block name
yarn test -t 'Transaction Builder'

# Run SDK tests against real chipnet (default is local mocknet)
TESTS_USE_CHIPNET=true yarn test

# Run SDK tests against a local regtest node (requires the docker stack, see "Regtest test stack")
yarn test:regtest

# Lint all packages
yarn lint

# Test coverage (90%+ target for PRs)
yarn test --coverage

# Regenerate ANTLR parser after grammar changes (run from packages/solidc)
yarn antlr
```

### Regtest test stack

`TESTS_USE_REGTEST=true` points the SDK e2e tests at a local BCHN regtest node + Fulcrum indexer,
started via `docker-compose.regtest.yml`:

```bash
# Start the stack (skip the `explorer` service: it builds a local image and tests do not need it)
docker compose -f docker-compose.regtest.yml up -d bchn fulcrum miner

# Ready when BCHN is at height 200 (the `miner` pre-mines for coinbase maturity) and Fulcrum logs
# "Block height 200, up-to-date" (port 50003). Then run the regtest suite. test:regtest sets
# --no-file-parallelism: the tests share one node, so parallel files cause mempool conflicts.
yarn test:regtest

# Tear down (add -v to also wipe chain state)
docker compose -f docker-compose.regtest.yml down
```

- `RegtestNetworkProvider` defaults match the compose: RPC `localhost:18443` (user/password), Electrum
  `localhost:50003`. Override via `REGTEST_RPC_URL`, `REGTEST_RPC_USER`, `REGTEST_RPC_PASSWORD`,
  `REGTEST_ELECTRUM_HOST`, `REGTEST_ELECTRUM_PORT`.
- If Fulcrum loops on "Possible reorg, will rewind ..." or exits on startup, the `bchn-data` /
  `fulcrum-data` volumes are stale and out of sync. Reset with
  `docker compose -f docker-compose.regtest.yml down -v` and restart.

## Architecture

### Compiler Pipeline (`packages/solidc/src/compiler.ts`)

`.scash` source -> Lexer/Parser (ANTLR4) -> AST -> ordered lowering passes -> semantic analysis -> code generation
-> bytecode optimization -> artifact

1. **Lexing/parsing**: ANTLR4-generated from `packages/solidc/src/grammar/SolidCash.g4`; `AstBuilder` converts the
   parse tree to the SolidCash AST.
2. **Import/type repair**: imports are resolved and imported placeholder types are re-resolved.
3. **Ordered lowering**: `compiler.ts` runs many order-sensitive transformations for inheritance, modifiers,
   control flow, memory/Yul, storage pointers, arrays/mappings, function pointers, external calls, libraries,
   block oracles, and Solidity-compatibility forms. Read the adjacent ordering comments before moving a pass.
4. **Semantic analysis**: `SymbolTableTraversal`, `TypeCheckTraversal`, and `EnsureFinalRequireTraversal` assign
   symbols/layout and validate the lowered program. The final-require check warns by default and errors when
   `enforceFinalRequire` is enabled.
5. **Safety lowering**: `InjectLocktimeGuardTraversal` adds the anti-malleability guard when enabled, followed by
   `EarlyReturnTransformation` for balanced stack-oriented returns.
6. **Code generation**: `GenerateTargetTraversal` emits Bitcoin Script plus source/debug metadata.
7. **Optimization**: `optimiseBytecode` produces emitted bytecode; `optimiseBytecodeOld` remains a compatibility
   oracle for scripts below the configured operation threshold.
8. **Artifact generation**: emits bytecode, ABI execution metadata, state/block layouts, function bodies, source,
   debug information, fingerprint, and referenced-contract data.

Most transformations use the visitor framework in `AstVisitor.ts`; several expansion helpers operate outside that
simple three-pass model. AST nodes are defined in `packages/solidc/src/ast/AST.ts`.

### SDK (`packages/solidcash/src/`)

- `Contract` — Instantiates from artifact + constructor args, generates address/locking bytecode, exposes `unlock` functions
- `TransactionBuilder` — Fluent API: `.addInput()` → `.addOutput()` → `.send()`
- `SignatureTemplate` — Signing template for P2PKH patterns
- Network providers in `src/network/`: `ElectrumNetworkProvider`, `MockNetworkProvider`, `FullStackNetworkProvider`, `BitcoinRpcNetworkProvider`

### Utils (`packages/utils/src/`)

Shared across compiler and SDK: artifact types, ABI types, type system, script ↔ ASM/hex conversion, bytecode optimization, source map generation.

## Code Style

- ESM throughout (`type: "module"`) — file extensions required in imports (`import/extensions: 'error', 'ignorePackages'`)
- Max line length: 125 characters
- Explicit return types on functions (`@typescript-eslint/explicit-function-return-type`)
- Unused variables prefixed with `_` are allowed
- TypeScript strict mode enabled

## Testing Structure

- **Compiler tests** (`packages/solidc/test/`): compilation fixtures, AST tests, code generation tests, error case tests organized by error type
- **SDK tests** (`packages/solidcash/test/`): contract instantiation, transaction building, e2e tests per contract type, network provider tests
- Test framework: Vitest with projects-based monorepo config
