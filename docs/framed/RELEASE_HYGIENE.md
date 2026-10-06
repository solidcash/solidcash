# Release hygiene: measured state of the section-3 readiness items

Measured at `feat/per-call` = `48e4c4f62` (2026-10-06), all read-only. "Changed src" below means the 579 files
under `packages/solidc/src`, `packages/solidcash/src` and `packages/utils/src` that differ from
`solidcash_v0.13.1` (`9fd8cd52b`). Nothing here has been fixed; each finding names the decision it needs.

## 1. Packaging (verified)

`npm pack --dry-run` per published package, run inside each package directory:

| package | version | tarball | unpacked | files |
|---|---|---|---|---|
| `solidc` | 0.13.1 | 6.0 MB | 31.8 MB | 507 |
| `solidcash` | 0.13.1 | 5.8 MB | 25.2 MB | 1,472 |
| `@solidcash/utils` | 0.13.1 | 384.9 kB | 1.6 MB | 114 |

Every tarball contains only `dist/**` plus `package.json` (each package has its own `.npmignore`); no test,
source, or documentation file leaks in, and no root-level file can leak because the root `package.json` is
`private: true`. The three declared versions already read `0.13.1`, matching the landing target, and the dry runs
wrote no `.tgz` (verified with `find`). Root `.npmignore` (`*`, `!dist/**`, `!index.*`) is therefore inert.

## 2. Environment knobs in shipped source (decision needed)

`packages/solidc/src/solidc-env-registry.ts` registers 61 `SOLIDC_*` names. Most of the `SOLIDC_DEBUG_*` family
only adds logging, but these change what the compiler publishes or how it caches, and they ship in `dist`:

- output-shaping: `SOLIDC_NO_OPTIMISE`, `SOLIDC_HANDLER_BAND_MODEL`, `SOLIDC_OWNER_ALT_ANCHOR`,
  `SOLIDC_ROUTE_ABI_TAIL`, `SOLIDC_SKIP_MESSAGE_BUS_BINDER`, `SOLIDC_SKIP_ROW_RESULT_RESOLVER`,
  `SOLIDC_COMPACT_ARTIFACT`, `SOLIDC_DISABLE_JOBEVENT_DETACH`
- validation behaviour: `SOLIDC_ROW_ASSERT`, `SOLIDC_ROW_HEAD_CHECK`, `SOLIDC_ROW_STACK_CLEAN`,
  `SOLIDC_STRICT_UNKNOWN_ENV`
- caching: `SOLIDC_COMPILE_CACHE`, `SOLIDC_COMPILE_CACHE_BUILD_ID`, `SOLIDC_COMPILE_CACHE_DIR`,
  `SOLIDC_COMPILE_CACHE_MAX_ENTRIES`
- oracle/parse: `SOLIDC_ROUTE_PARSE_ORACLE`, `SOLIDC_DUMP_ROUTE`

Across the changed src there are 220 distinct `SOLIDC_DEBUG_*` / `SOLIDC_TRACE_*` / `SOLIDC_DUMP_*` strings (219
of them in changed files, i.e. this branch added essentially all of them), and 595 lines begin with
`console.error(` or `console.log(`. Sampling shows those calls are reached through gates rather than
unconditionally: `compiler.ts` routes profiling through `profileLog()`, which returns unless
`SOLIDC_PROFILE === '1'`, and the `console.log` hits in `ast/AST.ts` are user-facing warnings (two decimal-literal
truncation warnings, seven `console.warn(`), not debug output. The SDK-side knobs are not all registered (for
example `SOLIDC_DEBUG_PREDOUT`, added by W6), so the registry is not a complete inventory.

Decision needed before the tag: keep the debug family (they are the W6 diagnostic protocol and the marketplace
harness recipe depends on some of them), and either document or remove the output-shaping family. This is a
policy call, not a defect: no knob is read at import time, so a shipped package behaves identically unless a user
sets one.

## 3. Non-ASCII characters (no action taken)

25 of the 579 changed src files contain non-ASCII bytes. Sampled with `grep -oP` and decoded, they are UTF-8
em dashes (`U+2014`) inside comments (for example 12 occurrences in
`packages/solidcash/src/message-bus/compose-assemble.ts`, 3 in `packages/solidc/src/per-call/master/master-program.ts`).
Repo-wide the count is 341 files under `packages/*/src`, dominated by the generated ANTLR files
(`grammar/SolidCashParser.ts`, `grammar/SolidCashLexer.ts`) and `grammar/SolidCash.g4`. A mechanical ASCII pass
would edit prose in 25 files of the branch; it is safe but large, so it belongs in its own commit (or in the W5
rename commit, which already rewrites the per-call files' text).

## 4. Over-long lines (pre-existing, no action taken)

332 lines exceed 125 characters under `packages/*/src`. They are concentrated in generated or exempt files:
`packages/solidc/src/grammar/SolidCashParser.ts` (ANTLR output, single lines up to 268 characters) and
`packages/create-solidhat/src/cli.ts:6` (256 characters, a template literal). eslint's `max-len` does not flag
them because they are not lint targets, so the "lines <= 125" convention holds for hand-written source.

## 5. Root-level working notes (repository cleanliness, not packaging)

40 tracked `*.md` files sit at the repository root, 34,496 lines in total. 26 of them are agent working notes,
not project documentation: `HANDOFF_*` (6), `GOAL_*` (4), `KERNEL_*` (4), `NEXT_SESSION_*` (3),
`MESSAGE_BUS_*` (2), `PERF_*` (2), `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md`, `FENCE_MAP_7_18.md`,
`READY_TO_PROMOTE_KERNEL_FIXTURES.md`, `REEVAL_STILL_OPEN.md`, `SESSION_FINDINGS_QUEUE_ITEMS_1_2.md`.

The root files that are release artifacts and should stay: `README.md`, `DEVELOPMENT.md`, `AGENTS.md`,
`CLAUDE.md`, `COMPARISON.md`, `CONCEPT_VALIDATION.md`, `FEATURES.md`, `FEATURES_SINCE_NEXT.md`,
`RELEASE_NOTES_0.13.1.md`, `RELEASE_READINESS.md`, `RELEASE_READINESS_HANDOFF.md`, `SECURITY-AUDIT.md`,
`SOLIDITY_COMPATIBILITY_0.13.1.md`, `TEST_DEFERRALS_0.13.1.md`.

Because section 1 proves none of them can reach a published tarball, this is a cleanliness call for the
repository, and it interacts with `.worktrees/release-readiness`'s requirement that the release record the exact
commit and known deferrals: moving the notes under a single directory (for example `docs/handoff/`) keeps the
content and the links while clearing the root. Their deletion is the coordinator's call; the two `HANDOFF_*` files
(`HANDOFF_KERNEL_BETA_CURRENT.md`, `HANDOFF_KERNEL_BETA_NEXT_AGENT.md`) carry the only copy of some kernel-lane
context, so they must not be deleted without moving them first.
