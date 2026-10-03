# Walls past 44/66: predicted from the code (2026-10-03)

Measured at `055833fb4`: a full 66-title run (44 passed, the set unchanged since 04:48), the walls-ahead replicas under
`PER_CALL_AHEAD=1` (9 of 142 cases off their pins), a census of the compiled marketplace's entries (calls, kinds,
guards, loops, side-cars, write segments), and the sources in `.marketplace/contracts/`. Each wall names its owner;
"in progress" marks work started ahead of the ladder in the composer lane. Updated after `27a60158f`: the full
66-title run of 2026-10-03 reads **50 passed | 16 failed (66)**, the scoreboard's ticked set is exactly that passing
set, and the walls below are the verdicts that run printed.

## The order the titles meet them

| Titles | Today's wall | Next walls predicted | Owner |
| --- | --- | --- | --- |
| #42 take job, #66 integration | **served**: a chunking mapping node reached twice chains like any other (`ed5ccadad`: the hop records the nodes a reach rewrote and the value each left, orders their writers, and chains the node's one input view to view); #42 passes | #66 now reaches `UnicrowDispute.challenge()` line 79 (`1-009`, the same wall as #57) | - |
| #45 pay start job | **served** (`0ad9ecf7f`): the title passes | - | - |
| #48 deliver result, #49 deliver result | **served** (2026-10-03 slice): their setup's `takeJob` now settles and the titles pass | - | - |
| #54 dispute sanity (no arbitrator) | **served** (2026-10-03 slice): same basis | - | - |
| #46, #55, #60-#62 | their setup's `takeJob` now settles; each reverts on its own path (`Expected transaction NOT to be reverted, but it reverted`) | each title's own revert path | per title |
| #52 refund sanity | reports the callee's revert (`1-011`, `Unicrow.refund`) where the EVM reports the entry's own `onlyWorker` "not worker", which fires before any call | the execution-order reporting below | hop; in progress (R5) |
| #57, #65, #66 | one callee-side wall: `UnicrowDispute.challenge()` line 79 (`1-009`) and `Unicrow.refund()` line 229 (`1-011`) | - | escaper lane (`Unicrow*`) |
| #53 refund | `Unicrow.refund()` line 253 (`no source message`) | - | escaper lane |
| #58 dispute worker | `MarketplaceV1.dispute()` line 219 (`no source message`), with the run it declares for dynamic `jobs` 3 chunk(s) sized from the record's own declaration | - | hop |
| #50, #51 approve result, #59 arbitrate sanity | the hop's interleave refusal: `Unicrow.release()` enters `Unicrow.getEscrow()` over one `escrows` node, and `UnicrowArbitrator.arbitrate()` enters `getArbitratorData()` over one `escrowArbitrator` node - it fires before the Unicrow token-transfer target the earlier map named for them | the Unicrow identity wall (`1-009`/`1-011`) behind it | hop |
| #19 post two jobs | a read frame of `MarketplaceV1.getJob()` line 212 refuses (`no source message`) | - | compiler + hop; in progress (R2) |
| #30 whitelist worker | the entry's own check reports `no source message` | - | hop |
| #31 update job | **served** (`5c4f232b7`) | - | - |

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
