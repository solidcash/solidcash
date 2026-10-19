# Release decision — SolidCash 0.13.1

This document triages the six named audit residuals and the five named unconditional skips, then states the
overall 0.13.1 release recommendation. Gate and suite evidence is recorded at the bottom; the gate commands are
run exactly as shipped, and no gate pin, test assertion, or compiler/SDK behavior was changed as part of this
review (the 2026-10-19 re-verification fixed only the lint and spellcheck failures in notes 2 and 4 below).

## Audit residuals

### 1. View and static calls do not pin the callee's state in direct composition

**Verdict: fail-closed.**

A plain `I(a).m()` through a `view`/`pure` interface declaration runs in regular mode in direct composition, so a
bare interface (no state declarations) does not pin the callee's data NFTs. The explicit `.staticcall()` spelling
and low-level `staticcall` do pin the callee master (plus the data NFTs the caller's declared type names), so
callers that need read-only semantics already have a spelled-out path. The proposed ~45 B/view-call implicit flag
was reviewed and rejected (2026-10-14): the tax hits common read-only getters, and the scan would still not
inherit read-only into nested callee calls nor pin the callee's satoshi/token movement. The exact boundary is
pinned by `packages/solidc/test/StaticCallDirectPinning.test.ts` (2026-10-16). Non-blocking.

### 2. A framed proxy's `initialize` that calls another contract is not atomic (SDKFRAMED-2)

**Verdict: fail-closed.**

The default framed proxy deploy is atomic and refuses a calling initializer; only the documented
`initializeAs: 'hop'` opt-in runs the older multi-transaction flow, which has a front-running window on the hop
(not a wrong-state soundness hole). The atomic validator/composer machinery is largely landed (validator +
composer done, SDK genesis builder drafted); what remains is a compiler-side created-data-record read plus the
adversarial e2e wiring. No soundness gap on the default path. Non-blocking for the default profile.

### 3. Sorted batch targets sharing a node: one key written twice (DS-6)

**Verdict: fail-closed.**

The remaining aliasing shapes refuse cleanly rather than mis-settle; the common cases resolve, and the boundary is
pinned by `AuditDS6DefaultRelink.test.ts` and `AuditDS6ChainOneNode.test.ts` (11/11). The still-refused shapes
are unbounded `bytes`/`string` nodes, struct/array defaults, and array soft-delete tails. Non-blocking.

### 4. A routed update of a proxy's records (feat/per-call integration)

**Verdict: resolved (not a gap).**

`deferrals.md:3102` marks this RESOLVED 2026-10-14: the open half was an SDK placement bug, now verified; the
delegate-marking half was already done (`a00dd2f72`).

### 5. An in-place upgrade of a contract that keeps records (CRYPTO-4)

**Verdict: resolved (not a gap).**

`deferrals.md:3211` marks this RESOLVED 2026-10-16 for all four record kinds (data NFTs, satoshi container, token
containers, and mapping/array entries). No blocking residual.

### 6. Logical caller identity for native compiles (model B)

**Verdict: fail-closed.**

Native compiles fall back to the physical master lock for `msg.sender`/`address(this)`; the model-B migration
(inject a SCID anchor witness, ~45 B per read) is user-deferred (2026-10-05, confirmed 2026-10-14). The skipped
`KernelPhysicalCallerWithScidCompose.test.ts` tracks this deferral. Non-blocking: identity falls back, it does
not mis-settle.

## Unconditional skips

### 1. Invalid P2PKH unlocker diagnostics

**Verdict: accept.**

A negative diagnostics test (error-message quality for a wrong-key P2PKH unlocker). No shipped behavior or
soundness surface is gated by it.

### 2. Invalid P2PKH-only and mixed-input rejection

**Verdict: accept (list entry stale).**

The `TransactionBuilder.test.ts` `.skip` this entry names is no longer present in the tree; the rejection path is
not currently skipped. No blocking gap remains for this named item.

### 3. Address-slot representation parity

**Verdict: accept.**

Explicitly out of scope: a BCH address is a 25-byte locking bytecode, not a 20-byte EVM hash, so
`EvmStorageFoundation.test.ts`'s address-slot read-back is skipped with that rationale. Address slot fields stay
fail-closed, consistent with the deferral doc.

### 4. Atomic circular / self-referential calls

**Verdict: accept.**

Circular and self-referential cross-contract address references are listed as a first-release deferral in the
release notes; the shapes fail closed. The three skipped `CircularCalls.test.ts` cases track that deferral.

### 5. Unbounded-bytes return events

**Verdict: accept.**

The unconditional return-event ordering coverage is regtest-gated; unbounded return events ride the documented
"event payload larger than one 128-byte commitment" fail-closed edge. Non-blocking for the stable profile.

## Overall recommendation

**Release-ready on the mocknet gates** (re-verified 2026-10-19 at `11b8f7feb`, plus the lint and spellcheck
fixes `0d670c83e` and `b5b3265db`). Every gate in the table below passes, the six residuals and five skips above
stay non-blocking, and the changes that turned the 2026-10-17 failures green are listed under "What closed the
2026-10-17 failures".
Before tagging, the release owner still has to accept two things outside the gates, and cut from the right branch:

- `release-application-regtest` was not run at this commit: the re-verification ran on mocknet only, by
  instruction. It last passed against stock BCHN v29.0.0 at `88cc906ec` (`docs/framed/REGTEST_AT_HEAD.md`).
- The marketplace proxy x kernel arbitrate title fails its preflight at input 1462 (see "Open outside the gates").
- Cut the release from `master`. The one `solidcash_v0.13.1` commit missing from `master`, `aa8b1b3aa` (a
  brace-style change), is patch-equivalent to `d64213ab3` on `master` (`git cherry` reports it applied), so
  `master` holds all of that branch's content; bringing `solidcash_v0.13.1` along needs a merge, not a fast-forward.

## Gate and suite evidence

Re-run on 2026-10-19 at `11b8f7feb` in a fresh worktree, mocknet only (`TESTS_USE_REGTEST` unset), each gate as
shipped and once. The tree was clean before and after every gate. The 2026-10-17 run this replaces is in this
file's history.

| Gate | Result | Evidence |
|---|---|---|
| `scripts/gate.sh fast` | pass | exit 0: build ok; identity `{"routeBytes":44837,"fullBytes":242091,"fullHash":"cab3b849643b536f"}` matches; timing 13.7 s (see note 1) |
| `scripts/gate.sh full` | pass | utils 512/512 and solidc 7366/7366 (461 files), the gate's own baseline; identity as in `fast` (see note 1) |
| `kernel-beta-gate` | pass | exit 0 without `--allow-dirty` (31 min): `diagnosticOnly: false`, head `11b8f7feb`, sourceFingerprints matched, all 39 required kernel proofs passed; `--sources-only` preflight exit 0 |
| `release-security-conformance` | pass | exit 0 (63 s) |
| `yarn test` | pass | exit 0 (31 min): utils 512/512; solidc 7366/7366; solidcash 5966 passed, 4 expected fail, 179 skipped, 5 todo; testing 113/113; testing-suite 27/27; solidhat 71 passed, 1 skipped |
| `yarn lint` | pass after fix | exit 1 at `11b8f7feb`: two errors from `14c740758` (see note 2); exit 0 at `0d670c83e` across all seven packages and testing-suite |
| `yarn spellcheck` | pass after fix | exit 1 at `11b8f7feb`: about 250 unknown words (see note 4); exit 0 at `b5b3265db` |
| `check:source-tree` | pass | exit 0 |
| `release-package-smoke` | pass | exit 0 (310 s) |
| `release-docs-snippets` | pass | exit 0 |
| `release-corpus-baseline` | pass | exit 0 against the retained scorecard (see note 3) |
| `release-application-conformance` | pass | exit 0 (16 s) |
| `release-generated-project-smoke` | pass | exit 0 (42 s) |
| `release-application-regtest` | not run | mocknet-only re-verification; last pass at `88cc906ec` |

Notes:

1. The identity step compiles `.marketplace/contracts/MarketplaceV1.sol`, an untracked directory of symlinks into
   the sibling `effectiveacceleration.ai` checkout. A fresh worktree has none, so the step prints nothing and the
   gate exits 1 with "bytecode changed". With the directory copied from the lane's checkout (no sibling source
   changed after the pin), `fast` matches the identity; `full` ran its suites in the same worktree.
2. `@typescript-eslint/no-loop-func` in `packages/solidcash/src/network/RegtestNetworkProvider.ts` (the
   native-fetch RPC wrapper was built inside its loop) and an unused `hexToBin` import in
   `packages/solidcash/test/e2e/AuditContainerCommitment.test.ts`. `0d670c83e` hoists the wrapper into one helper,
   unchanged in behavior, and drops the import; type-check clean, and the two mocknet test files that construct
   the provider (`RegtestCategoryMintX74`, `VmProviderObserverX57`) pass.
3. The gate checks the committed `bench/solidity-corpus/scorecard.txt` (2720/2805 positive, 149/2158 negative
   fixtures accepted) against `release-baseline.json`; it does not recompile the corpus. That scorecard was last
   regenerated at `a1e98a04a` (2026-10-12) and was reproduced identically by the 2026-10-14 integration run; it was
   not regenerated at `11b8f7feb`.
4. Most of the unknown words sat in the machine-written `docs/marketplace-matrix-*.json` evidence, now excluded
   beside the other generated records; 62 vocabulary terms (BCHN options and RPC names, build libraries) joined
   the project dictionary, and the remaining fragments got scoped ignores (`b5b3265db`). Lint, spellcheck and the
   source-tree check are CI steps that were not among the handoff's gates.

### What closed the 2026-10-17 failures

The full list is `git log 34be189e4..11b8f7feb`. The commits that map directly onto a gate:

- `gate.sh` identity and the stale size pins: `c49525874` re-pins the solidc vmap, verifier and direct-identity
  sizes, the utils covenant lengths (+4 B under block-layout v2) and the X50 forwarder (308 -> 350 B), regenerates
  `defaultProxyArtifact.ts` and re-pins the gate identity; `5d2a1f242` and `11b8f7feb` re-pin again after later
  fixes. These accept measured growth; they encode no behavior.
- `kernel-beta-gate`: `c49525874` renames the three `Unicrow` comments. The `sdk-journal` composition failures
  are addressed by `e88aec180` (vmap batch trailing width, delegate outside-layout walk boundary), `3b9a27a32` (no
  redundant positional batch self-check in routes), `4b7602823` (`address(this)` in invoked route handlers) and
  `8fc4e3e5c` (outside-layout walk for proxy delegates), with the proof titles aligned (`a52da8417`,
  `2d1cdb082`) and the cold-compile baselines re-pinned (`4d30adee5`).
- `release-security-conformance`: X50's artifact regenerated and its pin refreshed (`c49525874`).
- `yarn test`: the utils pins (`c49525874`), the testing-suite signer (`92b74a226`) and the SDK fixture gating
  (`c049d0c25`, `db04ffbc3`).

## Open outside the gates

### Marketplace proxy x kernel arbitrate: preflight failure at input 1462

Reported by the 2026-10-18 readiness session at `11b8f7feb`; not re-run in this re-verification. The four-cell
262/262 result in `docs/marketplace-matrix-2026-10-14.md` belongs to the pre-merge snapshot it names. The
session's diagnosis, kept here because its plan file did not survive, has two layers:

1. Compiler: the roll consumption decided by `isOpRoll` (`packages/solidc/src/generation/GenerateTargetTraversal.ts`)
   disagrees with the tracked stack model.
2. SDK: the return probe falls back to the 96-byte placeholder.

Whoever picks up the marketplace matrix work should start from both layers.
