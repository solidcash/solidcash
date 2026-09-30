# Parallel work beside the ladder: handoff (2026-09-30)

Items a worker other than the ladder stream can take now, each off the ladder's critical path or ahead of it, with
where it lives, when it is done, and what it must coordinate. Claim an item in the plan's claims section
(`PLAN_MARKETPLACE_66.md`, "Claims: work a second worker holds") with a docs commit before starting; the commit that
lands it removes the claim line.

## Where the ladder stands

- Last full ladder: 17/66 (run 16, `a62c78ef8` plus the write-segment landing). All 17 are class (a); the five
  composition groups are at zero: (d) repeated callee 0/23, (e) fan-in 0/11, `approveResult` re-entry 0/3,
  `arbitrate` re-entry 0/5.
- The ladder stream is on L3, #18 `post job 1`: the wall is the second reach of a mapping-writing callee, treated as
  the class-(d) capability (22 further titles hang on it). Evidence: `PER_CALL_HOP_TRACE=1` traces in `{SCRATCH}`.
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
  it at segment 1, two at segment 2), which the machine's own segment control accepts at that segment and refuses one
  segment later (`solidc/test/per-call/master/loop-upsert-segment.test.ts`). **That loop shape is served end to end
  when the key is the frame's**: `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts` drives it
  through the shipped deploy and call path, the machine accepts the spend, and the same case then changes one byte of
  the record the entry wrote and the machine refuses it.
  **Open, pending the coordinator's decision**: the fixture's `updateJobWhitelist`, whose key is an **element of a
  caller-supplied array**, so a different node per turn. It is not a verified batch at all — the entry's
  block layout reserves no `entry` slot for the collection — so no segment declares its records and no write fact can
  state them; the machine refuses the well-formed spend wherever its node record is declared (segment 0, the last
  segment, both, and an insert: `Program failed an OP_VERIFY operation.`), and it refuses it on the frame the shipped
  call path plans **itself** (`conformance/loop-upsert-settlement.test.ts`), while the same loop over a key the frame
  holds settles on that path. So the open part is the varying key: a per-turn node is a run-time target the
  run-time-loop machinery settles, which this stream's `proxy/**` lane and the frame's layout would have to carry.
  Pinned reproducers:
  `solidc/test/per-call/master/loop-upsert-segment.test.ts` (the fixture's own shape, the machine's refusals, and the
  segment control) and `solidcash/test/per-call/conformance/loop-upsert-settlement.test.ts` (the shipped call path).
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
- **Done when**: the three refusals are gone from the published census, the master tests pass, and the ladder
  stream has taken the published facts. **Status 2026-09-30: two of the three shapes are done.** The census read back
  with this round's compiler shows seven contracts and **0 refusals**, `postThreadMessage` publishes
  `writeSegments: []` and `refund` its batch and its run, the master tests pass, and the facts are in the ladder
  stream's hands. **The third shape is open, not done**: the fixture's `updateJobWhitelist` writes a **different node
  per turn** — its key is an element of a caller-supplied array — and that variant still publishes no write fact. The
  entry's block layout reserves no `entry` slot for the collection, so nothing declares those records, and the machine
  refuses the well-formed spend on the frame the shipped call path plans itself
  (`conformance/loop-upsert-settlement.test.ts`), while the same loop over a key the frame holds settles on that
  path. Serving it needs the collection declared in the frame's layout and the per-turn operands derived, which
  is compiler code generation plus the ladder stream's `proxy/**` planning — **the coordinator's decision on who
  takes it is what this item now waits for**. Reproducers: `solidc/test/per-call/master/loop-upsert-segment.test.ts`
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
  open for this shape** until the coordinator decides who takes it (`HANDOFF_PARALLEL.md`'s PW3 item waits on that
  decision).
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
