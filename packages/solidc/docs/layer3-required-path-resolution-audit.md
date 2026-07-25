# Audit of the Layer-3 required-path resolution

Date: 2026-07-25  
Target: `8e94ebe377e518d79ccd87912cf1170097489ae6`  
Reviewed against: `layer3-required-path-audit.md`  
Disposition: **Decision 3 for production or full-path completion; retain as experimental research**

## Executive conclusion

This revision makes several genuine advances:

- the execution-root encoding is framed and the prior ambiguity is closed;
- selectors, arguments, results, events, and resource categories have typed
  rows in one SDK/covenant encoding;
- the bounded journal performs ordered arithmetic over one physical state slot
  and flushes once;
- a balanced A -> B -> A journal fixture exists;
- balanced participant bases and exact total slot counts are enforced;
- native single and transitive calls execute within balanced transaction
  shapes; and
- controller set-once and typed-transition length checks are fixed.

The branch is nevertheless not sound as a production bus. Two new
covenant-accepted defects were reproduced on the BCH-2026 VM:

1. an event slot accepts a **minting-capability NFT** as an event, creating a
   transferable additional minting authority; and
2. a journaled state slot permits its satoshi value to be reduced and the value
   redirected into change.

There are also still architectural separations:

- balanced native calls are not included in the controller's execution rows;
- the bounded journal is a small generated arithmetic DSL, not execution of
  arbitrary compiled methods;
- resource identity is category-only and does not bind a canonical state
  locking covenant or unique slot; and
- the event output is not an ordinary SolidCash event NFT covenant despite the
  documentation calling it one.

The independent review remains outstanding by definition. The review package
and harness are useful deliverables, not completion of that gate.

## Verification

The focused new implementation suite passed:

```text
12 test files passed
56 tests passed
```

This includes the framed module, bounded journal, balanced cycle, balanced
native calls, transitive calls, auto-derived index helper, layout criteria,
resource root, runtime rows, events, and static policy checks.

Two audit cases were added to `Layer3BalancedEvents.test.ts`. Both transactions
are accepted by the BCH-2026 VM:

- event output capability changed from `none` to `minting`; and
- journal state value reduced from 4,000 to 1,000 satoshis while change
  increases by 3,000.

## Findings

### Q1 - Critical: an event slot can create additional minting authority

`balancedMemberBody` authenticates only:

```text
event output category base == emitter resource category
event output commitment == committed topic
```

It does not authenticate:

- locking bytecode;
- NFT capability;
- fungible-token amount;
- satoshi value; or
- the compiler-generated event covenant/version.

The event fixture spends a minting NFT as B's state. That input can mint more
NFTs of its category. The VM accepts an event output with `minting` capability
while preserving the original minting state NFT. The transaction therefore
creates another minting authority at the builder-selected P2PKH address.

This is not merely an event-format mismatch. Whoever controls that output can
subsequently mint arbitrary NFTs and fungible tokens of the state category,
destroying category authority and resource uniqueness.

Required correction: reproduce the existing compiler event covenant checks:

- exact event locking bytecode for the event signature/version;
- capability exactly `none`;
- fungible amount exactly zero;
- category base exactly the authenticated emitter category;
- commitment exactly the ABI event encoding;
- bounded dust value, normally 1,000 satoshis.

Add hostile VM tests for mutable/minting capabilities, non-zero FT amount,
wrong locking bytecode, excessive value, wrong category, and wrong commitment.

### Q2 - High: state-resource satoshi value is not preserved

Balanced resources preserve locking bytecode and token category, but
`balancedMemberBody` never compares input and output values.

The VM accepts reducing a journaled state NFT from 4,000 to 1,000 satoshis and
increasing the final change output by 3,000. The journal correctly computes the
new commitment while allowing the state container's BCH to be extracted.

Required correction: preserve resource value by default. If resource value is
part of an explicit transfer, commit a typed delta and destination in the
execution row and verify conservation on-chain.

### Q3 - High: journal state commitment preservation is only eight bytes

The bounded journal reads:

```text
input commitment[0:8]
```

and verifies only:

```text
output commitment[0:8] == bytes8(journal state)
```

It does not require an eight-byte input/output commitment or preserve any bytes
after offset 8. A transaction can therefore alter or discard commitment tail
metadata while satisfying the journal.

This is especially relevant if the same NFT commitment later carries version,
slot, ownership, nonce, or other state fields.

Required correction: either require `input.length == output.length == 8` for
this journal version, or use a typed field transition which preserves every
byte outside the selected field.

### Q4 - High: resource authenticity remains category-only

`ExecutionResource` contains:

```text
owner, categoryHex
```

It does not commit:

- resource locking bytecode;
- logical slot/key;
- NFT capability;
- initialization/genesis identity;
- expected commitment framing/version; or
- uniqueness within the category.

Tests generally place resource NFTs at a P2PKH address and unlock them with a
user signature. Such a state NFT is controlled by that key outside the bus; it
is not a self-pinned data-NFT covenant whose only valid transition is governed
by the participant.

The documentation notes that production requires a uniquely genesised
category, but this is not represented in the API or lifecycle. The event test
instead deliberately uses a minting resource category, for which multiple
sibling NFTs are possible.

Required correction: bind the canonical data-NFT controller locking bytecode,
slot identifier, capability, and category lifecycle. Prove initialization and
multi-transaction transitions with the real state covenant.

### Q5 - High: native calls remain outside the execution transcript

`Layer3BalancedCall`, `Layer3BalancedAutoDerive`, and
`Layer3BalancedTransitive` all configure:

```text
invocations: []
```

while their generated `appBody` performs real `IContract(...).method()` calls.
The native compiler covenant authenticates each target locally, which is useful
and real. But the controller root commits no corresponding call row, selector,
arguments, occurrence, result, or ordering dependency.

Consequently these tests prove:

```text
balanced native calls work
```

not:

```text
the execution transcript exhaustively authenticates native calls
```

An application body can add a native call without changing the execution rows.
This leaves the earlier emitter/callee exhaustiveness requirement open across
the native and transcript systems.

Required correction: derive rows from compiler `externalCalls` metadata and
make the caller prove that the complete emitted native-call sequence equals its
committed projection.

### Q6 - High: SDK "auto-derivation" still requires manual topology and co-spends

`balancedCaller` derives the numeric input index from:

```text
layout.calleeBase(calleeSlot)
```

but the developer supplies:

- `calleeSlot`;
- the complete ordered slot array;
- callee UTXO;
- callee unlocker;
- callee output; and
- the layout's `calleeSlots` count.

This removes one hand-written physical integer. It does not discover the call
graph or required contracts/state from compiler metadata as SolidCash
auto-derivation normally does.

The name and documentation should distinguish layout-relative index filling
from full call/state auto-derivation.

### Q7 - High/scope: the journal is not arbitrary compiled-method execution

The bounded journal supports:

```text
one 8-byte field
add | sub | mul
compile-time literal argument/result rows
```

It does soundly demonstrate repeated ordered arithmetic and a structural
A -> B -> A dependency within that vocabulary. This is meaningful research.

It does not execute the bodies of `deposit`, `scale`, or `credit` functions.
`methodSelector(name)` is an internal journal opcode identifier; journal
dispatch maps it to a generator-selected arithmetic symbol. It is not the
actual native ABI dispatch selector and cannot represent conditionals,
mappings, strings/bytes overwrites, events, transfers, nested calls, arbitrary
returns, or general surveyed-contract behavior.

The response's final caveat acknowledges this boundary. Therefore P2/P3/P6/P7
are closed only for the bounded DSL, not for the original general message-bus
requirement.

### Q8 - Medium/high: event output is not an existing SolidCash event NFT

The positive event test sends the event token to a P2PKH token address. It does
not use the compiler-generated event locking covenant with its 144-block CSV
cleanup path.

Calling it an "ordinary event NFT" is inaccurate. As built, spendability and
ownership depend on the arbitrary output address selected by the transaction
builder. The covenant does not enforce anyone-can-clean-after-expiry behavior.

Required correction: use the artifact's event definition and exact generated
event-NFT locking bytecode.

### Q9 - Medium: balanced closure is global and shape-specific

The balanced layout implementation correctly gives declared participant blocks
equal input/output bases and rejects changes to the exact total slot count.

However, it describes one closed transaction:

```text
participant blocks + manually counted callee slots + controller + fee tail
```

Because every participant asserts the exact transaction input/output count,
composition with another independently derived protocol block requires all
blocks to share one precomputed global layout. It is not yet a relocatable
artifact block that can be concatenated without recompiling participant
covenants for the combined shape.

This is acceptable for a closed transcript, but narrower than general
late-bound contract composability.

### Q10 - Medium: arithmetic range semantics are not specified or guarded

The journal performs unbounded BCH integer arithmetic and casts the final value
to `bytes8`. There are no explicit domain checks for:

- subtraction below zero;
- multiplication beyond eight bytes;
- signed interpretation of high-bit inputs;
- negative arguments; or
- overflow policy.

The resolution document explicitly lists these as outside the tested domain.
They must be normative before the journal can safely process monetary state.

### Q11 - Medium: the static policy gate is incomplete

`Layer3BalancedStandardPolicy` checks:

- unlocking bytecode <= 1,650 bytes;
- NFT commitment <= 40 bytes; and
- token outputs >= 800 satoshis.

It does not check the complete standardness surface, including serialized
transaction size, redeem-script size, actual dust threshold per locking
bytecode, operation budget for every covenant input, standard script forms,
sigops, output policies, or mempool result.

The committed regtest harness is the stronger evidence. It mutates the compose
file, restarts BCHN with `-acceptnonstdtxn=0`, and broadcasts selected tests.
That is useful and reproducible, but it does not make the static test a complete
standard-policy oracle.

### Q12 - Process: the independent review is still open

The refreshed review package and attack list are appropriate inputs. They do
not satisfy an independent review gate. The response correctly concedes this,
so the overall path cannot be called fully reviewed or production-ready.

## Improvements confirmed

The audit confirms these corrections:

- P1: framed execution encoding is now unambiguous for admitted sizes.
- P4: arguments/results are present in the production row type and root.
- P5: resource categories are included in the root.
- P11: SDK and covenant reject typed-transition length mismatches.
- P12: controller root initialization is set-once.
- Ordered bounded journal computation and one-flush settlement work.
- A balanced bounded A -> B -> A fixture works.
- Balanced base arithmetic and exact slot-count closure work.
- Native single and transitive calls work within balanced shapes.
- A reusable policy harness is committed.

These are substantial and should be retained.

## Revised status

The honest status is:

> The branch implements a framed controller-attested transcript, a bounded
> arithmetic state-journal prototype, balanced closed transaction layouts, and
> separately authenticated native call composition. It is not yet a sound
> integrated general message bus.

Before external review, at minimum:

1. close Q1 and Q2 with hostile VM regressions;
2. bind exact resource and event covenants, capability, amount, value, and
   commitment framing;
3. connect native compiler call metadata to exhaustive transcript rows;
4. define journal overflow and state-width semantics;
5. prove the combined balanced path with real self-pinned application state;
6. expand the policy gate; and
7. update the review package to include these findings.

Keep the feature experimental and default-off.
