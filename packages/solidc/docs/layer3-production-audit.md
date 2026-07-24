# Layer-3 production module audit

Date: 2026-07-24  
Target: `23043e1a1e8d3d1a8c1dcb8efbd5043e1dcbca5e`  
Disposition: **Decision 3 — do not merge or describe as a production message bus**

## Executive conclusion

The branch contains useful, executable covenant experiments and a sound-looking
hardening of peer-mode `msg.sender`. It does not implement the message bus
specified by the research documents, and its exported "production" API has
multiple covenant-accepted unsafe states.

Three counterexamples were reproduced on `createVirtualMachineBch2026`:

1. a declared resource's commitment can be replaced arbitrarily;
2. satoshis can be removed from a declared resource and paid to an attacker;
3. three participants can accept different, overlapping transcript blobs, so
   there is no single canonical global transcript.

The green suite demonstrates that the generated examples execute and reject the
covered mutations. It does not establish the advertised participation,
resource, invocation, or application-integration properties.

## Remediation status (2026-07-24, implementer response)

The audit is accepted. The prior "production / full capstone" framing was overstated; Decision 3 (research
scaffold, keep experimental, do not merge as a message bus) stands. Concrete corrections applied on top of
the audit commit:

- **L3-2 CLOSED.** Resource commitment is now preserved by default (fail-closed). A transition is an explicit
  `ResourceSpec.transition: true` opt-out; only then does `appBody` bind the output commitment.
- **L3-3 CLOSED.** Resource satoshi value is now covenant-preserved (`output.value == input.value`);
  capability is preserved by the existing 33-byte `tokenCategory` equality.
- **L3-1 PARTIALLY CLOSED.** Every named participant is now bound to ONE canonical transcript blob (identical
  SCB1 args region), so the reproduced overlapping/divergent/reordered/omitted views no longer co-validate.
  RESIDUAL: a fully DISJOINT injected transcript with a different-structured blob is not yet caught -
  structure-independent exhaustiveness (a canonical digest binding every co-spent branded input to one
  transcript identity) is still required before L3-1 can be called fully closed. Independent re-review wanted.
- **L3-4, L3-5, L3-6, L3-7, L3-8, L3-9: OPEN.** These are the scaffold-vs-real-composition, complete
  invocation/intent/result, full resource authority, exact-controller-identity, deployability, and typed-API
  items. They are a scope program, not point fixes, and are not addressed here.
- **`msg.sender` hardening: confirmed sound** by the audit and unchanged.

Regressions: `Layer3ProductionAudit.test.ts` now asserts L3-1/2/3 are REJECTED; all 91 layer3 tests
(spikes + production + module + msg.sender) green.

## Verification performed

The complete explicitly enumerated Layer-3 suite passed:

```text
26 files passed
94 tests passed
```

This includes all `Layer3*.test.ts` files, `ByteLexProbe.test.ts`,
`Layer3Module.test.ts`, `MsgSenderUniqueMaster.test.ts`, and the three audit
counterexamples in `Layer3ProductionAudit.test.ts`.

The handoff's quoted glob should not be used as a verification command: Vitest
does not expand that shell glob here. Passing the explicit file list is
necessary.

## Findings

### L3-1 — Critical: participants need not agree on one transcript

Each input parses its own unlocking bytecode and proves only that its active
input appears in that local participant list. No covenant assertion makes the
second push byte-identical across participants, commits every input to a shared
digest, or proves an exact global participant set.

The VM accepts a transaction in which A and B use participant mapping `[A,B]`
while C uses `[B,C]`. All three are branded instances of the generated covenant
and all three outputs preserve their respective masters. This falsifies the
central claim that every participant validates "the whole transcript."

Consequences include transcript equivocation, failure of exhaustiveness, and
the ability to compose overlapping local settlements which no participant
approved as one global execution.

Required correction: define one canonical transcript byte string (or
domain-separated digest), bind every participating input to it, and enforce an
exact participant input/output block and unique logical owners. Test divergent,
overlapping, omitted, injected, and reordered participant views on the VM.

### L3-2 — High: resource commitments have an unsafe unconstrained default

`ResourceSpec` contains only `{ owner }`. The generated resource checks preserve
locking bytecode and token category, but impose no default relation between the
input and output NFT commitments. A transition exists only when arbitrary
`appBody` source is supplied.

The VM accepts replacing commitment `01020304` with `deadbeef` for a declared
resource when `appBody` is absent.

Required correction: preservation must be the default. A state transition must
be an explicit, typed, validated operation with exactly one input state and one
output state. Omitting transition semantics must never authorize arbitrary
state.

### L3-3 — High: resource satoshi value is not preserved

The resource covenant does not compare input and output satoshi values. The SDK
constructs equal values on the honest path, but this is witness-constructor
behavior, not an on-chain guarantee.

The VM accepts reducing a declared resource from 5,000 to 1,000 satoshis and
adding a 4,000-satoshi attacker output.

Required correction: preserve resource value by default or specify and
covenant-bind an explicit value delta and destination. Apply the same rule to
fungible-token amount and NFT capability; SDK construction is not authority.

### L3-4 — High: the module is a homogeneous covenant scaffold, not application-contract composition

`instantiateTranscript` creates fresh instances of one generated transcript
artifact. The production tests do not co-spend existing heterogeneous Kashi,
BentoBox, or token contract artifacts and do not invoke their compiled
entrypoints. Application logic is injected as raw SolidCash statements in
`TranscriptSpec.appBody`.

Accordingly, the module has not shown that existing contracts can participate,
that their own state covenants remain authoritative, or that compiler-generated
external calls map to the transcript. Calling the nine-field arithmetic example
a complete Kashi message bus overstates what it proves.

Required correction: demonstrate the smallest real cross-artifact call using
the actual compiled caller and callee covenants, then the surveyed corpus rung.
The bus must authenticate projections of application contracts; it must not
replace all applications with a newly generated shared covenant.

### L3-5 — High: invocation and intent semantics are materially incomplete

`InvocationSpec` is only `{ caller, callee }`. It carries no selector, argument
commitment, callsite/occurrence identity, result, or ordering dependency.
Always-on M4 commits the caller master to `hash160(callee locking bytecode)`;
that is a persistent callee allowlist, not authorization of a particular call.

The refined selector-and-nonce intent demonstrated by an earlier spike was not
integrated into the production module. There is also no generic M5 result table:
examples recompute application expressions in `appBody` and bind raw
`valueExpr` source to an output.

Required correction: bind caller, callee, selector, canonical arguments,
occurrence/order, and consumed results. The caller must attest the complete set
of emitted rows, not merely co-presence or permission to call a callee.

### L3-6 — High: resource ownership is category association, not complete state authority

A resource is associated with its owner's master category, but the production
path does not require the canonical data-NFT locking covenant, a logical slot
identifier, uniqueness, or owner-authenticated initialization. Production
tests use fixture-minted, P2PKH-guarded state NFTs. The separate data-NFT spike
does not make the exported production path inherit those guarantees.

An arbitrary mutable NFT of the relevant category is therefore not, by itself,
proof of the owner's canonical pre-state.

Required correction: specify and enforce resource identity, controller
bytecode, slot/key, uniqueness, capability, initialization, and transition.
Exercise the full lifecycle without `addUtxo` fixture minting.

### L3-7 — Medium: controller branding is not exact code/version identity

The controller check relies on a public `L3B1CTRL` salt prefix at a calculated
redeem-script offset. A public prefix is a namespace marker, not a commitment to
an exact controller artifact or protocol version. This becomes especially weak
in combination with L3-1.

Required correction: bind the expected full locking bytecode or an unambiguous
artifact/version commitment, and verify the expected P2SH32 frame explicitly.

### L3-8 — Medium: network deployability and policy acceptance remain unproven

The mock provider deliberately relaxes script, transaction, commitment, and
operation-budget limits. Some tests separately evaluate inputs using the
BCH-2026 VM, which is useful consensus evidence, but is not a mainnet-policy
test. Regtest configured to accept non-standard transactions cannot establish
relay/mining standardness. The full authorization/remint lifecycle was not run
on a real node.

Required correction: run exact serialized transactions against BCH-2026
consensus limits and standard policy with non-standard acceptance disabled.
Measure every participant input, total transaction size, unlocking size, and
redeem-script size, then exercise the real mint-to-transition lifecycle.

### L3-9 — Medium: exported raw source expressions enlarge the trusted surface

`appBody: string[]` and `EffectSpec.valueExpr: string` make the SDK a covenant
source generator rather than a typed transcript API. Security properties depend
on callers remembering every preservation and authorization rule. The compiler
route also remains behind a test/spike-named experimental option.

Required correction: replace raw source fragments with typed operations whose
safe invariants are generated unconditionally. Keep experimental status until
the architecture and covenant review are complete.

## Sound or useful components

- The new peer-mode `msg.sender` scan requires exactly one co-spent minting
  master of the declared category and derives the sender from that input's
  actual locking bytecode. The inspected implementation and positive/hostile VM
  tests support this narrow claim.
- Per-local-view participant master preservation binds locking bytecode,
  category, commitment, and satoshi value for participant masters.
- Fixed output assertions for the generated M3 record, effects, and events bind
  the particular fields they compare.
- The tested generated shapes appear feasible under the measured operation
  budgets.
- The spikes are valuable research fixtures when described as such.

None of these local properties supplies the missing global-transcript,
resource-authority, invocation-exhaustiveness, or real-contract-integration
proofs.

## Graduation gates

Before merge as anything beyond an experimental spike:

1. close L3-1 through L3-3 with hostile VM regressions;
2. replace unsafe resource defaults and raw source fragments with typed,
   fail-closed semantics;
3. implement complete invocation/intent/result rows and emitter exhaustiveness;
4. prove a real two-artifact caller/callee settlement, then a surveyed corpus
   example;
5. independently review the revised covenant;
6. verify BCH-2026 consensus and standard-policy deployability;
7. correct documentation to distinguish implemented properties from isolated
   spikes and unimplemented research claims.

Until then, keep the feature default-off and label `src/layer3` experimental.
