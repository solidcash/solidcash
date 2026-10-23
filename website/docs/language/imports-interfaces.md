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
pragma solidcash ^0.14.0;

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

Everything declared at file level is importable by other files. Imports must come first in a file, after any
leading pragmas. Files may import each other; only a circular inheritance graph is an error.

## Import forms

### Wildcard import

Brings every file-level declaration into scope:

```solidity
pragma solidcash ^0.14.0;

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
pragma solidcash ^0.14.0;

import { Point, SCALE, double } from "./types.scash";

contract Consumer() {
    function run(int v) {
        Point memory p = Point(v, double(v));
        require(p.y == v * 2 && SCALE == 100);
    }
}
```

### Namespace import

Binds the file to a namespace identifier, which qualifies the **types** and **free functions** from that file:

```solidity
pragma solidcash ^0.14.0;

import "./types.scash" as T;

contract Consumer() {
    function run(int v) {
        T.Point memory p = T.Point(v, T.double(v));
        require(p.y == v * 2);
    }
}
```

The Solidity spelling `import * as T from "./types.scash";` does not parse; write `import "./types.scash" as T;`.

:::caution
Two import forms have known gaps in the current compiler:

- **Renaming with `as` in a selective import** (`import { double as x2 } from "...";`) parses, but the alias
  resolves only for an enum. For anything else the alias is not declared: import the original name instead.
- **Constants are not imported through a namespace.** `T.SCALE` does not resolve; use a wildcard or selective
  import for file-level constants. A namespace import also brings the file's types into scope under their bare
  names, so they must not clash with local names.
:::

### Importing Solidity sources

With the `evmCompat` compiler option, `.sol` files are parsed as SolidCash and the import resolver
also tries `.sol` candidates, so a Solidity dependency tree can be imported directly. `pragma solidity ...` is
accepted and its version constraint is not enforced. Solidity shapes outside the documented compatibility subset
are experimental; see [Solidity Parity](/docs/basics/solidity-parity).

Non-relative (npm-style) import paths resolve against the package tree, so
`import "@openzeppelin/contracts/token/ERC20/IERC20.sol";` works the same way it does in a Solidity project.

The flag also enables storage, public-getter, data-location, inheritance and proxy lowerings which can change an
artifact. See [Solidity Import Compatibility](/docs/compiler/solidity-import-compat); it is not merely a file
extension switch, and it is separate from EVM-compatible `abi.*` encoding.

## Interfaces

An `interface` describes another contract: its externally readable state and its callable functions. Unlike
Solidity, a SolidCash interface can declare **state variables and collections**, because reading another
contract's state is a covenant introspection operation rather than a call.

```solidity
pragma solidcash ^0.14.0;

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

Interface state variables and collections must be `public` or `external`. An interface may also declare
events, errors, enums, structs, user-defined value types, `using ... for` directives and a bodyless `fallback`.

### Reading external state

Given an interface and the target contract's self-pinned locking bytecode address, you can read its state directly:

```solidity
pragma solidcash ^0.14.0;

interface IToken {
    public uint256 totalSupply;
    public mapping(address => uint256) balances;
}

contract Reader(address target) {
    uint256 seen;

    function readTotal() public {
        this.seen = IToken(target).totalSupply;
    }

    function readBalance(address who) public {
        this.seen = IToken(target).balances[who];
    }
}
```

The compiler emits a covenant that co-spends the target contract's state UTXOs and pins their locking bytecode to
the target address. The target and sub-NFT covenants self-pin their category and commitments, so the read is
trustless. The SDK resolves and attaches the required inputs automatically.

### Calling external functions

```solidity
pragma solidcash ^0.14.0;

interface ICounter {
    function increment();
}

contract Caller(address target) {
    int calls;

    function bump() public {
        ICounter(target).increment.call();
        this.calls += 1;
    }
}
```

- `.call()` - a stateful call; the target may modify its own state.
- `.staticcall()` - read-only; the target's state must come out unchanged.

`target` is an address: the locking bytecode of the callee's master UTXO. The caller checks that the co-spent
callee has exactly that lock, so a 32-byte category id is not a call target. If the callee fails, the whole
transaction fails.

:::caution Experimental
A call that changes the callee's state is composed external state mutation, which is experimental in 0.14.0-beta.1 and
outside the stable compatibility promise. External state reads and `.staticcall()` are not affected.
:::

See [Cross-Contract Calls & Results](/docs/language/cross-contract-calls) for target binding, output-state reads,
return-event NFTs, and the low-level `.call` / `.delegatecall` forms.

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
`interfaceId` is `bytes4`, the XOR of the interface's function selectors. Selectors are sha256-based by default,
so it differs from an EVM contract's EIP-165 id; under the `evmCompat` option the selectors and the id are real
keccak256 over Solidity's canonical signatures.
:::

## Abstract contracts

An `abstract contract` may leave functions unimplemented and cannot be deployed on its own. It is the base for
inheritance:

```solidity
pragma solidcash ^0.14.0;

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
functions are implicitly virtual natively; `evmCompat` requires writing `virtual` on them, as Solidity does.
:::

See [Inheritance](/docs/language/inheritance) for C3 linearization, `super`, and multiple inheritance.

## Declaration-only files

A file containing only declarations - a standalone `interface`, file-level types, an inline-only `library`, or
an `abstract contract` - compiles to a minimal artifact with an ABI and empty bytecode, mirroring solc. Such an
artifact cannot be deployed.

## See also

- [Inheritance](/docs/language/inheritance) - `is`, `virtual`, `override`, `super` and C3 linearization
- [Libraries & Using-For](/docs/language/libraries) - sharing implementations rather than declarations
- [Structs, Enums & Custom Types](/docs/language/structs-enums-types) - the importable type forms
