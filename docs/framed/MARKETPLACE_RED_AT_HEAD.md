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

## Bisect result: `246cdfd74`

**First bad commit:** `246cdfd746153280b517711811cf9fc39166f7db` -
`fix(sdk): expose the logical CREATE address from getAddress` (2026-10-05 14:40:41 UTC). It touches
`packages/solidcash/src/stateful/ContractFactory.ts` and `packages/solidcash/src/stateful/StatefulContract.ts`.
Its message says a framed deployment kept `addrV(category)` in front of the logical CREATE address, so `getAddress()`
was not the address holding the SCID anchor; `target` now returns the logical address, `address` still returns the
framed execution lock, and the factory registers both.

**Last good commit before it:** `a04d069833ca636a37821e3a5f7ff02ce9e48260` (test-only, one line, code-identical in
behaviour to `abf1049ff`, which was run and passes).

Verdict table, oldest to newest on the first-parent line:

| commit | time (UTC) | subject (short) | verdict |
|---|---|---|---|
| `12c011dfe` | 10:21 | solidcash: trace a broadcast's bytes ... | PASS |
| `c3b274eb5` | 12:30 | feat(testing,sdk): logicalIdentity knob for deploy addresses | PASS |
| `7088b6d6e` | 13:32 | fix(testing): compare untyped byte arrays | PASS |
| `e6138b321` | 13:39 | fix(solidc): narrow a disk-hit delegate | PASS |
| `fa34859806` | 13:41 | fix(sdk): keep one return channel | PASS |
| `f8c8db06f5` | 13:45 | docs(per-call): W11 status (docs-only, = `fa34859806`) | PASS (source) |
| `2c19e710e` .. `8d4ea3bb61` | 13:45 - 14:48 | 25 commits, including `0d0600fc9`, `abf1049ff`, `246cdfd74`, `4b3d529be` | **does not compile** |
| `bbab3e0e00` | 14:53 | fix(solidc): treat a tuple-declared interface local as a call receiver | FAIL (unmodified) |
| `02de0b9d1` | 10:30 | refactor(framed): drop the deprecated aliases | FAIL (unmodified) |

Inside the non-buildable window, four commits were run with one gated, type-only, behaviour-preserving workaround
(`node.name === target.name` -> `node.name === (target as any).name` in `stored-value-source.ts`; the surrounding
filter pins `node.name === access.collection`, so the runtime value is identical): `0d0600fc9` PASS, `7e9b251657`
PASS, `abf1049ff` PASS, `246cdfd74` **FAIL**. The workaround cannot manufacture that failure: `bbab3e0e00` fails with
an unmodified build, and `fa34859806`/`f8c8db06f5` pass with one.

Two boundaries are worth keeping because the tree layout changed twice in this range:

- unmodified recipe: last good `f8c8db06f5`, first bad `bbab3e0e00`;
- with the workaround: last good `a04d069833`, first bad `246cdfd74`.

### The non-buildable window (a finding of its own)

A type error exists from `2c19e710e` (2026-10-05 13:45:36, the `const deletion = target instanceof MappingDeleteNode`
refactor) through `8d4ea3bb61` (14:48:49):

    packages/solidc/src/semantic/stored-value-source.ts(170,69): error TS2339: Property 'name' does not exist on type 'Node'.

`bbab3e0e00` fixes that line to read `access.collection`. Twenty-five commits on the branch do not typecheck, which
is why the plan's rule about running `yarn build` before handoff matters; the fix is only eleven commits later, so
nothing on `feat/per-call` past `bbab3e0e00` is affected.

### Recipe correction used for the bisect

`git archive` writes files with commit-time mtimes, which are older than the `*.tsbuildinfo` already in a copied
tree, so `tsc -b` skips every rebuild and serves stale `dist` (`Module '"@solidcash/utils"' has no exported member`).
A bisect (or any archive-based tree refresh) must delete the `*.tsbuildinfo` files first and build with
`tsc -b ... --force`.

### Next

A worker is testing whether reverting `246cdfd74` at HEAD restores the title, and whether a minimal variant (only
`target` returning the logical address, or only the factory's dual registration) is enough. That result decides
whether the fix is a correction to the framed address convention or a revert of a kernel-oriented change that leaked
into framed, which is the leak plan section 0 warns about.

Cycles: 15 harness cycles; logs in `{SCRATCH}/w4/bisect/` (`<commit>.log`, `<commit>.patched.log`).
