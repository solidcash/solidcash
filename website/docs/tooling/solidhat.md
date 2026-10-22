---
title: SolidHat Projects
---

`@solidcash/solidhat` is the recommended project toolchain for SolidCash applications. It adds whole-project
compilation, incremental caching, namespaced artifacts, generated TypeChain-compatible bindings, an in-process
test network, and Hardhat/Ethers compatibility without taking ownership of an existing EVM project.

SolidHat requires Node.js 22 or newer and an ESM or TypeScript project.

## Create a project

```sh
npm create @solidcash/solidhat@latest my-project
cd my-project
npm run solidhat:test
```

The initializer creates `solidcash.config.ts`, an isolated Vitest configuration, package scripts, ignore rules,
and—unless you select `empty`—a sample contract and test.

```sh
npm create @solidcash/solidhat@latest my-project -- \
  --template typescript \
  --package-manager npm \
  --hardhat 3 \
  --ethers 6
```

Templates are `typescript`, `javascript`, and `empty`. Useful automation flags are:

- `--yes` accepts the detected defaults.
- `--no-install` writes the project without installing packages.
- `--dry-run` prints the planned file operations.
- `--force` permits replacement of conflicting SolidHat-owned files.

## Add SolidHat to an existing project

Run the initializer at the project root:

```sh
npx @solidcash/solidhat --init --dry-run
npx @solidcash/solidhat --init
```

SolidHat detects `hardhat.config.*`, the package manager, and installed Hardhat/Ethers majors. Migration is
additive:

- Solidity sources, EVM tests, Hardhat configuration, and existing package scripts are preserved.
- SolidCash artifacts live only under `artifacts/solidcash`.
- The SolidCash compile cache lives in `~/.cache/solidcash`, outside the project.
- SolidCash tests use `vitest.solidhat.config.ts`, separate from the existing runner.
- Existing `README.md` files are never replaced.

The initializer plans all writes before applying them and rolls the plan back if a replacement fails. Use
`--hardhat 2|3` and `--ethers 5|6` when dependency detection is not the compatibility target you want.

## Commands

The generated package scripts call the same CLI commands you can run directly:

| Script | CLI | Purpose |
| --- | --- | --- |
| `solidhat:compile` | `npx solidhat compile` | Compile the complete source graph and publish artifacts atomically |
| `solidhat:typegen` | `npx solidhat typegen` | Generate configured ethers 5/6 bindings from existing artifacts |
| `solidhat:test` | `npx solidhat test [paths...]` | Compile, then run the isolated Vitest suite |
| `solidhat:clean` | `npx solidhat clean` | Remove only SolidCash artifacts, cache, and configured generated bindings |
| — | `npx solidhat doctor` | Diagnose configuration, artifacts, generated output, and migration hazards |

`npx solidhat typegen --watch` watches sources and artifacts. `npx solidhat doctor --json` produces a
machine-readable result for CI or editor integrations.

Compilation is graph-aware and content-addressed. Unchanged roots with the same effective compiler configuration
are restored from cache. New artifacts replace the previous `artifacts/solidcash` tree only after every required
compiler job succeeds, so a failed build cannot publish a partial graph.

## Configuration

```ts title="solidcash.config.ts"
import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: 'contracts',
    tests: 'test',
    artifacts: 'artifacts',
  },
  compiler: {
    evmCompat: true,
  },
  typegen: {
    targets: [
      { target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' },
    ],
  },
  networks: {
    mock: {
      type: 'mock',
      consensus: { maximumInputBytes: 500_000 },
      policy: { enforceDust: false },
    },
  },
  defaultNetwork: 'mock',
});
```

`compiler` is forwarded to `solidc`. The legacy key `solc` is accepted, but new configuration should use
`compiler`. Network types are `mock`, `regtest`, `electrum`, and `bitcoin-rpc`.

Mock consensus and dust-policy overrides exist for test harnesses. They do not change BCH network consensus.
Compile and preflight with real limits before publishing a deployment. In particular, a contract which only fits
under a raised mock `maximumInputBytes` is not thereby mainnet-deployable.

`solidcashConfigSchema` from `@solidcash/solidhat/config` exposes the configuration as JSON Schema.

`paths.cache` defaults to `~/.cache/solidcash`. Compile trusts the entries it finds there as compiled output, so
anyone who can write the cache can substitute artifacts for your sources. A cache inside the project is ignored
unless the config also sets `trustProjectCache: true`; set it only for a checkout no one else writes, never for a
cloned repository, and do not commit the cache.

## Artifacts and generated bindings

Artifacts mirror Hardhat's source/contract structure inside the SolidCash namespace:

```text
artifacts/
  solidcash/
    contracts/
      Counter.scash/
        Counter.json
        Counter.artifact.ts
```

Look up an unambiguous contract by name or use a fully qualified source name:

```ts
import { ethers } from '@solidcash/solidhat/hardhat3';

const Counter = await ethers.getContractFactory('Counter');
const Qualified = await ethers.getContractFactory('contracts/Counter.scash:Counter');
```

If two distinct artifacts share a contract name, the short lookup fails instead of choosing one. Generated
bindings retain the source tree and augment the artifact-name registry so literal contract names infer the
specific artifact type. Regeneration atomically replaces only the configured output directory and removes stale
generated files.

Use `typegen.targets[].sourceDir` when fixture sources were copied from another project but generated imports
should preserve the original source layout.

## Hardhat and Ethers compatibility

SolidHat exposes version-specific entry points:

```ts
import hre2, { ethers as ethersForHh2 } from '@solidcash/solidhat/hardhat2';
import hre3, { network } from '@solidcash/solidhat/hardhat3';
import { BigNumber } from '@solidcash/solidhat/ethers5';
import { toBigInt } from '@solidcash/solidhat/ethers6';

const connection = await network.connect();
```

| Project dependencies | Generated compatibility target |
| --- | --- |
| Hardhat 2 + Ethers 5 | `hardhat2`, `ethers5` |
| Hardhat 2 + Ethers 6 | `hardhat2`, `ethers6` |
| Hardhat 3 + Ethers 6 | `hardhat3`, `ethers6` |
| Neither installed | `hardhat3`, `ethers6` |

The generated Vitest config uses exact-match aliases. This lets imports such as `hardhat`, `chai`, and
`@nomicfoundation/hardhat-network-helpers` resolve to the BCH harness without accidentally redirecting unrelated
subpaths.

The compatibility surface includes `ethers.getSigners()`, `getContractFactory()`, `getContractAt()`,
`deployContract()`, `upgrades`, network helpers, common ethers utilities, and chai-style contract matchers. It is
an ergonomic adapter, not an EVM emulator: balances are UTXOs, addresses are BCH locking-bytecode identities,
time-dependent block globals use an oracle, and account impersonation is unavailable.

## Vitest integration

The generated `vitest.solidhat.config.ts` initializes the runtime and adds aliases for the chosen compatibility
pair. For a custom config:

```ts title="vitest.solidhat.config.ts"
import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

export default defineConfig(solidhatPreset(
  { hardhat: 3, ethers: 6 },
  { test: { include: ['test/**/*.test.ts'] } },
));
```

Run this configuration through `solidhat test`; a native Hardhat suite can continue using its original runner.
See [Testing Framework](./testing-framework.md) for the underlying HRE, fixtures, time helpers, and matcher
semantics.

## Programmatic initialization

```ts
import { initializeProject } from '@solidcash/solidhat';

const result = initializeProject({
  cwd: process.cwd(),
  dryRun: true,
  compatibility: { hardhat: 3, ethers: 6 },
});
```

The result reports created, updated, and unchanged paths, detected compatibility versions, whether a Hardhat
project was found, and package-installation status. This is useful for IDEs and higher-level scaffolding tools.

## Ownership and cleanup

SolidHat deliberately owns a small namespace. `clean` removes `artifacts/solidcash`, the cache's `solidcash` directory, and the
configured type-generation directories; it does not delete EVM artifacts or arbitrary project files. Keep
generated directories dedicated to SolidHat so this ownership rule remains unambiguous.
