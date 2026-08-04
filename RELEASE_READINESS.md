# SolidCash First-Release Readiness Tracker

Last reviewed: 2026-08-04  
Target: first public SolidCash release (`0.13.1`, unless the release version changes)

## Current assessment

**NO-GO for `0.13.1` at baseline `1a533c88`.** The formerly separate Solidity-corpus, SolidHat, state-journal, and
Layer-3/message-bus work is now integrated on `solidcash_v0.13.1`, but the integrated branch does not pass the
basic release gates. A fresh 2026-08-04 run found:

- `yarn build` and `yarn lint` failed at baseline; both are fixed and pass on the findings-fix worktree as of
  2026-08-04;
- baseline `yarn spellcheck` failed with 7,615 occurrences; the findings-fix worktree now passes after recording
  the existing 890-term technical/corpus vocabulary in a reviewed project dictionary and fixing a first-party
  misspelling;
- the historical broad corpus scorecard compiled 4,443/4,587 and contained 12 raw failures; the scoped 2026-08-04
  diagnostic pass found two raw positive-fixture failures, both now converted to named, source-located diagnostics.
  A release scorecard still requires a higher-budget rerun because 845 fixtures exceeded the intentionally tight
  five-second diagnostic budget under eight workers;
- 24 `.skip`/`.todo` occurrences remain under `packages` and `examples` (down from 25, but still unclassified);
- the findings-fix branch now includes `testing-suite` compilation, lint, and tests in the root gates and runs CI
  on `solidcash_v*`, but corpus, packed-package, application-conformance, and BCHN gates remain incomplete; and
- the findings-fix branch aligns all publishable package versions and internal ranges at 0.13.1.

The immediate release sequence is therefore: restore build/lint/spellcheck green; eliminate or convert the 12
raw corpus failures into stable source diagnostics; prove the remaining C2/covenant and delegate boundaries;
then run the complete clean-checkout, packed-package, mocknet, and BCHN candidate matrix.

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
- [ ] Make the release corpus complete with zero compiler crashes or raw internal exceptions.
- [~] Replace reachable late code-generation failures such as missing stack variables or unavailable block
  layouts with correct compilation or stable diagnostics.
  - The scoped positive corpus now has named diagnostics for its last two raw paths: transfer-frame loss and
    recursive inline struct encoding. A higher-budget corpus rerun must prove zero remaining raw failures.
- [ ] Verify every supported state mutation, external call, delegate call, and lifecycle path fails closed when
  supplied forged, reordered, duplicated, or missing auxiliary inputs.

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

- [~] Define the exact proxy/delegate feature profile supported by the first release.
- [ ] Confirm all unsupported delegate operations fail before broadcast rather than reverting unexpectedly
  on-chain.
- [ ] Reconcile outstanding delegate input-layout and proxy-context worker changes.
- [ ] Add release tests for supported proxy state mutation, events, nested calls, upgrades, and state preservation.
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
  - Current result: 4,443/4,587 single-file in-scope compiled; 144 failed; 337 negative fixtures are also
    accepted diagnostically. This is a baseline, not a passing release gate, because raw internal failures remain.
- [ ] Make the corpus command deterministic and record its Solidity corpus revision and tool versions.
- [ ] Add release gates:
  - [ ] no regression in accepted in-scope positive fixtures;
  - [ ] no increase in incorrectly accepted negative fixtures;
  - [ ] zero crashes/internal-error buckets;
  - [ ] reviewed changes to grouped failure reasons.
- [ ] Triage `NEG-ACCEPTED` cases that indicate missing safety or semantic strictness separately from harmless
  NatSpec/EVM-only diagnostic differences.
- [ ] Keep the corpus README, scorecard, and progress log numerically consistent.
  - Current source material: [`examples/solidity-corpus/README.md`](examples/solidity-corpus/README.md),
    [`scorecard.txt`](examples/solidity-corpus/scorecard.txt), and
    [`PROGRESS.md`](examples/solidity-corpus/PROGRESS.md).

### CI and release gates

- [x] Include `packages/testing` and `examples/testing-suite` in the root build/lint/test commands and required CI
  workflow (`codex/release-readiness-fixes`).
- [ ] Add a clean generated-project smoke test.
- [ ] Add at least one stateless and one stateful deployment/call test.
- [ ] Add fixture/reset and compilation-cache invalidation tests.
- [ ] Add a required BCHN regtest smoke suite for release candidates.
- [ ] Run build, lint, spellcheck, unit tests, e2e tests, examples, corpus gates, and package smoke tests from a
  clean checkout.
- [x] Ensure CI runs for the actual release branch (`solidcash_v*`), not only pushes to `master`.
- [x] Pin supported Node 22 and Yarn 1.22.22 in the root manifest and CI install behavior.
- [x] Update checkout/setup-node to GitHub Actions v4; Codecov remains on v5.

### Hardhat/ethers-compatible workflow

- [~] Reconcile the Hardhat-style project compilation cache from `.worktrees/dependency-dag` or confirm it was
  superseded.
- [ ] Demonstrate one maintained golden path:

  ```text
  initialize project → compile → obtain signers → deploy → call →
  assert event/revert/state → reset fixture → rerun
  ```

- [ ] Complete or explicitly defer HRE injection.
- [ ] Complete or explicitly defer deployment-script helpers.
- [ ] Complete stateless contract factory behavior needed by the golden path.
- [ ] Verify fixture/snapshot behavior on mocknet and document regtest behavior.
- [ ] Support the event and custom-error argument assertions used by the golden path.
- [ ] Publish a Hardhat/ethers/chai-to-SolidCash migration table.
- [ ] Include a complete stateful or token-contract test project.
  - Detailed tracker: [`examples/testing-suite/HARDHAT-PARITY.md`](examples/testing-suite/HARDHAT-PARITY.md).

### Application-level conformance

- [ ] Select and freeze at least five representative release applications:
  - [ ] ERC-20-like fungible token;
  - [ ] ownership/access control;
  - [ ] escrow;
  - [ ] proxy upgrade with preserved state;
  - [ ] mapping plus dynamic-array state;
  - [ ] cross-contract read and mutation;
  - [ ] timelock.
- [ ] For each selected application, require compilation, behavioral tests, event/error tests, and script-size
  measurements.
- [~] Decide whether `.worktrees/n-erc20` and its quarantined-admission design are release scope.
- [ ] Document any source changes required when porting the corresponding Solidity pattern.

### Packaging and release engineering

- [x] Align publishable package versions and internal dependency ranges at 0.13.1.
- [ ] Build the exact publish tarballs and install them into an empty consumer project.
- [ ] Run the golden-path smoke test against the packed artifacts rather than workspace links.
- [ ] Verify package exports, type declarations, source maps, licenses, READMEs, and dependency ranges.
- [ ] Produce release notes separating supported parity, experimental features, deferrals, and breaking changes.
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

At the 2026-08-04 audit snapshot, 24 skipped or TODO tests were found under `packages` and `examples` (the comment
mentioning `it.todo` in `StringStateGrowShrink.test.ts` is not counted). Classify every result before release.

- [ ] Fix or defer unbounded-bytes cross-contract return coverage.
- [ ] Fix or defer sequence-number/timelock coverage.
- [ ] Fix or defer optimizer-equivalence TODOs.
- [ ] Fix or defer nested-loop and optimized-value debugger TODOs.
- [ ] Keep circular-call tests skipped only with the permanent address-model limitation documented.
- [ ] Review skipped invalid-spend and incorrect-unlocker tests for security relevance.
- [ ] Reach zero unclassified `.skip`/`.todo` occurrences.

Suggested audit command:

```bash
rg -n --glob '*.{test,spec}.ts' \
  '\b(describe|it|test)\.skip\b|\b(describe|it|test)\.todo\b' \
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
- [ ] The Hardhat-style golden path passes using packed release artifacts.
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
| Build | **PASS** in findings-fix worktree (baseline failed with TS2345) | `codex/release-readiness-fixes` | 2026-08-04 |
| Unit tests | Incomplete — utils passed (295 tests, 1 TODO); full run stopped amid heavy concurrent test load | `1a533c88` | 2026-08-04 |
| Lint | **PASS** in findings-fix worktree (baseline failures fixed across compiler and SDK) | `codex/release-readiness-fixes` | 2026-08-04 |
| Spellcheck | **PASS** — 2,073 files, zero issues; explicit 890-term baseline dictionary | `codex/release-readiness-fixes` | 2026-08-04 |
| SDK e2e/mocknet | Not run | — | — |
| BCHN regtest | Not run | — | — |
| Testing-suite golden path | Not run | — | — |
| Solidity corpus | **IN PROGRESS** — scoped diagnostic 1,904/2,805; 845 timeouts; two raw paths converted and targeted | corpus `816d9b2a`, Node 22.22.0 | 2026-08-04 |
| Packed-package consumer smoke test | Not run | — | — |
| Application conformance suite | Not defined | — | — |
| Known `.skip`/`.todo` review | **FAIL** — 24 occurrences remain unclassified | `1a533c88` | 2026-08-04 |
