We use yarn workspaces + lerna for monorepo management. So to get started, clone this repository and run `yarn` in the root directory to install all dependencies for all packages.

Yarn workspaces perform package linking during installation; the postinstall hook goes directly to the
incremental build rather than running a redundant second dependency resolution through `lerna bootstrap`.

When updating code in one package, run `yarn build:watch` once in the repository root. It keeps TypeScript's package graph in memory and propagates changes to dependent packages incrementally. Keep the relevant Vitest process alive in another terminal so transformed compiler modules are reused too:

The watcher uses TypeScript's direct-dependency assumption to minimize edit latency. This is deliberately a
development optimization: always run one-shot `yarn build` before handoff so TypeScript exhaustively validates
transitive dependents.

```bash
# Compiler tests (an optional file or -t filter can follow `--`)
yarn test:compiler:watch -- test/Lexer.test.ts

# SDK unit tests, excluding e2e
yarn test:sdk:watch -- test/unit/EventFiltering.test.ts

# Mocknet e2e tests
yarn test:e2e:watch -- test/e2e/EventsFacade.test.ts
```

Vitest reruns affected tests on save. Press `r` to rerun the current selection. Use the one-shot `yarn build` before handing work off; it uses the same incremental project graph.

When returning to a branch or before choosing a focused file, Git-aware one-shot commands run only tests
affected by uncommitted changes:

```bash
yarn test:compiler:changed
yarn test:sdk:changed
yarn test:e2e:changed
```

The SDK's `test:unit` command runs only `test/unit`; `test:fast` and the default SDK watch loop add top-level
SDK regression tests but deliberately exclude conformance and journal/message-bus suites. The comprehensive
`yarn test` command is unchanged and remains the pre-handoff gate.

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

## solidcash

### Running tests

By default, running tests in the `solidcash` package runs against a local simulated `mocknet`. To run them against the real-world chipnet, you can use the `TESTS_USE_CHIPNET` environment variable. This uses chipnet contracts, which requires the test accounts to have some chipnet BCH.

```bash
# Run all tests using chipnet
TESTS_USE_CHIPNET=true yarn test
```

To run specific tests, you can use the `-t` flag to match the name mentioned in the `it` or `describe` block:

```bash
# Run all tests in the 'Transaction Builder' describe block (test/e2e/transaction-builder/TransactionBuilder.test.ts)
yarn test -t 'Transaction Builder'
```

## Code Coverage

New contributions have a code coverage target of 90%+. You can run `yarn test --coverage` to see the coverage report before submitting a PR.
