# The marketplace ladder is red at HEAD

**Status: confirmed; the offending commit is being bisected.** At `02de0b9d1` every marketplace title fails at the
shared fixture helper's first `publishJobPost`, in about twenty seconds, on both lanes. This blocks the W4 timings,
the W6 green gate and the W10 landing.

## Reproducer

    cd /Code/cashscript/.worktrees/per-call
    rm -rf .marketplace/cache node_modules/.experimental-vitest-cache
    mkdir -p node_modules/.experimental-vitest-cache
    node packages/solidhat/dist/cli.js compile          # 9 sources -> 19 artifacts, 0 cache hits
    SOLIDCASH_MARKETPLACE_WORKER_HEAP_MB=6144 npx vitest run --config vitest.marketplace.config.ts \
      -t "post job 1$|take job$|approve result$"

    Test Files  1 failed (1)
         Tests  3 failed | 63 skipped (66)
      Duration  25.34s

Each title fails with:

    FramedCallError: the call to "publishJobPost" was refused, so nothing was broadcast:
      validator/1: Program failed an OP_VERIFY operation.
     ❯ FramedFunctionCall.send packages/solidcash/src/framed/call/handle.ts:106:13
     ❯ deployMarketplaceWithUsersAndJob .marketplace/project/test/marketplace.test.ts:571:34

`deployMarketplaceWithUsersAndJob` is the helper every title's setup calls, so this is not one title's wall: the
whole ladder is red. The no-proxy twin fails at the same step with the same cause reached differently -
`FramedCompositionRefusedError`, frame `callee-master-6` of `FakeToken.transferFrom()`,
`revert ERC20InsufficientAllowance(...)`: the pull the entry makes is refused by the token, which is what a lost or
wrongly placed approve/settlement write looks like from the callee's side.

Logs: `{SCRATCH}/w4-worktree-proxied.log` (proxied, one title), `{SCRATCH}/w4-smoke-head.log` (the three smoke
titles).

## Why this is a regression

- `PLAN_MARKETPLACE_66.md` marks #50 `approve result and review > sanity checks`, #51 `approve result` and #52
  `refund > sanity checks` **measured green 2026-10-03**, with both full M2 runs at `66 passed (66)`.
- `PERF_KERNEL_VS_FRAMED.md` records `approve result and review / sanity checks` as **passed** at 1044.307 s in the
  W2 no-proxy measurement, and the proxied `take job` / `approve result` at 62.2 s / 131.8 s at `12c011dfe`.
- Plan section 0 records the post-merge smoke set as proxied 3/3 (`post job 1`, `take job`, `approve result`) - the
  three titles this report shows failing.

`12c011dfe` (2026-10-05 10:21 UTC) is an ancestor of HEAD, so the regression is in the commits between it and
`02de0b9d1`.

## The one artifact that moved

A cold HEAD compile of the nine marketplace sources against the W3 framed baseline
(`docs/framed/SIZE_KERNEL_VS_FRAMED.md`, 2026-10-05):

| contract | W3 framed bytes | HEAD framed bytes | delta |
|---|---:|---:|---:|
| FakeToken | 24303 | 24303 | 0 |
| MarketplaceDataV1 | 110050 | 110050 | 0 |
| **MarketplaceV1** | **135056** | **135920** | **+864** |
| Unicrow | 56258 | 56258 | 0 |
| UnicrowClaim | 21801 | 21801 | 0 |
| UnicrowDispute | 31305 | 31305 | 0 |

`composition.refusedEntries` is 0 everywhere, so the failing entry is admitted and the failure is at execution. The
one script that grew is the contract whose entry fails. This is the leak plan section 0 warns about: "Any new kernel
change can leak into framed the same way: check framed compiles of the marketplace (sizes and
`composition.refusedEntries`) after kernel-side changes."

Sizes: `{SCRATCH}/sizes-worktree.txt` (the 2026-10-05 artifact set), `{SCRATCH}/sizes-harness.txt` (HEAD).

## A false lead, recorded

Swapping the 2026-10-05 artifact set into a HEAD tree does **not** isolate the cause: the constructors then fail
(`deriveDeployCommitments`, `Unicrow.deploy`, `Program failed an OP_VERIFY operation`), because the artifacts and the
SDK/VM are only coherent at the same revision. Any A/B of artifacts must hold the rest of the tree fixed at the
commit the artifacts were compiled at. Log: `{SCRATCH}/w4-ab.log`.

## Bisect (in flight)

Method: a full-copy harness tree (`{SCRATCH}/w4/harness`, no `.git`, 1.9 GB, its own `node_modules`) whose tracked
sources are replaced from `git -C /Code/cashscript/.worktrees/per-call archive <commit>`, then
`npx tsc -b tsconfig.packages.json`, a cold fixture recompile, and the one title
`approve result and review sanity checks$` (pass ~130 s, fail ~16 s). The real repository is read-only to that work.

Verdict table and the offending commit go here when the bisect lands.
