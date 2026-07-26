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
pragma solidcash ^0.13.0;

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

:::caution
Type annotations on entry-point arguments are **semantic only**. The length of a bounded type like `bytes20` is
not automatically contract-enforced; the SDK uses the annotation to encode arguments correctly. If the length
matters to your logic, check it explicitly with `require(item.length == 20)`.
:::

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

:::note
Selectors are derived with sha256 by default, so they differ from an EVM contract's. The `evmCompat` compiler
option switches selector derivation to real keccak256.
:::

## Mutability

| Modifier | Meaning |
| --- | --- |
| `pure` | Declares no state access |
| `view` | Declares read-only state access |
| `payable` | Function can receive BCH; enables `msg.value` |

```solidity
function compute(int a, int b) internal pure returns (int) {
    return a + b;
}

receive() external payable { }
```

:::caution
`pure` and `view` are **accepted but not enforced**. Unlike solc, the compiler does not currently reject a
`view` function that writes state. Treat them as documentation and as porting affordances, not as guarantees.
:::

`payable` is largely cosmetic: every BCH address can receive value. It is accepted so Solidity sources compile,
and it enables `msg.value` in the body.

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
    diff = a - b;
    return;
}
```

Named returns are initialised to their type's default and returned by a bare `return;`, which is required.
Multi-return values are consumed by destructuring:

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

:::note
Named arguments cannot be used with an overloaded function, because the call would be ambiguous.
:::

### Recursion and loops

Internal functions compile to real subroutines using the BCH 2026 VM's `OP_DEFINE` / `OP_INVOKE`, so they can
be called from loops and can call each other. The practical limit is the VM's control stack depth.

## Free functions

Functions can be declared at file level, outside any contract. They are importable and behave like internal
helpers at every call site.

```solidity
pragma solidcash ^0.13.0;

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
Targets must be `internal`, `private` or `public`. External function types have no ABI representation on BCH,
so entry-point parameters and returns of function type are rejected. Function-pointer state is also rejected in
`upgrade` contracts and proxy implementation builds, because positional ids would remap.
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

See [Function Modifiers](/docs/language/modifiers) for the full reference, including the covenant-control
modifiers `unsafe`, `upgrade`, `selfdestruct`, `split` and `merge`.

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

An empty `receive()` or `fallback()` body synthesises a state-preserving no-op spend path, with a warning.

## Constructors

Non-stateful contracts take their immutable parameters on the contract definition itself. Stateful contracts
can additionally define an explicit `constructor()` body to initialise state at deployment:

```solidity
contract Token(pubkey admin) {
    int totalSupply;

    constructor() {
        this.totalSupply = 1_000_000;
    }
}
```

:::caution
Mappings and token containers cannot be accessed in the constructor: no UTXO commitment exists yet at
deployment time.
:::

## See also

- [Built-in Functions](/docs/language/builtin-functions) - the global function catalogue
- [Function Modifiers](/docs/language/modifiers) - visibility, mutability and covenant control
- [Libraries & Using-For](/docs/language/libraries) - sharing functions across contracts
- [Inheritance](/docs/language/inheritance) - `virtual`, `override`, `super` and C3 linearization
