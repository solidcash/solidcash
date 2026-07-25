---
title: Advanced Features
---

This page covers advanced SolidCash language features including control flow, ABI encoding, external contract interaction, delegatecall, and inline assembly.

## Switch Statement

```solidity
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
```

- Multiple `case` values with `break` to exit
- Optional `default` branch
- Works in stateful contracts (state tracking across branches)

## For Loops

SolidCash supports C-style `for` loops with no compiler-imposed iteration limits:

```solidity
for (int i = 0; i < n; i = i + 1) {
    total = total + values[i];
}
```

`break` and `continue` are supported:

```solidity
for (int i = 0; i < n; i = i + 1) {
    if (values[i] == 0) continue;  // skip zeros
    if (total > limit) break;       // stop early
    total = total + values[i];
}
```

### While & Do-While

```solidity
while (remaining > 0) {
    remaining = remaining - 1;
}

do {
    attempts = attempts + 1;
} while (!success && attempts < maxAttempts);
```

### Collection Iteration

See [Stateful Contracts - Mapping Iteration](/docs/language/stateful-contracts#mapping-iteration) for the three iteration modes (`for-of`, `for-in`, `for-of .entries`).

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

### Basic Encoding

```solidity
bytes data = abi.encode(42, true, hex"abcd");
bytes packed = abi.encodePacked(sender, amount);  // no padding
```

### Decoding

```solidity
(int x, bool y) = abi.decode(data, (int, bool));
int value = abi.decodeAt(data, (int), 4);  // decode at byte offset 4
```

### Advanced Encoding

```solidity
// Encode with a specific 4-byte selector prefix
bytes call = abi.encodeWithSelector(hex"12345678", arg1, arg2);

// Encode with selector derived from function signature string
bytes call = abi.encodeWithSignature("transfer(address,uint)", to, amount);

// Encode with selector from an interface function (type-safe)
bytes call = abi.encodeCall(IToken.transfer, (recipient, amount));
```

:::note
`abi.encodeWithSignature` and `abi.encodeCall` derive the 4-byte selector from the function signature
using **sha256**, not Ethereum's `keccak256`. Selectors therefore differ from an EVM contract's, so
encoded calldata is **not** cross-VM compatible - use these for SolidCash-to-SolidCash calls.
:::

## External Contract Interaction

### External State Reads

Read another contract's public state variables using an interface and category ID:

```solidity
interface ICounter {
    int public counter;
    mapping(bytes20 => int) public balances;
}

contract Reader(bytes32 counterCategory) {
    int lastSeen;

    function sync() {
        // Read current state of external contract
        this.lastSeen = ICounter(counterCategory).counter;
    }

    function readBalance(bytes20 account) returns (int) {
        return ICounter(counterCategory).balances[account];
    }
}
```

### Output State Reads

Read the state that an external contract will have **after** its function executes in the same transaction:

```solidity
function readAfterCall() {
    int newVal = ICounter(counterCategory).outState.counter;
    this.lastSeen = newVal;
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

The delegatecall pattern separates state (proxy) from logic (implementation):

```solidity
// Implementation - holds logic, state access redirected to proxy
contract Implementation() {
    int counter;

    function increment() public {
        this.counter = this.counter + 1;
        // `this` refers to the PROXY's state, not implementation's
    }
}

// Proxy - holds state, forwards unknown calls to implementation
contract Proxy(bytes20 implAddr) {
    int counter;

    fallback(bytes input) external {
        address(implAddr).delegatecall(input);
    }
}
```

The compiler infers that `increment` can run in proxy context and emits that build as
`artifact.delegateArtifact`. SDK proxy helpers deploy and call this variant; there is no source-level `delegate`
modifier.

:::caution
Functions using `unsafe`, `upgrade`, `selfdestruct`, `deploy`, `split`, `merge`, `view`, `pure`, `internal`, or
`private` are not eligible for the inferred delegate build. Transfers and token-container operations are also
currently ineligible.
:::

## Fallback & Receive Functions

```solidity
contract Flexible() {
    // Catches calls with unknown/no function selectors
    fallback(bytes input) external {
        // input contains raw calldata
    }

    // Catches pure BCH value transfers
    receive() external payable {
        // no parameters
    }
}
```

- At most one `fallback` and one `receive` per contract
- Both support `virtual`/`override` for inheritance

## Inline Assembly

Direct Bitcoin Script opcodes for low-level control:

```solidity
assembly {
    OP_DUP OP_ADD 0x01
}
```

:::caution
Inline assembly bypasses all compiler safety checks (type checking, stack verification). Use only when you fully understand the stack effects.
:::

## Exponentiation

```solidity
int result = base ** exponent;
```

- Right-associative: `2 ** 3 ** 2` = `2 ** 9` = `512`
- Exponent must be unsigned (non-negative)

## Date Literals

```solidity
int deadline = date("2025-12-31");
int precise = date("2025-06-15T14:30:00");
require(tx.locktime >= deadline);
```

Compiles to a Unix timestamp integer at compile time.

## Number Units

Compile-time multipliers for readability:

```solidity
int fee = 1000 satoshis;          // 1000
int amount = 1 bitcoin;           // 100_000_000
int timeout = 7 days;             // 604_800
int delay = 2 hours;              // 7_200
```

| Unit | Value |
|------|-------|
| `satoshis` / `sats` | 1 |
| `finney` | 10 |
| `bits` | 100 |
| `bitcoin` | 100,000,000 |
| `seconds` | 1 |
| `minutes` | 60 |
| `hours` | 3,600 |
| `days` | 86,400 |
| `weeks` | 604,800 |

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
try externalContract.someFunc() returns (int result) {
    process(result);
} catch Error(string memory reason) {
    handleError(reason);
} catch {
    handleUnknown();
}
```

## `msg` and `tx` Globals

| Global | Type | Description |
|--------|------|-------------|
| `msg.sender` | `address` | Locking bytecode of the calling contract (falls back to `tx.origin` for direct calls) |
| `msg.value` | `int` | Net satoshi change in the contract's satoshi container (sum of all matching outputs minus sum of all matching inputs) |
| `msg.sig` | `bytes4` | 4-byte function selector of the current function (compile-time constant) |
| `msg.data` | `bytes` | Unlocking bytecode (with redeem script stripped) |
| `tx.origin` | `address` | P2PKH locking bytecode of the first non-token input |
