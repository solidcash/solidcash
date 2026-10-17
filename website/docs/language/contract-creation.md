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

The deploy sites in one function must use one child contract shape so their genesis groups have a derivable
stride. A heterogeneous multi-site function fails closed with `ConditionalDeployError`. A conditional
`new Child{value: amount}(...)` is supported; when a loop or multi-site value-deploy shape cannot be represented
by the published layout, compilation likewise fails instead of emitting a partially checked covenant.

### Deploy and configure in one transaction

A newly created child is an output, so it cannot also be spent as an input in the same BCH transaction. SolidCash
supports the common Solidity `new C(); c.initialize(...)` shape by **folding** a supported initializer into the
child's genesis commitment:

```solidity
contract Child() {
    int supply;
    address owner;

    function initialize(int amount, address initialOwner) external {
        int doubled = amount * 2;
        this.supply = doubled;
        this.owner = initialOwner;
    }
}

contract Factory(pubkey admin) {
    int created;

    function create(sig authorization, int amount, address owner) public {
        require(checkSig(authorization, admin));
        Child child = new Child();
        child.initialize(amount, owner);
        this.created += 1;
    }
}
```

The child is born directly in its post-`initialize` state. No child co-spend or intermediate default-state output
exists. Straight-line local declarations, local reassignment, scalar state assignment, pure operators, casts,
ternaries, array indexing, default/prior field reads, and an optional single return value are foldable. Multiple
folded calls to the same child are applied in source order. The SDK derives the covenant-computed child commitment
while building `deployFrom()`.

Control flow, mapping writes, ordinary function calls, external calls, events, transaction/block introspection,
and nested deployment are not foldable. The compiler fails with `DeployThenCallError`; deploy first and call the
child in a later transaction.

:::danger
`require(...)` statements inside a folded child initializer are not executed. Put every authorization and input
guard in the factory before `new`/the folded call, as in the example. The initializer's assignments are still
verified by the factory covenant.
:::

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
id:

```solidity
contract PolicyV1(pubkey admin) {
    event Approved(int amount);

    function approve(int amount, sig s) public {
        require(amount <= 1000);
        require(checkSig(s, admin));
        emit Approved(amount);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
```

Only a contract whose whole state lives in its master NFT can upgrade in place. State variables, mapping and
array entries, and satoshi or token containers are bound to the master's exact lock and could not follow it to
the new bytecode, so the compiler refuses `upgrade` in a contract that keeps any of them. Evolve such a contract
behind a proxy instead. The new version may declare state, which begins at its type defaults. The category remains
stable while the physical contract address changes. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) for the funding, identity, and SDK rules.

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

The expression form implies the modifier on the enclosing function. It also covenants the transaction to exactly
one output at `to` and a fee below 2,000 satoshis. The modifier-only form has no equivalent recipient pin.

:::caution
Selfdestruct is irreversible. State UTXOs are consumed; CashTokens are not automatically transferred and can be
stranded or burned if the contract does not sweep them first. A `selfdestruct` function with no `require()` is a
hard compile error, and caller-controlled destinations require recognizable non-caller-controlled authorization.
:::

Destination pins, the compiler's authorization heuristic, the single-transaction limit, event cleanup, and the
SDK driver are covered in [Contract Destruction](./selfdestruct.md).

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

The recommended `upgrades.deployProxy()` helper deploys a pinned implementation and proxy together. Its built-in
proxy does not expose a mutable implementation pointer; see
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) before choosing or designing a custom proxy.

:::note
New code does not need a `delegate` modifier: delegate mode is inferred and published as a second artifact.
The parser still accepts the legacy explicit modifier during migration, but ordinary `public`/`external`
implementation functions are the supported forward-looking form.
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
- [Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) - native migration and proxy security
- [Contract Destruction](/docs/language/selfdestruct) - destination, fee, authorization, and batching rules
- [Libraries & Using-For](/docs/language/libraries#deployed-delegate-libraries) - deployed delegate libraries
