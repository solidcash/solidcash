# Journal / message-bus: implementation-status and gap analysis

Author: Claude. Date: 2026-07-24. Baseline: `codex/state-bus-research` @ `1a324595` + the J5 fix in
this pass. Purpose: answer "is the journal/bus spec fully implemented?" against the three spec
documents, and record what was finished in this pass versus what is deferred by design.

## Verdict

**Not fully implemented - and it is not supposed to be.** The spec has two tiers:

1. **Approved v1 scope (Releases 0-5, `compiler-hidden-batch-v1.md`)** - the owner-local journal (R1-R3),
   owner-local SCB1 batch (R4), and one-repeated-external-callee route (R5). This tier is
   **substantially implemented and, after the J5 fix below, has no known covenant-accepted wrong-state
   or fail-open defect in an accepted/advertised shape**. Some source shapes remain unsupported and
   fail closed, and R5 remains default-off. This matches the frozen implementation checkpoint in the
   research doc (section 8, 2026-07-23); it is not a claim of complete Solidity-shape coverage.
2. **Deferred bus/graph (Layer 3 + Deferred Releases A/B/C, `buffered-state-and-message-bus-research.md`
   section 5/8; `invocation-transcript-v1.md`)** - the general multi-participant transcript, cyclic
   participant graph (`A -> B -> A`, callbacks, flash loans), and delta aggregation. This tier is
   **explicitly not an implementation commitment** (research doc 5: "records possible layer 3
   semantics, not an implementation commitment"; 8: Deferred Release A "MUST NOT begin merely because
   Releases 0-5 pass"). It is un-started research, gated behind go/no-go criteria that are not met.

So "finishing the spec end to end in one go" is not achievable honestly: tier 1's accepted shapes
have a sound fail-closed boundary (this pass closes their last known fail-open gap); tier 2 is a
research programme whose revised design candidate is still unmeasured and unfrozen under current BCH
limits (see "Why the bus is not a one-pass item"). This pass finishes tier 1's outstanding soundness
item and records the unsupported shapes and deferred work explicitly.

## What was finished in this pass

**J5 (fail-open event loss) - FIXED end to end.** A returning helper that emits an event but does not
itself write state (e.g. `function log(v) internal returns (int) { emit E(v); return v+1; }`) survives
as an `OP_INVOKE` subroutine - void emit helpers are force-inlined, returning ones are not - and the
subroutine epilogue returns before event settlement, so the event was **silently dropped** (confirmed:
the shape compiled with the event absent from all ABI `emits` metadata, so no event output is built or
required on-chain). The guard in `GenerateTargetTraversal.ts:computeScalarJournalClosures` only checked
*state-writing* returning helpers; the fix removes the `writes.value` precondition so **any** returning
internally-invoked helper that emits is rejected at compile (fail-closed), matching how the
state-writing case was already handled. Regression test added (`ScalarJournal.test.ts` "rejects a
returning emit helper (no direct state write) invoked from a journal handler"). This turns the
last fail-open journal residual into a fail-closed compile error.

With J5 fixed, **no known fail-open (covenant-accepted wrong state, or silent divergence) defect
remains in an accepted/advertised v1 shape.** Every documented residual is fail-closed (below).

## Release-by-release status (approved v1)

| Release | Status | Notes |
|---|---|---|
| R0 diagnostics + cost evidence | Implemented | Invocation analysis, impossible-chain diagnostics, frozen `BatchCostRegression` measurements. |
| R1 scalar stateful subroutines | Implemented for advertised shapes | Read-your-writes + single-flush covenant-enforced; hostile-override / forged-flush VM-tested. Unsupported effect shapes fail closed. |
| R2 scalar recursion + handler ABI | Implemented for advertised shapes | `recursiveStateHandler` + SDK concrete-VM preflight; over-budget rejected before broadcast. |
| R3 mapping/bytes/array journals | Implemented for advertised shapes after J1/J2/J5 fixes | J1 inflation and J2 burn (both were covenant-accepted) fixed and VM-regression-locked; J5 event loss fixed this pass. Early-return and some multi-return shapes remain fail-closed rather than feature-complete. |
| R4 owner-local SCB1 batch | Implemented for advertised shapes | Positional selector + whole-blob equality + parser exhaustion; adversarial VM negatives with positive controls. |
| R5 one repeated external callee | Implemented experimentally, default-off | Caller/callee blob binding, one B settlement, exact two-row parameter-authorized transfer resource route. Stays default-off per graduation gates; standard `msg.sender`-authorized `transferFrom` remains unsupported. |

## Remaining approved-v1 follow-ups (all fail-closed; none block soundness)

- **J2 exit-aware flushing (future work, per spec).** Multi-entry journal wrappers containing an early
  `return` are **rejected at compile** rather than flushing entry write-backs before each exit. This
  is sound (fail-closed) but restrictive - a guard clause `if (x) return;` before the final `require`
  in a wrapper that calls a multi-entry helper does not compile. Deliberately not implemented in this
  pass: exit-aware write-back sinking is control-flow surgery in the exact code whose reorder caused
  the original J2 fund-burn, with subtle interactions with `EarlyReturnTransformation` (which runs
  later), nested returns, loops, and value-returning wrappers. Safe implementation sketch for a future
  pass: replace each `ReturnNode R` in the wrapper body with a `Block[ ...clonedWriteBacks, R ]`
  (node-level replacement, not statement-list insertion), keep the fall-through write-backs at the
  end, and add VM regressions proving the original burn repro now settles correctly across
  early-return / nested-return / loop-return / value-return shapes. Until then the rejection is the
  correct interim.
- **J3 diagnostics.** A deploy (`new`) or a transitive cast-form external call `IFoo(x).m()` inside a
  scalar-journal-eligible helper fails **closed** but with a confusing internal error ("Block layout
  not available", a param-arity mismatch) instead of a clear "not supported in a journal handler"
  rejection. Robustness/UX only.
- **J4 diagnostics.** A multi/non-tail-return returning state-array writer fails **closed at the VM**
  (`mandatory-script-verify-flag-failed`) rather than at compile. Should become a compile-time
  rejection. Robustness/UX only.
- **F5 test.** The R5 missing-caller negative is over-determined (it `splice`s out A's whole master
  input, so it fails on value/token conservation + index shift, in a callee with no `msg.sender`
  check). Replace with a caller-LBC-swap test in the `msg.sender`-keyed C2 scenario. Test-quality only;
  the caller/callee binding soundness stands via the target-substitution and forged-settlement
  negatives. See `compiler-hidden-batch-v1-audit.md` F5.

## Deferred by design (tier 2) - not startable in one pass

These are **not** unfinished v1 implementation; they are a separate, gated research programme.

- **General participant graph / multi-participant transcript (Deferred Release A).**
- **Circular participant graphs: `A -> B -> A`, callbacks, flash loans (Deferred Release B).**
- **Delta aggregation (numeric / token-balance / allowance) - deferred beyond v1.**
- **`msg.sender`-authorized ERC-20 `transferFrom` batching** - batch-ineligible because a
  `msg.sender`-sensitive handler is route-sensitive (introspection divergence). The implemented ERC-20
  resource route is parameter-authorized (`spender` param), which graduates the multi-entry
  journal/resource layout, not standard ERC-20 authorization.

### Why the bus is not a one-pass item

The current layer-3 candidate (`invocation-transcript-v1.md`) incorporates corrections from its first
audit, but remains deferred because its revised covenant and bounds have not been implemented,
measured, or independently verified:

1. **Participant binding was corrected in the candidate, but is unimplemented.** Revision 1 allowed
   a fabricated participant to forge logical `msg.sender`. Current structural invariant 15 instead
   requires every participant row to bind its declared owner/executor locking bytecode, category,
   capability, SCB1 route, and controller prefix to actual co-spent inputs. This closes the prose-level
   revision-1 gap; a format spike and independent covenant review must still prove the implementation.
2. **Capacity bounds were revised, but are unmeasured.** The old draft's maxima expanded to roughly
   57 KB against an 8,192-byte cap. The current candidate makes encoded length authoritative and
   proposes simultaneous ceilings of 8 participants, 24 invocations, and 24 resources. Those are
   candidate ceilings, not evidence that realistic payload distributions fit or execute.
3. **Instruction budget remains a measured constraint.** Under `BCH_2026_05`, an input's operation budget is
   `800 * (41 + |own unlocking bytecode|)`, i.e. roughly `8 * |unlocking|` instructions; `OP_SPLIT`
   charges full item length, so transcript parsing must be strictly front-consuming single-pass (~9%
   of budget) - random-access or pairwise-uniqueness shapes measured 1.7-20x over budget.
4. **Contract size.** The parameter-authorized two-row ERC-20 route already compiles to 9,775 bytes
   (225 under the 10,000 limit); a general graph covenant is far larger and hits the deploy wall.

Concrete path if the project wants to pursue tier 2: (a) implement a format/cost spike for the
candidate's corrected transaction-binding and streaming-validation invariants; (b) measure realistic
payloads against the 8,192-byte, operation, script, and transaction limits and revise the candidate
ceilings if necessary; (c) obtain an independent review of the measured covenant; (d) prove the
smallest useful acyclic corpus gate before Deferred Release A, then the Unicrow callback gate before
Deferred Release B. Each is a separate adoption decision, which is why the spec gates them.

## Validation

Build green (six packages). Full compiler suite re-run after the J5 fix (see run log). Focused gates
reproduced this session: `CollectionJournalRelease3` 14/14, `ScalarJournal` (now 6/6 incl. the new J5
regression) + `CollectionJournal` 17/17 total, `HiddenBatchRelease4` + `RepeatedExternalBatchRelease5`
29/29; full SDK suite 3,261 pass / 24 skip / 9 todo (pre-fix baseline; the J5 change is compiler-only
and rejects one previously-miscompiled shape). Worktree carries only the J5 source+test change and the
audit docs.
