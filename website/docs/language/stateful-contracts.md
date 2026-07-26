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
| `public` | Readable from external contracts; auto-generates a getter |
| `internal` | Accessible within the contract and inheriting contracts |
| `private` | Accessible only within the declaring contract |

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

- `constant` - value fixed at compile time; cannot reference runtime values.
- `immutable` - assigned once in the constructor; read-only in all other functions.

## State Variable Assignment

State variables are accessed and modified using the `this.` prefix.

```solidity
function increment() {
    this.counter = this.counter + 1;
    this.owner = hash160(bytes(msg.sender));
}
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

:::caution
Mappings and token containers cannot be accessed in the constructor because no UTXO commitment exists yet at deployment time.
:::

## Mappings

Mappings are key-value stores backed by **entry NFTs** - one NFT per key.

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
delete this.balances[account];
```

This removes the entry NFT for the given key.

## Mapping Iteration

As in Solidity, a mapping is **not iterable** by default. Declaring it `enumerable` opts into iteration,
which SolidCash supports in three modes:

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
Mapping iteration is compiled to entry NFT enumeration. All entry NFTs for the mapping are included as transaction inputs and iterated at script execution time.
:::

## Dynamic Arrays

State arrays support push, pop, index access, and deletion.

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

For fixed-width element types, the `packed` modifier stores the entire array as a single blob for better space efficiency:

```solidity
int[] packed public scores;
```

:::note
Packed arrays are only supported for types with a known fixed byte width (e.g., `int8`, `uint32`, `bytes20`). Variable-width types like `string` or `bytes` cannot be packed.
:::

## Token Containers

Token containers manage CashToken fungible tokens (FTs) and NFTs held by the contract. They are only
available on stateful contracts, so the contract needs at least one state variable.

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

### Token Container Properties

| Property | Type | Description |
|----------|------|-------------|
| `.tokenAmount` | `int` | Fungible token balance |
| `.tokenCategory` | `bytes32` | Token category ID |
| `.nftCommitment` | `bytes` | NFT commitment data |

### Token Container Methods

| Method | Description |
|--------|-------------|
| `.transfer(lockingBytecode, amount)` | Send fungible tokens to a recipient |
| `.transferNft(lockingBytecode, commitment, capability)` | Send an NFT to a recipient. `capability` is `0` (none), `1` (mutable) or `2` (minting) |

:::note
Token container keys (`bytes32 tokenCategory`) must be function parameters, not arbitrary expressions. This ensures the covenant can verify the category at compile time.
:::

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

Deploy with an initial balance using the SDK:

```typescript
const { contract } = await StatefulContract.deploy({
    // ...
    initialBalance: 50_000n,  // 50,000 satoshis in satoshi container
});
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
| **Entry NFTs** | Mapping key-value pairs (one per key) | `mutable` |
| **Event NFTs** | Emitted event records | `mutable` |
| **Token Container NFTs** | FT/NFT balances per category | `mutable` |
| **Satoshi Container** | BCH balance (plain UTXO) | N/A |

Every state-modifying transaction consumes these NFTs as inputs and produces updated versions as outputs. The contract bytecode verifies that output commitments match the expected new state - this is the **covenant** mechanism that makes stateful contracts trustless.

:::tip
The SDK handles all NFT management automatically via **auto-derivation**: it runs the contract bytecode in a local VM, discovers which state changes are needed, and constructs the full transaction including all covenant outputs.
:::
