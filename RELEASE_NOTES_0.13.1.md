# SolidCash 0.13.1 release-candidate notes

Status: draft; the exact release commit and final clean-checkout/BCHN matrix are not yet recorded.

SolidCash 0.13.1 introduces a Solidity-compatible language and workflow layer for Bitcoin Cash contracts. The
release claim is the documented subset in [`SOLIDITY_COMPATIBILITY_0.13.1.md`](SOLIDITY_COMPATIBILITY_0.13.1.md),
not unrestricted Solidity, EVM, Hardhat, or ethers parity.

## Supported in this release

- Solidity-style integer types and checked/unchecked arithmetic, structs, fixed and dynamic arrays, mappings,
  inheritance, modifiers, events, declared errors, ABI helpers, and the documented lowerable Yul subset.
- Stateful contracts backed by CashToken NFT commitments, including entry-backed mappings, chunked arrays,
  events, and the documented deploy, upgrade, destroy, split, and merge builders.
- The built-in proxy profile for scalar and data-NFT state, deployed through `upgrades.deployProxy`.
- A Hardhat-style project workflow through `@solidcash/testing` and SolidHat: configuration, CLI tasks, HRE,
  funded signers, factories, fixtures, time/block helpers, and the maintained chai assertion subset.
- Six aligned 0.13.1 packages with verified exports, declarations, embedded-source maps, CLIs, and installation
  from release tarballs. The packed consumer repeats the maintained stateful golden path.

See [`examples/testing-suite/MIGRATION.md`](examples/testing-suite/MIGRATION.md) for direct Hardhat, ethers, and
chai mappings.

## Experimental profiles

- Composed external state mutation and custom delegate-forwarding shapes beyond the built-in proxy profile.
- Layer-3/message-bus composition outside the frozen application and integrity matrices.
- Solidity source shapes outside the compatibility-manifest rows, even when the parser currently accepts them.

Experimental behavior is not part of the stable compatibility promise. Construction must stop with a named
diagnostic when the required transaction shape cannot be produced.

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

## Candidate evidence recorded on 2026-08-05

- Compiler suite: 3,146/3,146 across the complete run and isolated retries for three load-sensitive cases.
- SDK unit/e2e/mock suite: 3,808 passed, 39 skipped, 9 todo in the recorded full run.
- Generated-project gate: initialization 1/1, cache lifecycle 1/1, maintained harness 21/21.
- Packed-package gate: six tarballs and maintained stateful golden path 3/3.
- Application gates: mock-provider matrix 94/94 and serial BCHN v29 matrix 9/9.
- Integrity matrix: 81/81 executed tests with one documented skip, covering every stable physical state backend,
  external/delegate composition, and lifecycle elements. Experimental profiles remain outside the stable claim.
- Solidity corpus: 2,698/2,805 retained positives and 1,835/2,158 rejected negatives, with no residual timeout;
  strictness work is deferred as stated above.

These are candidate-worktree results, not a final release attestation. Before publishing, record the exact tested
commit and tag, rerun the clean-checkout aggregate gates, and replace this paragraph with the final results.
