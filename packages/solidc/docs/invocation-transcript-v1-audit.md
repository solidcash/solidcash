# Audit: state-journal, hidden-batch, and transcript documents

Status: ADVERSARIAL AUDIT, REVISION 3. Covers `buffered-state-and-message-bus-research.md`,
`compiler-hidden-batch-v1.md`, and the deferred `invocation-transcript-v1.md`.

Baseline audited: worktree `.worktrees/state-bus`, branch `codex/state-bus-research`, HEAD `d36116aa`.
Consensus baseline: `BCH_2026_05` (repo default, `packages/solidcash/src/libauth-template/utils.ts:9`).

Verdict on revision 3: the release plan is now in good shape and I have no structural objection to it.
The whole-blob equality fix is correct and is the right shape. It relocated all of the protocol's
weight onto one step that remains unspecified, which is this revision's principal finding. Two smaller
new findings and five carried-over items follow.

---

## 0. Disposition of revision 2 findings

| rev 2 finding | disposition |
|---|---|
| HIGH: caller never proves complete blob consumption | **Fixed, and fixed the stronger way.** `compiler-hidden-batch-v1.md` 4.2 step 4 now requires a single whole-blob equality assertion; prefix equality and unchecked trailing bytes are explicitly forbidden. |
| HIGH: research invariant partition contradicts the batch protocol | **Fixed.** Research 9 is now an atomic, per-release-tagged table which MUST generate the checklist and hostile-transaction suite. |
| Release 5 has no adversarial review gate | **Fixed.** New "Covenant protocol boundary" section, dedicated security review before Release 4 begins, plus separate adversarial review for R4 and R5 with named attack classes. |
| Release 0 measurement omits the caller side | **Fixed.** Gate 1 now separately measures B's parser, A's accumulator, and A's extraction/comparator. |
| A1: record the colocation budget rationale | **Adopted.** Batch protocol 3, lines 88-94, including the replication-versus-shared-source rule. |
| M1: blob position in unlocking bytecode unspecified | **Not fixed. Escalated to HIGH, see section 1.** |
| M2: transaction-introspection divergence undocumented | Not fixed. |
| M3: `invocationCount:u8` has no enforced ceiling | Not fixed. |
| M4: `callsiteId`/`occurrence` unverified | Downgraded to cosmetic. A now commits to them in the whole-blob equality, so they are pinned rather than unvalidated. They remain payload no covenant reads. |
| M5: version retention asserted bounded, never bounded | Not fixed. |
| M6: Release 5 scope ambiguities | Not fixed. |

---

## 1. High: the whole-blob proof is only as good as the extraction rule, which is unspecified

Section 4.2 step 4 requires A to assert equality between its expected blob and "the single canonical
blob extracted from B's actual unlocking bytecode". Section 3 says the blob is "one canonical push in
the batched owner's unlocking bytecode".

Neither states **which push**. The deferred candidate pinned this for its carrier ("the first item
pushed by its unlocking bytecode", with shortest-valid pushdata). The batch protocol dropped that
precision at exactly the point where it became load-bearing.

The equality proves A's expected blob equals *whatever A extracted*. It binds B's execution only if
A's extraction rule and B's parse rule identify the same bytes. If they can diverge, the proof is
vacuous.

Concretely, if the extraction rule is content-based ("the push beginning with magic `SCB1`") rather
than positional, an attacker crafts an ordinary application argument whose bytes begin with `SCB1`
followed by the row set A expects. A extracts the decoy and its equality passes. B parses the real
blob at its own position, which carries an extra `transfer` row. The injected row executes with A's
authority. This is revision 2's finding reconstituted through the extraction step.

A content-based rule is also fragile in the benign case: any application argument that happens to
begin with those four bytes changes which push is "the blob".

### Fix

Pin the position structurally and state the identical rule for both sides:

- the blob MUST be the *first* push of the batched owner's unlocking bytecode;
- it MUST use the shortest valid pushdata encoding, and other encodings are rejected;
- A extracts by that positional rule, not by scanning for magic;
- B parses that same position and MUST reject a transaction where its own first push is not a
  well-formed blob;
- the magic remains a format check, never a locator.

This is the single highest-value change outstanding. Everything else in section 4.2 is sound once the
two sides provably read the same bytes.

---

## 2. Medium: use byte equality, not hash equality

Step 4 specifies `hash256(expectedCompleteBlob) == hash256(actualCompleteBlob)`, and section 4.2
justifies exhaustiveness "under the hash collision-resistance assumption" (line 130). Release 5's own
adversarial review list now includes "hash-domain ambiguity", which is a symptom of the choice rather
than a reason for it.

Both operands are already stack items: A materialises the expected blob by accumulation (step 3) and
extracts the actual blob (step 4). A direct `OP_EQUALVERIFY` on the two byte strings is cheaper than
two `hash256` calls, and it removes a cryptographic assumption from the core soundness argument
entirely. There is no domain to separate and no collision question to review.

Byte equality is available here because both blobs are bounded well under the 10,000-byte stack item
limit. Hashing is the right tool when one side is only a commitment; here neither side is.

**Fix:** specify direct byte equality, delete the collision-resistance sentence, and drop
"hash-domain ambiguity" from the R5 review list because it will no longer exist.

---

## 3. Medium: signature semantics under batching are unanalyzed

Section 7 lists signatures as initially batch-eligible. Neither document analyzes how in-handler
`checkSig` interacts with a route the signature cannot see.

The certain part is a BCH fact: signature hashing does not cover unlocking bytecode, and `scriptCode`
is the same redeem script whether the unlocking bytecode selects the ordinary direct wrapper or the
reserved `SCB1` route. A signature therefore **cannot by itself distinguish which route ran**. The
same holds between two different source selectors today, so this is a pre-existing property of the
dispatch model rather than something batching invents.

What batching changes is the size of the space it matters over. A signature is bound to a route only
transitively, through the outputs it does cover. Batching is precisely the feature that lets several
handlers combine into one transaction, so it materially widens the set of distinct executions that can
produce identical outputs, and with it the chance that a signature authorizing one intent also
validates another.

I did not trace SolidCash's existing signature binding far enough to claim this is exploitable, and it
may well be covered by state outputs differing in every realistic case. It should not be left implicit
in a protocol whose review gate is being written now.

**Fix:** add an explicit analysis section stating what binds a signature to a route, and add a hostile
test to the R4/R5 suites for signature reuse across the direct and `SCB1` routes and across two
batches with equal outputs. The deferred candidate carried a version of this warning ("the SDK MUST
generate signatures against the transcript handler body and physical input, not reuse a direct-route
signature blindly"); it was lost in the split and should be restored in stronger form.

---

## 4. Carried over, still open

**C1. Transaction-introspection divergence is undocumented.** Batch protocol line 168 states that
introspection keeps current physical meanings, which is true and understates the consequence. A
handler asserting `tx.outputs.length == 2`, or reading `this.activeInputIndex`, behaves differently
when batched, and section 7's eligibility list does not mention introspection at all. The deferred
candidate carried a full language-behavior table for this. Port it, and make introspection-dependent
handlers either batch-ineligible or explicitly documented as observing the batch transaction.

**C2. `invocationCount:u8` has no enforced ceiling.** The wire admits 255 rows. Section 9 metadata
carries `maximumRows`, but nothing normatively requires B to reject an over-count blob before parsing.
Add an explicit early bound check rather than relying on operation-cost exhaustion.

**C3. Version retention is asserted bounded and never bounded.** Section 2 argues compatibility is
"bounded because an artifact is never required to retain an unbounded set of historical routes"
without stating the bound. Each retained route is another parser in a contract near the 10,000-byte
wall. Set a hard cap, count retained routes in the Release 0 measurement, and note that the
deprecation cliff falls hardest on long-lived callees: a token new callers can no longer reach is
worse than a caller that cannot reach new tokens.

**C4. Release 5 scope ambiguities.** Three, all in the highest-risk approved release:

- May A batch two *different* callees, `A -> B x2` and `A -> C x2`? Section 1 and section 7 both
  constrain callers, not callees. It should be allowed, the shape stays a tree, and it covers more
  corpus, but A then needs one accumulator and one equality per callee.
- May B make a forward external call to D? Section 7 rejects callbacks and cycles, and is silent on
  forward depth.
- May Release 4 and Release 5 compose, so that a locally batched A also calls B repeatedly? Nothing
  rejects it and nothing describes it. A's accumulator would span its local rows.

**C5.** "This is the final approved synchronous scope" in Release 5 sits oddly beside deferred
releases A, B, and C, which are also synchronous. Read as "final *approved*" it is fine; one clause
would remove the ambiguity.

---

## 5. On the release plan

I have no structural objection remaining. The additions since revision 2 are the right ones and are
better than the usual practice in this kind of plan:

- The **"Covenant protocol boundary"** section names the 0-3 versus 4-5 transition explicitly and
  states the asymmetry correctly: earlier releases fail by rejecting source, later ones can fail by
  accepting a hostile transaction.
- A **dedicated security review before Release 4 begins**, covering the encoding, parser,
  exhaustiveness check, version behavior, and budgets, rather than only reviewing the result.
- **Per-release adversarial review with named attack classes.** R4 names parser ambiguity, unchecked
  suffixes, row-count substitution, selector confusion, output substitution, limit bypass. R5 names
  conditional injection, unchecked suffixes, count substitution, hash-domain ambiguity, target
  aliasing, effect substitution. Naming the classes up front is what makes such a gate real.
- Release 0 now measures all three cost centres separately, and the encoding freezes against those
  numbers rather than against estimates.
- Releases 1-3 remain independently valuable and *reduce* contract size, so the early increments pay
  down the budget the later ones spend.

Two remaining plan-level notes. R4-plus-R5 composition (C4) is unassigned to any release. And the R5
review list should lose "hash-domain ambiguity" once section 2 is adopted, and gain "blob extraction
position" per section 1, which is a strictly more dangerous class than several already listed.

---

## 6. What is right

- The whole-blob equality is the correct primitive: it collapses omission, injection, reordering,
  argument substitution and count substitution into one assertion that cannot be partially satisfied,
  and it handles conditionals and loops without special cases.
- Dropping the participant table for the existing category-plus-actual-locking-bytecode model remains
  the decision that makes revision 1's critical finding structurally impossible rather than patched.
  Verified against codegen (`GenerateTargetTraversal.ts:18688-18692`), not prose.
- The invariant table is now generative rather than descriptive, which is the property that would
  have prevented revision 2's finding from being possible to miss.
- Recording *why* the blob is colocated with its parser, in budget terms, means the next protocol
  decision starts from measurement rather than from intuition.
- Rejecting my commitment-carried tier-0 proposal on correct grounds in revision 2, and keeping the
  nulldata variant as a future comparison rather than adopting it now, was right both times.
