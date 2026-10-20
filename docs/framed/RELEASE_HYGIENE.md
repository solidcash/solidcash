<!-- cspell:ignore Δowner Δdepth incomplet faile inpu ntify ompute ddbb eate cabb unpublised materalized rebuit Strasse Deltaowner Deltadepth -->
# Release hygiene: measured state of the section-3 readiness items

Measured at `feat/framed` = `48e4c4f62` (2026-10-06), all read-only. "Changed src" below means the 579 files
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
`packages/solidcash/src/message-bus/compose-assemble.ts`, 3 in `packages/solidc/src/framed/master/master-program.ts`).
Repo-wide the count is 341 files under `packages/*/src`, dominated by the generated ANTLR files
(`grammar/SolidCashParser.ts`, `grammar/SolidCashLexer.ts`) and `grammar/SolidCash.g4`. A mechanical ASCII pass
would edit prose in 25 files of the branch; it is safe but large, so it belongs in its own commit (or in the W5
rename commit, which already rewrites the framed files' text).

## 4. Over-long lines (pre-existing, no action taken)

332 lines exceed 125 characters under `packages/*/src`. They are concentrated in generated or exempt files:
`packages/solidc/src/grammar/SolidCashParser.ts` (ANTLR output, single lines up to 268 characters) and
`packages/create-solidhat/src/cli.ts:6` (256 characters, a template literal). eslint's `max-len` does not flag
them because they are not lint targets, so the "lines <= 125" convention holds for hand-written source.

## 4a. `yarn lint` (measured 2026-10-09, fixed)

`yarn lint` is one of the release gate commands, and it was failing with 948 errors: 918 in two `solidc` test
files (`test/generation/fixtures.ts` 917, the pasted artifact dumps disagreeing with `indent`/`quotes`/
`comma-dangle`; `test/SecurityCovenantAuthorization.test.ts` 1) and 30 in `solidcash`, of which 29 were dead
code the leaf-libauth import rewrite left behind (each dropped symbol in a multi-symbol
`@bitauth/libauth` import became a bare `;`, and the superseded import statements stayed) and one a pre-existing
`no-shadow`. The `solidcash` errors had been invisible because lerna stops the run at the first package with
errors, and `solidc` failed first.

All fixed on `feat/per-call` (see `docs/framed/DECISIONS.md` D28); `yarn lint` now reports 0. The
`solidc` failures are older than the SDK work: `039cefe85` reports the same 918 in the same two files.

## 4b. `yarn spellcheck` (measured 2026-10-10, fixed)

`yarn spellcheck` is the release-gate command that follows `yarn lint` in `github-actions.yml`. On `feat/per-call`
it failed with 913 unknown-word occurrences across 235 distinct files: 601 in `packages/**` (mostly source and
tests), 165 in `docs/**` (nearly all `docs/framed/**`), 148 in the root-level working notes, 4 in `scripts/**` and
4 in `website/docs/**`. The 2026-08-05 PASS recorded in `RELEASE_READINESS.md` was measured on the findings-fix
branch against an 890-term dictionary; the framed work had since added vocabulary that dictionary did not carry.

The sweep classified every token and treated three kinds differently:

- **Vocabulary**, merged into `.cspell-project-terms.txt` (953 -> 1,257 entries, inserted in place, deduplicated
  case-insensitively). These are the branch's identifiers, refusals and diagnostics (`UNPLANNABLE`, `PREDOUT`,
  `JOBEVENT`, `SCKP`, `HOPTRACE`, `dests`, `nondecrease`, `reauthenticated`, `rematerialization`, `poolable`,
  `inblock`, the `*OP` opcode-check names), together with the fixture strings, alphabet fragments and worktree
  suffixes the code and notes already carry (`ddee`, `abcdcafe`, the base58 charset fragments, `Uwjd`, `Xmjzl`,
  a German-name fixture, a Greek-letter fixture). Recording fixtures matches the dictionary's earlier entries
  (`abcdefgi`, `aaaabbbbcccc`).
- **Misspellings**, fixed in place rather than recorded: `unpublised` -> `unpublished` (3 occurrences),
  `materalized` -> `materialized`, `rebuit` -> `rebuilt`, and three test titles re-quoted from single-quoted
  strings with an escaped apostrophe to double-quoted ones, so the token reads as an apostrophe.
- **Scoped `cspell:ignore`** in the five files whose flagged tokens are not vocabulary: the mid-word elisions
  inside quoted tool output (`incomplet`, `faile`, `inpu`, `ntify`, `ompute`, `eate`) and the hex or random
  fragments inside pasted dumps (`cabb`, `ddbb`), plus this file and `HANDOFF_MAPPING_WRITE_ADMISSION.md` for the
  Greek-letter deltas of one algebra (`Deltaowner`, `Deltadepth`). That text is quoted evidence, so the tokens are
  declared locally instead of being rewritten or added to the project dictionary.

After the sweep `yarn spellcheck` exits 0 with zero issues. The public `website/docs/**` surface is clean in its
own right (79 files, 0 issues): its one incident word was reworded and `hdsigner` was recorded, since it names a
published `solidcash` subpath.

## 6. The unmerged worktrees: the ideas taken, measured

Measured 2026-10-10 on `feat/per-call`. Eight unmerged worktrees were reviewed and the ideas in two of them were
re-implemented by hand rather than merged; one idea was rejected on measurement. The per-operation numbers are
`npx tsx` micro-benchmarks of this branch's own code (10,000-20,000 warm iterations); a "per title" figure scales
them by the counts the composer instrument already records for `take job` (128 attempts, 127 hosts, 2,362
evaluations).

| change | where | before | after | scale |
|---|---|---|---|---|
| the minimal push of a repeated 9.4 KB redeem script | `utils/framed/primitives.ts` | 8,477 ns | 74 ns | the script is pushed once per master, and every attempt repeated it |
| the argument + redeem tail of a master's unlocking bytecode | `utils/framed/witness-block.ts` | 24,575 ns | 8,292 ns | about 16 us saved per attempt, so about 2 ms per title |
| the P2SH argument stack: `structuredClone` becomes a slice that shares items | `network/createVirtualMachine.ts` | 6.5 us (196 B block), 8.2 us (2 KB), 76.8 us (100 KB) | 66 ns, 51 ns, 49 ns | 2,362 evaluations: about 15 ms at 196 B, about 190 ms at 100 KB |
| the host's stop stack: a hex fingerprint becomes a byte comparison | `framed/composer/shipped-host.ts` | 51,831 ns | 1,559 ns | about 50 us saved per host run, so about 6 ms per title |
| the composer's placeholder rewrite: a full walk becomes an index | `framed/composer/draft.ts` | 25.9 ms at 20k entries x 60 learned; 193.5 ms at 20k x 600 | 16.6 ms; 16.7 ms | one pass per learned value removed: 177 ms at (20k, 600) |
| a filled master, remembered per (artifact, category, program) | `framed/deploy/material.ts` | 80.8 us | 0.18 us | once per repeated deployment |
| the live UTXO read by token category: a scan becomes an index | `network/MockNetworkProvider.ts` | 2.87 ms at 20k entries | 5.5 us | once per read |
| the last `it()` of `IterableMappingSet.test.ts` takes 300 s | `test/e2e/IterableMappingSet.test.ts` | the case runs in 1 s | - | a CI guard, not a win |

Qualification:

- Every entry removes work proportional to a property of the composition - witness-block size, live-set size,
  placeholders times records, repeated deployments - so none is a fixed per-title delta. The bundle sits below the
  resolution of one title comparison: the recorded day-to-day swing on `take job` is 20-50 s, and the wins above sum
  to tens of milliseconds for the shapes measured. They matter as removed work per operation, not as a title time.
- One idea was rejected on measurement. The incremental `operationCost` accumulator from `.worktrees/framed-vm-wins`
  (a running total per metrics object in place of the five-term product) costs 31.7 ns per opcode against the landed
  5.0 ns - **6.33x** - and was not ported.
- The P2SH clone removal is the one semantics-carrying change: the redeem phase shares the stack items instead of
  deep copies of them. libauth's instruction sets assign no stack slot and call no mutating method on an item, and the
  operations this SDK installs only read them, so an item cannot change under the phase that produced it. The array
  itself is still isolated by the slice.
- Two rules the port had to respect, both asserted by the suite: a cache keyed on an artifact must re-check
  `artifact.bytecode` (`test/framed/deploy/program-format.test.ts`), and the host's stop comparison must compare stack
  bytes rather than array identity, or a fill that changed nothing would read as progress.

Cleanup performed 2026-10-10, after that port: 27 worktrees removed (26 under `.worktrees/` plus
`/Code/per-call-libauth`), about 26.5 GB freed. Every branch those worktrees had checked out survives at the same
tip, and each one's uncommitted content was archived to `/Code/worktree-archive-2026-10-10/` (`tracked.patch`,
`status.txt`, `HEAD.txt`, and the untracked files that are not build output). Held back: `eacc-noproxy` and
`eacc-noproxy-kernel-beta` (a live VS Code server has a terminal cwd inside each) and the three Grok CLI worktrees.
What the archive holds that is not on a branch: the ecrecover side-car workstream from
`effectiveacceleration-marketplace` (`ecrecoverRecovery.ts`, `ecrecover-compute-library.ts`, `research/ecrecover-poc/`),
the ungate plan document, `InheritedPrivatePostfixRoute.test.ts` with `autoderive-bench.mjs`, and the rejected
`operationCost` accumulator with its `FastBch2026Every` case.

Not taken, with the reason: the `rescue/main-checkout` lane (its content was rescued onto this branch under new
hashes), the kernel-row-loop lanes (`grok/message-bus-kernel`, `kernel-return-helper-isolated`, `eacc-batch1-gate`,
`codex/eacc-noproxy` - superseded, and 0-70 of their files were rewritten here), the outline worktree's fifth commit
(measured to break five Unicrow e2e tests, and its only safe guard is a no-op), the `PERF_HANDOFF_KERNEL_BETA.md` note,
the EACC local-model harness (`codex/solidhat-marketplace-mock` - it mocks what the release gate exists to execute),
and the scratch configs of the measurement worktrees.

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
