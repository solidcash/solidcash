# Large Contract Splitting: End-to-End Implementation Plan

**Status:** implementation plan. `large-contract-splitting.md` remains the
research and alternatives record.

## 1. Normative v1 topology

V1 is a static, one-hop execution proxy. State contract `P` owns the application
category and all live state. Independent facet masters `F0..Fn` contain code. A
facet has its own category and an immutable constructor brand equal to `P`.

```text
small normal: C             small deployProxy: P -> I
split normal: P -> Fi       split deployProxy: P -> Fi
```

A split `deployProxy` is flattened: it does not deploy `P -> router -> Fi`. This
matches the current compiler prohibition on delegate functions containing
delegatecall. Facets do not share `P`'s category, carry application data NFTs, or
call other facets. Their addresses are statically committed into `P`.

The first splitter is hybrid. Functions may remain in `P`; terminal void
state-mutating entry points may move with their complete internal/private helper
closure. View/pure and return-valued entry points remain local until an
authenticated delegate-return protocol is proven. Lifecycle functions, nested
delegatecall, cross-facet calls, and splitting within a function are rejected.
Small contracts and existing compile/SDK APIs remain unchanged.

### 1.1 Inter-facet interaction is compile-time composition in v1

V1 has **no runtime inter-facet call**. A logical call enters `P` once and `P`
selects exactly one facet. That facet completes the entire state transition and
returns covenant success/failure only; it cannot delegatecall, call, or
staticcall another facet from the same bundle.

Source-level calls within the logical contract do remain supported, but the
splitter resolves them before deployment:

- An entry point and every stateful/internal/private function it can reach form
  one indivisible placement closure. Strongly connected components are collapsed
  first, so recursion cannot create a cross-facet edge.
- A helper used by entry points in different facets is duplicated only if the
  compiler proves it pure, deterministic, and independent of contract identity,
  state, context, effects, and mutable library state. Otherwise all callers are
  colocated. If that union exceeds the limit, splitting fails with the call path
  that forced the union.
- A call from one public function to another is an internal call for placement
  purposes and forces both bodies into the same closure. It is not compiled as a
  second selector dispatch.
- An external self-call through `this`, the root address, or a typed handle to
  `P` is rejected: the transaction cannot recursively spend the already-consumed
  root UTXO. Calling a different contract — including another split contract —
  remains an ordinary external call to that contract's root and never receives
  our proxy state context.
- Independent facet-backed entry points may be composed sequentially across
  transactions. Atomic composition requires a dedicated logical entry point
  whose whole call graph fits in one facet; merely co-spending extra facet
  masters does not authorize or execute them.

### 1.1.1 Partition by state interference, then by size

After mandatory call closures are formed, the primary grouping signal is the
state/effect footprint, not source order or a blind byte-size bin pack. For every
closure the compiler derives conservative read and write sets over:

- scalar and packed-struct slots;
- mapping families plus a key region (`constant key`, proven-disjoint range, or
  wildcard when aliasing is unknown);
- collection/chunk families and index regions;
- token/satoshi containers, emitted effects, and external-call resources;
- context dependencies such as `msg.value` that affect state computation.

Two closures interfere when they may participate in the same logical atomic
operation and one writes a resource the other reads or writes. `R/R` overlap is
not a conflict. Unknown keys, aliases, indirect calls, or dynamic indices widen
to the containing family and therefore conflict conservatively.

Interference within one logical operation is a **hard colocation edge** in v1.
Overlapping state access by independent public entry points is only a **soft
affinity**: grouping it usually shares state-backend/covenant machinery and keeps
future message boundaries local, but it must not merge the whole contract merely
because many functions touch a common field such as `owner` or `nonce`. Disjoint
storage domains are preferred split boundaries.

State/effect-free closures have no state-affinity edges. Pure internal helpers may
be duplicated after byte-identity testing; standalone pure/view/returning entry
points normally remain in `P` in v1 because the delegate return channel is not
available. If state-free computation itself becomes too large, it is a compute-
sidecar candidate with an authenticated result message, gated by A4 rather than
silently treated as a state facet.

This partitions **code and responsibility**, not storage ownership. Every group
still uses the single `P` pre-state and only the selected state controller may
author `P`'s final state.

This rule deliberately differs from Solidity's runtime nested `delegatecall`.
Solidity preserves the original storage/address context and caller/value through
arbitrary delegate depth. SolidCash currently rejects a `delegate` function that
contains delegatecall because that codegen path would skip the nested delegate's
state covenant and self-preservation. Treating the second facet as a normal
external call would be equally wrong: it would use the callee's state rather than
`P`'s. Therefore neither lowering is an acceptable fallback.

A future runtime design must separately prove proxy-index propagation, every
facet's brand and address pin, preservation of every facet master, selector and
calldata binding at every hop, return/error propagation, context parity,
cycle/depth bounds, and aggregate input/transaction budgets. Until that protocol
exists, the manifest's physical facet call graph must be edgeless.

### 1.2 Pinned future protocol: messages plus one settlement authority

Facets are separate input evaluations over the same fixed transaction. They have
no shared stack/journal and no consensus execution order, so runtime interaction
cannot mean “A writes `P`, then B reads A's write.” Nor may two facets
independently author the same `P` output.

The only sound extension admitted by this plan is a **message-and-settlement
batch**:

```text
P pre-state ──────────────────────────────> P final state
             producer A ─> intent ┐
             producer B ─> intent ├─> settlement facet S
             producer N ─> intent ┘
```

- `S` is the only delegate and state authority. The root pins `S`, the logical
  selector, and the complete producer/message set.
- Producers are compute/validation sidecars, not delegates. They cannot receive
  `_proxyMasterIndex` or author state. Each pins and preserves its own master and
  constrains authenticated message outputs.
- A message is an intent, not intermediate state. It binds protocol/version,
  destination `P` category, logical call ID, source facet category, sequence,
  operation, globally namespaced slot, value/payload digest, and replay nonce.
  Large payloads use pinned chunks; the 128-byte commitment carries a digest.
- `S` verifies identity, destination, call, nonce, payload, and canonical order,
  then folds every intent over `P`'s pre-state in one read-your-writes journal and
  flushes exactly one final state. Invalid/conflicting operations fail the batch.
- Exhaustiveness is mandatory: every root-declared producer/message is applied
  exactly once and no undeclared message affects settlement. The baseline is a
  manifest-committed ordered list; compact count/root/range proofs must establish
  equivalent completeness.
- Results/errors are settlement outputs committed by `S`; producers do not
  synchronously return to one another. Any failed input invalidates the atomic
  transaction.

This is joint constraint satisfaction, not nested control flow. All producer,
message/chunk, and settlement inputs count toward whole-transaction limits. The
wire-format research is in `buffered-state-and-message-bus-research.md`, but it is
not a shipped guarantee. Bundle messages require the root to commit permitted
participants and operations; a generic unbound cross-contract bus is insufficient.

## 2. Release invariants

These must hold against raw transactions, not only SDK-generated ones:

1. `P` solely authorizes state, vmap roots, chunks, containers, and value.
2. A facet executes only with its exact branded `P` input.
3. Each facet master preserves itself and cannot be substituted.
4. Facet, selector, input positions, and state output are bound in script.
5. Every redeem script and complete unlocking input is below 10,000 bytes; the
   complete transaction also meets operation, hash, and standardness limits.
6. Logical ABI and storage layout match the unsplit contract.
7. Unsupported or over-limit partitions fail closed with precise diagnostics.
8. Exactly one bundle facet executes per logical call; the deployed facet graph
   has no edges, and compiler placement resolves all logical internal edges.

## 3. Phase A: protocol experiments

Build isolated SolidCash sources plus VM and regtest harnesses before a general
compiler pass. Record redeem/input/transaction sizes, operation/hash budgets, and
the exact input/output layout for every case.

### A0 — minimal one-hop proof

- Deploy `P`, `F0`, and `F1` with distinct real categories; brand both facets.
- Mutate shared scalar state through both facets.
- Attack wrong brand/category/selector, swapped/omitted inputs, duplicate facet,
  foreign proxy, and facet-master theft.
- Prove selector authentication for a one-function facet. Synthesize an explicit
  dispatcher if current compilation elides its selector.
- Attempt facet A -> facet B using delegatecall, regular call, staticcall,
  external self-call, and an extra co-spent facet. Each must be rejected at
  compile time or fail in script; none may mutate `P`.

**Gate:** both valid routes preserve their master and mutate only `P`; every
malformed transaction fails in script.

### A1 — state backend proof

Exercise structs, default and vmap mappings (all proof modes), nested mappings,
dynamic/packed arrays, chunks, and multi-NFT state. Facet deployment must create
no application state NFT.

### A2 — effects and context proof

Exercise events, satoshi/token transfers, containers, external calls, sidecars,
`msg.*`, `tx.origin`, timelocks, and output-state reads. Classify each feature as
supported, root-local-only, or rejected. Unknown behavior is a compile error.

### A3 — deployment proof

On regtest, prove category derivation and whether a standard atomic genesis can
mint `P` and all facets from distinct vout-0 funding inputs. Otherwise design a
recoverable staged deployment; never strand branded facet funds if `P` fails.

### A4 — inter-facet message/settlement proof (post-v1 gate)

Use two producers and one settlement facet to update the same scalar and then the
same vmap entry. Prove non-commutative canonical ordering (`set`, then `add`) and
read-your-writes in `S`. Attack missing, duplicate, reordered, replayed,
wrong-destination/source, undeclared, conflicting, and payload-substitution
messages; the wrong settlement facet; producer direct-state access; and two
settlement facets attempting to author `P`. Compare final state to a monolithic
oracle and measure all commitment/transaction limits. Runtime interaction stays
disabled until A4 and independent review pass; ordinary one-facet v1 does not
depend on A4.

## 4. Phase B: compiler and artifacts

### B1 — pipeline boundary

Create an internal checkpoint after imports, inheritance, modifiers, and
compatibility lowerings expose complete bodies, but before per-contract semantic
and generation work. Compile cloned root/facet ASTs through the normal symbol,
type, covenant, codegen, and optimization pipeline.

### B2 — deterministic planner

Add `ContractSplitPlanner` to build the entry/helper call graph, form conservative
closures, retain unsupported functions in `P`, and pack closures deterministically
with a safety margin. Estimate candidates by compiling them, not AST node count.
Duplicate helpers only when proven pure; otherwise colocate callers. If root and
all facets cannot fit, report retained reasons, largest closures, and the failed
constraint. Cross-closure recursion, function pointers, moved returns, lifecycle
delegates, and nested/cross-facet delegates are v1 errors.

Collapse strongly connected components before packing and emit an explicit
physical-call-graph assertion after generation. Every facet-to-facet edge is a
compiler bug. Diagnostics identify the source call chain that forced colocation
or made the contract unsplittable.

Add `StateAccessAnalysis` before packing. It emits normalized read/write/effect
footprints and two graphs: hard interference edges and soft state-locality
affinities. The deterministic objective order is:

1. preserve call/SCC and hard-interference closures;
2. keep every shard below its measured limit and safety margin;
3. maximize soft state locality and shared generated machinery;
4. minimize duplicated pure code and number of facet inputs;
5. break remaining ties by source-qualified function name.

The manifest records each route's conservative footprint, reasons for every hard
union, and intentionally cut soft edges. This makes partition changes auditable
and gives A4 an explicit list of boundaries that would require messages.

### B3 — root and facets

The root keeps the original constructor, ABI, state, and local bodies. A moved
function becomes a selector-preserving forwarder to one symbolic facet link.
Each facet carries the full state-layout metadata needed for delegate offsets but
is marked `delegateOnly`; it has no application constructor and deploys only its
master. Its public surface is limited to assigned logical selectors and required
compiler dispatch machinery. Run normal covenant/resource checks on every shard
and map physical instructions back to original sources.

### B4 — additive bundle API

Do not change existing compile return types. Add explicit APIs such as
`compileStringSplit`/`compileFileSplit` returning:

```ts
interface SplitArtifactBundle {
  format: 'solidcash-split-v1';
  root: Artifact;
  facets: ArtifactMap;
  manifest: {
    logicalContractName: string;
    abi: AbiFunction[];
    stateLayoutFingerprint: string;
    deploymentMode: 'immutable-one-hop';
    routes: Array<{ selector: string; function: string; target: 'root' | string }>;
    facets: Array<{
      name: string; functions: string[]; brandArgument: string;
      delegateOnly: true; estimatedRedeemBytes: number;
    }>;
  };
}
```

Artifacts contain symbolic links, never deployment categories. Include compiler
version/options, source hashes, split-algorithm version, per-shard resources, and
logical-to-physical source maps. Begin with explicit API/CLI `--split`; automatic
retry above 10 kB is deferred and must not silently alter first-RC deployments.

## 5. Phase C: SDK

### C1 — bundle loading and deployment

Extend `ContractBundle`/`ContractFactory` additively with a split-aware factory or
handle. Validate schema version, selectors, layout fingerprints, `delegateOnly`,
and links. Deployment then:

1. selects distinct vout-0 funding UTXOs and precomputes `P`/`Fi` categories;
2. instantiates facets with brand `P` and category `Fi` to obtain bytecode;
3. resolves root links with those locking bytecodes;
4. instantiates `P` and builds the proven atomic/recoverable deployment;
5. validates actual serialized input/transaction limits before signing.

Return root/facet handles and categories, manifest, and all deployment
transactions. Facets receive no state/chunk/vmap outputs.

### vmap — calls, reconnect, and debugging

Expose one logical `contract.call.<fn>` surface. Root routes use the normal
builder. Facet routes add the selected master, encode selector/args, configure the
delegate courier, and lay out root state/effect outputs. Final validation
recomputes the route and actual sizes. Reconnect from bundle plus deployment
record/root category and verify discovered facet category/brand. Debug traces show
the logical call followed by physical root/facet frames with merged source maps.

### C3 — existing proxy integration

Keep small `deployProxy(I)` as `P -> I`. For a split bundle, route `P` directly to
`Fi`; never call the normal split root as an intermediate router. Initialization
is root-local or one direct facet call. Document v1 as an immutable implementation
bundle: current upgrades migrate to a new proxy/state instance, unlike in-place
EIP-1967 upgrades. Mutable registries and two-proxy routing are separate work.

## 6. Phase D: tests and release gates

Compiler tests cover unchanged small output, deterministic forced splitting,
ABI/selectors/constructor/layout/source maps, complete helper closures, local
returns/views, one-function selector authentication, per-shard normal validation,
and stable unsupported/size diagnostics.
Add footprint tests for `R/R`, `R/W`, and `W/W`; scalar/struct aliases; constant,
disjoint, and wildcard mapping keys; array/chunk ranges; common-owner soft
affinity; effect resources; and unknown-call widening. Golden tests assert stable
groups and explain every forced union or cut affinity.

VM/adversarial tests cover A0–A2 plus replay against another same-layout proxy,
same-code/different-category and different-code substitution, every vmap proof mode,
chunks, multi-NFT state, effects, external calls, context, and timelocks.
Add call-graph fixtures for shared pure-helper duplication, stateful-helper
colocation, public-to-public calls, recursion/SCC colocation, oversized closures,
external self-calls, and calls to a different split contract. Raw tests co-spend
unused or substituted facet masters and prove that this cannot create a second
execution edge.

The optional A4 suite covers deterministic folding, exhaustive message delivery,
single settlement authority, replay protection, digest-bound payloads, and
monolithic equivalence. Artifact support alone cannot enable the feature flag.

SDK/regtest E2E covers normal split deploy/reconnect/calls, fees/change and failure
recovery; flattened split `deployProxy` with no intermediate router; real genesis
and brand checks without `categoryOverride`; and actual resource limits. The
release corpus is oversized Unicrow: deploy it, execute every supported public
transition across facets, run local return/view functions, reconnect, and compare
final state/events/transfers to the reference model.

The RC gate requires full solidc/solidcash/utils/E2E regression suites, artifact
compatibility, route/layout/transaction fuzzing, independent threat review of the
eight invariants, reproducible artifacts, and user documentation of topology,
cost, static binding, unsupported features, and migration-style upgrades.

## 7. Milestones

1. **Protocol green:** A0–A3 measurements and adversarial proofs checked in.
2. **Compiler preview:** forced split emits deterministic validated bundles.
3. **SDK preview:** normal split deploy/call/reconnect works on regtest.
4. **Proxy integration:** flattened split proxy and initializer tests pass.
5. **Corpus gate:** Unicrow's complete supported ABI/resource tests pass.
6. **RC gate:** security, compatibility, docs, and reproducibility are complete.

## 8. Deferred work

Authenticated synchronous facet returns and production enablement of the A4
inter-facet message/settlement protocol,
mutable registry with rollback authorization, full `P -> router -> facet`,
intra-function splitting, and silent automatic splitting all require separate
protocol proofs. They are not implied by v1's use of “proxy”.
