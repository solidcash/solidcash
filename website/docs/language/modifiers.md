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

Modifiers are inlined at compile time; there is no call frame. Invocations apply left to right, code after `_`
runs after the body, and a modifier without parameters may omit the parameter list (`modifier timelocked { ... }`).
Modifiers take `virtual` and `override`, a bodyless `modifier hook() virtual;` is abstract, and modifiers also
apply to constructors.

### Multiple Placeholders

A modifier needs at least one `_`. As in Solidity, it may contain several, and each one inlines the function body
again:

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

A function without a visibility modifier is `public`.

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
| `payable` | Accepted for Solidity compatibility; does not gate value |

Native SolidCash and compatibility mode enforce the same effect checks: `pure` rejects contract-state and
environment reads, and both `pure` and `view` reject state/transient-state writes, contract creation,
low-level calls, and calls to less-restrictive functions.

`payable` does not decide who can send value: every BCH address can receive it. Any function may read
`msg.value`, except a `view` public or external function and a constructor that is not `payable`. `internal`,
`private` and `pure` functions cannot be `payable`.

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

These modifiers control the lifecycle of **stateful contracts**. They are valid only in a stateful contract (one
that declares state variables, mappings, arrays or events) and only on externally callable functions, and none of
them combines with `pure` or `view`.

### Authorizing lifecycle entries

A `deploy`, `upgrade`, `split` or `merge` entry changes what the contract is. Its covenant checks the transition,
not who asked for it, so the body needs an unconditional `require(checkSig(s, key))` with a key the caller cannot
choose: a contract parameter, a state variable or a constant. Without one the compile fails with
`UnauthorizedLifecycleError`. A `selfdestruct` function needs a `require` too, and a recipient the caller chooses
needs a signature by such a key (`UnauthenticatedSelfdestructError`). Guard a `migrateRecords` entry the same way.

The `allowUnsafeOperations` compiler option turns these errors into warnings. Keep it off unless a permissionless
lifecycle change is intended.

### Inferred `deploy`

A function that mints a child stateful contract is a deploy function. This is **inferred** from the deploy
form itself, so the `deploy` keyword is optional:

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

The resulting ABI entry carries the `deploy` modifier. Writing it explicitly
(`function createChild(sig s) deploy { ... }`) still parses and has the same effect. Deploy sites in branches or
loops must create the same child, and the transaction that creates a child cannot call it beyond a folded
initializer. See [Contract Creation & Lifecycle](/docs/language/contract-creation).

### `upgrade`

Moves the contract's master NFT to a new version of the contract code while preserving the category ID. The
address changes:

```solidity
contract LedgerV1(pubkey admin) {
    mapping(bytes20 => int) public balances;

    function set(sig s, bytes20 holder, int amount) {
        require(checkSig(s, admin));
        this.balances[holder] = amount;
    }

    function migrateEntry(sig s) migrateRecords {
        require(checkSig(s, admin));
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
```

The SDK chooses the replacement bytecode and a hidden witness binds it; the replacement's constructor body does
not run. State moves as follows:

- Data NFTs holding state variables are re-minted on the new bytecode with their values unchanged. Keep the new
  layout an extension of the old one: added fields start at their defaults.
- The satoshi container and token containers move with the master.
- Mapping and array entries move one per transaction through the `migrateRecords` entry, before the master moves.
- Values kept in chunk NFTs (dynamic `string`, `bytes` and array state, large mapping values) do not migrate yet;
  the SDK refuses an upgrade that would strand one.

An upgrade routed through the message bus (experimental) still refuses a contract that keeps state variables
(`UpgradeStrandsBoundStateError`). See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies#contracts-that-keep-state).

### `migrateRecords`

Marks the entry that moves mapping and array entries to the replacement bytecode during an upgrade. Declare one
when the contract keeps entries. `StatefulContract.upgrade` calls it once per entry before the upgrade itself,
passing your `migrateRecordsFunctionArgs` plus the replacement's lock as a hidden argument. It is valid only in a
stateful contract and cannot be combined with `upgrade`, `selfdestruct`, `unsafe`, `pure`, `view`, `internal` or
`private`.

### `selfdestruct`

Permanently destroys the contract by burning its master and state NFTs and releasing its satoshis. The statement
form pins the payout to a recipient:

```solidity
contract Vault(pubkey admin, address beneficiary) {
    uint256 withdrawals;

    function destroy(sig authorization) public {
        require(checkSig(authorization, admin));
        selfdestruct(beneficiary);
    }
}
```

`selfdestruct(recipient);` requires a single output, paid to `recipient`, with a fee below 2,000 satoshis. It
must be a direct statement of the function body, not nested in a branch or loop, and it implies the modifier, so
do not write both. A bare `selfdestruct;` does nothing.

The modifier form burns the state without pinning a recipient:

```solidity
contract Killable(pubkey admin) {
    int counter;

    function destroy(sig s) selfdestruct {
        require(checkSig(s, admin));
    }
}
```

:::caution
Selfdestruct is irreversible. State and entry NFTs are burned. CashTokens are not assigned a recipient by the
modifier and can be stranded or burned unless the contract sweeps them deliberately. See
[Contract Destruction](/docs/language/selfdestruct#tokens-are-not-transferred).
:::

### `split`

Mints N more master NFTs (threads) next to the running one:

```solidity
contract Parallel(pubkey admin) {
    int counter;

    function fork(int n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }
}
```

The `split` modifier names an integer parameter that holds the thread count.

### `merge`

Burns N co-spent masters into the running one:

```solidity
contract Parallel(pubkey admin) {
    int counter;

    function join(int n, sig s) merge(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }
}
```

`split` and `merge` bodies follow the `unsafe(1)` restrictions below: they cannot write state, access entries,
emit events, move satoshis or tokens, call or read other contracts, or deploy children. Threads do not partition
mapping entries, chunks or containers. See [Contract Concurrency](/docs/guides/concurrency).

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
The built-in proxy profile (`upgrades.deployProxy`) is the stable route; custom delegate forwarding beyond it is
experimental. An explicit `delegate` modifier is a legacy form that still compiles; new code should not write it,
because ordinary `public`/`external` functions are how proxy implementation code is authored now.

### `unsafe`

Allows unrestricted transaction introspection. Three tiers are available:

```solidity
function authorize(pubkey pk, sig s) unsafe {
    // unsafe(0): full access to all inputs/outputs
    require(checkSig(s, pk));
}

function limitedAccess() unsafe(1) {
    // Tier 1: preserve the master NFT and minting uniqueness
}

function readOnlyNft() unsafe(2) {
    // Tier 2: tier 1 plus satoshi-value preservation
}
```

| Tier | Covenant protections retained |
| --- | --- |
| `unsafe` / `unsafe(0)` | None; the master may be lost or duplicated |
| `unsafe(1)` | Master category, capability, locking bytecode, and minting uniqueness |
| `unsafe(2)` | Tier 1 plus `input value <= output value` |

Tier 1 and 2 functions may read ordinary scalar state but cannot write state, access entries, emit events, move
satoshis/tokens, call or read other contracts, or deploy children. `unsafe` is valid only in stateful contracts and
combines with no lifecycle modifier, `pure` or `view`. Every tier is compiler-warned; prefer the normal covenant
unless the transaction shape genuinely cannot use it.

## Modifier Compatibility

Not all modifiers can be combined. The compiler enforces these rules:

| Combination | Allowed? |
|-------------|----------|
| The same modifier twice | No |
| Two visibility modifiers (for example `internal` + `external`) | No |
| `pure` + `view` | No |
| `pure` + `payable`, `internal` / `private` + `payable` | No |
| `unsafe` + `pure` / `view` | No |
| `unsafe` + any lifecycle modifier | No |
| Any lifecycle modifier + `pure` / `view` / `internal` / `private` | No |
| `upgrade` + `deploy` / `selfdestruct` / `migrateRecords` | No |
| `selfdestruct` + `deploy` / `migrateRecords` | No |
| `split` + `merge` | No |
| `split` / `merge` + `upgrade` / `selfdestruct` / `deploy` | No |

The lifecycle modifiers are `deploy` (written or inferred), `upgrade`, `migrateRecords`, `selfdestruct`, `split`
and `merge`. They and `unsafe` are valid only in stateful contracts. Inferred delegate mode additionally requires
an externally callable function that mutates proxy-owned state and uses none of the incompatible lifecycle or
mutability modes.

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
