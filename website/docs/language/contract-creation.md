---
title: Contract Creation & Lifecycle
---

A Bitcoin Cash contract is a set of UTXOs rather than an account, so creating, upgrading and destroying one
means minting, re-minting and burning those UTXOs. SolidCash exposes this through familiar Solidity syntax:
`new Contract(...)`, `selfdestruct(...)`, and a small set of covenant-control modifiers.

## Creating a contract with `new`

A stateful contract can mint a child contract with `new`:

```solidity
pragma solidcash ^0.13.0;

contract Child(pubkey owner) {
    int counter;

    function bump() public {
        this.counter += 1;
    }
}

contract Factory(pubkey admin) {
    int created;

    function create(sig s) public {
        require(checkSig(s, admin));
        new Child(admin);
        this.created += 1;
    }
}
```

The compiler **infers** that `create` is a deploy function: it mints the child's genesis UTXOs and registers
the child's outputs at a fixed transaction-layout slot. The resulting ABI entry carries the `deploy` modifier.

:::note
`deploy` is **not** a source-level keyword. It was removed from the grammar and is now inferred from the
deploy form itself, either a `new C(...)` expression or a factory that reads a genesis input's outpoint.
Writing `deploy` explicitly is an "undefined modifier" error.
:::

### Deterministic addresses with `salt`

The `salt` call option is the BCH analogue of the EVM's `CREATE2`: the child's address is derived
deterministically from the salt rather than from a consumed outpoint.

```solidity
contract Child(pubkey owner) {
    int counter;
    function bump() public { this.counter += 1; }
}

contract Factory(pubkey admin) {
    int created;

    function createDeterministic(sig s, bytes32 salt) public {
        require(checkSig(s, admin));
        new Child{salt: salt}(admin);
        this.created += 1;
    }
}
```

### Conditional and looped deploys

A deploy inside an `if` branch, a loop, or a bare block compiles: the compiler verifies the deploy inline at
the site and, where needed, threads a runtime deploy counter. Multiple deploy sites for the same child
contract in one function are supported.

### Reading a child's bytecode

`type(C).creationCode` returns the child contract's compiled redeem script, which lets a factory build a
child's address or output on chain. Bitcoin Cash has no creation/runtime code split, so `runtimeCode` is an
alias.

```solidity
contract Child(pubkey owner) {
    int counter;
    function bump() public { this.counter += 1; }
}

contract Factory(pubkey admin) {
    int created;

    function inspect(sig s) public {
        require(checkSig(s, admin));
        bytes code = type(Child).creationCode;
        require(code.length > 0);
        new Child(admin);
        this.created += 1;
    }
}
```

## Upgrading

The `upgrade` modifier allows a function to replace the contract's own bytecode while preserving its category
id and its state:

```solidity
contract TokenV1(pubkey admin) {
    int counter;

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
```

The state layout may be **extended** in the new version by appending fields; existing values are preserved.

:::caution
Whoever can satisfy the `upgrade` function controls the contract's future code. This is the same trust surface
as an EVM upgradeable proxy. Guard it accordingly.
:::

## Destroying

Both the modifier form and the Solidity expression form are supported.

```solidity
contract Killable(pubkey admin) {
    int counter;

    // Modifier form: burns all state NFTs and returns the satoshis.
    function destroy(sig s) selfdestruct {
        require(checkSig(s, admin));
    }

    // Expression form: forwards the contract's value to an address.
    function destroyTo(address to, sig s) public {
        require(checkSig(s, admin));
        selfdestruct(to);
    }
}
```

The expression form implies the modifier on the enclosing function.

:::caution
Selfdestruct is irreversible: all state, entries and token containers are permanently lost. A `selfdestruct`
function with no `require()` is a hard compile error, because it skips covenant codegen and would otherwise let
anyone trigger the destruction.
:::

## Splitting and merging

These modifiers have no EVM analogue. They exist because a UTXO can only be spent once, so a single contract
instance serializes all of its users. `split` forks a contract into parallel threads and `merge` consolidates
them again.

```solidity
contract Parallel(pubkey admin) {
    int counter;

    function fork(int n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function join(int n, sig s) merge(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }
}
```

The modifier argument names the parameter carrying the thread count. See
[Concurrency](/docs/guides/concurrency) and [Threading](/docs/sdk/threading).

## Proxy and delegatecall

The proxy pattern separates state (proxy) from logic (implementation), as in Solidity. Implementations are
written as ordinary contracts:

```solidity
contract Impl() {
    int counter;

    function increment() public {
        this.counter += 1;    // `this` is the PROXY's state at runtime
    }
}

contract Proxy(address impl) {
    int counter;

    fallback(bytes input) external {
        impl.delegatecall(input);
    }
}
```

For eligible state-mutating entry points, the compiler builds a **second artifact** that executes against the
calling proxy's state and emits it as `artifact.delegateArtifact`. Reach it from the SDK via
`contract.asDelegate()` or the proxy helpers.

:::note
`delegate` is not a source-level modifier. Like `deploy`, it is inferred. The inferred build is byte-identical
to what an explicit modifier produced before it was removed.
:::

:::caution
A function is not eligible for the inferred delegate build if it uses `unsafe`, `upgrade`, `selfdestruct`,
`split`, `merge`, `view`, `pure`, `internal` or `private`. Transfers and token-container operations are also
currently ineligible.
:::

### Layout compatibility

The proxy and the implementation must agree on state layout: the implementation's fields must appear at the
same slots, with the same names and types. This is checked at compile time when both are in one compilation,
and again by the SDK at build time.

## Lifecycle modifier compatibility

All lifecycle modifiers require the contract to have state variables. Not all can be combined:

| Combination | Allowed |
| --- | --- |
| `pure` + `view` | No |
| `unsafe` + `pure` / `view` | No |
| `internal` + `external` | No |
| `upgrade` + `unsafe` / `selfdestruct` | No |
| `selfdestruct` + `unsafe` | No |
| `split` + `merge` | No |
| `split` / `merge` + `unsafe` / `upgrade` / `selfdestruct` | No |

## See also

- [Function Modifiers](/docs/language/modifiers) - the full modifier reference
- [Stateful Contracts](/docs/language/stateful-contracts) - the state UTXO model
- [Deployment](/docs/guides/deployment) - deploying from the SDK
- [Libraries & Using-For](/docs/language/libraries#deployed-libraries) - deployed delegate libraries
