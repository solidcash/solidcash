# SolidCash 0.14.0 release-candidate notes

Status: release-candidate notes for `0.14.0`. The mocknet gates are green at `c7dc1b535` (2026-10-19), as recorded
in [`RELEASE_DECISION_0.14.0.md`](RELEASE_DECISION_0.14.0.md). Two gates were not run: `release-application-regtest`
(verification was mocknet-only, by instruction) and a marketplace-matrix rerun at that commit (the last matrix run
was all four cells green at `14bfff57a`). The release was numbered 0.13.1 when those gates ran; it first ships as `0.14.0-beta.1`.

SolidCash 0.14.0 introduces a Solidity-compatible language and workflow layer for Bitcoin Cash contracts. The
release claim is the documented subset in [`SOLIDITY_COMPATIBILITY_0.14.0.md`](SOLIDITY_COMPATIBILITY_0.14.0.md),
not unrestricted Solidity, EVM, Hardhat, or ethers parity.

## Supported in this release

- Solidity-style integer types and checked/unchecked arithmetic, structs, fixed and dynamic arrays, mappings,
  inheritance, modifiers, events, declared errors, ABI helpers, and the documented lowerable Yul subset.
- Stateful contracts backed by CashToken NFT commitments, including entry-backed mappings, chunked arrays,
  events, and the documented deploy, upgrade, destroy, split, and merge builders.
- The built-in proxy profile for scalar and data-NFT state, deployed through `upgrades.deployProxy`.
- A Hardhat-style project workflow through `@solidcash/testing` and SolidHat: configuration, CLI tasks, HRE,
  funded signers, factories, fixtures, time/block helpers, and the maintained chai assertion subset.
- Six aligned 0.14.0 packages with verified exports, declarations, embedded-source maps, CLIs, and installation
  from release tarballs. The packed consumer repeats the maintained stateful golden path.

See [`examples/testing-suite/MIGRATION.md`](../../../examples/testing-suite/MIGRATION.md) for direct Hardhat, ethers, and
chai mappings.

## Experimental profiles

- Composed external state mutation and custom delegate-forwarding shapes beyond the built-in proxy profile.
- Message-bus **kernel** composition (see below). Shapes outside the frozen proof inventory, including dormant
  read-carrier publication, stay fail-closed.
- Solidity source shapes outside the compatibility-manifest rows, even when the parser currently accepts them.

Experimental behavior is not part of the stable compatibility promise. Construction must stop with a named
diagnostic when the required transaction shape cannot be produced.

## Kernel beta (message-bus calling convention)

This is a compiler convention, not a second protocol. The envelope (`L3C1` / `L3BUS1`) and journal rules are
unchanged. Admitted handlers compile as `OP_DEFINE` bodies behind one row-loop wrapper (`selector` `53434231`,
`artifact.messageBus.convention === 'kernel-row-loop'`). Direct single-spend calls stay direct.

**In this beta you can** compose kernel-admitted handlers through `messageBus.compose` / `call.batch` when the
artifact says `available: true` and each selected handler is `eligible`. The executable surface is exactly
`scripts/kernel-beta-manifest.json` (required proofs plus the two cold compiles). `yarn test:kernel-beta` is the
gate.

**In this beta you cannot** treat a green compile as a deployable contract: MarketplaceV1's kernel route is
12,102 bytes (over BCH's 10,000-byte per-input limit) and is compile-compatibility evidence only. UnicrowClaim's
kernel route is 2,918 bytes. Dormant `0x11` read-carrier / dense final-flush publication is off. `split` /
`merge` / `selfdestruct` / `unsafe(0|1)` / foreign `delegatecall` remain `KERNEL_*`. `messageBusKernel: false`
reproduces legacy unroll for tests; it is not a fallback when kernel refuses a handler.

Further admission widening belongs on `grok/message-bus-kernel`, not this freeze.

## Explicit first-release deferrals

- Full Solidity-corpus strictness parity. The retained single-file baseline is 2,698/2,805 positive fixtures;
  all 2,158 negative fixtures were audited, with 323 currently over-accepted. This queue is informational and
  postponed from the release gate.
- Delegate-mode satoshi and token-container movement, fallback-only transparent proxies, and identical standalone
  and delegate addresses.
- `hardhat-deploy` scripts/tags/dependency graphs, universal third-party chai matcher compatibility, and runtime
  custom-error argument recovery.
- A general growable variable-size state-memory model, circular cross-contract address references, and the
  remaining EVM-memory/Yul-only operations.

## Intentional Bitcoin Cash differences

- Contract state and identity are UTXO/CashToken based rather than EVM account/storage based.
- Calls are transaction compositions or co-spends, not synchronous EVM message calls.
- BCH fees and VM resource limits replace gas accounting.
- Events use NFT commitments rather than EVM logs, and failed execution does not carry EVM revert-data payloads.
- Account impersonation, mutable account code/storage/nonces, ENS, and EVM transaction signing have no direct
  equivalent. Testing uses explicit keys, funded UTXOs, fixtures, and contract state helpers.

## Breaking and migration changes

- Projects use Node 22 and Yarn 1.22.22 for the maintained release workflow.
- Compile artifacts are namespaced under `artifacts/solidcash`; factory lookup resolves contract names and
  fully-qualified source names.
- Stateful deployment requires initial commitment state, and authorization normally passes a BCH signature or
  data signature explicitly.
- `msg.sender`, `msg.value`, block/time values, addresses, token balances, and state operations use the BCH
  semantics documented in the compatibility manifest and migration table.
- Release source maps embed their referenced TypeScript source so installed tarballs remain debuggable without
  unpublished repository files.

## Candidate evidence recorded through 2026-08-11

- Compiler suite: 3,240/3,240 in the current comprehensive root run.
- SDK non-e2e suite: 1,204 passed, 19 skipped, 5 todo. The comprehensive mock e2e run passed 348 files with
  2,742 tests passing, 23 skipped, and 3 todo.
- Generated-project gate: initialization 1/1, cache lifecycle 1/1, maintained harness 21/21.
- Packed-package gate: six tarballs and maintained stateful golden path 3/3.
- Application gates: mock-provider matrix 95/95 and serial BCHN v29 matrix 9/9.
- Additional BCHN candidate evidence: event-path, multi-slot, and delegated-vmap focused files pass 24/24 after
  accepting live-node rejection wording and making the fabricated multi-slot output relay-valid. The full serial
  candidate aggregate is still incomplete: it was stopped after a later file ran for more than 14 minutes without
  returning a result.
- Integrity matrix: 81/81 executed tests with one documented skip, covering every stable physical state backend,
  external/delegate composition, and lifecycle elements. Experimental profiles remain outside the stable claim.
- Solidity corpus: 2,698/2,805 retained positives and 1,835/2,158 rejected negatives, with no residual timeout;
  strictness work is deferred as stated above.
- Clean-checkout CI ordering: at `9d37eae24`, a dependency-free detached worktree passed
  `yarn --frozen-lockfile --ignore-scripts` and the authoritative root `yarn build`; only generated artifact
  timestamps changed.
- Fresh-chain full BCHN diagnostic at `4f0d1bb53`: 128/482 files (16/61 batches) passed with zero failed batches
  before the run was intentionally stopped at a durable boundary to prepare the handoff. This partial result is
  not the final matrix attestation.

## Kernel beta gate attestation (2026-09-09)

The frozen kernel beta implementation at `50b50b32f5bc67d917493c48cda7f15287c2e149`, against census commit
`95fbe8f3c`, passed the exact clean `yarn test:kernel-beta` gate (`diagnosticOnly: false`). The gate ran the root
build, generated-artifact freshness (2/2), utility script/source-map checks (26/26), the compiler journal corpus
(62 files, 1,341/1,341), the SDK journal corpus (96 files passed and 6 intentionally skipped; 608 passed and 18
skipped tests), and the selected SDK regressions (10 files, 164/164). All 17 required kernel proof roles passed,
covering 58 proof tests in total, with no hidden caught compile attempts.

The gate's two fresh, cache-disabled samples per profile were deterministic and retained the pinned bytecode and
metadata hashes. MarketplaceV1 legacy unroll measured 5,747/5,624 ms, 40,019 route bytes, and 115,060 full bytes
(28/39 eligible handlers). Its kernel row loop measured 6,502/6,228 ms, 12,102 route bytes, and 126,967 full bytes
(39/39 eligible). UnicrowClaim's kernel row loop measured 3,006/3,160 ms, 2,918 route bytes, and 14,462 full bytes
(11/11 eligible). These sizes are compile-output measurements; they do not assert deployability for artifacts
over Bitcoin Cash's 10,000-byte script limit.

These are candidate-worktree results, not a final release attestation. Before publishing, complete the
fresh-chain BCHN matrix at the exact tested commit, record the tag, and replace this paragraph with the final
results.
