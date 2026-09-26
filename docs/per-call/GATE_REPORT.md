# Gate report

Commit `13aaad66c` on `feat/per-call` (the composition layer landed in `6df597fd3`, the API export and Log
rows in `ab2abd832`, the master prologue in `d90acd49b`, the validator program in `13aaad66c`). Recorded in
`docs/per-call/PLAN_MARKETPLACE_66.md` section 7.

## Decision

**Not yet due: continue to the deadline.** The gate is not reached, and a KILL was recorded here earlier on that
basis. That was premature. The plan kills only if the gate is not reached **within four weeks of the interface
freeze**, which is `2026-10-23`, with one two-week extension allowed when the first integration milestone is green and
every GO criterion holds. The deadline has not passed, so work continues to it, and no extension is claimed.

This section was corrected after review. The Log row that recorded the earlier KILL is left in place as history.

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
| Validator decision procedure V1–V11 **as TypeScript** | done | `packages/solidc/src/per-call/validator/`, 25 tests including one hostile test per check |
| `V_TEMPLATE`, the program that enforces those checks on chain | **started, running** | the first rules run in the machine: the validator recreates itself and a master of its category is spent (V1), the transcript's wire name, version and root count parse and every root index is in range (V2, partial), and the first root's category is the validator's (V9). `packages/solidcash/test/per-call/validator/script.test.ts` runs the real program against the real derivation over 400 generated compositions and one targeted case per enforced rule. V3–V8, V10, V11 and the rest of V2 remain TypeScript only |
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
| The tail after the call records | **done, structure only** | the segment section is walked and its entry shapes checked; the event and send sections are interpreted; T33 closed |
| Record settlement (comparing computed records with the declared views) | **absent** | the segment views are structure-checked, not chained on chain |
| A compiled entry that emits an event | **done** | the spend is accepted with the event at the listed output; seven refusals, each with a control |
| The caller signature's hash type | **done** | T20 closed: both accepted values pass, `NONE`, `SINGLE` and `ANYONECANPAY` refused on the compiled master |
| Record view mode (state settlement) | **absent** | state still read through today's direct covenant |
| Records read through a segment view | **absent** | — |
| Registry of the plan's own go/kill bounds (12K lines, 5 s Y2) | partly measurable | 1,366 compiler source lines added; composer suite ~2.6 s on a stub step |
| Tests, all green | done | the focused per-call directories pass together (42 files at this commit); the full build and the existing utils suite pass |

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

## A blocker that was recorded here and is now resolved

A master's frame values — `msg.sender`, `address(this)`, `msg.value` and `tx.origin` — are taken from its witness
block rather than read inline from the transaction. The sites this report used to list are no longer the obstacle:
the master head reads the block, checks it against the first push of its own unlocking bytecode, and the frame
values are VM-proven (`C4`, `C5`; `packages/solidcash/test/per-call/frames/`).

## What the shape does not have

- **The validator program, in part.** V1, V9 and the transcript's header and root indices run in the machine and are
  held to the derivation by a differential suite. V2's master-witness and settle-input parsing, V3–V8, V10 and V11 are
  still TypeScript checks with hostile tests and a reference model: the machine accepts their invalid transactions.
  The master-side tests outside the validator suite still spend a stand-in program whose hash the master recognises
  and whose rules it never runs.
- **The validator program's runtime budget.** The reference composition already sits at the published operation-cost
  density (800 per byte) before any program runs, so the program's own cost cannot fit inside it. A smaller program or
  unlocking padding is required on a real chain; the validator suite evaluates under the relaxed cost profile.
- **Records view mode.** A compiled master reads its records from the direct covenant rather than from its segment
  views, so no record chain is settled on chain, and state is still a single-contract matter.
- **Call-site compilation.** Calls are checked once in the head, from a descriptor derived at compile time, rather than
  compiled where they happen. That is why an admitted call takes only compile-time argument values, returns nothing,
  and is neither conditional nor repeated — and why every entry of a multi-entry master must make the same calls.
- **The return check.** Entry points encode returns as return-events rather than leaving a value on the stack to
  compare with the witness `retval`.

## Next step

The gate's deadline is `2026-10-23`, four weeks after the interface freeze. In the order that unblocks the acceptance
shapes:

1. **The validator program** (`V_TEMPLATE`), tested against the TypeScript checks that already exist, replacing the
   stand-in as each check lands. Started records view mode moved this from third to first, and it is now part-landed:
   the program exists and enforces V1, V9 and the transcript header and root indices, with a differential suite that
   grows a rule at a time. Next inside it: V3 (which masters point at this validator, which needs the witness block's
   `validatorRef`) and V4/V6 (the roots and the derived order), because the records chain needs the order. The
   per-input cost budget is the constraint to watch: a rule costs operations that the reference composition does not
   have spare.
2. **The rest of the records stream**: mapping nodes, their long values, dynamic values, and the value pin, on top of
   the settlement a standalone master already does and the chain the validator will do. The plan's kill criterion sits
   here: if the first two records items need rules outside the spec's record section, the effort is trending to a kill.
3. **Call-site compilation**: emitting each call's checks where it happens, so entries can differ and return values,
   conditionals and loops can come through.
4. **The remaining wire and spec gaps**: a listed send now names the record that pays it, so a value floor can be
   checked when sends exist; the spec correction is recorded in the Log.
