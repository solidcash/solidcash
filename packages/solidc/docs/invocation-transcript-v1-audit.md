# Audit: state-journal, hidden-batch, and transcript documents

Status: ADVERSARIAL AUDIT, REVISION 2. Covers `buffered-state-and-message-bus-research.md`,
`compiler-hidden-batch-v1.md`, and the now-deferred `invocation-transcript-v1.md`.

Baseline audited: worktree `.worktrees/state-bus`, branch `codex/state-bus-research`, HEAD `d36116aa`.
Consensus baseline: `BCH_2026_05` (repo default, `packages/solidcash/src/libauth-template/utils.ts:9`).

Verdict on revision 2: the restructure is sound and the release plan is a real improvement. One
exploitable gap was introduced by splitting the normative content across two documents, and the
invariant list in the research note now contradicts the batch protocol it governs. Both are cheap to
fix. The plan-level gap is that Release 5 moves funds across contracts and carries no adversarial
review gate, while the deferred layer 3 does.

---

## 0. Disposition of revision 1 findings

| rev 1 finding | disposition |
|---|---|
| CRITICAL: participant table unbound to transaction; `msg.sender` forgeable | Fixed. `invocation-transcript-v1.md:463` adds `tx.inputs[ownerInputIndex].lockingBytecode == ownerLockingBytecode`. Moot for the approved scope, which drops the participant table entirely. |
| HIGH: sort key admits two settlement authorities for one owner | Fixed. Sort key is now `(ownerLockingBytecode, stateCategory)` at `:282`. |
| HIGH: section 11 limits internally inconsistent by ~7x | Moot. No limits are frozen; the ladder now carries measured envelopes. |
| M1 `SCBH` rationale stated backwards | Moot for approved scope. Still present in the deferred candidate. |
| M2 `staticcall`, M3 foreign `outState` | Moot for approved scope; deferred candidate only. |
| M5 defer delta aggregation | Adopted (research 5.4, batch protocol 5). |
| A4 append-only write log | Adopted (research 3.1, batch protocol 5). |
| A6 per-rung capacity envelopes | Adopted (research 6.1). |
| A7 narrow the readiness claim | Adopted (research status line). |
| A2 tier-0 transcript in a 128-byte commitment | **Correctly rejected** (research 1, lines 127-130). An input commitment is pre-state and cannot carry the current transaction's transcript without a preparatory transition. My proposal was wrong. The surviving form of the idea is nulldata, noted in section 5 below. |

---

## 1. High: the caller never proves it consumed the whole batch blob

`compiler-hidden-batch-v1.md` section 4.1 requires the local-batch controller to prove "complete blob
consumption" (line 99). Section 4.2, the repeated-external-callee path, lists five steps and **none of
them is that check**. A "incrementally reconstructs or streaming-compares the expected B batch rows at
the original callsites" (line 112), which verifies each row A reaches, not that the blob contains only
rows A reached.

Attack:

```solidity
function pay() external {
    if (cond) { B(b).transfer(x, 100); }   // callsite 1, not taken
    B(b).transfer(y, 5);                   // callsite 2, taken
}
```

With `cond` false, A verifies exactly one row. A hostile witness supplies a two-row blob. B parses
both rows, executes both, and derives `msg.sender` for both from A's genuinely co-spent owner input,
which is legitimately present. B cannot detect the problem: it has no knowledge of how many calls A
intended. A cannot detect it either, because it only ever looked at the rows its own execution
reached.

The extra row executes with A's authority. Where A is a treasury, vault, or escrow, that is direct
fund theft.

This is not hypothetical machinery. I verified the caller-identity model in codegen
(`GenerateTargetTraversal.ts:18688-18692`): the callee verifies that an input with the supplied state
category and minting capability exists and returns *that input's actual locking bytecode* as
`msg.sender`. That is sound, and it is precisely why B accepts the injected row: A really is there.

Invariant 4 of the batch protocol ("every row executes exactly once in order and is checked by its
emitter and target") is intended to cover this and does not, because "checked by its emitter" is
satisfied per-row rather than over the whole blob.

### Fix, and the better fix

Minimum: add to 4.2 a sixth step, "A proves complete consumption of B's blob", and state it in the
invariants.

Better: make the failure impossible by construction. Have A accumulate an incremental digest over the
rows it emits, and require a single final equality against the digest of B's actual blob. This handles
conditional callsites and loops, which is presumably why the weaker streaming variant was offered,
while making omission, injection, reordering, and argument substitution one check instead of four. It
also removes the "reconstructs **or** streaming-compares" ambiguity, which currently leaves two
implementations with different security properties both nominally conforming.

---

## 2. High: the research note's invariant partition contradicts the batch protocol

Research note section 9 (line 741) states: "Invariants 1-4 and 8-10 govern the initial hidden batch.
Invariants 5-7 and 11-12 additionally govern a future general/asynchronous protocol."

That partition is wrong for three invariants which the approved scope requires:

- **Invariant 6** ("every declared outbound invocation has one matching inbound invocation; no
  undeclared invocation affects state or results") is exactly finding 1. It is assigned to the future
  protocol. It is the single most important invariant for Release 5.
- **Invariant 7** ("canonical order, callsite occurrences, arguments, and results are verified in
  script") is required by batch protocol invariant 4 and by Release 5's ship gate.
- **Invariant 12** clauses (a) "no cross-input intermediate state" and (b) "no two settlement
  authorities for one state object" are both required by Release 5, whose ship gate explicitly
  rejects duplicate physical B inputs. Only clause (c), unbounded cycles, is future-only.

Only invariant 5 (input-0 carrier) and 11 (asynchronous intents) are genuinely future-only.

This matters more than a documentation slip. Invariant lists become test checklists. A partition that
tells the implementer exhaustiveness is a layer 3 concern is how finding 1 ships.

**Fix:** split the composite invariants into atomic statements and re-derive the per-release mapping
mechanically rather than by prose ranges.

---

## 3. Medium findings

**M1. The blob's position in the unlocking bytecode is unspecified.** Batch protocol section 3 says
the blob is "one canonical push in the batched owner's unlocking bytecode". Which push? The deferred
candidate pinned "the first item pushed" for its carrier and required shortest-valid pushdata. A reads
B's unlocking bytecode through `OP_INPUTBYTECODE` and must locate the same bytes B parses. Specify
position, minimal encoding, and rejection of alternate spellings, or A and B can disagree about what
the blob is.

**M2. Transaction-introspection divergence is now undocumented.** The deferred candidate carried a
full language-behavior table (its section 8) stating that `tx.*` observes the bus transaction, not an
imagined per-call transaction. The batch protocol replaced this with one line: "`msg.sender`,
`tx.origin`, and transaction introspection keep current physical meanings" (line 154). True, and
misleading. A handler asserting `tx.outputs.length == 2`, or reading `this.activeInputIndex`, behaves
differently when batched, and section 7's eligibility list does not mention introspection at all. Port
the table, and make introspection-dependent handlers either batch-ineligible or explicitly documented
as observing the batch transaction.

**M3. `invocationCount:u8` has no enforced ceiling.** The wire allows 255 rows. Section 9 metadata
carries `maximumRows`, but nothing normatively requires B to reject an over-count blob *before*
parsing. Relying on operation-cost exhaustion is fail-closed but wasteful and untestable. Add an
explicit early bound check.

**M4. `callsiteId` and `occurrence` are witness fields nobody verifies.** They are A's compiler-internal
identifiers; B has no basis to check them and does not need them to execute rows in order. That is six
bytes per row of unvalidated witness data. Under the digest approach in finding 1 they become
redundant entirely. Either justify them as resync points for the streaming comparator or drop them.

**M5. Version retention is asserted bounded but never bounded.** Section 2 argues compatibility is
"bounded because an artifact is never required to retain an unbounded set of historical routes",
without stating the bound. Each retained version is another parser in a contract already close to the
10,000-byte wall, which is the constraint the whole plan is organized around. Set a hard cap, count
retained routes in the Release 0 measurement, and note that the deprecation cliff falls hardest on
long-lived callees: a v1 token that new callers can no longer reach is a worse outcome than a v1
caller that cannot reach new tokens.

**M6. Release 5 scope has two unresolved ambiguities**, both in the highest-risk approved release.
Is `A -> B x2` together with `A -> C x2` in scope? Section 1 says "one caller invoking the same
external state owner several times" and section 7 rejects "more than one external *caller* owner",
which does not answer it. It should be allowed, since each callee batches independently and the shape
stays a tree, and it covers more corpus. Second: may B itself make a forward external call to D?
Section 7 rejects callbacks and cycles but is silent on forward depth. State both.

**L1.** Batch protocol invariant 4 says every row is "checked by its emitter and target", but a
local batch (section 4.1) has no emitter; the origin rules authorize it. Reword per-path.

**L2.** Ladder rungs and release numbers are anti-correlated at the boundary: rung 4 (BentoBox) ships
in Release 4, rungs 1-3 ship in Release 5. Defensible, worth a note so readers do not assume alignment.

---

## 4. On the phased release plan

The restructure into independently shippable vertical slices is the right shape, and several details
are better than usual practice: "safe to stop at permanently", no dormant scaffolding, a capability
bit and byte-regression budget owned by the release that introduces it, and measurement before wire
freeze. Releases 1 through 3 genuinely stand alone, and they *reduce* contract size by de-inlining
stateful helpers, so the early increments pay down the constraint the later ones spend. That is a rare
and good property.

Three gaps.

**The 3-to-4 boundary is the plan's most important risk transition and is unmarked.** Releases 0
through 3 add no new covenant surface; they are compiler-internal and fail by not compiling. Releases
4 and 5 add transaction-visible protocol that fails by accepting a hostile transaction. The plan
applies uniform "ship gate" language across all six.

**Release 5 has no adversarial review gate.** Layer 3 gate 6 requires "an independent hostile-transaction
review" before the deferred protocol ships. Release 5 is cross-contract, moves funds under a caller's
authority, and introduces the first blob that two mutually distrusting covenants must agree on. It
gets a functional ship gate and no security review. Finding 1 is an existence proof that this scope is
capable of hiding a fund-theft bug. Add an equivalent gate to Release 5, and ideally to Release 4.

**Release 0's measurement list omits the caller side.** Batch protocol gate 1 measures "a hand-emitted
parser/dispatcher". Release 5 adds A's comparator or digest accumulator, which is separate code in a
separate contract with its own budget, plus whatever version-retention costs M5 identifies. Measure
all three in Release 0, since Release 4 freezes the encoding against those numbers.

---

## 5. Amendments and design proposals

### A1. Record why the blob lives in the callee's unlocking bytecode

The batch protocol made the right choice and does not say why, which will matter when the graph
protocol is reconsidered. BCH meters each input's budget as `800 * (41 + |own unlocking bytecode|)`,
and reading a byte costs 1. A participant that carries an N-byte blob in its own unlocking script
therefore *gains* 800N of budget and spends N to read it: an 800-to-1 return. The deferred carrier
design had this exactly backwards, granting the budget to an input at index 0 that does no parsing
while the participants that must parse got nothing for it.

The general rule this yields, worth stating in the research note: **co-locate a blob with the covenant
that parses it, and replicate it per participant while `N * T` stays small; a shared carrier is worth
its authentication surface only when replication threatens the 100,000-byte standard transaction
size.** At Release 5's N=2 and a blob of a few hundred bytes, replication is free.

### A2. The surviving form of the rejected tier-0 idea is nulldata

The rejection of commitment-carried transcripts (research lines 127-130) is correct. The variant that
survives it is the one the note already gestures at: for small blobs, an `OP_RETURN` output is readable
by every input through ordinary output introspection, needs no carrier input, no signer binding, and no
redeem-template verification. `maximumDataCarrierBytes` is 223, which comfortably covers a two- or
three-invocation blob. This is not needed for Release 5, where the callee's own unlocking bytecode is
better on budget grounds per A1, but it is the right first comparison for any future multi-participant
spike, and it deletes most of the deferred candidate's authentication surface.

### A3. Close finding 1 structurally, not procedurally

Restated from section 1 because it is the highest-value change available: replace "A reconstructs or
streaming-compares" with "A accumulates an incremental digest of every row it emits and asserts
equality against the digest of B's actual blob, once, at the end". Omission, injection, reordering, and
argument substitution all collapse into one check that cannot be partially satisfied, conditional
callsites are handled naturally, and `callsiteId`/`occurrence` (M4) fall out of the wire format.

### A4. Make the invariant-to-release mapping mechanical

Per finding 2, prose ranges over composite invariants produced a partition that contradicts the
protocol it governs. Split each invariant so it asserts one thing, tag each with the release from
which it applies, and generate the per-release checklist from the tags. The hostile-transaction suites
should be generated from that same table so a mis-tagged invariant produces a missing test rather than
silence.

---

## 6. What is right

- Dropping the participant table in favour of the existing category-plus-actual-locking-bytecode
  model is the correct call, and it is what makes revision 1's critical finding structurally
  impossible rather than merely patched. Verified against codegen, not just prose.
- Putting the blob in the batched owner's unlocking bytecode is right, for a reason stronger than the
  document currently claims (A1).
- Deferring delta aggregation, refusing to freeze wire bytes before measurement, and requiring each
  release to be permanently stoppable are all the conservative choice at the points where conservatism
  is cheap.
- The layer 3 go/no-go gates are unusually honest, particularly gate 4 refusing to accept a version
  byte as a migration strategy and gate 3 requiring measurement against artifacts already near the
  wall.
- Rejecting my commitment-carried transcript proposal on correct technical grounds, rather than
  adopting it, is the right outcome and improved the document.
