# Layer-3 required-path implementation audit

Date: 2026-07-25  
Target: `3a270bcda73390a0e0bd9a09e0e2e97f2991b0ac`  
Reviewed range: `0b1552a5..3a270bcd`  
Disposition: **Decision 3 - the required path is not complete**

## Executive conclusion

The additions provide useful experiments:

- a real mint-once controller genesis;
- exact controller locking-bytecode checks;
- heterogeneous scripts agreeing on a controller commitment;
- a one-shot controller option;
- a small typed field-delta transition;
- live BCHN coverage reported for selected shapes.

They do not implement the claimed execution-transcript bus. Several headline
properties are represented only as labels hashed into a controller commitment,
without being connected to the transaction's actual calls or state execution.

Most importantly:

1. the execution encoding is not canonical: two different semantic transcripts
   can produce exactly the same hash preimage;
2. the accepted "cycle" and "repeated callee" tests execute no calls at all;
3. committed selectors are not compared with dispatched selectors;
4. runtime arguments, results, and resources are not part of the production
   `ExecutionInvocation`/`executionRoot` API;
5. cross-edge ordering is explicitly unimplemented; and
6. the new path violates the newly adopted balanced-block and event-NFT design.

The review package itself acknowledges that ordering remains open. An external
review package is not completion of the required independent review.

## Verification performed

The focused committed suite passed:

```text
13 test files passed
53 tests passed
```

The count differs from the handoff's "59 tests across 13 files" for the stated
set. Test counts are secondary; the more important issue is what the tests
exercise.

Two additional regressions were added:

- an execution-root ambiguity demonstrating two semantic transcripts with the
  same root; and
- an SDK/covenant typed-transition disagreement when a commitment exceeds
  `TypedTransition.total`.

Both reproduce deterministically.

## Findings

### P1 - Critical: the execution-root encoding is ambiguous

The root preimage is an unframed concatenation:

```text
domain
|| participant locking bytecodes
|| caller_lbc || callee_lbc || selector
|| ...
|| emitter_lbc || topic
|| ...
```

There are no table counts, row tags, row lengths, or fixed selector-length
validation. `selectorHex` accepts any non-empty even-length hex string.

Consequently these two transcripts have the identical byte preimage and root:

```text
T1:
  invocation selector = selector || emitter_lbc || topic
  events = []

T2:
  invocation selector = selector
  events = [{ emitter, topic }]
```

This is not a SHA-256 collision. It is a serialization collision caused by the
absence of framing. The new unit regression proves
`executionRoot(T1) == executionRoot(T2)`.

The root is therefore not a canonical execution commitment and cannot safely
provide table exhaustiveness or type separation.

Required correction:

- version and domain-separate the format;
- include table tags and counts;
- use fixed-width participant identifiers and four-byte selectors;
- length-prefix every variable field;
- include row occurrence/order identifiers; and
- make one shared encoder authoritative for SDK and generated covenant code.

### P2 - Critical: the cycle and repeated-callee tests execute no calls

`Layer3Cycles.test.ts` creates contracts A and B whose functions only:

- recompute the controller root;
- perform trivial arithmetic over their own input values; and
- return successfully.

A never calls B. B never calls A. B has only one executed function, despite the
test claiming two calls to `B.f` and `B.g`.

The edges:

```text
A -> B selector 11111111
A -> B selector 22222222
```

or:

```text
A -> B selector 11111111
B -> A selector 22222222
```

are only bytes included in a hash. Acceptance proves that both inputs agree
about those labels, not that either invocation occurred, that two calls were
folded into one physical B execution, or that a cyclic dependency settled.

The original repeated-state and A -> B -> A requirements remain unimplemented.

### P3 - Critical: selectors are not bound to actual dispatch

`executionMemberBody` hashes the selector declared in the JavaScript
`ExecutionInvocation`. It never reads the participant input's unlocking
bytecode selector and compares it with that value.

The positive cycle tests intentionally use arbitrary selectors `11111111` and
`22222222`; the executed methods are `A.f()` and `B.g()`. The transactions
nevertheless pass.

This directly disproves callee exhaustiveness and invocation authenticity.
Position-binding a callee script does not prove that a committed method was
selected or executed.

Required correction: every invocation row must be checked by both sides:

- caller proves the row is one it emitted;
- callee proves its actual selected entrypoint, canonical arguments, occurrence,
  and result match the row;
- repeated rows are reconciled by a callee journal which executes all rows in
  order and flushes state once.

### P4 - High: runtime arguments/results are a bespoke test, not the module protocol

`ExecutionInvocation` still contains only:

```text
caller, callee, selectorHex
```

`executionRoot()` accepts only participants, invocations, and events. It has no
argument, result, resource, transition, or occurrence table.

`Layer3RuntimeArgs.test.ts` hand-writes a different covenant and a different
preimage formula inside the test. It does not use `executionMemberBody` for
runtime values and does not extend the production encoder or participant
generator.

This proves that one custom two-argument formula can be covenanted. It does not
prove that runtime arguments/results are folded into the implemented bus.

### P5 - High: resources and typed transitions are disconnected from the execution root

The typed transition was added to the older homogeneous `TranscriptSpec`
scaffold. `executionRoot` and `executionMemberBody` contain no resources or
transition rows.

Therefore the claim that resources are folded into the domain-separated
execution root is false. Evidence from the homogeneous resource scaffold cannot
be combined with evidence from the heterogeneous membership path.

The raw `transition: true`, `appBody: string[]`, and `valueExpr: string` escape
surfaces also remain exported.

### P6 - High: cross-edge ordering and data dependency are absent

The committed review package explicitly lists:

```text
Cross-edge ORDERING enforcement ... remains outstanding.
```

Hashing an ordered JavaScript array proves only agreement about array bytes. It
does not prove that edge 2 observes edge 1's result or post-state.

Without authenticated dependency edges and journal semantics, a structural
cycle has no execution meaning. This is a soundness requirement, not merely
ergonomics.

### P7 - High: "callee exhaustiveness inherent" is incorrect

An edge binding a callee participant position does not show:

- that the callee dispatched the committed selector;
- that every actual native call has a row;
- that every row was executed;
- that duplicate rows have distinct occurrences;
- that arguments and results match; or
- that no additional callee/input was used outside the first `n` positions.

The OP_RETURN count test covers only outputs beginning with `0x6a`. It does not
establish call exhaustiveness.

### P8 - High: auto-wiring does not exercise or derive native calls

`generateExecutionParticipant` is a source-string generator. It accepts:

- raw `appBody: string[]`; and
- optional raw `nativeCalls: Record<number, string>`.

The auto-wire VM test supplies no `nativeCalls` and executes no
`IContract(...).method()` expression. It proves automatic insertion of the
membership/root snippet, not automatic connection between native compiler call
metadata and transcript edges.

Because actual native calls add their own block-layout inputs, outputs, hidden
parameters, and return events, successful compilation and execution of the
no-call fixture is not evidence that the proposed generator composes with
native calls.

### P9 - High: balanced block-layout composability is not applied

The new execution path assumes:

```text
participants at inputs 0..n-1
controller at input n
events at outputs n+1+j
```

It does not use artifact block layouts, paired funding slots, or contract block
bases. `Layer3Exhaustiveness` has four inputs and five outputs and manually
inserts an OP_RETURN event. The one-shot path burns the controller without
authenticating the neutral output paired with its input.

This contradicts `balanced-block-layout-composability.md`, which requires:

- one contiguous balanced block per contract;
- paired funding inputs for output-only effects;
- identical input/output bases for later blocks;
- event NFTs rather than correctness-critical OP_RETURN records; and
- no SDK insertion outside compiler-assigned slots.

Until balanced layouts are integrated, these fixed global indices are not
composable with real journaled contract blocks.

### P10 - Medium/high: event exhaustiveness uses the wrong transport and global scope

The new path globally counts every OP_RETURN output and requires the count to
equal the transcript event count. This:

- prevents unrelated protocols or metadata from using OP_RETURN in the same
  transaction;
- requires a transaction-wide loop in every participant;
- does not use existing ABI event NFTs;
- creates permanently unspendable records; and
- is incompatible with balanced event slots unless paired funding inputs are
  added.

Event exhaustiveness should be defined over compiler-assigned event-NFT slots
within authenticated block bounds, not all nulldata outputs in the transaction.

### P11 - Medium: TypedTransition has an SDK/covenant length disagreement

The generated covenant rebuilds:

```text
input[0:offset] || updatedField || input[offset+width:total]
```

The SDK copies the entire input commitment and updates the field in place. No
side requires `inputCommitment.length == total`.

For a 17-byte input and `total = 16`, the SDK preserves byte 17 while the
covenant expects it to be discarded. The SDK-generated transaction is rejected
on the BCH-2026 VM.

This is fail-closed, but it disproves SDK/covenant agreement and the claim that
the module preserves every other byte for all admitted inputs.

Required correction: validate exact input length both in the SDK and covenant,
and test signed/unsigned delta bounds, underflow, overflow, and widths not
supported by bounded byte casts.

### P12 - Medium: controller `setRoot` is not set-once

The controller documentation says the deployer sets the root once. The covenant
does not distinguish an unset commitment from a set commitment and allows the
deployer to call `setRoot` repeatedly.

The deployer is an explicit trusted party, so this is not an outsider forgery.
It is nevertheless a mismatch between the lifecycle claim and enforced policy.
If immutability after initialization is required, the covenant must enforce an
unset-state marker or use a genesis commitment that never exposes a rewrite
path.

### P13 - Process: independent review remains outstanding

`layer3-review-package.md` is a useful handoff. It is not an independent
covenant review. The required path's item 8 is therefore prepared, not done.

The standard-policy result is recorded only as a documentation assertion after
temporarily changing and restoring node configuration. There is no committed
reproducible policy-test script or CI gate proving the node option and querying
the transaction's mempool acceptance. Treat it as useful manual evidence, not a
permanent regression.

## Supported conclusions

The evidence supports these narrower statements:

- A controller NFT can be genesised without minting authority on a real node.
- Participants can require its exact category, locking bytecode, commitment,
  and preservation.
- Two different locking scripts can agree on the same controller commitment.
- A one-shot controller can reject recreation of its category.
- A custom covenant can bind a particular amount/result formula.
- A small fixed-width field-delta transition works for exact-size commitments.
- Selected fixtures pass the BCH-2026 VM and reported BCHN policy run.

It does not support:

- a canonical complete execution transcript;
- actual repeated calls to one physical stateful callee;
- A -> B -> A execution;
- selector/call/argument/result exhaustiveness;
- ordered dependency settlement;
- balanced journaled block composition; or
- completion of independent review.

## Required next corrections

1. Freeze a framed, unambiguous, versioned execution encoding.
2. Integrate it into compiler-native external-call metadata, not raw generated
   source strings.
3. Bind actual dispatch selectors, canonical arguments, row occurrences, and
   authenticated results on both caller and callee.
4. Implement ordered callee journals for repeated rows and one physical state
   flush.
5. Represent cycles as dependency graphs with well-defined fixed-point or
   rejection semantics; do not equate graph labels with execution.
6. Fold resource identities and typed transitions into the same authenticated
   execution format.
7. Apply balanced artifact block layouts with paired funding inputs and
   event/return-event NFTs.
8. Make controller initialization/replay policy exact and reproducible.
9. Add a committed standard-policy harness.
10. Submit the corrected implementation for the independent review.

Until these pass, keep the feature experimental and default-off.
