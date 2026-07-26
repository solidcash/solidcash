---
title: Structs, Enums & Custom Types
---

SolidCash provides composite data types for organizing complex data: structs, enums, user-defined value types, and fixed-point decimals.

## Structs

Structs group related fields into a single composite type.

```solidity
struct User {
    bytes20 addr;
    string name;
    int balance;
}
```

### Defining Structs

Structs can be defined at **file level** (importable across files) or inside a contract:

```solidity
// File-level struct (importable)
struct Pair { int x; int y; }

contract MyContract() {
    // Contract-level struct
    struct Config { bytes20 admin; int threshold; }
}
```

### Creating Struct Instances

```solidity
struct User { bytes20 addr; string name; int balance; }
struct Pair { int x; int y; }

contract Demo() {
    function build(bytes20 who) {
        User memory user = User(who, "Alice", 100);
        Pair memory p = Pair(10, 20);

        // Field access
        int balance = user.balance;
        string name = user.name;

        require(balance == 100 && name.length > 0 && p.x + p.y == 30);
    }
}
```

Structs can also be built with named arguments: `Pair({ x: 10, y: 20 })`.

### Structs in State

Structs are stored as concatenated fixed-width fields in NFT commitments:

```solidity
struct User { bytes20 addr; string name; int balance; }

contract Registry() {
    mapping(bytes20 => User) public users;

    function register(bytes20 key, string name, int balance) {
        this.users[key] = User(key, name, balance);
    }

    // Partial field update - only modifies `name`, keeps other fields
    function rename(bytes20 key, string newName) {
        this.users[key].name = newName;
    }
}
```

### Nested Structs

```solidity
struct Address { bytes20 hash; bool isToken; }
struct Account { Address addr; int balance; }
```

### Importing Structs

```solidity
import { User, Pair } from "./types.scash";
```

## Enums

Enums define a set of named constants.

```solidity
enum Status { PENDING, ACTIVE, COMPLETED }   // values: 0, 1, 2
```

### Custom Values

Unlike Solidity, SolidCash allows custom enum values:

```solidity
enum Priority { LOW = 1, MEDIUM = 5, HIGH = 10 }
```

### Using Enums

```solidity
enum Status { PENDING, ACTIVE, COMPLETED }
enum Priority { LOW = 1, MEDIUM = 5, HIGH = 10 }

contract Demo() {
    function use() {
        Status current = Status.ACTIVE;
        require(current == Status.ACTIVE);

        // Type introspection
        require(type(Status).min == 0);      // first value
        require(type(Status).max == 2);      // last value
        require(type(Priority).min == 1);
        require(type(Priority).max == 10);
    }
}
```

### Scope

Enums can be file-level or contract-level. File-level enums are importable:

```solidity
import { Status } from "./enums.scash";
```

## User-Defined Value Types (UDVT)

Type aliases create zero-cost semantic wrappers around existing types:

```solidity
type TokenId is bytes32;
type Amount is int;
```

UDVTs prevent accidental mixing of semantically different values - a `TokenId` cannot be assigned where an `Amount` is expected without explicit conversion.

### Wrapping & Unwrapping

```solidity
type TokenId is bytes32;

contract Demo() {
    function use(bytes32 raw) {
        TokenId id = TokenId.wrap(raw);
        bytes32 back = TokenId.unwrap(id);
        require(back == raw);
    }
}
```

## Using-For Directives

The `using` directive attaches library functions to types, enabling method-call syntax:

```solidity
library SafeMath {
    function add(int a, int b) internal returns (int) {
        int result = a + b;
        require(result >= a);
        return result;
    }
}

using SafeMath for int;

contract Calculator() {
    function run(int x, int y) {
        // Callable as a method; equivalent to SafeMath.add(x, y)
        require(x.add(y) >= x);
    }
}
```

### Operator Overloading

Map specific functions onto operators for a user-defined value type:

```solidity
type Amount is int;

library AmountLib {
    function add(Amount a, Amount b) internal returns (Amount) {
        return Amount.wrap(Amount.unwrap(a) + Amount.unwrap(b));
    }
}

using { AmountLib.add as + } for Amount global;

contract Ledger() {
    function total(int raw) {
        Amount a = Amount.wrap(raw);
        require(Amount.unwrap(a + Amount.wrap(1)) > 0);
    }
}
```

The overloadable operators are `+ - * / % **`, `== != < <= > >=`, and `& | ^ ~`.

### Global Scope

Appending `global` makes the attachment visible to every file that imports this one:

```solidity
library SafeMath {
    function add(int a, int b) internal returns (int) { return a + b; }
}

using SafeMath for int global;

contract Consumer() {
    function run(int x) { require(x.add(1) > x); }
}
```

See [Libraries & Using-For](/docs/language/libraries) for the full reference.

## Fixed-Point Decimal Types

SolidCash is the **first smart contract language** with a full fixed-point implementation. Solidity declared the type but never built it.

```solidity
fixed128x18 price = 1.5;         // stored as 1_500_000_000_000_000_000
ufixed128x18 rate = 0.05;        // stored as 50_000_000_000_000_000
```

### Format

`fixed<M>x<N>` where:
- **M** = total bits (8 to 256, in steps of 8)
- **N** = decimal places (0 to 80)

The shorthand `fixed` is equivalent to `fixed128x18`. Similarly `ufixed` is `ufixed128x18`.

### Arithmetic

All arithmetic operators work with automatic scale correction:

```solidity
fixed128x18 a = 1.5;
fixed128x18 b = 2.0;

fixed128x18 sum = a + b;       // 3.5
fixed128x18 diff = b - a;      // 0.5
fixed128x18 product = a * b;   // 3.0 (auto-scales intermediate result)
fixed128x18 quotient = b / a;  // 1.333...
```

:::note
There is no intermediate overflow risk. Bitcoin Cash supports arbitrary-precision integers (since May 2025 BigInt activation), so intermediate products up to ~80,000 bits are handled safely.
:::

### Type Introspection

```solidity
fixed128x18 minVal = type(fixed128x18).min;
fixed128x18 maxVal = type(fixed128x18).max;
```

## Bounded Integer Types

Signed and unsigned integers with explicit bit widths:

```solidity
int8 small = 127;          // range: -128 to 127
uint8 byte_val = 255;      // range: 0 to 255
int256 large = 0;           // 256-bit signed
uint256 huge = 0;           // 256-bit unsigned
```

Available in 8-bit increments: `int8`, `int16`, ..., `int256` and `uint8`, `uint16`, ..., `uint256`.

### Introspection

```solidity
contract Bounds() {
    function check() {
        require(type(int8).min == -128);
        require(type(int8).max == 127);
        require(type(uint8).max == 255);
    }
}
```

### Unchecked Arithmetic

By default, bounded integer arithmetic checks for overflow/underflow. Use `unchecked` blocks for wrapping behavior:

```solidity
unchecked {
    uint8 a = uint8(255) + uint8(1);   // wraps to 0
    uint8 b = uint8(0) - uint8(1);     // wraps to 255
}
```

## Type Introspection Summary

| Expression | Returns | Description |
|------------|---------|-------------|
| `type(int256).min` | `int` | Minimum value |
| `type(uint8).max` | `int` | Maximum value |
| `type(fixed128x18).min` | `fixed128x18` | Min fixed-point value |
| `type(Status).min` | `int` | First enum value |
| `type(Status).max` | `int` | Last enum value |
| `type(IToken).interfaceId` | `bytes4` | EIP-165-style interface ID (sha256-based, differs from EVM) |
| `type(MyContract).name` | `string` | Contract name as string |
| `type(MyContract).creationCode` | `bytes` | Child contract's compiled redeem script |
| `type(MyContract).runtimeCode` | `bytes` | Alias of `creationCode` (BCH has no creation/runtime split) |
