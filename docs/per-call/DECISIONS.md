# Per-call decisions ledger

The single place an item's **current status** and its **authorization** live. Other per-call documents cite a row
id from here instead of restating a decision; when a decision changes, its row is edited in place and the row it
replaces is marked `SUPERSEDED-by <id>`. A status sentence anywhere else is a pointer, not a decision: if the two
disagree, this file is right and the other one is stale.

Two things are checkable rather than asserted. The **provenance** column names where the answer came from, so a
reader can tell an authorization from a paraphrase. And
`packages/solidc/test/per-call/master/decisions-ledger.test.ts` enforces the mechanical half: outside a pointer
line or this file, a line that names PW3 may not carry a superseded status phrasing, each id appears exactly once,
every `SUPERSEDED-by` names a row that exists, and each item has exactly one live row.

| id | date | item | question asked | answer | provenance | status |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | 2026-09-30 | the ladder's matchers, its checkpoint run, and the repeated-callee capability | how the ladder stream should spend its rounds before the next milestone | strict `revertedWith`/`withArgs` for per-call contracts before M1, a full ladder at the next checkpoint, and the repeated mapping-writing callee treated as the class-(d) capability | coordinator directions recorded as Log rows `f85b9d3d3` and `912ff9400` in `PLAN_MARKETPLACE_66.md`, and carried at the top of `HANDOFF_PARALLEL.md` | live |
| D2 | 2026-09-30 | PW3's varying-key item: which lane implements the SDK's per-turn record protocol | hand the SDK protocol to the ladder stream, or implement it in this lane | first answered "hand it to the ladder stream", then revised the same day to "implement the SDK half here instead" | the ask_user_question answers of that session, preserved in the handoff's PW3 item at the time and in the session's compaction segments | SUPERSEDED-by D5 |
| D3 | 2026-09-30 | Track S, Phase R, Phase 3, the remaining ECDSA parity cases, and the kernel-era name heuristics | when do these start | after M2 (66/66 on two consecutive full runs) | the plan's scope and not-for-now lists in `PLAN_MARKETPLACE_66.md` | live |
| D4 | 2026-09-30 | PW7's composed-transaction half of the chunk-output row | leave it scoped as recorded, spend a round resolving it, or hand it to the composer lane | "Leave it scoped as recorded (Recommended)" | `chat_history.jsonl:530`, the `ask_user_question` tool result (tool call id `call_00_v8PauXmjzlY22P4sZrp02281`) in this session's directory | live |
| D5 | 2026-09-30 | PW3's completion, and the fixture's call-in-loop shape | record PW3 as met with the fixture shape handed to the ladder stream, keep PW3 open in this lane, or serve it here by crossing into the excluded hop lane | "Hand the fixture shape to the ladder stream, PW3 met on its Done-when (Recommended)" | `chat_history.jsonl:530`, the same `ask_user_question` tool result (tool call id `call_00_v8PauXmjzlY22P4sZrp02281`) | live |

## What each live row decides, and what it does not

- **D5** decides PW3's status: met on its own Done-when (the three refusals gone from the published census, the
  master tests passing, the published facts in the ladder stream's hands), with the fixture's `updateJobWhitelist`
  shape - a varying-key loop upsert whose loop body also calls `publishJobEvent`
  (`.marketplace/contracts/MarketplaceV1.sol:474-497`) - handed to the ladder stream as a pinned reproducer. The
  loop protocol itself is served and is this lane's landing: one to four turns settle through the shipped path in
  any key order, each with a refused record mutation. D5 does **not** claim the fixture's own entry publishes a
  write-segment fact; it does not, because the write's segment is decided by a call inside the loop body, which is
  the hop's callee-frame planning.
- **D4** decides that PW7's chunk-output row certifies the shipped encoders' arithmetic and that the composed
  reading stays owed, with the blocker named (the read-modify-write of one long value in one frame).
- **D1** and **D3** are the ladder stream's and the plan's standing directions, unchanged by this lane's work.
