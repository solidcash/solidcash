# Marketplace `should whitelist worker` — entry-output cardinality defect (findings)

Status: **entry-output cardinality defect FIXED and committed** (`3ef649fcd`, one file, +7/-1); the title now
advances past BCH-2026 preflight and fails later in the test's own state-diff assertion. Numbers below are
reproduced on branch `grok/message-bus-kernel-beta` (worktree `/Code/cashscript/.worktrees/kernel-beta-candidate`),
artifacts under `.marketplace/artifacts/solidcash/`.

## Resolution of the cardinality defect

`_deriveFullTransactionState` used `implInputIndex + (physicalEntrySlot ?? blockSize)`. `blockSize` is the coordinate
just PAST the handler block, not an entry offset: `publishJobEvent` publishes master@0, dataNft@1, dataNft@2, entry@3,
event@4 (blockSize 5) and no `physicalEntrySlots`, so the SDK derived the entry at input+5 = 18 while the covenant
reads it at `INPUTINDEX + entrySlotOffset` = input+3 = 16 (`emitEntryOutputIndex`). Commit `3ef649fcd` prefers the
layout's own entry-slot offset (`blockLayout.slots.find(kind === 'entry').offset`), keeping the coordinate
metadata-driven.

Verified after the fix: `should whitelist worker` shows **0** `preflight failed` lines (was `input 13: OP_VERIFY`);
`message-bus-locking-groups` reports `inputs:[16] outputs:[16]` (was `[16,18]`); the four post-job guards pass
(4 passed / 62 skipped, run independently of the author); `yarn build` clean.

## Remaining blocker for this title (next target)

With entry geometry fixed, the title fails only in `checkJobFromStateDiffs`:
`AssertionError: expected false to deeply equal true` at `marketplace.test.ts:224` via `:1250` —
`getEvents(jobId, 0, 0)` decodes a jobEvents array whose last element lacks the newly published whitelist event,
while `getJob(jobId).whitelistWorkers` is true. The entry commitment itself is covenant-verified, so the defect is in
the chunked (P5b) jobEvents **value content / read-back**, not geometry.

Lead: `valueTailForEntry = valueTailFromTrace ?? valueTailFromSelected` (`StatefulContract.ts:14480-14492`) — for this
UPDATE the trace-extracted tail is byte-identical to `coSpent.value` (a *read* of the pre-state value, `e9000000…`)
while the authenticated computed tail is `05010000…`. Rejecting a trace tail equal to `coSpent.value` (i.e. computing
`coSpent` before that selection) is the suggested fix; the same mix-up also appears to drive the convergence thrash
(~361 s for this title versus ~45 s baseline).

## Reproduction

    yarn build
    yarn vitest --config vitest.marketplace.config.ts -t 'should whitelist worker$' --reporter=dot --no-file-parallelism

    Error: messageBus: BCH-2026 preflight failed at input 13: Program failed an OP_VERIFY operation.

Diagnostics used:

    SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=13  # large-equals / ring / locking groups
    SOLIDC_DEBUG_LOOP_ENTRIES=1                                                                # loop-entry-plan
    SOLIDC_DEBUG_VALUE_CHUNKS=1 SOLIDC_DEBUG_ENTRY_LOCK=<lock-prefix>                           # final-entry-outputs

## Localisation

* Failing instruction = index **344** of artifact body `functionBodies['a826ee9c']`
  (`MarketplaceDataV1.publishJobEvent`), an `OP_EQUALVERIFY` directly after a descending census loop (319–343).
* Emitted by `emitVerifySortedOutputCountRaw(4, …)` (`packages/solidc/src/generation/GenerateTargetTraversal.ts:27744`),
  whose only call site is `emitSortedValueUpsert` at line 20572 with expected `1n + extraCollectionOutputs`.
* `message-bus-large-equals` at failure: `left = 01` (expected) vs `right = 02` (found).
* The census counts transaction outputs at the collection's entry address. `message-bus-locking-groups` shows
  `aa2047362c5b4a0c…87` (category `ee643a16…`, slot `e3b0c442…` = `sha256("")`, i.e. `jobEvents[0]`) with
  `inputs: [16], outputs: [16, 18]` — one consumed entry, **two** recreated entries.
* Output 16 carries the new body (`…05010000d28c7c6d…53001471…204372`); output 18 is byte-identical to the consumed
  input commitment (stale pre-state body `…e9000000a68b212f…52001471…204372`). The stale copy is the illegal one.

The compiler's invariant (see the comment block at `GenerateTargetTraversal.ts:20446`) is deliberate: an update
recreates exactly one node, "plus one per co-spent read slot" (`extraCollectionOutputs`). `entryAccesses` for this
handler is a single slot with `operations: ["read","write"]` and `chunkableArrayValue: true`, so the expected
footprint is exactly one output.

## Emitters of the stale copy (addOutput stack attribution, instrumentation since removed)

1. `StatefulTransactionBuilder._padOutputsToIndex` (`StatefulTransactionBuilder.ts:7346`, called from ~16168):
   pads to a target index by cloning the **same-index input's** token, so when that input is a collection entry NFT
   it fabricates a second node at the entry address.
2. `StatefulTransactionBuilder.build` ~line 18226 (the `derivedChunkOutputs` placement loop): can place the entry at
   a **stale derived index** (18 instead of 16). The same hazard is already documented near line 16368
   (“stale entryIndex=15 while UPDATE lives at INPUTINDEX+3=16”).
3. `appendDelegateGroupOutputs` (`StatefulTransactionBuilder.ts:15894`): derived branch at 15934 emits a commitment,
   fallback branch at 15944 clones the input token, and the arm at **15906 is gated on the application function name**
   (`llcName === 'publishJobEvent'`), which violates the project rule against application/function-name logic.
   Merely disabling that arm did not by itself remove the duplicate, so (1)/(2) also need to be addressed.

## Focused composition-suite baseline (base vs this branch)

Measured with a worktree at the branch base `090c0d516` (built separately, `node_modules` symlinked) running the same
command on both trees:

    yarn workspace solidcash vitest run \
      test/journal-message-bus/AtomicMessageBusGraph.test.ts \
      test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts --reporter=dot

* base `090c0d516`: **13 failed | 57 passed (70)**
* branch HEAD (7 commits): **2 failed | 68 passed (70)**

Both remaining HEAD failures also fail at base, so the branch is 11 titles up with **zero regressions**:

* `materializes multiple heterogeneous child sites across two rows and rejects hostile genesis data` — pre-existing.
* `preserves a pooled long mapping return across event-emitting writes` — pre-existing; its first failing assertion is
  `expect(handlers.find(h => h.name === 'append')).toMatchObject({ eligible: true })`, i.e. a compiler route-admission
  assertion, not a VM failure. A construct probe compiled against both the base and HEAD compilers gives identical
  verdicts: a handler whose only statement is `this.items[key].push(...)` is rejected with
  `rejectionReason: KERNEL_LAYOUT` / `rejectionCode: MESSAGE_BUS_UNSUPPORTED_CONSTRUCT`, while
  `return this.items[key].length;` and struct-member reads of a mapping are `eligible: true`. The push-to-mapping-array
  write is therefore the trigger, and the marketplace write handlers (`publishJobEvent`, `registerUser`, …) carry the
  same `KERNEL_LAYOUT` rejection in the shipped artifacts.

## Marketplace ladder failures seen so far (30/66 titles run)

`/tmp/ladder-head.log` (isolated HEAD worktree, full 66-title file). Four failures up to title 30: three of one class
plus the entry-cardinality defect above.

* `register user > update user`, `register arbitrator > register arbitrator`, `register arbitrator > update arbitrator`
  fail with `Error: index out of bounds`, thrown at
  `expect((await marketplaceData.connect(arbitrator).getArbitrators(0, 0))…)`
  (`/Code/effectiveacceleration.ai/contract/test/marketplace.test.ts:426`).
* `job worker whitelisting > should whitelist worker` fails with the entry-cardinality OP_VERIFY above.

### Baseline methodology (important)

A naive base worktree is misleading: symlinking `node_modules` from the branch worktree makes workspace packages
resolve back to HEAD (`solidc` resolved to the branch checkout even when running from the base worktree). The reliable
baseline runner is `/tmp/kb-base/vitest.marketplace.base.config.ts`, which reuses the marketplace preset but prepends
explicit aliases to `/tmp/kb-base/packages/*/dist` for `solidcash`, `solidc`, `@solidcash/testing`, `@solidcash/solidhat`
and `@solidcash/utils`.

With that runner (base SDK + shared HEAD-compiled artifacts) all three `index out of bounds` titles fail identically at
base ⇒ **pre-existing, not regressions**. (Note: `/tmp/kb-base/packages/solidcash/src` currently carries temporary
`SOLIDC_DEBUG_PAGINATION` instrumentation; it lives only in that scratch worktree.)

### Root cause of the three `index out of bounds` titles

The revert text comes from the ported contract itself (`MarketplaceDataV1.sol:404`):

    uint256 arbitratorsLength_ = arbitratorAddresses.length;
    require(index_ < arbitratorsLength_, "index out of bounds");

Instrumentation shows the SDK *does* see the entry UTXOs — `getEntries('arbitrators')` reports `rawUtxos: 2,
filtered: 2` — yet the call still reverts, i.e. inside the VM the dynamic state array `arbitratorAddresses` reads as
length 0, while the `users`/`userAddresses` equivalent works in the passing `register user` title. The defect is in how
the view call's witness for that dynamic array is derived/supplied, not in entry enumeration.

## Tried and rejected (keep for the next attempt)

`StatefulContract.ts` derives the entry output coordinate as
`layoutEntryIndex = implInputIndex + (physicalEntrySlot ?? blockSize)`. `blockSize` is the coordinate *just past*
the handler block, so it names a trailing slice rather than the entry slot whenever the block has a slot after the
entry (`publishJobEvent`'s layout is master, dataNft, dataNft, entry@3, event@4). Replacing `blockSize` with the
published layout offset (`(nestedEntryAbi?.blockLayout ?? llc.blockLayout)?.slots.find(s => s.kind === 'entry')?.offset`)
was implemented, built and measured: `should whitelist worker` still fails identically (same census OP_VERIFY), so the
extra entry output is produced by the other emitters listed above, not by this coordinate. Change reverted; tree is
back to the verified state (build OK, four post-job guards green).

## Ladder failure census (61 of 66 titles reached: 26 pass / 35 fail)

From `/tmp/ladder-head.log` (isolated HEAD worktree, correct dist + artifacts):

| count | reason (first line of the failure) |
|---|---|
| 15 | `Expected transaction NOT to be reverted, but it reverted.` (revert reason on the following line) |
| 9 | `messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.` |
| 3 | `index out of bounds` — pre-existing `getArbitrators`/`getUsers` view-witness defect above |
| 1 | `input 13: OP_VERIFY` — `should whitelist worker` (this document) |
| 1 | `input 3: OP_VERIFY` |
| 1 | `External message-bus batch selector a826ee9c is not advertised as an eligible callee handler` — direct fallout of the `KERNEL_LAYOUT` write-handler ineligibility recorded above |
| 1 | `Delegate external call to MarketplaceDataV1.getArbitratorFee (offset 5) has arguments that cannot yet be resolved by the SDK` — same class the earlier `aa1e721b6` fix addressed |
| 1 | `Cannot read properties of undefined (reading 'to')` — SDK crash, worth a stack trace |

## Needed invariant

For one logical entry update there must be exactly one output at the collection entry address, carrying the final
derived body, at the index the covenant pins (child master input index + block offset — here 16 = input 13 + 3).
