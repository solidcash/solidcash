# Walls: none open - the ladder is 66/66 (2026-10-03)

**Measured 2026-10-03 by two consecutive full 66-title runs on one cold fixture: `66 passed (66)` both times, with
byte-identical passing sets (`diff` empty).** Run 1 at 3221.9 s measured a dist built from `6e2626e48`; run 2 at
3115.0 s measured a dist built from `0c5d27f1d` and a fixture compile that hit all nine compiler cache entries, so
the artifacts are the same bytes. HEAD advanced between the runs because other lanes were committing, so the plan's
M2 clause "two consecutive full runs of one commit" is met in substance (identical sets, every scoreboard title
green twice) and not literally; that is stated, not papered over. The last two walls, both landed by other lanes:
a guarded entry whose write inside a call-making loop published no write facts at all (`92c6cf9bc`, `af49d9d0f`),
and a callee block whose records were placed in first-declared order instead of data-record order, so a frame read
a neighbour's record (`fef851fee`, `d2bf005a8`). Log: `{SCRATCH}/m2-run-1.log`, `{SCRATCH}/m2-run-2.log`.

Everything below is the measurement history, newest first.


**Measured 2026-10-03 22:08 at `fef851fee`, the eight titles of the table below only (`-t` on the marketplace
config): `8 passed | 58 skipped (66)`.** #50 approve sanity, #51 approve result, #52 refund sanity, #59 arbitrate
sanity, #60 80-20, #61 0-100, #62 100-0 and #66 integration test all settle; with the 58 ticked titles that is
**66/66 expected**, pending a full 66-title run. The only source change between the slice below (`06cc9eef0`) and this
run is `fef851fee`: a contract's data records are placed side by side in data-record order, so a frame reads each at
its record base plus its layout offset. That matches the `setClaimed` signature (`declared=01 computed=02`): the frame
read its neighbour's record. Landed since and not yet under a full run: `d2bf005a8`, `4999f7211`, `43d12a9f9`,
`cf5f83e48`, `6e2626e48` (compiler: an entry cache ends at each call between two accesses), `f5f41861d`, `5f452f80b`,
`e77cf6109`, `2534b954b`; the full compiler and SDK suites at `cf5f83e48` show no framed regression beyond one
stale publication pin (fixed in `2534b954b`). Log: `{SCRATCH}/mkt-logs/h4.txt`.

Measured at `055833fb4`: a full 66-title run (44 passed, the set unchanged since 04:48), the walls-ahead replicas under
`FRAMED_AHEAD=1` (9 of 142 cases off their pins), a census of the compiled marketplace's entries (calls, kinds,
guards, loops, side-cars, write segments), and the sources in `.marketplace/contracts/`. Each wall names its owner;
"in progress" marks work started ahead of the ladder in the composer lane. Updated after `27a60158f`: the full
66-title run of 2026-10-03 reads **50 passed | 16 failed (66)**, the scoreboard's ticked set is exactly that passing
set. Updated again at `384859f30` from targeted title runs (no full run): **56 expected** - the 50 plus #30
(`499e1d178`), #58 (`69283cde1`), #55 and #57 (`b366f1bdf` on `69283cde1`), #19 (`db78982a0`) and #46
(`384859f30`), each confirmed green by its own run. A full run at `db78982a0` then read `55 passed | 11 failed (66)`
and one at `37d864925` read `56 passed | 10 failed (66)`, each with the ticked set equal to its passing set.
**Measured 2026-10-03 on the focused slice of the then-failing titles at `9b271b622`: `8 failed | 4 passed | 54
skipped (66)`, after a cold fixture recompile (`tsc -b` clean, 9 sources -> 7 artifacts, 0 cache hits). Two titles
moved with the shrinking-run landing `bfa670351`: #53 `refund > refund` and #65 `refuse arbitration > job taken`. The
ladder is 58/66 and the ticked set is exactly the passing set. The eight still failing stop on ONE wall, measured to
be the frame's own program rather than a planning stall: `the call's callee "UnicrowClaim.claim()" did not settle
through the proxy: frame "callee-master-2"/"callee-master-6" of UnicrowClaim.claim() at line 137: no source message
(Program failed an OP_VERIFY operation.)`. Line 137 is that body's first statement - a STATIC call whose return is a
13-field struct whose last member is a dynamic `string`. A temporary probe in the derivation host's `step`
(`composer/shipped-host.ts`, plus `draft.ts`'s `run.fill`, both reverted) printed `callee-master-6 site=0 no-progress
before=717:Program failed an OP_VERIFY operation. after=717:...` on every attempt, so the compiled body already fails
at ip 717 before any record is filled and the driver's "filled no witness at site 0" stall is a symptom, not the
cause. #50 is the attribution sibling (`expected revert reason Review text too long, but the contract's own reason was
"no source message"`). The hop's own trace adds the strongest lead: `reading callee=callee-master-6 ok
declaredLen=107 computedLen=107 declared=005123aa201162... computed=005223aa201162...` - the frame's declared view of
its 107-byte record differs from the computed one at byte 2 only (`0x51` vs `0x52`). Log:
`{SCRATCH}/ladder-slice-r4.log`, `{SCRATCH}/trace-claim.log`, `{SCRATCH}/trace-step.log`.
**Served after that slice:** `92c6cf9bc` locates an entry's own record write after a call-making loop from the
source, so the claim frame settles and the execution moves one frame deeper: `-t 'arbitrate 100-0'` now reports
`frame "callee-master-10" of Unicrow.setClaimed() at line 96` with `reading … declared=01 computed=02`, and the
signature is the published write facts - the `segment:"last"` release write that `Unicrow.refund()` and
`Unicrow.pay()` publish is absent for that entry. The claim replica is
`test/framed/edges/dynamic-struct-return-edge.test.ts` (3 passed) and a six-title regression batch
(`read mece tag`, `post job 1`, `post job with whitelist`, `withdraw collateral`, `close job before timeout`,
`take job take job`) is 6 passed, so the compiler change broke none of the measured green set.

## The order the titles meet them (HEAD `9b271b622`)

| Titles | Wall at HEAD | Next walls predicted from the code | Owner |
| --- | --- | --- | --- |
| #51 approve result, #52 refund sanity, #59 arbitrate sanity, #60 80-20, #61 0-100, #62 100-0, #66 integration test | the claim frame is served (`92c6cf9bc`); the execution now enters `Unicrow.setClaimed()`, which refuses at its `onlyUnicrowClaim` check (`Unicrow.sol:96`) with an unattributed `OP_VERIFY`. The hop trace names the comparison: `declared=01 computed=02` (`_status` 1 vs 2, a 1-byte record) | measured: the artifact publishes `[{record:0,segment:0,_status}]` for this entry but not the `{record:0,segment:"last",_status}` release fact that `Unicrow.refund()` and `Unicrow.pay()` publish, so segment 0 declares the spent `_status` where the body computed the entered one. Behind it: the `escrows` element write (`claimed = 1` on a 13-field struct with a dynamic `string`) and its chunk run | hop + compiler; `solidc/src/framed/master/support.ts` read with the artifact |
| #50 approve sanity | the entry's own revert reason is not attributed where the transaction reverts (`expected revert reason Review text too long, but the contract's own reason was "no source message"`) | the wall above, once the execution reaches the entry's own checks | attribution (`composer/refusal.ts`) |

Served on 2026-10-03, each confirmed by its own title run: #53 refund and #65 refuse arbitration job taken
(`bfa670351`: a write that leaves a chunked dynamic value shorter than the run the deployment holds plans the run at
the width it spends); #42 take job, #48, #49 deliver result and #54 dispute
sanity (`ed5ccadad` slice); #45 pay start job (`0ad9ecf7f`); #31 update job (`5c4f232b7`); #30 whitelist worker
(`499e1d178`: a run a loop frame only reads is found from the declaration's end); #58 dispute worker (`69283cde1`:
compat address equality by identity, forwarded `bytes` read as bytes); #55 dispute with arbitrator and #57 dispute
creator (`b366f1bdf`: a published local follows the writes before its read); #19 post two jobs (`db78982a0`: a read
plans one frame per calling loop turn); #46 post thread message sanity (`384859f30`: a signer or contract passed for an
`address` argument resolves through `getAddress()`, as ethers does); #60's and #51's reach checks are served
(`ba2625ef0`: each insert is planned against the list the earlier reaches left).


## Replicas whose pins were stale (refreshed 2026-10-03)

- MS5 (`origin-gated-payout.test.ts`): the guarded escrow's entry now publishes all three of its writes, so `refund`
  and `refuseArbitration` settle on the guarded market too; both pins assert the settlement and the store counts.
- `packed-address-argument.test.ts`: the arbitration with its amounts settles, and its payload is pinned as the one
  this hop states. **The divergence this entry used to name is refuted**: an instrumented `asBytes` reports the
  elements the entry asks it for (`uint16` 8000, `uint16` 2000, `uint256` 800, `uint256` 200, `uint256` 0) and every
  one is big-endian as the body declares it, so the left-aligned words in the payload are the fixed-width layout, not
  a byte-order error. No SDK element-encoder item is owed. It is no settlement wall: the stated data equals the
  stored event byte for byte, so plan and body agree. The arbitrate titles and the integration test do decode that
  payload (`decodeJobArbitratedEvent`, test lines 2883, 2961, 3040 and 3341), and the harness copy reads it at the
  body's offsets (`uint16` at 0 and 34, `uint256` at 2, 36 and 120, the reason at 68, the worker's 20 bytes at 100):
  the shares, amounts, reason and worker decode as the test expects, zero shares included. Not a wall.
- `ahead/fan-in.test.ts`: the second append to one job's chunked notes chains, so its `take` case asserts the
  settlement instead of the refusal.
- The whole directory is green again: 16 files / 143 cases. The `ahead/` files run only under `FRAMED_AHEAD=1`, so a
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
  wall today; the framed path passes its own sender to the resolver.
- A self-referential mapping update `m[k] = m[k] + x` publishes its write one segment after its source position
  (`m[k] = lit` and struct field writes publish their own); a re-entered reader would see the earlier view. The
  marketplace's writes are not affected.
