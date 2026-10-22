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
- Existing cache data in `cache` is untouched; the SolidCash compile cache lives in `~/.cache/solidcash`.
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

## Deployment scripts

SolidHat follows Hardhat's network-selected script workflow. `deploy` compiles and runs `scripts/deploy.ts` or
`scripts/deploy.js` by default; `run` accepts any script path. `--network` may appear before or after the task:

```sh
solidhat deploy --network regtest
solidhat run scripts/deploy-marketplace.ts --network chipnet
solidhat --network mainnet deploy scripts/deploy-production.ts
```

Scripts import the generation-specific runtime and use ordinary factories:

```ts
import { ethers, network } from '@solidcash/solidhat/hardhat3';

const [deployer] = await ethers.getSigners(1);
const Factory = await ethers.getContractFactory('Marketplace', deployer);
const contract = await Factory.deploy(/* constructor arguments */);
await contract.waitForDeployment();

console.log(network.name, await contract.getAddress(), contract.deploymentTransaction().txid);
```

Configured mock accounts are funded in-process. A `regtest` network uses BCHN RPC and funds mnemonic-derived
accounts from the node wallet when `accounts.satoshis` is configured. Electrum and generic Bitcoin RPC networks
never create funds; their mnemonic-derived addresses must already be funded. Live networks also require an
explicit `mnemonic`, so SolidHat will not accidentally deploy using its public mock mnemonic. Use environment
variables in `solidcash.config.ts` for mnemonic and RPC credentials, and never commit production secrets.

## Configuration

```ts
// solidcash.config.ts
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
    targets: [{ target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' }],
  },
  mnemonic: process.env.SOLIDCASH_MNEMONIC,
  accounts: { count: 1, satoshis: 100_000_000n },
  networks: {
    mock: {
      type: 'mock',
      // Defaults: 1MB inputs, stack items, and NFT commitments; 10MB transactions.
      consensus: { maximumInputBytes: 500_000 },
      policy: { enforceDust: false },
    },
    regtest: {
      type: 'regtest',
      rpc: {
        url: process.env.REGTEST_RPC_URL ?? 'http://127.0.0.1:18443',
        user: process.env.REGTEST_RPC_USER ?? 'user',
        password: process.env.REGTEST_RPC_PASSWORD ?? 'password',
      },
    },
    chipnet: { type: 'electrum', network: 'chipnet' },
    mainnet: { type: 'electrum', network: 'mainnet' },
  },
  defaultNetwork: 'mock',
});
```

Mock consensus and relay-policy overrides are test-harness-only. Real network providers retain BCH limits. The
compiler uses the active input and NFT commitment limits for sharding and state layout; deployment uses the same
limits for preflight validation. Dust relay policy is disabled on mocknet by default and can be re-enabled above.

`typegen.targets[].sourceDir` can preserve an original Solidity source layout when the compiled fixture sources live elsewhere (for example, lightweight BCH test stubs). It affects generated module paths only; artifacts remain the source of runtime data and types.

`paths.cache` defaults to `~/.cache/solidcash`. Compile trusts its entries as compiled output, so anyone who can
write the cache can substitute artifacts. A cache inside the project is ignored unless the config also sets
`trustProjectCache: true`; never set it for a cloned repository.

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

`solidhat clean` removes only `artifacts/solidcash` and the compile cache's `solidcash` directory.

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

## Offline mode

A ported suite that talks to a live service is not a test. It passes on the machine where the daemon happens to be
running and fails in CI; it returns whatever that service currently holds instead of what the assertion describes;
it spends its time on sockets and retries; and when it goes green you cannot tell whether your code is correct or
the service simply answered.

Offline mode replaces those dependencies with in-process stand-ins, so the suite is hermetic, deterministic, and
fast - and still runs your application code unmodified. It covers three things a ported Hardhat project reaches for:

| what the suite touches | what answers instead |
| --- | --- |
| an HTTP service (IPFS-style upload + gateway, price feed, indexer) | an in-memory service that keeps the real wire contract, plus a guard that refuses every request no service claims |
| the contracts themselves | local models (see [Local contract models](#local-contract-models)) - no compilation, no virtual machine |
| the EVM-only JSON-RPC methods deployment scripts still call | deterministic shims for `eth_getCode`, `eth_sendRawTransaction`, … |

Because the guard *refuses* anything unregistered, "this suite makes no real network calls" is a property you can
assert rather than hope for.

### Use it in three steps

**1. Turn it on** in the Vitest config. This is the whole setup for the common case:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

export default defineConfig(solidhatPreset(
  { hardhat: 2, ethers: 6 },
  { test: { include: ['test/**/*.test.ts'] } },
  { offline: true },
));
```

The in-memory IPFS upload service and gateway are registered for you, and `IPFS_UPLOAD_SERVICE_URL` /
`IPFS_GATEWAY_URL` decide which endpoints they answer.

**2. Describe anything else your application talks to** as an `OfflineService`, and declare pre-existing contracts
the chain did not deploy:

```ts
import { installOfflineNetwork } from '@solidcash/solidhat/offline-network';
import { seedOfflineRpcCode } from '@solidcash/solidhat/offline-rpc';

installOfflineNetwork({
  services: [{
    name: 'rates',
    matches: (url) => url.origin === 'https://rates.example.com',
    handle: async () => Response.json({ usd: 1 }),
  }],
});
seedOfflineRpcCode({ '0x1111111111111111111111111111111111111111': '0x6080' });
```

**3. Prove it stayed offline.** `assertNoNetworkViolations()` fails with the exact URLs that tried to escape:

```ts
import { assertNoNetworkViolations, offlineRuntime } from '@solidcash/solidhat/offline-setup';

afterAll(() => assertNoNetworkViolations());
// offlineRuntime().network.calls lists everything the suite asked for, handled or not
```

Tuning, when a suite legitimately needs an exception:

- `SOLIDCASH_OFFLINE_MODE=record` - record escapes instead of failing, for diagnosing an existing suite.
- `SOLIDCASH_OFFLINE_ALLOW=https://host-a/,/^https:\/\/host-b\.example\.com\//` - let matching requests
  through to the real network.
- `SOLIDCASH_MOCK_IPFS_SECRET` - require uploads to present that secret, which exercises the application's
  rejected-upload path.

### Local contract models

`@solidcash/solidhat/mock-contracts` replaces contracts with local programs: models are ordinary classes with a
caller, an event sink and revert helpers, wrapped in an ethers-shaped handle.

```ts
class CounterModel extends MockContractModel {
  static readonly viewMethods = ['count'] as const;
  static readonly events = { Incremented: ['by'] } as const;

  private value = 0n;

  count(): bigint { return this.value; }
  increment(by: bigint): void {
    if (by <= 0n) this.ctx.revert('amount must be greater than 0');
    this.value += by;
    this.ctx.emit('Incremented', { by });
  }
}

installMockContracts(hre, { upgrades, contracts: { Counter: { create: () => new CounterModel() } } });
```

`installMockContracts` replaces `getContractFactory`, `getContractAt` and `upgrades.deployProxy`. A name without a
model is refused rather than silently compiled, so a passing suite cannot be passing because half of it still ran
on chain. Receipts carry decoded events for the chai `emit` matcher, `addListener`/`queryFilter` work, and models
participate in `loadFixture` snapshots so fixture state rewinds between tests like a real chain. Deployment
addresses are valid CashAddresses (`@solidcash/solidhat/cashaddr`) so they round-trip through event payloads.

### Running ported deployment scripts

`runPortedScript` runs a Hardhat-era script in the current process with the globals it expects (`__dirname`,
`require`, and `process.exit` as a completion signal), so deployment scripts can be exercised against the same
mocked chain as the rest of the suite.

### Project fixtures

`stageProjectFixture` materializes a ported project under a fixture directory (`.solidhat/` by default) as relative
symlinks into the checkout: contract sources as file links (the compile walker treats those as targets), vendored
`@scope` directories as directory links so relative imports keep resolving, and whole trees for `src/`, tests and
implementations. Staging is idempotent, prunes links the current mirror no longer describes, and refuses to clobber
real files unless forced.
