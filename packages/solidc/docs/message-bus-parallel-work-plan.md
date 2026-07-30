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
| G1 | Compiler-bounded runtime-sized pointer table | A | P0.1 | **PROVEN** | reviewed by B (bound escape), fixed by A, regressions green - see 4.29 |
| G2 | Loop occurrence/order preservation and exact exhaustion | A | G1 | INTEGRATED | `4c131f9b`; missing/injected/duplicated/reordered/argument all reject |
| G3 | Remaining admitted symbolic target/selector expressions | A | G1 | INTEGRATED (scoped) | 4.7 gaps 1-2 closed; gap 3 closed where a bound exists, SCOPED otherwise |
| E1 | Nested/transitive heterogeneous result graph | B | P0.1 | **PROVEN** | reviewed by C (2 findings), both closed by X7, regressions green - see 4.29 |
| E2 | Call options and bounded iterated low-level calls | B | E1 | **PROVEN** | mode/target/calldata/result bound; options+iteration FAIL_CLOSED, binding BLOCKED |
| E3 | Explicit delegate-participant classes | B | E1 | INTEGRATED (type-shape only) | A13 escapes closed against the PUBLISHED TYPE, not the semantic class - see 4.44 |
| **SEC-12** | `hasSignatureGuard` suppresses SEC-2 and C1 at two sites | S1 | E3 | **INTEGRATED** | key operand now resolved; guard credited only for a key the caller cannot choose - see 4.51 |
| **SEC-16** | Same over-broad suppressor in `warnUnauthenticatedSelfdestruct` | S6 | SEC-12 | **INTEGRATED** | helper MOVED not copied, 66/66 lines verified identical; 3/8 mismatches -> 0/8 - see 4.56 |
| X37 | Publish delegate target/key provenance in the artifact | S3 | E3 | **INTEGRATED** | both `bytes`-cast escapes resolve to `parameter`; 327/327 artifacts SHA-256 identical minus the 2 new keys - see 4.53 |
| **SEC-17** | SEC-12 warns on a key committed by `hash160(pk)==pkh` | S6 | SEC-12 | **INTEGRATED** | 14/36 -> 0/36 across 7 spellings at both sites; 8 negative controls unflipped - see 4.56 |
| X46 | Commitment check reads the key's binding, not the writer of its target | A3 | SEC-17 | **INTEGRATED** | LIVE THEFT: bob takes 51,515 sats, broadcast-accepted; key-rotation idiom preserved - see 4.61 |
| X43 | Make the E3 gate read X37's provenance instead of the published type | A1 | X37 | **INTEGRATED** | both escapes refused; admission proven a LIVE hole (5 -> 999); 3 unnamed closures - see 4.59 |
| X50 | SDK's shipped `defaultProxyArtifact.ts` is stale in TWO ways | B2 | X43,X11 | **INTEGRATED** | a THIRD defect found: the manual edit hit `bytecode` only, so `debug.bytecode` and `fingerprint` disagreed - see 4.69 |
| X61 | `upgrades.deployProxy` + a delegate that INSERTS a mapping key no longer works | — | X50 | **ACCEPTED REGRESSION** | strict conservation cannot admit the node without permitting net proxy-category NFT creation; documented in `docs/upgrades.md` |
| X51 | Publish the `hash160(key) == committed` commitment as an artifact field | B3 | X43,SEC-17 | **INTEGRATED** | one rule shared with the diagnostic; 379/379 SHA-256 identical minus the new key - see 4.70 |
| X62 | `signatureGuard` says nothing about whether the check DOMINATES the delegatecall | — | X51 | **TODO** | a branch-guarded `checkSig` is admitted identically by the X51 and pre-X51 routes, measured side by side |
| E4 | Context/outState matrix and rejection policy | B | P0.1 | INTEGRATED | 25 values classified; one row honestly incomplete |
| S1 | Mapping insertion/deletion journal transitions | C | P0.1 | **PROVEN** | reviewed by A (forgery escape), fixed by C, regressions green - see 4.29 |
| S2 | Mixed scalar/collection/dynamic journals | C | S1 | **PROVEN** | `d0bbdf76`; scalar+collection proven, dynamic leg FAIL_CLOSED |
| S3 | Dynamic arrays/chunks across multiple handlers | C | S2 | TODO | Bounds and alias cases |
| L1 | Fully relocatable balanced participant block | C | P0.1 | **PROVEN** | blocks relocate relative to each other; the REGION is pinned to input 0 - see 4.10 |
| L2 | SDK funding/change/event-NFT block assembly | C | L1 | **PROVEN** | preflight is a capability, not a wired gate; 2 criteria SDK-only |
| C1 | DeFi integrated semantic capstone | B | G2,E2,S2,L2 | **INTEGRATED** | 16/16 + ReviewR2CapstoneC1 15/15; figures re-measured; clears consensus AND relay |
| C2 | Heterogeneous A→B→A dynamic dispatch capstone | A | G2,E1,S3,L2 | **PROVEN** | reviewed by B, clean, re-verified twice post-SEC-5 - see 4.29 |
| C3 | Eight-participant semantic capstone | C | C1,C2 | **INTEGRATED (relay caveat)** | 13/13 + ReviewR2CapstoneC3; meets consensus capacity, MISSES standard relay by 354 B |
| X25 | Re-measure C3 capacity run-to-completion, post-X23 | B | X23,C3 | **SUPERSEDED - table stale in all 10 rows** | controller measured **0.9217x**, over-budget set EMPTY; see 4.48 |
| X38 | Correct the stale capacity comments in the C1 and C3 fixtures | A5 | X25 | **INTEGRATED** | all figures re-measured at 4ac40b82 and printed by the run - see 4.60 |
| X39 | C3 serializes to 100,650 B - 650 over the 100,000 B standard relay ceiling | A5 | X25 | **INTEGRATED** | asserted as a band; consensus fit and relay policy stated as separate claims |
| X40 | Stop citing the C1/C3 reshapes as what closes SEC-6 | A5 | R2-F3 | **INTEGRATED** | verified two ways independently, not taken from the reviewer |
| X27 | Suffix-split the transcript in `attest` | B | X25 | **PROVEN** | round 9, after C1 CHANGES and X21 |
| X28 | Right-size `BALANCED_TRAILING_CAPACITY` per chunk need | A3 | — | **NO_CHANGE (measured)** | there IS no loop leg: 129 reservations, 9,164 computations, ZERO loop-term firings; alternative narrowing fails silently |
| A1 | Independent in-repository hostile review | A+B | C1,C2,C3 | INTEGRATED | 38 hostile cases across three capstones, all reject; 4 findings on C1/C3, C2 clean |
| F1 | Ordinary-limit consensus and policy measurements | A6 | — | **INTEGRATED** | envelope measured; a DIFFERENT limit binds first per shape; CONSENSUS_FIT supported but not asserted - see 4.58 |
| X47 | Ledger's "N=8 binding at 36.5%" is the SYNTHETIC fixture, not an 8-participant graph | B6 | F1 | **CONFIRMED - ledger edit pending** | verified by diffing both generators; two harnesses agree; wording supplied |
| X48 | One knob cannot express two hash regimes | B4 | F1 | **INTEGRATED** | splitting the field alone was COSMETIC - the regime selector was hardcoded; nothing moves, 9.3x margin - see 4.65 |
| X57 | `createVirtualMachineBch2026ForProvider` silently drops the observer | C2 | X48 | **INTEGRATED (premise corrected)** | a LATENT trap, not an active failure - the caller gate masks it; found a live diagnostic-destroying bug - see 4.75 |
| X67 | `packages/testing/src/config.ts` does not expose the split hash fields | — | X58 | `MockNetworkProvider.ts:89` writes only the nonstandard hash field | C2 | X48 | **INTEGRATED** | NOT cosmetic: a dust-enforcing mock read an allowance 20,000,000x smaller than declared |
| X58 | `MockNetworkProvider.ts:89` writes only the nonstandard hash field | — | X48 | **TODO** | the regime split is not yet end-to-end into the mem-cash verifier |
| X49 | Close CONSENSUS_FIT with a BCHN regtest broadcast | B1 | F1 | **INTEGRATED (scoped)** | CONSENSUS_FIT holds for the sweep N=2/4/8 ONLY - accepted AND mined; policy-vs-consensus settled - see 4.66 |
| X59 | Thread `createProvider` into the four capstone fixtures | C1 | X49 | **INTEGRATED** | **A13, C2 and C3 MINED on BCHN v29** with hostile controls refused on the same chain - see 4.78 |
| X60 | C1/C3 carry a 10-satoshi `OP_1` placeholder recipient | C1 | X49 | **INTEGRATED (premise corrected)** | `enforceDust: false` was NEVER the cause - the mock defaults it false; a real address alone does not fix dust |
| F2 | Conservative calibrated cost estimator | B7 | F1 | **INTEGRATED** | 28/28 conservative in-sample; evaluated OFF training data 3 ways; 34% margin found and NOT switched on - see 4.68 |
| F3 | MistSwap/EA and proving-corpus fit report | C6 | F1,F2 | **INTEGRATED** | **THE ENVELOPE IS NOT WHAT STOPS REAL CONTRACTS**: all 12 bus-reachable app contracts admit READ-ONLY; 80% of refusals are route-scope - see 4.77 |
| X73 | `initial-v1-route-requires-public-visibility` refuses 172 of 455 (38%) | — | F3 | **TODO (biggest incidental wall)** | Solidity marks entry points `external`; the v1 route admits `public` |
| X79 | The route-scope gates are STACKED; no single lift admits anything | D2 | F3 | **MEASURED** | the ERC-20's transfer/approve/transferFrom ARE admissible; 3 gates stacked; relaxing the third hits an unnamed abort |
| X76b | Lift `result-route` and normalize the bare entry spelling | E1 | X79 | **INTEGRATED** | 2 of 3 stacked gates; every bare shape lands on its DOTTED TWIN'S byte count; +2 state-changing, 0 lost - see 4.88 |
| X94 | `mixed-scalar` needs its own mixed-route VM settle | — | X76b | **TODO** | the only gate whose relaxation puts a row with NO physical entry into a route sized for per-row entry slots; 139/88 firings |
| X95 | `bareShapeIsNormalizable` is over-conservative | — | X76b | **TODO** | blocks on any bare index of a non-collection name; narrowing to collection names is sound but was not shipped |
| X96 | X73's never-shrink guard may no longer have a subject | F2 | X76b | **INTEGRATED** | it HAD lost it and is not unreachable; re-pointed at a fresh arithmetic subject, old one kept as a collapse record |
| X80 | F3's 455 is a ~2.2x undercount of gate reach | D2 | F3 | **MEASURED** | 419 firings, 226 on contracts that DO get a route and are invisible to the route-absent channel |
| X70 | F2 UNDER-predicts unlocking bytecode 45/45, mean -7.0% | D4 | F3,F2 | **INTEGRATED** | 44/45 under -> **0/45 under**; one defect was an IMPOSSIBILITY (intercept below the redeem it pushes) - see 4.83 |
| X78 | The estimator names DENSITY as the binder on all 45 | E3 | X70 | **INTEGRATED** | de-bias each coefficient before comparing: 0/43 -> **43/43**, census 22/367 -> **367/367** |
| X85 | `replicaSpec` drops 444 B of every corpus prediction | F2 | X78 | **INTEGRATED** | the fields mean DEPLOYED length; the stale default answered OVER on 23 of 1,712 rows that FIT - see 4.92 |
| X86 | The F3 census has DRIFTED and needs re-taking | F2 | X78 | **INTEGRATED** | "hours" was 29 MINUTES; re-taken in full; refusals 455 -> 280 and route-scope 80% -> **53%** |
| X99 | The plan and ledger still cite 455 / 364 / 367 / 45 | — | X86 | **TODO** | superseded by the full re-take; the integration owner quoted 80% in three briefs |
| X87 | `Layer3CorpusFitF3.test.ts:183` stale after X73 | F2 | X73 | **DOES NOT REPRODUCE** | the assertion is not in the tree; three reports were against a pre-baseline file. The real one was the X84 test |
| X88 | Route-synthesis arity bug on collection-iteration handlers | — | — | **TODO** | `Found parameters () ... where parameters (bigint) were expected` in the generated wrapper |
| X89 | A collection ITERATION read never enters the footprint | — | X88 | **TODO** | `CollectionIterationNode` carries `collectionName`, not `name`; harmless only because X88 stops it compiling |
| X71 | Bus-mode `ParseError` line number moves by 51 on an unrelated option | D6 | F3 | **WRITTEN, HELD ON LEASE** | option (e) works; Router02 compiles under `+hiddenBatch` but NOT under F3's `+controller` - see 4.85 |
| X83 | `Block slot not found: keccakSideCar[0]` - X42's family, uncovered slot kind | E2 | X71 | **INTEGRATED** | origin is a WHOLE-FUNCTION flag, not the lookup; corpus enumerated (78 files), 1 row changed - see 4.87 |
| X90 | The keccak second face: satisfiable or not? | F1 | X83 | **SETTLED - satisfiable AND sound** | X83's belief was wrong but its refusal to act was right; the real defect is the builder - see 4.89 |
| X97 | `TransactionBuilder.ts:258` never reaches the stateless keccak co-spend | G4 | X90 | **INTEGRATED** | no SEQUENTIAL order works - source order decides which family runs first; one fixpoint reads both - see 4.93 |
| X91 | X42's `blockhash` guard escapes | F1 | X42 | **INTEGRATED** | the briefed option set was wrong AND that IS the gap; it is a call EDGE, and it reaches the DIRECT route too - see 4.90 |
| X84 | Census lists no ParseError for solidity-by-example, but one exists | — | X71 | **TODO** | likely a missing `compileFile` fallback for FAIL rows; reconcile before quoting those numbers |
| X72 | 20 refusals published with NO `rejectionReason` | D6 | F3 | **INTEGRATED** | an ORDERING defect: the oracle pass appends an entry point after route synthesis names reasons; 16 -> 0 |
| F4 | Measured protocol/bytecode minimization | C3 | F1,F2 | **INTEGRATED** | **C3 now FITS relay: 99,618 B, 382 under** - a verifier byte is worth N transaction bytes - see 4.73 |
| X65 | The 8-way locking-bytecode dispatch costs 95 B per participant slot | D5 | F4 | **INTEGRATED** | **-444 B/projection**, 3.4x F4's sizing, by REJECTING the form F4 sized; C3 **3,698 B under** at HEAD (3,882 when this row was written, before X81) - see 4.84 |
| X81 | DECISION: take the axiom-free verifier variant? | F3 | X65 | **TAKEN** | price was +28 not +19; the real argument is a PARTIAL map became TOTAL - a forward-compatibility hazard - see 4.93 |
| X100 | The route refusal is stamped on every external entry point, not the thrower | — | X81 | **TODO** | 10 of 12 contracts lose the route ENTIRELY; attribute by error position and refuse only that handler |
| X82 | The F4-era comment tables already did not reproduce at `1591e87f` | — | X65 | **TODO** | C3 controller 2,131,662 recorded vs 2,131,942 measured; Sink 4,951 B vs 4,979 B |
| X66 | F2's basis and F1's header are stale-but-passing after F4 | D4 | F4 | **INTEGRATED** | re-measured not adjusted; consequence re-derived - every costed C3 fix was sized against an overrun that does not exist |
| R1 | Select and enforce production envelope | C7 | F1,F2,X49 | **INTEGRATED (gate unwired, by design)** | the plan-time screen CANNOT be the gate - measured; doc `layer3-production-envelope.md` - see 4.72 |
| X64 | DECISION: does `standard-output-template` ship? | C1 | R1 | **CLOSED - the rule does not exist** | BCHN v29 does not enforce it, cross-checked with `-acceptnonstdtxn=0`; **C2 and E1 are IN**; no rule is UNMEASURED any more |
| X74 | `RegtestNetworkProvider.addUtxo` ignores `token.category` and mints a fresh genesis | D3 | X59 | **INTEGRATED (cross-run throw MERGED, not verified)** | **ALL FOUR capstones MINED in one run**; `c38d96c1` is lint-clean but NOT node-verified - see 4.81 |
| X75 | `Unbound return call in __scbN` is an unnamed internal abort | D6 | F3 | **INTEGRATED** | NOT X22's shape; all 7 corpus files now name the real edge at a position INSIDE the user's file, 7/7 |
| X76 | X71's class has a SECOND site the `parseCode` guard cannot cover | E2 | X71 | **BLOCKED, hunks measured** | WIDER than filed: 161 files cite a line beyond the file, and X76's own position falls INSIDE it - see 4.87 |
| X92 | Mark generated-source AST nodes so every diagnostic on them says so | — | X76 | **TODO (4 files, one HELD)** | prototyped and demonstrated at +0 bytes; stamp at CONSTRUCTION, since lowering clones and re-parents nodes |
| X93 | 13 diagnostics report a position in an IMPORTED file with no label | F4 | X76 | **INTEGRATED** | keyed on CLONE IDENTITY (clones share the `Location` instance): 3/17 -> 17/17; 478 labels, 0 impossible - see 4.91 |
| X98 | 60 unlabelled-beyond-file positions remain, all out of one lease | — | X93 | **TODO** | `AstBuilder` hex/gas, `TypeCheckTraversal` range/cast, and every hard error via `Errors.ts` |
| X77 | `view` functions reported `writesState: true` | E3 | X71 | **DISPROVED - no defect** | fires on `externalCalls > 0`, not the array analysis; cannot refuse a handler; corpus delta ZERO - see 4.86 |
| R2 | Final regression and documentation reconciliation | Main | R1 | TODO | Exact integration commit |
| R3 | External review and product-demand gates | External | R2 | TODO | Never simulated in-repository |
| X1 | Repair delegate returnEvent/proxy-block slot collision | C | S2 | INTEGRATED | Needed BOTH a reserved layout slot and an SDK output swap |
| X2 | Repair rolled (non-expanded) pointer-table loop in codegen | B5 | — | **INTEGRATED** | NOT about rolled loops: an expression selector was double-counted on the tracked stack; old hostiles were VACUOUS - see 4.71 |
| X63 | The `while` spelling escapes G1's PUBLISHED occurrence ceiling | C4 | X2 | **INTEGRATED** | publishes rather than expands, because expanding would have DELETED X2's evidence; +0 bytes on 9 shapes |
| X68 | A `for` body that writes its own counter has no stability check | — | X63 | **TODO** | the same hole X63 closes for `while`; tightening changes a currently-admitted shape |
| X3 | Result fan-in: one handler consuming two producer results | A4 | — | **BLOCKED (wall named, fails closed)** | transcript machinery ACCEPTS fan-in; only caller-side lowering cannot - one bounded compiler change - see 4.62 |
| X56 | `.emitReturn()` on a delegated call that also emits | C4 | X12 | **INTEGRATED** | the compiler was already right; the SDK had the return channel and event inverted; +0 bytes - see 4.74 |
| X55 | `invocation-transcript-v1.md` still names byte 11 `callMode:u8` | B6 | X5 | **INTEGRATED (premise was wrong)** | the doc does not name byte 11 at all - it specs a DIFFERENT unimplemented format; labelled as such |
| X4 | Publish exact minimum occurrence, not just a ceiling | A | G1 | INTEGRATED | floor + provenance published and wired into the planner |
| X5 | Bind call options as a committed transcript row field | A4 | X31 | **INTEGRATED** | byte 11 now committed; the projection verifier is the FIRST covenant ever to read it - see 4.62 |
| X6 | Stable diagnostics for unadmitted low-level shapes | A (wiring) | E2 | INTEGRATED | 8 shapes named, incl. one in a modifier body; ONE admitted-class leak remains |
| X7 | Assert the projection result cursor is exhausted | B | E1 | INTEGRATED | Closed a LIVE root-result forgery, not defence-in-depth |
| X8 | Two chunk-backed dynamic writes plus a collection write | C | S2 | INTEGRATED | NOT a silent miscompile; settles, fails closed past 1 chunk |
| X9 | Resolve G1-C compile-cost fragility in `HiddenBatch` | A | G1 | INTEGRATED | Lazy mutation analysis; 56.6s -> 35.7s, below pre-G1 |
| X10 | Grow the trailing chunk region past one output beside an entry mint | H3 | X8 | **SDK HALF INTEGRATED** | the pin was wrong IN KIND - the region grew and filled wrong; positional trace attribution - see 4.94 |
| X101 | Speculative chunk growth handles a single chunk var only | — | X10 | **TODO** | multi-var + mint + multi-chunk needs a real search, not a linear grow; inert until the covenant half lands |
| X11 | Delegate C2 sorted writes have no settling instance | A2 | — | **INTEGRATED** | premise stale; chasing it found a LIVE forgery - reader returned `[5n, 99n]` - see 4.64 |
| X12 | `emit`-funder delegate class does not settle | A2 | — | **INTEGRATED** | cause was split-facet data-NFT offsets, not a graft position; -6 bytes |
| X13 | Direct `withExternalCall` route does not balance callee blocks | B | L2 | INTEGRATED | assembler corrected; position remains covenant-UNBOUND |
| X14 | Wire the balanced-assembly preflight into the production send path | B | L2 | INTEGRATED (layer-3 only) | direct-route wiring DEFERRED to the owner - would reject 44.5% of settling sends |
| X17 | Decide whether to gate `StatefulTransactionBuilder.send()` | Main | X14 | **DECIDED: do not gate** | See 4.19; the model, not the sends, is what is wrong |
| X15 | Silent eligibility gap: no `hiddenBatch` route and NO diagnostic | A | — | INTEGRATED | REFUSED with a named reason and a remedy; silence ended |
| X18 | Void `target.call(payload)` leaks on the bus route | C | X6 | INTEGRATED | admitted on the bus route; planner handoff applied by Main |
| X19 | `m[k]` and `this.m[k]` diverge on the bus route | C+A | X15 | INTEGRATED (scoped) | bare spelling admitted; a second key alternative or `msg.sender` key still needs `bindEntryKeyParameters` |
| **SEC-5** | Pointer-table caller stops binding its own emission rows | A | C2 | **INTEGRATED (PARTIAL)** | closed for EFFECT-FREE handlers; effect-carrying variant still unbound - see 4.24 |
| **SEC-6** | Emission handler with a transfer/emit/token-container is unbound | C | SEC-5 | **INTEGRATED (REPAIRED)** | refusal replaced by X29's real repair - see 4.33 |
| **SEC-7** | Routed token-container transfer is silently dropped | C | SEC-6 | **INTEGRATED (fail-closed)** | spender-selectable; NOT bus-specific - see 4.33 |
| **SEC-8** | X29's shared reached flag permitted satoshi-container theft | A | X29 | **INTEGRATED (closed)** | per-handler flag; design credited to C, validated by A |
| X30 | Multi-ROW mid-chain participant rejects at input 2 | R1 | X29 | **RETRACTED - wrong as written** | a multi-row mid-chain participant DOES settle; R1 reached ordinal 1 via a `StrideKick` root, see 4.49 |
| **SEC-10** | One-armed conditional emit reserves an unsettled slot | C | SEC-9 | **INTEGRATED** | reframed: the class was never slot-specific - see 4.45 |
| **SEC-11** | SEC-9's refusal is event-only; `transferWidth` never compared | C | SEC-9 | **INTEGRATED** | closed by the same own-category immutable pin |
| **SEC-13** | Own-category immutable pin is absent for delegate/selfdestruct | S2 | SEC-11 | **INTEGRATED** | all 3 paths admitted the forgery; A rejects at input 0, B/C at input 2 - see 4.47 |
| **SEC-14** | Zero-parameter event: taken and not-taken rows are byte-identical | A2 | SEC-13 | **INTEGRATED** | LIVE: the taken path's covenant checks NEVER RAN; a plain P2SH was accepted - see 4.64 |
| **SEC-9** | Divergent event-frame widths leave a reached slot unverified | A | SEC-8 | **INTEGRATED (fail-closed)** | EXPLOITABLE - spurious event NFT accepted; gate counted pre-lowering emits |
| X31 | Call-option refusal is on `deriveCompiledGraphPlan` only | B | E2 | **INTEGRATED** | both entry points share one check; refusal NARROWED - see 4.40 |
| X32 | L2's derived gate is silenced by a bare `Unlocker` | B | L2 | **INTEGRATED** | out-of-scope now separated from in-scope-but-underivable |
| X36 | `planCompiledGraph` does not enforce occurrence bounds | S4 | X31 | **INTEGRATED** | one shared assertion on both entry points; bound taken from published capacity, NOT `bindConsumerCallsites` - see 4.50 |
| X33 | S2's `touchesCollection` does not descend through calls | C | S2 | **INTEGRATED** | BFS over the call graph; caught its own fn-pointer over-approximation |
| X34 | Relax the over-strict `this.`-spelled dynamic+collection refusal | A3 | — | **NO_CHANGE (measured)** | recorded premise misattributed; with the guard off every refused leg emits NO artifact |
| X35 | Eligibility oddity: stricter combination admitted, simpler refused | A3 | — | **NO_CHANGE (measured)** | correct conservative proxy; real key is per-row `conditional` entry slots, fix site `compiler.ts` |
| X29 | Thread a per-call-site output index into the subroutine | C | SEC-6 | **INTEGRATED, striding now PROVEN** | reviewed by R1: striding holds both directions; opened SEC-15 on its reserved slots |
| **SEC-15** | Forged log LIVE in X29's own unreached frame slots | S5 | X29 | **INTEGRATED** | per-slot ordinal binding; a SECOND forgeable entry point found repairing it - see 4.54 |
| X44 | Two reached event-settling sites collapse to one ordinal | H1 | SEC-15 | **RE-CHECKED, still unreachable** | the effect-free control rejects identically, so X41's limit refuses it, not X44's collapse - see 4.95 |
| X102 | The collection-iteration depth term is CALL-SITE dependent | — | X10 | **TODO** | `+1` is correct at one caller and wrong at the C2 INSERT arm; a shared constant cannot fix it, pass the depth |
| X103 | A worker cannot merge or check out integration commits into its worktree | — | — | **TODO (process)** | the permission classifier denies both; dispatch from a later base or relay the half as a patch |
| **SEC-18** | A route-reachable PURE READER read the pre-transaction value | I1 | X105 | **REVIEW FAILED (L2) - REOPENED** | the repair misses the FUNCTION-POINTER edge and the exploit still SETTLES; it also regressed an honest contract into a bare error - see 4.105 |
| **L2-F3** | SEC-18 misses a reader reached through a function pointer | L2 | SEC-18 | **HIGH, OPEN** | `GTT.ts:1685` reads only `resolvedFunction?.functionId`, `:1689` skips `functionReference`. Pointer spelling is **+0 B, byte-identical to base** - not journalled at all. Fix site is a live sibling's lease |
| **L2-F1a** | X111's gate is bypassed at consensus by two constructors | L2 | X111 | **HIGH, OPEN** | promotes the author's own caveat to an exploit: a hand-assembled `CompiledGraphPlan` and a dropped `invocationAnalysis` entry both SETTLE. The real repair is compiler-side |
| **L2-F2** | SEC-18's widening CRASHES an honest resource-shaped route | L2 | SEC-18 | **MEDIUM, OPEN (regression)** | `_self_alias` (`compiler.ts:1479`) is a third clone the widening admits; 4,109 B at base -> bare "Missing journal context" at HEAD. The STALE-READING variant is the one that compiles |
| **L2-F1b** | The X111 gate is blind to the `__scb_resource_` spelling | L2 | X111 | **MEDIUM, OPEN** | its prefix is `__scb_graph_` only, so `planCompiledGraph` ADMITS the hostile order; guard control confirms renaming the clone makes it fire |
| **L2-F1c** | `writtenVariablesOf` short-circuits before `clone.unknown` | L2 | X111 | **LOW, OPEN** | an `unknown` clone publishing one nonexistent write escapes the conservative arm |
| X104 | Persisted chunk read fails closed on the bus route | I1 | S3 | **CLOSED by SEC-18's cause** | my `dynamicReads` lead was FALSIFIED twice (I4, then I1 independently); it was the same classifier - see 4.99 |
| X105 | Journal divergence: is the spec or the implementation wrong? | I1 | S3 | **ANSWERED: the implementation** | both governing docs already defined `load(slot)` correctly; a direct-route filter was never widened - see 4.99 |
| X106 | The 223-byte SCB1 blob envelope has two unlinked homes | J2 | X49 | **INTEGRATED (SDK half)** | home is `@solidcash/utils`; compiler half still BLOCKED behind J1's `compiler.ts` lease |
| X57 | Should the three observer callers gate on relaxed limits? | J2 | — | **ANSWERED: leave all three** | the observer trace is NOT a faithful substitute - it derives PHANTOM state where the full trace correctly derives none - see 4.100 |
| X111 | Emission-clone readers read the pre-state | M3 | SEC-18 | **SCALAR HALF CLOSED AT CONSENSUS; DYNAMIC HALF LIVE** | both bypass constructors now refused at **input 1 by the COVENANT**, non-vacuity shown by reverting. My briefed premise was WRONG - the naive widening breaks C2 on a DYNAMIC slot giving two sources for one array, not on frame arity - see 4.111 |
| X138 | The X111 gate can be defeated by a spender publishing a FAKE write | M3 | X111 | **HIGH, OPEN** | `writtenVariablesOf` reads the SPENDER's own footprint, so one nonexistent write flips the hostile row set REFUSED -> ADMITTED. **The dynamic residual is live at consensus, gate or no gate.** Broader than L2-F1c: any published write, not only `unknown` |
| X135 | Two ERC-20 metadata getters published as state-changing | M1 | SEC-18 | **CLOSED - a CLASSIFICATION leak** | `GTT:3014` appends to `dynamicWrites` with no writer test and `Artifact.ts:257` read that as a write. X105 had gated the SCALAR sibling ten lines up; only the dynamic branch leaked. **Headline moves BACK to 2 of 12 / 4 handlers** - my 3-of-12 re-pin was wrong |
| X136 | The recovered handlers are VM-unproven | M1 | L2-F2 | **1 of 112 PROVED** | partition: 11 contracts byte-identical in BLOCK SHAPE only (**every script grew**; FakeToken is now 446 B from the 10,000-byte ceiling), 3 moved, 17 newly compiling. Airdrop settles; **111 unproven and it admits no writers**, so the writer risk is untouched |
| X139 | L2-F2 is INCOMPLETE: any INVOKER of a journal handler holds its context | M1 | L2-F2 | **TODO (fix measured, NOT shipped)** | `StakingRewards` still fails. M1 made a fix work and withheld it because it moves a contract that already compiled (EACCToken blockSize 72 -> 73), and L2-F2 held itself to a stricter bar |
| X129 | The preflight fix is fail-open on a stale dependency | M2 | X121 | **CLOSED - behavioural probe** | not a version string: a patched tarball or a future 0.0.9 would answer that wrong. Demonstrated against REAL 0.0.7. **Its own first cut would have refused two GOOD installs** - keyed off a constant two instruction sets publish but neither enforces - and its row 0 caught it |
| X126 | 7 of 8 broadcast sites are ungated | M2 | R1-gate | **MEASURED, NOTHING LANDED** | 5,370 broadcasts across 422 files. Site 3 costs exactly 2 tests, where a fixture pays 100 sat to a 10-byte output and the gate answers with **the same 474-satoshi threshold BCHN used to refuse C1**. Gate node-correct, fixture unrealistic - reported, not landed. Site 8 is DEAD CODE |
| X109 | Two non-relaxed VM callers discard the provider's limits | K1 | X57 | **REOPENED - premise falsified by me** | K1 argued limits are unenforced using the ONE field the mock patches into `ConsensusCommon`; measured, submit refuses both a strict stack item AND a strict op-cost budget at exactly 150 x 167 |
| X121 | Two X109 measurements cannot both hold for one provider profile | L1 | X109 | **RESOLVED: a DEPENDENCY VERSION, and the repair is APPLIED** | Measurement A falsified at 0.0.8 - it held only where nothing enforced the budget. `_strictRecursiveVmPreflight` now reads the provider's limits because the bare VM was fail-OPEN at strict profiles - see 4.108 |
| X128 | `/Code/cashscript/node_modules` VIOLATES its own manifest | L1 | X122 | **TODO - needs `yarn install` at the root** | `packages/solidcash` declares `^0.0.8`, which on a `0.0.x` version means EXACTLY 0.0.8; the root tree holds **0.0.7** and `yarn.lock` says 0.0.8. **Six worktrees** are on 0.0.7, measuring a version the manifest forbids. Not run here: a root install while three agents are live is an unsafe side effect |
| X129 | X121's own fix is FAIL-OPEN on 0.0.7, and only a test stands between | L1 | X121 | **TODO (HIGH)** | at 0.0.7 the decider applies stock 800 and refuses `decrement(24)/(40)` while the repaired preflight reads the published 10,000,000 and admits them. L1's words: a failing test is not a runtime guard. Fix = probe once in `MockNetworkProvider`'s constructor that the installed mem-cash honours `consensus`, and throw |
| X130 | `.build()` is still fail-open at a strict profile | L1 | X121 | **BLOCKED (hunk ready, both halves)** | `debugging.ts` should read the provider's limits and cannot: needs `LibauthTemplate.ts:153` to pass `transaction.provider`. L1 declined to half-land it, because an optional parameter nobody supplies reads as provider-aware while behaving bare |
| X122 | A worker worktree without `node_modules` resolves out to the MAIN checkout | K1 | — | **TODO (process, was live)** | K1 found its own imports resolving to `/Code/cashscript/node_modules` -> the main tree at `solidcash_v0.13.1`, i.e. testing another branch's code; it also had a `yarn build` fail `lerna: not found` exit 127 while reporting success through a pipe. K2/K3/K4 verified clean (own relative links) |
| R3-8 | F3's two soundness rules sat inside the catch that swallowed them | I2 | R3 | **INTEGRATED** | the FIFTH vacuous guard; A/B-proven with the reviewer's own break, and a too-broad break rejected as unfair evidence |
| R3-15 | The sweep's CONSENSUS_FIT claim never re-ran | I2 | R3 | **INTEGRATED** | 5/5 on the live node twice; a flipped unlocking byte is the direct proof the node EXECUTES rather than accepting on size |
| R3-13 | 16 present-tense figures left behind by the first sweep | I2 | X99 | **INTEGRATED** | root cause named: the X81 row was never written into the covenant history; residue is 23 x N exactly on all four capstones |
| R3-5 | Two committed NUL bytes hid the F3 census generator from grep | I2 | R3 | **INTEGRATED** | plain `grep -c` returned nothing at all pre-fix |
| X92 | Generated-source nodes carry no origin label | I2 | X98 | **INTEGRATED, now pinned** | a 49-line shift, both beyond the file; three subject breaks all red |
| X83 | The keccak side-car slot pre-check | I2 | — | **INTEGRATED, now pinned** | the index claim now rests on two measured artifacts, not a quoted message the rename deleted |
| X108 | `compiler-hidden-batch-v1.md`'s Release 5 table matches NEITHER build | L3 | X105 | **CLOSED - my diagnosis was WRONG** | not a different fixture: the SAME one, frozen at `99abfbe2` and written to the doc two minutes later, never re-derived through seven commits. Both tables re-derived and now assertable, 11 cases, failing 9/11 against the stale doc - see 4.106 |
| X123 | The same stale Release 0 figures propagated into 5 more docs, 13 sites | M4 | X108 | **CLOSED - and it was 13, not 12** | every figure re-derived by COMPILING the fixture the doc names, not copied. Consequences too: "roughly triples contract size" is dead at 1.52x, and **F4's own named counter-example INVERTED** - the token it predicted would silently compile oversize is 5,777 B with 4,223 headroom - see 4.110 |
| X136 | Four more rows marked FIXED on rotted citations, one of them MINE | M4 | X123 | **INTEGRATED** | my own X123 fix of F4 cited `compiler.ts:959-967`, which is collection-route key-witness synthesis and has **never** emitted a size diagnostic. F1/F2/F3/F5 all cite drifted lines, and "all F1-F6 closed" is contradicted by the completion review directly above it |
| X125 | The solc-corpus stride was never recorded | M4 | R3-16 | **ESTABLISHED, not inferred** | searching all strides 1..4,876, exactly **one** gives 407 - twelve - and the same search returns exactly `[1]` for the other three corpora, which is the control that it discriminates. `strideRecordedByProbe` stays false and the test asserts that gap |
| X132 | UnicrowClaim is still not bus-compilable | M4 | SEC-18 | **MY DIAGNOSIS WAS WRONG** | no option decides it, the SUBJECT does: `UnicrowClaim.sol` compiles under every option set that parses and has **no `refund` at all**. `refund` is `Unicrow.sol:218`, a separate file. The refusal is CORRECT - a transcript row has no field to bind a `value` option |
| X137 | `journal-bus-implementation-status`'s margin collapses 5,677 -> 693 B | M4 | X123 | **RECORDED** | **both sides** of its comparison were stale; the conclusion survives but can no longer carry any claim that graph covenants are comfortably cheaper |
| R3-16 | The corpus result rests on four unpinned external checkouts | L3 | R3 | **INTEGRATED** | all four pinned and currently AT their pins; detection is three-layered because a commit does NOT pin the denominator - SBE moved 139 -> 141 in-scope with its pin unchanged - see 4.106 |
| X124 | mistswap is NOT recreatable from any public commit | L3 | R3-16 | **RECORDED, not closeable** | a local unpushed commit; 15 of 16 targets byte-identical to public ancestor `1f8622bb`, exactly one differs - `BentoBoxV1.sol`, a load-bearing anchor. Divergence is cosmetic rebranding, immaterial to what the census measures |
| X125 | The solc-corpus row is a 1-in-12 stride SAMPLE and the stride was recorded nowhere | L3 | R3-16 | **TODO** | 407 of 4,876; a second unpinned reproducibility parameter moving the same denominators, now marked `strideIsInferred: true` with two corroborations |
| R1-gate | The gate must sit on FINALIZED BYTES, not at plan time | L4 | R1 | **INTEGRATED** | 7 rules, policy/consensus split ENFORCED (`allowNonRelayable` cannot reach a consensus refusal), C1's dust refusal reproduced in-repo with the mock ACCEPTING the bytes - see 4.107 |
| X126 | 7 of 8 `sendRawTransaction` sites are still ungated | L4 | R1-gate | **TODO (L4 declined to recommend its own 1-line fix)** | a Layer-3-shaped composition via `StatefulTransactionBuilder.drive().send()` reaches the network unjudged. Blast radius unmeasured, and R1 recorded an analogue rejecting 44.5% of sends |
| X127 | `Layer3DynamicChunksS3` "64-chunk value" is LOAD-SENSITIVE, not broken | — | S3 | **TODO (flake)** | green in isolation and in a 2-file batch (33/33 here), red under `--maxWorkers=2` across 31 files for two independent workers, on op-cost density 2,893,600 / 3,617. `failingInput()` returns null the line before, so the gate admits it |
| X109 | Two non-relaxed VM callers discard the provider's own limits | — | X57 | **TODO** | gate is `> 10_000`, so a provider AT 10,000 builds a bare VM: measured a program the raw VM ACCEPTS and the provider's verifier REJECTS. `StatefulTransactionBuilder.ts:2662,:2691` |
| X110 | A shared `refs/stash` entry survived from round s1 | — | — | **TODO (process, hazard live)** | 923 lines of pointer-table files; all five now PRESENT and four LARGER in-tree, so nothing unique - but a `stash pop` would resurrect older copies. Drop was denied by the classifier; needs the user |
| X111 | Emission-clone readers still read the pre-state, undiagnosable at compile time | I1 | SEC-18 | **BOUNDARY (measured, refusal reverted)** | a per-slot compile-time refusal false-refused C2 **23/23**: route-closure membership is not route-composition membership. Belongs at graph-planning time |
| X99 | The plan and ledger still cite stale census and capacity figures | J4 | X86 | **CLOSED by the full re-take** | 7 downstream claims invalidated; the ledger was wrong in SIX places in one row, now on its third generation of those figures - see 4.101 |
| X112 | The F3 census probe CLOBBERS a leased file on every run | J4 | F3 | **TODO (process)** | `layer3-corpus-probe-f3.mjs` overwrites `layer3-corpus-census-f3.ts` as a side effect; J4 restored and re-pinned it, but the next re-take will do it silently |
| R3-4 | The live drift detector cannot see redeem-length drift | J4 | R3 | **CONFIRMED from a THIRD direction** | reports "drifted: 0" truthfully and uselessly - it checks one-slot candidates only, and all 21 drifted rows have `blockSize > 1` |
| X113 | The size rule that hides the application headline is UNSTABLE | K2 | F3 | **CLOSED - my stated cause was WRONG** | not three rows crossing 8,000: measured, all three got **smaller** by 37 B and remain under. The real cause is that **three no longer COMPILE**, and the loop had no try/catch, so the headline test was **RED at baseline**. Headline retired by measurement - see 4.109 |
| **X132** | **A COMPILER REGRESSION: 3 corpus contracts that compiled now crash** | K2 | SEC-18 | **HIGH, OPEN** | `Missing journal context '__internal__state_write_*'` at `GTT.ts:6456`, plus one `__extaddr_` stack error. **Same error family as L2-F2**, so SEC-18's widening has a wider blast radius than L2 measured - relayed to the worker holding that file |
| R3-6 | A "committed CI gate" asserted two limits that do not exist | K2 | R3 | **INTEGRATED** | both constants pre-May-2026, and the co-spent half skipped all 6 inputs every run. K2 reports the ceilings CANNOT fail on this shape (588 B of 10,000; 32 B of 128) rather than leaving a green tick |
| R3-9 | Forged-log absence asserted against a reader returning `[]` | K2 | R3 | **INTEGRATED, proven BY CONSTRUCTION** | corrupting the reader's category left all three green while the one test that already had `toHaveLength(2)` went red |
| R3-10 | A guard repaired from vacuity had no liveness control | K2 | R3 | **INTEGRATED, worse than filed** | both copies split on NEWLINES, and the covenants put nine comparands on their own line, so any two-line pairwise comparison was invisible. Rejoining surfaced one immediately |
| R3-11 | Two byte-locality assertions pass on an unpatched transcript | K2 | R3 | **INTEGRATED** | copied the non-emptiness pattern the same files already use correctly thirty lines earlier |
| R3-12 | A control that claims a read-back never reads anything | K2 | R3 | **INTEGRATED, repaired not deleted** | its twin `SEC-9 gap impact` was the same duplicate and had nothing to repair into (a transfer slot carries no log), so it was folded: 18 -> 17 tests, strictly more asserted |
| X112 | The census probe clobbers a leased file on every run | K2 | J4 | **INTEGRATED** | measured: a one-file smoke run replaced **11,448 lines** of the committed census |
| X133 | Five MORE vacuous guards, found sideways | K2 | R3 | **INTEGRATED** | including `chunkCount > 0` guarding a **different quantity** than the list it bounds, and `handlers.every(eligible)` being true of a route that published **no handler** |
| X134 | The pairwise detector's vocabulary is still locking-bytecode-only | K2 | R3-10 | **KNOWN HOLE, declined** | a row-to-row comparison naming neither side's locking bytecode is still unflagged; K2 judged widening it blind too false-positive-prone and said so rather than shipping it |
| X100 | The route refusal is stamped on every external entry point, not the thrower | J1 | X81 | **INTEGRATED** | attribution by NAME (longest match, so `transfer` is not blamed for `transferFrom`) and POSITION; +3 routes, +4 handlers, **0 WORSE / 4 better**, solc slice 117/117 identical - see 4.102 |
| M3 | Share a clone's layout after unioning its entry operations | J1 | X100 | **IMPLEMENTED, MEASURED, WITHHELD** | reproduced my figure to the byte and is corpus-safe, but would admit a state-changing handler onto a **DEAD route** (see X115). `git revert 1163ec7a` restores it - see 4.102 |
| M4 | Widen the two escape axes on the result-route rule | J1 | X76b | **NOT WIDENED: the axis INVERTED** | since X29, edge-carrying clones are kept behind OP_INVOKE, so the rule is potentially OVER-strict; widening would have refused a shape that currently compiles |
| X107 | Diagnostic positions that name nothing or name the wrong file | J3 | X92 | **INTEGRATED** | construction-time stamp beats a reachability walk: the parse KNOWS the file. Wrong-file hard positions **21 -> 4**, labelled hard errors **0 -> 29**, +0 bytes - see 4.103 |
| X114 | The never-shrink guard has lost its subject TWICE | — | X94 | **SUBJECT RETIRED, rule still live** | 3 candidate replacements probed, none shrinks; the rule fires on **3 corpus rows** (J4), so the fix is a real subject, not a synthetic one |
| X115 | A constant-keyed `__evm_storage` SCB1 route has NEVER settled a row | J1 | M3 | **TODO (blocks M3)** | not the write, not the visibility, not the metadata: a **READ-ONLY** row fails identically at input 0 on OP_VERIFY, and graph mode cannot even build the batch. Caveats 2 of X100's 4 gained rows |
| X116 | The `public` spelling publishes `writesState:false` for a slot it writes | J1 | M3 | **TODO** | `Slot.sol`, pre-existing; M3's union covers clones only. Belongs to whoever owns the route's `entryAccesses` derivation |
| X117 | An `address`-typed storage-slot write does not settle on the DIRECT path | J1 | — | **TODO** | `OP_SPLIT out of range`, reproduced with `solidityImportCompat` alone, `+forceStateful` and `+bus`. Nothing to do with the bus |
| X118 | `discarded-result+emit` throws a BARE internal Error, no name or position | J1 | M4 | **TODO** | `GenerateTargetTraversal.ts:1723` / `InlineReturningStateHelpers`; the `external` spelling is fail-closed by X100, the `public` spelling still throws |
| X119 | Six positionless graph-handler aborts, and they reproduce at 6 not 14 | J3 | X107 | **TODO** | plain `throw new Error` at `SymbolTableTraversal.ts:1948,1958,1964,1972,1987,1995`; they need a node, and a DIRECT sweep sees zero of them |
| X120 | Four ANTLR error-listener positions still name the wrong file | J3 | X107 | **TODO** | the listener builds its `Location` during lexing, before `AstBuilder` opens the stamped scope; move the scope up in `compiler.ts:parseCode` |
| X45 | `EcrecoverRecovery` STATEFUL fails at a low rate on a rare nonce | A5 | — | **INTEGRATED** | 1.33% per draw, ~12.6% per file; deterministic by PRECONDITION, bounded retry replaces an unbounded loop |
| X54 | `BatchCostRegression` ERC-20 footprint budget has no margin | B6 | — | **INTEGRATED** | the overrides were HALVING a later package-wide fix; removing them restores 30,000 ms |
| X52 | C2's capacity block is stale in the same way as C1's and C3's | B6 | X38 | **INTEGRATED** | ALL SIX rows wrong; B6 did not copy the figures it was handed, and half had moved - see 4.67 |
| X53 | The PLAN's own copies of the stale C1/C3 figures still need correcting | B6 | X38 | **INTEGRATED** | full table delivered and applied to this document; 2,131,662 base confirmed |
| X41 | Container `min(reached site transfers)` bound is BLOCKED, not open | — | X29 | **BLOCKED** | the only shape exercising it is unreachable: two outgoing-edge rows never settle |
| X42 | `new Child(..)` and `blockhash(n)` in a handler crash instead of diagnosing | B5 | SEC-6 | **INTEGRATED** | the two crashes are at DIFFERENT sites, so the gate sits ahead of both; +0 bytes |
| X26 | A bare `m[k]` READ contributes nothing to the function footprint | C5 | X19 | **INTEGRATED** | SILENT under-reservation: blockSize 2 while the covenant addresses slot +2, so the next block lands on it - see 4.76 |
| X20 | Widen the assembly model to describe entry/aux inputs | C5 | — | **AUX HALF INTEGRATED; entry half refused** | keyed a POSITION off a WIDTH; one padding slot re-opened the fail-open. Entry half is not a modelling gap |
| X69 | The direct route declares no trailing region at all | F4 | X20 | **REFUSED (measured)** | one half has NO TERM to relax - a mapping is a CollectionNode; where the term fires it breaks 4 of 33 settled sends at input 0 |
| X21 | Reconcile the 1200-satoshi event NFT against the model's 1000 | B | X17 | LEASED | round 9; now measured - 1000 IS covenant-enforced for sidecar slots only |
| X22 | Result-consuming handler that also carries an effect | A | C1 | LEASED | round 9; name it or admit it - silence and sentinels both unacceptable |
| X23 | Reduce projection-verifier operation density | B | C1 | **PROVEN** | **C1 now fits ORDINARY BCH-2026 capacity**; see 4.22 |
| X24 | Unroll the constant-depth stack-write shuttle | C | X23 | INTEGRATED | -17.5% on projections, NOT the ~7x estimated - see 4.30 |
| **SEC-1** | Conditional delegate edge forges proxy state | C | — | **INTEGRATED** | Not-taken paths frozen, not forbidden; repositioned attack also pinned |
| **SEC-2** | Caller-chosen implementation parameter | C | — | **INTEGRATED (warn)** | Deliberately not fail-closed; guarded proxies stay silent |
| **SEC-3** | Iterated delegate edge collapses N to 1 | C | — | **INTEGRATED** | Fails closed with a named diagnostic, `for` and `while` |
| **SEC-4** | Library-call sugar emitted NO pin at all | C | — | **INTEGRATED** | CONFIRMED live forgery; state rewritten with NO delegate co-spent |
| X16 | Extend the delegate rules to SCB1/graph-handler routes | C | SEC-1 | INTEGRATED (compile-level) | exclusion NOT falsified; a VM-level graph forgery remains unattempted |

The main thread should reproduce this table in progress updates using only changed rows plus a one-line aggregate,
for example: `2 PROVEN / 3 INTEGRATED / 4 REVIEW / 12 TODO / 0 BLOCKED`.

Aggregate after round 3 integration: `2 PROVEN / 11 INTEGRATED / 0 REVIEW / 0 LEASED / 22 TODO / 0 BLOCKED`.

### 4.107 THREE WORKERS CORRECTED ME IN ONE ROUND, and the corrections were the deliverable

L1, L3 and L2 each overturned something I had written, and in two cases my error was the reason the row
existed at all. Recording that plainly, because a board where the integrator is never wrong is a board that
is not being read.

**L1 vs me on X109, and then me vs L1: it was a DEPENDENCY VERSION.** I falsified K1's claim that the
published consensus limits are unenforced. L1 falsified my falsification. Both of us were right about what we
ran, because **L1's worktree had `@mem-cash/validation@0.0.7` and this workspace installs `0.0.8`** - 0.0.8's
`TxVerifierConfig` declares `consensus?: ConsensusOverrides` and its verifier reads it 28 times; 0.0.7 has
neither. Under 0.0.8, six of L1's assertions fail, including its stated decision row. This is X122's second
and sharper form: K1's version of the trap was obvious (a different branch's code), L1's is invisible - the
right source, the wrong version of the dependency whose behaviour is the entire subject. **A gate whose
correctness depends on which patch release is installed is fragile whichever answer is right**, which is the
finding that outlives either. Sent back to L1 with the version fact and an instruction not to trust my
numbers either.

**L3 vs me on X108: my diagnosis was the error.** I filed it as "a different fixture, stale by an
unattributed amount". It is the SAME fixture, and the amount is fully attributable to three named commits.
L3 settled it with arithmetic rather than argument: constant unlock deltas across 2/3/8 rows (A -908,
B -1,432), which a substituted fixture cannot produce, and a tx-size delta exactly equal to their sum in all
three rows. Written into the doc **two minutes** after being measured, then never re-derived through seven
commits. The line worth keeping: **both the stale and current tables satisfy `budget = 800 * (41 + unlock)`,
and that internal consistency is why the stale table looked credible for seven commits. Self-consistency is
not currency.** It then found the Release 0 table stale too, with the corpus-token claim INVERTED outright,
and re-derived the consequences rather than the numbers - the "only 225 bytes of headroom" reasoning is dead
at 5,186 bytes.

**L2 vs SEC-18: the first adversarial review of the round FAILED a merged security fix.** See 4.105.

### 4.106 L3: pinning made an irreproducibility VISIBLE rather than papering over it

R3-16 asked for four corpora to be pinned. The valuable part is what pinning exposed.

**Detection had to be three-layered, and the middle layer earns its place by counterexample.** Commit,
file counts, and a sha256 digest over exactly the files the census reads. A commit does NOT pin the
denominator: solidity-by-example moved **139 -> 141** in-scope files with its pin unchanged and a clean tree,
because exclusions were removed from the harness. A digest alone would miss a matching-commit dirty tree; a
commit alone missed this.

**mistswap is not recreatable from any public commit**, and L3 refused to hide that behind a SHA. It sits on
a local unpushed commit; 15 of 16 targets are byte-identical to public ancestor `1f8622bb` and exactly one
differs - `BentoBoxV1.sol`, one of the two load-bearing anchors. The divergence is cosmetic rebranding and
immaterial to what the census measures, and the manifest says plainly that no public commit reproduces it,
with a test to stop a later pin refresh quietly upgrading that.

**A second unpinned reproducibility parameter**: the recorded solc-corpus row is a **1-in-12 stride sample,
407 of 4,876**, and the stride was written down nowhere. Marked `strideIsInferred: true` with both
corroborations stated rather than asserted as known.

**Two silent degradations closed**: `findSol` returned `[]` for a missing root, so an absent corpus
contributed zero while a total was still reported; and the mistswap list is `.filter(existsSync)`, so a
renamed target shrank the denominator. L3 refused to make absence a skip - the easy way to stay green
everywhere - on the grounds that a guard whose subject can vanish while it stays green is the defect the row
exists to close.

### 4.107b L4: the gate R1 proved was necessary, and a defect its author found by READING

R1 measured that a plan-time screen cannot be the gate: nothing in the corpus reaches its REFUSE threshold,
and a per-input VM evaluation is **structurally blind** to transaction size, dust and output template. L4
built the finalized-bytes gate on both Layer-3 entry points - one judging `buildLibauthTransaction()`, one
judging `decodeTransactionUnsafe` of the literal broadcast hex.

**The policy/consensus split is enforced, not annotated**: `allowNonRelayable` admits a policy-only refusal
and cannot reach a consensus one, and suppressed policy refusals are still named. It is a caller argument and
never a provider field - reading `provider.policy.enforceDust` is exactly how dust came to be present,
correct and switched off. The gate reads **zero** provider limits, asserted against a profile publishing
10,000,000-byte ceilings.

**`standard-output-template` is deliberately absent**, and the code says why: X64 measured that BCHN v29 does
not enforce it. A rule refusing more than the node is wrong, not conservative.

**C1's refusal is reproduced in-repo, and the control is what makes it a wiring proof**: the perturbed bytes
are ACCEPTED by the mock network, so every covenant is satisfied and the gate is the only objector.

**The file defends itself against the vacuity class**: a `DEMONSTRATED` set must equal the rule-id set, so a
rule added without a byte-exact hostile pair fails the suite. Every rule has an admit/refuse pair differing
in ONE byte, with the message matched on its arithmetic. At the 1,000,000-byte boundary, the added rule IS
the added byte.

**L4 found a defect in its own rule by reading BCHN's source, not by a red test.** `isPushOnlyBytecode`
rejected `OP_RESERVED` and its own test asserted that; `CScript::IsPushOnly` is `if (opcode > OP_16) return
false` and its comment records `OP_RESERVED` as push-only. The gate was refusing a scriptSig BCHN accepts -
the identical error that got `standard-output-template` deleted.

**Three things it declined to ship**: a min-relay-fee rule (a real finalized-bytes property, but the mock
publishes `minRelayFeePerKb` unconditionally, so unlike dust the class was never invisible and the
justification does not transfer); a minimum-transaction-size rule (structurally unable to fire on any
Layer-3 shape - the sixth vacuous guard on this effort had it landed); and a dust defect in the SDK's slot
values that it had framed as a live production bug and then measured away, downgrading it to a pinned reading
that fails if any of three numbers moves. It also refused to recommend its own one-line coverage extension
(X126): 7 of 8 `sendRawTransaction` sites remain ungated, the hunk is trivial and in scope, and it declined
because the blast radius is unmeasured and R1 recorded an analogue rejecting 44.5% of sends.

### 4.104 K1: the honest half closed a live exploit; the other half I had to falsify

**X111's exploit was real and K1 refused to overclaim the fix.** At `8d2fe0b5` a router emitting
`withdraw(80)` then `assertFloor(50)` against an opening balance of 100 passed preflight and the mocknet VM
**resolved** - the emission-clone residual of SEC-18, reachable because `graphTailHandlers`
(`compiler.ts:912`) is not only outgoing-call handlers: under a controller, a handler merely reading
`msg.sender` is in it. K1 used that as the cheapest subject.

**The gate is not a soundness repair, and K1 said so in its own headline rather than in a footnote.** It
refuses at witness-construction time. The exploit bytes settled at base, no covenant moved, so the same bytes
still settle if any other constructor produces them - **X111 remains live at consensus level.** Worse, the
hostile order is not a spender's choice: it is the order the caller contract's own body emits and the
projection verifier then enforces, so **the composition an honest author writes is the one the gate refuses.**
It converts a silent wrong answer into a named refusal, and that is all.

What made planning time work where compile time failed 23/23: `invocationAnalysis` publishes per-function
reads/writes **and the clones themselves**, so emission-clone-ness is the compiler's own answer rather than a
proxy. Two rules keep it from over-refusing, both measured - **per slot** (C2's `absorb` writes `state:total`,
disjoint from `state:legs`, and `registerCredit`/`registerDebit` write `legs` but are not ROWS, which is
exactly why the compile-time version false-refused) and **order** (only an earlier writer makes a read stale;
ignoring order refuses the honest reader-first composition). H1 was proven non-vacuous by deliberate break.

**X109 I had to falsify, and the row is REOPENED rather than closed.** K1's own new test failed at the composed
HEAD - which is the whole reason composition gets verified instead of trusted. Chasing it broke the row's
central claim. K1 concluded the published limits are "rules nothing enforces" from a true grep (zero hits for
`config.consensus` in mem-cash) plus an inference that does not follow. Measured:

| published limit | submit path |
|---|---|
| `maximumStackItemBytes: 8` | **REJECTS** - "Maximum stack item length: 8 bytes" |
| `operationCostBudgetPerByte: 150` | **REJECTS** at exactly `150 x 167 = 25,050` |

The overrides built at `MockNetworkProvider.ts:80-98` reach `createTxVerifier` and bite; the exact arithmetic
is what makes the second a measurement of the *published* value rather than of some unrelated ceiling. **And
the instructive part: K1 demonstrated non-enforcement using `maximumStackItemBytes`, which is the one field the
mock explicitly patches into `ConsensusCommon` at `:264-271`.** It picked an enforced field to argue
non-enforcement.

So `ForProvider` looks faithful and J2's proposed repair may be correct - but I did not apply it. K1's
regression measurement cannot hold for the same profile as the row above, so one of the two compares different
provider configurations, and the recursion path is precisely where the risk lives. Two P2PKH probes do not
settle it (X121). Row 1 stands, because it is a claim about the two CONSTRUCTORS rather than about the decider,
and I added its missing guard: the same spends settle when only the attacked limit is relaxed.

**Both source comments K1 left asserted the falsified premise as settled fact.** A wrong comment in the code
outlives a wrong report, so both now carry the contradiction and state that the status quo is conservative only
because it is the status quo.

**Process defect, X122, and it was live**: K1's worktree had no `node_modules`, so `solidc` and
`@solidcash/utils` resolved up to `/Code/cashscript/node_modules` - the **main checkout**, at
`solidcash_v0.13.1`, i.e. a different branch's code. Its first `yarn build` also failed `lerna: not found`
exit 127 **while reporting success through a pipe**. It detected both and fixed resolution mid-run. I verified
K2/K3/K4 independently: each created correctly-scoped relative links into its own worktree, so they are clean.
Every future dispatch must state this check explicitly.

### 4.102 J1: the biggest structural fix of the iteration, and the best result was a change WITHHELD

**X100 shipped.** The route-generation refusal was stamped on every external entry point that reached the
fallback's visibility arm, so one unsupported handler cost a contract its entire route - 10 of 12 contracts in
the earlier measurement. Attribution now runs on two channels: NAME, where the message contains a clone name
and the LONGEST matching handler wins (so `transfer` is not blamed for `transferFrom`), and POSITION, where a
`SolidCashError`'s `node.location` falls inside exactly one recorded external span - which works only because
`cloneNode` shares `Location` objects by reference. Only external spans are recorded, so `public` keeps
hard-throwing; J1 preserved that asymmetry deliberately and said so rather than smoothing it.

Adoption is gated on never-worse **as a rule, not an expectation**:
`admittedHandlerCount(attributed) >= admittedHandlerCount(refusedAll)`. And the corpus was measured BOTH WAYS
with the same probe against both builds: eacc+SBE routes 124 -> **127**, handlers 404 -> **408**, refusals
272 -> **268**, 0 rows lost, 0 gained, **0 WORSE, 4 better**; the solc slice is **117/117 identical**, same
reason histogram. J1 also flagged that its absolute totals use a different stride than the quoted headline, so
only the delta is comparable - the kind of caveat that stops a figure being mis-cited later.

**M3 is the most valuable row in the packet, and nothing shipped.** J1 implemented it exactly as handed over,
reproduced my costed figure **to the byte** (+1,689.0 B, both handlers admitted), and confirmed it corpus-safe
(only two `__evm_storage` rows move; the solc slice stays 117/117). Then it withheld it on evidence the
handover did not have: **an SCB1 route over a constant-keyed `__evm_storage` entry cannot settle any row at
all.** Not the write, not the visibility, not the metadata - a READ-ONLY row fails identically at input 0 on
OP_VERIFY, and in graph mode the SDK refuses to build the batch. M3 would therefore have admitted a
state-changing handler onto a dead route, which is precisely the worse-than-the-refusal hazard the row was
scoped to avoid. Filed as X115; `git revert 1163ec7a` restores M3 the day such a route verifies.

**M4 was not widened because the measurement inverted the axis I briefed.** Since X29, an effect-carrying clone
WITH an outgoing edge is kept behind `OP_INVOKE` rather than flattened, so the premise
`result-route-requires-effect-free-handlers` rests on no longer holds for edge-carrying clones. Measured:
`bound-result+transfer` is refused in both spellings, while `discarded-result+transfer` is **eligible and
compiles** in both. The rule is potentially OVER-strict - the opposite direction from my expectation - and
widening `graphResultStatement` would have refused a shape that currently compiles.

**Reported rather than fixed, all outside J1's lease**: X115 above, X116 (the `public` spelling publishes
`writesState:false` for a slot it writes), X117 (an `address`-typed storage-slot write does not settle even on
the DIRECT path, `OP_SPLIT out of range`, nothing to do with the bus), X118 (`discarded-result+emit` throws a
BARE internal `Error` with no name, position or remedy). And the caveat it volunteered: two of X100's four
gained rows gain a **published** route whose settlement is broken upstream by X115.

**My error, recorded here rather than quietly:** I deleted J1's baseline worktree `.worktrees/j1-i6-base`
during housekeeping while J1 was still using it. Every baseline measurement had already been captured to JSON,
so nothing was lost - but that was luck, not sequencing. Worktree cleanup must check the live-agent list.

### 4.103 X107: the parse already knew the answer

J3 was briefed to walk reachability and install a root. It did something stronger: `AstBuilder` already
receives the id of the file it is parsing, so the parse **knows** which file it is reading. Stamping that on
every `Location` at construction time - the same mechanism as X92's generated-source mark - means the label
structurally cannot name a re-exporting intermediate, needs no import list present, and has no ordering rule
to get wrong.

Proven on a real three-level case: `UniswapV2Factory` -> `UniswapV2Pair` -> `UniswapV2ERC20` labels ERC20 line
91 column 35, landing exactly on `ecrecover` - the holder, not the intermediate. The headline resolves:
`ERC20Mock.sol` (15 lines) reporting `at Line 16` now reads `at Line 16, Column 4 of imported .../Context.sol`,
which is 24 lines long and whose line 16 is the declaration the error is about.

Measured: wrong-file hard positions **21 -> 4**; hard errors labelled with the holding file **0 -> 29**; zero
diagnostics anywhere name a file that does not exist. Six previously "plausible" bare positions were imported
lines that happened to FIT the root file - silently wrong rather than obviously wrong.

**+0 bytes, and the determinism trap was handled BEFORE the claim**: two compiles of one file from one dist
give different whole-artifact hashes and identical stripped hashes, because `updatedAt` moves. With that
established, base vs after is 206 artifacts byte-identical. J3 also declined to manufacture a VM case,
correctly - this is diagnostics only, nothing reaches the VM - and stated where its own change is INERT rather
than reporting sweep counts alone.

It disproved one of my briefed figures: the positionless-abort family reproduces at **6, not 14**, and only in
bus mode over the sbe corpus. A direct sweep sees zero, which is presumably why 14 never reproduced.

**Integration half (mine)**: the three sibling-owned call sites. `SymbolTableTraversal.diagLine` now prefers
the stamp over the map, resolving all 39 warn-side false labels; the second warn site never called `diagLine`
at all - it inlined its own `at line ${line}` - which is exactly why it was unlabelled. And
`GenerateTargetTraversal` interpolated a whole `Location`, printing **`at [object Object]`**, which the F3
census had recorded as a real corpus outcome, so it was reaching users. The regression test J3 could not land
(tests were outside its lease) is in, and its guards were demonstrated able to FAIL: stubbing `sourceFileOf`
turns the holding-file assertion red while leaving the three negative controls green, which is the correct
signature since those controls assert the ABSENCE of a label.

### 4.101 J4 re-measured everything: the envelope held, and SEVEN citations did not

The row was opened because this board has had seven stale-figure incidents and nothing had re-measured the
whole picture at once. Six iterations had changed the verifier three times, lifted three route gates and moved
the application headline.

**What did NOT move is the most important result.** The entire capacity envelope reproduces at `8685ae91`:
every serialized size, every binding-limit attribution, both covenants, all four gate chains, the 428 routed
contracts and the whole application headline. The three verifier changes and three gate lifts moved handler
admission and redeem scripts; **they did not move the envelope.** All four capstones re-mined on the live node
at their current bytes - A13 22,195 h5664, C2 51,049 h5847, C1 60,617 h5721, C3 96,302 h5500 - each with its
hostile control refused on the same chain in the same run.

**The harness was cross-validated against an independent oracle rather than against itself**: J4's new mock
A13 harness gives 22,195 B, equal to the node's figure to the byte.

**Two ratios moved and both are fully attributed.** Every capstone sits exactly `23 x N` above the pre-X81
series (+69/+92/+115/+184 at N=3/4/5/8) with participant routes byte-identical, so A13's and C3's moved binding
ratios are X81's projection growth and nothing else. The instructive part: `layer3-corpus-fit-f3.md` records
X81's +23 and the pre-X81 capstone bytes **on the same line** - it named the cause without carrying the
consequence, which is this board's recurring failure mode in miniature. Corrected in place.

**The census moved and the move is accounted for.** Named refusals 280 -> **258**, route-scope 53% -> **48%**,
route-scope-plus-generation-gap 63% -> **59%**. The 22-refusal drop is exactly `mixed-scalar -22`,
`result-route -2`, `would-shrink +2` - X94's lift landing, not drift. The census MODULE's own headline is stale
(895/435/286 against the board's 1008/441/290); the board's figures are the correct ones.

**Seven downstream claims were invalidated, and the ledger was wrong in six places in one row** - it still
said 504/367, "all 12 admit a READ-ONLY surface and nothing else" with 134 refused, and 148/280 (53%). All
corrected; that row is now on its THIRD generation of these figures (80% -> 53% -> 48%).

**Two findings that outlast the numbers:**

- **The size rule that hides the headline is itself unstable.** The live assertion's `redeemBytes < 8000` rule
  selected 6 rows at the recorded bytes and selects **3** at the measured ones, because `UnicrowDispute`,
  `FakeToken` and `UnicrowArbitrator` all crossed 8,000. Re-taking the census makes that guard WEAKER, not
  stronger.
- **The one live drift detector cannot see this drift.** `Layer3CorpusFitF3.test.ts` reports "rows whose
  recorded redeem length has drifted: 0" - true, and useless, because it only checks one-slot candidates and
  all 21 drifted rows have `blockSize > 1`. That is R3-4 confirmed from a third independent direction, and it
  is now the strongest argument on the board for widening that check.

**Process trap, filed as X112**: the F3 census probe **overwrites `layer3-corpus-census-f3.ts`** as a side
effect of every run. J4 restored it and re-verified the pin, but anyone re-taking the census will silently
clobber a leased file.

J4 also declined what it had not established: four node results it did not re-measure are explicitly NOT
carried forward, and it refused to report a wall-clock comparison against the recorded 29 minutes because the
re-take ran alongside a live node and vitest, where cross-run timing is noise. And when C3's hostile node
control returned an RPC timeout, it diagnosed that as not-a-refusal instead of banking it as one - the
aborted-evaluation trap in a new guise.

### 4.99 SEC-18: one classifier made every pure reader read the PRE-state, and it was exploitable

The largest security finding since SEC-14, and it had been sitting behind a lead I got wrong twice.

**The mechanism is one predicate.** `GenerateTargetTraversal.ts:1756` filtered the journal closure with
`writerIds.has(id) && slots.size > 0` - a function had to WRITE a slot before it could join. A handler that
touches a journal slot and writes nothing was dropped entirely, so reached from `__scb1` as an `OP_INVOKE`
subroutine it had no `pendingStateWrites` and `visitStateAccess` fell through to `emitStateFieldRead`: the
input NFT commitment, i.e. the pre-transaction value. The filter was added deliberately in `bd593a11` to
confine scalar journals to mutable owner state, and it is CORRECT in direct mode. It was simply never
widened when the batch route arrived. So this was a scope defect, not a spec disagreement - I1 checked both
governing documents and neither admits the shipped behaviour.

**Why it is a bypass and not a curiosity.** The tempting dismissal is that a spender who wants a stale read
can just not write. That is wrong, because the guard row is not the spender's choice: the caller contract's
own body emits `IVault(v).withdraw(a0); IVault(v).assertFloor(a1);` and the graph transcript binds the row
list. Open 100, withdraw 80, `assertFloor(50)`: true of 100, false of 20. **At base it passes preflight and
settles.** The post-state stayed exactly authenticated the whole time - nothing here forges state - which is
precisely why it survived every settlement suite we have. A guard satisfied against a value the transaction
is simultaneously changing is invisible to any test that only checks the post-state.

**X104 was the same cause, and my lead was falsified twice.** I told I1 the failing chunk-read shape was
missing `dynamicReads`. I4 falsified it first; I1 reproduced the falsification independently rather than
taking my word or its predecessor's. The real cause: a dropped read-only handler emitted its dynamic read
INSIDE the subroutine, which has no trailing-region context. Journalling hoists the read into `__scb1` where
`preAllocateDynamicWrite` knows the region base. No separate repair, no new diagnostic, no SDK change - and
a fail-closed wall turned out to be fail-closed **by accident**.

**I1 broke the C2 capstone on the way and said so.** The first version widened to the whole route closure:
C2 went 14/25 red, honest A -> B -> A failing at input 0. Cause instrumented, not guessed - a read-only
GRAPH EMISSION CLONE reading `legs`, whose frame is owned by the effect-frame protocol, so extra journal
slots leave it one item deeper than the caller pushes. Exactly the arity hazard the note at
`visitFunctionDefinition` warns about. Emission clones are now excluded.

**The residual cannot be diagnosed at compile time, and that was MEASURED rather than asserted.** I1 built
the fail-closed refusal for the emission-clone boundary and it false-refused C2 **entirely, 23/23**:
`registerCredit`/`registerDebit` write `legs` and sit in the route closure even when no such row exists in
the actual transaction. Route-closure membership is not route-composition membership, so any compile-time
refusal here is necessarily over-broad. Filed as X111 for graph-planning time. Note what this is: a worker
implementing a fix, measuring that it is worse than the gap, and reverting it - the opposite of the failure
mode where a fail-closed boundary quietly becomes an unchecked witness path.

**Cost, and one surprise.** +15 B for one pure scalar reader, +18 B for two, 0 B for a read-and-write reader,
and **-88 B** for a pure dynamic reader. Runtime falls too: the Release 5 B covenant drops 43/55/195
instructions at 2/3/8 rows, because a per-row commitment re-read becomes one frame pick. Direct mode is
byte-identical, and 1278/1278 fixture hashes are unchanged across 639 `.scash` x 2 option modes - which is
what bounds the blast radius to bus routes rather than a claim that nothing broke.

**Integration half.** The 8 red assertions were in the tests/docs lease, so I applied them, and I
re-measured all 8 figures rather than copying I1's - all matched. The 5 `Layer3DynamicChunksS3` assertions
that recorded the divergence as FACT now record read-your-writes; bodies unchanged, so each pair still
differs only in the expected value. Both guard negative controls pass before and after, and the single-row
one is now labelled to say why it is insensitive (one reader, no writer, so the journal value coincides with
the pre-state). Opened X108 rather than re-pinning the spec's Release 5 table silently: its figures match
neither build.

### 4.100 X57 answered by finding the observer derives PHANTOM state

J2 was asked whether three `debug()` callers should keep gating on relaxed limits. The answer is leave all
three, and the reason is not the performance argument the row was opened on.

**The performance case is real but small.** At ordinary capacity a probe is bounded by BCH-2026 density
control, not by taste: measured worst case 77,216 states, ~0.9 s, ~64 MB, at which point the VM refuses the
next operation. Above ordinary capacity `debug()` does not crawl, it THROWS - libauth's `proxyDebug` does
`results.push(...debugResult)` and blows V8's spread-argument limit with `RangeError` by 124,014 states. The
relaxed mock budget is 1.24 MILLION times the ordinary ceiling, so the gate is the only thing making a
relaxed probe possible at all.

**The decisive finding is a soundness one.** `extractCommitmentMapFromTrace` treats ANY opcode between
`OP_OUTPUTTOKENCOMMITMENT` and `OP_EQUALVERIFY` as proof the pair is not a commitment verification. The
observer retains only 6 opcodes - so an intervening opcode outside that set is INVISIBLE to it. Pinned to
input 0, real VM both sides, extractor transcribed verbatim: on a genuine verification both agree and derive
`a0..a7`; with `OP_SIZE OP_DROP` intervening the full trace correctly derives NOTHING and **the observer
derives phantom `a0..a7` for output 0**. The third row is the guard that makes this a finding rather than a
coincidence: when the intervening opcode IS one the observer keeps, both agree again - isolating invisibility
to the observer as the cause, not intervention as such. The same lossy projection feeds the sparse deploy
probe, so this covers two of the three call sites verbatim.

J2 also declined to claim the parts it had not established: whether 223 is the right number (inherited, not
re-measured), and gate 3, which emits console text only, so relaxing it would change log formatting rather
than correctness.

**Side finding, filed as X109.** The gate is `> 10_000`, so a provider publishing limits AT 10,000 counts as
"not relaxed" - and both non-relaxed branches then build a bare `createVirtualMachineBch2026()`, discarding
that provider's limits. Measured: one program that the raw VM ACCEPTS and the provider's own verifier
REJECTS. The failure tracer and strict preflight report under different rules than the verifier that decides.

### 4.97 THE HEADLINE MOVES: state-changing handlers reach the bus on real contracts

Merged at `9958d9c0`; two re-pointed guards at `c1ec6d60`. This is the result five iterations were aimed at.

**F3's application headline, re-verified unchanged at FOUR commits, has moved.** Was: *12 bus-reachable, **0**
admitting a state-changing handler, 134 refused.* Now: **12 bus-reachable, 2 admitting a state-changing handler,
4 state-changing handlers admitted, 130 refused** - application handlers **26 -> 88**. The subjects are
`UniswapV2Factory` (`setFeeTo`, `setFeeToSetter`, `setMigrator`) and `UniswapV2Pair.initialize`.

**And the live assertion does not catch it.** `Layer3CorpusFitF3.test.ts` still passes 12/12, because its
`redeemBytes < 8000` rule **excludes both subjects** (**58,786 B and 16,864 B** measured at `8685ae91`; the
43,939 and 14,556 first recorded here were PRE-LIFT sizes reported beside POST-LIFT admissions, a mixed-vintage
citation J4 caught). The headline lives in a recorded
census module and is **now stale** - which is R3-4 confirmed from the opposite direction.

**The gate protected something different from what the board briefed.** The brief said lifting it would put a row
with **no physical entry** into a route sized for per-row entry slots. In fact every physical entry key on a route
is a **wrapper parameter**, so the entry read is hoisted to the top of the wrapper and its write-back to the
bottom - **outside the row dispatch**. A row addressing no entry therefore flushes the reserved entry
**UNCHANGED, not unconstrained**.

**The genuine exception is narrower and is what the gate now keys on**: a `perRow` witness, which fails **two**
measured ways with the gate fully removed - an unbindable `_r{n}` witness, and **duplicate co-spend of one entry
NFT**, because the alias gating lives inside the entry handler's dispatch arm.

**Soundness stated in the byte table's form**: `blockLayout` **identical**, `entryAccesses` **identical** - same
collection, same offset, same wrapper parameter. The claim is *"the entry the covenant addresses is the same slot
the other route already addressed"*.

Corpus delta both ways: admitted handlers **895 -> 1008**, state-changing **435 -> 441**, contracts admitting one
**286 -> 290**, `mixed-scalar` firings 40 -> 18, and **0 rows lost, 0 gained, 0 shrank**. All five blockSize moves
explained.

**X95 REFUSED, and the prior author's judgement did not hold.** That worker judged the narrowing sound and shipped
the conservative version anyway. G2 shipped the narrowing, measured it, and found it **admits a shape a negative
control pins as refused** - dynamic and packed array state variables, which resolve to `StateArrayAssignNode`.
Its **only** corpus subject is one contract, against the control. Reverted, finding recorded at the site.

**X88 + X89 closed together, and X89 alone would not have been enough** - the sharper half: an iteration
contributes no key, so `directKeys` stays empty **and** the footprint carries no `collection:` resource, making
`nonEntryCollectionOnly` **vacuously true** and letting the chain fall through with **no reason at all**. Nor is
`directKeys.size === 0` the right test. The refusal is unconditional and named.

**Two guards lost their subject to this lift and were re-pointed rather than re-expected.** X35's row asserted the
refusal and argued it was *"the correct conservative proxy until those slots are conditional"* - the measurement
**inverted that argument**, so its companion case (the slot is unconditional) becomes the **supporting evidence**
rather than the justification. And the absence-diagnostic case was borrowing `mixed-scalar` as a convenient
refused handler; **two replacement candidates were tried and are now admitted too**, so it is re-pointed at a
refusal grounded in the handler's own shape. **That file has now had its borrowed subject lifted twice.**

**X73's never-shrink guard lost its subject for the THIRD time** - it had been re-pointed onto the mixed-scalar
gate one commit before that gate was lifted. Recommend checking reachability rather than re-pointing a fourth.

### 4.98 X101: measured before building, and the search was unnecessary

Merged at `2a2ba8d4`.

**The linear grow generalises.** The covenant reaches the trailing C2 NEW node's **address** before it verifies
**any** chunk - so while the region is all `'00'` placeholders, only its **total output count** is observable and
**the per-var split is not**. The first probe past the NEW node reads every `$len` off the state data NFT and
snaps each var to its exact count.

**The decisive measurement**: growing the **first** var and growing the **last** var produce **the same accepted
transaction** for (200,60), (60,200) and (200,200) - **including the two cases whose grown split is wrong with
the right total**. So a search would have been wasted work, and I3 measured that before building one.

The hostile swaps two commitments **while leaving both chunk addresses in place**, so the rejection is about
contents rather than layout - refused at input 0, honest control re-broadcast and accepted. The bound is loud and
by name, and confirmed to be on the **total** (4000 B one var -> `0 of 32`; 2000+2000 -> `0 of 31`).

**Its revert check reports zero discriminating power on this tree, and says so.** 6 of 6 pass with the change
reverted; with the unlanded covenant depth applied locally, **3 of 4 flip and 1 passes both ways**. Stated in the
commit message and the test header rather than left for a reader to discover.

**And it declined to add a validator it could have justified.** On base, the NEW node's 65-byte commitment is
credited into a chunk window - but under a correct covenant that is **dead code**, and its only live effect today
is a count in a message on a path that already refuses. *"That is the check-without-evidence shape the board
refuses."*


### 4.96 X92 found X93 was creating FALSE labels; S3's constraint is 32x earlier than expected

**X92 - the row's four named sites no longer existed**, because X93 had routed all six diagnostic sites through
one helper. G1 landed the mark **inside that helper** instead - one home rather than a four-way duplication, and
it picks up the two non-`unused` sites for free.

**The composition finding is the important one: X92 is a REPAIR of X93, not an addition to it.** An imported
label asserts *"line N is real in file F on disk"*. A generated position is in a string **no file holds**, so the
imported label was a **specific false label naming a real file** - precisely the failure X93 refused in direct
mode, **silently reappearing in bus mode**. Measured at base: **84 false imported labels on solidity-by-example
and 664 on MistSwap, every one naming a file too short to hold the line.** After X92, both are **0**.

Scale: beyond-the-file unlabelled positions across 152 SBE files, **5,151 -> 0**. The cheapest instance
reproduces exactly - a **6-line** contract reporting `at line 57` under one option and `at line 106` under
another, a **49-line shift**.

**Its no-artifact oracle was wrong first, and it caught that itself.** Hashing whole artifacts showed 49/74 rows
changed - **but also 61/88 in DIRECT mode, where the change cannot be active**. Cause: `artifact.updatedAt` is a
wall-clock stamp. It re-verified determinism (30/30 identical modulo that field), re-ran, and got **0/74 and
0/88**.

**Two claims from the brief did not reproduce, and it removed rather than papered over them.** The
`SushiMakerKashi.sol` instance is gone - **zero** `__scb_arg*` positions anywhere in MistSwap now - and the
residue is **6 position-less aborts, not 14**. It also measured direct mode as **non-discriminating** rather than
asserting it.

**S3 - the write direction crosses handler boundaries, and the binding constraint is not where anyone was
looking.** 24 VM cases settle, including two handler rows on one participant flushing only the last write, two
dynamic participants each owning a private region (138 slots), and **64 chunks - exactly the declared capacity**,
which doubles as the knob-liveness control.

**The constraint is the 223-byte SCB1 blob, not the trailing region.** An argument-carried value caps at
**202 bytes = 2 chunks**; the same handler **computing** its value reaches all **64**. **The envelope binds 32x
earlier than the region does** - so the region was never the wall.

Nine hostiles, each attacking a distinct invariant - commitment, length authority, order, bounds, permutation,
old-chunk consumption, capability, category, and **alias** - all pinned to **input 1**. An over-capacity run now
refuses at **zero signature requests**, where it previously built, funded, signed, and then failed at a
projection input naming nothing about the cause.

**Two limits reported rather than fixed**, both outside the lease. A persisted read of a non-empty chunk-backed
value has **no diagnostic at all**. And more seriously: **a later handler row reading a variable observes the
PRE-transaction value and the transaction SETTLES**, which **diverges from the documented single read-your-writes
journal**. Not chunk-specific - a scalar behaves identically, and the read-and-write case is still journalled.
Opened as **X104** and **X105**.

**Nothing moved downstream**, checked rather than assumed: projection **4,121 B**, controller **1,493 / 1,459 B**,
both exactly the pinned figures - after it caught its own first misread of 1,514/1,480 as `Contract.bytecode`
including the 21-byte constructor push. It also flagged `MAX_HIDDEN_BATCH_BLOB_BYTES = 223` duplicated as a bare
`223` in the controller source - a two-place constant that must move together (**X106**).


### 4.95 H1 landed NOTHING, correctly, and found the one-liner would have been wrong

Empty commit range, tree byte-identical to its base. Three rows, three different stated reasons not to land.

**M3 is not one mechanism - the row as filed conflates two shapes sharing an error string and nothing else.**
Enumerated across 190 files (mistswap 16/16, eacc 22/22, solidity-by-example 152/152; solc-corpus explicitly
**not** enumerated and every claim scoped accordingly):

- **A**: an SCB1 route clone (`Slot.sol`), thrower `__scb_external_write`, `kind=entry`, route lost at rung 4.
- **B**: an **`internal` constructor** - `constructor() internal { ...; emit E(...); }`, the OZ `Ownable` idiom,
  legal Solidity <=0.6. **Nothing to do with the route.** `isEntryPoint` is derived from visibility, so an
  internal constructor gets no `blockLayout`, but GTT still compiles it through `emitEntryPointFunctionDefine`
  and runs `emitEventCovenantVerification`. Minimal repro, **one variable each way**: drop the `emit` -> compiles;
  `internal` -> `public` -> compiles.

**Sub-shape A has two independent gaps, not one.** The clone is created after `InlineStoragePointerCalls` because
the synthesis decision reads a **pre-lowering** footprint that cannot see a collection created later. H1 forced
early synthesis and **it still throws**, because the collection is not yet `sorted` at that point.

**The naive fix compiles and MUST NOT SHIP - this is the finding.** Applied as a dist experiment, it turns
`route=ABSENT handlers=0` into **`route=PRESENT handlers=2`**, confirming that closing M3 returns a whole
contract's route. But the route then publishes **`writesState=false`** and `operations ['read']` for a slot the
clone's covenant **upserts**, because `collectEntryAccesses` walks only a function's own body. `StatefulContract`
branches on `operations.includes('write')` to pick a read-only unlocker, so a write row would be built with a
preserved output against a covenant demanding a rewritten one. **"A route that reports a write surface it cannot
exercise - worse than the refusal."** H1 labelled this a **code-path argument, not VM-measured**, and handed over
a two-part repair (union the operations by `(collection, keyParams, slotIndex)`, refuse on identity mismatch,
then share the layout) measured to give `writesState=true`, `operations ['read','write']`, **layout unchanged**.

Cost if landed: **+1,689 B** on `TestSlot` - which is the SCB1 route it currently loses entirely - and the
metadata union itself is **+0**.

**X44's premise was re-checked rather than inherited, and still holds.** The discriminator is the **effect-free
control**: a handler carrying no event and no transfer rejects with the identical `OP_VERIFY at input 0`, and it
has no ordinals to collapse - so the refusal is X41's independent limit, not X44's. Honest weakness stated: all
five reject with the same symptom, **so the control carries the argument, not the symptom.**

**X10's covenant line: DO NOT LAND, and a new finding that would have made it wrong.** The SDK half sits **ahead
of H1's base**, and both `git merge` and `git checkout <paths>` were **denied by the permission classifier**, so
the joint control could not be produced - and by the board's own measurement `+6` **alone** is worse than base.
*"Landing it unverified would be shipping a known regression on the chance it composes."*

What it verified statically **supports** `+6`: `emitAddDynamicOutputsBeforeEntries` has **exactly one call site**,
and five lines earlier the same routine already uses `returnOutputIdx + 6` with a comment enumerating the five
raw C2 working fields plus the running index. *"`+1` is the bug; `+6` is the constant already established at that
exact point."*

**But the same routine's collection-iteration term still uses `+1` at that same depth-6 call site - and that
helper has a SECOND caller where `+1` is CORRECT.** So the correction is **call-site-dependent and cannot be
fixed by a constant in the shared helper**; a clean repair passes the depth as a parameter. A contract with both
a collection iteration and a dynamic write reaching the C2 INSERT arm would still compute a wrong offset. Opened
as **X102**.

**An operational finding**: a worker cannot merge or check out integration commits into its own worktree - the
permission classifier denies both. Any row whose evidence needs a sibling's merged half must either be dispatched
from a later base or have that half relayed as a patch. Opened as **X103**.

### 4.94 X10's pin was wrong IN KIND: the region grew, and filled itself wrong

Merged at `ac95f239`.

**The recorded pin said the region does not grow past one output. It grows - and fills the outputs wrong.** The
root cause is that `extractCommitmentsFromTrace` is **positional**: the covenant's NEW-node check lands inside
the chunk window, and its single observation was credited to chunk **0**. **The count was never the problem.**

Measured on the base tree, `MINT` being a dynamic write plus a C2 entry mint:

| shape | outcome | outputs 3 / 4 / 5 |
| --- | --- | --- |
| MINT 120 | ACCEPTED | chunk (123 B) / NEW (65 B) / change |
| MINT 121, 200 | rejected at input 0 | **NEW commitment** / `00` / **the SAME NEW commitment** |
| READ 200 | ACCEPTED | chunk0 (123 B) / chunk1 (83 B) / change |

The fix keys chunk commitments by **their own output index** - which the loop-entry and value-chunk derivations
already did - **refuses an underived region by name before signing**, and grows speculatively by one output per
zero-progress probe to break the ordering cycle a trailing mint creates.

**The shape that must not survive is gone, in bytes**: 121 B goes **2,537 -> 0 broadcast**, 200 B goes
**2,617 -> 0**. No broadcast contains `00` at a chunk output, and no commitment appears at two outputs of one
transaction - asserted directly rather than inferred.

**It re-verified the claim its predecessor explicitly could not.** The earlier worker reported the `+1` vs `+6`
PICK-depth figure **as someone else's measurement rather than its own**, having failed to separate the causes
from outside the file. H3 separated them from the VM trace: at `+6` the PICK lands on the 200-byte value,
`OP_SIZE` reads `c800`, `+119 / 120` yields `02`, and the NEW index becomes 5.

**And the joint measurement is the finding.** `+6` **alone is WORSE than the SDK half alone** - it aborts probe 1
before the data NFT, so `A$len` is never learned and an **all-`00` transaction is broadcast**. `+6` **plus** the
merged growth: 121 and 200 both **ACCEPT**. So the long-standing *"necessary and not sufficient"* verdict stands,
and **the missing sufficiency is what shipped**. The covenant line is handed to the agent holding that file.

**Discriminating power verified by reverting the source**: **2 of 6** new tests fail on base and pass with the
change; the other 4 - positive, two guards, hostile - **pass on both, as they must**. The three guards are what
stop the result being credited to "multi-chunk writes" or to "a C2 mint".

**Residual stated**: speculative growth is restricted to a **single** chunk var, so multi-var plus mint plus
multi-chunk needs a real search rather than a linear grow. Inert in this tree, so it carries no test of its own
until the covenant half lands. Opened as **X101**.

### 4.93 X81 taken for a better reason than the board's, and X97 closed by a fixpoint

Merged at `775da681` (X81) and `fdb2d08e` (X97); re-pins at `cd7baa9c`.

**X81 - the board's price was wrong and its argument was weak, and the worker corrected both.** The brief said
the axiom was priced at **19 B**. Measured: **+28**, across four encodings tried, and the 4,117 figure **could not
be reproduced**. Net landed **+23**, only because an *independent* fold of a local refunds -5.

**Its own argument for taking it is better than the one it was given.** The board offered "one fewer thing to
reason about". The real content is that **the direction of the map changed**: the old form went VALUE->BYTES
through `OP_NUM2BIN`, a **partial** function whose domain sits one VM constant away from the field's own domain;
the new goes BYTES->VALUE through `OP_BIN2NUM`, **total**, resting on injectivity rather than a bound. Its words:
*"BCH has raised its stack and commitment limits twice in two years; a covenant whose admitted set NARROWS when a
limit RISES is a forward-compatibility hazard, not a fail-closed convenience."*

**Three of four bar items pass exactly** - `require(` 51->51, `&&`/`||` 13/6 unchanged, controller **byte-identical
by hash** - and **the fourth cannot pass for any byte-positive change**, which it said rather than dropped: *"the
verifier got denser, not only bigger - the board priced this on one limit and it lands on two."* Exactly N inputs
per shape rise, all of them projections, and **every worst-density ratio still reproduces to ten decimals**. No
binding limit moves. C3 96,118 -> **96,302**, headroom 3,882 -> **3,698**.

**`MEASURED_COVENANTS` is 4,121, not 4,117**, so the dead-covenant arithmetic is **421 x N**, not 444 x N. Five
pins re-applied; the integration owner missed the instruction count on the first pass and the X25 test caught it.

**The frontier survey found the count was the wrong UNIT.** The refusal is stamped on **every** external entry
point reaching that arm, not the handler that threw - so **10 of 12 contracts lose the SCB1 route entirely**. The
frontier is **12 contracts, not 30 handlers**. Its own first probe read one channel and saw **3**, a 10x
undercount, which is why the committed census reads both. Six mechanisms mapped with throw sites, fix sites and
v1-structural classification, verifying the prior worker's list as **contract** counts and finding **one it
missed**. The cheap high-value fix it named: attribute a throw to the handler containing the error position and
refuse **only that one**, turning "the contract loses its route" into "one named handler refusal". Opened as
**X100**.

**X97 - the fix was not the missing branch, and that is the finding.** Adding the straight-line path *after* the
loop path **does not work**: in the mixed shape the straight-line `keccak256` runs **before** the loop, so a
loop-only probe aborts on the straight-line bind before it ever sees an iteration - *which is literally where the
old "no side-car read found in the probe trace" came from*. **Source order decides which family runs first, so no
sequential order works.** Replaced by one progressive **fixpoint** that lays out the full candidate transaction
each round and reads both families off a single trace, with both families at the same relative offsets in the
trial as in the final layout.

**The positive control lands on X90's exact pinned witness** - contract 0, stateful side-car 1, stateless side-car
2 (`NI-2`, `NI=4`), funder 3 - with commitments asserted as the real hash chain. The hostile is pinned to **input
2, the index the builder itself picks**. And the guard negative has **two halves**: the `NI=3` collision is
VM-rejected *and* **the builder never emits it**, refused by name.

**A candour note worth copying**: G4 marked its own window/loop-block overlap check as **defensive and
unreachable** under the current arithmetic, *"rather than letting a reader think it is load-bearing."*

**Lease flagged rather than assumed**: it edited X90's test file because that file's negative control asserted
*"the SDK cannot build it"* - the precise assertion its row inverts. Surgical, with the four covenant-side controls
X90 proved left untouched, and an offer to revert. Correct call: the assertion was its own row's subject.

### 4.92 The census re-taken in FULL: the 80% figure is 53%, and "hours" was 29 minutes

Merged at `775da681`. This section retires several figures the board has been quoting, including one of its most
repeated.

**"Re-taking the census is hours" was wrong: it is 29 minutes.** So F2 re-took **all four corpora**, not a
scoped subset, and stamped it. The movement is large:

| | before | after |
| --- | --- | --- |
| routed / eligible | 367 | **428** |
| one-slot candidates | 71 | **86** |
| **total refusals** | **455** | **280** |
| bus-failure rows naming NO cause | 15 | **0** |
| visibility gate | 172 | **0** |
| `external-handler-route-generation-unsupported` | 0 | **29** |

**THE 80% CLAIM IS RETIRED.** Route-scope re-derives under the report's own grouping to **148/280 = 53%**, or
**177/280 = 63%** counting the new route-generation gap. The denominator shrank around a **fixed floor of 56
`no-entry-point-declared`**. The integration owner had quoted 80% in three briefs; it is 53%.

**And the "37 handlers" frontier is 29** on a full-corpus census, against 37 from the visibility-gate worker's own
delta measurement. Two different samples; the in-flight survey was told to enumerate from the committed census
rather than inherit either.

**X85 - F2 got it wrong first, and its own new assertion caught it.** The override fields mean the **DEPLOYED**
redeem length, not the compiled one. The projection takes no constructor args, so 4,121 either way against the
basis's 4,542 - **444 B of real staleness per participant**. But the controller takes a `bytes20 initializer`:
**compiles to 1,493 and deploys at 1,514**, which is the calibration's figure exactly. F2's first pass read 1,493
off `debug.bytecode` and passed a controller input **21 bytes shorter than the script the transaction pushes** -
**anti-conservative**, in a row whose entire purpose is conservatism. Caught by the assertion it added in the same
change (`expected 1514 to be 1493`). So the dead covenant is **444 x N + 0**, not 444 x N + 21.

**The stale default was giving WRONG CAPACITY ANSWERS, not just a loose band**: it answered **OVER on 23 of 1,712
rows that actually fit**. Band 15.0-18.9% -> **4.8-8.3%**; population 43 -> **50 of 86**. And X85's own filed
claim was slightly wrong too - it returns to **+4.8%..+8.3%**, not the "+4.3%..+7.5% originally published".

**X86's drift was not where it was filed.** All 71 one-slot rows probed: exactly **3 drifted, all solc-corpus,
none an application contract - and no application contract is a one-slot candidate at all.** So *"re-taking
mistswap+eacc could not have moved the population by one row"*, which is precisely what the row asked for.

**The structural half is the better fix.** Built-graph rows took redeem length **from the record** and asserted
equality **inside the caller's try/catch**, so stale rows joined the `require` failures and the population fell
45 -> 43 **silently**. Both rows now take the length from their **own compile** and assert that the compiled
participant **is** the script the master input pushes - a within-run property **that cannot go stale**.

**X87 does not reproduce, and three reports of it were against a file that no longer exists.** The assertion is
**not in the tree** - replaced in an ancestor of the baseline. F2 verified it passing twice, then hardened it
anyway (subject found by **walking** rather than pinned to one census row) because the guard was one row from
going red.

**The real `expected 0 to be greater than 0` was somewhere else entirely**, and only running the whole file found
it: the **X84** test asserts over the unattributed bus-failure head, and F2's re-take took that to **0 of 88** -
so the test was asserting **X84's repair had NOT landed**. Inverted to assert the closure, with the mechanism
measured live so the new assertion is not vacuous.

**The never-shrink guard HAD lost its subject - and is not unreachable.** X76 refuses `approve` in **both**
spellings, byte-identically, and the public control now has a route. F2 re-pinned it on a fresh arithmetic subject
(two public scalars plus one external collection handler: public admits 1, external admits 2), reproducing in
graph-controller mode too, and **kept the old subject as its own test recording the collapse**. That is the fourth
vacuous-guard instance on this board and the first to be re-pointed rather than deleted.

**F3's application headline holds at a FOURTH commit**: **12 bus-reachable, 0 admitting a state-changing handler,
134 refused** - identical at `6a685f33`, `6183cf12` and `b4d33fc1`. What moved is the census's **admitted** count,
38 -> **26**, because the 38 was stale.

**A dependency flagged for an in-flight sibling**: X81 would move the projection verifier 4,098 -> 4,117 (PREDICTION, never reconciled: the landed figure is **4,121**, off by 4 - see 4.93), which
moves `MEASURED_COVENANTS` and the 444 with it. Relayed, so the board does not ship a third stale number.

**Still to correct, outside F2's lease**: the plan and ledger cite **455 / 364 / 367 / 45**. Opened as **X99**.

### 4.91 X93 fixed by keying on CLONE IDENTITY; X69 refused, and one half has no term to relax

Merged at `c427ac67`.

**X93 - the row's own question answered, and the answer changed the fix's shape.** The four `unused variable`
sites do carry the import case, but they are **17.8% of it**: re-measured over 345 files, **44 files, 314 warning
instances, 7 distinct texts**, with **14 of the compiler's 24 `at line` sites** in lease covering **280/314 =
89.2%**. So a per-site patch was the wrong shape and F4 added **one shared helper** instead.

**The mechanism is the interesting part.** `Location` carries no file identity, and matching node identity against
the import tree resolved only **3 of 17** positions - because `InheritanceExpansionTransformation` **clones**, and
clones carry **the same `Location` instance by reference**. Keying the map on the Location resolved **17 of 17**.

**Two ordering details were load-bearing, and F4 found both by being wrong first.** A shallow map labelled line
170 as `ERC20.sol` when the truth is `SafeMath.sol:170` - and F4's own note is the right standard: **"a specific
false label is worse than none."** And last-write-wins let a clone in ERC20 overwrite Context.sol's claim on the
`msg.sender` line, so it is first-write-wins on Location keys.

**478 labelled positions across 40 files: 0 named a file that does not exist, 0 named a file too short to hold
the line**, and 463 further verified the cited symbol is literally on that line of that file. The 15 residual
mismatches are compiler-generated symbol names where **file and line are still correct** - X92's class, not a
wrong label. **+0 bytes, 345/345 artifacts byte-identical.**

**The hostile is pinned to the exact mislabel its own first cut produced** - `not.toContain('"/B.sol"')` for a
position reached through a re-exporting intermediate - plus two guard negatives: in the same compile, the root
file's own symbol stays **unlabelled**, and a no-import contract prints byte-exact unchanged output.

**60 unlabelled positions remain and every one is out of lease**, named site by site (`AstBuilder` hex literal and
gas option, `TypeCheckTraversal` integer range and `address(bytes20)`), plus every hard error via `Errors.ts` -
including the row's own `ERC20Mock.sol` "Line 16 of 15", which is an `AssignTypeError` and is **Context.sol's line
16**. Opened as **X98**.

**X69 - REFUSED, and the decisive finding is that one half has NO TERM TO RELAX.** A mapping is a
`CollectionNode`, and **all seven terms of `needsTrailingRegion` are about dynamic state VARIABLES**, loops,
keccak or ecrecover. Measured: `stateVars=0, dynamicNames=0, collections=1`, and with the direct-route gate
**fully removed** the C2 insert **still** got `trailingBase=undefined`. So the 381 `token outside every
participant block` category is not a relaxation at all - it needs a **new reservation class keyed on
`contract.collections.length`**, which would put 64 slots on nearly every stateful contract.

**Where the term can fire, it breaks settled sends.** **4 of 33 previously-settling sends** became
`OP_VERIFY` failures at **input 0**, the master covenant, all four value-returning plus dynamic-write. *"That is a
soundness regression, not a diagnostic one."*

**And it buys no describability, at +226% transaction size**: `arr.push(9)` goes 1,513 -> **4,938 bytes** and is
**still REFUSED** (unbalanced 67/66). It is **arithmetically self-limiting** - the SDK requests `capacity + 1`
funders, so at capacity 64 the funder budget exactly equals the slack one more fixed slot removes.

**The row's stated span was short by a file**: `GenerateTargetTraversal` carries two live
`trailingBase === undefined` branches that flip the moment the direct route declares a region. F4 measured that
both sides moved the chunk consistently, so that pairing is **not** the cause of the VM failure - and then said
the thing that matters: **"I did not isolate which covenant check fails, and I do not claim to have."**

X28's unsound-narrowing warning was also **re-confirmed live on a fresh shape**: `touchesDynamic=false` for a
function whose body is `arr.push(9)`. The measurement is recorded beside the predicate so the next reader does not
re-walk it.

### 4.89 X90 is SATISFIABLE and SOUND - both halves of X83's sentence were wrong, oppositely

Merged at `8f05bc0c`.

**X90 - X83 believed the mixed stateless shape unsatisfiable and said it had not proved it. It is satisfiable, and
X83 was right to refuse to act.** F1 confirmed the premise **from emitted ASM** rather than from the description:
straight-line reads `OP_TXINPUTCOUNT OP_2 OP_SUB` against the **stateless** hash, the loop reads
`OP_INPUTINDEX OP_1ADD OP_2 OP_PICK OP_ADD` with the 2,390-byte **stateful** covenant byte-compared inline.

**Satisfiable**: `NI`/`NO` are free, so the two families need not collide. A **positive control passes on the 2026
VM** at pinned indices - contract 0, stateful side-car 1, stateless side-car **2** (`NI-2` with `NI=4`), funder 3.

**And sound, so satisfying it is not an attack.** Each read binds `preimage == its own argument`, then reads the
commitment at the index that covenant kind's **own self-preservation tail provably writes**: stateless
`(NI-2)+NO-NI = NO-2`, stateful `I+1+counter`. Both agree with the master. The **hostile confirms** it: a side-car
honestly committing `keccak256(y)` for `y != x` at the pinned index is rejected by the master's `OP_VERIFY`.

**The real defect is the builder, and that is where X83's intuition came from.**
`TransactionBuilder.ts:258` takes an early `continue` on `keccakLoopReads` into
`addStatelessKeccakLoopCoSpends`, which splices **only stateful** side-cars and never reaches the straight-line
stateless path below - so `send()` always fails with *"no side-car read found in the probe trace"*. The guard
negative control reproduces exactly that: the SDK's natural `NI=3` forces `NI-2 == I+1+0 == 1` and fails closed.
Opened as **X97**; outside F1's lease, reported not touched.

**NOT refused, per the standing rule.** It compiles today, a satisfying spend exists, nothing is forgeable - so a
refusal would remove a working artifact for **zero** soundness gain. **Zero compiler change for this row.**

### 4.90 X91 did not reproduce as briefed, and the class is wider than filed

**The briefed option set was wrong, and the reason it was wrong IS the gap.** `Multicall2.sol` with the
**controller** dies earlier on an unrelated named refusal. The crash reproduces on `+hiddenBatch` **without** the
controller - and *no controller means no graph route, so nothing is a `graphEmissionHandler` and X42's gate never
runs at all.*

**The origin is a call EDGE, not an effect**, traced in four steps: `SymbolTableTraversal.ts:1475` appends
`__internal__blockhashInputIndex` to any `usesBlockhash` function **unconditionally** - unlike
`__internal__msgSenderCategory` twelve lines earlier, which **is** skipped for a route handler; the type checker
auto-forwards it as an identifier naming the caller's own same-named param; `__scb1` declares no such param; codegen
evaluates it and throws bare. **X42 guarded the callee's effects; this belongs to the edge**, so the guard sits in
`visitUserFunctionCall`, checked against the caller's own stack - the exact condition the argument loop aborts on.

**Wider than filed, found by enumerating shapes rather than sampling**: it also fires on the **plain direct
route**, no hidden batch involved - an ordinary function that never reads `blockhash` calling one that does. Two
reasons with **empirically verified different remedies**, and the message states the remedy that does **not** work
(a void callee still becomes a subroutine).

**The deploy half has no escape, measured**: `new C(..)` injects no synthetic witness, and `spawn` compiles at
4,169 / 4,837 bytes.

**Census enumerated with the discriminating set derived, not guessed**: every file containing `blockhash` **or**
`msg.sender` - the two **forwardable** witnesses - since a contract with neither cannot forward one. **209 files:
0 byte drift, 0 status flips, 72 identical FAIL heads, exactly 1 row changed.** +0 bytes across a pinned 13-row
table.

**And it corrected X76 in passing.** Multicall2's forwarded identifier reported **Line 63 of a 74-line file**,
inside an unrelated function - a position that exists but names the wrong thing. It now blames the real
`blockhash(blockNumber)` at **Line 34, Column 20**, asserted by parsing the line back out of the message.

### 4.88 TWO gates lifted, and the byte table IS the soundness argument

Merged at `699730a3`. Iteration 1's E1, which held `compiler.ts` through two iterations.

**Two of the three stacked gates are lifted**: `result-route` now demotes only handlers that **carry** an effect, with
event and value modes recomputed from the survivors - the old rule read `eventMode`, a property of the **set**, so
**one emitting sibling refused every effect-free handler and the route vanished**. And
`normalizeBareEntryAccesses` rewrites the clone's bare `ArrayAccess`/`ArrayAssign` into the `Mapping*` nodes
`SymbolTableTraversal` would have produced - the **same decision procedure**, including the packed and
dynamic-state-array exclusions.

**Corpus delta measured both ways, which is the part that makes it trustworthy:**

| | apps (190 rows) | solc sample (478 rows) |
| --- | --- | --- |
| new compile failures / rows disappeared | **0 / 0** | **0 / 0** |
| routes lost / eligibility lost | **0 / 0** | **0 / 0** |
| routes gained | **+6** | **+11** |
| handlers newly eligible | **+21** | **+75** |
| state-changing gained / lost | **1 / 0** | **1 / 0** |

`collection-helper-route-not-enabled` fell **88 -> 67** on apps and **55 -> 5** on solc;
`external-handler-would-shrink-the-route` **22 -> 5**.

**The byte-cost table is the soundness argument, not decoration.** Every newly admitted bare shape lands
**exactly on its dotted twin's byte count** - 4211/4211, 4152/4152, 2531/2531, 5854/5854. E1's own framing:
*"the soundness argument is therefore not 'the route looks right' but 'the route is the same script the other
spelling already reached'."* The 4-handler bare ERC-20 also went from a hard
`UndefinedReferenceError: __scb_arg_2_1` crash to a working 5,854-byte route.

**Two state-changing handlers on REAL corpus contracts, 0 lost**, re-derived by recompiling every changed file
against both dists and reading `artifact.abi[].writesState`: `EventSubscription.subscribe()` (a bare mapping write
plus a dynamic-array push) and **`TestToken.issueTokens()` - a real ERC-20 mint**.

**A regression the measurement caught that no test or reading found.** The first solc pass showed **4 files
stopped compiling**, and because a throw fails the whole multi-contract compile, **22 contract rows
disappeared**. Both causes were pre-existing route-generation gaps the refusals had been hiding. Fixed by turning
X73's two-rung fallback into a **four-rung monotone ladder** (`[ext,bare,result]` TTT -> TTF -> TFF -> FFF) whose
last two rungs reproduce X73's exactly, where the widest that compiles wins and the first error is re-raised if
none does. **Same class X73's own measurement caught** - and E1 stated that its corpus check *did* detect this and
that nothing else would have.

**Honest scoping, and it keeps a claim the board has now re-verified three times.** Neither corpus handler is
itself VM-settled - both are admitted only in **graph-controller** mode, needing ~200 lines of
authenticated-graph harness. What settles is the **shape**: the bare two-alternative ERC-20 `transferFrom`,
byte-identical to the dotted route the corpus test already settles. **F3's application headline is UNMOVED** -
all three application-corpus gains are read-only, and the two state-changing gains are on solidity-by-example and
solc. And the solc figure is a deterministic **450-file sample**, not its full denominator.

**`mixed-scalar` was NOT attempted, with a reason worth more than an attempt.** It is the only one of the three
whose relaxation would put **a row with no physical entry into a route sized for per-row entry slots**, so it
needs its own mixed-route VM settle. 139 apps / 88 solc firings, unchanged. Opened as **X94**.

**Also declined as over-conservative but deliberately kept**: `bareShapeIsNormalizable` blocks on any bare index
of a non-locally-bound non-collection name; tightening it to collection names only would widen the gain and E1
judged it sound - but shipped the measured version rather than the wider one. Opened as **X95**.

**One re-pin is substantive rather than mechanical**, and it is the third instance of this class on this board:
X73's never-shrink guard may **no longer have a subject** - the ERC-20 scenario it was built for no longer
shrinks, and firings of that reason fell 22 -> 5. Same shape as the vacuous `participantLbc` regex and R1's
positive control that lost its subject. Handed to the tests/docs holder with instructions to check whether the
guard is now unreachable rather than just update its number.

### 4.87 X83 lands with a SECOND FACE left standing; X76 is wider than filed and BLOCKED

Merged at `d2363af0`.

**X83's origin is not the lookup, and E2 instrumented rather than guessed.** `keccakInLoop` is a **whole-function**
flag; when set, `computeBlockLayout` reserves **zero** fixed `keccakSideCar` slots, because a loop reads one
side-car per iteration from the trailing region under a runtime counter. But codegen only routes there while
`keccakLoopActive` is live - so a `keccak256` call **outside** the loop in the same function still asks for a
fixed slot that was never reserved.

**X42's lesson applied twice over.** The guard is a **pre-check at the top of `emitKeccakComputeCall`**, before
any opcode is emitted and before `keccakPreimageParams` is mutated - and it checks **against the layout** rather
than against `keccakInLoop`, which also catches a static-count/emission-count disagreement under its own reason.

**`MerkleTree.sol` is not written as a mix**, which is the part worth remembering: a fixed-bound loop is unrolled
**before** the keccak pre-scan, so a `string[4]` loop became 4 straight-line calls beside the genuine `while`
loop's 1. Both orderings fail, at slot `[0]` or `[1]`, because the emission index is shared.

**The corpus check was enumerated, not sampled.** All **78** files containing `keccak256` across three corpora,
140 contract entries, compiled with the guard live and with it disabled in `dist`: **120 artifacts byte-identical,
19 of 20 error heads identical, exactly 1 row changed.** And E2 stated the boundary itself - *"a contract with no
`keccak256` is not discriminating here and I make no claim from one."* +0 bytes on every shape.

**A SECOND FACE of the same root cause, measured and deliberately left standing.** On a **stateless** function the
mixed shape does **not** crash: it produces an artifact whose straight-line call reads count-relative
`OP_TXINPUTCOUNT - 2` against the **stateless** compute covenant, while the loop reads absolute-forward
`OP_INPUTINDEX + 1 + counter` against the **stateful** one compared inline. One transaction would have to supply
two different covenant kinds at overlapping indices.

E2's handling is the standard to copy: *"I believe it is unsatisfiable (fail-closed) rather than unsound, but **I
did not prove satisfiability either way**"* - and refusing it would **remove an artifact that exists today**,
which is a behaviour change rather than a diagnostic one. So it reported instead of acting. Opened as **X90**.

**And X42's own guard escapes.** `Multicall2.sol` under `+hiddenBatch` still dies on
`Expected variable '__internal__blockhashInputIndex' does not exist on the stack` - X42's *second* crash, outside
its graph-emission-handler gate. Opened as **X91**.

**X76 is wider than the row filed, and E2 found that by scanning rather than constructing.** **24 hand-built
fixtures did not reproduce it**; a corpus scan did - `SushiMakerKashi.sol`, `Line 42` under `+controller`, exactly
the figure the row records. **And it is worse than filed: that position falls INSIDE the file** (line 42 is a
state-variable declaration), so nothing signals it is wrong.

**The class is far larger than one error.** **161 distinct corpus files emit a warning citing a line beyond the
file**, 138 naming a generated `__scb_*` symbol. The cheapest live instance is a **6-line** contract reporting
`'__scb_graph_msg_value' at line 58` under `+hiddenBatch` and **`at line 107`** under `+controller` - a position
beyond a 6-line file that **moves 49 lines** on an unrelated option. **These print in this repo's own test output
today.** A distinct sibling also fell out: **13 rows report a position in an IMPORTED file with no label**
(`ERC20Mock.sol` Line 16 of 15; `KashiPairMock.sol` Line 990 of 22), which the marking does **not** fix.

**BLOCKED by measurement, not by assertion**: the in-lease half alone does not compile
(`TS2339: Property 'generatedOrigin' does not exist on type 'Location'`), because the mark must exist before any
diagnostic can read it. The minimum viable change spans **4 files, one of them `compiler.ts`, which E1 holds.**
Prototyped, built, demonstrated on both channels, reverted, and the diff saved. **+0 bytes measured two ways**,
with the discriminating set correctly identified as bus-mode contracts only, since marked positions exist solely
inside a synthesized route. Opened as **X92**, with the note that stamping at **construction** is deliberate -
later lowering passes clone and re-parent nodes, so a post-parse walk misses everything they create.

**A brief of mine was wrong.** I gave E2 `packages/solidc/src/ast/Errors.ts` as part of its lease. **That file
does not exist**; it is `packages/solidc/src/Errors.ts`. E2 treated the real one as leased and said so.

### 4.86 X77's premise was WRONG and moves nothing; X78's diagnosis was right and its conclusion too strong

Merged at `91f673ce`. Iteration 1 of the 5-iteration loop, 4-agent cap.

**X77 - disproved, no code change, corpus delta ZERO.** The row claimed the conservative dynamic-array analysis
flags `view` functions as state-writing. It is **none of the three things the row named**: not the array
analysis, not an absent-means-writing default, and `InvocationAnalysis.ts` is not involved at all. The firing term
is `(func.externalCalls?.length ?? 0) > 0` in `Artifact.ts:254` - `getAmountsOut` and `getAmountsIn` both reach
`getReserves()` through a library, and their `dynamicWrites` and `entryAccesses` are **both empty**, measured on
the real artifact.

**Isolated with a control in both directions**: one contract, four `view` functions - the dynamic-array,
**named-return** and **tuple-declaration** shapes the row suspected all read **false**, while writers still read
**true**, so `false` is not a stuck value.

**And it cannot refuse a handler, which was the row's whole justification.** Nothing in route synthesis reads
`writesState`; the external-call refusal comes from `footprint.effects` independently. Of its three consumers,
two already exclude external calls explicitly, and flipping the flag at the third would **admit** an
external-call-bearing callee as a staticcall target - a weakening, not a fix.

**The corpus settles it.** 1,099 handlers, **`absent: 0`** - with `forceStateful` the field is never absent, so
the *absent = writing* convention this board has been caveating its counts with **contributes nothing**. 251
handlers declare `view`/`pure` and **244 are confirmed read-only (97.2%)**. Of the 7 flagged, 6 are external-call
and already refused for an unrelated reason, and **the single eligible one genuinely writes** - a `view` function
whose *modifier* assigns state, in `modifier_overriding_3.sol`. So the annotation is the lie, not the compiler.
Published counts do not move.

**X78 - fixed, and the earlier conclusion was the error.** X70 diagnosed the cause correctly (ranking bounds of
unequal tightness cannot rank limits) but concluded it needed per-contract cost measurement. It needed each
coefficient's **demonstrated over-prediction taken back out before the comparison** - a `ratioFloor` de-biasing
using **local** slack read at the bracketing calibration drivers, because a global discount regressed C1 and C2 in
trial.

| population | before | after |
| --- | --- | --- |
| built corpus graphs | **0/43** | **43/43** |
| capstones (in-sample) | 3/4 | **4/4** |
| census at N=1 | 22/367 | **367/367** |
| held-out E1 | 0/1 | 0/1 (unchanged) |

**Conservatism was preserved by measurement, not assertion**: E3 re-ran the whole 43-contract row with **both
estimator files reverted**, and every band came back **identical** - script, serialized, density and SigChecks all
0/43 under-predicted. The only line that differed was the ranking. It also added anti-regression guards so
re-ordering cannot turn OVER into FITS, asserted over 1,106 descriptors.

**Two of X70's published figures do not reproduce, and E3 proved it is staleness by measuring at the reverted
baseline.** The population is **43, not 45** - three rows now fail "census redeem length disagrees with the built
participant", so **the census has drifted**. And **444 bytes of every corpus prediction is a dead covenant**:
`estimate` defaults to the recorded basis (4,542 / 1,514) while HEAD generates **4,121 / 1,493**, because
`replicaSpec` never fills the override fields. With HEAD's sizes the band returns to X70's published
+4.3%..+7.5%. Both handed to E4, whose lease holds that file.

**A stale assertion replaced with one that cannot drift.** X70's legacy `before >= 44 under-predictions` fails at
the **baseline** commit too, because the legacy fit returns 4,441 B for a covenant that *was* 4,542 and is now
4,098 at the time, **4,121** at HEAD - so the impossibility decayed into mere looseness. E3 re-asserted the impossibility on the **calibration**
instead: a **3,966 B intercept against a 4,542 B covenant**, where no size change can soften it.

**The remaining miss is stated rather than fitted away.** E1 is still named density where relay size binds; its
de-biased floor lands 0.6846x against 0.6368x measured, because the envelope is 26.4% loose there where its
bracketing points showed 17.6%. **No re-fit closes it** - it is a cost driven by a contract body the descriptor
does not carry, and closing it needs a per-participant operation-cost reading at compile time.

**Five handoffs**, opened as **X85** (`replicaSpec` must pass the covenant overrides), **X86** (the F3 census
needs re-taking), **X87** (`Layer3CorpusFitF3.test.ts:183` stale after X73), **X88** (route-synthesis arity bug on
collection-iteration handlers: `Found parameters () ... where parameters (bigint) were expected`), and **X89** (a
collection *iteration* read never enters the footprint - harmless only because X88 stops it compiling).

### 4.84 X65 beat F4's sizing 3.4x by REJECTING the form F4 sized

Merged at `825f720f`; re-pins and the guard rewrite at `3bbc87fd`.

**-444 B per projection** (4,542 -> **4,098**), against F4's sized ~95 B/slot. D5 got there by **not building what
F4 proposed**: it measured **nine** forms and found F4's flagged byte-offset table lands at 4,522/4,385/4,374 and
its framed walk at 4,418 - **all worse than the shipped chains would have been worth optimising for**.

**The winning form needs no offset arithmetic at all**, which dissolves the soundness concern F4 declined to
land blind. It appends the participant loop's own raw 2-byte `participantInput` field at constant stride and
rebuilds the framed entry from `tx.inputs[idx].lockingBytecode` - a binding the loop **already requires**.

| shape | N | before | after | delta | = N x 444 |
| --- | --- | --- | --- | --- | --- |
| A13 | 3 | 23,458 | **22,126** | -1,332 | 3x |
| C2 | 4 | 52,733 | **50,957** | -1,776 | 4x |
| C1 | 5 | 62,722 | **60,502** | -2,220 | 5x |
| **C3** | 8 | 99,670 | **96,118** | -3,552 | 8x |

**C3 goes from 330 to 3,882 bytes under the relay ceiling**, and **A13 is node-verified at BOTH ends** - BCHN
mined 23,458 B at height 3441 and 22,126 B at height 3553.

**Soundness established rather than deferred, and fail-closed by measurement.** `bytes2` is exact at 0/200/9,999/
32,767 and **aborts** at 32,768 and 65,535 - it cannot truncate; an out-of-range table read **aborts**, including
at the 0xff no-caller sentinel where the chains hit a `revert`. So **this form can only ever REFUSE where the
chains accepted, never the reverse.** Check counts identical: `require(` 51 -> 51, `&&` 13 -> 13, `||` 2 -> 2.
The removed arms compared against an *unassigned empty local* - deleting them is a tightening had one been
reachable, not a loosening.

**It wins density too, so there was no trade to weigh**: instructions fall 19-21% and **no ratio rose anywhere**.
C2's binding density and C3's worst input reproduce **to the operation**, and the controller is byte-identical -
the scope control proving a change to one covenant moved one covenant's figures.

**An offer left open as X81**: the axiom-free variant measures 4,117, so **the single bound is priced at 19 B per
projection** and can be taken by swapping one line. With 3,882 bytes of C3 headroom, trading 152 bytes for one
fewer thing to reason about looks right - but it is D5's measured judgement that landed the bounded form, so it
is recorded as a decision rather than overridden.

**A guard had gone VACUOUS and D5 caught it.** `Layer3ReviewA1` and the C3 fixture hunted
`participantLbcN == participantLbcM` - and X65 deleted those identifiers, so the regex could never match again
while still passing. **A pairwise comparison reintroduced in any other spelling would have sailed through.**
Rewritten to assert the property rather than the spelling: no comparison in either covenant may carry a
participant locking bytecode on both sides, plus an explicit assertion that the old identifiers are gone.

D5 also found the F4-era comment tables **already did not reproduce** at the base commit (C3 controller cost
2,131,662 recorded against 2,131,942 measured, Sink 4,951 B against 4,979 B) - pre-existing drift its own
before-run established. Opened as **X82**.

### 4.85 X72 and X75 land; X71 is written, measured, and HELD for the lease

Merged at `29b05d1d`.

**X72's cause is an ordering one.** Route synthesis names reasons only for entry points **as of the moment it
runs**, and `SynthesizeBlockOracle` appends `__updateBlockOracle` *after* the early call - so both fields stay
`undefined` and the artifact publishes `eligible:false` with the key omitted. The fix reuses the name the
**absence** channel already resolves for exactly this condition, so both channels now say the same thing.
Corpus: **210 contracts, 103 routed, 16 unnamed before -> 0 after**, all 16 the oracle updater, per-corpus
**2/7/7** matching the census exactly.

**Its discriminating power is stated in both directions** - a leaked default would show the two late-ordering
contracts flipping to refused (0 observed), a missed shape would leave a surviving non-oracle unnamed row (0
observed). And D6 flagged that this is **not** a refusal, so X42's no-artifact property does not apply; what
replaces it is that the artifact is byte-identical but for one added key, on **423/423** corpus contracts.

**X75 is not X22's shape.** The returning call and the effect sit in a **void internal helper**; the effect makes
it ineligible for its own `OP_INVOKE` subroutine, so it is inlined into the SCB1 wrapper and the relocated edge
lands where the layout has **no slot** (measured: 0 slots, call index -1). Route synthesis never sees it, which
is why the gate belongs at the generator. All **7** corpus files now name the real edge at a position **inside
the user's file, verified line by line 7/7**.

**X71 is written, fully measured, and deliberately NOT landed** - its three hunks are in `compiler.ts`, which D1
still holds. Handover patch verified `git apply --check` clean.

**Option (e) works, and D6 reported the qualified truth.** Emitting the **parenthesised** tuple form is not a
language change - grammar untouched, no user program newly valid, and `AstBuilder` builds the same node either
way, with **no codegen consumer of the flag anywhere in the repo** (grepped). Router02 now **compiles** under
`+hiddenBatch`: route present, 25 handlers, 7 eligible. But under **`+controller`, F3's actual configuration, it
still fails** - now with a pre-existing *named* refusal instead of a ParseError at a synthetic position. **So
Router02 does not join the bus-reachable set**, and **all 7 admitted handlers are `view`/`pure`, so F3's
read-only headline stands.**

**423/423 corpus contracts byte-identical**, and the fallback is exercised: 3 solc-sample files still fail to
parse the generated route and now report the position as compiler-generated rather than bare.

**Two new findings.** `MerkleTree.sol` gets past the ParseError and lands on `Block slot not found:
keccakSideCar[0]` - **X42's family again, on a slot kind X42 did not cover** (**X83**). And a census discrepancy:
`F3_CENSUS_BUS_FAILURES` lists no ParseError for solidity-by-example, but `MerkleTree.sol` produces one under the
census's own options - likely a missing `compileFile` fallback for FAIL rows, **to reconcile before those numbers
are quoted again** (**X84**).

**A process note worth keeping.** D6's first full run reported 5 failures, **every one a 30s timeout and none an
assertion**, caused by running alongside two corpus probes - two of them its own. It moved the compiles into
budgeted `beforeAll` hooks, the mechanism `vitest.config.ts` itself names, so the cases are **load-invariant**
rather than merely re-run until green.

### 4.82 The gates are STACKED, the count was a 2.2x undercount, and the estimator was unsound at N=1

Merged at `a29a6122`; the R1 control it invalidated rebuilt at `862fbc25`.

**D2's headline is a NEGATIVE result and it is the most useful thing in the round.** Changing one axis at a time
on the real `solidity-by-example` ERC-20:

| variant | `transfer` |
| --- | --- |
| as written | `collection-helper-route-not-enabled` |
| visibility only (`external` -> `public`) | route ABSENT; still collection-helper |
| spelling only (`balanceOf[` -> `this.balanceOf[`) | `initial-v1-route-requires-public-visibility` |
| both | route ABSENT; every handler `result-route-requires-effect-free-handlers` |
| both + no events | **unnamed internal abort**: `__scb_resource_transfer`, 4 args vs 13 expected |
| both + no events + no `returns (bool)` | **`transfer`, `approve`, `transferFrom` all ELIGIBLE** |

**The machinery already admits the real ERC-20's state-changing surface.** Three gates are stacked on it - D2's,
D1's, then D2's again - and **no single lift admits anything.** That invalidates this round's framing, which
scored D1's 172 and D2's 192 as separable walls. They come off together or not at all, and relaxing the third
exposes an unnamed internal abort immediately behind it.

**The assigned "192" is a ~2.2x undercount, and D2 proved it by instrumenting the gates rather than reading the
diagnostic.** F3's 455 counts only refusals published in the route-absent channel, which exists **only when no
route was synthesized**; refusals on contracts that DO get a route are invisible to it. Measured firings:
**419**, of which **226** are on routed contracts F3 could not see. Its **193** on F3's own population validates
the instrument against F3's 192. Gate stacking measured too: **350 of 419 firings are on `public` handlers**, so
they would not fall to D1's gate at all.

**Two defects closed inside the lease**, with the first genuinely load-bearing: `LowerCollectionJournalHelpers`
refused **any** `ReturnNode` as an early return, but the Solidity ERC-20 wrapper is
`_transfer(from,to,v); return true;`. It was a thrown `Error`, so it **failed the whole file's multi-contract
compile and dropped every sibling** - hitting 6 files carrying 5 of the 12 bus-reachable application contracts.
Write-backs are now placed before the tail return, as the final `require` guard already was. Second: named
returns and tuple declarations bind a local, so `amounts[i]` published a phantom `collection:amounts:*` for a
name the contract never declares.

**The corpus delta is reported honestly and it is small**: 5 gate firings removed, **0 new refusals, ZERO newly
eligible handlers**. The journal fix advances six real files to the *next* wall rather than through it. D2 also
classified `mixed-scalar` and `result-route` as **pure sibling collateral** by compiling the same handler alone
and then beside the sibling - 195 firings, 100% `public`, none with a collection in its own footprint.

### 4.83 X70: the estimator was not conservative where it mattered, and one defect was an IMPOSSIBILITY

**Three defects, not one**, and the second is the sharpest: the projection verifier's 4,542-byte redeem script
sat inside a fitted line whose intercept was **4,095** - *not an inaccuracy but an impossibility*, since a P2SH
input must push the script it redeems. Also: an upper envelope bounds nothing **below** its smallest calibration
point, and a one-participant graph drives 2 rows against a calibrated minimum of 6.

| limit | BEFORE | AFTER |
| --- | --- | --- |
| unlocking bytecode (**binds all 45**) | mean **-7.2%**, **44/45 UNDER** | mean **+7.4%**, **0/45 under** |
| serialized / density / SigChecks | - | 0/45 under on each |

Out of sample: leave-one-out **24/28** (was 22/28), worst **-13.5%** (was -27.2%); the real held-out graph
**3/4** (was 2/4), worst **-3.5%** (was -9.6%).

**A fourth defect the per-class check found**, which the aggregate could not: clamping a **density** coefficient
to its measured floor under-predicted real corpus masters **34 of 45**, by up to 56.5%. Density is a property of
a **contract body**, not of any descriptor driver - so only the two body-dependent coefficients use the line
below their range, and everything the graph itself produces uses the measured floor.

**The binding-limit prediction is NOT fixed, and D4 said so instead of claiming it.** Density is still named
first. The cause is precise: the master-density coefficient over-predicts its own calibration points by up to
**284%** and the corpus by up to **601%**, while the script coefficient over-predicts by at most 10% - **ranking
bounds of that different a tightness does not rank limits.** Rather than fit again, `estimate` now publishes
`bindingUnresolved`, and **the true binder is in that set 45/45** - where F2 named the wrong one 45/45 with no
qualification.

**X66 re-measured, not adjusted**, and the consequence re-derived: **C3 no longer overruns the relay ceiling.**
D4's line is the one to keep - *every costed C3 fix on this board was sized against an overrun that does not
exist*. The margin re-derivation strengthened rather than survived: 34% -> **16%**, because all three covenants
now carry a fixed redeem term instead of one.

**A vacuous control caught by its author.** Commit `0502debf` moved the knob-liveness assertion **outside** the
try/catch, because a control inside the skip path would have been swallowed into the skip list and proved
nothing. Same class as X2's hostiles failing for the honest case's reason.

**And it broke R1's positive control, correctly.** `Layer3ProductionEnvelopeR1` asserted "C3 is the one shape in
the basis that is actually over" - and no shape in the basis is over anything now, so **the control had no
subject**. D4 reported it rather than re-pinning it, calling it a design decision. Rebuilt at `862fbc25`: the
loop is now asserted to have had nothing to assert, and the screen is exercised against a **synthetic 2x C3**
that screens **REFUSE** at a predicted 246,961 B against a 141,562 threshold. Its first version doubled the
participant count without extending the per-participant arrays, and **the estimator refused it** - one block
size and one redeem size per participant is validated, not assumed.

### 4.81 The X74 follow-up found a hole that survived the merged fix

Two questions went back to D3 after `9238abff`. Both answers were better than the questions, and the second one
**found a live hole in code the board had already merged**.

**The question was premised wrong, and D3 said so.** I asked what happens once the category label exists
on-chain. **The label never exists on-chain** - `'77'*32` is not a category and never becomes one; only the real
category, a txid, does. As posed, the question had no reachable case.

**The reachable version, which D3 then went and found: a real category from a PREVIOUS RUN, requested by a fresh
instance.** The in-memory index is empty, so the merged code took the genesis path and **minted a replacement** -
the exact silent substitution this row exists to kill, **surviving across runs**, still live after the fix. Nobody
was looking for it.

The resolution rests on a fact that makes the check exact rather than approximate: **a CashTokens category id IS
the txid of the genesis transaction**, so "does this category exist on this chain" is answerable by asking the
node for that transaction. Resolution is now three steps - memoized -> mint; **on-chain -> throw**; not a category
at all -> genesis and memoize, which is the path the board directed be kept. A node lacking `txindex` answers
"no" and **degrades to the genesis path rather than to a wrong mint** - the correct failure direction, since a
missing index must never become a silent substitution.

**The scope answer is complete in both directions.** The maps are per-instance fields, with the only `static`
being a numeric constant. The effective scope is one level up, in `test-util.ts`'s module-scoped
`regtestSingleton`, and D3 bounded it by **verifying vitest's `isolate: true` in the shipped default file rather
than assuming it**. So: shared within a test file, never across files - which is exactly what `Keccak256`'s seven
call sites in one file require.

D3 also declined to rebuild mid-run, naming the phantom-failure trap explicitly. Correct: that trap cost a
round-18 worker four phantom failures and cost the integration owner a false alarm two rounds running.

**EVIDENCE SCOPE, and the integration owner merged ahead of it.** `c38d96c1` - the cross-run throw - is merged at
`dc9cf1f7` but is **lint-clean and NOT node-verified**. D3 offered to hold it and let the board take only the
three proven commits; the merge had already happened when that caveat arrived. Recording rather than quietly
carrying it:

- **Node-verified**: `044997c3`, `f75ff24c`, `bcc5dc84` - four capstones mined, X74 green on three consecutive
  runs.
- **NOT node-verified**: `c38d96c1`. Its path requires *a real category from a previous run on the same chain*,
  which **the mock suite cannot reach at all** - `MockNetworkProvider` is a different class - so a green mocklet
  run is not evidence about it in either direction.

So this row is **MERGED, not INTEGRATED**, on the same rule that held SEC-13 for one notification cycle in round
15: an unfinished verification is not a verification. It is promoted when D3 runs the X74 file against BCHN.

The risk is bounded and worth stating: the change only **adds a throw** on a path that previously substituted
silently, so a wrong throw is a loud regtest failure rather than a silent acceptance - but "bounded" is an
argument, and the row stays unpromoted until it is a measurement.

### 4.80 ALL FOUR CAPSTONES MINED, in one run, on a real node

Merged at `9238abff`. This is the milestone the effort was pointed at.

| capstone | txid | height | bytes | inputs | confirmations | control |
| --- | --- | --- | --- | --- | --- | --- |
| C3 | `2878ce367db9b4bc...` | 3718 | **99,670** | **108** | 412 | refused |
| C2 | `e5cb971178e44385...` | 3933 | 52,733 | 79 | 197 | refused |
| **C1** | `d670ece5dd172dc3...` | 4058 | 62,722 | 38 | 72 | refused |
| A13 | `b9e20b84254720ec...` | 4115 | 23,458 | 8 | 15 | refused |

**One run, 637 seconds, 8/8**, every one re-verified mined via `getrawtransaction`, **sizes matching the plan's
recorded figures exactly**, and each with its hostile control refused on the same chain in the same run. The
`addUtxo` change did not knock the other three off the node - they reach it **in the same run as C1**.

**The fix has the right shape.** `addUtxo` now mints into the requested category via a retained minting NFT and
**throws by name on three distinct paths**, each naming the provider, the category and the reason - including
the one that matters: *"no minting NFT is retained for it, so the request cannot be satisfied. It is NOT served
with a different category."* Two are pinned by a new test; the third is an internal-consistency guard.

**A caveat D3 put on the record before being asked, and the board's answer.** One non-throwing path remains: a
category label existing **nowhere on chain** cannot be minted into, so it is genesised, the real category is
returned, and **the label is remembered** so every later request for it lands in the same real category. That is
what keeps ~15 existing placeholder call sites working.

**Decision: keep it, do not make it throw.** It removes the defect class without cost - the C1 defect was *one
requested category silently yielding two real ones*, and memoization makes that impossible. A throw would break
15 working call sites to buy **no** soundness. The board's rule is that a fail-closed boundary must not become an
unchecked path, not that every path must be a throw. Two questions returned to D3: whether the memoization is
per-instance or module-global (global would be shared state across tests in one process), and what a second run
against the same chain does once the label exists on-chain.

**Two operational findings.** D3's cleanup used a broad `pkill -f vitest`, which **matches globally across every
worktree** and may have interrupted a sibling mid-run; it flagged this rather than letting it surface as
someone else's mystery failure. Kill by job or PID here, never by pattern - a round-16 worker had wait loops
block on other agents' suites for the same reason.

And the box is now a measurable constraint, not a nuisance: **load 35, 56 vitest processes, swap FULLY
EXHAUSTED at 3/3 GB.** That is the condition that SIGTERM'd R2's single `yarn test` run with **zero** failing
tests printed - correctly reported as memory exhaustion rather than a test failure, and worked around by running
per-package to completion. The integration owner's own solidc run then timed out at 10 minutes against a normal
~2. **Under this load, prefer per-package runs, and check the box before believing a failure.**

### 4.79 Round 18 verified: 7,240 tests, six packages, exit 0 - and round 19 goes where F3 pointed

`yarn test` at `1591e87f`, exit **0**, all six workspaces reached: utils **295/0**, solidc **2,580/0**,
solidcash **4,322/0**, testing **19/0**, solidhat **24/0**. The skip count rose 27 -> 41: those are the
regtest-gated node tests, which run only against a live BCHN.

**The ledger was corrected at its own sites**, not appended to. It carried **no evidence-level claims at all**,
so the strongest result of this effort was absent from the authority document; it pinned the projection parser at
**4,501** bytes, predating both X5's +37 and F4's -129 (actual **4,542**); and it asserted "N=8 participant
binding at 36.5%" as though that were an eight-participant graph. All three are fixed in place, with the X47
correction written where the wrong figure lived.

**Round 19 dispatched at that commit, aimed where F3 pointed rather than where the last four rounds were
looking.** D1 takes `initial-v1-route-requires-public-visibility` (172 refusals, 38%, three times larger than
anything else); D2 takes the remaining ~192 route-scope gates; together that is **364 of 455 refusals**. D3 takes
X74, the provider defect that is the only thing keeping C1 off a node. D4 repairs F2's script term, which
under-predicts the binding limit 45/45. D5 takes X65, sized at ~6,080 C3 bytes. D6 takes the diagnostic holes.
D7 takes R2.

**A lease question from D6 produced a better answer than the row asked for.** Diagnosing X71, D6 found the
`ParseError` is not a position in the user's file at all: it comes from the **second** parse, of the route
contract `synthesizeHiddenBatchRoute` assembles, and the offending text is a **generated** row decoder emitting
the **unparenthesised** `uint256 a, address[] b = abi.decode(...)` - while only the **parenthesised** tuple form
accepts an array type. **The compiler is generating source its own grammar rejects.**

D6 correctly refused to widen the grammar, because that is a language change that makes previously-refused
programs compile and fails X42's no-artifact property. The board's answer is a fifth option it had not listed:
**emit the parenthesised form**, which changes no grammar and makes no new user program valid, and may make
`UniswapV2Router02` **actually compile** rather than fail with a better-labelled error. If it does, the bar rises
with it - a program that did not compile now does, so the packet must state what the newly-admitted route
actually exposes, since F3's headline is that every bus-reachable application contract currently offers a
read-only surface and nothing else.

The `__scbN` overlap between D2 and D6 is resolved to D6, whose lease contains the site; both briefs had told the
other agent it might take it, which was an ambiguity in the dispatch rather than in the work.

### 4.78 THREE CAPSTONES EXECUTE ON A REAL NODE, and the template rule does not exist

Merged at `eb7ca398`. The round's capstone, and it closes the decision the board escalated.

**X64: the rule was wrong, and measuring it was the right call.** R1's `standard-output-template` was the only
`UNMEASURED_CONSERVATIVE` rule in the envelope, and it alone kept C2 and the E1 result graph out. Measured on
BCHN v29 **and reproduced row-for-row on a throwaway container with explicit `-acceptnonstdtxn=0`**: a bare
`OP_1` at 1,000 sat reaches `missing-inputs`; an arbitrary `OP_2 OP_3 OP_ADD OP_5 OP_EQUAL` reaches
`missing-inputs`; a 300-byte OP_RETURN is refused `64: oversize-op-return`; a non-push scriptSig is refused
`64: scriptsig-not-pushonly`.

**The load-bearing control is the dust row.** The *same one-byte script* at 10 satoshis is refused **`64: dust`**
- which proves the per-output loop demonstrably runs **pre-lookup**, reaches that output, and **declines to
refuse it on template grounds**. Without that row, `missing-inputs` would prove nothing. And the strongest form
was done anyway: a real 1,000-satoshi bare `OP_1` output **funded, accepted, mined, then SPENT with an empty
unlocking script** on the strict node.

**C1 removed the rule rather than relabelling it** - "an envelope refusing what the node accepts is wrong, not
conservative". **C2 and the E1 result graph are IN, and no rule in the envelope is `UNMEASURED_CONSERVATIVE` any
more.** X64 is closed; the user's instruction to measure rather than choose between two guesses is what produced
that.

**X59: three shapes genuinely execute on a real node.** Mined on BCHN v29 regtest, each with a hostile control
refused by the node **on the same chain in the same run**:

| shape | txid | height | bytes | in/out |
| --- | --- | --- | --- | --- |
| A13 | `85a78285c463c5b1...` | 1401 | 23,458 | 8/8 |
| C2 | `de22608f5f088c1f...` | 1304 | 52,733 | 79/79 |
| **C3** | `5eb1fdb123cdcd44...` | 1090 | **99,670** | 108/108 |

`RegtestNetworkProvider` carries no `consensusLimits`, so **nothing was relaxed**. The node executed every input
script under real BCH-2026 consensus and real relay policy, accepted and mined it. **C3 - the eight-participant,
108-input maximum graph - is mined on a real node.** Four rounds ago it was 2.07x over a budget that had been
misread by 200x.

**X60's premise needed correcting, and C1 corrected it rather than implementing it.** `enforceDust: false` was
**never** the cause: `MockNetworkProvider` **defaults** it false for every instance in the repo, so deleting the
profile line changes nothing - and setting it `true` also flips `standard: true` in the verifier, applying the
exact capacity limits the profile exists to relax. C1 kept the line, documented both facts, and added
`dustOutputs()`, which applies BCHN's `3 * (bytes + 148)` rule **to the built bytes, where no provider setting
can mask it**. All four capstones assert it empty.

**And a real address alone does not fix a dust output** - it raises the threshold from 474 to 546, so the amount
had to move with it, 10 -> 1,000 satoshis.

**C1 the capstone is BLOCKED, and the blocker is not C1.** X60 moved it past every pre-lookup rule, so the node
now **executes** it and refuses `mandatory-script-verify-flag-failed (OP_EQUALVERIFY)` at inputs 2-6. Cause:
**`RegtestNetworkProvider.addUtxo` ignores `utxo.token.category` and silently mints a fresh genesis**, so four
entry NFTs seeded under the Token's category arrive under **four different ones**. The fixture cannot route
around it - the allowance entry is keyed on the Router's category-pinned bytecode and the Router pins the
Token's, so neither genesis can precede the other. The named fix is outside C1's lease: `addUtxo` must mint into
the requested category, **or at minimum throw instead of substituting**. Opened as **X74**, and C1's test is a
pinned FINDING that fails the moment it is fixed.

**A process finding that names a mistake the integration owner made this round.** A full e2e run against a
**stale compiler `dist`** produced 4 failures; `yarn build` took them to 19/19. The board hit exactly this two
rounds running - it is now a standing rule: **anything merging compiler commits must rebuild before believing a
suite result.**

Sizes at HEAD, measured: A13 23,458 / C2 52,733 / C1 62,722 / **C3 99,670**, 330 under the relay ceiling. A13 and
C2 match F4 exactly; C1 and C3 are +52 for X60's real recipient script and larger transfer value.

### 4.77 F3: THE ENVELOPE IS NOT WHAT STOPS REAL CONTRACTS

Merged at `756682d0`. This row reframes the four rounds of capacity work that preceded it, and the board should
say so plainly rather than filing it as one more measurement.

**SUPERSEDED FIGURES BELOW - read 4.97 and 4.101 for the current headline.** This section records F3's result
AS MEASURED AT `756682d0`. The qualitative claim survives (the envelope is still not what stops real
contracts, and `swap`/`transfer` still never reach the route); the counts do not. Current at `8685ae91`:
**2 of 12 admit a state-changing handler**, 4 admitted against 130 refused, and the census reads 512 in bus
mode / **428** reaching the bus.

**The headline as measured at `756682d0`: all 12 bus-reachable application contracts admit a READ-ONLY surface
and nothing else.** 134 state-changing handlers are refused. A real ERC-20 offers the graph `balanceOf` and `allowance`; a
constant-product AMM offers `balanceOf`. **The capacity envelope never gets to bind on `swap` or `transfer`,
because those never reach the route at all.**

Census: **712 contracts / 586 files** across four corpora; 635 compile, 504 in bus mode, **367 reach the bus**.
Of the 44 MistSwap and EACC contracts, **12** do.

**80% of refusals are route-scope gates, not capacity.** 364 of 455, and the single largest is
`initial-v1-route-requires-public-visibility` at **172 (38%)** - because **Solidity marks entry points
`external` while the v1 route admits `public`.** That is an incidental wall, and it is the biggest one in the
corpus by a factor of three.

**Where capacity does bind, it binds early and hard - and needed no estimator to show it.** Eight of the twelve
have redeem scripts at **86% to 439% of the 10,000-byte per-input limit before a single argument byte**:
`UniswapV2Factory` 439%, `MarketplaceV1` 323%, `EACCToken` 182%.

**A real finding against F2's conservatism claim, and it is F2's own documented blind spot at a magnitude nobody
had seen.** Across 45 measured transactions, **all 45 bind on unlocking bytecode length, and F2 under-predicts
that limit 45 out of 45** (-0.5% to -9.8%, mean **-7.0%**) while predicting density would bind on every one.
F2 recorded this as blind spot 5 at six participants and 1.8%; here it is **one participant at 7%**. The
mechanism is stated: the generated projection covenant is **~4,780 B, larger than any of the 45 contracts it
proves**. F2 remains conservative on serialized bytes (+15.7% to +24.2%, 45/45), density (+56.9% to +153.2%,
45/45) and SigChecks (exact, 45/45). Opened as **X70**.

**Two compiler defects found in passing**: a bus-mode-only `ParseError` on `UniswapV2Router02` whose **reported
line moves by 51 when an unrelated option changes**, so it is not a position in the user's file (**X71**); and
**20 refusals published with no `rejectionReason`**, all on the compiler-synthesized `__updateBlockOracle`
(**X72**).

**Walls classified, with the honest half stated.** **Real**: the 10,000-byte per-input script limit (stops 8 of
12 at N=1 and binds all 45 measured), the 100,000-byte relay ceiling (317/367 at N=8), operation-cost density.
**Incidental**: the five route-scope gates (364/455), the `LowLevelCallShapeError` shape gate (26 bus-mode
failures), `Unbound return call in __scbN` (5, an unnamed internal abort), the Router02 `ParseError`, and the
unnamed-refusal hole.

**And "real" is explicitly not "unmovable", per the standing correction on this board.** Subroutine extraction,
`outline.ts` span sharing, and the splitting and `library` paths all target script size, and **none is applied by
the census**. Whether they close `MarketplaceV1`'s ~70% gap is **unmeasured, and C6 claims neither direction** -
which is the right posture, and the opposite of calling an EVM pattern fundamental.

**What it does not prove, stated in full**: this is not a fit claim; **no application contract was measured** -
none has a one-slot block and the harness cannot seed sidecar slots generically - so their landings are estimates
only; no heterogeneous graph was measured or estimated; no two real contracts were composed; the solc figure is a
**1-in-12 systematic sample**; and the read/write split is an **upper bound on usefulness**, not a floor.

### 4.76 X26 is a SILENT under-reservation; X20's entry half is not a modelling gap; X10 BLOCKED

Merged at `584f3025`. Three rows, three different verdicts, each measured.

**X26 - a bare `m[k]` read publishes a SHORT layout, which is worse than none.** `analyseFunctionFootprint`
recovers a collection from `name`/`keys`, but `ArrayAccessNode` carries `array`/`index`, so the bare read matched
nothing - **exactly the class round 16 predicted**, a bare spelling a node-kind scan cannot see. X19 closed the
write half; the read half was still open.

The cost, measured: a handler whose only collection access is a bare read publishes `blockSize = 2`, slots
`[master@0, dataNft@1]`, **while the same route's covenant addresses block-relative slot `+2`** with ten
introspection opcodes. **Blocks are concatenated, so the next participant's block is placed at `base + 2` - the
exact slot the route reads and writes.** The dotted spelling of the same program declares `blockSize = 3`.

**The evidence-inheritance argument is elegant and sound.** After the fix, the bare and dotted spellings compile
to a **byte-identical bus route and identical route ABI** - so every existing settling test of the dotted
spelling is VM evidence for the fixed bare one. That is how a repair with no new VM case earns its settlement
evidence, the same license X63 used this round.

**Item 10 is the strongest refusal-of-corroboration on this board yet.** 500 corpus files, **0 status changes, 0
bytecode changes, 0 `invocationAnalysis` changes - and C5 measured that this has ZERO discriminating power rather
than assuming it.** The reason is precise: `analyseContractInvocations` runs at `compiler.ts:2003`, **after**
`SymbolTableTraversal` at 1880, so the published footprint is post-resolution where a bare `m[k]` is **already** a
`MappingAccessNode` and was never wrong. The changed call sites are the **pre-resolution** ones, all hidden-batch
synthesis, and **no corpus file compiles with `experimentalHiddenBatch`**.

**X20 - the auxiliary half was keying a POSITION off a WIDTH.** `deriveBalancedAssemblyFromInputs` claimed the
sidecar region only when `cursor + participants + 1 === totalSlots - 1`, and both auxiliary checks iterate that
list - so an empty one runs **neither**, including the 1,000-satoshi sidecar rule that exists to refuse *before
signing*. **One ordinary padding slot after the controller re-opened the fail-open while every index the model
would have claimed stayed exactly where it was.** Fixed by claiming wherever it fits (`<=` for `===`); slots
beyond the region stay unclaimed, so an injected extra participant block still lands outside and the controller's
own input-count rule remains what names it.

Hostile: padded tail plus a 999-satoshi sidecar previously **passed the gate and got signed**, with the VM
refusing only afterwards; now refused at **zero signature requests**. Just outside: a padded tail with **honest**
values is still **ACCEPTED**, so this is not a blanket refusal of wide tails.

**The 44.5% figure was re-measured rather than repeated**: 2,324 settled sends, **1,061 of 2,157 describable
rejections = 49.2%**, and C5 states plainly that it is **not** directly comparable, because X32 moved 167 sends
from *skipped* to *refused*. Categories named; **0 satoshi-value mismatches**, since X21 closed round 14's.

**Item 10 again, and again refused**: 0 of 2,157 sends change verdict - "near-zero discriminating power, so I am
not counting it" - because on the direct route the changed branch is **unreachable in 54 of 54** derivations. The
discriminating measurement is the layer-3 path: **189 derivations, 186 identical, 3 non-canonical, and all three
are C3 hostile shapes**.

**The entry half is NOT a modelling gap, and C5 refused to force it.** The two dominant rejection categories
(680 `unbalanced transaction`, 381 `token outside every participant block`) cannot be described by relaxing
`balancedBlocks.ts`: a C2 insert mints a **new node output with no paired input**, and chunk NFTs land past
`regionEnd`, because the **direct route declares no trailing region at all** - `needsTrailingRegion` is
`__scb1`-gated. Describing them needs the direct route to declare and fund a trailing region at X28's measured
price, touching `computeBlockLayout` **and** `StatefulTransactionBuilder`. **"Relaxing the model to accept these
shapes would admit unsound ones and I did not do it."** Opened as **X69**.

**X10 - BLOCKED, and it REFINES the recorded pin rather than repeating it.** X8 pinned the region at one output.
C5 measured that the region **does** grow past one output in general - a read-only collection and a
no-collection shape both build **two** chunks at 200 bytes. It fails **only when a C2 entry mint shares the
region**, and the failure is **worse than "does not grow"**: at 121 bytes the single seeded placeholder is
**never derived at all**, and the transaction carries the **NEW node commitment twice**, at outputs 3 and 5, with
a bare `00` between them. So the SDK half is **not** a "seed N instead of 1" change - the new node's placement
cycles with the chunk count.

The bound is structural in two places, both outside C5's lease: `StatefulContract.ts:9228-9234` seeds exactly one
chunk candidate, and `GenerateTargetTraversal.ts:5158-5186` carries the PICK depth. **C5 explicitly did not
re-verify X8's `+1` vs `+6` claim**, could not separate the causes from outside the file, and reported that half
**as X8's measurement rather than its own**.

Counts: solidc **2,572/0**, solidcash **4,263/0**.

### 4.75 X57's premise was wrong, X58 was not cosmetic, and a diagnostic was destroying itself

Merged at `d14a49ef`.

**X57 was a latent trap, not an active failure - and C2 established that on a live node rather than reasoning
about it.** The row said observers used for state derivation are discarded on live networks. They are not: all
three call sites first check `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000`, **the same
condition the factory used**, so a limits-less provider never requests an observer at all and derivation falls
through to full `vm.debug()`. **The mask is the caller gate, not another VM.** Census over deploy + two state
writes + one read on **live BCHN regtest**: 9 VM builds, **0 with an observer**, derived state **correct**;
against the mock, 9 builds, 8 with observer, also correct. The premise that only `MockNetworkProvider` publishes
limits is confirmed.

**A second defect found in the same install loop, and this one is live today.** **47 of 256 opcodes have no
`operations` entry**, so wrapping them called `undefined(state)` and produced `TypeError: operation is not a
function` instead of the VM's own `Called an unknown opcode.` Because `_logCovenantFailureTrace` observes **all
256 and swallows exceptions**, an unknown opcode **silently destroyed the diagnostic it exists to produce**. It
reproduces on the mock path. Fixed by routing through `instructionSet.undefined`, which still reports.

**C2 rejected a broader fix it had already validated.** It verified the crypto instances are `===`-identical and
the consensus default matches, then declined "always build via `createInstructionSetBch2026`" anyway: routing
every live VM evaluation through a differently-constructed instruction set is a worse trade than one guard
clause. The early return is kept exactly where it drops nothing.

**X58 was NOT cosmetic, contrary to the framing it inherited.** mem-cash builds its primary VM with
`standard = policy.enforceDust`, so a dust-enforcing mock read a standard allowance **nobody set**. Measured on a
1-byte unlocking script: `enforceDust: false` accepts 200 `OP_HASH256`; `enforceDust: true` **rejects at 11** with
`Maximum hash digest iterations: 21` - which is 42 x **0.5**, libauth's real standard value. **The enforced
allowance was 20,000,000x smaller than declared.**

**A hard constraint found and respected rather than worked around**: mem-cash validates every override as a
**positive safe integer**, so the real 0.5 and 3.5 **throw** on this provider. C2 did **not** add rounding or
silent skipping - naming it as exactly the "different silent path" the brief forbade - and pinned the constraint
as a test instead.

**Corpus discriminating power: zero, verified by grep rather than assumed.** No e2e test passes an observer with
a limits-less provider and none uses `enforceDust: true`, so the suite is a regression guard here and not
evidence. The evidence is 10 discriminating tests plus a live regtest control that fails reverted and passes
fixed. **Byte delta: none** - both changes are SDK-only.

**Two open items C2 named rather than left**: the three callers still gate the observer out on live networks, so
the fix removes a trap rather than changing behaviour today (`StatefulContract.ts` /
`StatefulTransactionBuilder.ts`, outside its lease); and `packages/testing/src/config.ts` does not expose the
split fields, so a `solidcash.config.ts` cannot set them - the split is end-to-end for `MockNetworkProvider` but
not for the harness config surface. Opened as **X67**.

**Operational intel relayed to C1**, which is on the node now: on regtest the funding address **accumulates UTXOs
across runs**, so `getUtxos().find(u => !u.token)` can return a non-zero vout and fail deploy with
`Funding UTXO must be at vout 0`. Filter on `u.vout === 0`. It cost C2 two of its first three runs and looks
nothing like a covenant fault.

### 4.74 X63 refused to expand, because expanding would have DELETED X2's evidence

Merged at `eb19dbf4`.

**The judgment that matters.** `ExpandBoundedPointerTableLoop` matched only the desugared `for`, so a
hand-written `while` published `maximumOccurrences: undefined`. The obvious fix is to route `while` into the
expansion. C4 **refused**, because the `while` spelling is the **only** source form that reaches codegen with a
rolled pointer table - i.e. the only producer of the expression-selector callsite **round 17's X2 repaired** -
and expanding it would have **deleted X2's evidence and the premise of its 14-test suite**. So `visitBlock` now
**records the ceiling and returns the statement untouched**. Seeing that across rounds is the whole value of a
worker reading the board rather than only its own row.

**+0 bytes on all 9 graph-mode shapes, sha256-identical.** The sharpest datum: the ordinary interface loop is
**byte-identical between the two spellings** (`6ad331eec0f792f9`, 3,061 B) - the same covenant published `3`
under `for` and **nothing** under `while`. Everything else routes through the shared `provenTripCount`, so
`while` can never publish on weaker evidence than `for`.

**Three guard controls, one per leg of the proof** - no dominating guard, the counter rewound inside the body,
the bound mutated by the same function - each publishing `undefined`, so the ceiling is credited to the
guard/step/mutation analysis and not to "the pass now sees `while`". C4 noted the rewind case **would have
published 3 without the new check**, making it discriminating rather than decorative. And a **structural guard**
asserts the two spellings still compile to *different* bytecode - the assertion that fails if this repair ever
silently becomes an expansion.

**X56: the compiler was already right.** X12's split-facet subtraction is correct for **both** slots; the **SDK**
had the return channel at output 3 and the event at 4, inverted, rejected at input 2 by the event's
locking-bytecode `OP_EQUALVERIFY`. The repair is entirely SDK-side, so **+0 bytes on every contract shape**.

**The gate was measured, exactly as the brief warned.** C4's first version relocated whenever the implementation
had a `returnEvent`, which rebuilt the layout object even for a returning delegate with **no** event - where the
offset does not move - **silently dropping `trailingBase`/`trailingCapacity`**. Tightened to fire only when the
offset actually differs, with the untouched shape now asserted rather than assumed.

**The hostile is discriminated, which is the part that makes it evidence.** A third own-category immutable NFT
appended beside the pair is rejected at **input 2** - attacking SEC-13's pin, whose admitted positions X56 moved -
and the *same test* appends a **plain untokened output of identical size and value** which is **ACCEPTED**.
Without that row the rejection could have been a value, fee or count fault.

**Item 12 is the most honest scoping note of the round.** X63 has **no new VM case of its own and cannot have
one**, since it changes zero emitted bytes; its settlement evidence is **inherited from X2**, and the
byte-identity measurement is what licenses that inheritance. X56 is proven on **one** shape; the generalisation
to implementations with entries is "a structural argument with no instance". The widened `returnEvent` admission
moves a shape **from documented-broken to untested, not to proven**. And the green full suite does **not**
establish X56's soundness, because a green suite cannot see a covenant that settles for the wrong reason.

**Pre-existing hole named, not fixed:** a `for` body that also writes its own counter is admitted with no
stability check - the same hole X63 closes for `while`. Tightening it would change a currently-admitted shape.
Opened as **X68**.

Full `yarn test` exit **0**: solidcash **4,267/0**, solidc **2,575/0**.

### 4.73 F4: C3 IS UNDER THE RELAY CEILING, and the lever was 82 verifier bytes

Merged at `09c00b62`; capstone pins updated at `d1cb8645`.

**The lever, which is the whole result.** `generateGraphProjectionVerifier` is **one covenant instantiated once
per participant**, and each proof slot's unlocking script pushes the whole redeem script - so **a verifier byte
is worth N transaction bytes**. That is the same mechanism X5 was measured on going the other way (+37 -> +296).
C3 needed 650 bytes; **it needed only 82 verifier bytes**. Nobody had stated the multiplier before, and it
reframes every future size question on this system.

Three rewrites, **-129 B per projection**: the bare locking bytecode cut from the framed table entry already on
the stack instead of re-slicing the transcript (-8), and X27's suffix split applied to the verifier's
**invocation** loop (-60) and **participant** loop (-61) - the controller's loop has carried that split since X27.

| shape | N | before | after | delta | = N x 129 |
| --- | --- | --- | --- | --- | --- |
| A13 | 3 | 23,845 | **23,458** | -387 | 3x |
| C2 | 4 | 53,249 | **52,733** | -516 | 4x |
| C1 | 5 | 63,315 | **62,670** | -645 | 5x |
| **C3** | 8 | 100,650 | **99,618** | **-1,032** | 8x |

**C3 is inside the 100,000-byte standard relay ceiling by 382 bytes, with all 108 slots intact.** The
slot-removal options F1 costed - four cheapest pairs at 810 B, or the 62-slot unused Ledger region at 13,048 B -
are **no longer needed to clear it** and remain as headroom. The multiplier was confirmed as exactly N on all
four shapes independently.

**It is not a security change, argued precisely rather than asserted.** No require is removed, weakened, added or
reordered; the check count is identical. Each `cursor + n <= transcript.length` becomes `local + n <=
frame.length` and each `tail + n <= transcript.length` becomes `n <= row.length` - **the same predicate**, since
`frame.length == transcript.length - cursor`, in range by the induction the controller already states. F4-1 is
**byte identity**: `participantLbc[2 .. 2+lbcLength)` **is** `transcript[cursor+6 .. cursor+6+lbcLength)`.

**The scope control is what makes that credible**: the controller reproduces **to the operation** - 2,891 B /
2,131,662 / 15,336 / 0.9217x, its exact pre-F4 reading. A change scoped to one covenant moved exactly one
covenant's figures. Both capstones' knob-liveness assertions still pass on the post-F4 bytes, including C3's that
the op-cost knob **bites** at 200/byte, and both envelopes re-run clean at the real consensus **and** real
standard profiles.

**Two limits improved and none regressed.** A13's binding limit **is** a projection: **5,131 -> 5,002 B, 0.5131x
-> 0.5002x**. C3's projection density improved 0.6284-0.6361 -> 0.5669-0.5707, and **all eight rows still cost
identically**, so X24's "the returning-row surcharge is gone" property survives. C3's op-cost density is
unchanged at 0.9217x, and standard size is still first-binding - now at **0.9962x**.

**Three alternatives screened and rejected with costs**, including one that worked: F4-4 hoists
`transcript.length` into a local for **-3 B**, measured and **deliberately not landed**, because "every landed
byte here costs a coordinated pin update across fixtures owned by other agents". Judging a real 3-byte win as not
worth the coordination is the kind of call this board wants made explicitly.

**The remaining opportunity is sized, not hand-waved**: the 8-way locking-bytecode dispatch costs **95 B per
participant slot**, measured by a throwaway probe that stripped slot 7 (4,542 -> 4,447) - roughly 760 B of the
verifier, worth **~6,080 C3 bytes**. Not landed, because the obvious table-lookup form needs a 2-byte offset
encoding whose soundness rests on the 10,000-byte stack-item bound, and the alternative trades bytes for
operations inside a 24-iteration loop and must be re-measured against C2, **which binds on density**. Opened as
**X65**.

**The stale-consequence trap, flagged not sprung.** F2's estimator basis and F1's header table are now
**stale-but-passing**, because both work off *recorded* figures rather than assertions - all four graph rows
overstate reality by 129 x N, and F2's C3 row verdict (over on relay size) is **no longer live**. C3's author
flagged this rather than editing another agent's files, naming it as exactly the trap this board has now been
bitten by four times. Opened as **X66**.

**The C3 size band did its job.** It was written as a band around 100,650 specifically so that shrinking under
the ceiling would **fail** and force its comment to be re-read - and that is precisely what happened. The comment
is rewritten rather than the band quietly widened.

### 4.72 R1: the gate cannot sit on the plan, and the weakest rule decides the envelope

Merged at `c65c4934`, test-and-doc only (1,858 lines, three new files, **no existing file touched**). C7 was told
it could add an SDK module only after reporting what it would touch; it **reported and did not add one**.

**Evidence level: none reached, and none claimed.** C7's own framing is the right one - *passing this gate is
agreement with a rule set, not evidence about a shape*. The sweep stays `CONSENSUS_FIT`, A13/C2/C1/C3 stay
`SEMANTIC`, nothing is `POLICY_FIT`.

**The plan-time screen CANNOT be the gate, and that is now measured rather than argued.** At the re-derived
allowances the REFUSE threshold for relay size is **141,562 B** while the largest shape ever built predicts
**112,955** - so **nothing in the corpus reaches REFUSE**. Worse, a per-input VM evaluation is **structurally
blind** to size, dust and template: a 100,650-byte transaction carrying a 10-satoshi `OP_1` output produces
**zero** per-input refusals at both real profiles. The gate must therefore sit on the **finalized bytes** at
`build()`/`send()`. That is a design conclusion the measurement forced, not a preference.

**Headroom goes at plan time only** - 10.9%, from F2's under-prediction band - and **never at build time**, where
the measurement is exact and a margin is a guaranteed false refusal.

**The boundary is relay, not mining.** C3 is mineable and unrelayable; choosing relay costs exactly one shape
across the whole corpus, by 0.65%.

**THE OPEN DECISION, and it is material.** The `OP_1` placeholder is **not** a C1/C3 artifact - **18 e2e fixtures
build one**, in two values. At 10 satoshis the `dust` rule catches it. At **1,000 satoshis**
(`Layer3HeterogeneousCycleC2.test.ts:537`, `Layer3ResultGraph.test.ts:499`) the **only** rule that refuses it is
`standard-output-template`, whose evidence label is **`UNMEASURED_CONSERVATIVE`**. So **the weakest-evidence rule
in the set decides whether C2 and the E1 result graph are inside the envelope**: keeping it takes them out,
dropping it leaves an unmeasured mainnet relay risk. X60 currently scopes the placeholder fix to C1/C3 only, so
this is not resolved by the round-18 work already in flight.

Three further decisions are flagged in the doc, **none gated implicitly**, per the standing rule that defaults
are ON and gating is asked about rather than assumed: whether the byte rules go default-on at `build()` (blast
radius unmeasured - X14's analogue rejected 44.5% of sends), whether `POLICY_FIT` should carry a build-time
margin, and that replacing the provider's limits in `evaluateEveryInput` is a **tightening** that needs measuring
first.

**Twelve rules, each with a hostile case that trips it** - 100,001 B, a 545-satoshi P2PKH one short of the
threshold, a bare `OP_1`, a 221-byte locking script, a 10,001-byte scriptSig, `0x93` in a scriptSig, 1,003,050 B -
plus the C1 placeholder refused on **two independent rules**, and one plan with two builds where only the byte
gate sees the difference. Dust thresholds 474/546/576 agree with the SDK's own `calculateDust`, and the relay
boundary is exact at 100,000/100,001.

**A measurement worth keeping: the mock provider's limits are 100x, 100x, 12,500x and 20,000,000x the real
ones**, and of 8 broadcast call sites in `src/`, **1 is gated**.

**What it does not prove, stated:** the gate has never been run against A13/C2/C1/C3 themselves, because their
builders are unexported - which is X59, in flight this round; A13's and C2's dust and template status is
unmeasured on any node; the seven byte rules are **not** the complete `IsStandardTx` set; and the allowances rest
on a seven-point calibration.

### 4.71 X2 was never about rolled loops, and its old "rejections" were VACUOUS

Merged at `314d09b8`.

**The row's own title was wrong about its subject.** X2 is recorded as the rolled (non-expanded) pointer-table
loop. B5's guard controls show **rolled loops were never the wall**: an ordinary interface call in a rolled loop,
and a **fixed-method** rolled pointer table, both settle at `ffef8568` **and** after. The actual defect is a
callsite whose **selector is an expression** - which a rolled loop merely happens to produce, because
`ExpandBoundedPointerTableLoop` only rewrites `for`, so a `while` spelling arrives at codegen rolled.

**The root cause is a double-count on the tracked stack.** `verifyGraphEmissionRow` had two selector branches:
an `IdentifierNode` selector emits `<idx> OP_PICK` with no tracked push and relies on the shared
`pushToStack('(__graph_selector)')`, while an **expression** selector called `this.visit(...)` - which already
pushes a tracked entry - and then took the shared push as well. The following `OP_CAT`'s `popFromStack(2)`
consumed both selector entries, left the stale `(__graph_target_mode)` behind, and the tracked stack sat one
entry deeper than reality for the rest of the handler. The fix renames the evaluated top instead of pushing
again - the convention already used twenty lines above for the evaluated *target*, and in
`emitExternalCallVerification` for the same selector.

**Localized with `vm.debug`, not guessed**: failure at instruction 187, in an opcode window that is a byte-exact
match for `consumeGraphRuntimeEmissionRow`, with the operands showing the row builder had read the caller's
emissions blob where its `value` argument belonged.

**The finding that matters most for how this board reads evidence: the pre-fix hostile cases were VACUOUS.**
Before the repair, the substituted-target and substituted-method cases "rejected" with **the same `OP_SPLIT`
crash as the honest transaction**. They looked like working hostile controls and proved nothing. After the fix
they reject with `OP_VERIFY` at **input 0** while the honest case settles. A hostile case that fails for the same
reason as the honest one is not evidence, and this is the first time this board has caught that pattern directly.

Cost: **+1, +2, -6, -6** bytes on exactly **4 of 11** shapes - precisely the producers of a non-identifier
`runtimeSelector` - with the other seven byte-identical, **verified rather than assumed**. At `ffef8568`, **8 of
the new 14 tests fail**; B5 annotated in-file which of the 6 passing ones pass for an unrelated reason, so they
cannot be miscounted as evidence.

**Not claimed:** the received-value rolled table (+2 B, same code path) has **no settling VM instance**, because
the layer-3 planner refuses that target set. Structural argument only, and labelled as such.

**A separate measured finding, left where it lies:** the `while` spelling also escapes G1's *published* ceiling.
`for` publishes `maximumOccurrences: 3` and the planner refuses 4; `while` publishes `undefined` and the planner
accepts **3 and 4**, stopping only at the participant and worklist caps. **Not a settlement gap** - the source
`require(handlers.length <= 3)` is in the covenant and refuses at input 0. Fix site is
`ExpandBoundedPointerTableLoop.visitBlock`, outside the lease. Opened as **X63**.

**X42: the two crashes are at DIFFERENT sites, and that determined where the guard goes.** The deploy fails while
generating `__scb_graph_run`, whose block layout has no deploy slot. The blockhash **does not fail at the read** -
both `__scb_graph_run` and `run` resolve the witness fine - it fails in **`__scb1`**, forwarding a handler
parameter the SCB1 route never receives. **A guard at the blockhash read site would not have caught it**, which
is why the refusal sits in `visitFunctionDefinition` ahead of both. One gate, two named reason tokens, the
no-artifact property **confirmed rather than assumed**, and **+0 bytes on every shape** because no compiling
program passes through the new path.

**Reach measured in both directions**: a blockhash reached through an internal helper **is** named (the helper is
inlined before codegen); a deploy through a helper is **not** - and B5 checked before calling that a gap, finding
it fails identically on the **direct** route, so it is pre-existing and unrelated. Left where it was.

**B5's own statement of discriminating power is the model.** Its full green run is real corroboration for X42, a
compile-time refusal whose false positive would surface as a red compile anywhere in 7,102 tests - and it is
**not** what establishes X2's repair, because *a green suite cannot see a covenant that settles for the wrong
reason*. That claim rests on the honest/hostile/guard triple at input 0 plus the 8-of-14 pre-fix control.

### 4.70 X51 closes the false negative X43 kept, without any type reconstruction

Merged at `42b7af50`; the four assertions B3 was leased out of applied at `76e46668`.

`AbiFunction.signatureGuard` gains `keyCommitment`, in X37's vocabulary, read through an accessor that spells
absence `unknown`. The point is **where the fact comes from**: `commitmentCommitsKey` now returns the committed
*side* rather than a boolean, factored so the artifact and the SEC-17 diagnostic run **one rule, not a copy** -
so the artifact cannot credit a commitment the diagnostic would refuse. The fold is the **weakest**, like `key`:
a single unpinned parameter key drags the published answer to `parameter`, which no allow-list admits.

**A VM triple with real attribution.** Honest: the holder of the committed key spends and the delegate writes
proxy state 5 -> 6, **settles**. Hostile: a stranger supplying his own pubkey **plus a valid signature over it**
is refused at **input 0**, failing at `OP_HASH160`/`OP_EQUALVERIFY`. Guard negative: the identical proxy with
**only the commitment line deleted** lets that same stranger settle 5 -> 6. The refusal is attributable to the
commitment, not to the signature check.

**Nothing previously measured moved: 171/171 green** across SEC-17's 8 negative controls, X46's 5 warning rows
and 4 silent controls including the key-rotation idiom, and the `checkMultiSig(ss, [pk, pk])` memoization case.
Every X51 row asserts the published field **and** the warning from the same source, because the two are computed
at different pipeline points - and a separate case pins the field **surviving modifier expansion, the locktime
guard and early returns**, measured rather than assumed.

**X37's compatibility bar met exactly**: 379 artifacts compiled in both runs, **compile status changed on 0**,
**379/379 SHA-256 identical to baseline after deleting exactly `signatureGuard.keyCommitment`**, bytecode
identical 379/379. Size +0.1314% with **347/379 files at +0 bytes**; the 32 that move are precisely the 32
publishing a row. Compile cost 0.0588-0.0603% by in-process attribution, inside X37's band.

**B3 discarded its own favourable measurement.** A whole-compiler in-process A/B gave **-5.89%** - a speedup -
and it threw the number away as below this box's noise floor under seven-worker load rather than reporting it.

**Corpus discriminating power, stated in both directions.** It genuinely discriminates the emitter change: 233
ABI functions carry a `signatureGuard`, 157 key resolutions reach the new walk, 41 functions across 32 artifacts
take the publishing branch. It is **blind** to the SEC-17/X46 decision refactor, which produces only console
warnings that artifacts never record - the 12 controls carry that load.

**Three judgments B3 made against its own brief, all correct.** (a) It corrected the task text: the class lived
in `UNADMITTED_DELEGATE_PARTICIPANT_CLASSES`, not `UNDETECTED_BY_THIS_GATE` - it was a shape the gate could see
and refused anyway. (b) It **declined to mint a second class id** for "artifact predates the field", because an
absent `keyCommitment` is byte-for-byte identical to "the compiler refused to credit the pin", so a separate id
would claim a distinction the artifact cannot support - and would have renamed the ordinary A13-2 hole after a
stale-artifact problem. (c) X46 has **no delegate case for a measured reason**: its vacuous-commitment shape
needs a self-write inside a delegatecall function, which the compiler refuses outright
(`DelegatecallSelfMutationError`), so it is pinned as that compile refusal and the artifact behaviour is pinned
at the selfdestruct site instead.

**Named residual, unchanged rather than introduced:** `signatureGuard` still says nothing about whether the check
**dominates** the delegatecall. A branch-guarded `checkSig` is admitted by the X51 route and by the pre-X51
`constructorArg` route **identically** - B3 measured both side by side rather than asserting the new route was
no worse.

### 4.69 X50: a THIRD defect in the shipped proxy, and a user capability deliberately removed

Merged at `1e43fc6c`.

**The manual adjustment the header warned about was applied to ONE of three fields, and that is a third defect
neither round-16 worker reported.** The relaxation lived in the **`bytecode` (ASM) field only**: `debug.bytecode`
carried the **unedited strict compile** (158 B, `OP_0 OP_NUMEQUALVERIFY`) while `bytecode` was the relaxed 159 B.
`Contract.ts:193` loads `artifact.bytecode`, so **the chain saw one script and `.debug()` showed another**, and
the `fingerprint` described **neither**. The file's own three fields disagreed with each other.

B2 **dropped** the adjustment rather than reapplying it, and measured why. 159 -> **173 B**, exactly two hunks:
**+15 B** of value and token-amount preservation for the data NFT at `OP_INPUTINDEX+1`, and **-1 B** at the tail
where `OP_0 OP_LESSTHANOREQUAL OP_VERIFY` becomes `OP_0 OP_NUMEQUALVERIFY`.

**The relaxation bought more than the INSERT, and the A/B proves it.** One own-category **mutable** NFT appended
at the proxy's own data-NFT covenant address, beside an honest delegated `increment()`, is refused at **input 0**
by the regenerated proxy - and **ACCEPTED, and lands**, against a proxy identical in every byte **except the
four-token tail**, leaving two mutable NFTs where the grafted layout names one. So `out >= in` buys **net
creation of proxy-category mutable NFTs generally**, not just collection nodes. The proxy is layout-independent
and cannot compute the collection entry address, so it **cannot** admit the one node while refusing the other
output. The INSERT is therefore genuinely unsupported through a strict proxy, and the test now asserts that
refusal with its reason rather than being deleted.

**Defect 1 is verified fixed with a guard negative**: the gate returns `bytecode-pinned` on the real grafted
proxy, and **stripping `target` back off still throws `unpublished-target-provenance`** - so the admission is
credited to the published field and not to the bytecode change that landed in the same commit.

**Five expectation changes, each named with its reason**, including one that exists purely for correct
attribution: `DelegateCollectionOutputPin` moved to a **non-conserving** proxy, because the shipped proxy now
refuses one input **earlier** and X11's pin would otherwise be credited for the conservation's refusal. Its
hostile row still refuses at **input 2**, keeping the pin as the credited mechanism.

**A real user capability is removed, deliberately, and documented.** `upgrades.deployProxy` combined with a
delegate that **inserts** a mapping key no longer works. That is a genuine regression in shipped behaviour,
accepted because the alternative is a proxy that permits net creation of its own mutable NFTs. Recorded in
`docs/upgrades.md` rather than left for a user to discover.

**What B2 declined to claim**, unprompted and all correct: it did **not** re-run round 16's 27-call
instrumentation, so "13 of 27 -> 0" is **inferred, not measured**; it makes no claim the E3 gate is wired,
because it is not; and it is **not a demonstrated wrong state read** - after the relaxed proxy accepted the
forged NFT, `getState()` still returned 6, because this provider returns UTXOs in insertion order, so the
exposure is **provider-dependent ordering** of identically shaped data NFTs. It also noted that **X11's pin now
has no settling instance on a conserving proxy**; its remaining population is proxies already deployed from the
stale artifact plus hand-written non-conserving forwarders.

Regression across all six packages: **7,088 passing**. One flake in `CorpusGapFixes` at 38.9 s under load,
green in isolation and in a second full run, in a file no compiler source change touched.

### 4.68 F2: conservative on 28/28 in-sample, and it says where it is NOT

Merged at `4c9176eb`, test-only (2,170 lines, six new files, no `src/` touched and **no existing test edited**).
It predicts from participant/invocation counts, per-participant `blockSize` and bytecode length alone - no UTXO,
no builder, no VM.

| shape | serialized pred/meas | worst script | worst density pred/meas |
| --- | --- | --- | --- |
| sweep N=2 / N=4 / N=8 | +0.9% / +0.3% / +0.0% | +0.0% | +0.0% on all three |
| A13 graph | 28,938 / 23,845 **+21.4%** | +0.0% | 0.5758 / 0.4067 **+41.6%** |
| C2 cycle | 59,548 / 53,249 +11.8% | +7.0% | 0.7960 / 0.6491 +22.6% |
| C1 DeFi | 65,397 / 63,315 +3.3% | +0.0% | +0.0% |
| C3 max graph | 112,955 / 100,650 +12.2% | +14.2% | +0.0%, correctly called **OVER** |

**28/28 conservative in-sample**, band +0.0% to +41.6%, mean +4.8%, erring high every time. All four limits are
modelled because the basis genuinely binds on four different ones.

**A model defect B7 found and fixed in its own first version, and the mathematics is the point.** Bounding an
operation cost above **and** its density bytes above bounds **nothing** about their quotient. The first version
did exactly that and **under-predicted C3 by -22.7% in-sample** - a conservative estimator that was not
conservative. Every cost coefficient now envelopes the **density ratio** directly. **Seventh first-version defect
across three rounds, and the sixth caught by its own author.**

**It was evaluated off its training data, three ways, and reported every miss.** A **real** held-out graph - E1's
six-participant, seven-invocation result graph, 19 inputs, never in any calibration set - came out **2/4 limits
conservative, worst -9.6%**. Leave-one-out 22/28, worst in-range -12.3%. Unseen counts N=3/6/16 **predicted
before building**, 11/12, the one miss -0.31% because the density-vs-participants curve bulges above the chord
between N=4 and N=8. A model evaluated on its training data is not evaluated, and this one was not.

**The margin arithmetic was wrong in the obvious direction, and B7 checked instead of assuming.** The closed-form
14% implied by the worst miss does not work, because a margin scales envelope coefficients but **not the additive
redeem term**. Searched: **34%** clears all 24 out-of-sample rows, at the cost of in-sample mean +4.8% -> +23.5%.
Reported and deliberately **not switched on**.

**Six limitations documented in the source, including the one that mattered most: it could not separate marginal
cost per resource/result/chunk/event either - and said so rather than fitting a curve through points that do not
separate the variables.** F1 hit the same wall. Two further limits the held-out graph actively *measured*:
projection unlocking bytes are **not** a function of participants plus invocations (they carry result payloads),
and controller density is **not** a function of slot count alone.

**Third independent confirmation of the C3 figure and its consequence.** B1 (on a node), B6 (re-measuring) and
B7 (estimating) each arrived at **100,650 B** and at F1's costed fix no longer clearing the ceiling - **four**
slot pairs needed, not two. Three workers, three methods, no coordination between them.

B7 also independently confirmed C2's fixture staleness for B6, matching on every figure, and confirmed for B4
that its basis inherits the single-knob regime with worst hash usage 0.1078x - so the regime split moves nothing
here, which is why it deliberately calibrates no hash coefficient.

### 4.67 The accuracy sweep OVERTURNS a conclusion, and X55's own premise was wrong

Merged at `851d04b7`. B6 corrected C2, then found the defect ran further than its row named - and found that the
row it was given for the transcript doc was itself mistaken.

**X52: all six of C2's recorded rows were wrong - and B6 did not copy the figures it was handed.** The brief gave
it A5's measured values. The **controller half reproduces exactly** (2,309 B / 1,198,938 / 0.6491); the
**projection half does not**, because X5 landed after that reading. Copying the brief would have re-pinned a
figure that had already moved. C2 also gained the knob-liveness control it never had - budget derived from the
reading at 259/byte, not a fixed fraction, because a fixed quarter-of-ordinary would have passed vacuously.

**The spillover is attributable to one edit, to the byte.** X5 touched `generateGraphProjectionVerifier` alone,
so every build grew by exactly **37 B x participant count**: A13 +111, C2 +148, C1 +185, C3 +296. Every
worst-density ratio reproduces to the operation, because each capstone's worst-cost input is a controller or a
participant and **never** a projection. **A13 is the one shape whose binding limit IS a projection**, so it is
the only one whose binding ratio moved: 0.5094x -> 0.5131x.

**A conclusion is overturned, not merely restated.** F1 costed C3's overrun and stated that removing the two
cheapest slot pairs frees 388 B and lands it at 99,966 - under the ceiling. At **100,650** that arithmetic gives
**100,262, still over**. Removing four frees 810 -> 99,840. **The stated fix stopped working when the figure
moved**, which is the sharpest possible argument that a dated table needs its *consequences* re-derived and not
just its numbers refreshed.

**X55's premise was wrong, and B6 checked before editing.** The row said the spec names byte 11 `callMode:u8`.
**It does not name byte 11 at all.** `invocation-transcript-v1.md` describes a *different, unimplemented*
candidate format whose row is `invocationId:u32, parentInvocationId:u32, subtreeEnd:u32, ...` - so byte 11 there
is the **high byte of `subtreeEnd`**, and `callMode` sits at offset 18. The shipped row is entirely different
(`parent:u16, callee:u8, localRow:u8, depth:u8, subtreeEnd:u16, selector:bytes4, callOptions:u8`). The two
formats diverge structurally throughout - different magic, different carrier, five row kinds against two, depth
ceiling 16 against `MAX_GRAPH_DEPTH = 7`. So B6 added a tabulated **"this is NOT the spec of the transcript the
SDK ships"** section rather than patching one field name into a document that would still have read as the
shipped spec. That is the right call: the fix the row asked for would have made the document *more* misleading.

**Two genuine errors it did find, both verified against measurement rather than constants.** The doc's
"instructions cost roughly eight bytes of budget" is **inverted by 64x** - at 100/instruction against 800/byte,
**eight instructions cost one byte**, confirmed by the three controllers' 9,561 / 9,536 / 15,336 instructions
consuming exactly 1,195.125 / 1,192 / 1,917 budget bytes. And §11 published only the **standard** hash regime,
unlabelled - the precise confusion F1 flagged and X48 fixed.

**X54: the wall-clock number was never the budget, and the overrides were HALVING the fix.** The row's actual
instrument is already load-invariant (`toEqual({directBytes: 3157, batchBytes: 4814, ...})`); the 15,000 ms was
only vitest's hang guard. The archaeology settles it: `357157ad` set 15,000 when vitest's default was 5,000 - a
*raise* - and `fa79113c` later raised the **package** default to **30,000** with a comment naming this exact
failure mode. Nobody revisited the overrides, so they had been cutting the later fix in half. **Removing them**
restores 30,000: measured 2,505 ms alone, 3,256 ms in a full suite, 7,467 ms under three concurrent suites - a
5.3x spread, and a live corroboration at **17,744 ms** in B6's own run that survives only on the 30,000 default.

**X47 confirmed independently**, by diffing both generators to prove F1 measures the same source, then agreeing
on two harnesses (F1 0.3630, the spike's own 36.3%). **X53 delivered as a full table** of every plan figure
provably wrong with its measured value - now applied to this document - including confirming the 2,131,662
controller base and that the derived 9.31% is unaffected.

**Discipline worth recording: B6 weakened no assertion and ADDED three** (a relay-ceiling bound and two
knob-liveness assertions on C2), reverted its instrumentation to byte-identical before staging, and labelled the
one figure it did not measure - the board's 13,352/3,931 ms pair - as a citation in the code comment itself.

### 4.66 X49: the first `CONSENSUS_FIT` this board can assert, and policy-vs-consensus is SETTLED

Merged at `c80142d7`. Node: **BCHN v29.0.0**, regtest, May 2026 upgrade active, Fulcrum in sync. This is the
first evidence in this effort that did not come from libauth.

**Policy versus consensus is now settled at the rule level, not argued.** One fully valid, wallet-signed
**101,513-byte** transaction on a real coin:

- through the **mempool** -> refused **`64: tx-size`** (code 64 = `REJECT_NONSTANDARD`);
- **the same bytes** in a hand-assembled block via `submitblock` -> **ACCEPTED**, confirmed at height 8444, and
  Fulcrum independently logged "verified ok".

**The 100,000-byte ceiling is POLICY, not consensus.** That is exactly F1's C3 prediction, and it is now proven
by a node rather than inferred from a constant.

**The enabling calibration was measured first**, which is what makes replaying mock-built bytes meaningful at
all: BCHN applies the standard **size** policy *before* input lookup, byte-exact - **100,000 B reaches
`missing-inputs`, 100,001 B is refused `64: tx-size`** - matching libauth's `maximumStandardTransactionSize`
exactly. So bytes whose outpoints exist on no chain still receive a truthful *size* verdict.

| shape | bytes | inputs | node verdict |
| --- | --- | --- | --- |
| sweep N=2 | 2,429 | 3 | **ACCEPTED + MINED** |
| sweep N=4 | 4,977 | 5 | **ACCEPTED + MINED** |
| sweep N=8 | 10,661 | 9 | **ACCEPTED + MINED** |
| A13 | 23,845 | 8 | `missing-inputs` |
| C2 | 53,249 | 79 | `missing-inputs` |
| C1 | 63,315 | 38 | **`64: dust`** |
| C3 | 100,650 | 108 | **`64: tx-size`** |

**`CONSENSUS_FIT` is supported for the participant-binding sweep at N=2, 4 and 8 - and for nothing else.** Those
three ran under `TESTS_USE_REGTEST` where the provider really broadcasts and mines, so the inputs **exist**: the
node executed the real Layer-3 binding covenants, accepted them and mined all three. For A13, C2, C1 and C3,
**`missing-inputs` means the node stopped before executing anything**, so their script validity remains
libauth-only. B1 drew that line itself rather than letting three green rows carry four more.

**A finding no libauth measurement could have produced: C1 is refused for DUST, not size.** C1 output 15 is
**10 satoshis to a 1-byte `OP_1` script**, against a node threshold of 474 - short by 464. It is invisible in
every harness measurement because `layer3-semantic-profile.ts:23` sets `enforceDust: false` and
`MockNetworkProvider.ts:96` then sets `dustRelayFeePerKb: 0n`. **C3 carries the same dust output** (82) and is
merely refused for size first. So **C1 and C3 are each unrelayable, and C1 for a reason entirely unrelated to
capacity** - which no amount of density measurement would ever have surfaced.

**Guards against overclaiming, enumerated rather than assumed.** B1 measured which policy rules this node
actually enforces - `tx-size`, `dust`, `oversize-op-return`, `scriptsig-not-pushonly` - and which it does **not**
(scriptPubKey templates, multi-`OP_RETURN`), cross-checked against a throwaway node with `-acceptnonstdtxn=0`.
Hence **`POLICY_FIT` is not supported for anything**; the solid policy results here are the two *negative* ones.
Separately confirmed: a **6,035-byte scriptSig is accepted**, so the legacy 1,650-byte standard limit is gone in
v29 with May 2026 active, matching libauth's 10,000.

**Independent cross-validation.** B1 measured C3 at **100,650** B - and C1 63,315, C2 53,249, A13 23,845 -
**before** the coordinator's relay of B4's identical figures arrived. Two workers, two methods, same numbers.
F1's 100,354 is confirmed stale; the overrun is **650 B**.

**BLOCKED, with the obstacle named: the capstones cannot run natively on regtest.** They call
`createLayer3SemanticTestProvider()`, which is mock-only; their builders *do* take a `createProvider` parameter
but are file-local and unexported, and B1 held no source lease. Opened as **X59** - threading that parameter is
the only remaining obstacle to node-executing A13, C2 and C1.

**Partial evidence kept rather than discarded**: a graph-controller run on regtest went ~75 minutes without
finishing and was stopped, but the node had already executed graph-controller covenants and refused **27 hostile
transactions with genuine script-verify failures** (21 `OP_EQUALVERIFY`, 5 `OP_VERIFY`, 1 `OP_NUMEQUALVERIFY`).

**X60 opened**: the `OP_1` placeholder recipient must become a real address, or C1 and C3 stay unrelayable
regardless of any size work.

### 4.65 X48: splitting the knob would have been COSMETIC, and "by luck" is now "by 9.3x of margin"

Merged at `d6ef4581`.

**The sharpest finding is that the named fix was not the fix.** F1 reported that `createVirtualMachine.ts` writes
one `hashDigestIterationsPerByte` into both regime fields. Splitting the field would have changed **nothing**,
because `createInstructionSetBch2026(true, ...)` was **hardcoded** and libauth selects the budget as
`standard ? Standard : Nonstandard` - so the nonstandard write was **dead code, and only the standard slot was
ever read**. The regime *selector* is what makes the split live. B4 found that by reading the consumer rather
than trusting the reported symptom.

**The answer to the question the row existed to ask: nothing moves.** All seven shapes bind on the **same limit
at the same ratio** as F1's baseline, with zero refusals at both real regimes. The figures that did move -
A13 23,734 -> 23,845 B, C2 53,101 -> 53,249, C1 63,130 -> 63,315, **C3 100,354 -> 100,650** - are serialized and
script **bytes**, which no VM knob can reach; they moved with the **base commit**, not with X48. Attributing
those correctly is the difference between a measurement and a coincidence.

**And it is quantified rather than asserted.** Worst hash usage anywhere is **0.1078x of the real standard
allowance**, set in all seven shapes by the same input: the **126-byte P2PKH fee funder**, 9 iterations against
an 83-iteration allowance. The multi-kilobyte Layer-3 covenant inputs reach 177 iterations and still top out at
**0.0487x** - their density budget grows with their script faster than their hashing does. The old 3-per-byte
knob could only have masked a failure for a shape between **1.0x and 6.0x**, and the envelope sits **9.3x below**
the bottom of that window. F1's "does not bite by luck" is now **"does not bite, measured, with 9.3x of margin"**.

**Two controls better than what they replace.** The hash control is now a **2x2**: tightening one knob below the
measured iterations must refuse in **its own regime and not in the other**, which is what proves the refusal came
from the knob under test rather than its twin - plus a guard that the shape hashes at all, so it cannot pass
vacuously. And consensus operation cost is now **read from the nonstandard instruction set** instead of only
derived by repricing at 64: **measured == derived on all 250 inputs, 0 mismatches**, so F1's arithmetic reprice
is VM-confirmed rather than assumed.

**Zero fixtures changed expectation**, and the `src/` change is byte-inert for all 11 existing single-value
profiles.

**Two caveats stated in the harness rather than hidden**: libauth's nonstandard instruction set also drops the
per-input SigChecks ceiling and leaves CLTV/CSV as no-ops, so it is *more permissive than real consensus* on
those two points. SigChecks is therefore still computed and ranked separately - it is what binds N=2 - and
`refusedAtStandard` remains the stronger acceptance reading.

**Relayed to B1, which is on regtest now:** the corrected knobs change nothing about what a broadcast should
show, so if C3 is refused, **hashing is not the cause** - 100,650 B against the 100,000 B ceiling is, and that is
a mempool policy refusal rather than a script failure.

**A pre-existing bug found by reading, reported not touched, and opened as X57:**
`createVirtualMachineBch2026ForProvider` **returns early when `provider.consensusLimits` is undefined and
silently drops the `observer`**. Providers other than the mock - Electrum and regtest included - have no
`consensusLimits`, so **opcode observers used for state derivation are discarded on live networks**. Relayed to
B1 as the first thing to check if regtest derivation misbehaves. Also flagged: `MockNetworkProvider.ts:89` writes
only the nonstandard field into the mem-cash verifier, so the split is not yet end-to-end there (X58).

### 4.64 TWO more live forgeries (X11, SEC-14), and A2 retracted its own first fix

The last round-16 packet, and the largest. Two of its three rows had a **stale or wrong recorded premise**, and
two produced **live forgeries**.

**SEC-14 was far worse than "not demonstrated exploitable".** The board recorded it as a shape a positional pin
could not separate, saved only by a reader accident. The truth is at the cause:
`emitEventCovenantVerification` gates a conditional emit on `OP_IF <blob non-empty>`, and a **zero-parameter blob
is empty** - the same value as the not-reached dummy. So on the **taken** path the gate evaluated false and the
covenant address, capability, FT-amount and satoshi-bound checks **never ran at all**. Measured: the reserved
event output replaced with a **plain 50,000-satoshi P2SH carrying no token** was **ACCEPTED**. The same diversion
on an *unconditional* zero-parameter emit was refused - that is the control that localises it.

The fix is `OP_0` -> `OP_1`, the same single byte: **+0 script cost on all nine shapes** (464 both sides for the
zero-parameter conditional), and +1 byte in the on-chain commitment, which is also what makes the row *readable*
- `parseEventCommitment` consumes it, so a genuine `emit Ping()` decodes as a log and a not-taken slot does not.
**The reader accident is removed, not relied on.** The decisive control is the second guard: a one-parameter
conditional emit is **byte-for-byte unchanged**, which is exactly what a marker prepended to every emit would
have broken.

**X11's recorded premise was stale, and chasing the real gap found a live forgery.** A delegate C2 sorted write
already settled in-repo (`UpgradesDeployProxy`, an INSERT). What had no settling instance was the same write
against a proxy owning **no data NFTs of its own** - and the cause was SDK-side: `hasNothingToDerive` read
`abiFunction.entryAccesses`, which a delegatecall forwarder does not publish, so derivation was skipped, the
entry output kept its **input** commitment, and the implementation covenant rejected its own transaction.

Then the consequence: `pinsCollectionOutputCount` **excluded delegates, recorded as "guarding an unreachable
shape"**. It is reachable, and with the pin off **nothing bounded collection output cardinality on that route**.
Appending one own-category mutable NFT at the collection entry address beside a genuine delegated
`users[msg.sender] = 5` was **ACCEPTED**, and the contract's own paginated reader returned **`[5n, 99n]`** - the
fabricated value read back as a genuine mapping entry. Refused at input 2 now. Cost **+28 bytes** for a delegate
performing a C2 sorted write, **+0** for an ordinary mapping write and **+0** for a delegate without one.

**A2 retracted its own first fix.** Its initial version pre-emptively refused every delegated INSERT - too broad,
and it broke the default-proxy case. Removed in two commits rather than argued for. **Sixth too-broad first
version across two rounds, and the fifth caught by its own author.**

**A second stale-artifact finding on the same file A1 flagged.** The shipped `defaultProxyArtifact` carries the
**relaxed** conservation form (`OP_0 OP_LESSTHANOREQUAL OP_VERIFY`, outputs >= inputs) where a fresh compile of
its own source emits **strict** `OP_0 OP_NUMEQUALVERIFY` - **159 bytes checked in against 173 fresh**. So the
delegated INSERT settles *only because that artifact is stale*, and **regenerating it per `docs/upgrades.md`
will break that test and close the insert**. Combined with A1's finding that the same file is a pre-X37 artifact,
X50 is now two independent defects in one checked-in file.

**X12's cause was not the recorded one either.** Not an unfilled graft position: a **split facet** is
`delegateOnly`, so the SDK never co-spends or materialises its own data NFTs, and an implementation-relative
offset counted them anyway - reading one index too high per data NFT. The gating was measured, not assumed: an
**ungated** subtraction settled the split route and **broke** the deployProxy route, caught by SEC-13's own
emitting-delegate case. Cost is **-6 bytes** on a split facet (six sites fold `OP_1 OP_ADD` into `OP_1ADD`) and
+0 on all eight other shapes. Newly named and refused at build time: `.emitReturn()` on a delegated call that
also emits, where the event NFT takes the index the forwarder reserved for the return event.

**A2 declined the cheap fix and said why.** It did not relax the proxy's conservation to admit INSERT on a
freshly compiled proxy: the cheap variants (`balance <= 0`, or excluding entry addresses from both loops) each
drop a real C1 property, **and the live forgery above shows that route is not over-protected**.

**Lease note:** A2 edited `StatefulContract.ts`, `StateReader.ts`, `AST.ts` and `compiler.ts`, all unleased and
untouched by the other five agents, and flagged them for tracking rather than leaving them to be discovered.

### 4.63 Round-16 verification: all six packages green, 7,063 tests, zero flakes

`yarn test` at `bbd87f71`, exit **0**, all six workspaces reached:

| package | tests |
| --- | --- |
| `@solidcash/utils` | 295 / 0 |
| `solidc` | **2,536 / 0** |
| `solidcash` | **4,189 / 0** |
| `@solidcash/testing` | 19 / 0 |
| `@solidcash/solidhat` | 24 / 0 |

**7,063 passing.** Both arithmetics close exactly: solidc 2,524 + 12 (X46) = 2,536; solidcash 4,167 + 3 (F1) +
9 (X43) + 2 (X46) + 8 (X5/X3) = 4,189. A5's eight added assertions are net zero new tests, as it reported.

**Zero flakes in this run**, against four consecutive full runs earlier at this HEAD that each failed a different
file. That is the 50s -> 120s timeout change and X45's precondition fix working together, and it is the first
full run of this effort with no failure to attribute.

**Correction to the board's own progress note.** An earlier update in this section said all six round-16 agents
had landed. **Five had**; A2 (X11, X12, SEC-14) was still running, and remains so - five commits deep, including
a retraction of one of its own refusals. The verification above therefore covers five of six workers, and A2's
merge will need its own.

### 4.62 X5 binds the call-options byte - the first covenant ever to read it; X3's wall is NAMED

Merged at `d2f11a2c`, after a hand-resolved conflict (below). Transcript byte 11 is now a documented
**call-options field**: bit 0 the compiler-proven read-only (`staticcall`) mode, bits 1-7 source-level options,
none admitted.

**Two divergences closed, both measured before the fix.** Round 15 refused only `delegatecall`, leaving the two
ordinary modes free to disagree: on real compiler output, `peek.staticcall(n)` publishes `staticcall` while a
supplied `callMode: 'call'` committed **`call`** - which also **skipped the staticcall read-only proof**. Worse,
the **root row was unbound end to end**: no caller re-derived its byte and no covenant read it, so a supplied
root `staticcall` was accepted and produced a transcript differing from the honest one in **exactly one byte**,
emission rows byte-identical. The projection verifier now requires the root row's byte to be 0 - **the first
covenant that has ever read that field.**

**One encoder writes both framings and asserts agreement with `callMode`**, so a hand-built plan handed straight
to `finalizeCompiledGraph` cannot desynchronize them; `assertNoUnboundCallOptions` was split into measurement
plus the same single exported refusal, keeping X31's byte-identical string intact.

VM evidence at ordinary capacity: honest settles; a **1-byte** root tamper refuses at **input 3**; a **1-byte**
edge-row rename refuses at **input 3**; the same rename carried into the emission vector (**2 bytes**) refuses at
**input 0**, the caller's own route. The mode-divergence refusal deliberately runs **after** the read-only proof
so the more specific message wins, which is why C2's refusal text is unchanged.

**X3 is BLOCKED for implementation and failed closed with a named diagnostic - and A4 respected the lease to get
there.** The wall is entirely compiler-side, in two files leased to other agents this round, and A4 touched
neither. It measured the wall instead of inferring it: `SymbolTableTraversal.ts:1855` refuses
`logicalCallSlots.length > 1 && some(hasReturnValues)` - **broader than fan-in**, since one returning plus one
void is refused by the same clause, isolation-pinned. And `verifyGraphEmissionRow`'s returning arm `OP_SPLIT`s
the caller's **whole** emission vector and requires the remainder to equal the declared length, so **a returning
row consumes the entire vector and nothing can follow it**. It named the fix: the cursor form
`consumeGraphRuntimeEmissionRow` already uses for loop rows.

**The sharpest part is what it proved is NOT the blocker.** Running the baseline SDK against a fan-in plan:
**accepted**, `resultDependencies: [[1,2],[],[]]`, failing only as an unnamed script error. And an honest fan-in
transcript needs **no relaxation to build**, because a row's result field comes from the producer's handler
outputs rather than the consumer's annotations - on that transaction, preflight fails at **input 0** (the
caller's route) while inputs 1, 3, 5, 6, 7 and 8 each evaluate clean individually. **The transcript machinery
accepts fan-in; only the caller-side lowering cannot.** That converts a vague capability gap into one bounded
compiler change.

**Cost, all measured and all budgets still passing**: projection verifier +37 bytes; C2 +210 instructions
(+1.4% over 5 invocations); C3 +315 (+1.3% over 15). All eight C3 projections remain equal, so that file's
"no returning-row surcharge" finding survives.

**The conflict, and why neither side was right.** A5 corrected C3's stale figures in the same block where X5
moved two of them. Taking A5's side would have re-pinned pre-X5 numbers; taking A4's would have discarded the
staleness corrections and reinstated text A5 had disproved. Resolved by hand: A5's corrected prose kept, X5's
deltas recorded as a **second, by-construction movement**, and the surcharge finding preserved explicitly
because equality across rows - not the absolute figure - is the property that mattered. Verified: C1 + C3 **29/29**.

**Follow-up A4 declined to take, correctly**: `docs/invocation-transcript-v1.md` still names the field
`callMode:u8` and `Layer3ReviewA1.test.ts` still names its offset `callModeStart`. Both are now the call-options
field. A4 left the shared spec doc alone. Opened as X55.

### 4.61 X46 is a LIVE THEFT closed; X28/X34/X35 stay refused, and one of MY premises was wrong

Merged at `270c7835`. Three of four rows came back **NO_CHANGE with a measurement**, which is the outcome the
brief explicitly permitted and the more useful half of this packet.

**X46 - a caller-chosen key reaches the committed state, and bob takes the money.** SEC-17 credits a key
committed by `require(hash160(pk) == this.pkh)`. It read the **binding** and not the **writer**, so
`this.pkh = otherPkh;` immediately before the commitment silences the diagnostic. A3 reproduced that at baseline,
then proved it is a real hole rather than a diagnostic nit: two contracts identical but for that one assignment,
both deployed with `pkh = alicePkh` and 50,000 satoshis. **Bob - not alice - calls `kill` with his own key and
his own destination, and takes 51,515 satoshis**, broadcast-accepted. Without the write, the covenant **rejects
at input 0**.

The enabling fact was itself measured: scalar state is **read-after-write within one transaction** on the
BCH-2026 VM - `this.pkh = a; require(this.pkh == a)` settles for arbitrary `a`, while the same require without
the write rejects. **A3's first probe of this was order-dependent and wrong, and it said so**, re-running with
two fresh deployments; the packet rests on the corrected one.

**The four silent controls all contain a state write**, so the silence is credited to *when* and *from what* -
not to "any state write present". They include the **key-rotation idiom** (write *after* the commitment), which
a cruder fix would have broken. Blast radius is bounded by construction: the two delegatecall sites cannot reach
this shape at all (a delegatecall function writing its own state is a hard `DelegatecallSelfMutationError`), and
all three consumers feed `console.log` blocks, so **no emitted byte can change**.

**X28: the loop leg does not exist, and my brief said it did.** I told A3 to split a compile-time-bounded loop
leg from an unbounded chunk leg, carrying the round-11 handoff's framing forward. A3 measured instead:
`needsTrailingRegion` is gated on `__scb1`, and five of its seven terms are assigned only inside
`GenerateTargetTraversal` while `computeBlockLayout` runs strictly earlier - so they are **`undefined` at every
evaluation**. Instrumented across both suites: **18 reservations / 2,283 layout computations** in the compiler
and **111 / 6,881** in the SDK, **every one through the chunk term, zero loop-term firings anywhere**. The
bounded half I asked it to size does not exist; the whole 64 is the unbounded chunk leg.

**And the obvious alternative narrowing is unsound, also measured.** "Reserve only when a dispatched handler
touches a dynamic variable" would be decided by a scan seeing `StateAccessNode`/`StateAssignNode` only, but the
bare `note = t` spelling is still an `AssignNode` - X19's gap, in this same function. **4 of the 18** reservations
report no dynamic-touching function while the contract writes one, and the narrowing fails **silently**: the SDK
enforces `trailingCapacity` only when the layout declares one, otherwise it appends the chunk run past the block
and misaligns every later participant.

**X34: the recorded premise was misattributed.** "Removing the guard makes the `this.`-spelled program compile
byte-identical to the bare form" is true of the plain path - but it is a property of the **baseline**, not
evidence about removal: with one handler and no route there is no clone, nothing carries a `__dj_` parameter, and
the guard never fires. Both spellings compile to the same fingerprint **with the guard on**. With the guard
disabled in a *copy* of the compiler, every refused leg produces **no artifact at all** - the exact internal error
the guard was built to replace. There is nothing to settle.

**X35: the predicate is a correct conservative proxy, and the real key is named.** Relaxing it does not remove
the entry NFT from a scalar row's block - measured, the slot list is identical either way. It only stops
requiring that something in that row constrains the entry's post-state, which is the SEC-9/SEC-15 class. It
should key on whether the route's entry slots are pinned on **every row** (per-row `conditional`), not on whether
this handler carries key witnesses; both halves are pinned in a test so a later relaxation must move the flag
too. Fix site is `compiler.ts`, outside the lease.

**A process finding the board should act on.** A3's first pin file added ~14s of bus compilation and tipped
`BatchCostRegression` and `HiddenBatch` past their explicit budgets - 4 failures, all timeouts, no assertions -
reproduced and confirmed against the same load without it. It cut the file to 7.5s. Separately it measured the
ERC-20 footprint row at **13,352 ms then 3,931 ms on consecutive unchanged runs against a 15,000 ms budget**.
That budget has **no margin** under concurrent load, independent of anything added this round. Opened as X54.

Counts: solidc **2,536/0** (2,524 + 12), solidcash **4,169/0** on its own baseline (+2 VM).

### 4.60 The accuracy repairs land, and the 50s test timeout is retired on measured grounds

Merged at `c4aae9ef`. X38, X39, X40 and X45 closed; every figure in both capstone comments is now one A5
measured at `4ac40b82`, and the capacity tests **print** their table so a future reader can check rather than
trust.

**C1's recorded figures were wrong; C3's were wrong in all ten rows.** C1's block also inferred the wrong
**sign** - against the 0.7268 it cites, the measured controller 0.6182 is **10.9 points lower**, not 8 higher.
C3's 1.2310x "the ONLY input over budget" was already contradicted by the file's own empty-set assertion two
lines away. **A5 found a third stale block nobody had flagged - C2's** (recorded 0.4607-0.4677 and 0.8170; measured
**0.3938-0.3979 at 5,464 B** and 0.6491 - all SIX rows wrong) - and **reported it rather than repairing it**, being outside the row.

**Two habits worth copying.** Where A5 could not re-measure a figure - the "Router shed 1,452 bytes" pre-vs-post
delta - it **dropped** the claim rather than carrying it forward, which is exactly how all three stale blocks
were created. And it labelled every number in the files as re-measured or cited, so the next worker can tell
which is which.

**X40 was verified independently, not taken from the reviewer.** A5 read `InlineStoragePointerCalls` itself
(`keepsGraphEmissionBinding` returns `!hasPhysicalEffects || hasOutgoingCall`, true via the second disjunct, so
the handler stays behind OP_INVOKE; the only way to fail it is a token-container effect or storage-pointer param,
which then hits the `GraphEmissionEffectError` throw - kept bound or refused, never flattened) **and** ran
`R2-C1-I` at this commit. Both capstone headers now credit the SEC-6 refusal and call the reshapes redundant.

**X45 is deterministic by PRECONDITION, not by retry luck.** A5 measured the width-0 rate at **4/300 = 1.33%**,
with ten unguarded positive-path draws compounding to a **~12.6% file-level flake rate** - which is why two
workers hit it independently. The ten now route through a probe that runs a real VM evaluation of both side-car
covenants and re-signs until it accepts, so **the test cannot build a transaction from a signature the split
search has not already accepted**. It still fails loudly: the retry budget is bounded at 24 - replacing an
unbounded `for(;;)` that would have **hung** - and exhaustion throws naming the condition and quoting the last
probe failure. **No budget was widened and no assertion removed**; negative-path tests keep the bare call, since
a width-0 draw cannot turn a required rejection into a false pass.

**The 50s mock test timeout is retired, on evidence from two independent sources.** Four full solidcash runs near
this commit each failed a **different** file - `Layer3MappingJournalS1`, `RepeatedExternalBatchCorpus`,
`Layer3ResultGraph`, `Layer3ResultGraphReview` - and every one passed in isolation. A regression cannot move
between files. A5 isolated the variable properly: re-running its failures with **only `--testTimeout` raised**
gave **17/17, exit 0**, and it measured its own files at 794s/871s/174s against ~8s/8s/60s unloaded, a **~100x
slowdown** under six concurrent agents. Raised to **120s** for mock; regtest already sat at 180s. A hang is
unbounded, so 120s still catches one - what it stops catching is a shared box.

**Both capstones should leave `CHANGES (round 9)`**, on A5's recommendation and round 15's independent reviews:
C1 fixture 16/16 plus `ReviewR2CapstoneC1` 15/15, C3 fixture 13/13 plus `ReviewR2CapstoneC3`, both with
re-measured figures and knob-liveness controls. **C3 carries a caveat the ledger must record**: it meets the
consensus-capacity claim and does **not** meet standard relay policy, by 354 bytes.

Two smaller owner items A5 surfaced: the plan records the post-X24/X27 controller base as 2,129,198 where two workers
independently measure **2,131,662** (+0.12%; 198,400/2,131,662 = 9.31%, so the derived figure stands), and the plan's own copies of the stale C1/C3
figures are outside A5's lease and still need correcting.

### 4.59 X43: E3 finally closes against the SEMANTIC class, and the admission was a LIVE hole

Merged at `e4eb1e12`. Sections 4.42 and 4.44 recorded E3 closed against the **published type**; X37 published the
provenance last round; this consumes it. A1 measured both gates over the same inputs by extracting the baseline
gate from `4ac40b82` into its worktree - not by reasoning about the change:

| escape | published metadata | baseline | X43 |
| --- | --- | --- | --- |
| `address t = address(target); t.delegatecall(input)`, `target` a `bytes` param | `{kind:'parameter'}`, param types `['bytes','bytes']`, containment TRUE | **ADMIT** `bytecode-pinned` | **REFUSE** `pinned-but-caller-selected` |
| `require(checkSig(s, pubkey(k)))`, `k` a `bytes` param | `{key:{kind:'parameter'}}`, no `pubkey` param published | **ADMIT** `caller-authorized` | **REFUSE** `self-authorized` |

**The admission was a live hole, and A1 proved it rather than asserting it.** New case A13-3b settles a **foreign
implementation rewriting proxy state 5 -> 999** through a proxy the round-14 gate called `bytecode-pinned`. The
guard leg fails `mandatory-script-verify-flag-failed` at **input 0**.

**The class is a conjunction, and neither half is the class.** `bytecode-pinned` now requires target provenance
`constructorArg`/`literal` **and** the implementation locking bytecode contained in the proxy bytecode -
provenance says the target is FIXED, containment says fixed to WHICH script. Round 14's gate had only the second.

**Three closures nobody had named.** Beyond the two known escapes, the type gate also admitted a **state-variable
target**, a **computed target** and a **ternary target** as `bytecode-pinned` - because none of them publishes an
`address` parameter, so a type-based gate saw nothing to object to. All nine `computed` forms X37 enumerates are
now verified refused.

**The round-14 false positive is repaired, not merely tolerated.** `E3PayoutProxy` - target a constructor arg,
plus an unrelated `address recipient` parameter - went REFUSE -> **ADMIT**, and its VM case still settles 5 -> 6.
Of 16 shapes measured across both gates, 7 changed: **6 narrowings and 1 widening**.

**Every refusal is paired with a same-published-types control that is still admitted**, so the refusal is
credited to provenance and not to "a second `bytes` parameter exists" - which would be round 14's mistake
respelled. `E3BytesUnusedProxy` has published types **byte-identical** to escape #1, down to the same 35-byte
require, and settles.

**Compatibility is three stated obligations, and an absent field falls closed.** Never read the raw field; go
through accessors that spell the missing case `unknown`, a kind the compiler never emits. Admit on an explicit
allow-list so `unknown` **and any kind a later compiler adds** fail closed. A pre-X37 artifact is refused as
`unpublished-target-provenance` - verified by stripping `target` from the admitted control and asserting the
unstripped original still passes.

**A1 declined to apply SEC-17's rule in the SDK, and the reason is right.** The compiler can credit
`require(hash160(pk) == <committed>)` because it sees the AST. **No artifact field publishes that commitment**,
and reconstructing it from types - a `bytes20` ctor arg next to a `pubkey` parameter - is precisely the reasoning
X43 exists to remove. So the shape is refused as `self-authorized`, enumerated as `hash160-committed-key`, with
the remedy named: one additive artifact field.

**Residual found and named: `decoy-committed-target`.** A proxy with two `address` constructor args -
delegatecalling one while the other holds the implementation's locking bytecode - is admitted against an
implementation it does not target, because containment is a substring test over the whole script. **Not an
authority hole**: both values are committed, no spender varies either, and the covenant refuses the mismatch at
spend time. Deliberately not closed by matching `target.name`, because X37's author measured `name` as
walk-order-dependent on a strength tie. Added to `UNDETECTED_BY_THIS_GATE` with a measured case, while the two
now-detected entries were removed **with their refusals asserted** rather than silently dropped.

**Handoff, opened as X50: the SDK's own shipped default proxy is a pre-X37 artifact.** Re-measuring the
"gate is not wired" claim over 27 calls gave 27/27 refused - conclusion unchanged - but **13 of those 27 refuse
as `unpublished-target-provenance`, because `defaultProxyArtifact.ts` is checked in with
`{callMode:'delegatecall'}` and no `target`.** Compiling its own `DEFAULT_PROXY_SOURCE` with the current compiler
publishes `{constructorArg, implementation}`, so the remedy is additive. A1 left it alone: outside its lease, and
the file header warns that regenerating it must reapply a manual bytecode adjustment. **Both halves are asserted
in the fixture so the finding cannot decay into a comment.**

**Corpus discriminating power: essentially zero, and A1 said so.** Nothing in `packages/solidcash/src` calls the
gate - re-verified by grep - so only the two E3 fixtures can depend on it. The full runs prove non-regression and
that the new imports typecheck, nothing more. The evidence is the two-gate blast-radius table and the A13-3 VM
block.

### 4.58 F1: the envelope is measured, and a DIFFERENT limit binds first almost every time

Merged at `e1b6f779`, test-only (741 lines, four new files, no `src/` touched). Measured at `4ac40b82`, every
shape run to completion at the **real** consensus profile *and* the **real** standard profile with **nothing
relaxed**, knob-liveness control live on all seven:

| shape | inputs | serialized | relay % | density std/cons | worst script | **binds first** |
| --- | --- | --- | --- | --- | --- | --- |
| synthetic N=2 | 3 | 2,429 B | 2.4% | 0.2177 / 0.2091 | 983 B | per-input SigChecks 0.2500x |
| synthetic N=4 | 5 | 4,977 B | 5.0% | 0.2570 / 0.2545 | 1,068 B | op-cost density 0.2570x |
| synthetic N=8 | 9 | 10,661 B | 10.7% | 0.3630 / 0.3605 | 1,184 B | op-cost density 0.3630x |
| A13 graph | 8 | 23,845 B | 23.8% | 0.4067 / 0.4041 | 5,131 B | script bytes 0.5131x |
| C2 cycle | 79 | 53,249 B | 53.2% | 0.6491 / 0.6465 | 5,423 B | op-cost density 0.6491x |
| C1 DeFi | 38 | 63,315 B | 63.3% | 0.6182 / 0.6157 | 7,451 B | script bytes 0.7451x |
| C3 max graph | 108 | **99,618 B** | **99.62%** | 0.9217 / 0.9191 | 5,876 B | standard relay size **0.9962x** (F4) |

**The headline result is that "capacity" was never one number.** C1 and A13 bind on the 10,000-byte per-input
script limit, C2 on operation-cost density, C3 on relay size. **C3 is inside every consensus limit and outside
exactly one policy limit** - which is the precise, defensible form of a claim this board has been making loosely.

**A ledger figure is misleading and must be corrected.** The ledger's *"N=8 participant binding at 36.5%"* is the
**synthetic binding-only fixture**, not an 8-participant graph. Real C3 at N=8 measures **0.9217x - 2.54x higher,
and 9.4x the bytes** (100,650 against 10,661). Read as an 8-participant capacity figure it implies headroom that
does not exist. A6 measures 36.30% for the synthetic at this commit against the pinned 36.5%.

**BLOCKED, and the reason it has never bitten is luck.** `createVirtualMachine.ts:29-30` writes a single
`hashDigestIterationsPerByte` into **both** the standard and nonstandard fields, so one knob cannot express two
hash regimes. Every "ordinary capacity" fixture passes 3, which is 0.86x of the real consensus 3.5 but **6x the
real standard 0.5**. Worst measured hash usage is 0.1078x, so it does not bite - *luck, not design*. Named
change: split `ConsensusLimits.hashDigestIterationsPerByte` into standard and nonstandard fields.

**The harness was validated three ways before its numbers were used**: it reproduces round 15's C3 figures
exactly at `4ac40b82` (100,354 B, 0.9217x, input 106 - since re-measured to 100,650 after X5), reproduces the
fixtures' own live assertions (6,046 density bytes,
24,382 projection instructions), and C1/C3 measure identically across independent tests and different providers.
That is how a measurement row earns the right to contradict recorded figures.

**C3's overrun is costed, not lamented**: at the time 354 B over. **Re-measured after X5 it is 650 B**, and that
**overturns the fix stated here**: removing the two cheapest slot pairs (177 + 211 B) frees 388 and now lands at
**100,262, still over**, where against 100,354 it did not. Removing four frees 810 -> 99,840. The 62 unused
Ledger trailing slots free 13,048 -> **87,602 B (87.6%)**. See 4.67.

**Promotion, stated with discipline.** **`CONSENSUS_FIT` is now supported** for A13, C2, C1, C3 and the sweep -
zero refusals at real BCH-2026 limits, nothing relaxed, knob control live - and A6 **declined to assert it**,
because everything was built on `MockNetworkProvider` and validated by libauth-with-real-constants rather than by
a node. A BCHN regtest broadcast would close it. **Nothing supports `POLICY_FIT`**: C3 is refuted on relay size,
and the rest are untested on dust (the fixtures set `enforceDust: false`), minimum relay fee, the full
`isStandard` predicate, and package/ancestor limits.

**Marginal cost per participant is superlinear**, from the controlled sweep rather than from the capstones (whose
participant and invocation counts move together): +1,274 B then +1,421 B of transaction, +0.0197 then +0.0265 of
density - consistent with O(N^2) cross-reads against an O(N) budget.

A6 independently confirmed the stale C1/C3 figures and **flagged them for A5 rather than editing them**,
respecting the lease. It also found more: C1 now has 5 projections and 38 slots, not "4/5 and 35"; C1/C2
projections measure 17,686 against 15,008 instructions, not a shared 17,259; and the "32 instructions per output"
fit does not reproduce at HEAD. **Every fixture assertion still passes** - only the comments are stale.

### 4.57 Round 15 closes: ALL SIX packages green, 7,029 tests, and round 16 dispatched

`yarn test` at `4ac40b82`, exit **0**, all six workspaces reached:

| package | tests |
| --- | --- |
| `@solidcash/utils` | 295 / 0 |
| `solidc` | **2,524 / 0** |
| `solidcash` | **4,167 / 0** |
| `@solidcash/testing` | 19 / 0 |
| `@solidcash/solidhat` | 24 / 0 |
| `@solidcash/create-solidhat` | no tests |

**7,029 passing.** This matters specifically because `yarn test` **halts at the first failing package**: for most of this effort a green solidc + solidcash was reported as "green", and it covered three of six. This is a full-repo result. The `EcrecoverRecovery` flake did not recur, which is consistent with its low rate rather than evidence against it - **X45 stands**.

**Round 15 final: eight workers, eight landed, zero abandoned.** Two live forgeries closed (SEC-13, SEC-15), three diagnostic defects closed (SEC-12, SEC-16, SEC-17), two capabilities landed (X36, X37), two independent reviews returned (R1, R2). Nine rows opened rather than left implicit (X38-X46, SEC-14). **Two of the five security findings were in code merged during this same round** - SEC-15 in X29, SEC-17 in SEC-12 - which is the strongest argument yet that INTEGRATED must never be read as reviewed.

**Round 16 dispatched at this commit**, six workers, disjoint leases: A1 X43 (`layer3/delegate.ts`), A2 X11/X12/SEC-14 (GTT + two lowering passes), A3 X34/X35/X28/X46 (`SymbolTableTraversal`, `balancedBlocks`), A4 X3/X5 (`layer3/graph.ts`, `worklist.ts`), A5 the accuracy repairs X38/X39/X40/X45 (tests and docs only), A6 F1 (measurement, no lease).

**A3's brief inverts the usual risk and says so.** Its four rows are *relaxations*, so a wrong answer admits an unsound shape rather than emitting a spurious warning. Its deliverable is a VM case proving each newly admitted shape settles, plus a case just outside the new boundary that still refuses - and explicit permission to conclude "this should stay refused", which the board has accepted before.

**A1 is the row that closes something already recorded as closed.** E3's gate classifies on the published type; both escapes cast through a `bytes` parameter; refusing `bytes` is unavailable because every admitted class carries a `bytes` calldata parameter. X37 landing the provenance fields is what makes it answerable at all.

### 4.56 SEC-16 and SEC-17 closed; the helper was MOVED, not copied, and verified line-for-line

Merged at `5d30c418`; solidc **2,524/0** (2,494 + 30). Both reproduced verbatim on their baselines first: SEC-16
as 3 mismatches of 8 (a caller-supplied `pk`, a rebound alias, and `checkDataSig` each silenced the selfdestruct
warning), SEC-17 as **14 of 36** across 7 spellings of the P2PKH admin idiom at **both** sites. After: 0/8 and
0/36.

**The helper was moved, and the move was verified mechanically rather than asserted.**
`warnUnauthenticatedSelfdestruct` now calls SEC-12's `hasAuthorizingSignatureGuard` instead of
`SignatureCheckFinder`. It read no instance state, so it moved from a private method to module scope - and S6
normalized `this.`/indent/`private` and confirmed **66/66 executable lines identical**. `SignatureCheckFinder`,
`SIGNATURE_CHECK_NAMES` and a now-unused import were deleted. That is the opposite of the drift this board
closed three `abi.find` sites to prevent.

**SEC-17 is deliberately narrow and the boundary was measured, not asserted.** A key parameter is credited only
when an **unconditional** top-level `require` pins `hash160(key)` to something the existing resolver says the
caller cannot choose; `unchecked` is transparent and only `&&` is descended. All **8 negative controls still
warn and none flipped**: committed to another caller param (directly and via alias), commitment inside an `if`
arm, commitment behind `||`, commitment binding a different key, `!=`, and the self-referential
`hash160(pk) == hash160(pk)`.

**S6 introduced a defect and found it in self-review.** Its first SEC-17 version answered **inconsistently within
a single key expression**: the cycle marker set on the first visit to a parameter made the second occurrence
resolve the other way, so `checkMultiSig(ss, [pk, pk])` with `pk` committed still warned while the
single-occurrence control was silent - the same false positive surviving in narrower form. Memoized per name,
with the in-flight marker deliberately not memoized so genuine self-reference still terminates. That is the
**fifth** too-broad-or-inconsistent first version this round and the **fourth** caught by its own author.

**An honest correction inside the measurement itself.** S6's first harness over-counted, because the generic
"Low-level .delegatecall() used" notice also contains the word "delegatecall"; the reported figures use the
C1-specific text. A measurement whose instrument is wrong is worse than no measurement, and it said so.

**Item 9 refuses corroboration for the third time this round.** The corpus run is 656 sources with **0
differing** - but only **9 of 656** mention `selfdestruct` at all and **none of those 9** emit the diagnostic on
either side, while SEC-17's reachable set is **1 of 656**. It is a regression net proving the 74 sources that
warn about other things were undisturbed; the evidence for both fixes is the before/after harnesses.

**Independent corroboration of X45.** S6 hit the same `EcrecoverRecovery` failure, in a contract with no
`selfdestruct` and no `delegatecall`, and attributed it the same way rather than assuming: 17/17 in isolation
**plus a second full run on identical tree and binaries at 4,162/0**. Two workers, two trees, same conclusion.

**No VM case, stated as a position.** Both are compile-time diagnostics that change no bytecode - the corpus run
confirms 0 emitted-output differences - so there is no input index to pin, and S6 wrote that manufacturing one
"would be theatre" rather than padding the packet. Correct.

**A documented limit, recorded not fixed**: the commitment check reads the key's binding, not the writer of what
it is bound to, so a function that assigns `this.pkh` **from a caller parameter** before comparing against it is
credited anyway. Opened as X46.

**Board verification, independent of the worker.** The integration owner re-ran its own three-shape probe against
the merged build: the `hash160`-committed idiom is now **silent**, the state-var control **silent**, and the
uncommitted key **still warns**. That last row is the one that matters - it shows the fix did not simply switch
the diagnostic off.

**A process failure worth recording, second occurrence.** The first attempt to merge S6 ran **in S6's own
worktree**, because the shell's working directory had persisted from a progress check. It was a no-op (merging a
branch into itself) and both trees were verified untouched, but the diffstat it printed looked exactly like a
catastrophic revert of X37 and SEC-15. **Rule going forward: every merge names its worktree explicitly via
`git -C <path>`, never relying on the ambient cwd.** This is the second time this exact error has occurred in
this effort.

### 4.55 Composed verification after SEC-15: 4,167, and the one failure was a self-diagnosing flake

`solidcash 4,166 passed / 1 failed` on the integration tree, which is **4,167 total = 4,162 + 5**, exactly S5's
predicted count. This composition had been tested by nobody: S5's baseline `ed32349c` predates both SEC-12 and
X37, so SEC-12 + X37 + SEC-15 first met here.

The failure was `EcrecoverRecovery > STATEFUL: ... ecrecoverPubKey + increments state`, and its error text names
its own cause and remedy: *"no ladder split fits both side-cars' op-budget for this signature (a rare
high-Hamming-weight scalar makes the GLV ladder too long for a 2-covenant split). Re-sign to obtain a different
signature."* Signature-dependent, on a path no round-15 change touches - SEC-12 and X37 each measured **0**
bytecode changes, and SEC-15 is gated on `hiddenBatchRoute && eventWidth > 0`.

**Confirmed by isolation anyway, not by that argument: 17/17 green.** The reasoning above is what makes the
result plausible; the isolation re-run is what makes it evidence, and the two are not interchangeable. Same
discipline as SEC-13's contention timeout.

**Opened as X45**, because this is a genuine test-quality defect rather than noise: the fixture signs with a
random nonce and has a known, documented failure rate whose remedy the error message itself states. A test that
knows how to fix itself should do so, rather than failing a full suite run at some low rate forever.

### 4.54 SEC-15 repaired per-slot, and a SECOND forgeable entry point was found doing it

Merged at `3b035dd8`. The route now carries the reached dispatch site's ordinal (`GRAPH_EVENT_SITE`, initialised
to **-1**, an ordinal no slot has). Every reserved ordinal **outside** `[site*width, site*width+width)` must
carry an empty commitment; the window itself is left to the handler, where `emitNotTakenEventSlotBinding` runs
**unshadowed**, so a handler whose own emit is conditional still pins its slot. The ordinal is keyed on the
reached handler's **own** `emitInfos.length`, not the shared frame's group-maximum width - which is SEC-8's
lesson applied without being told.

**S5 found a second forgeable entry point while repairing the first.** The route reaches its ordinals two ways,
and only one was known: besides the per-emit `OP_ELSE` where a flattened sibling emits, there is
`emitGraphFrameEventSlotBinding` standalone, where the invoked handler is the route's **only** emitter. There
`emitEventCovenantVerification` never runs at all - measured forgeable, and it would have survived a fix aimed
only at the reported path.

**The guard controls are what make the refusals attributable.** The same own-category NFT at the same unreached
slot with an **EMPTY** commitment is still ACCEPTED, before and after, at width 1 and width 2. SEC-11's pin
admits any own-category immutable NFT at an `event` offset and cannot separate those two rows, so the guard rows
credit the new refusals to the commitment binding rather than to the pre-existing pin. Ten hostile rows moved
from ACCEPTED to REJECTS at input 0; five honest controls settle unchanged, including width-2 and the
no-site-reached sentinel.

**Cost is real and the gate is narrow, both measured.** ~22-24 bytes per reserved ordinal that gains a binding:
**+215** and **+195** on the R1 hub shapes, **+369** on a uniform width-2 frame, **+174** on a C3-shaped router.
And **+0** on everything else, including **both capstones' effect carriers** - C1Notifier and C3Sink are leaves
that make no outgoing call, so they own no frame. That is measured per contract, not argued from the gate
condition. Larger than the +39 precedent because the reservation is 8 or 16 slots wide and the binding is
unrolled per slot; a loop form would be O(1) but cannot consult the per-slot route blobs the flattened-sibling
case needs.

**Item 9 states the corpus check is weak here and says why.** solidc's 2,463 tests contain **no VM test of an
unreached frame slot** - they confirm the gate is narrow via the +0 deltas but could not detect a wrong binding.
The discriminating evidence is the five honest VM controls (which fail immediately under a route-wide binding,
i.e. R1's ablation) and the two empty-commitment guards (which fail under an over-broad "no tokens at unreached
slots" rule). The fix is bracketed on both sides.

**A residual that is fail-closed and tied to a measured limit.** Two reached event-settling sites collapse to one
ordinal - the scalar's last write wins, so the earlier site's settled window is bound empty and the transaction
is **refused**. Nothing observable changes today, because R1's RESULT 3 measured that two reached sites never
settle anyway for an independent reason. If that limit is ever lifted this becomes a false refusal needing a
per-slot mask. Recorded here so the dependency is not rediscovered.

**An integration-owner error, caught by the worker.** S5's brief stated the `ed32349c` baseline as solidcash
**4,113/0**. That was R1's standalone figure; the true baseline at that commit was **4,162** (4,102 + 12 + 19 +
11 + 18, four merges deep). S5 flagged the discrepancy and **declined to reconcile it**, noting its diff touches
three files and cannot move static counts. Correct on both points - the error was mine, in the brief.

### 4.53 X37 published, and its own caveat found a live false positive in SEC-12 (SEC-17)

Merged at `656baa96`; solidc re-verified at **2,494/0** (2,474 + 20), the auto-merge in `SecurityAudit.test.ts`
resolving correctly with both S1's and S3's cases present.

The artifact now publishes `target` provenance on low-level calls and `signatureGuard.key` provenance on ABI
functions, additive and optional. **Both `bytes`-cast escapes now resolve to `parameter`**, which is the point:
`address t = address(target)` over a `bytes` param, and `checkSig(s, pubkey(k))` over a `bytes` param, are what
made E3's gate blind.

**The strongest compatibility evidence this board has produced.** All **327/327** compiling corpus artifacts are
**SHA-256 identical to baseline after deleting exactly the two new keys** (`updatedAt` normalized). That
discriminates any reordered, altered or dropped existing field - far stronger than "the suite is green". Bytecode
moved on **0/327**. Size cost +0.754% total with **210/327 files at +0 bytes**; ~44-68 B per row, worst case
+6.128% on a 1,077-B artifact. Compile cost 0.056%-0.152%, by in-process attribution.

**Two method notes worth keeping.** S3 **discarded** a cross-worktree A/B for compile cost after it produced
+17%, -27% and +240% on successive runs - box wall-clock variance is +-100% under this round's load, so any
timing A/B across worktrees is noise. And its first implementation had a real cost problem, a full body re-walk
per identifier, replaced by one per-function index walk **before** commit rather than reported as a caveat.

**Hostile case (e) attacked S3's own resolver and found a false safe**: `address t = impl; t = address(target)`
declares honest then reassigns, so a declaration-only resolver publishes `constructorArg` while the call reaches
the caller's bytes. Independently the same escape SEC-12 found one reassignment deeper. Two workers, two files,
same class - alias resolution must read every binding, and that now holds in both places.

**X37 does NOT close E3, and S3 said so first.** The SDK gate is a different lease and still classifies on the
published type; both A13 escapes still classify as admitted until the gate reads these fields. The field is
published, not consumed.

**SEC-17, found by following S3's own caveat.** Item 12(ii) warned that `signatureGuard` describes the key's
provenance and not the whole authority story - P2PKH publishes `{parameter, pk}` because its authority is the
separate `hash160(pk) == pkh` require. SEC-12 decides whether to warn using exactly that analysis, so the board
measured it on the merged tree:

| key | committed by | authorization warning |
| --- | --- | --- |
| state variable | - | **silent** (correct) |
| **parameter, `require(hash160(pk) == pkh)` against a state var** | a sibling require | **WARNS (wrong)** |
| parameter, nothing | - | **WARNS** (correct - the real SEC-2 hole) |

The middle row is the **standard BCH admin-upgrade idiom** and is currently indistinguishable from the genuine
hole. `hash160(pk) == pkh` against committed state makes `pk` effectively not caller-chosen.

Severity is low and the reason it still matters is not: this is a warning, not a refusal, so nothing breaks - but
a diagnostic that fires on the most standard authorization idiom in BCH trains people to ignore it, which is
precisely how the genuine SEC-2 instances it exists to catch would be missed. **Fourth fix this round whose first
version was too broad, and the first of the four to reach a merge** - the earlier three were caught by their own
authors before landing. Folded into S6, which already holds that helper and would otherwise have replicated the
defect into `warnUnauthenticatedSelfdestruct`.

### 4.52 Composed-tree verification at `71b9f8ee`: five merges, zero interaction

Every worker measures on its own worktree against `690c868c`, so five green packets do not by themselves say the
five compose. Measured on the integration tree after all five merges:

**solidc 2,474 / 0** (60 files) and **solidcash 4,162 / 0** (471 files, 4 skipped files, 24 skipped + 9 todo).

Both predictions close exactly and independently: solidc 2,463 + 11 (SEC-12) = **2,474**; solidcash
4,102 + 12 (SEC-13) + 19 (R2) + 11 (R1) + 18 (X36) = **4,162**. No test was lost, none double-counted, and no
pair of merges interacts - which was not guaranteed, since X36 changed planner admission while R1 and R2 added
fixtures that plan graphs through it.

**A cross-worker hazard was caught by a worker, not by the board.** S4 noticed that S5 is working the effect-frame
path from a baseline that already contains X36, and that `Layer3EmissionEffectEscape`'s three `selector` tamper
cells **bind 2 rows to a handler publishing 2 callsites** - exactly at capacity, and exactly the VM evidence
X36's capacity rule was chosen to preserve. If SEC-15's per-slot repair changes the callsite structure of
`hubSource`/`sec8HubSource`, a plan-time capacity refusal would present as "the fix broke something" when it is
really an over-count. Relayed to S5 with the instruction to re-measure rather than assume. No textual conflict
exists; X36 modified neither file.

**A tooling correction worth keeping.** `pgrep -f vitest` matches **globally across all worktrees**, so wait
loops written that way block on other agents' suites - two of S4's timed out at 10 minutes for that reason. Read
the run's own log summary instead. It cost only wall-clock here, but a wait loop that "completes" when a sibling
worker's suite ends is a false signal, not a slow one.

### 4.51 SEC-12 closed at both sites, and the corpus check was correctly refused as corroboration

Merged at `dbb15944`. Both suppressions were **reproduced verbatim on the baseline before any edit**: at `:5095`
the self-authorizing proxy emitted zero warnings past the generic notice, and at `:2302` a proxy delegatecalling
a P2PKH literal warned until `require(checkSig(s, pk))` with a caller-supplied `pk` **silenced it**.

`hasSignatureGuard` is deleted. `hasAuthorizingSignatureGuard` collects key operands (arg 1 of
`checkSig`/`checkMultiSig`, arg 2 of `checkDataSig`; a missing operand credits nothing) and credits a guard only
when the key is one the caller cannot choose - constructor input, state variable, literal, or an unresolvable
symbol such as a contract `const`.

**The negative control is the model this board should copy.** The two silent controls keep a caller-supplied
`pubkey` parameter, a `sig` parameter **and** an `address impl` parameter, and differ from the hostile in the
checkSig key alone. The hostile and the controls share all three incidental features, so the warning is
demonstrably credited to the key's source and not to "has a pubkey param", "has a sig param", or "target is a
parameter".

**S1 found two holes in its OWN first version by probing it.** (a) Reading only the declaration let
`pubkey k = owner; k = pk; require(checkSig(s, k))` resolve to the constructor key - the same escape one
reassignment deeper; every binding is now read, and both orderings warn. (b) The first version would have fired
on `checkSig(s, this.owners[i])`, but an index only *selects* among stored keys, so the container decides. Carved
out - otherwise the ordinary multi-owner proxy would have started warning. That is the third fix this round whose
first version was too broad, and the second caught by its own author rather than a reviewer.

**Item 8 of the packet is the honest one.** The blast-radius run covered 3,539 extracted sources, 1,960
compiling, with **0 bytecode changes, 0 compile-error changes, 0 warnings lost and 11 gained** - and S1 then
**declined to count it as corroboration**, because both call sites are gated on `hasExplicitDelegatecall` and
**2,049 of the 2,070 compiling sources cannot reach the changed code at all**. For those it proves only "no crash
and no accidental codegen change". The discriminating evidence is the 24-case control matrix. This is the
convention 4.34 invented, applied by its inheritor against its own favourable number.

All 11 newly-warning sources are `checkSig(s, <caller param>)`; **no legitimate proxy started warning**.

**The doc's exemplar of safe was the unsafe shape.** `delegatecall-security.md:118-119` listed "a signature guard
in the same function" as sufficient and cited `PINNED_PROXY` as the example - a fixture with no constructor args
that checks a caller-supplied `pubkey`, i.e. the unsafe shape verbatim. The bullet now states what the guard must
be, shows the unsafe shape as unsafe, names the fixture as a known-unsafe key kept for its identity/selector pin,
and records that SEC-12 changes **no bytecode**, so the takeover still settles: this is a diagnostic, not a
covenant, and A13-2b still settles 5 to 999.

**SEC-16 opened from S1's BLOCKED report.** The identical defect exists at a third site outside its lease:
`EnsureFinalRequireTraversal.ts:206-207`, `warnUnauthenticatedSelfdestruct`, returns early on any `checkSig`.
Measured on the current build - an unauthenticated `selfdestruct` warns, and a caller-supplied key silences it
while a constructor key is correctly silent. Dispatched to S6 with `keyIsCallerChosen` named as reusable, since
three `abi.find` sites were already closed this round precisely to stop a second copy drifting.

Counts: solidc **2,474/0** (2,463 + 11), solidcash **4,102/0**, exactly baseline. Three test files were edited
outside the source lease because their assertions **encoded the bug**; each is named in the packet.

### 4.50 X36: the obvious fix would have been a FALSE REJECTION, and measurement said so first

Merged at `ed32349c`. Both entry points now route every bound leg through one shared
`assertPlannedOccurrenceCount`, and the worklist gate keeps only what the bound cannot know - whether the
derivation probe answered at all.

**The trap this row was actually hiding.** The obvious implementation is to count rows the way
`bindConsumerCallsites` attributes them. S4 measured that attribution and found it **wrong**: on a handler with a
`once` and a `conditional` callsite of the same name, **both rows report callsite 0 and the conditional answers
neither**. Refusing on that guess is a false rejection that kills `Layer3CompiledGraphController`'s honest
conditional graph, which settles. The bound is therefore taken from the handler's **total published capacity** -
`batchInvocations.length` for a collapsed repeated call, 1 for any non-loop callsite, `maximumOccurrences ??
Infinity` for a loop - which needs no attribution guess at all. Fourth time on this board that the obvious fix
was the wrong one and only a measurement separated them.

**The deliberate many-to-one survived, measured rather than assumed**: instrumented over the layer-3 suite,
**1,004 caller/callsite binding groups, 6 outside capacity, every one a provable over-count**. Loop many-to-one,
unbounded loops and collapsed repeated calls all still plan.

**Two further divergences between the entry points, both closed.** `planCompiledGraph` read the compiler-authored
call mode **only when the caller supplied none**, so `callMode: 'call'` on a `delegatecall` callsite executed as
an ordinary call - and `Layer3CallOptions.test.ts:561` had documented that in a comment rather than a refusal.
Separately, `if (abiFunction === undefined) return;` skipped the call-option refusal entirely for the one
artifact shape that hides the direct-mode `transferCount` the refusal compares against. Three `abi.find` sites
bypassing the overload check were switched to `resolveGraphAbiFunction` - behaviour-identical today, closed so it
cannot drift.

**X31's remaining half verified**: both entry points now produce a **byte-identical** refusal string on the same
artifact, asserted. And the narrowing is confirmed by projection, not by eligibility: `this.transfer(r,900)` and
`bar{value:900}()` publish the **same** `transferCount: 1` and the same direct slots; the discriminator is
`handler.transfers` 1 vs undefined and route slots `transfer:8` vs `master:1` only. Both handlers are
`eligible: true`, so eligibility separates nothing.

Counts: solidc **2,463/0** unchanged, solidcash **4,120/0** (4,102 + 18). Seven assertions across five files
changed, all named. Four residual gaps reported rather than papered over, including that
`bindConsumerCallsites`' mis-attribution is now pinned as a `MEASURED:` test and that two evidence cells are
shadowed by the earlier refusal.

### 4.49 SEC-15: a forged log is LIVE in X29's OWN reserved slots, and X29's striding is PROVEN

R1's review merged at `ba6258bb`, test-only. Three results, and the review closed one gap while opening a worse
one.

**X29's striding is proven for the first time.** Section 4.41 recorded that every committed fixture uses row 0, so
`site * width` was multiplied by zero and per-site striding had **no** evidence. R1 reached ordinal >= 1 by making
the hub a **multi-row mid-chain participant** - a `StrideKick` root that calls it twice, so `fireAll` lands on
local row 1. The ordinal follows the row **in both directions**, for the transfer frame and the event frame, and
building the effect at the wrong ordinal rejects at input 0 either way. **X30's row is wrong as written**: a
multi-row mid-chain participant does settle.

**SEC-15 - a live forgery in the frame's own reserved slots.** The frame reserves 8 event outputs and only the
reached site settles one. `emitEventCovenantVerification` replaces its **entire SEC-10 not-taken binding with a
bare `OP_ENDIF`** whenever the route owns an effect frame (`GenerateTargetTraversal.ts:18137`, used at `:18314`),
and `emitOwnCategoryImmutableNftOutputPin` (`:20079`) admits an own-category immutable NFT at **any** `event`
offset. The 7 unreached slots are bound by nothing: forging one is ACCEPTED and `readEventsFromChain` returns
`Fired(999999)` beside the genuine logs, at full fidelity. **It reproduces in the single-row shape the committed
X29 fixture itself uses**, so it needs none of the reviewer's scaffolding.

**The repair shape was constrained by an ablation, not by argument.** Forcing `frameShadowed` to `false` makes the
**honest** transaction reject at input 0 as well, because the binding demands an empty commitment while the
reached site's genuine NFT carries a non-empty one. So the exemption is load-bearing and **the repair must be
per-slot** - bind the ordinals this dispatch site does not own - not a route-wide reinstatement. Dispatched to S5
with that constraint stated, because a fix that reinstates the route-wide binding rebuilds the ablation and fails
the honest control.

**This is SEC-10/SEC-11's class still live on the X29 route**, and off the bus the identical class is already
refused: `PlainConditionalEmitSlot.test.ts` is green at baseline, plain route rejects at input 0 and reads back
zero events, while the X29 frame route accepts. Section 4.43's justification - "the handler is the authority" -
is true only for the **one** slot the handler settles. That step was never checked until now.

**A claim is BLOCKED rather than open.** The subroutine's `containerIn - containerOut <= min(reached site
transfers)` bound **stays unmeasured**, because the only shape that exercises it (two reached transfer sites) is
unreachable for an independent reason: two rows that both dispatch an **outgoing-edge** handler never settle,
whatever the handler carries, while `[note,note]` and `[note,fireAll]` both do. R1 explicitly declined to call
the bound sound or unsound. Record it as blocked, not as verified.

**SEC-6 and SEC-7 came back clean under direct attack**, with the reason stated in each case. SEC-7's
`some(kind === 'tcTransfer')` short-circuit (`SymbolTableTraversal.ts:8871`) is **itself unguarded**, but every
path to it is closed upstream - which matters if the token-container key-parameter restriction is ever relaxed.
SEC-6's `hasOutgoingCall` is **shallow** and does not descend through internal calls, but an internal helper
making an external call is not compilable in a bus contract at all. Two effect kinds fail closed with an
**internal crash instead of a named diagnostic** - `new Child(..)` gives `Block slot not found: deploy[0]` and
`blockhash(n)` gives a missing-stack-variable error. No artifact is produced either way, so this is a diagnostic
gap, not a security gap.

### 4.48 R2's review of the C1/C3 reshapes: PASS on soundness, and the reshapes may be REDUNDANT

Merged at `5987f99b`, test-only (1,635 lines, two new review fixtures, no source file touched). **No escape found in
either reshape.** Zero soundness defects, six findings, all with measured numbers.

**Method worth adopting.** Both capstones rebuild the entire transaction per hostile row and assert equal
serialized *length*, which they honestly scope as evidence about shape. R2 instead mutated **one field of one
already-built honest transaction** and re-preflighted the same bytes - same outpoints, categories, witnesses.
Because `preflightLayer3Transaction` reports the *first* failing input, "refused at N" then also asserts that
inputs 0..N-1 accepted. Under that stricter construction C1's hostile matrix reproduced its indices **exactly**
(2 / 7 / 9 / 12 / 12 / 12), and the restored build re-accepts in every case.

**R2-F3 is the finding with consequences: the reshapes' stated premise is obsolete for BOTH capstones.** C1's
header says the effects were moved because a calling handler's clone "is flattened out of OP_INVOKE into
`__scb1`"; C3's says that shape is "measured FORGEABLE and refused by name (SEC-6)". Neither holds at
`690c868c`. For any function with `graphEmissionHandler && hasOutgoingCall`, `InlineStoragePointerCalls` now
either keeps it behind OP_INVOKE or throws - **the flattened-caller shape is unreachable**. The reshapes are
therefore redundant with a compiler invariant rather than load-bearing. They are not wrong and they buy wider
capstones, but the board should stop citing them as the thing that closes SEC-6: the refusal does.

**R2-F2 settles the structural-guard question on the actual subject.** Round 13 showed C1's guard premise false on
a synthetic sibling; R2 showed it false on **C1's own pre-reshape Router**, compiled at this commit: route
synthesized, `settle` eligible, 3 binding sites, and **16 owner-local physical slots**. The guard survives as a
drift detector; its justification does not.

**C3's ordinary-capacity claim REPRODUCES, and was measured the right way.** Run to completion over all 108
inputs, worst input the controller at **0.9217x**, over-budget set **empty** - plus a **knob-liveness control**:
the same bytes at 200/byte fail on density, so "ACCEPTED at 800/byte" is not vacuous. That control is what this
board lacked when it once read a 2.07x overrun as 0.0095%.

**A new bounded fact, measured for the first time (since re-measured to 100,650 / 650 over, see 4.67): the C3
transaction serializes to 100,354 bytes - 354 over the
100,000-byte standard relay ceiling.** The fixture correctly said standard size was untested; this turns that
into a number. "Fits ordinary BCH-2026 capacity" and "relayable under standard policy" are now known to be
different claims for C3, and no POLICY_FIT may be asserted for it.

**R2-F5: C3's X25 capacity table is stale in all ten rows.** It is introduced as "RE-MEASURED after the SEC-6
reshape, run to completion", and **not one row reproduces** - most consequentially the controller, recorded
1.2310x and "the ONLY input over budget", measured **0.9217x** with an empty over-budget set. The test's own
assertions already contradicted its comment (`expect(projection.bytes).toBe(6_009)` against a stated 5,876;
`expect(costs.filter(r => r.ratio > 1)).toEqual([])` against "the ONLY input over budget"), and the file states
both **24,067** and **25,984** for one quantity. Downstream arithmetic inherits it: "18.8% has to come off" when
it fits with 7.8% headroom. Same mechanism as C1's stale block - measured on the reshape branch before X24 and
X27 were composed on one tree, then never re-run. **Third occurrence of this failure mode on this board.**

**R2-F1 extends it: C1's stale comment is wrong in SIGN, not just in value.** It concludes the fifth participant
"costs about 7 points on each projection and 8 on the controller"; against the pre-reshape controller it cites
itself (0.7268), the measured post-reshape controller is **10.9 points LOWER**.

**R2-F6: the reshape opened a hostile-set gap nobody filled.** C3's hostile union is injection / injection-burned
/ omission / duplicate-owner / stranger-owner / disjoint-root / disjoint-root-stripped. **None attacks the event
NFT, the satoshi transfer, the container or the return commitment** - precisely the effects the reshape moved onto
the Sink. C1 moved its three effect rows to input 12; C3 added none. R2 supplied three, all refused at input 79.

**One accepted case correctly judged NOT a defect.** An arbitrary fee-funded payment at an unreached reserved
transfer slot was ACCEPTED (R2-C1-B). An unreached reserved slot is an ordinary output and the honest fixture
itself parks p2pkh funding there; the companion case paying the same slot **out of the satoshi container**
(4990 -> 3990) is refused at input 12. Reporting the accept together with the discriminating control is the
correct handling, not a finding.

**Two positive verifications worth keeping.** The seven unreached reserved event slots the reshape created are
bound: `emitEventCovenantVerification`'s SEC-10 `OP_ELSE` requires an EMPTY commitment on the not-taken path
(`GenerateTargetTraversal.ts:18316-18339`) and `readEventsFromChain` filters `commitment.length > 0`
(`StateReader.ts:327`) - covenant and reader exactly aligned, so no forged log is readable through a reserved
slot. And `msg.sender` on the ERC-20 leg binds to the **authenticated graph caller**, not merely to a co-spent
entry: R2 built a world where the substituted spender genuinely holds the allowance and it is still refused at 2.

**Scope R2 declined to claim.** C3 exercises 8/8 participants but only 8/24 invocations and depth 4/7; its
`toContain('invocationCount <= 24')` is a source-text check, not an enforcement proof, and the depth string is
absent from the file entirely. R2 verified all three bounds are written in both generated covenants and read the
depth-7 frame arithmetic as in range, but built no VM case for depth 8 or 25 invocations. Mock provider only.

Regression on the direct route: **6,584 passed / 0 failed** - baseline 6,565 plus R2's 19 new tests, exactly.

### 4.47 SEC-13 confirmed on all three paths; closed on two, and the third should NOT be closed separately

Merged at `7c57e293`. **All three excluded paths admitted the identical SEC-10/SEC-11 forgery** - an own-category
`none`-capability zero-FT NFT appended past the block end, accepted and read back by `readEventsFromChain` as a
genuine log. Measured before the fix, with honest and token-free guard controls on every row:

| path | honest | forgery | after fix |
| --- | --- | --- | --- |
| A `selfdestruct` | ACCEPTED | **ACCEPTED, logs `[999999n]`** | REJECTED at **input 0** (master) |
| B `delegatecall` proxy, impl declares no event | ACCEPTED | **ACCEPTED, logs `[999999n]`** | REJECTED at **input 2** (impl) |
| C `delegate` fn that genuinely emits | ACCEPTED, logs `[25n]` | **ACCEPTED, logs `[25n, 999999n]`** | REJECTED at **input 2** (impl) |

The fix is two hunks in `GenerateTargetTraversal.ts`: the gate drops `!isSelfdestruct` and
`!currentFunctionIsDelegate`, and inside a delegate function the allowed offsets become **implementation-relative**
(`OP_INPUTINDEX`, mirroring `emitBlockSlotIndex`'s `delegateOutputOnly`) while the pinned **category stays the
proxy's** - which is what a delegate `emit` actually produces.

**The gate exemption is measured, not assumed.** `declaresEvents` - the gate whose absence failed 17 spike files -
is untouched for every non-delegate function. Delegate functions are exempted from it *only* because case B's
forged log is readable against the **proxy's** declaration, which the implementation cannot see; gated on
`declaresEvents` alone, B stayed open.

**Cost is an order of magnitude below the original pin's +189 bytes**, because OP_DEFINE/OP_INVOKE outlining emits
the loop once and shares it: **+39 bytes** for a contract newly gaining a pin body, **~+3** per additional gated
entry point sharing it, **+49** for a second body shape when a delegate carries event offsets, and **+0** for
already-pinned, ungated, and proxy contracts.

**A negative result worth as much as the fix: path B should NOT be closed at the proxy.** The proxy's honest
own-category immutable outputs are the co-spent implementation's event NFTs, at an offset only that
implementation's layout names - the proxy cannot express the rule, and the implementation's pin already covers
them. What remains is exactly a proxy that does not *force* the co-spend, which is already SECURITY-AUDIT C1 and
which the compiler warns about verbatim. S2 asserted this in the fixture rather than arguing it: the same shape
writes `counter := 987654321` with **no implementation co-spent at all**, so a forged log adds nothing.

**Residual 1 closed by consensus, not by us.** An own-category immutable NFT carrying a non-zero FT amount is
refused by **CashTokens consensus** (`output amount: 1` against `input amount: 0`) and is unreachable for any
contract without own-category FTs in circulation, since FTs exist only from genesis. A cheap tightening exists -
an own-category output with no capability byte and a non-empty commitment is definitively an immutable NFT - and
was deliberately NOT added, because it could not be demonstrated live and costs bytes in every gated loop.

**Residual 2 is sharper than the handoff described, and is opened as SEC-14.** The taken and not-taken rows of a
conditional `emit Ping()` on a zero-parameter event are **byte-identical** at the event slot: same event covenant
address, `none` capability, empty commitment. **No positional pin can separate them** - only a non-empty active
marker in the emit blob could. It is not exploitable today solely because `readEventsFromChain` decodes neither
row as a log. That is a reader accident, not a covenant property, and it should not be recorded as a defence.

**Regression, both suites complete: zero regressions.** solidc **2,463/0 across 60 files, exactly baseline**.
solidcash **4,113 passed / 1 failed**, and the arithmetic closes exactly: baseline 4,102 + 12 new fixture rows =
4,114 = 4,113 + 1. Targeted blast-radius subset 15 files / 250 tests, 0 failures.

**The single failure was established as contention, not reasoned away as contention.** It is
`RepeatedExternalBatchCorpus.test.ts` failing on `Test timed out in 50000ms` - a timeout, not an assertion - in a
file containing **zero** `delegate`/`selfdestruct` occurrences, which the changed gate therefore cannot reach.
The run carried 5,810s of test time in 1,565s wall under load 40-50 from six sibling worktrees. **Re-run in
isolation: 4/4 in 68.8s.** That is the isolation re-run the house rule requires, not a verbal appeal to load.

Worth recording as method: S2 reported once with this suite still in flight and **declined to claim 4,114/0**,
then reported again when it finished. The board marked the row MERGED rather than INTEGRATED in between. An
unfinished run is not a green run, and the gap cost one notification cycle rather than a false entry.

### 4.46 Round-15 dispatch: six workers, disjoint leases, two of them reviewers

Baseline `690c868c` (solidc 2,463/0, solidcash 4,102/0, tree clean). The worker count rose from three to six
because the remaining work stopped being serial: after SEC-10/SEC-11 closed the immutable-NFT class, what is
left divides cleanly by file, so the lease system that previously forced serialisation now costs nothing.

Leases are disjoint by construction, one compiler file per worker:

| Worker | Task | Lease |
| --- | --- | --- |
| S1 | SEC-12 - `hasSignatureGuard` asks *whether*, never *whose key* | `SymbolTableTraversal.ts` + `delegatecall-security.md` |
| S2 | SEC-13 - own-category immutable pin absent on delegate/`selfdestruct` paths | `GenerateTargetTraversal.ts` |
| S3 | X37 - publish delegate target/key provenance in the artifact | `artifact.ts` + `Artifact.ts` |
| S4 | X36 - `planCompiledGraph` does not enforce occurrence bounds | `packages/solidcash/src/**` |
| R1 | Hostile review of X29 / SEC-6 / SEC-7 | none |
| R2 | Hostile review of the C1 and C3 reshapes | none |

**X37 is the keystone, not the smallest item.** E3 is recorded closed, but 4.44 established it is closed against
the published *type* and not the semantic class: both delegate escapes survive by routing the caller value
through a `bytes` parameter and casting. Refusing `bytes` is unavailable because every admitted class carries a
`bytes` calldata parameter. The actual blocker is missing metadata - `Artifact.ts:491-492` strips `lowLevelCalls`
to `{ callMode }` although the AST node already carries `dataParamIndex` (`AST.ts:278`). S3 publishes provenance
and is explicitly forbidden from touching the SDK gate, which is S4's lease. Un-blunting the gate is a later row.

**Both review targets were chosen because `INTEGRATED` on this board has never meant `attacked`.** X29 is the
proof: its own author found one hole in it during development, and an independent reviewer then found a second -
SEC-8, a live container theft that VM-settled and broadcast. The SEC-8 and SEC-9 *fixes* were reviewed and held;
X29, SEC-6 and SEC-7 themselves never were. The C1/C3 reshapes are in the same position - the originals were
reviewed, the reshapes that moved them off the forgeable shape were not.

R1 and R2 were each given the known limits of their target up front, so effort goes to new ground rather than
rediscovery. R1's sharpest: frame width > 1 settles, but every committed fixture uses row 0, so `site * width` is
multiplied by zero - what is proven is that two consecutive slots at the frame base are bound, **not per-site
striding**. R2's: an earlier reviewer already showed C1's structural guard is neither sufficient nor attributable,
so the guard survives as a drift detector while its stated justification is false.

Standing rules restated in every brief: `git stash` is BANNED (`refs/stash` is shared across worktrees); revert
instrumentation before staging and never `git add -A`; state a corpus check's discriminating power **for the
specific change**, remembering that this board's own convention was undercut by 7,343 files with zero diffs for a
fix that was wrong; **a clean review is a real result** and must not be padded into a finding; no worker may mark
a row PROVEN or edit this plan or the ledger.

R1 died on an API stall before any work landed and was resumed in place rather than respawned - its worktree and
branch already existed, so a fresh spawn would have failed on `git worktree add`.

### 4.45 SEC-10/SEC-11 were two indices of a class where EVERY unchecked index was open

Worker C probed whether the forgery actually needs a reserved slot **before** touching either item. **It does
not.** On a plain stateful contract whose function has no branch and no `emit` statement at all - block layout
`[master, dataNft]`, no `event` slot anywhere - appending one own-category `none`-capability NFT past the end of
the block was **ACCEPTED and broadcast**, and `readEventsFromChain` returned it as a genuine log.

The cause: an event NFT is an own-category **immutable (0x00)** NFT. `emitMintingNftUniqueness` conserves 0x02
and `emitOwnCategoryMutableNftConservation` conserves 0x01. **Nothing conserved 0x00**, while the co-spent
master is a minting NFT of the category. So SEC-10 and SEC-11 were two indices of a class in which every index
outside the checked slots was open.

**Independent corroboration nobody connected.** `Layer3BalancedAssemblyL2.test.ts:342` had ALREADY recorded this
exact capability as a measured limit of L2 - *"a SECOND NFT of its category can be minted in the tail and the
BCH-2026 VM accepts it"*. It sat in the repository as an assembly caveat for rounds, and no one read it as a
forgery primitive until the fix for a narrower bug went looking for the general form.

**A premise this board recorded was wrong.** The ledger said the not-taken slot carries "plain funding". Off the
bus it does not: the SDK materializes an own-category immutable NFT with an EMPTY commitment there. The
worker's first cut bound the slot to "not own-category" and broke the honest row. The fix instead requires
commitment size 0 on the `OP_ELSE` arm, which both honest shapes satisfy and a forged log cannot.

**Measured discipline throughout:** the X29 exclusion was bisected, not assumed - when a graph handler owns the
frame the route's own emit blobs are all empty, so route-level binding refused honest outputs; the route now
skips it and the handler is the authority. The existence guard came from a real `invalid transaction output
index` failure. Blast radius went 29 files / 51 tests on the first cut to **0**. Cost measured at dist level:
+189 bytes per contract, about +37 per gated covenant entry point.

**Residuals the worker named rather than left implicit:** the pin is not emitted for `delegatecall` proxies,
`delegate` functions or `selfdestruct` (opened as SEC-13); an own-category immutable NFT carrying a non-zero FT
amount is not counted, because introspection cannot distinguish it from a pure-FT output; a zero-parameter event
encodes to an empty commitment and is therefore indistinguishable from the honest inactive shape at an unsettled
slot - pre-existing, not introduced; and mocknet only, no regtest.

**Baseline correction:** this board's quoted `solidcash 4,034` was stale by 54 - the worktree baseline is 4,088.

### 4.44 E3's escapes are closed against the published TYPE, not the semantic class

Worker B closed both A13 escapes, then **self-reviewed its own fix and found the hole it leaves** - which is the
more valuable half.

`address t = address(target); t.delegatecall(input);` with `target` a **`bytes`** parameter publishes no
`address` parameter, so the gate still classifies it `bytecode-pinned` - A13-1 verbatim. And
`checkSig(s, pubkey(k))` with `k` a `bytes` parameter publishes no `pubkey` parameter, so it still classifies
`caller-authorized` - A13-2 verbatim. Both compile and both are admitted into the very classes A13 attacked.
Refusing `bytes` parameters is not available, because the calldata parameter every admitted class carries is
`bytes`. **So "closed" means closed against the published-type shape only**, and the worker said so rather than
letting the row read as settled.

**The gate is deliberately still unwired, and the measurement is why.** Instrumenting `withDelegatecall` across
the suites that use it: **11 calls over 6 distinct proxy pairs, 11/11 refused.** Wiring it would break every
settling delegatecall send in the suite. Worse, the `self-authorized` refusal is not synthetic - **the SDK's own
canonical `PinnedProxy` fixture is the A13-2 unsafe shape verbatim**: no constructor arguments,
`require(checkSig(s, pk))` against a caller-supplied `pk`.

**One rule is a measured over-refusal, committed as a stated cost.** `E3PayoutProxy` - target from the
constructor argument, plus an unrelated `address recipient` parameter - settles 5 to 6 on the VM and the gate
refuses it. The compiler, which can see the target expression, emits no diagnostic for it.

**The narrowing the worker caught in itself:** its first draft accepted `datasig` as well as `sig`, which would
have admitted a `checkDataSig`-authorized proxy that no BCH-2026 case settles. Reverted before committing.

**SEC-12 opened from the handoff.** `hasSignatureGuard` returns true for any `checkSig`/`checkMultiSig`/
`checkDataSig` anywhere in the subtree and is used as if it answered "is this delegatecall authorized". Both
suppressions are measured: at `:5095` it silences SEC-2 (the shape compiles with only a generic notice and a
stranger settles 5 to 999), and at `:2302` it silences the C1 P2PKH warning - a proxy warns with no `checkSig`
and **stops warning** once a caller-supplied-key `checkSig` is added. The fix shape is to resolve which key,
reusing machinery already in that class. **A doc defect ships with it:** `delegatecall-security.md` lists a
signature guard as sufficient and cites `PINNED_PROXY` as the example - the doc's exemplar of the safe shape is
the unsafe one.

**X37 opened:** the artifact strips `lowLevelCalls` to `{ callMode }` though the AST already carries
`dataParamIndex`. Publishing target and key provenance would let the gate answer both questions exactly, instead
of refusing whole parameter types and still missing the `bytes` route.

### 4.43 SEC-10 is LIVE and reaches plain contracts; SEC-9's refusal is incomplete

Worker B measured what nobody had, and the result is the widest-reaching finding of the effort.

**SEC-10 is a live forgery.** `collectEmitStatements` reserves a slot for a no-else branch arm, and
`emitEventCovenantVerification` wraps that slot's ENTIRE verification - commitment, locking bytecode, category,
capability, FT amount, value cap - inside `OP_IF <blob non-empty>`. On a row where the branch is not taken, the
reserved output is checked by nothing.

| row | slot content | result |
|---|---|---|
| branch taken | honest | ACCEPTED |
| branch taken | forged | REJECTS @0 - the slot IS bound when the branch runs |
| branch NOT taken | plain funding | ACCEPTED |
| branch NOT taken | forged at the REACHED slot | REJECTS @0 |
| **branch NOT taken** | **forged at the reserved slot** | **ACCEPTED, broadcast** |

**It is not bus-specific and does not need X29's frames.** It reproduces with one handler, one emit and frame
width 1 - no sibling, no divergence - and on a **plain stateful function with no bus, no route and no frame at
all**. So it predates X29 and reaches any contract containing `if (c) { emit E(); }`. The impact is a real log,
not a stray output: `readEventsFromChain` returns the forged value both on and off the bus.

**SEC-9's refusal is sound but incomplete on two axes.** Worker B confirmed `emitInfos`-after-lowering IS the
right comparison - it is literally what `eventWidth` is computed from - and credited it with catching a second
vector the pre-lowering gate misses. But:

- **static count is not settled count.** A one-armed emit contributes to `emitInfos` while settling nothing, so
  both handlers report the same width, the refusal stays silent, and SEC-10 lands.
- **it is EVENT-ONLY.** `transferWidth` is a group maximum by the identical construction and is never compared,
  and the gate counts only one of five transfer spellings. Measured: 16 transfer slots reserved, a forged
  own-category event NFT at the **settled** slot rejects, at the **reserved** slot is **ACCEPTED**, and reads
  back on chain. Opened as SEC-11.

**SEC-8's fix is CLEAN** on every vector Worker B could construct, including the `{value:}`-option case that
made the naive ablation wrong - unreachable because such a handler is dropped before frame planning.

**A limit on the width-2 evidence, found by the reviewer.** Worker A's positive control reproduces, and B added
the negative control it lacked (forging slot 0 also rejects). But both fixtures use row 0, so the reached site
is ordinal 0 and `site * width` is multiplied by zero. What is proven is that **two consecutive slots at the
frame base are bound** - not per-site striding. A width-2 settlement at ordinal >= 1 needs the multi-row batch
X30 records as still rejecting.

**Repair handoff, already located:** `minCounts.emits` sets `conditional` exactly when some path leaves a slot
unsettled, and correctly does not mark a two-armed if/else - so a repair keyed on it would not over-refuse. On a
route it is unusable as published, because every frame slot already carries `conditional: true` for the
unreached-site reason and the recompute is gated on `isEntryPoint`. `branchOps.minEmitCount` is the available
signal.

### 4.42 Round-13: E3's two ADMITTED classes both escape; G2/G3/C3 clean; two recorded figures wrong

**E3 - both admitted classes are reachable by shapes E3 itself refuses, and both settle on the VM.** Worker A
reviewed it, having not written it.

- **A13-1**: `pinnedInProxyBytecode` is a substring test AND it is the FIRST branch, so it short-circuits the
  `caller-chosen` refusal below it. A proxy taking its implementation as a constructor argument - so its p2sh32
  genuinely commits to those bytes - while `delegatecall`ing a caller-supplied `impl` parameter is classified
  `bytecode-pinned`, the class with the STRONGEST identity claim. A foreign implementation rewrites proxy state
  5 to 999 and settles. The honest control differs only in where `impl` comes from and is refused at input 0.
  **The compiler emits SEC-2's warning on the very same source - so the SDK gate contradicts the compiler.**
- **A13-2**: `caller-authorized` requires only that SOME `sig` parameter exists. A proxy with NO constructor
  arguments - storing no authority at all - whose `checkSig` is against a caller-supplied pubkey is classified
  `caller-authorized`; a stranger settles 5 to 999. **Nothing warns**: SEC-2's suppressor matches any
  `checkSig` anywhere in the body without asking which key it checks.

Both are gate-level - the gate is wired to nothing - so the on-chain effect is SEC-2's known warn-only takeover.
What is new is that E3's own gate labels these ADMITTED, and in the second shape suppresses the warning too.
E3 moves to CHANGES.

**E4 - Worker C's round-11 correction confirmed independently, and extended.** A real 25-byte origin IS
available; the actual failure is that a handler reading `msg.sender` cannot execute. **It is not root-specific:**
a non-root EMISSION handler fails identically (`OP_SPLIT`, 35-byte operand, input 1), while the same predicate
at a LEAF settles - the varying field is exactly whether the handler makes an outgoing call. **And it is not
only `msg.sender`:** `msg.sig` and `msg.data` break at the emission position too. It is fail-closed, not
silently wrong - all four locking bytecodes present give OP_VERIFY.

**That scopes a ledger PROVEN row.** The row claiming logical `msg.sender`/`msg.sig`/`msg.data` PROVEN for
admitted graph handlers is scoped to handlers with **no outgoing call** - confirmed by reading the committed
fixture, which puts all three reads in a participant that makes no calls.

**G2, G3 and C3 clean.** Worker C attacked three occurrence tampers the shipped set does not contain -
selector-only, call-mode, and reparent - all reject at input 0, and concluded the set's completeness is a
property of the MECHANISM (a byte-exact prefix partition plus an empty-remainder requirement) rather than of the
enumeration. G3's scoped fail-closed claim, previously prose with no VM case, now has one. X36 does not weaken
G2: enforcement is the caller covenant, not the planner.

**Two recorded figures are wrong, both found by review.**
- **C1's capacity numbers do not reproduce.** Recorded projections 0.5231/0.5154/0.5151/0.5204/0.5127 and
  controller 0.8057; measured run-to-completion at HEAD: **0.4627/0.4552/0.4548/0.4532/0.4525** and
  **0.6171**. Attribution is exact: they were written at `14089e2e` and X27's `attest` suffix-split - the
  controller script itself - landed **55 seconds later in the same branch**. The figures predate the
  optimisation of the script they measure.
- **C1's structural-guard justification is false**, though the guard still works as a drift detector. The
  published `blockLayout` is NOT an exact proxy for the compiler predicate: it is not sufficient (X29 repaired
  exactly the shape it would reject) and not attributable (a route slot carries no owner). The per-handler
  projection IS the right signal, and the SDK already uses it elsewhere.

**Two scope corrections to C3's own notes.** Injection is refused by the CONTROLLER ALONE on all three
placements, so its note crediting "the graph table's exhaustiveness over the whole transaction" describes one
covenant, not a system property. And re-rooting by the parent field alone leaves every projection proof
satisfied - only the controller refuses - so the depth-dispatch credit is specific to the depth-0 spelling.

### 4.41 SIX MORE ROWS PROMOTED TO PROVEN at `f2c53a5d`

Rounds 11 and 12 completed the cycle section 3.3 requires: an independent hostile review by a worker that did
not implement the row, every finding fixed and integrated, and regressions green. Verified at this commit:
**solidc 2,463 / 0**, **solidcash 4,011 / 0**.

| Row | Reviewer | Review outcome | Resolution |
| --- | --- | --- | --- |
| **L1** | B | CLEAN - and it pinned L1's one unindexed hostile row, extended relocation to a third width, and closed the strongest structural hypothesis | nothing to fix |
| **L2** | B | 2 findings - the gate silenced by a bare `Unlocker`, and two documented checks dead on the wired path | both closed by B in X32 |
| **S2** | B | 1 finding - the guard walked `fn.body` only | closed by C in X33 |
| **E2** | C | 1 finding - the option refusal was on the entry point nothing uses | closed by B in X31 |
| **X23** | C | CLEAN - and C closed the evidence limit X23's own author could not | nothing to fix |
| **X27** | C | CLEAN at the `frame.length` boundary | nothing to fix |

**Running total: 10 PROVEN.** Every one names a reviewer who did not write it.

**Still not promotable, and the list is the point.** X29, SEC-6 and SEC-7 were reviewed by A and produced SEC-8
and SEC-9 - both fixed, but the FIXES have had no independent review, so promoting them would restart exactly
the loop that caught them. C1 and C3 carry unreviewed reshapes. G2, G3, E3, E4 and roughly fifteen X rows have
never been attacked at all. SEC-10 is open and unmeasured.

### 4.40 X31/X32: the obvious fix was wrong in both cases, and measurement said so first

**X31.** Porting the existing option refusal to `planCompiledGraph` as written would have been wrong.
`this.transfer(..)` publishes the SAME direct-mode `transferCount` and the SAME block slots as `{value:}` - but
the compiler CARRIES a first-party transfer into the SCB1 route while it DROPS the option entirely. The
discriminator is the handler projection, not the direct layout. Measured before choosing: the blanket rule
fails **40 tests across 5 files**, refusing five first-party transfers the VM settles today. Both entry points
now share one narrowed check.

Two further divergences were found and closed in passing: `planCompiledGraph` skipped its delegatecall
rejection ENTIRELY when `callMode` was supplied rather than inferred, and a function name resolving to two ABI
entries silently took the first - SolidCash does admit overloads. One is reported and NOT closed (X36):
`planCompiledGraph` does not enforce occurrence bounds, so three children can bind one `once` callsite. It is
caught on chain by the caller's emission covenant, not at plan time.

**X32.** The first version claimed every tail slot as auxiliary and **broke C3's `injection-burned` case**,
replacing its covenant refusal at input 106 with an auxiliary-slot complaint - a right outcome for a wrong
reason, which is the failure mode this board has been catching all effort. That measurement drove the final
rule: only the canonical tail is claimed. The gate now separates OUT OF SCOPE (no participant master present -
ordinary transactions still return `undefined`) from IN SCOPE BUT UNDERIVABLE (refused by name), and both
Layer-3 send paths refuse when nothing was derivable, since reaching them is the caller's own assertion that
the transaction is a composition.

**A vacuous hostile case was found and fixed.** Worker B diagnosed, while verifying something else, that an X7
case patching emission byte 5 to `0x00` is a no-op about one build in 256, because that byte lies inside a
freshly minted category hash. A hostile case that silently becomes a no-op is worse than a flaky one - its
255/256 green runs look like evidence they are not. Fixed by the integration owner to flip on collision.

### 4.39 The S2 "dialect divergence" was a SPELLING divergence, and the admitted side is the correct one

Worker B measured that the same program is refused in `.scash` and admitted in Solidity, and correctly labelled
it UNDETERMINED. Worker C settled it, and the label itself was wrong.

**It is not the dialect. It is the spelling of the dynamic state write.** `this.note = tag` is a
`StateAssignNode` from the parser; bare `note = tag` is an `AssignNode` over an `IdentifierNode` until symbol
resolution - which runs AFTER these lowerings. So `analyseFunctionFootprint` never records `state:note`, no
`__scb_dynamic_` clone is synthesized, the dynamic journal converts nothing, and the guard has no `__dj_`
parameter to fire on. **This is X19's own gap, one resource kind over** - X19's comment records exactly this for
bare `m[k] = v`. Four cells rule the front end out: Solidity spelled `this.note` is REFUSED, `.scash` spelled
bare is ADMITTED, and it reproduces with no message-bus options at all.

**The admitted side is right, established on the VM rather than argued.** The chunk output settles beside the C2
insert node, and forged chunk, forged entry value, dropped chunk and an extra chunk minted at the dynamic
address all reject at input 0. So the refusal is over-strict.

**The worker did NOT remove the boundary, and the reason is the good kind.** It measured the removal: the `this.`
program then compiles BYTE-IDENTICAL to the bare form already settled above - settlement-by-identity for the
plain path. But in message-bus mode the `__scb_dynamic_` clone still exists and that artifact is 4,845 bytes
against the bare form's 4,397, so that leg is a different script and was never settled. Shipping half would
leave a mode-dependent boundary and make the X33 guard it had just strengthened unreachable. Opened as X34 with
the premise recorded.

**A limit of this board's own corpus convention, stated by the worker who established it.** The X33 corpus check
covered 7,343 files with **zero** status moves, message diffs or over-accept diffs - and that held for an
aggressive version of the fix that WAS wrong. Worker C's first repair rejected every function-pointer callsite,
refusing two shapes that compile at baseline. **The corpus could not have caught that; a targeted probe did.**
Corpus size is not discriminating power, and a clean corpus is not a clean change.

### 4.37 Round-11 review of X23/X27/E2/E4: a gap its own author could not close, and one real hole

**Worker C closed X23's recorded evidence limit** - the one its author tried three fixture variants on and
failed. The author read it as a fixture problem; it was an instrument problem. `preflightLayer3Transaction`
throws on the FIRST failing input, but the projection verifier never reads `tx.inputs[i].unlockingBytecode` -
only `attest` does - so evaluating each input SEPARATELY on the same transaction isolates each covenant.
Measured discriminating power: on every emission forgery exactly inputs 0 and 4 fail while 1, 2, 3, 5, 6 and 7
pass, on the same forged transaction.

**X23 clean, with stronger evidence than the system-level kind it previously had.** The rewritten one-slice
emission comparison refuses forged target, call mode, selector and target-length-frame bytes ON ITS OWN. For a
forged depth and a forged callee, **no participant route refuses at all** - only the rewritten
`activeCallees`/`usedMask` tables and the controller do. A term-by-term read found no dropped check, two
coalesced bounds strictly stronger, and the callee range silently tightened from `< 8` to `< participantCount`.

**X27 clean**, with five cases driving `cursor`/`tail` to the `frame.length` boundary including
`invocationCount + 1`, where the split lands at `tail == transcriptLength` exactly - the tight case for the
in-range claim.

**E2 FINDING - the guard is on the wrong entry point.** The call-option refusal lives only in
`deriveCompiledGraphPlan`. `planCompiledGraph` - the other public `layer3` entry point, and **the one every
committed capstone fixture uses** - has no option check, and a `{value:}` graph settles through it with the
option silently dropped. Iterated low-level calls do fail closed on every spelling tested.

**E4 - the recorded reason for its one open row is wrong.** `SignatureTemplate.unlockP2PKH()` does give a real
25-byte origin, so the positive branch is satisfiable and a not-the-origin caller refuses WITH an origin
present, which the committed case could not separate from "no origin exists". But a ROOT handler that READS
`msg.sender` cannot execute at all: a tautology over it fails at input 0 with `OP_SPLIT ... stack item length:
25; requested split index: 73`, one token from a passing control. It fails closed, but as a malformed-script
failure rather than a designed refusal.

### 4.38 SEC-8: the obvious repair does NOT close it, reported rather than shipped

Worker C reproduced the drain on its own fixture, confirmed the shared-frame mechanism, and **deliberately did
not apply Worker A's ablation** - keying on `transferInfos.length` alone would arm the flag for a
`{value:}`-option-only handler, which the frame grouping deliberately excludes because nothing settles those.
That is the caveat Worker A raised when offering the ablation as attribution rather than a fix.

It built the principled version instead - a per-handler `graphEffectSettlesTransfers` set only for frame members
- and reported that the drain was still ACCEPTED, concluding the dispatch-site flag write was not the only path.

**CORRECTED IN ROUND 12: that conclusion was wrong, and this board recorded it as fact.** Worker A measured the
cause: **C's fixture co-spent no container at all.** Giving the sibling an `emit` made the transfer-carrying
handler INELIGIBLE, because the `eventMode` gate drops any eligible handler with zero direct emits - so the
route reserved no `satoshiContainer` and no transfer slot. C's transaction had no container input, and its
`drain` only moved a change output. Its ACCEPTED was not evidence about the fix.

So C's decision to report rather than integrate was right, and its design was right - Worker A re-derived the
same `graphEffectSettlesTransfers` and credits it - but its conclusion was wrong, and Worker A's original
ablation was sound after all. A negative result needs its own control: C never checked that its fixture still
reserved the thing being drained.

The attempt is committed on a branch as `it.fails` so the drain stays visible, and the worker said explicitly:
**do not integrate it as a fix.** It was NOT merged. SEC-8 remains open, and the next step is to measure which
of `graphTransferFlagActive`, frame membership, or the epilogue's stack condition differs on this shape.

**SEC-9, from the same construction, is CLOSED in round 12 and was exploitable.** The eligibility gate does
require uniform event counts - but it counts **direct `emit` statements before lowering** while the frame
reservation counts `emitInfos` **after** it, so an emit reached through an internal call is invisible to it.
Measured: a spender minted a spurious own-category event NFT into a reached site's unverified second slot and it
was **ACCEPTED**. Now fails closed on divergent member counts, chosen over adding covenant surface for a shape no
capstone has. Its positive control is **the first VM settlement of an effect frame at width > 1**.

### 4.36 Round-11 review of S2, L1, L2: two real findings, and X28's own figure was stale

**L2 FINDING 1 - the derived gate is silenced by one optional field.** `deriveBalancedAssemblyFromInputs` reads
`inputs[cursor]?.unlocker?.abiFunction?.blockLayout`, but `abiFunction` lives on `ContractUnlocker`, NOT on the
base `Unlocker` that `TransactionBuilder.addInput` accepts. So an unlocker without it is a legal argument, not a
type violation. Rebuilding input 0's unlocker as a bare delegating object - transaction bytes asserted
byte-identical - makes the preflight return `undefined` and `sendPreflightedLayer3Transaction` **broadcast**,
where the honest control throws. That is the whole protection for that shape, since L2 itself records that the
BCH-2026 VM ACCEPTS the cloned event NFT. It directly contradicts the module's own comment calling it "a GATE
rather than a capability the caller may decline to use". The SDK builds bare `Unlocker` objects in ~17 places
today, none at a participant master - so this is a hostile-builder escape and a real fragility, not a live SDK
bug.

**L2 FINDING 2 - two documented checks are dead on the wired path.** The derived assembly returns
`auxiliaryInputs: []`, so both auxiliary checks never run when the gate is reached the way production reaches
it - including the one the module documents as covenant-required, and which really is present in both sidecars.
Measured with a projection slot output at 999 satoshis: the declared-layout call throws by name, the wired call
reports clean. The VM does still reject, but only after `build()` has taken every signature - which is exactly
the property L2's own test asserts the gate preserves.

**L1 CLEAN.** Its one hostile row without an asserted input index now has one (input 4, the first projection
slot), and relocation was extended from widths 1 and 2 to a 3-slot prefix, settling with state carried forward
and the stale-base attack still refused. The reviewer also chased and CLOSED the strongest structural
hypothesis: a transcript cannot declare a `blockSize` differing from the participant's layout, because
`__internal__graphBlockSize` is substituted as a compile-time constant rather than passed as a runtime argument.
The SDK still passes a `blockSize` argument codegen ignores - dead, not unsound.

**S2 FINDING - the guard is one AST level deep.** `touchesCollection` walks `fn.body` only and never descends
through a call, so moving the collection statement into a second internal callee - the sole difference from
S2's own fixture - silences the guard and restores `Block layout not available while compiling 'helper'`, the
exact internal error S2 was built to replace. Holds at two hops, for a bare read, and in message-bus mode.

**S2 UNDETERMINED - the boundary is dialect-dependent.** The same program is refused in `.scash` with and
without `solidityImportCompat`, and ADMITTED in Solidity syntax, with the state layout confirming the same
chunk-backed variable and the same collection in one handler. Which side is right is NOT established; no VM
settlement of the admitted form was run.

**X28 measured and BLOCKED, and its recorded figure was stale.** The -6.9% was computed against the pre-X24/X27
controller cost of 2,891,475; the absolute saving is unchanged but the denominator fell to 2,129,198, so the
same cut is now **-9.3% to -9.5%**. Two corrections to C3's own arithmetic: with one chunk the unused slots are
**63, not 62**, and the per-slot price is a floor rather than an estimate. The per-output term was re-fit
independently at exactly **32 instructions/output**, holding participant count, invocation count and transcript
length fixed - matching X25's three-point fit.

**But a smaller global constant is NOT the sound change.** The reservation is all-or-nothing and
`needsTrailingRegion` fires on seven distinct conditions that all collapse to 64; a blanket smaller value makes
any handler needing more than K trailing slots unsettleable - fail-closed, but SILENT at compile time, because
the count is a runtime property. The reviewer's handoff splits it: the loop-driven leg has a compile-time bound
already (that is why those lowerings unroll) and is the safe shippable half; the chunk leg has no static bound
and must keep a conservative default. It also priced the real cost of the change honestly - C3's post-Ledger
indices appear 41 times including six test NAMES.

### 4.35 SEC-8: X29's own repair introduced a satoshi-container theft

Found by Worker A reviewing X29, which it did not implement. **VM-settled and broadcast-accepted.** This is the
strongest argument in the whole effort for the rule that INTEGRATED is not PROVEN: X29 was a careful, measured
security repair whose author found and closed a hole it opened - and it still shipped a second one that only an
independent attacker found.

**Mechanism.** `planGraphEffectFrames` builds ONE `GraphEffectFrame` shared by every effect-carrying handler,
with `transferWidth = max(...)` across them. `GenerateTargetTraversal.ts:6273` writes the route-local reached
flag from that SHARED width. So dispatching an **emit-only** handler sets `GRAPH_TRANSFER_REACHED = 1`. Its
subroutine settles nothing, because that guard requires `pendingTransfers.length > 0`. And the route epilogue's
not-reached preservation guard is skipped, because the flag reads 1. The co-spent satoshi container then has
**no identity check and no value check at all**.

**Measured**, one row selecting an emit-only sibling, container 5,000 satoshis at input 2:

| `sibling` body | container output | result |
|---|---|---|
| `emit` + outgoing call | preserved 5,000 | ACCEPTED (honest control) |
| `emit` + outgoing call | **drained to 0** | **ACCEPTED, broadcast on chain** |
| `emit` only, no call | preserved 5,000 | ACCEPTED |
| `emit` only, no call | drained to 0 | REJECTS at input 0 |

The source control differs by exactly one line - deleting the outgoing call from the sibling's body - and the
route's block layout is identical. Attributed by ablation: adding `transferInfos.length > 0` to the flag
condition flips the drain from broadcast-accepted to a rejection at input 0, with all three controls unchanged.

**Blast radius, and a caution for future readers.** Worker A instrumented `planGraphEffectFrames` and found that
C1's Router and Notifier and C3's Sink all receive **no frame** - so this shape is absent from every shipped
capstone, and `Layer3EmissionEffectEscape` is the ONLY fixture that exercises X29's frame path at all. The 8
conditional event/transfer slots on C1 and C3 routes come from row reservation, not from `graphEffectFrame`;
**slot counts are not evidence that a route uses X29**.

**A named-unproven surface turned out to be unreachable, not merely unmeasured.** Frame width > 1 requires a
mid-chain participant owning two rows AND making an outgoing call per row. Measured with X29 entirely inactive:
one row ACCEPTED, two rows REJECTS at input 2, while a leaf owning two rows is ACCEPTED. So `site` is 0 in every
settleable bus graph, the `site * width` multiply is never exercised at runtime, and per-site frame separation
has zero VM evidence. That blocker predates X29 and is not charged against it.

**Three surfaces attacked clean**: SEC-7's drop condition held against seven shapes; branch-guarded emits and
transfers are properly guarded on both paths; and the site ordinal is a compile-time literal a caller cannot
influence.

### 4.2h Round-11 dispatch, base `d83f3795` - close the review gap

Section 4.34 records the real gap: only 4 rows are `PROVEN`, ~30 are `INTEGRATED`, and `INTEGRATED` means the
integration owner verified and merged it, not that anyone tried to break it. Round 11 is full cross-review, with
each reviewer assigned work it did not implement.

| Reviewer | Reviews | Also |
| --- | --- | --- |
| A | **X29, SEC-6, SEC-7** (C's) | - |
| B | **S2, L1, L2** (C's) | X28 measurement, BLOCKED on C's lease |
| C | **E2, E4, X23, X27** (B's) | first time C reviews B's work |

**X29 gets priority because it is the least-reviewed large change in the effort**: a security repair that
replaced a fail-closed refusal, landed in a single round, and whose own author found a hole it opened - moving
container settlement into the subroutine left the not-reached path unguarded, and a batch settled with the
container's satoshis taken. Each reviewer's brief lists the surfaces the AUTHOR named as unproven, because a
boundary someone was careful enough to draw is a boundary worth testing: frame width > 1 is compile-level only;
branch-guarded effects are unmeasured; the container conservation rule is now tighter than the flattened form
and may refuse batches it allowed.

Worker C is told to attack X23's equivalence CLAIMS rather than its performance, and is pointed at the evidence
limit X23's own author recorded - four hostile cases that refuse at the caller's route before the verifier is
reached, with three isolation attempts failed. Isolating it would close a gap the author could not.

All three briefs repeat that **a clean review is a real result**. One review in this effort found nothing and was
accepted as such; the risk of a reviewer inventing a finding to justify its round is real and worth naming.

### 4.34 State at the end of the parallel-work effort

Measured at this commit, not carried forward: **solidc 2,444 / 0** (59 files), **solidcash 3,951 / 0** (454
files, 4 skipped). The tree recovered from the deliberate SEC-6 red with the REPAIR integrated rather than the
capstones reduced.

**Capstones.** All three settle, and two of them now fit ORDINARY BCH-2026 capacity rather than only the relaxed
semantic profile: C1 (five participants after its SEC-6 reshape) and C3 (eight participants, 108 inputs, zero
over budget). C2 fits at <=0.82x. That was not the starting position - C1 was 2.07x over on first measurement.

**Security ledger.** Seven findings, all reached through a worker attacking another's work or disclosing a lead
it could not close: SEC-1 (conditional-edge state forgery), SEC-2 (caller-chosen implementation takeover,
deliberately warned rather than refused), SEC-3 (iterated-edge silent miscompile), SEC-4 (library sugar pinning
NOTHING - state rewritten with no delegate co-spent at all), SEC-5 (declared-returning-handler emission escape),
SEC-6 (effect-carrying emission escape), SEC-7 (spender-selectable token-container drop). Five closed by repair,
two fail closed by design.

**What is NOT claimed.** Only 4 rows are `PROVEN` - G1, S1, E1, C2 - each with a named reviewer who did not
implement it. Everything else is `INTEGRATED`, which means the integration owner verified and merged it, NOT
that anyone tried to break it. Roughly 20 X and SEC rows remain open. No `CONSENSUS_FIT` or `POLICY_FIT` claim
is made anywhere: the capacity results above are F1-style measurements against ordinary consensus knobs, with
dust disabled and no standard-policy or live-network evidence.

**Six integration-owner errors are recorded in this plan** rather than quietly fixed: a capacity figure wrong by
200x, a "fully green" claim covering three of six packages, calling a live exploit defence-in-depth, a
1,000-satoshi premise propagated into three briefs, a point-in-time suite result recorded as standing fact, and
a correction that was itself an unverified guess. Each was caught by a worker, which is the strongest single
piece of evidence that the adversarial structure did its job.

### 4.33 X29 lands: the repair beats the refusal, and the sequencing bet paid off

The bet recorded in 4.32 was to build the repair BEFORE reducing the capstones. It paid off.

X29 threads a per-call-site output frame from the route into the shared subroutine, so an effect-carrying
handler stays behind `OP_INVOKE` - keeping its emission binding - AND still produces its event and satoshi
transfer. Measured on one fixture with one variable:

| caller body | clone | emission recomputations | honest | argument sub | selector sub |
|---|---|---|---|---|---|
| effect-free | `OP_INVOKE` | 3 | SETTLES | REJECTS@0 | REJECTS@0 |
| emit, at `9bf3e5ea` | flattened | **0** | SETTLES | **SETTLED** | **SETTLED** |
| emit, with X29 | `OP_INVOKE` | 3 | SETTLES | REJECTS@0 | REJECTS@0 |
| transfer, with X29 | `OP_INVOKE` | 3 | SETTLES | REJECTS@0 | REJECTS@0 |

Two guard controls attack the PRESENCE of the effect - event output replaced by a plain funder, transfer paid
the wrong amount - so the repair is shown not to have re-introduced the silent-drop failure mode it replaced.

**It also shrinks what it fixes.** C1's real router goes 3,457 to **2,430 bytes (-29.7%)**, and block layouts are
byte-identical to the flattened form, which is why the capstone fixtures needed no wiring change. The controller
and projection verifier are byte-identical - X29 cannot reach them - so Worker B's 9,268/10,000 headroom is
untouched.

**Three self-corrections, all found by measurement, one of them a hole the fix itself opened.** Keeping EVERY
effect-carrying clone behind `OP_INVOKE` broke an edge-free `msg.value` batch; scoped to clones with an outgoing
call. Reserving frames after the route's own slots doubled an existing route's event slots; frames now share
base 0. And moving container settlement into the subroutine left the not-reached path unguarded - a batch
**settled with the container's satoshis taken**. Found, closed with a route-local reached flag, and attributed by
ablation.

**SEC-7 fails closed, and its stated cause was wrong twice - by its own author.** It is not "still a
`MethodCallStatement`", and the message bus was never the variable. The discriminator is whether the handler
also READS its container: without the read the route reserves no transfer slot and settles with no transfer, on
a plain hidden batch exactly as on the bus. It is exploitable rather than merely lossy because the same function
called DIRECTLY does enforce the transfer, the routed entry does not, and **the spender picks the entry**. The
guard is written on the drop condition rather than the spelling.

### 4.32 Round-10 dispatch: the tree is RED by design, and that is the sequencing

| Worker | Task | Note |
| --- | --- | --- |
| A | C3 reshape + C3-R2/R3 + X22 | notified mid-flight that SEC-6 changes its base |
| B | C1 reshape + C1-R1/R4 + X21, then X27 | also notified of the 9,268/10,000 headroom X24 consumed |
| C | **X29** then SEC-7 | build the repair SEC-6 fails closed in place of |

**26 SDK fixtures are red on purpose.** They are the emit-carrying shape measured forgeable. The integration
owner accepted that rather than holding a live-forgery refusal, and notified both workers already mid-flight on
those capstones instead of letting them finish against a base about to move under them.

**X29 is the sequencing bet.** C1 and C3 legitimately want an event NFT and a satoshi transfer alongside
outgoing calls - that is what a DeFi composition looks like. If X29 lands, both capstones reshape BACK to their
full form rather than being permanently reduced to fit a refusal. If it does not, they are reduced and the board
says so. Reducing them first and then discovering the repair was buildable would have been the expensive order.

**One constraint passed to Worker B that came from Worker C's own work:** X24 traded operation count for emitted
bytes and left the deployed projection verifier at **9,268 / 10,000**. B owns that covenant and is adding to it
in X27, so it was told to measure the deployed size and warned that crossing 10,000 would take C1 from fitting
ordinary capacity to failing on a SIZE limit - strictly worse than the density failure X23 fixed.

### 4.30 SEC-6 is a live forgery, refused rather than repaired - and it turns two capstones red

Worker C built the one-variable control that settles it. At `9bf3e5ea`, changing ONLY whether the caller's
handler carries an `emit` or `transfer`:

| caller body | graph clone | emission binding sites | honest | argument sub | selector sub |
|---|---|---|---|---|---|
| effect-free | behind `OP_INVOKE` | 4 | SETTLES | REJECTS @0 | REJECTS @0 |
| emit-carrying | flattened into `__scb1` | **0** | SETTLES | **SETTLED** | **SETTLED** |

Adding `msg.sender == hub` to every callee changed nothing. Both substitutions still settled.

**It reaches a capstone this board already integrated.** `C1Router.settle` measures **0** emission-binding sites
for its three outgoing edges, and deleting its `emit` + `transfer` restores 4. C1's seven hostile cases all
reject - but none of them attacks the caller's own emission row, which is the surface this opens. That is not a
defect in C1's matrix; it is a surface nobody knew existed until the one-variable control was built. **C2 is
NOT affected** - its fixtures carry no effects at all, verified, so its `PROVEN` promotion stands.

**Refused by name, not repaired, and the reason is measured.** Keeping the clone behind `OP_INVOKE` restores
binding - 0 to 32 sites - but then silently DROPS the effect: the honest graph settled with zero event slots and
no event output. Trading a forgeable edge for a silently dropped transfer is not a fix. The real repair needs a
per-call-site output index threaded from the route into the subroutine, opened as X29.

**This deliberately turns 26 fixtures red**: `Layer3DefiCapstoneC1` (11), `Layer3BoundedMaximumGraphC3` (11),
`Layer3CompiledGraphController` (4). Every one is the emit-carrying shape measured forgeable. The integration
owner accepted a temporarily red SDK tree because **a live forgery outranks a green suite**, and notified the
two workers already mid-flight on those capstones' CHANGES rather than letting them finish against a base that
was about to change under them.

**SEC-7 opened:** the token-container spelling `this.tokens[c].transfer(..)` does NOT reach the refusal - it is
still a `MethodCallStatement` at that pass, so the clone is never flattened and its edge stays bound - but its
route reserves no token slot either, i.e. the same silent-effect-drop shape from the other direction. Pinned by
the worker rather than claimed as covered.

### 4.31 X24 lands at -17.5%, and corrects the estimate that motivated it

X24 unrolls the deep stack-variable write. Measured run-to-completion, never on an aborted evaluation:
projection proofs **-17.5%**, root controller -11.3%, participant routes -12.0%, and a p2pkh control at exactly
**0** change.

**It is NOT the ~7x the earlier estimate suggested, and the worker said so directly.** That 84% figure was
measured on the PRE-rewrite covenant; after X23's own rewrite the remaining share is 17.5%. Fully accounted for:
8 deep replacements totalling 139 shuttled items, 139 x (22-3) x 100 = 264,100 predicted against 261,695
measured.

**The corpus number is again declared meaningless by its own author.** The 329-contract `.scash` corpus reports
0 changed - and instrumenting `emitReplace` shows **0 of 638 `.scash` files reach depth 14 at all**, so the
branch never fires. The discriminating corpus is real Solidity: 2 of 167 compiling `.sol` files, `Unicrow.sol`
(10 deep sites, 148 items, max depth 20) and `UnicrowClaim.sol`.

It buys operation count with emitted bytes: the projection verifier goes 9,002 to 9,268, inside the 10,000-byte
limit but with less headroom, while the root controller SHRANK. The counted-loop path is retained behind
`UNROLL_DEEP_REPLACE`, so the trade is one byte-exact line to revert.

### 4.29 FOUR ROWS PROMOTED TO PROVEN at `16979e0e`

The verifying run completed green across all six packages: utils 295/0, **solidc 2,434/0**, **solidcash
3,921/0**, testing 19/0, solidhat 24/0, `lerna success` in 6 packages.

It ran under the 63-process contention recorded in 4.28 and still passed - and that direction matters.
**Contention manufactures false FAILURES, not false passes.** A timeout under load can turn a good suite red; it
cannot turn a bad suite green. So the earlier deferral was over-cautious in the correct direction, and this
result is sound evidence rather than a compromised one.

Promoted, each with the reviewer who did not implement it:

| Row | Reviewer | What the review found | Resolution |
| --- | --- | --- | --- |
| **G1** | B | the guard-derived bound was escapable in three shapes, one VM-confirmed | closed by A, plus the inherited `TupleAssignmentNode` blind spot in a second pass |
| **S1** | A | the cardinality pin was suppressed whenever a collection owned more than one slot, and a read creates a slot | closed by C; a forged node was readable as genuine state |
| **E1** | C | the `possibleTargets` widening, and the never-exhausted projection result cursor | both closed by X7 - which turned out to be a LIVE root-result forgery, not defence in depth |
| **C2** | B | nothing; 12 added cases all reject | re-verified twice after SEC-5, empirically and structurally |

Each satisfies section 3.3 in full: a different worker attacked it, every finding was fixed and integrated, and
regressions are green on the exact commit.

**Still not promotable, and the distinction is load-bearing.** C1 and C3 sit in CHANGES. G2, G3, E2, E3, E4 and
every X and SEC row have had NO independent hostile review - `INTEGRATED` means the integration owner verified
and merged it, not that anyone tried to break it. Promoting those would make the headline number mean nothing,
which is precisely what this board exists to prevent.

### 4.28 Why PROVEN is still 2, and what is queued for promotion

A row count taken at round 9: **54 rows - 30 INTEGRATED, 17 TODO, 5 LEASED, 2 CHANGES, 2 PROVEN.** Both PROVEN
rows are P0.1 and P0.2, which predate this effort. Nine rounds, three capstones and five closed forgeries have
promoted nothing, and that is deliberate: section 3.3 makes `PROVEN` require an independent hostile review to
pass AND corrections to land AND regressions to be green.

**Queued for promotion once the tree is verifiably green, with the reviewer named:**

| Row | Reviewed by | Findings | Status of findings |
| --- | --- | --- | --- |
| G1 | B (did not implement it) | bound escape, three shapes | fixed by A, integrated |
| S1 | A (did not implement it) | multi-slot forgery escape | fixed by C, integrated |
| E1 | C (did not implement it) | `possibleTargets` widening, unexhausted cursor | both closed by X7 |
| C2 | B (did not implement it) | none - clean review | n/a; re-verified twice post-SEC-5 |

**Not promotable:** C1 and C3 are in CHANGES. G2, G3, E2, E3, E4, S1's siblings and every X row have had no
independent hostile review at all - INTEGRATED means the integration owner verified and merged it, not that
someone tried to break it.

**Deferred deliberately at round 9.** The verifying run was attempted while three workers were running their own
suites: 63 concurrent vitest processes, and the run did not progress past `solidc` in the time allowed. A suite
measured under that contention is exactly the condition that produced timeout-only failures earlier in this
effort, and it is not a sound basis for a claim that outlives the session. The promotion waits for a quiet tree.

### 4.27 A1 review of C1 and C3: no escape found, four real findings, one correcting this plan

Worker A reviewed the two capstones it did not build, added 26 hostile cases - 17 transcript fields neither
capstone reaches, the root caller row, and 8 preservation properties - and **every one rejects**. No escape was
found. A states plainly that this is evidence the fields are bound, not proof they are bound correctly for
shapes it did not build.

**BOTH-R1 corrects a premise the integration owner wrote into several briefs.** The 1,000-satoshi slot value is
NOT purely an SDK assembly convention. Both generated covenants carry
`require(tx.outputs[this.activeInputIndex].value == 1000)` - verified by the owner at `graph.ts:580` and `:786` -
so paying 1,200 satoshis at a projection slot is refused by the projection verifier and at the controller slot by
the controller. It is an SDK convention for **event, transfer and funding slots only**, not for the two sidecar
slot kinds. Neither capstone asserted it as authenticated, so nothing is over-claimed downstream - but the
premise itself was too broad, and it was repeated in three worker briefs. Directly relevant to open task X21.

**C1-R1 (documentation).** C1's fixture comment claims every other byte of a hostile build is identical to its
control. That is false: two HONEST builds of the same length differ in 15,158 of 101,714 hex characters, because
the builders draw fresh outpoints and mint fresh categories per call. The assertion the test actually makes -
equal serialized length - is sound, and supports the weaker claim this plan recorded ("no input, output or
witness was added or removed"). The in-file comment overclaims and needs correcting.

**C1-R4 (under-claim, conservative direction).** C1 states the return-event position is covenant-unbound. It is
not: the controller binds it to block membership, strict monotonicity across participants, and the committed
result commitment. Moving the return output to another output INSIDE the same block is refused at the
controller. C1 under-claims its own authentication.

**C3-R2 (evidence gap).** C3's `duplicate-owner` case does not test owner uniqueness. Worker A ran the control:
an identical-shape edit installing a STRANGER script belonging to no participant - so all owners stay distinct -
is refused at the same input by the same covenant with the same failure class. The duplication contributes
nothing; the refusal is caused by a row naming a locking bytecode other than the one co-spent at that base,
which is the invariant the omission case already attacks. A confirmed the mechanism: **neither generated covenant
ever compares two participant rows.** Owner uniqueness is enforced only by `planCompiledGraph` in the SDK.

**C3-R3 (scope note wrong).** C3 says stripping the leftover emission row is the omission case. Measured, it is
not: re-rooting the edge AND stripping the caller's emission row refuses at the caller's own master route, a
different covenant and a different input from the 3-byte version. The stricter attacker is a distinct,
uncovered case.

C1's substantive claims all verify, including X23's ordinary-capacity result reproduced independently
run-to-completion to four decimals.

### 4.25 X25 answers the scaling question, and moves the blocker off the projection entirely

Worker B re-measured C3 run-to-completion on the post-X23 tree. Three recorded facts were wrong.

**The blocker is the CONTROLLER, not the projection.** True ratios against the ordinary 800/byte budget:

| input | role | ratio |
|---|---|---|
| 8 participant masters | 2,905-4,787 bytes | 0.337-0.506 |
| 8 projections | 5,880 bytes | 0.681-0.689 |
| **106 controller** | 2,940 bytes | **1.2286** |

C3 misses ordinary capacity **by one input**, and 18.6% has to come off the controller and nothing else. The
aborted reading said "1,029 over, 0.04%" - the artifact again, on a different input from the one the test named.

**The recorded 8,412-byte projection input was pre-X23.** It is 5,880, and 8,412 - 5,880 is exactly the 2,532
bytes X23 removed - an independent cross-check that X23's saving landed where it claimed.

**Scaling is answered, and C3's own hypothesis is measured false.** The projection verifier is a pure function of
(participants, invocations): C1 and C2 are both 4/5 with different compositions and transcripts of 1,141 against
743 bytes, and their projections evaluate to a **byte-identical 17,259 instructions**, with the returning
participant's row at 17,584 in both, and the +325 returning-row surcharge identical across all three capstones.
Transcript length does not enter at all. The controller is that plus **exactly 32 instructions per transaction
output** - a three-point fit at 35, 79 and 108 slots. C3's reading that widening buys budget as fast as it
spends it is false: budget base grows 3.3% and 6.8% while cost grows 56.2% and 80.6%.

Participant count and invocation count still cannot be separated - they move together in all three builds.

**Two costed levers, neither implemented.** A destructive left-to-right walk in `attest` gives -17.3%, which is
1.3 points short on its own. Shrinking the Ledger's 64-slot trailing region to what one chunk actually needs
gives -6.9% - which prices C3's own structural finding about `BALANCED_TRAILING_CAPACITY`. Together -24.2%,
about 0.93x. That constant is in Worker C's lease, so Worker B correctly reported it as BLOCKED rather than
reaching for it.

### 4.26 A1 review of C2: CLEAN, and the SEC-5 question answered twice

Worker B reviewed C2, which it did not build, reproduced 11/11 from committed fixtures before touching anything,
and added 12 cases against fields C2 had not attacked - table over-run and under-run, participant master,
projection slot, return-event output, master capability, satoshi value, token category, owning locking bytecode.
**All reject. No defect found in C2.**

The independence claim turned out stronger than its label: the target and selector attacks come from **opposite
sides** - `target` moves the persisted table and keeps the transcript honest, `selector` moves the transcript and
keeps the persisted table honest.

**SEC-5 was re-checked two ways**, because C2 was built while that escape was live and deliberately uses a
pointer table. Empirically all 11 original cases still reject at the same inputs post-fix. Structurally,
`synthesizeBatchBeforeLowering` is false for C2's hub, so it takes the late path and `InlineStoragePointerCalls`
never flattened it - SEC-5's bug never applied. And logically the escape could only have made hostile cases
ACCEPT, while C2's results are rejections.

**C2 fits ordinary BCH-2026 capacity**, every input at or below 0.82x, so its SEMANTIC-only label is conservative
rather than forced. C2 carried no capacity measurement before; it does now.

Two observations recorded as facts rather than defects: the return-output binding is enforced by the CONTROLLER,
not by the participant that produces the result; and the projection covenant validates the declared proof region
as a whole, so moving participant 3's slot rejects at projection 0 rather than at the moved slot.

### 4.24 SEC-5 closed for effect-free handlers - and the worker's own hypothesis was wrong

Worker A's starting hypothesis, which it had correctly labelled a starting point rather than a diagnosis, was
that `resultMode`'s unrolled parser was the cause. **It was wrong**, and five instrumented measurements settled
it rather than argument:

`synthesizeBatchBeforeLowering` carries `|| fn.returnTypes.length > 0`, so merely DECLARING a returning handler
flips route synthesis from the late site to the early one. The emission-handler clone therefore already exists
when `InlineStoragePointerCalls` runs - and that pass **flattens it into the route wrapper**. Flattened, the
external calls are generated with `__scb1` as the current function, which is not a `graphEmissionHandler`, so
`visitExternalFunctionCall` takes the ordinary-call path and no emission row is ever recomputed or compared.

The decisive detail: `InlineExternalCallHelpers` and `InlineReturningStateHelpers` both already carry exactly
this guard, with exactly this rationale in their comments. `InlineStoragePointerCalls` did not. The bug was a
missing instance of a guard the codebase had already written twice.

All five characterization cells now reject at **input 0**, asserted explicitly rather than by a bare throw, with
the guard negative control run twice - once against an unscoped fix, once against the final one.

**The scoping is measured, not assumed.** The first unscoped version turned an existing route's 8 transfer slots
into 0, because a transfer/event/token-container operation reserves an owner-local slot that only the flattened
form declares. The guard excludes those - the same line `synthesizeBatchBeforeLowering`'s own comment draws.

**SEC-6, opened rather than folded in.** A graph emission handler that ALSO performs a transfer, emit or
token-container operation is **still flattened and still generates unbound edges**. Measured at codegen level:
emission-binding sites are 0 both at baseline and after the fix, while the effect-free shape goes 0 -> 16. It is
pre-existing and unchanged, and the worker refused to let SEC-5's claim cover it.

**Corpus discipline, now fully established.** The 867-file general corpus reports 0 changed - and the worker
states it has **zero discriminating power** here and explains why: none of those files compiles with a message
bus controller, so `graphEmissionHandler` is never set and the guard can never fire. The number that means
something is a purpose-built 14-case bus-mode corpus, where SEC-5 changed 3 of 14, all effect-free
graph-emission shapes.

**X26, reported and BLOCKED:** a bare `m[k]` READ contributes nothing to `analyseFunctionFootprint`, because
`ArrayAccessNode` carries `array`/`index` rather than `name`/`keys`. A handler whose only collection access is a
bare read never enters the collection-eligibility branch. Whether that is sound or merely fail-open is
UNDETERMINED, and the worker said so instead of guessing.

### 4.23 C3 lands, and its capacity figure inherits the artifact X23 exposed

C3 settles: eight independently compiled types, eight blocks, **108 balanced slots**, one transaction, all eight
post-states read back off chain. Five hostile cases - injection, injection-with-burned-NFTs, omission,
duplicate-owner, disjoint-root - each pinned to an input index, each with an honest control that is preflighted
AND settled first. The two transcript patches are verified intra-build by byte index (3 bytes for disjoint-root;
all inside row 7's 35-byte frame for duplicate-owner), and the worker notes cross-build byte comparison is
meaningless here because every build mints fresh categories.

**Scoped honestly by the worker: C3 saturates the PARTICIPANT bound only** - 8 of 8 participants, but 8 of 24
invocations and depth 4 of 7. It is not evidence about the other two ceilings.

**Its capacity figure is not usable, and the reason is section 4.22.** C3 was built on `c7ee8ea9`, before X23
landed, and reports missing ordinary capacity by "70 operations, 0.00104%" at input 98. That is the same
abort-semantics artifact: a reported cost is always within one operation of the budget however much evaluation
remained. Its companion observation - that C3 "misses by less than C1, 70 against 626, despite being wider" -
therefore compares two artifacts and means nothing. The worker already declined to call it a scaling law and
asked for an F1 measurement, which was the right instinct on numbers that turned out to be unusable.

**CORRECTION (X25 and A1), and the first version of this correction was itself wrong.** The integration owner
wrote that C3 "still passes 11/11" after X23. It did not: the capacity test asserts a refusal at input 98 while
the tree refuses at input 106. Worker B found it during the review round and fixed the test.

The owner's first correction then guessed at a cause - that SEC-5 had moved the failing input afterwards. Worker
A measured it instead and **pinned the same failure, with byte-identical numbers, at C3's own integration
commit**. So the test was RED when C3 was marked INTEGRATED, and the SEC-5 explanation was an unverified guess
layered on top of an unverified claim.

Two lessons, both earned rather than asserted: a point-in-time measurement is not a standing claim, and a
correction is not exempt from needing evidence.

**Two structural findings worth carrying into the F phase.** The projection input is 8,412 bytes, under the
10,000-byte limit, so input size is not the blocker at eight wide either - density is, again. And
`BALANCED_TRAILING_CAPACITY = 64` dominates the layout: one dynamic-storage participant contributes 66 of the 98
participant slots for a SINGLE chunk UTXO, and a second such participant would cost another 64.

**A gate-precedence issue the worker disclosed:** for the token-preserving injection,
`preflightLayer3Transaction` never reaches the VM - the structural block-assembly gate refuses first and names
an OUTPUT, not an input. The worker added a burned-NFT variant specifically so the covenant refusal could be
pinned to an input, rather than quietly reporting an output index as if it were one.

C3 also deliberately uses no pointer table anywhere, so **no C3 claim depends on SEC-5**, which is still live.

### 4.22 X23 CLOSED - and the number in 4.20 was wrong by 200x

**Correction first, because the integration owner recorded the bad number prominently.** Section 4.20 recorded
C1 as failing ordinary capacity by "0.0095%" and called that the highest-value optimisation target. That figure
was an artifact of libauth's abort semantics: the density check runs after EVERY operation, so the reported cost
is always within one operation of the budget no matter how much evaluation remained. Run to completion against a
relaxed budget, input 29 actually needed **13,588,248 - 2.07x the budget**. And it was never one input: all five
Layer-3 sidecars were over, at 2.07 / 1.85 / 1.85 / 1.75x, with the controller worst at **2.28x**. The real ask
was 52-56% off, not 0.0095%.

Anyone reading a near-miss figure off an aborted evaluation is reading the budget back, not the cost. That
applies to every future capacity measurement on this board.

**Result: C1 now settles under ORDINARY BCH-2026 capacity** - 10,000-byte inputs, 128-byte commitments, 800
cost/byte - proven by running C1's own measurement, not by argument.

| input | ratio before | ratio after |
|---|---|---|
| 29 projection p0 | 2.0653 | **0.4556** |
| 30 / 31 / 32 | 1.8490 / 1.8475 / 1.7549 | **0.4514 / 0.4510 / 0.4567** |
| 33 controller | 2.2800 | **0.7268** |

Projection verifier **7,033 -> 4,501 bytes** (-36.0%), controller **1,897 -> 1,504** (-20.7%). Both re-pinned in
the completion ledger by the integration owner; the worker correctly declined to edit it.

**Root cause, measured with an opcode and IP histogram rather than guessed.** 95.8% of the cost was
`evaluatedInstructionCount x 100`, and it traced to ONE lowering: a write to a stack variable at depth N costs
about 22N instructions, via a two-`OP_BEGIN` altstack shuttle. 4,988 items shuttled across 362 writes at mean
depth 13.8 - roughly 84% of all instructions. Cursor-heavy parser loops are the worst possible shape for it.

**X24, opened, and it is much larger than X23 was.** That depth is a COMPILE-TIME CONSTANT - it is pushed as a
literal - yet the compiler emits a dynamic ~22N loop where the unrolled `N x (OP_SWAP OP_TOALTSTACK)` then
`N x OP_FROMALTSTACK` is 3N. That is roughly a 7x cut on every variable write in EVERY contract, not just these
two covenants. It sits in `GenerateTargetTraversal.ts`, Worker C's lease.

**One guard was strengthened, not just preserved:** `require(callee < participantCount)` now runs locally, where
the old 8-way chain only reverted at `callee >= 8`, leaving a callee in `[participantCount, 8)` setting a bit
nothing checked. Not exploitable - the controller enforced it - but now enforced where it is used.

**Evidence limit the worker recorded rather than claimed away.** Its four new hostile cases all refuse at input
0, the caller's own master route, so the verifier is never reached. Because that route binds the whole emissions
region including the transcript's copy, the verifier's comparison is structurally a SECOND binding in that
fixture and cannot be isolated from it. So the four cases are system-level evidence that the rewrite opened no
hole - they are NOT evidence about the rewritten comparison alone. Three fixture variants were tried to isolate
it and all failed, and the test says so.

The X7 `resultCursor` assertion is untouched and verbatim, and was never the cost - one comparison outside both
loops. Region pinning at `expectedParticipantInput = 0` is intact.

### 4.21 SEC-5: a pointer-table caller stops authenticating its own emission rows

Found by Worker A while building C2, and reported separately rather than folded into the capstone.

A runtime-sized pointer-table caller **stops binding its own emission rows as soon as its contract declares any
returning public handler** - declared, never invoked. Target and argument substitutions then settle.

| dispatch | returning handler declared | caller rows | target sub | argument sub |
|---|---|---|---|---|
| pointer table | no | 1 and 2 | REJECTS | REJECTS |
| pointer table | yes (pure or state-writing) | 1 and 2 | **ACCEPTED** | **ACCEPTED** |
| ordinary `IFoo(x).bar()` | yes | 1 and 2 | n/a | REJECTS |

This lets a graph author redirect a compiled contract's outgoing calls to any co-spent participant with any
arguments. It is measured one variable at a time, with an honest control that settles in every configuration
and an ordinary-callsite control that stays bound in the same configuration - so the escape is attributable to
the pointer-table path plus a declared returning handler, not to the harness.

Committed as a CHARACTERIZATION test: the accepting cells assert measured behaviour and are labelled forgeries,
so a repair turns the file red rather than silently passing. Starting point, explicitly not a diagnosis: a
returning handler switches the SCB1 route to the unrolled per-row parser.

**Worker A also corrected its own earlier evidence.** Its first bisect appeared to show the escape additionally
required two caller rows. It does not - that fixture assembled some cells against the wrong physical block
layout, so three of its four "rejections" were artifacts. The controlled harness supersedes it, and the
correction was volunteered.

### 4.20 C1 settles - and the measurement that matters is where it does NOT fit

C1 settles as one transaction: 35 inputs, 35 outputs, four independently compiled participants, layout
`[0,19,24,26]` gapless from input 0 as L1's pinned region requires. Every post-state is read back off the chain
against numbers the test states independently - `balances` 100 to 70/10/20, `allowance` 50 to 20, Bento
`(12,9)` to `(42,31)`, Kashi collateral 5 to 27 using the SHARE returned rather than the amount deposited.

Seven hostile cases, each refused by the covenant that OWNS the field and never by the controller, and each
attacked build is **the same serialized length as its control** - so no input, output or witness was added or
removed to produce the rejection. That control is what makes the matrix mean something.

**RETRACTED FIGURE - see section 4.22.** The "0.0095% over" below is an ARTIFACT of libauth aborting the moment
the density check trips, so the reported cost is always within one operation of the budget however much
evaluation remained. The true overrun was **2.07x**, and all five sidecars were over. C1 has since been brought
under ordinary capacity by task X23. The original text is kept below only so the error is auditable; do not
quote the percentage.

**Under ordinary BCH-2026 capacity C1 does NOT fit, and the blocker is not what anyone assumed.** It fails at
input 29, the first graph projection proof, on operation-cost density: a budget of 6,579,200 for 8,224 density
bytes, overrun to 6,579,826. That is **0.0095% over** [RETRACTED - artifact]. Participant scripts are comfortably inside the ordinary
10,000-byte input limit - Router 4,843 bytes, Token 7,058. So the thing standing between this composition and
ordinary consensus capacity is the PROJECTION VERIFIER's density, by a hair, and nothing else. Opened as X23;
it is the highest-value single optimisation target this effort has produced, and it arrives before F1 rather
than after.

**A new gap, reported rather than endorsed (X22).** A handler that consumes a result AND carries an effect
fails with the internal `Unbound return call in __scb1; graph=undefined` - no named refusal and no diagnostic
channel entry. Same family as X15, on a shape X15's fix does not reach.

**And a correction to X3's framing.** The refusal a result-consuming handler hits is
`requires call/staticcall edges and at most one returning call`, which is broader than fan-in: it rejects a
result consumer alongside ANY second edge, not merely a second producer. X3 should be read as that wider
restriction.

C1's continuation claim is scoped by the worker rather than by me: it proves a result-dependent STATE
TRANSITION, not a result-dependent onward CALL, because that shape is one of the four pinned refusals.

### 4.19 X17 DECIDED: do not gate `StatefulTransactionBuilder.send()`

Worker B measured that turning the balanced-assembly gate on would reject **1,014 of 2,278 describable stateful
sends (44.5%) that settle today**, across 628 `unbalanced transaction`, 378 `token outside every participant
block`, and 8 satoshi-value mismatches - including that SolidCash emits event NFTs at **1200** satoshis where
the model specifies 1000.

**Decision: do not gate it, and do not adjust the numbers until the model earns them.**

The reasoning is that a gate rejecting 44% of legitimate settling work is not a strict gate, it is a wrong
model. The failures are concentrated in shapes the balanced-block model was never built to describe - entry and
auxiliary inputs are not blocks, which is the direct source of the 378 token-outside-region rejections - and in
one plain contradiction, where the SDK's own event NFTs are 1200 satoshis and the model asserts 1000. Shipping
the gate would convert a modelling gap into user-visible breakage and would teach everyone to bypass the gate.

The alternative of relaxing the gate until it accepts today's sends is worse: it would produce a check that
passes everything and proves nothing, which is exactly the failure mode this board has been catching in other
workers' claims all effort.

So the gate stays where Worker B put it - a real gate on the layer-3 path, where the model does describe the
shapes - and stays off the general stateful path. Two follow-ups are opened rather than left implicit:

- **X20**: widen the assembly model to describe entry and auxiliary inputs, then re-measure the 44.5%.
- **X21**: reconcile the 1200-satoshi event NFT against the model's 1000. One of the two numbers is wrong and
  the board should say which; today it simply asserts both.

Recorded so nobody later reads L2's checklist line "SDK preflight rejects malformed or unbalanced blocks before
signing" as covering the stateful path. It does not, deliberately.

### 4.18 SEC-4 confirmed, and worse than the lead described

Worker C disclosed this lead at the end of the previous round without chasing it. It was right, and the reality
was worse: `pinsDelegateCoSpend` is FALSE for a pure `L.f()` function AND the emitted covenant pinned
**nothing** - no delegate identity, no selector, and no state covenant either, because the per-function
`!functionHasDelegatecall` gate still fired.

Measured on the BCH-2026 VM, baseline to fixed:

| co-spent at the delegate slot | settled | baseline | fixed |
|---|---|---|---|
| the real linked library | 1 | ACCEPTED | ACCEPTED |
| a HOSTILE library, same layout and same selector | 999 | **ACCEPTED** | REJECTED input 0 |
| **nothing at all** | 999 | **ACCEPTED** | REJECTED input 0 |
| 2-function library, `wipe` substituted for `increment` | 0 | - | REJECTED input 0 |

A spender rewrote a consumer's state with **no delegate co-spent at all**.

Root cause: `L.f()` desugars to a node marked `synthesizedFromLibraryCall`, and every C1 rule keyed off
`hasExplicitDelegatecall`, which excludes exactly that node - so the pin, self-write and reachability rules all
skipped it, while codegen read `lowLevelCalls` rather than the AST predicate and skipped the state covenant. The
same flag is set by the split-facet forwarder, so **the hole covered two shipped features**, not one.

The fix derives the delegate input index from the function's own reserved `lowLevelCall` block slot rather than
a witness, so it is not caller-chosen, and emits the selector half only when the library has two or more public
functions. Three previously-compiling shapes are now rejected: `L.f()` beside a state write, `L.f()` in a loop,
and `L.f()` from a non-entry-point.

**The corpus caveat is stronger than last round and the worker said so first.** 656 files, 0 changed - but the
corpus contains ZERO `L.f()` consumers and zero split roots, and its one delegatecall file uses the explicit
form. **Discriminating power for this change: zero files.** The real evidence is the suites and the matrix above.

**X16: the worker caught its own false positive before reporting it.** It first measured that graph mode had
LOST the SEC-1 covenant. That was a measurement artifact - a message-bus artifact publishes bodies as hex in
`functionBodies`, and a split root outlines bodies into `OP_DEFINE`d spans pushed as data, so an ASM grep of
`artifact.bytecode` returns a false negative for both. Decoding showed the covenant present. The exclusion is
therefore NOT falsified, but the evidence is compile-level: no VM-level forgery was attempted against a live
graph-controller transaction with a conditional delegate row, and that stays open.

### 4.16 FULL REPOSITORY GREEN - all six packages, measured in one run

| Package | Result |
|---|---|
| `@solidcash/utils` | 295 passed |
| `solidc` | **2,417 passed / 0 failed** |
| `solidcash` | **3,809 passed / 0 failed** (448 files, 4 skipped) |
| `@solidcash/testing` | 19 passed |
| `@solidcash/solidhat` | 24 passed |
| `@solidcash/create-solidhat` | no tests |

This is the first genuinely complete green run. Every earlier "fully green" figure in this document covered
`solidc` and `solidcash` only - three of six workspaces - because `yarn test` HALTS at the first failing package
and never reached the rest. The integration owner was reporting a partial number as a total until Worker B's
packet mentioned a package outside that set.

`packages/solidc/vitest.config.ts` now sets `testTimeout: 30_000`. Nine failures in the previous full run were
`Test timed out in 5000ms` with zero assertion failures, each passing in isolation; Worker A independently
measured ten such failures at load average 29, where the same file took 168s against a usual 54s. A suite that
is red only from timeouts cannot serve as a regression gate, because a real failure is indistinguishable from
load. 30s still fails a genuine hang.

### 4.17 Two cross-worker catches worth keeping

**Worker A caught Worker B asserting a class it never verified.** B's X6 module lists an unconditional
option-free void `target.call(payload)` as ADMITTED. It compiles on the direct route - but on the bus route it
leaks `Block slot not found: lowLevelCall[0]`. A verified the leak is pre-existing by reverting the wiring and
rebuilding, and named the failure mode precisely: the module asserted ADMITTED without asking whether the
compiler admits it, which is board section 4.12's lesson in a different file. Pinned `OPEN:` rather than left
inside an unqualified claim, and BLOCKED on Worker C's lease. Recorded as X18.

**Worker A caught its own probes being misleading, and found a real divergence doing it.** `balances[who] = x`
and `this.balances[who] = x` produce a BYTE-IDENTICAL direct-route artifact with an identical ABI, yet on the bus
route the dotted form compiles to a route while the bare form throws. Add a read-modify-write and the two
spellings diverge on the DIRECT route too, one publishing `read` where the other publishes `write`. A's original
X15 probes used the bare spelling and were misleading until it caught this. Recorded as X19.

X15 itself is closed by refusal, not admission: `synthesizeHiddenBatchRoute` computed a stable reason for every
entry point but published reasons only through `hiddenBatch.handlers`, an object never built when every handler
is rejected - so the absence was observable and the reason was not. It now names each entry point, its reason,
and a remedy.

### 4.15 X14 stops at a decision the integration owner has to make

The preflight is now a real gate on the layer-3 path: `deriveBalancedAssemblyFromInputs` reads the block set off
an unsigned builder rather than from a caller-supplied layout, so no cooperation is needed, and it runs
unconditionally as the first statement of both `preflightLayer3Transaction` and
`sendPreflightedLayer3Transaction`. Proven on the production path, not a harness: a malformed assembly is
rejected with `signatureRequests.count === 0`, against an honest control differing only in the attacked field.

**It was deliberately NOT wired into `StatefulTransactionBuilder.send()`, and the reason is measured rather than
argued.** Worker B instrumented `send()` and ran the whole SDK suite - 2,413 stateful sends:

| outcome | count |
|---|---|
| gate would accept | 1,264 |
| **gate would REJECT a send that settles today** | **1,014 of 2,278 describable (44.5%)** |
| model cannot describe, skipped | 135 |

Categories: 628 `unbalanced transaction`, 378 `output carries a token outside every participant block`, 5 a
`returnEvent` satoshi-value mismatch, 3 the same for `event` - SolidCash emits event NFTs at **1200** satoshis
while the model specifies 1000.

So the balanced-block model does not describe most of what the stateful SDK legitimately builds today. Turning
the gate on would break roughly 44 percent of settling sends. That is a product decision, not a worker's, and it
is recorded as X17 rather than taken silently in either direction. The instrumentation was reverted before
staging.

**A second honest limit:** after X13 the direct route's own external-call transactions are UNDESCRIBABLE by this
model rather than accepted by it - the measured shapes leave no slot outside the participant region for the
model's mandatory fee/change tail. X13 balanced the blocks; it did not bring the direct route inside the model.

**And X13 is an assembler correction, not a security fix.** The return-event position is still covenant-UNBOUND:
the covenant constrains commitment, category, capability, FT amount, bytecode and value, never the index. Worker
B proved it rather than asserting it - the SAME unmodified covenants accepted output 6 before the change and
output 4 after. A hostile assembler can still splice the event elsewhere.

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

### 4.2g Round-8 dispatch, base `9bf3e5ea` - the review round

| Worker | Task | Reviews |
| --- | --- | --- |
| A | **A1** hostile review | C1 (B's) and C3 (C's) - NOT its own C2 |
| B | **A1** hostile review + X25 | C2 (A's) - NOT its own C1 |
| C | **SEC-6**, then X24 | none - security takes priority over review |

Plan section 8 requires the reviewer not be the implementer, so the capstone reviews are split by authorship: A
built C2, B built C1, C built C3, and no worker reviews its own.

Each review brief lists the specific claims the AUTHOR already scoped, because that is where a reviewer is most
likely to find something - a claim someone was careful enough to bound is a claim that has a boundary worth
testing. Both briefs state explicitly that **a clean review is a real result** and that manufacturing a finding
to justify the round is not wanted.

Worker B is also told that C2 was built BEFORE SEC-5 was fixed and deliberately uses a pointer table, so its
hostile cases must be re-verified on the post-SEC-5 tree - a capstone that passed while the escape was live is
exactly the thing to re-check.

Worker C is corrected on its own C3 capacity figure before starting, so it does not carry the artifact forward.

### 4.2f Round-7 dispatch, base `c7ee8ea9`

| Worker | Task | Lease |
| --- | --- | --- |
| A | **SEC-5** - fix the emission-binding escape it found | `compiler.ts` + `artifact.ts`; also X19's remaining half at `compiler.ts:469` |
| B | **X23** - reduce projection-verifier density | `packages/solidcash/src/**` |
| C | **C3** - the eight-participant capstone | none; a capstone should need no source change |

Each brief carries the constraints the OTHER workers measured, so a capstone cannot quietly assume a property
that does not hold and a fix cannot rediscover a settled fact. C3's brief states in advance that it will NOT fit
ordinary capacity and that this is expected rather than a failure, so the worker measures the figure instead of
treating it as a defect - and it warns that SEC-5 is live and unfixed, so C3 must not build a claim that
silently depends on emission binding holding for a pointer table.

B's brief carries one explicit prohibition: the `require(resultCursor == resultVector.length)` assertion closed
a LIVE root-result forgery, so it may not be removed to save operations. An optimisation that weakens
authentication is a rejection, not an optimisation.

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
