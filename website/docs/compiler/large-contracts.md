---
title: Large Contracts & Split Bundles
---

Bitcoin Cash limits one P2SH redeem script/unlocking bytecode to 10,000 bytes. SolidCash can compile an oversized
stateful contract into a `solidcash-split-v1` bundle: one state-owning root plus statically linked, one-hop delegate
facets.

```text
logical contract
  +- root: owns the master, data, vmap, chunk, and container state
  +- facet 0: owns code for one group of entry functions
  +- facet 1: owns code for another group of entry functions
```

The logical ABI stays on the root. A moved function becomes a thin selector-preserving forwarder, and the SDK
routes its call through the required facet automatically. Splitting is explicit and fail-closed; ordinary compiler
entry points never silently change deployment topology.

## Compile a split bundle

```ts
import { compileFileSplit, compileStringSplit } from '@solidcash/solidc';

const bundle = compileFileSplit('Large.scash');

const tuned = compileStringSplit(source, {
  forceSplit: true,
  maxShardBytes: 9_000,
});
```

Without `forceSplit`, a contract which already fits is returned as a valid bundle with no facets. This lets tooling
use one output type while avoiding needless deployment overhead. `maxShardBytes` is both the placement ceiling and
the final byte limit checked for each shard, taken literally as redeem-script bytes; choose a value below 10,000
when operational headroom matters. When it is omitted, the planner budgets the whole spend against the BCH
10,000-byte input limit: the redeem script plus the constructor arguments and the widest entry point's own
arguments. `rootFunctions` names public entry points that must stay on the root.

CLI usage is explicit. `--split size` always splits (it sets `forceSplit`), even when the contract would fit:

```sh
solidc Large.scash --split size --output Large.split.json
solidc Large.scash --split size --format ts --output Large.split.ts
solidc Large.scash --split size --size
```

`--split size` is the size packer described on this page; it refuses the framed convention. `--split func` compiles
one framed master per ABI entry (a `FunctionSplitBundle`) and requires `composition: 'framed'`, which the CLI sets
for it; the framed convention is experimental (see [Framed Composition](/docs/guides/framed-composition)). An
over-cap message-bus kernel route is outside function split. `--split size` and `--split func` cannot be combined
with raw ASM or hex output. A bare `--split` is refused; the modes are `off`, `size`, and `func`.

SolidHat also checks compiled artifacts against the active provider's input limit. When an ordinary stateful
artifact exceeds that ceiling, its project compilation attempts to publish a `.split.json` bundle alongside the
artifacts. Use production consensus settings for a release build; a relaxed mock-network ceiling can deliberately
admit a monolith which mainnet cannot spend.

## What the planner moves

The planner runs after imports, inheritance, modifiers, semantic lowering, and internal-call analysis. It:

1. forms a complete internal call closure for every movable public/external entry point;
2. treats calls as hard colocation edges;
3. groups functions with overlapping state/effect footprints where possible;
4. best-fit packs independent groups; and
5. compiles every candidate through normal optimization before accepting its measured bytes.

The size decision uses emitted bytecode, not an AST estimate. A function closure which cannot fit one facet, or a
root which remains too large, produces a measured compile diagnostic.

Terminal public/external state transitions, including single-return transitions, can move. Fallback/receive
handlers, lifecycle routes, unsafe routes, and delegate routes remain root-local. View/pure functions stay on the
root too, unless the unsplit contract is itself over the shard limit; then they can move as well, so that the root
still fits. Overloaded movable entries currently fail closed because v1 routing is function-name based.

## State ownership and one-hop execution

The root is the sole application-state authority. It owns every scalar data NFT, vmap entry, dynamic chunk, token
container, and satoshi container. A facet is a branded, `delegateOnly` contract with:

- its own self-preserved minting master and physical category;
- the complete root state-layout metadata for offsets;
- only the function closure assigned to it; and
- a constructor brand equal to the root category.

The root pins each facet's exact locking bytecode at deployment. A foreign facet, different category, wrong brand,
or changed state layout cannot be substituted later.

One logical call selects at most one facet. Internal/private helpers used by that entry are placed in the same
closure. V1 does not execute facet A and then facet B against shared intermediate state: separate BCH inputs do not
share a mutable call frame, and nested delegate calls are not enabled. If an atomic operation needs several steps,
write one entry point whose complete closure fits one facet.

This is separate from the [message bus](/docs/guides/message-bus). The bus composes multiple state-owning physical
participants; a split bundle partitions one logical contract's code while retaining one root state owner.

## Deploy and call

```ts
import { SplitContractBundle } from '@solidcash/solidcash/stateful';

const factory = SplitContractBundle.from(bundle, signer);
const app = await factory.deploy([owner], {
  initialState: { count: 0n },
});

await app.waitForDeployment();
await app.call.increment(1n).send();

const value = await app.call.setAndReturn(2n).staticCall();
await app.call.setAndReturn(3n).emitReturn().send();
```

`SplitContract` exposes `call`, direct ABI methods, root state getters, `connect()`, `getAddress()`,
`deploymentTransaction()`, and `waitForDeployment()`/`deployed()`.

Deployment first reserves a genesis-valid root funding outpoint, derives its category, selects distinct genesis
inputs for the facets, and preconstructs every address/redeem script. It then deploys the branded facets and
finally the root. If the final root broadcast fails transiently, retry with the same reserved root outpoint so the
facet brands and links remain valid.

A signer runner supplies funding and signatures. A provider runner needs explicit root and per-facet funding:

```ts
const app = await SplitContractBundle.from(bundle, provider).deploy(constructorArgs, {
  fundingUtxo: rootFunding,
  funder: rootUnlocker,
  changeAddress,
  facetOverrides: Object.fromEntries(bundle.manifest.facets.map((facet, index) => [
    facet.name,
    { fundingUtxo: facetFunding[index], funder: facetUnlockers[index], changeAddress },
  ])),
});
```

Every genesis funding input must be a distinct plain `vout: 0` UTXO because each creates a physical CashToken
category.

## Reconnect to a deployment

Persist the physical record when you need direct reconstruction:

```ts
const record = app.deploymentRecord();
// { rootCategory, facetCategories, logicalAddress? }

const again = factory.attach(record, constructorArgs);
```

Signer-backed factory deployment also creates one logical CREATE identity. It is a spendable P2SH20 discovery
address derived from the signer address and logical transaction nonce, with immutable category-bearing anchors
for the physical root and ordered facets. This lets another process authenticate and reconstruct the bundle:

```ts
const again = await factory.at(logicalAddress, constructorArgs);
```

The resolver checks the identity commitment, root locking bytecode, facet categories, brand, and bundle topology.
A process-local deployment registry is a convenience, not the authentication root.

## Return values and events

A moved returning function uses the same authenticated return-event slot as an unsplit contract:

- plain `.send()` discards the computed return and creates no carrier;
- `.emitReturn().send()` publishes the category-bound return-event NFT; and
- `.staticCall()` evaluates the facet locally and decodes a single return.

Facet events are routed into root-owned event outputs, preserving the logical artifact/event API. If an event's
arguments cannot be inferred from the function arguments and state trace, use the normal pending-call
`.emitEvent()` override.

Tuple static-return decoding and composing a moved returning function behind another contract's typed call are
not supported by split v1 and fail closed.

## Proxies and upgrades

```ts
import { upgrades } from '@solidcash/solidcash/stateful';

const proxied = await upgrades.deployProxy(factory, { count: 0n });
```

For a split bundle this is a flattened root-to-facet deployment, not a mutable proxy layered over a router. See
[Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies#split-implementations).

A normal split is already internally proxy-shaped (`root -> facet`). Split proxy deployment therefore uses a
flattened topology rather than inserting a second router hop. The root/facet links of an ordinary v1 split are
immutable; splitting is not an implicit facet-upgrade mechanism.

## Loader and deployment checks

The SDK refuses a bundle with:

- an unknown bundle version or invalid logical-identity scheme;
- duplicate routed selectors;
- a route to a missing facet;
- a facet which is not branded and delegate-only;
- root/facet state-layout fingerprint drift;
- an over-limit constructed redeem script;
- reused genesis funding inputs; or
- initial application state attached to a delegate-only facet.

The complete transaction must still satisfy argument-size, operation-density, hash-iteration, standardness, fee,
and whole-transaction limits. Splitting solves the code-size dimension; it does not make an otherwise unbounded
operation free.

## Current v1 boundaries

- no nested or runtime facet-to-facet calls;
- no splitting inside one over-limit function closure;
- no movable overloaded entry points;
- no lifecycle, fallback, or receive facets, and no pure or view facets unless the unsplit contract is over the
  limit;
- no tuple static-return decoding; and
- staged deterministic deployment rather than one atomic multi-category genesis.

These shapes produce errors rather than weaker bytecode. See [Script & Transaction Limits](./script-limits.md)
for the surrounding BCH resource model.
