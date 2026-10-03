# Walls past 44/66: predicted from the code (2026-10-03)

Measured at `055833fb4`: a full 66-title run (44 passed, the set unchanged since 04:48), the walls-ahead replicas under
`PER_CALL_AHEAD=1` (9 of 142 cases off their pins), a census of the compiled marketplace's entries (calls, kinds,
guards, loops, side-cars, write segments), and the sources in `.marketplace/contracts/`. Each wall names its owner;
"in progress" marks work started ahead of the ladder in the composer lane.

## The order the titles meet them

| Titles | Today's wall | Next walls predicted | Owner |
| --- | --- | --- | --- |
| #42 take job, #66 integration | the entry frame's `OP_SPLIT` is **served** (`0ad9ecf7f`: an argument's own call was read from the wrong stack slot, so the arbitrator fee became the record loop's count); it now stops at the hop's named refusal of a second `publishJobEvent` reach on one chunking `jobEvents` node (`requireSettledNodeChains`) | the token fan-in behind it is served (`bc67c1f7e`: MS3's `payStart` settles) | hop; in progress (R4) |
| #45 pay start job | **served** (`0ad9ecf7f`): the title passes | - | - |
| #46, #48, #49, #54-#58, #65 | their setup's `takeJob` ("expected not reverted") | none predicted: their own entries match settling shapes; sanity titles that expect an entry's own revert before a call need the row below (#52) | - |
| #19 post two jobs, #30 whitelist worker | a mapping write inside a loop whose body calls `publishJobEvent` (`_updateJobWhitelist`, line 474): no per-turn write segment is published; #30 is refused by the hop, #19 fails the write's check | - | compiler + hop; in progress (R2) |
| #52 refund sanity, #53 refund | the batch and run in different segments are **served** (`a4c797027`); #52 now reports the callee's revert ("1-011", `Unicrow.refund`) where the EVM reports the entry's own `onlyWorker` "not worker", which fires before any call | #53: its setup's `takeJob` | hop; in progress (R5: report the first failure in execution order) |
| #50, #51 approve result | the setup's `takeJob` | MS4 now **settles** (`bc67c1f7e`: a frame starts from the views earlier frames of its contract left) | - |
| #59-#62 arbitrate | the setup's `takeJob` | MS7 now **settles** (`bc67c1f7e`) | - |
| #31 update job | **served** (`5c4f232b7`): "incorrect data length" is ethers' own encoder error for a `bytes32` of another length, raised before any contract runs; the per-call handle now checks each argument with the shared encoder (a `bytesN` length, an integer's range) before composing, and the title passes | - | - |

## Replicas whose pins are stale at `055833fb4`

- MS5 (`origin-gated-payout.test.ts`): `refund` and `refuseArbitration` no longer stop at the escrow's mapping write;
  `refuseArbitration` settles.
- `packed-address-argument.test.ts`: the arbitration's split no longer refuses.
- MS4 and MS7: moved as in the table. The `ahead/` files run only under `PER_CALL_AHEAD=1`, so a moved wall goes
  unnoticed by the focused suites; a run per landing that touches the hop or the composer keeps them honest.

## Also found while looking

- A void `return;` that EarlyReturnTransformation does not reach compiles to nothing, so the code after it runs
  (confirmed in bytecode; every early return in a `fallback()` or `receive()` too). In progress (AB). The marketplace
  has no return before an external call; returns before writes are being checked.
