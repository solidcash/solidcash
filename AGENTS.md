# SolidCash -- AI Agent Reference

> Internal agent guidance for this repository. The language, SDK and porting reference is the public file
> `website/static/AGENTS.md`, served at https://solidcash.org/AGENTS.md. Edit the reference there; internal
> rules live only here.

SolidCash is a high-level language for Bitcoin Cash smart contracts with Solidity-compatible syntax. It compiles
`.scash` sources, and `.sol` sources under `evmCompat`, to Bitcoin Script. The repository is a monorepo: compiler
(packages/solidc), SDK (packages/solidcash), shared utils (packages/utils), test framework and Hardhat-style tasks
(packages/testing), and the SolidHat project tool (packages/solidhat, packages/create-solidhat).

## Build & Test

    yarn                  # install + bootstrap + build
    yarn build            # build all packages
    yarn test             # run all tests
    yarn test -t 'name'   # run specific test by name
    yarn lint             # lint all packages

### Fast Development Loop (Use By Default)

For iterative development, do not repeatedly launch one-shot builds and test runners. Their TypeScript and
Vitest startup/import costs dominate focused tests. Keep these processes alive in separate terminals:

    yarn build:watch
    yarn test:compiler:watch -- test/SomeCompiler.test.ts
    yarn test:sdk:watch -- test/unit/SomeSdk.test.ts
    yarn test:e2e:watch -- test/e2e/SomeE2e.test.ts

`build:watch` assumes changes affect direct dependencies to minimize edit latency. This is not the final type
gate: run one-shot `yarn build` before handoff to validate all transitive project references.

For a quick Git-aware check that requires no file selection, use `yarn test:compiler:changed`,
`yarn test:sdk:changed`, or `yarn test:e2e:changed`. These select tests related to uncommitted changes and
exit successfully when no tests are affected. Use them for bounded validation after the target test is green.

In `solidcash`, `test:unit` means only `test/unit`. `test:fast`, `test:changed`, and `test:watch` also cover
top-level SDK regressions but exclude the conformance and journal/message-bus directories. Do not broaden these
development-loop commands; `yarn test` remains the comprehensive non-root-e2e regression gate for major milestones.

During debugging, run only the test currently being made green, optionally with one adjacent test (the target
test +/- 1). Specify its file and `-t 'test name'`; do not run a contract-wide test ladder or full suite.
Vitest reruns affected tests on save; press `r` to rerun the current selection. Once green, validate with a
small, directly affected set of tests. Run full suites only at major milestones such as a beta cut, major
integration, or release, not for ordinary edits or handoffs; they can consume an hour of CPU time. Run the
one-shot `yarn build` before handoff.

Kernel/compiler diagnostic switches are documented in `docs/kernel-diagnostics.md`. Use them on a focused
test, and distinguish trace-only output from switches that alter bytecode, witnesses, optimisation, or timing.
Authoritative cold measurements must use the clean-env gate or scoreboard; never infer production behavior
from an instrumented run.

Always use `test:e2e:watch` for focused e2e watch runs. Do not run `vitest test/e2e <file>`: Vitest treats
positional filters as alternatives, so that form runs every e2e file instead of only `<file>`. The dedicated
e2e watch config restricts discovery while allowing an additional file filter.

The root build uses TypeScript project references. Preserve `tsconfig.packages.json`, package `references`, and
incremental build metadata; do not replace the build with per-package `tsc -p` loops. Generated testing-suite
artifacts only need regeneration when contract sources or emitted compiler JavaScript change; `.tsbuildinfo`
and declaration/source-map timestamp changes must not invalidate them.

Package builds emit to `dist/`. Never emit `.js`, `.js.map`, or generated declaration sidecars (`.d.ts`,
`.d.mts`, `.d.cts`, and their maps) beside TypeScript sources,
tests, scripts, or configs, and never commit such sidecars. The root and testing-suite example tsconfigs are
no-emit; use `yarn build` or `yarn build:watch` for output. `.gitignore` retains explicit exceptions for
authored JavaScript and ambient declarations. Run `yarn check:source-tree` before committing; ignored files
can still be tracked, and authored exceptions must not be deleted as build artifacts. If the guard finds a
tracked generated file, inspect it and untrack that exact path; never bulk-delete `src/` or its declarations.
Do not force-add emitted sidecars or silence the guard. Keep diagnostic switches opt-in and documented in
`docs/kernel-diagnostics.md`; a switch that alters bytecode or SDK settlement is an experiment, not a
production measurement. Remove one-off probes keyed to a contract/function name, literal output index, or
address prefix once the investigation ends; retained probes must describe a reusable type, effect, flow, or VM
boundary. Kernel/compiler/SDK behavior must likewise be selected by type, effect, flow, ABI schema, or authenticated
metadata, never an application, contract, collection, event, or function name. Historical name-based compatibility
is debt: keep it explicitly fenced to legacy artifacts and do not copy or widen it.

After emitted compiler JavaScript changes, a project compile normally expands source selection to a complete rebuild
so it cannot publish mixed-context artifacts. During a local codegen loop, `solidcash compile --iteration <source>`
may regenerate only the requested source. It deliberately leaves the artifact context stale, so a normal
`solidcash compile` still performs the required complete rebuild before handoff.

Yarn workspaces already link local packages during install. Do not restore `lerna bootstrap` to `postinstall`;
it performs a redundant second dependency resolution before the build.

CI installs with `--ignore-scripts` because its next step runs the authoritative explicit build. Preserve that
ordering; allowing workspace lifecycle builds during CI installation compiles the monorepo twice.

## Repository Layout

    packages/solidc/src/grammar/SolidCash.g4   -- ANTLR4 grammar (source of truth)
    packages/solidc/src/ast/AST.ts             -- AST node definitions
    packages/solidc/src/compiler.ts            -- pipeline and ordered lowering passes (~22k lines: grep it)
    packages/solidc/src/semantic/              -- symbol, type-check, final-require and safety passes
    packages/solidc/src/generation/            -- codegen; GenerateTargetTraversal.ts is ~57k lines: grep it
    packages/solidc/docs/                      -- internal language/compiler/SDK reference; tests cite its paths
    packages/solidcash/src/Contract.ts         -- non-stateful contract SDK (the lean `solidcash` root)
    packages/solidcash/src/stateful/           -- stateful SDK (StatefulContract.ts, bundles, lifecycle)
    packages/solidcash/src/network/            -- network providers
    packages/solidcash/src/TransactionBuilder.ts -- transaction building
    packages/utils/src/                        -- artifact/ABI types, script utils, bytecode optimisation
    packages/testing/                          -- @solidcash/testing: Vitest preset, matchers, HRE, `solidcash` CLI
    packages/solidhat/, packages/create-solidhat/ -- SolidHat project tool and its initializer
    website/docs/                              -- public product documentation
    website/static/AGENTS.md                   -- public agent reference: language, SDK, porting, limits
    docs/                                      -- internal ledgers and records; start at docs/README.md
    examples/testing-suite/                    -- Hardhat-style example project
    bench/                                     -- Solidity corpus and application benches

## Compiler Pipeline

    .scash / .sol source
      -> ANTLR4 lexer/parser -> AST (AstBuilder)
      -> import resolution and imported-type repair
      -> ordered lowering passes in compiler.ts (inheritance, modifiers, control flow, memory/Yul, storage
         pointers, arrays/mappings, function pointers, external calls, libraries, block oracles, Solidity forms);
         read the ordering comments before moving a pass
      -> SymbolTableTraversal, TypeCheckTraversal, EnsureFinalRequireTraversal
      -> InjectLocktimeGuardTraversal, EarlyReturnTransformation
      -> GenerateTargetTraversal (Bitcoin Script plus source/debug metadata)
      -> optimiseBytecode (optimiseBytecodeOld stays a compatibility oracle below the operation threshold)
      -> artifact (bytecode, ABI, state/block layouts, function bodies, source, debug info, fingerprint)

## Language and SDK Reference

Read `website/static/AGENTS.md` before writing or reviewing SolidCash source, SDK code or tests. It is the public
reference for the language, the SDK, SolidHat, porting from Solidity and BCH limits, and it is served to users'
agents, so keep it user-facing: no repository paths and no internal rules. Update it when user-visible syntax,
an SDK name or a compiler default changes.
