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

### Tier 1: security, currently REOPENED
- **SEC-18** - a route-reachable pure reader read the pre-transaction value. Review FAILED; reopened.
- **L2-F3** - SEC-18 misses a reader reached through a function pointer (`GenerateTargetTraversal.ts:1685/1689`).
- **L2-F1a** - X111's gate bypassed at consensus by two constructors.
- **L2-F1b/F1c/F2** - the same family: a spelling the gate is blind to, a short-circuit, and a
  widening that crashes an honest resource-shaped route.

These are the only rows where a defect is believed live. Everything else is hygiene or capability.

### Tier 2: named gaps with a known shape
- **X210** - the ORDINARY stateful submit path has no covenant reader at all; the only gate there is
  byte-only. The recursive VM preflight is opt-in and default-off.
- **X186** - absorption window at `TransactionBuilder.send`; a hunk is ready and unapplied.
- **X214** - **450 bare `rejects.toThrow()` sites with no named reason.** This is the highest-yield
  remaining vacuity surface: 1.6x the population that just came back clean, and the exact shape
  earlier rounds repeatedly found vacuity in.
- **X170** - the basis correction's outlined-body refusal fires on a real contract.
- **X207** - `logicalValueMode` reachability: can route uniformity actually demote a payable handler?
  **This is now known to be YES in general** (see X229), so the row is narrower than it looks.
- **X227** - a possible FOURTH msg.value population (`contractUsesMsgValue` vs `routeUsesMsgValue`).
- **X201 + X229** - admitting the bare-body forwarding call. It was implemented, VM-proved on its own
  terms, and **REVERTED**, because admitting a handler changes the route's UNIFORMITY CLASS and
  `applyRouteUniformity` then demotes a different, unrelated handler (`ERC20Bank.token`). Whoever
  retakes this must handle the uniformity interaction first. Do not re-land it without the full
  108-file bus-mode sweep.

### Tier 3: re-pins and residuals
- **X159 is probably STALE** - it says `StableSwap` no longer compiles in any mode, but X204 compiled
  it at 7,968 B and settled three of its handlers. Re-pin before trusting either.
- **X226** - multi-statement bodies ending in a call are admitted by construction but VM-proved only
  on a single-statement body.
- **X213** - 10 `resolves.not.toThrow()` sites whose `not.toThrow()` clause is DEAD (measured);
  `.resolves` carries the whole claim. Marked in-file, not repaired.
- **X217** - two throw-census tools now exist (`test/e2e/layer3-throw-census.ts` and V3's). Reconcile
  rather than write a third.
- **X221** - 435 settled transactions carry no route blob and are excluded from the count by
  construction. Named assumption, not a measurement.

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
5. **Validate your own instrument before trusting it.** One census tool silently changed assertion
   text; one mutation harness reported GREEN when ZERO TESTS RAN (vitest `-t` is a REGEX, and a title
   containing `m[k]++` matched nothing). Make any harness refuse to call an empty run a result.
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
  restored, prove the refusal MOVED (e.g. admission -> covenant) rather than disappeared. X201 is the
  worked example: `attack` is admitted again, and the VM refuses it at input index 0.
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
- `TaskStop` on a backgrounded task kills the wrapper but NOT the node child. Orphans have exhausted
  swap. Kill by PID; `readlink /proc/<pid>/fd/2` identifies which is live.
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

## 9. What I would do first

1. Re-pin **X159** (probably stale) so the board stops carrying a false HIGH.
2. Take **SEC-18 and the L2-F family** - the only rows where a defect is believed live, and the review
   already failed once.
3. Then **X214**, the 450 unexamined `rejects.toThrow()` sites, because it is the largest unmeasured
   surface and prior rounds show a real hit rate there.

Before ANY route-admission change lands, budget for the full bus-mode sweep:
`ls test/e2e/*.test.ts | xargs grep -l experimentalHiddenBatch` is 108 files, ~9 minutes at
`--maxWorkers=2`. It is the only measurement that has reliably caught this class.

Do not start by adding capability. The bus admits more than it has been proven to bind, and the
ratio - 82 of 206 - is the honest summary of where this stands.
