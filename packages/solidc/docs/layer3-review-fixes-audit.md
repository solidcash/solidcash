# Audit of Layer-3 review fixes

Date: 2026-07-25  
Target: `e3ab7c26f7ee9ad31aed50909c4681b3b4f38714`  
Reviewed commits: `c1a258e4`, `e3ab7c26`  
Disposition at reviewed target: **direct covenant attacks fixed; native-call transcript claim remained open**

## Subsequent resolution (2026-07-25)

The accepted probes recorded by this audit were retained and flipped to rejection
tests. Commits `2a8e98e8`, `6e160b5c`, and `11477b44` close the actionable
findings as follows:

- F1: `externalCalls.length` must equal `calleeSlots`; omission and surplus fail
  during generation.
- F2: every callee slot is bound to the exact committed locking bytecode and
  the positional minimal selector push in its actual unlocking bytecode. Native
  rows require a dispatched, multi-entry callee because a single-entry artifact
  legitimately elides selector dispatch.
- F3: the row commits the physical caller input, callee address, selector, and
  exact minimally encoded selector/argument prefix. The covenant compares the
  entire prefix with the actual callee unlocking bytecode. Physical callers
  must precede their callee slot and are identity-bound to the participant or
  preceding callee input.
- F4: the transitive fixture commits both A -> B and B -> C. B is named by its
  physical callee-slot input, and both selectors, visible arguments, and
  synthesized co-spend indices are bound.
- F5: balanced event outputs now use SolidCash's standard category-branded
  anonymous event-NFT covenant, including its 144-block CSV cleanup path,
  rather than the participant master covenant.

VM regressions now reject an omitted row, false selector, substituted argument,
wrong callee index, and omitted/incorrect transitive execution. This resolution
does not turn the bounded journal into a general VM or remove the documented
bounded-call eligibility rules.

The last manual-spec/compiler-auto-wiring boundary was subsequently removed by
`cf7dd5ad`: `deriveNativeExternalCalls` recursively consumes the compiler
artifact's `externalCalls` and `argSources`, resolves exact registered targets,
allocates physical slots, derives selector/argument prefixes (including
compiler-owned co-spend indices), and supplies the call statements injected by
`generateBalancedParticipant`. Derived tables are immutable and runtime-branded;
both public covenant-generation layers reject a manually authored table.
Expression-based, dynamic, pointer, loop, batch, returning, and signature-bearing
shapes fail closed until they have a transcript model.

## Summary

Commit `c1a258e4` correctly closes the two previously reproduced value/token
attacks:

- event outputs must now have `none` capability, zero fungible amount, fixed
  1,000-satoshi value, committed topic, and a fixed locking bytecode; and
- balanced state resources preserve locking bytecode, token category, satoshi
  value, and fungible amount.

It also requires an eight-byte journal input commitment, binds the complete
eight-byte output commitment, rejects negative final journal state, and makes
controller initialization set-once. Those are meaningful covenant-level
improvements.

Commit `e3ab7c26` does not close native-call transcript exhaustiveness. Two
additional BCH-2026 VM transactions are accepted:

1. a real native call with **no** `ExecutionExternalCall` row; and
2. a real `ping(int)` call whose committed row uses selector `deadbeef`.

The implementation commits caller/address/selector bytes to the root, but the
covenant only uses the address. It does not prove that every actual call has a
row, that the declared caller emitted it, or that the row selector equals the
actual dispatched selector.

## Verification

Focused fixes and audit probes:

```text
Layer3BalancedCall.test.ts    4 passed
Layer3BalancedEvents.test.ts  5 passed
```

The two accepted native-call bypasses are included in that green result as
audit evidence.

## Findings

### F1 - High: native-call rows are optional

`balancedMemberBody` permits:

```text
externalCalls.length <= layout.calleeSlots
```

and iterates only the supplied rows. It does not require equality or otherwise
prove that every callee slot corresponds to exactly one committed row.

The VM accepts the original native `ISink(...).ping(7)` transaction with:

```text
calleeSlots = 1
externalCalls = []
```

The compiler's native call covenant still authenticates the local call target,
but the controller execution root contains no native-call row. Therefore an
application can add a native call without changing the claimed exhaustive
transcript.

Required correction: derive the row count and rows from compiler external-call
metadata. At minimum require a bijection between active native-call slots and
committed rows, including repeated occurrences.

### F2 - High: committed native-call selectors are labels

For each external row, the balanced membership code enforces only:

```text
tx.inputs[calleeBase(k)].lockingBytecode == committed calleeAddr
```

It never consumes `x.selectorHex` after hashing it into the root. The caller's
actual native dispatch verifies its compiler-selected method independently.

The VM accepts a transaction which really executes `ping(int)` while the
controller root commits selector `deadbeef`.

Required correction: compare the row selector with the actual selector
authenticated by the caller/callee native-call machinery. The authoritative
selector must come from compiler ABI metadata for the exact signature
(`ping(int)`), not `methodSelector('ping')`.

### F3 - High: caller identity and row occurrence are not connected

`ExecutionExternalCall.caller` is encoded into the root but is not used by
`balancedMemberBody` to prove which participant emitted the call. Rows are
mapped to callee slots by array index alone.

There is also no callsite/occurrence identifier, so repeated calls cannot be
bijectively reconciled with compiler external-call slots.

Required correction: bind each row to:

- participant caller position;
- compiler callsite/occurrence;
- callee slot;
- actual selector;
- canonical arguments;
- call mode;
- result slot, if returning; and
- dependency order.

The caller must verify its complete row projection and each callee must verify
the rows it executes.

### F4 - Medium/high: transitive native calls are not exhaustively represented

The transitive fixture commits only A -> B. It describes B -> C as
"transitively bound" because B's locking bytecode embeds C's address.

Binding B's code is useful, but it does not make the external-call table an
exhaustive execution transcript. The table omits B -> C's selector, arguments,
occurrence, result, and dependency.

Either:

- make the transcript table exhaustive and include B -> C; or
- define the protocol as committing code identities while native code owns its
  internal call graph, and stop claiming exhaustive rows.

### F5 - Medium: the event output is still not the ordinary event covenant

The event output now locks to `lbc<emitter>`, the generated participant
executor. This closes arbitrary-address substitution, but it is not the
existing compiler event-NFT covenant with:

- event-signature identity;
- `none` capability;
- emitter category;
- 144-block CSV cleanup; and
- anyone-can-clean-after-expiry behavior.

The event becomes spendable only through whatever path the participant
executor permits in a future transcript. This is a different lifecycle from
the documented ordinary SolidCash event NFT.

Required correction: bind the exact artifact-derived event covenant locking
bytecode, not the participant execution locking bytecode.

### F6 - Remaining declared boundaries

The updated resolution document accurately acknowledges:

- the journal is a bounded `add|sub|mul` eight-byte counter DSL;
- state custody remains P2PKH in tests rather than a canonical state guard;
- topology, UTXOs, unlockers, and ordered slots remain developer supplied; and
- independent review is outstanding.

These are not closed requirements. They are acceptable as explicit research
bounds while the feature remains experimental and default-off.

## Confirmed fixes

The source and focused tests support the following narrower conclusions:

- event capability smuggling is rejected;
- event fungible amount and value are fixed;
- state satoshi/FT extraction is rejected;
- journal commitment tails are rejected by exact eight-byte framing;
- controller `setRoot` is set-once;
- native callee addresses can be committed and pinned to layout slots.

The last point is address binding, not complete native-call transcript binding.

## Original required next step (now resolved for the supported v3 call class)

Before claiming finding 6 closed, connect `ExecutionExternalCall` directly to
the compiler's `externalCalls` ABI entries and generate both sides of a
row/slot bijection. Add hostile VM tests for:

1. omitted row;
2. extra row;
3. wrong caller;
4. wrong callsite occurrence;
5. wrong selector;
6. wrong arguments;
7. swapped repeated calls;
8. omitted transitive row; and
9. wrong/missing return dependency.

At the reviewed target, the honest status was:

> The direct event/state attacks are fixed, and native callee addresses are
> root-bound, but native calls are not exhaustively represented by the
> transcript.

Current evidence superseding that target is listed in the subsequent-resolution
section above. Compiler-derived direct, repeated, and transitive callsites are
exhaustive for the supported v3 call class; unsupported classes reject before a
covenant is generated.
