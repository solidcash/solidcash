# Pre-message-bus work scope (handoff)

Author: Claude; corrected against the current specifications by Codex. Date: 2026-07-24.
Baseline: `codex/state-bus-research` at `0a0096f0`.

## 0. How to use this handoff

This separates **required gates from optional hardening before the message bus (Deferred Release A)**
- it does not implement the bus itself. "Message bus" here = the general multi-participant invocation
transcript / participant graph (`buffered-state-and-message-bus-research.md` sections 5, 8; the
deferred `invocation-transcript-v1.md`). The bus is explicitly gated by the spec's own go/no-go
(research doc 0.1: *"the general transcript is not ready to implement… no five-table format, carrier
controller, or general cycle route is frozen"*).

Do not start Deferred Release A codegen/SDK until the required gates in sections 3-4 pass and the
measured candidate is independently reviewed and frozen. Optional Phase A work may proceed in
parallel and is a prerequisite only where its acceptance gate says so. Read these first:
`journal-bus-implementation-status.md` (status),
`state-journal-audit.md` (journal soundness + the J1/J2/J5 findings), `compiler-hidden-batch-v1-audit.md`
(batch F1-F6), `compiler-hidden-batch-v1.md` (R0-5 spec, sections 7.1/10), `buffered-state-and-message-
bus-research.md` (sections 0.1, 5, 6.1, 8). Trust none of their annotations without re-verifying on
the rebuilt VM (`MockNetworkProvider.send()` = real `BCH_2026_05`).

## 1. Current state (what is already done)

Corpus proving-ladder rungs 1-4 are implemented and VM-tested: TreasurySplit / Marketplace / MasterChef
(R5 star topology), BentoBox-style owner-local batch (R4). Journal soundness holes J1 (inflation) and
J2 (burn) are fixed and regression-locked; J5 (event loss) fixed this pass. R5 is default-off with a
parameter-authorized two-row ERC-20 resource route. Rung 5+ (Kashi cook, Unicrow, Uniswap flash swap)
- the multi-participant/cyclic cases - are the bus and are **not** started.

The qualitative gap the bus must cross: everything shipped authenticates **one** immediate caller
via category-presence and the co-spent input's actual locking bytecode. A multi-participant transcript
must generalize that invariant to every participant while also proving owner uniqueness, exhaustive
streaming validation, and one settlement authority. The deferred candidate now specifies those
bindings in structural invariant 15, but no measured covenant implementation proves them yet.

## 2. Work phases (dependency order)

Sizing: S = hours, M = 1-3 days, L = ~1 week, XL = multi-week/research. Each item lists
What / Why-for-bus / Where / Acceptance / Risk.

### Phase A - optional v1 hardening and evidence improvements [~1-2 weeks]

These items improve feature coverage, diagnostics, or audit evidence. The accepted v1 surface is
already fail-closed. A1-A3 are not normative layer-3 prerequisites while their current rejection
boundaries remain explicit; A4 is strongly recommended before reviewing generalized participant
authentication.

**A1. J2 exit-aware write-back flushing.** [L, HIGH RISK]
- What: multi-entry journal wrappers containing an early `return` currently **reject at compile**
  (`LowerCollectionJournalHelpers.ts` ~180-205). Implement flushing entry write-backs before every
  control-flow exit instead of rejecting.
- Why useful: guard clauses are common and a future bus may reuse the same journal. This is feature
  completion, not a soundness prerequisite while the compiler rejection remains in force.
- Where: `LowerCollectionJournalHelpers.ts` `installMultiCaches` (~589-607) + the rejection loop
  (~183-205); interacts with `EarlyReturnTransformation` (runs later, `compiler.ts` ~902).
- Approach (safe): replace each `ReturnNode R` in the wrapper body with `Block[ ...clonedWriteBacks, R ]`
  (node replacement, NOT statement-list insertion), keep fall-through write-backs at the end.
- Acceptance: the original J2 burn repro (`payOnce(alice,bob,30,skip=1)` -> was `alice=0`) now
  settles `alice=70,bob=30` on the VM; add VM regressions for early-return / nested-return /
  loop-return / value-returning-wrapper; existing `CollectionJournalRelease3` stays green.
- Risk: HIGH - this is the exact code whose reorder caused a covenant-accepted fund burn. Any subtle
  error re-opens fund loss. Verify exhaustively or keep the sound rejection.

**A2. J3 clean diagnostics.** [S]
- What: a deploy (`new`) or transitive cast-form external call `IFoo(x).m()` in a scalar-journal
  helper fails closed but with a confusing internal error ("Block layout not available",
  param-arity mismatch). Make it a clear "not supported in a journal handler" compile rejection.
- Where: `InlineStoragePointerCalls.ts` `isScalarJournalEligible` (~253-289) - add AST backstops for
  `InstantiationNode` (deploy) and cast-receiver `MethodCallNode`; the effect fields it currently
  checks are `undefined` at pass time (populated by a later `SymbolTableTraversal`).
- Acceptance: both shapes throw a clear diagnostic at compile; no VM-level failure.
- Risk: low. Regression-check the whole compiler suite (over-rejection risk).

**A3. J4 compile-time rejection.** [S]
- What: a multi/non-tail-return returning state-array writer fails closed **at the VM**
  (`mandatory-script-verify-flag-failed`) instead of at compile. Make it a compile rejection.
- Where: `InlineReturningStateHelpers.ts` eligibility (single-tail-return only); the survivor reaches
  the scalar-journal off-by-R path. Reject at the journal-closure step or inline it correctly.
- Acceptance: the shape throws at compile; the single-tail array-push handler still inlines+settles.

**A4. F5 caller-authentication test.** [M]
- What: replace the over-determined R5 missing-caller negative
  (`RepeatedExternalBatchRelease5.test.ts:405-412`, which `splice`s out A's whole master input and so
  fails on value/token conservation + index shift, in a callee with no `msg.sender`) with a real
  caller-LBC-swap test.
- Why useful: this isolates the existing two-party caller-binding invariant and provides a concrete
  adversarial pattern for the generalized participant-binding review in C1/D4. It strengthens
  evidence; it is not the mechanism which creates layer-3 identity.
- Where: reuse `MsgSenderCrossContractC2.test.ts` fixtures (`Bank.deposit` writes `bal[msg.sender]`).
  Capture a valid `deposit` tx, forge a variant that swaps only the co-spent caller-master input from
  A to A' (and A's state output to A'), conserving input count/satoshis/token balances, leaving Bank's
  entry output at slot `H(A.LBC)`. Push raw; the covenant must reject because `slot == H(A'.LBC) !=
  H(A.LBC)`. Positive control: untouched A accepts; a genuine A' deposit credits `bal[A']`.
- Acceptance: the forged-caller tx is VM-rejected with all unrelated structure preserved; positive
  controls pass. See `compiler-hidden-batch-v1-audit.md` F5 (Test A).

### Phase B - establish observed need and target corpus [days]

This is normative layer-3 gate 1. It comes before freezing covenant surface.

**B1. Demonstrated demand.** [S]
- Document concrete bounded workloads which shipped R1-R5 cannot express. Candidate cases are a
  Kashi `cook` subset with result chaining, an Unicrow callback, and a Uniswap-style flash swap.
- Separate the first acyclic case from later cyclic cases. Deferred Release A needs an acyclic target;
  callbacks and flash loans belong to Deferred Release B.
- Acceptance: at least one real acyclic multi-participant workload is shown to be impossible under
  the current owner-local and repeated-single-callee routes, with its required call/result graph.

**B2. Corpus and size baseline.** [M]
- Record current deployed bytecode and available headroom for the target Effective Acceleration and
  split-corpus artifacts. This is a measurement input, not authorization to implement facet work.
- Sharded/faceted communication remains outside this work scope. In-scope outcomes are shared route
  extraction, ordinary subroutines, a smaller protocol, or an explicit measured rejection.

### Phase C - implement the current candidate as a disposable format/cost spike [XL, RESEARCH]

The current `invocation-transcript-v1.md` is corrected research prose, not frozen wire format. Build
only enough to test its invariants and costs; no production artifact advertises this spike.

**C1. Participant transaction binding.** [L]
- Implement structural invariant 15: each participant row binds its owner/executor locking bytecode,
  category, required capability, minimally selected SCB1 route, and exact controller prefix to actual
  co-spent inputs. Enforce disjoint/contiguous blocks and one logical owner/settlement authority.
- Historical note: revision 1 omitted this participation lemma and permitted forged logical
  `msg.sender`. The current candidate specifies the correction; the task is implementation and proof,
  not redesigning an absent requirement.
- Acceptance: fabricated rows, legacy-route participants, locking-bytecode/category substitution,
  duplicate owners, and a second settlement authority all fail in BCH-2026 VM tests.

**C2. Streaming structural validator and parser.** [L]
- Hand-emit a front-consuming parser/validator for canonical order, contiguous IDs/ranges, tree
  structure, unique resources/calls/effects, exact consumption, and bounded counts. Do not use random
  access or pairwise uniqueness scans.
- Start from the candidate ceilings (8 participants, 24 invocations, 24 resources, 8,192 encoded
  bytes), but treat encoded length and VM limits as authoritative. These ceilings are hypotheses.

**C3. Projection and exhaustiveness spike.** [L]
- Prove every declared participant executes the same transcript and every owner projection consumes
  exactly its inbound/outbound ranges, results, effects, and events. Demonstrate the smallest acyclic
  target from B1; cycles remain rejected.

**C4. Auto-derivation graph design.** [XL]
- Specify a finite worklist which discovers runtime targets and ordered result dependencies,
  deduplicates physical participants without deduplicating logical invocations, derives intermediate
  journals, and reports duplicate identity, future-result cycles, unresolved artifacts, contention,
  and size deterministically.
- Acceptance: the B1 acyclic case is constructed on paper and by an SDK prototype without duplicate
  physical owner inputs.

### Phase D - measure, revise, review, and freeze [multi-week]

Phases C and D are an iterative loop: measurements may force changes to encoding, bounds, or even a
no-go decision. Freeze only after the final measured implementation passes all six normative gates.

**D1. Measured frozen cost and real-corpus fit.** [L]
- Under `BCH_2026_05`, record controller/redeem bytes, operation cost, pushed bytes, hash iterations,
  stack/memory peaks, unlocking sizes, and full transaction size for realistic 2/3/8-participant and
  candidate-maximum payloads.
- Measure fixed overhead on the B2 corpus near the 10,000-byte wall. Target roughly 800 bytes or less
  of fixed redeem-script overhead per participant; higher results require an explicit utility review.
- The old revision-1 draft expanded to roughly 57 KB. Current 8/24/24 ceilings avoid promising those
  maxima, but remain unproven until these measurements pass.

**D2. Immutable-version interoperability.** [M]
- Define exact-common-version negotiation, bounded route retention, and predictable failure for
  incompatible immutable deployments. Measure retained-parser cost; a version byte is insufficient.

**D3. Owner uniqueness and contention/liveness.** [M]
- Separately prove on-chain owner uniqueness/one settlement authority and benchmark off-chain
  stale-input/retry behavior as participant count grows. Alias diagnostics do not substitute for
  cross-transaction liveness measurements.

**D4. Independent hostile review.** [M]
- Review participant binding, caller authentication, owner uniqueness, exhaustive streaming
  validation, acyclic result semantics, version behavior, and every limit. Resolve all fail-open
  findings against the measured implementation.

**D5. Freeze or no-go.** [S]
- Freeze exact bytes, controller prefixes, parser, bounds, version rules, and diagnostics only if
  B1/B2 and D1-D4 pass. Otherwise record a no-go and leave layer 3 disabled.

### Parallel product track - optional R5 expansion/default enablement

This track is useful but is not a normative prerequisite for Deferred Release A.

- A standard `msg.sender`-authorized ERC-20 `transferFrom` route remains unsupported because direct
  and SCB1 introspection/resource contexts diverge. R5 already derives its immediate caller from the
  actual co-spent A locking bytecode; the missing work is route equivalence, eligibility, alias/cold
  resource handling, and size, not invention of caller-LBC authentication.
- Any material R5 expansion requires sequential-oracle VM tests, deployed-size measurements, and a
  fresh independent review before default enablement.
- The current parameter-authorized route already satisfies the frozen R5 proving shape. Default-on
  policy and standard ERC-20 support should not silently become layer-3 adoption gates.

## 3. Dependency graph

```
B1 observed acyclic need + B2 corpus baseline
                       │
                       v
C1 transaction binding + C2 streaming validator
                       │
                       +--> C3 projection/exhaustiveness
                       +--> C4 derivation graph
                                      │
                                      v
                 D1 cost/corpus measurement <--> candidate revision
                       + D2 version interoperability
                       + D3 uniqueness and contention/liveness
                                      │
                                      v
                         D4 independent hostile review
                                      │
                                      v
                           D5 freeze or explicit no-go
                                      │
                                      v
                    [Deferred Release A: acyclic graph only]

A1-A3 optional v1 feature/diagnostic work and A4 stronger evidence may run in parallel.
The optional R5 `msg.sender`/default-on product track may also run in parallel.
```

The spike/revision loop is deliberate: cost evidence may require changing encoding or bounds before
review and freeze. No frozen bytes or production capability are emitted during that loop.

## 4. Hard gates - do NOT start the bus until all hold

Research section 0.1 summarizes four headline gates; section 8's “Additional go/no-go gates” expands
the normative checklist to the six substantive layer-3 gates below. Items 1 and 8 preserve the v1
soundness boundary and release ordering around that checklist.

1. No known fail-open defect in an accepted v1 shape; every unsupported journal shape has an explicit
   fail-closed boundary. J2 may remain explicitly scoped rather than feature-complete.
2. **Observed need:** a real bounded acyclic workload cannot be expressed by R1-R5.
3. **Measured frozen cost:** complete parser, validator, transaction binding, projection, and full
   transactions fit BCH-2026 budgets at selected participant limits.
4. **Real-corpus fit:** fixed overhead leaves the target Effective Acceleration/corpus artifacts
   deployable, or an explicit utility review accepts a narrower supported set.
5. **Version interoperability:** immutable peers negotiate an exact common version with bounded
   retention cost and predictable incompatibility.
6. **Contention/liveness:** stale-input and retry behavior is measured as participant count grows;
   selected defaults follow those results.
7. **Independent review:** participant binding, caller authentication, owner uniqueness, exhaustive
   streaming validation, and acyclic result semantics pass hostile review.
8. The bus starts **acyclic only** (Deferred Release A). Cycles/callbacks/flash loans are Deferred
   Release B, separately adoptable after A.

## 5. Known landmines

- **L1 (participation lemma):** revision 1 was forgeable; the current candidate specifies the
  corrected invariant 15. Do not implement the old row semantics, and do not treat corrected prose
  as proof until the C1 covenant and hostile tests exist.
- **L2 (burn code):** `installMultiCaches` (A1) is the code whose reorder caused a covenant-accepted
  fund burn. Treat every change as security-critical; VM-verify or keep the sound rejection.
- **L3 (size wall):** the 10,000-byte contract limit is hard. D1/B2 must prove corpus fit; sharding is
  not silently pulled into scope as the answer.
- **L4 (untrusted SDK):** construction-time alias/cold checks improve diagnostics but cannot prove
  participant identity, uniqueness, or settlement. The layer-3 covenant must enforce its own
  invariant set even when the SDK witness is hostile.
- **L5 (measurement flakiness):** the heavy resource-shape compile (`HiddenBatch` "allocates one exact
  two-row resource shape") times out at 5s under concurrent CPU load; run measurement single-threaded.
- **L6 (build/dist):** never rebuild `solidc` while a dist-importing suite runs; rebuild, then test.

## 6. Effort summary

| Phase | Items | Rough size |
|---|---|---|
| A optional hardening | J2 exit-aware (L, high-risk), J3/J4 diagnostics (S), F5 test (M) | 1-2 weeks |
| B evidence | observed acyclic need and corpus/size baseline | days |
| C disposable spike | transaction binding, streaming validator, projection, derivation design | multi-week research |
| D gates/freeze | cost/corpus, versions, contention, independent review, freeze/no-go | multi-week research |
| Parallel R5 track | optional standard ERC-20 shape/default enablement | independent XL research |

The critical path is observed need -> a disposable implementation of the current participation and
streaming invariants -> measured revision -> independent review -> freeze. Immediate caller identity
already exists in R5; layer 3 must prove that identity and one settlement authority for every
participant in one canonical graph.

## 7. Execution plan for the large effort

### Milestone 0 - preserve the trusted baseline

Before spike work:

1. create a new worktree from this branch rather than mixing the spike into the v1 implementation;
2. record the exact baseline commit and build/test totals;
3. keep all existing artifact capability metadata and compiler defaults byte-identical;
4. prohibit production code from advertising a layer-3 selector, version, or controller prefix;
5. keep R5 default-off and do not reuse its experimental flag for the spike.

The spike may use test-only helpers and generated scripts. If it requires production compiler
plumbing for measurement, that plumbing must be inert without a test-only entry point and must not
change emitted artifacts.

**Baseline gate**

```text
yarn build
packages/solidc: complete suite
packages/solidcash: complete suite
git diff of representative direct/R1-R5 artifacts: byte-identical
```

### Milestone 1 - observed-need dossier

The first deliverable is evidence, not code:

- choose the smallest bounded acyclic Kashi `cook` subset;
- list its participants, physical state owners, invocation preorder, result dependencies, and
  concrete resources;
- prove why R4 owner-local batching and R5 one-repeated-callee grouping cannot express it;
- define a sequential reference interpreter and expected final state;
- record a smaller synthetic 2-participant/3-invocation case for parser debugging only.

Deliverable: `packages/solidc/docs/layer3-target-corpus.md`.

**Stop condition:** if no real acyclic workload remains after R1-R5 auto-derivation, record no
observed need and stop layer-3 work.

### Milestone 2 - transaction-binding spike

Implement only the participation lemma and canonical participant blocks:

- encode the current candidate participant row;
- bind owner/executor input locking bytecode, category, capability, selected route, and controller
  prefix;
- require strict owner-key order and reject duplicate logical owners;
- require contiguous, non-overlapping participant input/output blocks;
- prove one settlement authority for each state owner.

Start with two participants and no general invocation/resource tables. This isolates identity from
parser complexity.

Suggested test surface:

```text
packages/solidc/test/Layer3ParticipantBindingSpike.test.ts
packages/solidcash/test/e2e/Layer3ParticipantBindingSpike.test.ts
```

Required hostile cases:

- fabricated participant row;
- locking-bytecode, category, capability, input-index, and route substitution;
- legacy artifact or legacy route;
- duplicate owner under a different participant ID;
- two settlement authorities for one category;
- executor substitution and illegal owner/executor overlap;
- untouched positive transaction.

Every negative must preserve unrelated transaction structure sufficiently to identify the intended
covenant check. A construction-time SDK rejection is not evidence for an on-chain invariant.

### Milestone 3 - streaming parser and validator

Add tables incrementally:

1. header/count bounds and exact blob consumption;
2. participant order and blocks;
3. resource ownership/ranges and unique mutable input indices;
4. invocation preorder, parents, and `subtreeEnd`;
5. callsite occurrence uniqueness;
6. effect/event output ranges.

For each step, freeze a measurement snapshot before adding the next table. Parsing must be
front-consuming and single-pass. Test decoy magic, non-minimal pushes, truncation at every field,
unknown flags/kinds, count substitution, trailing suffixes, duplicate keys, and malformed ranges.

Suggested compiler test:

```text
packages/solidc/test/Layer3FormatCostSpike.test.ts
```

The test should emit a structured metrics record containing:

```text
encoded bytes
redeem/controller bytes
unlocking bytes per input
transaction bytes
evaluated instructions
operation cost / maximum operation cost
stack-pushed bytes
hash iterations
peak stack items/bytes
```

### Milestone 4 - acyclic projection and derivation

Implement only enough projection to execute the Milestone-1 Kashi subset:

- deterministic invocation preorder;
- one live journal per owner;
- authenticated child result consumed by its parent;
- one physical owner input/output block per participant;
- exact inbound/outbound range consumption;
- SDK finite worklist with deterministic termination.

Explicitly reject:

- back-edges/callbacks;
- future-result dependencies;
- unresolved dynamic targets;
- duplicate physical owners not collapsed into one participant;
- graphs or blobs beyond measured bounds.

Compare every accepted execution with the sequential reference interpreter. Attack omitted,
injected, reordered, duplicated, and substituted invocations/results/resources.

### Milestone 5 - measurement and revision loop

Run the complete candidate at:

- smallest synthetic case;
- selected Kashi subset;
- realistic 2-, 3-, and 8-participant distributions;
- each proposed maximum independently and a realistic combined near-maximum.

Check measurements into a stable fixture rather than only a prose table. Any encoding or bound
change invalidates prior measurements and returns to Milestone 3.

**No-go triggers**

- fixed covenant overhead makes the target corpus undeployable;
- parser/projection exceeds BCH-2026 operation, stack, item, script, unlocking, or transaction limits;
- no bounded version-retention strategy fits;
- retry/stale-input behavior is impractical at the useful participant count;
- participant/exhaustiveness soundness requires pairwise or random-access validation that does not
  fit the measured budget.

### Milestone 6 - independent review and freeze

Give the reviewer:

- exact candidate encoding and controller-prefix bytes;
- generated covenant sources/bytecode and source maps;
- sequential reference interpreter;
- all positive and hostile raw transactions;
- measurement fixtures and reproduction commands;
- version and contention results;
- explicit unsupported graph classes.

Only after all findings are resolved may the normative document freeze exact bytes and enable
Deferred Release A implementation. The frozen release remains acyclic.

## 8. Validation matrix

| Property | Compiler/static evidence | SDK/construction evidence | BCH-2026 covenant evidence |
|---|---|---|---|
| canonical encoding | deterministic encoder + byte fixtures | exact-common-version selection | minimal parsing + exact exhaustion |
| participant identity | owner-key sort and duplicate diagnostics | actual input/resource resolution | LBC/category/capability/route/controller equality |
| one settlement authority | owner/resource graph analysis | one physical owner block | unique owner/block/output checks |
| invocation exhaustiveness | canonical preorder/range metadata | finite worklist | complete row/range consumption |
| sequential equivalence | reference interpreter | derived journals/results | authenticated final owner/resource outputs |
| boundedness | static/candidate limit diagnostics | complete VM preflight | all input budgets and standardness pass |
| version behavior | advertised exact versions | intersection or deterministic failure | selected route parses only its exact version |
| contention/liveness | alias/owner diagnostics | stale-input/retry benchmarks | not an on-chain safety claim |

No property is considered proven solely because the SDK refuses to construct a transaction.

## 9. Commit and review discipline

- Commit each invariant or table independently with its positive, negative, and cost regression.
- Never combine an encoding change with unrelated journal/R5 work.
- Rebuild `solidc` before any dist-importing SDK suite; do not rebuild concurrently with those tests.
- Run heavy cost tests single-threaded and distinguish deterministic budget regression from timeout.
- Keep measurement changes reviewable: state why bytes/operations changed and which release owns the
  regression.
- After every candidate-format change, re-run all earlier malformed-input vectors.
- Preserve a clean rollback point at the last measured candidate.

## 10. First work package ready to start

The next implementation turn should perform only Milestones 0-1:

1. create the dedicated spike worktree;
2. pin baseline build, compiler, SDK, and byte-identity evidence;
3. extract the bounded acyclic Kashi `cook` target from the surveyed corpus;
4. write its participant/invocation/resource/result graph and sequential oracle;
5. issue an observed-need go/no-go.

Do not begin transcript code in the same turn unless the observed-need gate passes with a concrete
acyclic target. If it passes, the following work package is Milestone 2's two-participant
transaction-binding spike—not the five-table format and not cycle support.
