---
title: Function Modifiers
---

SolidCash functions support a rich set of modifiers that control visibility, state access, and lifecycle behavior.

## Custom Modifiers

Custom modifiers encapsulate reusable validation logic. The `_` (underscore) placeholder marks where the function body is inserted.

```solidity
contract Token(pubkey owner) {
    modifier onlyOwner(sig s) {
        require(checkSig(s, owner));
        _;
    }

    modifier minAmount(int amount, int minimum) {
        require(amount >= minimum);
        _;
    }

    function transfer(bytes20 to, int amount, sig s)
        onlyOwner(s) minAmount(amount, 1)
    {
        // This body replaces _ in each modifier
        // Execution order: onlyOwner check -> minAmount check -> body
    }
}
```

### Multiple Placeholders

Unlike Solidity (which supports only one `_`), SolidCash allows multiple placeholders in a single modifier:

```solidity
modifier logged(string label) {
    console.log("Before:", label);
    _;
    console.log("After:", label);
    _;  // body can execute multiple times
}
```

### Modifier Parameters

Modifiers accept parameters just like functions. Use different parameter names than the function to avoid `VariableRedefinitionError`:

```solidity
contract Fees(pubkey owner) {
    int handled;

    modifier onlyOwner(sig ownerSig) {
        require(checkSig(ownerSig, owner));
        _;
    }

    modifier charged(int fee) {
        require(msg.value >= fee);
        _;
    }

    function doSomething(int amount, sig s) public charged(100) onlyOwner(s) {
        require(amount > 0);
        this.handled += 1;
    }
}
```

## Visibility Modifiers

| Modifier | Scope |
|----------|-------|
| `external` | Only callable from outside via function selector |
| `public` | Callable from anywhere; generates selector |
| `internal` | Callable within contract and inheriting contracts |
| `private` | Callable only within the declaring contract |

```solidity
contract Example() {
    function publicFunc() public { }        // anyone can call
    function externalFunc() external { }    // only from outside
    function helper() internal { }          // this + children
    function secret() private { }           // this only
}
```

:::note
`public` and `external` functions become unlock paths in the redeem script, dispatched by a 4-byte selector
(sha256-based by default; real keccak256 under the `evmCompat` option). `internal` and `private` functions are
not unlock paths: they compile to reusable subroutines via the BCH 2026 VM's `OP_DEFINE` / `OP_INVOKE`, or are
inlined where that is cheaper.
:::

## State Access Modifiers

| Modifier | Meaning |
|----------|---------|
| `pure` | Declares no state access |
| `view` | Declares read-only state access |
| `payable` | Function can receive BCH; enables `msg.value` |

:::caution
`pure` and `view` are **accepted but not enforced**. Unlike solc, the compiler does not currently reject a
`view` function that writes state. Treat them as documentation and as porting affordances, not guarantees.
:::

```solidity
contract Example() {
    int counter;

    function compute(int a, int b) internal pure returns (int) {
        return a + b;              // no state access
    }

    function getCounter() public view returns (int) {
        return this.counter;       // read-only
    }

    receive() external payable {
        // accept BCH
    }
}
```

## Inheritance Modifiers

| Modifier | Meaning |
|----------|---------|
| `virtual` | Function can be overridden by child contracts |
| `override` | Overrides a parent contract's function |

```solidity
contract Base() {
    function foo() virtual { require(true); }
}

contract Child() is Base {
    function foo() override { require(1 == 1); }
}
```

## Lifecycle Modifiers

These modifiers control the lifecycle of **stateful contracts**. They require the contract to have state variables.

### Inferred `deploy`

A function that mints a child stateful contract is a deploy function. This is **inferred** from the deploy
form itself, so there is no keyword to write:

```solidity
contract Child(pubkey owner) {
    int counter;
    function bump() public { this.counter += 1; }
}

contract Factory(pubkey admin) {
    int created;

    function createChild(sig s) public {
        require(checkSig(s, admin));
        new Child(admin);
        this.created += 1;
    }
}
```

The resulting ABI entry carries the `deploy` modifier.

:::caution
`deploy` was removed from the grammar. Writing it explicitly is now an "undefined modifier" error. See
[Contract Creation & Lifecycle](/docs/language/contract-creation).
:::

### `upgrade`

Deploys a new version of the contract code while preserving the category ID and state:

```solidity
contract TokenV1(pubkey admin) {
    int counter;

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
```

State layout can be extended in the new version (append new fields). Existing state values are preserved.

### `selfdestruct`

Permanently destroys the contract by burning all NFTs and returning satoshis:

```solidity
contract Killable(pubkey admin) {
    int counter;

    function destroy(sig s) selfdestruct {
        require(checkSig(s, admin));
    }
}
```

:::caution
Selfdestruct is irreversible. All state, entries, and token containers are permanently lost.
:::

### `split`

Creates N parallel contract instances (threads) from a single master:

```solidity
contract Parallel(pubkey admin) {
    int counter;

    function fork(int n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }
}
```

The `split` modifier takes a parameter name that specifies the thread count.

### `merge`

Consolidates N threads back into a single master:

```solidity
contract Parallel(pubkey admin) {
    int counter;

    function join(int n, sig s) merge(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }
}
```

### Inferred delegate mode

Proxy implementations use ordinary Solidity syntax. For eligible state-mutating entry points, the compiler emits
a second artifact that executes in the calling proxy's state context:

```solidity
contract Implementation() {
    int counter;

    function increment() public {
        this.counter = this.counter + 1;
        // `this` refers to the proxy's state, not the implementation's
    }
}
```

Access the inferred build through `artifact.delegateArtifact`, `contract.asDelegate()`, or the SDK proxy helpers.
`delegate` is not a source-level modifier.

### `unsafe`

Allows unrestricted transaction introspection. Three tiers are available:

```solidity
function authorize(pubkey pk, sig s) unsafe {
    // unsafe(0): full access to all inputs/outputs
    require(checkSig(s, pk));
}

function limitedAccess() unsafe(1) {
    // Tier 1: cannot read contract state variables
}

function readOnlyNft() unsafe(2) {
    // Tier 2: cannot write NFTs
}
```

## Modifier Compatibility

Not all modifiers can be combined. The compiler enforces these rules:

| Combination | Allowed? |
|-------------|----------|
| `pure` + `view` | No |
| `unsafe` + `pure` / `view` | No |
| `internal` + `external` | No |
| `upgrade` + `unsafe` | No |
| `upgrade` + `selfdestruct` | No |
| `upgrade` + inferred `deploy` | No |
| inferred `deploy` + `unsafe` | No |
| `selfdestruct` + `unsafe` | No |
| `selfdestruct` + inferred `deploy` | No |
| `split` + `merge` | No |
| `split` + `unsafe` | No |
| `split` + `upgrade` | No |
| `split` + `selfdestruct` | No |
| `split` + `deploy` | No |
| `merge` + `unsafe` | No |
| `merge` + `upgrade` | No |
| `merge` + `selfdestruct` | No |
| `merge` + `deploy` | No |

All lifecycle modifiers (`deploy`, `upgrade`, `selfdestruct`, `split`, `merge`) require the contract to have state
variables. Inferred delegate mode additionally requires an externally callable function that mutates proxy-owned
state and uses none of the incompatible lifecycle or mutability modes.

## Fallback & Receive

Two special functions handle unmatched calls:

```solidity
contract Flexible(bytes20 admin) {
    // Handles calls with unknown function selectors
    fallback(bytes input) external {
        // `input` contains the raw calldata
    }

    // Handles BCH transfers with no data
    receive() external payable {
        // accept value
    }
}
```

- `fallback`: at most one per contract; receives raw calldata as `bytes`
- `receive`: at most one per contract; must be `external payable`; no parameters
- Both support `virtual`/`override` for inheritance
