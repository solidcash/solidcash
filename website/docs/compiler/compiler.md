---
title: Compiler
---

The SolidCash compiler is called `solidc` and is used to compile SolidCash `.scash` contract files into `.json` (or `.ts`) artifact files.
These artifact files can be used to instantiate a SolidCash contract with the help of the SolidCash SDK. For more information on this artifact format refer to [Artifacts](/docs/compiler/artifacts).

:::info
Because of the separation of the compiler and the SDK, SolidCash contracts can be integrated into other programming languages in the future.
:::

## Command Line Interface

The `solidc` command line interface is used to compile SolidCash `.scash` files into `.json` (or `.ts`) artifact files.

### Installation
You can use `npm` to install the `solidc` command line tool globally.

```bash
npm install -g solidc
```

### CLI Usage
The `solidc` CLI tool can be used to compile `.scash` files to JSON (or `.ts`) artifact files.

```bash
Usage: solidc [options] [source_file]

Options:
  -V, --version          Output the version number.
  -o, --output <path>    Specify a file to output the generated artifact.
  -h, --hex              Compile the contract to hex format rather than a full artifact.
  -A, --asm              Compile the contract to ASM format rather than a full artifact.
  -c, --opcount          Display the number of opcodes in the compiled bytecode.
  -s, --size             Display the size in bytes of the compiled bytecode.
      --split            Emit a state-local one-hop root/facet bundle.
      --no-message-bus   Disable inferred atomic message-bus composition.
  -S, --skip-enforce-function-parameter-types
  -L, --skip-enforce-locktime-guard
      --allow-unverified-paths
      --allow-unsafe-operations
  -f, --format <format>  Specify the format of the output. (choices: "json", "ts", default: "json")
  -?, --help             Display help
```

:::tip
To have the best TypeScript integration, we recommend generating the artifact in the `.ts` format and importing it into your TypeScript project from that `.ts` file.
:::

#### Example
```bash
solidc ./Contract.scash --output ./artifact.ts --format ts
```

```bash
solidc ./Contract.scash --size --opcount

solidc ./Large.scash --split --output ./Large.split.json
```

:::info
The size outputs of the `solidc` compiler are based on the bytecode without constructor arguments. This means they are always an underestimate, as the contract hasn't been initialized with contract arguments.
:::

## JavaScript Compilation
Generally SolidCash contracts are compiled to an Artifact JSON file using the CLI compiler. They can also be
compiled programmatically with the `solidc` package.

```bash
npm install solidc
```

### compileFile()
```ts
compileFile(sourceFile: PathLike): Artifact
```

Compiles a SolidCash contract from a source file. This compile method is handy when using Node.js with the contract source file available but you are doing quick compilations (for example for contract size comparisons) and you don't need the contract artifact file to be generated.

:::note
`compileFile()` only works from a Node.js context because it uses the file-system so it's not available in browser setting.
:::

#### Example
```ts
const P2PKH = compileFile(new URL('p2pkh.scash', import.meta.url));
```

### compileString()
```ts
compileString(sourceCode: string): Artifact
```

Compiles a SolidCash contract from a source code string. This compile method is handy in a browser compilation setting like the [SolidCash Playground](https://playground.solidcash.org/) where testing contracts can be quickly compiled and discarded. The method is also useful if no source file is locally available (e.g. the source code is retrieved with a REST API).

```ts
const baseUrl = 'https://raw.githubusercontent.com/CashScript/cashscript'
const result = await fetch(`${baseUrl}/master/examples/p2pkh.scash`);
const source = await result.text();

const P2PKH = compileString(source);
```

## Multiple declarations

`compileFile()` and `compileString()` keep the single-artifact API and select the source's primary contract (the
last concrete top-level contract unless `primaryContractName` is provided). To compile every top-level declaration,
use the additive multi APIs:

```ts
import { compileFileMulti, compileStringMulti } from 'solidc';

const artifacts = compileFileMulti('Protocol.scash');
const tokenArtifact = artifacts.Token;
const factoryArtifact = artifacts.Factory;
```

The return value is an `ArtifactMap`, keyed by declaration/contract name in source order. Concrete contracts and
libraries receive normal artifacts; declaration-only units receive minimal artifacts; abstract contracts are not
deployable entries. Duplicate top-level names are a compile error.

For a deploy-aware wrapper which carries the complete artifact graph into the SDK, use `ContractBundle`:

```ts
import { ContractBundle } from 'solidcash';

const bundle = ContractBundle.from(artifacts, { provider, signer });
const { contract: factory } = await bundle.deploy('Factory', [owner], deployOptions);
```

This lets typed child deployments and linked library dependencies resolve artifacts without calling
`registerChild()` or `registerArtifacts()` manually.

## Split bundles

```ts
import { compileFileSplit, compileStringSplit } from 'solidc';

const split = compileFileSplit('Large.scash', {
  maxShardBytes: 9_500,
  forceSplit: false,
});
```

These functions always return a `SplitArtifactBundle`; a fitting contract has zero facets unless `forceSplit` is
set. See [Large Contracts & Split Bundles](./large-contracts.md) for planning, deployment, routing, and v1 limits.

## Common compiler options

| Option | Purpose |
| --- | --- |
| `primaryContractName` | Select the single-artifact primary contract explicitly |
| `enforceFunctionParameterTypes` | Enforce declared ABI argument types |
| `enforceLocktimeGuard` | Inject the guard required when `tx.locktime` participates in a spend |
| `enforceFinalRequire` | Promote unverified/unconstrained spending paths from warnings to errors |
| `allowUnsafeOperations` | Explicitly admit detected caller-controlled delegate/selfdestruct authority |
| `commitmentLimit` | Set the state-layout NFT commitment budget (bounded by the target network) |
| `maximumInputBytes` | Validate against a private/mock per-input ceiling; production defaults to 10,000 |
| `evmCompat` | Accept Solidity pragmas/imports, enable the Solidity porting pipeline, and use EVM word encoding for the `abi.*` family |
| `chunkedArrays` | Select the dense chunk backend for eligible unbounded state arrays |
| `chainId` | Bake `block.chainid` as a `uint256`; the current network convention uses only `chainId & 0xff` |
| `ecrecover` | Select the `p2pkh` or `evm` address projection for imported Solidity |
| `forceStateful` | Give a zero-state covenant a master NFT and empty state layout |
| `inlineLibraries` | Force named script-precompile libraries inline or into side-cars |
| `disableAutoInline` | Disable the small/single-use library inline heuristic |
| `userLibraries` | Register custom script-precompile code and its ABI |
| `brandLibrary` | Bind a deployed delegate library to its owning consumer's category |
| `messageBus` | `undefined` for inference, `true` to request a route, `false` to forbid it |
| `messageBusKernel` | Default `true`: compile message-bus routes as the kernel row loop instead of the legacy unroll |

`importResolver` and `rootFileId` are the browser/tooling hooks for imported sources. `compileFile*` supplies a
Node filesystem resolver automatically, including `node_modules` and optional `.sol` resolution.

Unsafe and relaxed options exist for migration, testing, and private networks. Publishing an artifact requires
the limits and security settings of the network which will validate it.
