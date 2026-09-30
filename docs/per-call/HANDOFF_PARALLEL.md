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

### PW3. Write segments for the entries that publish none

- **Status**: ledger row D5 (`docs/per-call/DECISIONS.md`) - met on the Done-when below, with the fixture's
  call-in-loop shape handed to the ladder stream.
- **Why**: `postThreadMessage` (no record write of its own), `updateJobWhitelist` (a loop upsert whose body also
  calls) and a batch write beside a dynamic run in another segment published no write segment and stop the ladder at
  #20, #30, #46 and #47.
- **Do**: publish each shape's fact in `support.ts`/`stop-sites.ts`, with a master test per shape in
  `solidc/test/per-call/master` that the body verifies the write at that segment (accept and refuse). This lane owns
  the loop protocol's SDK side (`packages/solidcash/src/per-call/call/**`); `per-call/proxy/**` and `read.ts` stay the
  ladder stream's.
- **The code that landed**: `c3cf75d69` (a write list states the empty case; a loop whose own body reaches no call
  has its write placed - one call puts it at segment 1, two at segment 2; a batch beside a run in another segment
  publishes both), `aecdbf5ef` (a varying-key loop upsert declares the collection's `entry` slot, the artifact
  publishes the in-loop access, and the emitter addresses the turn's node from the frame's parked base),
  `566f58571` (the turns are derived from the artifact's own `sortedUpsertLoopInfo`, each with its own key),
  `18bd5bda5` (the plan declares one node per turn where the emitted coordinate reads them; the declared-ordinal
  arm's base and sign, the pending-flush mints, the segment-close exemption and the per-insert predecessor
  repetition are all corrected there), `e2c583612` and `2149801f7` (the caller's key array is handed to the frame in
  the order the body walks its chain, so a descending array settles, and three and four turns settle too).
- **Served, measured through the shipped deploy and call path**: an entry that writes nothing of its own, a
  runtime-loop upsert beside a call, a batch beside a dynamic run, and the loop upsert for one to four turns in any
  key order - each accepted by the machine with a refused mutation beside it. Pins:
  `solidc/test/per-call/master/write-shape-publication.test.ts` (which carries the shipped-path verdict for its own
  body), `master/write-segments-publication.test.ts`, `master/loop-upsert-segment.test.ts`,
  `solidcash/test/per-call/call/loop-turns.test.ts`, `conformance/loop-upsert-settlement.test.ts` and
  `conformance/loop-upsert-beside-call.test.ts`.
- **Refused by name, and not served**: a per-key value array (`balances[workers[i]] = amounts[i]`, which the SDK may
  not permute), and a loop whose body makes the call. The second is the fixture's `updateJobWhitelist`
  (`.marketplace/contracts/MarketplaceV1.sol:474-497`, where the write and `publishJobEvent(...)` share one
  iteration): its write fact cannot be stated because the write's segment is decided by a call inside the loop body
  (`support.ts:722`'s `callFreeNestedBlocks` returns undefined for that shape), and `callPerCallEntry` refuses the
  body for the callee-frame reason. Settling it is the hop's callee-frame planning, PW1/PW2's lane, which is what D5
  hands over; the reproducer is `master/loop-upsert-segment.test.ts` (the fixture's own shape, still refused wherever
  its node record is declared), `write-segments-publication.test.ts:142`, and the source lines above.
- **Done when**: the three refusals are gone from the published census, the master tests pass, and the ladder stream
  has taken the published facts. Met: 7 contracts / 0 refusals, `solidc/test/per-call/master` 613 in 83 files (the ledger guard included).
- **Coordination**: high (the ladder stream wrote `support.ts` and owns `proxy/**`); agree the split first.

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
  fixture's own shape, the machine's refusals, and its segment control) and that conformance guard. **PW3's status is
  ledger row D5** (`docs/per-call/DECISIONS.md`), met on the item's own Done-when: the three refusals are gone from
  the published census (7 contracts,
  0 refusals, `{SCRATCH}/census2-head.log`, `BUILD=0`, `COMPILE=0`), the master tests pass (613 in 83 files, the ledger guard included), and the
  published facts are in the ladder stream's hands. Two shapes are recorded as refused **by name** rather than
  served, and neither is one of the item's three: a **per-key** value array (`balances[workers[i]] = amounts[i]`,
  the reorder is not licensed there), and a loop whose **body makes the call**, which needs the hop's callee-frame
  planning (PW1/PW2's lane). An earlier round's wording that placed the shape beyond the item's Done-when was
  withdrawn in `c612e351b`. **That wording was never the item's Done-when**: the Done-when line is
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
- **Decision (coordinator, 2026-09-30, this session)**: the **composed-transaction half of the chunk-output row stays
  scoped as recorded** rather than resolved now: the row certifies the shipped encoders' arithmetic (1 chunk for one
  event's append, 27 at the thirtieth, 423 across thirty), the blocker for a composed reading is the read-modify-write
  of one long value in one frame, and the resolving change is named in the row. The question put to the coordinator:
  leave it scoped, spend a round resolving it, or hand it to the composer lane - answer, leave it scoped.

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

### PW10. A read-only entry reached through a proxy (the read shape of the 24 titles)

- **Why**: a per-call transaction reaches a proxied contract by naming the proxy's master; the proxy's `__fallback`
  records a `DELEGATE` call to the implementation. For a **read-only** entry the caller's compiled body requires its
  call record's kind to be `STATIC` (the site's kind is fixed by the interface declaration it was compiled
  against), so the plan states the proxy frame `STATIC` and its own call to the implementation `DELEGATE`, which
  `checkV10` refuses (`V10_STATIC_NON_STATIC_CALL`, `packages/solidc/src/per-call/validator/checks.ts`). Measured: the
  same hop settles and broadcasts with the method declared non-`view`, and fails with it declared `view`
  (`HOPTRACE verdict id=validator/1 index=2 objection=Program failed an OP_VERIFY operation.`). Most of the
  remaining acceptance titles read through a proxy: `meceTags`, `userRegistered` and `arbitratorRegistered` are all
  `STATIC` sites in the specification's own edge catalog (section 22).
- **Why the relaxation is sound**: V10's property is "nothing below a read-only frame changes state", and
  `checkV10` already collects that subtree transitively and checks every frame in it for unchanged record
  commitments, no event, no send and no value. The only clause the proxy leg trips is the **call-kind** one, and a
  `DELEGATE` call is not a state change in itself: it runs the callee's code against the caller's records, and the
  delegate frame's own entries are checked by the same loop. Admitting `DELEGATE` as a callee kind while keeping
  every other requirement on that frame and its subtree keeps T34.
- **Do**: relax the call-kind clause (off chain) and `requireStaticCalls` (on chain, `validator/program.ts`) to
  accept `STATIC` or `DELEGATE` and nothing else, with the rest of each walk unchanged; prove it with machine-level
  pairs — a read-only delegate accepted, and the same plan refused when the delegate changes a record, emits, sends
  or carries value, at two levels, both off chain and from the program.
- **Done when**: a `view` call through a proxy settles with the caller reading the value, and the refusals above
  still hold from the program.
- **Size**: half a day to a day. **Coordination**: `validator/` only — the ladder stream has an agent on it.

## Status (2026-09-30, the parallel worker's round)

- **PW5 - landed** (`700abdba6`). The 11 cross-contract rows are pinned in `conformance/cross-contract-identity.test.ts`,
  the EVM's answer beside the refusal each meets by name; with the 10 single-contract rows, 21 of 21 are recorded.
  G1 stays open until each row is served (its plan text lists the refusals).
- **PW1 - step 1 and the reporter half of step 2 landed** (`274f29eb9`, `1d2e3ecd1`). `ahead/revert-after-calls.test.ts`
  fails the seven checks through the shipped proxy path. The settle loop already asks the reporter on a stall; the
  reporter now names the innermost frame the execution reached rather than an unreached leg refusing on its own
  unfilled reference, so five checks report their own reason and the revert inside the third token call names the
  callee's custom error. Left in the settle loop (`proxy/deploy.ts`, the ladder stream's): `errorArgs` on the thrown
  error, and the callee-first order that lets an unreached callee's revert beat an earlier check of the entry.
- **PW2 - landed** (`8f3ae98ee`, `48c4e03d3`, `315e2b853`, `a808809d9`, `c27583fa5`, `86c803be1`, `d99258e47`,
  `b5273653e`, `c51f24376`). The probes in `test/per-call/ahead/`, the plan's "Walls ahead" table (shape, first wall,
  what stands behind it, file, owner) and `ahead/` in `MANIFEST.md`. Fixed on the way, each with its focused case: a
  call site's branch predicate published as it stands where its branch starts (`569c0d60d`); a method named like a
  built-in on a contract receiver compiled as the built-in (`73265877c`, `2aa73362e`); a long mapping value's chunk
  taken as a data record by the deployment classifier (`82493523a`); and a constructor's struct-literal mapping value,
  which crashed the genesis rather than being refused by name (`25173d5a3`). Handed over through the table: the hop's
  walls, with a patch for the delegate frame declaring records its entry does not name (applied in `184d88c25`),
  and the per-call clock that never moves
  (`oracle/blockOracleUpdater.ts`). Beyond PW8 on `post job 1`'s own path stand PW10's `view` reads through the data
  proxy, the token pull's allowance read beside its balances batch, which the hop drops (`job-updates.test.ts`), and,
  as last probed, two reaches of one mapping node (`publishJobPost`'s `balanceOf(msg.sender)` beside
  `transferFrom(msg.sender)`).
- **PW9 - landed, for a different cause** (`039dbdf5b`). There was no coordinate mismatch: the ip the machine reports
  and the published `requires` are both in the invoked body's coordinates, and the reporter reads them correctly. The
  zero-target entry failed first at its call-count guard, pinned to a fixed count because a call in the right operand
  of `&&` or `||`, or in a conditional arm, was taken as made on every path; the same cause let the skip path accept
  a forged call record (proven on the machine, closed). `reverts/zero-target-call.test.ts` reports `invalid token`,
  and `chunk-array-range-read.test.ts` already reported its own message (since `f2e34600d`). Not measured: the
  fixture's revert titles. Handed over: such a call site publishes no condition, so the planner states a visit
  whenever its target is non-zero.

### PW3 addendum: the nested-key run-time-loop write the job posting entry makes

- **Measured on the committed base** (`354ccf998`, `17697ac0e`), fixture recompiled from scratch, filtered run
  `-t 'post job 1|post job with invalid deadline|remove mece tag'`: `remove mece tag` passes; both job-posting
  titles stop on `the implementation's "publishJobPost" entry writes 1 mapping entry(ies) across 0 sorted
  batch(es), and this hop plans one batch to one collection`.
- **The write**: `whitelistWorkers[jobs.length - 1][allowedWorkers_[i]] = true`, inside
  `if (allowedWorkers_.length > 0) { for (uint i = 0; i < allowedWorkers_.length; i++) … }`. The artifact publishes
  it in `entryAccesses` (`slotIndex 0`, `keySources` = an expression for the job id and
  `arridx(id:allowedWorkers_, id:__sp10_i)`, `operations: ["write"]`, `valueSource: "lit:true"`) and
  **`sortedUpsertLoops` is empty** for the entry, so the hop's batch planner has nothing to plan and refuses.
  `stateLayout.collections` has the collection as `sorted: true` with key types `["uint256","address"]`.
- **Why it is PW3's**: it is the same nested-key, varying-element write shape as `updateJobWhitelist`, and the
  reason it was not served was the machine's own refusal of every declaration tried for that shape (PW3's status at
  that revision; the current status is ledger row D5 in `docs/per-call/DECISIONS.md`), not the planner's choice. Whoever publishes and serves the varying-key loop row serves both entries —
  this one is the fixture's own acceptance title (`post job 1`), so it is worth measuring against it directly:
  `cd /Code/cashscript/.worktrees/per-call && node --max-old-space-size=8192 packages/testing/dist/cli.js compile
  --jobs 4` then `yarn vitest run --config vitest.marketplace.config.ts --no-file-parallelism -t 'post job 1'`
  (~8 minutes, most of it the fixture deployment).
