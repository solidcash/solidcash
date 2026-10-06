# W8 survey: CashScript commits since the fork

Survey date 2026-10-05. `feat/framed` at `57dfa942e`. Fork point `a34616620` (2026-05-26, "Merge pull request #370 from CashScript/next"). No `cashscript` remote existed before this survey; it is now `https://github.com/CashScript/cashscript.git` (fetch only, no merge yet).

Tips fetched:

| ref | commit | date | subject |
|---|---|---|---|
| `cashscript/master` | `71a243b65` | 2026-09-29 | ci: add pull request stats comment (#467) |
| `cashscript/next` | `ac35856e7` | 2026-09-29 | chore: bump version to 0.14.0-next.7 |
| tag `v0.13.3` | `1c37959fc` | 2026-09-15 | docs: add release notes for v0.13.3 |
| local `master` | `b7119e195` | 2026-06-09 | Fix missing location data in tuple assignment errors |

`cashscript/master` contains the fork. `HEAD..cashscript/master` is 22 commits. `HEAD..cashscript/next` is 77. `cashscript/master..cashscript/next` is 56. Local `master` has the same 8 commits the plan names, and all 8 are inside those 22.

This release merges the stable line (`cashscript/master`, v0.13.3), by adapting the commits below. It does not merge `cashscript/next`. That branch is 0.14.0-next.7, a prerelease, and it includes a breaking `SignatureTemplate` change (#440). A literal rebase of the 7342 SolidCash commits is not the method.

Package names differ (`cashc`/`cashscript` there, `solidc`/`solidcash` here), so a path-wise merge will not apply. Each "adapt" row is a cherry-pick of the behaviour onto the renamed files, or a skip once the behaviour is already present.

## The 22 commits on `cashscript/master` since the fork

| commit | class | decision | reason |
|---|---|---|---|
| `4c46aa351` Small update to test case | tooling | skip | One CashScript test fixture (`bitshift.cash`). No behaviour. |
| `1ef2f3d87` Add supporters page | docs | skip | Website page on the CashScript site. The SolidCash site is a separate tree. |
| `5303f9949` Ignore supporters page for spellcheck | tooling | skip | Follows the supporters page. |
| `cd1c74589` Custom syntax error listeners | compiler | adapt | `compileString` / `compileFile` listener hook. Re-apply on `packages/solidc` if the option is absent. Grammar is untouched, so no ANTLR regeneration. |
| `5d8f3cba2` Export `ast/Location` | compiler | adapt | Public compiler export. Re-apply on `packages/solidc/src/index.ts` if `Location` is not already exported. |
| `52b2be621` Docs improvements (#409) | docs | skip | Broad CashScript website edit. Conflicts with the rebranded docs. |
| `8964e5d7c` `addUtxo` returns the UTXO | SDK | skip | Already present: `MockNetworkProvider.addUtxo` returns `Promise<Utxo>` (`packages/solidcash/src/network/MockNetworkProvider.ts`). |
| `b7119e195` Tuple-assignment error locations | compiler | adapt | Source locations on tuple assignment errors. Re-apply on the symbol and type traversals if those errors still lack a location. One of the 8 local `master` commits. |
| `1597840a1` Improve `ParseError` messages | compiler | adapt | Error text in `packages/cashc/src/Errors.ts` and the error listeners. Re-apply the message text where the SolidCash errors are still the older wording. |
| `92bd877d0` Release notes 0.13.1 and 0.12.2 | docs | skip | CashScript release notes. This landing writes its own changelog. |
| `b5248b51a` Bump version to 0.13.1 | tooling | skip | Their package names and versions. This landing stays `solidcash` 0.13.1. |
| `02e63a00f` WalletConnect guide title | docs | skip | Their website guide. |
| `42e8ad81d` Source tags for stack cleanup and loop condition | compiler | adapt | Debug source tags in the generator, plus fixture regeneration on their side. Take the tag behaviour only. Do not take their regenerated fixtures. If a parser is not regenerated, decision constants stay as pinned. |
| `57ca18b17` `calculateTransactionFee` | SDK | adapt | Not present under that name in `packages/solidcash/src`. Port the method onto `TransactionBuilder`. |
| `1024ddf5f` More `TransactionBuilder` validation | SDK | adapt | Local checks and the errors they raise. Port the checks. Their e2e edits are CashScript-named and are not copied. |
| `dd3694442` Docs for 0.13.2 | docs | skip | Their release notes and transaction-builder page. |
| `a4f112abb` Bump version to 0.13.2 | tooling | skip | Their versions. |
| `53f286b59` Spellcheck | tooling | skip | `.cspell.json` only. |
| `f05ef0dd5` Size placeholder P2PKH inputs at their signed size (#444) | SDK | adapt | Fee estimate uses the unsigned size of a placeholder P2PKH input. Port the size constant and the builder change. Covered by their `TransactionBuilder` test; add the equivalent on the SolidCash test file. |
| `bd95aa5b7` Bump version to 0.13.3 | tooling | skip | Their versions. |
| `1c37959fc` Release notes for v0.13.3 | docs | skip | Their notes. The fee fix they describe is the adapt row above. |
| `71a243b65` PR stats comment (#467) | tooling | skip | Their GitHub workflow. |

The 8 local `master` commits not in HEAD are `4c46aa351`, `1ef2f3d87`, `5303f9949`, `cd1c74589`, `5d8f3cba2`, `52b2be621`, `8964e5d7c`, `b7119e195`. Three of them are adapt (`cd1c74589`, `5d8f3cba2`, `b7119e195`). One is already present (`8964e5d7c`). Four are skip.

## `cashscript/next` (not in this release)

56 commits on top of `cashscript/master`, from "Add minimal user-defined functions" (`0.14.0-next.0`) through `0.14.0-next.7`. Classes, all **skip for this release**:

| class | examples | why skip now |
|---|---|---|
| compiler features | user-defined functions (#413), multi-return (#423), global constants (#426, #431), `unused` modifier (#425), tuple reassignment (#436), node_modules imports, peephole opts (#451, #458), in-memory import resolution | SolidCash already has functions, constants, and a much larger generator. Taking these diffs would fight 7,000 later commits. Revisit after the release, file by file, not as a merge. |
| compiler fixes | init-reassign for-loop (#466), nulldata chunk size (#465), `slice()` final-use (#464), debug scope tags (#463), audit findings (#452) | Same. Each is a candidate to re-check against `packages/solidc` after the release, not to merge blind. |
| SDK | `SignatureTemplate` breaking change (#440), input locking-bytecode check, `MockNetworkProvider` resubmit, electrum-cash and vitest bumps (#448), SDK audit (#454) | Breaking SDK change is outside 0.13.1. Dependency bumps wait on the libauth decision in `PERF_LIBAUTH.md`. |
| docs / versions | release notes, guide restructure, version bumps | Their site and their version numbers. |

## Merge shape (phase 2, not done here)

Do it in a scratch worktree. No parser change is in the adapt set, so ANTLR 4.13.2 does not need a regeneration and `compiler.ts` decision constants stay pinned. If a later adapt touches the grammar, regenerate with 4.13.2 and re-pin those constants before the gate. Libauth stays on the decision in `PERF_LIBAUTH.md`; do not take upstream's libauth bump if it drops the `perf-vm-fixes` commits.
