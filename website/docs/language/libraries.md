---
title: Libraries & Using-For
---

SolidCash has the same `library` keyword as Solidity, the same `using ... for` attachment, and the same
operator overloading. It also has a third mechanism Solidity does not need: **external library precompiles**,
which is how expensive primitives like `keccak256` are shared without duplicating bytecode.

## Inline libraries

A library whose functions are `internal` (or unmarked) is a compile-time construct. Its functions are inlined
at every call site and no artifact is produced, exactly like Solidity's internal library functions.

```solidity
pragma solidcash ^0.13.0;

library SafeMath {
    function add(int a, int b) internal returns (int) {
        int r = a + b;
        require(r >= a);
        return r;
    }
}

contract Vault() {
    function deposit(int balance, int amount) {
        require(SafeMath.add(balance, amount) > 0);
    }
}
```

Libraries may also declare `struct`, `enum`, `type`, `event`, `error` and `constant` members, which are
referenced with `Library.Member`:

```solidity
library Rebase {
    struct Data { uint256 base; uint256 elastic; }

    function addElastic(Data storage d, uint256 n) internal {
        d.elastic += n;
    }
}

contract Pool() {
    Rebase.Data total;
    using Rebase for Rebase.Data;

    function grow(uint256 n) public {
        this.total.addElastic(n);
    }
}
```

This is Solidity's `storage self` pattern, and it works the same way: `self` is one of possibly many struct
instances in the caller's state. Storage-pointer parameters have no on-stack value, so such a function is
inlined at each call site with the parameter aliased to the argument's state path. See
[Data Locations](/docs/language/data-locations#storage-parameters).

## Using-for

`using L for T` attaches a library's functions to a type so they can be called with method syntax. The
receiver becomes the first argument.

```solidity
library SafeMath {
    function add(int a, int b) internal returns (int) {
        int r = a + b;
        require(r >= a);
        return r;
    }
}

using SafeMath for int;

contract Calculator() {
    function run(int x, int y) {
        require(x.add(y) > 0);      // same as SafeMath.add(x, y)
    }
}
```

`using L for *` attaches the library to every type, and the `global` keyword makes the attachment visible to
every file that imports this one:

```solidity
library Utils {
    function double(int a) internal returns (int) { return a * 2; }
}

using Utils for * global;

contract Consumer() {
    function run(int x) {
        require(x.double() == x * 2);
    }
}
```

### Selective attachment

The braced form attaches specific functions rather than a whole library:

```solidity
library MathLib {
    function add(int a, int b) internal returns (int) { return a + b; }
    function sub(int a, int b) internal returns (int) { return a - b; }
}

using { MathLib.add } for int;

contract Selective() {
    function run(int x, int y) {
        require(x.add(y) >= 0);
    }
}
```

### Operator overloading

The same braced form maps functions onto operators for user-defined value types:

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
        Amount b = Amount.wrap(1);
        require(Amount.unwrap(a + b) > 0);
    }
}
```

The overloadable operators are `+ - * / % **`, `== != < <= > >=`, and `& | ^ ~`.

## Deployed libraries

A library with at least one `public` or `external` function compiles to a **deployed, stateless contract** with
its own artifact. Its public functions run in the calling contract's state context, which is the BCH analogue
of Solidity's `DELEGATECALL`-linked library.

```solidity
pragma solidcash ^0.13.0;

library Counter {
    uint256 count;

    function incrementBy(uint256 n) public {
        this.count += n;
    }
}
```

The library declares the **state shape** it operates on. A consumer that imports it calls `Counter.incrementBy(n)`,
and the compiler rewrites that to a delegatecall against a synthesized library-address constructor argument.
The SDK supplies the deployed library's address and co-spends it automatically.

This split matches Solidity exactly: `internal` library functions are inlined, `public` library functions are
delegatecalled.

### Layout compatibility

Because the library runs against the caller's state, the consumer's state layout must **lead with the library's
fields**, in the same order, with the same names and types. This is the same rule as EVM upgradeable-proxy
storage-layout compatibility. It is checked twice: at compile time when both layouts are in one compilation,
and again by the SDK at build time.

### Return values

A delegate library call has **no synchronous return**. BCH has no cross-input call, so a library function
cannot hand a value back to the caller's script; using a library call as a value (`r = L.f(x)`) is a compile
error. Results are communicated through the shared state: the library writes a state field and the caller
reads it from its own state afterwards.

Value-returning pure helpers belong in an inline library or an external library precompile instead.

### Arguments

Library-call arguments are positional and must be either a forwarded parameter of the enclosing function or a
compile-time literal:

```solidity
pragma solidcash ^0.13.0;

import "./counter.scash";

contract App() {
    uint256 count;   // must match the library's leading state layout

    function bumpBy(uint256 n) public { Counter.incrementBy(n); }   // forwarded parameter
    function bumpOne() public { Counter.incrementBy(1); }           // literal
}
```

Computed expressions and state reads are rejected with a clear error: the delegatecall data is not on chain,
so the SDK is the courier and has to be able to reconstruct the arguments.

### Contention and branding

A deployed library is a co-spent UTXO, so a globally shared one would serialize all of its users. Compiling
with the `brandLibrary` option pins the library to its owning consumer's category and requires that consumer's
master to be co-spent. The library then rides the master's existing serialization and adds no marginal
contention. Shard by minting a per-consumer branded copy.

:::note
Whoever controls the master can re-mint a branded library, which means swappable logic without changing the
consumer's address. That is the same trust surface as an EVM upgradeable proxy. Use an immutable,
non-minting brand for libraries that are meant to be frozen.
:::

## External library precompiles

There is a third, lower-level mechanism: a **precompile**, a Script bytecode subroutine invoked with
`OP_INVOKE` inside the caller's own script. This is how SolidCash provides primitives that are too expensive to
inline everywhere, most notably `keccak256`.

| | External library (precompile) | Deployed library contract |
| --- | --- | --- |
| Layer | a Script bytecode subroutine | a source-language contract abstraction |
| Execution | `OP_INVOKE` within the caller's script | a separate co-spent contract evaluation |
| State | pure: inputs to outputs on the stack | touches the caller's state |
| Reuse storage | inline in the redeem script, or a side-car blob UTXO | a deployed contract UTXO |
| Linking | by hash (content-addressed) | by address / category brand |
| Returns a value | yes (synchronous subroutine) | no (via shared state) |

You mostly consume these implicitly by calling `keccak256`. See
[Cryptography](/docs/language/cryptography) for the details.

## Why inline versus deploy is your choice

There is no free shared code on Bitcoin Cash. A transaction can only read the bytecode of inputs it **spends**,
so using library code means either embedding it (duplicated bytes, no contention) or co-spending the UTXO that
holds it (shared bytes, plus lifecycle and contention). EVM code is freely shareable with zero contention; BCH
has no equivalent.

This, rather than a code-size cap, is what should drive the choice:

- **Inline** by default. It is simplest and adds no co-spent inputs.
- **Deploy** when the contract outgrows a single input's script-size and operation-cost budget. Each input
  carries its own budget, so moving logic to a co-spent UTXO multiplies the budget available.

## See also

- [Functions](/docs/language/functions) - visibility, free functions and function types
- [Data Locations](/docs/language/data-locations) - `storage` parameters and aliasing
- [Cryptography](/docs/language/cryptography) - the keccak256 and ecrecover side-cars
- [Script Limits](/docs/compiler/script-limits) - the per-input budgets that drive externalisation
