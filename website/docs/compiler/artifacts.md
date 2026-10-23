---
title: Artifacts
---

An artifact is the compiler/SDK contract. It contains the Bitcoin Script program, ABI, constructor schema,
state-storage plan, protocol metadata, and optional debug information needed to construct, spend, inspect, or
compose a contract without recompiling its source.

Artifacts can be emitted as JSON or as typed TypeScript. Persist the exact artifact used for a deployment:
addresses, state layouts, selectors, inferred routes, and debug maps can all change when source or compiler options
change.

## Core envelope

```ts
interface Artifact {
  contractName: string;
  constructorInputs: readonly AbiInput[];
  abi: readonly AbiFunction[];
  bytecode: string;                 // CashAssembly text, before constructor args
  source: string;
  compiler: {
    name: string;
    version: string;
    options?: CompilerOptions;     // the options that change how the artifact is read
  };
  updatedAt: string;
  fingerprint?: string;
  debug?: DebugInformation;
  functionBodies?: Record<string, string>;

  stateLayout?: StateLayout;
  structs?: readonly StructDefinitionInfo[];
  enums?: readonly EnumDefinitionAbi[];
  events?: readonly EventDefinitionAbi[];
  errors?: readonly ErrorDefinitionAbi[];
  externalInterfaces?: readonly ExternalInterfaceInfo[];

  externalLibraries?: readonly ExternalLibraryAbi[];
  isLibrary?: boolean;
  delegateOnly?: boolean;          // a split-bundle facet
  delegateArtifact?: Artifact;
  invocationAnalysis?: InvocationAnalysisArtifact;
  messageBus?: MessageBusArtifact;
  composition?: { convention: 'framed'; /* ... */ };
  refusedFunctions?: readonly PublishedRefusedEntry[];
  diagnostics?: readonly { severity: 'warning' | 'error'; code: string; message: string }[];
}
```

`bytecode` is assembly text, not serialized hex. The SDK assembles it, injects encoded constructor arguments and
addressing prefixes, and exposes the final hex through `Contract.bytecode`. `debug.bytecode` is the compiler's
hex-encoded debug stream.

`fingerprint` is a SHA-256 fingerprint of the normalized bytecode pattern. It identifies code shape independently
of volatile artifact metadata; it is not a deployment address or category ID.

## ABI functions

Each ABI entry starts with the familiar call schema:

```ts
interface AbiFunction {
  name: string;
  selector?: string;
  inputs: readonly AbiInput[];
  outputs?: readonly AbiOutput[];
  modifiers?: readonly string[];
  isFallback?: boolean;
  isReceive?: boolean;
}
```

Stateful and composed calls carry additional compiler-owned metadata. Depending on the source, an entry can
describe:

- required scalar data-NFT indices and a balanced input/output block layout;
- vmap entry reads/writes, key sources, iteration, batch and loop operations;
- dynamic value/chunk reads and writes;
- events, BCH transfers, token-container effects, and return carriers;
- typed/low-level external calls and `outState` reads;
- child deployments, delegate/library calls, and lifecycle modifiers;
- blockhash, Keccak, and ecrecover sidecars; and
- message-bus eligibility and handler effects.

Inputs whose names begin with `__internal__` are compiler witnesses. A normal SDK caller supplies only visible
source parameters; transaction construction resolves the internal indices, proofs, bounds, and routed values.
Third-party artifact consumers must preserve and implement these fields rather than exposing them as user ABI.

## State layout

`stateLayout` marks an artifact as stateful and describes the exact NFT commitment layout:

```ts
interface StateLayout {
  variables: readonly StateVariableInfo[];
  dataNftCount: number;
  commitmentLimit: number;          // normally 128 bytes
  collections?: readonly CollectionInfo[];
  structs?: readonly StructDefinitionInfo[];
  // additional generated roles/hints may be present
}
```

For each scalar field, `nftIndex` and `fieldIndex` are persistent physical positions. Visibility, immutability,
packed form, dynamic/chunk storage, and contract-reference information are recorded where applicable.

Collections record mapping/array signatures, key/value types, nested key lists, bounds, enumeration, the verified
sorted-list backend, and whether values can spill into chunks. State readers and upgrade checks use this metadata;
do not recompute layout from the source in an SDK.

See [State Storage & Encoding](/docs/language/storage-model) and
[Verified Mappings](/docs/language/verified-mappings).

## Events, errors, and user types

Top-level arrays describe definitions separately from functions:

- `events`: signature, parameters, `indexed` flags, and `anonymous` status. A parameter carries an ABI `type` and,
  when compiled with `evmCompat` and the type has a scalar packed form, a `notation: 'evm'` flag;
- `errors`: custom-error signature and parameters;
- `structs`: field order and nested type information used for ABI/state decoding; and
- `enums`: member names and ordinal values.

The event ABI is used both to plan event-NFT outputs and to decode `receipt.events`, `queryEvents()`, and
`queryFilter()`. Event persistence semantics are described in [Events & Errors](/docs/language/events-errors).

A parameter's `notation: 'evm'` flag tells a decoder that the argument is written in the standard EVM notation -
the bytes `abi.encodePacked` produces at the type's natural width - so the reader takes the width from the ABI
`type`. A parameter without the flag is written in the platform pushdata frame.

## Debug information and source maps

```ts
interface DebugInformation {
  bytecode: string;
  sourceMap: string;
  logs: readonly LogEntry[];
  requires: readonly RequireStatement[];
  functionDebug?: Record<string, FunctionDebugInformation>;
  invokeDebug?: Record<string, InvokeDebugInformation>;
}
```

The main `sourceMap` covers the dispatcher stream. Multi-function contracts store executable function bodies
separately under `functionBodies[selector]`; their per-instruction locations, log sites, and require sites live in
`debug.functionDebug[selector]`. Nested `OP_INVOKE` helpers use `invokeDebug[functionId]`.

Tooling must stitch these tiers based on the selected ABI function. Reading only the top-level map shows a
function body as the data push registered by `OP_DEFINE`, not the detailed executed stream. SolidCash's debugger
performs this stitching automatically.

`console.log` metadata exists only for debugging. Production compilation strips the log effects from contract
semantics.

## Delegate and protocol metadata

`delegateArtifact` is a second compile of proxy-eligible functions whose `this.<state>` accesses target a
co-spent proxy. It is intentionally a different script. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies).

`invocationAnalysis` is the compiler's call/resource closure. It identifies functions, internal components,
external calls, state/effects, recursion, and boundedness for splitting and atomic composition. Its presence is
analysis, not permission to bypass a covenant.

When eligible, `messageBus` publishes the route ABI, handler eligibility, verifier program, canonical envelope
limits, and participant/row bounds consumed by `messageBus.compose()`. It also carries the admission stamp
(`admittedHandlerIds`, `refusedHandlerIds`, `admissionSource`), the published `resourceBudgets`, and a concrete
`deployability` certificate stating whether the measured route bytecode fits the 10,000-byte P2SH limit. Treat
these as versioned wire metadata; see
[Message Bus Artifact Reference](/docs/reference/message-bus-artifact). Message-bus composition is experimental in
0.14.0-beta.1.

`externalLibraries` describes inline or co-spent libraries and compute sidecars, including branding, integrity
hashes, ABI, result-NFT mode, and minimum instance capacity.

`composition` is present only on an artifact compiled with `composition: 'framed'`, the experimental framed
convention. It publishes the placeholders and stop sites the SDK fills and checks; see
[Framed Composition](/docs/guides/framed-composition). `refusedFunctions` lists entry points the compiler refused:
each stays in the ABI but fails whenever it is reached, and its `reason` lets a builder report which function is
unsupported instead of a failed spend.

`diagnostics` retains compiler warnings and errors useful to downstream tooling. Do not silently discard a
security warning merely because bytecode was emitted under an explicit unsafe compatibility option.

## Multi-contract artifact maps

A source file may contain several deployable contracts, libraries, interfaces, and declaration-only units:

```ts
import { compileFile, compileFileMulti } from '@solidcash/solidc';

const primary = compileFile('Protocol.scash');
const artifacts = compileFileMulti('Protocol.scash');

const factoryArtifact = artifacts.Factory;
const tokenArtifact = artifacts.Token;
```

`compileFile()` and `compileString()` return the primary single artifact for compatibility.
`compileFileMulti()` and `compileStringMulti()` return an `ArtifactMap` keyed by declaration name in source order.
Abstract contracts are not deployable entries. `ContractBundle` consumes the map and registers it as dependency
context for child deployments, libraries, and cross-contract resolution.

## Split artifact bundles

With the default `split: 'size'`, `compileFileSplit()` / `compileStringSplit()` return a different versioned
envelope (`split: 'off'` returns a plain `Artifact`):

```ts
interface SplitArtifactBundle {
  format: 'solidcash-split-v1';
  root: Artifact;
  facets: ArtifactMap;
  manifest: SplitManifest;
}
```

The manifest binds selectors to immutable one-hop facets, records the shared state-layout fingerprint and logical
identity scheme, and publishes per-route state/effect footprints. Load it through `SplitContractBundle`; do not
treat its delegate-only facets as standalone application-state contracts. See
[Large Contracts & Split Bundles](/docs/compiler/large-contracts).

`split: 'func'` (experimental, framed convention) returns a `FunctionSplitBundle` instead: `format:
'solidcash-split-v2'`, a `logical` artifact for the whole contract, and one framed master per ABI entry in
`shards`.

## TypeScript artifacts

The CLI can generate a `.artifact.ts` module whose value still satisfies the runtime `Artifact` schema while its
literal ABI drives SDK generics. This provides constructor tuples, function names/arguments, event names, and event
matcher types without a separate code-generation pass.

```bash
solidc Counter.scash --format ts --output Counter.artifact.ts
```

JSON is appropriate for language-neutral storage and third-party SDKs. TypeScript is preferable inside an SDK
application when compile-time call safety matters.

## Compatibility rules

- The SDK rejects incomplete artifacts and compiler versions older than its supported floor.
- A deployment should be reconstructed with the same artifact, compiler options, constructor arguments, salt,
  address type, and stateful category.
- Unknown versioned bundle/protocol fields should fail closed rather than being guessed.
- Generated artifacts such as the built-in proxy must keep `bytecode`, debug bytecode/maps, and `fingerprint`
  synchronized; hand-editing only one field creates an artifact that cannot be audited reliably.

See [Compiler](/docs/compiler) for output commands and options, and
[Contract Instantiation](/docs/sdk/instantiation) for how the SDK constructs final bytecode.
