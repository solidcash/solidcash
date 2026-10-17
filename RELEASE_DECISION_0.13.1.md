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

**Not yet release-ready as-is. Ship after the triage and refreshes below are landed.**

The six residuals are all fail-closed or resolved, and the five skips are non-blocking edge/diagnostics coverage:
no soundness blocker hides in either list. The blockers are gate and suite failures. Several are stale
byte-length/identity pins from `745a72ddd` (block-layout v2) or a forbidden-name comment, but the solidcash SDK
suite additionally surfaces a real runtime `TypeError` and message-bus preflight failures that need triage:

1. `yarn test` is red and lerna bails at the first failure. Run individually, the workspaces total: utils
   `2 failed`, solidc `6 failed`, solidcash `38 failed` (after the 7 `PrecomputedValueChunkEntry` fixture
   failures were fixed in `6920138e4`), `@solidcash/testing` `0 failed`, testing-suite `0 failed`. The
   solidcash 38 include 33 message-bus preflight `OP_VERIFY` failures, two contracts over the 10000-byte input
   limit, and two logical-identity and one `PredOut` compose failures.
2. `kernel-beta-gate` is red: three kernel comment lines carry the forbidden `Unicrow` name. A comment rename
   makes the gate pass.
3. `release-security-conformance` is red: the shipped `defaultProxyArtifact.ts` is stale, and the X50 test's
   308-byte forwarder pin is stale (the compiler now emits 350 bytes).
4. `scripts/gate.sh` and six solidc tests hold stale bytecode-identity/size pins against `745a72ddd`.
5. `release-application-regtest` cannot run here (no BCHN/Fulcrum docker stack).

Details and exact test names are in the evidence sections below.

## Gate and suite evidence

Recorded below as each gate completes; captured under the goal scratch dir.

| Gate | Result | Evidence |
|---|---|---|
| `scripts/gate.sh fast` | **fail (triaged)** | exit 1: build ok; bytecode identity changed — `actual {"routeBytes":45047,"fullBytes":244791,"fullHash":"dcd8c1e0e0f12656"}` vs `expected {"routeBytes":40019,"fullBytes":115274,"fullHash":"ed6cfff8760a3ca8"}` |
| `scripts/gate.sh full` | **fail (triaged)** | exit 1: same bytecode identity; utils `2 failed \| 510 passed (512)`; solidc `6 failed \| 7360 passed (7366)` vs documented `189 failed / 4828 passed of 5017` |
| `release-package-smoke` | pass | exit 0 |
| `release-docs-snippets` | pass | exit 0 |
| `release-corpus-baseline` | pass | exit 0 |
| `release-application-conformance` | pass | exit 0 |
| `release-application-regtest` | **environment-blocked** | exit 1: BchnRpcClient `fetch failed` — no BCHN/Fulcrum docker stack |
| `release-generated-project-smoke` | pass | exit 0 |
| `release-security-conformance` | **fail (triaged)** | exit 1: `X50DefaultProxyRegenerated.test.ts` — shipped proxy artifact stale, and its 308-byte forwarder pin is stale (compiler emits 350 bytes) |
| `kernel-beta-gate` | **fail (triaged)** | exit 1: forbidden `Unicrow` names in three kernel comment lines |
| `yarn test` | **fail (triaged)** | exit 1: bails at `@solidcash/utils` — `2 failed \| 510 passed (512)`; remaining workspaces run individually (see workspace-suite-counts table) |

### `gate.sh` bytecode-identity triage

`scripts/gate.sh` is the performance-regression gate: its frozen `EXPECTED` identity
(`routeBytes:40019, fullBytes:115274, fullHash:ed6cfff8760a3ca8`) is a pre-change baseline. This branch carries
~500 accumulated semantic commits (the item-10 features, block-layout v2, and the security fixes), so the produced
artifact legitimately differs (`routeBytes:45047, fullBytes:244791`). The build and timing portions pass; the
identity FAIL is a stale perf-baseline pin against `master`, and the pin must be refreshed before the gate can be
used as a release gate.

### Solidc suite triage (6 failures)

`gate.sh full` prints `6 failed | 7360 passed (7366)`; a separate `yarn workspace solidc vitest run test/` pass
captured the names. All six are stale bytecode-size/optimization-shape pins, the same root cause as the
bytecode-identity pin above:

- `test/VMapBytecodeOptimizations.test.ts` (3):
  - `general vmap bytecode sharing > keeps depth-sensitive sorted-output authentication inline`
  - `general vmap bytecode sharing > shares a collection-specific entry address across reads and writes`
  - `general vmap bytecode sharing > shares repeated composite state traversal by structural type`
- `test/journal-message-bus/MessageBusVerifierSize.test.ts` (1):
  - `atomic verifier bytecode specialization > moves the global verifier out of the scalar master and keeps both covenants deployable`
- `test/framed/master/direct-path-identity.test.ts` (2):
  - `the direct convention is unchanged > emits the pinned bytecode for a stateful contract with a signature check`
  - `the direct convention is unchanged > emits the pinned bytecode for a stateful contract that reads msg.sender`

These are expectation pins against bytecode sizes/optimization shapes that `745a72ddd` (block-layout v2) moved;
they are pin refresh work, not evidence of a behavioral miscompile. The documented `189 failed / 4828 passed of
5017` baseline in `gate.sh` is itself stale: the suite has grown to 7366 tests and the 189 expected failures have
been reduced to these 6, so the baseline needs a refresh rather than a triage of 183 regressions.

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
| `solidc` | `gate.sh full` | `3 failed \| 458 passed (461)` files; `6 failed \| 7360 passed (7366)` tests |
| `solidcash` | `yarn workspace solidcash test` | `21 failed \| 955 passed \| 26 skipped (1002)` files; `45 failed \| 5931 passed \| 4 expected fail \| 167 skipped \| 5 todo (6152)` tests |
| `@solidcash/testing` | `yarn workspace @solidcash/testing test` | `25 passed (25)` files; `113 passed (113)` tests |
| `testing-suite` | `yarn workspace testing-suite test` | `7 passed (7)` files; `27 passed (27)` tests |

The solidcash count is the first measurement. Seven `PrecomputedValueChunkEntry` failures were fixed in
`6920138e4`, so 38 solidcash failures remain; see the triage below.

### Solidcash SDK suite triage (45 measured; 38 remaining after one fix)

The first measurement recorded 45 failures. One group was fixed in this review; the remaining 38 still need
triage:

- **`test/unit/PrecomputedValueChunkEntry.test.ts` — 7/7 failures. FIXED.** The direct-delegate chunk-owner
  derivation added in `44acff17f` reads `builder.rootCategoryId` (which resolves to `builder.categoryId`), but
  the hand-built unit fixture created the builder with `Object.create(StatefulTransactionBuilder.prototype)`
  without setting `categoryId`, so the registrar threw
  `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` at
  `packages/solidcash/src/stateful/sc-register-create-builder-builder-state.ts:456`. Fixed in `6920138e4` by
  giving the fixture the same category as the host (matching the real non-delegate path). The focused file now
  passes 7/7.
- **33 message-bus/kernel composition failures** across 17 files under `test/journal-message-bus/e2e/`
  (`KernelMultiContinuationResourceCompose` 8, `KernelProxyRouteLayoutWitnessCompose` 4,
  `KernelProxyEcrecoverSidecarCompose` 3, `AtomicMessageBusCompose` 3, `AtomicMessageBusCapacity` 2,
  `KernelProxyForeignEcrecoverCompose` 2, and 11 files with 1 each). The representative error is
  `messageBus: BCH-2026 preflight failed at input N: Program failed an OP_VERIFY operation` from
  `packages/solidcash/src/message-bus/preflight.ts`. These need a real triage, not a pin refresh.
- **`test/framed/deploy/constructor-dynamic-mint.test.ts` — 2/2 failures.** `ConstructorDynamicMint` compiles to
  10294/10327 bytes, exceeding the 10000-byte input-script limit by 294/327 bytes (block-layout-v2 growth).
- **`test/unit/LogicalIdentityPreservation.test.ts` — 2 failures.** Logical `CREATE` identity preservation
  (`FakeToken.json` across the marketplace fixture transfer/approve sequence).
- **`test/unit/PredOutSentinelComposeSync.test.ts` — 1 failure.** Layout-sentinel / `PredOut` compose sync gates
  on `layoutWitnessIsActiveCoordinate`.

### `kernel-beta-gate` triage

The gate fails on its forbidden-application-name fence: three kernel comment lines added since the census commit
contain `Unicrow` — `packages/solidc/src/compiler.ts` (pass-invocation comment),
`packages/utils/src/artifact.ts` (`reuseEntryLocalForWriteback` option doc), and
`packages/solidc/src/semantic/ReuseEntryLocalForWriteback.ts` (class doc). This is a comment-only leak of an
application-shaped name, not kernel logic. A comment rename (drop the `Unicrow` token, keep the description) makes
the gate pass; that edit is left to the releaser because this review's scope is judgment plus gate evidence, not
unilateral source changes.

### `release-security-conformance` triage

`X50DefaultProxyRegenerated.test.ts` fails on both of its guardrails for the shipped
`packages/solidcash/src/stateful/defaultProxyArtifact.ts`:

- the freshness assertion (shipped bytecode equals a fresh compile of `DEFAULT_PROXY_SOURCE`) fails because the
  shipped artifact is stale;
- a scratch regeneration shows the second assertion (forwarder length 308 bytes) is also stale: the current
  compiler emits a 350-byte forwarder.

The 42-byte growth traces to `745a72ddd` (block-layout v2). The regenerated artifact was reverted to keep this
review's diff Markdown-only; the releaser must regenerate `defaultProxyArtifact.ts` and refresh the 308-byte pin
to the current emitted size (or confirm the growth is intended).
