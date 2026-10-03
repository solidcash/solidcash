# Walls past 50/66: predicted from the code (2026-10-03)

Measured at `055833fb4`: a full 66-title run (44 passed, the set unchanged since 04:48), the walls-ahead replicas under
`PER_CALL_AHEAD=1` (9 of 142 cases off their pins), a census of the compiled marketplace's entries (calls, kinds,
guards, loops, side-cars, write segments), and the sources in `.marketplace/contracts/`. Each wall names its owner;
"in progress" marks work started ahead of the ladder in the composer lane. Updated after `27a60158f`: the full
66-title run of 2026-10-03 reads **50 passed | 16 failed (66)**, the scoreboard's ticked set is exactly that passing
set. Updated again at `384859f30` from targeted title runs (no full run): **56 expected** - the 50 plus #30
(`499e1d178`), #58 (`69283cde1`), #55 and #57 (`b366f1bdf` on `69283cde1`), #19 (`db78982a0`) and #46
(`384859f30`), each confirmed green by its own run.
**Measured 2026-10-03 by a full 66-title run at `db78982a0`: `55 passed | 11 failed (66)`** - the 54 above
plus #19 (`db78982a0`, the read path's per-turn frames for a loop's calls), with the ticked set exactly that
passing set. The 11 still failing are #46, #50-#53, #59-#62, #65 and #66; each one's own verdict is in the
plan's Log row for `db78982a0`.

## The order the titles meet them (HEAD `384859f30`)

| Titles | Wall at HEAD | Next walls predicted from the code | Owner |
| --- | --- | --- | --- |
| #50 approve sanity, #59 arbitrate sanity | their first steps expect the entry's own revert (`job in invalid state`, `not creator`, `not arbitrator`, `not disputed`), which fires before any call; a refusal the planner raises for the call the entry never makes is thrown first (V6 is applied to settle-time refusals only) | each title's success step, below | hop; in progress (R9) |
| #50, #51 approve, #52 (its approve step) | `release` writes the escrow record and the claim it calls updates the same node (`setClaimed`): `enclosed-reads.ts` chains an inner READ only, so the inner UPDATE is refused ("one of them enters the other") | the enclosing write is body-computed since `b366f1bdf`, so its value must be learned from the writer's close; the long value is written twice in one hop (below); token balance inserts beside the node every payout turn debits (`requireSatisfiableReachWrites`, `requireChainableNodes`; the compiler's sorted insert proves its predecessor against the spent input, not the declared view) | hop + compiler; in progress (D1: enclosed update and learned value; P5: the inserts) |
| #50-#52, #59-#62, #66 | a chunked mapping value written twice in one hop (`settle` then the claim's `setClaimed`; `release` then `setClaimed`): the hop planned the second writer's value from the deployment's node (`nodeFieldValue` reads the live node, not the value the earlier reach left), so its run sat at a stale digest's address; not a compiler protocol change - each writer creates its own run | - | hop; in progress (D1, with the enclosed update) |
| #59-#62 arbitrate, #66 | the dispute step passes now (`69283cde1`, `b366f1bdf`); the arbitration then meets the double write above, re-reads its own flag through the claim (chains, `4900bb9b9`), and pays out only the turns its guard lets through (`4900bb9b9`) | the token balance inserts above | in progress (P5 for the inserts) |
| #52, #53 refund, #65 refuse arbitration (job taken) | a write that shrinks the job record across a chunk boundary (3 to 2 chunks): `refuseArbitration` is refused by name (`sizedDynamicRun`); `refund` sizes its run from the record's declared length and fails in the frame (attributed to line 488) | #52's approve step (above); #53's `reopenJob` shrinks the record again | compiler + hop; in progress (S1) |

Served on 2026-10-03, each confirmed by its own title run: #42 take job, #48, #49 deliver result and #54 dispute
sanity (`ed5ccadad` slice); #45 pay start job (`0ad9ecf7f`); #31 update job (`5c4f232b7`); #30 whitelist worker
(`499e1d178`: a run a loop frame only reads is found from the declaration's end); #58 dispute worker (`69283cde1`:
compat address equality by identity, forwarded `bytes` read as bytes); #55 dispute with arbitrator and #57 dispute
creator (`b366f1bdf`: a published local follows the writes before its read); #19 post two jobs (`db78982a0`: a read
plans one frame per calling loop turn); #46 post thread message sanity (`384859f30`: a signer or contract passed for an
`address` argument resolves through `getAddress()`, as ethers does). Moved, not yet green: #52 and #53 past
the early read of their own record (`c46cdeb23`), #65 past `Unicrow.refund` (`69283cde1`, `b366f1bdf`), #50 and #51
past the token transfer's target (`12897d9b3`: an address read back through a call result reaches a callee as the
lock it names).

## Replicas whose pins were stale (refreshed 2026-10-03)

- MS5 (`origin-gated-payout.test.ts`): the guarded escrow's entry now publishes all three of its writes, so `refund`
  and `refuseArbitration` settle on the guarded market too; both pins assert the settlement and the store counts.
- `packed-address-argument.test.ts`: the arbitration with its amounts settles, and its payload is pinned as the one
  this hop states. **The divergence this entry used to name is refuted**: an instrumented `asBytes` reports the
  elements the entry asks it for (`uint16` 8000, `uint16` 2000, `uint256` 800, `uint256` 200, `uint256` 0) and every
  one is big-endian as the body declares it, so the left-aligned words in the payload are the fixed-width layout, not
  a byte-order error. No SDK element-encoder item is owed. It is no settlement wall: the stated data equals the
  stored event byte for byte, so plan and body agree. The arbitrate titles and the integration test do decode that
  payload (`decodeJobArbitratedEvent`, test lines 2883, 2961, 3040 and 3341); whether the harness decoder reads the
  fixed-width layout as the test expects is being checked from the code.
- `ahead/fan-in.test.ts`: the second append to one job's chunked notes chains, so its `take` case asserts the
  settlement instead of the refusal.
- The whole directory is green again: 16 files / 143 cases. The `ahead/` files run only under `PER_CALL_AHEAD=1`, so a
  moved wall goes unnoticed by the focused suites; a run per landing that touches the hop or the composer keeps them
  honest.

## Also found while looking

- A void `return;` that EarlyReturnTransformation did not reach compiled to nothing: served (`a625404d9`), and a call a
  lowered return gates is published under that return's own predicates (`643853c16`).
- Compat `block.timestamp` reads each contract's own oracle register (`__block_timestamp`), not the transaction's
  locktime; the comment in `SynthesizeBlockOracle.ts` that says otherwise is stale. The dispute's time window is not a
  wall on the mock network: each mined block advances the clock by at least a second and every oracle is synced after
  each transaction.
- The kernel lane's 822f3001a (a call condition reads `msg.sender` from the authenticated executing frame) was lost
  in the 2026-09-24 module extraction: `ExternalCallPredicate` fails its two cases on this branch. Not a marketplace
  wall today; the per-call path passes its own sender to the resolver.
- A self-referential mapping update `m[k] = m[k] + x` publishes its write one segment after its source position
  (`m[k] = lit` and struct field writes publish their own); a re-entered reader would see the earlier view. The
  marketplace's writes are not affected.
