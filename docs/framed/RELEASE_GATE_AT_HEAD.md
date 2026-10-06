# Release gate scripts at HEAD

## Scope, revision, method

- Worktree `/Code/cashscript/.worktrees/per-call`, branch `feat/per-call`.
- HEAD at the start and the end of every run: `eb8f193d5` (`docs(framed): close the W4 artifact-size item`).
  No source or test file changed while the scripts ran.
- Each script ran once, sequentially, from the worktree root, wrapped in `timeout 5400`. A failing script was
  re-run once with more output (details below).
- Wall time is seconds measured around the `yarn` invocation. The box was loaded by another worker's ladder,
  so these times are the observed values only and must not be read as idle-machine durations.
- Logs (cited per row): `/tmp/grok-goal-4b830698eeec/implementer/relgate/<name>.log`.

## Result table

| # | script | exit | wall (s) | one-line result |
|---|---:|---:|---|
| 1 | `yarn examples` | 1 | 12 | crash: the resolved source module has no export `CompilerTokenWriterGroup` |
| 2 | `yarn test:package-smoke` | 0 | 263 | six packages packed; temp-consumer golden path passed |
| 3 | `yarn test:docs-snippets` | 1 | 12 | 153 snippets compiled, 0 failed; the bare-`tsc` half hit TS2688 |
| 4 | `yarn test:corpus-baseline` | 0 | 0 | 2698/2805 positive, 323/2158 over-accepted; scorecard hash matches |
| 5 | `yarn test:application-conformance` | 1 | 25 | 6 failed / 96 passed, all in `test/e2e/Upgrade.test.ts` |
| 6 | `yarn test:generated-project-smoke` | 0 | 44 | init, compile-cache, and example-project paths all passed |
| 7 | `yarn test:security-conformance` | 0 | 166 | 15 adversarial cases passed |
| 8 | `yarn test:kernel-beta:local` | 1 | 1 | aborted at the vocabulary check before build or tests |
| 9 | `yarn spellcheck` | 123 | 48 | 902 issues in 229 files |

## Failures in detail

### 1. `yarn examples` -- NEW

Log: `examples.log`. The first file (`tsx examples/p2pkh.ts`) died before any output with:

    SyntaxError: The requested module './value-chunk-geometry.js' does not provide an export named
    'CompilerTokenWriterGroup'
      at packages/solidcash/src/stateful/StatefulTransactionBuilder.ts:81

`value-chunk-geometry.ts` declares `export type CompilerTokenWriterGroup` (line 218); the builder imports it in a
value-position import list without `import type`. `yarn examples` runs under `tsx`, which resolves the
`solidcash` package through the root tsconfig `paths` (`solidcash -> solidcash/src`), so the TS source is
executed and the erased type-only export is absent at runtime. A `tsc` build and the built `dist` elide the
import, so only this source-resolving path fails. Re-run once: identical crash. No baseline row exists (the
`W6_BASELINE.md` run was vitest suites, not `examples`), so this is NEW.

### 3. `yarn test:docs-snippets` -- environment, NEW

Log: `test-docs-snippets.log`. The snippet half is green:

    docs snippets: 79 files, 317 blocks, 160 standalone, 153 compiled, 7 skipped, 0 failed

The second half writes a probe that imports every documented SDK name and hands it to bare `tsc`; that half
aborted:

    documented SDK imports: 57 names across 3 packages, UNRESOLVED
    error TS2688: Cannot find type definition file for '@types'.
      The file is in the program because:
        Entry point for implicit type library '@types'

Root cause is the container, not doc rot: `node_modules/@types/@types` is a self-referential symlink to
`node_modules/@types`, and a `tsc` run with default options includes every `node_modules/@types` entry and
fails on that one. Reproduced outside the script with a trivial file:
`npx tsc --noEmit --skipLibCheck --module nodenext --moduleResolution nodenext /tmp/probe-empty.ts` emits the
same TS2688. Classification: environment, NEW (no `docs-snippets` row in `W6_BASELINE.md`).

### 5. `yarn test:application-conformance` -- NEW

Log: `test-application-conformance.log`; verbose re-run `test-application-conformance-rerun.log`.

`Test Files 1 failed | 8 passed (9)`, `Tests 6 failed | 96 passed (102)`. All six are in
`packages/solidcash/test/e2e/Upgrade.test.ts`, each with the same error:

    Error: mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input
    index 0: Program failed an OP_VERIFY operation.)

Titles:

- state extension (V1 -> V3 with new state variable) > should upgrade from V1 to V3 and initialise new field
  with default
- state extension (V1 -> V3 with new state variable) > should use V3 logic after upgrade (incrementWithBonus)
- state extension (V1 -> V3 with new state variable) > should chain V1 -> V2 -> V3 upgrade preserving state
  throughout
- state extension overflowing into new data NFT > should mint new data NFT when state overflows to second NFT
- state extension overflowing into new data NFT > should use V2 logic with new data NFT after overflow upgrade
- overflow data NFT run under a signature over all outputs > settles under SIGHASH_ALL, and refuses a new data
  NFT off the covenant, a gap, a detached extra, or an old one left unspent

The file was re-run in isolation with `--reporter=verbose`: the same 6 fail, so this is not run-order or
parallelism. Classification: NEW. `W6_BASELINE.md` has no `test/e2e/Upgrade.test.ts` row, and none of the six
is among the 14 `W6_KNOWN_FAILURES.md` titles. `W6_FULL_SUITE_AT_HEAD.md` reached the same six and also
classes them NEW.

### 8. `yarn test:kernel-beta:local` -- NEW

Log: `test-kernel-beta-local.log`. The gate aborts in about one second, before build or tests, with:

    Error: kernel implementation added application-shaped production names:

It then lists four added production comment lines. The check scans lines added since the manifest's
`censusCommit` (`95fbe8f3c`) over `packages/*/src` for a case-insensitive application-name vocabulary drawn
from `scripts/kernel-beta-manifest.json`. Every offending line is a comment. Exact text is in the log; no
baseline doc records this gate failing. Classification: NEW.

### 9. `yarn spellcheck` -- NEW (not one of the plan's named gates)

Log: `spellcheck.log`. `git ls-files -z | xargs -0 cspell lint` ran in three batches and exited 123.
Totals: 902 issues in 229 files (batch summaries `530 in 1688 files`, `324 in 2040 files`, `48 in 401 files`).
By area: 363 in `packages/*/src`, 225 in `packages/*/test`, 148 in root `*.md`, 149 in `docs/framed/`,
1 in `website/docs`, 4 in `scripts/`.

A configuration exists (`.cspell.json` plus `.cspell-project-terms.txt`), so this is a dictionary that does not
yet cover the branch's own vocabulary (kernel identifiers such as `SCJD`, `SCKP`, `HOPTRACE`, `prestate`, and
the working-note prose), not a missing tool.

## Readiness verdicts

- **Packaging** -- GREEN. `test:package-smoke` (exit 0) packs the six published/workspace packages, installs them
  into a temp consumer, and runs a golden-path spend. This covers install and runtime; it does not check the
  version strings, changelog, or migration guide that section 3 item 5 also asks for.
- **Docs snippets** -- AMBER. The snippet-compile half is green (0 failed of 153 compiled); the documented-import
  half could not run (TS2688, environment), so the item is unverified rather than failed on its merits.
- **Corpus baseline** -- GREEN. `test:corpus-baseline` (exit 0) matches the retained Solidity-corpus scorecard
  against `release-baseline.json`, 2698/2805 positive and 323/2158 over-accepted, hash unchanged.
- **Application conformance** -- RED. `test:application-conformance` exits 1 with the six `Upgrade.test.ts`
  failures above.
- **Generated project smoke** -- GREEN. `test:generated-project-smoke` (exit 0) covers generated-project
  init+test, the incremental compile cache (cold/warm/invalidated/clean), and the example testing-suite golden
  path.
- **Security conformance** -- GREEN. `test:security-conformance` (exit 0) runs 15 adversarial cases including
  message-envelope and emitted-return forgery and shipped-proxy regeneration.
- **Kernel gate** -- RED. `test:kernel-beta:local` aborts at the vocabulary check, so its build, journal and
  regression commands, and its fixture-freshness/cold-compile checks never ran.

Two further results sit outside the seven named items. `yarn examples` (section 3 item 10) is RED with the
source-export crash. `yarn spellcheck` is RED, but the plan's section 3 does not list spelling as an item.

## Readiness items no script here covers

- Item 1 (Model B address representation): no script.
- Item 2 (security triage): `test:security-conformance` covers adversarial cases and the envelope/return forgery
  audit, but not the `msg.sender` forgeability note or a lenient-`revertedWith` transcript.
- Item 3 (regtest consensus realism): `scripts/release-application-regtest.mjs` exists but needs the
  `docker-compose.regtest.yml` stack, which is not part of this container run.
- Item 4 (release hygiene): non-ASCII bytes, over-125-column lines, debug hooks, and root working notes have no
  script.
- Item 6 (compile time): only the incremental-cache path runs (in generated-project-smoke); the pathological
  bus-off compile has no gate.
- Item 7 (determinism / stale fixtures): the kernel manifest covers it (`generated-artifacts`
  artifact-freshness and `coldCompiles`), but the vocabulary abort means those commands did not run, so
  determinism is not established by this pass.
- Item 8 (CI) and item 9 (compatibility matrix): no script.

## What W6 still needs after these scripts

- The kernel gate must be unblocked (the four added comment lines drop the forbidden vocabulary, or the
  manifest census moves) before its build, journal, and determinism commands can be judged.
- The six `Upgrade.test.ts` failures and the `yarn examples` source-export crash must be fixed or filed in
  `W6_KNOWN_FAILURES.md` with a class; both are NEW and currently unowned.
- The `@types` self-symlink in `node_modules` must be resolved (or the docs-snippets probe given an explicit
  `types`/`typeRoots`) before the documented-import half can be called green.
- Spellcheck needs a curated dictionary and an exclude set before it could be adopted as a gate.
- The uncovered items (regtest, CI, compile time, hygiene, determinism, Model B, compatibility matrix) need a
  route of their own; none of these scripts reaches them.
- The whole gate should be re-run once on an idle box, because every wall time here was taken under another
  worker's load.
