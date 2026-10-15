# W4: the emitted per-frame operation-cost project

Opened 2026-10-08 by the user's answer to the title sweep's density question ("Open a compiler per-frame cost
project"). Ledger row D26.

Status: complete. The third increment below meets all six 64-frame budgets, merged as `33860e146` on 2026-10-13.
The earlier measurements and candidate approaches remain as the investigation record; D26 is closed.

## Goal

Bring the emitted kernel runtime-loop settlement inside BCH-2026's operation-cost density budget at the frame
bound the compiler itself publishes, so the six red titles below settle at their advertised bound.

Budget: `operationCostBudgetPerByte * (densityControlBaseLength + unlockingBytecode.length)` per input, i.e.
`800 * (41 + unlockingBytecode.length)` on the shipped consensus profile. These are direct spends
(`selector || args || redeem`), so the redeem script is part of the control length.

## The six titles and their measured requirement

Measured by running each shape under a relaxed-budget probe VM and reading `state.metrics.operationCost` at 64
frames (`LowerTailRecursion.ts` publishes the constant `maximumIterations: 64`).

| title | file | 64-frame cost | budget at the failing shape | required cut |
|---|---|---|---:|---:|---:|
| `settles a guarded tail-call stream with an inert unwind suffix in recursive source order` | AffineVoidRecursiveEvents | 3,833,233 | 2,640,000 | 31.1% |
| `reconstructs multiple affine parameters for a pre-only stream and enforces exact termination` | AffineVoidRecursiveEvents | 9,396,044 | 2,991,200 | 68.2% |
| `settles every pre-recursion frame, rejects a forged event, and enforces the frame bound` | AffineVoidRecursiveEvents | 3,696,688 | 2,672,000 | 27.7% |
| `settles mixed pre-order and post-descent events in recursive source order` | AffineVoidRecursiveEvents | 6,201,628 | 2,698,400 | 56.5% |
| `settles affine-counter progression in exact pre-order and unwind order at the 64-frame boundary` | AffineVoidRecursiveEvents | 6,974,120 | 2,838,400 | 59.3% |
| `enforces the recursive event domain step and 64-frame resource bound` | KernelLoopCompose | 3,814,071 | 2,900,800 | 23.9% |

The second row needs more cost than any single input can ever fund: the maximum budget is
`800 * (41 + 10,000) = 8,039,200`, so that row needs at least a 14.5% cut *and* a maximal reserve, or 68.2% alone.

## What is already established (do not re-derive, and do not repeat the two refuted leads)

- **A reserve is not a route to these six.** They are direct spends, so a reserve would have to be baked into the
  deployed script and would move the contract's address; and the only categorical artifact signal the six share
  (`runtimeLoopEvents` with `maximumIterations: 64`) is also published by a green in-budget sibling measured at
  +661,268 margin, so gating on it would move an in-budget shape's address and unlocking length.
- **The `KernelLegacyObservableParity` and `settles a lazy returning-helper event...` density failures are already
  fixed** by a different mechanism (`c46bf4790`, `kernelRouteEffectDensityReserveBytes`), because those are
  *compiler routes* with a discarded positional push in the unlocking frame. Do not generalise that fix to these
  six; there is no such slot here.
- **Refuted lead 1**: "~413 of ~560 executed instructions per frame are in an outlined pushdata-encoder body
  invoked ~19 times per frame". It does not reproduce. The cost is a per-frame laid-out frame settlement body
  executed once per frame (title 1: 4,648 executed instructions for `descend(6)`, ~40% in a 306-instruction body
  invoked once per frame; title 2: ~51% of 5,966).
- **Corrected lead 2** (first increment, `W4_FRAME_COST_PROFILE.md`): whether deleting a stepped-over arm is a
  win depends on how often it is stepped over. An arm inside the frame/settlement/verify loop is charged once per
  iteration (64-65x per run), so removing 49 charged instructions there saves `49 x 100 x 65 = 318,500` cost and
  loses `49 x 800 = 39,200` budget - net positive. The earlier per-run arithmetic (saves 4,900, loses 39,200)
  holds only for an arm charged once. Check every deletion against `scripts/density-headroom.ts` with the real
  iteration count, not per run.
- **The first increment's ceiling** (`W4_FRAME_COST_PROFILE.md`): the complete stepped-over charge is only
  21-35% of a row's cost, while the required cut is 23.9-68.2% of cost, i.e. 85-325% of that pool. So no
  arm-deletion or reordering reaches the bar. The structural move is to take the mutually-exclusive record-kind
  arms and encoder switches off the step-over path - outline them into `OP_DEFINE` bodies so `OP_INVOKE`
  dispatches past them - while keeping their bytes in the script, because the script is the density-control
  length. Per row: the recursive-event row needs 85.2% of its pool, the guarded tail-call row 112%, mixed
  pre/post 184%, affine-counter 169%, pre-only 325% (and its full cost already exceeds the 8,039,200 maximum any
  input can fund). This is why the increment landed no emission change: a real answer is a structural codegen
  project, and the event-lock hoist alone (3.7% of one row) would refresh the kernel corpus pins for no
  acceptance gain.
- Cost composition at 64 frames (title 6): 95.9% instruction count (36,590 x 100), 2.8% pushed bytes, 1.3%
  hashing. Of 554 charged instructions per frame, 406 are executed and 147.6 are charged-but-stepped-over
  (`installSparseProbeBranchSkips`, `createVirtualMachine.ts:778` — BCH-2025 charges every stepped-over
  instruction). So both "do less work" and "have fewer instructions inside a skipped arm" are legitimate targets,
  but the latter only while the control length does not shrink.
- The largest hoistable invariant found so far is the expected event locking bytecode
  (`emitExpectedEventLockingBytecode`, `GenerateTargetTraversal.ts:18415`): 22 executed instructions per record,
  all frame-invariant (the master input's token category and the event definition), worth 128,000 units, 3.4% of
  title 6's cost. It is not enough alone; record it as one contribution, not the fix.

## Method

1. For each title, take the executed-instruction profile at the failing bound and attribute cost by outlined body
   (`faithful-probe-trace.ts:evaluateProbeTrace` is the observer; a scratch build with a raised budget makes the
   program finish so it can be read). Keep the attribution in `W4_FRAME_COST_PROFILE.md`.
2. Rank the blocks by (cost x frames) with two columns: "hoistable" (frame-invariant) and "removable without
   losing control length". Only the intersection is free money; a removable block that shrinks the control length
   must be paired with a same-length replacement or it is net-negative.
3. Change the emission, not the covenant's meaning. A cheaper check that accepts exactly the same transactions is
   a win; anything that accepts more is not.
4. Re-measure the same six titles individually, then the whole `Kernel*` journal corpus, then the framing suites.

## Acceptance

- Each of the six settles at its published bound on the stock profile (`operationCostBudgetPerByte: 800`,
  `maximumBytecodeLength: 10,000`), reproduced individually with `--maxWorkers=1`.
- No consensus limit is changed, no check is loosened, and no test is padded.
- The pinned-bytecode corpus is either unchanged or refreshed with every moved pin named and justified. Shrinking
  emitted bytecode is expected on some shapes; where it happens, confirm the density headroom went up, not down.
- The project reports its per-block ledger even if it does not reach the acceptance bar: which blocks it removed,
  what each was worth, and what the remaining gap is.

## Progress

- 2026-10-08, first increment (`W4_FRAME_COST_PROFILE.md`): the six rows are profiled, the lever pool is
  quantified, and the event-lock hoist is recorded as worth 3.7% of one row. No emission change landed, because
  the profile shows the required cut is 85-325% of the only pool a reordering can reach. Next increment: the
  structural move (outlining the mutually-exclusive arms so the VM dispatches past them without losing their
  bytes from the control length), which must be built and measured as one change, not incrementally.

- 2026-10-13, second increment (branch `feat/hunt-d26`, base `fc44df38a`): five of the six settle at 64 frames.
  Profile at base, title 1 per frame (~600 charged instructions): frame loop ~270 (commitment encode 48, record
  pushdata wrap 50, per-record event lock rebuild 24 + HASH256, count bump 16, loop control and rebinding ~70),
  settlement ~180 per record (four-kind dispatch 98 of which 53 stepped over, pushdata decode 51, checks 32),
  census ~130 per output (immutable-NFT pin ~100, two shared output scans ~31). Cuts, all in
  `GenerateTargetTraversal.ts`, direct convention only (framed bytes untouched):
  1. An events-only, unchunked stream keeps compact records (the commitment, plus a one-byte lock ordinal when it
     mixes events); its verifier builds each event lock once and runs the effect verifier's event checks in the
     same order. Transfer and chunked streams keep the tagged records.
  2. The immutable-NFT pin steps over `[start, end)`: its own span clause admits every output there.
  3. A 14..17-deep replace inside a while body uses the ROLL rotation, not the counted alt-stack loops.
  4. Compact-stream int event arguments use a 47-instruction flat encoder (the generic ladder became 83 once the
     outliner inlined its push frame), same encoding for every input.

  | title | base cost / budget | now cost / budget |
  |---|---:|---:|
  | guarded tail-call stream | 4,032,737 / 3,241,600 | 1,931,872 / 2,906,400 |
  | pre-only affine parameters | 9,642,515 / 3,580,800 | 3,819,340 / 3,288,800 |
  | every pre-recursion frame | 3,884,596 / 3,260,800 | 1,794,891 / 2,966,400 |
  | mixed pre-order and post-descent | 6,595,267 / 3,292,800 | 2,468,363 / 2,983,200 |
  | affine-counter progression | 7,316,296 / 3,424,800 | 2,784,016 / 3,110,400 |
  | recursive event domain step (KernelLoopCompose) | 4,116,185 / 3,492,000 | 1,994,457 / 3,227,200 |

  The pre-only title fits 54 frames (3,241,490 / 3,288,800; 57,785 per frame). Its ~577 instructions per frame:
  argument encoding 168 (3.5 args, the PUSHDATA1/2 arm is stepped over on every call), parameter rebinding at
  depth 13-15 ~98, the lowered tail recursion's loop control ~51, settlement ~77, count bumps ~36, shared output
  scans ~47. Next levers: that arm out of line (~52), a do-while lowering with the continue flag on top (~40),
  shallow loop-carried parameters. The mixed and affine-counter titles now reach their inexact-descend check,
  which the affine frame guard refuses at derivation (as `424fea1b1` recorded for the non-void title; measured
  the same for the pre-only title); the three tests assert that.

- 2026-10-13, third increment (branch `feat/hunt-d26b`, base `aa4cd27ab`): all six settle at 64 frames; the
  pre-only title has 20.5% headroom. Direct convention only (framed bytes and lowering untouched). Cuts:
  1. `LowerTailRecursion`: an event stream `prefix; if (base) return [r]; recurse(args)` clears the repeat flag in
     its base arm and advances the frame in the other, so the loop has no break flag and no per-frame reset or
     re-arm. A parameter whose new value reads only itself and invariants is assigned in place (no temporaries,
     so its replace is 3 to 4 items shallower).
  2. Runtime-loop events reserve no epilogue emit registers: two dead items no longer deepen every loop replace.
  3. The loop int encoder's opcode arm and OP_PUSHDATA1/2 prefix are compiler helpers, defined once and invoked,
     so a pass steps over one invoke instead of 8 and 14 instructions; the encoding is unchanged.
  4. The compact stream's record count is bumped in place (`ROT 1ADD ROT ROT` at depth 2, not a copy and replace).

  | title | before cost / budget | now cost / budget |
  |---|---:|---:|
  | guarded tail-call stream | 1,931,872 / 2,906,400 | 1,337,172 / 2,829,600 |
  | pre-only affine parameters | 3,819,340 / 3,288,800 | 2,567,470 / 3,231,200 |
  | every pre-recursion frame | 1,794,891 / 2,966,400 | 1,219,493 / 2,881,600 |
  | mixed pre-order and post-descent | 2,468,363 / 2,983,200 | 2,070,559 / 2,984,800 |
  | affine-counter progression | 2,784,016 / 3,110,400 | 2,382,688 / 3,104,000 |
  | recursive event domain step (KernelLoopCompose) | 1,994,457 / 3,227,200 | 1,465,248 / 3,160,000 |

  The pre-only title now executes 24,780 instructions at 64 frames (was 36,906): about 388 a frame (was 577).
  What is left a frame: argument encoding ~118 (the outliner shares the classification and the medium prefix, at
  two invokes a call), the three parameter replaces at depth 7-9 ~67, settlement ~83 and output scans ~48.
  Pinned sizes move for direct-convention contracts with runtime-loop events and for affine event recursions.

## Risks

- Any emission change moves pinned sizes across the kernel corpus; that is the largest cost of this project.
- The affine recurrences are also a correctness surface (event order, frame bounds). Their titles assert exact
  ordering, so a cheaper settlement must keep the ordering assertions green.
- The pre-only title may prove unreachable without a structural change to what it emits per frame; say so early
  rather than optimising the other five only.
