# Ladder run times

Per-title wall time and the full run time, from the canonical harness command:

    yarn vitest run --config vitest.marketplace.config.ts --no-file-parallelism --reporter=verbose

One file, one worker, serial: every title pays its own fixture deployment on its first call, and `loadFixture`
reuses it within the file, so the FIRST title in the file carries the whole deployment. A failed title still
spends its attempt budget, which is why a wall can make a run minutes longer without changing its count.

## m1-run-1.log — 8/66 — 2026-09-29 06:01 — `d8ac2a413`

- 58 failed | 8 passed (66)
- full run: **367.57 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **354.6 s**, median **0.11 s**
- first title (the fixture's deployment): **263.4 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 263.35 s | ✓ | admin > transfer owner |
| 2 | 24.22 s | ✓ | admin > pause/unpause |
| 3 | 15.38 s | × | unicrow params > set unicrow contract addresses |
| 4 | 13.11 s | × | unicrow params > set unicrow markeplace address |
| 5 | 12.90 s | ✓ | admin > non pauser cannot unpause |
| 6 | 12.76 s | ✓ | admin > set version |
| 7 | 2.36 s | ✓ | mece tags > read mece tag |
| 8 | 1.29 s | ✓ | admin > non pauser cannot pause |
| 9 | 1.20 s | ✓ | admin > non owner cannot transfer owner |
| 10 | 1.10 s | ✓ | admin > non owner cannot set version |
| 11 | 0.77 s | × | register user > register user |
| 12 | 0.19 s | × | mece tags > update mece tag |
| 13 | 0.17 s | × | close job > close job before timeout |
| 14 | 0.14 s | × | dispute > sanity checks with arbitrator |
| 15 | 0.14 s | × | integration test > integration test |
| 16 | 0.13 s | × | arbitrate > arbitrate 100-0 |
| 17 | 0.13 s | × | take job > sanity checks |
| 18 | 0.13 s | × | refuse arbitration > job closed |
| 19 | 0.13 s | × | dispute > dispute worker |
| 20 | 0.13 s | × | refuse arbitration > job taken |
| 21 | 0.13 s | × | refuse arbitration > job not taken |
| 22 | 0.13 s | × | arbitrate > sanity checks |
| 23 | 0.12 s | × | dispute > sanity checks closed job |
| 24 | 0.12 s | × | dispute > dispute creator |
| 25 | 0.12 s | × | arbitrate > arbitrate 80-20 |
| 26 | 0.12 s | × | arbitrate > arbitrate 0-100 |
| 27 | 0.12 s | × | dispute > sanity checks no arbitrator |
| 28 | 0.12 s | × | close job > close job after timeout |
| 29 | 0.12 s | × | deliver result > sanity checks |
| 30 | 0.12 s | × | refund > sanity checks |
| 31 | 0.12 s | × | post thread message > sanity checks |
| 32 | 0.12 s | × | register arbitrator > register arbitrator |
| 33 | 0.11 s | × | register arbitrator > update arbitrator |
| 34 | 0.11 s | × | register user > update user |
| 35 | 0.11 s | × | job posting > post job 1 |
| 36 | 0.11 s | × | job updates > update job amounts |
| 37 | 0.11 s | × | job updates > update job arbitrator |
| 38 | 0.11 s | × | job updates > update job tags |
| 39 | 0.11 s | × | reopen job > reopen job after timeout |
| 40 | 0.11 s | × | job posting > post job with whitelist |
| 41 | 0.11 s | × | take job > take job multiple |
| 42 | 0.11 s | × | reopen job > reopen job before timeout |
| 43 | 0.10 s | × | job posting > post job with unregistered arbitrator |
| 44 | 0.10 s | × | refund > refund |
| 45 | 0.10 s | × | job posting > post two jobs |
| 46 | 0.10 s | × | job posting > post job with arbitrator same as creator |
| 47 | 0.10 s | × | job posting > post job with invalid amount |
| 48 | 0.10 s | × | deliver result > deliver result |
| 49 | 0.10 s | × | job updates > update job many times, get history |
| 50 | 0.10 s | × | withdraw collateral > withdraw collateral |
| 51 | 0.10 s | × | take job > take job |
| 52 | 0.10 s | × | job posting > post job with invalid token |
| 53 | 0.10 s | × | job posting > post job with invalid delivery method |
| 54 | 0.10 s | × | job posting > post job with invalid mece tags |
| 55 | 0.10 s | × | job worker whitelisting > should whitelist worker |
| 56 | 0.10 s | × | pay start job > pay start job |
| 57 | 0.10 s | × | post thread message > post thread message |
| 58 | 0.10 s | × | job posting > post job with invalid deadline |
| 59 | 0.10 s | × | job posting > post job with invalid title |
| 60 | 0.10 s | × | job updates > update job |
| 61 | 0.10 s | × | approve result and review > sanity checks |
| 62 | 0.10 s | × | approve result and review > approve result |
| 63 | 0.10 s | × | pay start job > sanity checks |
| 64 | 0.08 s | × | mece tags > remove mece tag |
| 65 | 0.05 s | × | job posting > post job from unregistered user |
| 66 | 0.02 s | × | admin > can not call initializer |

## m1-run-2.log — 12/66 — 2026-09-29 07:53 — `84955377b`

- 54 failed | 12 passed (66)
- full run: **1008.59 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **997.0 s**, median **13.48 s**
- first title (the fixture's deployment): **252.6 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 252.60 s | ✓ | admin > transfer owner |
| 2 | 21.99 s | ✓ | admin > pause/unpause |
| 3 | 15.08 s | × | job posting > post job with invalid mece tags |
| 4 | 14.93 s | × | deliver result > deliver result |
| 5 | 14.79 s | × | approve result and review > sanity checks |
| 6 | 14.65 s | × | job worker whitelisting > should whitelist worker |
| 7 | 14.65 s | × | job posting > post job with unregistered arbitrator |
| 8 | 14.57 s | × | approve result and review > approve result |
| 9 | 13.91 s | × | job updates > update job amounts |
| 10 | 13.91 s | × | refund > sanity checks |
| 11 | 13.89 s | × | job updates > update job tags |
| 12 | 13.82 s | × | job updates > update job arbitrator |
| 13 | 13.73 s | × | reopen job > reopen job after timeout |
| 14 | 13.73 s | × | job posting > post job 1 |
| 15 | 13.71 s | × | take job > sanity checks |
| 16 | 13.69 s | × | job posting > post job with invalid title |
| 17 | 13.68 s | × | job updates > update job many times, get history |
| 18 | 13.66 s | × | job posting > post job with invalid deadline |
| 19 | 13.62 s | × | reopen job > reopen job before timeout |
| 20 | 13.60 s | × | close job > close job after timeout |
| 21 | 13.59 s | × | take job > take job multiple |
| 22 | 13.59 s | × | close job > close job before timeout |
| 23 | 13.59 s | × | job updates > update job |
| 24 | 13.58 s | × | job posting > post job with whitelist |
| 25 | 13.55 s | × | dispute > sanity checks no arbitrator |
| 26 | 13.54 s | × | job posting > post job with invalid amount |
| 27 | 13.53 s | × | job posting > post job with invalid token |
| 28 | 13.53 s | × | withdraw collateral > withdraw collateral |
| 29 | 13.50 s | × | job posting > post job with invalid delivery method |
| 30 | 13.50 s | × | take job > take job |
| 31 | 13.49 s | × | pay start job > pay start job |
| 32 | 13.49 s | × | pay start job > sanity checks |
| 33 | 13.48 s | × | job posting > post job with arbitrator same as creator |
| 34 | 13.47 s | × | refund > refund |
| 35 | 13.32 s | × | job posting > post two jobs |
| 36 | 13.29 s | × | dispute > sanity checks closed job |
| 37 | 13.26 s | × | dispute > sanity checks with arbitrator |
| 38 | 13.21 s | ✓ | unicrow params > set unicrow contract addresses |
| 39 | 13.12 s | × | dispute > dispute worker |
| 40 | 13.11 s | × | dispute > dispute creator |
| 41 | 13.10 s | × | arbitrate > sanity checks |
| 42 | 13.09 s | × | arbitrate > arbitrate 0-100 |
| 43 | 13.07 s | × | arbitrate > arbitrate 80-20 |
| 44 | 13.03 s | × | deliver result > sanity checks |
| 45 | 12.96 s | × | refuse arbitration > job not taken |
| 46 | 12.96 s | × | arbitrate > arbitrate 100-0 |
| 47 | 12.95 s | × | integration test > integration test |
| 48 | 12.93 s | × | refuse arbitration > job closed |
| 49 | 12.90 s | × | refuse arbitration > job taken |
| 50 | 12.86 s | × | post thread message > post thread message |
| 51 | 12.83 s | × | post thread message > sanity checks |
| 52 | 11.43 s | ✓ | admin > non pauser cannot unpause |
| 53 | 11.05 s | ✓ | unicrow params > set unicrow markeplace address |
| 54 | 10.70 s | ✓ | admin > set version |
| 55 | 5.40 s | ✓ | mece tags > update mece tag |
| 56 | 4.74 s | × | register user > register user |
| 57 | 4.21 s | × | register arbitrator > register arbitrator |
| 58 | 4.17 s | ✓ | admin > can not call initializer |
| 59 | 2.16 s | ✓ | mece tags > read mece tag |
| 60 | 1.23 s | ✓ | admin > non pauser cannot pause |
| 61 | 1.10 s | ✓ | admin > non owner cannot transfer owner |
| 62 | 0.89 s | ✓ | admin > non owner cannot set version |
| 63 | 0.10 s | × | register user > update user |
| 64 | 0.10 s | × | register arbitrator > update arbitrator |
| 65 | 0.07 s | × | mece tags > remove mece tag |
| 66 | 0.06 s | × | job posting > post job from unregistered user |

## m1-run-4.log — 12/66 — 2026-09-29 09:58 — `e3eccbc7a`

- 54 failed | 12 passed (66)
- full run: **467.57 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **449.8 s**, median **0.13 s**
- first title (the fixture's deployment): **312.4 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 312.43 s | ✓ | admin > transfer owner |
| 2 | 30.79 s | ✓ | admin > pause/unpause |
| 3 | 20.33 s | ✓ | unicrow params > set unicrow contract addresses |
| 4 | 16.83 s | ✓ | unicrow params > set unicrow markeplace address |
| 5 | 15.55 s | ✓ | admin > non pauser cannot unpause |
| 6 | 14.75 s | ✓ | admin > set version |
| 7 | 10.43 s | × | mece tags > remove mece tag |
| 8 | 6.54 s | ✓ | admin > can not call initializer |
| 9 | 5.38 s | ✓ | mece tags > update mece tag |
| 10 | 2.14 s | ✓ | mece tags > read mece tag |
| 11 | 1.79 s | ✓ | admin > non pauser cannot pause |
| 12 | 1.60 s | ✓ | admin > non owner cannot transfer owner |
| 13 | 1.55 s | × | register user > update user |
| 14 | 1.47 s | × | register arbitrator > update arbitrator |
| 15 | 1.38 s | ✓ | admin > non owner cannot set version |
| 16 | 0.66 s | × | register user > register user |
| 17 | 0.17 s | × | job posting > post job 1 |
| 18 | 0.15 s | × | job posting > post job with whitelist |
| 19 | 0.15 s | × | job posting > post two jobs |
| 20 | 0.14 s | × | job posting > post job with invalid title |
| 21 | 0.14 s | × | job updates > update job |
| 22 | 0.14 s | × | arbitrate > arbitrate 100-0 |
| 23 | 0.14 s | × | integration test > integration test |
| 24 | 0.13 s | × | job posting > post job with invalid delivery method |
| 25 | 0.13 s | × | job posting > post job with invalid amount |
| 26 | 0.13 s | × | job posting > post job with invalid mece tags |
| 27 | 0.13 s | × | take job > sanity checks |
| 28 | 0.13 s | × | arbitrate > arbitrate 0-100 |
| 29 | 0.13 s | × | job posting > post job with invalid token |
| 30 | 0.13 s | × | job updates > update job tags |
| 31 | 0.13 s | × | arbitrate > arbitrate 80-20 |
| 32 | 0.13 s | × | post thread message > sanity checks |
| 33 | 0.13 s | × | refuse arbitration > job closed |
| 34 | 0.13 s | × | refuse arbitration > job taken |
| 35 | 0.12 s | × | close job > close job after timeout |
| 36 | 0.12 s | × | refund > sanity checks |
| 37 | 0.12 s | × | dispute > sanity checks no arbitrator |
| 38 | 0.12 s | × | dispute > sanity checks with arbitrator |
| 39 | 0.12 s | × | dispute > dispute creator |
| 40 | 0.12 s | × | dispute > dispute worker |
| 41 | 0.12 s | × | refuse arbitration > job not taken |
| 42 | 0.12 s | × | approve result and review > approve result |
| 43 | 0.12 s | × | dispute > sanity checks closed job |
| 44 | 0.12 s | × | arbitrate > sanity checks |
| 45 | 0.12 s | × | job posting > post job with arbitrator same as creator |
| 46 | 0.12 s | × | job posting > post job from unregistered user |
| 47 | 0.12 s | × | job updates > update job arbitrator |
| 48 | 0.12 s | × | deliver result > sanity checks |
| 49 | 0.12 s | × | job posting > post job with invalid deadline |
| 50 | 0.12 s | × | job updates > update job amounts |
| 51 | 0.12 s | × | take job > take job multiple |
| 52 | 0.12 s | × | job posting > post job with unregistered arbitrator |
| 53 | 0.12 s | × | job worker whitelisting > should whitelist worker |
| 54 | 0.11 s | × | close job > close job before timeout |
| 55 | 0.11 s | × | reopen job > reopen job before timeout |
| 56 | 0.11 s | × | reopen job > reopen job after timeout |
| 57 | 0.11 s | × | take job > take job |
| 58 | 0.11 s | × | register arbitrator > register arbitrator |
| 59 | 0.11 s | × | job updates > update job many times, get history |
| 60 | 0.11 s | × | withdraw collateral > withdraw collateral |
| 61 | 0.11 s | × | approve result and review > sanity checks |
| 62 | 0.11 s | × | pay start job > pay start job |
| 63 | 0.11 s | × | pay start job > sanity checks |
| 64 | 0.11 s | × | refund > refund |
| 65 | 0.11 s | × | post thread message > post thread message |
| 66 | 0.11 s | × | deliver result > deliver result |

## m1-run-5.log — 12/66 — 2026-09-29 10:50 — `b15dd1514`

- 54 failed | 12 passed (66)
- full run: **485.80 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **475.1 s**, median **0.13 s**
- first title (the fixture's deployment): **323.6 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 323.60 s | ✓ | admin > transfer owner |
| 2 | 34.10 s | ✓ | admin > pause/unpause |
| 3 | 26.12 s | ✓ | unicrow params > set unicrow contract addresses |
| 4 | 18.18 s | ✓ | admin > non pauser cannot unpause |
| 5 | 17.61 s | ✓ | unicrow params > set unicrow markeplace address |
| 6 | 17.38 s | ✓ | admin > set version |
| 7 | 10.15 s | × | mece tags > remove mece tag |
| 8 | 6.63 s | ✓ | admin > can not call initializer |
| 9 | 6.50 s | ✓ | mece tags > update mece tag |
| 10 | 2.80 s | ✓ | mece tags > read mece tag |
| 11 | 1.90 s | ✓ | admin > non owner cannot transfer owner |
| 12 | 1.82 s | ✓ | admin > non pauser cannot pause |
| 13 | 1.27 s | ✓ | admin > non owner cannot set version |
| 14 | 0.66 s | × | register user > register user |
| 15 | 0.19 s | × | take job > take job |
| 16 | 0.14 s | × | integration test > integration test |
| 17 | 0.14 s | × | dispute > sanity checks with arbitrator |
| 18 | 0.14 s | × | arbitrate > arbitrate 80-20 |
| 19 | 0.14 s | × | dispute > sanity checks closed job |
| 20 | 0.14 s | × | arbitrate > arbitrate 0-100 |
| 21 | 0.14 s | × | post thread message > sanity checks |
| 22 | 0.14 s | × | deliver result > sanity checks |
| 23 | 0.14 s | × | refund > sanity checks |
| 24 | 0.14 s | × | dispute > sanity checks no arbitrator |
| 25 | 0.14 s | × | arbitrate > arbitrate 100-0 |
| 26 | 0.14 s | × | refuse arbitration > job closed |
| 27 | 0.13 s | × | dispute > dispute worker |
| 28 | 0.13 s | × | refuse arbitration > job taken |
| 29 | 0.13 s | × | take job > sanity checks |
| 30 | 0.13 s | × | arbitrate > sanity checks |
| 31 | 0.13 s | × | dispute > dispute creator |
| 32 | 0.13 s | × | refuse arbitration > job not taken |
| 33 | 0.13 s | × | job posting > post job 1 |
| 34 | 0.13 s | × | post thread message > post thread message |
| 35 | 0.12 s | × | job posting > post two jobs |
| 36 | 0.12 s | × | register arbitrator > update arbitrator |
| 37 | 0.12 s | × | job posting > post job with unregistered arbitrator |
| 38 | 0.12 s | × | pay start job > pay start job |
| 39 | 0.12 s | × | deliver result > deliver result |
| 40 | 0.12 s | × | job posting > post job with invalid mece tags |
| 41 | 0.12 s | × | register user > update user |
| 42 | 0.12 s | × | job posting > post job with whitelist |
| 43 | 0.12 s | × | job posting > post job with invalid amount |
| 44 | 0.12 s | × | close job > close job before timeout |
| 45 | 0.12 s | × | pay start job > sanity checks |
| 46 | 0.12 s | × | job posting > post job with arbitrator same as creator |
| 47 | 0.12 s | × | job posting > post job with invalid deadline |
| 48 | 0.12 s | × | job posting > post job with invalid title |
| 49 | 0.12 s | × | job posting > post job from unregistered user |
| 50 | 0.12 s | × | reopen job > reopen job after timeout |
| 51 | 0.12 s | × | approve result and review > approve result |
| 52 | 0.12 s | × | refund > refund |
| 53 | 0.11 s | × | job worker whitelisting > should whitelist worker |
| 54 | 0.11 s | × | job updates > update job |
| 55 | 0.11 s | × | job updates > update job arbitrator |
| 56 | 0.11 s | × | withdraw collateral > withdraw collateral |
| 57 | 0.11 s | × | register arbitrator > register arbitrator |
| 58 | 0.11 s | × | job posting > post job with invalid token |
| 59 | 0.11 s | × | job updates > update job many times, get history |
| 60 | 0.11 s | × | reopen job > reopen job before timeout |
| 61 | 0.11 s | × | take job > take job multiple |
| 62 | 0.11 s | × | close job > close job after timeout |
| 63 | 0.11 s | × | approve result and review > sanity checks |
| 64 | 0.11 s | × | job posting > post job with invalid delivery method |
| 65 | 0.11 s | × | job updates > update job amounts |
| 66 | 0.11 s | × | job updates > update job tags |

## m1-run-6.log — 13/66 — 2026-09-29 12:10 — `00153b042`

- 53 failed | 13 passed (66)
- full run: **602.77 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **590.8 s**, median **0.18 s**
- first title (the fixture's deployment): **371.8 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 371.77 s | ✓ | admin > transfer owner |
| 2 | 54.51 s | ✓ | admin > pause/unpause |
| 3 | 36.80 s | ✓ | unicrow params > set unicrow contract addresses |
| 4 | 28.87 s | ✓ | unicrow params > set unicrow markeplace address |
| 5 | 24.59 s | ✓ | admin > non pauser cannot unpause |
| 6 | 22.55 s | ✓ | admin > set version |
| 7 | 11.21 s | ✓ | admin > can not call initializer |
| 8 | 9.20 s | ✓ | mece tags > update mece tag |
| 9 | 5.33 s | ✓ | mece tags > remove mece tag |
| 10 | 3.96 s | ✓ | mece tags > read mece tag |
| 11 | 3.02 s | ✓ | admin > non pauser cannot pause |
| 12 | 2.54 s | ✓ | admin > non owner cannot transfer owner |
| 13 | 2.38 s | × | register arbitrator > update arbitrator |
| 14 | 2.15 s | × | register user > update user |
| 15 | 1.97 s | ✓ | admin > non owner cannot set version |
| 16 | 1.06 s | × | register user > register user |
| 17 | 0.41 s | × | take job > take job multiple |
| 18 | 0.27 s | × | reopen job > reopen job after timeout |
| 19 | 0.27 s | × | reopen job > reopen job before timeout |
| 20 | 0.25 s | × | job updates > update job many times, get history |
| 21 | 0.24 s | × | close job > close job after timeout |
| 22 | 0.23 s | × | take job > sanity checks |
| 23 | 0.23 s | × | withdraw collateral > withdraw collateral |
| 24 | 0.22 s | × | job updates > update job amounts |
| 25 | 0.21 s | × | job posting > post job 1 |
| 26 | 0.20 s | × | job updates > update job tags |
| 27 | 0.20 s | × | dispute > dispute worker |
| 28 | 0.20 s | × | refuse arbitration > job closed |
| 29 | 0.19 s | × | dispute > sanity checks with arbitrator |
| 30 | 0.19 s | × | integration test > integration test |
| 31 | 0.19 s | × | dispute > sanity checks closed job |
| 32 | 0.19 s | × | close job > close job before timeout |
| 33 | 0.18 s | × | register arbitrator > register arbitrator |
| 34 | 0.17 s | × | job posting > post job with invalid mece tags |
| 35 | 0.17 s | × | refund > sanity checks |
| 36 | 0.17 s | × | take job > take job |
| 37 | 0.17 s | × | post thread message > sanity checks |
| 38 | 0.17 s | × | arbitrate > arbitrate 100-0 |
| 39 | 0.17 s | × | dispute > sanity checks no arbitrator |
| 40 | 0.17 s | × | job posting > post job with invalid deadline |
| 41 | 0.17 s | × | job posting > post job with invalid token |
| 42 | 0.16 s | × | pay start job > sanity checks |
| 43 | 0.16 s | × | dispute > dispute creator |
| 44 | 0.16 s | × | refuse arbitration > job not taken |
| 45 | 0.16 s | × | refuse arbitration > job taken |
| 46 | 0.16 s | × | arbitrate > sanity checks |
| 47 | 0.16 s | × | job posting > post job with arbitrator same as creator |
| 48 | 0.16 s | × | job posting > post job with unregistered arbitrator |
| 49 | 0.16 s | × | pay start job > pay start job |
| 50 | 0.16 s | × | arbitrate > arbitrate 80-20 |
| 51 | 0.15 s | × | job posting > post job with whitelist |
| 52 | 0.15 s | × | approve result and review > approve result |
| 53 | 0.15 s | × | deliver result > sanity checks |
| 54 | 0.15 s | × | job posting > post job with invalid title |
| 55 | 0.14 s | × | job posting > post job with invalid amount |
| 56 | 0.14 s | × | post thread message > post thread message |
| 57 | 0.14 s | × | arbitrate > arbitrate 0-100 |
| 58 | 0.14 s | × | approve result and review > sanity checks |
| 59 | 0.14 s | × | job worker whitelisting > should whitelist worker |
| 60 | 0.14 s | × | job posting > post two jobs |
| 61 | 0.14 s | × | refund > refund |
| 62 | 0.14 s | × | job posting > post job from unregistered user |
| 63 | 0.14 s | × | job updates > update job arbitrator |
| 64 | 0.14 s | × | deliver result > deliver result |
| 65 | 0.13 s | × | job updates > update job |
| 66 | 0.13 s | × | job posting > post job with invalid delivery method |

## m1-run-7.log — 13/66 — 2026-09-29 13:31 — `f4cadb76d`

- 53 failed | 13 passed (66)
- full run: **3754.66 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3743.9 s**, median **53.18 s**
- first title (the fixture's deployment): **355.6 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 355.60 s | ✓ | admin > transfer owner |
| 2 | 116.50 s | × | post thread message > sanity checks |
| 3 | 95.22 s | × | job worker whitelisting > should whitelist worker |
| 4 | 91.49 s | × | job updates > update job many times, get history |
| 5 | 88.81 s | × | pay start job > pay start job |
| 6 | 88.68 s | × | post thread message > post thread message |
| 7 | 83.64 s | × | reopen job > reopen job before timeout |
| 8 | 83.60 s | × | take job > sanity checks |
| 9 | 83.58 s | × | reopen job > reopen job after timeout |
| 10 | 83.05 s | × | approve result and review > sanity checks |
| 11 | 82.90 s | × | job posting > post two jobs |
| 12 | 82.82 s | × | job updates > update job amounts |
| 13 | 81.89 s | × | job updates > update job tags |
| 14 | 81.03 s | × | pay start job > sanity checks |
| 15 | 80.41 s | × | job posting > post job with unregistered arbitrator |
| 16 | 78.16 s | × | withdraw collateral > withdraw collateral |
| 17 | 76.89 s | × | take job > take job |
| 18 | 76.46 s | × | close job > close job after timeout |
| 19 | 75.01 s | × | deliver result > sanity checks |
| 20 | 73.29 s | × | close job > close job before timeout |
| 21 | 72.77 s | × | job updates > update job |
| 22 | 71.92 s | × | take job > take job multiple |
| 23 | 66.68 s | × | approve result and review > approve result |
| 24 | 66.01 s | × | deliver result > deliver result |
| 25 | 65.16 s | × | job updates > update job arbitrator |
| 26 | 62.32 s | × | job posting > post job with arbitrator same as creator |
| 27 | 62.15 s | × | refund > sanity checks |
| 28 | 57.80 s | × | dispute > sanity checks closed job |
| 29 | 56.56 s | × | job posting > post job with invalid deadline |
| 30 | 56.18 s | × | refuse arbitration > job taken |
| 31 | 54.48 s | × | arbitrate > arbitrate 80-20 |
| 32 | 54.14 s | × | refund > refund |
| 33 | 53.18 s | × | dispute > sanity checks with arbitrator |
| 34 | 53.10 s | × | refuse arbitration > job not taken |
| 35 | 53.02 s | × | arbitrate > arbitrate 0-100 |
| 36 | 51.08 s | × | arbitrate > arbitrate 100-0 |
| 37 | 51.01 s | × | integration test > integration test |
| 38 | 50.76 s | × | dispute > dispute creator |
| 39 | 49.62 s | × | refuse arbitration > job closed |
| 40 | 49.27 s | × | arbitrate > sanity checks |
| 41 | 48.74 s | × | dispute > dispute worker |
| 42 | 42.18 s | × | job posting > post job 1 |
| 43 | 40.94 s | ✓ | admin > pause/unpause |
| 44 | 40.23 s | ✓ | unicrow params > set unicrow contract addresses |
| 45 | 38.45 s | × | job posting > post job with invalid mece tags |
| 46 | 38.05 s | × | job posting > post job with invalid title |
| 47 | 37.56 s | × | register arbitrator > update arbitrator |
| 48 | 36.86 s | × | job posting > post job with invalid delivery method |
| 49 | 35.60 s | × | job posting > post job with whitelist |
| 50 | 34.86 s | × | dispute > sanity checks no arbitrator |
| 51 | 34.82 s | × | job posting > post job with invalid amount |
| 52 | 27.93 s | × | job posting > post job with invalid token |
| 53 | 27.84 s | × | register user > update user |
| 54 | 27.56 s | ✓ | unicrow params > set unicrow markeplace address |
| 55 | 23.59 s | ✓ | admin > non pauser cannot unpause |
| 56 | 21.55 s | ✓ | admin > set version |
| 57 | 16.45 s | ✓ | mece tags > update mece tag |
| 58 | 12.80 s | × | register arbitrator > register arbitrator |
| 59 | 11.29 s | ✓ | mece tags > remove mece tag |
| 60 | 9.07 s | ✓ | admin > can not call initializer |
| 61 | 8.03 s | × | register user > register user |
| 62 | 5.91 s | ✓ | mece tags > read mece tag |
| 63 | 2.48 s | ✓ | admin > non owner cannot transfer owner |
| 64 | 2.35 s | ✓ | admin > non pauser cannot pause |
| 65 | 2.10 s | ✓ | admin > non owner cannot set version |
| 66 | 0.39 s | × | job posting > post job from unregistered user |

## m1-run-8.log — 13/66 — 2026-09-29 14:49 — `5bf6434f3`

- 53 failed | 13 passed (66)
- full run: **3227.34 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3215.6 s**, median **57.59 s**
- first title (the fixture's deployment): **312.6 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 312.64 s | ✓ | admin > transfer owner |
| 2 | 79.39 s | × | dispute > sanity checks closed job |
| 3 | 77.10 s | × | dispute > dispute creator |
| 4 | 76.58 s | × | job updates > update job amounts |
| 5 | 75.72 s | × | integration test > integration test |
| 6 | 73.46 s | × | arbitrate > arbitrate 0-100 |
| 7 | 73.06 s | × | dispute > sanity checks with arbitrator |
| 8 | 72.76 s | × | arbitrate > sanity checks |
| 9 | 71.86 s | × | arbitrate > arbitrate 100-0 |
| 10 | 71.44 s | × | refuse arbitration > job not taken |
| 11 | 69.89 s | × | arbitrate > arbitrate 80-20 |
| 12 | 68.80 s | × | take job > sanity checks |
| 13 | 68.75 s | × | withdraw collateral > withdraw collateral |
| 14 | 68.16 s | × | refuse arbitration > job taken |
| 15 | 68.04 s | × | dispute > dispute worker |
| 16 | 67.46 s | × | refuse arbitration > job closed |
| 17 | 67.41 s | × | approve result and review > approve result |
| 18 | 67.19 s | × | job updates > update job |
| 19 | 66.13 s | × | post thread message > sanity checks |
| 20 | 65.72 s | × | refund > refund |
| 21 | 65.49 s | × | take job > take job |
| 22 | 65.17 s | × | job updates > update job many times, get history |
| 23 | 65.12 s | × | refund > sanity checks |
| 24 | 63.49 s | × | take job > take job multiple |
| 25 | 62.76 s | × | job worker whitelisting > should whitelist worker |
| 26 | 61.81 s | × | job updates > update job arbitrator |
| 27 | 61.61 s | × | job updates > update job tags |
| 28 | 59.47 s | × | approve result and review > sanity checks |
| 29 | 59.23 s | × | close job > close job before timeout |
| 30 | 58.81 s | × | deliver result > deliver result |
| 31 | 58.76 s | × | post thread message > post thread message |
| 32 | 57.95 s | × | reopen job > reopen job before timeout |
| 33 | 57.59 s | × | pay start job > sanity checks |
| 34 | 57.40 s | × | close job > close job after timeout |
| 35 | 57.36 s | × | deliver result > sanity checks |
| 36 | 56.97 s | × | reopen job > reopen job after timeout |
| 37 | 55.62 s | × | pay start job > pay start job |
| 38 | 46.13 s | × | dispute > sanity checks no arbitrator |
| 39 | 41.22 s | × | job posting > post job with unregistered arbitrator |
| 40 | 40.96 s | × | job posting > post two jobs |
| 41 | 38.99 s | × | job posting > post job with arbitrator same as creator |
| 42 | 34.93 s | ✓ | admin > pause/unpause |
| 43 | 28.76 s | × | job posting > post job 1 |
| 44 | 23.52 s | × | register user > update user |
| 45 | 23.10 s | × | job posting > post job with invalid mece tags |
| 46 | 21.99 s | ✓ | unicrow params > set unicrow contract addresses |
| 47 | 21.88 s | × | job posting > post job with invalid delivery method |
| 48 | 21.23 s | × | job posting > post job with invalid title |
| 49 | 20.68 s | × | register arbitrator > update arbitrator |
| 50 | 20.25 s | × | job posting > post job with invalid token |
| 51 | 20.23 s | × | job posting > post job with invalid deadline |
| 52 | 17.99 s | ✓ | unicrow params > set unicrow markeplace address |
| 53 | 17.98 s | × | job posting > post job with whitelist |
| 54 | 17.73 s | × | job posting > post job with invalid amount |
| 55 | 16.28 s | ✓ | admin > non pauser cannot unpause |
| 56 | 15.32 s | ✓ | admin > set version |
| 57 | 7.08 s | × | register user > register user |
| 58 | 7.08 s | ✓ | admin > can not call initializer |
| 59 | 6.56 s | ✓ | mece tags > update mece tag |
| 60 | 5.76 s | × | register arbitrator > register arbitrator |
| 61 | 5.51 s | ✓ | mece tags > remove mece tag |
| 62 | 2.96 s | ✓ | mece tags > read mece tag |
| 63 | 1.82 s | ✓ | admin > non pauser cannot pause |
| 64 | 1.78 s | ✓ | admin > non owner cannot transfer owner |
| 65 | 1.58 s | ✓ | admin > non owner cannot set version |
| 66 | 0.13 s | × | job posting > post job from unregistered user |

## m1-run-9.log — 15/66 — 2026-09-29 16:20 — `c6d3bb914`

- 51 failed | 15 passed (66)
- full run: **5161.43 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **5062.6 s**, median **75.28 s**
- first title (the fixture's deployment): **806.0 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 805.97 s | ✓ | admin > transfer owner |
| 2 | 138.28 s | × | job updates > update job amounts |
| 3 | 130.71 s | × | job posting > post two jobs |
| 4 | 108.45 s | × | register user > register user |
| 5 | 106.36 s | × | job updates > update job tags |
| 6 | 104.20 s | × | job updates > update job many times, get history |
| 7 | 103.13 s | × | job posting > post job with arbitrator same as creator |
| 8 | 98.77 s | × | dispute > dispute creator |
| 9 | 98.65 s | × | withdraw collateral > withdraw collateral |
| 10 | 94.35 s | × | dispute > dispute worker |
| 11 | 93.52 s | × | job worker whitelisting > should whitelist worker |
| 12 | 86.50 s | × | take job > sanity checks |
| 13 | 86.41 s | × | dispute > sanity checks closed job |
| 14 | 86.19 s | × | refuse arbitration > job taken |
| 15 | 84.29 s | × | arbitrate > arbitrate 80-20 |
| 16 | 83.87 s | × | refuse arbitration > job not taken |
| 17 | 83.12 s | × | register user > update user |
| 18 | 82.72 s | × | job updates > update job arbitrator |
| 19 | 81.78 s | × | refund > sanity checks |
| 20 | 81.25 s | × | register arbitrator > register arbitrator |
| 21 | 80.93 s | × | reopen job > reopen job after timeout |
| 22 | 80.20 s | × | integration test > integration test |
| 23 | 80.13 s | × | arbitrate > arbitrate 0-100 |
| 24 | 79.95 s | × | arbitrate > sanity checks |
| 25 | 79.56 s | × | refund > refund |
| 26 | 78.08 s | × | arbitrate > arbitrate 100-0 |
| 27 | 77.61 s | × | close job > close job before timeout |
| 28 | 77.23 s | × | job updates > update job |
| 29 | 76.97 s | × | approve result and review > approve result |
| 30 | 76.75 s | × | take job > take job multiple |
| 31 | 75.84 s | × | refuse arbitration > job closed |
| 32 | 75.56 s | × | deliver result > sanity checks |
| 33 | 75.28 s | × | pay start job > sanity checks |
| 34 | 75.24 s | × | close job > close job after timeout |
| 35 | 73.79 s | × | deliver result > deliver result |
| 36 | 73.04 s | × | take job > take job |
| 37 | 72.45 s | × | approve result and review > sanity checks |
| 38 | 71.98 s | × | dispute > sanity checks with arbitrator |
| 39 | 71.91 s | × | pay start job > pay start job |
| 40 | 71.72 s | × | reopen job > reopen job before timeout |
| 41 | 70.09 s | × | post thread message > post thread message |
| 42 | 68.27 s | × | register arbitrator > update arbitrator |
| 43 | 66.05 s | × | post thread message > sanity checks |
| 44 | 57.45 s | × | job posting > post job with whitelist |
| 45 | 56.40 s | ✓ | unicrow params > set unicrow contract addresses |
| 46 | 55.68 s | × | job posting > post job with invalid token |
| 47 | 51.98 s | × | dispute > sanity checks no arbitrator |
| 48 | 50.55 s | × | job posting > post job 1 |
| 49 | 46.37 s | ✓ | admin > pause/unpause |
| 50 | 45.44 s | × | job posting > post job with unregistered arbitrator |
| 51 | 43.31 s | × | job posting > post job with invalid amount |
| 52 | 41.61 s | ✓ | unicrow params > set unicrow markeplace address |
| 53 | 38.16 s | ✓ | admin > set version |
| 54 | 30.00 s | ✓ | admin > non pauser cannot unpause |
| 55 | 28.90 s | ✓ | job posting > post job with invalid title |
| 56 | 27.90 s | × | job posting > post job with invalid mece tags |
| 57 | 26.78 s | × | job posting > post job with invalid delivery method |
| 58 | 24.09 s | ✓ | admin > can not call initializer |
| 59 | 23.77 s | ✓ | job posting > post job with invalid deadline |
| 60 | 14.97 s | ✓ | mece tags > update mece tag |
| 61 | 8.24 s | ✓ | mece tags > remove mece tag |
| 62 | 6.95 s | ✓ | mece tags > read mece tag |
| 63 | 6.85 s | ✓ | admin > non owner cannot set version |
| 64 | 4.31 s | × | job posting > post job from unregistered user |
| 65 | 3.64 s | ✓ | admin > non owner cannot transfer owner |
| 66 | 2.10 s | ✓ | admin > non pauser cannot pause |

## m1-run-10.log — 14/66 — 2026-09-29 20:17 — `dc4c1bdc6`

- 52 failed | 14 passed (66)
- full run: **3119.32 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3106.9 s**, median **54.65 s**
- first title (the fixture's deployment): **336.3 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 336.30 s | ✓ | admin > transfer owner |
| 2 | 70.95 s | × | refund > sanity checks |
| 3 | 67.32 s | × | job updates > update job many times, get history |
| 4 | 66.27 s | × | job worker whitelisting > should whitelist worker |
| 5 | 66.21 s | × | take job > sanity checks |
| 6 | 64.56 s | × | close job > close job before timeout |
| 7 | 62.56 s | × | arbitrate > sanity checks |
| 8 | 62.52 s | × | withdraw collateral > withdraw collateral |
| 9 | 62.45 s | × | job updates > update job arbitrator |
| 10 | 62.32 s | × | dispute > dispute worker |
| 11 | 62.24 s | × | dispute > dispute creator |
| 12 | 62.18 s | × | take job > take job |
| 13 | 61.58 s | × | arbitrate > arbitrate 100-0 |
| 14 | 61.36 s | × | arbitrate > arbitrate 80-20 |
| 15 | 61.33 s | × | job updates > update job |
| 16 | 61.18 s | × | job updates > update job tags |
| 17 | 60.95 s | × | refuse arbitration > job closed |
| 18 | 60.82 s | × | post thread message > post thread message |
| 19 | 60.26 s | × | approve result and review > approve result |
| 20 | 59.23 s | × | job updates > update job amounts |
| 21 | 59.23 s | × | approve result and review > sanity checks |
| 22 | 58.77 s | × | reopen job > reopen job after timeout |
| 23 | 58.51 s | × | reopen job > reopen job before timeout |
| 24 | 58.34 s | × | integration test > integration test |
| 25 | 58.31 s | × | deliver result > deliver result |
| 26 | 58.20 s | × | dispute > sanity checks with arbitrator |
| 27 | 57.81 s | × | close job > close job after timeout |
| 28 | 57.01 s | × | refuse arbitration > job taken |
| 29 | 56.99 s | × | arbitrate > arbitrate 0-100 |
| 30 | 56.91 s | × | refuse arbitration > job not taken |
| 31 | 55.69 s | × | refund > refund |
| 32 | 54.95 s | × | pay start job > sanity checks |
| 33 | 54.65 s | × | deliver result > sanity checks |
| 34 | 54.18 s | × | take job > take job multiple |
| 35 | 53.76 s | × | dispute > sanity checks closed job |
| 36 | 53.32 s | × | post thread message > sanity checks |
| 37 | 51.27 s | × | pay start job > pay start job |
| 38 | 45.45 s | × | job posting > post two jobs |
| 39 | 41.82 s | ✓ | register user > register user |
| 40 | 41.56 s | × | register arbitrator > update arbitrator |
| 41 | 38.87 s | ✓ | admin > pause/unpause |
| 42 | 38.62 s | × | dispute > sanity checks no arbitrator |
| 43 | 38.09 s | × | job posting > post job with unregistered arbitrator |
| 44 | 37.74 s | × | register arbitrator > register arbitrator |
| 45 | 37.62 s | × | register user > update user |
| 46 | 37.54 s | × | job posting > post job with arbitrator same as creator |
| 47 | 26.35 s | ✓ | unicrow params > set unicrow contract addresses |
| 48 | 22.34 s | ✓ | unicrow params > set unicrow markeplace address |
| 49 | 19.42 s | × | job posting > post job with whitelist |
| 50 | 19.32 s | ✓ | admin > non pauser cannot unpause |
| 51 | 18.97 s | × | job posting > post job with invalid token |
| 52 | 18.27 s | × | job posting > post job with invalid delivery method |
| 53 | 18.17 s | ✓ | admin > set version |
| 54 | 18.17 s | × | job posting > post job with invalid amount |
| 55 | 18.16 s | × | job posting > post job 1 |
| 56 | 17.79 s | × | job posting > post job with invalid deadline |
| 57 | 17.63 s | × | job posting > post job with invalid title |
| 58 | 17.52 s | × | job posting > post job with invalid mece tags |
| 59 | 7.82 s | ✓ | admin > can not call initializer |
| 60 | 6.97 s | ✓ | mece tags > update mece tag |
| 61 | 3.55 s | ✓ | mece tags > remove mece tag |
| 62 | 2.84 s | ✓ | mece tags > read mece tag |
| 63 | 2.00 s | ✓ | admin > non pauser cannot pause |
| 64 | 1.93 s | ✓ | admin > non owner cannot transfer owner |
| 65 | 1.80 s | ✓ | admin > non owner cannot set version |
| 66 | 0.12 s | × | job posting > post job from unregistered user |

## m1-run-11.log — 14/66 — 2026-09-29 21:20 — `2ce840bcc + c2357b1f1 + d6cdc439d`

- 52 failed | 14 passed (66)
- full run: **3104.95 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3091.2 s**, median **53.76 s**
- first title (the fixture's deployment): **316.0 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 316.01 s | ✓ | admin > transfer owner |
| 2 | 84.19 s | × | arbitrate > arbitrate 80-20 |
| 3 | 83.36 s | × | refuse arbitration > job taken |
| 4 | 81.38 s | × | integration test > integration test |
| 5 | 77.12 s | × | arbitrate > arbitrate 100-0 |
| 6 | 76.00 s | × | arbitrate > arbitrate 0-100 |
| 7 | 72.85 s | × | refuse arbitration > job not taken |
| 8 | 71.18 s | × | arbitrate > sanity checks |
| 9 | 69.44 s | × | dispute > sanity checks closed job |
| 10 | 68.55 s | × | refuse arbitration > job closed |
| 11 | 65.66 s | × | job updates > update job many times, get history |
| 12 | 64.04 s | × | dispute > sanity checks with arbitrator |
| 13 | 63.40 s | × | dispute > dispute creator |
| 14 | 60.53 s | × | pay start job > pay start job |
| 15 | 60.43 s | × | dispute > dispute worker |
| 16 | 60.22 s | × | withdraw collateral > withdraw collateral |
| 17 | 59.88 s | × | job updates > update job |
| 18 | 59.79 s | × | job updates > update job amounts |
| 19 | 59.10 s | × | close job > close job before timeout |
| 20 | 58.90 s | × | deliver result > deliver result |
| 21 | 58.86 s | × | take job > sanity checks |
| 22 | 58.76 s | × | reopen job > reopen job after timeout |
| 23 | 57.95 s | × | refund > sanity checks |
| 24 | 57.78 s | × | pay start job > sanity checks |
| 25 | 57.62 s | × | approve result and review > sanity checks |
| 26 | 57.32 s | × | job worker whitelisting > should whitelist worker |
| 27 | 56.20 s | × | job updates > update job arbitrator |
| 28 | 56.03 s | × | take job > take job multiple |
| 29 | 55.40 s | × | refund > refund |
| 30 | 55.01 s | × | approve result and review > approve result |
| 31 | 54.81 s | × | job updates > update job tags |
| 32 | 54.35 s | × | take job > take job |
| 33 | 53.76 s | × | reopen job > reopen job before timeout |
| 34 | 53.61 s | × | close job > close job after timeout |
| 35 | 53.60 s | × | post thread message > sanity checks |
| 36 | 52.38 s | × | post thread message > post thread message |
| 37 | 50.80 s | × | deliver result > sanity checks |
| 38 | 39.85 s | × | dispute > sanity checks no arbitrator |
| 39 | 35.20 s | ✓ | admin > pause/unpause |
| 40 | 34.74 s | × | job posting > post job with unregistered arbitrator |
| 41 | 34.34 s | × | job posting > post two jobs |
| 42 | 33.97 s | ✓ | register user > register user |
| 43 | 33.44 s | × | register arbitrator > register arbitrator |
| 44 | 32.47 s | × | register arbitrator > update arbitrator |
| 45 | 32.27 s | × | job posting > post job with arbitrator same as creator |
| 46 | 30.57 s | × | register user > update user |
| 47 | 22.12 s | ✓ | unicrow params > set unicrow contract addresses |
| 48 | 19.86 s | ✓ | unicrow params > set unicrow markeplace address |
| 49 | 17.48 s | × | job posting > post job 1 |
| 50 | 17.13 s | × | job posting > post job with whitelist |
| 51 | 16.53 s | ✓ | admin > non pauser cannot unpause |
| 52 | 16.29 s | ✓ | admin > set version |
| 53 | 16.22 s | × | job posting > post job with invalid token |
| 54 | 16.19 s | × | job posting > post job with invalid mece tags |
| 55 | 15.81 s | × | job posting > post job with invalid deadline |
| 56 | 15.79 s | × | job posting > post job with invalid title |
| 57 | 15.26 s | × | job posting > post job with invalid delivery method |
| 58 | 15.23 s | × | job posting > post job with invalid amount |
| 59 | 6.75 s | ✓ | admin > can not call initializer |
| 60 | 6.09 s | ✓ | mece tags > update mece tag |
| 61 | 3.73 s | ✓ | mece tags > remove mece tag |
| 62 | 2.50 s | ✓ | mece tags > read mece tag |
| 63 | 2.12 s | ✓ | admin > non owner cannot transfer owner |
| 64 | 1.56 s | ✓ | admin > non pauser cannot pause |
| 65 | 1.39 s | ✓ | admin > non owner cannot set version |
| 66 | 0.10 s | × | job posting > post job from unregistered user |

## m1-run-12.log — 14/66 — 2026-09-29 22:32 — `fab7b4d01 (census 0)`

- 52 failed | 14 passed (66)
- full run: **3409.73 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3394.8 s**, median **54.34 s**
- first title (the fixture's deployment): **415.3 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 415.34 s | ✓ | admin > transfer owner |
| 2 | 83.59 s | × | refuse arbitration > job closed |
| 3 | 80.68 s | × | dispute > dispute worker |
| 4 | 80.09 s | × | dispute > dispute creator |
| 5 | 78.64 s | × | refuse arbitration > job not taken |
| 6 | 78.27 s | × | dispute > sanity checks closed job |
| 7 | 73.28 s | × | refund > refund |
| 8 | 72.54 s | × | arbitrate > sanity checks |
| 9 | 71.84 s | × | job updates > update job |
| 10 | 71.75 s | × | arbitrate > arbitrate 100-0 |
| 11 | 69.35 s | × | arbitrate > arbitrate 0-100 |
| 12 | 68.49 s | × | close job > close job before timeout |
| 13 | 68.37 s | × | job updates > update job many times, get history |
| 14 | 67.74 s | × | arbitrate > arbitrate 80-20 |
| 15 | 67.55 s | × | dispute > sanity checks with arbitrator |
| 16 | 65.86 s | × | approve result and review > approve result |
| 17 | 65.76 s | × | job worker whitelisting > should whitelist worker |
| 18 | 63.36 s | × | take job > sanity checks |
| 19 | 61.52 s | × | job updates > update job tags |
| 20 | 61.25 s | × | take job > take job multiple |
| 21 | 60.79 s | × | reopen job > reopen job before timeout |
| 22 | 60.60 s | × | withdraw collateral > withdraw collateral |
| 23 | 60.45 s | × | refund > sanity checks |
| 24 | 59.24 s | × | reopen job > reopen job after timeout |
| 25 | 57.89 s | × | refuse arbitration > job taken |
| 26 | 57.80 s | × | post thread message > sanity checks |
| 27 | 57.69 s | × | job updates > update job arbitrator |
| 28 | 56.34 s | × | pay start job > pay start job |
| 29 | 56.22 s | × | take job > take job |
| 30 | 56.15 s | × | close job > close job after timeout |
| 31 | 56.13 s | × | job updates > update job amounts |
| 32 | 54.85 s | × | pay start job > sanity checks |
| 33 | 54.34 s | × | integration test > integration test |
| 34 | 54.18 s | × | deliver result > sanity checks |
| 35 | 53.42 s | × | approve result and review > sanity checks |
| 36 | 51.66 s | × | post thread message > post thread message |
| 37 | 49.98 s | × | deliver result > deliver result |
| 38 | 49.88 s | × | job posting > post two jobs |
| 39 | 47.61 s | ✓ | register user > register user |
| 40 | 45.21 s | × | job posting > post job with unregistered arbitrator |
| 41 | 43.87 s | × | register user > update user |
| 42 | 43.85 s | × | job posting > post job with arbitrator same as creator |
| 43 | 43.07 s | × | dispute > sanity checks no arbitrator |
| 44 | 42.92 s | ✓ | admin > pause/unpause |
| 45 | 41.95 s | × | register arbitrator > register arbitrator |
| 46 | 35.46 s | × | register arbitrator > update arbitrator |
| 47 | 31.17 s | ✓ | unicrow params > set unicrow contract addresses |
| 48 | 25.47 s | ✓ | unicrow params > set unicrow markeplace address |
| 49 | 22.89 s | × | job posting > post job with whitelist |
| 50 | 22.14 s | × | job posting > post job 1 |
| 51 | 21.50 s | × | job posting > post job with invalid token |
| 52 | 20.48 s | ✓ | admin > non pauser cannot unpause |
| 53 | 19.91 s | ✓ | admin > set version |
| 54 | 18.63 s | × | job posting > post job with invalid mece tags |
| 55 | 18.28 s | × | job posting > post job with invalid amount |
| 56 | 17.04 s | × | job posting > post job with invalid delivery method |
| 57 | 15.94 s | × | job posting > post job with invalid title |
| 58 | 15.80 s | × | job posting > post job with invalid deadline |
| 59 | 7.86 s | ✓ | admin > can not call initializer |
| 60 | 7.57 s | ✓ | mece tags > update mece tag |
| 61 | 4.44 s | ✓ | mece tags > remove mece tag |
| 62 | 3.11 s | ✓ | mece tags > read mece tag |
| 63 | 2.16 s | ✓ | admin > non owner cannot transfer owner |
| 64 | 1.92 s | ✓ | admin > non pauser cannot pause |
| 65 | 1.50 s | ✓ | admin > non owner cannot set version |
| 66 | 0.14 s | × | job posting > post job from unregistered user |

## m1-run-13.log — 14/66 — 2026-09-29 23:30 — `8ca6be7fb`

- 52 failed | 14 passed (66)
- full run: **3515.81 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3505.3 s**, median **57.36 s**
- first title (the fixture's deployment): **348.0 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 348.01 s | ✓ | admin > transfer owner |
| 2 | 84.74 s | × | dispute > sanity checks with arbitrator |
| 3 | 82.97 s | × | pay start job > sanity checks |
| 4 | 79.20 s | × | dispute > sanity checks closed job |
| 5 | 77.05 s | × | dispute > dispute creator |
| 6 | 76.67 s | × | take job > take job multiple |
| 7 | 76.30 s | × | refund > refund |
| 8 | 76.14 s | × | dispute > dispute worker |
| 9 | 73.18 s | × | refund > sanity checks |
| 10 | 72.91 s | × | pay start job > pay start job |
| 11 | 70.85 s | × | job updates > update job |
| 12 | 70.75 s | × | refuse arbitration > job not taken |
| 13 | 70.28 s | × | arbitrate > sanity checks |
| 14 | 70.24 s | × | post thread message > sanity checks |
| 15 | 70.15 s | × | job worker whitelisting > should whitelist worker |
| 16 | 69.97 s | × | approve result and review > approve result |
| 17 | 66.74 s | × | arbitrate > arbitrate 80-20 |
| 18 | 66.67 s | × | arbitrate > arbitrate 0-100 |
| 19 | 65.44 s | × | refuse arbitration > job closed |
| 20 | 64.72 s | × | take job > sanity checks |
| 21 | 63.85 s | × | deliver result > deliver result |
| 22 | 63.23 s | × | approve result and review > sanity checks |
| 23 | 63.16 s | × | arbitrate > arbitrate 100-0 |
| 24 | 62.87 s | × | refuse arbitration > job taken |
| 25 | 62.51 s | × | deliver result > sanity checks |
| 26 | 61.62 s | × | reopen job > reopen job before timeout |
| 27 | 59.49 s | × | take job > take job |
| 28 | 58.79 s | × | job updates > update job tags |
| 29 | 58.76 s | × | reopen job > reopen job after timeout |
| 30 | 58.73 s | × | job updates > update job amounts |
| 31 | 58.52 s | × | post thread message > post thread message |
| 32 | 58.18 s | × | withdraw collateral > withdraw collateral |
| 33 | 57.36 s | × | integration test > integration test |
| 34 | 56.43 s | × | job updates > update job arbitrator |
| 35 | 55.58 s | × | job updates > update job many times, get history |
| 36 | 54.76 s | × | dispute > sanity checks no arbitrator |
| 37 | 54.16 s | ✓ | register user > register user |
| 38 | 54.11 s | × | register arbitrator > update arbitrator |
| 39 | 52.58 s | × | register arbitrator > register arbitrator |
| 40 | 52.40 s | × | close job > close job before timeout |
| 41 | 51.96 s | × | job posting > post two jobs |
| 42 | 51.48 s | × | close job > close job after timeout |
| 43 | 48.38 s | × | register user > update user |
| 44 | 46.38 s | × | job posting > post job with unregistered arbitrator |
| 45 | 42.26 s | ✓ | admin > pause/unpause |
| 46 | 41.26 s | × | job posting > post job with arbitrator same as creator |
| 47 | 36.14 s | ✓ | unicrow params > set unicrow contract addresses |
| 48 | 28.67 s | ✓ | unicrow params > set unicrow markeplace address |
| 49 | 27.87 s | × | job posting > post job 1 |
| 50 | 24.00 s | × | job posting > post job with invalid delivery method |
| 51 | 23.26 s | ✓ | admin > set version |
| 52 | 22.75 s | ✓ | admin > non pauser cannot unpause |
| 53 | 21.89 s | × | job posting > post job with invalid mece tags |
| 54 | 21.05 s | × | job posting > post job with invalid token |
| 55 | 20.28 s | × | job posting > post job with invalid title |
| 56 | 20.21 s | × | job posting > post job with whitelist |
| 57 | 20.12 s | × | job posting > post job with invalid deadline |
| 58 | 19.27 s | × | job posting > post job with invalid amount |
| 59 | 10.99 s | ✓ | admin > can not call initializer |
| 60 | 9.49 s | ✓ | mece tags > update mece tag |
| 61 | 6.20 s | ✓ | mece tags > remove mece tag |
| 62 | 3.98 s | ✓ | mece tags > read mece tag |
| 63 | 2.63 s | ✓ | admin > non owner cannot set version |
| 64 | 2.48 s | ✓ | admin > non pauser cannot pause |
| 65 | 1.97 s | ✓ | admin > non owner cannot transfer owner |
| 66 | 0.25 s | × | job posting > post job from unregistered user |

## m1-run-14.log — 15/66 — 2026-09-30 00:50 — `070a7ceb0 + bdb9611d2`

- 51 failed | 15 passed (66)
- full run: **3151.45 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3141.8 s**, median **52.98 s**
- first title (the fixture's deployment): **327.1 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 327.09 s | ✓ | admin > transfer owner |
| 2 | 77.93 s | × | dispute > dispute creator |
| 3 | 76.33 s | × | arbitrate > arbitrate 100-0 |
| 4 | 73.84 s | × | post thread message > sanity checks |
| 5 | 71.26 s | × | refuse arbitration > job not taken |
| 6 | 69.11 s | × | arbitrate > sanity checks |
| 7 | 68.96 s | × | refuse arbitration > job closed |
| 8 | 68.89 s | × | pay start job > pay start job |
| 9 | 68.53 s | × | take job > sanity checks |
| 10 | 67.32 s | × | dispute > dispute worker |
| 11 | 67.10 s | × | arbitrate > arbitrate 0-100 |
| 12 | 66.15 s | × | close job > close job after timeout |
| 13 | 64.49 s | × | take job > take job |
| 14 | 64.04 s | × | refuse arbitration > job taken |
| 15 | 63.91 s | × | take job > take job multiple |
| 16 | 63.61 s | × | dispute > sanity checks closed job |
| 17 | 63.58 s | × | reopen job > reopen job before timeout |
| 18 | 63.04 s | × | pay start job > sanity checks |
| 19 | 62.93 s | × | dispute > sanity checks with arbitrator |
| 20 | 62.73 s | × | reopen job > reopen job after timeout |
| 21 | 61.72 s | × | integration test > integration test |
| 22 | 61.60 s | × | arbitrate > arbitrate 80-20 |
| 23 | 61.09 s | × | close job > close job before timeout |
| 24 | 60.90 s | × | withdraw collateral > withdraw collateral |
| 25 | 59.25 s | × | job updates > update job amounts |
| 26 | 57.99 s | × | job updates > update job many times, get history |
| 27 | 57.47 s | × | job updates > update job tags |
| 28 | 56.97 s | × | refund > refund |
| 29 | 56.56 s | × | job updates > update job arbitrator |
| 30 | 56.30 s | × | approve result and review > sanity checks |
| 31 | 55.00 s | × | post thread message > post thread message |
| 32 | 54.85 s | × | approve result and review > approve result |
| 33 | 52.98 s | × | deliver result > sanity checks |
| 34 | 52.09 s | × | deliver result > deliver result |
| 35 | 51.95 s | × | refund > sanity checks |
| 36 | 51.39 s | × | job updates > update job |
| 37 | 49.40 s | × | job worker whitelisting > should whitelist worker |
| 38 | 44.80 s | × | dispute > sanity checks no arbitrator |
| 39 | 42.71 s | × | register user > update user |
| 40 | 41.14 s | × | register arbitrator > register arbitrator |
| 41 | 37.49 s | × | register arbitrator > update arbitrator |
| 42 | 36.72 s | × | job posting > post two jobs |
| 43 | 35.86 s | ✓ | register user > register user |
| 44 | 34.34 s | ✓ | admin > pause/unpause |
| 45 | 32.72 s | × | job posting > post job with unregistered arbitrator |
| 46 | 32.11 s | × | job posting > post job with arbitrator same as creator |
| 47 | 24.11 s | ✓ | unicrow params > set unicrow contract addresses |
| 48 | 20.98 s | ✓ | admin > non pauser cannot unpause |
| 49 | 20.13 s | ✓ | unicrow params > set unicrow markeplace address |
| 50 | 19.60 s | ✓ | admin > set version |
| 51 | 18.29 s | × | job posting > post job 1 |
| 52 | 18.04 s | × | job posting > post job with invalid mece tags |
| 53 | 15.74 s | × | job posting > post job with whitelist |
| 54 | 15.33 s | × | job posting > post job with invalid token |
| 55 | 14.81 s | × | job posting > post job with invalid amount |
| 56 | 14.64 s | × | job posting > post job with invalid title |
| 57 | 14.58 s | ✓ | job posting > post job with invalid deadline |
| 58 | 14.55 s | × | job posting > post job with invalid delivery method |
| 59 | 7.52 s | ✓ | admin > can not call initializer |
| 60 | 6.08 s | ✓ | mece tags > update mece tag |
| 61 | 3.24 s | ✓ | mece tags > remove mece tag |
| 62 | 2.53 s | ✓ | mece tags > read mece tag |
| 63 | 1.96 s | ✓ | admin > non pauser cannot pause |
| 64 | 1.73 s | ✓ | admin > non owner cannot transfer owner |
| 65 | 1.47 s | ✓ | admin > non owner cannot set version |
| 66 | 0.26 s | × | job posting > post job from unregistered user |
## m1-run-15.log — 17/66 — 2026-09-30 04:04 — `a62c78ef8`

- 49 failed | 17 passed (66)
- full run: **3095.29 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3082.5 s**, median **50.99 s**
- first title (the fixture's deployment): **357.3 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 357.27 s | ✓ | admin > transfer owner |
| 2 | 75.69 s | × | dispute > sanity checks with arbitrator |
| 3 | 74.98 s | × | arbitrate > sanity checks |
| 4 | 72.78 s | × | dispute > dispute creator |
| 5 | 71.63 s | × | approve result and review > approve result |
| 6 | 68.87 s | × | dispute > dispute worker |
| 7 | 67.44 s | × | arbitrate > arbitrate 80-20 |
| 8 | 67.01 s | × | dispute > sanity checks closed job |
| 9 | 65.68 s | × | refund > refund |
| 10 | 64.93 s | × | refund > sanity checks |
| 11 | 61.39 s | × | deliver result > sanity checks |
| 12 | 59.75 s | × | pay start job > sanity checks |
| 13 | 59.41 s | × | approve result and review > sanity checks |
| 14 | 58.66 s | × | job updates > update job many times, get history |
| 15 | 58.63 s | × | integration test > integration test |
| 16 | 58.30 s | × | take job > take job multiple |
| 17 | 58.22 s | × | refuse arbitration > job not taken |
| 18 | 58.05 s | × | deliver result > deliver result |
| 19 | 56.92 s | × | post thread message > post thread message |
| 20 | 56.32 s | × | refuse arbitration > job closed |
| 21 | 56.28 s | × | job updates > update job |
| 22 | 55.36 s | × | pay start job > pay start job |
| 23 | 54.55 s | × | job worker whitelisting > should whitelist worker |
| 24 | 53.89 s | × | arbitrate > arbitrate 0-100 |
| 25 | 53.60 s | × | arbitrate > arbitrate 100-0 |
| 26 | 53.18 s | × | close job > close job before timeout |
| 27 | 53.02 s | × | withdraw collateral > withdraw collateral |
| 28 | 52.84 s | × | reopen job > reopen job after timeout |
| 29 | 52.19 s | × | job updates > update job arbitrator |
| 30 | 51.73 s | × | take job > take job |
| 31 | 51.52 s | × | refuse arbitration > job taken |
| 32 | 51.33 s | × | post thread message > sanity checks |
| 33 | 50.99 s | × | close job > close job after timeout |
| 34 | 49.84 s | × | take job > sanity checks |
| 35 | 49.77 s | × | reopen job > reopen job before timeout |
| 36 | 49.69 s | × | job updates > update job tags |
| 37 | 49.34 s | × | job updates > update job amounts |
| 38 | 48.80 s | × | dispute > sanity checks no arbitrator |
| 39 | 47.33 s | ✓ | register arbitrator > update arbitrator |
| 40 | 44.90 s | × | register arbitrator > register arbitrator |
| 41 | 43.08 s | ✓ | admin > pause/unpause |
| 42 | 40.83 s | ✓ | register user > update user |
| 43 | 39.45 s | ✓ | register user > register user |
| 44 | 37.05 s | × | job posting > post two jobs |
| 45 | 33.78 s | × | job posting > post job with arbitrator same as creator |
| 46 | 29.96 s | × | job posting > post job with unregistered arbitrator |
| 47 | 28.02 s | ✓ | unicrow params > set unicrow contract addresses |
| 48 | 21.28 s | ✓ | admin > non pauser cannot unpause |
| 49 | 21.03 s | ✓ | unicrow params > set unicrow markeplace address |
| 50 | 20.87 s | ✓ | admin > set version |
| 51 | 18.56 s | × | job posting > post job 1 |
| 52 | 18.47 s | × | job posting > post job with whitelist |
| 53 | 17.69 s | × | job posting > post job with invalid token |
| 54 | 17.44 s | × | job posting > post job with invalid amount |
| 55 | 16.97 s | × | job posting > post job with invalid title |
| 56 | 16.47 s | × | job posting > post job with invalid delivery method |
| 57 | 15.77 s | ✓ | job posting > post job with invalid deadline |
| 58 | 15.75 s | × | job posting > post job with invalid mece tags |
| 59 | 7.72 s | ✓ | admin > can not call initializer |
| 60 | 6.95 s | ✓ | mece tags > update mece tag |
| 61 | 3.84 s | ✓ | mece tags > remove mece tag |
| 62 | 3.16 s | ✓ | mece tags > read mece tag |
| 63 | 2.32 s | ✓ | admin > non owner cannot transfer owner |
| 64 | 2.02 s | ✓ | admin > non pauser cannot pause |
| 65 | 1.67 s | ✓ | admin > non owner cannot set version |
| 66 | 0.25 s | × | job posting > post job from unregistered user |
## m1-run-16.log — 17/66 — 2026-09-30 05:31 — `a62c78ef8` + the record-write landing

- 49 failed | 17 passed (66)
- full run: **3219.07 s** (start to finish, including vitest's own start-up and the reporter)
- per-title times recorded: 66, sum **3205.3 s**, median **54.74 s**
- first title (the fixture's deployment): **347.5 s**

| # | Time | Result | Title |
| --- | --- | --- | --- |
| 1 | 347.46 s | ✓ | admin > transfer owner |
| 2 | 74.53 s | × | refuse arbitration > job taken |
| 3 | 74.40 s | × | post thread message > sanity checks |
| 4 | 71.59 s | × | take job > sanity checks |
| 5 | 70.95 s | × | integration test > integration test |
| 6 | 70.58 s | × | withdraw collateral > withdraw collateral |
| 7 | 70.30 s | × | pay start job > sanity checks |
| 8 | 70.03 s | × | take job > take job |
| 9 | 69.64 s | × | reopen job > reopen job after timeout |
| 10 | 67.37 s | × | pay start job > pay start job |
| 11 | 65.86 s | × | close job > close job after timeout |
| 12 | 65.79 s | × | reopen job > reopen job before timeout |
| 13 | 65.20 s | × | refuse arbitration > job not taken |
| 14 | 64.72 s | × | close job > close job before timeout |
| 15 | 64.51 s | × | job worker whitelisting > should whitelist worker |
| 16 | 63.72 s | × | job updates > update job many times, get history |
| 17 | 63.03 s | × | refuse arbitration > job closed |
| 18 | 62.46 s | × | take job > take job multiple |
| 19 | 61.93 s | × | post thread message > post thread message |
| 20 | 60.85 s | × | deliver result > sanity checks |
| 21 | 60.16 s | × | deliver result > deliver result |
| 22 | 56.97 s | × | job updates > update job |
| 23 | 56.95 s | × | arbitrate > arbitrate 0-100 |
| 24 | 56.87 s | × | refund > refund |
| 25 | 56.77 s | × | arbitrate > sanity checks |
| 26 | 56.58 s | × | job updates > update job amounts |
| 27 | 56.54 s | × | dispute > dispute creator |
| 28 | 56.24 s | × | dispute > sanity checks closed job |
| 29 | 56.19 s | × | arbitrate > arbitrate 80-20 |
| 30 | 55.90 s | × | register arbitrator > register arbitrator |
| 31 | 55.14 s | × | approve result and review > approve result |
| 32 | 54.89 s | × | job updates > update job arbitrator |
| 33 | 54.74 s | × | dispute > dispute worker |
| 34 | 54.31 s | × | dispute > sanity checks with arbitrator |
| 35 | 53.45 s | × | arbitrate > arbitrate 100-0 |
| 36 | 53.38 s | × | job updates > update job tags |
| 37 | 53.16 s | × | approve result and review > sanity checks |
| 38 | 52.89 s | × | refund > sanity checks |
| 39 | 46.66 s | ✓ | register arbitrator > update arbitrator |
| 40 | 43.59 s | ✓ | register user > update user |
| 41 | 43.34 s | × | job posting > post job with unregistered arbitrator |
| 42 | 38.56 s | ✓ | admin > pause/unpause |
| 43 | 38.37 s | × | job posting > post two jobs |
| 44 | 37.60 s | ✓ | register user > register user |
| 45 | 36.93 s | × | dispute > sanity checks no arbitrator |
| 46 | 33.96 s | × | job posting > post job with arbitrator same as creator |
| 47 | 25.89 s | ✓ | unicrow params > set unicrow contract addresses |
| 48 | 24.81 s | ✓ | unicrow params > set unicrow markeplace address |
| 49 | 21.18 s | ✓ | admin > set version |
| 50 | 19.42 s | ✓ | admin > non pauser cannot unpause |
| 51 | 18.96 s | × | job posting > post job with invalid mece tags |
| 52 | 18.91 s | × | job posting > post job 1 |
| 53 | 18.65 s | × | job posting > post job with invalid amount |
| 54 | 18.11 s | × | job posting > post job with invalid delivery method |
| 55 | 17.84 s | × | job posting > post job with whitelist |
| 56 | 17.02 s | × | job posting > post job with invalid title |
| 57 | 16.24 s | × | job posting > post job with invalid token |
| 58 | 15.48 s | ✓ | job posting > post job with invalid deadline |
| 59 | 7.99 s | ✓ | admin > can not call initializer |
| 60 | 6.72 s | ✓ | mece tags > update mece tag |
| 61 | 3.61 s | ✓ | mece tags > remove mece tag |
| 62 | 2.87 s | ✓ | mece tags > read mece tag |
| 63 | 1.99 s | ✓ | admin > non pauser cannot pause |
| 64 | 1.93 s | ✓ | admin > non owner cannot transfer owner |
| 65 | 1.79 s | ✓ | admin > non owner cannot set version |
| 66 | 0.82 s | × | job posting > post job from unregistered user |
