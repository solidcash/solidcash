# Layer 3 single-transaction bus: implementation handoff

## Mission

Replace the exact-root controller-NFT workflow with a complete, production-ready
single-transaction message bus. Composition, authorization, execution, and
settlement must occur in one Bitcoin Cash transaction. Artifact-specialized verifier
covenants are deployed once with each contract; no execution-specific UTXO may be
minted, confirmed, or prepared before a call.

This branch starts at `aa562953` from `codex/layer3-binding-spike`. The existing
controller-backed implementation is the behavioral and hostile-test corpus. It
is not the target architecture and must be removed when equivalent evidence
exists for the single-transaction protocol.

The independently extracted journal work lives on
`codex/journal-mainline-extraction`. Do not merge that branch wholesale here;
this branch already contains the journal implementation needed by SCB1.

## Required end state

The public workflow is one composition and one broadcast:

```ts
await layer3.compose({
  calls: [
    contractA.call.prepare(...),
    contractB.call.settle(...),
  ],
  funder,
  changeAddress,
}).send();
```

The SDK must not expose or require:

- controller genesis;
- a controller NFT or controller category;
- an execution-root preparation transaction;
- confirmation between composition and execution;
- projection inputs used only to distribute controller verification;
- `messageBusController` or `messageBusControllerCategory` compiler options.

## Protocol decision

Use compiler-specialized, self-preserved verifier covenants deployed at contract genesis.

Each contract deploys a configurable pool of `N` mutable verifier NFTs locked by the
verifier program generated from that contract's message-bus route. A composition consumes
and exactly recreates one verifier for every participant. The verifier carries the canonical
framed graph transcript as the first push in its unlocking bytecode and performs the heavy
global and local verification. The participant master retains only a compact binder which
pins its verifier bytecode, category, preservation, transcript, and exact verifier arguments.

This is not a controller or an execution authority: there is no shared category, privileged
owner, graph-specific root, or setup lifecycle. Verifiers are ordinary contract-owned genesis
resources, are specialized to the artifact, and self-preserve indefinitely. `N` controls the
number of concurrently spendable compositions involving that contract. Ordinary calls do not
consume a verifier and retain their existing spending path.

Do not make the transcript commit to the transaction ID, complete unlocking
bytecodes, or signatures contained within itself. It commits to semantic facts:

- protocol domain (wire compatibility follows the package semantic version; no redundant version byte);
- participant count, order, locking bytecodes, and master categories;
- authenticated actual block spans, compiler-published fixed prefixes and maximum capacities;
- selectors, call modes, arguments, results, callers, and completion positions;
- resource ownership and exact resource slots;
- events, value transfers, token effects, and return-event commitments;
- dynamic/trailing-region capacities and actual use;
- any oracle or sidecar slots required by admitted handlers.

## Canonical physical layout

For participant blocks `P0..Pn-1`:

```text
inputs/outputs:
  [P0 complete balanced block]
  [P1 complete balanced block]
  ...
  [Pn-1 complete balanced block]
  [P0 artifact-specialized verifier]
  ...
  [Pn-1 artifact-specialized verifier]
  [fee input / change output]
```

Rules:

1. `P0` starts at index 0.
2. `Pi.base = P(i-1).base + P(i-1).actualSize`; bases are derived, never encoded as caller-selected indices.
3. Each block has exactly one master at local offset 0.
4. Every fixed slot and every used trailing slot is present exactly once at `base + offset`; unused trailing
   capacity is physically absent.
5. One verifier for each participant occurs, in participant order, immediately after all blocks.
6. Every verifier carries identical carrier bytes; binders read the final verifier as the canonical carrier.
7. The fee input is the first index after the verifier region.
8. Outputs use the same absolute slot model as inputs; each verifier output exactly recreates its input
   locking bytecode, category, capability, token amount, value, and instance prefix.

The composer derives all indices. Application code supplies no global indices.

## Authorization policy

Separate transcript integrity from permission to compose.

The baseline implementation must support compiled policy authorization:

- each participant artifact publishes admitted incoming/outgoing selectors,
  call modes, argument/result schemas, and effect bounds;
- each participant verifies that all transcript rows involving it conform to
  that policy;
- participant master categories and locking bytecodes bind concrete identities;
  substitution changes the authenticated participant table;
- every row is owned and consumed exactly once.

If a source contract needs runtime authority over counterpart selection, add an
explicit data-signature or existing-state policy proof. Such authorization is
computed off-chain for the same transaction and must not require a preparatory
UTXO. Do not introduce a universal privileged signer as a protocol requirement.

## Security invariants

The implementation is incomplete until VM tests prove all of these:

1. **One transcript:** every verifier carries identical canonical bytes and every participant binder
   pins its verifier's carrier to the canonical final-verifier bytes.
2. **Exact participant set:** no participant can be omitted, duplicated,
   substituted, or reordered relative to the transcript.
3. **Contiguous blocks:** bases and sizes cover the participant prefix without
   gaps or overlap.
4. **Active membership:** every evaluating participant proves its active input
   is the master of exactly one framed block.
5. **Exact row consumption:** every invocation, result, caller, completion,
   event, resource, and settlement row is consumed once; no suffix is ignored.
6. **Call authenticity:** selectors, modes, arguments, callers, reachability,
   loop occurrence bounds, and results match compiler-authored SCB1 emissions.
7. **State authenticity:** master, data NFT, entry NFT, dynamic chunk, satoshi,
   and token-container transitions preserve ownership and settle exactly once.
8. **Effect authenticity:** value transfers, token transfers, events, and return
   events cannot be forged, redirected, duplicated, or left unclaimed.
9. **No replay authority:** verifier NFTs confer no independent authority; replay is prevented because
   participant UTXOs are consumed, while verifiers only attest the transaction that spends them.
10. **No circular commitment:** transcript construction remains possible before
    transaction signatures and produces stable bytes after signing.
11. **Fail closed:** unsupported recursion, aliases, dynamic cardinality,
    delegate context, introspection, or effect combinations produce named,
    positioned diagnostics rather than partial verification.
12. **Capacity:** admitted 2-, 4-, and 8-participant graphs fit actual BCH-2026
    consensus limits, or the compiler/SDK publishes and enforces a smaller
    measured bound.

## Migration map

### Preserve and adapt

- compiler message-bus handler discovery and SCB1 local row encoding;
- scalar, collection, and dynamic journals;
- balanced participant block descriptors and trailing-region metadata;
- compiler-derived call occurrence, caller, calldata, result, and effect tables;
- canonical participant ordering and framed transcript codec;
- SDK graph planning and whole-transaction assembly;
- refusal taxonomy and hostile VM fixtures;
- result/event/resource settlement checks that do not depend on controller
  authority.

### Replace

- controller-root lookup with verifier-carried transcript extraction;
- controller/projection verification with artifact-specialized self-preserved verifiers;
- controller-bound compiler preamble with inferred graph-participant context;
- controller-inclusive physical layout with participant blocks, participant verifiers, and fee tail;
- exact-root NFT lifecycle APIs with `compose(...).send()`;
- graph metadata that publishes controller identity with carrier and policy
  metadata.

### Remove after migration

- `messageBusController` and `messageBusControllerCategory`;
- controller genesis/deployment helpers and one-shot controller covenant;
- projection verifier artifacts and projection input/output construction;
- controller NFT preservation/burn/category scans;
- controller-specific transcript arguments and preflight rules;
- `__testLayer3BindingSpike` and production docs that rely on it;
- skipped controller-era production audits once replaced by live tests.

## Implementation phases

### Phase 0 — freeze baseline and requirements

1. Inventory controller/projection dependencies by source file and artifact field.
2. Classify existing tests as reusable, adaptable, or obsolete.
3. Record current byte sizes, operation counts, and maximum graph capacities.
4. Add a requirements matrix mapping every invariant above to planned tests.

Deliverable: committed protocol specification and executable baseline census.

### Phase 1 — codec and layout

1. Define a new domain for the controllerless transcript; do not duplicate the package semantic version on wire.
2. Define canonical carrier framing as the first push of every verifier unlocking bytecode.
3. Implement encode/decode with strict length and EOF checks.
4. Implement controllerless physical layout and artifact metadata.
5. Add mutation/property tests for every field and boundary.

Deliverable: pure codec/layout tests with no controller objects.

### Phase 2 — compiler-specialized verifier and compact binder

1. Generate an artifact-specialized verifier program and genesis covenant bytecode.
2. Bind active participant membership and contiguous block layout.
3. Verify compiler-published local policy and local transcript rows.
4. Generate a compact master binder pinning verifier code, category, preservation, carrier, and ABI arguments.
5. Prove global exact-consumption invariants without controller/projection inputs.
6. Infer graph participation; remove explicit hidden/controller admission flags.

Deliverable: two independently compiled participants reject all structural
mutations in the BCH-2026 VM.

### Phase 3 — SDK one-transaction composer

1. Derive participant order, blocks, calls, results, resources, and effects.
2. Encode one transcript into each participant verifier's canonical first push.
3. Build all participant inputs/outputs, verifier inputs/outputs, and fee/change tail in one builder.
4. Sign only after transcript and transaction structure are final.
5. Provide ergonomic `compose(...).send()` and offline build/sign APIs.

Deliverable: two-contract transaction built and broadcast with no prior setup.

### Phase 4 — semantic completeness

Port and prove, one family at a time:

- void and returning calls;
- repeated calls, fan-in, fan-out, branches, and bounded loops;
- logical `msg.sender`, `msg.sig`, `msg.data`, `msg.value`, and `tx.origin`;
- mapping/fixed-array/dynamic-state journals;
- value and token transfers;
- events and return-event vectors;
- blockhash, keccak/ecrecover sidecars, and trailing regions;
- delegate/static/raw call modes where sound.

Each family needs positive VM completion and hostile field-mutation tests.

### Phase 5 — capacity and optimization

1. Measure 2/4/8 participants and representative application graphs.
2. Attribute cost by duplicated global verification versus local verification.
3. Optimize without weakening exact-consumption or membership proofs.
4. Publish enforced limits in artifacts and SDK preflight.

Measure both the master binder and each artifact-specialized verifier. Contract deployment
may mint `N` self-preserved verifier instances; publish and test the resulting concurrency
bound. No verifier may be created in a setup transaction between deployment and composition.

### Phase 6 — removal and public API stabilization

1. Delete controller/projection implementation and APIs.
2. Delete compatibility paths that can silently select the old protocol.
3. Remove test-only semantic bypasses.
4. Rewrite public documentation and examples around one transaction.
5. Migrate all retained tests to inferred compiler behavior.

### Phase 7 — completion audit

Run and record:

```bash
yarn build
yarn lint
cd packages/solidc && yarn test --run
cd packages/solidcash && yarn test --run
```

Also run live BCH-2026/regtest capstones for at least:

- two heterogeneous contracts with a returning call and state settlement;
- three-contract transitive call chain;
- repeated ERC-20-style resource calls;
- event plus value/token effects;
- maximum admitted participant/resource shape.

Search the production tree for controller-era residue and justify every retained
match. Completion requires all invariants to have direct evidence, all public
examples to use one transaction, and no preparatory execution transaction.

## First implementation task

Start with Phase 0 and Phase 1, not compiler code generation:

1. create the requirements/test matrix;
2. inventory controller and projection dependencies;
3. specify the exact carrier byte grammar and controllerless physical layout;
4. implement pure codec/layout code and hostile mutation tests;
5. measure the existing controller baseline for comparison.

Do not preserve a controller abstraction under a different name. The defining
property is that the complete execution can be composed, signed, and broadcast
as one transaction using only existing participant/resource UTXOs and ordinary
fee funding.

## Suggested new-session prompt

```text
Work in /Code/cashscript/.worktrees/layer3-single-tx-bus on
codex/layer3-single-tx-bus. Follow
packages/solidc/docs/layer3-single-transaction-bus-handoff.md from Phase 0
through the verified finished implementation. Treat aa562953 as the
controller-backed behavioral baseline, not the desired architecture. Begin by
committing the requirements matrix, dependency inventory, carrier grammar, and
pure controllerless codec/layout tests. Do not require any setup transaction.
```
