# Message-bus full-spec completion handoff for Opus

> **SUPERSEDED EXECUTION HANDOFF.** Releases A-J's technically implementable rows are complete. Current
> readers should use `message-bus-HANDOFF.md` and `message-bus-completion-ledger.md`. Recorded final evidence:
> bus sweep 115 files / 1,321 passed / 11 skipped; `solidc` 2,807/2,807; capstones 53 passed / 6 skipped;
> union proof 145/213. Current-byte A13/C2/C1/C3 are also accepted and mined by BCHN v29.0.0 with paired
> hostile refusals. Independent review and product-demand/default-on decisions remain explicit graduation
> gates. The instructions below are retained as the historical execution record.

## Mission

Complete every technically implementable, non-process requirement in
`message-bus-completion-ledger.md` without weakening the covenant security model,
the balanced-block invariant, Solidity call semantics, or BCH-2026 deployability.

The statement “the spec is not finished, and I cannot finish it” is too broad.
The remaining engineering is substantial but implementable. Only these final
graduation inputs intrinsically require evidence outside the implementation:

1. independent covenant-review sign-off;
2. real product/corpus demand supporting a frozen general protocol.

Participant-contention behavior is still an engineering deliverable: implement
a reproducible stale-outpoint model and regtest stress harness. Production data
can later strengthen that evidence.

Do not mark the goal complete merely because external process gates remain.
Finish the technical rows, prepare the external-review package, and leave only
the genuinely external sign-offs explicitly pending.

## Repository and baseline

- Worktree: `/Code/cashscript/.worktrees/layer3-binding-spike`
- Branch: `codex/layer3-binding-spike`
- Baseline commit at this handoff: `18135893`
- The worktree was clean when this document was created.
- Consensus and policy target: BCH May 2026 (`BCH_2026_05`).
- Sharded/faceted contracts remain excluded from this specification.
- Layer 3 remains experimental/default-off until the graduation gates pass.

Recent foundational commits:

- `7ad4eb67`: cross-function bytecode outlining;
- `65dae80b`: journal `msg.sender`-keyed resource handlers;
- `cd65c5ec`: two caller-authorized `transferFrom` rows on BCH-2026;
- `99203e77`: caller-keyed transfer admission, nested collection routes, clean
  batched-delete rejection;
- `bee674fb`: caller-keyed `transfer` VM proof;
- `18135893`: caller-keyed `approve` VM proof and ledger reconciliation.

Current focused suites are green:

- utils outlining;
- compiler HiddenBatch;
- compiled Layer-3 graph controller.

Run the full build/test/lint baseline before the first feature commit and record
the exact counts in the implementation log.

## Authority and soundness model

The SDK is an untrusted witness constructor. Every accepted transaction shape
must be justified entirely by covenants and BCH consensus.

Preserve these invariants throughout:

1. Every logical state owner has exactly one physical master input and one
   settlement authority.
2. Owner identity is the actual co-spent input locking bytecode plus its
   category/capability, never a witness-declared address.
3. Every participant agrees on one canonical execution transcript/root.
4. Every reached source call contributes exactly one canonical invocation row;
   omitted, injected, reordered, or substituted rows fail.
5. Each handler reads prior journal writes and every dirty resource flushes
   exactly once.
6. Results are authenticated by their producer and consumed with exact ABI byte
   equality and type.
7. Static calls cannot dirty state or emit effects.
8. Each contract occupies one contiguous balanced block with equal input and
   output slot counts.
9. Output-only semantics receive paired funding inputs; input-only proofs receive
   authenticated neutral outputs.
10. Event transport uses ordinary 1,000-satoshi event NFTs, permissionlessly
    spendable after 144 blocks. The bus does not require OP_RETURN transport.
11. Every input must pass the real BCH-2026 VM and remain below the 10,000-byte
    input-script limit and operation-cost budget.
12. Unsupported or unanalyzable shapes fail at compile/construction time. Never
    convert a fail-closed boundary into an unchecked witness path.

The balanced layout is not optional formatting. It is the composition rule:

```text
physicalInput  = blockBase + localSlot
physicalOutput = blockBase + localSlot
```

The final funding input is paired with the final change output.

## Normative sources and precedence

Read these completely before implementation:

1. `message-bus-completion-ledger.md` — live requirement/status authority.
2. `buffered-state-and-message-bus-research.md` — semantic rationale and surveyed
   contract corpus.
3. `compiler-hidden-batch-v1.md` — shipped owner-local/repeated-owner protocol.
4. `balanced-block-layout-composability.md` — required physical block layout.
5. `invocation-transcript-v1.md` — general semantic candidate and security
   invariants.
6. `layer3-erc20-continuation-handoff.md` — completed size/journaling milestone.
7. `state-journal-audit.md`, `compiler-hidden-batch-v1-audit.md`, and Layer-3
   audit/re-audit documents — previously discovered failure classes.

Resolve the apparent status conflict as follows:

- the full synchronous semantics in `invocation-transcript-v1.md` are the target;
- its exact wire encoding remains revisable until parser, size, corpus, and
  compatibility measurements pass;
- do not freeze or advertise a general version merely by copying the research
  candidate;
- once implemented and measured, update the candidate into a normative frozen
  format or write a superseding specification.

## Current implementation map

Compiler:

- `packages/solidc/src/compiler.ts`
  - hidden-route eligibility and synthesis;
  - caller-key witnesses;
  - resource-shaped handlers and parser helpers;
  - graph metadata.
- `packages/solidc/src/analysis/InvocationAnalysis.ts`
  - call footprint and closure analysis.
- `packages/solidc/src/semantic/LowerCollectionJournalHelpers.ts`
  - value-threaded C2 journal handlers and wrapper caches.
- `packages/solidc/src/semantic/LowerDynamicStateJournalHelpers.ts`
  - dynamic-state journal lowering.
- `packages/solidc/src/generation/GenerateTargetTraversal.ts`
  - covenant code generation, external calls, state resources, outState,
    introspection, block layouts, OP_DEFINE/OP_INVOKE.
- `packages/utils/src/outline.ts`
  - repeated cross-function span outlining.

SDK:

- `packages/solidcash/src/layer3/hidden-batch.ts`
  - canonical SCB1 planning/encoding.
- `packages/solidcash/src/layer3/graph.ts`
  - compiled graph planning, physical layout, route arguments, transcript
    finalization.
- `packages/solidcash/src/layer3/derive-native.ts`
  - currently bounded native external-call derivation.
- `packages/solidcash/src/layer3/transcript.ts`
  - transcript encoding and balanced transaction assembly.
- `packages/solidcash/src/layer3/covenant.ts`
  - controller/projection/participant generators and balanced layouts.
- `packages/solidcash/src/layer3/codec.ts`
  - candidate codec/spike utilities.

Primary executable evidence:

- `Layer3CompiledGraphController.test.ts`
- `Layer3Balanced*.test.ts`
- `Layer3Cycle.test.ts`, `Layer3Cycles.test.ts`
- `Layer3ResultChain.test.ts`
- `Layer3Exhaustiveness.test.ts`
- `Layer3Heterogeneous.test.ts`
- `Layer3NPartyMutual.test.ts`
- `Layer3ProductionAudit.test.ts`
- `RepeatedExternalBatchRelease5.test.ts`
- `RepeatedExternalBatchCorpus.test.ts`
- `HiddenBatch.test.ts`

Treat older `*Spike.test.ts` files as mechanism/cost evidence, not automatically
as production-semantic proof. Prefer adding proof to compiled graph and balanced
production fixtures.

## Remaining work: ordered vertical releases

Each release must be safe to stop at permanently, keep existing direct and R4/R5
paths working, add hostile BCH-2026 VM tests, update the ledger, and commit
independently.

### Release A — close admitted handler semantics

Goal: remove coverage-only uncertainty before widening protocol structure.

Implement and VM-prove:

1. modifiers on graph handlers, including a hostile authorization failure;
2. string and custom-error `revert`;
3. `while`, `do/while`, early exit, break, and continue with exact reached-row
   exhaustion;
4. multi-argument events with exact identity/topic/data/count;
5. `mint` and `burn` through real balanced compiled-graph settlement;
6. route equivalence between one direct invocation and one SCB1 invocation.

Keep unsupported early-return journal shapes fail-closed unless exit-aware
flushing is implemented and exhaustively VM-tested.

Acceptance:

- all relevant ledger rows are either PROVEN for a clearly named admitted class
  or retain a precise structural exclusion;
- no compiler-only admission test is called execution proof.

### Release B — general multi-handler owner journal

Goal: lift `resource-shaped-route-requires-one-handler`.

The owner route must admit an ordered mix such as:

```text
transfer -> approve -> transferFrom -> mint -> burn
```

Requirements:

1. union the concrete entry/resource descriptors for all reached handlers;
2. canonicalize by full structural storage identity, not identifier names;
3. resolve aliases so one physical entry has one pending journal value;
4. preserve invocation order while authenticating one final flush per resource;
5. support different selectors and argument schemas in one owner batch;
6. prove duplicate/cold/alias conflicts fail closed;
7. preserve caller-key binding independently per row;
8. keep artifact/input size and operation density pinned.

VM tests must include:

- mixed ERC-20 ordering with intermediate read-your-writes checks;
- same entry touched by several handler types;
- insufficient balance/allowance midway through the batch;
- forged selector, arguments, caller key, row order, and post-state;
- mint/burn supply or backing invariants applicable to the chosen token fixture.

### Release C — complete resource backend composition

Goal: connect all existing authenticated state backends to one graph journal.

Implement:

1. mapping insertion and deletion;
2. nested mappings with dynamic keys;
3. fixed arrays;
4. bytes/string replacement and overwrite semantics;
5. dynamic arrays and chunked values;
6. token containers and token effects;
7. runtime-varying aliases with canonical structural identities.

Reuse existing C2/chunk/container proofs. Do not invent a parallel Layer-3 state
authority.

For every resource class test:

- existing/read/update;
- cold insertion;
- deletion;
- alias/dedup;
- omitted or substituted input;
- forged commitment/value/category/capability;
- exact output ownership and one flush.

### Release D — typed results and suspension/resumption

Goal: lift the one-common-scalar return restriction.

Implement:

1. zero, one, tuple, bytes/string, struct, and heterogeneous result types;
2. producer-authenticated ABI bytes;
3. result dependencies consumed by later calls and parent computation;
4. nested and transitive result chains;
5. callback/cycle suspension and resumption without executing a physical input
   twice;
6. rejection of impossible value/result dependency cycles.

Build an explicit invocation dependency graph:

- execution edges may cycle structurally;
- result-dependency edges must have a resolvable evaluation order;
- SCC analysis must reject a cycle requiring an unavailable future result;
- owner settlement still occurs once after all logical invocations.

Do not model cycles as UTXO reentrancy. They are authenticated logical edges in
one atomic transaction.

### Release E — full logical context and call modes

Implement transcript semantics for:

1. `outState` at the correct logical settlement boundary;
2. aggregate and per-invocation `msg.value`;
3. relevant transaction introspection with documented physical-transaction
   semantics;
4. broader runtime staticcall dirty/effect snapshots;
5. existing pinned one-hop delegatecall authority;
6. signature-bearing handlers, preserving the existing signing model;
7. supported low-level/opaque calls with exact calldata and result binding.

Explicitly document unavoidable BCH divergences. Never emulate an imagined
per-call transaction.

Delegate mode must bind:

- proxy owner;
- executor input and locking bytecode;
- executor SCB1 route;
- brand/category relationship;
- full-state authority;
- exactly one settlement controller.

### Release F — compiler-complete invocation summary

Compiler artifacts must emit enough metadata to derive the graph without
hand-authored rows:

1. stable handler IDs/selectors and protocol versions;
2. callsite IDs and occurrence rules;
3. target expressions and possible target sets;
4. canonical argument expressions/types;
5. result producers/consumers;
6. state/resource footprints;
7. events and effects;
8. call mode;
9. boundedness and loop limits;
10. failure diagnostics for unresolved or impossible chains.

Extend analysis to:

- expressions;
- dynamic targets;
- bounded loops;
- internal/external function pointers;
- explicit source batches;
- returning and transitive calls;
- duplicate owner authorities;
- result-dependency SCCs.

Compile-time errors must explain the callsite and exact unresolved property.

### Release G — owner-reusing symbolic graph worklist

Replace bounded/preorder derivation with a general worklist:

1. start from the requested root call;
2. expand compiler-emitted callsites;
3. evaluate/resolve bounded target alternatives;
4. intern logical owners by authenticated identity;
5. acquire each physical owner/resource input once;
6. accumulate ordered invocation rows;
7. stabilize resources, effects, events, and results to a fixed point;
8. reject unresolved or ambiguous graphs;
9. generate one canonical transcript and per-owner projection;
10. run a final complete BCH-2026 VM probe for every input before broadcast.

The derivation algorithm may be iterative off-chain, but no convergence result
is trusted on-chain. Covenants verify the final fixed point.

### Release H — independently relocatable balanced blocks

Current blocks share a precomputed global layout. Replace that coupling with
compiler-owned local slot descriptors plus a relocatable block base.

Requirements:

1. each artifact declares its local balanced block;
2. all internal references are `blockBase + localSlot`;
3. a composer concatenates heterogeneous blocks without recompilation;
4. controller/projection/fee tail remain balanced;
5. resources, results, effects, and event NFTs stay within owner block bounds;
6. arbitrary admitted combinations compose, including cycles and heterogeneous
   participants.

Test permutation and insertion of unrelated blocks. A block must remain valid
when its base moves without changing its local semantics.

### Release I — general transcript format and version interoperability

Only after Releases A-H establish actual semantics:

1. compare inline replicated blobs, nulldata, and any carrier candidate under
   BCH-2026 standard policy;
2. implement a single-pass, front-consuming canonical parser;
3. require exact table ordering, uniqueness, bounds, exhaustiveness, and trailing
   byte rejection;
4. bind every participant to its actual owner/executor input;
5. measure participant/resource/invocation/event/effect ceilings;
6. define immutable artifact version negotiation;
7. retain at most `MAX_BATCH_PROTOCOLS_PER_ARTIFACT = 2`;
8. measure the byte/op cost of every retained route;
9. prove v1-only, v2-only, common-version, and no-intersection behavior;
10. freeze the format only after hostile review and corpus measurement.

Do not resurrect the old forgeable participant-table candidate. Invariant 15's
actual-input locking-bytecode/category/capability/executor binding is mandatory.

### Release J — limits, contention, policy, and review package

Build reproducible evidence:

1. contract/redeem/input/transaction byte budgets;
2. instruction and operation-cost density;
3. stack items, combined stack bytes, and function-table limits;
4. standard relay policy on BCHN regtest;
5. corpus transactions from Mistswap and Effective Acceleration contracts;
6. stale-outpoint/contention simulation varying participant count and activity;
7. retry/backoff strategy and failure-probability reporting;
8. immutable-version compatibility matrix;
9. attack-first independent-review package.

Separate:

- technical implementation complete;
- external review signed off;
- demand justifies protocol freeze;
- feature default-on.

The first is achievable in-repository. The latter three are graduation decisions.

## Cross-function outlining warning

`packages/utils/src/outline.ts` is now consensus-sensitive infrastructure.

Preserve or strengthen these relocation barriers:

- balanced `OP_IF`/`OP_NOTIF`/`OP_ELSE`/`OP_ENDIF`;
- balanced `OP_BEGIN`/`OP_UNTIL`;
- no `OP_DEFINE`;
- no `OP_ACTIVEBYTECODE`;
- no `OP_CODESEPARATOR`;
- no signature opcode whose meaning depends on active bytecode;
- no moved require/console source anchor;
- no helper-ID collision;
- bounded function count and identifier width.

Every feature release must run compiled-graph VM tests, not only compiler unit
tests. The first outliner implementation passed the compiler suite while an
unbalanced `OP_ELSE` broke nine positive graph transactions.

As scripts shrink, BCH operation-budget density rises. Pin both absolute work
and percentage of available budget.

## Commit and validation discipline

Commit each vertical release separately and verbosely. Before each commit:

```bash
yarn workspace @solidcash/utils build
yarn workspace solidc build
yarn workspace solidcash build
yarn workspace @solidcash/utils test
yarn workspace solidc test
yarn workspace solidcash test
yarn lint
git diff --check
```

For long work, run focused suites continuously, but do not substitute focused
tests for the full gate.

Do not silently re-pin measurements. Explain every material movement and retain
a ceiling/headroom assertion.

Never use bare `rejects.toThrow()` as the only hostile evidence when a
construction-time failure could satisfy it. Pair negatives with:

1. an honest positive control;
2. a check that transaction construction completed;
3. a specific VM/covenant rejection where practical.

## Ledger update rule

After each release:

1. update `message-bus-completion-ledger.md`;
2. cite exact tests and admitted semantic boundaries;
3. distinguish compiler admission from BCH-2026 execution proof;
4. leave a row PARTIAL if any normative class remains;
5. append an implementation-log entry with commits and measurements.

The technical implementation is complete when every non-process requirement is
PROVEN or the normative specification is explicitly narrowed with user approval.
Do not narrow it merely to obtain green status.

## Definition of done

Technical completion requires all of the following:

1. every non-process ledger row is PROVEN with hostile BCH-2026 evidence;
2. arbitrary admitted synchronous graphs derive from source calls without
   hand-authored invocation rows;
3. mixed handlers, resources, results, effects, events, callbacks, and cycles
   settle once per owner;
4. independently relocatable balanced blocks compose;
5. version negotiation and bounded immutable compatibility are implemented;
6. every final input passes a complete real-VM preflight;
7. standard-policy/regtest, corpus, size, density, and contention gates are
   reproducible;
8. the external-review package is current and attack-oriented;
9. only independent review, real demand evidence, and the default-on decision
   remain externally pending.

At that point report:

> Technical specification implemented; external graduation gates pending.

Do not report “entire specification complete” or enable by default until the
external gates are actually satisfied.

## Copy/paste execution prompt for Opus

```text
Work in /Code/cashscript/.worktrees/layer3-binding-spike on
codex/layer3-binding-spike. Read AGENTS.md and then completely read:

1. packages/solidc/docs/message-bus-opus-completion-handoff.md
2. packages/solidc/docs/message-bus-completion-ledger.md
3. packages/solidc/docs/buffered-state-and-message-bus-research.md
4. packages/solidc/docs/compiler-hidden-batch-v1.md
5. packages/solidc/docs/balanced-block-layout-composability.md
6. packages/solidc/docs/invocation-transcript-v1.md
7. the journal, hidden-batch, and Layer-3 audit documents referenced by the handoff.

Continue autonomously through Releases A-J in the handoff. The technical work is
finishable. Do not stop merely because independent review or product-demand
evidence is external: finish every in-repository technical requirement and
prepare those external gates.

Keep the SDK an untrusted witness constructor. Preserve actual-input owner
binding, one authority/flush per owner, exact reached-row exhaustiveness,
producer-authenticated results, staticcall immutability, balanced block layouts,
event NFTs, BCH-2026 deployability, and fail-closed unsupported shapes.

Every release must provide honest positive controls, hostile BCH-2026 VM
negatives, measured byte/op headroom, a ledger update, full build/test/lint, and
a separate verbose commit. Do not claim compiler admission is VM proof. Do not
claim the full spec complete while any non-process ledger row remains PARTIAL or
MISSING.
```
