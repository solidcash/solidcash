# W4 frame-cost profile: the six red settlement rows sit at or above the only identified lever

First increment of `W4_FRAME_COST_PROJECT.md` (ledger row D26). Worktree `tg-s`, branch `tg-s`, tip
`1f3694d90`. This is a measurement document: no emission change is landed here, because the per-block ledger
below shows the acceptance cut is at or above the ceiling of the only lever the profile exposes.

## What was measured

Instrument: the BCH-2026 SDK VM with an `ALL_OPCODES` observer on the faithful (branch-recording) path, so
every charged instruction is attributed to the outlined body and instruction that owned it. A private provider
with `operationCostBudgetPerByte: 10_000_000` lets each 64-frame program finish so the whole run can be read;
the charged counts and the byte lengths are independent of that budget. Scripts are in the scratch directory
(`tgs-active.mts`, `tgs-dumpbody.mts`), not in the tree.

The shape under the observer is `contract.call.<entry>(...)` for the failing arguments of each title, built by
the same `setupStatefulUtxos`/`StatefulContract.withCategory` path the tests use. `totalCost` is
`metrics.operationCost` after the last instruction; it reproduces the published figures to within ~100 units
(e.g. title 6: 3,833,133 here against the project's 3,833,233).

## Reproductions (stock profile, `--maxWorkers=1`)

    cd packages/solidcash
    ../../node_modules/.bin/vitest run <file> -t '<leaf>' --maxWorkers=1

All three priority titles fail in `applyOverrides` with the same shape:

    Error: Auto-derivation produced incomplete state (missing: __messageBusHold).
      Reason: VM failed at ip <n> opcode 104: ... exceed the operation cost density limit.
      Maximum operation cost: <budget> (density control length: <len>); operation cost following
      operation: <cost>.

| file | leaf title | ip | budget | cost following op |
|---|---|---:|---:|---:|
| KernelLoopCompose | enforces the recursive event domain step and 64-frame resource bound | 254 | 2,900,800 | 2,903,057 |
| AffineVoidRecursiveEvents | settles every pre-recursion frame, ... frame bound | 252 | 2,672,000 | 2,672,158 |
| AffineVoidRecursiveEvents | settles a guarded tail-call stream ... recursive source order | 251 | 2,640,000 | 2,640,263 |

## Per-row totals (full 64-frame run under the relaxed budget)

`inactive` is the count of charged instructions the VM stepped over inside an inactive branch (BCH-2025 charges
every stepped-over instruction). `inactiveBytes` is the byte footprint of the distinct instructions that are
ever stepped over - the density-control length those charges are paid for.

| row | cost | instr | inactive | cost needed | budget | cut needed | inactive share |
|---|---:|---:|---:|---:|---:|---:|---:|
| KernelLoop `enforces the recursive event domain ...` | 3,814,821 | 36,593 | 10,731 | 914,021 | 2,900,800 | 23.9% | 28.1% |
| AffineVoid `settles every pre-recursion frame ...` | 3,696,588 | 35,460 | 10,701 | 1,024,588 | 2,672,000 | 27.7% | 29.0% |
| AffineVoid `settles a guarded tail-call stream ...` | 3,833,133 | 36,715 | 10,656 | 1,193,233 | 2,640,000 | 31.1% | 27.8% |
| AffineVoid `settles mixed pre/post ...` | 6,201,528 | 59,469 | 18,995 | 3,503,128 | 2,698,400 | 56.5% | 30.6% |
| AffineVoid `settles affine-counter progression ...` | 6,974,020 | 67,109 | 24,510 | 4,135,620 | 2,838,400 | 59.3% | 35.1% |
| AffineVoid `pre-only stream ...` | 9,395,944 | 91,461 | 19,728 | 6,404,744 | 2,991,200 | 68.2% | 21.0% |

## Per-block ledger - KernelLoop `enforces the recursive event domain ...`

Charges are per 64-frame run; cost is `charges x 100` plus the row's pushed bytes and hash iterations. Frames:
the row runs the published `maximumIterations: 64`, so a body reached once per frame carries 64-65 charges per
instruction.

| block | body | len | charges | class | worth |
|---|---|---:|---:|---|---:|
| master inline | #3 | 401 | 15,074 | frame loop 11-101 x65 + settlement 171-263 x65 + verify 346-385 x67 | - |
| pushdata encode | #5 | 48 | 3,120 | inherent, payload changes per frame | - |
| pushdata length decode | #14 | 46 | 2,944 | inherent, 4-arm switch on payload length | - |
| pushdata length encode | #7 | 37 | 2,368 | inherent, 3-arm switch on payload length | - |
| output verify | #16 | 27 | 1,728 | inherent, per event | - |
| SID/commitment check | #25 | 27 | 1,728 | inherent, per output | - |
| **expected event lock** | **#8** | **22** | **1,408** | **hoistable (frame-invariant)** | **140,800** |
| stack drop 7 | #9 | 15 | 960 | inherent, locals teardown | - |
| stack drop 6 | #10 | 14 | 896 | inherent, locals teardown | - |
| pushdata encode | #6 | 13 | 832 | inherent | - |
| verify tail | #26 | 13 | 832 | inherent | - |
| category equal | #23 | 5 | 990 | inherent | - |
| input/output scan | #24 | 49 | 844 | inherent, once | - |
| category count | #22 | 38 | 700 | inherent, once | - |
| stack drop 5 | #11 | 11 | 693 | inherent | - |
| stack drop 4 | #4 | 9 | 576 | inherent | - |
| satoshi bound | #15/#17 | 5 | 640 | inherent | - |
| head/dispatch | #2 | 165 | 164 | inherent, once | - |
| other | - | - | 96 | inherent, once | - |

Hoistable, exactly one block: the expected event locking bytecode (`emitExpectedEventLockingBytecode`,
`GenerateTargetTraversal.ts:18432`, emitted from the runtime-loop event path at `:18280`). It is built from the
master input index, the master's token category and the event covenant suffix - all frame-invariant - and it is
recomputed 64 times. It is worth 1,386-1,408 charges = **3.7%**, matching the project's 3.4% estimate and too
small to move any row. It is recorded here as a contribution to be landed **with** the structural change below,
not alone: landing it by itself moves the kernel corpus pins for no acceptance gain.

## Where the remaining gap is, and why it is not closed here

The only large pool is the stepped-over charge: 10,656-24,510 charged instructions per row, 27.8-35.1% of the
cost. It cannot be removed by deleting the bytes, because those bytes are the density-control length. The
project's refuted lead 2 priced one such block at one charge per instruction (49 instructions -> 4,900 cost).
That accounting holds only for a block executed once. The block this profile finds sits in the 65-iteration
event-settlement loop: in `body#3` of the KernelLoop row, ip205-254 (50 instructions, ~52 bytes) is the
non-event arm of the record-kind dispatch and is stepped over on every one of the 65 iterations - 3,250 charges
(325,000 cost) against 41,600 budget. For a block stepped over K times, removing it is net-positive when
`K x 100 > bytes x 800`, i.e. K > 8 per byte; a loop arm at K=65 clears that easily, a once-only arm does not.
Either way the pool is too small for five of the six rows.

Reachability ceiling. If every stepped-over charge vanished *and every one of those bytes were kept* (the most
generous possible outcome), the rows would land at:

| row | pool (charges) | needed | pool / needed |
|---|---:|---:|---:|
| KernelLoop `enforces the recursive event domain ...` | 1,073,100 | 914,021 | 85.2% |
| AffineVoid `settles every pre-recursion frame ...` | 1,070,100 | 1,024,588 | 95.7% |
| AffineVoid `settles a guarded tail-call stream ...` | 1,065,600 | 1,193,233 | 112% (99% with the event-lock hoist) |
| AffineVoid `settles mixed pre-order and post-descent ...` | 1,899,500 | 3,503,128 | 184% |
| AffineVoid `settles affine-counter progression ...` | 2,451,000 | 4,135,620 | 169% |
| AffineVoid `reconstructs multiple affine parameters ... (pre-only)` | 1,972,800 | 6,404,744 | 325% |

The two cheapest rows need 85-96% of an unattainable pool; the other four need more than the whole pool. If
the stepped-over bytes are removed rather than preserved, the budget falls by 800 per byte as well, and even
the two marginal rows go red again (KernelLoop: 2,741,721 cost against 2,589,600 budget, short by 152,121).

The pre-only row is a separate question and the answer is no, twice over: it needs 6,404,744 more than its
budget, and its full cost 9,395,944 already exceeds the largest budget any single input can fund at the 10,000
byte P2SH ceiling (`800 x (41 + 10,000) = 8,039,200`). It is unreachable without changing what the row spends.

## Verdict

- All six rows: NOT FIXED. The acceptance cut (23.9-68.2%) is at or above the ceiling of the only lever the
  profile exposes.
- The one safe, frame-invariant block (the expected event lock) is worth 3.7% and is recorded, not landed.
- Reaching the bar needs the stepped-over charge reduced *while keeping the byte length*: the record-kind arms
  and encoder switches must leave the step-over path. The available shape for that is to outline the
  mutually-exclusive arms into `OP_DEFINE` bodies (`OP_INVOKE` dispatches past an arm without stepping through
  it), which is a structural codegen change - not a first increment - and it moves the kernel corpus pins on
  every framed contract. Even if it were built, the table above caps its effect below the bar for four rows and
  leaves the two cheapest marginal.
