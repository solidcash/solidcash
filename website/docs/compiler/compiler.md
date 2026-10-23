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
npm install -g @solidcash/solidc
```

### CLI Usage
The `solidc` CLI tool can be used to compile `.scash` files to JSON (or `.ts`) artifact files.

```bash
Usage: solidc [options] <source_file>

Options:
  -V, --version          Output the version number.
  -o, --output <path>    Specify a file to output the generated artifact.
  -h, --hex              Compile the contract to hex format rather than a full artifact.
  -A, --asm              Compile the contract to ASM format rather than a full artifact.
  -c, --opcount          Display the number of opcodes in the compiled bytecode.
  -s, --size             Display the size in bytes of the compiled bytecode.
  --split [mode]         Split mode: off, size, or func. A bare --split is refused.
  --suppress-warnings    Suppress non-fatal compiler warnings.
  --no-source-map        Skip bytecode source maps (faster compile; weaker debug attribution).
  --no-message-bus       Disable inferred atomic message-bus composition (fails if the contract requires it).
  -S, --skip-enforce-function-parameter-types  Do not enforce function parameter types.
  -L, --skip-enforce-locktime-guard            Do not inject a tx.time guard when tx.locktime is used.
  --allow-unverified-paths    Allow spending paths with no verification or state covenant (unsafe).
  --allow-unsafe-operations   Allow detected caller-controlled delegatecall/selfdestruct authority (unsafe).
  -f, --format <format>  Specify the format of the output. (choices: "json", "ts", default: "json")
  -?, --help             Display help
```

`-h` prints hex, not help: use `-?` or `--help` for help. The CLI takes exactly one source file and has no
Solidity-mode flag; compile `.sol` sources through the [JavaScript API](#javascript-compilation) with
`evmCompat: true`, or through a [SolidHat](/docs/tooling/solidhat) project.

| Flag | Effect |
| --- | --- |
| `-o, --output <path>` | Write the artifact to a file, creating missing directories. Without it, or with `-o -`, the artifact goes to stdout. |
| `-f, --format json\|ts` | `json` (default) or a TypeScript module (`export default {...} as const`) whose literal types drive the SDK's typed calls. |
| `-h, --hex` / `-A, --asm` | Print only the script, as hex or as ASM. They cannot be combined with each other, with `--output`, or with `--split size\|func`. |
| `-c, --opcount` / `-s, --size` | Print the opcode count and/or the byte size instead of the artifact. With a split mode, one line per shard. |
| `--split off\|size\|func` | `off` compiles a normal artifact. `size` always splits into a root plus facets (it sets `forceSplit`), see [Large Contracts](/docs/compiler/large-contracts). `func` compiles one framed master per entry point and selects the framed convention (experimental). |
| `--suppress-warnings` | Hide non-fatal warnings, including the over-10,000-byte size warning. Errors still fail the compile. |
| `--no-source-map` | Sets `sourceMap: false`: no source maps on the artifact. Faster, but failures are attributed less precisely. |
| `--no-message-bus` | Sets `messageBus: false`: compile direct-only. Fails with `MESSAGE_BUS_REQUIRED` when the contract needs a bus route. |
| `-S` | Sets `enforceFunctionParameterTypes: false`. |
| `-L` | Sets `enforceLocktimeGuard: false`. |
| `--allow-unverified-paths` | Sets `enforceFinalRequire: false`: a spend path with no verification and no state change becomes a warning instead of an error. Unsafe. |
| `--allow-unsafe-operations` | Sets `allowUnsafeOperations: true`. Unsafe. |

When the compiled script is over 10,000 bytes, `solidc` prints a warning that the BCH network will not accept it.

:::tip
To have the best TypeScript integration, we recommend generating the artifact in the `.ts` format and importing it into your TypeScript project from that `.ts` file.
:::

#### Example
```bash
solidc ./Contract.scash --output ./artifact.ts --format ts
```

```bash
solidc ./Contract.scash --size --opcount

solidc ./Large.scash --split size --output ./Large.split.json
```

:::info
The size outputs of the `solidc` compiler are based on the bytecode without constructor arguments. This means they are always an underestimate, as the contract hasn't been initialized with contract arguments.
:::

## JavaScript Compilation
Generally SolidCash contracts are compiled to an Artifact JSON file using the CLI compiler. They can also be
compiled programmatically with the `solidc` package.

```bash
npm install @solidcash/solidc
```

### compileFile()
```ts
compileFile(sourceFile: PathLike, options?: CompileOptions): Artifact
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
compileString(sourceCode: string, options?: CompileStringOptions): Artifact
```

Compiles a SolidCash contract from a source code string. This compile method is handy in a browser, where test contracts can be compiled quickly and discarded. The method is also useful if no source file is locally available (e.g. the source code is retrieved with a REST API).

```ts
const baseUrl = 'https://raw.githubusercontent.com/solidcash/solidcash'
const result = await fetch(`${baseUrl}/master/examples/p2pkh.scash`);
const source = await result.text();

const P2PKH = compileString(source);
```

## Multiple declarations

`compileFile()` and `compileString()` keep the single-artifact API and select the source's primary contract (the
last concrete top-level contract unless `primaryContractName` is provided). To compile every top-level declaration,
use the additive multi APIs:

```ts
import { compileFileMulti, compileStringMulti } from '@solidcash/solidc';

const artifacts = compileFileMulti('Protocol.scash');
const tokenArtifact = artifacts.Token;
const factoryArtifact = artifacts.Factory;
```

The return value is an `ArtifactMap`, keyed by declaration/contract name in source order. Concrete contracts and
libraries receive normal artifacts; declaration-only units receive minimal artifacts; abstract contracts are not
deployable entries. Duplicate top-level names are a compile error.

For a deploy-aware wrapper which carries the complete artifact graph into the SDK, use `ContractBundle`:

```ts
import { ContractBundle } from '@solidcash/solidcash/stateful';

const bundle = ContractBundle.from(artifacts, { provider, signer });
const { contract: factory } = await bundle.deploy('Factory', [owner], deployOptions);
```

This lets typed child deployments and linked library dependencies resolve artifacts without calling
`registerChild()` or `registerArtifacts()` manually.

## Split bundles

```ts
import { compileFileSplit, compileStringSplit } from '@solidcash/solidc';

const split = compileFileSplit('Large.scash', {
  maxShardBytes: 9_500,
  forceSplit: false,
});
```

The return type follows the `split` option:

| `split` | Returns |
| --- | --- |
| omitted or `'size'` | a `SplitArtifactBundle` (root plus facets). A contract that already fits has zero facets unless `forceSplit` is set. |
| `'off'` | a plain `Artifact`, as `compileFile()` returns |
| `'func'` | a `FunctionSplitBundle`: one framed master per ABI entry (experimental; requires `composition: 'framed'`) |

`compileFile()` and `compileString()` refuse `split: 'size'` and `split: 'func'`. See
[Large Contracts & Split Bundles](./large-contracts.md) for planning, deployment, routing, and v1 limits.

## Compiler options

Every compile function takes an options object. `DEFAULT_COMPILER_OPTIONS` (exported by `solidc`) holds the
defaults: `enforceFunctionParameterTypes: true`, `enforceLocktimeGuard: true`, `enforceFinalRequire: true`,
`allowUnsafeOperations: false`, `commitmentLimit: 128`, `chunkedArrays: true`, `chainId: 0`, `optimise: true`,
`messageBusKernel: true` and `composition: 'direct'`. The artifact records the options that change how it is read
(`evmCompat`, the enforcement flags, `commitmentLimit`, `messageBus` and a few more) under `compiler.options`.

### Safety and validation

| Option | Default | Purpose |
| --- | --- | --- |
| `enforceFinalRequire` | `true` | A public or external spend path with no verification (`require`, `assert`, `revert`, a time check) and no state change is a compile error. `false` turns it into a warning; such a path is spendable by anyone. |
| `enforceFunctionParameterTypes` | `true` | Check entry arguments: bounded integers, fixed-point values, enums and `bool` are range-checked, `bytesN` length-checked. |
| `enforceLocktimeGuard` | `true` | Inject the guard required when `tx.locktime` participates in a spend. |
| `allowUnsafeOperations` | `false` | Admit compiler-detected caller-controlled `delegatecall`/`selfdestruct` authority. A migration and testing escape hatch only. |
| `maximumInputBytes` | `10000` | The per-input byte ceiling the compiler plans against (the BCH limit). Raise it only for a private or mock network. |
| `commitmentLimit` | `128` | NFT commitment budget for the state layout. BCH allows 128 bytes. |

### Solidity compatibility

| Option | Default | Purpose |
| --- | --- | --- |
| `evmCompat` | `false` | Solidity mode: accept `pragma solidity` and `.sol` imports, apply Solidity type and literal rules, use EVM ABI words and keccak256 selectors. See [Solidity Import Compatibility](/docs/compiler/solidity-import-compat). |
| `addressForm` | follows the mode | `'hash'` (the 20-byte identity) or `'bytecode'` (the whole locking bytecode): the form an `address` takes where it becomes bytes. Omitted means `'hash'` under `evmCompat` and `'bytecode'` otherwise. |
| `ecrecover` | `'evm'` under `evmCompat`, else unset | Map bare Solidity `ecrecover(hash, v, r, s)` to the `'p2pkh'` or `'evm'` address projection. Natively, `ecrecover` is undefined unless this is set. |
| `chainId` | `0` | The value of `block.chainid`, baked as one byte (`chainId & 0xff`). Convention: mainnet 0, chipnet 1, testnet4 2, regtest -1. |

### Imports, selection and diagnostics

| Option | Purpose |
| --- | --- |
| `primaryContractName` | Select the contract compiled into the single artifact instead of the last concrete one. |
| `compileDeclarations` | Fully compile only these contract names in a multi compile; other imported concrete contracts are left out (interfaces still get ABI-only artifacts). |
| `importResolver`, `rootFileId` | Resolve imports without a filesystem (browser and tooling hook). `compileFile*` supplies a Node resolver automatically, including `node_modules` and `.sol` resolution under `evmCompat`. |
| `files` | String entry points only: an in-memory map of import sources keyed by path, shorthand for `importResolver: createMapResolver(files)`. Pass `files` or `importResolver`, not both. |
| `errorListener` | Receive syntax errors through a custom `SolidCashErrorListener`. |
| `warningListener` | Receive each warning as a `CompilerWarning` instead of the default console print. Compose with `defaultWarningListener` to print and collect. |
| `suppressWarnings` | Discard non-fatal warnings. Errors still throw. |
| `sourceMap` | Default `true`. `false` skips source maps; require and log line numbers are still recorded. |
| `optimise` | Default `true`. `false` emits the unoptimised script so a VM failure points at the exact source line. Debugging only: the script is larger, so never deploy it. |

```ts
import { compileString, defaultWarningListener, type CompilerWarning } from '@solidcash/solidc';

const warnings: CompilerWarning[] = [];
const artifact = compileString('import "./math.scash";\ncontract Calculator() { ... }', {
  files: { 'math.scash': 'function double(int x) pure returns (int) { return x * 2; }' },
  warningListener: (warning) => { warnings.push(warning); defaultWarningListener(warning); },
});
```

### State and code generation

| Option | Default | Purpose |
| --- | --- | --- |
| `chunkedArrays` | `true` | Store an eligible unbounded fixed-width `T[]` state array in the dense chunk backend. `false` selects the sparse entry-NFT collection. |
| `forceStateful` | `false` | Give a contract with no state a master NFT and an empty state layout, so it can be called through the stateful SDK. |
| `tagSingletonDataNfts` | `false` | Encode an NFT-index tag even when fixed state fits one data NFT. A wire-layout choice. |
| `inlineLibraries` | automatic | Per built-in library name (for example `keccak256`): `true` always inlines it, `false` always uses a side-car. |
| `disableAutoInline` | `false` | Disable the heuristic that inlines small, single-use libraries. Explicit `inlineLibraries` entries still apply. |
| `userLibraries` | none | Register custom script libraries: `{ name, code, abi: { inputs, outputs } }`, with `code` as hex. |
| `brandLibrary` | `false` | Brand a delegate library to its consumer's category, so it is spendable only beside that consumer's master. |
| `delegateArtifactContracts` | all | Only these contract names receive a `delegateArtifact` (the proxy-context build). |
| `reuseEntryLocalForWriteback` | `true` | Size optimisation. `false` exists for size measurements only; do not deploy it. |
| `autoDelegate` | unset | Internal: the compiler sets it to produce `delegateArtifact`. Do not set it. |

### Composition (experimental)

Message-bus kernel composition and the framed convention are experimental profiles. Leave these options at their
defaults unless you are following the [message bus guide](/docs/guides/message-bus) or the
[framed composition guide](/docs/guides/framed-composition).

| Option | Default | Purpose |
| --- | --- | --- |
| `messageBus` | automatic | Omitted infers a route from the source's atomic call graph. `true` also requests a route for a graph-free contract and falls back to direct-only when none can be built. `false` compiles direct-only and fails with `MESSAGE_BUS_REQUIRED` when the source needs a bus. |
| `messageBusKernel` | `true` | Compile routes as the kernel row loop. `false` reproduces the legacy unrolled route, for compatibility tests only. |
| `messageBusHandlers` | all eligible | Clone only these entry points (by name, or `{ name, selector }` for one overload) into the route. |
| `messageBusGraphContext` | `false` | Compile a graph-free participant with the atomic graph envelope. |
| `messageBusEntryPoolCapacity` | 8 / 2 | Entry lanes for graph-context one-key pools (default 8) and fixed-key tuples (default 2). An integer from 1 to 99. |
| `messageBusDirectParticipant` | `false` | Allow atomic manifests with a co-spent direct-only participant and no verifier NFT. |
| `messageBusRootEnvelope` | `false` | Carry the canonical envelope on the root route. |
| `messageBusProxyForwardEnvelope` | `false` | Carry the canonical envelope in the root proxy's forward payload. |
| `optimizeForCompilationSpeed` | `false` | Skip speculative route admission attempts and compile the conservative route directly. |
| `ownerAltAnchor`, `handlerBandModel` | off | Opt-in route code generation features; omitted reads the `SOLIDC_OWNER_ALT_ANCHOR` / `SOLIDC_HANDLER_BAND_MODEL` environment flags. |
| `composition` | `'direct'` | `'framed'` compiles each entry point as a master program that recreates itself, so a contract's state settles once per transaction. The result is published on `artifact.composition`. |
| `upgradesFrom` | none | Framed proxies: per contract name, the state layout of the implementation it replaces. The compile refuses a layout that would read those records differently. |
| `split` | see above | `'off'`, `'size'` or `'func'`, for the split entry points. |

Split compiles also take `maxShardBytes` (the per-shard redeem-script ceiling; omitted, the planner budgets the
BCH input limit including constructor and call arguments), `forceSplit` (split even when the contract fits) and
`rootFunctions` (entry points to keep on the root). See [Large Contracts](/docs/compiler/large-contracts).

Unsafe and relaxed options exist for migration, testing, and private networks. Publishing an artifact requires
the limits and security settings of the network which will validate it.
