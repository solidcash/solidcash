---
title: Imports & Interfaces
---

SolidCash source files can declare importable types, constants and free functions at file level, and can
describe other contracts with `interface` declarations. This page covers both.

## File-level declarations

Outside any contract, a `.scash` file may declare:

- `struct`, `enum`, `type` (user-defined value types)
- `event`, `error`
- `constant` values
- free functions
- `interface`, `library` and `contract` definitions
- `using ... for` directives

```solidity
pragma solidcash ^0.13.0;

struct Point { int x; int y; }

enum Kind { A, B }

int constant SCALE = 100;

function double(int v) returns (int) {
    return v * 2;
}

contract Consumer() {
    function run(int v) {
        Point memory p = Point(v, double(v));
        require(p.y == v * 2 && SCALE == 100);
    }
}
```

Everything declared at file level is importable by other files.

## Import forms

### Wildcard import

Brings every file-level declaration into scope:

```solidity
pragma solidcash ^0.13.0;

import "./types.scash";

contract Consumer() {
    function run(int v) {
        require(double(v) == v * 2);
    }
}
```

### Selective import

Brings named declarations into scope:

```solidity
pragma solidcash ^0.13.0;

import { Point, SCALE, double } from "./types.scash";

contract Consumer() {
    function run(int v) {
        Point memory p = Point(v, double(v));
        require(p.y == v * 2 && SCALE == 100);
    }
}
```

### Namespace import

Binds the file to a namespace identifier, which qualifies **types** from that file:

```solidity
pragma solidcash ^0.13.0;

import "./types.scash" as T;

contract Consumer() {
    function run(int v) {
        T.Point memory p = T.Point(v, v);
        require(p.x == v);
    }
}
```

:::caution
Two import forms have known gaps in the current compiler:

- **Renaming with `as` in a selective import** (`import { double as x2 } from "...";`) parses, but the alias
  does not resolve. Import the original name instead.
- **Namespace-qualified values and functions** (`M.SCALE`, `M.double(v)`) do not resolve. A namespace import
  currently qualifies types only; use a wildcard or selective import for constants and free functions.
:::

### Importing Solidity sources

With the `solidityImportCompat` compiler option, `.sol` files are parsed as SolidCash and the import resolver
also tries `.sol` candidates, so a Solidity dependency tree can be imported directly. `pragma solidity ...` is
accepted and its version constraint is not enforced.

Non-relative (npm-style) import paths resolve against the package tree, so
`import "@openzeppelin/contracts/token/ERC20/IERC20.sol";` works the same way it does in a Solidity project.

## Interfaces

An `interface` describes another contract: its externally readable state and its callable functions. Unlike
Solidity, a SolidCash interface can declare **state variables and collections**, because reading another
contract's state is a covenant introspection operation rather than a call.

```solidity
pragma solidcash ^0.13.0;

interface IBase {
    function ping();
}

interface IToken is IBase {
    public uint256 totalSupply;
    public mapping(address => uint256) balances;

    function transfer(address to, uint256 amount) returns (bool);
}
```

:::caution
In an interface, the **visibility keyword comes first**: `public uint256 totalSupply;`, not
`uint256 public totalSupply;`. This is the reverse of the state-variable declaration order inside a contract,
where both orders are accepted.
:::

Interface state variables and collections must be `public` or `external`.

### Reading external state

Given an interface and the target contract's category id, you can read its state directly:

```solidity
pragma solidcash ^0.13.0;

interface IToken {
    public uint256 totalSupply;
    public mapping(address => uint256) balances;
}

contract Reader(bytes32 target) {
    uint256 seen;

    function readTotal() public {
        this.seen = IToken(target).totalSupply;
    }

    function readBalance(address who) public {
        this.seen = IToken(target).balances[who];
    }
}
```

The compiler emits a covenant that co-spends the target contract's state UTXOs and verifies their category, so
the read is trustless. The SDK resolves and attaches the required inputs automatically.

### Calling external functions

```solidity
pragma solidcash ^0.13.0;

interface ICounter {
    function increment();
}

contract Caller(bytes32 target) {
    int calls;

    function bump() public {
        ICounter(target).increment.call();
        this.calls += 1;
    }
}
```

- `.call()` - a stateful call; the target may modify its own state.
- `.staticcall()` - read-only; the target's state changes are not committed.

See [Advanced Features](/docs/language/advanced-features#external-contract-interaction) for output-state reads
and the low-level `.call` / `.delegatecall` forms.

### Interface introspection

```solidity
interface IToken {
    function transfer(address to, uint256 amount) returns (bool);
}

contract Probe() {
    function check() {
        bytes4 id = type(IToken).interfaceId;
        require(id.length == 4);
    }
}
```

:::note
`interfaceId` is `bytes4` and is derived with sha256, so it differs from an EVM contract's EIP-165 id.
:::

## Abstract contracts

An `abstract contract` may leave functions unimplemented and cannot be deployed on its own. It is the base for
inheritance:

```solidity
pragma solidcash ^0.13.0;

abstract contract Ownable(pubkey owner) {
    modifier onlyOwner(sig s) {
        require(checkSig(s, owner));
        _;
    }

    function label() public virtual returns (string) {
        return "base";
    }
}

contract Vault(pubkey owner) is Ownable(owner) {
    function label() public override returns (string) {
        return "vault";
    }

    function act(sig s) public onlyOwner(s) {
        require(label().length > 0);
    }
}
```

:::note
`virtual` is enforced: overriding a function the base did not mark `virtual` is a compile error. Abstract
functions are implicitly virtual.
:::

See [Inheritance](/docs/language/inheritance) for C3 linearization, `super`, and multiple inheritance.

## Declaration-only files

A file containing only declarations - a standalone `interface`, file-level types, or an inline-only `library` -
compiles to a minimal artifact with an ABI and empty bytecode, mirroring solc.

## See also

- [Inheritance](/docs/language/inheritance) - `is`, `virtual`, `override`, `super` and C3 linearization
- [Libraries & Using-For](/docs/language/libraries) - sharing implementations rather than declarations
- [Structs, Enums & Custom Types](/docs/language/structs-enums-types) - the importable type forms
