---
title: Contract Creation & Lifecycle
---

A Bitcoin Cash contract is a set of UTXOs rather than an account, so creating, upgrading and destroying one
means minting, re-minting and burning those UTXOs. SolidCash exposes this through familiar Solidity syntax:
`new Contract(...)`, `selfdestruct(...)`, and a small set of covenant-control modifiers.

## Creating a contract with `new`

A stateful contract can mint a child contract with `new`:

```solidity
pragma solidcash ^0.51.0;

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
Writing `deploy` is optional. The compiler infers it from the deploy form itself: a `new C(...)` of a stateful
contract (one with state variables, mappings, or arrays), or a factory that reads a genesis input's outpoint. An
explicit argument-free `deploy` in modifier position marks the function the same way; `deploy` stays an ordinary
name elsewhere, so a function may still be called `deploy`.
:::

`new` of a stateful child must appear inside a function, and the contract that deploys it becomes stateful. A
deploy function must be externally callable and cannot be combined with `pure`, `view`,
`unsafe`, `upgrade`, `selfdestruct`, `split`, or `merge`.

:::note
In a direct creator, which is the default convention, `new` of a stateful child is a **deployer `new`**. It spends
a one-shot coin of the child's generated `Deploy<C>` program, and that program runs the child's constructor on chain.
See [Proof of birth](#proof-of-birth-deploying-through-deployc). Some rules below differ between the two paths, and
each section says where:
- `salt`;
- a call on the new child in the same function;
- the folding of the child's constructor.

Message-bus and framed creators keep the older genesis that this page describes.
:::

:::danger
A deploy entry needs an unconditional `require(checkSig(s, key))` where the caller cannot choose `key`: a
constructor argument, a state variable, or a constant. A direct compile rejects a deploy, `upgrade`, `split`, or
`merge` function without one (`UnauthorizedLifecycleError`). `allowUnsafeOperations` turns the error into a
warning for an intentionally permissionless entry.
:::

### Deterministic addresses with `salt`

The `salt` call option is the BCH analogue of the EVM's `CREATE2`. `new C{salt: s}(...)` adds `s` to the
child's redeem script as a `<s> OP_DROP` prefix, so the same code and constructor arguments give a different,
deterministic address for each salt. EVM `CREATE2` address math does not apply. A stateful child's address also
commits to its category, which comes from the funding outpoint.

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

The SDK reads a salt that the deploy function forwards from one of its parameters, or a literal salt. For a
computed salt, pass `childSalt` to `StatefulContract.deployFrom()`.

A deployer `new` refuses `salt`. The child's redeem script starts with its category pin, so its address already
depends on its deployer coin. The example above compiles for a message-bus or framed creator, for example one
compiled with `messageBus: true`. `salt` also works on the `new` of a stateless child.

### Funding the child with `value`

`new C{value: v}(...)` pays `v` satoshis to the child's address in the deploy transaction. The value comes from the
factory's satoshi container, so the factory must hold at least `v` there; a contract that deploys with a value is
stateful. If the child declares a `constructor` body, it must be `payable` to receive a deploy value.

```solidity
contract Child(pubkey owner) {
    int counter;
    function bump() public { this.counter += 1; }
}

contract FundingFactory(pubkey admin) {
    int created;

    function createFunded(sig s, int amount) public {
        require(checkSig(s, admin));
        new Child{value: amount}(admin);
        this.created += 1;
    }
}
```

With the SDK, pass the amount as `childValue` in the deploy options.

On a deployer `new`, `value` moves `v` from the factory's satoshi container into the child's satoshi container
before the child's constructor runs. `msg.value` is `v` there, and `v` must be 0 or at least RESERVE. The child
must keep a satoshi container. The SDK reads the value from the factory's run; a `childValue`, when given, must
equal it.

### Conditional and looped deploys

A deploy inside an `if` branch, a loop, or a bare block compiles: the compiler verifies the deploy inline at
the site and, where needed, threads a runtime deploy counter. Multiple deploy sites for the same child
contract in one function are supported.

The deploy sites in one function must use one child contract shape so their genesis groups have a derivable
stride. A heterogeneous multi-site function fails closed with `ConditionalDeployError`. A single conditional
`new Child{value: amount}(...)` is supported; a `{value: ...}` deploy in a function with several deploy sites, or
another value-deploy shape the published layout cannot represent, also fails with `ConditionalDeployError` instead
of emitting a partially checked covenant.

A loop deploy mints one child per iteration, and each child needs its own funding input at `vout: 0`; pass them as
`fundingUtxos` to `deployFrom()`. A conditional deploy whose branch is not taken is an ordinary call: `.send()` on
the pending call sends it without minting a child.

Through deployers each child's category is its own prep transaction's txid, so no funding input needs to sit at
`vout: 0`. The SDK learns from the factory's run how many children are created, in which order and with which
arguments. It then builds one prep per child, as a chain, before the creation: from the connected signer, or from
`prepFunding`. A creating call that creates a different number of children than `deployments` says is refused.
Different child contracts in the branches of one direct function are refused; use a message-bus creator for that.

### Deploy and configure in one transaction

A newly created child is an output, so it cannot also be spent as an input in the same BCH transaction. A
message-bus or framed creator supports the common Solidity `new C(); c.initialize(...)` shape by **folding** a
supported initializer into the child's genesis commitment. Under automatic selection a creator that calls its new
child compiles on the message bus. A direct creator refuses any call on a child its deployer `new` creates in the
same function, with `DeployedChildCallError`: pass the values as constructor arguments, which the constructor
runs on chain, or call the child in a later transaction. The fold:

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

The child's own constructor folds the same way. A child whose constructor does not fold cannot be created with `new`:
the factory checks the child's genesis against the folded constructor, so it could not check the state that
constructor produces (see [A child's constructor](#a-childs-constructor) for the errors). Assign those fields with
straight-line expressions of constants and constructor arguments, for example a precomputed constant in place of a
value a loop builds.

:::danger
`require(...)` statements inside a folded child initializer are not executed. Put every authorization and input
guard in the factory before `new`/the folded call, as in the example. The initializer's assignments are still
verified by the factory covenant.
:::

### A child's constructor

A direct factory's deployer `new` runs the child's constructor on chain, in `Deploy<C>`. The constructor may emit,
make payments, take `value`, read block fields and make calls:
- block fields come from the transaction's locktime, which is a lower bound;
- `msg.sender` is the factory;
- a call goes to a callee compiled as a direct contract with `genesisCalls` (the default), whose call record proves
  the call.

See [Proof of birth](#proof-of-birth-deploying-through-deployc).

A message-bus or framed factory does not run its child's constructor. It folds the constructor, state-variable
initializers included, into its own covenant, which then verifies the child's first state. Constructor arguments,
straight-line locals and writes fold, and so does a `require` over them, which the creating call enforces.

A statement the fold cannot express is refused with `ChildGenesisFoldError`, naming the child and the statement, so a
guard or a write is never dropped. A constructor whose fold fails without one such statement is refused with
`UnfoldableChildConstructorError`. That covers a write or `require` that reads `tx.*`, `msg.value`, the child's own
state or a signature, a branch the fold cannot join, an `emit`, a transfer, a nested `new`, and any `block.*` or
`blockhash` read. Compute the value in the factory and pass it as an argument, or set it in a later transaction. A
child that reads block data in its own later calls is unaffected. Framed creation replays a child's genesis under its
own rules.

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

State records are bound to the master's exact lock, so the upgrade carries them to the new bytecode: data NFTs
are re-minted unchanged, satoshi and token containers move with the master, and mapping or array entries move one
per transaction through a `migrateRecords` function. Keep the new state layout an extension of the old one; new
fields begin at their type defaults. Values kept in chunk NFTs do not migrate yet, and the SDK refuses an upgrade
that would strand one. The category remains stable while the physical contract address changes. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) for the migration, funding, identity, and SDK
rules.

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

Run either form with `StatefulContract.selfdestructTo(...)`, an alias of `StatefulContract.destroy(...)`.
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

The modifier argument names the integer parameter carrying the thread count. Like a deploy entry, `split` and
`merge` need an unconditional `require(checkSig(s, key))` with a key the caller cannot choose. See
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
```

For eligible state-mutating entry points, the compiler builds a **second artifact** that executes against the
calling proxy's state and emits it as `artifact.delegateArtifact`. Reach it from the SDK via
`contract.asDelegate()` or the proxy helpers.

The recommended `upgrades.deployProxy()` helper deploys a pinned implementation and the built-in proxy together:

```ts
import { getContractFactory } from '@solidcash/solidcash/contract-factory';
import { upgrades } from '@solidcash/solidcash/stateful';

const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), { counter: 0n });
await proxy.increment().send();   // runs Impl.increment against the proxy's state
```

The built-in proxy does not expose a mutable implementation pointer. A custom proxy that forwards with its own
`delegatecall` is experimental; see [Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) before
choosing or designing one.

:::note
New code does not need a `delegate` modifier: delegate mode is inferred and published as a second artifact.
The parser still accepts the legacy explicit modifier during migration, but ordinary `public`/`external`
implementation functions are the supported forward-looking form.
:::

:::caution
A function is not eligible for the inferred delegate build if it uses `unsafe`, `upgrade`, `deploy`,
`selfdestruct`, `split`, `merge`, `view`, `pure`, `internal` or `private`, or if it issues its own delegatecall.
Transfers and token-container operations are also currently ineligible.
:::

### Layout compatibility

The proxy and the implementation must agree on state layout: the implementation's fields must appear at the
same slots, with the same names and types. This is checked at compile time when both are in one compilation,
and again by the SDK at build time.

## Lifecycle modifier compatibility

All lifecycle modifiers need a stateful contract (for example one with state variables, mappings, or events), and
every lifecycle function must be externally callable (not `internal` or `private`). Not all can be combined:

| Modifier | Cannot be combined with |
| --- | --- |
| `deploy` | `unsafe`, `pure`, `view`, `upgrade`, `selfdestruct`, `split`, `merge` |
| `upgrade` | `unsafe`, `pure`, `view`, `deploy`, `selfdestruct`, `split`, `merge`, `migrateRecords` |
| `migrateRecords` | `unsafe`, `pure`, `view`, `upgrade`, `selfdestruct` |
| `selfdestruct` | `unsafe`, `pure`, `view`, `deploy`, `upgrade`, `split`, `merge`, `migrateRecords` |
| `split` / `merge` | each other, `unsafe`, `pure`, `view`, `deploy`, `upgrade`, `selfdestruct` |

`pure` and `view` also exclude each other, as do `unsafe` and `pure` / `view`.

## See also

- [Function Modifiers](/docs/language/modifiers) - the full modifier reference
- [Stateful Contracts](/docs/language/stateful-contracts) - the state UTXO model
- [Deployment](/docs/guides/deployment) - deploying from the SDK
- [Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) - native migration and proxy security
- [Contract Destruction](/docs/language/selfdestruct) - destination, fee, authorization, and batching rules
- [Libraries & Using-For](/docs/language/libraries#deployed-delegate-libraries) - deployed delegate libraries

## Proof of birth: deploying through `Deploy<C>`

A stateful contract compiled with `deployer: true` carries a one-shot **`Deploy<C>`** program. When its artifact
has one, the SDK deploys the instance through it, and the instance has a **proof of birth**: its category was
created by spending the deployer coin at output 0 of a prep transaction, and that coin's program checked the
constructor's outputs and calls. An artifact from a plain compile has no deployer and its top-level deployment
is today's genesis, silently.

- **The category** is the txid of the contract's own prep transaction, not `fundingUtxo.txid`. The funding
  coin only pays for the prep and need not sit at vout 0. Code that needs a category or address before a
  deployment builds the preps first and reads it from each result.
- **The constructor's `msg.sender`** is `tx.origin`, the deploying wallet, as in Solidity. `block.number` and
  `block.timestamp` come from the transaction's locktime, a lower bound rather than the mined block.
- **Identity.** The creation keeps the category's identity output at output 0 as today's option says. It does
  not mint a logical-identity anchor: the census forbids one at birth.
- **Fallbacks.** A deployment that asks for anything the deployer does not build (an initial state the
  constructor does not produce, a salt, another address type, several master threads, a non-P2PKH funder)
  takes today's genesis with one warning, and has no proof of birth. `viaDeployer: true` turns the fallback
  into an error that names it.
- **Inside a creator**, `new C{args: (a1, a2), value: v}(c1, c2)` gives C's contract parameters in `args` and
  the constructor arguments in the parentheses. A `new` of a stateful direct child compiles to a deployer
  binding: the creator publishes its own category into the deployer's arguments, checks what the deployer
  received, and the child's constructor can read `msg.sender` as the creator. See
  [contract-creation.md in the compiler docs](https://github.com/solidcash/solidcash/blob/master/packages/solidc/docs/contract-creation.md)
  for the transaction tables and the full interface.
