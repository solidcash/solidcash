---
title: SolidHat Projects
---

`@solidcash/solidhat` is the recommended project toolchain for SolidCash applications. It adds whole-project
compilation, incremental caching, namespaced artifacts, generated TypeChain-compatible bindings, an in-process
test network, and Hardhat/Ethers compatibility without taking ownership of an existing EVM project.

SolidHat requires Node.js 22 or newer and an ESM or TypeScript project.

This page covers the project workflow: creating a project, `solidcash.config.ts`, the CLI, compilation and
artifacts, networks and accounts, and deployment scripts. The runtime that tests and scripts import (`ethers`,
contract factories, fixtures, network helpers, chai matchers and `upgrades`) is described in
[SolidHat Runtime](/docs/sdk/solidhat).

## Create a project

```sh
npm create @solidcash/solidhat@latest my-project
cd my-project
npm run solidhat:test
```

In a terminal, the initializer asks for every choice you did not pass as a flag: the project directory, the
template, the package manager, whether to add the samples, and whether to install dependencies. Pass flags after
npm's `--` separator:

```sh
npm create @solidcash/solidhat@latest my-project -- \
  --template typescript \
  --package-manager npm \
  --hardhat 3 \
  --ethers 6 \
  --yes
```

| Flag | Meaning |
| --- | --- |
| `--template typescript\|javascript\|empty` | Project language. `empty` is a TypeScript project without the samples. Default `typescript`. |
| `--package-manager npm\|yarn\|pnpm` | Package manager for scripts and installation. Default: `pnpm` with a `pnpm-lock.yaml`, `yarn` with a `yarn.lock`, else `npm`. |
| `--hardhat 2\|3` | Hardhat entry point the tests and scripts import. |
| `--ethers 5\|6` | Ethers helpers and generated bindings. |
| `--yes`, `-y` | Accept the defaults without prompts and install dependencies (unless `--no-install`). |
| `--install`, `--no-install` | Install dependencies, or only write the files. |
| `--sample`, `--no-sample` | Add or omit the sample contract, test and deployment script. |
| `--dry-run` | Report how many files would be created or updated, without writing or installing anything. |
| `--force` | Replace conflicting SolidHat-owned files: the SolidCash config, the Vitest config and the samples. |

Without a TTY, for example in CI, there are no prompts: missing options take their defaults, and packages are
installed only with `--yes` or `--install`. At the prompt, the samples question defaults to yes even for the
`empty` template; pass `--no-sample` to skip it.

Without `--hardhat` and `--ethers`, SolidHat reads `package.json`. A Hardhat 2 dependency selects `hardhat2` with
Ethers 5, unless the project depends on Ethers 6. Anything else selects `hardhat3` with Ethers 6, unless the project
depends on Ethers 5.

A new TypeScript project contains:

```text
contracts/Counter.scash      sample contract (not with --template empty)
test/Counter.test.ts         sample test (not with --template empty)
scripts/deploy.ts            sample deployment script (not with --template empty)
solidcash.config.ts          compiler, paths, accounts and networks
vitest.solidhat.config.ts    Vitest configuration with the Hardhat/Ethers aliases
package.json                 solidhat:* scripts; @solidcash/solidhat, vitest and typescript dev dependencies
.gitignore                   artifacts/solidcash/, cache/solidcash/, node_modules/
README.md
```

The JavaScript template writes `.js` files instead. Compiling adds `artifacts/solidcash/` and, with the generated
`typegen` target, `typechain-types/`. The compile cache lives in `~/.cache/solidcash`, outside the project.

## Add SolidHat to an existing project

Run the initializer at the project root:

```sh
npx @solidcash/solidhat --init --dry-run
npx @solidcash/solidhat --init
```

`--init` takes the same flags as `npm create`, except the directory. SolidHat detects `hardhat.config.*`, the
package manager, and installed Hardhat/Ethers majors. Migration is additive:

- Solidity sources, EVM tests, Hardhat configuration, and existing package scripts are preserved. `package.json`
  gains only the `solidhat:*` scripts and dev dependencies it does not have yet.
- SolidCash artifacts live only under `artifacts/solidcash`.
- The SolidCash compile cache lives in `~/.cache/solidcash`, outside the project.
- SolidCash tests use `vitest.solidhat.config.ts`, separate from the existing runner.
- An existing project gets no `README.md`, and gets the samples only with `--sample` or a yes at the prompt.

The initializer refuses to replace a conflicting file it owns unless you pass `--force`. It plans all writes before
applying them and rolls the plan back if a replacement fails.

### Convert a Hardhat configuration

```sh
npx solidhat init --from-hardhat
```

This writes a standalone `solidcash.config.ts` next to the nearest `hardhat.config.ts`, `.mjs` or `.js` and does not
modify the Hardhat file. It copies `paths.sources`, `paths.tests` and `paths.artifacts`, and the `path`, `count` and
`initialIndex` of the `hardhat` network's accounts. When the Hardhat config has a mnemonic, the new config reads
`process.env.SOLIDCASH_MNEMONIC` instead of copying the phrase. It sets `compiler: { evmCompat: true }` and a mock
default network. Solidity compiler settings and EVM networks are not translated. An existing `solidcash.config.ts`
is never overwritten.

A Hardhat config can instead carry a `solidcash` section with the same fields. SolidHat reads it when it finds no
`solidcash.config.*`. A standalone config is clearer, because it keeps BCH settings out of the EVM toolchain.

## Configuration

The project configuration is `solidcash.config.ts`, `.mjs` or `.js`. SolidHat looks for it from the working
directory up to the project root (the nearest `package.json` or `.git`). Paths resolve relative to the config file,
not the shell's current directory. Discovery skips a config file that another local user could have planted; see
[Testing Framework](/docs/tooling/testing-framework#install-and-configure-directly).

A new project starts with this configuration:

```ts title="solidcash.config.ts"
import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: 'contracts',
    artifacts: 'artifacts',
    tests: 'test',
  },
  compiler: { evmCompat: true },
  typegen: {
    targets: [{ target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' }],
  },
  mnemonic: process.env.SOLIDCASH_MNEMONIC,
  accounts: { count: 1, satoshis: 100_000_000n },
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
    chipnet: { type: 'electrum', network: 'chipnet', mnemonic: process.env.SOLIDCASH_MNEMONIC_CHIPNET },
    mainnet: { type: 'electrum', network: 'mainnet', mnemonic: process.env.SOLIDCASH_MNEMONIC_MAINNET },
  },
  defaultNetwork: 'mock',
});
```

| Key | Default | Meaning |
| --- | --- | --- |
| `paths.contracts` | `contracts` | Source root for `.scash` and Solidity-compatible `.sol` files. |
| `paths.tests` | `test` | Project tests. |
| `paths.artifacts` | `artifacts` | Artifact root; SolidHat writes beneath `@solidcash/solidcash/`. |
| `paths.cache` | `~/.cache/solidcash` | Compile cache root; SolidHat writes beneath `@solidcash/solidcash/`. |
| `trustProjectCache` | `false` | Allow a `paths.cache` inside the project. |
| `compiler` | none | Options passed to `solidc`. The legacy name `solc` is accepted. |
| `composition` | `direct` | Experimental: `framed` compiles every entry point in the framed convention. |
| `logicalIdentity` | `true` | Address deployments by a stable CREATE identity; `false` uses the address each genesis transaction produces. |
| `typegen.targets` | none | Generated bindings; see [Generated bindings](#generated-bindings). |
| `typegen.jsonArtifactModules` | `false` | Make each `.artifact.ts` load the JSON artifact next to it instead of embedding it. |
| `mnemonic` | Hardhat test mnemonic | Signing phrase for every network without its own `mnemonic`. |
| `accounts` | see below | Development signers. |
| `networks` | `mock` only | Named networks; see [Networks](#networks). |
| `defaultNetwork` | `mock` | Network used when no `--network` is given, and always inside Vitest workers. |

`solidcashConfigSchema` from `@solidcash/solidhat/config` exposes the configuration as JSON Schema.

### Compiler options

`compiler` options are passed to `solidc`; see [Compiler](/docs/compiler) for the full list. New projects set
`evmCompat: true`, the Solidity compatibility mode: `.sol` sources and `pragma solidity` are accepted, and the ABI
uses EVM encoding. `.sol` sources compile in this mode even when `evmCompat` is not set. `ecrecover: 'p2pkh'`
makes recovered identities native BCH P2PKH addresses; `ecrecover: 'evm'`, the default under `evmCompat`, returns
conventional 20-byte EVM addresses.

`solidhat compile` takes two limits from the selected network instead of the config: `maximumInputBytes` is the
network's input-script limit, and `commitmentLimit` is at most the network's NFT commitment limit. A network that
publishes no limits gives 10,000 and 128 bytes. See [Test under real limits](#test-under-real-limits).

### Compile cache trust

`paths.cache` defaults to `~/.cache/solidcash`. Compile trusts the entries it finds there as compiled output, so
anyone who can write the cache can substitute artifacts for your sources. A cache inside the project is ignored
unless the config also sets `trustProjectCache: true`; set it only for a checkout no one else writes, never for a
cloned repository, and do not commit the cache.

## Accounts and mnemonics

`ethers.getSigners()` derives signers from the network's mnemonic on the `accounts.path` branch.

| Field | Default | Meaning |
| --- | --- | --- |
| `accounts.path` | `m/44'/60'/0'/0` | BIP-32 branch; signer `i` uses child index `i`. |
| `accounts.count` | `20` | Signers funded when the runtime starts on the mock network. |
| `accounts.satoshis` | `100_000_000n` | Value of each development funding coin on mock and regtest. |
| `accounts.initialIndex` | `0` | First derived account: signer `i` is wallet `initialIndex + i`, on every network type. |

Each network signs with its own `mnemonic`, else the top-level `mnemonic`, else the public Hardhat development
mnemonic. The development mnemonic is accepted only on mock and regtest: SolidHat refuses to select an Electrum or a
non-regtest Bitcoin RPC network without an explicit mnemonic. A BCH signature carries no chain id, so SolidHat also
refuses to select or connect a live network whose phrase would also sign on another live chain. In the generated
config, setting only `SOLIDCASH_MNEMONIC` is enough for mock and regtest; before using chipnet or mainnet, set
`SOLIDCASH_MNEMONIC_CHIPNET` and `SOLIDCASH_MNEMONIC_MAINNET` separately, or both inherit the one phrase and are refused.

On the mock network every signer starts with many funding coins. On regtest, `getSigners()` tops each signer up from
the node wallet. Electrum and Bitcoin RPC networks never create funds.

:::danger Never reuse development keys
The default development mnemonic is public. Never fund it on chipnet or mainnet. Load live keys from a secret
manager or environment variable, keep production and staging keys separate, and do not commit seed phrases or RPC
credentials.
:::

## Networks

SolidHat selects a named entry from `networks` with `--network`. When it is omitted, `defaultNetwork` is used. A
`mock` entry always exists.

| Field | Used by | Meaning |
| --- | --- | --- |
| `type` | all | `mock`, `regtest`, `electrum` or `bitcoin-rpc`. Default `mock` (`regtest` for an entry named `regtest`). |
| `network` | `electrum`, `bitcoin-rpc` | `mainnet`, `testnet3`, `testnet4` or `chipnet`. Inferred when the entry's name is one of these. |
| `rpc` | `regtest`, `bitcoin-rpc` | `{ url, user, password }`. |
| `electrum` | `electrum` | `{ host }` for a custom server on its standard port. A custom `port` is refused. |
| `consensus` | `mock` | Overrides of the mock's consensus limits. A `regtest` entry accepts them too, but they change only SolidHat's own checks, not the node. |
| `policy` | `mock` | `{ enforceDust }`: apply the node's dust and standardness rules on the mock. |
| `mnemonic` | all | Signing phrase for this network. |

### Mock

```ts
networks: {
  mock: { type: 'mock' },
}
```

The mock network runs entirely in-process. It creates deterministic funded signers, evaluates transactions with
the BCH 2026 VM, and updates an in-memory UTXO set. It is the fastest choice for unit tests and deployment-script
development. Its default limits are relaxed; see [Test under real limits](#test-under-real-limits).

### BCHN regtest

```ts
networks: {
  regtest: {
    type: 'regtest',
    rpc: { url: 'http://127.0.0.1:18443', user: 'user', password: 'password' },
  },
}
```

The regtest provider talks to a Bitcoin Cash Node over JSON-RPC and uses the node's wallet: it funds signers from
it, mines a block after every broadcast so scripts can await confirmation, rewinds fixture snapshots, and drives
time with the node's mock clock. Set `REGTEST_RPC_URL`, `REGTEST_RPC_USER` and `REGTEST_RPC_PASSWORD` to point the
generated config at another node. See [BCHN regtest admission](#bchn-regtest-admission) for the node setup.

### Electrum

```ts
networks: {
  chipnet: { type: 'electrum', network: 'chipnet', mnemonic: process.env.SOLIDCASH_MNEMONIC_CHIPNET },
  privateChipnet: {
    type: 'electrum',
    network: 'chipnet',
    electrum: { host: 'chipnet.example.org' },
    mnemonic: process.env.SOLIDCASH_MNEMONIC_CHIPNET,
  },
}
```

Use Electrum for ordinary chipnet or mainnet querying and broadcasting. Electrum never creates funds: the derived
deployer address must already hold spendable BCH and, for a stateful deployment, suitable `vout: 0` genesis UTXOs.
SolidHat does not mine on live networks; confirmation time follows the network.

### Bitcoin RPC

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
    mnemonic: process.env.SOLIDCASH_MNEMONIC_MAINNET,
  },
}
```

Use `bitcoin-rpc` for a wallet-enabled BCH JSON-RPC endpoint without regtest's development helpers. `rpc.url`,
`rpc.user` and `rpc.password` are required, and so is `network` unless the entry's name is a BCH network name. Like
Electrum, this provider does not fund accounts. Prefer TLS, a private network, or a local authenticated proxy; do
not expose node RPC directly to the internet.

## Commands

```sh
npx solidhat compile [sources...]       # compile the project, publish artifacts/solidcash, regenerate bindings
npx solidhat test [paths...] [-t name]  # compile, then run Vitest with vitest.solidhat.config.*
npx solidhat deploy [script]            # compile, then run scripts/deploy.ts (or .js) or the given script
npx solidhat run <script>               # compile, then run any script with the runtime
npx solidhat typegen [--watch]          # regenerate bindings from existing artifacts
npx solidhat doctor [--json]            # read-only project checks
npx solidhat clean                      # remove artifacts, compile cache and configured bindings
npx solidhat init --from-hardhat        # write solidcash.config.ts from hardhat.config.*
npx solidhat node                       # explain that the mock runs in-process; starts no server
```

| Command | Flags |
| --- | --- |
| `compile` | `--quiet` hides per-file output. `--suppress-warnings` hides compiler warnings (or set `compiler.suppressWarnings`). `--jobs N` compiles Solidity roots in N worker threads, which helps only cold builds. `--skip-split` skips split bundles for oversized `.sol` contracts. `--iteration` is described under [Compile, cache and artifacts](#compile-cache-and-artifacts). |
| `test` | `--no-compile` skips the compile. |
| `deploy`, `run` | `--no-compile` skips the compile. |
| `typegen` | `--watch` regenerates when sources or artifacts change, until Ctrl+C. |
| `doctor` | `--json` prints the findings as JSON. |
| `init` | `--from-hardhat` is required. |

`--network <name>` (or `--network=<name>`) can appear anywhere on the line and selects a configured network.
`npx solidhat --help` prints the usage, and an unknown task lists the available ones. A task you declare in
`solidcash.config.ts` with `task()` from `@solidcash/testing/tasks` runs the same way; see
[Testing Framework](/docs/tooling/testing-framework#custom-tasks-and-cli).

`solidhat test` runs `npx vitest run` with `vitest.solidhat.config.ts` (or `.js`) when the file exists. File paths
and single-dash options such as `-t <name>` are passed to Vitest. Options that start with `--` are read as task
options and are not passed on, so put other Vitest options in the Vitest config.

`doctor` reports a missing contracts directory, missing artifacts, two binding targets sharing an output
directory, bindings inside the source tree, hand-written files in a generated directory, and a Hardhat project
without bindings. It exits with code 1 when it finds an error.

The generated package scripts call the same commands: `solidhat:compile`, `solidhat:typegen`, `solidhat:test`,
`solidhat:deploy` and `solidhat:clean`. Pass flags after npm's `--` separator:

```sh
npm run solidhat:deploy -- --network regtest
```

### The solidcash CLI

`@solidcash/testing` ships the same tasks as a `solidcash` command for projects that do not use SolidHat:

```sh
npx solidcash compile
npx solidcash test
npx solidcash run scripts/deploy.ts --network regtest
```

Its `test` does not compile first; run `npx solidcash compile` before it. It accepts `--network <name>` only as two
separate words and has no `--init`.

## Compile, cache and artifacts

`solidhat compile` compiles every `.scash` file directly inside `paths.contracts` and every `.sol` file below it,
skipping `node_modules` and `@scope` directories. Imports resolve normally, so imported `.scash` files can live in
subdirectories.

Compilation is graph-aware and content-addressed. A cache entry is keyed by the compiler build, the root source,
its whole import closure and every option, so a cache hit is equivalent to recompiling. New artifacts replace the
previous `artifacts/solidcash` tree only after every source compiles, so a failed build cannot publish a partial
graph. After publishing, compile regenerates the configured bindings.

Artifacts mirror Hardhat's source/contract structure inside the SolidCash namespace:

```text
artifacts/
  solidcash/
    contracts/
      Counter.scash/
        Counter.json            one artifact per contract in the file
        Counter.artifact.ts     the same artifact as a typed module
    Counter.json                the file's primary contract, for direct imports
    Counter.artifact.ts
    Token.json                  contracts compiled from .sol sources
    Token.artifact.ts
    Large.split.json            split bundle for a contract over the input limit
```

A contract whose script exceeds the selected network's input limit also gets a `<Name>.split.json` bundle; see
[Large Contracts](/docs/compiler/large-contracts). Look up an unambiguous contract by name or use a fully qualified
source name:

```ts
import { ethers } from '@solidcash/solidhat/hardhat3';

const Counter = await ethers.getContractFactory('Counter');
const Qualified = await ethers.getContractFactory('contracts/Counter.scash:Counter');
```

If two distinct artifacts share a contract name, the short lookup fails instead of choosing one. When a split
bundle exists for the name, the factory deploys the split form.

`solidhat compile <sources...>` recompiles only the named sources (a path, a path relative to `paths.contracts`, or
a file name) and keeps the other artifacts of the last complete build. If the compiler or an artifact-affecting
option changed since that build, it compiles everything instead, so the tree never mixes old and new output. After
changing the compiler itself, `--iteration` forces the focused compile anyway and marks the tree stale; the next
normal compile then rebuilds everything.

## Generated bindings

```ts
typegen: {
  targets: [
    { target: 'ethers5', layout: 'typechain', outDir: 'typechain-types-v5' },
    { target: 'ethers6', layout: 'typechain', outDir: 'typechain-types-v6' },
  ],
}
```

Each target generates TypeChain-compatible modules for Ethers 5 or Ethers 6. `outDir` defaults to
`typechain-types`, or `typechain-types-<target>` when there are several targets. Generated bindings retain the
source tree and augment the artifact-name registry so literal contract names infer the specific artifact type.
Regeneration atomically replaces only the configured output directory and removes stale generated files, and an
unchanged set of artifacts reuses the previous output. Do not edit files in an output directory.

`solidhat typegen` regenerates from the existing artifacts and fails when there are none. Use
`typegen.targets[].sourceDir` when fixture sources were copied from another project but generated imports should
preserve the original source layout.

## Deployment scripts

`solidhat deploy` compiles, then imports `scripts/deploy.ts`, `scripts/deploy.js` or the script you name, with the
runtime connected to the selected network. `solidhat run <script>` does the same for any script. Both also set
`globalThis.hre` for scripts written in Hardhat's injected style. The sample project's script:

```ts title="scripts/deploy.ts"
import { ethers, network } from '@solidcash/solidhat/hardhat3';

const [deployer] = await ethers.getSigners(1);
console.log(`Deploying on ${network.name} from ${deployer.address}`);

const Counter = await ethers.getContractFactory('Counter', deployer);
const counter = await Counter.deploy();
await counter.waitForDeployment();
const transaction = counter.deploymentTransaction();

console.log(JSON.stringify({
  network: network.name,
  address: await counter.getAddress(),
  transaction: transaction.txid,
}, null, 2));
```

Run it with `npx solidhat deploy --network regtest`. See
[Write a Deployment Script](/docs/sdk/solidhat#write-a-deployment-script) for the deployed-contract handle and a
script that records its deployment, and [Contract Deployment](/docs/guides/deployment) for CashToken genesis, initial
state, and verification.

### Deployment progression

Use the same script and explicit network names as a promotion pipeline:

1. **Mock:** iterate quickly and validate arguments, deployment order, and output files.
2. **Regtest:** enforce BCH consensus and policy with a real BCHN node and real serialized transactions.
3. **Chipnet:** validate public-network funding, indexing, propagation, and confirmation handling.
4. **Mainnet:** use separately reviewed configuration and keys after verifying every prior stage.

Before promoting a deployment:

- Run `solidhat doctor` and a clean `solidhat compile --network <network>`.
- Confirm constructor arguments, fee destinations, owner keys, and token-category dependencies.
- Confirm the deployer has enough BCH and the required `vout: 0` UTXOs.
- Record the artifact and compiler version, network, transaction IDs, addresses, constructor arguments, and source
  commit.
- Inspect every genesis output, NFT capability, commitment, and fungible amount.
- Reconstruct expected addresses in an independent verification script.

SolidHat implements Hardhat-style `run` and `deploy` scripts, but not the optional `hardhat-deploy` plugin's
`deployments.deploy`, tag and dependency graph, named deployments, or `deployments.createFixture`. Use factories and
explicit script composition.

## Test under real limits

The mock network runs the BCH 2026 VM with the real operation-cost density, but relaxes sizes by default:

| Limit | Default mock | BCH |
| --- | --- | --- |
| Input script, `maximumInputBytes` | 1,000,000 | 10,000 |
| Stack item, `maximumStackItemBytes` | 1,000,000 | 10,000 |
| Transaction, `maximumTransactionBytes` | 10,000,000 | 100,000 (standard) |
| NFT commitment, `maximumNftCommitmentBytes` | 1,000,000 | 128 |
| Operation cost, `operationCostBudgetPerByte` | 800 | 800 |
| Hash iterations, `hashDigestIterationsPerByte` | 10,000,000 | 0.5 standard, 3.5 consensus |
| Dust and standardness, `policy.enforceDust` | off | on |

A green mock test therefore does not prove that a transaction is valid on mainnet. Compiling is affected too:
`solidhat compile` takes its input and commitment limits from the selected network, so a compile against the
default mock can skip splits and pack state into commitments larger than BCH accepts. Use such artifacts for tests
only. See [Script Limits](/docs/compiler/script-limits) for the limits themselves.

### Give the mock production limits

Add a mock network with production values and make it the default:

```ts title="solidcash.config.ts"
networks: {
  mock: { type: 'mock' },
  strict: {
    type: 'mock',
    consensus: {
      maximumInputBytes: 10_000,
      maximumStackItemBytes: 10_000,
      maximumTransactionBytes: 100_000,
      maximumNftCommitmentBytes: 128,
    },
    policy: { enforceDust: true },
  },
},
defaultNetwork: 'strict',
```

To cap only the input size, set `policy: { enforceProductionInputLimit: true }` on a mock network: every input is
held to BCH's 10,000 bytes, and `solidhat compile` against that network splits contracts to fit. Commitment and
other sizes stay relaxed.

Outside SolidHat, pass the same values to the SDK's provider:

```ts
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';

const provider = new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 100_000,
    maximumNftCommitmentBytes: 128,
  },
  policy: { enforceDust: true },
});
```

`enforceDust: true` applies the node's standard relay rules as well as the dust threshold. The mock accepts only
whole numbers for hash-iteration limits, so only a real node checks the real 0.5 and 3.5 per-byte allowances.

### Compile publishable artifacts

Compile against a network with BCH limits before you deploy or publish artifacts:

```sh
npx solidhat compile --network regtest
```

Regtest publishes no relaxed limits, so this compile uses 10,000-byte inputs and 128-byte commitments. A
production-shaped mock such as `strict` above gives the same result, and as the default network it also applies to
plain `npx solidhat compile`.

`solidhat test --network <name>` affects only the compile that runs before the tests. Vitest workers always use
`defaultNetwork`. To test on another network, change `defaultNetwork` (for example
`defaultNetwork: process.env.TEST_NETWORK ?? 'mock'`, with a variable name of your choice), or use the connection
from `const { ethers } = await network.connect('regtest')` inside the test.

### BCHN regtest admission

Regtest sends every transaction through a real BCHN node, with its consensus and relay rules. Run a node of version
29 or newer in regtest mode with RPC, a transaction index, and the 2026 upgrade active, then mine the first 200
blocks yourself so the chain's time is past the activation time:

```sh
bitcoind -regtest -daemon -server=1 -txindex=1 -rpcuser=user -rpcpassword=password \
  -upgrade12activationtime=1762596456
CLI="bitcoin-cli -regtest -rpcuser=user -rpcpassword=password"
$CLI generatetoaddress 200 "$($CLI getnewaddress)"
```

Then deploy and test against it:

```sh
npx solidhat deploy --network regtest
TEST_NETWORK=regtest npx solidhat test --network regtest
```

The second command assumes the `TEST_NETWORK` default shown above. Regtest tests share one node, so run their files
one at a time: set `test: { fileParallelism: false }` in `vitest.solidhat.config.ts`. Deploy to chipnet only after
the regtest run passes.

## Ownership and cleanup

SolidHat deliberately owns a small namespace. `clean` removes `artifacts/solidcash`, the cache's `solidcash`
directory, and the configured binding directories; it does not delete EVM artifacts or arbitrary project files.
With the default per-user cache, that cache directory is shared by all your projects. Keep generated directories
dedicated to SolidHat so this ownership rule remains unambiguous.

## Programmatic initialization

```ts
import { initializeProject } from '@solidcash/solidhat';

const result = initializeProject({
  cwd: process.cwd(),
  dryRun: true,
  compatibility: { hardhat: 3, ethers: 6 },
});
```

`initializeProject` takes the same choices as the CLI flags: `target`, `template`, `packageManager`, `install`,
`sample`, `force`, `dryRun` and `compatibility`. It never prompts. The result reports created, updated, and unchanged
paths, the compatibility versions used, whether a Hardhat project was found, and whether packages were installed.
This is useful for IDEs and higher-level scaffolding tools.

## Troubleshooting

### `Network "..." is not configured`

Add the exact name under `networks` or correct `--network`. The error lists the available names.

### A live network requires an explicit mnemonic

Set `mnemonic` for the network, or the top-level `mnemonic`, from a secure environment source. SolidHat refuses to
use the public development mnemonic with Electrum or a non-regtest Bitcoin RPC network.

### A network needs its own mnemonic

One phrase would sign on two live chains. Give each live network its own `mnemonic`.

### The deployer has insufficient funds

- On the mock network, confirm `accounts.satoshis` provides enough value.
- On regtest, confirm BCHN's wallet is loaded, mature coinbase funds exist, and its RPC credentials are correct.
- On chipnet or mainnet, fund the exact CashAddress returned by `getSigners()` and wait for indexing.

### Deployment needs a `vout: 0` UTXO

CashToken category genesis requires spending output index zero. Ordinary wallet UTXOs at other indices cannot be
substituted. Prepare genesis funding as described in the
[deployment guide](/docs/guides/deployment#exact-input-deployment).

### A mock deployment succeeds but regtest fails

The mock may have relaxed script, stack-item, transaction-size, NFT-commitment, or dust policy. Compile and run
with `--network regtest`, then inspect the BCHN rejection rather than raising mock limits further.

### Artifacts are stale

Remove only SolidHat-owned outputs and rebuild:

```bash
npx solidhat clean
npx solidhat compile --network regtest
```

Avoid deleting an existing Hardhat project's entire `artifacts` or `cache` directory; SolidHat namespaces its own
files so both toolchains can coexist.

### A script should not recompile

Use `--no-compile` only after a known-good compile with the same network-sensitive limits:

```bash
npx solidhat deploy --network regtest --no-compile
```

For a production deployment, a fresh explicit compile is safer.
