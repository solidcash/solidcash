# Message-Bus Parallel Work Plan

Status: execution plan  
Baseline: `d941b139` (`prove persisted varying-selector graph dispatch`)  
Scope: finish the bounded journaled message-bus semantics first, prove that the parts compose, and only then
optimize and select the production envelope.

## 1. Objective and evidence levels

The immediate objective is semantic correctness, not premature selection of a deployable participant bound.
Correctness and deployability are related but distinct claims:

1. **SEMANTIC**: honest and hostile transactions execute with BCH-2026 consensus semantics. Relaxed mock limits may
   be used so size does not block semantic work.
2. **CONSENSUS_FIT**: the same shape passes ordinary BCH-2026 consensus limits.
3. **POLICY_FIT**: the same shape is accepted by the BCHN standard-policy configuration and retains the selected
   production headroom.

Relaxed limits prove only `SEMANTIC`. They must never be cited as `CONSENSUS_FIT` or `POLICY_FIT`. Conversely, a
semantically sound shape that is currently too large remains implemented and testable; it is not silently removed
from the language. The compiler and SDK may keep it experimental or reject it under a production preflight profile.

The intended order is:

1. reconcile the ledger and finish bounded semantics;
2. prove the semantics compose in integrated capstones;
3. complete balanced SDK assembly;
4. measure and optimize;
5. select and enforce the production envelope;
6. graduate only after the external/process gates are separately satisfied.

## 2. Baseline facts

The following work is already committed and must not be reopened without a failing regression:

- two-element persisted varying-target/varying-selector dispatch passes honestly;
- independent target and selector substitutions reject;
- received and compiler-reduced function pointers are graph-bound;
- scalar, tuple, bytes, string and struct results are authenticated;
- canonical option-free low-level `call` and `staticcall` have typed graph edges;
- a pinned, block-local one-hop delegate class is proven;
- chunk-backed and collection-entry `outState` reads are authenticated;
- balanced participant layouts and event-NFT slots exist for the currently proven shapes;
- bounded variable transcript validation and bounded immutable-version interoperability have committed evidence.

The completion ledger remains authoritative for detailed evidence. This plan owns execution order and task status;
it does not duplicate the ledger's historical narrative.

## 3. Roles and shared-work rules

At most four agents are active:

1. **Integration owner (main thread)**: owns the status board, dependency decisions, collision-file leases,
   cherry-picks/merges, full regression, and ledger updates.
2. **Worker A — graph semantics**: symbolic graph expansion, targets, selectors, loops and function pointers.
3. **Worker B — execution semantics**: returns, continuations, low-level calls, context and introspection.
4. **Worker C — state/layout or audit**: state backends and balanced assembly while implementation is active;
   adversarial review after an integration candidate exists.

Workers use separate Git worktrees and branches created from an integration commit named by the main thread. They
must not work in or modify another worker's worktree.

### 3.1 Collision-file leases

The following are single-writer files or surfaces:

- `packages/solidc/src/compiler.ts`
- `packages/solidc/src/generation/GenerateTargetTraversal.ts`
- `packages/solidc/src/semantic/SymbolTableTraversal.ts`
- shared AST/artifact types
- shared Layer-3 SDK planner/assembler modules
- existing large Layer-3 integration tests
- this plan and the completion ledger

Before changing one, a worker requests a lease from the integration owner. The status board records the lease.
A lease names the file/surface, worker, task ID and base commit. Only the integration owner may resolve overlapping
leases. Workers should prefer new modules, sources and focused test files.

Workers never edit this plan or the completion ledger. They report evidence; the integration owner updates both.

### 3.2 Worker evidence packet

Every completed task returns exactly:

- task ID and result: `PASS`, `FAIL_CLOSED`, `BLOCKED`, or `NO_CHANGE`;
- base commit and ordered commit hashes;
- files changed, including every leased collision file;
- focused commands and their exact pass/fail counts;
- honest VM cases added;
- hostile cases added and the field/invariant each attacks;
- evidence level reached: `SEMANTIC`, `CONSENSUS_FIT`, or `POLICY_FIT`;
- measurements, when applicable;
- direct-route regression result;
- remaining unsupported shapes and their exact diagnostic;
- an explicit statement of what the work does not prove;
- clean-worktree confirmation.

`PASS` means the task's written acceptance checklist is satisfied. It does not mean `PROVEN`. Only the integration
owner may mark `INTEGRATED`, and only a separate review pass may justify changing a ledger claim to `PROVEN`.

### 3.3 Task states

The main-thread board uses:

- `TODO`: ready or waiting on listed dependencies;
- `LEASED`: assigned against a named base commit;
- `REVIEW`: worker commits and evidence packet received;
- `CHANGES`: review found required corrections;
- `INTEGRATED`: merged and focused plus full regression passed;
- `PROVEN`: hostile review passed and ledger evidence was updated;
- `SCOPED`: deliberately unsupported and rejected deterministically;
- `BLOCKED`: concrete dependency or contradiction prevents progress.

Only the integration owner changes task state.

## 4. Main-thread status board

This is the concise, authoritative progress view. Historical investigation belongs in the completion ledger or a
task-specific report, not in this table.

| ID | Deliverable | Owner | Depends on | State | Lease/commit/evidence |
| --- | --- | --- | --- | --- | --- |
| P0.1 | Reconcile plan tasks with atomic ledger claims | Main | — | PROVEN | Atomic ledger rows and §8 task map |
| P0.2 | Record relaxed BCH-2026 semantic-test profile | Main | — | PROVEN | Named profile, limits doc and focused runtime tests |
| G1 | Compiler-bounded runtime-sized pointer table | A | P0.1 | INTEGRATED | `30d25f27` + corrections `4c131f9b`; three escapes closed, G1-C resolved |
| G2 | Loop occurrence/order preservation and exact exhaustion | A | G1 | INTEGRATED | `4c131f9b`; missing/injected/duplicated/reordered/argument all reject |
| G3 | Remaining admitted symbolic target/selector expressions | A | G1 | INTEGRATED (scoped) | 4.7 gaps 1-2 closed; gap 3 closed where a bound exists, SCOPED otherwise |
| E1 | Nested/transitive heterogeneous result graph | B | P0.1 | INTEGRATED | `39d034f2`; fan-in scoped out, stable rejection |
| E2 | Call options and bounded iterated low-level calls | B | E1 | INTEGRATED (partial) | mode/target/calldata/result bound; options+iteration FAIL_CLOSED, binding BLOCKED |
| E3 | Explicit delegate-participant classes | B | E1 | INTEGRATED (partial) | classes enumerated; item 2 NOT satisfied - two classes do not fail closed |
| E4 | Context/outState matrix and rejection policy | B | P0.1 | INTEGRATED | 25 values classified; one row honestly incomplete |
| S1 | Mapping insertion/deletion journal transitions | C | P0.1 | INTEGRATED | forgery escape closed; guard keys off slot contribution |
| S2 | Mixed scalar/collection/dynamic journals | C | S1 | INTEGRATED (partial) | `d0bbdf76`; scalar+collection proven, dynamic leg FAIL_CLOSED |
| S3 | Dynamic arrays/chunks across multiple handlers | C | S2 | TODO | Bounds and alias cases |
| L1 | Fully relocatable balanced participant block | C | P0.1 | INTEGRATED (scoped) | blocks relocate relative to each other; the REGION is pinned to input 0 - see 4.10 |
| L2 | SDK funding/change/event-NFT block assembly | C | L1 | INTEGRATED (partial) | preflight is a capability, not a wired gate; 2 criteria SDK-only |
| C1 | DeFi integrated semantic capstone | Main | G2,E2,S2,L2 | TODO | Relaxed VM allowed |
| C2 | Heterogeneous A→B→A dynamic dispatch capstone | Main | G2,E1,S3,L2 | TODO | At least two targets/selectors |
| C3 | Eight-participant semantic capstone | Main | C1,C2 | TODO | Correctness, not deployability |
| A1 | Independent in-repository hostile review | C | C1,C2,C3 | TODO | Reviewer did not implement reviewed slice |
| F1 | Ordinary-limit consensus and policy measurements | A | A1 | TODO | 2/4/8 participant envelopes |
| F2 | Conservative calibrated cost estimator | B | F1 | TODO | Reporting first; rejection only after calibration |
| F3 | MistSwap/EA and proving-corpus fit report | C | F1 | TODO | Separate demand from synthetic capacity |
| F4 | Measured protocol/bytecode minimization | A | F1 | TODO | Optimize only invariant-preserving spans |
| R1 | Select and enforce production envelope | Main | F2,F3,F4 | TODO | Semantic support may exceed production profile |
| R2 | Final regression and documentation reconciliation | Main | R1 | TODO | Exact integration commit |
| R3 | External review and product-demand gates | External | R2 | TODO | Never simulated in-repository |
| X1 | Repair delegate returnEvent/proxy-block slot collision | C | S2 | INTEGRATED | Needed BOTH a reserved layout slot and an SDK output swap |
| X2 | Repair rolled (non-expanded) pointer-table loop in codegen | — | — | TODO | `OP_SPLIT` on 1-byte item at input 0; off G1's path |
| X3 | Result fan-in: one handler consuming two producer results | B | E1 | TODO | Needs `SymbolTableTraversal.ts` + `GenerateTargetTraversal.ts` leases |
| X4 | Publish exact minimum occurrence, not just a ceiling | A | G1 | INTEGRATED | floor + provenance published and wired into the planner |
| X5 | Bind call options as a committed transcript row field | B | E2 | TODO | Needs `artifact.ts` + `GenerateTargetTraversal.ts` |
| X6 | Stable diagnostics for unadmitted low-level shapes | A (wiring) | E2 | LEASED | round 5; module landed by B, A holds the call site |
| X7 | Assert the projection result cursor is exhausted | B | E1 | INTEGRATED | Closed a LIVE root-result forgery, not defence-in-depth |
| X8 | Two chunk-backed dynamic writes plus a collection write | C | S2 | INTEGRATED | NOT a silent miscompile; settles, fails closed past 1 chunk |
| X9 | Resolve G1-C compile-cost fragility in `HiddenBatch` | A | G1 | INTEGRATED | Lazy mutation analysis; 56.6s -> 35.7s, below pre-G1 |
| X10 | Grow the trailing chunk region past one output beside an entry mint | C | X8 | TODO | Blocks multi-chunk dynamic + collection mint |
| X11 | Delegate C2 sorted writes have no settling instance | C | S1 | TODO | S1's delegate exclusion guards an unreachable shape, unattacked |
| X12 | `emit`-funder delegate class does not settle | C | X1 | TODO | Pre-existing; verified neither repaired nor regressed by X1 |
| X13 | Direct `withExternalCall` route does not balance callee blocks | B | L2 | LEASED | round 5; measured refusal is an acceptable outcome |
| X14 | Wire the balanced-assembly preflight into the production send path | B | L2 | LEASED | round 5; must not silently gate existing users |
| X15 | Silent eligibility gap: no `hiddenBatch` route and NO diagnostic | A | — | LEASED | round 5; silence is the one unacceptable outcome |
| **SEC-1** | Conditional delegate edge forges proxy state | C | — | **INTEGRATED** | Not-taken paths frozen, not forbidden; repositioned attack also pinned |
| **SEC-2** | Caller-chosen implementation parameter | C | — | **INTEGRATED (warn)** | Deliberately not fail-closed; guarded proxies stay silent |
| **SEC-3** | Iterated delegate edge collapses N to 1 | C | — | **INTEGRATED** | Fails closed with a named diagnostic, `for` and `while` |
| **SEC-4** | Library-call sugar may never emit the co-spend pin | — | — | **TODO (security)** | `pinsDelegateCoSpend` appears FALSE for a pure `L.f()` function - UNINVESTIGATED |
| X16 | Extend the delegate rules to SCB1/graph-handler routes | — | SEC-1 | TODO | Deliberately excluded; they loop by design and use per-row slots |

The main thread should reproduce this table in progress updates using only changed rows plus a one-line aggregate,
for example: `2 PROVEN / 3 INTEGRATED / 4 REVIEW / 12 TODO / 0 BLOCKED`.

Aggregate after round 3 integration: `2 PROVEN / 11 INTEGRATED / 0 REVIEW / 0 LEASED / 22 TODO / 0 BLOCKED`.

### 4.14 Checkpoint after the security round, measured at `05412a58`

| Suite | Baseline `93bbfedb` | At `05412a58` |
|---|---|---|
| `solidc` | 2,322 passed / 10 failed | **2,405 passed / 0 failed** |
| `solidcash` | 3,597 passed / 5 failed | **3,806 passed / 0 failed** (448 files, 4 skipped) |

Both figures were taken in the integration worktree at the integration commit, not inferred from a worker's
tree. That distinction mattered here: the first SDK number available after the security merge was measured in
Worker C's worktree and differed, so it was re-run before being recorded.

### 4.13 The security round closed SEC-1..SEC-3, and the worker broke its own first fix

SEC-1 is closed by freezing not-taken paths rather than forbidding them: a runtime edge-reached flag is
allocated only for a conditional callsite, and the epilogue requires every co-spent own-category mutable NFT to
be preserved in place wherever the flag is 0. The honest taken path still settles, and a not-taken no-op still
settles.

**The most valuable part was self-refutation.** The worker's FIRST covenant was an index-paired check at the
block-layout data-NFT offsets. That is dodgeable, because a data NFT's flag=1 path never pins its own position.
Rather than ship it, the worker built the repositioned attack - master flag=false at input 0, a decoy funder at
the checked offset, the real data NFT at input 2 - and measured it settling 5 to 999 against its own fix. It
then rewrote the covenant as an index-agnostic per-input property loop and pinned the repositioned attack
permanently. An attribution control confirms the refusal comes from the new emitter, not from value preservation
or the C3 conservation loop.

SEC-2 warns rather than failing closed, with a stated reason: an upgradeable proxy taking `impl` as a parameter
guarded by `require(impl == this.implementation)` is legitimate, and a hard rejection would have to model every
way a `require` can constrain an address. Guarded shapes stay silent; unguarded and aliased parameters warn.

**Two honesty notes worth preserving.** The 656-file corpus reports 0 changed, but the worker attached the
caveat that the corpus contains exactly ONE delegatecall contract - so its discriminating power for delegate
codegen is one file, and the real coverage is the compiler suites. And it caught one of its own assertions that
passed on the baseline too, replacing it with an opcode-signature check that does not.

**A new security lead came out of it, uninvestigated: SEC-4.** Library-call sugar (`L.f()`) is excluded by
`hasExplicitDelegatecall`, and the worker noticed `pinsDelegateCoSpend` therefore appears to be FALSE for a pure
library-call function - meaning that path may never emit the co-spend pin at all. It did not investigate. That
is the right disclosure and it needs its own round.

**Process failure worth recording.** The worker reported the work complete and the state clean, but nothing was
committed: HEAD was still the integration commit with six modified files in the working tree. The integration
owner caught it by checking `git log` and `git status` rather than trusting the packet, rescued the changes to a
patch, verified, and committed them. A packet's clean-worktree line means nothing unless the commits exist.

### 4.12 A published ceiling was WRONG, not merely imprecise

While implementing X4, Worker A found that a nested loop published `maximumOccurrences: 2` against a true 6 -
the inner loop's count REPLACED the outer's instead of multiplying. That is not conservatism, it is a false
published measurement: the artifact asserted a ceiling lower than the code can reach. Fail-closed on chain, but
anything reasoning from the published number was reasoning from a wrong one. Now published as 6.

A second trap was avoided rather than hit: a `return` inside a loop survives to artifact generation as a plain
sibling of the callsite, so a naive floor would have published 3 for a loop that can reach zero. The floor is
cleared for early-exit loops, and `continue` was verified safe by AST probe rather than assumed.

The lesson generalises past this bound: a published number is evidence only if something checks it against the
code that produces it. Board rows citing artifact metadata should say when the number was last verified against
behaviour, not merely that it is published.

### 4.11 SECURITY: two live delegate forgeries and one silent miscompile

Found by Worker B while enumerating delegate classes for E3, and verified by the integration owner by reading
and running the pinned cases. These are in the delegatecall proxy path, a shipped feature - not Layer-3-only.

**SEC-1, live forgery.** A guarded delegatecall spent with the branch condition FALSE and no implementation
co-spent settles a forged proxy state. The honest control - the identical transaction with the condition TRUE -
is refused at input 0. The codegen gate that skips the proxy's own state covenant is `!functionHasDelegatecall`,
a PER-FUNCTION property, while the co-spend pin sits INSIDE the branch: on the untaken path the proxy both skips
its state covenant and never reaches the pin, so the false path self-authorizes on minting-NFT presence alone.
This reopens security finding C1.

**SEC-2, live takeover.** A delegate entry point taking the implementation address as an unguarded parameter
lets an unrelated spender co-spend an implementation they wrote. The covenant does exactly what it promises - it
pins the co-spent script to the supplied address - but the address is caller-supplied, so the pin proves
nothing. The existing C1 warning fires only for a P2PKH literal and is SUPPRESSED here because
`pinsDelegateCoSpend` is true. `delegatecall-security.md` requires a covenant `impl` but never excludes an
unguarded parameter.

**SEC-3, silent miscompile.** An iterated delegate edge publishes one edge and one slot, so a loop delegating
twice settles one delegation. Compiles clean, no diagnostic.

Both forgeries are pinned as `OPEN:` tests asserting today's broken behaviour, so a fix makes them FAIL loudly
rather than close silently. Worker B established why an SDK-side gate cannot catch SEC-1 or SEC-3: conditional,
iterated and singular delegate edges publish byte-identical artifact metadata, asserted as a test. Typed
interface edges publish `occurrence`/`maximumOccurrences`; low-level edges do not.

Assigned to Worker C as a dedicated security round, ahead of remaining feature work, because the fixes are in
its leased files.

### 4.10 L1/L2 land with three claims deliberately scoped down

L1 proves the strong form of relocation: one physical instance - one locking bytecode, one category, one master
UTXO carried forward - settles at block base 0, 1 and 2 across 5-, 7- and 8-slot transactions, with accumulated
state proving continuity rather than re-seeding.

**But the participant REGION is pinned to input 0, and that is pre-existing, not introduced.**
`generateGraphProjectionVerifier` and `GraphRootController.attest` both start their packing cursor at
`expectedParticipantInput = 0` and require `participantInput == expectedParticipantInput`. Worker C proved this
with a padded prefix in which every committed index was consistently shifted: rejected on chain, and rejected
identically by the new preflight. So blocks relocate RELATIVE TO EACH OTHER; the region cannot be offset as a
whole. Reading L1 as full positional freedom would be wrong, and the capstones must not assume it.

Two L2 criteria are SDK-level only, measured rather than asserted:

1. The **1,000-satoshi slot value is a convention, not a covenant invariant** - an 800-satoshi return-event
   output settles on the BCH-2026 VM.
2. **Event NFTs staying inside the emitting block is SDK assembly, not a covenant invariant** - the
   participant's minting master is co-spent, so a second NFT of that category minted in the tail settles. The
   in-block slot is authenticated; a category-indexing observer that trusts any NFT of the category is not safe.

Both hold for the honest SDK and neither survives a hostile assembler. They are broader than Layer-3.

The L2 preflight is also a CAPABILITY, not a mandatory gate: it is an exported helper the tests call explicitly
and is not wired into any production send path (task X14).

### 4.9 Full-repository green, measured at the round-3 integration commit

| Suite | Baseline `93bbfedb` | After round 3 |
|---|---|---|
| `solidc` | 2,322 passed / **10 failed** | **2,372 passed / 0 failed** (57 files) |
| `solidcash` | 3,597 passed / **5 failed** | **3,750 passed / 0 failed** (444 files, 4 skipped) |

Every red present at the baseline is gone, and none was retired by editing a test expectation: the ten `solidc`
reds were a fixture-outpoint birthday collision, three `FnPtrDispatchTables` reds were a direct-route regression
from `d941b139`, the `Layer3CompiledGraph` red was G1's own acceptance test, and `LargeContractSplitting` was
the X1 slot collision. Four separate causes, each fixed at its source.

This is a SEMANTIC gate, not a consensus or policy one. Mock limits remain relaxed by default.

### 4.2 Round-1 integration result, measured on `72f07b07`

| Suite | Baseline `93bbfedb` | After round 1 |
|---|---|---|
| `solidc` | 2,322 passed / **10 failed** | 2,342 passed / **0 failed** |
| `solidcash` | 3,597 passed / **5 failed** | 3,656 passed / **1 failed** |

The one remaining red is `LargeContractSplitting` (task X1). The ten `solidc` reds and the parallel-only
`solidcash` reds are gone: they were a fixture-outpoint birthday collision, fixed in `72f07b07`.

### 4.2e Round-5 dispatch, base `97484fe1`

| Worker | Tasks | Lease |
| --- | --- | --- |
| A | wire X6, then X15 | `compiler.ts` + `packages/utils/src/artifact.ts` |
| B | X14, then X13 | `packages/solidcash/src/layer3/*` + `src/stateful/*` |
| C | **SEC-1, SEC-2, SEC-3** (in flight) | `GenerateTargetTraversal.ts` + `SymbolTableTraversal.ts` |

Round 5 is shaped around Worker C's security round: A and B were given work that cannot touch
`GenerateTargetTraversal.ts` or `SymbolTableTraversal.ts` while the delegate forgeries are being fixed there.

Two round-4 deliveries were inert until this round, each blocked by a lease rather than by a technical problem:
B's X6 module had no call site because the call site is in A's file, and C's L2 preflight was a capability
because the production send path is in B's. Round 5 closes both. That pattern - a delivery that is complete but
unreachable across a lease boundary - is worth watching for; it does not show up as a failing test.

### 4.2d Round-4 dispatch, base `cc47ff0e`

| Worker | Tasks | Lease |
| --- | --- | --- |
| A | X4 then G3 | `compiler.ts` + **`packages/utils/src/artifact.ts` (newly granted)** |
| B | E3 then X6 | `packages/solidcash/src/layer3/*` |
| C | L1 then L2 | `GenerateTargetTraversal.ts` + `SymbolTableTraversal.ts` |

L1/L2 is the critical path: C1, C2 and C3 all depend on L2. `artifact.ts` is granted to A because X4 cannot be
closed without it; the change must be additive and optional, since it ripples into the SDK and B's planner.

No round-4 task may absorb X10, X11, X12, X5, X3 or X2. Those stay separately tracked so a partial fix cannot be
folded into a delivered task's claim.

### 4.2b Round-2 dispatch, base `b9aa816d`

Each worker opens with a hostile review of a peer's round-1 slice, since the protocol requires that the reviewer
did not implement the reviewed work. No round-1 task can reach `PROVEN` until its review lands.

| Reviewer | Reviews | Then implements |
| --- | --- | --- |
| Worker A | S1 (`6119ba26`) - the skipped-guard shapes, especially the UNVERIFIED multi-slot single-write case | G2 |
| Worker B | G1 (`30d25f27`) - ceiling-not-exact-count, movable bounds, the direct-route gating fix | E2 |
| Worker C | E1 (`39d034f2`) - `isRuntimeResolvedCallsite` widening, unexhausted projection result cursor | S2 |

Round-1 worktrees were deliberately left intact rather than reset, so every delivered commit stays reachable
from its original branch. Round-2 worktrees are new: `worker-a-g2`, `worker-b-e2`, `worker-c-s2`.

### 4.2c X1 diagnosed by the integration owner - it is a slot collision, not an SDK placement bug

Worker B traced the `LargeContractSplitting` red to a disagreement about whether an active `returnEvent`
consumes an input position inside the proxy block, and offered a compiler-side or an SDK-side fix. Measuring the
published layout settles which is correct:

    setX            blockSize 2  [[0 master] [1 dataNft]]
    setXReturning   blockSize 3  [[0 master] [1 dataNft] [2 returnEvent]]
    getX            blockSize 3  [[0 master] [1 dataNft] [2 returnEvent]]

There is **no `lowLevelCall` slot in the layout at all** - the delegate facet input is not represented. But the
covenant pins the facet at `proxyMaster + 1 + dataNftCount`, which for one data NFT is index **2**, and index 2
is where the layout puts `returnEvent`. With `.emitReturn()` active the SDK materializes a funder for that
output-only slot, the funder takes index 2, and the facet is pushed to 3. The covenant then computes
`OP_INPUTINDEX (3) OP_2 OP_SUB = 1` against a `proxyMasterIndex` witness of 0 and fails.

So the two positions are not merely misaligned; they are **the same slot claimed twice**. The SDK-side option -
moving the funder out of the block - was rejected on inspection: participant blocks are balanced, input extent
must equal output extent, and pulling a funder out of the block range breaks the 1:1 input/output
correspondence the whole layout depends on. The honest fix is for the block layout to reserve the delegate
input slot and place `returnEvent` after it.

That lives in `GenerateTargetTraversal.ts`, currently leased to Worker C for S2, so X1 is assigned to Worker C
after S2 rather than worked around in the SDK. The integration owner deliberately did not patch the SDK to
route around a leased file.

### 4.4 G1 hostile review: CHANGES, with one confirmed soundness escape

Worker B reviewed G1 (it did not implement it) and the review did its job.

**Confirmed sound:** the published bound being a ceiling rather than an exact count is genuinely fail-closed.
Co-spending fewer rows than the persisted table reaches rejects at input 0. Bound edges behave: `<= 24`
compiles, `<= 25` rejects, `i <= n` with `n <= 24` correctly computes 25 and rejects.

**Confirmed defective:** the guard-derived bound is escapable. `mutatedNames()` in
`ExpandBoundedPointerTableLoop.ts` walks `AssignNode`, array, mapping and state nodes only. The integration
owner verified directly that the file never mentions `TupleAssignmentNode`.

    require(n <= 3); (n, m) = (m, n); for (i < n) handlers[i](v);

is accepted and publishes `maximumOccurrences: 3`, but with `n=1, m=9` runs **9 iterations**, VM-measured. The
control `n = m;` is correctly rejected. In graph mode the expansion emits 3 guarded rows while the source
`require` ran before the swap, so 6 dispatches are dropped from the compiled program with nothing left to reject
them - a silent truncated prefix, exactly the failure mode the guard exists to prevent. Two further escapes are
confirmed at compile level: mutation through an `internal` function, and a bound read through a getter while a
state push moves it.

**The blind spot is inherited, and wider than G1.** `TupleAssignmentNode` is also absent from the older
`UnrollFixedBoundEntryLoop.collectMutatedNames` (verified: zero occurrences). `TupleAssignmentNode` survives to
codegen, so the write is real in both passes. Worker A is asked to fix both trackers and to report whether the
older pass was independently exploitable.

**Compile-cost regression (G1-C).** G1's passes pushed `HiddenBatch.test.ts > admits the caller-authorized
ERC-20 handler set` past the 5s default: that file measured 27/27 at `93bbfedb` but 26/27 at `b9aa816d`, file
time 41.3s -> 56.6s (+37%). So the "27/27 alone" figure pinned in 4.0 no longer holds on this machine. Worker A
must report the compile-cost delta and either reduce it or justify it, not silently raise the timeout.

### 4.5 A security-relevant measurement from the E2 work

`{value:}` call options change **no covenant byte at all**, in graph or direct mode. They are enforced entirely
by SDK block-layout assembly. That is why a graph row would have dropped the option silently, and it is why the
new SDK gate fails closed rather than best-effort. It also means the guarantee is only as strong as the SDK for
every existing direct-route user, which is broader than Layer-3 and worth its own look.

### 4.6 S1 hostile review: a live forgery escape, found by the reviewer

Worker A reviewed S1 (it did not implement it) and found the shape Worker C had itself flagged as UNVERIFIED
rather than cleared. C was right to flag it; A built the fixture C could not.

The collection-output cardinality pin is suppressed whenever a collection owns more than one entry slot in a
function - and **a READ creates a slot while only WRITES enter the batch route**. So `m[a] = m[b] + 1` has two
slots and one write: no batch route, therefore no batch verifier, and the pin suppressed. Both the insert and
update arms then accept a node for a key that was never written.

It is worse than a stray UTXO. A plain `require(m[k] == v)` handler afterwards **authenticates the forged node
as genuine state** - it satisfies address, category, capability and `slot == H(k)`, which is precisely the
indistinguishability property S1's own analysis identified. Three cases are pinned with `it.fails` in
`S1ReviewMultiSlotForgery.test.ts`.

Where the pin IS emitted the mechanism is sound: a duplicate node for the inserted key and a foreign-slot
substitution both keep the count at 2 and reject. So the count is tight; only its guard condition is too narrow.
Delegate functions are a fifth suppressing condition that was NOT VM-tested.

S1 returns to `CHANGES` and is reassigned to Worker C for round 3, ahead of X1, since the fix is in its lease.

### 4.7 Recorded gaps from G2 - published bounds are weaker than claimed

Three shapes publish no explicit per-callsite ceiling: a single-selector pointer table (coalescing keys on
`selectorArrayVar`), a multi-group function (coalescing admits one group), and a loop holding an ordinary
interface call (`ExpandBoundedPointerTableLoop` counts only pointer dispatches). The third publishes
`occurrence: 'loop'` with no `maximumOccurrences`, and the planner then accepts **any** count up to the global
24 ceiling - demonstrated by planning six rows from a source carrying no bound at all.

These are fail-closed on chain, so they are not exploits. But G1's headline claim is that a compiler-proven
bound is published, and for these shapes no such bound exists. The claim must be scoped to the shapes that
actually publish one.

### 4.8 X7 was a live exploit, and the integration owner called it wrong

When assigning X7 the integration owner wrote that the unexhausted result cursor was defence-in-depth rather
than a live exploit, on the grounds that every route Worker C had built was caught one level lower. That
reasoning was wrong for one shape.

A returning **root** invocation has no parent, therefore no emission row and no compiled consumer route
decoding its result. The prefix-only projection slice was its ONLY binding. Two hostile transcripts - a root
result declared void, and a root result truncated to a one-byte prefix, both leaving every return-event NFT
commitment byte honest - **settled on the BCH-2026 VM** at integration commit `3386bbc4`.

Independently confirmed by the integration owner with a guard negative control: commenting out the single new
`require(resultCursor == resultVector.length)` and rebuilding makes exactly those two cases settle again, while
the honest control and the non-root ordering test still pass.

The worker was equally careful about the limit of the claim: for any NON-root producer the assertion is second,
because every participant master input structurally precedes every projection slot, so a consumer route always
rejects first. That ordering is pinned as its own test.

Lesson for this board: "caught one level lower" is a claim about the shapes someone happened to build, not a
property of the design. It should not have been used to downgrade a stated invariant.

### 4.3 Corrections this round forced on this plan

1. **Section 2 was wrong.** It listed "received and compiler-reduced function pointers are graph-bound" as
   settled baseline fact. That claim was masking a direct-route regression introduced by `d941b139`, which made
   the broadcast pointer receiver use the live loop index for EVERY compilation when only a graph handler needs
   it. `FnPtrDispatchTables` measured 14/14 at `d941b139^`, 11/14 at `93bbfedb`, and 14/14 after G1. The three
   baseline reds were that regression - not independent bugs, and not G2's.
2. **Mock limits are already relaxed, so no mock-based test is `CONSENSUS_FIT` evidence.**
   `MOCK_CONSENSUS_LIMITS` - the default for every mock test, not just semantic ones - sets 1,000,000-byte
   inputs and stack items, 10,000,000-byte transactions, and a 10,000,000 operation budget. This weakens every
   prior mock-based capacity claim in this repository, not only Layer-3 ones.
3. **The semantic profile is STRICTER than the mock default on the limit that matters most.**
   `MOCK_CONSENSUS_LIMITS.maximumNftCommitmentBytes` is 1,000,000 against BCH-2026's real 128.
   `createLayer3SemanticTestProvider()` restores 128. So a fixture relying on a commitment above 128 bytes
   passes by default and would fail on real BCH-2026. Capacity claims must state which provider they used.
4. **`git stash` is unsafe in this repository.** `refs/stash` is shared across all worktrees, so a
   push/pop pair in one worker's tree can consume or deliver another worker's entry. It happened this round:
   Worker A's G1 files landed in Worker C's tree. Both recovered and neither committed foreign work, but the
   rule is now: workers must use `git diff > file` plus `git checkout --` and `git apply`, never `git stash`.

### 4.0 Pinned regression baseline at `93bbfedb`

Measured by the integration owner BEFORE any round-1 delivery, so a worker is never charged with a
pre-existing failure.

| Package | Result at `93bbfedb` |
| --- | --- |
| `@solidcash/utils` | 295 passed, 1 todo (14 files, 1 skipped) |
| `solidc` (full parallel run) | 2,322 passed, **10 failed** across 2 files |
| `solidc` `HiddenBatch.test.ts` alone | 27 passed, 0 failed |
| `solidc` `MessageBusRoute.test.ts` alone | 3 passed, 0 failed |
| `solidcash` (full run) | 3,597 passed, 24 skipped, 9 todo, **5 failed** across 3 files |
| `solidcash` failures in isolation | still fail - these are GENUINE, unlike the `solidc` ten |

The five `solidcash` failures, each reproduced in isolation:

| File | Failure | Owner |
| --- | --- | --- |
| `Layer3CompiledGraph.test.ts` | `expected [ '51', '52' ] to deeply equal [ '51', '52', '53' ]` | G1 target test, already red |
| `FnPtrDispatchTables.test.ts` (3) | `argument count mismatch for function 'fire'. SDK produced 3 args but ABI expects 8 ... compiler/SDK version mismatch`; `Duplicate input detected` | unassigned - A to classify |
| `LargeContractSplitting.test.ts` | `Could not derive the return value of 'setXReturning' for .emitReturn(). The covenant trace did not expose an authenticated return commitment.` | unassigned - B to classify |

The `Layer3CompiledGraph.test.ts` red is a pre-written acceptance test for G1: a two-element selector table where a
three-element one is expected. It should be made to pass by implementing G1, never by editing the expectation.

**Open question against section 2.** Section 2 lists as already-committed baseline fact that "two-element persisted
varying-target/varying-selector dispatch passes honestly" and that "received and compiler-reduced function pointers
are graph-bound". The first is consistent with the measurements above. The second may not be: three
`FnPtrDispatchTables` cases fail in isolation at this exact commit. The integration owner has NOT concluded that
section 2 is wrong - the failures may cover an aspect the claim never made - and has asked Worker A to classify
them as either subsumed by G1 or an independent pre-existing defect. Section 2 will be corrected only on that
evidence, and only by the integration owner.

**CORRECTION (round 2): the `solidc` figures above no longer hold.** After G1, `HiddenBatch.test.ts` is
genuinely flaky on the 5s default timeout - the integration owner measured 27/27 and then 26/27 on consecutive
isolated runs, and Workers B and C independently reported 1 and 4 timeout failures in that file. This is
compile-cost fragility introduced by G1's added passes (task G1-C), not a correctness regression: every failure
is `Test timed out in 5000ms`, never an assertion. Do not treat "solidc 0 failed" as a stable gate until G1-C is
resolved; compare failure KINDS, and re-run that file in isolation before charging a worker with it.

**The 10 original failures were parallel-run only.** Both files pass in isolation, so the baseline defect is test
execution, not compiled behaviour. A round-1 delivery that reproduces exactly these 10 in a full run has NOT
regressed anything; a delivery that changes the set has. `yarn test` halts after `solidc` fails, so the
`solidcash` baseline must be taken with `yarn workspace solidcash test` separately.

Cross-worktree contamination was checked and ruled out: the compiler's `compileCache` is an in-process `Map`
(`compiler.ts:116`), not a shared filesystem cache, so parallel workers in separate worktrees cannot corrupt
each other through it. Workers may run their own suites concurrently.

### 4.1 Active leases (round 1, base `93bbfedb`)

| Collision surface | Leased to | Task |
| --- | --- | --- |
| `packages/solidc/src/compiler.ts` | Worker A | G1 |
| `packages/solidc/src/generation/GenerateTargetTraversal.ts` | Worker C | S1 |
| `packages/solidcash/src/layer3/*` (planner/assembler) | Worker B | E1 |
| `packages/solidc/src/semantic/SymbolTableTraversal.ts` | unleased | — |
| this plan and the completion ledger | Main (never workers) | — |

Worktrees: `.worktrees/worker-a-g1`, `.worktrees/worker-b-e1`, `.worktrees/worker-c-s1`, each branched from
`93bbfedb`. A worker needing a surface leased to another worker must implement behind a NEW module and request
the lease in its evidence packet; it must not edit the leased file, and must report `BLOCKED` if that is
impossible. `LowerCollectionJournalHelpers.ts` and the C2/SortedList backend are not collision surfaces and are
free for Worker C.

## 5. Phase 0: rebaseline and make claims atomic

### P0.1 — ledger reconciliation

Checklist:

- [x] Remove stale references to the now-complete varying-selector investigation.
- [x] Split compound rows where a proven feature and a deliberate rejection share one `PARTIAL` status.
- [x] Classify every remaining claim as implementation, fail-closed scope, measurement, or external/process.
- [x] Map every implementable claim to exactly one task ID in this plan.
- [x] Confirm process rows cannot block semantic completion.

### P0.2 — relaxed semantic-test profile

Checklist:

- [x] Add one named BCH-2026 VM configuration used only by semantic capstones.
- [x] Document every changed input-size, transaction-size and operation-budget limit.
- [x] Keep opcode behavior, introspection behavior and covenant evaluation identical to BCH-2026.
- [x] Ensure test names and reports say `SEMANTIC`, never `standard` or `deployable`.
- [x] Retain ordinary-limit tests for already fitting cases.

## 6. Phase 1: bounded semantic closure

Workers implement the smallest vertical slice that can be independently falsified. A task must not combine an
unrelated compiler change, SDK change and optimization.

### G1–G3 — graph acquisition and expansion

Checklist:

- [ ] Compiler bound is explicit and artifact-published.
- [ ] Every reached occurrence resolves to one canonical participant, selector and argument vector.
- [ ] Runtime-sized inputs are accepted only when the compiler can prove a finite bound.
- [ ] Transcript order matches source execution order.
- [ ] Exact exhaustion rejects missing, injected, duplicated and reordered occurrences.
- [ ] Target and selector substitution reject independently.
- [ ] Direct non-graph behavior is regression-identical.
- [ ] Shapes beyond the admitted bound fail with a stable diagnostic.

### E1–E4 — execution and context

Checklist:

- [ ] Result schema, producer, consumer and occurrence are canonical.
- [ ] Scalar and composite results work through nested and transitive dependencies.
- [ ] Multiple consumers cannot substitute or consume a result twice unintentionally.
- [ ] Low-level mode, target, calldata, options and result are transcript-bound.
- [ ] Iteration has a compiler-proven bound and exact row count.
- [ ] Every delegate class proves code identity, state owner and output authority.
- [ ] Supported context values have direct/transcript equivalence or explicitly documented logical semantics.
- [ ] Divergent context, including current `tx.origin` and `activeBytecode`, fails closed.

### S1–S3 — state and journal semantics

Checklist:

- [ ] Mapping insertion proves predecessor/successor ordering and unique authority.
- [ ] Mapping deletion cannot strand, duplicate or fabricate value.
- [ ] Scalar, collection and dynamic writes share one read-your-writes journal.
- [ ] Structural aliases canonicalize to one physical entry.
- [ ] Every physical state/resource slot has one final authorized flush.
- [ ] Early return, loop exit and revert either flush correctly or fail at compile time.
- [ ] Dynamic chunk count, order, category, capability and commitment are authenticated.
- [ ] Honest and hostile transactions execute on the BCH-2026 VM.

### L1–L2 — balanced physical composition

Checklist:

- [ ] Each participant contributes an equal-width input/output block.
- [ ] Funding inputs fill unused input-side slots.
- [ ] Corresponding output-side slots use the specified 1,000-satoshi ordinary/event/return-event or settlement
      outputs.
- [ ] Event NFTs remain inside the emitting participant's block.
- [ ] Final fee funding and terminal change are outside relocatable participant blocks.
- [ ] A block may move without changing its internal covenant meaning.
- [ ] No new global absolute-index dependency exists.
- [ ] SDK preflight rejects malformed or unbalanced blocks before signing.

## 7. Phase 2: integrated semantic capstones

Capstones use the relaxed profile when necessary. They prove composition, not production fit.

### C1 — DeFi composition

- [ ] Caller-authorized ERC-20 `transferFrom`.
- [ ] Bento/Kashi-style accounting.
- [ ] Result-dependent continuation.
- [ ] Multiple state/resource transitions.
- [ ] Ordinary and return-event NFTs.
- [ ] Hostile caller, allowance, result, resource and event substitutions reject.

### C2 — heterogeneous cycle

- [ ] Three independently compiled participant types.
- [ ] Structural A→B→A cycle; every physical input executes once.
- [ ] Dynamic state and at least two possible target/selector pairs.
- [ ] Missing/reordered return edge rejects.
- [ ] Target, selector, argument, result and post-state substitutions reject independently.

### C3 — bounded maximum graph

- [ ] Eight participants or the explicitly selected semantic bound.
- [ ] Calls, results, resources, dynamic chunks and event NFTs are all present.
- [ ] Balanced blocks compose without absolute-index rewriting.
- [ ] Honest all-input execution passes.
- [ ] Participant injection, omission, duplicate owner and disjoint-root cases reject.

## 8. Phase 3: adversarial integration review

The reviewer must not be the worker who implemented the reviewed slice.

Checklist:

- [ ] Reproduce all capstones from committed fixtures.
- [ ] Add at least one hostile case per authenticated transcript field.
- [ ] Check whole-table exhaustion, owner uniqueness and physical input/output binding.
- [ ] Check state/resource value, category, capability, commitment and locking-bytecode preservation.
- [ ] Check direct-route bytecode/behavior regressions.
- [ ] Check relaxed limits are the only reason a relaxed-only case fails ordinary limits.
- [ ] Report findings by task ID and return affected tasks to `CHANGES`.
- [ ] Mark a task `PROVEN` only after corrections and regressions land.

## 9. Phase 4: production fitting

Only this phase may narrow the production envelope.

### F1 — measurements

For 2-, 4- and 8-participant representative shapes, pin:

- redeem and unlocking-bytecode size per input;
- operation cost and available-budget percentage;
- maximum stack and item sizes;
- serialized transaction size;
- standard-policy result;
- construction/preflight time;
- marginal cost per participant, invocation, resource, result, chunk and event.

### F2 — estimator

- [ ] Predictions are conservative for all measured fixtures.
- [ ] Unknown shapes fail estimation closed.
- [ ] Error margins are recorded.
- [ ] Reporting ships before enforcement.
- [ ] Production rejection is enabled only after calibration.

### F3 — corpus fit

Evaluate MistSwap, Effective Acceleration, TreasurySplit, Marketplace, MasterChef, BentoBox and Kashi. Record graph
shape, compiler derivation, eligibility, exact rejection, measured/estimated cost and fit at 2/4/8 participants.

### F4 — optimization

Every proposal records the exact repeated span, bytes saved, operation-cost change, stack contract, preserved
authentication invariant and protocol-version effect. Smaller bytecode with unsafe stack or authentication behavior
is a rejection, not an optimization.

The provisional 20% headroom target is a product policy subject to measured justification. It is not a semantic
correctness criterion.

## 10. Integration protocol

For every worker delivery, the main thread:

1. verifies the evidence packet and clean commit series;
2. reviews diffs before integration;
3. runs focused compiler and SDK tests;
4. runs the relevant honest and hostile BCH-2026 VM cases;
5. runs full build, test and lint at an integration checkpoint;
6. assigns an independent hostile review;
7. updates the status board;
8. updates the completion ledger only after evidence is committed.

Integration commits must be small enough to revert independently. No task may remain `LEASED` across a baseline
change without being rebased or explicitly renewed. Workers must report a blocker as soon as it is measured; they
must not fill time with adjacent unassigned changes.

Suggested cadence:

- assign up to three independent tasks from the board;
- receive evidence packets asynchronously;
- integrate the least collision-prone task first;
- publish the new integration commit;
- rebase or renew remaining leases;
- report changed board rows to the main thread;
- run a full regression after every two integrated semantic slices, and immediately after any shared codegen or
  transaction-layout change.

## 11. Production-envelope decision

After F1–F4, select one production profile:

- bounded graph up to eight participants;
- bounded graph up to four participants;
- two-party graph plus repeated-owner batching;
- journaling/repeated-owner batching only.

This decision changes production preflight and default-on status, not the truth of already proven semantic tests.
Semantically implemented shapes outside the selected profile remain experimental and are rejected by production
preflight with a precise capacity diagnostic.

## 12. Definition of completion

Semantic implementation is complete when:

- every implementable non-process claim in the bounded semantic envelope is `PROVEN`;
- every excluded shape is `SCOPED` with deterministic compiler or SDK rejection;
- C1–C3 and their hostile suites pass on the exact integration commit;
- balanced participant blocks are relocatable and SDK-assembled;
- no temporary probes or unexplained test-limit changes remain.

Production fitting is complete when:

- ordinary BCH-2026 consensus and standard-policy measurements are pinned;
- conservative preflight limits enforce the selected production envelope;
- corpus-fit and contention evidence are recorded;
- documentation distinguishes semantic support, consensus fit and policy fit.

Graduation/default-on additionally requires the independent external review and product-demand gates. These are
reported separately and are never simulated by in-repository tests.
