---
title: Events & Errors
---

SolidCash supports Solidity-style events for typed on-chain records and custom errors for structured failure
reporting. On Bitcoin Cash an event is a CashToken NFT output, not an item in an EVM receipt log.

## Event Definitions

Events declare a record type that can be emitted during function execution:

```solidity
event Transfer(bytes20 indexed from, bytes20 to, int amount);
event Approval(bytes20 indexed owner, bytes20 indexed spender, int amount);
```

### Indexed Parameters

Mark up to three parameters as `indexed`. The SDK accepts filters only for these named parameters, matching the
Solidity API contract. All parameters remain encoded in the NFT commitment; a basic UTXO provider returns the
event-address UTXOs and the SDK applies indexed filters after decoding them.

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
**Events are UTXOs.** A named event is sent to a covenant address derived from the contract category and full event
signature. An anonymous event uses one shared address for the contract. The record remains directly queryable while
its NFT is unspent.
:::

## Event NFT Protocol

For every reached `emit`, generated code verifies a dedicated output with all of these properties:

- the same 32-byte base category as the emitting contract's master NFT;
- `none` NFT capability and zero fungible-token amount;
- a commitment which exactly equals the canonically encoded event arguments;
- the event-specific P2SH32 covenant address, or the shared anonymous-event address; and
- at most 1,200 satoshis, preventing a log output from trapping a large contract balance.

The covenant also pins where own-category immutable NFTs may occur in the transaction and binds inactive
conditional event slots to empty commitments. A transaction builder therefore cannot append a forged event beside a
genuine state transition and have the SDK accept it as another log.

Named event addresses use the complete signature, such as `Transfer(address,address,uint256)`, so overloaded event
names remain distinct. Anonymous events deliberately omit that signature hash and must be disambiguated by decoding
against the contract's anonymous event definitions.

### Commitment encoding

Arguments are concatenated in declaration order with the Script-native state codec:

- integers use minimal BCH VM-number pushdata encoding;
- strings are UTF-8 bytes;
- byte strings, addresses, public keys, and signatures carry their exact bytes;
- structs encode fields in declaration order; and
- arrays encode their element count followed by their elements, packing fixed-width elements tightly.

A reached zero-parameter event uses an internal non-empty marker so it cannot be confused with a reserved but
untaken conditional slot. The marker does not appear as an argument in decoded results.

See [State Storage & Data Encoding](./storage-model.md#canonical-state-encoding) for the shared codec.

### Retention and cleanup

Event NFTs are immutable (`none` capability), but they are not forced to remain in the UTXO set forever. Their
covenant enforces a 144-block relative delay and then permits anyone to spend them for cleanup. Consequently:

- `queryEvents()` and `readEventsFromChain()` read the **current unspent event set** exposed by the provider;
- an application which needs permanent history must index event UTXOs before they are spent, or use a provider
  which retains spent-output history; and
- block-range arguments on the ethers-compatible facade cannot reconstruct already-spent events from a UTXO-only
  provider.

This design makes logs independently discoverable without forcing every event to remain as permanent UTXO-set
bloat.

## Reading Events (SDK)

The connected `StatefulContract` API resolves signatures, addresses, structs, and anonymous events for you:

```typescript
const transfers = await token.queryEvents('Transfer', { from: aliceAddress });

for (const event of transfers) {
    console.log(event.txid, event.vout, event.values.amount);
}
```

Filters may contain only parameters declared `indexed`; passing any other field is an error. Use a full signature
when an event name is overloaded.

The ethers-style facade returns `{ eventName, eventSignature, args, txid, vout }` records:

```typescript
const filter = token.filters.Transfer(aliceAddress, null);
const logs = await token.queryFilter(filter);

await token.on(filter, (log) => {
    console.log(log.args.to, log.args.amount);
});

await token.off(filter);
```

`on()` and `once()` poll the provider (default interval: four seconds). Existing UTXOs are seeded as already seen,
so a new subscription fires only for event outputs observed after subscription. `off()`, `removeListener()`, and
`removeAllListeners()` stop listeners; these APIs do not create a node-side push subscription.

For lower-level access, derive the address and decode the UTXOs explicitly:

```typescript
import {
  readEventsFromChain,
  readAnonymousEventsFromChain,
  getEventNftAddress,
  getAnonymousEventNftAddress,
} from 'solidcash/stateful';

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
- `blockHeight` / `confirmations` - when supplied by the provider
- `values` - decoded parameter map (e.g., `{ from: ..., to: ..., amount: 100n }`)

Anonymous results also include `eventName` and `eventSignature` after schema matching.

## Events Compared with Return Results

A function return used across a contract boundary is carried by a **return-event NFT**, but it is not an event
declared with `event`:

| | Declared event NFT | Return-event NFT |
| --- | --- | --- |
| Purpose | Application log | Synchronous result transport |
| Locking bytecode | Signature-specific or anonymous event covenant | `OP_TRUE` |
| Retention | Cleanup only after 144 blocks | Immediately disposable |
| Decoder | Event ABI definition | Callee function output types |
| Emission | `emit EventName(...)` | Automatic for a cross-contract result; `.emitReturn()` when requested off-chain |

See [Cross-Contract Calls & Results](./cross-contract-calls.md#return-event-nfts) for the caller/callee binding.

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
