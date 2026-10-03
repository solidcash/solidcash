# Walls past 44/66: predicted from the code (2026-10-03)

Measured at `055833fb4`: a full 66-title run (44 passed, the set unchanged since 04:48), the walls-ahead replicas under
`PER_CALL_AHEAD=1` (9 of 142 cases off their pins), a census of the compiled marketplace's entries (calls, kinds,
guards, loops, side-cars, write segments), and the sources in `.marketplace/contracts/`. Each wall names its owner;
"in progress" marks work started ahead of the ladder in the composer lane.

## The order the titles meet them

| Titles | Today's wall | Next walls predicted | Owner |
| --- | --- | --- | --- |
| #42 take job, #66 integration | `MarketplaceV1.takeJob()` line 662: the entry frame's witness read (`OP_SPLIT` invalid index) | the token fan-in: `Unicrow.pay`'s `transferFrom` reads the allowance the root's `approve` wrote in the same transaction (MS3, `ahead/fan-in.test.ts`) | ladder (hop) |
| #45 pay start job | `payStartJob()` line 760, the same `OP_SPLIT` signature as `takeJob` | as `takeJob`, without the side-cars | ladder (hop) |
| #46, #48, #49, #54-#58, #65 | their setup's `takeJob` ("expected not reverted") | none predicted: their own entries match settling shapes (one store call; MS6 dispute served; MS5 refund/refuseArbitration replicas now settle past their pins) | - |
| #19 post two jobs, #30 whitelist worker | a mapping write inside a loop whose body calls `publishJobEvent` (`_updateJobWhitelist`, line 474): no per-turn write segment is published; #30 is refused by the hop, #19 fails the write's check | - | compiler + hop; in progress (R2) |
| #52 refund sanity, #53 refund | `refund` declares its mapping batch in segment 2 and its dynamic record's chunk run in segment 4, and the frame reads the run past its own block's records (refused by name) | `_refund`'s one-turn whitelist loop (row above) | compiler/composer; in progress (R3) |
| #50, #51 approve result | the setup's `takeJob` | MS4 (`ahead/reentry-payout.test.ts`) now passes the re-entered guard it was pinned at and stops in the payout loop: `Escrow.sendShare()` line 36 reads an input index the transaction does not have (a node one transfer created, rewritten by the next) | hop; in progress (R1) |
| #59-#62 arbitrate | the setup's `takeJob` | MS7 (`ahead/deep-arbitration.test.ts`) now stops earlier than pinned: the re-entered `STATIC` `Judge.readFlag()` (line 64) reads the flag its outer frame just wrote through a view that does not parse; a re-entered frame needs the view its outer frame left | hop; in progress (R1) |
| #31 update job | a 99,999-byte `contentHash` cannot be pushed (BCH's element limit is 10,000 bytes), so the SDK fails before the contract's own "incorrect data length" check | an option: derive with the largest encodable stand-in, report the contract's revert if it reverts, refuse by name otherwise, never broadcast | open |

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
