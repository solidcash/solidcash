# keccak256() language integration spec

How the side-car keccak becomes a first-class `keccak256(bytes) -> bytes32` builtin, across compiler,
artifact, and SDK. Built on the validated PoC (`genvar.mjs` variable-length keccak + `sidecar.mjs`
loader). Status: spec + foundational layers; codegen + SDK in progress.

## Decisions (locked)

- **Branded** side-car for stateful contracts: the side-car's P2SH address is salted with the
  contract's token category, so each contract co-spends its own keccak UTXO -> zero cross-contract
  contention (aligns with the contract's existing state-UTXO serialization). Stateless: shared.
- **Single-tx path**, input <= ~408 bytes (3 keccak blocks). Bounded by *compute*: per-input op budget
  `~32,800 + 800 * unlockingLength`, unlocking capped at 10,000 B (consensus) -> ~8M op -> 3 blocks.
  Covers ~all real keccak usage (storage keys, addresses, hashes, EIP-712, Merkle nodes). Larger input
  is a future streaming-sponge extension; optimizing the permutation also raises the cap (see README).
- **Deploy once, with the contract**, and only if the source references `keccak256`. Not lazy.
- **Integrity = blob-hash check** baked into the contract bytecode (`OP_HASH256 == <hardcoded hash>`).
  This makes the loader branding-agnostic: it trusts any side-car carrying the real blob; branding is
  purely the SDK's address-isolation concern.
- Artifact field name: **`externalLibraries`** (not "sideCars").

## Shared constants (single source of truth, in @solidcash/utils)

The compiler's loader offsets MUST match the SDK's side-car redeem byte-for-byte (same rule as the 5
existing covenant-script pairs). Define once in utils:

- `KECCAK256_LIBRARY_BLOB` (hex): the canonical variable-length keccak blob (`genvar.mjs` output).
- `KECCAK256_LIBRARY_BLOB_HASH` (hex): `hash256(blob)` - the integrity constant.
- `KECCAK256_LIBRARY_ID = 0x1009n`: function id keccak is OP_DEFINEd under (next after the 0x1000-0x1008
  subroutine registry; the blob's internal round uses id 2, which is free).
- Side-car redeem template: `<salt:32> OP_DROP | self-pres(5) | PUSHDATA2(blob) | OP_DROP OP_1`.
  - branded: `salt` = contract category (32 B). shared: `salt` = 32 zero bytes.
  - self-pres: `OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY`.

## Layer 1 - artifact (utils/artifact.ts)

```ts
interface ExternalLibraryAbi { name: string; blobHash: string; branded: boolean; }
interface Artifact      { ...; externalLibraries?: readonly ExternalLibraryAbi[]; }   // contract-level (deploy)
interface AbiFunction   { ...; externalLibraries?: readonly string[]; }               // per-fn (co-spend on use)
```

## Layer 2 - front-end (solidc/ast/Globals.ts)

`KECCAK256 = 'keccak256'` in `GlobalFunction`; `Symbol.function(KECCAK256, bytes32, [ANY])` in the
global table (same shape as `sha256`).

## Layer 3 - codegen (GenerateTargetTraversal.ts, visitFunctionCall special case)

Define-once (like the subroutine registry): first `keccak256(...)` emits the loader; each call site is
`visit(arg)` then `<KECCAK256_LIBRARY_ID> OP_INVOKE`. Loader (reads the side-car = last input; integrity
by blob hash, so an attacker can't substitute a forged keccak):

```
OP_TXINPUTCOUNT OP_1SUB OP_INPUTBYTECODE      // last input unlocking = PUSHDATA2(redeem)
<3>  OP_SPLIT OP_NIP                           // drop outer PUSHDATA2 prefix -> redeem
<34> OP_SPLIT OP_NIP                           // drop <salt:32> OP_DROP
<5>  OP_SPLIT OP_NIP                           // drop self-pres
<3>  OP_SPLIT OP_NIP                           // drop blob PUSHDATA2 prefix
<blobLen> OP_SPLIT OP_DROP                     // blob | (OP_DROP OP_1) suffix; drop suffix
OP_DUP OP_HASH256 <KECCAK256_LIBRARY_BLOB_HASH> OP_EQUALVERIFY   // integrity
<KECCAK256_LIBRARY_ID> OP_DEFINE
```

Records the library in the artifact (contract-level + the calling function). Budget: the caller's
unlocking carries the op-budget pad (SDK-added); no compiler change beyond the invoke.

## Layer 4 - SDK (solidcash)

On building a tx whose called function lists `keccak256`:
1. Derive the side-car address (branded: salt = contract category; shared: zero salt) from the utils
   redeem template + `KECCAK256_LIBRARY_BLOB`.
2. Ensure the side-car UTXO exists; if missing, create it **in the contract's deployment tx** (one-time).
3. Add the side-car as the **last input**; recreate it as an output at the same index (self-pres).
4. Add the op-budget pad to the main input's unlocking (sized to block count).

Verify (blob hash baked in bytecode) means a wrong/missing side-car fails the spend rather than
producing a wrong hash.

## Tests

- compiler: a contract using `keccak256` compiles; artifact has `externalLibraries`; bytecode has the
  loader + invoke; offsets match the utils redeem template.
- VM-level: compiler-generated main + utils-built side-car in a 2-input tx -> hash matches EVM (reuses
  the harness from `test-sidecar.mjs`).
- SDK e2e: deploy a keccak-using contract (side-car created with it) + spend -> matches EVM.
