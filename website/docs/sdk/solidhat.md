---
title: SolidHat Project Tooling
sidebar_label: SolidHat
description: Hardhat-style compilation, testing, scripts, deployment, networks, artifacts, and TypeChain tooling for SolidCash projects.
---

SolidHat is the project-level development environment for SolidCash. It provides the workflow that tools such as
Hardhat provide around an EVM compiler—project configuration, whole-project compilation, named networks, funded
development accounts, contract factories, tests, scripts, deployment, generated bindings, and namespaced build
output—but targets Bitcoin Cash and the SolidCash SDK.

Use SolidHat when you want one repeatable command-line workflow for a complete contract project. Use `solidc`
directly when you only need to compile an individual source file, and use the `solidcash` SDK directly when your
application already owns its build and deployment workflow.

:::info SolidHat is not an EVM
SolidHat preserves familiar project ergonomics, not EVM semantics. Contracts compile to Bitcoin Script,
transactions spend UTXOs, stateful contracts use CashToken NFTs, addresses are CashAddresses, and there is no gas,
account nonce, or mutable global EVM state.
:::

## Requirements

- Node.js 22 or newer
- npm, Yarn, or pnpm
- An ESM or TypeScript project

## Create a New Project

Create a TypeScript project with the default Hardhat 3 and Ethers 6 compatibility surface:

```bash
npm create @solidcash/solidhat@latest my-contracts
cd my-contracts
npm run solidhat:test
```

The generated project contains:

```text
contracts/                  SolidCash source files
scripts/deploy.ts           Default network-selectable deployment script
test/                       Vitest tests
solidcash.config.ts         Compiler, paths, accounts, and networks
vitest.solidhat.config.ts   Hardhat/Ethers compatibility aliases
artifacts/solidcash/        Generated artifacts
typechain-types/            Generated contract bindings
cache/solidcash/            Incremental compilation cache
```

Choose the language, package manager, and compatibility versions explicitly when needed:

```bash
npm create @solidcash/solidhat@latest my-contracts -- \
  --template typescript \
  --package-manager npm \
  --hardhat 3 \
  --ethers 6
```

Available templates are `typescript`, `javascript`, and `empty`. The JavaScript template generates
`scripts/deploy.js`; `solidhat deploy` discovers either the TypeScript or JavaScript default automatically.

Useful initializer options include:

| Option | Meaning |
| --- | --- |
| `--yes` | Accept non-interactive defaults. |
| `--no-install` | Generate files without installing dependencies. |
| `--sample` / `--no-sample` | Include or omit the sample contract, test, and deployment script. |
| `--dry-run` | Print the planned initialization without writing files. |
| `--hardhat 2\|3` | Select the compatibility entry point. |
| `--ethers 5\|6` | Select the Ethers compatibility helpers and bindings. |

## Add SolidHat to an Existing Project

Run the initializer in the project root:

```bash
npx @solidcash/solidhat --init --dry-run
npx @solidcash/solidhat --init
```

The operation is additive. SolidHat detects the package manager and installed Hardhat/Ethers versions, but keeps
existing EVM project files intact:

- `hardhat.config.*`, Solidity sources, tests, and scripts are not modified.
- EVM artifacts remain under `artifacts`; SolidCash owns `artifacts/solidcash` only.
- Other cache data remains under `cache`; SolidCash owns `cache/solidcash` only.
- SolidHat creates a separate `solidcash.config.ts` and `vitest.solidhat.config.ts`.
- An existing `README.md` is not replaced.

SolidHat refuses to replace conflicting generated files unless `--force` is supplied. Initialization plans all
writes first and rolls them back if an atomic replacement fails. Prefer `--dry-run` before changing a mature
repository.

## Configuration

The project configuration is `solidcash.config.ts`, `.mjs`, or `.js`. Paths are resolved relative to the config
file, not the shell's current directory.

```ts title="solidcash.config.ts"
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
    ecrecover: 'p2pkh',
  },

  typegen: {
    targets: [
      { target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' },
    ],
  },

  mnemonic: process.env.SOLIDCASH_MNEMONIC,
  accounts: {
    path: "m/44'/60'/0'/0",
    count: 1,
    initialIndex: 0,
    satoshis: 100_000_000n,
  },

  networks: {
    mock: { type: 'mock' },
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

### Paths

| Field | Default | Purpose |
| --- | --- | --- |
| `paths.contracts` | `contracts` | `.scash` and Solidity-compatible `.sol` source roots. |
| `paths.tests` | `test` | Project tests. |
| `paths.artifacts` | `artifacts` | Artifact root; SolidHat writes beneath `solidcash/`. |
| `paths.cache` | `cache` | Cache root; SolidHat writes beneath `solidcash/`. |

### Compiler Options

`compiler` options pass through to `solidc`. The deprecated `solc` spelling remains accepted, but new projects
should use `compiler`.

Important options include:

- `solidityImportCompat: true` for projects porting Solidity sources and imports.
- `ecrecover: 'p2pkh'` when recovered identities should be native BCH P2PKH addresses.
- `ecrecover: 'evm'` when an unmodified Solidity suite expects conventional 20-byte EVM addresses.
- State-layout, script-size, optimization, and other compiler settings supported by `solidc`.

The active provider's consensus limits are included in compilation. Mocknet can deliberately use generous test
limits, while regtest and live providers retain real Bitcoin Cash limits. Always compile against a real-network
configuration before publishing a production deployment.

### Accounts

`getSigners()` derives accounts from `mnemonic`, `accounts.path`, and `accounts.initialIndex`.

| Field | Meaning |
| --- | --- |
| `path` | BIP-32 branch; a child index is appended for each signer. |
| `count` | Number of accounts initialized by the runtime. |
| `initialIndex` | First child index to derive. |
| `satoshis` | Per-account development funding on mocknet or regtest. |

If `mnemonic` is omitted, mocknet and regtest use the public Hardhat development mnemonic. This is suitable only
for disposable local environments. SolidHat refuses to select Electrum or non-regtest Bitcoin RPC networks unless
an explicit mnemonic is configured.

:::danger Never reuse development keys
The default development mnemonic is public. Never fund it on chipnet or mainnet. Load live keys from a secret
manager or environment variable, keep production and staging keys separate, and do not commit seed phrases or RPC
credentials.
:::

## Network Types

SolidHat selects a named entry from `networks` using `--network`. When it is omitted, `defaultNetwork` is used.

### Mocknet

```ts
networks: {
  mock: {
    type: 'mock',
    consensus: {
      maximumInputBytes: 500_000,
      maximumStackItemBytes: 500_000,
      maximumTransactionBytes: 10_000_000,
      maximumNftCommitmentBytes: 128,
    },
    policy: { enforceDust: false },
  },
}
```

Mocknet runs entirely in-process. It creates deterministic funded signers, evaluates transactions locally, and
updates an in-memory UTXO set. It is the fastest choice for unit tests and deployment-script development.

Consensus and relay-policy overrides are mock-only. A script that succeeds with relaxed limits is not necessarily
deployable to BCHN. Run the same deployment against regtest before using chipnet or mainnet.

### BCHN Regtest

```ts
networks: {
  regtest: {
    type: 'regtest',
    rpc: {
      url: 'http://127.0.0.1:18443',
      user: 'user',
      password: 'password',
    },
  },
},
accounts: { count: 1, satoshis: 100_000_000n },
```

The regtest provider communicates with a Bitcoin Cash Node wallet over JSON-RPC. When `accounts.satoshis` is set,
`getSigners()` derives the configured accounts and asks the node wallet to fund any derived address that has no UTXOs.
Broadcast transactions are mined by the regtest provider, allowing deployment scripts to await confirmation.

The repository includes `docker-compose.regtest.yml` for local development. From the repository root:

```bash
docker compose -f docker-compose.regtest.yml up -d bchn fulcrum miner
curl --user user:password \
  --data-binary '{"jsonrpc":"1.0","id":"ready","method":"getblockcount","params":[]}' \
  -H 'content-type:text/plain' \
  http://127.0.0.1:18443
npx solidhat deploy --network regtest
```

For an application repository, use an equivalent BCHN regtest service and set `REGTEST_RPC_URL`,
`REGTEST_RPC_USER`, and `REGTEST_RPC_PASSWORD` in the environment.

### Electrum Live Networks

Use Electrum for ordinary chipnet or mainnet querying and broadcasting:

```ts
networks: {
  chipnet: { type: 'electrum', network: 'chipnet' },
  mainnet: { type: 'electrum', network: 'mainnet' },
  privateChipnet: {
    type: 'electrum',
    network: 'chipnet',
    electrum: { host: 'chipnet.example.org' },
  },
}
```

Electrum never manufactures funds. The derived deployer address must already have spendable BCH and, where a
deployment requires it, suitable `vout: 0` genesis UTXOs. SolidHat also does not mine after broadcast on live
networks; confirmation time follows the network.

### Generic Bitcoin RPC

Use `bitcoin-rpc` when connecting to a wallet-enabled BCH JSON-RPC endpoint without regtest's development helpers:

```ts
networks: {
  productionRpc: {
    type: 'bitcoin-rpc',
    network: 'mainnet',
    rpc: {
      url: process.env.BCH_RPC_URL!,
      user: process.env.BCH_RPC_USER!,
      password: process.env.BCH_RPC_PASSWORD!,
    },
  },
}
```

`network`, `rpc.url`, `rpc.user`, and `rpc.password` must be explicit. Like Electrum, this provider does not fund
accounts. Prefer TLS, a private network, or a local authenticated proxy; do not expose node RPC directly to the
internet.

## CLI Tasks

The initializer adds package scripts such as `solidhat:compile`, `solidhat:typegen`, `solidhat:test`,
`solidhat:deploy`, and `solidhat:clean`. You can also invoke the CLI directly.

| Command | Behavior |
| --- | --- |
| `solidhat compile` | Compile the project graph, atomically publish artifacts, and update configured bindings. |
| `solidhat typegen` | Generate bindings from existing artifacts. Add `--watch` for continuous generation. |
| `solidhat test [paths...]` | Compile, then run Vitest using `vitest.solidhat.config.*`. |
| `solidhat run <script>` | Compile, initialize the selected HRE, and import a script. |
| `solidhat deploy [script]` | Compile and run a deployment script; defaults to `scripts/deploy.ts` or `.js`. |
| `solidhat doctor` | Check config, paths, artifacts, and generated-output safety without modifying them. |
| `solidhat clean` | Remove only SolidHat-owned artifacts, cache data, and configured generated bindings. |
| `solidhat node` | Explain the active in-process mock network; it does not start BCHN. |

Use `--no-compile` with `test`, `run`, or `deploy` only when artifacts are already current:

```bash
npx solidhat deploy --network regtest --no-compile
npx solidhat run scripts/verify.ts --network chipnet --no-compile
```

`--network` can appear before or after the task:

```bash
npx solidhat --network regtest deploy
npx solidhat deploy --network regtest
```

When invoking an npm package script, insert npm's `--` separator:

```bash
npm run solidhat:deploy -- --network regtest
```

## Compile, Artifacts, and Type Generation

`solidhat compile` discovers `.scash` sources and the Solidity-compatible `.sol` dependency graph. It forwards
effective compiler settings, writes one artifact per contract, and only replaces the published artifact tree after
all required compilation succeeds. A failed build leaves the previous coherent artifact set intact.

Artifacts use a Hardhat-like source/contract layout inside SolidHat's namespace:

```text
artifacts/
  solidcash/
    contracts/
      Marketplace.scash/
        Marketplace.json
        Marketplace.artifact.ts
```

Resolve a unique contract by name or disambiguate it with a fully qualified name:

```ts
const Marketplace = await ethers.getContractFactory('Marketplace');
const Qualified = await ethers.getContractFactory(
  'contracts/Marketplace.scash:Marketplace',
);
```

Type generation is content-addressed. Generated TypeChain-compatible modules preserve the source tree, remove stale
files through atomic replacement, and support Ethers 5 or Ethers 6 targets:

```ts
typegen: {
  targets: [
    { target: 'ethers5', layout: 'typechain', outDir: 'typechain-types-v5' },
    { target: 'ethers6', layout: 'typechain', outDir: 'typechain-types-v6' },
  ],
}
```

## Tests and Hardhat Compatibility

The generated Vitest configuration aliases Hardhat, Ethers, Chai matchers, and network helpers to SolidCash-aware
implementations. This allows compatible test files to retain imports such as:

```ts
import { ethers, network } from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
```

Run them through SolidHat, not through the original EVM Hardhat runner:

```bash
npx solidhat test
npx solidhat test test/Marketplace.test.ts
npx solidhat test test/Marketplace.test.ts -t 'deploys with the configured fee'
```

Mocknet supports snapshots, fixture restoration, time advancement, funded signers, contract factories, Chai-style
transaction assertions, and familiar Ethers helpers. Live-node tests should use fresh deployments and run
serially; a real chain cannot be rewound like an in-memory snapshot.

Compatibility entry points are deliberately separate:

| Project expectation | Runtime imports |
| --- | --- |
| Hardhat 2 + Ethers 5 | `@solidcash/solidhat/hardhat2`, `@solidcash/solidhat/ethers5` |
| Hardhat 2 + Ethers 6 | `@solidcash/solidhat/hardhat2`, `@solidcash/solidhat/ethers6` |
| Hardhat 3 + Ethers 6 | `@solidcash/solidhat/hardhat3`, `@solidcash/solidhat/ethers6` |

SolidHat does not emulate behavior that has no safe Bitcoin Cash equivalent. Review the
[Solidity parity guide](/docs/basics/solidity-parity) and [platform differences](/docs/basics/platform-differences)
when porting an EVM project.

:::note `hardhat-deploy` is separate
SolidHat supports Hardhat-style `run` and `deploy` scripts, but does not currently implement the optional
`hardhat-deploy` plugin's `deployments.deploy`, tag/dependency graph, named deployments, or
`deployments.createFixture` APIs. Use factories and explicit script composition.
:::

## Write a Deployment Script

A deployment script receives the configured runtime through its imports. It should identify the selected network,
deploy through a signer-bound factory, wait for the genesis transaction, and persist enough data to reproduce and
verify the deployment.

```ts title="scripts/deploy.ts"
import { writeFile } from 'node:fs/promises';
import { ethers, network } from '@solidcash/solidhat/hardhat3';

const [deployer] = await ethers.getSigners(1);
console.log(`Deploying on ${network.name} from ${deployer.address}`);

const Marketplace = await ethers.getContractFactory('Marketplace', deployer);
const marketplace = await Marketplace.deploy(
  deployer.publicKey,
  1931n,
);
await marketplace.waitForDeployment();

const transaction = marketplace.deploymentTransaction();
const deployment = {
  network: network.name,
  deployer: deployer.address,
  address: await marketplace.getAddress(),
  transaction: transaction.txid,
  constructorArguments: [deployer.publicKey, '1931'],
};

await writeFile(
  `deployment.${network.name}.json`,
  `${JSON.stringify(deployment, null, 2)}\n`,
  { flag: 'wx' },
);

console.log(deployment);
```

`factory.deploy()` returns an Ethers-shaped deployed handle:

- `await contract.waitForDeployment()` waits until the provider knows the deployment transaction.
- `await contract.getAddress()` returns the deployed logical CashAddress.
- `contract.deploymentTransaction()` returns the transaction details, including `txid` and serialized `hex`.
- `contract.connect(otherSigner)` switches the signer for later calls.

For multi-contract systems, deploy in dependency order and pass earlier addresses or token categories to later
constructors. Keep the deployment script deterministic where possible and write a separate verification script.

## Deployment Progression

Use the same script and explicit network names as a promotion pipeline:

1. **Mocknet:** iterate quickly and validate arguments, deployment order, and output files.
2. **Regtest:** enforce BCH consensus and policy with a real BCHN node and real serialized transactions.
3. **Chipnet:** validate public-network funding, indexing, propagation, and confirmation handling.
4. **Mainnet:** use separately reviewed configuration and keys after verifying every prior stage.

Before promoting a deployment:

- Run `solidhat doctor` and a clean `solidhat compile --network <network>`.
- Confirm constructor arguments, fee destinations, owner keys, and token-category dependencies.
- Confirm the deployer has enough BCH and the required `vout: 0` UTXOs.
- Record the artifact/compiler version, network, transaction IDs, addresses, constructor arguments, and source commit.
- Inspect every genesis output, NFT capability, commitment, and fungible amount.
- Reconstruct expected addresses in an independent verification script.

See [Contract Deployment](/docs/guides/deployment) for CashToken genesis design, initial state, BCMR metadata,
concurrency outputs, and deployment verification.

## Custom Tasks and Programmatic Runtime

SolidHat includes a Hardhat-style task registry. A task action receives its arguments and the active runtime:

```ts
import { task } from '@solidcash/testing/tasks';

task('accounts', 'Print configured signer addresses')
  .addOptionalParam('count', 'Number of accounts', 1)
  .setAction(async (args, hre) => {
    const signers = await hre.ethers.getSigners(Number(args.count));
    for (const signer of signers) console.log(signer.address);
  });
```

The runtime exposes:

- `hre.config`: resolved paths, compiler settings, accounts, and named networks.
- `hre.network`: active name, provider, Ethers helpers, and `connect()`/`create()` connection seam.
- `hre.ethers`: provider-bound signers, factories, deployed-contract lookup, deployment, and utility functions.
- `hre.networkHelpers`: fixtures, snapshots, mining, and time helpers where the provider supports them.
- `hre.run(taskName, args)`: programmatic task invocation.

`solidhat run` also assigns the active runtime to `globalThis.hre` for scripts that follow Hardhat's injected-HRE
style, though explicit imports are easier to type and test.

## Hardhat Configuration Migration

An existing Hardhat project can opt into SolidCash with a `solidcash` section, but a standalone config is clearer
because it avoids coupling BCH settings to the EVM toolchain. Generate one without modifying the Hardhat file:

```bash
npx solidcash init --from-hardhat
```

Only unambiguous path and HD-account fields are inherited. Solidity compiler settings and EVM network definitions
are intentionally not translated into BCH configuration.

## Troubleshooting

### `Network "..." is not configured`

Add the exact name under `networks` or correct `--network`. SolidHat lists the available names in the error.

### A live network requires an explicit mnemonic

Set `mnemonic` from a secure environment source. SolidHat intentionally refuses to use the public development
mnemonic with Electrum or a non-regtest Bitcoin RPC network.

### The deployer has insufficient funds

- On mocknet, confirm `accounts.satoshis` or the signer options provide enough value.
- On regtest, confirm BCHN's wallet is loaded, mature coinbase funds exist, and its RPC credentials are correct.
- On chipnet/mainnet, fund the exact CashAddress returned by `getSigners()` and wait for indexing.

### Deployment needs a `vout: 0` UTXO

CashToken category genesis requires spending output index zero. Ordinary wallet UTXOs at other indices cannot be
substituted. Prepare genesis funding as described in the [deployment guide](/docs/guides/deployment#exact-input-deployment).

### A mock deployment succeeds but regtest fails

Mocknet may have relaxed script, stack-item, transaction-size, NFT-commitment, or dust policy. Compile and run with
`--network regtest`, then inspect the BCHN rejection rather than increasing mock limits further.

### Artifacts are stale

Remove only SolidHat-owned outputs and rebuild:

```bash
npx solidhat clean
npx solidhat compile --network regtest
```

Avoid deleting an existing Hardhat project's entire `artifacts` or `cache` directory; SolidHat namespaces its own
files specifically so both toolchains can coexist.

### A script should not recompile

Use `--no-compile` only after a known-good compile with the same network-sensitive compiler limits:

```bash
npx solidhat deploy --network regtest --no-compile
```

For production deployment, a fresh explicit compile is safer than relying on this optimization.
