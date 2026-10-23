# Large contract splitting

Status: first-release-candidate implementation (`solidcash-split-v1`).

SolidCash can compile a stateful contract into one state-owning root and a set of
statically linked delegate facets. This is the BCH analogue of a Solidity
Diamond, but it deliberately permits only one delegate hop.

```text
ordinary deployment                 split deployment

contract C                          state root P (category C)
                                      |
                                      +-- pinned facet F0 (own category, brand C)
                                      +-- pinned facet F1 (own category, brand C)
```

`P` owns every application state NFT. Facets deploy only a persistent minting
master, have the complete logical state-layout metadata for offset calculation,
and are marked `delegateOnly`. A moved function remains in the root ABI as a
thin selector-preserving forwarder. Its target address is a constructor link,
so deployment fixes the facet graph immutably.

## Compiler API

```ts
import { compileFileSplit, compileStringSplit } from '@solidcash/solidc';

const bundle = compileFileSplit('Large.scash');
const forced = compileStringSplit(source, {
  forceSplit: true,       // useful for tests and explicit topology selection
  maxShardBytes: 10_000,
});
```

Ordinary `compileFile` and `compileString` are unchanged. Without `forceSplit`,
the split API returns an empty-facet bundle when the ordinary artifact fits.
The CLI equivalent is `solidc --split Large.scash` and emits a JSON or TypeScript
bundle. `--split` cannot be combined with raw ASM/hex output.

The planner runs after imports, inheritance, and modifier expansion. It forms a
complete internal call closure for every movable entry point, then derives a
conservative state/effect footprint. Calls are hard colocation edges. Shared
state is a soft affinity: the planner tries functions touching the same scalar or
possibly-aliasing collection region together first. It then best-fit packs
independent groups when their union fits, reducing duplicated facet masters and
deployment transactions without weakening the call-closure boundary. Constant,
distinct mapping keys are treated as disjoint; dynamic keys widen to a wildcard.
Candidate ordering uses cached component sizes, but every accepted union is
compiled through the normal optimizer, so the limit is decided using emitted
bytecode rather than an AST or additive estimate. `maxShardBytes` is also the
packing ceiling; deployments wanting operational headroom can set it below the
10,000-byte consensus limit.

V1 moves terminal public/external state transitions, including return-valued
transitions. View/pure functions, fallback/receive, and lifecycle/delegate/unsafe
functions remain in the root. Overloaded movable entry points fail closed
until SDK routing is selector-keyed. A facet or root that cannot fit produces a
compile error with its measured size and closure.

A moved returning function keeps the logical root ABI and uses one shared,
authenticated `returnEvent` offset in the root and facet layouts. A plain
`.send()` materializes neither side of that optional slot and discards the
computed value. `.emitReturn()` materializes both its funder input and output;
the facet computes and authenticates the commitment against the root-owned
output. `.staticCall()` evaluates the facet input in the VM and decodes the same
authenticated blob without broadcasting. This is a return channel, not mutable
inter-facet memory: it cannot make a second facet observe intermediate state.

## Inter-facet state interaction

V1 has no runtime facet-to-facet edge and no message bus. A logical call selects
exactly one facet, and that facet applies the whole state transition to `P`.
Internal/private helpers and public-to-public internal calls are placed in the
same facet closure. Independent functions that modify the same state are grouped
when size permits; otherwise they are separate serial transitions over the same
root master.

This restriction matters on BCH. Separately evaluated transaction inputs do not
share a sequential memory journal: facet A cannot write an intermediate state
that facet B then observes during the same transaction. Merely co-spending an
extra facet does not execute or authorize it. Atomic multi-function behavior
requires a dedicated entry point whose complete closure fits one facet.

A future multi-facet logical call requires authenticated intent messages and one
settlement facet as the sole state author. Messages must bind the destination
root, source facet, logical call, nonce/order, operation, slot, and payload, and
the settlement must prove completeness and fold them over one pre-state. That
protocol is explicitly outside `solidcash-split-v1`; nested delegatecall is not a
fallback because current delegate covenant context is one-hop.

## SDK deployment and calls

```ts
import { Signer, SplitContractBundle, upgrades } from '@solidcash/solidcash';

const factory = SplitContractBundle.from(bundle, signer);
const app = await factory.deploy(constructorArgs, {
  initialState: { count: 0n },
});

await app.call.increment(1n).send();
await app.call.setAndReturn(2n).send();              // authenticated value discarded
await app.call.setAndReturn(3n).emitReturn().send(); // returnEvent output
const value = await app.call.setAndReturn(4n).staticCall();
const record = app.deploymentRecord();
const again = factory.attach(record, constructorArgs);

// Split upgradeable deployment is flattened; there is no router between root
// and facets.
const proxied = await upgrades.deployProxy(factory, { count: 0n });
```

Deployment reserves the root's vout-0 funding input first, derives its category,
selects distinct facet genesis inputs, and preconstructs every facet and the root
before broadcasting anything. This validates constructor encoding, deterministic
links, and the complete constructed redeem-script size. It then deploys facets
and finally the root. A transient root failure is recoverable by retrying with
the reserved root funding outpoint; already-created facets keep the same brand,
category, and address.

The loader rejects missing facets, duplicate selectors, non-branded or
non-delegate artifacts, and root/facet state-layout mismatches. Facet deployment
rejects application initial state, balances, constructor init calls, and data
NFTs. Calls route local functions directly and automatically add the selected
facet as the root forwarder's delegate co-spend.

## Security invariants

- The root is the sole application state authority and self-pins category `C`.
- A facet constructor brand equals `C`; a foreign root therefore fails.
- The root pins the exact facet locking bytecode supplied at deployment.
- Each facet self-preserves its own minting master and cannot be substituted by
  another category or arbitrary UTXO at call time.
- Delegate state offsets use the root's full layout; bundle loading rejects
  layout drift before deployment or attachment.
- Exactly one selected facet is necessary for a logical call. Extra co-spent
  inputs do not gain root state authority.
- Emitted artifact sizes and constructed redeem scripts are checked against the
  10,000-byte per-input limit. Final unlocking data and whole-transaction limits
  remain enforced by transaction construction and VM validation.

Unlike a conventional upgradeable Solidity proxy, normal split deployment is
already proxy-shaped internally: `P -> Fi`. `deployProxy` for a split bundle uses
that same flattened topology rather than `P -> router -> Fi`, because a second
delegate hop is not enabled. Facet replacement is therefore not an implicit
upgrade mechanism; v1 links are immutable. Existing small-contract
`deployProxy(implementation)` behavior remains unchanged.

## Current deliberate limits

- no nested/runtime inter-facet calls or message settlement;
- no split inside a single over-limit function;
- no movable overloaded entry points;
- view/pure/fallback/receive and lifecycle functions stay root-local;
- moved single-value returns support send, emit, and static decoding; tuple
  decoding and composing a moved callee behind another contract call are not yet
  supported and fail closed;
- deployment is deterministic and recoverable staged deployment, not one atomic
  N+1-output genesis transaction.

All limits fail closed. They should be lifted only with a protocol and tests that
preserve the security invariants above.

The Solidity-import Unicrow corpus **no longer needs to split at all**. Measured
today: `Unicrow.sol` is **8,935 real bytes** against the configured 10,000-byte
limit, with **1,065 bytes of headroom**, and `compileFileSplit` returns the unsplit
bundle - **0 facets**.

Two changes account for it. X149 corrected the planner's ruler: `artifact.bytecode`
is an ASM LISTING, in which one 1-byte opcode occupies `OP_CHECKSIGVERIFY `, so
`.length / 2` was half a CHARACTER count - which is why the figures this paragraph
used to carry ended in `.5`. And X154 measured that cross-function outlining, which
runs unconditionally, cuts the emitted script by **70.2%**.

The figures previously recorded here - a 23,931.5-byte monolith, a 7,483.5-byte
root, four facets of 9,696.5 / 9,787 / 9,450.5 / 3,647.5, 40,065 bytes deployed at
67.42% overhead, and 213 bytes of headroom on the largest facet - are stale in both
UNIT and MAGNITUDE, and are kept here only so the correction is legible. These are
regression observations rather than stable ABI promises: optimization changes can
move the exact figures, while every emitted artifact is remeasured against the
configured limit.

The exact imported Unicrow monolith cannot deploy, as expected: its 23.8 KB redeem
script is embedded in the constructor input and exceeds BCH's 10 KB unlocking
bytecode limit. This was previously misdiagnosed as a constructor-runtime gap
because commitment inference replaced the underlying VM error with a generic
message.

The faceted root now deploys that constructor natively. Genesis codegen covenants
the complete data-NFT layout, including untouched/default and compiler-injected
fields. SDK inference converges progressively because VM execution stops at the
first placeholder commitment mismatch: probe 1 learns NFT 0, probe 2 can reach
NFT 1, and so on, followed by a complete validation run. Every probe reads the
same zero/explicit constructor pre-state; only synthetic output placeholders are
updated, so non-idempotent initialization executes once per deployment. Entry
and event commitments converge by exact output index. The opt-in
`SOLIDC_REAL_CORPUS=1` regression verifies all four facets deploy, the imported
constructor initializes its peer/governance addresses and protocol fee, and the
inlined `Counters.Counter.increment()` leaves the escrow counter at one.

## Hardhat-compatible deployment sequencing

The unchanged Effective Acceleration marketplace test is the integration target.
Its Unicrow fixture reads one signer nonce, predicts four CREATE identities, then
deploys four contracts in that exact order with circular peer addresses. These
identities remain security-relevant: the contracts later use them as typed call
targets and compare them with contract-origin `msg.sender`.

SolidCash models the EVM account nonce as a signer-local **logical transaction
nonce**. It advances once for each user-visible transaction initiated by that
signer: a deployment, `deployProxy`, stateful function send, or value transfer.
A composite BCH implementation may broadcast several transactions, but facet
staging, proxy implementation deployment, root funding preparation, and other
subordinate transactions execute under the parent's reservation and do not
advance it independently. Reads, static calls, and transaction construction do
not consume a nonce. A failure before broadcast releases its reservation.

Mock-network accounts follow Hardhat's lifecycle: the provider derives and funds
configured accounts once, caches one signer object per mnemonic/path/index, and
`getSigner(i)` and repeated `getSigners()` calls return those same objects. A
fixture snapshot captures both UTXO state and signer nonce state. Network reset
creates a fresh account set and nonce sequence. Cross-process reconstruction
from BCH address history is deliberately not attempted: incoming payments and
internal funding transactions make history length different from an EVM nonce.

Genesis-eligible funding inputs are prepared by each deployment, not by a global
deployment planner. An ordinary contract, split root plus all facets, or flattened
split proxy consumes one logical nonce. Facets have physical categories but no
Solidity-visible CREATE identity and never perturb deployment order.

The `ethers` CREATE shim deterministically derives a spendable P2SH20 logical
address from `(signer address, nonce)`. Genesis mints an immutable, category-bearing
SCID anchor at that address. Its commitment records the canonical deployer locking
bytecode, nonce, and physical root locking bytecode. Resolution recomputes the
logical address, requires exactly one valid anchor, and checks the physical root
against the artifact and constructor arguments. Split roots additionally mint
ordered SCIF records for their physical facet categories. Consequently an SDK can
reconstruct a normal or split deployment in another session without a local
deployment registry.

Hardhat compilation emits `.split.json` beside ordinary artifacts, and factory
lookup prefers that bundle so positional `deploy()` and `getContractAt()` route
through `SplitContractBundle` without test-source changes.

Three boundaries remain explicit. Typed external calls still pin the physical
root and do not yet accept a co-spent SCID anchor as a logical target.
Contract-origin `msg.sender` still exposes the
authenticated physical caller root: exposing its logical address requires a
stack-safe extension of the minting-input verifier and a VM regression that rejects
missing, duplicate, wrong-category, and wrong-root anchors. Also, a typed call whose
callee is itself split must co-spend and route the selected facet in addition to the
callee root. Until those paths are implemented, peer authorization must not assume
logical `msg.sender`, and split callees are not advertised as transparent external
targets. Hash-derived placeholders without the SCID binding are never sufficient.
