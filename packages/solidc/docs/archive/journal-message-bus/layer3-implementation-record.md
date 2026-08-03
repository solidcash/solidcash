# Layer 3 single-transaction bus implementation record (archived)

> Completed implementation evidence. Current normative behavior is defined by
> `../../layer3-single-transaction-bus-protocol.md`; stable coverage is `../../layer3-coverage-matrix.md`.

Last updated: 2026-08-03
Branch: `codex/layer3-single-tx-bus`
Verified implementation revisions: `095517ca`, `b8a3611f`, and consolidation revision history
Overall verified progress: **100 / 100 points (100%)**

This record consolidates the completed handoff, requirements census, phase ledger, and final audit. It is immutable
historical evidence; current requirements are maintained in `../../layer3-coverage-matrix.md` and current wire
behavior in `../../layer3-single-transaction-bus-protocol.md`.

## Mission and architectural disposition

The project replaced the exact-root controller-NFT workflow with atomic composition using compiler-specialized,
self-preserved verifier covenants deployed at contract genesis. Composition, authorization, execution, and
settlement occur in one transaction. There is no controller category, execution-root preparation, projection
input, confirmation barrier, or setup transaction. Participant blocks use authenticated actual spans and local
offsets; verifier inputs follow the blocks, and the ordinary fee/change tail is last.

At baseline `aa562953`, controller/projection concerns crossed compiler options and admission, code generation,
artifact metadata, graph codec/planning, controller covenants, balanced assembly, preflight, and public exports.
Reusable journal and row-encoding evidence was preserved; controller-bound assembly was adapted; genesis,
projection, root-lifecycle, and compatibility APIs were removed after controllerless VM evidence existed.

All twelve final security obligations—one transcript, exact participants, contiguous blocks, active membership,
exact row consumption, authentic calls/state/effects, no replay authority, no circular commitment, fail-closed
admission, and measured capacity—are enumerated in the stable coverage matrix. The phase evidence below records
their implementation closure.

## Scoring rules

- The denominator is always 100 points; percentages are therefore comparable over time.
- Check an item only when its implementation and the evidence named by the item are both present.
- In-progress code, a compile-only probe, skipped tests, controller-backed evidence, and an unverified
  compatibility path score zero for that item.
- If later testing contradicts an item, uncheck it and reduce the score immediately.
- Phase completion requires every item in that phase, regardless of the overall percentage.
- The product is complete only at 100%, after the Phase 7 requirement-by-requirement audit.

## Phase summary

| Phase | Weight | Verified | Status |
| --- | ---: | ---: | --- |
| 0. Baseline and requirements | 5 | 5 | Complete |
| 1. Codec and layout | 10 | 10 | Complete |
| 2. Compiler sidecar verifier and binder | 15 | 15 | Complete |
| 3. One-transaction composer | 15 | 15 | Complete |
| 4. Semantic completeness | 30 | 30 | Complete |
| 5. Capacity and optimization | 8 | 8 | Complete |
| 6. Removal and API stabilization | 7 | 7 | Complete |
| 7. Completion audit | 10 | 10 | Complete |
| **Total** | **100** | **100** | **100%** |

## Phase 0 — baseline and requirements (5/5)

- [x] **1 point:** Controller/projection dependency inventory and migration classification are committed.
- [x] **1 point:** Existing tests are classified as reusable, adaptable, or obsolete.
- [x] **1 point:** Controller-backed baseline size/capacity evidence is recorded for comparison.
- [x] **1 point:** All twelve security invariants are mapped to required evidence.
- [x] **1 point:** Protocol requirements and controllerless architecture are committed in
  the requirements census and `../../layer3-single-transaction-bus-protocol.md`.

## Phase 1 — codec and layout (10/10)

- [x] **2 points:** Controllerless domain and versionless canonical byte grammar are defined.
- [x] **2 points:** Every participant verifier carries the canonical transcript as its first push.
- [x] **2 points:** Strict encode/decode rejects malformed lengths, non-canonical fields, and suffix bytes.
- [x] **2 points:** Participant blocks are contiguous, followed by one verifier each and one fee/change tail.
- [x] **2 points:** Pure codec/layout mutation tests cover every field and framing boundary without controller objects.

Evidence: `Layer3SingleTxCodec.test.ts`, `Layer3SingleTxGraph.test.ts`, commits `59c094e1`,
`23aca57f`, and `c540a849`.

## Phase 2 — compiler sidecar verifier and compact binder (15/15)

- [x] **3 points:** Every artifact-specialized verifier parses identical carrier bytes and self-preserves.
- [x] **3 points:** Participant identity, active membership, block bases, sizes, and fee-tail boundary are verified.
- [x] **3 points:** Invocation rows are bound to local SCB1 execution and exact result consumption.
- [x] **2 points:** Carrier, verifier lock, attestation, argument, and participant mutations are rejected in the BCH-2026 VM.
- [x] **2 points:** Resource/effect rows have exact physical cardinality checks and local ownership binding.
- [x] **1 point:** Graph participation is fully inferred for every admitted family without explicit controller admission.
- [x] **1 point:** Controller/projection verifier parameters and semantic fallbacks are absent from production routes.

## Phase 3 — SDK one-transaction composer (15/15)

- [x] **3 points:** Composer derives canonical participant order, prefix-summed actual block bases, and compact balanced blocks.
- [x] **3 points:** One transcript is encoded as the first push of every participant verifier.
- [x] **3 points:** Participant blocks, one verifier per participant, and one P2PKH fee/change tail are assembled in one builder.
- [x] **2 points:** Transcript and transaction structure are finalized before signatures are produced.
- [x] **2 points:** `layer3.compose({ calls, funder, changeAddress }).send()` broadcasts without setup execution.
- [x] **1 point:** Offline `build()` exists for inspection, mutation testing, and later signing.
- [x] **1 point:** Public API surface and tests prove there is no silent legacy-controller selection path.

## Phase 4 — semantic completeness (30/30)

### Calls and execution graph (7/7)

- [x] **2 points:** Void and returning calls complete with authenticated results.
- [x] **1 point:** A three-participant transitive return chain completes.
- [x] **1 point:** Nested result dependencies and fan-in result binding have controllerless evidence.
- [x] **1 point:** Repeated calls and fan-out have positive and hostile controllerless VM evidence.
- [x] **1 point:** Branch reachability and exact occurrence consumption have controllerless VM evidence.
- [x] **1 point:** Bounded loops have positive, overflow, omitted-row, and duplicate-row controllerless evidence.

### Logical transaction context (4/4)

- [x] **1 point:** `msg.sender` is reconstructed from authenticated caller rows and hostile caller mutations fail.
- [x] **1 point:** `msg.sig` and `msg.data` are reconstructed from authenticated selector/argument rows.
- [x] **1 point:** `msg.value` is reconstructed and tied to authenticated BCH settlement.
- [x] **1 point:** `tx.origin` is tied to the canonical P2PKH fee input and hostile origin mutations fail.

Evidence: commit `4ed61e64`, including one canonical broadcast, direct BCH-2026 VM validation of every input,
and hostile caller, selector, argument, and root-origin carrier mutations. The previously committed BCH value
settlement capstone supplies the physical `msg.value` binding.

### State journals and trailing resources (5/5)

- [x] **2 points:** Mapping/entry NFT transitions are authenticated at exact physical slots.
- [x] **1 point:** Fixed/scalar state uses compiler-published balanced block slots.
- [x] **2 points:** Dynamic chunk creation, update, deletion, and trailing capacity are authenticated.

### Effects (7/7)

- [x] **2 points:** Event rows bind event commitment, owner, occurrence, and absolute output.
- [x] **1 point:** Return-event vectors are authenticated and completely consumed.
- [x] **2 points:** BCH transfers bind recipient, amount, and satoshi-container transition.
- [x] **2 points:** FT and immutable/mutable/minting NFT transfers bind recipient and token-container transition.

Evidence: commits `9915aa1d`, `5278ffab`, `19127a9c`, `7ec06606`, and `7798d441`, including
positive capstones and hostile row/physical-output mutations.

### Oracles, sidecars, and call modes (7/7)

- [x] **2 points:** Blockhash oracle slots have positive, stale, omitted, substituted, and duplicate evidence.
- [x] **2 points:** Keccak and ecrecover sidecars have exact-slot consumption and recreation evidence.
- [x] **1 point:** `staticcall` enforces read-only semantics and authenticates its mode bit.
- [x] **1 point:** Raw/low-level calls authenticate calldata, selector, results, and supported effects.
- [x] **1 point:** Sound delegate context is implemented and tested, or every delegate shape is explicitly refused.

## Phase 5 — capacity and optimization (8/8)

- [x] **2 points:** Actual BCH-2026 measurements exist for admitted 2-participant graphs.
- [x] **2 points:** Actual measurements exist for admitted 4-participant representative graphs.
- [x] **2 points:** Actual measurements exist for admitted 8-participant/max-resource graphs, or a smaller bound is proven.
- [x] **1 point:** Cost is attributed between duplicated global verification and local verification.
- [x] **1 point:** Measured participant/resource limits are published in artifacts and enforced by SDK preflight.

Evidence: `Layer3SingleTxCapacity.test.ts` evaluates every finalized input against stock BCH-2026 and pins
the accepted 2-, 4-, 5-, and 8-participant rows. The eight-party shape is 92,705 bytes and its worst input uses
99.43% of its operation-density allowance; nine is outside the protocol bound. Global density reserve bytes live
only in deployed verifier sidecars. The measurements and cost attribution are published in
`layer3-single-tx-capacity-bch2026.json`. `SINGLE_TX_BUS_CAPACITY` publishes the eight-participant ceiling,
`assertSingleTxParticipantCapacity` enforces it before block assembly, and the
composer now runs exact structural, VM, and finalized-byte preflight before returning a builder. Artifact block
layouts continue to publish and enforce per-participant resource capacity. Controller-era reports are excluded.

## Phase 6 — removal and API stabilization (7/7)

- [x] **2 points:** Controller genesis, controller NFT, execution-root, and projection implementation are deleted.
- [x] **1 point:** `messageBusController` and `messageBusControllerCategory` are absent from compiler and artifact APIs.
- [x] **1 point:** Compatibility paths cannot silently select the old protocol.
- [x] **1 point:** `__testLayer3BindingSpike` and semantic bypasses are removed from production code.
- [x] **1 point:** Public documentation and examples exclusively teach one-transaction composition.
- [x] **1 point:** Retained tests use inferred behavior; obsolete controller tests are deleted or explicitly archived.

## Phase 7 — completion audit (10/10)

### Repository gates (4/4)

- [x] **1 point:** Fresh `yarn build` passes at the verified implementation revision.
- [x] **1 point:** Fresh `yarn lint` passes at the verified implementation revision.
- [x] **1 point:** Full `packages/solidc` test suite passes without relevant skips.
- [x] **1 point:** Full `packages/solidcash` test suite passes without relevant skips.

Evidence recorded 2026-08-03: build and lint passed in all six packages; SolidC passed 63 files and 2,407
tests; SolidCash passed 429 files and 3,729 tests. Its 8 skipped files/38 skipped tests and 9 todos are the
pre-existing opt-in network, regtest, envelope, and unrelated split-corpus fixtures. The controllerless codec,
graph, balanced assembly, 19-case composition, and 2/4/5/8 capacity tests all ran.

### Live BCH-2026/regtest capstones (4/4)

- [x] **1 point:** Heterogeneous returning call with state settlement completes live.
- [x] **1 point:** Three-contract transitive chain completes live.
- [x] **1 point:** Repeated ERC-20-style resources plus event/value/token effects complete live.
- [x] **1 point:** Maximum admitted participant/resource shape completes live.

Evidence recorded 2026-08-03 with `test/regtest/standard-policy-harness.sh`: BCHN ran with
`acceptnonstdtxn=0`; heterogeneous state/return, three-party transitive return, event, BCH settlement, repeated
FT settlement, and the maximum eight-participant shape all broadcast successfully. The capacity capstone also
proved the exact finalized transaction is rejected on second submission. The harness restored default policy.

### Final proof (2/2)

- [x] **1 point:** Production-tree residue search justifies every retained controller-era match.
- [x] **1 point:** Requirement-by-requirement audit directly proves all twelve security invariants and no setup transaction.

The production search over `packages/solidc/src`, `packages/solidcash/src`, and `packages/utils/src` has zero
matches for controller terminology and every concrete removed symbol/domain. Remaining uses of “projection”
describe ordinary row/data projections, not projection inputs or verifier artifacts. Historical migration terms
remain only in documentation. The verified evidence for S1 through S12 is recorded in the security requirements
matrix. Every live application transaction uses existing participant/resource UTXOs, one genesis-deployed
self-preserved verifier per participant, and one ordinary P2PKH fee input; the harness creates no controller,
projection, or pre-call setup transaction.

## Update log

| Date | Revision | Progress | Change |
| --- | --- | ---: | --- |
| 2026-08-02 | `7798d441` | 58% | Initial ledger. Counts committed controllerless codec, mutual verification, composition, journals, events, BCH transfers, and FT/NFT settlement evidence. |
| 2026-08-02 | `4ed61e64` | 62% | Authenticated logical `msg.sender`, `msg.sig`, `msg.data`, `msg.value`, and `tx.origin` with canonical broadcast and hostile carrier mutations. |
| 2026-08-02 | `e26fa2ac` | 63% | Repeated callsites share one physical participant, fan-out settles two independent participants, and swapped/dropped/duplicated/retargeted invocation rows fail the BCH VM. |
| 2026-08-02 | working tree | 65% | Conditional reachability and compile-time-bounded loop occurrences consume exactly the authenticated invocation rows; omitted, duplicate, under-floor, and over-ceiling cases fail. |
| 2026-08-02 | working tree | 66% | Each controllerless participant enforces static block preservation; canonical static execution broadcasts, while mode substitution and a reached event effect fail the BCH VM. |
| 2026-08-02 | working tree | 67% | The composer decodes singular low-level calls through a prepared callee proof; target, selector, calldata, and opaque result substitutions fail direct VM validation. |
| 2026-08-02 | working tree | 69% | Controllerless composition positions and recreates blockhash oracle bands, propagates locktime, and rejects stale, substituted, omitted, and duplicate oracle inputs; the complete 17-case composition suite passes. |
| 2026-08-02 | working tree | 71% | Keccak and ecrecover compute sidecars occupy authenticated exact slots, recreate exact commitments, broadcast canonically, and reject wrong, swapped, omitted, or duplicate physical endpoints; the complete 19-case composition suite passes. |
| 2026-08-02 | working tree | 72% | Delegate execution is fail-closed: entry handlers publish a positioned stable refusal, internal delegate closures fail before synthetic arity lowering, and forged SDK delegate modes remain rejected. Phase 4 is complete. |
| 2026-08-02 | working tree | 73% | Removed controller identity options and artifact fields plus controller-conditioned route generation/semantic selection; all builds/lints and the complete 19-case controllerless suite pass. |
| 2026-08-02 | working tree | 74% | Removed the production `__testLayer3BindingSpike` eligibility bypass and deleted the isolated controller-era SDK codec/covenant/transcript API island. |
| 2026-08-02 | `b990c482` | 82% | Removed the remaining controller/projection runtime, canonicalized the fee tail, eliminated controller-mode compiler fallbacks, retired the obsolete corpus, and replaced production API docs with one-transaction composition. |
| 2026-08-02 | `9020d5cf` | 90% | Measured stock BCH-2026 capacity at 2/4/5 participants, proved 6 as the adjacent failing bound, published/enforced the ceiling, and broadcast the maximum under standard policy. |
| 2026-08-03 | `095517ca` | 100% | Added direct signature-stability and live replay-rejection proofs, passed all repository and standard-policy live gates, completed residue review, and audited S1-S12. |
| 2026-08-03 | working tree | 92% | Replaced maximum-capacity padding and absolute row endpoints with v2 authenticated actual spans and participant-local offsets; targeted VM/capacity suites plus fresh build/lint pass. |
| 2026-08-03 | `b8a3611f` | 100% | Passed full compiler/SDK suites and live standard-policy capstones, restored BCHN policy, completed residue review, and audited v2 S1-S12. |

## Next percentage milestones

- **100% achieved:** flexible spans, semantic coverage, measured capacity, controller removal, public API
  stabilization, repository gates, live-regtest capstones, residue review, and the v2 S1-S12 audit all pass.
