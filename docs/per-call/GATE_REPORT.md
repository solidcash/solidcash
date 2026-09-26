# Gate report

Commit `9425481c5` on `feat/per-call` (the composition layer landed in `6df597fd3`, the API export and Log
rows in `ab2abd832`, the master prologue in `d90acd49b`). Recorded in `docs/per-call/PLAN_MARKETPLACE_66.md` section 7.

## Decision

**KILL.** The gate is not reached, so by the plan's own rule the work stops here and this report goes to the user
rather than a pass being claimed.

## Why

The gate asks the acceptance toys and shapes to settle under generic rules, with the hostile suite green and the
reference model agreeing with the shipped script. Two of those need code generation that does not exist:

- **Stream C** (master frames and calls) would emit each entry point as a self-recreating master whose frame
  fields come from its witness block. Not implemented.
- **Stream R** (records, view mode) would answer state reads from a segment view rather than from a spent
  commitment. Not implemented, and it is the plan's own stated main risk with a single coder.

Both are changes inside the compiler's main traversal (`GenerateTargetTraversal.ts` is 37,918 lines) and the plan
sizes them at 5–7 weeks with four coders. The gate's "no per-shape special case" clause therefore cannot be
evaluated: there are no compiled per-call artifacts to inspect.

Two further gate items are also unavailable: the hostile suite's rejection tests are written against the
derivation rather than a script, and the reference model agrees with the derivation rather than with `V_TEMPLATE`,
because `V_TEMPLATE` itself is not implemented.

## What the gate does rest on

| Item | State | Evidence |
| --- | --- | --- |
| Interface frozen, version 1, pinned by vectors | done | `packages/utils/src/per-call/`, `packages/utils/test/per-call/vectors/`, 113 tests |
| Validator decision procedure V1–V11 | done | `packages/solidc/src/per-call/validator/`, 25 tests including one hostile test per check |
| Independent reference model, differential agreement | done | 240 generated compositions over two seeds; zero accept/reject, check or order disagreements |
| Golden re-entrant composition | done | accepted at the section 5.1 indices with the section 8 derived order |
| Composer derivation, assembly, layout, refusals | done | `packages/solidcash/src/per-call/composer/`, 35 tests |
| Record reuse claim tested rather than assumed | done, one divergence | `packages/solidc/test/per-call/records/`, 29 tests |
| Master ownership and recreation checks, VM-proven | done | `packages/solidc/src/per-call/master/prologue.ts`, 12 VM tests in `packages/solidcash/test/per-call/frames/` |
| Compiler emits a per-call master | **done for one shape** | one inlined entry point, no external calls, no returns; 29 tests in `solidc/test/per-call/master` |
| A compiled master is deployed and spent | **done** | `solidcash/test/per-call/frames/compiled-master-spend.test.ts`: VM accepts the spend, three controls refused |
| Selector dispatch | **done** | a two-entry contract compiles to one master and both entries are spent |
| A callee compiles as well as a caller | **done** | both masters compiled, co-spent with a validator, accepted |
| The return check | **absent** | refused by name, now naming the entry |
| N1 and the call shape in the master | **done and reachable** | a calling contract compiles and publishes three placeholder offsets; VM-proven with three inputs co-spent |
| Segment and record settlement | **absent** | nothing after the call records is interpreted |
| The caller signature's hash type | **absent** | see Deviations: the check makes callers' unlocking bytecodes load-bearing |
| Record view mode (state settlement) | **absent** | state still read through today's direct covenant |
| Records read through a segment view | **absent** | — |
| Registry of the plan's own go/kill bounds (12K lines, 5 s Y2) | partly measurable | 1,366 compiler source lines added; composer suite ~2.6 s on a stub step |
| Tests, all green | done | 219 tests across six focused directories; the full build and the existing utils suite pass |

## Defects found and fixed

Three independent streams found the same defect in the frozen decoder: `decodeWitnessBlock` read a call record as
`kind, calleeRef, target, value`, while its own encoder wrote `kind, target, value, calleeRef`. No block containing
a call round-tripped. Fixed, and the consumer's local copy of the decoder was deleted in favour of the single frozen
codec — a second implementation of one wire format is exactly the divergence the format exists to prevent.

Two further rules this work had over-tightened were removed: a record created by a frame's first segment is
permitted (a frame may insert before it calls out), and the argument pushes are the pushes *between* the witness
block and the redeem script, not everything after the witness block.

The reuse proof found one spec divergence: section 20 states the direct-value case as a measurement of the canonical
encoding, while the shipped classifier decides it from the type, so `sig` and unbounded `bigint` mapping values are
stored verbatim and can exceed the 64-byte tail.

## Next step

## The precise blocker (recorded so it is not re-derived)

A master must take `msg.sender`, `address(this)`, `msg.value` and `tx.origin` from its witness block. Today each is
emitted inline from the transaction, and the sites are spread across the traversal and its symbol pass:

| What | Where |
| --- | --- |
| `msg.sender`, with `tx.origin` and minting-verification fallbacks | `GenerateTargetTraversal.ts:36133`, `:36247` |
| `msg.value` (stateless branch reads `OP_INPUTINDEX OP_UTXOVALUE`) | `:36178`, `:36198` |
| `address(this)` as `OP_INPUTINDEX OP_UTXOBYTECODE`, and `emitMasterInputIndex` as the base of every state and category read | `:12956`, `:33917` |
| `tx.origin` as a first-non-token-P2PKH scan | `:35884` |
| The synthetic frame parameter and its signature list | `SymbolTableTraversal.ts:3132`, `compiler.ts:10048` |
| Per-entry artifact slot (the artifact carries one `bytecode`) | `artifact.ts:1613`, `compiler.ts:14045` |

The return check has no mechanism at all — entry points encode returns as return-events rather than leaving them on
the stack to compare with `retval` — and the category pin and `addrX` are deployment-time while the prologue needs a
compile-time category, so the pin needs a placeholder the SDK fills.

Wrapping the traversal output with a prefix cannot work: the body would still compute the frame fields from the
transaction, so the emitted master would claim the per-call convention while violating W1, O1 and N1. That is why
the option refuses, and why the current state is the honest one.

## Next step

The shape the compiler can carry is now proven end to end, so the remaining work is no longer a question of whether a master can exist. What is left, in the order it unblocks: lower calls with arguments and return values rather than only checking them; emit the return check; add the caller signature's hash type; interpret segment and record settlement after the call records; and implement the record view mode so a stateful master settles against its segment view rather than today's direct covenant. Then the acceptance shapes can settle, which is what the gate actually asks for. The pin-and-recreate half of C2 is
done and VM-proven; what remains is to emit it as the head of a compiled master, add W0 (the first-push
self-check) and the selector dispatch, and then give the records stream its view mode. That is the smallest
increment that turns the composer's injected step into a real program run.
