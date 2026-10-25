# Release decision — SolidCash 0.14.0

This document triages the six named audit residuals and the five named unconditional skips, then states the
overall 0.14.0 release recommendation. Gate and suite evidence is recorded at the bottom, and the gate commands
are run exactly as shipped. The 2026-10-17 review changed no gate pin, test assertion, or compiler/SDK behavior;
the 2026-10-19 work fixed the lint, spellcheck and marketplace matrix failures listed below.

The release was renumbered from 0.13.1 to 0.14.0 on 2026-10-23 and first ships as `0.14.0-beta.1`. The evidence
below was recorded under the old number.

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

The deferral entry "A routed update of a proxy's records" in `deferrals.md` marks this RESOLVED 2026-10-14: the open half was an SDK placement bug, now verified; the
delegate-marking half was already done (`a00dd2f72`).

### 5. An in-place upgrade of a contract that keeps records (CRYPTO-4)

**Verdict: resolved (not a gap).**

The deferral entry "An in-place upgrade of a contract that keeps records" in `deferrals.md` marks this RESOLVED 2026-10-16 for all four record kinds (data NFTs, satoshi container, token
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

**Release-ready on the mocknet gates at `c7dc1b535`** (`master`, 2026-10-19). Every gate in the table below exits 0
at that commit, and the six residuals and five skips above stay non-blocking. `master` carries all the release work:
the readiness and matrix fixes (merge `168a45b9d`), `feat/tether-bch-native` (merge `e974a00e4`),
`solidcash_v0.13.1` (merge `30b457b10`, history only) and the D30 record (`c7dc1b535`). The most recent mocknet
verification ran at `e3d85e0b4` on master, 2026-10-24 to 2026-10-25: every gate passes once `a0883f157`, a test-only
commit, re-pins two e2e byte-identity hashes. Its gate table and the re-pins it needed are in "The 2026-10-24
verification" below. The 2026-10-23 run at `0f7da2afa` and its four green marketplace cells are in "The 2026-10-23
verification". Two items outside the gates are left for the release owner:

- `release-application-regtest` was not run: verification ran on mocknet only, by instruction. It last passed
  against stock BCHN v29.0.0 at `88cc906ec` (`docs/framed/REGTEST_AT_HEAD.md`).
- The marketplace matrix ran at `14bfff57a` with all four cells green (262/262), and again at `7e5c0f897` on
  2026-10-23 with the same four cells green (262/262), the latter on master `809de50f8` with the D49 layout. Both
  are semantic mock results on their named commits, not stock-BCHN claims.

## Gate and suite evidence

Final run on 2026-10-19 at `c7dc1b535`, mocknet only (`TESTS_USE_REGTEST` unset), one job at a time, tree clean
before and after every gate. The runs at `11b8f7feb` and `14bfff57a` are in this file's history.

| Gate | Result | Evidence |
|---|---|---|
| `scripts/gate.sh fast` | pass | exit 0: identity `{"routeBytes":44837,"fullBytes":242091,"fullHash":"cab3b849643b536f"}` matches (see note 1) |
| `scripts/gate.sh full` | pass | exit 0 (650 s): utils 512/512, solidc 7364 passed and 7 skipped (see note 2); identity as in `fast` |
| `kernel-beta-gate` | pass | exit 0 without `--allow-dirty` (34 min): `diagnosticOnly: false`, head `c7dc1b535`, sourceFingerprints matched, all 39 required kernel proofs passed; `--sources-only` exit 0 (see note 2) |
| `release-security-conformance` | pass | exit 0 (72 s) |
| `yarn test` | pass | exit 0 (29 min): utils 512/512; solidc 7364 passed, 7 skipped (see note 2); solidcash 5974 passed, 4 expected failures, 179 skipped, 5 todo; testing 113/113; testing-suite 27/27; solidhat 71 passed, 1 skipped (see note 4) |
| `yarn lint` | pass | exit 0 (203 s); the `11b8f7feb` failures were fixed by `0d670c83e` |
| `yarn spellcheck` | pass | exit 0, 2096 files, no unknown words; the `11b8f7feb` failures were fixed by `b5b3265db` |
| `check:source-tree` | pass | exit 0 |
| `release-package-smoke` | pass | exit 0 (293 s) |
| `release-docs-snippets` | pass | exit 0 |
| `release-corpus-baseline` | pass | exit 0 against the retained scorecard (see note 3) |
| `release-application-conformance` | pass | exit 0 |
| `release-generated-project-smoke` | pass | exit 0 |
| marketplace matrix | not re-run | last at `14bfff57a`: proxy x kernel 66/66, proxy x framed 66/66, no-proxy x kernel 65/65, no-proxy x framed 65/65 |
| `release-application-regtest` | not run | mocknet-only verification; last pass at `88cc906ec` |

Notes:

1. The identity step compiles `.marketplace/contracts/MarketplaceV1.sol`, an untracked directory of symlinks into
   the sibling `effectiveacceleration.ai` checkout. A fresh worktree has none, so the step prints nothing and the
   gate exits 1 with "bytecode changed"; the runs above copy it from the main checkout.
2. The battery ran in a checkout outside `/Code`, where the tests that need the sibling `effectiveacceleration.ai`
   checkout skip: 7 in solidc (4 files) and the three real-contract kernel files in solidcash. Those files (4 solidc,
   6 solidcash) then ran once from a checkout under `/Code`, where they find the sibling: solidc 36/36, solidcash 16
   passed and 3 skipped by their opt-in switches (`SOLIDC_REAL_CORPUS`, `L3_X168_*`). `kernel-beta-gate` ran from
   that checkout too. `EACC_CONTRACTS_DIR` cannot stand in for the location: the gate reads it as the repository
   root while the test helpers read it as `contract/contracts`, so the gate's journal steps would compile from the
   wrong path.
3. The gate checks the committed `bench/solidity-corpus/scorecard.txt` (2720/2805 positive, 149/2158 negative
   fixtures accepted) against `release-baseline.json`; it does not recompile the corpus. That scorecard was last
   regenerated at `a1e98a04a` (2026-10-12) and was reproduced identically by the 2026-10-14 integration run.
4. `ExactAdditiveRecurrenceSecurity.test.ts` runs close to its 120 s limit (98.5 s alone); it timed out once at
   `14bfff57a` while two marketplace cells ran beside `yarn test`, and passed in this run.
5. Outside the release gates, the affected SDK e2e files (at `14bfff57a`): `KernelDirectChunkedEntryUpdate` and
   `KernelDirectLogicalCaller` pass (the latter red since `24a61d5d1`); `MasterChefDeposit` fails at its allowance
   step because the test approves the physical `chef.address` while callees now see the logical CREATE lock (it was
   already red at a later step).

### The 2026-10-22 re-pin

The gates were re-run at master `809de50f8`, 245 commits past `c7dc1b535`, and the bytecode identity had moved.
Both pins were updated to the measured endpoint; no assertion or test filter changed.

| Pin | Old | New |
|---|---|---|
| `scripts/gate.sh` identity | `{"routeBytes":44837,"fullBytes":242091,"fullHash":"cab3b849643b536f"}` | `{"routeBytes":44840,"fullBytes":247572,"fullHash":"bf00ad8f2b11dc1e"}` |
| kernel manifest, marketplace-v1 legacy | 44837 / 242091 / `cab3b849…` | 44840 / 247572 / `bf00ad8f…` |
| kernel manifest, marketplace-v1 kernel | 14819 / 304457 / `6b43e224…` | 14824 / 309899 / `d71e2754…` |
| kernel manifest, unicrow-claim kernel | 1085 / 15436 / `75537e4f…` | 1092 / 15601 / `50af6a8a…` |

The fixture is untouched: the marketplace source still hashes to the manifest's pinned `57d93a5b…`, and the kernel
gate's two fresh compiles agree with each other. A bisect over the first-parent chain from `c7dc1b535` to
`4ebd75bfa`, the merge before the D49 branch landed, locates the first deviation at `efba0f1ef`
(`fix(containers): drop the token container's permissionless merge path`), inside the framed token-container line;
the identity then tracks that line's churn (242044 and 260292 full bytes at intermediate commits) to the endpoint.

### The 2026-10-23 verification

Every mocknet gate was re-run from the isolated worktree `/Code/cashscript/.worktrees/release-readiness`, branch
`release-readiness/2026-10-22`, created from master `809de50f8`; the verified tree is `0f7da2afa` (this section was
written after that run). Runs were made one at a time with `TESTS_USE_REGTEST` unset and no `SOLIDC_*` or `FRAMED_*`
overrides, and the tree was clean before and after each gate. The worktree's 237 symlinks all resolve inside it or to
the sibling `effectiveacceleration.ai` checkout.

| Gate | Commit | Result |
|---|---|---|
| `scripts/gate.sh full` | `0f7da2afa` | exit 0 (675 s): identity `{"routeBytes":44840,"fullBytes":247572,"fullHash":"bf00ad8f2b11dc1e"}` matches; utils 525/525; solidc 473 files, 7431 passed, 0 failed |
| `kernel-beta-gate` | `7e5c0f897` | exit 0 (34 min) without `--allow-dirty`: `diagnosticOnly: false`, `head 7e5c0f897`, sourceFingerprints matched, every required kernel proof passed |
| `yarn test` | `7e5c0f897` | exit 0 (34 min): utils 525/525; solidc 7431 passed; solidcash 5988 passed, 5 expected failures, 186 skipped, 5 todo; testing 118/118; testing-suite 27/27; solidhat 71 passed, 1 skipped |
| `yarn test:e2e` | `7e5c0f897` | exit 0 (23 min): 608 files, 3786 passed, 24 skipped, 3 todo, 0 failed |
| `yarn lint` | `0f7da2afa` | exit 0 (308 s) |
| `yarn spellcheck` | `0f7da2afa` | exit 0, no unknown words |
| `check:source-tree` | `0f7da2afa` | exit 0 |
| `check:doc-citations` | `0f7da2afa` | exit 0 |
| `release-security-conformance` | `0f7da2afa` | exit 0 (80 s) |
| `release-package-smoke` | `0f7da2afa` | exit 0 (317 s) |
| `release-docs-snippets` | `0f7da2afa` | exit 0 (10 s): 346 blocks, 172 standalone, 160 compiled, 12 skipped (imports a file the docs do not ship), 2 historical, 0 failed |
| `release-corpus-baseline` | `0f7da2afa` | exit 0 against the retained scorecard |
| `release-application-conformance` | `0f7da2afa` | exit 0 (13 s) |
| `release-generated-project-smoke` | `0f7da2afa` | exit 0 (28 s) |
| marketplace matrix | `7e5c0f897` | all four cells green, 262/262, 0 failed and 0 skipped; see `../../marketplace/marketplace-matrix-2026-10-14.md` |
| `release-application-regtest` | not run | mocknet-only verification, as in the 2026-10-19 run |

The gates ran at three successive commits because each failure was fixed and committed before the next gate: the
re-pin and the vocabulary fix, then the layout pins and the SDK derivation fix (`7e5c0f897`), then a return type on
the new guide-snippet test helper (`0f7da2afa`, test-only; the matrix cells' shipped code is unchanged by it).

What this run changed:

- The bytecode identity and both kernel cold baselines were re-pinned, as recorded in the 2026-10-22 section above.
- `kernel-beta-gate` refused an application name in the regtest provider's comment. The comment was fixed and the
  gate's vocabulary scan moved into `scripts/kernel-beta-vocabulary.mjs`, pinned by
  `scripts/kernel-beta-vocabulary.test.mjs`.
- Four D49 layout pins moved: the proxied `Table` fixture's data-NFT counts, the conditional-return output indices,
  and the `deployProxy` route's counts. Their assertions are unchanged; the values come from the compiled layouts.
- A D49 regression in the SDK's caller-side derivation: a framed callee whose entry writes two data NFT records had
  its second record materialized with the pre-call commitment, so the callee's route refused the transaction with
  `OP_VERIFY` at its master input. The derivation now re-probes until every required record is learned, pinned by
  `FramedExternalCallMultiRecordState.test.ts`.
- Two ERC-20 guide snippets gained the imports they were missing, and the scaled snippet its hook implementations;
  `Erc20GuideSnippets.test.ts` compiles both against the shipped `solidcash/contracts` base contracts.

### The 2026-10-24 re-pin

The gates were re-run at master `1b5f53076` and `63cd768a6`, and the bytecode identity had moved since the 2026-10-22
pin. Every pin was updated to the value measured at `63cd768a6`; no assertion or test filter changed.

| Pin | Old | New |
|---|---|---|
| `scripts/gate.sh` identity | `{"routeBytes":44840,"fullBytes":247572,"fullHash":"bf00ad8f2b11dc1e"}` | `{"routeBytes":44865,"fullBytes":246609,"fullHash":"30c4f5a157f93e83"}` |
| kernel manifest, marketplace-v1 legacy | 44840 / 247572 / `bf00ad8f` | 44865 / 246609 / `30c4f5a1` |
| kernel manifest, marketplace-v1 kernel | 14824 / 309899 / `d71e2754` | 14850 / 308917 / `1305ee5e` |
| kernel manifest, unicrow-claim kernel | 1092 / 15601 / `50af6a8a` | 1068 / 15869 / `74c05f87` |

The route-size screens follow the kernel routes: the marketplace route (14850) still exceeds the 10,000-byte limit
alone and the claim route (1068) does not. The fixture sources are untouched.

Each value was measured at every first-parent commit from `c21639b6e` to `63cd768a6` that changes compiler sources,
from a scratch build per commit; the measurement reproduces all four 2026-10-22 values at `c21639b6e`. Four commits
move them, and no other does:

| Commit | marketplace-v1 legacy | marketplace-v1 kernel | unicrow-claim kernel |
|---|---|---|---|
| `c21639b6e`, the 2026-10-22 pin | 44840 / 247572 | 14824 / 309899 | 1092 / 15601 |
| `0639d52bd`, call records (D50) | 44840 / 249466 | 14824 / 311772 | 1113 / 15986 |
| `6cece8511`, proxied route records pinned outside the window | 44914 / 249540 | 14899 / 311847 | 1113 / 15986 |
| `c1883fb8e`, one owner distance per delegate entry | 44914 / 247254 | 14899 / 309561 | 1113 / 15986 |
| `18860c4fd`, shared call-record settlement | 44865 / 246609 | 14850 / 308917 | 1068 / 15869 |

The direct multi-call commits (`b05a11f83` to `9285c4f39`), `173951f2e`, `86f001741` and `63cd768a6` leave all four
unchanged: these fixtures are message-bus compiles, and the compact call-record layout of `63cd768a6` applies to
direct compiles only.

### The 2026-10-24 verification

Every mocknet gate was re-run from the isolated worktree `/Code/cashscript/.worktrees/release-gates`, one gate at a
time, with `TESTS_USE_REGTEST` unset and no `SOLIDC_*` or `FRAMED_*` overrides; the tree was clean before and after
each gate. The final battery ran at `e3d85e0b4` from 2026-10-24 to 2026-10-25. It follows a battery at `63cd768a6`
and a re-run of that battery's red gates at `b7469b668`, both in this file's history. `e3d85e0b4` changes the
compiler, so every gate was run again on it. The one file the battery left red was re-pinned in `a0883f157`, which
changes only that test file.

| Gate | Commit | Result |
|---|---|---|
| `scripts/gate.sh full` | `e3d85e0b4` | exit 0 (817 s): identity `{"routeBytes":44865,"fullBytes":246609,"fullHash":"30c4f5a157f93e83"}` matches; utils 525/525; solidc 475 files, 7439 passed, 0 failed |
| `kernel-beta-gate` | `e3d85e0b4` | exit 0 (43 min) without `--allow-dirty`: `diagnosticOnly: false`, `head e3d85e0b4`, sourceFingerprints matched, all 39 required kernel proofs (87 titles) passed |
| `yarn test` | `e3d85e0b4` | pass, run per package (53 min, see below): utils 525/525; solidc 7439 passed (the `gate.sh full` run); solidcash 6003 passed, 5 expected failures, 186 skipped, 5 todo; testing 120/120; testing-suite 27/27; solidhat 72 passed, 1 skipped |
| `yarn test:e2e` | `e3d85e0b4`, one file at `a0883f157` | pass after a test-only re-pin: in five file chunks (37 min, see below), 617 files, 3808 passed, 24 skipped, 3 todo, 2 failed, both byte-identity pins in `IfConvertRepeatedEntryWrite.test.ts`; re-pinned in `a0883f157`, where the file passes 7/7 |
| `yarn lint` | `e3d85e0b4` | exit 0 (488 s) |
| `yarn spellcheck` | `e3d85e0b4` | exit 0, no unknown words |
| `check:source-tree` | `e3d85e0b4` | exit 0 |
| `check:doc-citations` | `e3d85e0b4` | exit 0 |
| `release-security-conformance` | `e3d85e0b4` | exit 0 (90 s) |
| `release-package-smoke` | `e3d85e0b4` | exit 0 (380 s) |
| `release-docs-snippets` | `e3d85e0b4` | exit 0 (11 s): 346 blocks, 160 compiled, 0 failed |
| `release-corpus-baseline` | `e3d85e0b4` | exit 0 against the retained scorecard |
| `release-application-conformance` | `e3d85e0b4` | exit 0 (18 s) |
| `release-generated-project-smoke` | `e3d85e0b4` | exit 0 (48 s) |
| marketplace matrix | not run | not part of this round, by instruction; last green at `7e5c0f897` |
| `release-application-regtest` | not run | mocknet-only verification, as in the earlier runs |

The host's memory guard stopped the first `yarn test` attempt after its first package, while the shared host's swap
was full; that attempt is not a gate result. `yarn test` and `yarn test:e2e` then ran as one vitest process per
package or file chunk, with two workers instead of the configured three. The chunks are vitest's own file lists
(`vitest list --filesOnly`): the SDK suite's 1,013 files in eight chunks and the 617 e2e files in five. The counts
above are their sums. The utils and solidc suites were not run again: utils passed in the stopped attempt (525/525),
and `gate.sh full` ran solidc's identical suite at the same commit.

`IfConvertRepeatedEntryWrite.test.ts` pins seven small direct-convention mapping contracts, by sha256, to the bytes
of the builds before its two if-convert fixes. `e3d85e0b4` encodes them 28 to 51 bytes shorter. Measured from
scratch builds: at `d1ae4038e` all seven reproduce the old pins. At `e3d85e0b4`, with every constant-id `OP_INVOKE`
expanded, each entry and the dispatcher is instruction-identical to `d1ae4038e` under both conventions, and no
top-level instruction lies outside the define table. `a0883f157` changes only the seven expected hashes and two
comments.

The owner's two `yarn test:e2e` decisions from the `63cd768a6` battery:

- `KernelNestedTuplePool.test.ts`: the title now expects `build()` of a looped call with a signer to return the bus
  composition `send()` broadcasts, and requires every input of it to pass the VM (`d1ae4038e`). Its state checks
  after zero, one and two rows now run. The refusal without a signer, in the title before it, stays.
- `OzBchNativeInheritance.test.ts`: the 9,450-byte budget stays. Measuring the real limit found an honest
  `transferFrom` of an 8-byte amount from a P2PKH holder to a P2SH32 lock whose master input was 10,005 bytes, over
  the 10,000-byte input limit, which mocknet does not enforce. `e3d85e0b4` cuts the script from 9,517 to 9,350 bytes
  without removing or reordering a check: each collection's entry-address helper reads the master's category
  itself, bounded-bytes parameter checks are shared, and the record carrier's category check uses the take-32
  helper. That input is now 9,838 bytes, and a new title holds it under 10,000; the P2PKH-to-P2PKH input went from
  9,987 to 9,820 bytes.

What this round changed:

- Package rename: the gate scripts and the kernel manifest name the `@solidcash/*` workspaces (`847f142c2`), and
  two comments it lengthened were rewrapped (`847f142c2`, `f449e2485`).
- Call-record (D50) follow-ups: `0e6f4414f` (two tests read D50 records), `862fd54ae` (two size pins),
  `173951f2e` (a compile crash on a call that leaves its arguments to the callee; its pre-D50 binding is an open
  residual in `docs/security/security-audit-2026-10-16.md`), `86f001741` (a raw call whose result is never read reads
  no record), `63cd768a6` (the OZ `transferFrom` input back under the limit).
- The bytecode identity and the kernel cold baselines, as recorded in "The 2026-10-24 re-pin" above. `e3d85e0b4`
  leaves them unchanged.
- The two decisions above: `d1ae4038e`, and `e3d85e0b4`, which also re-pins MinimalNativeToken (7,514 to 7,355
  bytes) and the BchNative wrapper (7,580 to 7,421 bytes).
- `a0883f157`: the if-convert byte-identity pins, as above.

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

### What closed the marketplace matrix failures (2026-10-19)

The 2026-10-18 handoff named one open matrix item, proxy x kernel arbitrate at input 1462. Running all four cells at
`11b8f7feb` also found no-proxy x kernel failing 20 titles; its last green record was the 2026-10-14/15 pre-merge
snapshot. Four causes, each fixed with a pinning test:

- **Arbitrate (proxy x kernel).** The handoff's two-layer diagnosis (`isOpRoll` against the tracked stack model; the
  return probe's placeholder) did not hold: the route computed its result correctly. Compose never fed claimed
  chunked stream records back into the assembled transaction, so the `Arbitrated` record stayed empty, every return
  probe stopped there, and admit refused the placeholder return. `a0ae125c1` feeds an unlearned chunked record its
  claim (`RuntimeEventClaimFeedBack.test.ts`).
- **Caller identity (no-proxy x kernel, 10 titles).** `24a61d5d1` (2026-10-16) made callees on the non-graph builder
  path see a caller's physical lock as `msg.sender`, while `getAddress()`, `address(this)` and the graph path use the
  logical CREATE lock: `onlyMarketplace` refused the marketplace, and token balances credited under one identity were
  debited under the other. `5f0d8e67b` presents the logical lock there again for a deployment whose route proves its
  own SCID; proxy, framed and native deployments keep the physical lock.
- **Value-chunk band lock (no-proxy x kernel, 8 titles).** The band picked its lock by a vote over every P2SH32 output
  in its window, so a caller's chunk run lent its lock and the reconcile refused the owner category. `9ba7fb6a5` lets
  only the band's own category vote (`ValueChunkBandOwnedLock.test.ts`).
- **Old value chunks of an in-place update (no-proxy x kernel, 2 titles).** The outside-layout walk (`cd0baa165`,
  2026-10-15) refused the spent old chunks of a chunked entry updated in a direct sorted-batch arm. `30ca5ea5e` admits
  the old chunk lock, and `14bfff57a` narrows that to entries that run the walk: inside a message-bus route the extra
  code only cost bytes and pushed the pooled atomic-bus callee's route input to 10,110 B, past the 10,000 B limit
  (`KernelDirectChunkedEntryUpdate.test.ts`).

Two residuals, neither on a failing path, are in `packages/solidc/docs/deferrals.md`: the single-write update arm
shares the old-chunk gap, and the scalar-only return fallback reads a composite return type as one word.
