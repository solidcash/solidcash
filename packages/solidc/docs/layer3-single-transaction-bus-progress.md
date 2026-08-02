# Layer 3 single-transaction bus progress

Last updated: 2026-08-02  
Branch: `codex/layer3-single-tx-bus`  
Tracking baseline: working tree after `d2f8dca6` (`feat(layer3): compose authenticated low-level calls`)
Overall verified progress: **69 / 100 points (69%)**

This is the durable progress ledger for
[`layer3-single-transaction-bus-handoff.md`](./layer3-single-transaction-bus-handoff.md).
Update it whenever a checklist item gains or loses authoritative evidence.

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
| 2. Compiler mutual verifier | 15 | 13 | In progress |
| 3. One-transaction composer | 15 | 14 | In progress |
| 4. Semantic completeness | 30 | 27 | In progress |
| 5. Capacity and optimization | 8 | 0 | Not started for controllerless product |
| 6. Removal and API stabilization | 7 | 0 | Not started |
| 7. Completion audit | 10 | 0 | Not started |
| **Total** | **100** | **69** | **69%** |

## Phase 0 — baseline and requirements (5/5)

- [x] **1 point:** Controller/projection dependency inventory and migration classification are committed.
- [x] **1 point:** Existing tests are classified as reusable, adaptable, or obsolete.
- [x] **1 point:** Controller-backed baseline size/capacity evidence is recorded for comparison.
- [x] **1 point:** All twelve security invariants are mapped to required evidence.
- [x] **1 point:** Protocol requirements and controllerless architecture are committed in
  `layer3-single-transaction-bus-requirements.md` and `layer3-single-transaction-bus-protocol.md`.

## Phase 1 — codec and layout (10/10)

- [x] **2 points:** Controllerless domain, version, and canonical byte grammar are defined.
- [x] **2 points:** The first participant master input is the canonical transcript carrier.
- [x] **2 points:** Strict encode/decode rejects malformed lengths, non-canonical fields, and suffix bytes.
- [x] **2 points:** Participant blocks are contiguous and end at one ordinary fee/change tail.
- [x] **2 points:** Pure codec/layout mutation tests cover every field and framing boundary without controller objects.

Evidence: `Layer3SingleTxCodec.test.ts`, `Layer3SingleTxGraph.test.ts`, commits `59c094e1`,
`23aca57f`, and `c540a849`.

## Phase 2 — compiler mutual verifier (13/15)

- [x] **3 points:** Every participant extracts and parses the identical carrier bytes.
- [x] **3 points:** Participant identity, active membership, block bases, sizes, and fee-tail boundary are verified.
- [x] **3 points:** Invocation rows are bound to local SCB1 execution and exact result consumption.
- [x] **2 points:** Structural carrier and participant mutations are rejected in the BCH-2026 VM.
- [x] **2 points:** Resource/effect rows have exact physical cardinality checks and local ownership binding.
- [ ] **1 point:** Graph participation is fully inferred for every admitted family without explicit controller admission.
- [ ] **1 point:** Controller/projection verifier parameters and semantic fallbacks are absent from production routes.

## Phase 3 — SDK one-transaction composer (14/15)

- [x] **3 points:** Composer derives canonical participant order, absolute block bases, and complete balanced blocks.
- [x] **3 points:** One transcript is encoded into input 0 and shared by all participant verifiers.
- [x] **3 points:** Participant inputs/outputs plus one P2PKH fee/change tail are assembled in one builder.
- [x] **2 points:** Transcript and transaction structure are finalized before signatures are produced.
- [x] **2 points:** `layer3.compose({ calls, funder, changeAddress }).send()` broadcasts without setup execution.
- [x] **1 point:** Offline `build()` exists for inspection, mutation testing, and later signing.
- [ ] **1 point:** Public API surface and tests prove there is no silent legacy-controller selection path.

## Phase 4 — semantic completeness (27/30)

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

### Oracles, sidecars, and call modes (4/7)

- [x] **2 points:** Blockhash oracle slots have positive, stale, omitted, substituted, and duplicate evidence.
- [ ] **2 points:** Keccak and ecrecover sidecars have exact-slot consumption and recreation evidence.
- [x] **1 point:** `staticcall` enforces read-only semantics and authenticates its mode bit.
- [x] **1 point:** Raw/low-level calls authenticate calldata, selector, results, and supported effects.
- [ ] **1 point:** Sound delegate context is implemented and tested, or every delegate shape is explicitly refused.

## Phase 5 — capacity and optimization (0/8)

- [ ] **2 points:** Actual BCH-2026 measurements exist for admitted 2-participant graphs.
- [ ] **2 points:** Actual measurements exist for admitted 4-participant representative graphs.
- [ ] **2 points:** Actual measurements exist for admitted 8-participant/max-resource graphs, or a smaller bound is proven.
- [ ] **1 point:** Cost is attributed between duplicated global verification and local verification.
- [ ] **1 point:** Measured participant/resource limits are published in artifacts and enforced by SDK preflight.

Controller-era capacity reports do not satisfy these items.

## Phase 6 — removal and API stabilization (0/7)

- [ ] **2 points:** Controller genesis, controller NFT, execution-root, and projection implementation are deleted.
- [ ] **1 point:** `messageBusController` and `messageBusControllerCategory` are absent from compiler and artifact APIs.
- [ ] **1 point:** Compatibility paths cannot silently select the old protocol.
- [ ] **1 point:** `__testLayer3BindingSpike` and semantic bypasses are removed from production code.
- [ ] **1 point:** Public documentation and examples exclusively teach one-transaction composition.
- [ ] **1 point:** Retained tests use inferred behavior; obsolete controller tests are deleted or explicitly archived.

## Phase 7 — completion audit (0/10)

### Repository gates (0/4)

- [ ] **1 point:** Fresh `yarn build` passes at the final revision.
- [ ] **1 point:** Fresh `yarn lint` passes at the final revision.
- [ ] **1 point:** Full `packages/solidc` test suite passes without relevant skips.
- [ ] **1 point:** Full `packages/solidcash` test suite passes without relevant skips.

### Live BCH-2026/regtest capstones (0/4)

- [ ] **1 point:** Heterogeneous returning call with state settlement completes live.
- [ ] **1 point:** Three-contract transitive chain completes live.
- [ ] **1 point:** Repeated ERC-20-style resources plus event/value/token effects complete live.
- [ ] **1 point:** Maximum admitted participant/resource shape completes live.

### Final proof (0/2)

- [ ] **1 point:** Production-tree residue search justifies every retained controller-era match.
- [ ] **1 point:** Requirement-by-requirement audit directly proves all twelve security invariants and no setup transaction.

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

## Next percentage milestones

- **62%:** logical context capstone is committed with canonical success and hostile caller/selector/args/origin failures.
- **69%:** controllerless repeated/branch/loop and all oracle/sidecar families are directly proven.
- **73%:** remaining static/raw/delegate policy is implemented or soundly refused with tests.
- **81%:** controllerless capacity measurements and enforced bounds are complete.
- **88%:** controller/projection code and compatibility paths are removed; public API/docs are stable.
- **100%:** all final repository gates, live-regtest capstones, residue review, and invariant audit pass.
