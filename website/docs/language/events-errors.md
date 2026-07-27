---
title: Events & Errors
---

SolidCash supports Solidity-style events for logging and custom errors for structured failure reporting.

## Event Definitions

Events declare a record type that can be emitted during function execution:

```solidity
event Transfer(bytes20 indexed from, bytes20 to, int amount);
event Approval(bytes20 indexed owner, bytes20 indexed spender, int amount);
```

### Indexed Parameters

Mark up to 3 parameters as `indexed` for efficient filtering when reading events from chain.

### Anonymous Events

Anonymous events share a single NFT address, reducing on-chain overhead:

```solidity
event Debug(string message) anonymous;
```

### Scope

Events can be defined at file level, contract level, or in interfaces:

```solidity
// File-level
event GlobalEvent(int value);

contract MyContract() {
    // Contract-level
    event LocalEvent(bytes20 addr);
}

interface IToken {
    // Interface-level
    event Transfer(bytes20 from, bytes20 to, int amount);
}
```

## Emitting Events

Use the `emit` keyword inside functions:

```solidity
contract Token() {
    event Transfer(bytes20 indexed from, bytes20 to, int amount);
    int totalSupply;
    mapping(bytes20 => int) balances;

    function transfer(bytes20 to, int amount) {
        bytes20 sender = hash160(bytes(msg.sender));
        require(this.balances[sender] >= amount);

        this.balances[sender] = this.balances[sender] - amount;
        this.balances[to] = this.balances[to] + amount;

        emit Transfer(sender, to, amount);
    }
}
```

:::note
**Events are persistent NFTs.** Unlike Solidity where events are ephemeral log entries (requiring archive nodes to query), SolidCash events are stored as CashToken NFTs in the UTXO set. They can be queried directly from any full node without special indexing.
:::

## Reading Events (SDK)

```typescript
import {
    readEventsFromChain,
    readAnonymousEventsFromChain,
    getEventNftAddress,
    getAnonymousEventNftAddress,
} from 'solidcash';

// Named events
const eventAddr = getEventNftAddress(contract.inner, categoryId, 'Transfer');
const events = await readEventsFromChain(
    provider, eventAddr, categoryId, transferEventDef
);

for (const evt of events) {
    console.log(evt.values.from, '->', evt.values.to, ':', evt.values.amount);
}

// Anonymous events
const anonAddr = getAnonymousEventNftAddress(contract.inner, categoryId);
const anonEvents = await readAnonymousEventsFromChain(
    provider, anonAddr, categoryId, anonymousEventDefs
);
```

Each event object contains:
- `txid` - transaction that emitted the event
- `vout` - output index
- `values` - decoded parameter map (e.g., `{ from: ..., to: ..., amount: 100n }`)

## Custom Error Definitions

Errors define structured failure types with parameters:

```solidity
// File-level errors
error InsufficientBalance(int requested, int available);
error Unauthorized();

contract Token() {
    // Contract-level errors
    error TransferFailed(bytes20 to, int amount);
}
```

Errors are included in the contract's ABI, allowing callers to decode failure reasons.

## Revert

Use `revert` to abort execution with an error:

```solidity
error InsufficientBalance(int requested, int available);

contract Ledger() {
    mapping(bytes20 => int) balances;

    function transfer(bytes20 to, int amount) public {
        bytes20 sender = hash160(bytes(msg.sender));
        if (this.balances[sender] < amount) {
            revert InsufficientBalance(amount, this.balances[sender]);
        }
        this.balances[sender] -= amount;
        this.balances[to] += amount;
    }
}
```

### Revert Variants

```solidity
error InsufficientBalance(int requested, int available);

contract RevertForms() {
    function structured() { revert InsufficientBalance(100, 50); }  // error with args
    function withMessage() { revert("Not enough funds"); }          // string message
    function bare() { revert(); }                                   // no data
}
```

## Assert

Assert checks internal invariants that should never be false:

```solidity
contract Invariant() {
    int totalSupply;

    function check() public {
        assert(this.totalSupply >= 0);
        this.totalSupply += 1;
    }
}
```

If the assertion fails, the transaction is aborted.

## Require with Messages

The `require` statement is the primary validation mechanism. An optional second argument provides an error message:

```solidity
contract Guarded(pubkey owner) {
    function withdraw(int amount, sig s) {
        require(amount > 0, "Amount must be positive");
        require(checkSig(s, owner));
    }
}
```

:::note
External/public functions **must** end with a `require` statement (the "final require" rule). This is a covenant safety requirement enforced by the compiler.
:::

## Console Logging

For testing and debugging, `console.log` outputs values that can be inspected with test matchers:

```solidity
function debug(int x) {
    console.log("Value:", x);
    console.log(x);
}
```

:::caution
`console.log` is stripped from production bytecode. It is only useful with the `.toLog()` test matcher during development.
:::

## Test Matchers

The SDK provides test matchers for verifying errors and events:

```typescript
import 'solidcash/vitest';

// Require failure
await expect(contract.call.transfer(args).send())
    .toFailRequireWith(/Amount must be positive/);

// Solidity-style aliases
await expect(tx.send()).toBeReverted();
await expect(tx.send()).toBeRevertedWith(/Unauthorized/);

// Event emission (type-safe)
const result = await contract.call.transfer(to, amount).send();
await expect(result).toEmit(contract, 'Transfer', {
    from: senderPkh,
    to: recipientPkh,
    amount: 100n,
});

// Predicate matchers
await expect(result).toEmit(contract, 'Transfer', {
    amount: (v: bigint) => v > 50n,
});

// Console log
await expect(tx.send()).toLog("Value: 42");
```

See [Test Matchers](/docs/sdk/test-matchers) for the full reference.
