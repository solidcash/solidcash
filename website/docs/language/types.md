---
title: Types & Operators
---

SolidCash is a statically typed language, so the type of each variable needs to be specified. The type system
follows Solidity closely: the same integer families, the same bounded byte types, the same structs, enums,
user-defined value types, arrays and mappings. Where Bitcoin Cash forces a difference, it is called out inline
and explained in depth in [Platform Differences](/docs/basics/platform-differences).

## Boolean

`bool`: the possible values are the constants `true` and `false`.

Operators:

- `!` (logical negation)
- `&&` (logical conjunction, "and")
- `||` (logical disjunction, "or")
- `==` (equality)
- `!=` (inequality)

`&&` and `||` **short-circuit**, exactly as in Solidity: in `f(x) || g(y)`, `g(y)` is only evaluated when
`f(x)` is false. The compiler lowers `a && b` to `a ? b : false` and `a || b` to `a ? true : b`.

:::note
There is no implicit conversion from non-boolean types. `if (1) { ... }` is not valid SolidCash; write
`if (bool(1)) { ... }`.
:::

## Integers

SolidCash has two integer families: **bounded** integers with Solidity-identical ranges and overflow checks,
and the **unbounded** BCH-native `bigint`.

| Keyword | Type | Bounded | Overflow-checked | On-chain width |
| --- | --- | --- | --- | --- |
| `int` / `uint` | aliases for `int256` / `uint256` | yes | yes | 33 bytes |
| `intN` / `uintN` | N in 8..256, steps of 8 | yes | yes | `N/8 + 1` bytes |
| `bigint` | arbitrary precision | no | no | variable (minimal pushdata) |

```solidity
uint256 supply = 1_000_000;
int8 small = -128;          // range -128 .. 127
uint64 timestamp = 0;
bigint huge = 2 ** 300;     // no range check, grows as needed
```

Ranges are exactly the EVM ranges: `intN` is `[-2^(N-1), 2^(N-1) - 1]` and `uintN` is `[0, 2^N - 1]`.

:::note
`int256` and `uint256` occupy **33 bytes** on chain, not 32. BCH Script numbers are sign-magnitude, so a full
256-bit magnitude needs one extra byte for the sign flag. Ranges are unaffected; only the physical width
differs. See [Platform Differences](/docs/basics/platform-differences#number-encoding).
:::

Operators:

- Comparisons: `<=`, `<`, `==`, `!=`, `>=`, `>` (all evaluate to `bool`)
- Arithmetic: `+`, `-`, unary `-`, `*`, `/`, `%` (modulo), `**` (exponentiation, right-associative)
- Bitwise: `&`, `|`, `^`, `~`
- Shifts: `<<`, `>>`
- Increment / decrement: `++`, `--` (prefix and postfix)
- Compound assignment: `+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `|=`, `^=`, `<<=`, `>>=`

### Overflow and `unchecked`

Bounded integers are range-checked whenever a value **lands in a bounded slot**: an explicit cast, an
assignment to a bounded variable/state variable/parameter/return, or a write into a fixed-width array. A
violation fails the script rather than silently wrapping.

Arithmetic *intermediates* are not checked per operation. The BCH VM has a single big-number type, so
intermediates do not overflow at 256 bits; the bound is checked when the result is stored. This matches
Solidity's observable behaviour for `a = b + c` while avoiding redundant per-operation checks.

`unchecked { }` replaces the range check with wraparound modulo 2^N, matching Solidity:

```solidity
unchecked {
    uint8 a = uint8(255) + uint8(1);      // wraps to 0
    uint8 b = uint8(0) - uint8(1);        // wraps to 255
    uint16 c = uint16(65535) + uint16(1); // wraps to 0
}
```

`bigint` is never bounds-checked or wrapped.

### Choosing between them

| You want | Use |
| --- | --- |
| Solidity parity and overflow safety | `int` / `uint` |
| A specific narrow width | `intN` / `uintN` |
| O(1) indexed integer arrays | `intN[]` |
| Smallest on-chain footprint for small values | `bigint` |
| Values that may exceed 256 bits | `bigint` |

When in doubt use `int`/`uint`. Reach for `bigint` deliberately, for size or to opt out of overflow checks.

### Number formatting

Underscores can separate digits of a numeric literal for readability, e.g. `1_000_000`. Scientific notation is
supported, e.g. `1e6` or `1E6`, and the two can be combined: `1_000e6`.

### Division by zero

The script fails when the right-hand side of a division or modulo operation is zero.

:::caution
Always consider whether `/` and `%` operations have division-by-zero edge cases and how that would impact
contract security.
:::

### Date parsing

Dates and times are always represented as integers. Use the built-in parser to get the UTC timestamp of a
date. It takes a date in the format `date("YYYY-MM-DDThh:mm:ss")` and converts it to an integer timestamp at
compile time.

```solidity
int timestamp = date("2021-02-17T01:30:00");
require(timestamp == 1613554200);
```

## Fixed-Point Decimals

`fixed` / `ufixed` and `fixedMxN` / `ufixedMxN` are scaled-integer decimals, where **M** is the total bit width
(8 to 256, steps of 8) and **N** is the number of decimal places. `fixed` is shorthand for `fixed128x18`, and
`ufixed` for `ufixed128x18`.

```solidity
fixed128x18 price = 1.5;   // stored as 1_500_000_000_000_000_000
ufixed128x18 rate = 0.05;  // stored as 50_000_000_000_000_000

fixed128x18 sum = price + fixed128x18(2.0);
```

Arithmetic, comparisons and decimal literals all work, with automatic scale correction on multiply and divide.
Fixed-point shares the same bounds-check and `unchecked` machinery as bounded integers.

:::caution
Solidity **declares** fixed-point types but has never implemented them: any real use is a compile error in
solc. SolidCash implements them fully, so this is a SolidCash extension and not a cross-compiler parity
feature. The compiler emits a one-time warning to that effect. Mixed fixed/integer arithmetic with an integer
literal (`1.5 * 2`) is an "unequal types" error: write `1.5 * 2.0` or cast explicitly.
:::

## String

`string`: UTF-8 encoded byte sequence.

Operators:

- `+` (concatenation)
- `==` (equality)
- `!=` (inequality)

Members:

- `length`: number of bytes in the string.
- `split(int)`: splits at the given index and returns a tuple of the two resulting strings.
- `slice(int,int)`: returns a substring from the start index up to (but excluding) the end index.
- `reverse()`: reverses the string.

`string.concat(...)` joins any number of strings:

```solidity
string greeting = string.concat("Hello", ", ", "World");
```

:::caution
The script fails if `split()` or `slice()` is called with an out-of-bounds index.
:::

## Bytes

`bytes`: byte sequence. Hexadecimal literals are prefixed with `0x`, or written as `hex"..."`. The type can be
bound to a length by writing e.g. `bytes4`, `bytes20`, `bytes32`. `byte` is an alias for `bytes1`.

Operators:

- `+` (concatenation)
- `==`, `!=`
- `&` (bitwise AND), `|` (bitwise OR), `^` (bitwise XOR), `~` (bitwise inversion)
- `<<`, `>>` (bitwise shifts)

Members:

- `length`: number of bytes in the sequence.
- `split(int)`: splits at the given index and returns a tuple of the two resulting sequences.
- `slice(int,int)`: returns the part from the start index up to (but excluding) the end index.
- `reverse()`: reverses the byte sequence.

`bytes.concat(...)` joins any number of byte values, and index-range slices are supported:

```solidity
bytes mintingCapability = 0x02;
bytes noCapability = 0x;

bytes2 middle = 0x12345678.slice(1, 3);  // 0x3456
bytes head = payload[0:4];               // index-range slice
bytes tail = payload[4:];                // open-ended slice
bytes joined = bytes.concat(head, tail);
```

:::caution
The script fails if `split()` or `slice()` is called with an out-of-bounds index.
:::

## Bytes types with semantic meaning

Some byte sequences hold specific meanings inside Bitcoin Cash contracts. These have their own types, separate
from the regular `bytes` type. All three support `==` and `!=` and implicitly cast to `bytes`.

- **`pubkey`**: a public key. Generally 33 bytes long.
- **`sig`**: a transaction signature. Generally 65 bytes long.
- **`datasig`**: a data signature. Generally 64 bytes long.

## Address

`address` is the Solidity-compatible identity type. `address payable` is accepted and behaves identically:
every BCH address can receive value, so payability is cosmetic.

```solidity
contract Vault(address owner) {
    function withdraw(address payable to, int amount) {
        require(msg.sender == owner);
        to.transfer(amount);
    }
}
```

:::caution
A SolidCash `address` is the **full locking bytecode** (the entire scriptPubKey), not a fixed 20-byte hash. A
P2PKH address is 25 bytes (`76a914<20 bytes>88ac`), a P2SH32 address is 35 bytes, and a covenant address is an
arbitrary script. This makes addresses variable-length and directly comparable against `lockingBytecode`
introspection fields.

`bytes20(addr)` and `uint160(addr)` are supported as **narrowing** casts for Solidity source compatibility:
they extract the embedded 20-byte hash at offset 3 of the P2PKH form. Both warn, because the conversion is
lossy and meaningless for a non-P2PKH address. Compare addresses as addresses wherever you can.
:::

Members: `.transfer(amount)`, `.send(amount)`, `.call(data)`, `.staticcall(data)`, `.delegatecall(data)`,
`.code`, `.codehash`. See [Contract Calls](/docs/language/advanced-features#external-contract-interaction).

## Enums

Enums define a set of named constants and are integer-backed.

```solidity
enum Status { PENDING, ACTIVE, COMPLETED }     // values 0, 1, 2
```

Unlike Solidity, SolidCash allows explicit member values:

```solidity
enum Priority { LOW = 1, MEDIUM = 5, HIGH = 10 }
```

Enums may be declared at file level (importable) or inside a contract. See
[Structs, Enums & Custom Types](/docs/language/structs-enums-types#enums).

## User-Defined Value Types

`type X is Y` creates a zero-cost distinct type over an existing one, with `wrap` / `unwrap` conversions:

```solidity
type TokenId is bytes32;
type Amount is int;

Amount a = Amount.wrap(100);
int raw = Amount.unwrap(a);
```

## Structs

Structs group related fields into a composite type, and can be declared at file level or inside a contract.

```solidity
struct Point { int x; int y; }

Point memory p = Point(1, 2);
Point memory q = Point({ x: 1, y: 2 });   // named initialisation
int sum = p.x + q.y;
```

Structs may be nested, stored in state, held in mappings and arrays, and updated field-by-field. See
[Structs, Enums & Custom Types](/docs/language/structs-enums-types#structs).

## Arrays

Arrays come in fixed-size (`T[N]`) and dynamic (`T[]`) forms, and may be multi-dimensional.

```solidity
int[3] fixedSize;                      // fixed-length
int[] memory scores = new int[](3);    // dynamic, allocated at runtime
scores[0] = 10;
int count = scores.length;

bytes buffer = new bytes(32);          // dynamic bytes
string label = new string(8);          // dynamic string
```

Array literals use bracket syntax, which is also how `checkMultiSig` takes its arguments:

```solidity
require(checkMultiSig([sig1, sig2], [pk1, pk2, pk3]));
```

State arrays additionally support `.push()`, `.pop()`, `.delete(i)` and indexed assignment. See
[Stateful Contracts](/docs/language/stateful-contracts#dynamic-arrays) for the state-array backends and the
`packed` layout modifier.

## Mappings

`mapping(K => V)` is a key-value store. Keys and values may be named for readability, and mappings may nest.

```solidity
mapping(address => uint256) balances;
mapping(address holder => uint256 balance) named;
mapping(address => mapping(address => uint256)) allowances;
```

As in Solidity, a mapping is **not iterable** by default. Declaring it `enumerable` opts into iteration:

```solidity
enumerable mapping(address => uint256) balances;
```

See [Stateful Contracts](/docs/language/stateful-contracts#mappings) for storage backends and iteration.

## Tuple

Multiple values can be returned and destructured. Tuples are also what `split` returns on a `string` or
`bytes` value, and their elements can be read with an index:

```solidity
string bitcoinCash = "Bitcoin Cash";
string cash = bitcoinCash.split(8)[1];
```

:::note
A variable cannot be used as the tuple index. Assign both sides instead, and use either element conditional on
the variable.
:::

Destructuring assigns both sides at once:

```solidity
string hello, string world = "Hello World".split(6);
require(hello + "World" == "Hello " + world);

(int x, bool y) = abi.decode(data, (int, bool));
```

## Function Types

Functions are first-class values. A function type names the parameter types, the visibility, and the returns:

```solidity
contract Calculator() {
    function _add(int a, int b) internal returns (int) { return a + b; }
    function _mul(int a, int b) internal returns (int) { return a * b; }

    function apply(int a, bool useAdd) {
        function(int, int) internal returns (int) op = useAdd ? _add : _mul;
        require(op(a, 2) > 0);
    }
}
```

See [Functions](/docs/language/functions#function-types) for the full reference.

## Type Casting

Casting can be implicit or explicit depending on the types involved. `pubkey`, `sig` and `datasig` implicitly
cast to `bytes`, so they can be used anywhere a `bytes` is expected. Integer literals implicitly convert to any
integer type.

```solidity
pubkey signerPk = pubkey(0x0000);
bytes editedPk = bytes(signerPk) + 0x1234;
bool b = bool(5);           // true
uint64 narrowed = uint64(someInt);
```

### Casting table

| Type | Implicitly castable to | Explicitly castable to |
| --- | --- | --- |
| integer literal | any integer type, `bigint`, `fixed`, enum | as below |
| `intN` / `uintN` | `bigint`, wider same-signed `intM`/`uintM` | any integer type, `bytesN`, `bool`, `fixed`, enum |
| `bigint` | `intN` / `uintN` (range-checked on write) | `bytesN`, `bool`, `fixed`, enum |
| `bool` | | integer types |
| `string` | | `bytes` |
| `bytes` | | `sig`, `datasig`, `pubkey`, integer types |
| `bytesN` | `bytes` | integer types, `address` |
| `pubkey` | `bytes` | `bytes` |
| `sig` | `bytes` | `bytes` |
| `datasig` | `bytes` | `bytes` |
| `address` | | `bytes`, `bytes20`, `uint160` (both narrowing, warned) |
| enum | | integer types |
| user-defined value type | | via `.wrap()` / `.unwrap()` only |

Integer-to-bytes casts use `OP_NUM2BIN`; bytes-to-integer casts use `OP_BIN2NUM`. An enum cast is a no-op
because enums are integer-backed. Integer-to-fixed multiplies or divides by the scale factor `10^N`.

:::note
Mixing signed and unsigned integers implicitly is rejected, exactly as in Solidity: write an explicit cast.
:::

### Semantic bytes casting

Casting unbounded `bytes` to a bounded `bytesN` is a purely semantic cast. The bytes are not zero-padded and
no length check is performed, which is why the cast carries the `unsafe_` prefix. This is useful for things
like `LockingBytecode` constructors that expect a specific length.

```solidity
bytes pkh = tx.inputs[0].nftCommitment;      // type bytes, content 20 bytes
bytes20 bytes20Pkh = unsafe_bytes20(pkh);    // type bytes20, content 20 bytes
bytes25 lockingBytecode = new LockingBytecodeP2PKH(bytes20Pkh);
```

### Other semantic casting

Casting `bytes` to an integer, or an integer to a `bool`, adds opcodes that perform the conversion. Advanced
users can perform these casts without the added opcodes using the `unsafe_` prefix.

```solidity
bytes bytesValue = 0x123456000000;  // not a valid minimally encoded integer

int(bytesValue);         // type int, content 0x123456
unsafe_int(bytesValue);  // type int, content 0x123456000000

int intValue = 25;

bool(intValue);          // type bool, content true / 0x01
unsafe_bool(intValue);   // type bool, content 25 / 0x19
```

## Type Introspection

`type(T).member` exposes compile-time information about a type or contract:

| Expression | Returns | Description |
| --- | --- | --- |
| `type(int8).min` / `.max` | integer | Range bounds of a bounded integer |
| `type(fixed128x18).min` / `.max` | fixed | Range bounds of a fixed-point type |
| `type(Status).min` / `.max` | integer | First and last enum value |
| `type(IToken).interfaceId` | `bytes4` | EIP-165-style interface id (sha256-based, differs from EVM) |
| `type(MyContract).name` | `string` | Contract name |
| `type(MyContract).creationCode` | `bytes` | Compiled redeem script of the contract |
| `type(MyContract).runtimeCode` | `bytes` | Alias of `creationCode` (BCH has no creation/runtime split) |

## Operators

All supported operators and their precedence, from tightest to loosest binding. This is **Solidity**
precedence, which differs from C: the bitwise operators `&`, `^` and `|` bind **tighter** than comparisons, so
`x & y == z` parses as `(x & y) == z`.

| Precedence | Description | Operator |
| --- | --- | --- |
| 1 | Parentheses | `(<expression>)` |
| 2 | Type cast | `<type>(<expression>)` |
| 3 | Object instantiation | `new <class>(<args...>)` |
| 4 | Function call | `<function>(<args...>)` |
| 5 | Index / tuple index / slice | `<value>[<index>]`, `<value>[<a>:<b>]` |
| 6 | Member access | `<object>.<member>` |
| 7 | Postfix increment / decrement | `++`, `--` |
| 8 | Prefix increment / decrement | `++`, `--` |
| 8 | Unary minus, logical NOT, bitwise inversion | `-`, `!`, `~` |
| 9 | Exponentiation (right-associative) | `**` |
| 10 | Multiplication, division, modulo | `*`, `/`, `%` |
| 11 | Addition and subtraction, concatenation | `+`, `-` |
| 12 | Shifts | `<<`, `>>` |
| 13 | Bitwise AND | `&` |
| 14 | Bitwise XOR | `^` |
| 15 | Bitwise OR | `\|` |
| 16 | Numeric comparison | `<`, `>`, `<=`, `>=` |
| 17 | Equality and inequality | `==`, `!=` |
| 18 | Logical AND (short-circuiting) | `&&` |
| 19 | Logical OR (short-circuiting) | `\|\|` |
| 20 | Ternary conditional (right-associative) | `<cond> ? <a> : <b>` |
| 21 | Assignment and compound assignment | `=`, `+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `\|=`, `^=`, `<<=`, `>>=` |
