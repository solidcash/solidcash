# Layer-3 message-bus spike - self-audit findings

Date: 2026-07-24. Auditor: the implementing agent (adversarial self-audit). Method: EMPIRICAL - each
attack is built as a transaction and run on the real BCH-2026 VM (`MockNetworkProvider.sendRawTransaction`
+ `createVirtualMachineBch2026`). A finding is "confirmed" only when the attack transaction is ACCEPTED
by the VM. Attack harness: `test/e2e/Layer3Audit.test.ts` (compact binding) and
`test/e2e/Layer3AuditState.test.ts` (state-NFT covenant). Both pass, encoding the outcomes below.

## Summary

| # | Item | Result | Severity |
|---|---|---|---|
| F1 | Foreign-category state NFT is unauthenticated (inflation) | CONFIRMED exploitable | Critical (as-built) |
| F2 | Value-settlement output binds value but not recipient | CONFIRMED exploitable | High (M5/result form) |
| N1 | Value/commitment preservation relies on the stateful covenant, not the binding | Implicit dependency | Note |
| N2 | Index validity is enforced by VM crash, not explicit range checks | Fragile | Note |
| D1 | Extra unnamed participant-covenant input | Rejected (defense holds) | - |
| D2 | Duplicate/aliased participant (input0==input1) | Rejected (defense holds) | - |
| D3 | msg.sender caller/callee constrained to the real participants | Sound by construction | - |

The core message-bus MECHANISM (identity-by-reference binding, canonical order, brand cross-check, the
msg.sender constraint) is sound - the defenses hold on the VM. Both findings are MISSING CHECKS in the
demonstration covenants, not unsoundness of the mechanism. A production covenant must add them.

## F1 - State-NFT authenticity is unauthenticated (CONFIRMED exploitable)

`Layer3AuditState.test.ts`. The state-write, Kashi, oracle, and refined-intent spikes hold owner state
in a MUTABLE NFT under a FOREIGN category, guarded by a P2PKH key. The covenant reads that NFT's
commitment as authoritative pre-state and computes `shareOut = floor(M*B/E)` from it.

Attack: an actor who can build a valid transcript supplies a state NFT with an INFLATED base `B` (nothing
brands the NFT to any owner, and foreign-category genesis is permissionless even on a real node). With
`E=10, M=6`, honest `B=8 -> S=4`; the attack `B=1000 -> S=600`, and the VM ACCEPTS it (test
"FINDING: ... mints S=600 and the covenant accepts it" passes). The covenant faithfully transitions the
fake state to `(E+M, B+S)` and settles the inflated share.

This was documented as the section-6.1 stand-in in the handoff; the audit CONFIRMS it is a real
exploitable gap, not theoretical. Scope: the four spikes that use a foreign-category state NFT. It does
NOT apply to the master-commitment spikes (M4 intent, M5 result, rebase, graph, transcript, chain), whose
committed value sits in the PARTICIPANT'S OWN minting category - on a real node the CashTokens rule
"only the category's minting NFT can create its tokens" authenticates those (the mock's `addUtxo`
bypasses that rule, so the mock cannot demonstrate the difference; it is real on a node).

Remediation: each owner's state NFT MUST be branded to that owner (its minting category, at
`getDataNftAddress`, guarded by `buildDataNftCovenantScript`), so only the owner can create or mutate it.
The covenant must then verify the state NFT's category equals the owner's. This is the SDK's data-NFT
machinery; integrating it with the transcript covenant is unbuilt (handoff section 10).

## F2 - Value-settlement output binds the value but not the recipient (NEW, CONFIRMED)

`Layer3AuditState.test.ts`, test "FINDING: the consumer credit ... can be redirected". The result (M5)
and state-write demo covenants deliver the callee result into a "consumer settlement" as a satoshi output
`require(tx.outputs[k].value == 2000 + shareOut)` - checking the VALUE but never the output's
`lockingBytecode`. Attack: send that output to an ATTACKER P2PKH with the same value; the VM ACCEPTS it.

So the M5 claim "callee result consumed INTO THE CALLER settlement" is weaker than stated: the value is
bound to the authenticated result, but its RECIPIENT is unconstrained - anyone can receive it. This was
NOT previously documented; the self-audit surfaced it.

Scope: the value-settlement form (M5 `Layer3ResultSpike`, `Layer3StateWriteSpike`). It does NOT apply to
the Kashi/oracle spikes, where the consumer credit is a STATE NFT bound by lockingBytecode + category +
commitment (the correct pattern). Remediation: bind the consumer output's recipient (require its
lockingBytecode is the consumer's), or - better - deliver results into the consumer's committed state as
Kashi/oracle do, not a bare value output.

## N1 - Value/commitment preservation relies on the stateful covenant, not the binding

`Layer3Audit.test.ts`, test "value drain". Recreating a participant master at a LOWER satoshi value is
REJECTED - but by the `forceStateful` covenant's built-in protected-satoshis invariant, NOT by the
binding, which checks only `lockingBytecode` + `tokenCategory` of the recreation output. The binding
implicitly depends on `forceStateful` for value (and, in the compact form, commitment) safety. A
production covenant should not rely on that implicitly; it should assert value/commitment preservation
where it matters, or document the dependency as load-bearing. Confirm the stateful invariant is EXACT
(input == output) and not merely a floor, and that it holds for every participant output index used.

## N2 - Index validity by VM crash, not explicit range checks

The attacker supplies `callerIdx/calleeIdx/producerIdx/state indices` in the blob. Pointing a state index
at a participant or the fee input reads an empty commitment, giving `int("")=0` and then `M*0/0`
(division by zero) -> the VM aborts and the tx is rejected. So the defense exists, but it is a CRASH, not
a validated bound. This is fragile: a covenant change that avoids the division (or a role whose misuse
does not crash) could turn a mis-pointed index into a silent bypass. A production covenant must
range-check and role-check every attacker-supplied index explicitly.

## D1/D2/D3 - Defenses that hold (verified on the VM)

- D1 extra unnamed participant input: co-spending a third `__layer3_bind` contract not named in the blob
  is REJECTED - when the VM evaluates that input, its membership check
  (`activeInputIndex in {input0,input1}`) fails, so its own covenant aborts.
- D2 aliased/duplicate participant (`input0 == input1`): REJECTED - canonical order requires `hi0 < hi1`
  strictly; equal inputs give `hi0==hi1 && lo0==lo1`, so neither branch holds. Distinctness is enforced.
- D3 msg.sender caller/callee: because BOTH participants run the covenant and each requires
  `activeInputIndex in {callerIdx, calleeIdx}`, the set `{callerIdx, calleeIdx}` must contain both
  participant indices; with `callerIdx != calleeIdx` it equals `{input0, input1}`. So the attacker cannot
  point `callerIdx` at the fee or a non-participant - the sender is bound to a real participant.

## Overall assessment

The mechanism is sound; the demonstration covenants are incomplete in two ways that a production covenant
must fix (F1 state authenticity, F2 recipient binding) and two ways to harden (N1 explicit
value/commitment preservation, N2 explicit index checks). F1 was a known stub now proven exploitable; F2
is new. Neither undermines the spike's verdict that the message bus is buildable and its bindings sound -
but neither the state-authenticity nor the recipient-binding property should be claimed until the
production covenant asserts them. The audit did not find a way to forge participant identity, msg.sender,
canonical order, or a correctly-branded result - those bindings held under every attack tried.
