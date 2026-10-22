---
title: Stateful Contracts
---

SolidCash supports **stateful contracts** - contracts that store persistent state across transactions using CashToken NFT commitments. Unlike constructor parameters (which are immutable once set), state variables can be read and modified in every function call.

:::note
Stateful contracts require `p2sh32` address type. The SDK enforces this at construction time.
:::

## State Variables

State variables are declared at the top level of a contract, outside any function. They persist across transactions.

```solidity
pragma solidcash >=0.8.0;

contract Counter(pubkey admin) {
    int public counter;
    bytes20 internal owner;
    bool private initialized;
}
```

### Visibility

| Modifier | Access |
|----------|--------|
| `public` | Accessible everywhere in source; other contracts read it through an interface that declares it. Under `evmCompat` it also gets a Solidity getter function. |
| `external` | Like `public`, and the variable is stored alone in its own data NFT (native only; `evmCompat` rejects it) |
| `internal` | Accessible within the contract and inheriting contracts |
| `private` | Accessible only within the declaring contract |

Visibility is a source-level rule. State lives in NFT commitments that anyone can read on chain, and the SDK's
`getState()` returns every field.

An `external` state variable is also a layout instruction: each one gets a data NFT of its own. Contract threads
partition data NFTs, so functions that touch different `external` variables can run on different threads; see
[Concurrency](/docs/guides/concurrency#design-state-for-partitions).

### Constants & Immutables

```solidity
contract Config() {
    int constant MAX_SUPPLY = 1_000_000;         // compile-time, must initialize
    bytes20 immutable deployer;                   // set in constructor, read-only after

    constructor() {
        this.deployer = hash160(bytes(msg.sender));
    }
}
```

- `constant` - value fixed at compile time; cannot reference runtime values. It is compiled into the bytecode and
  takes no state.
- `immutable` - assigned once in the constructor; assigning it in any other function is a compile error. Unlike
  Solidity, the value is still stored in a data NFT.
- `transient` - not stored at all. Every call starts the variable at its type default and drops it when the call
  ends, like a local variable, and the compiler warns. It exists for Solidity code written for EIP-1153.

```solidity
bool transient locked;   // not persisted: false at the start of every call
```

## State Variable Assignment

State variables are read and written with the `this.` prefix or by their bare name. A bare name compiles to the
same bytecode as the `this.` form; it refers to the state variable unless a local variable or parameter of the same
name shadows it.

```solidity
contract Counter() {
    int counter;
    bytes20 owner;

    function increment() public {
        this.counter = this.counter + 1;
        this.owner = hash160(bytes(msg.sender));
    }
}
```

```solidity
counter += 1;            // same as this.counter += 1
balances[account] = 0;   // same as this.balances[account] = 0
```

:::caution
State changes are enforced by covenant verification. The compiler generates bytecode that checks the output NFT commitment matches the expected new state. If the state you set doesn't match what the bytecode computes, the transaction fails.
:::

## Constructor

Stateful contracts can have an explicit constructor to initialize state.

```solidity
contract Token(pubkey admin) {
    int totalSupply;
    bytes20 deployer;

    constructor() {
        this.totalSupply = 1_000_000;
        this.deployer = hash160(admin);
    }
}
```

Mapping assignments in a constructor are supported. The SDK derives the initial entry outputs while it builds the
deployment transaction; there is no earlier mapping state for the constructor to read.

## Verified Mappings

Every SolidCash mapping is a **verified mapping**, or **vmap** for short. Mapping entries are backed by mutable
**entry NFTs**, one per key. The entries form an authenticated sorted list, so each read proves one of two things:

- the requested key exists and this is its committed value; or
- the key is genuinely absent, so Solidity's type-default value is correct.

This matters on a UTXO chain: a transaction author chooses which UTXOs to spend. Without an absence proof, they
could hide an existing entry and make it appear unset. Vmaps prevent that omission attack automatically; there is
no source modifier or compiler option to enable them.

```solidity
contract Ledger() {
    mapping(bytes20 => int) public balances;

    function setBalance(bytes20 account, int amount) {
        this.balances[account] = amount;
    }

    function getBalance(bytes20 account) returns (int) {
        return this.balances[account];
    }
}
```

### Named Keys & Values

For documentation clarity, keys and values can be named:

```solidity
mapping(bytes20 holder => int balance) public balances;
```

### Nested Mappings

```solidity
mapping(bytes20 => mapping(bytes32 => int)) public allowances;

function approve(bytes20 owner, bytes32 spender, int amount) {
    this.allowances[owner][spender] = amount;
}
```

### Deleting Entries

```solidity
contract Ledger() {
    mapping(bytes20 => int) balances;

    function clear(bytes20 account) public {
        delete this.balances[account];
    }
}
```

As in Solidity, `delete mapping[key]` assigns the value type's default (`0`, `false`, or empty). The authenticated
node may remain on chain with that default value; deletion does not mean an unauthenticated physical removal.

## Mapping Iteration

As in Solidity, a mapping is **not iterable in source code** by default. Declaring it `enumerable` enables
iteration in three modes. It does not change the storage or security model: plain and enumerable mappings are both
vmaps.

```solidity
enumerable mapping(bytes20 => int) public balances;
```

:::note
Iterating a plain (non-`enumerable`) mapping is a compile error that names the fix.
:::


```solidity
contract Ledger() {
    enumerable mapping(bytes20 => int) public balances;
    int total;

    // Iterate values
    function totalBalance() public {
        int sum = 0;
        for (int balance of this.balances) {
            sum = sum + balance;
        }
        this.total = sum;
    }

    // Iterate keys
    function countHolders() public {
        int count = 0;
        for (bytes20 holder in this.balances) {
            count = count + 1;
        }
        this.total = count;
    }

    // Iterate entries (key-value pairs)
    function audit() public {
        for (bytes20 holder, int balance of this.balances.entries) {
            require(balance >= 0);
        }
        this.total += 1;
    }
}
```

:::tip
Mapping iteration follows the authenticated vmap links. All reachable entry NFTs for the mapping are included as
transaction inputs, and the covenant verifies that the list is complete and correctly ordered.
:::

The loop source is always written with `this.` (`this.balances`, `this.balances.entries`). The visibility may come
before `enumerable` or after the mapping type, so `public enumerable mapping(bytes20 => int) balances;` also parses.

Entry NFTs store a hash of each key, not the key itself. Before a key or entry loop runs, pass the encoded keys to
the SDK with `sc.setIterationKeys('balances', [key1, key2])`. Key and entry loops support single-key mappings only.
Iteration cost grows with the number of entries, so do not iterate a mapping that an attacker can grow.

A values loop can instead walk a bounded page per call, resuming from a `bytes32` cursor state variable:
`for (int balance of this.balances.window(cursor, 10))`. See
[Windowed iteration](./verified-mappings.md#windowed-iteration).

## Dynamic Arrays

Unbounded state arrays whose elements are chunk-packable are dense, length-tracked values backed by a data-NFT
length header and chunk NFTs. This is the default for bounded integers, fixed bytes, strings, bytes, addresses,
fixed- or variable-width structs, and supported nested arrays. They support push, pop, index access, iteration,
and swap-with-last deletion. `.length` is a `bigint` natively and a `uint256` under `evmCompat`.

Each chunk NFT holds up to 120 bytes of the encoded array. A read or write handles the whole chunk run, so its cost
grows with the array, and the decoded array must fit the 10,000-byte stack-item limit.

```solidity
contract TodoList() {
    string[] public items;

    function addItem(string item) {
        this.items.push(item);
    }

    function removeItem(int index) {
        this.items.delete(index);
    }

    function removeLast() {
        this.items.pop();
    }

    function updateItem(int index, string newItem) {
        this.items[index] = newItem;
    }
}
```

### Packed Arrays

The `packed` modifier stores the entire array as one inline data-NFT blob:

```solidity
int[] packed public scores;
```

:::caution
An inline packed array must fit the data NFT's 128-byte commitment budget together with its framing and any sibling
fields. Prefer the default chunk-packed `T[]` for a collection that must grow beyond that bound.
:::

Native bounded non-packed arrays (`uint256[1000] slots;`), and any form ineligible for the dense backend, are
represented as entry-NFT collections. They are sparse, mapping-like collections rather than length-tracked blobs,
with no `.length`, `.push()` or `.pop()`. The `chunkedArrays: false` compiler option sends otherwise eligible
unbounded arrays to this collection backend too. Under `evmCompat`, a bounded `T[N]` is instead one packed field, or
a chunk-packed value when it does not fit one commitment. Backend selection and operation support are described in
[Arrays](./arrays.md); both physical chunk formats are described in
[State Storage & Data Encoding](./storage-model.md#dense-array-backends).

## Token Containers

Token containers manage native CashToken fungible tokens (FTs) and NFTs held by a stateful contract. Each held
category gets a deterministic covenant address bound to the contract's category.

### Token Container Properties

`this.tokens[category]` exposes `.tokenAmount` (the fungible amount in the container inputs) and `.nftCount`, both
`bigint`, plus `.tokenCategory` and `.nftCommitment` of the routed container input. Output aggregates are available
through `this.outState.tokens[category].tokenAmount` and `this.outState.tokens[category].nftCount`.

### Token Container Methods

`.transfer(lockingBytecode, amount)` sends fungible tokens, and `.transferNft(lockingBytecode, commitment, capability)`
sends an NFT (capability `0` immutable, `1` mutable, `2` minting), each by enforcing the matching transaction output.

```solidity
contract Vault() {
    int withdrawals;

    function withdrawFT(bytes32 tokenCategory, bytes20 recipient, int amount) public {
        require(this.tokens[tokenCategory].tokenAmount >= amount);
        this.tokens[tokenCategory].transfer(
            new LockingBytecodeP2PKH(recipient), amount
        );
        this.withdrawals += 1;
    }

    function withdrawNFT(bytes32 nftCategory, bytes20 recipient, bytes commitment) public {
        this.tokens[nftCategory].transferNft(
            new LockingBytecodeP2PKH(recipient), commitment, 0
        );
        this.withdrawals += 1;
    }
}
```

To deposit tokens, add the token input to the call in the SDK and declare the amount with
`.tokenContainerDeposit(category, amount)`; the called function must use `this.tokens[category]`. Category-key
rules, covenant preservation, deposits, SDK access, auto-derived outputs, and the current multiple-UTXO limitation
are covered in the dedicated [Token Containers](./token-containers.md) reference.

## Satoshi Container

The satoshi container manages the contract's native BCH balance.

```solidity
contract Treasury(pubkey admin) {
    int counter;

    function sendFunds(sig s, bytes20 recipient, int amount) {
        require(checkSig(s, admin));
        this.transfer(new LockingBytecodeP2PKH(recipient), amount);
        this.counter = this.counter + 1;
    }
}
```

Read the container in the same transaction with `this.balance` and `this.outState.balance`:

```solidity
require(this.balance >= amount);           // satoshi-container inputs of this transaction
require(this.outState.balance >= floor);   // satoshi-container outputs of this transaction
payable(to).transfer(amount);              // the same payment as this.transfer(to, amount)
```

- `this.balance` is the satoshi container's value in this transaction's inputs. `addr.balance`, including
  `address(this).balance`, is something else: it sums this transaction's inputs locked to `addr`. Neither is a
  chain-wide balance.
- `msg.value` is the net change of the satoshi container in this call (outputs minus inputs). It is a `bigint`
  natively and a `uint256` under `evmCompat`. `payable` does not restrict it.

Deploy with an initial balance using the SDK:

```typescript
const { contract } = await StatefulContract.deploy(
    artifact,
    constructorArgs,
    {
        provider,
        fundingUtxo,
        funder,
        changeAddress,
        initialBalance: 50_000n,  // 50,000 satoshis in satoshi container
    },
);
```

## Partial Struct Field Updates

When a struct is stored in a mapping, individual fields can be updated without rewriting the entire struct:

```solidity
struct User {
    bytes20 addr;
    string name;
    int balance;
}

contract Registry() {
    mapping(bytes20 => User) public users;

    function updateName(bytes20 key, string newName) {
        this.users[key].name = newName;  // only updates name field
    }
}
```

## How State Storage Works

Under the hood, stateful contracts use CashToken NFTs to store state:

| NFT Type | Purpose | Capability |
|----------|---------|------------|
| **Master NFT** | Contract identity and control | `minting` |
| **Data NFTs** | State variable values (128 bytes each) | `mutable` |
| **Entry NFTs** | Verified mapping nodes: key slot, next link, and value (one per key) | `mutable` |
| **Chunk NFTs** | Dynamic strings, bytes and arrays (120-byte chunks); large mapping values (126-byte chunks) | `mutable` |
| **Event NFTs** | Emitted event records | `none` |
| **Return-event NFTs** | Authenticated cross-contract return values | `none` |
| **Token containers** | Native FT/NFT custody per held category | Depends on the held token; an NFT is optional |
| **Satoshi Container** | BCH balance (plain UTXO) | N/A |

A data NFT commitment holds up to 128 bytes of fields. A dynamic value keeps its `uint32` byte length in a data NFT
and its bytes in chunk NFTs of up to 120 bytes each. A mapping entry stores a fixed-width value of up to 64 bytes or
a variable-width value of up to 60 bytes inline; a longer value keeps its length, a SHA-256 root and its first 28
bytes in the entry and the rest in 126-byte continuation chunks.

Every state-modifying transaction consumes these NFTs as inputs and produces updated versions as outputs. The contract bytecode verifies that output commitments match the expected new state - this is the **covenant** mechanism that makes stateful contracts trustless.

:::tip
The SDK handles all NFT management automatically via **auto-derivation**: it runs the contract bytecode in a local VM, discovers which state changes are needed, and constructs the full transaction including all covenant outputs.
:::

For the exact commitment codec, vmap absence proofs, chunk layouts, and UTXO lifetimes, see
[State Storage & Data Encoding](./storage-model.md).
