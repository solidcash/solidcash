# Layer-3 implementation re-audit

Date: 2026-07-24  
Target: `991e205f082211b698f944b5abd9cfa756d39570`  
Prior audit: `layer3-production-audit.md` at `67542c54`  
Disposition: **Decision 2 for native external-call coverage; Decision 3 for the claimed complete message bus**

## Executive conclusion

The new commits improve the experimental scaffold and add valuable integration
coverage for SolidCash's existing native external-call machinery. They do not
close every prior finding and do not implement the originally researched
heterogeneous, cyclic N-party message bus.

The branch now contains two separate mechanisms:

1. native, independently compiled external calls, which successfully execute
   acyclic stars and chains; and
2. a new controller-attested, homogeneous, binding-only N-party covenant.

No implementation combines them. The first has typed calls but no N-party
mutual transcript. The second mutually binds clone participants but has no
calls, selectors, arguments, results, resources, application state, or
heterogeneous code. Evidence from the two mechanisms cannot be combined into a
claim that a heterogeneous N-party bus exists.

The headline “every audit finding is closed” is therefore false. The repository
documentation itself still says heterogeneous mutual peers remain open.

## Verification

The explicitly enumerated Layer-3 suite passed on the BCH-2026 VM:

```text
29 test files passed
109 tests passed
```

The six native-composition tests were also rerun successfully against the live
BCHN regtest stack:

```text
Layer3RealComposition.test.ts  4 passed
Layer3ResultChain.test.ts      2 passed
```

The regtest evidence is real, but the node runs regtest's default
`acceptnonstdtxn=1`; it proves consensus-node acceptance, not mainnet standard
relay policy.

An additional VM regression confirms a new controller-preservation defect:
reducing the controller output from 2,000 satoshis to 1 satoshi and redirecting
the remainder is accepted.

## Finding-by-finding disposition

### R1 — High: the controller's satoshi value is not preserved

`bindingFrameworkBodyControllerBound` preserves the controller locking
bytecode, token category, and NFT commitment, but does not compare its input and
output values.

The BCH-2026 VM accepts a transaction that recreates the controller NFT with one
satoshi and directs the other 1,999 satoshis elsewhere. The committed positive
tests always construct equal values and therefore did not exercise the
covenant boundary.

Correction: require
`tx.outputs[controllerIdx].value == tx.inputs[controllerIdx].value`, or bind an
explicit authorized delta and recipient.

### R2 — High: the N-party root is a participant-set root, not a transcript root

The controller commitment is:

```text
sha256(ordered participant locking bytecodes)
```

It does not commit invocations, selectors, arguments, occurrences, results,
resources, events, or execution order. The generated
`generateControllerBoundCovenant` handler accepts only participant input/output
pairs plus `controllerIdx`; it is explicitly binding-only.

Equality of the local unlocking prefixes ensures named clone participants agree
on those positional arguments. It does not turn the address-set root into an
execution transcript.

Under the external assumption that exactly one immutable controller NFT exists
for the baked category, the construction is a plausible homogeneous
participant-set attestation. It does not close L3-1 for a general message bus.

Correction: rename the primitive to participant-set binding and narrow its
claims, or define a domain-separated transcript root covering the complete
canonical execution and bind every heterogeneous participant projection to it.

### R3 — High: heterogeneous N-party mutual composition remains unimplemented

The native integration tests use independently compiled Kashi, Bento, Token,
and Oracle contracts. The N-party tests instantiate multiple copies of one
generated `Participant` artifact. No test or implementation runs different
compiled participant covenants under the controller-attested root.

`layer3-real-composition.md` correctly states that this deeper generalization
remains open. The completion handoff contradicts that committed qualification.

This is the central unresolved feature for circular calls. The native examples
are acyclic:

- Kashi to Bento;
- Kashi to Bento and Token;
- Kashi to Bento to Oracle.

They do not demonstrate A to B to A, repeated settlement of one physical
callee, callbacks, recursion, or cyclic state contention.

### R4 — High: the “real bus” commits contain tests, not a new bus implementation

Commits `b9afdc58`, `9958f41a`, and `1f636be7` modify only test files.
They exercise the pre-existing `IContract(addr).method()` compiler/SDK path and
are useful regression coverage. They do not connect that path to
`src/layer3`, the controller root, or a new transcript implementation.

The native path may be sound for the tested acyclic call shapes, but calling
these test additions implementation of the missing bus obscures the actual
scope.

Correction: describe these commits as integration proof for the existing
native external-call subsystem. Do not use them as evidence for properties
implemented only by the disconnected N-party scaffold.

### R5 — High: L3-5 is not closed for the N-party subsystem

Native external calls bind their own selector, forwarded arguments, callee
identity, and return event. The N-party controller covenant binds none of these.
The experimental `TranscriptSpec` still has `InvocationSpec { caller, callee }`
and its M4 remains a persistent callee allowlist.

There is no common canonical invocation ledger whose exhaustiveness is checked
by callers and callees. Consequently the complete invocation semantics of the
native path cannot be attributed to the N-party path.

### R6 — Medium/high: transition opt-out remains an unsafe raw-source boundary

Default resource commitment and satoshi preservation are genuine improvements.
L3-3 is closed for the experimental resource path.

For `transition: true`, however, the generator simply omits commitment
preservation and relies on the caller to supply a correct raw `appBody`.
Nothing requires that `appBody` bind the commitment at all. The production API
still exposes `appBody: string[]` and `valueExpr: string`.

This is fail-open after an SDK boolean, not the typed transition operation
required by the prior audit. L3-2 and L3-9 are therefore only partially
addressed in the scaffold. The native external-call path has a typed API, but it
does not remove the unsafe exported scaffold API.

### R7 — Medium: exact controller identity is not enforced

The controller category is baked into the participant covenant, but the
controller input's locking bytecode is not compared to an expected controller
covenant. In tests the controller is a P2PKH NFT. The participant root commits
participant addresses, not controller code.

Category authority can be a valid design if initialization proves a unique
mint-once NFT and destroys all minting authority, but that lifecycle is an
external assumption here and is fabricated by the mock test setup. The
implementation has neither a controller genesis API nor a uniqueness proof.

Therefore L3-7's claimed “exact-code controller identity” is not established.

### R8 — Medium: deployability is proven only for the native acyclic path

The live-node rerun validates the six native star/chain examples. It does not
run the controller-attested N-party subsystem because that subsystem lacks a
real mint-once controller genesis flow.

Mainnet policy acceptance also remains unmeasured because the regtest node
accepts non-standard transactions. L3-8 is closed only as consensus-node
evidence for the tested native shapes, not for the complete claimed system.

## Properties supported by evidence

- Default experimental resources preserve commitment and satoshi value.
- Named homogeneous participants compare identical positional binding blobs.
- Given an authentic unique controller NFT, the controller root attests one
  ordered set of participant locking bytecodes.
- Native two-contract, three-owner star, and transitive-chain calls execute on
  BCH-2026 and the live BCHN regtest node.
- Each tested callee's own covenant remains authoritative; the hostile
  over-debit and deep guard failures reject.
- The previously audited unique-master `msg.sender` hardening remains intact.

These are meaningful results. They justify retaining the work as experimental
building blocks and native-call regression coverage.

## Required path to a complete bus

1. Fix controller value preservation and implement a real, verifiable
   mint-once controller lifecycle.
2. Decide whether the controller attests only membership or the complete
   execution. Name and document the primitive accordingly.
3. Define a canonical, domain-separated execution root covering calls,
   arguments, ordering, results, resources, and events.
4. Bind independently compiled participant covenants—not clones of one binding
   artifact—to their authenticated projections of that root.
5. Prove emitter and callee exhaustiveness, unique logical state ownership, and
   resource transition authority.
6. Demonstrate repeated calls to one physical state UTXO, then the smallest
   heterogeneous cycle A to B to A. Reject unresolvable cycles at compile or
   derivation time.
7. Run the N-party lifecycle on BCHN and test standard policy with
   non-standard acceptance disabled.
8. Obtain the independent covenant review already required by the specification.

Until those gates pass, the honest status is: **native acyclic external-call
composition works for the tested shapes; homogeneous N-party membership binding
is experimental; the general cyclic message bus is not implemented.**
