# Layer-3 execution-transcript bus - independent-review package

This package is for the external covenant review the specification requires (gate 5). It consolidates the
covenants, the canonical encoding, the threat model, the trust assumptions, and the hostile test matrix, and
gives an HONEST per-finding status against `layer3-production-reaudit.md`. Independent review itself remains
outstanding - this package exists to make it efficient, not to substitute for it.

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
- R8 N-party live-node lifecycle: CLOSED for consensus-node acceptance on regtest. Mainnet STANDARD policy
  (acceptnonstdtxn=0) NOT yet measured.
- R5 full: PARTIAL. Selectors + call graph are bound; the ACTUAL runtime args/results of native
  `IContract(addr).method()` calls are not yet wired into the transcript edges (a compiler-integration feature).
- R4 exhaustiveness: PARTIAL. Participant substitution/permutation is closed by the position-bound root; full
  emitter/callee exhaustiveness + unique state ownership + resource-transition authority need resources/events
  in the root (R2 extension) + R6.
- R6 typed transition: OPEN. The earlier scaffold still exposes raw `appBody`/`valueExpr`; a typed,
  unconditionally-generated transition operation is not built. (The execution model has no resources yet, so
  it does not expose the unsafe boundary.)
- R5 cycles (A->B->A, repeated one-callee settlement): OPEN. On UTXO each input executes once, so EVM-style
  reentrancy has no direct analogue; the achievable form is mutual co-verification under the execution root
  (which the heterogeneous binding demonstrates for the acyclic edge) plus, for a genuine cycle, two physical
  instances or a callback via `msg.sender`. Not implemented; needs dedicated design.
- Gate 5 independent review: this package is the deliverable; the external review itself is outstanding.

## What a reviewer should attack first

1. The mint-once uniqueness argument (does any genesis path leave a minting NFT of the controller category?).
2. The position-bound root (can two different transcripts share a controller, or a participant be replayed
   across transcripts, given the controller commitment is fixed?).
3. The absence of runtime arg/result binding (R5): a caller and callee agree on the selector but the covenant
   does not yet force the args/results they exchanged to match the transcript.
4. Replay: the controller root is fixed and preserved, so the SAME transcript can be re-run - is that intended
   (idempotent attestation) or does it need a nonce/one-shot?
