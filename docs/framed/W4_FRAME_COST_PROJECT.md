# W4: the emitted per-frame operation-cost project

Opened 2026-10-08 by the user's answer to the title sweep's density question ("Open a compiler per-frame cost
project"). Ledger row D26.

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

## Risks

- Any emission change moves pinned sizes across the kernel corpus; that is the largest cost of this project.
- The affine recurrences are also a correctness surface (event order, frame bounds). Their titles assert exact
  ordering, so a cheaper settlement must keep the ordering assertions green.
- The pre-only title may prove unreachable without a structural change to what it emits per frame; say so early
  rather than optimising the other five only.
