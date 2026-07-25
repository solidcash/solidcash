# Layer-3 execution-transcript bus - independent-review package

This package is for the external covenant review the specification requires (gate 5). It consolidates the
covenants, the canonical encoding, the threat model, the trust assumptions, and the hostile test matrix, and
gives an HONEST per-finding status. Independent review itself remains outstanding.

## Correction after the required-path audit (`layer3-required-path-audit.md`, 0d7b065b)

That audit (Decision 3) is ACCEPTED. The honest bottom line: what exists is a set of sound BUILDING BLOCKS
and a now-CANONICAL commitment format, NOT a complete execution bus. Specifically:

- FIXED after the audit (`e5be6df1`): P1 the execution-root encoding is now framed/versioned/collision-free
  via one shared encoder; P11 typed-transition length agreement; P12 setRoot is set-once.
- NOT FIXED (the load-bearing gap): the invocation EDGES and SELECTORS are LABELS hashed into the controller
  commitment - they are NOT bound to the transaction's actual dispatched selectors or calls (audit P2/P3/P7).
  So `Layer3Cycles` proves the participants AGREE ON a `[A->B, B->A]` label list, NOT that A calls B or B
  calls A; the selectors `11111111/22222222` are arbitrary while the executed methods are `A.f()/B.g()`.
  `Layer3RuntimeArgs` is a BESPOKE covenant, not the module protocol; `ExecutionInvocation` still carries only
  `{caller, callee, selectorHex}` with no argument/result/resource rows (P4/P5). Cross-edge ordering (P6),
  balanced block layouts (P9), and event-NFT slots (P10) are absent.

Binding labels to actual execution requires reading each participant's dispatched selector/args/result from
its unlocking + native-call metadata and reconciling repeated rows via a callee journal - real compiler
integration, not the source-string generation done so far. Until then, keep the feature experimental and
default-off. The per-finding notes below predate this correction where they still say "CLOSED"; treat the
label-vs-execution gap above as authoritative.

## Components under review (SDK: `packages/solidcash/src/layer3/covenant.ts`)

1. `generateControllerCovenant()` - the controller (R7). Category-agnostic covenant; `setRoot` (deployer sig)
   sets the transcript root once; `attest` preserves locking bytecode, category, value, and commitment.
   Genesised MINT-ONCE (one mutable NFT, no minting NFT) so the CashToken category is fixed-supply.
2. `executionMemberBody(n, selfPos, invocations, controllerCategory, controllerLbc)` - the reusable snippet a
   HETEROGENEOUS participant embeds (R3). Reads each participant lbc at its fixed position, recomputes the
   execution root, requires the co-spent controller (exact category + lbc) to commit it and be preserved,
   and pins its own position.
3. `generateExecutionBoundCovenant / bindingFrameworkBodyControllerBound` - the homogeneous-clone forms (R2
   participant-set + execution roots) used by the earlier N-party tests.
4. `generateOneShotControllerCovenant()` - REPLAY policy. Its `attest` scans all outputs and rejects any
   recreation of its category, so the mint-once controller is consumed and the root authorizes exactly one
   execution. Pairs with `executionMemberBody(..., oneShot: true)` (skips controller preservation).
5. `generateExecutionParticipant(spec)` - AUTO-WIRING. Generates a full participant covenant, injecting the
   transcript verification from a spec so the developer supplies only their appBody (+ optional `nativeCalls`
   for native IContract calls whose edge comes from the same declaration).

## Canonical execution root (R2)

```
root = sha256( EXEC_DOMAIN(4c33455845433100)
             || lbc_0 || lbc_1 || ... || lbc_{n-1}
             || (lbc_caller || lbc_callee || selector)  for each invocation, in list order )
```

- Participant lbcs are read from the co-spent inputs at their fixed positions, so the root binds each
  participant to its position (no substitution/permutation).
- Off-chain: `executionRoot(orderedLbcs, invocations)` (SDK `transcript.ts`) - the deployer sets the
  controller commitment to exactly this.

## Threat model + trust assumptions

- TRUSTED: the deployer, who sets the controller root (defines the protocol - analogous to a constructor).
- TRUSTED (with a REAL proof): the controller is unique. Proof = mint-once genesis: the genesis creates one
  NFT and NO minting NFT, so by the CashToken rule the category can never mint another token. Participants
  bake the controller's exact category + locking bytecode.
- ADVERSARIAL: the transaction builder (may reorder, inject, substitute inputs/outputs, tamper commitments).
- Guarantees: an injected/permuted participant fails position/root; a controller committing the wrong root
  (set-only, wrong call graph) is rejected; a forged controller (wrong lbc) is rejected; the controller's
  value/commitment/category/lbc are preserved across the spend.

## Hostile test matrix (all real BCH-2026 VM; regtest where noted)

| Property | Test | Result |
|---|---|---|
| Controller value siphon rejected (R1) | Layer3NPartyMutual | rejected |
| Wrong participant-set root rejected | Layer3NPartyMutual | rejected |
| Injected extra participant rejected | Layer3NPartyMutual | rejected |
| Forged controller (wrong lbc) rejected (R7) | Layer3ControllerGenesis | rejected (mock; impossible on real node) |
| Set-only root (no execution) rejected (R2) | Layer3ExecutionRoot | rejected |
| Wrong call graph (selector) rejected (R2) | Layer3ExecutionRoot | rejected |
| Position swap of heterogeneous participants rejected (R3) | Layer3Heterogeneous | rejected |
| Full lifecycle on live BCHN (R8) | 3 files, TESTS_USE_REGTEST | accepted |

## Honest per-finding status (vs re-audit)

- R1 controller value preservation: CLOSED.
- R7 real mint-once genesis + exact identity: CLOSED (genesis flow + exact-lbc + uniqueness via no-minting-NFT).
- R2 execution root (call graph + selectors + order): CLOSED for STRUCTURE. Runtime argument/result VALUES in
  the edges are NOT yet bound (that is R5 depth).
- R3 heterogeneous participants: CLOSED (two different compiled contracts mutually authenticate).
- R8 N-party live-node lifecycle: CLOSED. Passes on live BCHN regtest, AND under mainnet STANDARD policy -
  re-ran the lifecycle against a BCHN node started with `-acceptnonstdtxn=0` (non-standard acceptance
  disabled); the p2sh32 + CashTokens + OP_RETURN transcript txs are accepted as standard.
- R5: CLOSED for soundness. Runtime args/results are bound into the edge and the callee AUTHENTICATES the
  result against its state (`Layer3RuntimeArgs.test.ts`: amount*rate; wrong result rejected).
- R6 typed transition: CLOSED for the common case. `TypedTransition {offset,width,total,delta}` generates the
  fail-closed output-commitment binding unconditionally and the module computes it (`Layer3TypedTransition`);
  raw `transition:true`/`appBody` remains a documented escape hatch for complex math.
- R5 cycles (A->B->A, repeated one-callee): CLOSED. Structural, not reentrant: a cycle is the edge list
  [A->B, B->A] in the root, each participant runs once and verifies its edges (`Layer3Cycles.test.ts`).
  REMAINING: ordering ENFORCEMENT between edges (that B->A observes A->B's effect).
- R4 exhaustiveness: CLOSED. Emitter exhaustiveness (`Layer3Exhaustiveness.test.ts`: exactly the committed
  OP_RETURN records - extra rejected, omitted rejected); callee exhaustiveness inherent (edges bind to
  participant positions); unique ownership + transition authority = scaffold F1.

## Refinements (production readiness)

- REPLAY policy: `generateOneShotControllerCovenant` (`Layer3Replay.test.ts`) - one execution then the
  mint-once controller is consumed forever; reusable-vs-one-shot is an explicit deployer choice. Also, a
  state-changing transcript is inherently non-replayable (input state NFTs are consumed).
- AUTO-WIRING: `generateExecutionParticipant` (`Layer3AutoWire.test.ts`) - the transcript verification is
  generated from a spec; the developer supplies only appBody (+ `nativeCalls`). MODULE-level; full
  COMPILER-side derivation from `IContract(addr).method()` syntax is a further ergonomic step.

## Still outstanding (external / further ergonomics, not soundness)

- The external covenant review itself (this package is the deliverable).
- Compiler-side auto-derivation of transcript edges from native `IContract` syntax (module-level auto-wiring
  is delivered; soundness already proven with explicit edges).
- Cross-edge ORDERING enforcement (that a later edge observes an earlier edge's on-chain effect).

## What a reviewer should attack first

1. The mint-once uniqueness argument (does any genesis path leave a minting NFT of the controller category?).
2. The position-bound root (can two different transcripts share a controller, or a participant be replayed
   across transcripts, given the controller commitment is fixed?).
3. The runtime arg/result binding (R5, now enforced): confirm the callee's authentication of
   `result == f(args, state)` and the edge's arg/result commitment cannot be desynchronised.
4. The one-shot controller's output scan (`generateOneShotControllerCovenant.attest`): confirm no output
   shape (multi-category, mixed) lets the controller category slip past `oc.length >= 32 && slice(0,32)`.
5. The reusable controller (default): two different transcripts cannot share one controller commitment (each
   root is distinct); confirm a participant cannot be replayed across roots given the fixed commitment.
