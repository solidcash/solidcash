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
| P8 | Auto-wiring exercises no native calls | SUBSTANTIALLY CLOSED | `generateBalancedParticipant` composes with a REAL native `IContract(addr).method()` call: single call (`Layer3BalancedCall`) and a TRANSITIVE A->B->C chain (`Layer3BalancedTransitive`), callees co-spent in the layout callee slots, callers self-preserving, wrong callee-base rejected. Remaining: SDK auto-derivation of the co-spends from compiler metadata (vs. supplied witness). |
| P9 | Balanced block-layout composability | CLOSED (core invariant) | `balancedLayout` gives every participant a contiguous block (executor + state NFTs + event slots) with equal input/output cardinality; blocks concatenate by computed bases; covenants address slots by BLOCK BASE, and the balanced closure rejects inserted/omitted slots (`Layer3Balanced` shows A's size-2 block shifting B's base to 2). Criteria 1,2,3,4,7,9,10 VM-proven (incl. transitive); conditional-same-size (5), fee-invariance (6), artifact-only auto-composition (8) not yet exercised. |
| P10 | Event exhaustiveness wrong transport | CLOSED | Events are NFT slots inside the emitter's balanced block (block-relative), branded with the emitter's committed state category, structurally exhaustive via the closure - no global OP_RETURN scan, spendable records (`Layer3BalancedEvents`). |
| P11 | TypedTransition length disagreement | CLOSED | SDK and covenant both require `commitment.length == total`. `Layer3TypedTransition`. |
| P12 | setRoot not set-once | CLOSED | `setRoot` requires an empty input commitment; one-shot controller replay policy available. `Layer3Replay`. |
| P13 | Independent review + policy harness | COMMITTABLE PARTS DONE | Committed CI gate `Layer3BalancedStandardPolicy` (static standard-relay limits, runs without the stack) + reproducible regtest harness `standard-policy-harness.sh` (mempool acceptance under `-acceptnonstdtxn=0`, now covering the balanced shapes). The external human covenant review is external by definition. |

## The balanced block layout (P8/P9/P10)

`balancedLayout` / `balancedMemberBody` / `generateBalancedParticipant` implement the invariant from
`balanced-block-layout-composability.md` for the transcript bus:

- Every participant owns one contiguous block: executor (slot 0) + co-spent state NFTs + event slots, with
  equal input and output cardinality. Blocks concatenate by computed bases (`base_{i+1} = base_i + size_i`),
  so a later block's input base equals its output base regardless of earlier block contents.
- Native-call callee slots follow the participant blocks; then the controller's 1-slot block; then the fee
  tail (fee input paired with change output).
- Covenants address every slot by BLOCK BASE, never a fixed global index. The balanced closure
  (`tx.inputs.length == tx.outputs.length == totalSlots`) rejects any inserted or omitted slot.
- Events are NFT slots inside the emitter's block, branded by its committed state category; exhaustiveness is
  structural (fixed `block.events` + closure), replacing the global OP_RETURN count.
- A participant can make a real native `IContract(addr).method()` call: the callee is co-spent in the callee
  slot and the compiler's on-chain dispatch verification (`OP_UTXOBYTECODE == addr`, master preservation,
  caller self-preservation) runs alongside the balanced membership.

Tests (real BCH-2026 VM): `Layer3Balanced` (shifted bases + closure), `Layer3BalancedEvents` (event NFT
slots), `Layer3BalancedCall` (native call under balanced bases), `Layer3BalancedTransitive` (A->B->C native
chain).

## Status of the balanced program

- P8: the generator composes with real native calls - single (`Layer3BalancedCall`) and transitive A->B->C
  (`Layer3BalancedTransitive`) - and the SDK auto-derives the co-spend index from the layout
  (`Layer3BalancedAutoDerive`: `balancedCaller` + `buildBalancedTranscriptTx`, no hand-written indices).
- P9: all 10 acceptance criteria are VM-proven - 1,2,3,4,7,9,10 in the balanced/call/transitive tests, and
  5 (conditional same-size), 6 (fee-invariance), 8 (independently-compiled composition) in
  `Layer3BalancedCriteria`.
- P13: the committed CI policy gate (`Layer3BalancedStandardPolicy`) checks the balanced shapes against
  standard-relay limits without the stack; the regtest harness proves mempool acceptance under
  `-acceptnonstdtxn=0`. The external human covenant review is the one step no code can perform.

The single item no engineering can close from inside the repo is the P13 *external human review* - by
definition performed by an independent third party. Everything committable for it (reproducible policy gate +
harness + review package) is in the tree.

Known bounds of the journal model (documented, not hidden):

- Operations are a fixed vocabulary (`add|sub|mul`) baked at generation time, not arbitrary method bodies.
- State is one 8-byte little-endian field per resource; `sub` past zero and values exceeding 8 bytes are out
  of the tested domain.
- Resource identity binds to a committed category; production soundness requires that category be genesised
  unique (same requirement as any stateful NFT).

Keep the feature experimental and default-off until the external review (P13) is completed by a third party.
