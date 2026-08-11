# SolidCash 0.13.1 release-readiness handoff

## Checkout and branch state

Continue in this dedicated worktree:

```text
/Code/cashscript/.worktrees/release-readiness
```

The requested release baseline is:

```text
c78c135b7
```

The ordinary `solidcash_v0.13.1` checkout is `/Code/cashscript`. Both branches were synchronized when this
handoff was prepared. Keep release-readiness work in the dedicated worktree until it is verified, then merge or
fast-forward it back deliberately.

## Valid evidence at the integrated head

The following gates passed on the fully merged tree before the final NativeUSDT test-only refactor:

```bash
yarn lint
yarn build
```

`yarn lint` covered all seven package workspaces and the root testing suite. `yarn build` covered the TypeScript
project-reference build and regenerated/compiled all three testing-suite fixtures. The deterministic generated
artifact updates are committed.

Integration commits, oldest first:

```text
74c1c2683  Merge branch 'solidcash_v0.13.1' into codex/release-readiness-final
3f70bb8f5  chore(testing): regenerate artifacts after branch integration
9287cd3c8  Merge the concurrently advanced solidcash_v0.13.1 tip
4d2da0ebe  chore(testing): refresh artifacts after final integration
bec314aed  fix(integration): restore release lint gates
```

The post-rebase readiness series was preserved as
`codex/release-readiness-pre-c78-snapshot-20260811`, rebuilt from `c78c135b7`, and then applied as ordinary
commits on `codex/release-readiness-final`. The current series begins at `324cbca5f`; inspect `git log
c78c135b7..HEAD` for the complete, authoritative list rather than relying on the older integration excerpt
above.

## BCHN matrix: current focused evidence and remaining final gate

At `324cbca5f`, the three consensus-impossible MistSwap constructor probes were explicitly classified as
mock-only while their useful mock coverage was retained. Focused mock execution passed all 4 tests. With
`TESTS_USE_REGTEST=true`, the consensus-compatible `CreatePairDeployVMap` layout row passed and the three
oversized executable rows were reported as skipped (1 passed, 3 skipped).

Old batch 38 was rerun from a wiped `release-readiness` BCHN/Fulcrum chain at the same candidate. All eight files
and all 46 tests passed in 49.23 seconds. The old failure was therefore accumulated-chain contamination, not a
reproducible defect at the rebased candidate.

At `370b535e2`, a new 482-file diagnostic sweep reached the durable boundary at 352/482 files (44/61 batches).
It was intentionally stopped during batch 45 after the shared chain made ordinary settlements take 45-55
seconds each. Nine failed batches were then isolated on a fresh chain. Every recorded failure now has a concrete
disposition:

- `BchNativeInheritance` and `BchNativeQuarantineInheritance` use intentionally unsplit 10,744-byte and
  11,866-byte fixtures. Their structural rows remain live and their behavioral rows are explicitly mock-only.
- `OzBchNativeInheritance` and `MinimalNativeToken` now seed fungible bearer supply in the category genesis
  transaction. Their complete live wrap/transfer/allowance/withdraw paths pass.
- Four multi-call return-order rows compile a 12,157-byte consumer; the live-compatible single-call rows remain
  live and the oversized rows are explicitly mock-only.
- `DelegateMappingProbe` requires circular prechosen categories via mock-only `categoryOverride`; its metadata
  assertion remains live.
- `DeployThenCallFold` now asserts that the returned child category matches the funding input actually selected
  by the connected signer, rather than assuming insertion order overrides largest-first coin selection.
- The hand-linked NativeUSDT proxy/facet probes explicitly retain their documented mock-only chosen-category
  classification. Their 29 mock rows pass; six structural live rows pass and 23 transactional rows skip.
- `compileStringSplit` once again budgets constructor and widest-call pushes during facet packing and final facet
  validation. The 29-test compiler splitting suite passes. From a wiped chain, the NativeUSDT bundle's constructed
  shards deployed successfully and state initialization passed, proving the former 10,030-byte constructed-facet
  refusal is fixed. BCHN consistently closes its RPC transport while validating the maximum-shape route spends,
  even on fresh chains; those route assertions are therefore explicit mock-only coverage. Smaller split-route
  BCHN regressions retain live routing coverage.
- `Sec13UnpinnedEventNftPaths` remains an accumulated-chain-only failure: the encompassing old batch 38 region
  passes 46/46 from a wiped chain.

Focused evidence after the fixes includes:

```text
BCH native inheritance: mock 9/9; fresh BCHN 4 passed, 5 intentional skips
CrossContractCallInfra: mock 8/8; BCHN 4 passed, 4 intentional skips
DelegateMappingProbe: mock 5/5; BCHN 1 passed, 4 intentional skips
DeployThenCallFold: mock 13/13; BCHN 13/13
MinimalNativeToken: mock 2/2; BCHN 2/2
NativeUSDT hand-linked rows: mock 29/29; BCHN 6 passed, 23 intentional skips
solidc LargeContractSplitting: 29/29
NativeUSDT built-in splitter: fresh BCHN deployment 1/1; maximum-shape routes explicit mock-only
```

`yarn build` and `yarn lint` both pass after these changes. Generated testing-suite content was unchanged; only
regeneration timestamps moved, so they were restored rather than committed.

The authoritative full matrix at the final candidate is still outstanding.

## Older BCHN diagnostics (not final evidence)

A pristine BCHN matrix was run at the older candidate `edbf5c2c8`. It reached 416/467 files (batches 1-52)
before being intentionally interrupted during batch 53 to perform the branch integration. The durable ledger is:

```text
packages/solidcash/.regtest-progress.json
```

Its fingerprint belongs to `edbf5c2c8`, not the current integrated head. The runner will ignore it when the
fingerprint differs, but do not cite or manually resume it as proof for `bec314aed` or later.

The old run recorded failed batches 17, 31, and 38:

- Batch 17: the live `CreatePairDeployC2` row (now named `CreatePairDeployVMap`) attempted a constructor probe
  stack item of about 16.9 KB, exceeding BCHN's 520-byte stack-item limit. This is now classified as mock-only;
  the layout-only row remains live.
- Batch 31: `MasterChefDeposit` and `MasterChefPoolInfoPush` attempted about 16.6 KB constructor probe items,
  again exceeding BCHN's 520-byte stack-item limit. These vendored MistSwap diagnostics are now classified as
  mock-only.
- Batch 38: the terminal output was truncated. Its clean-chain reproduction now passes all 46 tests, confirming
  that the old report was caused by accumulated chain state.

Batch 53 was running `AtomicMessageBusCompose` when interrupted. Its first six tests passed, while later cases
hit their 120-240 second limits on the accumulated chain. Because the run was interrupted, those timeout reports
are neither a completed batch result nor final-head evidence. The capacity/ByteLex fixes had already passed
focused fresh-chain BCHN runs before the full sweep.

Several important old-candidate checkpoints did pass in full-suite order: BlockOracle sweep/deduplication,
DeployThenCallFold, FunctionPointerArrayCall, NestedArrayDelete, Solidity corpus behavior, stateful SDK,
split/merge, upgrades, sorted mappings, and batches 39-52. These are diagnostic confidence only after the large
`solidcash_v0.13.1` integration; rerun the relevant gates at the current head.

Additional release gates already passed sequentially on this candidate lineage:

```text
corpus baseline: 2,698/2,805 positive; 323/2,158 over-accepted
security conformance: passed
documentation snippets: 128 compiled, 6 import-only skips, 0 failed; 33/33 SDK imports resolve
spellcheck: 0 issues
package smoke: all six packed packages; golden consumer 3/3
application conformance: 95/95
generated-project smoke: SolidHat 1/1; cache 1/1; golden path 21/21
application regtest: fresh chain 9/9
```

The first application/generated attempts overlapped package-smoke rebuilding package outputs and were invalid;
the sequential reruns above are the results to cite.

## Immediate continuation sequence

1. Confirm the worktree is clean and record the candidate commit:

   ```bash
   git status --short --branch
   git rev-parse HEAD
   ```

2. If the NativeUSDT test or compiler changes again, rerun both halves. Split compilation takes about six minutes
   per invocation on this machine; do not confuse the long silent compile with a hang:

   ```bash
   TESTS_USE_REGTEST=true yarn --cwd packages/solidcash vitest run --no-file-parallelism \
     test/e2e/NativeUsdtInherited.test.ts -t 'deploys a bundle whose constructed shards fit'
   yarn --cwd packages/solidcash vitest run --no-file-parallelism \
     test/e2e/NativeUsdtInherited.test.ts -t 'spends every generated NativeUSDT route'
   ```

3. Run the relevant one-shot mock/live suites, then `yarn lint` and `yarn build`.

4. Start the authoritative full matrix from a wiped chain at the final candidate:

   ```bash
   docker compose -p release-readiness -f docker-compose.regtest.yml down -v
   docker compose -p release-readiness -f docker-compose.regtest.yml up -d
   REGTEST_CONTINUE_ON_FAILURE=true yarn test:regtest
   ```

   Use `REGTEST_CONTINUE_ON_FAILURE=true` for the diagnostic sweep. After every deterministic failure is fixed or
   explicitly classified, wipe the chain again and run `yarn test:regtest` without continue-on-failure for final
   release evidence.

5. Update the BCHN row in `RELEASE_READINESS.md` with the exact final commit, file/test totals, chain-reset
   procedure, and any documented skips. The current table still describes superseded candidates and must not be
   used as the final attestation.

6. Run the still-outstanding broader gates, especially the root `yarn test`, the comprehensive e2e suite, and a
   clean-checkout install/CI-ordering rehearsal. The conformance, corpus, documentation, package-smoke,
   generated-project, spellcheck, and application-regtest results already recorded above need rerunning only if
   subsequent changes can affect them.

## Completion standard

Do not tag 0.13.1 merely because the branch merge, build, or lint is green. Completion requires a clean final
candidate, an authoritative fresh-chain BCHN matrix at that exact commit, the broader release gates, updated
release notes/readiness evidence, and an explicit audit of every unchecked first-release exit item.
