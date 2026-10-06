# W8 preparation: upstream merge distance, conflict surface, and port plan

Read-only measurement at `feat/per-call` = `48e4c4f62` (2026-10-06). Nothing merged, fetched, or checked out.

## 1. The remote already exists (corrects the plan's setup note)

`/Code/cashscript` already configures `cashscript` = `https://github.com/CashScript/cashscript.git` (plus `mew`
and `private`), and it is already fetched. A live `git ls-remote ... HEAD` returns
`71a243b656e61c36e91384d23351dd106b0a4c40`, which is exactly the local `refs/remotes/cashscript/master` tip, so
the local fetch is current on 2026-10-06. The W8 agent does **not** need to add a remote. `refs/remotes/cashscript`
holds 23 refs, including `master` and `next` (both 2026-09-29).

## 2. Distance

- merge base: `a34616620` (2026-05-26, "Merge pull request #370 from CashScript/next")
- upstream `master` since the base: **22 commits**, 85 files
- our side since the base: 7,489 commits, 4,432 files
- paths changed on both sides: **65** (`comm -12` of the two `git diff --name-only` sets)

## 3. The rename makes this a port, not a resolve

Our tree renamed the packages: `packages/cashc` -> `packages/solidc` and `packages/cashscript` ->
`packages/solidcash`. Neither upstream directory exists locally (`packages/` holds `create-solidhat`, `solidc`,
`solidcash`, `solidhat`, `testing`, `utils`), and git reports the base-to-ours diff for those paths as
`D packages/cashc/src/compiler.ts` + `A packages/solidc/src/compiler.ts`. Upstream's ~50 package-file changes
therefore arrive as delete/modify on paths that no longer exist, and the merge must apply each change by hand to
its renamed target. Only `packages/utils/**`, the website, and root config can merge with path identity.

## 4. The 22 commits, classified (`sha | files pkgs web other | subject`)

Behavioural, must be ported:

| commit | files | subject | port target |
|---|---|---|---|
| `f05ef0dd5` | 3 | size placeholder P2PKH inputs at their signed size | `solidcash/src` fee estimation |
| `1024ddf5f` | 8 | more local validation checks on TransactionBuilder | `solidcash/src/TransactionBuilder.ts` |
| `57ca18b17` | 1 | calculateTransactionFee on TransactionBuilder | same file |
| `42e8ad81d` | 14 | Add source tags for stack cleanup and loop condition | `packages/solidc/src/generation` |
| `8964e5d7c` | 12 | Return UTXO from MockNetworkProvider.addUtxo() | `packages/solidcash/src/network`, tests |
| `cd1c74589` | 5 | Allow for custom syntax error listeners in compileString/compileFile | `packages/solidc/src` |
| `b7119e195` | 2 | Fix missing location data in tuple assignment errors | `packages/solidc/src/ast`, semantic |
| `1597840a1` | 2 | Improve ParseError messages | `packages/solidc/src/Errors.ts` |
| `5d8f3cba2` | 1 | Export ast/Location in cashc | `packages/solidc/src/index.ts` |
| `4c46aa351` | 1 | Small update to test case | the matching test |

Documentation and config, can be taken wholesale with path mapping: `52b2be621` (33 files, Docs improvements
#409), `1ef2f3d87` + `5303f9949` (supporters page + spellcheck ignore), `02e63a00f` (WalletConnect title),
`dd3694442`, `53f286b59`, `1c37959fc`, `92bd877d0`, `71a243b65` (CI comment).

Do **not** take: `b5248b51a`, `a4f112abb`, `bd95aa5b7` (version bumps to upstream's 0.13.1 / 0.13.2 / 0.13.3).
Our landing target is the local `solidcash_v0.13.1` line, which is a different release train; adopting upstream's
version numbers would misstate what is being released. Read them for their changelogs only.

Note for the fee work: `f05ef0dd5` upstream is titled "size placeholder P2PKH inputs at their signed size",
which is the same class as the SDK fee-estimation shortfall recorded in `W6_STATUS.md` for
`KernelMultiContinuationResourceCompose` (fee 33353 versus the 43528 the final 43.5 KB transaction needs). Porting
it is worth doing before attempting that item again, and it may remove the shortfall outright.

## 5. Recommended execution order (one quiet window)

1. Confirm the window and that no other agent is writing to `/Code/cashscript` (check `/proc/*/cwd` per the
   plan's rule, not by killing anything).
2. Port in the order above, behaviour first, docs last, each as its own commit on `feat/per-call` with the
   upstream sha named in the message (the branch already uses the `(rescued <sha>)` convention). Keep the
   package renames: never create `packages/cashc` or `packages/cashscript` paths.
3. Skip the three version-bump commits; record why in `docs/per-call/DECISIONS.md`.
4. After the last port: one-shot `yarn build`, `yarn lint`, then the compiler and SDK suites once each
   (`--maxWorkers=2..3`), and compare the failure list against `docs/per-call/W6_BASELINE.md`. Any *new* failure
   is a port defect; the recorded pre-existing rows must not grow.
5. Re-pin whatever upstream's `42e8ad81d` (source tags) and `1597840a1`/`b7119e195` (error text) move in our
   pinned test expectations, in the same commits as the port that moved them.

Do the W5 rename *after* this merge, as the plan sequences it, so the rename is applied once to the merged text.
