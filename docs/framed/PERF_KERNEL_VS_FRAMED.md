# Performance: kernel vs framed (W2)

> **Measurement snapshot, 2026-10-05.** These numbers describe the cited worktrees, not the current master. Current
> lane cost is in [`NOPROXY_LANE_COST.md`](./NOPROXY_LANE_COST.md); current release gates and sizes are in
> [`../marketplace/bchn-marketplace-consensus-relaxation.md`](../marketplace/bchn-marketplace-consensus-relaxation.md)
> and [`../release/0.14.0/RELEASE_DECISION_0.14.0.md`](../release/0.14.0/RELEASE_DECISION_0.14.0.md).

Measured 2026-10-05. Three lanes: framed proxied at `12c011dfe`, framed no-proxy at `d326e325b` (measurement worktree, sources retargeted at the no-proxy contracts), and the kernel lane at `d7f3c7ad6`.

## How this lane was run

Worktree `/Code/cashscript/.worktrees/framed`. `solidcash.config.ts` sets `composition: 'framed'` and points tests at the proxied contract suite. Limits in that config: `operationCostBudgetPerByte` 1,000,000, `maximumInputBytes` 10,000,000, `maximumTransactionBytes` 100,000,000. Those are the relaxed mock limits. The harness matcher is the one in `packages/testing/src/chai.ts` at this commit: a framed failure must carry the contract's own reason (`TRIAGE_SECURITY.md`). `MARKETPLACE_FIXTURE_STALE_OK` was unset.

Fixture recompile before the titles: `node --max-old-space-size=8192 packages/solidhat/dist/cli.js compile`, 62 seconds. `MarketplaceV1.json` mtime 2026-10-05 10:23:00 UTC, after `packages/solidc/dist/compiler.js` (08:26 UTC).

Titles, one worker, heap 6144 MB:

| title | result | wall |
|---|---|---:|
| take job | passed | 62.208 s |
| approve result | passed | 131.787 s |

Vitest duration for the file was 199.67 s (tests 194.00 s). Exit 0. Two passed, 64 skipped.

## Transactions

`SOLIDCASH_TX_TRACE=1` prints one line per broadcast from `TransactionBuilder.send` and from the framed call submit. Fee is input satoshis minus output satoshis. The composed calls use fee rate 1, so their fee equals their byte length.

take job, 21 broadcasts, 184,575 bytes, fee 200,095 satoshis. Four of them are the composed calls:

| bytes | inputs | outputs | fee | largest unlocking script |
|---:|---:|---:|---:|---:|
| 40451 | 6 | 8 | 40451 | 24937 |
| 40463 | 6 | 8 | 40463 | 24887 |
| 40451 | 6 | 8 | 40451 | 24937 |
| 40463 | 6 | 8 | 40463 | 24887 |

The other 17 broadcasts are single-input deployments and funding transactions (185 to 3,037 bytes, one input, 21 to 27 outputs on the contract deploys). The largest unlocking script on a composed call is 24,937 bytes, above the 10,000-byte standard input limit. This lane only passes because the mock limit is 10,000,000.

approve result passed in 131.787 s and its vitest log has no broadcast-trace lines (stdout is the fallback warning only). Its transaction counts are not in this run. The worker CPU profile below covers both titles.

## CPU split

One profile for the worker (`--cpu-prof`), 97,050 samples:

| bucket | samples | share |
|---|---:|---:|
| VM (`libauth` virtual machine, instruction set, `runPhases`) | 78475 | 80.9% |
| derivation (names containing derive, framed, composer, frame) | 6033 | 6.2% |
| compile | 95 | 0.1% |
| other, of which garbage collection is 6942 samples (7.2%) | 12447 | 12.8% |

Compile is absent because the fixture was already compiled. The VM in the profile is stock `node_modules/@bitauth/libauth` (`3.1.0-next.8`) with the SDK overrides (`createVirtualMachine.js` `runPhases` is in the top self-time). `structuredClone` is also in the top self-time. That is the function-table copy the fork removes (`archive/docs:docs/framed/PERF_LIBAUTH.md`); this lane did not load the fork.

## Kernel proxied lane

Worktree `.worktrees/kernel-beta-candidate` at `d7f3c7ad6`. Its `solidcash.config.ts` does not set `composition`, so the compile is the direct kernel convention. The mock limits match the framed config: `operationCostBudgetPerByte` 1,000,000, `maximumInputBytes` 10,000,000, `maximumTransactionBytes` 100,000,000. `MARKETPLACE_FIXTURE_STALE_OK` was unset. Fixture compile: 61 seconds, 22 sources, 26 artifacts, 0 cache hits. `MarketplaceV1.json` mtime 2026-10-05 10:29:32 UTC.

The kernel worker heap is the config default, 8192 MB. The framed run above set `SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144`. Same titles, same limit numbers, different heap ceiling.

`packages/testing/src/chai.ts` on this kernel commit requires a relaxed-network revert's message to contain the expected reason, and it rethrows a construction failure. It has no framed frame-reason branch. These two titles are success paths, so that matcher did not decide them. It is not the older matcher that ignored reasons.

CPU profile was not enabled, and this tree has no `SOLIDCASH_TX_TRACE`, so this lane has no CPU split and no transaction byte, fee, or input counts. The log's only runtime note is a `preflight-return-idx` line during take job (`inputIndex` 1352, `OP_VERIFY`), and the title still passed.

| title | result | wall |
|---|---|---:|
| take job | passed | 126.242 s |
| approve result | passed | 111.212 s |

Vitest file duration 242.03 s (tests 237.46 s). Exit 0. Two passed, 64 skipped.

| title | framed wall | kernel wall |
|---|---:|---:|
| take job | 62.208 s | 126.242 s |
| approve result | 131.787 s | 111.212 s |
| fixture compile | 62 s | 61 s |

take job is about twice as fast on framed. approve result is slower on framed (132 s against 111 s). The lanes are not uniformly ordered.

## The post-merge speed note

The plan records post-merge framed titles about 1.5 to 2 times faster than the pre-merge ladder, with close job before timeout at 27 s versus 49 s. This pair did not re-time that title. On the two titles that were timed, only take job matches a 2x gap, and it is framed against the kernel lane at the same limits, not framed against its own pre-merge ladder. approve result goes the other way.

Not re-running an evaluation that stopped on a failing close (`d8166489d`) took the slowest no-proxy title from 1,415 s to 1,286 s, about 9 percent. The framed worker profile is 81 percent VM on stock libauth. Neither number accounts for a 27 s versus 49 s close-job gap. That title is still untimed in this pair.

## No-proxy framed lane

Worktree `.worktrees/framed-noproxy-measure`, detached at `d326e325b`, `composition: 'framed'`. Contract and test paths point at `/Code/effectiveacceleration.ai/contract-noproxy`. Same relaxed mock limits as the proxied config. `MARKETPLACE_FIXTURE_STALE_OK` was unset. Worker heap 6144 MB, one worker. `SOLIDCASH_TX_TRACE=1`.

Fixture compile: 97 seconds, 22 sources, 26 artifacts, 0 cache hits. `MarketplaceV1.json` mtime 2026-10-05 10:37:32 UTC. The harness test file is a symlink to the no-proxy `marketplace.test.ts`. The first vitest launch exited before that symlink existed. The numbers below are the retry, against the fixture from that compile.

| title | result | wall |
|---|---|---:|
| approve result and review / sanity checks | passed | 1044.307 s (17.4 min) |
| refund / sanity checks | passed | 718.767 s (12.0 min) |

Vitest file duration 1768.73 s (tests 1763.08 s). Exit 0. Two passed, 63 skipped. Both titles finished inside the original 20-minute budget. The harness timeout in `vitest.marketplace.config.ts` is still 40 minutes.

Fee on a composed call equals its byte length (fee rate 1). The largest unlocking script is 135,908 bytes, above the 10,000-byte standard input limit.

approve sanity, 33 broadcasts, 7,708,325 bytes, fee 7,720,215 satoshis. Twenty are multi-input. The largest is 1,314,520 bytes, 45 inputs, 71 outputs, fee 1,314,520, largest unlocking script 133,320 bytes.

refund sanity, 10 broadcasts, all multi-input, 5,058,396 bytes, fee 5,058,396 satoshis. The largest is 989,220 bytes, 40 inputs, 61 outputs, fee 989,220, largest unlocking script 130,101 bytes.

One CPU profile for the worker, 847,724 samples:

| bucket | samples | share |
|---|---:|---:|
| VM (stock `libauth` plus `runPhases`) | 758756 | 89.5% |
| derivation | 20649 | 2.4% |
| compile | 98 | 0.0% |
| other, of which garbage collection is 51474 samples (6.1%) | 68221 | 8.0% |

The profile resolves `@bitauth/libauth` from `node_modules`, so this is stock libauth with the SDK overrides. `stateStepMutate` and `collect` in `createVirtualMachine.js` are the top self-time after the garbage collector.

## Still to run

- Kernel transaction bytes, fee, and input counts, and a kernel CPU profile. That run did not collect them.
- The four-cell libauth matrix on these titles. Every marketplace number above is stock libauth with the SDK overrides on.
