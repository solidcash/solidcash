# Layer-3 required-path audit - resolution status

Tracks each finding of `layer3-required-path-audit.md` (Decision 3) against what is now implemented and
VM-verified. Honest status only: a finding is marked CLOSED only where a real BCH-2026 VM regression proves
it, and the remaining deep items are named as open, not glossed.

## The execution model that closes P2/P3/P6/P7: the callee state journal

The audit's central, thrice-repeated objection was that invocation edges were only labels hashed into the
controller commitment, never bound to actual execution. The fix is a callee STATE JOURNAL
(`generateExecutionParticipant({ journal })`):

- The callee owns a co-spent state NFT (a resource folded into the framed root, P5).
- It reads its 8-byte state, then EXECUTES every incoming edge naming it as callee, in list order: each edge's
  committed selector selects an operation from the journal op-map (`add|sub|mul`) applied with the edge's
  committed args. The final state is flushed once to the recreated resource output.
- A designated outgoing edge (`emits`) must carry the callee's AUTHENTIC flushed post-state as its args, so a
  downstream journal that consumes the return edge applies a real computed result, not a label.

This makes the following REAL state transitions rather than hash agreement:

- repeated calls to one physical callee (two edges folded into one flush);
- selector-to-operation dispatch (a different selector computes a different result);
- cross-edge ordering (edge 2 observes edge 1's post-state; order changes the settled value); and
- A -> B -> A execution (B applies A's deposit, emits its authentic state, A consumes it), with forgery of a
  value the callee never produced rejected by the callee covenant.

Tests: `Layer3Journal.test.ts` (ordered multi-op, ordering-matters, hostile final state),
`Layer3Cycle.test.ts` (A->B->A with authentic returned result, hostile forged credit).

## Per-finding status

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| P1 | Ambiguous execution-root encoding | CLOSED | One shared framed/versioned/length-counted encoder (`framedRootExpr` covenant + `executionRoot` SDK, byte-identical); 4-byte selector validation; the collision regression now asserts closure. `Layer3Module` unit tests. |
| P2 | Cycle/repeated-callee execute no calls | CLOSED (journal model) | `Layer3Journal` (repeated callee, real ordered flush), `Layer3Cycle` (A->B->A authentic result). Native-call coverage is P8. |
| P3 | Selectors not bound to dispatch | CLOSED (journal model) | Journal op-map dispatches committed selector -> operation; ORDERING/HOSTILE prove divergent real computation. Native-selector reconciliation is P8. |
| P4 | Runtime args/results are bespoke | CLOSED | `ExecutionInvocation {argsHex, resultHex}` in the production API, folded into the framed root; journal consumes args as real operands. `Layer3IntegratedArgs`. |
| P5 | Resources disconnected from the root | CLOSED | `ExecutionResource {owner, categoryHex}` in the framed root; owner verifies the co-spent NFT; the journal writes that resource. `Layer3ResourceRoot`. |
| P6 | Cross-edge ordering/dependency absent | CLOSED (journal model) | `Layer3Journal` ORDERING (25 != 30), `Layer3Cycle` (edge 2 observes edge 1's post-state). |
| P7 | Callee exhaustiveness incorrect | CLOSED (journal rows) | Every incoming edge is folded into the flush; omit/add a row and it fails. Native-call-has-a-row is P8. |
| P8 | Auto-wiring exercises no native calls | OPEN (deep) | `generateExecutionParticipant` still injects source snippets; it does not derive edges from compiler-native IContract call metadata, and native calls bring their own block-layout slots that conflict with the fixed exec layout (needs P9). |
| P9 | Balanced block-layout composability | OPEN (deep) | The exec path uses fixed global indices (participants 0..n-1, controller n, resources n+1+k); the journal inherits them. Real artifact block layouts / paired funding slots are not integrated. |
| P10 | Event exhaustiveness wrong transport | OPEN | Still a global OP_RETURN count loop, not compiler-assigned event-NFT slots within authenticated block bounds. |
| P11 | TypedTransition length disagreement | CLOSED | SDK and covenant both require `commitment.length == total`. `Layer3TypedTransition`. |
| P12 | setRoot not set-once | CLOSED | `setRoot` requires an empty input commitment; one-shot controller replay policy available. `Layer3Replay`. |
| P13 | Independent review + policy harness | PARTIAL | Committed standard-policy harness `test/regtest/standard-policy-harness.sh`; the external covenant review itself is external by definition. |

## Honest scope of what remains

P8/P9/P10 are one entangled program: real compiler-native IContract dispatch, balanced artifact block layouts
with paired funding inputs, and event-NFT slots. The journal proves the EXECUTION SEMANTICS are real for a
bounded arithmetic-op state machine over per-participant 8-byte state; it does not yet run arbitrary compiled
method bodies through the compiler's external-call/block-layout machinery. Until P8/P9/P10 land and the
external review (P13) is done, keep the feature experimental and default-off.

Known bounds of the journal model (documented, not hidden):

- Operations are a fixed vocabulary (`add|sub|mul`) baked at generation time, not arbitrary method bodies.
- State is one 8-byte little-endian field per resource; `sub` past zero and values exceeding 8 bytes are out
  of the tested domain.
- Resource identity binds to a committed category; production soundness requires that category be genesised
  unique (same requirement as any stateful NFT).
- Fixed global input/output indices (P9) are not yet balanced-block-layout composable with native calls.
