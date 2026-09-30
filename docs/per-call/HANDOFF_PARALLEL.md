# Parallel work beside the ladder: handoff (2026-09-30)

Items a worker other than the ladder stream can take now, each off the ladder's critical path or ahead of it, with
where it lives, when it is done, and what it must coordinate. Claim an item in the plan's claims section
(`PLAN_MARKETPLACE_66.md`, "Claims: work a second worker holds") with a docs commit before starting; the commit that
lands it removes the claim line.

## Where the ladder stands

- Last full ladder: 17/66 (run 17, `f22ecc5ff`). Run 18 (the strict matchers) was killed by its `timeout 5400`
  wrapper after 50 of 66 titles, so it carries no count; a full ladder now needs `timeout 10800`. All 17 are class
  (a); the five composition groups are at zero: (d) repeated callee 0/23, (e) fan-in 0/11, `approveResult` re-entry
  0/3, `arbitrate` re-entry 0/5.
- The ladder stream is on L3, #18 `post job 1`. The wall has moved twice this round: the hop's plan-time refusal
  (three reaches of one token entry all writing one mapping key, because two of the three sites are gated on an
  earlier call's result) is **gone** — such a site is now planned as no visit and re-planned from what the earlier
  call returned (`f2e34600d`) — and the title now stops on the entry's **own** `require(meceCount == 1, "Exactly one
  MECE tag is required")`, whose count comes from a value a **proxied** callee returned. That is PW8, and it is the
  critical path for the 24 titles. Evidence: `{SCRATCH}/ladder/probe-postjob1-r29.log` (the targeted run) and
  `probe-postjob1-trace-r29.log` (`PER_CALL_HOP_TRACE=1`).
- Coordinator directions (log rows `f85b9d3d3`, `912ff9400`): strict `revertedWith`/`withArgs` for per-call contracts
  before M1 is claimed (the count is expected to drop), and a full ladder at the next checkpoint. Both are the
  ladder stream's.
- Estimate at the time of writing: M2 (66/66 on the mock) around 2026-10-09 to 10-17; the long tail is L5-L7 (19
  titles, 5 of them never green on any path).

## The ladder stream's lane (do not edit without its agreement)

- `packages/solidcash/src/per-call/proxy/**` (hop planning, `callPerCallProxyEntry`, entry writes, the hop trace).
- `packages/solidcash/src/per-call/composer/**` derivation host and draft (the repeated-site fill is being changed).
- The ladder harness and fixture: `vitest.marketplace.config.ts`, `examples/effectiveacceleration/**`,
  `.marketplace/**`, `packages/testing/src/chai.ts` (the strict matchers), and the scoreboard ticks.
- `packages/solidc/src/per-call/master/support.ts` and `stop-sites.ts` write-segment publication (`f22ecc5ff`);
  the second worker also edits `support.ts` (self-call admission).
- Full ladder runs (at most one per day, the ladder stream's). Single-title runs in a scratch copy are fine; say so in
  the claim if they will be frequent, since each loads the shared box.

## Rules that apply to every item

- Own scratch copy synced to HEAD; land by explicit paths, `merge-onto-live` for any file another worker holds; never
  sweep or stash another worker's uncommitted edits; commit at once.
- Tests: the failing case first, then the one before it; the focused suites of the touched directories at landing;
  a full compiler or SDK suite only when the change is compiler-wide.
- Soundness: any change to emitted master or validator code lands with a machine accept and a machine refuse.
- No `OP_RETURN` outputs, no application names in `src/`, no repeated-byte identifiers in tests, ASCII only, comments
  tight.
- A gap found in the ladder stream's lane is handed over as a reduced, pinned reproducer (the failing case named as
  the known wall) with its trace, not fixed in place.

## Items

### PW1. A revert after calls, reported through the hop (MS10, spec 23 row 5, E3's open half)

- **Why**: the seven open class-(a) titles (#21-23, #25-27, "reverts after calls", one inside the third token call)
  need the innermost entry's own reason through a composed hop, and the strict matchers will compare it. E3 is
  partial: `reportCompositionRefusal` (`composer/refusal.ts`) finds the innermost refusing frame, but the derivation
  stalls (`PER_CALL_DERIVATION_STALLED`) before it is asked.
- **Do**: (1) in the worker's own directory, a neutral MS10 replica behind generated proxies: a root that makes
  state-changing calls into a proxied store and a token, then fails each of the seven checks in turn; show the
  reason is recoverable by applying `reportCompositionRefusal` to the stalled draft. (2) Agree with the ladder stream
  on the one hook in the settle loop that reports it (its file), and update the suites that pin the stall as a stall
  (find them by `PER_CALL_DERIVATION_STALLED` under `test/per-call`).
- **Done when**: each of the seven checks is reported by its own reason (and custom-error arguments) through the
  shipped proxy path, nothing is broadcast, and E3 is ticked.
- **Size**: 1-2 days. **Coordination**: medium-high (step 2 is in the ladder stream's file).

### PW2. Walls ahead: the later groups' shapes through the shipped call path (MS3-MS7)

- **Why**: each flow shape settles as a hand-planned replica in `shapes/`, but none is driven through the automatic
  hop planning the ladder uses. L5-L7 are the estimate's long tail; knowing their first walls days early narrows it.
- **Do**: in a new `test/per-call/ahead/` directory, neutral contracts deployed behind generated proxies and called
  through `callPerCallProxyEntry` with `PER_CALL_HOP_TRACE=1`, one file per shape: MS3 fan-in (`takeJob` single
  applicant, `payStartJob`), MS5 (`refund`, `refuseArbitration` on a taken job), MS6 (`dispute` by the creator), MS4
  (`approveResult` with a rating), MS7 (`arbitrate` 80-20, about 24 masters). Pin each as settling or at its first
  wall by name. Fix a compiler-side gap in this lane (with a machine accept and refuse); hand an SDK hop gap to the
  ladder stream as a pinned reproducer.
- **Done when**: a "walls ahead" table (shape, first wall, file, owner) is in the plan, every reproducer pinned, and
  `ahead/` is in `MANIFEST.md`.
- **Size**: 2-3 days (about half a day per shape). **Coordination**: low while no hop code is edited.

### PW3. Write segments for the entries that publish none (compiler half)

- **Why**: `postThreadMessage` (no own record write), `updateJobWhitelist` (a runtime-loop upsert beside a call) and a
  batch write beside a dynamic run in another segment still publish no write segment and keep named refusals; the
  ladder stops on them at #20, #30, #46 and #47.
- **Do**: publish a fact for each shape in `support.ts`/`stop-sites.ts` (an entry with no own write publishes an empty
  list; a loop upsert beside a call its segment range; a batch and a run their own segments), each with a master test
  in `solidc/test/per-call/master` that the body verifies the write at that segment (accept and refuse). The SDK side
  (`proxy/entry-writes.ts`) stays with the ladder stream unless it hands it over.
- **Landed, and where the split falls (2026-09-30, `c3cf75d69`)**: the two shapes the compiler can state are
  published. An entry that writes no record of its own publishes an **empty list**
  (`MarketplaceV1.postThreadMessage` does now), a batch write beside a dynamic run in another segment publishes
  **both** (`MarketplaceV1.refund`), and a runtime-loop upsert *beside* a call — a loop whose own body makes none,
  or whose write the lowering settles after the calls — publishes **the segment its write lands in** (one call puts
  it at segment 1, two at segment 2). Where a mapping record belongs is fixed by the machine's own control rather
  than by that suite: a non-loop record declared at the segment the write lands in is accepted and the same
  declaration one segment later is refused (`solidc/test/per-call/master/loop-upsert-segment.test.ts`), and the loop
  body itself settles there for a fixed record (next paragraph). **That loop shape is served end to end
  when the key is the frame's and the entry's body makes no call**:
  `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts` drives it
  through the shipped deploy and call path, the machine accepts the spend, and the same case then changes one byte of
  the record the entry wrote and the machine refuses it.
  **With a call beside the loop the mapping node is a second, independent wall, measured through the shipped proxy
  path** (`solidcash/test/per-call/conformance/loop-upsert-beside-call.test.ts`): its frame is refused with `Program
  failed an OP_VERIFY operation.` inside the upsert body in both source orders (loop then call, and call then loop),
  while the **entry's own record** upserted in a run-time loop beside a call settles — that file's machine pair
  accepts the well-formed spend and refuses the same spend with one byte of the record the loop wrote changed, at the
  segment the call opened (one call: segment 1; it is the criterion's loop-upsert-beside-a-call shape with a
  machine accept and a refused mutation). So a loop upsert is served for a fixed record and open for a chain node
  once a call shares the body.
  **Open** (the coordinator's decision below keeps it in PW3): the fixture's `updateJobWhitelist`, whose key is an
  **element of a caller-supplied array**, so a different node per turn. It is not a verified batch at all — the entry's
  block layout reserves no `entry` slot for the collection — so no segment declares its records and no write fact can
  state them; the machine refuses the well-formed spend wherever its node record is declared (segment 0, the last
  segment, both, and an insert: `Program failed an OP_VERIFY operation.`), and it refuses it on the frame the shipped
  call path plans **itself** (`conformance/loop-upsert-settlement.test.ts`), while the same loop over a key the frame
  holds settles on that path when the entry's body makes no call (with a call beside the loop the chain node is
  refused, measured above). So the open part is the varying key: a per-turn node is a run-time target the
  run-time-loop machinery settles, which this stream's `proxy/**` lane and the frame's layout would have to carry.
  Pinned reproducers:
  `solidc/test/per-call/master/loop-upsert-segment.test.ts` (the fixture's own shape, the machine's refusals, and the
  segment control), `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts` (the shipped call path) and
  `solidcash/test/per-call/conformance/loop-upsert-beside-call.test.ts` (the loop upsert beside a call: the fixed
  record's accept and refused mutation, and the chain node's refusal beside them).
- **What serving the open variant needs, scoped (2026-09-30, a read-only investigation).** The emitter's run-time-loop
  body addresses its per-turn record as the *direct* convention's co-spent band (`input[activeInput + blockSize +
  turn]`, `GenerateTargetTraversal.ts`'s `emitSortedUpsertLoopBody` / `emitTrailingWriteInputBase`), while a per-call
  frame declares its records in a segment and parks their base (`recordInputIndexSlotName()`); so for this shape the
  master reads another participant and its `OP_EQUALVERIFY` fails — the `Program failed an OP_VERIFY operation.`
  recorded above. Three commits would serve it, each leaving the census at 0 refusals and the per-call suite green:
  (1) the per-call layout gives the collection an `entry` slot for this shape and the artifact publishes the write
  fact (`SymbolTableTraversal` skips an in-loop entry and `support.ts`'s `perCallWriteSteps` places only batch slots
  today, both per-call-only to change); (2) the emitter takes the frame-relative per-turn coordinate the paged-read
  arithmetic already carries (`perCallEntryOffset` plus `perCallPagingTurnAddend`) instead of the trailing band;
  (3) the SDK's `entry-records.ts` plans one node per turn, mirroring the read path's `entryReadRecords` / `loopTurns`.
  Compiler about 4-6 days, SDK about 4-6 days; the smallest visible step — the loop-beside-a-call varying key,
  compiler only — is about 1-1.5 days and turns `master/loop-upsert-segment.test.ts`'s two refusals into an accept at
  the write's segment beside a refusal one segment later.
  The measurement behind that plan, taken for all three varying-key variants (a loop beside a call, a loop whose body
  makes the call, a loop with no call): each artifact publishes **no `entryAccesses`** (the artifact's own filter
  drops an in-loop access), no `sortedBatchInfo`, and a `blockLayout` of `{blockSize: 1, slots: [master]}` — with
  `sortedUpsertLoopInfo` present — while the same loop over a parameter key publishes `entryAccesses`, a
  `conditional` entry slot, `sortedBatchInfo` and `writeSegment: 1`. Four things therefore have to change together
  for the varying key: the artifact publishes the access, the layout gives it a slot, the emitter addresses the
  turn's node from the frame's parked base instead of the direct convention's co-spent band, and the SDK plans one
  node per turn. A write fact alone would state a segment that declares nothing, which is why this cannot be
  published from the compiler half on its own. **And the call inside the loop is a second, independent wall for that
  variant**: measured through the shipped call path, a loop whose body makes the call is refused by
  `callPerCallEntry` for the callee-frame reason (`entry "move" makes 1 external call(s), whose callee frames this
  call path does not plan yet`) even when its key is the frame's own, so the fixture's `updateJobWhitelist` needs the
  hop's callee-frame planning (PW1/PW2's lane) as well as the varying-key handling. The per-call lane consumes none
  of the artifact's `entryLoopWrites`, the field the in-loop access is published under; only
  `packages/solidcash/src/stateful/**` reads it.
- **The compiler half was written and measured (2026-09-30)**, so the split point is exact rather than estimated.
  Three per-call-only edits, 28 lines: `SymbolTableTraversal.ts`'s layout push gives an in-loop access a
  `{kind: 'entry', conditional: true}` slot, `Artifact.ts`'s filter publishes the in-loop access for per-call, and
  `GenerateTargetTraversal.ts`'s `runtimeLoopEntry` arm and `emitSortedUpsertLoopBody`'s `pushIdx` take the frame's
  parked base plus the slot's per-call offset plus the loop's counter instead of the direct convention's trailing
  band. Measured with all three in place, on the fixture's own varying-key entry through the shipped call path: the
  artifact then publishes `blockLayout {blockSize: 2, slots: [master, {kind: 'entry', conditional: true}]}` and
  `entryAccesses [{slotIndex: 0, collection: "balances", keyParams: ["arridx(id:workers,id:i)"], operations:
  ["write"]}]` with no write fact, and the shipped path refuses **by name, before the machine is asked**:
  `entry "move" writes mapping "balances" at 1 turn(s) of "workers", a run-time loop whose per-turn records a
  call does not declare yet` (the turn count is the array's own, derived from the artifact's
  `sortedUpsertLoopInfo`)
  (`packages/solidcash/src/per-call/call/entry-records.ts:374`). So the compiler half alone converts a machine-level
  `OP_VERIFY` refusal into a named SDK refusal and moves that body's `blockSize`: it lands with the SDK half or not
  at all. The edits are committed as `docs/per-call/patches/pw3-varying-key-compiler-half.diff` (76 lines, three
  files, `git apply --check` clean against `00455e017`, and it touches no SDK file, so it cannot collide with the
  ladder stream's live edits), with the run that measured it at `{SCRATCH}/probe-varying.log`.
- **What the SDK half is, and why it is the whole remainder.** The per-call lane has no run-time-loop record
  protocol at all: `grep -rn sortedUpsertLoopInfo packages/solidcash/src/per-call` is empty, and only
  `packages/solidcash/src/stateful/**` reads it (`StatefulContract.ts`, `KernelEntryJournal.ts` (1890 lines),
  `stb-materialize-runtime-loop-trailing.ts`, `stb-materialize-trailing-iteration-entries.ts`). The artifact already
  publishes what the key side needs (`sortedUpsertLoopInfo[0]`: `varyingArrayParam: "workers"`,
  `valueScalarParam: "amount"`, `op: "set"`), so enumerating the turns mirrors the read path's own paged planning.
  The record side does not mirror anything: the loop's per-turn **outputs** are not witness-declared records at a
  frame coordinate (what `emitPerCallEntryIndex` names) but the positions the segment's declared list gives them —
  the mechanism the batch path already reaches through `emitDeclaredGroupRecordOrdinal`/`batchTargetOrdinal`. Porting
  that protocol into `packages/solidcash/src/per-call/call/entry-records.ts` and the composer is what the 4-6 day SDK
  estimate covers, and it is the ladder stream's own code area: `per-call/proxy/**` and `per-call/read.ts` carry live
  uncommitted edits in this tree today.
- **Decision (coordinator, 2026-09-30)**: the varying-key variant **stays in PW3**, and the collection's `entry` slot
  in the per-call block layout plus the `packages/solidcash/src/per-call/proxy/**` planning are **authorized**. The
  work is the three-commit sequence recorded above, executed in the order the scoping note gives
  (`SymbolTableTraversal.ts`'s per-call layout push, `Artifact.ts`'s in-loop access filter, `perCallWriteSteps`'s
  fact, then `GenerateTargetTraversal`'s frame-relative per-turn coordinate in `emitSortedUpsertLoopBody` /
  `pushIdx` and the `runtimeLoopEntry` arm of `emitEntryInputIndex`, then the SDK's per-turn node planning in
  `packages/solidcash/src/per-call/call/entry-records.ts`). **The first two steps were written, measured and
  reverted the same day**: with the per-call `entry` slot published (`{blockSize: 2, slots: [master, {kind: 'entry',
  offset: 1, slotIndex: 0, conditional: true}]}`) and the emitter addressing the frame's own base, the master's
  failure moves from `Program failed an OP_VERIFY operation.` to a read at the no-record sentinel
  (`requested index: -32767`) and the shipped path refuses by name (`touches mapping "balances" as write outside a
  sorted batch, which a call does not plan`), so the accept waits on the SDK's per-turn node planning: the frame's
  witness declares the collection's nodes at a base the plan chooses, so a hand-built witness cannot supply them
  without re-implementing that plan. No partial landing: adding the slot without the emission
  moves `blockSize` for that body, and publishing the access without the SDK's per-turn planning changes what the
  shipped path does with the entry, so the three land as one sequence with the fixture census held at 0 refusals.
- **Decision (coordinator, 2026-09-30, revised the same day)**: the varying-key item **stays in this lane and is
  implemented here, in steps**. The earlier reading of that day handed the SDK protocol to the ladder stream; the
  coordinator reversed it on the measured boundary, because the per-turn record protocol is this lane's own
  counterpart to the compiler half and the ladder stream's live edits (`per-call/proxy/**`, `per-call/read.ts`) do
  not touch it. PW3's item is open in this lane until the fixture's `updateJobWhitelist` shape settles, and its box
  stays unticked.
- **The compiler half is landed (`aecdbf5ef`)**: three per-call-only edits, 28 lines. `SymbolTableTraversal.ts` gives
  an in-loop access a `{kind: 'entry', conditional: true}` slot in the per-call block layout, `Artifact.ts` publishes
  the in-loop access for per-call, and `GenerateTargetTraversal.ts`'s `runtimeLoopEntry` arm and
  `emitSortedUpsertLoopBody`'s `pushIdx` address the turn's node from the frame's parked record base plus the slot's
  per-call offset plus the loop's counter instead of the direct convention's trailing band. **Measured with it in
  place**: the artifact publishes `blockLayout {blockSize: 2, slots: [master, {kind: 'entry', conditional: true}]}`
  and `entryAccesses [{slotIndex: 0, collection: "balances", keyParams: ["arridx(id:workers,id:i)"], operations:
  ["write"]}]`; the shipped call path refuses the varying-key write **by name** at the seam the planner replaces
  (`packages/solidcash/src/per-call/call/entry-records.ts:374`, `... as write outside a sorted batch, which a call
  does not plan`) where the machine previously failed inside the emitted body; and the hand-built frame in
  `solidc/test/per-call/master/loop-upsert-segment.test.ts` now reads the **no-record sentinel**
  (`requested index: -32767`) rather than an unrelated participant, which is the frame's own base - the proof that
  the emitter addresses what the frame's plan declares. The frame-held-key loop upsert still settles under the new
  coordinate (its machine pair is green). Blast radius measured: only the two varying-key pins changed; solidc master
  600, solidcash conformance 79 and hostile 103 all pass, and the census stays at 0 refusals. The saved patch
  `docs/per-call/patches/pw3-varying-key-compiler-half.diff` is superseded by this landing and is removed with it.
- **What the SDK half must do, from the measured seam.** Three pieces, in this order: (1) plan the loop's turns from
  the artifact's `sortedUpsertLoopInfo[k]` (`varyingArrayParam`, `valueScalarParam`, `op`) and resolve each turn's
  key - the read path's own paged planning (`entryReadRecords`, `pagedKeyAt`, `loopTurns` in `per-call/read/read.ts`)
  is the mirror; (2) declare the turn's node in the frame's record list where the emitted coordinate looks for it, so
  the turns' records sit in turn order starting at the slot's per-call offset from the frame's first declared record
  (`GenerateTargetTraversal.perCallEntryOffset`), which is where the sentinel becomes a real node; (3) name the loop's
  per-turn **outputs** by their position in the segment's declared list - the mechanism the batch path already
  reaches through `emitDeclaredGroupRecordOrdinal` / `batchTargetOrdinal` - since a per-call frame's created records
  sit in the transaction's trailing outputs rather than at a frame coordinate.
- **Piece 2's coordinate measured before it is written (2026-09-30).** Three facts, each taken from the shipped
  machine rather than read off the code. (1) The frame's record base is the **first record its first segment
  declares**: a segment declaring none parks the no-index sentinel, and the emitted coordinate is
  `base + perCallEntryOffset(slot) + turn` - which is why the hand-built frame reads `requested index: -32768` for
  the varying key (`loop-upsert-segment.test.ts`). (2) The `+1` in `perCallEntryOffset` is **not** a direct-convention
  leftover: dropping it for a per-call frame with no batch ahead of the slot breaks the shipped read path (9 cases in
  `test/per-call/reads`, 9 in `test/per-call/call`, 3 in `conformance`, all green again on revert), so a per-call
  frame's declared list carries one record ahead of its first entry slot and piece 2 has to declare the turns'
  records **inside** that convention, mirroring the read path's own order and count
  (`entryReadRecords`/`layReadNodes`). (3) With the coordinate known, a frame that declares a plain update view at
  the node the turn reads still fails the body's own comparison (`Program failed an OP_VERIFY operation.`), so the
  remainder of piece 2 is the record **contents** - the run-time loop's transition views, which the body proves -
  rather than the coordinate. Evidence: `{SCRATCH}/offset-experiment.log`, `{SCRATCH}/offset-suites.log`. (4) The
  offset itself is now a number rather than a formula to re-derive: instrumenting `perCallEntryOffset` on the
  fixture's varying-key body prints `{dataNftCount: 0, compact: 0, earlier: 0, batched: 0, perCall: true,
  probe: 1}` - **the turn's node must sit one past the frame's declared base** (`base + 1 + turn`), which is the
  read path's own convention and the reason a frame that declares only the node at the base reads the neighbouring
  participant. So piece 2's declaration is `[one record at the base, turn 0's node, turn 1's node, ...]` with the
  loop's transition views - the shape of the list is settled; what the records carry is not.
- **Piece 3's emitter half is landed (2026-09-30).** `emitSortedUpsertLoopBody`'s `pushIdx` now has the arm the
  mechanism calls for: when the frame is a per-call one, no sorted batch shares the body and the entry slot is the
  loop's (`readsRecordsFromFrame`, `batchTargetSlots().length === 0`, `entrySlots[slotIndex].inLoop`), the **out**
  side is emitted as the negative declared-list ordinal `-(perCallRecordsBeforeGroups() + 1)` with the loop's counter
  **subtracted**, so turn `t` names the position `perCallRecordsBeforeGroups() + t` - the records a batch creates sit
  at that base too, so the one convention serves both. The in side is unchanged (it names the witness-declared
  record the frame parks). Gated this narrowly, nothing that settles today moves: the shipped-path guards are 6/6
  and the compiler pins 14/14 with it in (`{SCRATCH}/piece3-emitter.log`). **The arm is the emitter half only**: it is
  exercised once the plan declares the loop's created nodes at that base, which is piece 2's declaration, so the
  varying-key pins' verdicts are unchanged for now.
- **Piece 3's mechanism, named from the shipped code (2026-09-30).** The emitter's per-call branch of
  `emitSortedUpsertLoopBody`'s `pushIdx` addresses the loop's **output** side at the frame's own coordinate
  (`emitPerCallEntryIndex('out', slotIndex)`), and in a per-call hop that coordinate names a *participant* output -
  the records a frame creates are trailing outputs, not participants. The batch path already solves exactly this: a
  created record is addressed by its **position in the segment's declared list**, which
  `emitDeclaredGroupRecordOrdinal(declaredOrdinal, recordOffset)` (`GenerateTargetTraversal.ts:31196`) emits as the
  negative index `-(perCallRecordsBeforeGroups() + declaredOrdinal + recordOffset + 1)`, with the batch's own
  predecessor outputs subtracted, and which the shared close reads as a position rather than a coordinate. So piece 3
  is: give the loop's `pushIdx` out-side the same treatment with the turn as the runtime addend
  (`-(beforeGroups + firstCreatedOrdinal + turn + 1)`), and have the plan place the loop's created nodes starting at
  that ordinal - the one piece of the coordinate the emitter cannot know is the plan's own first-created ordinal,
  which is why the two halves land together.
- **Stating the literal value removes the derivation stall and moves the wall to the machine (2026-09-30).** The
  batch plan marks *every* target record a learning candidate (`valueDependent` is true for a target however its
  value was computed), so the derivation was asked for a hand-back per node and the loop's close supplied none. With
  the value stated - the artifact publishes `valueConst: "1"` for the fixture's `= true`, and the plan then declares
  the end views itself - the stall is gone and the machine **evaluates the frame**, refusing it with
  `frame "master" of Ledger.move() at line 1: no source message (Program failed an OP_VERIFY operation.)` for one turn
  and for two (`{SCRATCH}/stated-value-probe.log`). So the remaining wall for the literal shape is the declaration
  the body compares against itself - its per-turn coordinate and its output side - and no longer the hand-back; the
  parameter-value shape still needs the loop's journal stream, since its views cannot be stated. The wiring is kept
  at `{SCRATCH}/entry-records-stated-value.ts` for the next attempt and is not landed (the parameter-value shape
  would degrade from a named refusal to a stall).
- **The fixture's own value is a literal, and that does not unblock it (2026-09-30).** `updateJobWhitelist` stores
  `true` under every key (`whitelistWorkers[jobId][w] = true`), and the artifact says so: its `sortedUpsertLoopInfo`
  publishes `valueConst: "1"` (measured on a neutral replica, `{SCRATCH}/literal-probe.log`). So the plan can state
  the written value rather than leaving it to be learned - and the derivation *still* refuses with the same
  `the call's write to mapping "whitelist" did not hand back every node it rewrites, so the frame cannot declare
  their commitments`, for one turn and for two. **The blocker is therefore the run-time loop's own close**, which
  hands back its journal's stream rather than one commitment per rewritten node: a per-call frame must take the
  loop's minted nodes from that stream (the kernel lane's `KernelEntryJournal` output layout) instead of expecting a
  hand-back per node. That is the concrete remaining work of piece 2, and it is the same conclusion for a literal
  value and a parameter value.
- **Piece 2 attempted: the turns' records were planned as a batch, and the derivation names why that is not the
  loop's protocol (2026-09-30).** The wiring that reaches the derivation is settled and reproducible: derive the loop
  plan (piece 1), filter the loop's collection out of `planReadNodes`' accesses **and** its `slotIndex` out of the
  layout's slots (without the second filter the label `arridx(id:workers,id:i)` fails to resolve a second time), and
  hand the turns to the batch planner as its writes. With that wiring the shipped call path gets past planning and is
  refused by the **derivation** with `the call's write to mapping "balances" did not hand back every node it
  rewrites, so the frame cannot declare their commitments` (`{SCRATCH}/loop-declaration-probe.log`). So a batch-shaped
  declaration - each node written once, in its final form - is not what the run-time loop's body closes with: its
  close hands back its journal's stream, and the per-turn records have to carry *that* transition view. The wiring
  was reverted rather than landed, because it replaces a named refusal with a derivation stall and settles nothing;
  the next attempt starts from it rather than from zero.
- **SDK half, piece 1 landed**: the per-call lane derives the turns of a run-time-loop mapping write from the
  artifact's own facts. `planCallLoopWrites` (`packages/solidcash/src/per-call/call/entry-records.ts`) reads each
  `sortedUpsertLoopInfo` entry - the collection, `varyingArrayParam`, `valueScalarParam`, the operation - finds the
  access whose key names that array, takes the counter from the key label's own operands, and resolves one key per
  element of the array the caller handed the entry, substituting the turn for the counter exactly as the read path's
  `pagedKeyAt` does. The shipped call path consumes it: its refusal now names what the shape needs
  (`entry "move" writes mapping "balances" at N turn(s) of "workers", a run-time loop whose per-turn records a call
  does not declare yet`) in place of the generic "outside a sorted batch". Pinned by
  `solidcash/test/per-call/call/loop-turns.test.ts`, whose four cases drive the shipped compiler, the shipped planner
  and `callPerCallEntry` over a real deployment: one turn per element with each element's own key, a single-element
  array, an array the frame does not carry (refused by name), and the shipped refusal naming three turns for three
  elements. **Pieces 2 and 3 remain** - declaring the turns' records where the emitted coordinate looks for them, and
  naming the loop's per-turn outputs by their position in the segment's declared list.
- **Done when**: the three refusals are gone from the published census, the master tests pass, and the ladder
  stream has taken the published facts. **Status 2026-09-30: two of the three shapes are done.** The census read back
  with this round's compiler shows seven contracts and **0 refusals**, `postThreadMessage` publishes
  `writeSegments: []` and `refund` its batch and its run, the master tests pass, and the facts are in the ladder
  stream's hands. **The third shape is the varying key, and it is in this lane** (the coordinator's 2026-09-30
  decision below): its compiler half is landed and its SDK half is the next rounds' work. The fixture's
  `updateJobWhitelist` writes a **different node per turn** — its key is an element of a caller-supplied array —
  and that variant publishes no write fact, while its collection now has an `entry` slot in the frame's layout and a
  published access. Serving it needs the per-turn operands derived: the first is landed (the compiler-half bullet
  above), the second is the per-call composer's run-time-loop record protocol, which this lane implements piece by
  piece until the shape settles. Reproducers: `solidc/test/per-call/master/loop-upsert-segment.test.ts`
  (the fixture's own shape, the machine's refusals, the segment control) and
  `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts` (the shipped call path).
- **Size**: 1-2 days. **Coordination**: high (the ladder stream wrote this code; the second worker edits
  `support.ts`); agree the split before starting.

### PW4. The owed proxy-binding guard (soundness)

- **Why**: the MANIFEST's attack table lists "a proxied call whose delegate callee is not the implementation the
  proxy's own record names" as owed and now testable. Every class-(d) and later title goes through a proxy.
- **Do**: a hostile case on `toys/proxy.test.ts`'s forwarded hop that mutates the delegate callee against the
  proxy's record; it must be refused by the derivation and by the machine, beside the faithful spend. Update the row.
- **Done when**: the row cites the case and no longer says owed.
- **Size**: half a day. **Coordination**: none (`hostile/`).

### PW5. G1/S0: the cross-contract reference rows

- **Why**: the conformance suite runs the 10 single-contract rows; the 11 cross-contract rows of
  `probes/this-call-msg-sender/ref.sol` (A to B, re-entry, `staticcall`, `delegatecall`, `new`, a value send, a
  fallback, the proxy pair, the factory) are to be recorded as served or refused by name, with no work on the hop.
- **Do**: finish the draft (`{SCRATCH}/drafts/cross-contract-identity.test.ts` in the parallel worker's scratch),
  pin each row's per-call answer or refusal beside the EVM's.
- **Done when**: 21 of 21 rows recorded; G1 ticked when every row is served or its refusal is the hop's by name.
- **Size**: half a day to a day. **Coordination**: none (`conformance/`). Claimed by the parallel worker.

### PW6. Spec 23 row guards that gate later titles

- **Why**: one shipped-path test per row is plan item G2; several rows are shapes later titles need and nothing
  tests yet.
- **Do**, ordered by the titles they gate: row 19 (reverts from view calls, 6), row 14 (two `JobEvent`s in one
  transaction), row 13 (events above 128 bytes from nested frames), row 24 (`string => string` set and delete), row
  16 (24-hour windows, the challenge period, strictly later block times), row 12 (struct and array arguments and
  returns with dynamic members, `uint16[5]`, `uint256[5]`), rows 10, 11 and 6 (`address(this).balance` compared with
  0 in `functionCallWithValue`, `bool` return decoding and revert re-raise, custom errors re-raised by SafeERC20
  assembly). Each pinned as served or refused by name; gaps handled as in PW2.
- **Done when**: each row has its guard and G2's list is ticked row by row.
- **Size**: a quarter to half a day per row. **Coordination**: low.

### PW7. Measurements the plan owes, and the ladder's cost

- **Why**: plan 4.5 lists VM evaluations and VM runs per master during derivation (E1: one with resumption), Y2 and Y6
  wall times, and chunk outputs per `jobEvents` append and over 30 updates of one job; and a full ladder costs about
  54 minutes (first title 347.5 s, median 54.7 s), which limits how often it can run.
- **Do**: measure each and record it in the Log; profile one ladder title in a scratch copy and hand speedup proposals
  to the ladder stream (the harness and the fixture are its files).
- **Done when**: the 4.5 rows are recorded, and the proposals are in the Log with their measured effect.
- **Size**: half a day to a day. **Coordination**: none (read-only).

### PW8. A proxied callee's return reaches its caller (the ladder's critical path)

- **Why**: after the planned-arms landing, the targeted title gets all the way to the implementation entry's own
  `require(meceCount == 1, "Exactly one MECE tag is required")` (`MarketplaceV1.publishJobPost`, line 259) and fails
  there. That count is built from `bytes(marketplaceData.meceTags(tag)).length` — a `STATIC` call to
  `MarketplaceDataV1Proxy.__fallback()` whose delegate leg runs `MarketplaceDataV1.meceTags()`. The trace shows the
  *implementation* frame's value learned and accepted (`HOPTRACE stop callee=callee-impl-master-2
  reason=learned-retval`, then `reason=accepted`), and the caller then failing on the value it recorded for the
  **proxy** frame. This is the shape the parallel worker already recorded as "a value a proxied store returns reaches
  its caller empty", now measured on the ladder's own title; the same wall holds the other 23 titles.
- **What the model requires**: `packages/solidc/src/per-call/validator/checks.ts:299` —
  `if (!bytesEqual(calleeBlock.retval, call.result)) check('V5','V5_RETVAL_MISMATCH', callee)`. The callee block the
  caller records is the proxy's `__fallback` frame, so **that frame's `retval` must be the bytes the implementation
  frame recorded**, i.e. the value encoded by the implementation entry's own declared return encoding. Two facts
  block the current shape: `placeProxiedCallee` plans the proxy frame `returns: false`, and the generated fallback
  cannot record the value — a void entry must record nothing (`GenerateTargetTraversal.ts:35590-35606`, the
  `OP_SIZE` vs `0` check) while declaring it `returns (bytes)` re-encodes the delegate's bytes (pushdata framing, or
  a one-byte `bool`), so the two never compare equal.
- **Do**: give the generated proxy's fallback a frame that records the delegate's result **verbatim**, with no
  re-encoding — the smallest compiler notion of a raw retval, or one generated facade method per implementation
  entry typed to that entry's declared return — and plan the proxy leg with that return, threading the value the
  implementation frame's own close hands back. Files: `packages/solidcash/src/per-call/proxy/generate.ts` and
  `packages/solidcash/src/per-call/proxy/external-calls.ts` (the hop), plus the compiler's retval emission.
- **Done when**: a proxied callee's return reaches its caller through the shipped hop (a focused case in
  `test/per-call/call/` beside a control where the implementation returns nothing), and the fixture's `meceTags` read
  answers the value the implementation entry returned — measured by re-running `-t 'post job 1'` (~7 minutes with the
  deployment) beside `-t 'mece tags > remove mece tag'`.
- **Size**: a day or two. **Coordination**: the compiler half is `GenerateTargetTraversal.ts`/`proxy/generate.ts`,
  which the second worker is in; the ladder stream holds the hop's planning and will take whichever half the worker
  does not.

## Not for now

- Strict matchers and the checkpoint ladder: the ladder stream's (coordinator directions above).
- The class-(d) capability itself: the ladder stream's current round.
- Value sends into a contract entered twice or through a proxy, and paid bodies that call: they wait on the hop's
  callee frames (the parallel worker's held items).
- The self-call node at two positions: the second worker's reserved layout decision.
- Track S (3b, today's direct path), Phase R and Phase 3: after M2 (decision D3).
- C13 at infinity and the direct convention's zero-address rule: parity items to revisit once the matchers are
  strict.
- The kernel-era entry-name heuristics in `packages/solidcash/src/stateful/`: Phase 3 cleanup.

## Suggested split

- Parallel worker: PW5, then PW1 step 1 (with step 2 agreed with the ladder stream), then PW2.
- Second worker: PW4, then PW6 and PW7; PW3 once the ladder stream agrees the split (the second worker already
  works in `support.ts`).

## Status (2026-09-30, the second worker's round)

- **PW3, compiler half - landed** (`c3cf75d69`). An entry that writes nothing of its own now publishes an empty write
  list, a write inside a loop whose own body reaches no call is placed, and a runtime-loop upsert beside a call
  publishes the segment its write lands in (one call puts it at segment 1, two at segment 2; the machine's own
  control accepts a batch record at the write's segment and refuses the same declaration one segment later).
  **Handed over rather than served**: a *varying-key* loop upsert - the fixture's `updateJobWhitelist` - is not a
  verified batch (its collection has no `entry` slot in the block layout), and the machine refuses every witness
  declaration for it, including both segments and an insert, with `Program failed an OP_VERIFY operation.` inside
  the upsert body's own emitted code, before any record is read - and the shipped call path refuses it on the frame
  it plans itself (`conformance/loop-upsert-settlement.test.ts`), while the same mapping written once from a
  parameter settles there. The reproducers are `solidc/test/per-call/master/loop-upsert-segment.test.ts` (the
  fixture's own shape, the machine's refusals, and its segment control) and that conformance guard. **PW3 stays
  open for this shape** under the coordinator's 2026-09-30 decision that it stays in PW3 (recorded above); the item's
  box is unticked until the fixture shape settles, and an earlier round's wording that put the shape "outside PW3's
  done-when" was withdrawn in `c612e351b`. **That wording was never the item's Done-when**: the Done-when line is
  byte-identical at `1ec400927` and at HEAD ("the three refusals are gone from the published census, the master tests
  pass, and the ladder stream has taken the published facts"), with only a status sentence appended below it
  (`git show 1ec400927:docs/per-call/HANDOFF_PARALLEL.md | grep -n -A2 'Done when'`), so PW3's requirement was
  narrowed and restored inside one round and a citation of the interval reads a revision that is not on the branch
  (`git log -S "outside PW3" -- docs/per-call/HANDOFF_PARALLEL.md` names `87b092627` adding it and `c612e351b`
  removing it).
  **The served loop-upsert shape's machine accept, and where it is pinned** (the criterion that asks each published
  shape for `well-formed spend accepted, mutated spend refused`): the accept is
  `solidc/test/per-call/master/loop-upsert-segment.test.ts`'s third describe, `the run-time-loop upsert the shipped
  path settles, its machine verdict` - shipped compile, shipped deploy, `callPerCallEntry`, `{ accepted: true,
  objections: [] }`, then one byte of the commitment the loop wrote changed and `vm.stateSuccess(...)` not true - so
  the compiler-side file that pins the refusals carries the accept beside them; the same pair is
  `solidc/test/per-call/master/write-shape-publication.test.ts:232` (whose fourth case publishes that body) and
  `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts:94` (with the mutation refused in the same
  case). A citation of `loop-upsert-settlement.test.ts:86-97` reads the revision before `fddae17aa`.
- **PW4 - landed** (`a723cdfba`, `cfecf35b7`). The attack table cites `hostile/delegate-callee-mutation.test.ts`: the
  faithful forwarded hop is accepted, and a callee that is a second deployed contract's master is refused
  `V5_DELEGATE_TARGET_MISMATCH` off chain and by the facet's edge rule on chain.
- **PW6 - landed** (`59fc8077d`, `3d728a8f4`, `2ad01fb71`, `5b852ceff`). Rows 19, 24, 14, 16, 12, 10, 11 and 6 are
  served with their observables (24 through the proxy path, refused on the direct path by name); row 13 is served by
  the shipped composer and derivation (`edges/events-across-frames.test.ts` settles a callee's payload above 128
  bytes), with what the call entry point does to the same nesting pinned beside it and a root-frame control of the
  same size served there. G2 is ticked for all nine rows.
- **PW7 - landed** (`12c24e2d9`). The 4.5 rows carry measured numbers (VM evaluations, per-master runs, derive and
  build walls, the twenty-four-master shape, and the chunk outputs per append) and the first title is profiled:
  455.1 s, of which 452.9 s is the fixture deployment.
- **The fixture census was read back** with this round's compiler (`node --max-old-space-size=8192
  packages/testing/dist/cli.js compile --jobs 4`): 9 sources, 7 artifacts, **0 refusals** in all seven contracts.
  `MarketplaceV1.postThreadMessage()` publishes `writeSegments: []` and `MarketplaceV1.refund()` publishes its batch
  and its run, which is the two publication halves of PW3 at the fixture; `MarketplaceV1.updateJobWhitelist()`
  publishes nothing, for the wall recorded in the plan's Deviations.
- Still held elsewhere: PW1, PW2 and PW5.

### PW9. A dispatched body's `requires` published where the invoked body's own pointers land

- **Why**: after PW8 the revert-shaped titles stop reporting `no source message` and start reporting the contract's
  own reason, except where the failing `require` sits in a **call-making** body. Measured on a neutral replica: the
  machine reports the failing instruction relative to the invoked subroutine (`ip = 4`), while the compiler publishes
  that selector's `debug.functionDebug[selector].requires` in **program** coordinates (`ip = 589`), and
  `artifact.debug.requires` is empty; `frameRevertReason` (`packages/solidcash/src/per-call/composer/refusal.ts:222`)
  looks both up, misses, and falls back to `no source message`. The same entry with its call removed recovers its
  message, so the gap is the coordinate space, not the reason.
- **Do**: publish a call-making (subroutine-invoked) body's `requires` and source map in the coordinates the machine
  reports for it, or publish the base the reporter must subtract; then a revert inside such a body names its own
  message. Reproducers already exist: `packages/solidcash/test/per-call/reverts/zero-target-call.test.ts` and
  `packages/solidcash/test/per-call/reverts/chunk-array-range-read.test.ts` (both currently assert the frame and the
  line, and say the message is not surfaced).
- **Done when**: those two tests assert the entry's own message and the fixture's `post job with invalid token`,
  `post job from unregistered user` and the other revert titles report their source text.
- **Size**: half a day to a day. **Coordination**: `refusal.ts` is the ladder stream's; the publication is the
  compiler's. Confirm before editing `refusal.ts`.
