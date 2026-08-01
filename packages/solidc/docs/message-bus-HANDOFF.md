# Layer-3 message bus: handoff

Written for an incoming reviewer/implementer picking this up cold. Read this file, then
`message-bus-completion-ledger.md` (the authority for what is claimed), then
`message-bus-parallel-work-plan.md` (the board: ~591 rows, sections 4.x carry the narrative).

## 1. Where the work is

- Branch `codex/layer3-binding-spike`, worktree `/Code/cashscript/.worktrees/layer3-binding-spike`.
- Baseline branch is `solidcash_v0.13.1`. This work has NOT been merged to it.
- `solidc` 2,807/2,807. Capstones C1/C2/C3: 53 passed / 6 skipped.
- At `1b57f474`, the full SDK run has 5,188 passed / 49 skipped / 9 todo. Its only failures are the two
  known tests in `test/conformance/arithmetic.conformance.test.ts` (POW op-cost density), proven pre-existing
  by re-running against a clean tree. Do not chase them.
- Repository-wide `yarn build` and `yarn lint` are green at the same source state.
- At `caac68e0`, BCHN v29.0.0 accepted and mined current-byte A13, C2, C1 and C3 on regtest, while
  refusing each paired hostile transcript: 4 files / 69 tests green.

## 2. The single most important distinction on this project

**PROVEN != INTEGRATED.** Only rows with a named reviewer who did NOT implement them are PROVEN.
Everything else is INTEGRATED: verified and merged, not adversarially reviewed. The ledger marks
this. Do not upgrade a row's status by re-reading it.

Second distinction, equally load-bearing: **compiler admission is NOT VM proof.** A handler the
route admits has not been shown to settle, and a handler that settles has not been shown to refuse
its hostile. A claim needs all three: admitted, settled with a txid, and a one-field-moved hostile
refused at a NAMED INPUT INDEX.

## 3. Numbers you will be tempted to quote, and their real status

| figure | status |
|---|---|
| recovered-handler partition | CURRENT: 135 recorded rows / 126 admitted after-present rows / 213 gained / 15 lost / 64 moved. The live exact-set check names every drift. Historical 206- and 215-handler partitions remain useful only when explicitly labelled with their commit state. |
| VM-proved numerator | CURRENT UNION: 1,564 records / 806 settlements / 167 routes / 157 collisions; 213 eligible handlers partition into 145 proved and 68 unproved. The consumer attributes only by batch-blob containment. Historical 82/206 and 112/206 runs are not current ratios. |
| 12 gained writers | CURRENT conservative classifier count; nine explicitly publish `writesState: true`. Classification means the state machinery is required, not necessarily that the source body changes a state variable. |
| "no chunk-backed writer exists" | SOLID, measured both directions. Writer rows and dynamic-variable rows are DISJOINT sets. Do not hunt a subject for this shape. |
| "co-spent-callee graphs have no subject in the recovered population" | RETIRED. The current 213-handler partition includes outgoing-call subjects, including the single typed, argument-target bare-forwarding shape covered by the X201/typed-dispatch covenant proofs. |

`writesState: true` means **"needs the state machinery"**, NOT "changes a state variable". Always read the body.

Current capstone measurements are evidence, not estimates:

- **C2:** 59,785 serialized bytes; 1,088-byte transcript; controller ratio 0.6250; projection
  instruction counts `[15826, 15826, 15826, 15792]`.
- **C3:** 96,461 serialized bytes; 2,006-byte transcript; controller ratio 0.9780; no over-budget input.
- **Delegate v1:** the pinned one-hop participant is represented by a transcript-bound delegate execution
  frame naming the distinct executor input and executor locking bytecode. Nested and general delegate graphs
  remain outside this one-hop requirement.

## 4. Ranked open work

### Tier 1: security, repaired after the failed L2 review
- **SEC-18 / L2-F3** - direct and function-pointer readers now share the live scalar journal.
- **L2-F1a** - both bypass constructors are refused by the participant covenant, not merely by the planner.
- **L2-F1b/F1c** - neither clone spelling nor fabricated footprint metadata buys consensus admission; X146
  closes the dynamic half in the covenant. The planner remains a diagnostic, not a security boundary.
- **L2-F2** - the route and every invoker of a journalled handler now hold the required context (X139).

The original L2 review remains the evidence that the first repair failed; it is not a description of HEAD.
Focused current-HEAD evidence lives in `Layer3SecurityReviewL2X111`, `Layer3EmissionCloneJournalX111`,
`Layer3EmissionCloneFakeWriteX138`, `Layer3ReadYourWritesX105`, and `SecurityReviewL2Sec18`.

### Tier 2: named gaps with a known shape
- **X210** - CLOSED: the ordinary stateful submit path now evaluates every input of the exact fully funded
  transaction before byte checks and broadcast. The recursive opt-in keeps its specialized diagnostic, but is
  no longer the only VM boundary.
- **X186 is CLOSED** - the finalized-byte gate no longer absorbs covenant objections; it decides with
  `stateSuccess`, including non-raised falsy-top failures. X198 applied the same repair to the sibling
  all-input evaluator, and X210 now wires that evaluator into ordinary stateful submission.
- **X214 is CLOSED** - **0 bare `rejects.toThrow()` sites with no named reason.** The executable AST census
  began at 436 sites and now self-checks an empty population. The unit partition was exhausted first;
  two previously skipped P2PKH cases are now live, and `DynamicLoopEntryAdversarial` no longer passes on
  spent-input or signature failure before its mapping covenant runs. `Layer3BalancedCall` and
  `MultiDimensionalArray`, `SortedMappingDynBytesValue`, `MsgSenderC2`, `ConstructorChain`, and `Layer3GraphSpike`
  are exhausted with mutation-proved input-0 reasons. Both graph hostiles pin the provider's exact `OP_VERIFY`
  verdict; a never-match mutation made them red while the positive graph passed. `MsgSenderC2` required staged mutation: mutating its first rejection prevented
  the Alice state update needed by the next test, so restoring that first exact reason was required before the
  second matcher could be independently driven red.
  `VoidEarlyReturn`, `ReturnInLoop`, `FunctionPointerTernaryCall`, `NestedArrayDelete`, and
  `VoidEarlyReturnEntry` are exhausted as a five-file bundle: each sole target independently reached the same
  mutation-proved layer-3 input-0 `OP_VERIFY` reason while seven controls stayed green.
  `BytesOrder`, `C2DefaultMapping`, `C2ScalarCacheInLoop`, `CoalesceMappingEntryFieldWrites`, and
  `CollectionJournalTailReturn` are exhausted as a five-file bundle: every sole target independently reached
  the same mutation-proved layer-3 input-0 `OP_VERIFY` reason while ten controls stayed green.
  `Layer3ExecutionRoot` is exhausted: both the participant-set-only commitment and wrong-call-graph commitment
  reach the same mutation-proved provider refusal at input 0 (`OP_VERIFY`). `Layer3ResultSpike` is exhausted too:
  both result and settlement forgeries pin that exact provider verdict, with the positive graph green under
  mutation. This count also reconciles eight already-exhausted executable sites the previous pin omitted.
  `PortingFeatures` is exhausted: its wrong bytes truncation and wrong big-endian integer both reach the exact
  BCH-2026 input-0 `OP_VERIFY`; the measured source population was 110 before those two repairs.
  `SortedMappingsAllParity` is exhausted after its ordered write/read proofs: both final hostile reads reach
  that same exact refusal. The measured pre-edit population was 104, accounting for four earlier repairs absent
  from the published 108-site pin. `CreationCode`, `DiamondC3`, `DynamicLoopEntry`, `EmitAfterRevertGuard`, and `EnumCast`
  are exhausted: five independent mutations each pin the exact layer-3 input-0 `OP_VERIFY` verdict.
  `UncheckedArithmetic` is exhausted: its checked overflow and wrong wrapped-result expectation are both
  AST-live and reach input-0 `OP_VERIFY`. Its measured pre-edit population was 96, incorporating six earlier
  repairs absent from the published 102-site pin.
  `AddressCast` is exhausted: its wrong embedded hash reaches exact input-0 `OP_VERIFY`. Its measured pre-edit
  population was 88, incorporating six earlier repairs absent from the published 94-site pin.
  The five-file `CompoundAssignment` / `ConcatFunctions` / `ConstBytesConcat` / `ContractDeployment` /
  `CovenantFailureTrace` slice is exhausted. It distinguishes three input-0 `OP_VERIFY` refusals, one exact
  source-mapped failed require, and one input-0 Schnorr `NULLFAIL`.
  The `SameGapChain` / `MappingStructScalarWrite` / `Layer3Journal` / `Layer3BalancedRepeatedCall` /
  `Layer3Cycles` slice is exhausted. It distinguishes two layer-3 preflight input-0 refusals, two provider
  input-0 refusals, and the journal callee's provider refusal at input 1.
- **X170 is CLOSED on HEAD** - the blanket outlined-body refusal was over-broad. The compiler now
  compares the body's emitted chunk basis with every entry point that can reach it: agreeing bases
  compile and disagreeing bases fail closed with both layouts named. `PointerTableBound.test.ts`
  pins the one-token boundary; `Layer3RuntimeSizedPointerTable.test.ts` settles 1, 2, and 3 rows.
- **X207 is CLOSED** - the demotion is reachable, and X199 already computes `logicalValueMode` over
  final eligible handlers, so a demoted payable handler cannot widen the surviving route.
- **X227 is CLOSED NEGATIVE** - the fourth population is reachable through an uncalled private
  `msg.value` reader, but it controls balanced frame plumbing rather than SCB1 row width. Both sides use
  the same predicate, and the existing EnglishAuction narrow settlements are the runtime control.
- **X201 + X229 are CLOSED** - bare-body forwarding is admitted and bound without
  demoting existing route members. Uniformity compares the widened set with the pre-X201 set, and a
  code-generation failure retries the same ladder rung with only bare forwarding disabled. This preserves
  `ERC20Bank.token` and `balanceOf`. X226's write-then-call form settles and refuses its dropped callee at
  input 0. The final sweep at `b27dc1c4` is green: 115 files, 1,321 passed / 11 skipped.

### Tier 3: re-pins and residuals
- **X159 is CLOSED on HEAD** - `StableSwap` compiles in bus mode with four eligible handlers, and the
  three gained handlers (`tokens`, `balances`, `totalSupply`) settle. The focused compile pin and VM
  proof are `Layer3RecoveredPartitionX160.test.ts` and `Layer3RecoveredCollectionBreadthV2.test.ts`.
- **X226 is CLOSED** - the multi-statement write-then-call subject settles, and dropping its callee is
  refused by the caller covenant at input 0.
- **X213 is closed** - all 10 dead `resolves.not.toThrow()` clauses now await the operation and assert its
  successful result shape (txid, and transaction bytes where available).
- **X217 is CLOSED** - the committed `test/e2e/layer3-throw-census.ts` observes SDK boundary throws.
  V3's chai-matcher instrument covered assertion semantics, was validated, and was deliberately reverted
  after the measurement. They have complementary scopes and only the reusable boundary tool remains.
- **X221 is closed by scope** - the numerator is SCB1 route settlements. A no-blob direct call does not execute
  the route covenant and cannot prove it. The probe reports possible same-participant ordinary calls separately
  as `noRouteCandidates`; they remain excluded from route attribution.

## 5. Method that actually works here

These were all learned by getting them wrong first.

1. **Build the subject twice, differing only in the suspected field.** FIVE "walls" on this project
   turned out to be the measurement rather than the system: a stale dependency quoting stock limits,
   a return-event slot given a plain output, one argument passing a slot index where a master index
   was wanted, an SDK header byte, and a compiler rebuilt mid-run.
2. **A green suite proves nothing went RED; only a throw census proves nothing went VACUOUS.**
   Instrument the guard to log every throw with its calling `src/` frame, run the population, revert.
3. **Prove the repair was NECESSARY, not just sufficient.** Re-run each mutation against the
   PRE-repair file and show the old code was green under it.
4. **Match on what YOUR gate writes, not on what the decider says.** A control matching the wrong
   vocabulary passes vacuously.
5. **Validate your own instrument before trusting it, against a figure it must reproduce.** Three
   real failures: a census tool silently changed assertion text; a mutation harness reported GREEN when
   ZERO TESTS RAN (vitest `-t` is a REGEX, and a title containing `m[k]++` matched nothing); and a
   partition parser silently matched **15 of 135 rows and 68 of 206 gained handlers** because it
   required a rigid field order, then emitted a confident-looking count that was nearly published.
   The cure is cheap and non-negotiable: make the tool reproduce a number the source already publishes
   (currently X160's own 135 recorded / 126 admitted / 213 gained / 15 lost / 64 moved) and fail loudly if it
   does not. Make any harness refuse to
   call an empty run a result.
6. **Attribute by containment, never by adjacency.** An adjacency-based settlement probe manufactured
   settlements: a probe attempt traces its route and never broadcasts, leaving the route pending for
   the next attempt's initialization transaction to absorb.
7. **Libauth registers an error on the instruction AFTER the one that raised it.** Subtract one before
   mapping a pointer into `artifact.debug.functionDebug[...].requires`.
8. **Ask `stateSuccess`, not `state.error`.** libauth's `success()` returns `state.error` only as its
   FIRST branch, and that same function is what `vm.verify` uses. This exact shape has now survived
   inside two successive gates built to remove it. The compiler DELETES a final require's `OP_VERIFY`
   when the stack is shallow, so an ordinary failing require raises nothing at all.
9. **Do not narrow a specification or subject to obtain green.** If a subject stops existing, say so.
   A negative result reported honestly is worth more than a repair invented to have something to show.
10. **A widening to route ADMISSION needs the FULL bus-mode sweep, not a targeted set.** The worked
    example is X201: its author measured the capstones plus 5 files and disclosed 4 reds; I measured 5
    files and found 9; the then-complete 108-file sweep found 12 across 6 files, and the 12th is the one that
    decided the row. **The handler a widening breaks need not appear in any file that mentions the
    changed feature** - here it was demoted by a uniformity pass, not by the widened predicate.
11. **When judging a capability change, price it in PROVEN handlers, not in features.** Historically,
    the pre-X229 X201 attempt gained two handlers and lost one already-settling handler, which made that
    intermediate state a bad trade. X229 retired the trade by preserving the existing route members while
    landing X201. Keep the historical measurement as the reason for the monotonicity guard, not as HEAD state.

## 6. Security invariants that must not be traded away

- The SDK is an **untrusted witness constructor**. Every accepted shape must be justified by covenants
  and BCH consensus, never by the SDK behaving well.
- Owner identity is the actual co-spent input locking bytecode plus category/capability, never
  witness-declared.
- **A fail-closed boundary must never become an unchecked witness path.** When a capability is
  restored, prove the refusal MOVED (e.g. admission -> covenant) rather than disappeared. The worked
  example is X201 on current HEAD: `attack` is admissible again, and the VM refuses it at input index 0
  with the vector-exhausted signature - the refusal moved, it did not vanish. X229's uniformity interaction
  was repaired without reverting the capability. Re-derive the exact VM wording before relying on it.
- Never a bare `rejects.toThrow()` as sole hostile evidence.

## 7. Environment traps that have each cost a full run

- **`@mem-cash/validation` MUST be 0.0.8.** 0.0.7 silently IGNORES `consensus` overrides. It has
  reversed two conclusions and made a test look flaky.
- A worktree with no `node_modules` resolves **outward across a branch boundary**.
- `cp -a` the `node_modules` from a sibling WORKTREE, not the repo root. Verify:
  `ls node_modules/@solidcash/` = 4, `readlink node_modules/.bin/lerna` = `../lerna/cli.js` (a real
  symlink - a dereferencing copy makes `lerna` a shim that cannot require itself), `node_modules/solidc`
  resolves.
- **Run `yarn build` from the WORKTREE ROOT.** From a package dir it rebuilds only that package.
  Targeted tests passing while `yarn build` is broken is the most common failure mode here.
- `yarn install` DELETES the gitignored-but-tracked fixture
  `test/imports/fixtures/node_modules/@solidcash/testlib/constants.scash`, and `git status` reports
  nothing.
- `TaskStop` on a backgrounded task kills the wrapper but NOT the node child. Live orphans have
  exhausted swap once. Kill by PID; `readlink /proc/<pid>/fd/2` identifies which is live.
- **But a high `vitest` process count is NOT evidence of a leak.** This box carries ~45 ZOMBIE vitest
  entries (`STAT=Z`, PPID 1, **0 MB RSS**), some 26 days old, that hold process-table slots and no
  memory. They look identical to live orphans under `pgrep -c`. Diagnose with `ps -eo pid,stat,rss`
  and check actual swap holders via `/proc/<pid>/status` `VmSwap` - on this box the top holders are
  VS Code (~1.9 GB), not the test run. This is also the concrete reason `pkill -f vitest` is banned:
  it would match 45 corpses plus whatever live run is going, in every worktree.
- `pgrep` waiters SELF-MATCH their own command line.
- `artifact.bytecode` is an **ASM LISTING**, not hex. `.length / 2` is meaningless. Use
  `debug.bytecode` or `asmToBytecode`.

## 8. Hard bans

- **`git stash` is BANNED** - `refs/stash` is shared across worktrees.
- Never `git add -A`. Never `pkill -f vitest` (matches globally across worktrees).
- Every merge uses `git -C <path>` - working in the wrong worktree has happened six times.
- Do not modify `mem-cash` sources.
- Never run the full suite under `yarn test:regtest`.
- No em-dashes or non-ASCII in generated code. Keep comments tight.

## 9. Where prior work is parked, and how to re-run the measurements

**Nothing is lost to a revert.** Every worker branch is kept (139 of them, `worker-<id>-<round>`), and
merged worktrees are removed but their branches retain the commits.

- **Historical X201 origin:** `worker-v1-i16` at `dd0d751b` contains the original complete, VM-proved
  compiler change plus `Layer3BareForwardingBodyX201.test.ts`. It was once reverted while X229 was unresolved.
  Current HEAD includes X201 with the X229 uniformity repair, so this commit is provenance, not pickup work.
- V1-V4 of the last round are `worker-v{1,2,3,4}-i16`; earlier rounds follow the same pattern.

**The three measurements worth re-running, with commands.** All from
`/Code/cashscript/.worktrees/layer3-binding-spike/packages/solidcash`.

```bash
# 1. The capstones - the fastest real signal. Expect 52 passed / 6 skipped.
npx vitest run test/e2e/Layer3DefiCapstoneC1.test.ts \
  test/e2e/Layer3HeterogeneousCycleC2.test.ts test/e2e/Layer3BoundedMaximumGraphC3.test.ts

# 2. The full bus-mode sweep - MANDATORY before any route-admission change lands.
#    115 files discovered; expect 1,321 passed / 11 skipped on the recorded
#    final HEAD. It is the only thing that has reliably caught the X229 class.
npx vitest run $(ls test/e2e/*.test.ts | xargs grep -l experimentalHiddenBatch) \
  --maxWorkers=2 --reporter=dot

# 3. The settlement count. The probe is inert unless L3_X204_OUT is set, and it is a pure
#    observer: every patched method forwards to the original. Attribution is by CONTAINMENT of the
#    batch blob in the settled raw transaction - never adjacency, which manufactures settlements.
mkdir -p /tmp/x235
L3_X204_OUT=/tmp/x235/records npx vitest run --config vitest.x204.config.ts \
  $(cat test/e2e/layer3-x235-union-manifest.txt) \
  --maxWorkers=2 --reporter=dot
npx tsx test/e2e/layer3-x235-settlement-consumer.ts /tmp/x235/records.*
# The committed consumer refuses empty observations and self-checks
# 135 recorded / 126 admitted / 213 gained / 15 lost / 64 moved.
# Latest verified union: 1,564 records / 806 settlements / 167 routes / 157 collisions;
# 213 eligible = 145 proved + 68 unproved.
```

## 10. What I would do first

1. Independently re-review **SEC-18 and the L2-F family** before upgrading their status. Their known
   exploits are repaired on HEAD, but the ledger distinguishes integration from independent proof.
2. Then **X214**, the bare `rejects.toThrow()` population, because it is the largest unmeasured
   surface and prior rounds show a real hit rate there.

Before ANY route-admission change lands, budget for the full bus-mode sweep:
`ls test/e2e/*.test.ts | xargs grep -l experimentalHiddenBatch` discovers 115 files on current HEAD.
The final recorded sweep is green at 115 files / 1,321 passed / 11 skipped. Re-run it at
`--maxWorkers=2` after any route-admission change; it is the only measurement that has reliably caught
this class.

Do not start by adding capability. The bus admits more than it has been proven to bind, and the
current verified ratio is 145 proved / 213 eligible, with 68 unproved; re-run the consumer after any
admission or settlement change rather than carrying this ratio forward.
