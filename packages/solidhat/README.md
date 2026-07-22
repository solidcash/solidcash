# @solidcash/solidhat

Hardhat-style project tooling for SolidCash. SolidHat adds whole-project compilation, incremental caching,
namespaced artifacts, a task runner, and compatibility entry points for Hardhat and Ethers test suites.

See the [current implementation plan](./docs/implementation-plan.md) for the scoped TypeChain work. Viem, Wagmi,
ABI projection, and BCH WalletConnect findings are recorded as [future research](./docs/viem-wagmi-research.md)
and are not part of that plan.

## Requirements

- Node.js 22 or newer
- npm, Yarn, or pnpm
- A project using ESM or TypeScript

## Create a project

```sh
npm create @solidcash/solidhat@latest my-project
cd my-project
npm run solidhat:test
```

The initializer creates a SolidCash config, an isolated Vitest config, package scripts, ignore rules, and—unless
the `empty` template is selected—a sample contract and test.

```sh
npm create @solidcash/solidhat@latest my-project -- \
  --template typescript \
  --package-manager npm \
  --hardhat 3 \
  --ethers 6
```

Templates are `typescript`, `javascript`, and `empty`. Add `--yes` for defaults, `--no-install` to defer dependency
installation, or `--dry-run` to preview the file plan.

## Add SolidHat to an existing project

Run the initializer from the project root:

```sh
npx @solidcash/solidhat --init
```

SolidHat detects `hardhat.config.*`, the package manager, and declared Hardhat/Ethers dependency majors. Injection
is additive:

- `hardhat.config.*`, Solidity sources, EVM tests, and existing scripts are preserved.
- Existing EVM artifacts remain in `artifacts`; SolidCash owns only `artifacts/solidcash`.
- Existing cache data remains in `cache`; SolidCash owns only `cache/solidcash`.
- A separate `solidcash.config.ts` and `vitest.solidhat.config.ts` are created.
- Existing `README.md` files are never replaced.

Use `--dry-run` before modifying a mature repository. SolidHat refuses to replace conflicting SolidHat-owned files
unless `--force` is supplied, and all planned writes are rolled back if any replacement fails.

```sh
npx @solidcash/solidhat --init --dry-run
npx @solidcash/solidhat --init --hardhat 2 --ethers 5 --no-install
```

## Commands

The initializer adds namespaced package scripts:

```sh
npm run solidhat:compile
npm run solidhat:typegen
npm run solidhat:test
npm run solidhat:clean
```

The CLI can also be invoked directly:

```sh
npx solidhat compile
npx solidhat typegen
npx solidhat typegen --watch
npx solidhat doctor
npx solidhat test
npx solidhat clean
```

When `typegen.targets` are configured, `solidhat compile` updates TypeChain-compatible bindings after artifacts are committed. `solidhat typegen` regenerates them from existing artifacts. Generation is content-addressed and atomically replaces only its configured output directory.

`solidhat doctor` performs a read-only check of configured paths, namespaced artifacts, unsafe or colliding
type-generation outputs, and manually added files in generated trees. Use `--json` in CI or editor integrations.
The exported `solidcashConfigSchema` provides the same configuration surface as JSON Schema.

`solidhat test` compiles the project first, matching Hardhat's normal test workflow. Compilation resolves the full
source dependency graph, reuses cached roots whose content and effective compiler configuration are unchanged,
and replaces the SolidCash artifact tree only after every compiler job succeeds.

## Configuration

```ts
// solidcash.config.ts
import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: 'contracts',
    tests: 'test',
    artifacts: 'artifacts',
    cache: 'cache',
  },
  compiler: {
    solidityImportCompat: true,
  },
  typegen: {
    targets: [{ target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' }],
  },
  networks: {
    mock: { type: 'mock' },
  },
  defaultNetwork: 'mock',
});
```

`typegen.targets[].sourceDir` can preserve an original Solidity source layout when the compiled fixture sources live elsewhere (for example, lightweight BCH test stubs). It affects generated module paths only; artifacts remain the source of runtime data and types.

Compiler options are forwarded to `solidc`. A Hardhat config containing an explicit `solidcash` section remains
supported, but a standalone SolidCash config is recommended because it avoids changing the EVM toolchain.

## Compatibility entry points

Compatibility generations are deliberately separate so applications and bundlers load only the requested API:

```ts
import hre2, { ethers as hardhat2Ethers } from '@solidcash/solidhat/hardhat2';
import hre3, { network } from '@solidcash/solidhat/hardhat3';
import { BigNumber } from '@solidcash/solidhat/ethers5';
import { toBigInt } from '@solidcash/solidhat/ethers6';

const connection = await network.connect(); // Hardhat 3-style connection
```

`--init` writes exact-match Vitest aliases for the detected pair. Exact matching is important: redirecting the
root `ethers` import must not redirect internal imports such as `ethers/abi`.

| Project dependencies | Generated entry points |
| --- | --- |
| Hardhat 2 + Ethers 5 | `hardhat2`, `ethers5` |
| Hardhat 2 + Ethers 6 | `hardhat2`, `ethers6` |
| Hardhat 3 + Ethers 6 | `hardhat3`, `ethers6` |
| No existing versions | `hardhat3`, `ethers6` |

Override detection with `--hardhat 2|3` and `--ethers 5|6`.

## Artifacts and factories

Artifacts follow the Hardhat source/contract layout within the SolidCash namespace:

```text
artifacts/
  solidcash/
    contracts/
      Counter.scash/
        Counter.json
```

Factories resolve from that namespace:

```ts
import { ethers } from '@solidcash/solidhat/hardhat3';

const Counter = await ethers.getContractFactory('Counter');
const QualifiedCounter = await ethers.getContractFactory('contracts/Counter.scash:Counter');
```

Fully-qualified names disambiguate contracts which share a name. Generated TypeChain modules retain the source
tree and export all contracts declared in a source file; stale files are removed by atomic regeneration.

`solidhat clean` removes only `artifacts/solidcash` and `cache/solidcash`.

## Vitest integration

The generated `vitest.solidhat.config.ts` applies generation-specific aliases and initializes the SolidCash test
runtime. Run it through `solidhat test`; native Hardhat tests can continue using their existing runner and config.

For a custom Vitest configuration:

```ts
import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

export default defineConfig(solidhatPreset(
  { hardhat: 3, ethers: 6 },
  { test: { include: ['test/**/*.test.ts'] } },
));
```

## Programmatic initialization

```ts
import { initializeProject } from '@solidcash/solidhat';

const result = initializeProject({
  cwd: process.cwd(),
  dryRun: true,
  compatibility: { hardhat: 3, ethers: 6 },
});
```

The returned plan reports created, updated, and unchanged files, detected compatibility versions, installation
status, and whether a Hardhat project was detected.

## Tree shaking

`@solidcash/solidhat` declares `sideEffects: false`. Configuration, initialization, Vitest integration, and each
Hardhat/Ethers generation are independent export-map entry points. The initializer does not load the compiler,
network runtime, or compatibility shims; task runtime modules are loaded only when a task is executed.
