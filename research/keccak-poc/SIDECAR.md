# Side-car keccak library

Repurposes the pure-script keccak256 into an **externally callable, on-chain function library**. The
keccak code lives once in a side-car UTXO; a main script loads it by introspection, `OP_DEFINE`s it,
and invokes it on arbitrary data. (Separate from the original exploration: `sidecar.mjs` +
`test-sidecar.mjs`; `vm.mjs`/`gen25.mjs` are reused read-only and unchanged.)

## Pattern

- **Side-car redeem** = `[ self-preservation | PUSHDATA(keccak blob) | OP_DROP | OP_1 ]`.
  - self-preservation: `OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY`
    (the output at the side-car's index recreates its locking script -> the library UTXO persists).
  - the keccak blob is embedded as a data push (then dropped) purely so it can be read back out of
    the input's bytecode.
- **Main script** (the caller), in another input of the same tx:
  `OP_INPUTBYTECODE(sidecar)` -> strip the outer PUSHDATA2 prefix -> strip self-pres -> strip the
  blob's push prefix -> strip the `OP_DROP OP_1` suffix -> `OP_DEFINE` the blob -> `OP_INVOKE` it on
  the data. All strip offsets are compile-time constants (`SPLIT`s).

Validated in a 2-input transaction (`test-sidecar.mjs`): the main loads + invokes keccak and its
output **matches EVM keccak256**; the side-car self-preserves; a wrong expected hash fails.

## Result

| | bytes |
|---|--:|
| **main loader** (in every caller) | **23** |
| side-car redeem (once, on-chain)  | 1,780 |
| embedded keccak blob              | 1,770 |

The caller carries a **23-byte** loader instead of embedding the ~1.8 KB keccak. The heavy code sits
once in the shared side-car UTXO; the caller supplies the operation-cost budget (the `pad` arg in its
own unlocking; ~2.2M op cost as before). Nested `OP_DEFINE` works, so the keccak blob - which itself
defines the round body internally - loads as a single function.

## Caveats

- Strip offsets (self-pres length, push prefixes, blob length) are hardcoded in the loader; they must
  be recomputed if the blob changes. A length-prefixed layout could make the loader blob-size-agnostic.
- The side-car must be present as an input of the spending tx (introspection reads it); callers must
  co-spend the library UTXO and recreate it (CashTokens covenant / "tx template" coordination).
- Single 32-byte block, as in the base PoC.

## Run

```
node keccak-poc/test-sidecar.mjs   # 2-input load+invoke vs EVM, + self-preservation
```
