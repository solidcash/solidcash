# Performance: kernel vs per-call (W2)

Measured 2026-10-05. One lane is in this file: per-call, proxied, at `12c011dfe`. The no-proxy lane and the kernel proxied lane are not in this run.

## How this lane was run

Worktree `/Code/cashscript/.worktrees/per-call`. `solidcash.config.ts` sets `composition: 'per-call'` and points tests at the proxied contract suite. Limits in that config: `operationCostBudgetPerByte` 1,000,000, `maximumInputBytes` 10,000,000, `maximumTransactionBytes` 100,000,000. Those are the relaxed mock limits. The harness matcher is the one in `packages/testing/src/chai.ts` at this commit: a per-call failure must carry the contract's own reason (`TRIAGE_SECURITY.md`). `MARKETPLACE_FIXTURE_STALE_OK` was unset.

Fixture recompile before the titles: `node --max-old-space-size=8192 packages/solidhat/dist/cli.js compile`, 62 seconds. `MarketplaceV1.json` mtime 2026-10-05 10:23:00 UTC, after `packages/solidc/dist/compiler.js` (08:26 UTC).

Titles, one worker, heap 6144 MB:

| title | result | wall |
|---|---|---:|
| take job | passed | 62.208 s |
| approve result | passed | 131.787 s |

Vitest duration for the file was 199.67 s (tests 194.00 s). Exit 0. Two passed, 64 skipped.

## Transactions

`SOLIDCASH_TX_TRACE=1` prints one line per broadcast from `TransactionBuilder.send` and from the per-call call submit. Fee is input satoshis minus output satoshis. The composed calls use fee rate 1, so their fee equals their byte length.

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
| derivation (names containing derive, per-call, composer, frame) | 6033 | 6.2% |
| compile | 95 | 0.1% |
| other, of which garbage collection is 6942 samples (7.2%) | 12447 | 12.8% |

Compile is absent because the fixture was already compiled. The VM in the profile is stock `node_modules/@bitauth/libauth` (`3.1.0-next.8`) with the SDK overrides (`createVirtualMachine.js` `runPhases` is in the top self-time). `structuredClone` is also in the top self-time. That is the function-table copy the fork removes (`PERF_LIBAUTH.md`); this lane did not load the fork.

## The post-merge speed note

The plan records post-merge per-call titles about 1.5 to 2 times faster than the pre-merge ladder, with close job before timeout at 27 s versus 49 s. This run did not re-time that title, and it has no pre-merge pair, so it does not identify that gap.

What is already measured, from the commit that landed before this plan: not re-running an evaluation that stopped on a failing close (`d8166489d`) took the slowest no-proxy title from 1,415 s to 1,286 s, about 9 percent, not 1.5 times. The worker above is 81 percent VM on stock libauth. A libauth change would land in that 81 percent. The 27 s versus 49 s gap is still unexplained by either number. Kernel versus per-call on the same title, same limits, and same matcher is the run that can separate kernel VM work from box load. That run is not this one.

## Still to run

- No-proxy per-call: approve sanity and refund sanity, same limits and the same matcher.
- Kernel proxied harness built from `.worktrees/kernel-beta-candidate`'s config at its HEAD, same two titles, with the matcher difference stated if that tree's `revertedWith` is the older lenient one.
