# Data locations

Where a variable's data physically lives, how each location modifier changes that, and - most importantly -
what happens when you write **no** modifier. This is the deep dive behind the "Data location and lifetime"
section of [modifiers.md](./modifiers.md).

## The model: two homes, not three

The EVM has three data locations and the type system forces you to pick one on every reference-type
declaration:

- `storage` - persistent contract state (slots).
- `memory` - mutable scratch RAM, wiped after the call.
- `calldata` - the read-only, immutable input of the call.

SolidCash compiles to a UTXO model where data has exactly **two** possible homes:

- **The stack.** The Bitcoin Cash VM is a stack machine. Every parameter, local, intermediate, and return
  value lives on the stack for the single execution of a spend, then is gone. There is no separate "memory"
  segment and no heap for transient values.
- **State UTXOs.** Persistent state lives in CashToken UTXOs that the contract's covenant pins and re-creates
  each spend - data NFTs for fixed-size fields, chunk UTXOs for variable-size data, entry NFTs for sparse
  keyed collections. This is the only "storage".

Because non-state data has exactly one home (the stack), **SolidCash never requires a data-location keyword**.
The Solidity friction of annotating `memory` / `calldata` / `storage` on every `bytes`, `string`, array, or
struct parameter simply does not exist. When you do write one, it still carries meaning: `calldata` is
enforced read-only, `storage` is a write-through alias, and `memory` names the mutable on-stack default.

## The default: no modifier

What a declaration means with no location modifier, by context:

| Context | EVM default | SolidCash default |
| --- | --- | --- |
| State variable | `storage` (mandatory, implicit) | Persistent state UTXO. Which backend depends on the type (table below). |
| Local, value type | stack | stack |
| Local, reference type | **none - you must write `memory` or `storage`** | stack (no keyword needed) |
| External function param, reference type | `calldata` (default) | stack, supplied by the unlock script |
| public/internal param, reference type | `memory` (must be written) | stack (no keyword needed) |
| Return value, reference type | must be `memory` | stack (no keyword needed) |

The unlock script (the spending input's signature script) is the closest analog to EVM calldata: it carries
the function selector and the argument values that get pushed onto the stack. But it is just the stack at
execution time; there is no distinct calldata region.

### State-variable default backend, by type

A no-modifier state variable is persistent, but *how* it is stored depends on the declared type. SolidCash
splits state into **registers** (fixed-size, a static count of data NFTs), **dynamic storage** (variable-size,
chunk UTXOs - the "heap"), and **collections** (sparse keyed, one entry NFT per key/element).

| Declared type | Default backend (no modifier) | Notes |
| --- | --- | --- |
| `int` / `uint` / `bool` / `address` / `bytesN` / `enum` / `fixedMxN` | Register: a field in the data NFT commitment | Fixed-width scalars are packed into the data NFT. |
| `string`, unbounded `bytes` | Dynamic storage: a `uint32` length header in the data NFT + chunk UTXOs | Grows/shrinks at runtime. See [dynamic-storage.md](./dynamic-storage.md). |
| `T[]` (unbounded, chunk-packable element) | Dynamic storage: chunk-packed (length header + chunk UTXOs) | Reuses the string/bytes machinery. |
| `T[N]` (bounded array) | Collection: one entry NFT per element (sparse) | Override with `packed` for a single dense blob field. |
| `T[][]` (nested array) | Collection | |
| `struct` | Chunk-packed (fixed-width inline, variable-width framed) | A single dense value, not sparse. |
| `mapping(K => V)` | Collection: one entry NFT per key (sparse) | |

See [arrays.md](./arrays.md) and [structs.md](./structs.md) for the layout details and trade-offs.

## The location modifiers

### `memory`

| EVM | SolidCash |
| --- | --- |
| Mutable scratch RAM for reference types; required on many params/locals/returns. | The mutable on-stack default - the same behavior as omitting it. Writing it is allowed (this is what distinguishes it from read-only `calldata`). It does not change codegen, and it does **not** provide Solidity's memory aliasing (see the divergence note below). |

### `calldata`

| EVM | SolidCash |
| --- | --- |
| The read-only, immutable, cheaper input region; the default for external-function reference params. | **Enforced read-only**: writing a `calldata` parameter or local is a compile error (`CalldataModificationError`), matching Solidity. Reading, passing, slicing, and returning it are fine; to modify, copy it into a plain (memory) variable first. The value still arrives via the unlock script and lives on-stack; "read-only" is the part that is enforced. |

### `storage`

| EVM | SolidCash |
| --- | --- |
| A reference into persistent state. State vars are `storage`; a local `T storage p = m[k];` is a pointer whose writes mutate the slot. | Repurposed as a compile-time **alias**, only meaningful on a local: `T storage p = container[k];` records the access path, drops the declaration, and rewrites every read/write of `p` to `container[k]`. Write-through like Solidity, but resolved at compile time, not a runtime pointer. State vars do not need it - they are state by default. |

```solidity
// `p` is an alias for this.balances[user]; the write lands in the mapping entry.
int storage p = this.balances[user];
p = p + amount;            // == this.balances[user] = this.balances[user] + amount;
```

### Divergence: no memory aliasing

SolidCash is value-semantic. Solidity's `memory` is reference-semantic: `bytes memory a = b;` makes `a` and
`b` the same buffer, so `a[0] = x` also changes `b`, and a `memory` argument passed to an internal function is
mutated in place. SolidCash has no heap or pointers - locals and arguments are independent stack values, so
assignment and argument passing **copy**, and mutations never propagate back. This is the one Solidity
`memory` behavior SolidCash does not reproduce; it is rarely relied upon (and a frequent footgun when it is).
The write-through `storage` alias above is the only aliasing mechanism, and it targets state, not locals.

## The lifetime modifiers

These do not pick a location so much as a lifetime; they apply to state variables (except `constant`, which
also forms a top-level definition).

### `transient` (EIP-1153)

| EVM | SolidCash |
| --- | --- |
| Transaction-scoped storage (`TSTORE`/`TLOAD`): survives across calls within one transaction, zeroed at transaction end. | No analog (no transaction-scoped storage; one spend = one execution, no re-entry). Lowered to a per-function local, zero-initialized at the start of every spend. Dropped from the state layout; a transient-only contract stays stateless. Warned. See [solidity-import-compat.md](./solidity-import-compat.md). |

### `immutable`

| EVM | SolidCash |
| --- | --- |
| Assigned once in the constructor, then baked into the deployed bytecode (no SLOAD). | Assigned once in the constructor, then read-only - but it **still lives in the data NFT**, not the bytecode. The covenant rejects any write outside `constructor`. For a true bytecode-embedded constant, use a constructor argument or `constant`. |

### `constant`

| EVM | SolidCash |
| --- | --- |
| Compile-time constant; inlined, no storage slot. | Top-level `T constant X = expr;` is inlined at every use site (no state field, zero cost). As a modifier on a parameter or local, it write-protects the binding (assigning it is a compile error). |

### `packed`

| EVM | SolidCash |
| --- | --- |
| Not a location keyword. Solidity auto-packs small state vars into 32-byte slots; `abi.encodePacked` is unrelated. | An explicit state-layout choice: store a bounded array / struct as a single dense blob field in the data NFT instead of the default sparse collection (one entry NFT per element). |

## Cheat sheet

- Writing a mutable `bytes` / `string` / array / struct parameter or local? Write **no location** (or
  `memory`) - it is a mutable on-stack value.
- Want a parameter the function must not modify? `calldata` - it is enforced read-only. Copy it into a plain
  variable to work with a mutable version.
- Want persistent state? Declare a **state variable**; it defaults to the right backend for its type. No
  keyword needed.
- Want a writable shorthand for a deep collection entry? `T storage p = this.m[k];`.
- Want write-once state? `immutable`. Want a compile-time constant with zero state cost? `constant`.
- Want a scratch value that resets each spend (e.g. a ported reentrancy guard)? `transient`.
- Want a bounded array stored as one blob instead of per-element UTXOs? `packed`.

## See also

- [modifiers.md](./modifiers.md) - the full modifier reference (visibility, mutability, covenant control)
- [dynamic-storage.md](./dynamic-storage.md) - the chunk-UTXO "heap" for `string` / `bytes` / dynamic arrays
- [arrays.md](./arrays.md), [structs.md](./structs.md) - state-layout models and `packed`
- [solidity-import-compat.md](./solidity-import-compat.md) - `transient` and other porting affordances
