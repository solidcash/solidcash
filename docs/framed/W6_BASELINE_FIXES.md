# W6 baseline rows: fixes and the reasons the rest stay

`W6_FAILURE_FIXES.md` covers the 28 regressions this stream introduced. This note covers the other half of W6
step 3: the rows `W6_BASELINE.md` already carried as pre-existing kernel or framed failures. Each row below is
either fixed, or left with the reason written down. Nothing is skipped silently.

## Landed

### The kernel upgrade route: 7 titles, `e01ea5f4d`

- `KernelUpgradeCompose.test.ts` (4) and `KernelUpgradeSignature.test.ts` (3), all failing
  `messageBus: BCH-2026 preflight failed at input N: Program failed an OP_VERIFY operation.`
- Cause: the upgrade variant's growth check `require(inputMutableCount == dataNftCount)`
  (`GenerateTargetTraversal.ts`, the `emitOwnCategoryMutableNftConservation` call for an upgrade) was passed
  `true` unconditionally, but a message-bus handler row appends inside the final existing data NFT and co-spends
  the participant's detached `MessageBusVerifier_*` NFT, whose token also carries the category. The census is
  therefore balanced (`inputs - outputs == 0`), not exact, and the guard refused.
- Fix: `upgradeMintsDataNfts = isUpgrade && node.messageBusEligible !== true && node.messageBusUpgradeRoute !== true`,
  passed to both `isUpgrade` branches. This restores the intent commit `e40c15ed2` recorded for a direct upgrade.
- The finding's "reading 2" (make the composer use the atomic verifier) is not viable: the bound graph route's
  `compactAtomicBinder` requires `activeVerifier >= 0`, so the detached verifier input is mandatory.
- Verified: both files whole (7 passed / 3 passed), `KernelSelfdestructStateCompose` 1/1, `e2e/Upgrade.test.ts`
  24/24, `KernelProxyUpgradeThenCompose` 3/3, and the negative titles still refuse.

### The framed `call/` rows: 4 of 7, `31bfe3cb7`

- Fixed: two of the three `branch-predicate-after-arm-write.test.ts` titles (the third, "refuses the plan the
  arm-folded predicate implied", was already passing) and both `skipped-batch-write.test.ts` titles.
- Causes: a call site's published branch condition was resolved at the call instead of at the branch
  (`serializeGuard` left `serializationProgramPoint` at the call while resetting `priorStatements`), so the arm's
  own write folded into the predicate it reads; and `PruneInlinedConstantBranches` dropped a literal-decided arm
  in every composition, so a framed entry lost the access of the write that arm holds.
- The whole framed config went from **7 failed / 1815 passed** to **3 failed / 1819 passed**.

## Left, with the reason

### The four batch-eligibility titles (`KernelIndependentComputedChunks`, `KernelMixedEntryInsert` x3)

Two independent pin contradictions, established by a full investigation that changed no file:

- `KernelDirectComputedChunks.test.ts:30` (and the same pin in `KernelDirectWitnessAbi.test.ts:29` and
  `solidc/test/WitnessAbiPublication.test.ts:19`) asserts
  `artifacts.Store.messageBus.handlers.find(h => h.name === 'update').eligible === false`, while
  `KernelIndependentComputedChunks.test.ts:47` requires the atomic composer to batch the same handler, which
  throws `Handler 'update' is not batch eligible: KERNEL_LAYOUT` unless the flag is `true`. The two `Store`
  artifacts are byte-identical; the difference is only how the SDK reaches the handler, a runtime choice the
  compiler never sees. Signals that do not distinguish them at the decision point were checked and ruled out:
  `compilerOptions.autoDelegate`, `fn.modifiers` (the auto-marker runs after route synthesis), and
  `messageBusGraphContext` with its sibling set.
- `KernelMixedEntryInsert` is a different conflict: `Ledger.update` is already eligible and the failure is a
  preflight `OP_VERIFY` because the runtime route drops the chunkable sorted batches. Restoring `db0551317`'s
  inclusion passes these three but fails seven other titles; writes-only inclusion still fails three; adding the
  `kernel-row-loop` alias sentinel re-opens `KernelMixedArrayMappingJournal`'s forged-entry refusal. No variant
  was net-positive.

Both are recorded rather than forced; no test was weakened or skipped.

### The nine operation-cost density titles

They fail `Program attempted an operation that would exceed the operation cost density limit` with the budget
exceeded by 5 to 2257 units. The mechanism is measured, not guessed:

- libauth's `densityControlLength` is the input's unlocking bytecode length plus 41, and the limit is that length
  times 800, so one byte of unlocking bytecode buys 800 units.
- `packages/solidcash/src/Contract.ts` already sizes such a reserve from the route's access stream for
  compiler-route frames (`kernelRouteDensityReserveBytes`), and a probe confirmed that function is never reached
  for these titles: they are direct ABI wrappers (selector not `534b4231`) or bare-batch kernel routes whose
  published ABI carries no access stream, so the reserve slot is empty (`OP_0`).
- A direct wrapper's frame is `selector || args || redeem` with no discarded positional slot. Inserting a pad
  after the selector, before it, twice, or below the redeem each broke the frame, and `OP_NOP` or a non-minimal
  push is rejected by consensus, so the padding cannot be added from the SDK alone.
- A working but unprincipled variant was found and **not landed**: sizing the bare-batch kernel reserve at 2560
  bytes turns `KernelLegacyObservableParity` green and one `KernelLoopCompose` title green, but it lengthens
  every bare-batch kernel input by 2.5 KB, the true deficit is not derivable from the published ABI (the printed
  "over by N" is only the abort point; the real shortfall is ~2300+ bytes), and a blanket reserve regresses
  `AtomicMessageBusCapacity.test.ts`, which pins exact per-input operation-cost maxima. Trading 2.5 KB on a broad
  route class for two titles, on a guess, is not worth the blast radius.

### `LogicalIdentityPreservation` x2

Neither is a product defect at this revision, and the second failure is a decision conflict:

- The file loads `examples/effectiveacceleration/artifacts/solidcash/FakeToken.json` when it exists and returns
  early when it does not. The copy in the worktree was generated 2026-10-03 and still carried the legacy
  `per-call` convention label, which no routing predicate accepts after the rename, so the deploy fell into the
  direct probe and the constructor aborted at instruction 15 (`Failed to derive initial state commitments`).
  Regenerating that project's artifacts with the current compiler (22 sources -> 26 artifacts, `FakeToken.json`
  now `framed`) removes that error.
- What remains is the identity assertion: the test calls `resolveLogicalIdentity(await token.getAddress())` and
  expects that address to hold the immutable SCID anchor. D22 (`cee831dc2`) makes a framed deployment report its
  framed execution lock there, which the proxied marketplace ladder requires. The two cannot both hold; D22 is the
  one that is live and is still awaiting the user's confirmation, so the tests are left failing with this reason
  rather than either side being changed.

### `plain-caller-identity`: "carries the caller's reported address whole"

The payload at offset 140 carries the caller's **20-byte identity, zero-padded**, not the 35-byte locking script
the title expects:

    Expected: "aa200ec9a7654f028350e80111d46933a6d98d8dc9bf31cd56284ef3c554084cf95487"  (35-byte P2SH32 lock)
    Received: "2dc0030097d6999495a069c3a217b2e37dcb8fab000000000000000000000000000000"

That is the D13 identity-in-results representation; the whole-lock form is what model B would bring, and the
plan's non-goals keep model B deferred. The title is left failing rather than re-pinned to today's shape, which
would have to be reverted when model B lands.

### `write-segments-settlement` and `proxy-external-calls-published`

- `write-segments-settlement` ("settles a refund-like entry"): still an `OP_VERIFY` at settlement in frame
  `implementation-master` of `Impl.refund()`. The published conditions were ruled out (a minimal reproduction
  showed the inlined helper's guarded call publishes `occurrence: conditional` with no condition, but making that
  condition literal `true` did not change the failure), so the cause is in the frame's segment and record
  declaration for four calls with a batch between them and a dynamic write after the last call. Not found.
- `proxy-external-calls-published` ("states one call per published site"): reports
  `FRAMED_HOST_STOP_SITES_UNPUBLISHED: the artifact publishes no framed stop-site table` in a worktree that has
  `.marketplace/artifacts/solidcash`; the file skips itself when that directory is absent. Not investigated.

## Environment note

`examples/effectiveacceleration/artifacts/**` is generated and untracked. The copies on disk predated the rename
and carried `composition.convention: per-call`; the gate recipe's "fixtures recompiled first" applies to them as
well as to `.marketplace`. They were regenerated in place for the runs this note reports.
