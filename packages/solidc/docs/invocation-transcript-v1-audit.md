# Audit: buffered-state research note and invocation transcript v1

Status: ADVERSARIAL AUDIT. Reviews `buffered-state-and-message-bus-research.md` and the normative
`invocation-transcript-v1.md` it defers to.

Baseline audited: worktree `.worktrees/state-bus`, branch `codex/state-bus-research`, HEAD `d36116aa`.
Consensus baseline assumed: `BCH_2026_05` (the repo default, `packages/solidcash/src/libauth-template/utils.ts`).

Verdict: the security *model* is sound and unusually well posed. Two structural defects make a hostile
transaction accepted today, and the resource envelope is not merely a residual risk, it is the binding
design constraint and both documents get it wrong by roughly an order of magnitude.

The go/no-go in research note section 0.1 should be narrowed to Phase 0-1. The wire format must not be
frozen until the parser cost spike in A1 below is measured.

---

## 1. Critical: the participant table is never bound to the transaction

`ownerLockingBytecode` appears in the spec only three times: the wire definition (3.3), the canonical
sort key (3.3), and the definition of logical owner (5.1). It is **never compared against the actual
locking bytecode of the input it names.**

Section 4's fourteen structural checks bind ids, counts, ranges, tree nesting and sort order. None of
them reach the transaction. Section 5.1 has each participant verify only *its own* row. Section 6.1
step 2 has a caller authenticate its callee, but a fabricated caller never executes, so it
authenticates nothing.

Consequence: logical `msg.sender` is forgeable. Section 5.3 defines it as "the authenticated physical
owner locking bytecode of the parent invocation's target participant", read from the participant
table. The table is witness data supplied by whoever builds the transaction.

Attack:

```text
participant 0: ownerLockingBytecode = <p2sh32 of the token's privileged Minter>
               ownerInputIndex      = 1          // input 1 is actually attacker-controlled p2pkh
participant 1: the real Token, at its true input
invocation 0:  root -> participant 0 (never executes; nothing requires it to)
invocation 1:  child of 0, target participant 1, selector mint(attacker, 1e18)
```

The Token covenant validates the structure (everything passes), verifies its own identity, executes
invocation 1, computes `msg.sender` from participant row 0, and satisfies `require(msg.sender ==
minter)`. The Minter is never spent and never runs.

The whole "each participant verifies its own projection, all bind one transcript" argument depends on
an unstated lemma: *every declared participant provably executes a covenant that validates this same
transcript.* Nothing establishes it.

### Fix (normative, add as section 4 item 15)

Every mutable participant MUST verify, for every participant row `j`:

1. `tx.inputs[row_j.ownerInputIndex].lockingBytecode == row_j.ownerLockingBytecode`;
2. when `stateCategory` is non-empty, the token category and master capability at that input match;
3. `tx.inputs[row_j.ownerInputIndex].unlockingBytecode` selects the reserved `SCB1` route;
4. the same for `executorInputIndex` / `executorLockingBytecode` when `executionKind != 0`.

Check 1 is what bridges "the table says X" to "X actually ran": the input's locking bytecode is a p2sh
commitment to a redeem script, so forcing it to equal the claimed contract forces that contract's
script to evaluate, which forces its self-verification.

Check 3 is not optional. Without it an attacker names a legacy non-v1 artifact whose covenant happens
to pass on attacker-chosen arguments; the right script runs but never parses the transcript, so its
rows go unverified. Spec section 2.5 currently states this as an SDK-side property ("an artifact
without v1 metadata cannot participate"), which an untrusted witness constructor cannot be trusted to
honour.

Cost is negligible: `OP_UTXOBYTECODE` per row pushes ~35 bytes, plus a handful of instructions. At 8
participants this is under 0.1% of the operation-cost budget computed in section 3.

---

## 2. High: the canonical sort key admits two settlement authorities for one owner

Section 3.3 sorts participants by `(ownerLockingBytecode, stateCategory, artifactFingerprint)`.

Section 5.1 defines the logical owner as `(ownerLockingBytecode, stateCategory)`. Sorting on a triple
that appends a third field means two rows may share a logical owner and still be strictly ordered and
structurally valid. That is exactly the "two settlement authorities for the same state object" which
section 14.1 forbids and section 9.5 rejects, admitted by the canonical encoding.

Section 9.4 rejects it in SDK derivation. The SDK is untrusted; this must be structurally impossible.

Compounded with defect 1 it is directly exploitable. Even after defect 1 is fixed it forces two inputs
carrying the same locking bytecode and category, which is precisely the duplicate physical consumption
the protocol exists to prevent, and it then rests entirely on state-lineage invariants catching it.

### Fix

Sort strictly increasing on `(ownerLockingBytecode, stateCategory)` alone, and require strict
inequality between adjacent rows. Duplicate owners then cannot be encoded. See also amendment A5:
`artifactFingerprint` should leave the wire format entirely.

---

## 3. High: the resource envelope is wrong by roughly 7x, and it is the primary constraint

Neither document states a consensus target or measures a budget. Both matter more than any other open
question here.

Measured constants (libauth 3.1.0-next.8, `ConsensusBch2026`, standard relay):

```text
densityControlLength D   = 41 + |unlockingBytecode|
maximumOperationCost     = 800 * D
operationCost            = 100*instructions + 26000*sigchecks + 192*hashIterations
                           + arithmeticCost + stackPushedBytes
maximumHashDigestIterations = 0.5 * D
maximumStandardUnlockingBytecodeLength = 10,000   (2023/2025: 1,650)
maximumTokenCommitmentLength           = 128      (2023/2025: 40)
maximumStandardTransactionSize         = 100,000
maximumStackItemLength = 10,000   maximumStackDepth = 1,000   maximumControlStackDepth = 100
```

Two consequences the documents do not draw.

**The governing currency is instructions, priced against your own unlocking bytecode.** Since
800/100 = 8, a participant gets roughly `8 * |unlockingBytecode|` instructions. A signature check
costs 260 instruction-equivalents. Pushing a byte costs 0.01. For a realistic stateful participant
with a 5,000-byte redeem script plus 500 bytes of arguments: D = 5,551, budget 4,440,800, about
44,000 instructions, 2,775 hash iterations, 129 sigchecks.

**Section 11's limits cannot coexist.** Summing the section 3 wire format at the stated row maxima:

| table | row size | count | bytes |
|---|---|---|---|
| participants | ~128 (163 delegate) | 32 | 4,096 |
| invocations | ~139 (64B args, 32B result) | 128 | 17,792 |
| resources | ~66 | 128 | 8,448 |
| effects | ~99 | 128 | 12,672 |
| events | ~112 (64B fields) | 128 | 14,336 |
| header | 20 | 1 | 20 |
| **total** | | | **57,364** |

Against an 8,192-byte transcript cap. The declared capacity is unreachable by 7x. Section 11 asserts
that "generated validation loops and resource assumptions are bounded by them", so implementers will
size generated code for capacities that can never occur while the real binding limit goes unstated.

Honest capacity at the 8,192-byte cap is roughly **8 participants, 32 invocations, 24 resources, 8
effects, 4 events** (8,316 bytes). Independently, 32 participants each carrying a multi-kilobyte
redeem script exceeds the 100,000-byte standard transaction size, which caps participants near 8-12
regardless of the blob.

**Parse cost is affordable, but only for one implementation shape.** `OP_SPLIT` charges
`stackPushedBytes` equal to the full item length (both halves), so every touch of the blob costs
O(blob).

```text
front-consuming single pass (split one row off the head, parse fields inside the small row):
  ~T^2/(2*rowLen) + F*rowLen  ~= 400,000 cost units at T=8,192   (~9% of budget)

random access / field-at-a-time against the whole blob:
  912 splits * 8,192          ~= 7,500,000 cost units             (~169% of budget, fails)

pairwise uniqueness scan over 76 rows:
  76^2 comparisons            ~= 3,500,000 cost units             (fails on its own)
```

Section 4 as written invites the failing shapes. Item 12 ("`(parentInvocationId, callsiteId,
occurrence)` is unique") has no mandated sort order, so the obvious implementation is the pairwise
scan.

Also note: loops (`OP_BEGIN`/`OP_UNTIL`) reduce generated *bytecode size*, not operation cost. Every
iteration still pays. Loops do not relieve any of the above.

### Fixes

- Declare `BCH_2026_05` normative, and state the dependency explicitly. The protocol is **infeasible
  on BCH_2025_05**: the 1,650-byte standard unlocking cap yields D = 1,691 and about 13,500
  instructions total, less than the validator alone needs.
- Rewrite section 11 to *derive* limits from the cost model rather than assert them, and state the
  model (`instructions ~= 8 * |unlockingBytecode|`) in the spec so limits move with measurement.
- Set v1 limits to the honest capacity above, and cross-check the sum of row sizes against the blob
  cap as an invariant of the spec, not of the implementation.
- Mandate a streaming validator: every table sorted on a key that turns uniqueness into an adjacent
  pair test, single front-consuming pass, no backward seek. `subtreeEnd` is a forward reference and
  stays legal.

---

## 4. Medium and lower findings

**M1. Section 2.2's rationale for the `SCBH` output is stated backwards.** It says the SIGHASH_ALL
signature binds the transcript "even though signature hashing does not directly include unlocking
scripts". What actually binds the blob is each participant's own `hash256(blob) == digest` check in
2.4. The signature binds only the *digest*, via the output. An implementer reading 2.2 could drop the
direct hash check as redundant, which would let anyone swap the blob. State the real division: the
participants' hash check provides integrity; the signature provides origin consent to a specific
transcript, which is what stops a third party substituting a self-consistent transcript that produces
the same outputs.

**M2. `staticcall` read-only enforcement has no on-chain enforcer.** Section 3.5 says the target "MUST
be compiler-proven read-only"; section 8 says it "must preserve all mutable resources". Both are
off-chain properties. The target sees `callMode == 1` in its own inbound row and is the only party
that can enforce it. Make it a normative target-side obligation: `callMode == 1` implies zero dirty
resources and no mutable descendants, verified by the target.

**M3. Foreign `outState` ordering is delegated to the untrusted SDK.** Section 8 admits the read "only
when derivation proves that every invocation which can mutate that owner has already completed". The
value read is always the target's authenticated final state, so this is not a soundness hole, but the
*semantics* silently diverge from the sequential reference model when a later invocation targets that
owner. Make the reader verify on-chain that no invocation row with `targetParticipant == T` follows
its own position in canonical order.

**M4. Effect rows can move value with no physical output.** Section 3.6 allows `outputIndex = 0xffff`
"when folded into an owner-local logical ledger", with no constraint on source and destination being
the same owner. Restrict the sentinel to `sourceParticipant == destination participant`; otherwise a
credit and a debit can be attributed to different owners with no output to check.

**M5. Delta aggregation should not ship in v1.** Research note 5.4 classes ERC-20 balance deltas as a
"reducible optimisation" and spec 7.5 permits it "after proving equivalence to sequential handler
execution". If the deployed covenant implements the aggregated form, the aggregate *is* the on-chain
semantics and the ordered reference exists only off-chain, so a flaw in the equivalence proof is a
silent divergence with no on-chain oracle. The first three corpus rungs are n = 2 and n = 3, where
aggregation buys nothing. Defer it past v1.

**M6. Carrier template matching needs an exact-length rule.** Section 2.1 requires verifying the
canonical carrier template with a baked 20-byte pkh hole. Specify exact total length and exact prefix
and suffix bytes, or a redeem script that matches the template plus trailing opcodes is accepted.
Also specify the three-way pushdata branch (direct / `PUSHDATA1` / `PUSHDATA2`) for reading the first
push, and reject non-minimal and `PUSHDATA4` encodings.

**M7. "Tiny carrier" is misleading.** Research note 5.3 and spec 2.1 describe a "tiny signer-bound
ephemeral carrier". Its redeem script is tiny; its unlocking bytecode is the largest input in the
transaction by an order of magnitude. This wording drives wrong cost intuitions. It also means the
carrier has the largest operation-cost budget in the transaction and does almost nothing with it,
which amendment A2 exploits.

**M8. Verify the `SCBH` output against nulldata policy** before freezing the format: one OP_RETURN
output at 39 bytes is within `maximumDataCarrierBytes` (223), but confirm BCHN's per-transaction
nulldata output count against SolidCash's existing OP_RETURN usage in
`GenerateTargetTraversal.ts` (dynamic-storage chunks, drain placeholders).

---

## 5. Amendments and alternative design proposals

### A1. Move the parser cost spike into Phase 0, before the wire format is frozen

The research note's Phase 0 gate is "metadata is deterministic and existing suites byte-identical".
That is the right gate for the *analysis* work and the wrong gate for the *riskiest* thing in the
plan. Under the current phasing the carrier format is baked into four phases of code before anything
measures it.

Add to Phase 0: hand-write the transcript parser and structural validator for a 2 KB blob, run it
under `BCH_2026_05` against a realistic participant redeem script, and report measured
`operationCost`, `hashDigestIterations`, `stackPushedBytes` and instruction count. Let that
measurement set section 11. This is a few days of work and it is the difference between a specified
protocol and a shippable one.

### A2. Tiered transcripts, so the common case does not pay for the general one

Every corpus case on rungs 1-3 (TreasurySplit two transfers, Marketplace three transfers, MasterChef
double mint) is two or three invocations against one or two participants. Under the current spec each
pays for a full 8 KB carrier, a signer-bound p2sh, an OP_RETURN, and full structural validation.

Propose two encodings behind one canonical digest:

- **tier 0**: the whole transcript fits in 128 bytes. Carry it inline in the participant's own state
  NFT commitment (2026 raises `maximumTokenCommitmentLength` from 40 to 128), no carrier input, no
  separate blob parse. Covers repeated-callee batching, which is the highest-value milestone.
- **tier 1**: the carrier at input 0, as specified, for graphs that need it.

Tier selection is part of the digest preimage, so a hostile transaction cannot downgrade. This makes
Phase 3 and Phase 4 shippable without the full carrier machinery, and it matches the ladder the
research note already recommends.

### A3. Exploit 128-byte commitments generally

The 40 -> 128 byte commitment increase in the 2026 upgrade is the single largest change affecting this
design and neither document mentions it. Beyond A2:

- Many contracts that needed several scalar resource rows now need one, directly shrinking the
  resource table, which is the second-largest table at the maxima.
- A participant's `(firstInvocation, invocationCount, firstResource, resourceCount)` range plus the
  transcript digest fits comfortably in its own output commitment. Binding the range into state
  lineage is stronger than re-deriving it from the blob on every evaluation, and it makes the
  completeness proof in section 5.4 local.

### A4. Replace the deep-frame journal with an append-only write log

Spec 7.2 puts the journal in "one controller-owned lower-stack frame" addressed by `OP_DEPTH`-derived
indices. Measured behaviour:

```text
OP_PICK  pushedBytes = item.length              // reads are cheap, O(item)
OP_ROLL  pushedBytes = item.length + depth      // moves are cheap
```

but there is no insert-at-depth. Updating a deep frame slot requires rolling everything above it out
and back, which is O(depth) rolls each costing O(depth), so writes are O(depth^2). The spec's own
residual-risk list flags the frame primitives as unproven; this is why.

Propose instead:

- prefetched base values in a fixed run at the bottom, read with `OP_PICK` (O(item), unchanged);
- writes appended as `(slotId, value)` pairs at the *top* of the stack, O(1);
- `journalLoad` scans the write log top-down, falling back to the base value;
- flush consumes the log in order.

Read-your-writes is preserved by construction. Reads become O(writes so far), which at a write cap of
32 is roughly 3,400 cost units worst case, and the compiler can collapse most reads to O(1) by
statically resolving the slot to a known log position or proving no prior write. This is strictly
better than O(depth^2) writes and removes the hardest unproven primitive from the critical path.

### A5. Drop `artifactFingerprint` from the wire format

Spec 3.3 claims it "prevents ABI-compatible but semantically different handler substitution". At the
covenant layer that is false: the fingerprint is a compiler-side hash and is not derivable from the
transaction, so no participant can check it. The locking bytecode already pins the exact script, which
is the real defence. Keeping it costs 32 bytes per participant, puts an uncheckable field in the
canonical sort key (see finding 2), and creates false confidence. Move it to artifact metadata and SDK
derivation, where it is genuinely useful.

### A6. Per-rung capacity estimates on the proving ladder

Research note 6.1 is the strongest part of either document: evidence-driven and correctly ordered.
Add a capacity column. Rungs 5-8 (Kashi `cook` subset, flash swap, `claimMultiple`, multi-hop) need
more participants and invocations than the honest capacity in section 3 above. Discovering that before
implementing a rung is much cheaper than discovering it during its gate.

### A7. Narrow the readiness claim

Research note line 3 reads "RESEARCH COMPLETE / IMPLEMENTATION READY UNDER THE V1 SPECIFICATION" and
section 0.1 says "Implementation may start". The semantics are indeed pinned well enough for Phase 0
and Phase 1. They are not pinned for the carrier: the format has an exploitable authentication gap
(finding 1), a canonical-encoding defect (finding 2), and a capacity table that is internally
inconsistent by 7x (finding 3).

Suggested replacement: "IMPLEMENTATION READY FOR PHASE 0-1. Carrier format and section 11 limits are
provisional pending the Phase 0 cost spike and the resolution of audit findings 1-3."

---

## 6. What the documents get right

Worth stating plainly, because the findings above are all fixable and the underlying architecture is
not the part in doubt.

- Reframing the "bus" as a finite verified execution transcript rather than a queue or foreign-slot
  writes is the correct primitive, and the rejection of the `{op, slot, value, nonce}` outbox is well
  argued.
- "The SDK is an untrusted witness constructor" (spec 1.1) is the right security posture and is held
  consistently almost everywhere. Findings 1, M2 and M3 are places where it slipped, not places where
  the model is wrong.
- The projected-callback execution model (spec 1.3) is a genuinely good answer to independent input
  evaluation, and the observation that each row is checked by both emitter and target is the right
  completeness argument. It just needs the missing lemma from finding 1.
- Separating "no replay nonce needed, because consuming participant state makes the transaction
  non-replayable" (research 5.1) from the asynchronous protocol that *would* need one is correct.
- The irreducible-boundary list (research 7) is accurate. `tryAggregate(false, ...)` genuinely cannot
  be made sound, and saying so beats pretending otherwise.
- Insisting the direct single-call path stays byte-identical (spec 13 gate 1) is the right
  conservatism for a change of this blast radius.

One correction to the framing of research 7 item 4: consensus resource ceilings are listed alongside
the fundamental boundaries as though they were a residual risk. Section 3 above shows they are the
primary design constraint, and they should drive the wire format rather than be checked against it
afterwards.
