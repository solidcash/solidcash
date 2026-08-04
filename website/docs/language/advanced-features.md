---
title: Advanced Features
---

This page covers control flow, cross-contract interaction, and a handful of expression-level conveniences.

Several topics that used to live here now have dedicated pages:
[Inline Assembly](/docs/language/assembly), [Contract Creation & Lifecycle](/docs/language/contract-creation)
(proxies and delegatecall), [Data Locations](/docs/language/data-locations), and
[Global Variables](/docs/language/globals) (the `abi.*` family, `msg.*`, `block.*` and number units).

## Switch Statement

```solidity
contract Router() {
    int counter;

    function route(int action) public {
        switch (action) {
            case 0:
                this.counter = this.counter + 1;
                break;
            case 1:
                this.counter = this.counter - 1;
                break;
            default:
                revert("Unknown action");
        }
    }
}
```

- Multiple `case` values, with `break` to exit
- Optional `default` branch
- Works in stateful contracts (state is tracked across branches)

## Loops

SolidCash supports C-style `for` loops with no compiler-imposed iteration limit. The practical bound is the
per-input operation-cost budget, not gas.

```solidity
contract Summing() {
    function total(int[] values, int n) returns (int) {
        int sum = 0;
        for (int i = 0; i < n; i++) {
            sum += values[i];
        }
        return sum;
    }
}
```

`break` and `continue` are supported:

```solidity
contract Filtering() {
    function total(int[] values, int n, int limit) returns (int) {
        int sum = 0;
        for (int i = 0; i < n; i++) {
            if (values[i] == 0) continue;   // skip zeros
            if (sum > limit) break;         // stop early
            sum += values[i];
        }
        return sum;
    }
}
```

### While & Do-While

```solidity
contract Counting() {
    function countdown(int remaining) returns (int) {
        int steps = 0;
        while (remaining > 0) {
            remaining -= 1;
            steps += 1;
        }

        do {
            steps += 1;
        } while (steps < 3);

        return steps;
    }
}
```

### Collection Iteration

See [Stateful Contracts - Mapping Iteration](/docs/language/stateful-contracts#mapping-iteration) for the
three iteration modes (`for-of`, `for-in`, `for-of .entries`). Note that a mapping must be declared
`enumerable` to be iterable.

## Unchecked Arithmetic

By default, bounded integer arithmetic checks for overflow/underflow. The `unchecked` block disables these checks for wrapping behavior:

```solidity
unchecked {
    uint8 a = uint8(255) + uint8(1);   // wraps to 0
    uint8 b = uint8(0) - uint8(1);     // wraps to 255
    uint16 c = uint16(65535) + uint16(1); // wraps to 0
}
```

Only applies within the block. Outside `unchecked`, overflow/underflow causes a script failure.

## ABI Encoding & Decoding

The `abi.encode` / `abi.encodePacked` / `abi.encodeWithSelector` / `abi.encodeWithSignature` /
`abi.encodeCall` / `abi.decode` / `abi.decodeAt` family is documented in
[Global Variables](/docs/language/globals#abi-encoding-and-decoding), together with the caution about
sha256-derived selectors.

## External Contract Interaction

### External State Reads

Read another contract's public state variables using an interface and category ID:

```solidity
interface ICounter {
    public int counter;
    public mapping(bytes20 => int) balances;
}

contract Reader(bytes32 counterCategory) {
    int lastSeen;

    function sync() public {
        // Read the current state of the external contract
        this.lastSeen = ICounter(counterCategory).counter;
    }

    function readBalance(bytes20 account) public {
        this.lastSeen = ICounter(counterCategory).balances[account];
    }
}
```

The compiler emits a covenant that co-spends the target's state UTXOs and verifies their category, so the read
is trustless. The SDK attaches the required inputs automatically.

### Output State Reads

Read the state an external contract will have **after** its function executes in the same transaction, using
`.outState`:

```solidity
interface ICounter {
    public int counter;
}

contract Reader(bytes32 counterCategory) {
    int lastSeen;

    function readAfterCall() public {
        this.lastSeen = ICounter(counterCategory).outState.counter;
    }
}
```

### External Function Calls

```solidity
interface ITarget {
    function increment(pubkey pk, sig s);
}

contract Caller(bytes32 targetCategory) {
    function callTarget() {
        ITarget(targetCategory).increment.call();
    }

    function readTarget() {
        ITarget(targetCategory).increment.staticcall();  // read-only
    }
}
```

- `.call()` - stateful call (target can modify its own state)
- `.staticcall()` - read-only (target state changes are not committed)

## Delegatecall & Proxy Pattern

Proxies, the inferred delegate build, and layout compatibility are covered in
[Contract Creation & Lifecycle](/docs/language/contract-creation#proxy-and-delegatecall).

## Fallback & Receive Functions

See [Functions](/docs/language/functions#fallback-and-receive).

## Inline Assembly

SolidCash accepts both Yul blocks and native BCH opcode blocks. See
[Inline Assembly](/docs/language/assembly).

## Exponentiation

```solidity
contract Power() {
    function compute(int base, uint exponent) returns (int) {
        return base ** exponent;
    }
}
```

- Right-associative: `2 ** 3 ** 2` is `2 ** 9`, i.e. `512`
- The exponent must be an **unsigned** type. A signed `int` exponent is a compile error: use `uint`/`uintN`

## Date Literals

```solidity
contract Deadline() {
    function check() {
        int deadline = date("2025-12-31T00:00:00");
        int precise = date("2025-06-15T14:30:00");
        require(precise < deadline);
        require(tx.time >= deadline);
    }
}
```

Compiles to a Unix timestamp integer at compile time.

:::note
The full `YYYY-MM-DDThh:mm:ss` form is required. A date-only string such as `date("2025-12-31")` is a compile
error.
:::

## Number Units

See [Global Variables](/docs/language/globals#globally-available-units).

## String Features

```solidity
string greeting = "Hello, World!";
string combined = string.concat("Hello", " ", "World");
int len = greeting.length;
string sub = greeting.slice(0, 5);          // "Hello"
string reversed = greeting.reverse();
(string a, string b) = greeting.split(5);   // ("Hello", ", World!")
```

## Try-Catch

```solidity
interface IRisky {
    function compute() returns (int);
}

contract Guarded(bytes32 target) {
    int last;

    function attempt() public {
        try IRisky(target).compute() returns (int result) {
            this.last = result;
        } catch {
            this.last = 0;
        }
    }
}
```

:::caution
The `try` block runs, but **catch bodies are dead code**. A failed opcode aborts the Bitcoin Cash script
outright and execution cannot be resumed, so there is nothing to catch. `try`/`catch` parses and the `try`
path compiles so that ported Solidity sources build, and the compiler warns about the divergence. Do not rely
on a `catch` branch for error recovery.
:::

## `msg` and `tx` Globals

See [Global Variables](/docs/language/globals#message-and-origin-variables) for `msg.sender`, `msg.value`,
`msg.sig`, `msg.data` and `tx.origin`, including the caution about using signatures rather than sender
identity for authorization.

## See also

- [Inline Assembly](/docs/language/assembly)
- [Contract Creation & Lifecycle](/docs/language/contract-creation)
- [Imports & Interfaces](/docs/language/imports-interfaces)
- [Global Variables](/docs/language/globals)
