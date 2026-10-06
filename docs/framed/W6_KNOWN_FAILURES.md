# W6: the 14 named solidc failures

The full sequential baseline is `W6_BASELINE.md` (`BASELINE_DONE 2026-10-05T13:24:55Z`,
start commit `295f6eed6`). All 14 rows below failed in that run and keep these classes.
That baseline marks no failure merge-caused. This note is only the section 0 list.

Classified from git on 2026-10-05 at `43b4116e3`. These tests were not re-run. The pass/fail split is the one in `UPSTREAM_PLAN.md` section 0 (9 red on the kernel beta alone, 5 red on framed alone). Git only places the assertion. Merge `1f818ffd0` joined framed `d8166489d` and kernel `d7f3c7ad6` at base `ea7a48e27`. None of the 14 was introduced by that merge. The eight files are unchanged from the merge to `43b4116e3`.

| # | test | file:line | class |
|---|------|-----------|-------|
| 1 | single-tail-return helper with a field-name-colliding local | `packages/solidc/test/solidity-compat/storage-collections.test.ts:1092` | pre-existing kernel |
| 2 | state-pinned external-call targets from proxy storage | `packages/solidc/test/DelegateInference.test.ts:599` | pre-existing kernel |
| 3 | live arithmetic progression for a loop-dependent argument | `packages/solidc/test/ExternalCalls.test.ts:274` | pre-existing kernel |
| 4 | method call on a tuple-ternary-destructured interface var | `packages/solidc/test/ExternalCalls.test.ts:872` | pre-existing kernel |
| 5 | no lowered constant placeholder around a returning external call | `packages/solidc/test/ExternalCalls.test.ts:1040` | pre-existing kernel |
| 6 | replayable necessary conjunct before a later call | `packages/solidc/test/ExternalCalls.test.ts:1052` | pre-existing kernel |
| 7 | self external-function member stored in a struct blob | `packages/solidc/test/solidity-compat/calls-abi.test.ts:300` | pre-existing kernel |
| 8 | conditional local pointer publishes the same entry route | `packages/solidc/test/StructsMappings.test.ts:147` | pre-existing kernel |
| 9 | scalar update arms excluded by dominating terminal guards | `packages/solidc/test/journal-message-bus/KernelDominatedStateBranchAdmission.test.ts:16` | pre-existing kernel |
| 10 | proxy master witness across delegate facet entries | `packages/solidc/test/LargeContractSplitting.test.ts:225` | pre-existing framed |
| 11 | bare `totals[k].addElastic(e)`, statement and expression | `packages/solidc/test/solidity-compat/storage-collections.test.ts:1610` | pre-existing framed |
| 12 | LOCAL-indexed struct-field chain via the array co-spend loop | `packages/solidc/test/ExternalCalls.test.ts:1220` | pre-existing framed |
| 13 | using-for method and a real interface method on the same field | `packages/solidc/test/solidity-compat/libraries-imports.test.ts:637` | pre-existing framed |
| 14 | `this.m[k].addElastic(e)`, both positions | `packages/solidc/test/solidity-compat/libraries-imports.test.ts:710` | pre-existing framed |

Rows 5 and 6 exist only on the kernel parent (`43d479e94`, `9cb6ff519`). The other twelve titles exist on the merge base. Rows 2 and 8 were rewritten on kernel only (`826faf1b6`, `66bd3c77f`); HEAD matches those kernel bodies. Row 13's framed text calls `balanceOf` on the same pointer; kernel `4bc339555` moved that to a second pointer, and HEAD has the kernel text. The plan's "red on framed alone" for that row is the pre-merge framed assertion, not a new merge failure.

Counts: pre-existing kernel 9, pre-existing framed 5, merge-caused 0. Every other
failure from the 2026-10-05 sequential run is listed in `W6_BASELINE.md`.
