# Planning against the reached state: design, and a stage-1 prototype

Status: design (2026-10-01, user direction). Stage 1 is prototyped as `patches/reached-state-arguments.diff`, not
applied. Lane: the SDK hop (`packages/solidcash/src/per-call/proxy/`), which is the ladder stream's; the patch is the
hand-over. The pins cited are those at `73fefbd2f`, the HEAD the patch is based on and checked against (section 4).

## 1. The problem

The hop (`callPerCallProxyEntry`, `deployPerCallProxy`) plans every call of a composed transaction from facts that
hold before the transaction: the entry's arguments, the proxy's live records and each callee's live deployment. The
execution runs each call against the state and the results the transaction has reached when the call is made. A
planned value that depends on something the transaction reaches is therefore refused at plan time, or settled
against a stale view and refused at that frame's line. The walls, pinned in `packages/solidcash/test/per-call/ahead/`
(run with `PER_CALL_AHEAD=1`; `PLAN_MARKETPLACE_66.md` section 6, "Walls ahead", and the Log rows titled "walls
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
   `PER_CALL_HOP_TRACE=1` prints every `attempt` and `stop ... reason=`.
3. **Re-plan for gated arms** (`f2e34600d`). A site whose published condition reads an earlier call's result is
   planned as no visit. `planAndSettleHop` settles, decodes each producer's `retval` (`producedCallResults`, through a
   proxied callee's `retvalFrom`), plans again with those results, and stops when `samePlannedSites` holds, at most
   once per conditional producer. This is the model the design generalizes: plan from what is known, settle to learn
   what the transaction reaches, plan again.

The machine already accepts the reached state. The caller's own code computes each call's argument digest from the
values it holds, an earlier record's `result` among them, and refuses a record that carries another
(`solidc/src/per-call/master/call-site.ts`: "the record is not the authority for the digest, the code's operands
are"). V5 binds each record's `result` to the callee's `retval` and its digest to the callee's call data; V6 derives
the execution order; V7 chains each record's views across every frame that runs on it, in that order, from the real
input to the real output (`SPEC_PER_CALL_TRANSACTION.md` 7.2). The hand-planned replicas in `test/per-call/shapes/`
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

What this does not change: the compiler, the master programs, the validator program (whose bytes every per-call
address is derived from), the witness ABI and the composer's layout. A stage that would need one of them is outside
this design.

### 3.10 Cost

Each pass is a full settle, so a hop of dependency depth `D` takes at most `D + 2` settles. Measured at `82e71560f`,
where the fan-in cases still reached the settle (section 4): two settles before the next wall, 15.4 s and 5.9 s (run
with the hop trace on), against 3.4 s and 2.6 s for HEAD's plan-time refusal. A later step can start each pass from
the previous pass's learned values for the frames whose call data and views did not move.

## 4. The stage-1 prototype

`docs/per-call/patches/reached-state-arguments.diff` changes only the three hop files of 3.7 item 1
(`call-resolution.ts`, `external-calls.ts`, `deploy.ts`). It was written on `82e71560f`, re-based on `2a85cd76f` when
the two hop patches landed, and on `73fefbd2f` (an outpoint trace in `broadcastHop`, which moves its last hunk by
eight lines); each time it applied unchanged, with offsets. It carries no test change: once it is applied, the three
ahead cases below fail on their old words, and whoever lands it flips them to the walls named here. A callee frame's
own arguments stay as they are (stage 1b), and so do the settle order, loop bounds and record views. For an entry
whose arguments read no earlier result, the hop plans and settles exactly as before.

`git apply --check --cached` against HEAD (`73fefbd2f`): clean. `git apply --check` against the live tree: clean.
The patched SDK type-checks, and eslint reports as many problems on the three files as at HEAD (23, 0 and 2).

Measured in a scratch copy under `PER_CALL_AHEAD=1`, the `fan-in` cases at `73fefbd2f` (and the same at
`2a85cd76f`), `packed-address-argument` at `2a85cd76f`:

| Case | HEAD | With the patch |
| --- | --- | --- |
| `fan-in` take | refused while planning, before any settle: "the call to "IJournal.post" passes argument 1 from a "expression" expression of kind "call", which the hop cannot resolve from the caller's own arguments and state" | the count and the fee are stated as `0`, and the plan is refused one wall later, still before any settle: "the callee "Vault.pay()" writes records this hop cannot declare: the implementation's "pay" entry writes mapping "deals" a value whose source the artifact does not publish, so this hop cannot tell whether the write needs value chunks". `pay` stores a `Deal` holding the amount it computes from its own two `balanceOf` reads, a value only its close states (stage 3) |
| `fan-in` pay start | refused while planning: "the call to "IVault.pay" passes argument 3 from a "expression" expression of kind "producerResult", ..." | the same refusal of `Vault.pay()`'s `deals` write |
| `packed-address-argument` arbitrate (59-62) | refused while planning: "the call to "IJournal.publishJobEvent" passes argument 1 from a "expression" expression of kind "call", ..." | `split`'s `uint256[5]` is stated as five zeros, and the settle stops at the producer itself: "the call's callee "Splitter.split()" did not settle through the proxy: frame "callee-master-1" of Splitter.split() at line 21: no source message (Program failed an OP_VERIFY operation.)". `split` writes its own record (`calls = calls + 1`), which the hop declares kept (stage 3); nothing moved, so the refusal stands. The consumer's delegate frame (`Journal.publishJobEvent()`, depth 2) settled before `split` (depth 1): the order 3.4 changes |
| the other eight `packed-address-argument` cases | 8/8 | 8/8 |

Behind the `deals` refusal, measured at `82e71560f`, where the hop still planned such a callee without its write
(`PER_CALL_HOP_TRACE=1`): pass 0 learned `noteCount`'s `1` and `feeOf`'s `250` (`replan pass=0
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
