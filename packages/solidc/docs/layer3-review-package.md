# Layer-3 message bus: independent covenant-review package

Status: **READY FOR INDEPENDENT REVIEW; SIGN-OFF PENDING**.

Audit target: `codex/layer3-binding-spike` branch HEAD. The integration owner must replace this sentence with
the exact immutable commit after the default-on implementation and final verification are integrated. A review
of any other commit does not close the ledger's independent-review gate.

## 1. Project decisions and review boundary

- The project has decided that this branch must ship the admitted Layer-3 message-bus surface **default-on**.
- Product demand is a project decision and is not an evidence task for this implementation or its reviewer.
- Independent covenant review remains mandatory. Default-on implementation and its regression proof do not
  substitute for external sign-off.
- Consensus target: BCH May 2026 (`BCH_2026_05`). Sharded/faceted contracts remain excluded.
- The SDK and every transaction builder are adversarial witness constructors. Acceptance must be justified by
  the covenant bytes and BCH consensus, never by planner metadata or an SDK preflight alone.
- Unsupported source and transaction shapes must fail closed with a named diagnostic.

Current claim/status authority: `message-bus-completion-ledger.md`. Operational evidence and commands:
`message-bus-HANDOFF.md`. The long execution plan and older audit files are provenance, not current status.

## 2. Exact source surface to review

The reviewer must follow each invariant through compiler admission, generated covenant bytes, SDK assembly,
and the hostile VM/node control. At minimum inspect:

- compiler route admission and lowering: `packages/solidc/src/compiler.ts` and the semantic passes it invokes;
- artifact metadata and balanced layout: `packages/solidc/src/artifact/Artifact.ts`;
- generated route/controller/projection covenants: compiler generation plus
  `packages/solidcash/src/layer3/graph.ts`;
- canonical transcript/framing helpers: `packages/solidcash/src/layer3/transcript.ts`;
- hidden-batch and stateful SDK assembly: `packages/solidcash/src/layer3/hidden-batch.ts` and
  `packages/solidcash/src/stateful/StatefulContract.ts`;
- production capacity checks: `packages/solidcash/src/layer3/preflight.ts`;
- exact default-on wiring at the audit-target commit, including an explicit opt-out only if the public API
  intentionally retains one.

Canonical semantic references:

- `compiler-hidden-batch-v1.md`;
- `invocation-transcript-v1.md`;
- `balanced-block-layout-composability.md`;
- `layer3-production-envelope.md`;
- `delegatecall-security.md` and `mapping-omission-security.md`.

## 3. Threat model and invariants checklist

For each item, record PASS, FAIL, or SCOPED, the exact source anchor, the honest control, the one-field hostile,
and the rejecting input index/diagnostic.

- [ ] **Canonical encoding:** domain/version/framing are total and collision-resistant; every participant,
  occurrence, selector, argument, option, result, resource, effect, and row count is exhausted exactly once.
- [ ] **Physical identity:** every logical owner maps to the intended physical master input/output; duplicate,
  omitted, reordered, injected, or substituted participants reject.
- [ ] **Controller/carrier authority:** category, locking bytecode, commitment, signer, and preservation/one-shot
  policy cannot be forged or replayed outside the declared model.
- [ ] **State authority:** scalar, mapping, sorted insertion/deletion, struct field, chunk, dynamic-array, and
  packed-array paths have one authority and one final flush per owner; omission and stale-state attacks reject.
- [ ] **Calls and results:** direct, transitive, cyclic, repeated-owner, raw, bounded-loop, and returning calls
  bind mode, target, calldata, options, producer, schema, order, and consumption count for every admitted class.
- [ ] **Effects:** satoshi transfers, token containers, event NFTs, and return outputs preserve exact authority,
  value, category, capability, destination, and ordering.
- [ ] **Static and output state:** `staticcall` cannot mutate any direct or transitive state/effect surface;
  scalar, collection, and chunk-backed `outState` reads authenticate the intended post-state.
- [ ] **Context:** `msg.sender`, `msg.value`, `msg.sig`, and `msg.data` match direct semantics where claimed;
  authenticated graph `tx.origin` uses its documented logical carrier signer; unsupported `activeBytecode`
  and divergent contexts fail closed.
- [ ] **Delegate execution:** code identity, state owner, resource owner, result producer, and output authority are
  independently bound for each admitted delegate class.
- [ ] **Balanced layout:** independently compiled blocks relocate without global indices; slot ranges are unique
  and complete; funding/change and malformed-layout attacks reject before or in the named covenant input.
- [ ] **Default-on boundary:** ordinary compilation exposes exactly the reviewed admitted surface; unsupported
  contracts retain deterministic refusal; explicit opt-out behavior, if retained, cannot weaken contracts
  compiled in the default mode.
- [ ] **Capacity/policy:** every accepted production shape passes the selected preflight profile without turning
  a semantic-only VM result into a consensus or relay-policy claim.

## 4. Required evidence to reproduce

Run from `packages/solidcash` after `yarn build`. Do not use a stale `dist`.

1. Capstones: the three C1/C2/C3 files in `message-bus-HANDOFF.md`; expected **53 passed / 6 skipped**.
2. Full bus-mode regression: the documented 115-file command; expected **1,321 passed / 11 skipped**.
3. Settlement union: the committed X235 manifest/probe/consumer; expected **1,564 records / 806 settlements /
   167 contained routes / 157 resolved collisions**, with **145 of 213** eligible handlers proved and 68
   unproved. The 68 are an evidence-breadth limit, not themselves proof of a vulnerability.
4. Compiler suite: **2,807/2,807**.
5. SDK suite: **5,188 passed / 49 skipped / 9 todo**. The only expected failures are the two pre-existing POW
   operation-density cases named in the handoff; they are outside this review and must not mask another failure.
6. Repository `yarn build` and `yarn lint`: green.
7. Current-byte node capstones: BCHN v29.0.0 accepts and mines A13, C2, C1, and C3 and refuses every paired
   hostile transcript; recorded gate is **4 files / 69 tests**. Record node configuration and exact commit.
8. Covenant size guard: `Layer3EnvelopeDocR2.test.ts`; production generator figures are projection **5,820 B**,
   controller **2,810 B** with a 1-byte target and **2,844 B** with p2sh32.

The reviewer should also run or inspect the current regressions for SEC-18/X111 emission-clone bypasses,
transcript carrier authentication, result fan-in, delegate authority, staticcall purity, mapping/chunk omission,
event/effect settlement, and graph context. The completion ledger links the current evidence for each family.

## 5. Priority hostile attacks

1. Construct valid-looking bytes without `planCompiledGraph`; prove planner metadata is never the boundary.
2. Reuse one owner, result, resource, event, or effect in two logical positions.
3. Omit or reorder a reached row while preserving all unrelated transcript bytes.
4. Substitute controller/carrier signer, category, locking bytecode, or commitment independently.
5. Exercise journalled callees through aliases, function pointers, helpers, loops, and emission clones.
6. Cross static/delegate/ordinary modes while preserving selector and arguments.
7. Move balanced blocks and insert malformed trailing slots, funding inputs, or outputs.
8. Compile without the former experimental opt-in and compare artifact/covenant identity with the reviewed mode.

## 6. Reviewer deliverable and sign-off

Every finding must include: ID, severity, violated invariant, selected production-profile impact, exact source and
test anchors, reproduction bytes or fixture, honest control, hostile mutation, VM/node result, and disposition.
The final report must state the exact git commit, compiler/SDK build identity, BCHN version/configuration, and
whether any required command was skipped.

Sign-off closes only the independent-review PROCESS row. Any finding that changes covenant bytes, admission,
layout, default behavior, or settlement requires a new integration commit, the relevant full regressions, and
review of the changed bytes before sign-off can be credited.

## 7. Historical audit provenance

Use these to retest prior failure classes, not as current status:

- `layer3-production-audit.md` and `layer3-production-reaudit.md`;
- `layer3-required-path-audit.md` and `layer3-required-path-resolution.md`;
- `layer3-review-fixes-audit.md`;
- `message-bus-security-review-l2.md`;
- `message-bus-external-review-guide.md` (commit-scoped evidence-method audit).

Where historical prose conflicts with the completion ledger or the audit-target bytes, the ledger and a fresh
reproduction at the exact audit commit control.
