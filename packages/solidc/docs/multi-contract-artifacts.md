# Spec: multi-contract artifact output

Status: **Phase 1 in implementation.** Supersedes the current "compile only the last contract" behavior for
callers that opt in. Companion to `source-maps.md`. See sections 13-14 for the registry-redundancy and
contract-less-artifact findings that motivate building this now.

## 1. Summary / decision

A single `.scash` file may declare several top-level contracts (common when porting Solidity). Today
`compileString` / `compileFile` return **one** `Artifact` - the **last** contract in the file - and discard the
rest into `importedContracts` (referenced bytecode only). This spec adds first-class multi-contract output.

Decisions (rationale in section 8):

- Return all contracts as a **map keyed by contract name** (`ArtifactMap`), mirroring solc's Standard-JSON
  `contracts[file][name]` shape. **Not** a JSON array, **not** one-on-disk-file-per-contract by default.
- Ship it **additively** via new `compileStringMulti` / `compileFileMulti`. The existing
  `compileString` / `compileFile` keep returning a single `Artifact` (the primary) - unchanged.
- **Do not** use a `Artifact | ArtifactMap` union return: it breaks the type for every existing caller (forces
  narrowing) while staying ambiguous about which shape you got - an overloaded-return anti-pattern.
- The eventual uniform-map break (making the primary entry points always return `ArtifactMap`) is **deferred**
  to a deliberate version boundary (section 9), to a map - never a union.
- The per-contract `Artifact` schema is **unchanged** and stays BCH-native (not Solidity-shaped); see section 10.

## 2. Background

### SolidCash today
- `compileString` (`compiler.ts:49`) / `compileFile` compile `ast.contract` into one `Artifact`.
- `AstBuilder.visitSourceFile` (`ast/AstBuilder.ts:504-512`) sets the **last** top-level contract as the primary
  and pushes the rest into `SourceFileNode.importedContracts`.
- `compileReferencedContracts` (`compiler.ts:233`) already compiles each *referenced* sibling to **bytecode** (for
  cross-contract calls), but never produces a full `Artifact` for them.

### Solidity (reference, `../solidity`)
- Standard JSON: one document, `output.contracts[sourceFile][contractName] = {...}` - a nested object **map**
  (`StandardCompiler.cpp:1717`).
- `--combined-json`: one document, flat map keyed `"<file>:<Contract>"`.
- CLI `-o <dir>`: *then* writes per-contract files `<filesystemFriendlyName>.bin/.abi/...`
  (`CommandLineInterface.cpp:191`). On-disk files are a CLI convenience layered on top of the map - not the model.

## 3. The `ArtifactMap` type (`packages/utils/src/artifact.ts`)

```ts
/** All compiled contracts from one compilation, keyed by contract name (solc's contracts[name] shape). */
export type ArtifactMap = Record<string, Artifact>;
```

- Keyed by **contract name**. Names are unique within a compilation unit in SolidCash today, so a flat map is
  sufficient. If cross-file imports ever introduce a name collision, switch the key to `"<file>:<name>"` (or a
  nested `Record<file, Record<name, Artifact>>`) - documented as a forward-compatible change, not done now.
- Iteration order = **source declaration order** (matches solc).

## 4. API surface (`packages/solidc/src/compiler.ts`)

```ts
export function compileStringMulti(code: string, options?: CompileOptions): ArtifactMap;
export function compileFileMulti(path: string, options?: CompileOptions): ArtifactMap;
```

Semantics:
- Returns one `Artifact` per **top-level, concrete** contract declared in the file (the primary + every sibling
  currently dropped into `importedContracts`).
- Cross-references between siblings resolve exactly as today (each non-primary is still available as referenced
  bytecode while compiling the others).
- `library` contracts -> their normal artifact (`isLibrary: true`). Declaration-only units (standalone
  interface / file-level enum-struct / inline-only library) -> the existing minimal artifact via
  `generateDeclarationArtifact`. **Abstract** contracts are **excluded** from the map (not deployable); revisit
  if Solidity-parity "empty-bytecode entry for abstract" is wanted.
- Duplicate top-level contract names in one file -> a compile error (matches solc's duplicate-definition error),
  rather than silent last-wins.
- `compileString` / `compileFile` are **unchanged**: still return the single primary `Artifact`.

## 5. Implementation plan

1. **Extract a per-contract compile helper.** Refactor the body of `compileString` (from semantic analysis at
   `compiler.ts:160` through `generateArtifact` at `:221`) into `compileContract(primary, siblings, code,
   options): Artifact`. `compileString` becomes: parse -> pick primary (last) -> `compileContract`.
2. **`compileStringMulti`:** parse once; collect the full top-level contract list (the array
   `AstBuilder.visitSourceFile` already builds at `:442`, before it splits primary/imports). For **each** concrete
   top-level contract, call `compileContract(thatContract, theOthers, code, options)` and key the result by name.
3. **Reuse, don't re-parse per contract** where cheap: parsing + `AstBuilder` run once; the per-contract pipeline
   (semantic passes + codegen + optimise + artifact) runs N times (each contract sees the others as imports).
   Correctness first; a shared-frontend optimization is a follow-up.
4. **Keep `compileReferencedContracts` as-is** - it still supplies sibling bytecode during each per-contract pass.

## 6. Output modes

- **Programmatic (default):** return the `ArtifactMap`. This is the canonical form (solc's Standard-JSON model).
- **On-disk (optional, additive):** a thin helper for CLI/tooling, mirroring solc `-o`:
  ```ts
  export function writeArtifacts(map: ArtifactMap, outDir: string): void; // one <ContractName>.json per entry
  ```
  Not required for the core feature; specify only if/when a CLI needs it. The map is not written as a JSON array.

## 7. Backward compatibility

- **Phase 1 (this spec):** purely additive. Zero changes to `compileString` / `compileFile`, the SDK, the bench,
  or existing tests. Safe alongside the parallel agent on this branch.
- **Phase 2 (deferred, deliberate):** migrate the primary entry points to always return `ArtifactMap`, with a
  one-shot codemod for internal call sites (`new Contract(map[name])`, `Object.values(map)[0]`, etc.). Precondition:
  no external npm consumers **and** the parallel agent is paused/coordinated. The break is to a **uniform map**;
  the union is never adopted.

## 8. Why a map, additively (not a union, not break-now)

- A `Artifact | ArtifactMap` union is back-compatible only at runtime; at the type level every existing caller
  must narrow before touching a field, and the returned shape depends on the input (single vs multi contract) -
  ambiguous and unergonomic. If one entry point must do both, a return-typed **overload**
  (`compileString(code, {multi:true}): ArtifactMap`) is the type-safe form - but that is just the additive
  function under one name.
- Breaking `compileString` now is clean long-term (solc always returns the map) but collides with the parallel
  agent + the in-flight bench push for marginal present value - hence deferred, not rejected.

## 9. Out of scope: the per-contract artifact schema

The `Artifact` envelope is **not** reshaped to Solidity's. Its ABI (BCH types + covenant metadata), single
locking bytecode (no creation/runtime split), and UTXO-native fields (`stateLayout`, `functionBodies`,
`externalInterfaces`, `fingerprint`) have no clean Solidity mapping, and no EVM tool can consume a BCH artifact.
The only Solidity convention adopted here is the multi-contract **map**. (Full rationale: the artifact-format
evaluation; mirrors the source-maps decision to stay BCH-native.)

## 10. Edge cases

- Single-contract file via `compileStringMulti` -> a one-entry map; `compileString` returns that same artifact.
- Sibling cross-references (`A` uses `B` in the same file) -> resolve via the existing referenced-bytecode path.
- `library` / interface-only / file-level enum-struct -> their normal / minimal artifacts, included in the map.
- Abstract contract -> excluded from the map.
- Duplicate top-level names -> compile error.

## 11. Test plan

- 2-contract file: `compileStringMulti` -> 2-entry map; each artifact instantiates (`new Contract(map[name])`)
  and its functions unlock.
- Sibling cross-call (`A.f()` -> `B`) compiles and the e2e co-spend resolves.
- Single-contract file: `compileStringMulti` -> 1 entry; `compileString` unchanged (byte-identical artifact).
- Duplicate-name file -> throws.
- `library` + interface-only + abstract: presence/absence in the map per section 4.
- Regression: existing `compileString`/`compileFile` suites unchanged (additive).

## 12. Anchors

- Current entry: `packages/solidc/src/compiler.ts:49` (`compileString`), `:160-221` (per-contract pipeline),
  `:233` (`compileReferencedContracts`).
- Primary-vs-imports split: `packages/solidc/src/ast/AstBuilder.ts:442` (list), `:504-512` (last-as-primary).
- Artifact type: `packages/utils/src/artifact.ts:340`.
- Solidity reference: `../solidity/libsolidity/interface/StandardCompiler.cpp:1717` (map),
  `../solidity/solc/CommandLineInterface.cpp:191` (per-contract files).

## 13. Why now: this retires the SDK dependency registry

The SDK has three registries - `registerChild` (deploy), `registerLibrary` (delegate), and
`externalContracts` / `_externalRegistry` (external calls). Each binds a name to **two** facts at once:

- **(A) the artifact** - bytecode / ABI / `stateLayout`. *Compile-time* knowledge: the parent already imports
  / `new`s / calls the dependency.
- **(B) the live instance** - the deployed contract's **category** + address. *Runtime* fact: which on-chain
  UTXO to co-spend.

The multi-contract `ArtifactMap` supplies **(A) for the whole graph**. **(B) is not a registry need at all**:

- The **address** comes from auto-derivation - an external call's `addr` is a call argument; a *branded*
  delegate library's address is `address(libArtifact, [brand = libraryBrand(consumerCategory)])`, derivable
  from the map + the consumer category; a `new C()` has no instance (it is being minted).
- The **category** (and master/data capabilities + commitments) is revealed directly by
  `provider.getUtxos(address)` - the indexer attaches `token: { category, nft }` per UTXO. This is exactly
  what `getFullState` already does for a contract's own state, so co-spending an external/delegate target is
  `getFullState(targetAddress)`. No spend-probe needed (the self-pin parse from a spending tx is only a
  fallback for reconstructing an unusual unlocker).

So the registry decomposes into: **artifact -> ArtifactMap (by name)**, **instance/category ->
`getUtxos(address)`**, **address -> a call arg or `artifact + brand`**. `registerChild` /
`registerLibrary` / `externalContracts` collapse to internal resolution. The only irreducible input is the
*Artifact of a contract you neither compiled nor imported* - a lone `Artifact`, not a registry of instances.
Resolution keys already exist in the per-function ABI: `deployTargets[].contractName`,
`libraryDelegateCalls[].library`, `externalReads`/`externalCalls[].interfaceName`.

## 14. Contract-less artifacts (types / events / interfaces / errors)

Once the compiler emits **one artifact per top-level declaration**, "contract" stops being special - the map
carries non-deployable declarations too, mirroring solc's `contracts[file][name]` (where an interface entry
is ABI-only and a library is its own entry). The per-contract `Artifact` schema is unchanged and stays
**BCH-native** (section 9): the borrowed convention is the multi-entry map, *not* EVM ABI encoding.

| declaration | minimal artifact carries | enables |
|---|---|---|
| **interface** | ABI only (selectors + signatures), no bytecode | external-call typing + function dispatch (the (A) ABI half of an `IFoo(addr).m()` co-spend) |
| **struct / enum / UDVT** | the type's BCH pushdata field-layout schema | one shared encode/decode for the SDK + cross-contract code |
| **event** | signature + the event-NFT commitment shape | decode emitted events without the emitter's full artifact |
| **error** | error signature (require-with-error) | decode revert reasons |
| **library** | full artifact (`isLibrary: true`, with bytecode) | precompile blob / delegate target (already produced) |
| **free fn / file-level** | minimal artifact | parity completeness |

These come from the existing `generateDeclarationArtifact` path (section 4); Phase 1 promotes them to
first-class, schema-carrying map entries keyed by name alongside the concrete contracts.

## 15. Updated phasing

1. **Phase 1 (this):** `compileStringMulti` / `compileFileMulti` -> `ArtifactMap`, including **imported**
   contracts (not just same-file siblings - dependencies are usually `import`ed) and the contract-less
   entries above. `compileString` / `compileFile` unchanged.
2. **Phase 2 (SDK, done):** `StatefulContract.registerArtifacts(map)` loads a whole `ArtifactMap` into the
   child registry in one call; `deployFrom` resolves the dependency artifact from the ABI's recorded
   `deployTargets[].contractName`, no per-child `registerChild`, no `childArtifact`. The registry stays as the
   fallback for a foreign pre-deployed instance.
3. **Phase 2b (SDK, done):** `ContractBundle.from(map, { provider })` wraps the map + provider (+ optional
   signer) as the implicit deploy context. `deploy` / `withCategory` / `attach` auto-register the whole map, so
   the consumer never calls `registerArtifacts`. `attach(name, address)` resolves the **live category** from
   the indexer via `getUtxos(address).token.category` (`resolveCategoryFromAddress`), confirming the
   category half of the registry is redundant for any deployed instance.
4. **Phase 3a (SDK, done):** the DELEGATE-library co-spend resolves from the bundle via `getUtxos`, with no
   `registerLibrary`. When a consumer registered the `ArtifactMap` (so the library artifact is in its child
   registry) but no library instance, `_resolveLibrariesFromRegistry` takes the artifact by name, reads the
   library's live category from the indexer (`resolveCategoryFromLockingBytecode` on the consumer's baked
   `__libAddr_<name>` ctor arg), rebuilds the instance (branded -> `__brand` = consumer category; else no args)
   and registers it only if it hashes back to the baked address. Purely additive: it fires only in the path that
   previously threw, so registered-instance flows are byte-identical.
5. **Phase 3b (remaining, shape TBD):** the same retirement for **external** calls/reads. Harder than delegates:
   externals are self-pinned, so the target address is derived *from* the category (circular - only the
   consumer's baked `addressParam` breaks it, and only for direct externals; transitive external graphs chain
   through categories), and `_buildExternalGraph` runs synchronously at `withCategory`/`from`, so `getUtxos`
   either forces the connect API async or moves external-graph construction to call-time. Artifact resolution is
   by interface name, so bundle auto-resolution also needs an interface->implementation convention.
6. **Phase 3c (remaining):** a deploy-graph helper that deploys a contract and its lib deps from the map in
   order, auto-wiring. Bounded for non-branded libraries (deploy the library, link the consumer to its address,
   calls auto-wire via 3a); branded libraries carry a deploy-time category circularity that needs pre-chosen
   categories.
