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
| **SEC-12** | `hasSignatureGuard` suppresses SEC-2 and C1 at two sites | — | E3 | **TODO (security)** | matches any `checkSig` without asking whose key; both suppressions measured |
| X37 | Publish delegate target/key provenance in the artifact | — | E3 | TODO | `lowLevelCalls` stripped to `callMode`; AST already carries `dataParamIndex` |
| E4 | Context/outState matrix and rejection policy | B | P0.1 | INTEGRATED | 25 values classified; one row honestly incomplete |
| S1 | Mapping insertion/deletion journal transitions | C | P0.1 | **PROVEN** | reviewed by A (forgery escape), fixed by C, regressions green - see 4.29 |
| S2 | Mixed scalar/collection/dynamic journals | C | S1 | **PROVEN** | `d0bbdf76`; scalar+collection proven, dynamic leg FAIL_CLOSED |
| S3 | Dynamic arrays/chunks across multiple handlers | C | S2 | TODO | Bounds and alias cases |
| L1 | Fully relocatable balanced participant block | C | P0.1 | **PROVEN** | blocks relocate relative to each other; the REGION is pinned to input 0 - see 4.10 |
| L2 | SDK funding/change/event-NFT block assembly | C | L1 | **PROVEN** | preflight is a capability, not a wired gate; 2 criteria SDK-only |
| C1 | DeFi integrated semantic capstone | B | G2,E2,S2,L2 | CHANGES (round 9) | B correcting C1-R1 and C1-R4 in its own file |
| C2 | Heterogeneous A→B→A dynamic dispatch capstone | A | G2,E1,S3,L2 | **PROVEN** | reviewed by B, clean, re-verified twice post-SEC-5 - see 4.29 |
| C3 | Eight-participant semantic capstone | C | C1,C2 | CHANGES (round 9) | test fixed by B; A correcting C3-R2, C3-R3 and the blocker attribution |
| X25 | Re-measure C3 capacity run-to-completion, post-X23 | B | X23,C3 | **SUPERSEDED - table stale in all 10 rows** | controller measured **0.9217x**, over-budget set EMPTY; see 4.48 |
| X38 | Correct the stale capacity comments in the C1 and C3 fixtures | — | X25 | **TODO** | 3rd occurrence; C1's is wrong in SIGN, C3's in all 10 rows, one quantity stated twice (24,067 vs 25,984) |
| X39 | C3 serializes to 100,354 B - 354 over the 100,000 B standard relay ceiling | — | X25 | **TODO** | ordinary-capacity fit and relayability are now measurably different claims; blocks any POLICY_FIT for C3 |
| X40 | Stop citing the C1/C3 reshapes as what closes SEC-6 | — | R2-F3 | **TODO** | flattened-caller shape is UNREACHABLE at HEAD; reshapes redundant with a compiler invariant, not load-bearing |
| X27 | Suffix-split the transcript in `attest` | B | X25 | **PROVEN** | round 9, after C1 CHANGES and X21 |
| X28 | Right-size `BALANCED_TRAILING_CAPACITY` per chunk need | — | X25 | TODO | costed at -6.9%; with X27 reaches ~0.93x |
| A1 | Independent in-repository hostile review | A+B | C1,C2,C3 | INTEGRATED | 38 hostile cases across three capstones, all reject; 4 findings on C1/C3, C2 clean |
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
| X6 | Stable diagnostics for unadmitted low-level shapes | A (wiring) | E2 | INTEGRATED | 8 shapes named, incl. one in a modifier body; ONE admitted-class leak remains |
| X7 | Assert the projection result cursor is exhausted | B | E1 | INTEGRATED | Closed a LIVE root-result forgery, not defence-in-depth |
| X8 | Two chunk-backed dynamic writes plus a collection write | C | S2 | INTEGRATED | NOT a silent miscompile; settles, fails closed past 1 chunk |
| X9 | Resolve G1-C compile-cost fragility in `HiddenBatch` | A | G1 | INTEGRATED | Lazy mutation analysis; 56.6s -> 35.7s, below pre-G1 |
| X10 | Grow the trailing chunk region past one output beside an entry mint | C | X8 | TODO | Blocks multi-chunk dynamic + collection mint |
| X11 | Delegate C2 sorted writes have no settling instance | C | S1 | TODO | S1's delegate exclusion guards an unreachable shape, unattacked |
| X12 | `emit`-funder delegate class does not settle | C | X1 | TODO | Pre-existing; verified neither repaired nor regressed by X1 |
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
| X30 | Multi-ROW mid-chain participant rejects at input 2 | — | X29 | TODO | width>1 was CONFLATED with site ordinal; width 2 now settles on the VM |
| **SEC-10** | One-armed conditional emit reserves an unsettled slot | C | SEC-9 | **INTEGRATED** | reframed: the class was never slot-specific - see 4.45 |
| **SEC-11** | SEC-9's refusal is event-only; `transferWidth` never compared | C | SEC-9 | **INTEGRATED** | closed by the same own-category immutable pin |
| **SEC-13** | Own-category immutable pin is absent for delegate/selfdestruct | S2 | SEC-11 | **INTEGRATED** | all 3 paths admitted the forgery; A rejects at input 0, B/C at input 2 - see 4.47 |
| **SEC-14** | Zero-parameter event: taken and not-taken rows are byte-identical | — | SEC-13 | **TODO (security, not demonstrated exploitable)** | positional pin cannot separate them; only `readEventsFromChain` failing to decode prevents it |
| **SEC-9** | Divergent event-frame widths leave a reached slot unverified | A | SEC-8 | **INTEGRATED (fail-closed)** | EXPLOITABLE - spurious event NFT accepted; gate counted pre-lowering emits |
| X31 | Call-option refusal is on `deriveCompiledGraphPlan` only | B | E2 | **INTEGRATED** | both entry points share one check; refusal NARROWED - see 4.40 |
| X32 | L2's derived gate is silenced by a bare `Unlocker` | B | L2 | **INTEGRATED** | out-of-scope now separated from in-scope-but-underivable |
| X36 | `planCompiledGraph` does not enforce occurrence bounds | — | X31 | TODO | 3 children can bind one `once` callsite; caught on chain, not at plan time |
| X33 | S2's `touchesCollection` does not descend through calls | C | S2 | **INTEGRATED** | BFS over the call graph; caught its own fn-pointer over-approximation |
| X34 | Relax the over-strict `this.`-spelled dynamic+collection refusal | — | X33 | TODO | admitted form PROVEN sound on the VM; bus-mode leg unsettled |
| X35 | Eligibility oddity: stricter combination admitted, simpler refused | — | X33 | TODO | dyn+collection `eligible: true` while dyn-only is refused |
| X29 | Thread a per-call-site output index into the subroutine | C | SEC-6 | **INTEGRATED** | effect-carrying handlers keep binding AND keep their effects; routes SHRANK |
| X26 | A bare `m[k]` READ contributes nothing to the function footprint | — | X19 | TODO | `ArrayAccessNode` has no `name`/`keys`; sound or fail-open is UNDETERMINED |
| X20 | Widen the assembly model to describe entry/aux inputs | — | X17 | TODO | Then re-measure the 44.5% rejection rate |
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

**A new bounded fact, measured for the first time: the C3 transaction serializes to 100,354 bytes - 354 over the
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
