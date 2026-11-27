# sdk-tx-perf: intent and archived diff

Kind: archived workstream, 2026-11-13. The worktree `.worktrees/sdk-tx-perf` was deleted after this record; the branch
`perf/sdk-tx-perf` (`f185340a6`) is kept. The work ran 2026-10-22..23, plus a benchmark commit on 2026-11-05, and
nothing was left uncommitted.

## Intent

Make SDK transaction building and derivation faster, specified as one goal in seven commits on the branch, with every
transaction byte-identical to the base `fcbd58a09`. The spec's section 1, in short:

- **Derivation probes:** the sparse observer on every network, instead of libauth `debug()` (every state cloned) on
  live networks. One instrument closes the mocknet/live split, which had hidden live-only failures before.
- **Learning computed values:** one probe per dependency layer instead of one value per probe in six loops (stateful
  phase 2, phase-1 entries, the cleaned rescan, the final repair, deploy, the framed composer). Authenticated failed
  checks are suppressed and recorded; a run that suppresses nothing is the verdict.
- **Stateful send:** no eager whole-transaction `debug()` on every standard-limit send (about 240 ms per send in the
  measured file); the template debug only for contracts with `console.log` entries, and a per-input density check
  keeps the actionable refusal.
- **Framed composer,** the largest cost (`take job`: 61 s, 1,014 evaluations, 274 walks): batched walks, an exact
  read-field memo and a structural recipe, on every network.
- **Builder boundary:** bytes instead of hex round trips.

User decisions on record: no fallback switch, so the last commit removes both development oracles; no deferrals inside
the stream; docs only until the user asks for code (2026-10-22), with the commits already implemented kept.

## Where it stopped

- The spec was declared implementable at `489f18a44` (2026-10-23), after three reviews and several verification
  rounds (the framed confirmation rule F13 among them).
- Commit 1 of 7, the probe instruments, is implemented (`4ef7d7f31`, `06bf01380`): the sparse observer at every
  limit, a recorder that exits through libauth's own evaluator, branch skips on every observer hardened for the 2026
  instruction set, a parity sink, and the dead `BoundedProbeTraceCollector` copy deleted from `StatefulContract.ts`.
  Its tests: `test/unit/LiveLimitProbeVm.test.ts`, `test/e2e/LiveLimitProbeParity.test.ts` (on a live-like provider:
  no published limits, no simulator) and `test/e2e/FaithfulDerivationPathGate.test.ts`.
- Commits 2-7 were never started: 2 collector probe, 3 loops, 4 send path, 5 framed composer, 6 docs, 7 removal of
  the development oracles (`SOLIDC_FAITHFUL_DERIVATION`, `SOLIDC_DEBUG_FRAMED_LEGACY`).
- `test/e2e/SdkTxPerfProbe.test.ts` keeps the design's derivation benchmark (skipped unless `SDK_PERF=1`;
  `f185340a6`).

## A live-path fix that is not on master

The parity test found that runtime-loop transfers (`this.transfer` in a `for` loop) did not settle on a live provider
at standard limits: the final preflight failed an `OP_VERIFY`. It already failed at the base. A provider with
`maximumInputBytes` of 10,000 or less, which includes every live provider by default, gets a reduced trace. That trace
drops the state after `OP_OUTPUTBYTECODE` that the lock pairing read, so the SDK never learned the recipient's lock.
`fb9234001` reads that operand positionally (`pairObservedActual: false`). Master has neither the fix nor its test:
`packages/solidcash/src/stateful/trace-verified-value-helpers.ts:306` still pairs, and the runtime-loop read at
`sc-derive-full-phase2-apply-runtime-loop.ts:103` passes no flag. Not rerun on master. The branch's bug note is
`perf/sdk-tx-perf:docs/wip/live-runtime-loop-transfer/BUG.md` (also in the diff).

## The diff

`sdk-tx-perf.diff` is `git diff fcbd58a09 perf/sdk-tx-perf`: 24 files, +7,179/-386. Applied to `fcbd58a09` it rebuilds
the branch tree exactly (checked with `git apply --cached` on a scratch index). Most of it is the design and the spec:
`DESIGN.md`, `SPEC.md` and five component specs under `spec/`, 5,925 lines (read them with
`git show perf/sdk-tx-perf:docs/wip/sdk-tx-perf/SPEC.md`). The code is commit 1 and the fix:
`network/createVirtualMachine.ts`, `stateful/faithful-probe-trace.ts`, `StatefulContract.ts`, the deploy and
iteration probes, the test helpers `test/deterministic-random.ts` and `test/live-like-provider.ts`, the four tests
above, and a `docs/compiler-diagnostics.md` section on the probe switches.

## State against master (2026-11-13)

- No commit is on master (`git cherry`). Master is 753 commits past the base; a test merge (`git merge-tree`)
  conflicts only in `test/e2e/FaithfulDerivationPathGate.test.ts`.
- The spec cites `file:line` against `fcbd58a09`, and those lines have moved. Picking it up means rebasing the branch
  onto master, rechecking the citations and the byte-identity fixtures recorded at the base, then commit 2.
