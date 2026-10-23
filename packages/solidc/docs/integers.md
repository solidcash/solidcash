# Integers in SolidCash

SolidCash has two families of integers: **bounded** (`int`/`uint`, `intN`/`uintN`) and **unbounded**
(`bigint`). Bounded integers give Solidity parity (fixed width, overflow-checked); `bigint` is the Bitcoin
Cash VM's native arbitrary-precision number. This document explains both, how they map onto the BCH VM, how
they convert, how overflow is handled, and how to choose between them.

## TL;DR

| Keyword            | Type                  | Bounded? | Overflow-checked? | On-chain encoding            |
| ------------------ | --------------------- | -------- | ----------------- | ---------------------------- |
| `int` / `uint`     | `int256` / `uint256`  | yes      | yes               | fixed 33 bytes               |
| `intN` / `uintN`   | N in 8..256 (step 8)  | yes      | yes               | fixed `N/8 + 1` bytes        |
| `bigint`           | arbitrary-precision   | no       | no                | variable (minimal pushdata)  |
| literal (`5`, `0xff`) | generic integer    | -        | -                 | (becomes whichever it's used as) |

- Use `int`/`uint` (= `int256`/`uint256`) by default: Solidity parity, overflow safety, and O(1) array indexing.
- Use `bigint` for the cheapest representation, when you do not want overflow checks, or for values that may
  exceed 256 bits (rare).

## The two families

### Bounded integers: `intN` / `uintN`

`int8 .. int256` and `uint8 .. uint256`, in steps of 8 bits. `int` and `uint` are aliases for `int256` and
`uint256` (Solidity parity). Their ranges are exactly the EVM ranges:

| Type      | Min            | Max              | Storage width |
| --------- | -------------- | ---------------- | ------------- |
| `int8`    | -2^7  (-128)   | 2^7 - 1 (127)    | 2 bytes       |
| `uint8`   | 0              | 2^8 - 1 (255)    | 2 bytes       |
| `int16`   | -2^15          | 2^15 - 1         | 3 bytes       |
| `int32`   | -2^31          | 2^31 - 1         | 5 bytes       |
| `int64`   | -2^63          | 2^63 - 1         | 9 bytes       |
| `int128`  | -2^127         | 2^127 - 1        | 17 bytes      |
| `int256`  | -2^255         | 2^255 - 1        | 33 bytes      |
| `uint256` | 0              | 2^256 - 1        | 33 bytes      |

(For any width N: `intN` is `[-2^(N-1), 2^(N-1) - 1]`, `uintN` is `[0, 2^N - 1]`, storage is `N/8 + 1` bytes.)

Bounded integers are **overflow-checked**: a value that lands in a bounded slot outside its range fails the
script (see [Overflow and bounds checks](#overflow-bounds-checks-and-unchecked)). They are **fixed-width** on
chain, which is what makes arrays of them O(1)-indexable.

### Unbounded integer: `bigint`

`bigint` is the BCH VM's native integer. Since the May 2025 BCH upgrade (CHIP-2024-07) removed the old 4-byte
number limit, VM numbers are bounded only by the 10,000-byte stack-element limit, i.e. roughly 80,000-bit
values. `bigint`:

- has no range check (it never "overflows" within that limit),
- is stored **variable-width** as minimal pushdata (small values take few bytes),
- is the most efficient choice for arithmetic-heavy or value-dependent code.

`bigint` is the type the former unbounded `int` used to be; the rename happened so `int` could mean `int256`.

## Why the BCH encoding differs from the EVM

The EVM stores every integer in a 256-bit word using **two's complement**: the sign is folded into the same
256 bits (e.g. `-1` is `0xFFFF...FF`), so `int256` and `uint256` are both exactly 32 bytes.

The BCH VM uses **sign-magnitude** numbers (`CScriptNum`): little-endian bytes where the top bit of the most
significant byte is a dedicated sign flag and the rest is magnitude. A full N-bit magnitude therefore needs
N + 1 bits (the extra sign bit), which rounds up to one extra byte:

```
byteWidth(intN) = byteWidth(uintN) = ceil((N + 1) / 8) = N/8 + 1
```

So `int256`/`uint256` are **33 bytes on chain, not 32**. The ranges remain EVM-exact; only the physical width
differs. A 32-byte sign-magnitude scheme was considered and rejected: it would drop `int256`'s `-2^255` and,
worse, make any `uint256` with bit 255 set (bitmasks like `1 << 255`, hash-to-uint) read back as negative.
True 32-byte EVM byte-compatibility would require two's-complement-on-load/store conversion opcodes everywhere,
which is only worth it for byte-identical cross-chain hashing.

## Type-system internals

For contributors working in `packages/utils/src/types.ts`:

- `PrimitiveType.INT` (string `'int'`) is the **integer-literal / generic-integer** type. Every integer
  literal (`IntLiteralNode`) has this type. It implicitly converts to any `IntType` and to `bigint`.
- `PrimitiveType.BIGINT` (string `'bigint'`) is the **explicit unbounded** type (keyword `bigint`).
- `int`, `uint`, `intN`, `uintN` parse to `IntType(signed, bits)`.
- Fixed-point `fixedNxM` / `ufixedNxM` parse to `FixedType` and share the same sign-magnitude width rule.

`PrimitiveType.INT` is normalized to `PrimitiveType.BIGINT` at the entry of the type-relation helpers
(`typesEqual`, `implicitlyCastable`, `explicitlyCastable`) and in `compileCast`, so the integer-literal type
and the unbounded type behave identically in the type system. `IntType` values are distinct (they carry
`signed`/`bits`).

```
parseType('int')     -> IntType(true, 256)
parseType('uint')    -> IntType(false, 256)
parseType('uint128') -> IntType(false, 128)
parseType('bigint')  -> PrimitiveType.BIGINT
literal 5            -> PrimitiveType.INT   (IntLiteralNode.type)
```

## Conversions and casting

### Implicit conversions (no cast needed)

- **literal -> anything integer**: `int8 a = 5; uint256 b = 5; bigint c = 5;` all work.
- **`intN` -> `bigint`**: widening to unbounded is always allowed.
- **`bigint` -> `intN`**: allowed. The BCH VM has a single integer type, so bounded widths are nominal; values
  and literals assign freely to them. The range is still enforced at runtime by a bounds check on the write
  (see below), so this is safe, not a silent truncation.
- **`intN` -> `intM`**: widening within the same signedness (`M >= N`), or unsigned to a strictly wider signed
  type (`M > N`).

Not implicit (require an explicit cast): integer <-> `bytes`, integer <-> `bool`.

### Explicit casts

`int256(x)`, `uint128(x)`, `bigint(x)`, `int(x)`, `uint(x)`, plus cross-type casts:

- **integer <-> `bytesN`**: `bytesN(i)` is `OP_NUM2BIN` to N bytes; `int(b)` / `bigint(b)` is `OP_BIN2NUM`.
- **integer <-> `bool`**: `bool(i)` is `i != 0` (`OP_0NOTEQUAL`); `int(flag)` is a no-op (0/1 already valid).
- **integer <-> `enum`**: enums are integer-backed; the cast is a no-op.
- **integer <-> `fixedNxM`**: multiply/divide by the scale factor (`10^M`).

A cast to a bounded type is bounds-checked exactly like an assignment to one.

## Overflow, bounds checks, and `unchecked`

A bounded integer's range is enforced whenever a value **lands in a bounded slot**:

- an explicit cast to a bounded type (`int128(x)`),
- an assignment to a bounded variable, state variable, parameter, or return,
- a write of an element into a fixed-width integer array (`push`, indexed assign).

The emitted check is, for value `v` of type `intN`/`uintN`:

```
v >= type.min   (OP_GREATERTHANOREQUAL, OP_VERIFY)
v <= type.max   (OP_LESSTHANOREQUAL,    OP_VERIFY)
```

If either fails, the script fails (a failed `require`-style verification) rather than silently wrapping.

The exception is an inline-assembly `x := w` into an integer variable: like the EVM's cleanup of a dirty word, it
keeps the low N bits of `w` (sign-extended for `intN`) instead of checking, and a signed source is read as its
two's-complement word.

**A bounded arithmetic result is checked where it is computed**, as Solidity checks each operation. An integer
literal beside a bounded operand takes that operand's type, as Solidity converts it, so `x - 1` on a `uint256` is
checked exactly like `x - y` and reverts below zero. `bigint` arithmetic is not checked: the VM has one big-number
type, so its intermediates do not overflow at 256 bits (only at the ~10,000-byte stack-element limit). Two lowerings
that rebuild a sum still leave a literal step unchecked: a tail-recursive `return f(n - 1) + 1`, and a counter loop
the message-bus kernel folds.

**`unchecked { ... }`** replaces the range check with wraparound into the type's range (modulo 2^N), matching
Solidity's `unchecked`:

```
unsigned:  ((v % 2^N) + 2^N) % 2^N            -> wraps into [0, 2^N - 1]
signed:    shift by min, wrap mod 2^N, shift back  -> wraps into [-2^(N-1), 2^(N-1) - 1]
```

`bigint` is never bounds-checked or wrapped (it has no fixed range).

## Storage encoding (state variables)

- A **bounded** integer state variable is stored fixed-width via `OP_NUM2BIN(byteWidth)` (e.g. 33 bytes for
  `int256`, 9 bytes for `uint64`). Writes are range-validated by the SDK and the on-chain covenant.
- A **`bigint`** state variable is stored as variable-width minimal pushdata. The SDK's state-layout
  accounting budgets up to 258 bytes for it (`OP_PUSHDATA1` + length + up to 256 data bytes, i.e. up to
  ~2^2048), so it comfortably covers any realistic value while the actual stored bytes stay minimal.

This is why changing a state variable between `int`/`int256` and `bigint` changes its on-chain commitment
bytes: one is fixed 33-byte, the other is variable.

## Arrays of integers

The element type's width decides the array backend (see also `arrays.md`):

- **`intN[]` / `int[]`** (fixed-width element): **chunk-packed flat-stream** layout. Element `i` lives at byte
  offset `i * width`, so indexed access is O(1) (`index * width`, `OP_SPLIT`). Each element occupies the full
  `N/8 + 1` bytes.
- **`bigint[]`** (variable-width element): **single-blob framed** layout
  (`pushdata(count) ++ pushdata(elem_0) ++ ...`). Indexed access is O(n) (a scan loop skips earlier elements).

Integer-literal array elements are coerced to the **declared** array element type, so `int[] a = [1, 2, 3]`
packs at `int256` fixed width and stays consistent with its fixed-width indexed reads. (Before this coercion
existed, such a literal was built variable-width but read fixed-width, causing an `OP_SPLIT` failure at
runtime.)

Trade-off: `int256[]` is O(1) to index but spends 33 bytes per element; `bigint[]` is compact (small values
are 1-2 bytes each) but O(n) to index.

## Choosing between them

| You want...                                      | Use            |
| ------------------------------------------------ | -------------- |
| Solidity / EVM parity, overflow safety           | `int` / `uint` |
| A specific narrow width (e.g. a `uint8` counter) | `intN`/`uintN` |
| O(1) indexed arrays of integers                  | `intN[]`       |
| Smallest on-chain footprint for small values     | `bigint`       |
| No overflow checks (you manage ranges yourself)  | `bigint`       |
| Values that may exceed 256 bits                  | `bigint`       |
| Compact arrays where O(n) access is fine         | `bigint[]`     |

When in doubt, prefer `int`/`uint`: it is the safe, portable default. Reach for `bigint` deliberately, for
size or to opt out of overflow checks.

## Gotchas

- `int256`/`uint256` are **33 bytes** on chain, not 32 (sign-magnitude needs a sign bit). Plan state layouts
  and ABI encoders accordingly.
- `bigint` and `int`/`int256` have **different on-chain encodings**; switching a field between them changes the
  commitment bytes and any hand-built encoders/expectations.
- A `bigint` assigned into a bounded slot **is** range-checked at that point; it is not a silent truncation.
- In debug output, bounded integers and `bigint` both print as decimals (the formatter recognizes
  `int`/`bigint`/`intN`/`uintN`); other byte-typed values print as `0x...` hex.

## See also

- `arrays.md` - array backends (chunk-packed vs framed vs collection) in detail.
- `archive/docs:packages/solidc/docs/solidity-gap-analysis.md` and `solidity-import-compat.md` - Solidity parity and porting.
- Fixed-point numbers (`fixedNxM`/`ufixedNxM`) share the sign-magnitude width rule and the same bounds-check /
  `unchecked` machinery; they are scaled integers (value * 10^decimals).
