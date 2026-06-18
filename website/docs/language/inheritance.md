---
title: Inheritance & Interfaces
---

SolidCash supports contract inheritance, interfaces, abstract contracts, libraries, and free functions. These features allow you to compose reusable building blocks, define standard APIs, and organize large codebases across multiple files.

## Imports

SolidCash provides three import styles:

```solidity
// Wildcard - imports all top-level definitions
import "./Base.scash";

// Namespace - access via prefix
import "./Base.scash" as Base;
// Usage: Base.MyStruct, Base.myFunc()

// Selective - import specific items
import { MyStruct, myFunc } from "./Lib.scash";
```

### NPM-Style Imports

```solidity
import "@solidcash/math/SafeMath.scash";
import { MAX_VALUE } from "my-library/constants.scash";
```

The compiler resolves NPM packages from `node_modules/` and auto-appends `.scash` if needed.

:::caution
Circular imports are detected at compile time and produce an error. Organize your files to avoid dependency cycles.
:::

### What Can Be Imported

- Constants
- Type aliases (UDVT)
- Enums and Structs
- Interfaces
- Free functions
- Library definitions

## Contract Inheritance

Contracts can inherit from one or more parent contracts using the `is` keyword.

```solidity
contract Ownable(pubkey owner) {
    modifier onlyOwner(sig s) {
        require(checkSig(s, owner));
        _;
    }
}

contract Token(pubkey owner, int supply) is Ownable(owner) {
    int totalSupply;

    constructor() {
        this.totalSupply = supply;
    }

    function mint(bytes20 to, int amount, sig s) onlyOwner(s) {
        this.totalSupply = this.totalSupply + amount;
    }
}
```

Inherited functions, modifiers, state variables, and types are all available in the child contract.

### Multiple Inheritance

```solidity
contract Pausable() {
    bool paused;
    modifier whenNotPaused() { require(!this.paused); _; }
}

contract ManagedToken(pubkey owner) is Ownable(owner), Pausable {
    function transfer(bytes20 to, int amount, sig s)
        onlyOwner(s) whenNotPaused()
    {
        // ...
    }
}
```

## Virtual & Override

Mark functions as `virtual` to allow overriding, and `override` to replace a parent implementation:

```solidity
contract Base() {
    function getValue() virtual returns (int) {
        return 1;
    }
}

contract Child() is Base {
    function getValue() override returns (int) {
        return 2;
    }
}
```

Both `virtual` and `override` can be combined to allow further overriding down the chain:

```solidity
contract GrandChild() is Child {
    function getValue() override returns (int) {
        return 3;
    }
}
```

## Diamond Inheritance

Inheritance is flattened at compile time by merging parents. When two parents define the same
function (a diamond), the child **must** provide an explicit `override` to resolve the ambiguity;
without it the compiler errors. Functions inherited from a single common ancestor are deduplicated
rather than treated as a conflict.

```solidity
contract A() {
    function foo() virtual { require(1 == 1); }
}
contract B() is A {
    function foo() virtual override { require(2 == 2); }
}
contract C() is A {
    function foo() virtual override { require(3 == 3); }
}
contract D() is B, C {
    function foo() override { require(4 == 4); }  // must resolve conflict
}
```

:::note
`super.f()` and `Base.f()` resolve along the **C3 linearization** (the same method resolution order
Python and Solidity use). For the diamond above the order is `[D, B, C, A]`, so `super.foo()` inside
`B` reaches `C` (the sibling branch) before the shared ancestor `A` - cooperative super. An
inheritance graph with no valid C3 ordering is a compile error. Use `super.f()` to call the next
implementation in this order, or `Base.f()` to call a specific ancestor's directly.
:::

## Abstract Contracts

Abstract contracts define partial implementations that must be completed by inheriting contracts:

```solidity
abstract contract Pausable() {
    bool paused;

    function pause() internal;     // no body = abstract function
    function unpause() internal;   // must be implemented by child
}

contract PausableToken(pubkey admin) is Pausable {
    function pause() internal {
        this.paused = true;
    }

    function unpause() internal {
        this.paused = false;
    }
}
```

- Abstract contracts cannot be compiled to artifacts directly.
- All abstract functions must be implemented in any non-abstract child.

## Interfaces

Interfaces define a contract's public API without implementation. They are used for external contract interaction and type checking.

```solidity
interface IERC20 {
    event Transfer(bytes20 indexed from, bytes20 to, int amount);

    int public totalSupply;
    mapping(bytes20 => int) public balances;

    function transfer(bytes20 to, int amount) external;
    function balanceOf(bytes20 account) external returns (int);
}
```

### Interface Features

- Function signatures (no body)
- State variable declarations (visibility markers only)
- Mapping declarations
- Event declarations
- Enum and struct definitions
- Inheritance: `interface IERC721 is IERC165 { }`

### Interface ID (EIP-165 Style)

```solidity
bytes4 id = type(IERC20).interfaceId;
// XOR of all 4-byte function selectors - EIP-165 style (bytes4, like Solidity).
// Note: SolidCash selectors are sha256-based, not keccak256, so the value differs from an EVM contract.
```

### External State Reads

Interfaces enable reading another contract's state:

```solidity
interface ICounter {
    int public counter;
}

contract Reader(bytes32 counterCategory) {
    function readCounter() returns (int) {
        return ICounter(counterCategory).counter;
    }
}
```

See [Advanced Features](/docs/language/advanced-features) for more on external calls.

## Libraries

Libraries are stateless collections of reusable functions:

```solidity
library MathLib {
    function square(int x) returns (int) {
        return x * x;
    }

    function clamp(int value, int lo, int hi) returns (int) {
        if (value < lo) return lo;
        if (value > hi) return hi;
        return value;
    }
}
```

Libraries cannot be compiled alone (they produce no artifact). Use them via imports or `using` directives:

```solidity
import { MathLib } from "./MathLib.scash";

using MathLib for int;

contract Calculator() {
    function compute(int x) {
        int sq = x.square();         // method syntax via using-for
        int clamped = MathLib.clamp(x, 0, 100);  // direct call
    }
}
```

## Free Functions

Functions defined at file level (outside any contract) are callable from any contract in scope:

```solidity
int constant MAX_AMOUNT = 10_000;

function validateAmount(int amount) {
    require(amount > 0, "Amount must be positive");
    require(amount <= MAX_AMOUNT, "Amount too large");
}

contract Vault() {
    function deposit(int amount) {
        validateAmount(amount);
        // ...
    }
}
```

Free functions:
- Cannot access contract state (`this.` is not available)
- Can be imported across files
- Useful for shared validation logic and utilities

## File-Level Constants

```solidity
int constant FEE_RATE = 100;
bytes32 constant ZERO_HASH = bytes32(0);
```

Constants defined at file level are importable and available to all contracts in the file.
