---
title: Upgrades, Proxies & Delegatecall
---

SolidCash supports two different code-evolution patterns. They preserve different identities and have different
transaction shapes:

| Pattern | State holder | What changes | Stable identifier |
| --- | --- | --- | --- |
| Native `upgrade` lifecycle | The master NFT; the old contract keeps no state records | The master NFT moves to new locking bytecode | CashToken category ID |
| Proxy + `delegatecall` | A proxy's data NFTs | A co-spent implementation authorizes proxy-state outputs | Proxy address, for that proxy deployment |

These are not interchangeable. Native upgrade is the simpler choice for a contract that keeps no state records,
when changing the physical contract address is acceptable. A contract that keeps state cannot upgrade in place. A
proxy keeps its own lock and records, and is useful when callers must continue targeting a state-holding proxy
address or when porting a Solidity proxy architecture.

## Native lifecycle upgrades

An `upgrade` function authorizes moving the contract's minting master NFT to new bytecode:

```solidity
contract PolicyV1(pubkey admin) {
    event Approved(int amount);

    function approve(int amount, sig s) public {
        require(amount <= 1000);
        require(checkSig(s, admin));
        emit Approved(amount);
    }

    function authorizeUpgrade(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
```

The compiler adds a hidden replacement-bytecode witness and verifies that the master output uses exactly the
replacement selected by the SDK. This binding still applies with permissive signature hash modes; a caller cannot
silently substitute different bytecode after satisfying the source-level authorization.

`upgrade` is valid only on externally callable stateful functions and cannot be combined with `pure`, `view`,
`internal`, `private`, `unsafe`, `selfdestruct`, `deploy`, `split`, or `merge` behavior.

:::danger
The source-level guard decides who controls future code. Use a constructor- or state-bound key, multi-signature
policy, or another non-caller-chosen authority. `require(checkSig(s, pk))` is not authorization if the caller also
chooses `pk`.
:::

### Contracts that keep state

Every state record is bound to the executing master's exact lock: the data NFTs holding state variables, mapping
and array entries, and satoshi or token containers. An in-place upgrade moves the master to the replacement
bytecode's lock, so those records could not follow it and could never be spent again. The compiler therefore
refuses an `upgrade` function in a contract that keeps any of them (`UpgradeStrandsBoundStateError`). Native
upgrade works for a contract whose whole state lives in its master NFT; declaring and emitting events, as
`PolicyV1` does, makes a contract stateful without keeping such records. Evolve a contract that keeps state behind
a proxy instead: a [custom proxy](#custom-proxies-and-manual-delegatecall) can select a new implementation while
keeping its own lock and records.

### State and identity after migration

The upgrade transaction:

1. spends the old master with the `upgrade` entry point;
2. recreates the same minting NFT category at the new contract's physical locking bytecode; and
3. mints the replacement's data NFTs at the replacement's lock when the new artifact declares state.

The category ID stays the same, but the physical P2SH address changes because the covenant bytecode or constructor
arguments changed.

### Adding state in the replacement

The replacement may declare state variables. Each begins with its type's default value and can be initialized in
a later function call. The new data-NFT outputs require a funding input for their 1,200 satoshis each. Those
records are bound to the replacement's lock, so a replacement that declares state cannot declare an `upgrade`
function of its own.

The `upgrade` body is the authorization path, not a general state-migration callback. Constructor arguments
construct the replacement locking bytecode; an explicit `constructor { ... }` state-initialization block is not
rerun.

### SDK migration

```ts
import { SignatureTemplate } from 'solidcash';
import { StatefulContract } from 'solidcash/stateful';

const result = await StatefulContract.upgrade({
  provider,
  oldContract: policyV1,
  upgradeFunctionName: 'authorizeUpgrade',
  upgradeFunctionArgs: [new SignatureTemplate(adminPrivateKey)],
  newArtifact: policyV2Artifact,
  newConstructorArgs: [adminPublicKey],
  fundingUtxo,
  funder: signer.unlockP2PKH(),
  changeAddress: signer.address,
  maxFee: 20_000n,
});

console.log(result.categoryId === policyV1.categoryId); // true
console.log(result.contract.address === policyV1.address); // normally false
await result.tx.wait();
```

`fundingUtxo` and `funder` are mandatory when the replacement declares state, because its data NFTs are new
outputs. Supplying them for ordinary real-network upgrades also keeps the miner fee separate from contract value.
Persist the new artifact, constructor arguments, physical address, and transaction ID beside the stable category.

Every record and container is bound to the master's exact lock, so a record left at the old lock is unspendable once
the master moves. The SDK lists every entry and container address before it sends anything and refuses the upgrade
while a genuine record would be left behind: more live containers than the covenant migrates, or a dynamic or value
chunk, which no upgrade path migrates yet. Coins someone else sent to a container address count as genuine when they
carry its category; name them in `leaveBehind` to abandon them, and `result.leftBehind` reports each one with its
value. Mapping entries migrate one per transaction, paid from `fundingUtxo`.

Artifacts compiled before the authenticated replacement-bytecode witness was added are rejected. Recompile the
old source with the current compiler before enabling its upgrade path.

## Proxy and implementation model

In the proxy model, the proxy owns the persistent state while an implementation is co-spent to authorize a state
transition. Bitcoin Cash does not execute another script in a shared storage frame: the implementation covenant
is a real transaction input whose delegate build reads and writes the proxy's category-branded NFTs.

```text
inputs                                      outputs
proxy master  ── proxy forwarder ────────▶ proxy master
proxy data    ───────────────────────────▶ proxy data with new commitments
implementation master ─ delegate logic ─▶ implementation master
```

Implementations use ordinary source syntax:

```solidity
contract CounterImplementation() {
    int public counter;

    function increment() public {
        this.counter = this.counter + 1;
    }
}
```

For eligible functions the compiler emits `artifact.delegateArtifact`. In that build, `this.counter` resolves to
the proxy's state through an injected proxy-master input index. New code uses ordinary `public`/`external`
functions; the parser only retains the legacy explicit `delegate` modifier as a migration compatibility form.

### Which functions receive a delegate build

An externally callable function is eligible when it mutates proxy-owned state, emits an event, or performs a
low-level call. It is excluded when it is `view`, `pure`, `internal`, `private`, `unsafe`, `upgrade`, `deploy`,
`selfdestruct`, `split`, or `merge`, or when it issues another delegatecall.

Value transfers and token-container operations are currently not supported in delegate mode. The exclusion also
follows internal helper calls, so an otherwise eligible entry point becomes ineligible if a helper performs one of
those operations. Typed calls that only mutate another contract do not by themselves make a function eligible.

The implementation must be selector-dispatched: the pinned proxy path requires a selector-leading unlocking
script, so use an implementation with at least two ABI functions.

## Recommended SDK proxy

`upgrades.deployProxy` deploys the compiler-generated delegate implementation, deploys a state-holding proxy, and
returns one handle that dispatches implementation method names:

```ts
import { getContractFactory } from 'solidcash/contract-factory';
import { upgrades } from 'solidcash/stateful';

const implementationFactory = getContractFactory(counterArtifact, signer);
const proxy = await upgrades.deployProxy(
  implementationFactory,
  { counter: 5n },
  {
    implementationOverrides: implementationDeployOptions,
    proxyOverrides: proxyDeployOptions,
  },
);

await proxy.waitForDeployment();
await proxy.increment().send();

console.log(proxy.address);          // stable state-holder address
console.log(proxy.proxy);            // deployed proxy contract
console.log(proxy.implementation);   // deployed delegate implementation
```

`proxy.forward('increment', [])` is the explicit form of `proxy.increment()`. `connect(runner)`, `getAddress()`,
`deploymentTransaction()`, and `waitForDeployment()` provide the expected contract-handle operations.

### Initial state and initializers

Native SolidCash initialization can seed proxy state directly at genesis:

```ts
await upgrades.deployProxy(factory, { counter: 5n });
await upgrades.deployProxy(factory, [5n], { initializer: false });
```

A positional array maps to state variables in declaration order when genesis seeding is forced. A named record is
safer when the source is authored for SolidCash.

For ports that define an eligible `initialize` function, the SDK auto-detects it, deploys default state, and sends
a second delegated initialization transaction:

```ts
const proxy = await upgrades.deployProxy(factory, [owner, 5n]);
const custom = await upgrades.deployProxy(factory, [owner, 5n], {
  initializer: 'initializeV1',
});
```

Set `initializer: false` to bypass auto-detection and seed at genesis. When an initializer runs, pass positional
arguments rather than a named state record.

### The default proxy is pinned

The built-in proxy bakes the implementation's physical locking bytecode into its constructor bytecode. The caller
cannot substitute a malicious delegate, and the proxy verifies both the co-spent implementation identity and the
forwarded selector.

This also means the built-in proxy has **no mutable implementation pointer**. `deployProxy` provides an
OpenZeppelin-like deployment and call surface, but this proxy cannot be upgraded in place. Changing its logic
requires deploying a new proxy and deliberately migrating state, or designing a custom authenticated proxy. There
is currently no `upgradeProxy` SDK operation.

The default proxy is layout-independent at the script level, but the SDK grafts the implementation layout onto
its artifact for state encoding and compatibility checks.

:::caution Verified mapping insertion
The default proxy conserves its own-category mutable-NFT count. Updating an existing vmap entry preserves that
count and is supported; inserting a new key mints an entry NFT and is rejected. Use a purpose-built proxy whose
covenant authenticates the permitted entry-node increase if delegated inserts are required. Never weaken the
default conservation check to accept arbitrary additional mutable NFTs.
:::

## Custom proxies and manual delegatecall

A custom proxy can bake an implementation, authenticate a parameter-selected implementation, or store the
selected address in state:

```solidity
contract AdminProxy(address initialImplementation, pubkey admin) {
    int public counter;
    address public implementation;

    constructor() {
        this.implementation = initialImplementation;
    }

    function forward(bytes input, address impl, sig s) public {
        require(impl == this.implementation);
        require(checkSig(s, admin));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}
```

Pass the artifact through `options.proxy`, optionally naming `options.forwardFunction`. A forwarder shaped as
`f(bytes input)` is baked mode; `f(bytes input, address impl, ...auth)` is parameter mode; `__fallback()` is an
unpinned fallback shape. `options.auth(signer)` builds trailing parameter-mode authorization arguments. Prefer the
baked default unless a mutable, explicitly governed implementation is a protocol requirement.

At the lower level, deploy the delegate artifact itself and wire the co-spend on a pending proxy call:

```ts
const implementation = StatefulContract.withCategory(
  implementationContract.asDelegate(),
  implementationCategory,
);

await proxy.call.__fallback()
  .withDelegatecall(implementation, 'increment', [])
  .send();
```

`withDelegatecall(implementation, functionName, args, proxyMasterIndex?)` validates layout compatibility, encodes
the selector and arguments, includes the delegate master, and supplies the compiler-owned input indices.

### Security rules

The compiler and SDK enforce several BCH-specific requirements:

- The delegate input must be forced and pinned to a real covenant address, not an untrusted P2PKH placeholder.
- A caller-selected implementation must be bound to constructor/state/constant identity or authorized by a
  signature whose key is itself not caller-selected.
- A proxy function issuing delegatecall cannot also write its own state; the delegate is the state authorizer.
- Delegatecall cannot appear in a loop. On a conditional path, any path that skips the delegate is restricted to
  preserving proxy state.
- The proxy and implementation must have matching names, types, and physical state-layout positions.
- The proxy preserves the rest of its own-category mutable NFT set so untouched state cannot be forged or burned.

Compiler-synthesized delegatecalls—deployed-library calls and large-contract root-to-facet routes—receive the same
identity, selector, self-mutation, and control-flow treatment.

## Split implementations

A split bundle is already proxy-shaped: its state-holding root delegates directly to compiler-generated facets.
Passing a `SplitContractBundle` to `upgrades.deployProxy` therefore deploys the flattened `root -> facet` topology,
not `proxy -> implementation router -> facet`.

Split proxy deployment requires a constructor-free logical implementation, supports genesis state seeding rather
than delegated initializers, and cannot be wrapped in a custom proxy. Root-to-facet links are immutable; splitting
a contract is a script-size mechanism, not a facet-upgrade protocol. See
[Large Contracts & Split Bundles](/docs/compiler/large-contracts).

## Choosing a pattern

- Use native `StatefulContract.upgrade()` for a contract that keeps no state records, when a stable category is
  enough and you want an explicit code migration.
- Use the built-in `deployProxy()` when a stable proxy address and Solidity-like forwarded calls matter, but the
  implementation can remain pinned for that deployment.
- Build a custom proxy only when mutable implementation selection is essential and its governance covenant can be
  audited as a first-class security boundary.

See [Contract Creation & Lifecycle](/docs/language/contract-creation),
[Stateful SDK](/docs/sdk/stateful-contracts), and
[Cross-Contract Calls](/docs/language/cross-contract-calls) for the surrounding APIs.
