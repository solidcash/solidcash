---
title: Functions
---

Functions are the main construct in a SolidCash contract. Externally callable functions are the entry points
for spending from a contract: each one is a branch of the redeem script, selected by a 4-byte selector.
Internal functions are ordinary reusable helpers.

For the catalogue of built-in functions like `sha256` and `checkSig`, see
[Built-in Functions](/docs/language/builtin-functions).

## Declaring a function

```solidity
pragma solidcash ^0.14.0;

contract TransferWithTimeout(pubkey sender, pubkey recipient, int timeout) {
    function transfer(sig recipientSig) {
        require(checkSig(recipientSig, recipient));
    }

    function timeout(sig senderSig) {
        require(checkSig(senderSig, sender));
        require(tx.time >= timeout);
    }
}
```

At its core, the result of an externally callable function is a yes-or-no answer to "can money be sent out of
this contract?". Covenants let you go further and constrain *where* the money goes. See the
[Covenants guide](/docs/guides/covenants).

### Function arguments

Arguments to externally callable functions are supplied by the spender in the unlocking script. Because the
spender chooses them, they are **untrusted**: anyone can craft them to probe your contract logic.

```solidity
function spend(pubkey pk, sig s, int amount) {
    require(amount > 0);
    require(checkSig(s, pk));
}
```

By default, entry code canonicalizes `bool` and enforces bounded `bytesN`, signed/unsigned integer, enum,
fixed-point, and matching value-type ranges. The SDK also validates the complete ABI before encoding arguments.
Setting `enforceFunctionParameterTypes: false` removes those on-chain entry guards to save bytecode; only do so
when equivalent validation is unnecessary or explicitly implemented in the contract.

:::note
Function parameters are passed in the reverse order of their declaration. This matters when debugging,
optimising, or constructing transactions by hand.
:::

Function arguments are variables and can be reassigned inside the body.

## Visibility

| Modifier | Meaning |
| --- | --- |
| `external` | Callable only from outside, via a function selector |
| `public` | Callable from outside and from within the contract |
| `internal` | Callable within the contract and inheriting contracts |
| `private` | Callable only within the declaring contract |

```solidity
contract Example(pubkey owner) {
    function publicFunc(sig s) public { require(checkSig(s, owner)); }
    function externalFunc(sig s) external { require(checkSig(s, owner)); }
    function helper(int a) internal returns (int) { return a * 2; }
    function secret(int a) private returns (int) { return a + 1; }
}
```

`public` and `external` functions become unlock paths in the redeem script and get a 4-byte selector.
`internal` and `private` functions are not unlock paths: they are compiled as reusable subroutines (or inlined
where that is cheaper).

A function declared without a visibility keyword is `public`. Calling an `external` function by name from inside
the contract is a compile error; make it `public` to call it both ways.

### Entry-point selectors

An entry point is chosen by a 4-byte selector computed from its signature, `name(type1,type2,...)`. Natively the
selector is the first 4 bytes of the signature's sha256 hash, so it differs from an EVM contract's. Under the
`evmCompat` compiler option it is the first 4 bytes of the keccak256 hash of the canonical Solidity signature, as
solc computes it. Inside a function, `msg.sig` holds the selector of the running entry point.

## Mutability

| Modifier | Meaning |
| --- | --- |
| `pure` | Declares no state access |
| `view` | Declares read-only state access |
| `payable` | Accepted for Solidity compatibility; does not gate value (see below) |

```solidity
function compute(int a, int b) internal pure returns (int) {
    return a + b;
}

receive() external payable { }
```

Mutability checking is uniform across native and compatibility modes. `pure` functions reject contract-state and
environment reads, and both `pure` and `view` reject state/transient-state writes, contract creation, low-level
calls, and calls to less-restrictive functions or function pointers.

`payable` is accepted so Solidity sources compile, but it does not decide whether a function can receive value:
every BCH address can. Any function may read `msg.value` (the net change of the contract's satoshi container),
except a `view` public or external function and a constructor that is not `payable`. `pure` functions cannot read
it, and `internal`, `private` and `pure` functions cannot be declared `payable`.

## Return values

Functions can return one value, several values, or named values.

```solidity
function single(int a) internal returns (int) {
    return a * 2;
}

function multiple(int a, int b) internal returns (int, int) {
    return (a + b, a - b);
}

function named(int a, int b) internal returns (int total, int diff) {
    total = a + b;
    diff = a - b;   // no return statement needed
}
```

Named returns start at their type's default value. Falling off the end of the function returns their current
values, and a bare `return;` does the same at an earlier point. A function with unnamed returns that falls off its
end returns the type defaults, as in Solidity. Multi-return values are consumed by destructuring:

```solidity
contract Consumer() {
    function _stats(int a, int b) internal returns (int total, int diff) {
        total = a + b;
        diff = a - b;
        return;
    }

    function use() {
        (int total, int diff) = _stats(10, 4);
        (, int onlyDiff) = _stats(10, 4);      // skip a slot
        require(total == 14 && diff == onlyDiff);
    }
}
```

### Returns from entry points

A `public` or `external` function may also declare return values. Called by name from inside the contract, a
`public` function returns them like an internal one. Off chain, the SDK reads them without sending a transaction:
see `staticCall()` in [Transactions and Receipts](/docs/sdk/transactions#stateful-calls). Another contract
receives a stateful callee's return values through a
[return-event NFT](/docs/language/cross-contract-calls#return-event-nfts); calls that mutate another contract's
state are experimental.

## Calling functions

Internal and private functions are called by name. Arguments may be positional or named:

```solidity
contract Caller() {
    function helper(int a) internal returns (int) { return a * 2; }
    function compute(int a, int b) internal returns (int) { return a - b; }

    function run() {
        int doubled = helper(21);
        int result = compute({ b: 1, a: 5 });   // named arguments, any order
        require(doubled == 42 && result == 4);
    }
}
```

### Overloading

Functions may be overloaded on arity and parameter types:

```solidity
function _sum(int a, int b) internal returns (int) { return a + b; }
function _sum(int a, int b, int c) internal returns (int) { return a + b + c; }
```

Overload resolution uses argument count and types. Named arguments also participate: their field names first
filter the candidate set and types then select the matching signature. A call is rejected only if no unique
overload remains. Contextual function-pointer type and, for supported helper inlining, expected return arity can
also disambiguate otherwise similar overloads.

### Recursion and loops

Internal functions compile to real subroutines using the BCH 2026 VM's `OP_DEFINE` / `OP_INVOKE`, so they can
be called from loops and can call each other. Recursion works, in contract functions and free functions alike:

```solidity
function factorial(int n) returns (int) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}
```

The practical limits are the VM's control stack depth and the operation cost budget of the input.

## Free functions

Functions can be declared at file level, outside any contract. They are importable and behave like internal
helpers at every call site.

```solidity
pragma solidcash ^0.14.0;

function double(int v) returns (int) {
    return v * 2;
}

contract Calculator() {
    function run(int a) {
        require(double(a) == a * 2);
    }
}
```

## Function types

Functions are first-class values. A function type names its parameter types, visibility and returns, and a
function name in value position produces such a value.

```solidity
contract Strategy() {
    function _add(int a, int b) internal returns (int) { return a + b; }
    function _mul(int a, int b) internal returns (int) { return a * b; }

    function apply(int a, bool useAdd) {
        function(int, int) internal returns (int) op = useAdd ? _add : _mul;
        require(op(a, 2) > 0);
    }
}
```

A function value is the target's integer function id, and an indirect call reuses the same `OP_INVOKE`
dispatch as a direct one. Function pointers can be stored in arrays and state mappings to build dispatch
tables.

:::note
An entry point cannot take or return an `internal` function type, as in solc. It may take an `external` function
value; the entry code then checks that the received id names one of this contract's own public or external
functions of that type. Function-pointer state is rejected in `upgrade` contracts and proxy implementation builds,
because function ids are positional and would remap.
:::

## Modifiers

Custom modifiers wrap a function body at the `_` placeholder:

```solidity
contract Token(pubkey owner) {
    modifier onlyOwner(sig s) {
        require(checkSig(s, owner));
        _;
    }

    function transfer(bytes20 to, int amount, sig s) onlyOwner(s) {
        require(amount > 0);
        require(to.length == 20);
    }
}
```

See [Function Modifiers](/docs/language/modifiers) for the full reference, including the lifecycle modifiers
(inferred `deploy`, `upgrade`, `migrateRecords`, `selfdestruct`, `split`, `merge`) and the `unsafe` tiers.

## Fallback and receive

Two special functions handle calls that match no selector:

```solidity
contract Flexible(bytes20 admin) {
    int counter;

    fallback(bytes input) external {
        require(input.length >= 0);
        this.counter += 1;
    }

    receive() external payable { }
}
```

- `fallback`: at most one per contract; receives the raw calldata as `bytes`.
- `receive`: at most one per contract; must be `external payable` and take no parameters.
- Both support `virtual` and `override`.

An empty `receive()` or `fallback()` body, like any empty function body without return values, is compiled as
`require(true)` with a warning. For an entry point this is a state-preserving no-op spend path.

## Constructors

Every contract takes its immutable parameters on the contract definition itself; their values are baked into
the bytecode. Stateful contracts can additionally define a `constructor` block to initialise state at deployment.
Its parameters are deployment arguments, not part of the bytecode:

```solidity
contract Token(pubkey admin) {
    int totalSupply;

    constructor(int initialSupply) {
        this.totalSupply = initialSupply;
    }

    function mint(sig s, int amount) {
        require(checkSig(s, admin));
        this.totalSupply += amount;
    }
}
```

:::caution
A constructor may create mapping entries, but it cannot read pre-existing mapping state because none exists yet.
Token containers cannot be read or transferred in a constructor. The SDK evaluates supported constructor effects
while assembling genesis; see [Contract Deployment](/docs/guides/deployment#deployment-arguments).
:::

## See also

- [Built-in Functions](/docs/language/builtin-functions) - the global function catalogue
- [Function Modifiers](/docs/language/modifiers) - visibility, mutability and covenant control
- [Libraries & Using-For](/docs/language/libraries) - sharing functions across contracts
- [Inheritance](/docs/language/inheritance) - `virtual`, `override`, `super` and C3 linearization
