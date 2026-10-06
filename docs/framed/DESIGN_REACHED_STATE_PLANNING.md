# Planning against the reached state: design, and a stage-1 prototype

Status: design (2026-10-01, user direction). Stage 1 was prototyped as `patches/reached-state-arguments.diff`, not
applied. Lane: the SDK hop (`packages/solidcash/src/framed/proxy/`), which is the ladder stream's; the patch is the
hand-over. The pins cited are those at `73fefbd2f`, the HEAD the patch is based on and checked against (section 4).
Superseded for results: section 5 records the execution-order spike that landed on `framed-next` in place of the
fixed point (arguments and loop bounds from an earlier result, in any frame), and what it found about views.

## 1. The problem

The hop (`callFramedProxyEntry`, `deployFramedProxy`) plans every call of a composed transaction from facts that
hold before the transaction: the entry's arguments, the proxy's live records and each callee's live deployment. The
execution runs each call against the state and the results the transaction has reached when the call is made. A
planned value that depends on something the transaction reaches is therefore refused at plan time, or settled
against a stale view and refused at that frame's line. The walls, pinned in `packages/solidcash/test/framed/ahead/`
(run with `FRAMED_AHEAD=1`; `PLAN_MARKETPLACE_66.md` section 6, "Walls ahead", and the Log rows titled "walls
ahead ..."):

| Planned value | Depends on | Where it is fixed today | Pinned in `ahead/` |
| --- | --- | --- | --- |
| A call argument | an earlier call's result | `resolveCallArguments` (`call-resolution.ts`) refuses: "passes argument i from a ... which the hop cannot resolve from the caller's own arguments and state" | `fan-in` take (the note carries `noteCount`'s count) and pay start (`pay` carries `feeOf`'s fee); `packed-address-argument` arbitrate (the amounts of `split`'s `uint256[5]`) |
| A loop's visit count | an earlier call's result | `occurrenceCountOf`, `derivedOccurrenceCountOf` (`external-calls.ts`) refuse: "runs a loop whose bound is not fixed by the caller's own arguments" | `reentry-payout` and `deep-arbitration`, first case (the claimer's loop turns as often as `readRecord` returned) |
| A callee's record views | a record an earlier frame wrote in the same transaction | `buildHopPlan` declares every callee data record kept at its live commitment and spends it on the read-only path; `calleeEntryWrites` plans a callee's mapping writes against the live deployment; `requireSatisfiableReachWrites` refuses two reaches that write one key | `reentry-payout`, `deep-arbitration`: third case (the guard `release` or `settle` set reads as unset at `setClaimed`) and second case (every turn credits one holder); `origin-gated-payout` (two store logs, one count key); and behind stage 1, `fan-in` (`Vault.pay`'s `deals` write of a value it computes from its own earlier calls; then `approve` and `transferFrom` on one allowance) and arbitrate (`split` writes its own record) |
| An arm's visits, an argument's value, a loop's key | state the entry itself wrote earlier in its own body | `occurrenceCountOf` states one visit for a condition over state the entry rewrites (`conditionReadsWrittenState`); `makeCallResolver` and the loop plan read state as it was before the transaction | `job-updates` #36 and #38 (a payout or a pull the execution skips is planned), #34 (the skipped arm's amount is negative and throws `value out-of-bounds`), #31-#33 (both token arms planned, then two reaches of one balance key); `job-threads-and-refusals` #64 (the skipped escrow calls stay stated) and #20 (the loop key `tasks.length - 1` read before the push); `call-argument-from-own-write` (a plain state variable the entry wrote fails closed) |

The four rows are one capability: plan each call against the state and results the transaction has reached (log row
"walls ahead", 2026-09-30). L5-L7, the estimate's long tail, need it.

## 2. What the hop does today

1. **Plan** (`planHopExternalCalls`, `planEntryCalls` in `external-calls.ts`). Pass one resolves every published site
   of an entry from the caller's own facts (`makeCallResolver`: its arguments, its state, `msg.sender`,
   `address(this)`): the site's visit count (`occurrenceCountOf`), its target and its argument pushes. Pass two reads
   each callee's live deployment, takes a master per reach, and recurses into the callee's own sites from the
   callee's live state. The result is a `HopExternalPlan` (`calls`, `callBases`, `callsiteIds`,
   `conditionalProducers`, `callees`, `utxos`).
2. **Settle** (`settleHop` in `deploy.ts`). `settleCallees` settles callee frames deepest first (a stable sort by
   depth, so siblings keep placement order). Each attempt builds the whole composition (`buildHopPlan`) from what has
   been learned and evaluates one frame, deriving its subtree when it makes calls; the failing close names the value
   the body computed: `learned-retval`, `learned-write` (a value-dependent mapping node, in `learningCandidates`
   order) or `learned-event`. The implementation frame is then attempted the same way (`learned-retval`,
   `learned-record` for its own data records, `learned-write`, `learned-event`) and the root is derived.
   `FRAMED_HOP_TRACE=1` prints every `attempt` and `stop ... reason=`.
3. **Re-plan for gated arms** (`f2e34600d`). A site whose published condition reads an earlier call's result is
   planned as no visit. `planAndSettleHop` settles, decodes each producer's `retval` (`producedCallResults`, through a
   proxied callee's `retvalFrom`), plans again with those results, and stops when `samePlannedSites` holds, at most
   once per conditional producer. This is the model the design generalizes: plan from what is known, settle to learn
   what the transaction reaches, plan again.

The machine already accepts the reached state. The caller's own code computes each call's argument digest from the
values it holds, an earlier record's `result` among them, and refuses a record that carries another
(`solidc/src/framed/master/call-site.ts`: "the record is not the authority for the digest, the code's operands
are"). V5 binds each record's `result` to the callee's `retval` and its digest to the callee's call data; V6 derives
the execution order; V7 chains each record's views across every frame that runs on it, in that order, from the real
input to the real output (`SPEC_FRAMED_TRANSACTION.md` 7.2). The hand-planned replicas in `test/framed/shapes/`
(`reentry-payout-loop`, `deep-arbitration`, `fan-in-with-result`, `origin-gated-payout`, `time-gated-challenge`)
state reached views by hand, and the machine accepts them. The walls are planning walls.

## 3. Design

### 3.1 Core idea

A planned value is either fixed by facts that hold before the transaction, or a function of values that precede it in
the execution order (V6): a call's result is read after the call returns, a view after the segment that wrote it
closed, an arm or a loop turn after the values its condition reads. So the hop plans with what it knows and a
stand-in for each value the transaction reaches, settles to learn the reached values, plans again from them, and
repeats until the values the plan stated are the values the settle learned. That plan is the fixed point, and the
machine checks it as it checks any plan.

### 3.2 What is stated before it is learned, and where it is learned from

| Reached value | Stated while unknown | Learned from |
| --- | --- | --- |
| An earlier call's result an argument reads | the declared zero of the producer's return type: `0`, `false`, the empty lock of `address(0)`, zero bytes of a `bytesN`, `N` zeros of a `T[N]` | the producer frame's `retval` (`learned-retval`), decoded with its entry's outputs (`producedCallResults`) |
| An earlier call's result a condition reads | no visit (`f2e34600d`) | as above |
| An earlier call's result a loop bound reads | no turn | as above |
| A record's view at a segment boundary | the view the latest learned earlier write left, else the live commitment | the writing frame's own close: `learned-record`, `learned-write`, and a new `learned-view` for a callee's own data record |
| The entry's own state at one of its calls | the state decoded from the entry's learned views of the segments before that call, else the live state | the implementation frame's `learned-record` and `learned-write` |

Learned results are keyed by the frame that made the call and the call site: the `callsiteId` for the hop's own entry
(the prototype), and the call path from the root (`site#occurrence/site#occurrence/...`) for a callee frame, which
stays stable across passes where master ids shift.

### 3.3 The loop

```
known = {}
for pass = 0, 1, ...:
  plan     = planHopExternalCalls(known)          // a stand-in wherever `known` has nothing
  refusal  = the plan-time checks (reach check)   // deferred while the plan states a stand-in
  settle(plan), keeping every value it learned even when a frame refuses
  learned  = the reached values the settle produced
  if the settle completed and nothing it learned moves the plan: return the plan (the fixed point)
  if it was refused and no learned value differs from the one the plan stated: the refusal is the entry's verdict
  if pass reached the bound: refuse by name
  known = learned
```

A refusal raised while the plan states a value the transaction does not compute is not a verdict: the caller's code
refuses a digest its own values do not produce, and a frame refuses a view the transaction did not reach. The
refusal stands once a pass learns nothing that moves the plan.

### 3.4 Order: what is learned from where

- **Results.** A producer is an earlier site of the frame that consumes its result, so it is an earlier sibling of the
  consumer in the call tree. A post-order settle (children before parent, siblings in published order) settles the
  producer's whole subtree, and learns its result, before any frame its result feeds. Today's deepest-first order is
  also callee before caller, but it can settle a consumer's deeper subtree before a shallower producer, so a consumer
  that refuses its stand-in ends the pass before the producer is learned. Post-order keeps every callee-before-caller
  learning the settle relies on.
- **Views.** A frame's segment `k` closes at its call `k`, before that call's result is needed, so its view at each
  boundary is learnable before its callees settle. Views are planned in V6 order (segment 0 of a frame, the frames of
  its first call, segment 1, ...): each segment's `viewIn` is the previous `viewOut` of the same record in that order,
  and each `viewOut` the body computes is left unstated and learned. The settle becomes a relaxation in V6 order:
  every frame is evaluated, the first unstated value it stops at is learned, the plan is rebuilt, until no frame
  learns anything.

### 3.5 Termination and convergence

Order the reached values by their position in V6 order. A value at position `p` is a deterministic function of the
facts before the transaction and of values at positions before `p`; call its depth the longest chain of such
dependencies that ends at it. A value of depth 0 reads nothing the transaction reaches, so pass 0 learns it
correctly. If pass `d - 1` learned every value of depth below `d` correctly, pass `d` states them, and every value of
depth `d` is computed from correct inputs. So by pass `D`, the largest depth, every learned value is correct, and pass
`D + 1` states them all and learns the same values: the fixed point, after at most `D + 2` settles. No value depends
on a later one, so none can oscillate once the values before it stop moving; the plan's shape (which sites are
visited, how many turns) is decided from earlier values too, so the part of the plan before a decision is stable once
the values before it are. The hop still caps the passes at the number of producers, as `f2e34600d` caps by its
conditional producers, and refuses by name past the cap.

A pass that is refused learns every value up to the refusing frame, in settle order. When the order puts every
producer of a frame before it (3.4), a refusal after which nothing moved is genuine: a wrong input of the refusing
frame would come from a producer upstream of it, and the first such producer, whose own inputs were right, was
settled earlier in the same pass and learned a value other than the one stated. With today's deepest-first order
that does not hold for every shape, which is why stage 1b changes the order.

Two assumptions keep this true and each stage must preserve them: a frame's result does not depend on which master it
runs on (pools hand masters out in placement order, so a later re-plan never moves an earlier frame's master), and
learning a value never needs a later frame (results by the post-order above, views by the segment closes).

### 3.6 Failure modes and refusals

| Shape | Behaviour | Refusal |
| --- | --- | --- |
| A refusal under a stand-in, the producer learned with another value | not a verdict: planned again | none; trace `replan pass=N reason=argument-results moved=[callsite:stated->learned ...]` |
| A refusal under a stand-in, the producer not learned before it (the producer refused, or with today's order a consumer's deeper subtree refused first) | nothing moved, so the refusal stands | the refusing frame's own, e.g. `Splitter.split()` writing its own record behind arbitrate |
| Values still moving at the cap | refused | "the entry's arguments an earlier call's result builds did not settle: the hop re-planned N time(s) without the results its producers returned stopping (callsite(s) ...)"; arms keep `f2e34600d`'s message |
| An argument reads a result a loop repeats (one per turn), or a type with no stated zero (a struct, an enum) | unchanged | "passes argument i from a ..." |
| A callee frame's argument reads its own earlier call | unchanged until stage 1b | as above |
| A plan-time check that refuses while the plan states a stand-in (the reach check) | deferred: the pass still settles to learn, and the refusal stands once a pass learns nothing that moves the plan | the check's own words |
| The planner itself refuses while building a plan that states a stand-in (no plan, so nothing settles) | stands in the prototype; the design plans the refused part out of the learning pass (as the hop did before such refusals were named) and decides it on the plan without stand-ins | the planner's own, e.g. `Vault.pay()`'s `deals` write in `fan-in` |
| A re-plan that needs more masters than a pool holds | refused | the pool's refusal, as today |

### 3.7 Files and functions, by stage

1. **Stage 1, the entry's own arguments (prototyped).** `call-resolution.ts`: `HopCallInputs.argumentReturns` and
   `CallResolver.resolveArgument`; `resolveCallArguments` reads arguments through it, while targets and conditions
   resolve as before. `external-calls.ts`: `zeroOfResultType`, `standInResultOf` and `argumentReturnsOf`;
   `planEntryCalls` states the root frame's producer-built arguments from learned results or stand-ins and records
   what each visited site read (`HopExternalPlan.argumentProducers`, `argumentResults`, `standInProducers`).
   `deploy.ts`: `settleCallees` keeps each learned `retval` in a map its caller holds (`retvalSink`), so a refused
   settle still hands back what it learned; `producedCallResults` covers conditional and argument producers;
   `planAndSettleHop` defers a stand-in's refusal, compares stated and learned values (`movedArgumentResults`) and
   plans again; both settle closures pass the map.
2. **Stage 1b, callee frames and order.** `external-calls.ts`: thread the call path through `placeCalleeMasters` and
   `placeProxiedCallee` into the nested `planEntryCalls`, key learned results by it, and record `path` and
   `callsiteIds` on `HopCallee`. `deploy.ts`: `producedCallResults` walks every frame's sites, and `settleCallees`
   settles in post-order.
3. **Stage 2, loop bounds.** `occurrenceCountOf` evaluates the domain's `continueCondition` (and
   `derivedOccurrenceCountOf` its sources) with the learned results, as conditions do (`conditionExternalReturns`); an
   unlearned bound plans no turn, and its producer joins the producers the loop plans again on.
4. **Stage 3, callee records at the reached state.** `external-calls.ts`: a ledger of reached views per category,
   built while planning in V6 order; `calleeEntryWrites` and `calleeReadNodes` plan against the reached view instead
   of the live deployment; a callee write whose value the artifact does not publish is laid at a candidate width and
   laid again from the value learned at its close, as the entry's own run is (`entryWritesFor`);
   `requireSatisfiableReachWrites` narrows to what one transaction cannot carry even chained (two heads created for
   one collection). `deploy.ts`: `buildHopPlan` states each callee segment's `viewIn` from the
   chain, leaves a written `viewOut` unstated (a callee's own data-record write, MS5 and MS6), spends a written record
   on the write path and leaves its output to the chain's end (the composer's `declaredChainEnd` already recreates an
   unstated record there); the settle relaxes in V6 order.
5. **Stage 4, the entry's own reached state.** `occurrenceCountOf`, `makeCallResolver` and the loop plan
   (`planHopLoopBatch`) read the state decoded from the implementation frame's learned views before each call,
   replacing `conditionReadsWrittenState`'s one visit, in the same loop.

### 3.8 Rollout and acceptance

| Stage | Ahead pins that move | Must stay green |
| --- | --- | --- |
| 1 | `fan-in` take and pay start: past the argument refusal to the planner's refusal of `Vault.pay()`'s `deals` write; `packed-address-argument` arbitrate: past it to `Splitter.split()`'s own record write (both measured, section 4) | the seven hop suites (measured, section 4) |
| 1b | none pinned yet: pin a callee frame's producer-built argument first (the real `UnicrowClaim.claim` passes one a call before its payout loop) | as above, with `call/conditional-return-gated-arms` |
| 2 | `reentry-payout`, `deep-arbitration` first case: to the reach check their second case meets (needs 1b, since the loop is in the claimer's frame) | as above |
| 3 | `reentry-payout`, `deep-arbitration` second and third cases; `origin-gated-payout`; `fan-in` take and pay start; `packed-address-argument` arbitrate | as above, with the `shapes/` replicas as the machine's reference |
| 4 | `job-updates` #34, #36, #38 and the arms of #31-#33; `job-threads-and-refusals` #20, #64; `call-argument-from-own-write`'s plain-state case | as above |

Each stage flips its pins to the next wall, or to a settle and a broadcast, in the commit that lands it.

### 3.9 Soundness

Planning chooses the witness; the machine checks all of it. The caller's own code computes each argument from the
values it holds and refuses a record whose digest differs; V5 binds every record's `result` to the callee's `retval`
and its digest to the callee's call data; each frame closes every segment against its declared views, and V7 chains
them from the real inputs to the real outputs. A stand-in the transaction does not compute can only be refused, never
accepted, and the loop returns only a plan whose settle completed. A refusal computed from a stand-in is deferred, not
dropped: it stands once a pass learns nothing that moves the plan. (The separate hand-over that `broadcastHop` runs
without checking `settled.accepted` is unchanged by this design.)

What this does not change: the compiler, the master programs, the validator program (whose bytes every framed
address is derived from), the witness ABI and the composer's layout. A stage that would need one of them is outside
this design.

### 3.10 Cost

Each pass is a full settle, so a hop of dependency depth `D` takes at most `D + 2` settles. Measured at `82e71560f`,
where the fan-in cases still reached the settle (section 4): two settles before the next wall, 15.4 s and 5.9 s (run
with the hop trace on), against 3.4 s and 2.6 s for HEAD's plan-time refusal. A later step can start each pass from
the previous pass's learned values for the frames whose call data and views did not move.

## 4. The stage-1 prototype

`docs/framed/patches/reached-state-arguments.diff` changes only the three hop files of 3.7 item 1
(`call-resolution.ts`, `external-calls.ts`, `deploy.ts`). It was written on `82e71560f`, re-based on `2a85cd76f` when
the two hop patches landed, and on `73fefbd2f` (an outpoint trace in `broadcastHop`, which moves its last hunk by
eight lines); each time it applied unchanged, with offsets. It carries no test change: once it is applied, the three
ahead cases below fail on their old words, and whoever lands it flips them to the walls named here. A callee frame's
own arguments stay as they are (stage 1b), and so do the settle order, loop bounds and record views. For an entry
whose arguments read no earlier result, the hop plans and settles exactly as before.

`git apply --check --cached` against HEAD (`73fefbd2f`): clean. `git apply --check` against the live tree: clean.
The patched SDK type-checks, and eslint reports as many problems on the three files as at HEAD (23, 0 and 2).

Measured in a scratch copy under `FRAMED_AHEAD=1`, the `fan-in` cases at `73fefbd2f` (and the same at
`2a85cd76f`), `packed-address-argument` at `2a85cd76f`:

| Case | HEAD | With the patch |
| --- | --- | --- |
| `fan-in` take | refused while planning, before any settle: "the call to "IJournal.post" passes argument 1 from a "expression" expression of kind "call", which the hop cannot resolve from the caller's own arguments and state" | the count and the fee are stated as `0`, and the plan is refused one wall later, still before any settle: "the callee "Vault.pay()" writes records this hop cannot declare: the implementation's "pay" entry writes mapping "deals" a value whose source the artifact does not publish, so this hop cannot tell whether the write needs value chunks". `pay` stores a `Deal` holding the amount it computes from its own two `balanceOf` reads, a value only its close states (stage 3) |
| `fan-in` pay start | refused while planning: "the call to "IVault.pay" passes argument 3 from a "expression" expression of kind "producerResult", ..." | the same refusal of `Vault.pay()`'s `deals` write |
| `packed-address-argument` arbitrate (59-62) | refused while planning: "the call to "IJournal.publishJobEvent" passes argument 1 from a "expression" expression of kind "call", ..." | `split`'s `uint256[5]` is stated as five zeros, and the settle stops at the producer itself: "the call's callee "Splitter.split()" did not settle through the proxy: frame "callee-master-1" of Splitter.split() at line 21: no source message (Program failed an OP_VERIFY operation.)". `split` writes its own record (`calls = calls + 1`), which the hop declares kept (stage 3); nothing moved, so the refusal stands. The consumer's delegate frame (`Journal.publishJobEvent()`, depth 2) settled before `split` (depth 1): the order 3.4 changes |
| the other eight `packed-address-argument` cases | 8/8 | 8/8 |

Behind the `deals` refusal, measured at `82e71560f`, where the hop still planned such a callee without its write
(`FRAMED_HOP_TRACE=1`): pass 0 learned `noteCount`'s `1` and `feeOf`'s `250` (`replan pass=0
reason=argument-results moved=[1:0->1 4:0->250]`; pay start `moved=[2:0->250]`); each settle stopped inside `pay`
at `Coin.transferFrom()` (an `OP_VERIFY`, so `pay`'s own result was never learned); and pass 1 was refused by the
reach check: "the hop reaches the entry "Coin.approve()" 2 times, and 2 of them write collection "allowances" at the
same key; ..." (`approve` in the entry and `transferFrom` inside `pay` write `allowances[desk][vault]`; the check
names its group's first reach). Planned against the live deployment, `transferFrom` would also read that allowance as
it was before `approve` wrote it (the walls-ahead table's "seen, not pinned"). All of it is stage 3.

| Hop suite, each run alone | HEAD `73fefbd2f` | Patched |
| --- | --- | --- |
| `call/proxy-call` | 4/4 | 4/4 |
| `call/proxy-external-calls` | 7/7 | 7/7 |
| `call/proxy-proxied-callee-return` | 5/5 | 5/5 |
| `call/write-segments-settlement` | 3/3 | 3/3 |
| `call/conditional-return-gated-arms` | 1/1 | 1/1 |
| `deploy/proxy-entry-writes` | 7/7 | 7/7 |
| `toys/proxied-entry` | 7/7 | 7/7 |

The same 34 of 34 both ways at `2a85cd76f` and at `82e71560f`. Also green with the patch, each alone, at
`82e71560f` and `2a85cd76f`: `call/proxy-external-calls-published` (7, 1 skipped),
`call/proxy-external-calls-loop-state` (6, 1 skipped), `reverts/zero-target-call` (3) and
`call/proxy-guarded-write-call` (2); and on their own pins the ahead files `packed-integer-argument` (6/6) and
`call-argument-from-own-write` (11/11) at `82e71560f`, and `reentry-payout` (3/3), `deep-arbitration` (3/3),
`origin-gated-payout` (6/6) and `job-updates` (23/23) at `2a85cd76f`. Their entries' arguments read no earlier
result, so the patch plans and settles them exactly as HEAD does.

## 5. Execution-order planning: the spike

Status: spike (2026-10-01), landed on `framed-next` with this section; measured at `171d1528b`, re-checked on the
tip it was committed to (`ee1b55310`). It replaces the stage-1 patch of section 4:
`patches/reached-state-arguments.diff` is superseded and should not be applied.

### 5.1 The idea

The fixed point of section 3 states a stand-in for every value the transaction reaches and settles the whole hop
until nothing moves. The kernel's planner (`kernel-beta-candidate`, read only) works the same way: producer probes
seed the stand-ins, every pass is a whole-transaction trace, a pass rebuilds when an argument or a reached call
moves, the budget is the claims plus two, and a fingerprint stops a cycle; it avoids records an earlier call wrote
only by composing every call to a contract into one input, which framed does not do.

Per-call allows something the kernel cannot. The validator checks frames in execution (V6) order and each frame is
a body of its own, so a frame's result depends only on its call data and the records it reads, never on a frame
after it. The hop already places frames in V6 order (a pre-order walk: a site's callee and its subtree before the
next site). So the planner walks the execution and stops at the first site whose value it cannot state yet:

```
reached = {}
loop:
  plan = planHopExternalCalls(reached)       // stops before the first site that reads an unlearned result
  if plan.blocked:
    settle only the frames of the calls the site reads (and their subtrees), on the stopped plan
    reached += what they returned            // keyed by the calling frame's path and the call's site
    continue
  settle the whole plan, starting each frame from what the stops learned
```

Nothing is stated that the execution does not compute, so nothing is deferred: a refusal while settling a stop is
that frame's verdict on its real inputs, and a refusal while planning after a stop is a plan-time refusal on real
values. Each stop learns at least one result no earlier stop learned, so the loop ends (`MAXIMUM_PLAN_STOPS`, 64,
names a hop that would not).

### 5.2 The prototype

Three hop files, no compiler, program, witness or composer change:

- `external-calls.ts`. `planEntryCalls(ctx, caller, enteredBy, path)` walks its sites in order (pass one is a loop
  that can stop): `waitingProducers` names the earlier sites of the same frame whose result a loop's domain or a
  visited site's argument sources read and no settle has learned; the walk stops there (`HopPlanBlock`: `path`,
  `where`, `reads` = `argument` or `loop-bound`, `producers`). A site whose results are learned resolves its
  arguments through `argumentReturnsOf` and `makeCallResolver({ argumentReturns })`, and `occurrenceCountOf`
  evaluates a loop's domain with them (`conditionExternalReturns`). Pass two places the resolved sites in order and
  stops after a callee whose own walk stopped (`ctx.stop`); `placeCalleeMasters` and `placeProxiedCallee` place no
  later visit and mark the frames above the stop `truncated`. Every frame carries its `path` (`/site.visit` per
  level, `''` for the entry; a proxied reach's two frames share it) and the site that names it (`origin`).
  `knownResultsOf` hands a frame only its own results. `HopExternalPlan.blocked` and
  `HopExternalPlanOptions.reachedResults` (keyed `path|callsiteId`) carry the loop's state.
- `call-resolution.ts`. `HopCallInputs.argumentReturns` and `CallResolver.resolveArgument`, as in stage 1: an
  argument may read a learned result, a target never does.
- `deploy.ts`. `planAndSettleHop` gains the stop branch: the reach check on the stopped plan (all its values are
  real, so a clash there stands), `producerFramesOf`, `settleHopCallees(options, only)` (factored out of
  `settleHop`) with `settleCallees({ only, seed })`, `reachedCallResults` (a proxy's result through `retvalFrom`, as
  `producedCallResults`), and `keepFrameLearning`/`seedOf`, which key what a stop learned (each frame's `retval`,
  unstated write views and event payloads) by `path|functionName` and hand it to the same frames in every later
  plan, including the full plan's settle. `HopPlanOptions.truncated` and `resolvedWriteSegment({ truncated })`
  declare a truncated frame's write past its last stated call in its last segment: a stopped plan never settles
  that frame, it only has to compose.

A stop happens only where the base refuses: an argument or a loop bound reading an earlier result was refused by
`resolveCallArguments` and `occurrenceCountOf` at plan time. A hop without one plans and settles exactly as before:
the seed is absent, `only` is absent, the conditional re-plan of `f2e34600d` is untouched.

### 5.3 Results

| Case | Base `171d1528b` | Execution order |
| --- | --- | --- |
| `fan-in` take | refused while planning: `IJournal.post` argument 1 (`noteCount`'s count) | two stops: settles `noteCount`'s two frames alone (`learned=[\|1:1]`), then `feeOf`'s (`[\|4:250]`); refused while planning `pay`: `Vault.pay()`'s `deals` write (stage 3, the wall section 4 named) |
| `fan-in` pay start | refused while planning: `IVault.pay` argument 3 (`feeOf`'s fee) | one stop (`[\|2:250]`), then the same `deals` refusal |
| `packed-address-argument` arbitrate | refused while planning: argument 1 (`split`'s `uint256[5]`) | one stop: settles `split`'s frame alone, which refuses its own record write (`calls = calls + 1`; stage 3). The consumer is never planned (`stated` holds `split`'s argument only); stage 1 settled the consumer's delegate frame first (3.4's order problem) |
| `reentry-payout`, first case | refused while planning: the loop's bound | one stop inside `Claimer.claim` (path `/0.0/0.0`, depth 2): settles `readRecord`'s frame, learns 4, plans four turns; refused by the reach check, the second case's wall (stage 1b and 2 of section 3.7) |
| `deep-arbitration`, first case | refused while planning: the loop's bound | one stop (path `/1.0/2.0`), learns 5, refused by the reach check as its second case |
| `call/argument-from-earlier-result` (new) | refused while planning | `chain` (price, `twice(price)`, `thrice(...)`, stored) and `sum` (a loop bounded by a returned count) settle and broadcast, with the values the bodies computed |
| `call/proxy-external-calls-published` loop width | refused while planning | with the facade seeded, the plan stops before `getJobs`'s loop with `jobsLength` placed (the pin is flipped to that) |

Unchanged, each run alone with the prototype at `171d1528b`, `740139083`, `0af2d6331` and `ee1b55310` (the tip it
was committed on): the nine hop suites (`call/proxy-call` 4, `call/proxy-external-calls` 7,
`call/proxy-proxied-callee-return` 5, `call/write-segments-settlement` 3, `call/conditional-return-gated-arms` 1,
`call/branch-predicate-after-arm-write` 3, `call/loop-turns` 7, `deploy/proxy-entry-writes` 7, `toys/proxied-entry` 7:
44 of 44, as without it at each); `call/proxy-external-calls-loop-state` (6, 1 skipped), `reverts/zero-target-call`
(3), `call/proxy-guarded-write-call` (2), `call/proxy-callee-proxy` (3), `call/reach-write-check` (4) and
`call/two-created-heads` (4); under `FRAMED_AHEAD=1` the four ahead files (19 of 19 with the flipped pins) and
`origin-gated-payout` (6), and, at the first two, `packed-integer-argument` (6), `call-argument-from-own-write` (11)
and `job-updates` (23) on their own pins. (The tip moved under the spike three times: genesis-only heads and a
batch-verification fix; each re-sync was re-run before the commit.) Ladder titles whose first wall was one of these refusals
(`PLAN_MARKETPLACE_66.md`, "Walls ahead": MS3, MS4, MS7, arbitrate) were not run; their rows move to the walls
above.

### 5.4 Cost

Measured in one scratch copy at `171d1528b`, each variant installed in turn, every count the same in two untraced
runs and a traced one (wall time within 5 %); "attempts" are frame attempts, each a full composition build
(`buildHopPlan` and `composeDraft`) and one or more VM runs, counted from `FRAMED_HOP_TRACE=1`; VM runs are counted
by wrapping the machine's `evaluate`. `chain` and `sum` are `call/argument-from-earlier-result`'s entries; `deep` is
`chain` with two more links (`twice`, `thrice`), in an uncommitted measurement copy of that file.

| Shape | Stage-1 fixed point | Execution order |
| --- | --- | --- |
| `chain`: two dependent arguments | 3 settles, 22 attempts, 100 VM runs, 2.9 s | 2 stops and 1 settle, 10 attempts, 52 runs, 1.5 s |
| `deep`: four dependent arguments | 5 settles, 56 attempts, 218 runs, 7.1 s | 4 stops and 1 settle, 16 attempts, 74 runs, 2.4 s |
| `sum`: a loop bounded by a result | refused while planning | 1 stop and 1 settle, 11 attempts, 61 runs, 1.9 s |
| `fan-in` take, to the reach check (1) | 2 settles, 22 attempts, 58 runs, 4.6 s | 2 stops, 6 attempts, 16 runs, 0.57 s |
| `fan-in` pay start, to the reach check (1) | 2 settles, 14 attempts, 42 runs, 2.2 s | 1 stop, 3 attempts, 8 runs, 0.30 s |
| `fan-in` take, as it stands | refused while planning (`deals`), 0 runs, 49 ms | 2 stops, 6 attempts, 16 runs, 0.59 s, then the same refusal |

(1) With `calleeEntryWrites`'s refusal bypassed for the measurement only, which is how the hop planned `pay` at
`82e71560f`, where section 3.10 measured two settles, 15.4 s and 5.9 s with the trace on (another base and load).
Both approaches then meet the reach check (`approve` and `transferFrom` write `allowances[desk][vault]`); stage 1
settles every frame twice and stops inside `pay` at `transferFrom`, execution order settles two leaf reads.

Why: a stop settles only the frames of the calls the waiting site reads (two attempts for a leaf that returns,
three for a proxied one), and the full settle starts each frame from what the stops learned (one attempt for a frame
already settled). The fixed point settles every frame on every pass, so its cost grows with dependency depth times
the number of frames; execution order grows with the number of frames plus the number of stops. Re-planning from the
start at each stop is cheap beside a settle (a plan-time refusal at the base takes 10 to 50 ms).

### 5.5 How far it extends

- **Arguments and loop bounds, at any depth.** Done in the prototype: the hop's own entry and callee frames alike,
  through proxies, keyed by frame path. Not waited for, and refused as before: a result a loop returns once per turn,
  a result of a site the plan places no call for, and a loop whose domain the artifact does not publish.
- **Conditions.** Unchanged (`f2e34600d`'s full settle and re-plan), because those shapes are served today. A
  condition that reads an unlearned result would be one more stop: decided in the next plan from the learned result,
  in callee frames too, where a gated site is planned today as no visit and never revisited.
- **Targets** computed from a result: the same stop, once `resolveCallTarget` reads through `resolveArgument`.
- **A record an earlier frame wrote (re-entry, stage 3): not without a compiler change.** A result is exposed when
  its frame returns, which precedes its consumer in V6 order; a view a frame writes in the middle of its body is
  not. The shipped masters close every segment at their end: `entryStopSites` (`solidc/src/framed/master/
  stop-sites.ts`) publishes "every call in order, then every segment close", and a frame `W.f()` that writes, calls,
  writes and calls publishes `call 0, call 1, close of segment 0, close of segment 1, close of segment 2`. So the
  view `Escrow.release` leaves before it calls `claim` (the guard `claiming = 1`) is compared, and can be learned,
  only once `claim` has returned, while the frames inside `claim` that read it (`readRecord`, `setClaimed`) have to
  be planned with it first. Section 3.4's premise ("a frame's segment `k` closes at its call `k`, before that call's
  result is needed") does not hold for the shipped programs. Two ways out:
  1. **Close each segment at the call that ends it** (a master-program change in `solidc`; the validator, whose
     bytes the addresses derive from, is untouched): compare segment `k` and publish its close before `call k`, so
     the derivation learns each view in execution order, the order spec section 18's loop assumes when it reads "the
     computed records" at a stop site. Then the stop mechanism covers re-entry with no stand-in: a stop for "this
     frame declares a record an earlier frame wrote, at a view no settle learned" (found from the writers' published
     `writeSegments`), a derivation of the truncated writer on the stopped plan that learns the view at that close
     (the composer already learns an unstated `viewOut` where the body compares it, `learnComputedValues`) before it
     stalls at the call it cannot bind yet, and the reader planned from it. The kill criterion of
     `EVAL_REMOVE_BATCH_ENTRYPOINT.md` ("re-entry forces a cross-slot fixpoint") would not trigger.
  2. **Keep the programs and confine the fixed point to re-entered views.** State the reader's view at the live
     commitment, settle the writer to its end (its own body needs only its callees' results, which the stale view
     often does not change: `readRecord` returns `shares` either way, and a void `setClaimed` returns nothing), learn
     the written view there, and plan the reader again. This needs a settle that keeps learning past a frame whose
     verdict is not needed for the value being learned (`setClaimed` refuses under the stale guard), and it is a
     cross-frame fixpoint in the EVAL document's sense, bounded by the re-entry depth.
  Either way the hop's representation has to change as stage 3 says: `buildHopPlan` stating each callee segment's
  `viewIn`/`viewOut` from a per-record ledger built in V6 order instead of the live commitment, spending a written
  record on the write path with its output at the chain's end (`declaredChainEnd`), and `calleeEntryWrites` and
  `calleeReadNodes` planning against the reached node, two reaches of one key sharing one participant (the parallel
  worker's change), with `requireSatisfiableReachWrites` narrowed to what a chain cannot carry.
- **The entry's own reached state (stage 4).** The same holds for the implementation frame: its views at call `k`
  are compared at its end, so planning site `k` from the state its own body wrote needs closes at calls (way 1) or a
  plan, settle and re-plan on the entry's learned records (way 2, what section 3's stage 4 proposes).

### 5.6 What had to be restructured

- **Planning order.** `planEntryCalls`'s pass one became a loop that can stop, and pass two stops after a callee
  that stopped. The whole entry is no longer validated before any live record is read when it stops: the sites
  after a stop are validated once their results are learned.
- **Incremental placement.** A stopped plan is re-made from the start rather than extended: placement is
  deterministic, so the frames before the stop are placed again identically (same master ids, same pool slots,
  same participants), and learned values are re-keyed by frame path at each plan (`seedOf`) so nothing depends on
  that identity.
- **The participant layout.** `buildHopPlan` lays whatever the plan places: a stopped plan's later calls, their
  masters and records are simply absent, and input indices shift as the plan grows, which is why nothing learned is
  keyed by index. The one change is the truncated frames' write segments (above).
- **The settle.** `settleCallees` takes `only` and `seed`, and `settleHopCallees` is factored out of `settleHop`.
  The loop is bounded by learning: each stop adds at least one result (or the hop is refused by name, "returned
  nothing the hop could decode"), and `MAXIMUM_PLAN_STOPS` names a plan that never completes.
- **Refusals.** A refusal while settling a stop is the producer frame's own and stands (arbitrate's `split`). A
  plan-time refusal after a stop is reported as at the base (fan-in's `deals`). The gap: the entry's own frame is not
  evaluated at a stop, so an entry that reverts before a stopped site (a `require` on its own state, say) is reported
  as the first planner or settle refusal that follows, as the base reports a plan-time refusal before any settle.
  The fix is to derive the truncated entry at each stop and read a stall before the stopped site's own call site as
  the entry's revert.

### 5.7 Recommendation

Adopt execution-order planning for every value an earlier call returns, and do not apply the stage-1 fixed point.

- It is sound without deferral: nothing is stated that the execution does not compute, so every refusal is a
  verdict, and the machine checks the final plan as it checks any.
- It is cheaper, and the gap grows with depth: 1.9 to 3 times faster and 2 to 3 times fewer VM runs on the
  dependent chains, 7 to 8 times faster to fan-in's next wall.
- It covers stage 1b (callee frames) and stage 2 (loop bounds) with the same mechanism and no extra state.
- It stays inside the hop's three files, and shapes served today keep their path.

For views (re-entry, stage 3, and the entry's own state, stage 4) execution order is only as good as the order the
programs expose them in. Closing each segment at the call that ends it (way 1 of 5.5) is the change that makes the
whole reached-state problem execution-ordered, with no stand-in anywhere; it is a compiler change to every master
that makes calls and should be decided by the compiler stream before stage 3 starts. Without it, stage 3 and stage 4
use a stand-in view learned at the writer's end (way 2), a fixed point confined to re-entered records and bounded by
the re-entry depth, beside execution-order planning for results.

Staging:

1. Landed: arguments and loop bounds from an earlier result, in any frame (this section; the four ahead pins and
   the published-facts pin flipped, `call/argument-from-earlier-result` added).
2. Next, small: derive the truncated entry at each stop to report its own revert; conditions and targets as stops
   (retiring `f2e34600d`'s full-settle re-plan once its suites pass on stops).
3. Decide way 1 or way 2 for views (a compiler-stream decision), then stage 3 on it: the per-record ledger in
   `buildHopPlan` and the shared mapping participant; pins that move: `fan-in` (`deals`, then `allowances`),
   `packed-address-argument` arbitrate, the second and third cases of `reentry-payout` and `deep-arbitration`,
   `origin-gated-payout`.
4. Stage 4 on the same choice.
