---
title: Data Locations
---

Solidity forces you to annotate every reference-type declaration with `memory`, `calldata` or `storage`.
SolidCash accepts all three keywords, and they carry real meaning, but you almost never have to write one.
This page explains why, and what each keyword does when you do.

## The model: two homes, not three

The EVM has three data locations: `storage` (persistent slots), `memory` (scratch RAM wiped after the call),
and `calldata` (the read-only call input).

SolidCash compiles to a UTXO model where data has exactly **two** possible homes:

- **The stack.** The Bitcoin Cash VM is a stack machine. Every parameter, local, intermediate and return value
  lives on the stack for the single execution of a spend, then is gone. There is no separate memory segment
  and no heap for transient values.
- **State UTXOs.** Persistent state lives in CashToken UTXOs that the contract's covenant pins and re-creates
  each spend: data NFTs for fixed-size fields, chunk UTXOs for variable-size data, entry NFTs for sparse keyed
  collections. This is the only "storage".

Because non-state data has exactly one home, **SolidCash never requires a data-location keyword**. The
Solidity friction of annotating every `bytes`, `string`, array or struct parameter simply does not exist.

## The default: no modifier

What a declaration means with no location modifier:

| Context | EVM default | SolidCash default |
| --- | --- | --- |
| State variable | `storage` (mandatory, implicit) | Persistent state UTXO; the backend depends on the type |
| Local, value type | stack | stack |
| Local, reference type | **none, you must write one** | stack (no keyword needed) |
| External function param, reference type | `calldata` | stack, supplied by the unlock script |
| public/internal param, reference type | `memory` (must be written) | stack (no keyword needed) |
| Return value, reference type | must be `memory` | stack (no keyword needed) |

The unlock script (the spending input's signature script) is the closest analogue to EVM calldata: it carries
the function selector and the argument values that get pushed onto the stack. But it is just the stack at
execution time; there is no distinct calldata region.

## State-variable backends

A no-modifier state variable is persistent, but *how* it is stored depends on its declared type. SolidCash
splits state into **registers** (fixed-size fields in a data NFT), **dynamic storage** (variable-size chunk
UTXOs) and **collections** (sparse keyed, one entry NFT per key or element).

| Declared type | Default backend | Notes |
| --- | --- | --- |
| `int`, `uint`, `bool`, `address`, `bytesN`, `enum`, `fixedMxN` | Register: a field in the data NFT commitment | Fixed-width scalars are packed into the data NFT |
| `string`, unbounded `bytes` | Dynamic storage: a length header plus chunk UTXOs | Grows and shrinks at runtime |
| `T[]` (unbounded, chunk-packable element) | Dynamic storage: chunk-packed | Reuses the string/bytes machinery |
| `T[N]` (bounded array) | Collection: one entry NFT per element | Override with `packed` for a single dense field |
| `T[][]` (nested array) | Collection | |
| `struct` | Chunk-packed (fixed-width inline, variable-width framed) | A single dense value, not sparse |
| `mapping(K => V)` | Collection: one entry NFT per key | |

## The location modifiers

### `memory`

| EVM | SolidCash |
| --- | --- |
| Mutable scratch RAM for reference types; required on many params, locals and returns. | The mutable on-stack default: the same behaviour as omitting it. Writing it is allowed, and it is what distinguishes a mutable parameter from a read-only `calldata` one. |

```solidity
function process(string memory label) internal returns (bytes) {
    bytes memory buffer = new bytes(32);
    require(label.length > 0);
    return buffer;
}
```

`memory` reference values use the compiler's shared linear-memory model. Assigning one memory array, bytes
value, string or supported struct to another **aliases the same buffer**, and supported internal/private
helper calls pass those references through. If an alias group reaches an operation the pointer lowering cannot
represent, the compiler fails closed rather than silently reverting to value-copy behaviour.

### `calldata`

| EVM | SolidCash |
| --- | --- |
| The read-only, immutable, cheaper input region; the default for external reference parameters. | **Enforced read-only.** Writing a `calldata` parameter or local is a compile error, matching Solidity. Reading, passing, slicing and returning are all fine. |

```solidity
function inspect(bytes calldata input) external returns (bytes) {
    bytes memory editable = input;   // copy first, then modify
    return editable;
}
```

The value still arrives via the unlock script and lives on the stack; the read-only part is what is enforced.

### `storage`

| EVM | SolidCash |
| --- | --- |
| A reference into persistent state. A local `T storage p = m[k];` is a pointer whose writes mutate the slot. | A compile-time **alias**, only meaningful on a local. The declaration records the access path and is dropped, and every read or write of the alias is rewritten to the underlying path. Write-through like Solidity, but resolved at compile time rather than as a runtime pointer. |

```solidity
struct Account { uint256 balance; bool active; }

contract Ledger() {
    mapping(address => Account) accounts;

    function credit(address user, uint256 amount) public {
        // `a` is an alias for accounts[user]; the writes land in the mapping entry.
        Account storage a = accounts[user];
        a.balance += amount;
        a.active = true;
    }
}
```

Both the bare Solidity spelling (`accounts[user]`) and the explicit `this.accounts[user]` form work.

:::caution
Storage pointers are supported for **struct**, array and mapping references. A pointer to a *scalar* element
(`uint256 storage p = balances[k];`) is not supported: read and write the element directly instead.
:::

State variables never need `storage`: they are state by default.

#### `storage` parameters

An internal function may take `mapping(...) storage`, `T[] storage` or `StructType storage` parameters: a
compile-time reference to the caller's state, exactly as in Solidity. A storage reference has no on-stack
value, so such a function is **inlined at each call site** with the parameter aliased to the argument's state
path. This ports Solidity library and helper mutators unchanged:

```solidity
function set(mapping(address => uint256) storage m, address k, uint256 v) internal {
    m[k] = v;
}

function update(address k, uint256 v) public {
    set(this.balances, k, v);   // compiles to a direct this.balances[k] = v
}
```

## Lifetime modifiers

These pick a lifetime rather than a location. They apply to state variables, except `constant`, which also
forms a top-level definition.

### `constant`

| EVM | SolidCash |
| --- | --- |
| Compile-time constant; inlined, no storage slot. | Top-level `T constant X = expr;` is inlined at every use site: no state field, zero cost. As a modifier on a parameter or local it write-protects the binding, so assigning to it is a compile error. |

### `immutable`

| EVM | SolidCash |
| --- | --- |
| Assigned once in the constructor, then baked into the deployed bytecode. | Assigned once in the constructor, then read-only, but it **still lives in the data NFT** rather than the bytecode. The covenant rejects any write outside the constructor. |

For a truly bytecode-embedded constant, use a contract constructor argument or `constant`.

### `transient` (EIP-1153)

| EVM | SolidCash |
| --- | --- |
| Transaction-scoped storage (`TSTORE`/`TLOAD`), zeroed at transaction end. Headline use is a cheap re-entrancy guard. | No analogue: there is no transaction-scoped storage, and one spend is one execution with no re-entry. Lowered to a per-function local, zero-initialised at the start of every spend, and dropped from the state layout. Compiler-warned. |

### `packed`

| EVM | SolidCash |
| --- | --- |
| Not a location keyword. Solidity auto-packs small state variables into 32-byte slots. | An explicit state-layout choice: store a bounded array or struct as a single dense blob field in the data NFT, instead of the default sparse collection of one entry NFT per element. |

```solidity
int[] packed public scores;
```

`packed` requires a fixed byte width per element, so variable-width types like `string` and unbounded `bytes`
cannot be packed.

## Cheat sheet

- Mutable `bytes` / `string` / array / struct parameter or local? Write **no location** (or `memory`).
- Parameter the function must not modify? **`calldata`**, which is enforced read-only. Copy it to modify.
- Persistent state? Declare a **state variable**; it defaults to the right backend for its type.
- Writable shorthand for a deep collection entry? **`T storage p = this.m[k];`**
- Write-once state? **`immutable`**. Compile-time constant with zero state cost? **`constant`**.
- Scratch value that resets each spend (e.g. a ported re-entrancy guard)? **`transient`**.
- Bounded array stored as one blob rather than per-element UTXOs? **`packed`**.

## See also

- [Function Modifiers](/docs/language/modifiers) - visibility, mutability and covenant-control modifiers
- [Stateful Contracts](/docs/language/stateful-contracts) - the state UTXO model in depth
- [Platform Differences](/docs/basics/platform-differences) - why there is no storage slot space
