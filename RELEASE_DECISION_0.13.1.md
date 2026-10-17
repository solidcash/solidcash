# Release decision — SolidCash 0.13.1

This document triages the six named audit residuals and the five named unconditional skips, then states the
overall 0.13.1 release recommendation. Gate and suite evidence is recorded at the bottom; the gate commands are
run exactly as shipped.

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

**Not yet release-ready. One real blocker remains: the message-bus kernel composition suite is red.**

The six residuals are all fail-closed or resolved, and the five skips are non-blocking edge/diagnostics coverage.
The mechanical and stale-pin gate failures found in this review are now fixed: `gate.sh`'s bytecode-identity pin
is refreshed, the three forbidden `Unicrow` comment names are removed, the X50 proxy artifact and its forwarder
byte-length pin are refreshed, and the `MessageBusVerifierSize` pin is refreshed. `scripts/gate.sh full` and
`release-security-conformance` now exit 0.

What still blocks 0.13.1 is `kernel-beta-gate`'s `sdk-journal` phase: 33 message-bus composition e2e tests fail
with `messageBus: BCH-2026 preflight failed at input N: Program failed an OP_VERIFY operation`. The block-layout
v2 refactor (`745a72ddd`) unified the front-region auxiliary co-spend band in the compiler and the SDK's direct
path (`orderedFrontRegionCoSpends` in `stb-build-inputs.ts`), but the message-bus composition assembly path
(`compose-assembly-runtime.ts`) was not updated to honor the new band, so its assembled input order no longer
matches the emitted covenants. That is a soundness-adjacent regression, not a pin refresh, and it needs dedicated
engineering before release.

Remaining suite hygiene (non-blocking to the gates, but must be triaged): 2 utils byte-length pins, 5 solidc
bytecode-size pins, and 5 non-journal solidcash failures (2 contract-size overflows, 2 logical-identity, 1
`PredOut` compose). Details are below.

## Gate and suite evidence

Recorded below as each gate completes; captured under the goal scratch dir.

| Gate | Result | Evidence |
|---|---|---|
| `scripts/gate.sh fast` | pass | subset of `full`; bytecode identity now matches after the pin refresh |
| `scripts/gate.sh full` | **pass** | exit 0: build ok; bytecode identity ok (`45047/244791/dcd8c1e0e0f12656`); utils `2 failed \| 510 passed (512)`; solidc `5 failed \| 7361 passed (7366)` |
| `release-package-smoke` | pass | exit 0 |
| `release-docs-snippets` | pass | exit 0 |
| `release-corpus-baseline` | pass | exit 0 |
| `release-application-conformance` | pass | exit 0 |
| `release-application-regtest` | **environment-blocked** | exit 1: BchnRpcClient `fetch failed` — no BCHN/Fulcrum docker stack |
| `release-generated-project-smoke` | pass | exit 0 |
| `release-security-conformance` | **pass** | exit 0: all 15 scenarios, including the regenerated X50 proxy freshness check |
| `kernel-beta-gate` | **fail (triaged)** | exit 1 at `sdk-journal`: 33 message-bus composition failures; the name fence and `compiler-journal` phases now pass |
| `yarn test` | **fail (triaged)** | exit 1: bails at `@solidcash/utils` — `2 failed \| 510 passed (512)`; remaining workspaces run individually (see workspace-suite-counts table) |

### `gate.sh` bytecode-identity triage (resolved)

The frozen `EXPECTED` identity was a pre-change baseline (`routeBytes:40019, fullBytes:115274,
fullHash:ed6cfff8760a3ca8`). This branch carries the item-10 features, block-layout v2, and the security fixes,
so the produced artifact legitimately differs. The pin is refreshed to the current measurement
(`routeBytes:45047, fullBytes:244791, fullHash:dcd8c1e0e0f12656`) in `aad8767c3`, and `gate.sh full` now exits 0.

### Solidc suite triage (5 failures)

`gate.sh full` prints `5 failed | 7361 passed (7366)`. All five are stale bytecode-size/optimization-shape pins
from block-layout v2:

- `test/VMapBytecodeOptimizations.test.ts` (3):
  - `general vmap bytecode sharing > keeps depth-sensitive sorted-output authentication inline`
  - `general vmap bytecode sharing > shares a collection-specific entry address across reads and writes`
  - `general vmap bytecode sharing > shares repeated composite state traversal by structural type`
- `test/framed/master/direct-path-identity.test.ts` (2):
  - `the direct convention is unchanged > emits the pinned bytecode for a stateful contract with a signature check`
  - `the direct convention is unchanged > emits the pinned bytecode for a stateful contract that reads msg.sender`

`test/journal-message-bus/MessageBusVerifierSize.test.ts` was re-pinned in `1368112ac` (direct 619→629, composed
1876→1881, framework tax 1257→1252) and now passes. These remaining pins are refresh work, not evidence of a
behavioral miscompile.

### `yarn test` triage

`yarn test` is `lerna run test --ignore solidcash-examples && yarn workspace testing-suite test`; lerna bails on
the first failing package, so the run stopped at `@solidcash/utils` before reaching solidc, solidcash, or the
testing-suite. The two failures are byte-length pins in `packages/utils/test/state.test.ts`:

- `buildEntryNftCovenantScript (dual-path) > should use the category-pinned form`: expected 212, got 216.
- `buildValueChunkCovenantScript (digested domain) > commits to the tagged collection/slot/root tuple in 224 bytes`: expected 224, got 228.

Both covenant scripts grew by 4 bytes under block-layout v2. Because lerna bails at the first failure, the
remaining workspaces were then run individually to collect their milestone counts.

### Workspace suite counts

| Workspace | Command | Result |
|---|---|---|
| `@solidcash/utils` | `gate.sh full` | `1 failed \| 26 passed (27)` files; `2 failed \| 510 passed (512)` tests |
| `solidc` | `gate.sh full` | `2 failed \| 459 passed (461)` files; `5 failed \| 7361 passed (7366)` tests |
| `solidcash` | `yarn workspace solidcash test` | `20 failed \| 956 passed \| 26 skipped (1002)` files; `38 failed \| 5938 passed \| 4 expected fail \| 167 skipped \| 5 todo (6152)` tests |
| `@solidcash/testing` | `yarn workspace @solidcash/testing test` | `25 passed (25)` files; `113 passed (113)` tests |
| `testing-suite` | `yarn workspace testing-suite test` | `7 passed (7)` files; `27 passed (27)` tests |

The solidcash count reflects the 7 `PrecomputedValueChunkEntry` failures fixed in `6920138e4`; 38 remain (33
message-bus composition, 2 contract-size overflows, 2 logical-identity, 1 `PredOut` compose). The solidc count
reflects the `MessageBusVerifierSize` re-pin in `1368112ac`.

### Solidcash SDK suite triage (38 remaining failures)

- **33 message-bus/kernel composition failures** across 17 files under `test/journal-message-bus/e2e/`
  (`KernelMultiContinuationResourceCompose` 8, `KernelProxyRouteLayoutWitnessCompose` 4,
  `KernelProxyEcrecoverSidecarCompose` 3, `AtomicMessageBusCompose` 3, `AtomicMessageBusCapacity` 2,
  `KernelProxyForeignEcrecoverCompose` 2, and 11 files with 1 each). The representative error is
  `messageBus: BCH-2026 preflight failed at input N: Program failed an OP_VERIFY operation` from
  `packages/solidcash/src/message-bus/preflight.ts`. This is the same block-layout-v2 band mismatch that fails
  `kernel-beta-gate`'s `sdk-journal` phase.
- **`test/framed/deploy/constructor-dynamic-mint.test.ts` — 2/2 failures.** `ConstructorDynamicMint` compiles to
  10294/10327 bytes, exceeding the 10000-byte input-script limit by 294/327 bytes (block-layout-v2 growth).
- **`test/unit/LogicalIdentityPreservation.test.ts` — 2 failures.** Logical `CREATE` identity preservation
  (`FakeToken.json` across the marketplace fixture transfer/approve sequence).
- **`test/unit/PredOutSentinelComposeSync.test.ts` — 1 failure.** Layout-sentinel / `PredOut` compose sync gates
  on `layoutWitnessIsActiveCoordinate`.

### `kernel-beta-gate` triage

The forbidden-name fence is fixed in `aad8767c3`: the three `Unicrow` comment lines in
`packages/solidc/src/compiler.ts`, `packages/utils/src/artifact.ts`, and
`packages/solidc/src/semantic/ReuseEntryLocalForWriteback.ts` are renamed away, so the source-fingerprint phase
reports `matched`. The `compiler-journal` phase passes after the `MessageBusVerifierSize` re-pin (`1368112ac`).

The gate now fails only at `sdk-journal` (`yarn workspace solidcash vitest run test/journal-message-bus`): 33
message-bus composition e2e failures, the same set listed above. The block-layout-v2 commit unified the
front-region auxiliary band in the compiler and the SDK's direct path but did not update the message-bus
composition assembly, so the composed input order no longer satisfies the emitted covenants. This is the
release-blocking item.

### `release-security-conformance` triage (resolved)

The gate's X50 scenario failed because the shipped `defaultProxyArtifact.ts` was stale and its forwarder
byte-length pin was 308 bytes against the current 350-byte emit. Fixed in `aad8767c3`: the artifact is
regenerated via `scripts/regenerate-default-proxy.ts` and the X50 pin is refreshed to 350. The full
`release-security-conformance` run now exits 0.
