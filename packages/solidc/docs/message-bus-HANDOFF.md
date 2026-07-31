# Layer-3 message bus: handoff

Written for an incoming reviewer/implementer picking this up cold. Read this file, then
`message-bus-completion-ledger.md` (the authority for what is claimed), then
`message-bus-parallel-work-plan.md` (the board: ~591 rows, sections 4.x carry the narrative).

## 1. Where the work is

- Branch `codex/layer3-binding-spike`, worktree `/Code/cashscript/.worktrees/layer3-binding-spike`.
- Baseline branch is `solidcash_v0.13.1`. This work has NOT been merged to it.
- `solidc` 2,731/2,731 across 83 files. Capstones C1/C2/C3: 52 passed / 6 skipped.
- The SDK unit suite has 2 known-failing tests in `test/conformance/arithmetic.conformance.test.ts`
  (POW op-cost density). Proven pre-existing by re-running against a clean tree. Do not chase them.

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
| 206 recovered handlers | SOLID. Re-taken with one shared probe binary across two worktrees, both directions checked (206 gained, 0 lost). |
| **82 of 206 VM-proved, and the union is LARGER** | Two independent machine re-takes both land on 82, each with a parser self-checked against X160's own published 135 rows / 206 gained. **But they are not the same 82**: the second run includes `EnglishAuction.highestBid/endAt/started`, which did not settle at all when the first was taken, so the second set must be missing ~3 the first covered. The two file sets differ (24 files + indirect helpers vs 25 by corpus-root grep). **Do not publish a single number until one run covers the UNION of both file sets.** It was 35 before the last round, and I reported it as 12 - wrong by ~3x. |
| 11 gained writers | Exhausted: 4 proved, 1 fail-closed (`Target.protected`), 2 INADMISSIBLE since X187 (`Attack.attack`, `Foo.callBar` - X201 would have re-admitted them but was reverted), 4 publish `writesState` ABSENT and mutate nothing. |
| "no chunk-backed writer exists" | SOLID, measured both directions. Writer rows and dynamic-variable rows are DISJOINT sets. Do not hunt a subject for this shape. |
| "co-spent-callee graphs have no subject in the 206" | SOLID. Exactly 2 of 206 publish an outgoing external call; the other 81 measured directly at 0. A boundary of the POPULATION, not the machinery. |

`writesState: true` means **"needs the state machinery"**, NOT "changes a state variable". At least 2
of the explicit writers write nothing. Always read the body.

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
- **X214** - **400 bare `rejects.toThrow()` sites with no named reason.** This is the highest-yield
  remaining vacuity surface. The AST census began at 436 executable sites; six unit guards and ten
  Layer-3 emission/effect guards are repaired with mutation-validated reasons.
- **X170 is CLOSED on HEAD** - the blanket outlined-body refusal was over-broad. The compiler now
  compares the body's emitted chunk basis with every entry point that can reach it: agreeing bases
  compile and disagreeing bases fail closed with both layouts named. `PointerTableBound.test.ts`
  pins the one-token boundary; `Layer3RuntimeSizedPointerTable.test.ts` settles 1, 2, and 3 rows.
- **X207 is CLOSED** - the demotion is reachable, and X199 already computes `logicalValueMode` over
  final eligible handlers, so a demoted payable handler cannot widen the surviving route.
- **X227 is CLOSED NEGATIVE** - the fourth population is reachable through an uncalled private
  `msg.value` reader, but it controls balanced frame plumbing rather than SCB1 row width. Both sides use
  the same predicate, and the existing EnglishAuction narrow settlements are the runtime control.
- **X201 + X229** - admitting the bare-body forwarding call. It was implemented, VM-proved on its own
  terms, and **REVERTED**, because admitting a handler changes the route's UNIFORMITY CLASS and
  `applyRouteUniformity` then demotes a different, unrelated handler (`ERC20Bank.token`). Whoever
  retakes this must handle the uniformity interaction first. Do not re-land it without the full
  108-file bus-mode sweep.

### Tier 3: re-pins and residuals
- **X159 is CLOSED on HEAD** - `StableSwap` compiles in bus mode with four eligible handlers, and the
  three gained handlers (`tokens`, `balances`, `totalSupply`) settle. The focused compile pin and VM
  proof are `Layer3RecoveredPartitionX160.test.ts` and `Layer3RecoveredCollectionBreadthV2.test.ts`.
- **X226 is DORMANT with X201 reverted** - the multi-statement write-then-call subject is currently
  refused as `batched-handler-forward-call-not-enabled`. Its missing VM proof matters only if X201 is
  retaken, and must then accompany the X229 uniformity repair and full bus sweep.
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
   (here, X160's own 135 rows / 206 gained) and fail loudly if it does not. Make any harness refuse to
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
    files and found 9; the full 108-file sweep found 12 across 6 files, and the 12th is the one that
    decided the row. **The handler a widening breaks need not appear in any file that mentions the
    changed feature** - here it was demoted by a uniformity pass, not by the widened predicate.
11. **When judging a capability change, price it in PROVEN handlers, not in features.** X201 gained
    two handlers that cannot settle and lost one that settles with a txid and two hostiles refused at
    a named input. That is what made it a bad trade, and it is not visible from the feature
    description.

## 6. Security invariants that must not be traded away

- The SDK is an **untrusted witness constructor**. Every accepted shape must be justified by covenants
  and BCH consensus, never by the SDK behaving well.
- Owner identity is the actual co-spent input locking bytecode plus category/capability, never
  witness-declared.
- **A fail-closed boundary must never become an unchecked witness path.** When a capability is
  restored, prove the refusal MOVED (e.g. admission -> covenant) rather than disappeared. The worked
  example is X201 while it was applied: `attack` became admissible again, and the VM refused it at
  input index 0 with the vector-exhausted signature - the refusal moved, it did not vanish. X201 was
  then reverted for an unrelated reason (X229), so on HEAD `attack` is refused at ADMISSION again.
  Re-derive this before relying on it; do not quote it from here.
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

- **X201's implementation is `worker-v1-i16` at `dd0d751b`** - a complete, VM-proved compiler change
  plus its test file `Layer3BareForwardingBodyX201.test.ts`. It was reverted on the integration branch
  for the uniformity interaction (X229), NOT because it was wrong on its own terms. Whoever retakes the
  row should start from that commit rather than reimplement it, and only needs to solve X229.
- V1-V4 of the last round are `worker-v{1,2,3,4}-i16`; earlier rounds follow the same pattern.

**The three measurements worth re-running, with commands.** All from
`/Code/cashscript/.worktrees/layer3-binding-spike/packages/solidcash`.

```bash
# 1. The capstones - the fastest real signal. Expect 52 passed / 6 skipped.
npx vitest run test/e2e/Layer3DefiCapstoneC1.test.ts \
  test/e2e/Layer3HeterogeneousCycleC2.test.ts test/e2e/Layer3BoundedMaximumGraphC3.test.ts

# 2. The full bus-mode sweep - MANDATORY before any route-admission change lands.
#    108 files, ~9 minutes. It is the only thing that has reliably caught the X229 class.
npx vitest run $(ls test/e2e/*.test.ts | xargs grep -l experimentalHiddenBatch) \
  --maxWorkers=2 --reporter=dot

# 3. The settlement count. The probe is inert unless L3_X204_OUT is set, and it is a pure
#    observer: every patched method forwards to the original. Attribution is by CONTAINMENT of the
#    batch blob in the settled raw transaction - never adjacency, which manufactures settlements.
L3_X204_OUT=/tmp/x204 npx vitest run --config vitest.x204.config.ts \
  $(ls test/e2e/*.test.ts | xargs grep -l "solidity-by-example\|SBE_ROOT\|mistswap\|eacc") \
  --maxWorkers=2 --reporter=dot
# then intersect the emitted JSONL with the gained set parsed out of
# Layer3RecoveredPartitionX160.test.ts - and make the parser reproduce 135 rows / 206 gained first.
```

## 10. What I would do first

1. Independently re-review **SEC-18 and the L2-F family** before upgrading their status. Their known
   exploits are repaired on HEAD, but the ledger distinguishes integration from independent proof.
2. Then **X214**, the bare `rejects.toThrow()` population, because it is the largest unmeasured
   surface and prior rounds show a real hit rate there.

Before ANY route-admission change lands, budget for the full bus-mode sweep:
`ls test/e2e/*.test.ts | xargs grep -l experimentalHiddenBatch` is 108 files, ~9 minutes at
`--maxWorkers=2`. It is the only measurement that has reliably caught this class.

Do not start by adding capability. The bus admits more than it has been proven to bind, and the
ratio - 82 of 206 - is the honest summary of where this stands.
