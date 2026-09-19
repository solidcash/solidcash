# Handoff — kernel-beta marketplace climb (next session)

## SESSION 3 HEADLINE (read this before the older rounds below)

* **HEAD is now `46d682882`** (two commits on top of `c4bd81467`), both compiler-only, both test-covered:
  * `2a46c48d4` **stop advertising a repeated message-bus batch the callee route refuses**. A batch group lives in the
    CALLER's bytecode (`emitExternalBatchBlobVerification` hard-requires the `0453434231` envelope), so grouping a
    repeated call to a callee whose route refuses the handler produces a transaction that can never be composed.
    `SymbolTableTraversal` now drops such slots from the group when the callee's source is part of this compilation
    (interface-only callees stay unknown and keep the old behavior), kernel-scoped because the refusal is kernel-only.
  * `46d682882` **record the value a handler wrote for a rebuilt state-array entry** (the real item-1 payload fix; see
    the round-45/49 history below for how it was localised). The dominating-write analysis is now field-precise, treats
    a whole-entry struct rebuild as a per-field write, ignores a rebuild argument that is the rebuild itself / the read
    being serialized / a re-read of the same field from the same entry, and resolves the dynamic-array cache local
    (`__dlcache_x = x`) so a write through that alias counts.
* **Gates at HEAD**: `yarn build` clean; `packages/solidc` ExternalCalls + journal-message-bus + InvocationAnalysis =
  **11 failed / 1521 passed**, the same 11 pre-existing failures as the pre-change baseline (11 failed / 1507 passed) —
  zero new failures; post-job guards (`post job 1$`, `post two jobs$`, `post job with invalid mece tags$`,
  `post job with whitelist$`) **4 passed / 62 skipped** with regenerated artifacts.
* **The ladder's dominant failure class has moved and is now precisely named.** With both commits plus regenerated
  artifacts, the titles that used to die at admission
  (`External message-bus batch selector a826ee9c is not advertised as an eligible callee handler`) now compose and fail
  later with:
  `Could not derive the return value of 'pay' for .emitReturn(). The covenant trace did not expose an authenticated
  return commitment.` — measured on `take job$`, `deliver result$`, `refund$`. That single message is the next block to
  work: it is an `IUnicrow.pay` **return-value derivation** failure in the SDK, not an admission or payload problem.
* **`should whitelist worker` and `update job` are NOT regressions but they are not fixed either**: both exceed 300 s in
  the SDK's `_assertConvergedFinalTransaction` repair loop (`SOLIDC_DEBUG_REPAIR_CONVERGENCE=1` shows 32 repairs per
  sweep proposing an 81-byte commitment against a 64-byte previous one, first difference at byte 128). A control run
  with the **round-46 artifacts** (`/tmp/kb-artifacts-105-preargfix`) hangs the same way, so this non-convergence
  predates this session's changes and is the real item-1 blocker (`_repairComputedChunkOutput`,
  `StatefulTransactionBuilder.ts:21044`).

### Regenerating the marketplace artifacts (supersedes the §4.1 recipe — **no symlinks**)

`.marketplace/iteration/` holds a scratch project (`solidcash.config.ts` + `recompile.sh`) that compiles each
marketplace source into its own private artifact directory and merges the result into the fixture:

    cd .marketplace/iteration
    ./recompile.sh MarketplaceV1.sol MarketplaceV2.sol MarketplaceV3.sol MarketplaceDataV1.sol EACCToken.sol \
      TreasurySplit.sol unicrow/FakeToken.sol unicrow/Unicrow.sol unicrow/UnicrowDispute.sol \
      unicrow/UnicrowArbitrator.sol unicrow/UnicrowClaim.sol

One source per invocation because a combined `--iteration` run silently omitted `MarketplaceDataV1` and
`UnicrowDispute`, and because `MockSablierLockup.sol` needs an external dependency that is not in this repository —
omitting it is why no symlink is required. Every compile **replaces** the artifact tree it writes to, so per-source
output directories plus a merge are mandatory; the fixture keeps its other 94 artifacts because the merge only
overwrites the files the scratch build emitted.

### Measurements taken this session

| title | before (round-46 artifacts) | after (both commits + regenerated) |
|---|---|---|
| `post job 1`, `post two jobs`, `post job with whitelist`, `post job with invalid mece tags` | pass | **pass** |
| `take job` | admission error (`a826ee9c` not eligible) | `Could not derive the return value of 'pay' …` |
| `deliver result`, `refund` | admission error | `Could not derive the return value of 'pay' …` |
| `job not taken` | admission error (`ec3e6b08`) | > 300 s (bounded run) |
| `should whitelist worker`, `update job` | > 300 s (control run, old artifacts) | > 300 s |

Both commits are compiler-only; the SDK is untouched this session. Full-suite ladder was deliberately not re-run
because the two known-hanging titles would consume its budget; run it only after the `pay` derivation and the repair
convergence are addressed.

### Next steps, in order

1. **`IUnicrow.pay` return derivation** (`Could not derive the return value of 'pay' for .emitReturn()`). This is now
   the gate on the whole `take job` / `deliver result` / `refund` / `dispute` / `arbitrate` family. Measured once with
   `SOLIDC_DEBUG_COLLECTION_FETCH=1` on `take job$`: `_deriveReturnBlob` (`StatefulContract.ts:30929`) gets
   `returnOutputIndex: 6`, `inputIndex: 0`, and the probe trace dies with
   `Program attempted to read from an invalid transaction output index. Transaction output count: 8; requested index: -1.`
   The transaction has 8 outputs; output 6 is the return output and carries the placeholder commitment `00` (empty),
   while outputs 4 and 7 are collection entries (`e3b0c44298fc1c14…` = `sha256("")` and an all-zero commitment). So the
   return materialization output exists at the right index but never receives a real commitment, and the executing
   input reads a *negative* output index while the trace is still provisional. Start from the `-1` read (a relative
   output index whose left operand is zero) and from why the pay return band stays at the `00` placeholder.
2. **`_repairComputedChunkOutput` convergence** for a handler that publishes an event whose payload is now the value
   the handler wrote: the repair loop proposes a commitment that is 17 bytes longer than the previous one (81 vs 64)
   with a 128-byte common prefix, 32 times per sweep.
3. Item 3 (`register arbitrator` / `update arbitrator` / `update user`, `index out of bounds`) is untouched: see the
   round-30–42 history below.

---

## STATE OF PLAY (end of the 40-round session) — read this first

* **Landed and verified** (HEAD `16324293e`, base `090c0d516`, 10 commits): the perf merge is an ancestor and its
  gates are green; the Prepared/Planned exact-selector authority hazard is fixed without name-derived authority
  (`b885cea9e`); producer transport / producer-aware descriptor selection landed (`2db4121f6`); and the two additive
  SDK commits from this session (`90895948b` `map:` label evaluation, `16324293e` route-row context binding).
  Gates at HEAD: `yarn build` clean; focused SDK 39/39 (RouteRowExpressionKey + PreparedProducerSelectorAuthority +
  MappingReadAfterWrite + DirectMappingReadPlan); post-job marketplace guards 4 passed / 62 skipped; composition
  suites base 13 failed → HEAD 2 failed (zero regressions).
* **Not achieved**: the 66-title ladder is **26 pass / 39 fail** (plus the last title timing out) and has not moved
  this session - every landed change was additive and verified on its own terms, none flipped a title. Two red blocks
  remain, each with a proven root cause and a fully specified next step:
  1. `should whitelist worker` (+ the 9 `update job` titles, same class): the event payload is **SDK-computed from
     pre-write state** because `aa1e721b6` keeps the anchored read-after-write cache out of kernel routes; the fix is
     post-write argument evaluation (`stateIncludesPriorWrites` exists but is never passed `true`). See item 1.
  2. `register arbitrator` / `update arbitrator` / `update user` (`index out of bounds`): the read's entry key never
     resolves - the true producer is `compose.ts:1393-1426`, the operand type is now known (`entryArgs` values are JS
     `number`s, not bigints), and the last measurement left one binary question with its probe. See item 3.
* **Method note**: nine hypotheses were tested and disproved this session; all are recorded in the item-3 negatives and
  the round-30/31/35/36/37/38/39 addenda below. Do not re-run them - start from the two named probes.

## Where things are

* Worktree: `/Code/cashscript/.worktrees/kernel-beta-candidate`
* Branch: `grok/message-bus-kernel-beta`, base `090c0d516`, **HEAD `16324293e`** (10 commits on the base)
* Commits, oldest first: `b885cea9e` (Prepared/Planned exact producer selectors, no name-derived authority),
  `2db4121f6` (producer context / producer-aware descriptor selection), `cadb5dbe8` (stop borrowing chunk values from
  the category-global cache), `4fc2e3529` (read-after-write regression test), `c5faff282` (compiler fix for
  read-after-write in one handler), `aa1e721b6` (keep the anchored mapping cache out of kernel route compilation),
  `c86c01b21` (stamp empty event timestamps in derived continuation values), `3ef649fcd` (nested sorted entry must be
  addressed at its published block-slot offset), `90895948b` (`evalComputedKey` gains the
  `map:<stateArray>(<index>)` label form), `16324293e` (`resolveRouteRowExpressionKey` binds a `map:` label's
  source-loop local to the single selected row's `occurrenceIndex`; additive, both candidate wiring sites measured
  off-path).
* Detail and evidence for all of the above: `MARKETPLACE_ENTRY_CARDINALITY_FINDINGS.md` (same directory).

**Never commit the four fenced files** (they are intentionally dirty):
`examples/testing-suite/artifacts/golden_token.artifact.ts`, `examples/testing-suite/artifacts/golden_token.json`,
`scripts/kernel-beta-manifest.json`, `solidcash.config.ts`. Never commit generated `.js` / `.d.ts` / `.js.map`.
Do not modify Marketplace/Unicrow Solidity or the 66-title suite; fix compiler/SDK/harness generally, never by
application/function/source names.

## Verified state (measured this session)

| gate | result |
|---|---|
| `yarn build` | clean |
| guards `-t 'post job 1$\|post two jobs$\|post job with invalid mece tags$\|post job with whitelist$'` | 4 passed / 62 skipped |
| `test/unit/PreparedProducerSelectorAuthority.test.ts` + `test/e2e/MappingReadAfterWrite.test.ts` | 15/15 |
| composition suites (see below) base → HEAD | **13 failed / 57 passed → 2 failed / 68 passed**, zero regressions |
| perf branch `perf/marketplace-speedup-investigation` (`69b523871`) | confirmed ancestor of the base |
| marketplace ladder (66 titles) | pre-`3ef649fcd` baseline **26 pass / 39 fail over 65 titles** (40 `×` lines incl. title 66's 600 s timeout). `/tmp/ladder-3ef-clean.log` matches the old prefix exactly (25 pass / 3 fail over the 28 titles it reached) — the count did not move. |
| artifact freshness | **verified, no regeneration needed**: `packages/solidc/dist/semantic/CacheMappingEntryInLoop.js` (mtime 08:04:58) already contains `aa1e721b6`'s `routeSnapshotKeysOnly` restriction, and `.marketplace/artifacts/solidcash/*.json` carry `updatedAt` 07:54–08:24 (files copied 09:15). |

Working agreement (current): **do not re-run the full ladder or full suites after small edits.** Batch changes and
verify with the focused titles below; escalate to a full run only when a block of fixes has landed.

Fast focused loop (each is a *single* title; `register arbitrator$` ≈ 17 s, `update job$` ≈ 75 s,
`should whitelist worker$` ≈ 70 s):

    yarn vitest --config vitest.marketplace.config.ts -t '<title>$' --reporter=dot --no-file-parallelism

Composition command: `yarn workspace solidcash vitest run test/journal-message-bus/AtomicMessageBusGraph.test.ts test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts --reporter=dot`

## What `3ef649fcd` fixed (do not regress it)

`_deriveFullTransactionState` derived a nested sorted entry's output coordinate as
`implInputIndex + (physicalEntrySlot ?? blockSize)`. `blockSize` is the coordinate just PAST the block. For
`MarketplaceDataV1.publishJobEvent` (layout master@0, dataNft@1, dataNft@2, entry@3, event@4; blockSize 5; no
`physicalEntrySlots`) the entry was derived at input+5 = 18 while the covenant reads it at
`INPUTINDEX + entrySlotOffset` = input+3 = 16 (`emitEntryOutputIndex`). Two outputs landed at the collection entry
address, so the covenant's collection-footprint census (`emitVerifySortedOutputCountRaw`, called from
`emitSortedValueUpsert`, `GenerateTargetTraversal.ts:20572`) failed with expected 1 vs found 2. The fix prefers the
layout's own entry-slot offset; keep that metadata-driven.

After it: `should whitelist worker` produces **no** `preflight failed` line, and `message-bus-locking-groups` reports
`inputs:[16] outputs:[16]` (was `[16,18]`).

## Queue for the next session

1. **`should whitelist worker` — ROOT CAUSE PROVEN (round 25); it is not a chunk/read-back defect.** The failure
   `AssertionError: expected false to deeply equal true` at `marketplace.test.ts:224` via `:1250` compares
   `recreatedJob.whitelistWorkers` (decoded from the **Created** event blob, the only branch of
   `computeJobStateDiffs` that assigns that field) with the on-chain job state. A temporary print inside
   `decodeJobCreatedEvent` produced the actual payload: **175 bytes ending in `00`** —
   `…0976a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac` + `00`. The decoder walk is aligned
   (title→33, contentHash→65, tags→70, token→105 (35-byte `aa20…87`), amount→137, maxTime→141, deliveryMethod→149,
   arbitrator→174 (25-byte `76a914…88ac`), bool→175), so the wire format is right and the **payload itself carries
   `whitelistWorkers = 0`**.
   Why: `aa1e721b6` deliberately keeps the *anchored* read-after-write cache out of kernel routes
   (`CacheMappingEntryInLoop` `routeSnapshotKeysOnly`, source and `packages/solidc/dist` both contain it — the
   08:04 dist was built from the already-edited source, so the 08:23 artifacts are **not** stale). Without the
   anchored cache, `publishJobPost`'s `jobPost.whitelistWorkers = allowedWorkers_.length > 0` write is invisible to
   the later read, and the payload is **SDK-computed** from the handler's call-argument metadata
   (`abi[<publishJobPost>].externalCalls[computedOffset 11].argSources[1]`), whose expression reads
   `field:whitelistWorkers(arrayAccess(state:jobs, jobs.length-1))` — evaluated against the **pre-write** state, so
   `false`. Re-enabling the anchored form instead makes the same argSource reference the cache local, which the SDK
   cannot evaluate: that is exactly the `Delegate external call to MarketplaceDataV1.publishJobEvent (offset 11) has
   arguments that cannot yet be resolved by the SDK` error recorded in `aa1e721b6`.
   So the fix is an SDK capability, not a chunk fix: **the argument-source evaluator must observe the handler's own
   writes** (the entry value the transaction is about to commit) or resolve the anchored cache local. The hooks
   already exist and are dead: `_resolveExternalArgs`'s `stateIncludesPriorWrites` parameter is never passed `true`
   (it only affects encoding width today, `StatefulContract.ts:31986`, `:32150`), and
   `_evaluateExternalExpression(localBindings, stateLengthDeltas)` is only wired for inlined-helper parameters.
   **Do not repeat:** (a) flipping `valueTailForEntry` precedence (measured, no effect, reverted); (b) "the last
   jobEvents element is missing" — the arrays are fine; (c) regenerating the marketplace artifacts — verified fresh.
   *Same class:* the **`update job` family (`input 0: OP_VERIFY`, 9 titles)** re-runs `updateJobPost`, whose
   Updated payload is likewise SDK-computed from pre-write state. Expect them to move with item 1's fix, not before
   it.
2. **`KERNEL_LAYOUT` refusal of mapping-array `push` write handlers** — the compiler-side fence
   (`compiler.ts:4588-4612`: a handler that writes a chunkable collection is refused unless it carries the
   counter-journal transport parameter and has no untransported write). It is what makes
   `Revert reason: "External message-bus batch selector a826ee9c is not advertised as an eligible callee handler"`
   appear, and it is why every marketplace write handler ships `eligible: false`. Measured census: only 2 titles
   surface that text explicitly (`take job`, `job not taken`), so treat this as an architectural gate rather than a
   quick ladder win — the 21 `Expected transaction NOT to be reverted` failures are a separate block.
   A seven-variant construct probe gives identical verdicts at base and HEAD: a handler whose only statement is
   `this.items[key].push(...)` is rejected with `rejectionReason: KERNEL_LAYOUT` /
   `rejectionCode: MESSAGE_BUS_UNSUPPORTED_CONSTRUCT`, while `this.items[key].length` and struct-member reads of a
   mapping are `eligible: true`.
3. **Dynamic-array read route (`Error: index out of bounds`) — diagnosis corrected in round 25.** Three titles fail
   at `marketplaceData.connect(arbitrator).getArbitrators(0, 0)` (`marketplace.test.ts:426`, also `:499`) with the
   contract's own `require(index_ < arbitratorAddresses.length, …)` (`MarketplaceDataV1.sol:404`).
   *Correction:* there is **no** `users`-works/`arbitrators`-fails asymmetry — `getUsers(0, 0)` is called only at
   `marketplace.test.ts:385`, inside the *failing* `update user` title, so **no passing title exercises a dynamic
   state array through a read route**. The earlier "`register user` proves the users path works" note was wrong
   (`register user` only reads the `publicKeys` mapping).
   Measured with `SOLIDC_DEBUG_VALUE_WITNESS=1` on `register arbitrator$`: the read route's only chunkable witness is
   the `arbitrators` **mapping** entry, fetched as a *predecessor proof of the absent empty-slot key*
   (`slot: e3b0c442…` = `sha256("")`, `present: false`, `proofSlot: 41d0326f…`, 79-byte witness). The handler
   metadata is `messageBus.handlers[getArbitrators].batchKeyWitnesses[0].expressionLabel =
   "map:arbitratorAddresses(binop:+(id:i,id:index_))"`, `physicalEntrySlots: [4]` — so the SDK must evaluate that
   label to know *which* entry to fetch, and it produced no key (empty-slot fallback). `evalComputedKey`
   (`StatefulContract.ts:~3790-3915`) has **no `map:<collection>(<indexExpr>)` case** and cannot bind a loop local
   (`id:i`), which is the concrete lead: the state array is present on chain (the `registerArbitrator` transaction's
   state commitment carries the variable-width array blob with its VM-number count prefix `51` = 1), so the write is
   fine and the read-route key derivation is what fails. Pre-existing at base.
   **Round-26 localisation (measured, instrumentation reverted):** the read route is built by `_createBuilder`
   (`StatefulContract.ts:16690`); its entry-access loop (~`17246`–`17560`) fetches the proof for the **empty key
   slot** (`slot: e3b0c442…` = `sha256("")`, `present: false`) and *then* resolves the entry value correctly
   (79-byte `arbitrators` witness) — only the key is wrong. The three `batchKeyWitnesses` consumers are **not** on
   this path: `batch()` (`:6020`), `_batchRaw` (`:6323`; `SOLIDC_DEBUG_ROUTE_ENTRY_PLAN=1` printed **zero**
   `message-bus-active-entry-operations` lines) and `_buildRepeatedExternalBatch` (`:32630`) were all silent for this
   call under `SOLIDC_DEBUG_KEY_EVAL=1`; the only `evalComputedKey` invocations observed were `lit:DA` / `lit:DV`
   (mece tags). Established label vocabulary facts for the fix: the compiler publishes
   `batchKeyWitnesses[0] = { source: 'expression', inputIndex: -1, routeInput: '__message_bus_key_arbitrators_0',
   expressionLabel: 'map:arbitratorAddresses(binop:+(id:i,id:index_))' }`; `evalComputedKey`
   (`:3792-3915`, the function `:6022` uses to turn `expressionLabel` into a witness) has **no `map:` case** and
   cannot bind the loop local `id:i`, while `substPreservedStructFields` (`:3969`) proves `map:<collection>(…)` is an
   established label form elsewhere; and `_buildRepeatedExternalBatch` (`:32633`) still does
   `args[binding.inputIndex]` for a non-`msgSender` binding, i.e. `args[-1]`, so an expression binding silently
   becomes the inert witness there. When wiring this, also check `routeKeyName()` (`:6342`, strips `id:` and
   `__message_bus_ek_` but **not** `__message_bus_key_`) against `inactiveRouteEntrySlots` (`:6346-6350`), which
   requires every route key to start with `__message_bus_key_`.
   **Round-27 landing + the exact remaining step.** `90895948b` added the missing `map:<stateArray>(<index>)` case to
   `evalComputedKey` (unit-tested; additive — an unresolved index or absent/non-array/out-of-range slot still returns
   `undefined`, so every fallback is unchanged). What is still missing is the *row context*: the composer is
   `resolveRouteRowExpressionKey` (`:5355`) — it already resolves a **pure**
   `AbiDecodeAtNode{data=id:rowArgs,index=N,schema=[…]}` label from the matching row's `args`
   (`parseRowArgsDecodeLabel`, `:5104`; row match by collection + arity + `rowIndexHint`, `:5330`) and otherwise falls
   back to `evalComputedKey`. The corpus label is the **composed** form
   `map:arbitratorAddresses(binop:+(id:__rh28_i,AbiDecodeAtNode{data=id:rowArgs,index=0,schema=[,]}))`
   (and the `userAddresses` twin): the `AbiDecodeAtNode{…}` here is an *operand*, not the whole label, and
   `id:__rh28_i` is the route row's loop counter — i.e. `RouteExpressionKeyRow.occurrenceIndex` (`:5028`). So the step
   is to evaluate that composed form inside `resolveRouteRowExpressionKey` with the matching row in hand (operand →
   `row.args[N]`, loop local → `row.occurrenceIndex`, then the now-implemented `map:` array index).
   **Measured negatives, do not repeat:** (a) threading `onChainState.state` into the entry-key `keySources`
   expression branch (`_createBuilder`, `:17358`) makes `evalComputedKey` resolve these labels against *plan-time*
   state and breaks `MappingReadAfterWrite`'s two computed-key cases (`packs the field it just wrote through an
   on-chain computed key`, `requires the field it just wrote through an on-chain computed key`) — the state has to
   arrive with the row context, not on its own. (b) `16324293e` proves the resolver side (39/39 focused tests) but
   both candidate producers are **off this call's path**: `selectedRouteRows` is `0` at `_createBuilder`'s entry-key
   expression branch (instrumented: `encode-key-map … "rows":0`), and the producer-context call site at `:24068`
   (`childCompilerRoute?.rowArguments` + `childState.state` — the one place that already has both) is **not reached**
   for `getArbitrators(0, 0)` (no `child-route-key` line). So the next session's task is to find the planner that
   materializes a **view** route's rows — likely the proxy/read dispatch in the solidhat adapter or
   `_batchRaw`/graph composition for a `staticcall`-style read — and give it the selected rows, then call
   `resolveRouteRowExpressionKey` with `rowArguments` + `state`. Both landed commits are strictly additive: with the
   label unresolved, every previous fallback still applies.
   **(c) round 29, also measured and reverted:** at that `_createBuilder` branch, calling the resolver with a
   synthetic single row built from the planning args (`[{ args: entryArgs, occurrenceIndex: 0, handler:
   entryAbiFunction }]`) plus `onChainState.state` left `register arbitrator$` at `index out of bounds` unchanged.
   So either the branch's `map:` resolution still does not produce a key for this call (instrument it there before
   concluding), or the empty key is not the only cause — check the in-VM `arbitratorAddresses.length` the covenant
   actually reads (the entry witness it consumes) as well.
4. **Remaining census items** (from the 65-title run): 1 × `input 3: OP_VERIFY`,
   1 × `Delegate external call to MarketplaceDataV1.getArbitratorFee (offset 5) has arguments that cannot yet be
   resolved by the SDK` (same class as item 1), 1 × `Cannot read properties of undefined (reading 'to')`.
5. **Re-run the full ladder only once a block of fixes has landed** (per the current working agreement), and record
   the new count; investigate why the final title exceeded its 600 s timeout.

## Tooling and traps

* Marketplace tests load **prebuilt** artifacts from `.marketplace/artifacts/solidcash/*.json`; they never recompile.
  SDK edits therefore only need `yarn build`; compiler edits need the artifacts regenerated (no tracked generator
  script exists — it was done ad hoc in this session).
* Debug hooks: `SOLIDC_DEBUG_FAILURE_POINT=1 SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=<n>`
  (`message-bus-large-equals` gives the operands of the failing `OP_EQUALVERIFY`, plus the executed-instruction ring
  and `message-bus-locking-groups`), `SOLIDC_DEBUG_LOOP_ENTRIES=1`, `SOLIDC_DEBUG_VALUE_CHUNKS=1` +
  `SOLIDC_DEBUG_ENTRY_LOCK=<lock prefix>`, `SOLIDC_DEBUG_COLLECTION_FETCH=1`.
* **Base comparisons:** a worktree whose `node_modules` is symlinked from this one resolves workspace packages back to
  HEAD, which silently invalidates "base" runs. Use `/tmp/kb-base/vitest.marketplace.base.config.ts`, which prepends
  explicit aliases to `/tmp/kb-base/packages/*/dist`. `/tmp/kb-base` currently carries temporary
  `SOLIDC_DEBUG_PAGINATION` instrumentation in its own copy of the sources.
* Scratch worktrees available: `/tmp/kb-base` (pinned base runner) and `/tmp/kb-head` (full-ladder runs; log
  `/tmp/ladder-head.log`). Remove with `git worktree remove --force <path>` when done.
* Long runs: the marketplace config uses `--no-file-parallelism`, `execArgv: ['--max-old-space-size=8192']`, and a
  600 s per-test timeout. Run long suites as background jobs and collect with `job_output`; a full ladder takes
  tens of minutes.

## Definition of done for the original objective

1. Perf merge complete and gates green — **done**.
2. Prepared/Planned exact-selector authority without name-derived authority — **done**.
3. Producer transport + producer-aware descriptor selection — **landed**; `should whitelist worker` still red for the
   P5b value reason in item 1 above.
4. 66/66 ladder with build, focused producer/graph/delegate tests and post-job guards green at every commit —
   **in progress**: re-measure the current count (baseline 26/65 before `3ef649fcd`), then work the queue in order.

## Round 30 (no code change; consolidated evidence)

* Re-read of the already-captured `/tmp/arb-tx.log` (round 26) settles one open theory: the `register arbitrator`
  write **does** persist the dynamic array - the state commitment carries the variable-width blob with its
  VM-number count prefix (`…0000 51 00 1976a914…88ac…` = one element). So "the SDK never wrote
  `arbitratorAddresses`" is dead, and the three `index out of bounds` titles are a **read-side state view** problem
  (`index_ = 0` compared against a length that should be 1).
* Next probe, before touching key derivation again: dump the *read* route's own input commitments (which NFT/commitment
  the covenant actually consumes) together with the in-VM `arbitratorAddresses.length`. `marketplaceData.arbitratorsLength()`
  is a public getter, so the value is reachable from the harness without editing the 66-title suite - but no passing
  title calls it today, so it has zero coverage.
* Unchanged and still green at HEAD `16324293e`: `yarn build`, 39/39 focused SDK tests (RouteRowExpressionKey +
  PreparedProducerSelectorAuthority + MappingReadAfterWrite + DirectMappingReadPlan), marketplace guards 4 passed /
  62 skipped. The two landed commits are strictly additive.

### Round 31 addendum - the empty key reaches the *value* too (read-only, no new run)

Re-reading `/tmp/arb-tx.log` (`SOLIDC_DEBUG_COLLECTION_FETCH=1`) shows the two `collection-value-chunk-fetch` events in
the whole run are **both** for the `arbitrators` collection with the **same root** (`f73f1cef…`), the **same chunk
address** and the **same chunk data** (`000011c5…04546573740454657374045465737401640000`, the 79-byte
`JobArbitrator`), differing only in `slot`: `41d0326f…` (the real entry, `registerArbitrator`) and `e3b0c442…` =
`sha256("")` (the empty key, `getArbitrators`). Also, `arbitratorAddresses` appears in **no** collection fetch at all,
so the dynamic state array is never assembled from chunks on the read path - it comes from the state commitment, which
round 30 showed carries it with count 1.

Conclusion: the read route is handed the *right value bytes under the wrong (empty) slot*, and its authenticated
absence is what makes the in-VM view report length 0. So the empty key **is** the root cause - the two landed
commits are on the right track - and the remaining task is reachability: the resolver has to run where the read's
carrier/entry proof is planned (not at `:17358`, not at `:24068`, neither of which is reached for this call). Start
by instrumenting `resolveRouteRowExpressionKey` itself (log every call with its `rowArguments`/`state` presence and
return) while running `register arbitrator$`; that enumerates the real callers on this path instead of guessing.

### Round 32 - the producer is `compose.ts`, not `StatefulContract.ts` (read-only; no new run)

Grep for the route-key vocabulary found the real producer: `packages/solidcash/src/message-bus/compose.ts:1393-1426`
(`descriptorWitnesses`). It already calls `evalComputedKey(binding.expressionLabel, [...descriptor.args],
abi.inputs, state)` for every `batchKeyWitnesses` binding with `source === 'expression'`, and when that returns
`undefined` it **throws** `messageBus: cannot derive computed route witness '<routeInput>' from '<label>'`
(`:1410-1415`). `:1440-1452` then aggregates those values, and `:1476-1492` fills any route key input that is still
unbound with an *inactive filler* (`:1460-1475`).

That explains every observation at once: the read executes with a route key witness that was never derived (the
handler-form label `map:arbitratorAddresses(binop:+(id:i,id:index_))` cannot resolve `id:i` from `abi.inputs`, so the
composer either threw and a caller fell back to a direct route, or the binding never reached a derivation), giving the
`sha256("")` absent-slot proof and an in-VM length of 0.

**Next edit, precisely:** at `compose.ts:1403` derive the binding with row context *before* the throw - the handle is
`resolveRouteRowExpressionKey` (imported from `./stateful/StatefulContract.js`), with
`collection` from the handler's entry access for that binding, `rowArguments` from the descriptor's route rows (or a
single synthetic row from `descriptor.args` when the call is direct, which is sound here because this site **does**
pass `state` and *is* reached), `routePlanningArgs: descriptor.args`, `routeVisibleInputs: abi.inputs`, `state`. Both
landed commits (`90895948b` evaluator case, `16324293e` row-context binding) exist to make that one call work; the two
`StatefulContract.ts` sites I wired in rounds 27-29 were off-path (fields `selectedRouteRows = 0`; `:24068` never
reached), which is why neither moved the title.

### Round 34 - the combination wiring was tested and did not flip the title

Applied at `_createBuilder`'s entry-key expression branch (`:17358`, the one site that *does* receive the
`map:arbitratorAddresses(binop:+(id:i,id:index_))` label): `resolveRouteRowExpressionKey` with BOTH the row context
(`selectedRouteRows`, else one synthetic row from `entryArgs`) and `onChainState.state`, guarded by the route's own
existence (`entryCompilerRoute !== undefined || selectedRouteRows.length > 0`) so a direct call cannot mistake a
body-local key for a route loop counter. Built clean; `register arbitrator$` still failed with
`Error: index out of bounds`. Reverted; tree verified at HEAD `16324293e` (22/22 focused tests, build clean).

So "state + row context at the label's own site" is now measured and insufficient. Two possibilities remain, and one
run separates them: either the guard skipped this call (`entryCompilerRoute` undefined **and**
`selectedRouteRows.length === 0` - round 28 measured `rows: 0`, so check `entryCompilerRoute` too), or the empty key
is not the sole cause.

**Stop guessing the path - enumerate it.** Instrument `resolveRouteRowExpressionKey` (log every call: label,
`rowArguments?.length`, `state` present, returned key or undefined) plus `evalComputedKey`'s `map:` branch, run
`register arbitrator$` once, and read which callers actually execute on this path and what they return. That single
run resolves the open question; every hypothesis tested in rounds 27-34 was chosen by reading code instead.

### Round 35 - DECISIVE: `resolveRouteRowExpressionKey` is never called on this path

Instrumented `resolveRouteRowExpressionKey` itself (every call: collection, label, `rowArguments.length`, `state`
presence, return value) and ran `register arbitrator$`: **0 `rowkey` lines**. The function is never entered for this
call, so every wiring attempt routed through it (rounds 28-34) was structurally unable to matter. That retires that
whole line of attack.

Combined with rounds 26-27, the picture is now closed on the *derivation* side: the only site that receives the
handler-form label `map:arbitratorAddresses(binop:+(id:i,id:index_))` is `_createBuilder`'s entry-key expression
branch (`:17358`), and it calls plain `evalComputedKey(label, entryArgs, entryAbiFunction.inputs)` with **no state**
(round 27 proved that once state is supplied there the array is found: `present: true, length: 1`, and only the loop
local `i` is missing). Round 29 (state + one synthetic row, unguarded) and round 34 (the same, route-guarded) both
left the title at `index out of bounds`.

**Exactly one experiment remains, and it is fully specified:** apply the round-29 patch (state + synthetic single row
at `:17358`, no guard) *together with* the round-35 `rowkey` logging inside `resolveRouteRowExpressionKey`, and run
`register arbitrator$` once. That distinguishes the last two possibilities - the resolver returns a key there and the
empty key is not the sole cause, versus the resolver still returns `undefined` (then log the rewritten label and the
array index inside the `map:` branch to see which operand fails).

### Round 36 - the resolver IS reached with row context and state, and still returns `undefined`

Ran the exact experiment round 35 specified: the round-29 wiring at `:17358` (state + one synthetic row, unguarded)
**plus** call logging inside `resolveRouteRowExpressionKey`. Output - exactly one call, and it fails *inside* the
resolution:

    rowkey {"c":"arbitrators","l":"map:arbitratorAddresses(binop:+(id:i,id:index_))","rows":1,"st":true,"r":"undef"}

So the site receives the label, the array is reachable (`st:true`; round 27 measured `present:true, length:1`), the
occurrence binding supplies a row - and the composed label still does not evaluate. The failure is therefore in the
*operand* evaluation, not in reachability, and the remaining candidates are narrow and testable in one more run:
`id:index_` may not be present in `entryAbiFunction.inputs` (the route host's inputs are `batchBlob` +
`__internal__*`, so `evalValue('id:index_')` returns undefined and `binop:+` then yields undefined), and/or the state
element type from the `address[]` decode is neither `Uint8Array` nor a `:`-bearing string.

Next run: keep the same wiring, and inside `evalComputedKey`'s `map:` branch log the rewritten label, the raw
`index` value, the array length and the first element's JS type. That pins the failing operand directly. Tree verified
clean at HEAD `16324293e` after the run (build re-run, only the four fenced files modified).

### Round 37 - the failing operand is the *parameter* binding, not the array

`SOLIDC_DEBUG_MAPOP=1` inside `evalComputedKey`'s `map:` branch, with the round-29 wiring active, produced four lines;
the decisive one is the resolver's rewritten evaluation:

    mapop {"l":"map:arbitratorAddresses(binop:+(lit:0,id:index_))","arr":true,"len":1,"el":"object",
           "elCtor":"Uint8Array","idx":"undefined",
           "inputs":["index_","limit_","__internal__valueWitness_0","__internal__returnOutputIdx","__internal__proxyMasterIndex"]}

So: the occurrence rewrite is applied, the decoded array is found (`len 1`), its element IS a `Uint8Array` (the `map:`
case would return it), `index_` IS the first handler input - and the **index expression still evaluates to
`undefined`**. `binop:+` requires two bigints, so `args[0]` is not a bigint on this path; a decimal string is the prime
suspect (the surrounding code elsewhere normalizes exactly that: `encodeKey` does
`typeof v === 'string'` -> `bigIntToVmNumber(BigInt(v))`).

Last step, both halves in one commit: (1) in `evalComputedKey`'s `evalValue` `id:` case, coerce a numeric string
binding (`/^-?[0-9][0-9_]*$/`) with `BigInt(...)` before returning it; (2) restore the `:17358` wiring (state + one
synthetic row, unguarded) so the label is evaluated with the array and the occurrence. Note when re-applying: the
anchor text for (2) must be re-read from the file first - the round-37 patch script aborted on a stale anchor, so that
attempt applied **nothing** and the title run was of unmodified code (tree auto-verified clean afterwards at
`16324293e`).

### Round 38 - the coercion is not the answer either; `entryArgs` does not align with the label's inputs

Applied both hunks (numeric-string coercion in `evalValue`'s `id:` case + the `:17358` wiring); built clean;
`register arbitrator$` still `index out of bounds`. Reverted.

That rules out the "decimal string" reading of round 37 and points at the last remaining explanation for
`idx: "undefined"`: the `id:index_` operand resolves through `args[inputs.findIndex(...)]`, but at that site
`routePlanningArgs` (`entryArgs`) is **not** aligned with `entryAbiFunction.inputs` - the printed `inputs` are the
handler's (`index_`, `limit_`, `__internal__*`) while `entryArgs` is the argument list the builder carries for that
frame, so `args[0]` is `undefined` and `binop:+` collapses. The final probe is therefore one line: log
`entryArgs.length` and the first three `entryArgs` values alongside `inputs` in that branch, and pair them with the
matching list for the label (either `entryArgs` needs re-indexing onto the handler inputs, or the resolver must take
the handler-aligned argument list). Everything else on this path is now measured and green-verified.

### Round 39 - the operand type is `number`, and normalizing it *still* does not flip the title

The alignment probe settled the type question: at `:17358` `entryArgs` **does** align with the handler inputs
(`inputs: ["index_:uint256","limit_:uint256","__internal__valueWitness_0:bytes",…]`, `argsParam: 0`), but the values
are **JS numbers** (`firstArgs: ["number","number"]`), which is why `binop:+` (bigint-only) collapsed to `undefined`
and why the round-38 *string* coercion did nothing.

Applied the correct normalization (`typeof bound === 'number'` -> `BigInt(bound)`, keeping the string case) together
with the `:17358` wiring; built clean; `register arbitrator$` still `index out of bounds`. Auto-reverted; tree verified
at `16324293e`.

So the resolution now *should* produce the array's first element, which leaves exactly two possibilities, separated by
one log line: either the resolved key is not the entry's real slot - compare the returned hex against the entry slot
observed in round 31, **`41d0326f18316d0cde6612927fcf6def7c1fa980e37aa3eafc155955f19edaa6`**, which a
`Uint8Array` element (native locking bytecode) vs a `:`-bearing address string encoding would explain - or the empty
key was never the sole cause and the in-VM `arbitratorAddresses.length` must be read directly.

### Round 41 - DECISIVE: the key now resolves correctly and the failure is INDEPENDENT of it

Applied the number normalization (`typeof bound === 'number'` -> `BigInt(bound)`) **plus** the `:17358` wiring
(state + one synthetic row), and logged the key the resolver returns:

    keyhex 76a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac

That is the arbitrator's native P2PKH locking bytecode, and `sha256` of exactly those bytes is the entry's real slot
(`41d0326f18316d0c…f19edaa6` - note: the value recorded in earlier rounds ended `…f19eda26`, a transcription slip, now
corrected throughout). So the SDK supplies the **correct** entry key - and `register arbitrator$` *still* fails with
`index out of bounds`. Auto-reverted; tree verified at `16324293e`.

**Therefore the empty key was never the cause of the length-0 view** (round 36's alternative is the true branch): the
read route's covenant reads a state in which `arbitratorAddresses` is empty, even though the committed state carries
it (count prefix `51`) and the SDK decodes it (`present: true, length: 1`). The whole key-derivation thread - rounds
26-39, including both landed commits - is correct but orthogonal to this failure.

Next probe (not key derivation): log what the **read route** consumes for state - the state-NFT input's commitment in
the read's prepared transaction, and the witness the handler receives for the dynamic array - to find where the array
is lost between the committed state and the in-VM read. `mock-prepared-transaction` prints outputs only, so add the
input commitments alongside, or use `SOLIDC_DEBUG_VALUE_WITNESS` on the read and compare with the committed
commitment (`…0000 51 00 1976a914…88ac…`).

### Round 41 addendum - the array blob parses cleanly as a value chunk (from `/tmp/arb-tx.log`)

Output #12 of the registration transaction is `aa20111e8f47c3d0f64eba`, mutable, commitment
`001b511976a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac`. That parses as a canonical vmap value chunk:
2-byte LE index `0000` + chunk data `1b 51 1976a914…88ac` = pushdata(27) + count `51` (= 1 element) + the 26-byte
pushdata-encoded element. So the `arbitratorAddresses` blob **is** written as a chunk with the right content, and the
SDK-side state decode agrees (`present: true, length: 1`).

So the `index out of bounds` failure is now narrowed to the **read route's in-VM state view**: the key is correct
(round 41), the value exists (above), yet the covenant's `arbitratorAddresses.length` reads 0. The next probe is
therefore about the read's *state source* - which input/commitment the read route authenticates and whether the
dynamic-array chunk is included as a witness/continuation for that route (add the input commitments to the
`mock-prepared-transaction` print, or compare the read's own state commitment against the committed one).

### Round 41 second addendum - the array chunk is consumed AND recreated; suspect the blob framing or the route's state view

`SOLIDC_DEBUG_VALUE_CHUNKS=1 SOLIDC_DEBUG_COLLECTION_FETCH=1` on `register arbitrator$` (no rebuild) shows the
dynamic-array chunk in three places:

* a prepared transaction's **output #12**: `lockingBytecode: aa20111e8f47c3d0f64ebaa762e419c6a9e5aa3546f1ec20d5114be1d178188ea91287` (P2SH32), category `ee643a16…`, `capability: mutable`;
* a later prepared transaction's **output #8**: the same lock with commitment `001b511976a914c4ad89cdb7377ec8a163070e8442d399a87b870188ac`;
* an **unlocking stack** listing `'', '1b', '<that same lock hex>', '01', ''` - i.e. the chunk NFT is spent as an input.

So the `arbitratorAddresses` continuation is created, spent and recreated with the same content
(`pushdata(27) || count 0x51 || 26-byte element`) - the write side and the continuity are fine, and round 41 proved the
entry key is right. Only `collection-value-chunk-fetch` (2 events) is ever about the `arbitrators` **mapping** value,
never about the array, i.e. the SDK never treats the array as a vmap collection to fetch.

Remaining hypothesis, now narrow: the **framing the SDK writes** for a dynamic state array
(`1b` length prefix + `51` count + pushdata element) versus what the compiled `arbitratorAddresses.length` / indexed
read expects when it is executed *inside a kernel route*, and/or the route's state view. The cheapest discriminator is
the passing `packages/solidcash/test/e2e/ChunkArrayPushEmpty.test.ts` shape (`address[] keys; push; require(keys.length == n)`)
compiled **with `messageBus: true`** and run through a route: if the same blob reads length 0 there, the framing/route
interaction is the defect and it is reproducible in a fast, focused test instead of the 20 s marketplace title.

### Round 42 - LANDED FIX `6335c3b46` (not just analysis)

`fix(sdk): resolve a dynamic-state-array entry key instead of proving an absent one`. Two real defects fixed:
`evalComputedKey`'s `id:` binding now normalizes numeric parameters that arrive as JS numbers (route frames pass them
that way, which is why `binop:+` collapsed) or decimal strings; and `_createBuilder`'s entry-key branch now resolves
the `map:` label with the entry access's own frame (selected route rows, else that frame's args as the single row it
executes) plus the decoded state, instead of falling back to an empty placeholder key. Before: the route proved the
**absent** empty slot `sha256("")`; after: the real slot `41d0326f…` (verified by `sha256` of the arbitrator's P2PKH
locking bytecode). Evidence: new unit case + 40/40 focused; guards 4 passed / 62 skipped. Honest effect: neither
target title flips - each has an *additional* proven cause.

Also added (untracked, passes 1/1 standalone): `packages/solidcash/test/e2e/ChunkArrayPushMessageBus.test.ts` - the
`ChunkArrayPushEmpty` shape compiled with `messageBus: true, messageBusKernel: true`, asserting both a write route
(`count(1n)`) and a **view** route (`await sc.size()`) over the same `address[]`. It proves a route-compiled dynamic
array push + length read works in isolation, i.e. the marketplace's length-0 read is fixture-specific. Keep it as a
regression test or delete it; it is not part of the commit.

Remaining two fixes, each with its concrete edit:
1. `should whitelist worker`: the SDK evaluates the Created-event payload against **pre-write** state
   (`field:whitelistWorkers(arrayAccess(state:jobs, …))` -> `false`). Fix in the compiler: record
   `abi[<handler>].externalCalls[].argSources` from the **post-cache** body so a written entry field is packed from
   the value the handler wrote (`c5faff282` already rewrites the body; only the recorded argument snapshot lags).
   Requires regenerating `.marketplace/artifacts/solidcash/*.json`, then the title + the four guards.
2. `register arbitrator` / `update arbitrator` / `update user`: with the key now correct the covenant still reads
   `arbitratorAddresses.length == 0`. Compare the read route's consumed state commitment against the committed one
   (the array blob `pushdata(27) || 0x51 || element` is written and recreated correctly).

### Round 43 - exact edit site for the `should whitelist worker` fix (no code change this round)

The external-call argument snapshot is recorded in **semantic analysis**, before the read-after-write cache pass:
`packages/solidc/src/semantic/SymbolTableTraversal.ts:7220` (`const argSources: ExternalCallArgSource[] = []`) and the
classification loop at `:7320` (`if (classified) { argSources.push(classified); continue; }`). That ordering is the
whole defect: the recorded expression is the **pre-cache** state read
(`field:whitelistWorkers(arrayAccess(state:jobs, …))`), so the SDK packs the pre-write value (`false`) into the Created
event payload, and `checkJobFromStateDiffs` then fails at `marketplace.test.ts:224`.

The fix: at classification time, substitute a read of an entry field that the enclosing function **wrote earlier in its
body** with that write's right-hand expression (for `publishJobPost`: `jobPost.whitelistWorkers = allowedWorkers_.length
> 0` -> record `binop:>(unop:.length(id:allowedWorkers_),lit:0)`). Then the SDK evaluates the payload from the
parameters and packs `true`, exactly as the handler's body does. Verify cheaply **before** touching the marketplace
fixture: compile the marketplace shape with `compileString` and assert the recorded `abi[<fn>].externalCalls[].argSources`
expression contains no `arrayAccess(state:jobs…)` for the written field - seconds per iteration, no artifact
regeneration. Regenerate `.marketplace/artifacts/solidcash/*.json` only once that assertion holds, then run
`should whitelist worker$` plus the four guards.

I stopped short of editing `SymbolTableTraversal` this round deliberately: AST substitution there is a real change and
the session's remaining context cannot carry it through the required build + focused-test + guard cycle, and landing it
unverified would violate the "guards green at every commit" rule the objective sets.

### Round 44 - the fix is a SMALL extension of an existing resolver, not new machinery

Re-reading the recorder shows `SymbolTableTraversal` **already** has a field-write resolver: `dominatingStatements()`
(`:7393`) collects the statements that dominate the call, `observePrior` (`:7693`) records
`MappingFieldAssignNode`/`MappingAssignNode`/`StateArrayAssignNode`/push/pop/delete effects into
`assignedField`/`assignedWhole`/`fieldWriteAmbiguous`, and `:7776` (`if (!fieldWriteAmbiguous && assignedField)`)
substitutes the assigned expression into the recorded argument. It works for a direct
`jobs[k].field = rhs` assignment and refuses (records the pre-state read) whenever the write is ambiguous.

The marketplace gap is concrete and small: `MarketplaceV1.publishJobPost` writes through a **storage pointer**
(`JobPost storage jobPost = jobs[jobId]; jobPost.whitelistWorkers = allowedWorkers_.length > 0;`), so the assignment
target is an *identifier*, `sameTarget` (`:7676`/`sameArrayTarget` `:7682`) never matches the argument's
`arrayAccess(state:jobs, …)` base, and the resolver falls through to the pre-state read - which the SDK then packs as
`false`. The file even carries the helper for the missing link: `findLocalInit` / `resolveInitializer`
(`:7358-7374`) already resolve a local's initializer.

So the edit is: resolve the **assignment target** (and the argument base) through the local-initializer chain so a
storage-pointer alias matches its underlying `stateAccess`, then let the existing `assignedField` substitution run.
Verify at compile level in seconds (compile the marketplace shape with `compileString`; assert the recorded
`argSources` for the written field no longer contains `arrayAccess(state:jobs…)`), then regenerate
`.marketplace/artifacts/solidcash/*.json` and run `should whitelist worker$` plus the four guards.

### Round 45 - LANDED COMPILER FIX `da03e946b` (the `should whitelist worker` root cause)

`fix(solidc): record a struct field written through a storage pointer as the written value`. The external-call
argument snapshot's field-write resolver matched the assignment target against the read's serialized base; a read
through a local struct alias (`Job storage job = jobs[id]; job.whitelistWorkers = …`) serializes its base as that
identifier while the assignment names `jobs[id].field`, so it never matched and the recorded argument kept the
**pre-write** state read - which the SDK then packed into the Created event payload. `sameTarget`/`sameArrayTarget` now
compare against the alias resolved through the file's existing `resolveInitializer`.

Verified without the marketplace fixture: compiling the marketplace shape directly, the recorded payload argument went
from `field:whitelistWorkers(arrayAccess(state:jobs, …))` to a base whose first field is
`{kind:'source',source:{kind:'forward',paramIndex:0}}` - the parameter the handler assigned. Gates: `yarn build`
clean; InvocationAnalysis + KernelGraphResultDependency 18/18; ExternalCalls 67 passed with the identical 5
pre-existing failures measured before and after; four post-job guards 4 passed / 62 skipped.

**Next action (single step):** regenerate `.marketplace/artifacts/solidcash/*.json` with the current compiler, then run
`should whitelist worker$` (expect the `:224` assertion to pass) followed by the four guards. Nothing else is needed
for this fix - the compiler side is done and committed.

### Round 46 - `da03e946b` reached the marketplace path only halfway; the missing class is the state-ARRAY field assign

Regenerated `MarketplaceV1.json` with the fixed compiler (`--iteration MarketplaceV1.sol`, ~2 min) and inspected the
recorded payload: the base is no longer `arrayAccess(state:jobs, …)` but a **whole-entry reconstruction**
`call:JobPost(...)` whose `whitelistWorkers` member is `{"kind":"reference","name":"FunctionCallNode"}` - an
unresolved reference the SDK cannot evaluate, so the Created payload still packs `false` and
`should whitelist worker` still fails at `:224` (run time also jumped to **313 s** from ~70 s, i.e. the substitution
did change the plan and the SDK is converging the hard way). Guards stay green (4 passed / 62 skipped).

Reason: `publishJobPost` writes through a **dynamic state-array** pointer (`JobPost storage jobPost = jobs[jobId]`,
`jobs` is `JobPost[]`), while round 45 extended only the *mapping* targets (`MappingFieldAssignNode` /
`MappingAssignNode` / `MappingDeleteNode`). `observePrior` (`SymbolTableTraversal.ts:7693`) has no branch for the
state-array field-assign class, so it never sets `assignedField` for `jobPost.whitelistWorkers = allowedWorkers_.length
> 0` and falls through to `assignedWhole` (the pre-existing entry read) - hence the `JobPost(...)` reconstruction with
an unresolved member.

**Next edit (same pattern as round 45, one branch):** in `observePrior`, add the state-array field-assign node class
(mirroring the `MappingFieldAssignNode` branch: matching field name + same array target -> `assignedField =
statement.expression`, ambiguity rules unchanged), rebuild, re-run the same `compileString` probe on the marketplace
shape but with `JobPost[] jobs` instead of a mapping, then regenerate `MarketplaceV1.sol` again and run
`should whitelist worker$` + the four guards. Note the fixture currently holds the *partially* fixed artifact, so a
regeneration is required after the next compiler change regardless.

### Round 47 - correction: for the array path the next step is NOT a new `observePrior` branch

Checked the AST shapes: `ArrayAssignNode`/`StateArrayAssignNode` carry only `{name, index, value}` - no
`trailingMembers` - so `jobs[id].field = rhs` reaches the recorder as a **whole-element** assign, which `observePrior`
already handles at `:7718` by setting `assignedWhole = statement.value`. That matches the regenerated artifact: the
payload base is a `call:JobPost(...)` reconstruction (the substituted whole element), and the *member* the payload
packs (`whitelistWorkers`) is `{"kind":"reference","name":"FunctionCallNode"}` - an unresolved placeholder, not the
written `allowedWorkers_.length > 0`. So the written value is not carried into that coalesced element (or the
serializer drops the node that produces it), and the substitution round 45 added is *not* the missing piece for this
path.

Next step is therefore the field-write **coalescing** / struct-literal serialization for a state-array element, not
another target-matching branch: find where `jobs[id].field = rhs` becomes the whole-element value and make it carry
`rhs` for that member (then the recorder's existing `assignedWhole` substitution publishes it). Verify with the same
`compileString` probe but `JobPost[] jobs`, asserting the recorded member is a `source:forward` of the parameter (as
the mapping probe already produces), then regenerate `MarketplaceV1.sol` and run `should whitelist worker$` + guards.

### Round 49 - the unresolved member is a coalescing TEMP the recorder cannot serialize

`CoalesceStructFieldArrayWrites.ts` (the state-*array* twin of the mapping coalescer) does carry the written value:
`:78` rewrites each unit's value with `rewriteArrayReads(..., u.field, u.tmp, tmp)` and `:84` builds the whole-element
value from those units - so `jobs[id].field = rhs` becomes one element whose `field` member is the running temp
`u.tmp` (`__nlv_*` for a same-file struct, `__inlv_*` for an imported one, per the comment at `:232`), not the raw
`rhs`.

The argument recorder runs *after* that pass and its serializer has no binding for those temps, so it emits
`{"kind":"reference","name":"FunctionCallNode"}` - exactly the unresolved member seen in the regenerated
`MarketplaceV1.json` and the reason the SDK still packs `false`.

So the last edit is in `SymbolTableTraversal`'s serializer for a field whose expression is an `__nlv_*`/`__inlv_*`
temp: resolve it through the same local-initializer chain the file already uses (`findLocalInit` / `resolveInitializer`,
`:7358`), i.e. publish the temp's dominating assignment (the written value) rather than the placeholder. Verify with
the `compileString` probe switched to `JobPost[] jobs` - the recorded member must be a `source:forward` of the
parameter, as the mapping probe already produces - then regenerate `MarketplaceV1.sol` and run
`should whitelist worker$` + the four guards.
