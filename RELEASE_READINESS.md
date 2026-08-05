# SolidCash First-Release Readiness Tracker

Last reviewed: 2026-08-05
Target: first public SolidCash release (`0.13.1`, unless the release version changes)

## Current assessment

**NO-GO for `0.13.1` on the current findings-fix worktree.** The formerly separate Solidity-corpus, SolidHat,
state-journal, and Layer-3/message-bus work is integrated, and the basic build/test/lint/package gates now pass.
Release evidence is still incomplete in the higher-budget corpus, application-conformance, and full BCHN candidate
matrix. The 2026-08-04 through 2026-08-05 reassessment found:

- `yarn build` and `yarn lint` failed at baseline; both are fixed and pass on the findings-fix worktree as of
  2026-08-04;
- baseline `yarn spellcheck` failed with 7,615 occurrences; the findings-fix worktree now passes after recording
  the existing 890-term technical/corpus vocabulary in a reviewed project dictionary and fixing a first-party
  misspelling;
- the historical broad corpus scorecard compiled 4,443/4,587 and contained 12 raw failures. Identical 30-second
  eight-worker sweeps compiled 2,501 and 2,488 of 2,805 because scheduler/cache effects moved 15 fixtures across
  the timeout boundary. A fresh-worker 120-second retry tier recovered 175 compilations and exposed five hidden
  raw paths, all now converted to named diagnostics. After the eligibility and fallback fixes, a complete fresh
  sweep compiled 2,622/2,805 with 72 named diagnostics and 111 timeouts. Fresh-worker retries at 30 and 120
  seconds resolved all 111: the retained result is 2,698/2,805 with 107 named failures, zero generic/raw buckets,
  and zero timeouts. The matching negative audit checked all 2,158 fixtures with zero residual timeouts: SolidCash
  rejects 1,835 and over-accepts 323 that solc rejects;
- the integrated compiler suite passes all 3,145 tests, the SDK suite passes 3,808 tests, and the testing-suite
  passes all 25 tests. The six high-bit EVM-storage/message-bus failures found during reassessment are
  fixed with asymmetric byte-order, signed-memory, string-memory, and capacity regressions;
- 14 executable `.skip`/`.todo` occurrences remain under `packages` and `examples`; all are classified as explicit
  first-release deferrals, permanent BCH/model differences, or mock/debug API limitations, with no skipped release
  blocker remaining;
- the findings-fix branch includes `testing-suite` compilation, lint, and tests in the root gates and runs CI on
  `solidcash_v*`; the clean packed-package gate passes, while application conformance and the full BCHN candidate
  matrix remain incomplete. Solidity-corpus strictness gaps remain measured but are deferred from release gating;
- the findings-fix branch aligns all publishable package versions and internal ranges at 0.13.1.
- all six publishable packages now pass a clean tarball-consumer gate: packed README/license and manifest targets
  are checked, the tarballs are installed together without workspace links, runtime and subpath imports execute,
  public types compile, all four CLIs answer `--help`, and the packed compiler produces an SDK-consumable artifact.
- BCHN v29 regtest now proves BIP68 block-height and 512-second MTP ages end to end: the covenant rejects a short
  sequence, BCHN rejects valid sequences while their prevouts are immature, and the spends succeed after maturity.
- BCHN v29 with mainnet standard relay policy accepts all five atomic message-bus composition capstones and the
  published 24-input, eight-participant maximum at 94,651 serialized bytes. The distinct 32-input resource-heavy
  fixture remains a relaxed semantic stress shape and is not claimed as standard-relay fit.

The immediate release sequence is therefore: finish the remaining protocol/covenant soundness audits, then
define/run application conformance and the full BCHN candidate matrix. Over-accepted Solidity negative-fixture
strictness is a post-release compatibility backlog, not a current release blocker. The corpus result remains
reproducible with its published fresh-worker retry tiers; the 30-second eight-worker primary result alone is
load-sensitive.

This is the maintained overview for the Solidity-parity and release-readiness effort. It is intentionally
an action-oriented companion to the detailed design and research documents. Those documents remain the source
of truth for implementation details.

## How to maintain this tracker

Checkbox meanings:

- `[ ]` Not started or not yet demonstrated.
- `[~]` In progress, partially supported, or implemented outside the release branch.
- `[x]` Complete on the release branch and covered by the stated verification.
- `[-]` Explicitly deferred from the first release, with a documented limitation and a fail-closed boundary.

When changing a status:

1. Link the merge commit, test, scorecard, or design decision beside the item.
2. Only use `[x]` after the work is present on the release branch.
3. For security-sensitive compiler or covenant work, require an adversarial or VM-level regression test.
4. Move intentionally unsupported work to the deferral section rather than silently removing it.
5. Update the review date and the release-gate snapshot at the bottom.

## Release definition

The first release should claim a **documented Solidity-compatible subset**, not unrestricted Solidity parity.
The compatibility documentation must distinguish:

- syntax and type-system compatibility;
- behavioral compatibility;
- EVM ABI byte compatibility;
- Hardhat/ethers workflow compatibility;
- intentional BCH/UTXO differences.

Release-ready means every advertised construct either compiles correctly with behavioral coverage or fails
early with a stable, source-located diagnostic. A valid Solidity program may be rejected by the first release;
it must not silently compile to incorrect covenant behavior.

## P0 — Release blockers

### Compiler and covenant soundness

- [x] Fix the documented C2 sorted-mapping read issue involving a last-use local key.
  - Evidence/design: [`packages/solidc/docs/deferrals.md`](packages/solidc/docs/deferrals.md), “Multi-return
    STATE helper inline” and its corrected C2 root-cause analysis.
  - Completion requires a minimal source-level regression, generated-bytecode/VM proof, and a negative test
    preventing recurrence through desugaring or inlining.
  - Evidence: `packages/solidcash/test/e2e/SortedMappingComputedKeyRmw.test.ts` exercises the exact local-copy
    trigger through compiler, SDK transaction construction, VM execution, and state readback.
- [ ] Audit nearby C2 key-source and stack-liveness paths for the same stale-offset class of bug.
- [x] Fix the six EVM-storage/message-bus VM regressions in `packages/solidcash/test/e2e/EvmStorageLayout.test.ts`.
  - Root cause: Solidity-compatible big-endian scalar casts exposed older storage and Yul-memory lowering paths
    that assumed BCH-native typed casts. The fix uses sign-safe raw word encoding, preserves fixed-byte order,
    and aligns compile-time storage-slot constant folding with runtime casts.
  - Evidence: all 39 `EvmStorageLayout` tests pass, including asymmetric `0x89ab1234`; the related memory/storage
    focus passes 63 tests with one intentional skip; the complete compiler and SDK suites pass.
- [-] Keep the measured Solidity corpus as release evidence without completing strictness parity.
  - A complete fresh positive-fixture sweep and its isolated retry tiers have zero generic/raw error buckets and
    zero residual timeouts. The primary sweep produced 111 timeouts; 30-second fresh-worker retries recovered 27
    as compilations and one as a named diagnostic, then the 120-second tier recovered 49 as compilations and 34
    as named diagnostics. All negative fixtures are now checked, but 323 over-accepted cases remain a strictness
    review queue. Per release prioritization, the full bench and over-accepted-correctness work are postponed and
    are not release blockers.
- [~] Replace reachable late code-generation failures such as missing stack variables or unavailable block
  layouts with correct compilation or stable diagnostics.
  - Transfer-frame loss, recursive inline struct encoding, missing block layout, oversized message-bus verifier,
    lost compiler-tracked stack values, and recursive traversal overflow now fail with named diagnostics. The
    retained result reports 107 named failures and no generic `Error` or raw `RangeError` bucket.
- [ ] Verify every supported state mutation, external call, delegate call, and lifecycle path fails closed when
  supplied forged, reordered, duplicated, or missing auxiliary inputs.
  - A deterministic integrity baseline now runs as `yarn test:security-conformance`: 81/81 executed tests cover C2 batch
    witness tampering, dynamic-loop entry tampering, external-call target substitution, cross-contract
    fail-closed subcases, delegate identity/selector pinning, split/merge missing/duplicated/reordered/redirected
    lifecycle elements, deploy child-genesis and upgrade/selfdestruct
    missing/duplicated/reordered/redirected elements, and message-envelope/return forgery. Upgrade replacement
    bytecode is carried by a compiler-owned covenant witness, so the SDK-selected master remains authenticated
    even with `SIGHASH_NONE`. Ordinary scalar/data-NFT and dynamic-chunk transitions reject missing, duplicated,
    semantically significant reordered, redirected, and commitment-forged state elements without relying on any
    signature guard. Old chunks themselves are an identity-authenticated unordered input set. Satoshi-container
    and fungible-token container transitions additionally preserve container presence, position, destination,
    and value/amount. Ordinary events and emitted returns preserve their required position, destination, and
    commitment, rejecting missing, duplicated, reordered, redirected, or changed outputs. The built-in
    `upgrades.deployProxy` profile preserves the proxy state block and requires the pinned implementation
    co-spend. Untyped deploy
    factories reject before broadcast because the supplied
    child artifact cannot be covenant-authenticated; typed stateful deploy combined with a C2 access also rejects
    until their trailing output regions can be separated. The gate also covers the built-in proxy lifecycle,
    multi-NFT initialization/state preservation, delegated events and returns, nested initializer helpers, and
    compiler/SDK refusal of implementation functions that reach ineligible operations.
  - Remaining before this item can close: equivalent matrix closure for the remaining supported state-mutation
    families and early refusal for delegate shapes outside the supported built-in proxy profile.

### Cross-contract state bus and nested calls

- [~] Freeze the supported state-bus/Layer-3 profile now that the implementation is integrated; the protocol and
  coverage documents exist, but the public stable/experimental boundary is not yet a release contract.
- [x] Reconcile the former state-bus, Layer-3 binding, SolidHat, journal, and related worker branches.
  - Evidence: integration commits `83cfd13b`, `10cc6635`, `5fdc7b24`, and consolidation commit `1a533c88`.
- [x] Merge the accepted bus/journal/binding implementation into `solidcash_v0.13.1`.
- [ ] Run compiler, SDK, mocknet, VM/adversarial, and BCHN regtest coverage after integration.
- [ ] If deferred, hide or reject every stable-API path that depends on the unfinished architecture and document
  the experimental boundary.

### Proxy and delegate behavior

- [x] Define the exact proxy/delegate feature profile supported by the first release.
  - The compatibility manifest supports the built-in `upgrades.deployProxy` path for scalar/data-NFT state.
    Custom forwarders and other delegate shapes remain experimental; delegate-mode satoshi/token movement and
    fallback-only transparent proxies remain deferred below.
- [x] Confirm unsupported operations are excluded from inferred delegate artifacts and rejected during SDK
  construction.
  - `DelegateInferred.test.ts` covers direct and internal-helper transfer/token operations, contracts with no
    eligible implementation entry points, standalone artifacts supplied as implementations, and non-delegate
    functions selected from delegate artifacts.
- [ ] Reconcile outstanding delegate input-layout and proxy-context worker changes.
- [x] Add release tests for supported proxy state mutation, events, nested calls, upgrades, and state preservation.
  - `UpgradesDeployProxy.test.ts`, `DelegateInferred.test.ts`, and `DefaultProxyIntegrity.test.ts` are required by
    `yarn test:security-conformance`; the expanded gate passes 81/81 executed tests with one documented skip.
- [-] Delegate-mode satoshi and token-container movement, unless explicitly brought into scope.
- [-] Fallback-only proxy operation, unless the selector-less forwarding protocol is fixed.
- [-] One identical address for standalone and delegate deployments; the current separate-artifact design is an
  intentional size tradeoff.
  - Evidence/design: [`packages/solidc/docs/deferrals.md`](packages/solidc/docs/deferrals.md), delegate-mode
    sections.

## P1 — Required release work

### Compatibility contract

- [x] Publish a conservative versioned compatibility manifest covering the required dimensions:
  [`SOLIDITY_COMPATIBILITY_0.13.1.md`](SOLIDITY_COMPATIBILITY_0.13.1.md).

  | Area | Parse | Type check | Codegen | SDK | Behavioral test | Release status |
  |---|---:|---:|---:|---:|---:|---|
  | Integers and checked arithmetic |  |  |  |  |  |  |
  | ABI encode/decode |  |  |  |  |  |  |
  | Structs, mappings, and arrays |  |  |  |  |  |  |
  | Inheritance and modifiers |  |  |  |  |  |  |
  | External calls and returns |  |  |  |  |  |  |
  | Proxy/delegate calls |  |  |  |  |  |  |
  | Inline assembly/Yul subset |  |  |  | N/A |  |  |
  | Lifecycle operations |  |  |  |  |  |  |

- [ ] Resolve contradictory or stale documentation, including short-circuit behavior and outdated corpus gap
  descriptions.
- [ ] Give every documented limitation one of: supported, experimental, deferred, or permanent BCH difference.
- [ ] Ensure public website examples compile against the exact release packages.

### Solidity corpus and differential testing

- [x] Reconcile the Solidity corpus work with the release branch (`10cc6635`).
- [x] Regenerate the corpus scorecard on the integrated branch.
  - Current retained positive-only result: 2,698/2,805 compiled; 107 fixtures failed with named diagnostics and
    zero timed out. The complete 30-second/eight-worker primary sweep compiled 2,622 with 72 named diagnostics
    and 111 timeouts; isolated 30-second/four-worker and 120-second/four-worker tiers resolved every timeout.
  - Negative result: all 2,158 checked; 1,835 rejected, 323 over-accepted, zero unchecked, zero timeouts. The
    conservative screening inventory is [`NEGATIVE_AUDIT.md`](examples/solidity-corpus/NEGATIVE_AUDIT.md).
- [x] Make the corpus command deterministic and record its Solidity corpus revision and tool versions.
  - The scoped runner uses stable file ordering, isolated reusable workers, a per-fixture timeout, configurable
    worker count/negative checking, a resumable fresh-worker retry tier, and writes the corpus revision,
    Node/platform, scope, primary/retry budgets, and retry history.
- [ ] Add release gates:
  - [ ] no regression in accepted in-scope positive fixtures;
  - [ ] no increase in incorrectly accepted negative fixtures;
  - [ ] zero crashes/internal-error buckets;
  - [ ] reviewed changes to grouped failure reasons.
- [-] Triage `NEG-ACCEPTED` cases that indicate missing safety or semantic strictness separately from harmless
  NatSpec/EVM-only diagnostic differences. This compatibility-strictness backlog is explicitly deferred and does
  not block the current release; fail-closed protocol/covenant audits remain separate release gates.
  - All 323 are syntax-test negatives. Initial screening identifies 95 platform/backend-policy candidates and a
    228-case strictness-review queue, led by 78 data-location/storage-reference cases. Five uninitialized-storage-
    pointer cases now reject after branch/zero-iteration-loop definite-assignment tracking. No case is waived yet.
- [ ] Keep the corpus README, scorecard, and progress log numerically consistent.
  - Current source material: [`examples/solidity-corpus/README.md`](examples/solidity-corpus/README.md),
    [`scorecard.txt`](examples/solidity-corpus/scorecard.txt), and
    [`PROGRESS.md`](examples/solidity-corpus/PROGRESS.md).

### CI and release gates

- [x] Include `packages/testing` and `examples/testing-suite` in the root build/lint/test commands and required CI
  workflow (`codex/release-readiness-fixes`).
- [x] Add a clean generated-project smoke test.
  - `yarn test:generated-project-smoke` creates a temporary SolidHat project, compiles it through the generated
    CLI configuration, resolves its factory, and runs its generated test without reusing project artifacts.
- [x] Add at least one stateless and one stateful deployment/call test.
  - The same gate runs the stateless `Example` calls and the stateful oracle-backed `TimeVault` deployment/call.
- [x] Add fixture/reset and compilation-cache invalidation tests.
  - The gate proves named-fixture restoration and cold/warm/dependency-invalidated compilation, preserves the last
    valid artifact after a failed rebuild, and verifies `clean` removes artifacts and cache data.
- [ ] Add a required BCHN regtest smoke suite for release candidates.
- [ ] Run build, lint, spellcheck, unit tests, e2e tests, examples, corpus gates, and package smoke tests from a
  clean checkout.
- [x] Ensure CI runs for the actual release branch (`solidcash_v*`), not only pushes to `master`.
- [x] Pin supported Node 22 and Yarn 1.22.22 in the root manifest and CI install behavior.
- [x] Update checkout/setup-node to GitHub Actions v4; Codecov remains on v5.

### Hardhat/ethers-compatible workflow

- [x] Reconcile the Hardhat-style project compilation cache from `.worktrees/dependency-dag` or confirm it was
  superseded.
  - The integrated compiler task owns the current cache. `yarn test:generated-project-smoke` proves cold and warm
    runs, dependency invalidation, qualified factory lookup, last-valid-artifact retention, and clean removal.
- [x] Demonstrate one maintained golden path:

  ```text
  initialize project → compile → obtain signers → deploy → call →
  assert event/revert/state → reset fixture → rerun
  ```

  - `examples/testing-suite/test/golden-path.test.ts` compiles and resolves `GoldenToken`, obtains funded
    signers, deploys initialized state, sends calls, checks decoded positional event arguments, checks a named
    require reason and state, restores a named fixture, and reruns the successful path. It is part of
    `yarn test:generated-project-smoke`.

- [x] Complete or explicitly defer HRE injection.
  - `createHardhatRuntimeEnvironment` injects config, the selected network/provider, `ethers`, network helpers,
    task lookup, and `hre.run`; `solidcash run` also exposes the active HRE to scripts.
- [-] Defer hardhat-deploy-style deployment scripts, tags, and dependency graphs.
  - The first-release golden path uses factories, `deployContract`, and `upgrades.deployProxy`; no selected example
    or release gate requires the separate hardhat-deploy workflow.
- [-] Defer additional stateless contract-factory behavior not needed by the maintained golden path.
  - The release path is stateful; existing stateless calls remain covered by the same generated-project gate.
- [x] Verify fixture/snapshot behavior on mocknet and document regtest behavior.
  - `harness.test.ts` proves snapshot restoration without fixture reruns on mocknet. Regtest deliberately has no
    rollback snapshot primitive: live-node tests use fresh deployments/categories and run serially, as the
    application regtest gate does.
- [-] Support event arguments; defer custom-error runtime argument matching.
  - The golden path proves Chai-style positional event arguments. BCH failed calls do not transport EVM-style
    revert payloads, so typed custom-error argument recovery is not a first-release requirement; declarations
    remain artifact metadata and the maintained path checks a named require reason.
- [x] Publish a Hardhat/ethers/chai-to-SolidCash migration table.
  - [`examples/testing-suite/MIGRATION.md`](examples/testing-suite/MIGRATION.md) maps configuration, CLI/HRE,
    signers, factories, fixtures, time, assertions, balances, utilities, and permanent BCH differences.
- [x] Include a complete stateful or token-contract test project.
  - `GoldenToken` and `golden-path.test.ts` provide the maintained compile/deploy/call/event/revert/state/reset
    project.
  - Detailed tracker: [`examples/testing-suite/HARDHAT-PARITY.md`](examples/testing-suite/HARDHAT-PARITY.md).

### Application-level conformance

- [x] Select and freeze at least five representative release scenarios in
  `yarn test:application-conformance` (nine files, 94 executed tests on 2026-08-05):
  - [x] ERC-20-like ledger with mint/transfer balances, preserved supply, decoded `Transfer` arguments, and the
    declared insufficient-balance path (`Erc20LikeApplication.test.ts`);
  - [x] token integration and target pinning (`SafeErc20ChainTargetPinning.test.ts`);
  - [x] ownership/access control (`CustomModifier.test.ts`);
  - [x] escrow-like oracle release and absolute locktime (`HodlVault.test.ts`);
  - [x] proxy upgrade with preserved state (`Upgrade.test.ts`);
  - [x] mapping plus dynamic-array state (`IterableMappingPattern.test.ts`);
  - [x] cross-contract read and mutation (`ExternalFunctionCalls.test.ts`).
  - Supporting release-interface coverage: decoded event arguments/filtering (`EventsFacade.test.ts`) and
    custom-error metadata plus assert/revert behavior (`ErrorAssertRevert.test.ts`).
- [x] Make the selected mock-provider scenarios a deterministic, named release command. The gate rejects ordinary
  test failures and does not include the environment-gated timelock file, whose four tests otherwise report as
  skipped without chipnet/regtest configuration. CI runs the named gate separately so its result remains visible
  even though the same files are also part of the broad SDK suite.
- [x] Run representative application flows on BCHN v29 regtest through a deterministic serial command.
  - `yarn test:application-regtest` runs the ERC-20-like ledger/event/error flow and the independent
    escrow/oracle/timelock flow without file parallelism; the 2026-08-05 run passes 9/9.
- [x] For each selected application, require compilation, behavioral tests, event/error tests, and script-size
  measurements. The frozen gate proves compilation/behavior and shared event/custom-error interfaces;
  every row now measures its serialized locking bytecode against a named, machine-readable 10,000-byte ceiling in
  `packages/solidcash/test/application-size-budgets.ts`. The same manifest classifies event/custom-error coverage
  for every row as covered or explicitly not declared, and each scenario validates its profile while running.
- [-] Keep `.worktrees/n-erc20` and its quarantined-admission design outside the first release.
  - The branch adds a separate 1,828-line native-USDT/facet profile and an admission design not used by the
    supported nine-file application gate. The release instead ships the smaller ERC-20-like ledger scenario and
    treats native CashTokens as the preferred fungible-asset model; the branch remains available for a later
    independently reviewed feature release.
- [x] Document source/workflow changes required by every selected Solidity application pattern.
  - Evidence: `SOLIDITY_COMPATIBILITY_0.13.1.md`, “Application porting notes”.

### Packaging and release engineering

- [x] Align publishable package versions and internal dependency ranges at 0.13.1.
- [x] Build the exact publish tarballs and install them into an empty consumer project.
  - `yarn test:package-smoke` packs all six release packages, validates README/license and every concrete
    main/types/bin/export target, installs only those tarballs into a temporary consumer, exercises runtime and
    subpath imports, compiles public types, checks all CLIs, and compiles/constructs a contract through packed APIs.
- [x] Run the golden-path smoke test against the packed artifacts rather than workspace links.
  - `yarn test:package-smoke` installs only the six release tarballs plus consumer tooling, compiles the stateful
    `GoldenToken`, and passes the deploy/call/event/revert/state/fixture-reset path 3/3 in that isolated project.
- [x] Verify package exports, type declarations, source maps, licenses, READMEs, and dependency ranges.
  - The packed smoke covers exports, type declarations, licenses, READMEs, source maps for every emitted
    JavaScript file, installed versions, and internal dependency resolution. Every packed map is now required to
    embed all referenced source content, so consumers do not depend on unpublished `src/` trees.
- [x] Produce release notes separating supported parity, experimental features, deferrals, and breaking changes.
  - [`RELEASE_NOTES_0.13.1.md`](RELEASE_NOTES_0.13.1.md) is the candidate draft; it deliberately leaves the exact
    release commit/tag and final clean-checkout attestation pending.
- [ ] Tag the exact tested commit and record the corpus/regtest results in the release notes.

## P2 — Valuable after the first release

These items do not block the first release when the unsupported boundary is documented and fail-closed.

- [ ] Broaden Yul compatibility beyond the supported lowerable subset.
- [ ] Implement the growable variable-size state memory model.
- [ ] Revisit circular cross-contract address references.
- [ ] Add delegate-mode satoshi and token movement.
- [ ] Add fallback-only transparent proxy support.
- [ ] Pursue a compact dual-mode standalone/delegate encoding.
- [ ] Complete `hardhat-deploy` compatibility.
- [ ] Complete chai matcher and third-party matcher compatibility.
- [ ] Cover remaining rare recursive ABI shapes.
- [ ] Automate per-optimizer-rule VM equivalence proofs.
- [ ] Improve debugger reporting for optimized values and nested loops.
- [ ] Expand app-specific event decoders and project helper libraries.

## Known skipped/TODO-test review

At the 2026-08-05 audit snapshot, 14 executable skipped or TODO occurrences remain under `packages` and
`examples`, down from 24 after removing six empty placeholder suites and one obsolete manual-proof TODO. Every remaining occurrence is classified in
[`TEST_DEFERRALS_0.13.1.md`](TEST_DEFERRALS_0.13.1.md); none is a release-blocking coverage gap.

- [x] Prove writing an unbounded cross-contract return directly to dynamic state, including an interface that
  under-declares the callee's physical state footprint. Dynamic chunks anchor after the authenticated return event.
- [x] Prove BIP68 block-height and 512-second MTP maturity against BCHN: short sequence fails the covenant,
  immature valid sequences fail node consensus, and the identical spends succeed after maturity.
- [x] Remove the stale optimizer-equivalence TODO; 102 active equivalence proofs already cover this area.
- [-] Nested-loop and optimized-value debugger enhancements are post-release.
- [x] Keep circular-call tests skipped only with the permanent address-model limitation documented.
- [x] Review skipped invalid-spend and incorrect-unlocker tests for security relevance.
- [x] Reach zero unclassified `.skip`/`.todo` occurrences.

Suggested audit command:

```bash
rg -n --glob '*.{test,spec}.ts' \
  '^\s*(describe|it|test)\.(skip|todo)\b' \
  packages examples -g '!**/node_modules/**'
```

## First-release exit checklist

- [ ] No known silent miscompiles in the supported language subset.
- [ ] All unsupported security-sensitive shapes fail at compile or transaction-construction time.
- [ ] State-bus/Layer-3 scope is integrated and frozen, or clearly excluded.
- [ ] Proxy/delegate scope is explicit and adversarially tested.
- [ ] Compatibility manifest is complete and published.
- [ ] Corpus baseline is reproducible, crash-free, and non-regressing.
- [ ] Clean-checkout CI and BCHN regtest gates pass.
- [x] The Hardhat-style golden path passes using packed release artifacts.
- [ ] Representative application suite passes with script-size measurements.
- [ ] Package versions and exports are consistent.
- [ ] Release documentation clearly separates parity from intentional BCH differences.
- [ ] Exact release commit, test results, scorecard, and known deferrals are recorded.

## Audit snapshot and source index

The initial audit was performed against `solidcash_v0.13.1` at `8b8410a5` on 2026-07-27. This reassessment was
performed against `solidcash_v0.13.1` at `1a533c88` on 2026-08-04. Former worktree state is no longer used as a
release metric; merged commits and reproducible gates are the evidence baseline.

Primary evidence:

- [`packages/solidc/docs/deferrals.md`](packages/solidc/docs/deferrals.md)
- [`packages/solidc/docs/external-contract-calls.md`](packages/solidc/docs/external-contract-calls.md)
- [`packages/solidc/docs/buffered-state-and-message-bus-research.md`](packages/solidc/docs/buffered-state-and-message-bus-research.md)
- [`packages/solidc/docs/sorted-mapping-c2.md`](packages/solidc/docs/sorted-mapping-c2.md)
- [`examples/solidity-corpus/README.md`](examples/solidity-corpus/README.md)
- [`examples/solidity-corpus/scorecard.txt`](examples/solidity-corpus/scorecard.txt)
- [`examples/solidity-corpus/PROGRESS.md`](examples/solidity-corpus/PROGRESS.md)
- [`examples/testing-suite/HARDHAT-PARITY.md`](examples/testing-suite/HARDHAT-PARITY.md)
- [`package.json`](package.json)
- [`.github/workflows/github-actions.yml`](.github/workflows/github-actions.yml)

### Release-gate snapshot

Update this table whenever a release candidate is cut.

| Gate | Result | Commit/artifact | Date |
|---|---|---|---|
| Clean install | **PASS** — `yarn install --frozen-lockfile --ignore-scripts` with worktree-local dependencies | `d5d4d70f` | 2026-08-04 |
| Build | **PASS** — all six packages plus testing-suite fixture compilation | `codex/release-readiness-fixes` | 2026-08-04 |
| Compiler tests | **PASS** — 3,145/3,145, including storage-pointer definite-assignment and alias-source regressions | `codex/release-readiness-fixes` | 2026-08-05 |
| SDK unit/e2e/mocknet | **PASS** — 433 files; 3,808 passed, 39 skipped, 9 todo. High-bit EVM storage and shared Yul-memory regressions pass | `codex/release-readiness-fixes` | 2026-08-04 |
| Lint | **PASS** — seven workspaces plus root testing-suite lint | `codex/release-readiness-fixes` | 2026-08-04 |
| Spellcheck | **PASS** — 2,101 files, zero issues; explicit 890-term baseline dictionary | `codex/release-readiness-fixes` | 2026-08-05 |
| BCHN regtest | **PARTIAL PASS** — v29 BIP68 height/MTP proofs pass; five atomic composition capstones and the 24-input, 94,651-byte eight-participant maximum are accepted under standard relay policy; full candidate matrix not rerun | `codex/release-readiness-fixes` | 2026-08-05 |
| Testing suite | **PASS** — 6 files, 25/25; includes maintained stateful compile/deploy/call/event/revert/state/reset path 3/3 | `yarn workspace testing-suite test` | 2026-08-05 |
| Generated-project smoke | **PASS** — clean project initialization/compile/test 1/1; cache lifecycle 1/1; stateless/stateful harness 21/21 | `yarn test:generated-project-smoke` | 2026-08-05 |
| Solidity corpus | **INFORMATIONAL / DEFERRED** — positives retain 2,698/2,805, 107 named failures, zero generic/raw buckets/timeouts; all 2,158 negatives checked, with 323 over-accepted. Strictness parity is not a current release blocker | corpus `816d9b2a`, Node 22.22.0, linux-arm64; positive primary 30s/8, retry 30s/4 then 120s/4; negative audit 30s/4 then 120s/4; accepted-negative recheck 30s/4 | 2026-08-05 |
| Packed-package consumer smoke test | **PASS** — six tarballs; clean install, embedded-source-map/export/type/CLI/runtime/compiler checks; maintained stateful golden path 3/3 | `yarn test:package-smoke` | 2026-08-05 |
| Application conformance suite | **PASS** — deterministic nine-file mock-provider gate passes 94/94 with explicit applicability and named locking-script budgets; the serial BCHN v29 application gate passes 9/9 across ERC-20-like and escrow/oracle/timelock flows | `yarn test:application-conformance`; `yarn test:application-regtest` | 2026-08-05 |
| Integrity conformance suite | **PARTIAL** — deterministic fifteen-scenario gate passes 81/81 executed tests (one documented skip), including lifecycle, scalar/data-NFT, dynamic-chunk, satoshi/token containers, events/returns, and the built-in proxy lifecycle/refusal profile; remaining state-mutation matrices remain open | `yarn test:security-conformance` | 2026-08-05 |
| Known `.skip`/`.todo` review | **PASS** — 14 executable occurrences classified; no skipped release blocker remains | `codex/release-readiness-fixes` | 2026-08-05 |
