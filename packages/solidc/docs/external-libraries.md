# External Libraries (script precompiles)

A user-extensible registry of named BCH-script libraries that are callable from contracts like builtins.
`keccak256` is the first built-in instance; the same mechanism supports future built-ins (`keccak512`)
and user-supplied libraries.

## Concept

A **library** is a named, self-contained script (a function `[inputs] -> [outputs]`, an OP_DEFINE-able
blob) plus an ABI signature. Registering a library named `lib` makes `lib(args)` a valid, type-checked
call in a contract, resolved by **name**. The blob is either inlined into the contract redeem or loaded
at runtime from a co-spent side-car UTXO.

## Decisions (locked)

- **Registry is user-extensible (1c):** built-in precompiles (`keccak256`, future `keccak512`) PLUS
  user-supplied libraries, provided two ways: (a) a precompiled blob + declared ABI, and (b) a `.scash`
  library source the compiler compiles into a blob. Both resolve to the same registry entry.
- **Generic-first (2b):** build the registry + descriptor generically (keyed by name), with keccak256
  as the first instance - not a keccak-hardcoded path generalized later.
- **Per-library inline:** auto-inline when a library is used once and it fits; `inlineLibraries`
  (Record<name, boolean>) overrides per library.
- **Integrity by blob hash:** the loader verifies the blob by `OP_HASH256 == blobHash` (branding-agnostic),
  so one side-car serves every loader in a tx.
- **Branded vs shared side-car:** branded (address salted with the contract token category) for stateful,
  shared for stateless. Deployed once with the contract; co-spent as the last input + recreated as the
  last output (self-pres). Threaded through stateful auto-derivation.

## Artifact descriptor

```ts
interface ExternalLibraryAbi {
  name: string;          // builtin resolves its library by this name (keccak256, keccak512, user 'lib')
  inline: boolean;       // embedded in the contract redeem vs loaded from a side-car
  branded: boolean;      // side-car address salted with the contract category vs shared
  blobHash: string;      // hash256(blob); the integrity check baked into the bytecode
  codeBegin: number;     // byte offset where the blob begins in the side-car input bytecode
  codeEnd: number;       // ... and ends (generalizes today's hardcoded strip offsets)
  abi: { inputs: AbiInput[]; outputs: AbiOutput[] };  // call signature, e.g. (bytes) -> bytes32
}
```
Contract-level `externalLibraries: ExternalLibraryAbi[]`; per-function `externalLibraries: string[]`
(names used, drives the budget pad). Compiler option `inlineLibraries?: Record<string, boolean>`.

## Registry (utils)

```ts
interface ExternalLibrary {            // a registry entry
  name: string;
  blob: Uint8Array;                    // the script
  abi: { inputs: AbiInput[]; outputs: AbiOutput[] };
  // side-car layout (offsets the loader strips), derived from how the side-car redeem wraps the blob
}
const BUILTIN_LIBRARIES = { keccak256: {...}, /* keccak512: {...} */ };
// user libraries merged in via the compiler option (blob+abi) or compiled from .scash
```

## Resolution + codegen

1. Symbol table registers every library (built-in + user) as a callable global function: `lib`'s ABI
   gives the parameter/return types so `lib(args)` type-checks.
2. Codegen for `lib(args)`: **inline** (used once + fits + option allows) emits `<blob> <id> OP_DEFINE`
   in the function prologue; **side-car** emits the loader (read last input -> strip `codeBegin/End` ->
   `OP_HASH256 == blobHash` -> `OP_DEFINE`). Each call site: `<args> <id> OP_INVOKE`.
3. The blob's internal sub-functions use ids below the 0x1000 subroutine registry; library ids start at
   0x1009 (keccak256), incrementing per library.

## SDK

Generic, parameterized by the descriptor (not keccak-hardcoded):
- pad: per-function `externalLibraries` -> add the op-budget pad + redeem `OP_DROP`.
- co-spend: contract-level `externalLibraries` with `inline === false` -> co-spend the side-car (last
  input) + recreate (last output), branded by category or shared; one side-car per tx.
- deploy: create the side-car once with the contract (only if referenced & not inlined).

## Phased plan (generic-first)

1. **Types + registry (utils):** `ExternalLibrary`, rich `ExternalLibraryAbi` (offsets + abi), the
   `inlineLibraries` option, `BUILTIN_LIBRARIES = { keccak256 }`, a side-car-redeem builder parameterized
   by blob (replacing the keccak-specific one).
2. **Symbol-table registration:** register built-in + user libraries as callable global functions
   (name -> ABI). Compiler option for user libraries (blob+abi).
3. **Codegen generalization:** generic `lib()` loader/inline by library; migrate keccak256's special
   case onto it. Emit the full descriptor (offsets, abi, inline).
4. **SDK generalization:** generic side-car build/deploy/co-spend + pad keyed by the descriptor; migrate
   keccak256.
5. **Inline path:** generic inline (per-library option) + the artifact `inline` flag + the co-spend skip.
6. **.scash libraries:** compile a `.scash` library source (a function -> blob + ABI) into a registry entry.
7. **Tests:** migrate keccak256 tests (force side-car where coverage is needed; add inline tests); add a
   user-library (blob+abi) example and a `.scash` library example. Re-run mock + regtest.

## Current state (2026-06)

Phases 1-5 + 7 (partial) DONE and committed on `solidcash_v0.13.1`; **stopped at bytecode-only** (phase
6, `.scash` source, deferred - see below).

- **1-3b** (compiler): generic registry (`BUILTIN_LIBRARIES { keccak256 }`), name-resolved symbols,
  codegen (side-car loader + invoke), rich descriptor. Commits 55480b81, 75990749, 75800d1d, c7daa6c5.
- **2b** (commit 556b88f1): USER libraries via the `userLibraries` option (precompiled hex `code` + ABI);
  per-compilation symbol registry (never the static global); ids from 0x100A; collision throws; artifact
  embeds the user blob as `code`. `resolveLibraries(userLibraries)`.
- **4** (commit 0cffd152): SDK side-car co-spend driven by the artifact descriptor (any library), not
  keccak constants. `resolveLibraryBlob(descriptor)`, `SHARED_LIBRARY_SALT`. keccak addresses byte-identical.
- **5** (commit 39fc7009): inline path. Auto-inline when used once and blob <= `INLINE_MAX_BLOB_LENGTH`
  (256); `inlineLibraries[name]` force on/off; `disableAutoInline`. keccak (2326 B) stays a side-car;
  small libs inline. SDK skips co-spend for inlined libraries.
- **7 (partial):** a user library (`inc` = OP_1ADD) compiles and runs end-to-end on mock, both inlined
  (no side-car) and via a forced side-car, under the budget-enforcing VM.

**What ships / is "live": bytecode (blob) libraries only** - keccak256 as the built-in, plus user
libraries supplied as a precompiled blob + ABI. The `.scash`-source compilation path is NOT built.

Tested: compiler 1120, keccak SDK 8, utils 4, user-lib compiler 10, user-lib SDK 5, stateful 39; all
three packages lint-clean. keccak's regtest validation (mock + real BCHN) stands from the earlier
keccak-specific work. See keccak-poc/ and the keccak256_builtin memory.

## Phase 6 (.scash source) - DEFERRED: design discussion

Goal: let users supply a library as `.scash` SOURCE the compiler compiles, instead of a precompiled blob.
Discussion 2026-06 reshaped this significantly; capturing it to resume later.

### Key insight: compile a CONTRACT, not a single function

A single free-function is insufficient - a real library calls helpers, uses structs/enums/constants, and
shares internal logic. Compiling an entire **contract** as the library gets all of that for free (the
contract compiler already handles internal calls, helpers, subroutine extraction). The library's WHOLE
ABI (every function) becomes callable, vs. today's one-function-per-library (keccak256).

This is a generalization of the shipped system from single- to multi-function:
- **Today:** one library = one blob = one ABI function = one OP_INVOKE id.
- **Contract-as-library:** one blob = an internal SELECTOR DISPATCHER over N functions = N ABI entries.
  `Math.add(a, b)` emits `push a, push b, push selector(add), <libId> OP_INVOKE`, result left on the stack.
  Internal `add -> mulmod` calls inside the library compile as in a normal contract.

The side-car/inline co-spend, budget pad, and artifact descriptor all carry over unchanged; only
"which function within the blob" (the selector) is new. The existing subroutine-dispatch machinery
(OP_DEFINE/OP_INVOKE, 4-byte selector validation; see subroutine_dispatch_rework memory) is the basis
for the dispatcher.

### What a "library contract" is (proposed restrictions)

Stateless; no constructor covenant; functions `return` values instead of ending in `require()` (the
final-require rule is replaced by a return-to-stack). Allowed: internal helpers, structs, enums,
constants, loops, pure arithmetic. Introspection (`tx.*`) technically still works (OP_INVOKE shares the
VM) but should be forbidden in a "pure computation library" to start; relax later if wanted.

### Open API decisions (NOT decided - the reason we stopped)

1. **Reference model** - how a consuming contract pulls the library in:
   - (a) **In-language import** (ergonomic, Solidity-like): `import { Math } from "./math.scash";` then
     `Math.add(a,b)`. Compiler compiles the library during the same build, embeds blob + full ABI.
   - (b) **Build-step artifact**: `compileLibrary(src)` -> artifact, passed via `userLibraries`,
     referenced by name. Decoupled; can ship a precompiled library without source.
   - (c) Both (build-step first, layer import on top).
2. **Declaration** - `library` is already taken (Solidity `using for` helpers, compiled INTO the
   contract). Options: a new keyword (e.g. `precompile Math { ... }`, unambiguous, lets semantic
   analysis enforce pure/stateless), or reuse `contract` compiled in a "library mode" (no new keyword,
   but blurs spendable-covenant vs pure-library, needs guards).

### Other threads raised (unresolved)

- Calling/dispatch mechanics: selector on stack -> branch -> body -> result; reuse subroutine-dispatch.
- `using for` vs an external-library blob: both could be called "libraries"; they differ (compile-time
  inlining into the contract vs a runtime OP_DEFINE blob co-spent/inlined as a precompile).
- Whether to base this on the existing EXTERNAL-CALL mechanism (`IFoo(category).func()`, co-spending a
  stateful contract + reading state) instead of a new precompile path. External calls co-spend a stateful
  UTXO and read state; a library is pure computation co-spent as a blob - different enough that a separate
  path likely stays cleaner, but worth weighing.
- Multi-function descriptor shape: `ExternalLibraryAbi.abi` becomes multiple functions, each with a
  selector; codegen dispatch + SDK carry over otherwise. (User had artifact.ts open - the descriptor
  shape is the natural place this lands.)

### When resuming

Decide (1) reference model and (2) declaration keyword first (they shape the public API/grammar), then:
extend the descriptor to multi-function, add the library compilation mode (dispatcher reads selector from
stack, functions return to stack, pure/stateless enforcement), generalize codegen call sites to
`<args> <selector> OP_INVOKE`, and the SDK is mostly unchanged (blob co-spend/inline already generic).
