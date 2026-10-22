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
// Usage: Base.MyStruct, Base.myFunc(); constants need a wildcard or selective import

// Selective - import specific items
import { MyStruct, myFunc } from "./Lib.scash";
```

### NPM-Style Imports

```solidity
import "@solidcash/math/SafeMath.scash";
import { MAX_VALUE } from "my-library/constants.scash";
```

A relative path resolves against the importing file. Any other path is looked up in `node_modules/`, walking up
from the importing file, and then next to it. The compiler appends `.scash` when the path has no extension.

:::note
Imports must come first in a file, after any leading pragmas. Files may import each other: a circular import
compiles. A circular *inheritance* graph (`A is B` while `B is A`) is a compile error.
:::

### What Can Be Imported

- Constants
- User-defined value types
- Enums and structs
- Events and errors
- Interfaces
- Free functions
- Libraries and contracts
- `using ... for` directives

See [Imports & Interfaces](/docs/language/imports-interfaces#import-forms) for what each import form brings into
scope.

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

A base contract's parameters are supplied in the `is` list (`is Ownable(owner)`) or by the child's constructor
(`constructor() Ownable(owner) { ... }`). Natively, a base listed without arguments passes its parameters on
instead: they are prepended to the child's own parameters, and a child parameter with the same name is merged
with them.

### Multiple Inheritance

```solidity
contract Ownable(pubkey owner) {
    modifier onlyOwner(sig s) { require(checkSig(s, owner)); _; }
}

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

`virtual` is enforced: overriding a function the base did not mark `virtual` is a compile error.

Both keywords can be combined to allow further overriding down the chain. An intermediate contract must mark
its own implementation `virtual` as well as `override`:

```solidity
contract Base() {
    function getValue() virtual returns (int) { return 1; }
}

contract Child() is Base {
    function getValue() virtual override returns (int) { return 2; }
}

contract GrandChild() is Child {
    function getValue() override returns (int) { return 3; }
}
```

## Diamond Inheritance

Inheritance is flattened at compile time by merging parents. When two parents define the same
function (a diamond), the child **must** provide an explicit `override` to resolve the ambiguity;
without it the compiler errors. Functions inherited from a single common ancestor are deduplicated
rather than treated as a conflict. Natively a bare `override` is enough; under `evmCompat` the override
must list every base that provides the function, as in Solidity (`override(B, C)`). The listed form works in
both modes.

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
    function foo() override(B, C) { require(4 == 4); }  // must resolve conflict
}
```

:::note
`super.f()` and `Base.f()` resolve along the **C3 linearization** (the same method resolution order
Python and Solidity use). As in Solidity, bases are listed from the most base-like to the most derived, so the
rightmost base comes first. For the diamond above the order is `[D, C, B, A]`: `super.foo()` inside `D`
reaches `C`, `super.foo()` inside `C` reaches `B` (the sibling branch) before the shared ancestor `A`, and
`super.foo()` inside `B` reaches `A` - cooperative super. An inheritance graph with no valid C3 ordering is a
compile error. Use `super.f()` to call the next implementation in this order, or `Base.f()` to call a specific
ancestor's directly.
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
    function pause() internal override {
        this.paused = true;
    }

    function unpause() internal override {
        this.paused = false;
    }

    function act(sig s) public {
        require(checkSig(s, admin));
        pause();
    }
}
```

- An abstract contract cannot be deployed or created with `new`. Compiled on its own, it yields an ABI-only
  artifact with empty bytecode.
- All abstract functions must be implemented in any non-abstract child.
- An implementing child must mark the function `override`. Abstract functions are implicitly `virtual`;
  `evmCompat` requires writing `virtual` on them, as Solidity does.

## Interfaces

Interfaces define a contract's public API without implementation. They are used for external contract interaction and type checking.

```solidity
interface IERC20 {
    event Transfer(bytes20 indexed from, bytes20 to, int amount);

    public int totalSupply;
    public mapping(bytes20 => int) balances;

    function transfer(bytes20 to, int amount) external;
    function balanceOf(bytes20 account) external returns (int);
}
```

### Interface Features

- Function signatures (no body)
- State variable declarations, with the **visibility keyword first** (`public int counter;`); the visibility
  must be `public` or `external`
- Mapping and array declarations, with the same rule
- Event and error declarations
- Enum, struct and user-defined value type definitions
- `using ... for` directives and a bodyless `fallback`
- Inheritance: `interface IERC721 is IERC165 { }`

A contract that lists an interface in its `is` list must implement the interface's functions.

### Interface ID (EIP-165 Style)

```solidity
interface IERC20 {
    function transfer(bytes20 to, int amount) external;
}

contract Probe() {
    function check() {
        // XOR of all 4-byte function selectors - EIP-165 style (bytes4, like Solidity).
        bytes4 id = type(IERC20).interfaceId;
        require(id.length == 4);
    }
}
```

:::note
SolidCash selectors are sha256-based by default, so the value differs from an EVM contract's; under the
`evmCompat` compiler option they are real keccak256 over Solidity's canonical signature spelling.
:::

### External State Reads

Interfaces enable reading another contract's state:

```solidity
interface ICounter {
    public int counter;
}

contract Reader(address counter) {
    int lastSeen;

    function readCounter() public {
        this.lastSeen = ICounter(counter).counter;
    }
}
```

:::note
The reading contract must be **stateful** (it needs at least one state variable). The read is compiled as a
covenant that co-spends the target's state UTXOs, which requires a block layout to place them in.
:::

See [Imports & Interfaces](/docs/language/imports-interfaces) and
[Advanced Features](/docs/language/advanced-features#external-contract-interaction) for more on external
reads and calls.

## Libraries

Libraries are collections of reusable functions:

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

A library function without an explicit visibility is `internal`, and internal library functions are inlined
where they are called. Compiled on its own, a library like this yields an ABI-only artifact with empty
bytecode. Use libraries via imports or `using` directives:

```solidity
import { MathLib } from "./MathLib.scash";

using MathLib for int;

contract Calculator() {
    function compute(int x) {
        int sq = x.square();         // method syntax via using-for
        int clamped = MathLib.clamp(x, 0, 100);  // direct call
        require(sq >= clamped);
    }
}
```

See [Libraries & Using-For](/docs/language/libraries) for `using ... for`, operator binding and libraries
with `public` functions.

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
        require(true);
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
