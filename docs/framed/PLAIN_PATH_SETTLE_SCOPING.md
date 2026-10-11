# The plain path's learning loop: scoping it the way `settleCallees` does

Brief for whoever owns `call/call.ts`. Written 2026-10-04 at the request of the plain-path lane, from reading
`call.ts`'s loop and `proxy/deploy.ts`'s `settleCallees`. Nothing here is a decision: it is the shape to start from
if the take-job profile says a loop port is warranted, exactly as that lane asked.

**Status (2026-10-11): ported.** The plain path settles its callee frames through `settleCallees` itself, seeded
from and read back into its callee values; no-proxy `take job` went from 383.1 s to 61.1 s. The measurements and
the two defects found on the way are in `NOPROXY_LANE_COST.md` section 7. Two things this brief expected went
otherwise:

- The loops were not split by hand. `settleCallees` takes the plain path's own plan through opt-in hooks (its draft
  builder, its root, its `retval` candidate, learning only the judged frame's views, handing back an exposed write
  value, judging a frame whose subtree derived), so one loop serves both paths and the hop's work is unchanged.
- "What NOT to port" did not bite. The hop's re-entry machinery (`deriveReentryWriters`) already chains a contract
  that separate frames rewrite, a token's transfers through separate payers among them, so judging frame by frame
  keeps what the continuous derivation learned. The continuous derivation still learns the entry's own values and
  any callee value a settle leaves owed.

## The measurement that motivates it

`take job` takes ~740 s on the plain path against ~100 s through the hop. The difference is not the machine; it is
how much composition each iteration re-derives.

## What the two loops do today

**Hop** (`proxy/deploy.ts`, `settleCallees`):

- one loop per callee, in `calleeSettleOrder(callees, deepestFirst)` — deepest frame first, so a frame is judged
  after the frames it calls have answered;
- each frame gets **its own** budget: `MAXIMUM_HOP_ATTEMPTS` (4) plus that frame's own learning candidates, its own
  event sentinels, plus the enclosing candidates it sits inside;
- an iteration re-plans the hop and re-derives **only the frame under judgement**;
- `deferFailures` records a refusal against that frame and lets the loop continue, so one refusing callee does not
  restart the composition;
- what each frame learned is carried in a `CalleeSettlement` (`retvals`, `writeViews`, `writeValues`, `events`), and
  the caller seeds the next frame with it (`seedOf`).

**Plain** (`call/call.ts`):

- one **global** loop, whose budget is a sum over every learner in the composition
  (`maximumAttempts`, `call.ts:1334-1338`: candidates + emits + 2×sends + payees + 2×(payee events, payee
  candidates, payee sends) + callees·(1+payees when the entry shares a payee) + payable calls + retval + 3);
- every iteration runs `buildPlan(...)` → `createComposedDerivationHost(...)` → `deriveComposition([...payeeRequests,
  root], host)`, i.e. it re-plans and re-derives the **whole composition**, payees included, however many
  iterations ago they last changed;
- four paths recurse through `callInShape(options, shape, { ...prior, ... })` — a learned write value, a stopped
  plan's reached results, guard decisions from call results, a re-sized run — and each recursion restarts that
  global loop with a fresh plan and a fresh host;
- `candidate.learnUnstatedViews()` already bulk-learns the draft's placeholders per iteration, so the remaining
  waste is the re-plan and the re-derivation, not one-value-per-pass reading.

So the plain loop is O(all learners × whole composition) where the hop is O(Σ learner × its own frame). That is the
7×, and it grows with the square of a composition's frame count.

## The shape to port

1. **Split the learners by frame.** Keep the entry's own loop for the values the entry itself computes (its `retval`,
   its own mapping-node closes, its own emits and sends). Move each callee's and each payee's learning into its own
   loop with its own budget, in dependency order — deepest first, which for the plain path means: payee receive
   frames, then callees, then the entry.
2. **Re-derive only the frame under judgement.** Build the plan once per iteration of a frame's own loop, and derive
   that frame (its subtree is the frames already answered, so they are seeded, not re-derived). `FrameRequest`,
   `deriveComposition`'s `onCalleeStall`, and `createComposedDerivationHost` already give the hook for this.
3. **Carry a settlement between loops** rather than a flat `prior`: reuse the `CalleeSettlement` shape
   (`retvals`/`writeViews`/`writeValues`/`events`) as the seed the callee loops hand the entry loop, exactly as
   `seedOf` does on the hop.
4. **Keep the entry's `callInShape` recursions** — they are about the entry's own learnings (sized runs, reached
   results, guard decisions) and stay as they are once the callees no longer re-derive inside them.

## What NOT to port

- **`deriveReentryWriters`, `withReentryFrames`, `enclosed-values`/`reached-values` and the hop's enclosing-writer
  machinery.** W14 measured that the plain path's single depth-first derivation learns a token's supply record across
  separate transfer frames for free, which the hop needed a dedicated re-entry channel for. Anything that ends the
  plain path's one continuous derivation in favour of per-frame derivations can bring that problem back, so the
  port should be limited to *scoping the loops*, not to adopting the hop's writer machinery.
- The hop's proxy-specific frames (proxy master, delegate frame, `initialize` hop) — the plain path has no proxy.

## Preconditions to check before starting

- `producedCallResults` / `reachedCallResults` and `calleePlan.blocked` must keep working: a stopped plan's results
  are what the recursion at `call.ts:1810-1830` learns, and those sites must still see the same plan.
- The guard-decision pass (`calleePlan.conditionalProducers`, `armsDecided`) counts passes; with per-frame loops,
  that counter has to become per-frame or it will trip early.
- `calleeValuesOwed` / `NO_CALLEE_VALUES` are the entry loop's stopping condition — keep them as the check that
  every frame has answered before the entry derives.
- The `sharesPayee` multiplier in `maximumAttempts` exists because a payee's value can be learned again once the
  amount it was paid is known. A per-payee loop has to keep that ordering: amount first, then the payee's own values.

## Orthogonal, and cheaper: the per-attempt constants

These are pure recomputation and help both lanes without touching the loop structure. Each is independent of the port
above:

- `composer/draft.ts:676-724` — `programFor` → `transactionFor` re-encodes **every** input's unlocking bytecode on
  every evaluation, and `buildMasterUnlockingBytecode` (`utils/src/framed/witness-block.ts:325`) minimal-pushes the
  whole redeem script (22,000 B for UnicrowClaim up to 140,004 B for MarketplaceV1). Only the evaluated master's
  block ever differs, so the per-input bytes belong in a draft-level cache keyed by the block a view-learning
  mutates. `transactionOutputs()` (`:667`) and `segmentsInWalkOrder()` (`:596`) rebuild per call too.
- `deploy/material.ts:113` — `deployMaster` fills the placeholders into a fresh copy and hashes (sha256 of the
  validator program, hash256 of the script) per callee **per plan**; `programBytes` next to it is already memoized.
- `composer/refusal.ts:222-262` — `frameRevertReason` calls `debugSkew`, which splits the whole source map just to
  count its entries and decodes the whole program, and then `sourceMapToLocationData(sourceMap)` parses the whole
  map to read one line. The per-body maps are 103,609 entries for MarketplaceV1, 40,595 for Unicrow. The learning
  loop refuses on most iterations, so this sits directly on the hot path.

## How to measure it

Keep `take job`'s 740 s as the baseline and re-measure the same title after the port; `pay start job` is the second
data point. A full no-proxy ladder run is only worth taking once a single title has moved, since the runs are the
scarce resource.
