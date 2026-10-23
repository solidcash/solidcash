---
title: Upgrades, Proxies & Delegatecall
---

SolidCash supports two different code-evolution patterns. They preserve different identities and have different
transaction shapes:

| Pattern | State holder | What changes | Stable identifier |
| --- | --- | --- | --- |
| Native `upgrade` lifecycle | The contract's own master NFT and records | The master and its records move to new locking bytecode | CashToken category ID |
| Proxy + `delegatecall` | A proxy's data NFTs | A co-spent implementation authorizes proxy-state outputs | Proxy address, for that proxy deployment |

These are not interchangeable. A native upgrade keeps the category and carries the contract's state to the new
code, but the physical contract address changes. A proxy keeps its own lock and records, and is useful when callers
must continue targeting the same address or when porting a Solidity proxy architecture.

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

`upgrade` is valid only on externally callable functions of a stateful contract and cannot be combined with `pure`,
`view`, `internal`, `private`, `unsafe`, `selfdestruct`, `deploy`, `split`, `merge`, or `migrateRecords`.

:::danger
The source-level guard decides who controls future code. Use a constructor- or state-bound key, multi-signature
policy, or another non-caller-chosen authority. `require(checkSig(s, pk))` is not authorization if the caller also
chooses `pk`. A direct compile rejects an `upgrade` function without an unconditional `require(checkSig(s, key))`
against a key the caller cannot choose (`UnauthorizedLifecycleError`).
:::

### Contracts that keep state

Every state record is bound to the executing master's exact lock: the data NFTs holding state variables, mapping
and array entries, value chunks, and satoshi or token containers. The upgrade moves the master to the replacement's
lock and carries the records with it:

- **State variables.** The upgrade transaction re-mints each data NFT at the replacement's lock with its values
  unchanged. Keep the new layout an extension of the old one: every existing variable keeps its name, type and
  position, and new variables are appended and start at their default values. The SDK refuses a removed, moved or
  retyped variable.
- **Containers.** The satoshi container and the token containers move with the master in the same transaction.
- **Mapping and array entries.** Entries move one per transaction through a `migrateRecords` function, before the
  upgrade moves the master. The SDK sends these transactions for you.
- **Chunk values.** Dynamic values and long mapping values keep their bytes in chunk NFTs, which no upgrade
  migrates yet. The SDK refuses an upgrade while one is live: clear or shorten those values through the old
  contract first.

```solidity
contract LedgerV1(pubkey admin) {
    mapping(bytes20 => int) public balances;

    function set(sig s, bytes20 holder, int amount) {
        require(checkSig(s, admin));
        this.balances[holder] = amount;
    }

    // Moves one mapping entry toward the replacement per transaction.
    function migrateEntry(sig s) migrateRecords {
        require(checkSig(s, admin));
    }

    // Moves the master, the data NFTs and the containers.
    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
```

A `migrateRecords` function keeps the master at its old lock and re-mints one co-spent entry at the replacement's
entry address, which the same kind of hidden witness names. Guard it with the same key as `upgrade`: whoever calls
it chooses that replacement. It must be externally callable and cannot be combined with `pure`, `view`, `unsafe`,
`upgrade`, `selfdestruct`, or `delegate`. A contract without mapping or array entries does not need one.

A message-bus upgrade route (experimental) appends inside the existing data NFTs at the old lock instead, so the
compiler refuses an `upgrade` function that joins such a route in a contract with state variables
(`UpgradeStrandsBoundStateError`).

### State and identity after migration

A native upgrade sends one transaction per mapping or array entry, then the upgrade itself. The upgrade
transaction:

1. spends the old master with the `upgrade` entry point;
2. recreates the same minting NFT, with its category and commitment, at the new contract's physical locking
   bytecode;
3. re-mints the data NFTs at the new lock, minting any extra data NFTs the longer layout needs; and
4. moves the satoshi and token containers to the new lock.

The category ID stays the same, but the physical P2SH address changes because the covenant bytecode or constructor
arguments changed.

### Adding state in the replacement

The replacement may append state variables. Each begins with its type's default value and can be set by a later
function call. When the longer layout needs more data NFTs, the upgrade mints them from the funding input at 1,200
satoshis each. The replacement may declare its own `upgrade` function for a later migration.

The `upgrade` body is the authorization path, not a general state-migration callback. Constructor arguments
construct the replacement locking bytecode; an explicit `constructor { ... }` state-initialization block is not
rerun.

### SDK migration

```ts
import { SignatureTemplate } from '@solidcash/solidcash';
import { StatefulContract } from '@solidcash/solidcash/stateful';

const admin = new SignatureTemplate(adminPrivateKey);
const result = await StatefulContract.upgrade({
  provider,
  oldContract: ledgerV1,
  upgradeFunctionName: 'migrate',
  upgradeFunctionArgs: [admin],
  migrateRecordsFunctionArgs: [admin],      // the migrateRecords function's own arguments
  newArtifact: ledgerV2Artifact,
  newConstructorArgs: [adminPublicKey],
  fundingUtxo,
  funder: signer.unlockP2PKH(),
  changeAddress: signer.address,
  maxFee: 20_000n,
});

console.log(result.categoryId === ledgerV1.categoryId); // true
console.log(result.contract.address === ledgerV1.address); // normally false
await result.tx.wait();
```

Pass `fundingUtxo`, `funder`, and `changeAddress`. They pay for extra data NFTs and for every entry migration, and
every network except the mock needs them for the upgrade's fee. Each entry migration is its own transaction, paid
from the funding coin with its change chained to the next step; the SDK prices every step before it sends the
first. `migrateRecordsFunctionName` picks the `migrateRecords` function when the contract declares several.
Persist the new artifact, constructor arguments, physical address, and transaction ID beside the stable category.

Every record and container is bound to the master's exact lock, so a record left at the old lock is unspendable once
the master moves. The SDK lists every entry, chunk, and container address before it sends anything and refuses the
upgrade while a genuine record would be left behind: a live chunk value, or more live containers than the covenant
migrates. Pass the categories of foreign token containers in `tokenContainerCategoryIds`; containers keyed by the
contract's own category or by a stored value are found without naming them. Anyone can send a coin to a container
address: name such surplus coins (`txid:vout`) in `leaveBehind` to abandon them at the old lock, and
`result.leftBehind` reports each one with its value.

Artifacts compiled before the authenticated replacement-bytecode witness was added are rejected. Recompile the
old source with the current compiler before enabling its upgrade path.

## Proxy and implementation model

In the proxy model, the proxy owns the persistent state while an implementation is co-spent to authorize a state
transition. Bitcoin Cash does not execute another script in a shared storage frame: the implementation covenant
is a real transaction input whose delegate build reads and writes the proxy's category-branded NFTs.

The built-in proxy that `upgrades.deployProxy` deploys is the supported profile. Custom forwarders and manual
`delegatecall`, `upgrades.upgradeProxy`, and deployed delegate libraries are experimental in this release.

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

The proxy checks that the forwarded call data starts with the implementation function's selector. An
implementation whose only eligible entry is a single function keeps its selector dispatch for that reason.

## Recommended SDK proxy

`upgrades.deployProxy` deploys the compiler-generated delegate implementation, deploys a state-holding proxy, and
returns one handle that dispatches implementation method names:

```ts
import { getContractFactory } from '@solidcash/solidcash/contract-factory';
import { upgrades } from '@solidcash/solidcash/stateful';

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
safer when the source is authored for SolidCash. An implementation compiled for the experimental framed convention
is deployed behind a generated proxy instead; see [Framed Composition](/docs/guides/framed-composition#proxies).

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
requires deploying a new proxy and deliberately migrating state, or designing a custom authenticated proxy.
`upgrades.upgradeProxy` refuses the built-in proxy.

The default proxy is layout-independent at the script level, but the SDK grafts the implementation layout onto
its artifact for state encoding and compatibility checks.

:::caution Verified mapping insertion
The default proxy conserves its own-category mutable-NFT count. Updating an existing vmap entry preserves that
count and is supported; inserting a new key mints an entry NFT and is rejected. Use a purpose-built proxy whose
covenant authenticates the permitted entry-node increase if delegated inserts are required. Never weaken the
default conservation check to accept arbitrary additional mutable NFTs.
:::

## Custom proxies and manual delegatecall

Custom proxies are experimental in this release. A custom proxy can bake an implementation, authenticate a
parameter-selected implementation, or compare the selected address with one it stores in state. This forwarder
accepts any implementation that the admin signs for:

```solidity
contract Forwarder(pubkey admin) {
    int counter;                                   // same layout as the implementation

    function forward(bytes input, address impl, sig s) external {
        require(checkSig(s, admin));
        impl.delegatecall(input);
        require(input.length > 0);
    }
}
```

Pass the artifact through `options.proxy`, optionally naming `options.forwardFunction`. A forwarder shaped as
`f(bytes input)` is baked mode; `f(bytes input, address impl, ...auth)` is parameter mode; `__fallback()` is an
unpinned fallback shape. `options.auth(signer)` builds the trailing parameter-mode authorization arguments; the
default is the signer's public key and a signature, so pass `auth: () => [adminSignature]` for the forwarder above.
Prefer the baked default unless a mutable, explicitly governed implementation is a protocol requirement.

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

### Re-targeting a parameter-mode proxy

`upgrades.upgradeProxy(proxy, newFactory, options?)` (experimental) follows the OpenZeppelin shape for a custom
proxy in parameter mode. It deploys the new implementation's delegate build and returns a new handle that forwards
to it. It sends no transaction to the proxy: the proxy's lock, address, and state stay the same, and the
forwarder's own check decides whether it accepts the new implementation.

```ts
import { getContractFactory } from '@solidcash/solidcash/contract-factory';
import { upgrades } from '@solidcash/solidcash/stateful';

const proxy = await upgrades.deployProxy(getContractFactory(counterV1Artifact, admin), { counter: 0n }, {
  proxy: forwarderArtifact,
  auth: () => [adminSignature],
});
const upgraded = await upgrades.upgradeProxy(proxy, getContractFactory(counterV2Artifact, admin));
await upgraded.increment().send();
```

`proxy` may also be the proxy's address on the connected network; `options` takes `runner` and
`implementationOverrides`. The new implementation must keep the proxy's state layout exactly: the same data NFT
count, and every field with the same name, type, position, and encoding. Retargeting migrates no commitments, so
it also refuses an added field. A baked or fallback proxy, including the built-in one, is refused.

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

Compiler-synthesized delegatecalls (deployed-library calls, which are experimental, and large-contract
root-to-facet routes) receive the same identity, selector, self-mutation, and control-flow treatment.

## Split implementations

A split bundle is already proxy-shaped: its state-holding root delegates directly to compiler-generated facets.
Passing a `SplitContractBundle` to `upgrades.deployProxy` therefore deploys the flattened `root -> facet` topology,
not `proxy -> implementation router -> facet`.

Split proxy deployment requires a constructor-free logical implementation, supports genesis state seeding rather
than delegated initializers, and cannot be wrapped in a custom proxy. Root-to-facet links are immutable; splitting
a contract is a script-size mechanism, not a facet-upgrade protocol. See
[Large Contracts & Split Bundles](/docs/compiler/large-contracts).

## Choosing a pattern

- Use native `StatefulContract.upgrade()` when a stable category is enough and the address may change. It carries
  state variables, containers, and mapping entries to the new code, but not chunk values.
- Use the built-in `deployProxy()` when a stable proxy address and Solidity-like forwarded calls matter, but the
  implementation can remain pinned for that deployment.
- Build a custom proxy (experimental) only when mutable implementation selection is essential and its governance
  covenant can be audited as a first-class security boundary.

See [Contract Creation & Lifecycle](/docs/language/contract-creation),
[Stateful SDK](/docs/sdk/stateful-contracts), and
[Cross-Contract Calls](/docs/language/cross-contract-calls) for the surrounding APIs.
