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

## Current state (reference: keccak256)

Done + tested (mock + regtest) on the keccak-specific path: compiler builtin + loader + artifact;
SDK budget pad + side-car co-spend + deploy; branded stateful (threaded through auto-derivation);
stateless/branded/unbranded/cross-contract. The inline path was prototyped then reverted pending this
generic design. See keccak-poc/ and keccak256_builtin memory.
