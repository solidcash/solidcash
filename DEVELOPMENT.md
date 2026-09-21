We use yarn workspaces + lerna for monorepo management. So to get started, clone this repository and run `yarn` in the root directory to install all dependencies for all packages.

Yarn workspaces perform package linking during installation; the postinstall hook goes directly to the
incremental build rather than running a redundant second dependency resolution through `lerna bootstrap`.

When updating code in one package, run `yarn build:watch` once in the repository root. It keeps TypeScript's package graph in memory and propagates changes to dependent packages incrementally. Keep the relevant Vitest process alive in another terminal so transformed compiler modules are reused too:

The watcher uses TypeScript's direct-dependency assumption to minimize edit latency. This is deliberately a
development optimization: always run one-shot `yarn build` before handoff so TypeScript exhaustively validates
transitive dependents.

Build output belongs in each package's `dist/`, never beside `.ts` sources, tests, scripts, or configs. Do
not commit generated `.js`, `.js.map`, or `.d.ts` sidecars. Root and testing-suite example tsconfigs have
`noEmit` to prevent accidental in-place compiles; use project-reference builds for emitted output. Run
`yarn check:source-tree` before committing; it checks ignored files too. The exceptions are authored VS Code
JavaScript, `examples/common-js.js`, and two ambient declarations under `packages/`—keep those tracked.

```bash
# Compiler tests (an optional file or -t filter can follow `--`)
yarn test:compiler:watch -- test/Lexer.test.ts

# SDK unit tests, excluding e2e
yarn test:sdk:watch -- test/unit/EventFiltering.test.ts

# Mocknet e2e tests
yarn test:e2e:watch -- test/e2e/EventsFacade.test.ts
```

Vitest reruns affected tests on save. Press `r` to rerun the current selection. Use the one-shot `yarn build` before handing work off; it uses the same incremental project graph.

For local debugging, select the one test being made green by file and `-t 'test name'`, optionally with one
adjacent test (target +/- 1). Do not run a contract-wide test ladder or full suite during this loop. After
the target is green, run only a small set of directly affected tests for broader validation. Reserve full
suites for major milestones (beta cut, major integration, release), not routine handoffs: they can cost an
hour of CPU time.

When returning to a branch or before choosing a focused file, Git-aware one-shot commands run only tests
affected by uncommitted changes:

```bash
yarn test:compiler:changed
yarn test:sdk:changed
yarn test:e2e:changed
```

The SDK's `test:unit` command runs only `test/unit`; `test:fast` and the default SDK watch loop add top-level
SDK regression tests but deliberately exclude conformance and journal/message-bus suites. The comprehensive
`yarn test` command is unchanged and remains a milestone regression gate.

If you're already in a package directory, you can run:

```bash
pushd ../.. && yarn build && popd
```

### Publishing a release

To publish a new release, we use `yarn update-version 'x.x.x'` in the root directory to bump the version before release, and then `yarn publish-all` in the root directory to publish the release. In case of a tagged release (such as `next`), we use `yarn publish-all --dist-tag <tag name>` to publish the release with the specified tag.

## solidc

### Prerequisites

In order to use the `antlr` command line tool when updating SolidCash's grammar file, you need to have it installed.

On macOS you can install it using Homebrew:

```bash
brew install antlr
```

On Linux you can install it using apt:

```bash
sudo apt install antlr4
```

For other platforms, refer to the [Antlr website](https://www.antlr.org/).

### Updating the grammar

When updating the grammar file in `src/grammar/SolidCash.g4`, we also need to make sure that the generated parser is updated. To do this, run the following command in the `packages/solidc` directory:

```bash
yarn antlr
```

### Running `cashproof`

Most of the bytecode optimisations that the `solidc` compiler uses can be verified for correctness using the [`cashproof` tool](https://github.com/EyeOfPython/cashproof). This tool needs to be installed separately by installing its dependencies using `pip` and cloning its repository from GitHub.

From there, you can run `python <cashproof_path> [filenames]` to verify that the optimisations contained in these files are provably correct.

Example:
```bash
python <cashproof_path> packages/solidc/test/cashproof/0.1.2=0.2.0.equiv
```

Note that if you want to run `cashproof` on the "main" SolidCash optimisations file, you need to first extract the optimisations from the `solidc` compiler and save them in a separate file. This can be done using the following commands:

```bash
cp packages/utils/src/cashproof-optimisations.ts opt.equiv && sed -i '' '/`/d' opt.equiv
python <cashproof_path> opt.equiv
```

### Debugging a VM failure with an unoptimised build

`solidc` folds the generated script with a peephole/structural optimiser, which is what ships. That rewrite moves
instructions, so an instruction pointer reported by a VM failure is only approximately attributable to a source
line (the SDK scans a window of candidate mappings and names the first `require` it finds).

For an investigation where the exact source line matters, compile with optimisation disabled:

```bash
SOLIDC_NO_OPTIMISE=1 solidhat compile      # or: solidc compile, or { optimise: false } in the compiler options
```

Every instruction then keeps the source location that produced it, so the reported instruction pointer maps to
the exact construct and `debug.requires` / `debug.logs` pointers stay exact; failure messages mark such artifacts
as unoptimised. The mode is a debugging aid only: the script is larger and evaluates more opcodes, so it must not
be used for artifacts that are deployed or measured for size. The flag participates in the artifact cache key, so
switching it back and forth recompiles instead of reusing the other mode's artifacts.

## solidcash

### Running tests

By default, running tests in the `solidcash` package runs against a local simulated `mocknet`. To run them against the real-world chipnet, you can use the `TESTS_USE_CHIPNET` environment variable. This uses chipnet contracts, which requires the test accounts to have some chipnet BCH.

```bash
# Major-milestone gate only: run all tests using chipnet
TESTS_USE_CHIPNET=true yarn test
```

During debugging, use the exact `it` title and its file, not a broad `describe` filter:

```bash
yarn test:e2e:watch -- test/e2e/transaction-builder/TransactionBuilder.test.ts -t '<exact test title>'
```

## Code Coverage

New contributions have a code coverage target of 90%+. You can run `yarn test --coverage` to see the coverage report before submitting a PR.
