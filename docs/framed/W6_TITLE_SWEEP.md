# W6 title sweep: the 31 residual reds, worked one title at a time

Base `9fd44ec92`. Merged tip `13964264c`. Every title below was reproduced **individually** with

    cd packages/solidcash
    ../../node_modules/.bin/vitest run <file> [-t '<leaf title>'] --maxWorkers=1

(`--config vitest.framed.config.ts` for `test/framed/**`, `--config vitest.e2e.config.ts` for `test/e2e/**`).

Thirteen parallel workers each owned a cluster, and each was required to give the exact command, the root cause
with the file and function, a fail-without / pass-with experiment, a pinning test where one is honest, and a
whole-file before/after. The gate log this sweep starts from is `w8-solidcash.log` + `w8-yarn-test-e2e.log`
(26 solidcash rows, 5 e2e rows). The rows are the `W6_BASELINE.md` rows, so none of them is a new regression
from the framed work.

## Green after this sweep (14 of 31)

| # | title (file) | cause | fix | pin |
|---:|---|---|---|---|
| 14 | `executes address.transfer from its typed fixed-effect descriptor` (FixedConditionalTransferSecurity) | `message-bus.ts:projectMessageBusHandlerArguments` projected a solidityImportCompat handler's transfer recipient to a 32-byte EVM ABI word, so the driver route's `suppliedEmissions == expectedEmissions` check failed | recipient stays native when the same param is not forwarded into an external call | `test/unit/ProjectGraphEmissionAddressArgs.test.ts` |
| 15 | `executes address.send from its typed fixed-effect descriptor` (same file) | same descriptor, same projection | same | same |
| 4 | `states one call per published site the caller's own facts reach` (framed/call/proxy-external-calls-published) | the test's `shippedArtifacts()` loaded interface artifacts, which carry no `composition`, and `readPublishedStopSites` refused the first one | keep only artifacts with a `composition` (a contract that loses its table still fails) | the title itself |
| 17 | `preserves payload event effects across fresh route compiles` (KernelLegacyObservableParity) | `Contract.createCompilerRouteUnlocker` gave a zero-length density reserve to every non-journal kernel route; the effect route needs ~2.4 KB to finish at all | `kernelRouteEffectDensityReserveBytes`, sized per reserved effect site and keyed on `convention === 'kernel-row-loop'` plus a non-empty graph effect band | `test/unit/KernelRouteDensityReserve.test.ts` |
| 20 | `settles a lazy returning-helper event in a scalar-state continuation` (KernelLoopCompose) | same zero-length reserve | same | same |
| 26 | `reads a non-empty chunk from the route trailing run` (OutlinedArrayReadRoute) | `sc-allocate-create-builder-funders-accounting.ts` forced the returnEvent input pad for any build with `iterationEntryInputs > 0`; a direct frame compacts around the absent slot, so the chunk run landed one coordinate late | gate that term on an atomic participant (`overrides?.omitLocalFeeTail`) | the title itself |
| 23 | `preserves a multi-segment journal through repeated void, one-value, and two-value handler invokes` (KernelSegmentedHandlerReturnWidths) | `InlineReturningStateHelpers.ts` inlined a returning `__message_bus_entry_*` clone that owns a runtime mapping loop into the route, so the cursor guard pushed the route-wide union (2) where the row vector has 1 | a clone that owns a runtime mapping loop stays an `OP_INVOKE` body | `packages/solidc/test/journal-message-bus/KernelHandlerLoopStreamScope.test.ts` |
| 18 | `settles affine varying-key recursive sets and deletes through rank streams` (KernelLoopCompose) | same inlining | same | same |
| 28-30 | `inserts a scalar entry (false/false)`, `(true/false)`, `(true/true)` (KernelMixedEntryInsert) | `sc-batch-raw.ts:batchRaw` dropped every `chunkableValue` collection from the runtime `sortedBatchInfo`, so the entry input was spent with no census entry | include a chunkable collection when the compiled route publishes it in its own `sortedBatchInfo` | the three titles |
| 31 | `multi-value (tuple) reads fail closed with a clear message (not yet supported)` (StaticCall) | a stale pin: `84e349830` ("read a multi-output view as a named tuple") removed the refusal and added a sibling test; the tuple read decodes one component per declared output with the authenticated decoder and still fails closed on a short carrier | the pin now asserts the resolved tuple | the title itself |
| 16 | `settles an existing chunked struct fixed-array update before a wide external result` (KernelChunkedMappingStructCompose) | `GenerateTargetTraversal.emitPushdataEncode` applied the Solidity ABI address lane to every address leaf inside a `graphEmissionHandler`, including the struct value a field write lowers to, so each address leaf shrank 35 -> 32 bytes and the route's value digest no longer matched the SDK's value chunks | suppress the lane for a state struct value (`encodingReferenceDataValue`) | the title itself plus 20 sibling files |
| 19 | `settles selected counter domains and freezes mixed collection/effect domains` (KernelLoopCompose) | two reds. First: `getLoopEntryOutputBase` returned the raw predecessor input index for a runtime-loop write, so the entry band landed one coordinate late (`0764ac086`, merged). Second: `StatefulContract._createBuilder`'s `singleTargetRowBatch` sized the batch from the runtime route's own narrowed `sortedBatchInfo`, so a union batch projected to a single lane was misread as a standalone one-slot batch and the INSERT predecessor was planned at the fixed entry slot; the builder then appended it at `masterIndex + blockSize` = 142 and the compose compaction left `vmapBatchPredOut_0` naming no output | read the compiled batch width from the published route (`entryArtifact.messageBus.route.sortedBatchInfo`) and require it to be 1 for the single-target layout | `test/unit/UnionRouteSingleRowPredOut.test.ts` |

Verification for each: the whole file green before merging, then re-run on the merged tree
(`merge-verify.log`, `merge-verify2.log` in the sweep scratch), with the sibling files that share the changed
engine also green: FixedConditional 8/8, KernelLegacyObservableParity 3/3, KernelLoopCompose 142/144 (the two
known reds), OutlinedArrayReadRoute 1/1, KernelSegmentedHandlerReturnWidths 2/2, journal corpus
(KernelJournalOwnershipCharacterization 6, KernelMixedArrayMappingJournal 7, KernelMixedBytesMappingJournal 11,
KernelSegmentedJournalCarrier 1) all green, `KernelRealUnicrowProxyArbitration` 7/7 and `KernelRealUnicrowArbitration`
3/3 (the pair a dropped projection half once broke), `AtomicMessageBusCapacity` 11 passed / 2 skipped,
`KernelDensityBoundedCompose` 2/2, `KernelHandlerLoopStreamScope` 1/1, `StaticCall` 12/12.

## Still red (17), with what each one needs

### Needs a decision (7)

| # | title | the decision |
|---:|---|---|
| 1, 2 | `preserves FakeToken.json identity across the marketplace fixture transfer/approve sequence`, `... across transfer to another account` (LogicalIdentityPreservation) | D22 (`cee831dc2`, `DECISIONS.md`): `StatefulContract.getAddress()`/`target` is `_framedAddress ?? _logicalAddress ?? this.address`, so the contract reports the framed execution lock while the SCID identity anchor is minted at the logical CREATE address. Measured: swapping the first two operands makes both green (`2 passed | 19 skipped`) and regresses the proxied marketplace title `approve result and review sanity checks`. D22's own row already asks for this confirmation. |
| 3 | `carries the caller's reported address whole inside a long packed payload, to the receipt and the chain` (framed/call/plain-caller-identity) | packed `uint160(address)`: `packages/solidc/test/Casts.test.ts:162` is green and pins the narrowed 20-byte Solidity identity (`OP_3 OP_SPLIT OP_NIP`); the title expects the verbatim 35-byte lock. This is not the deferred model B — model B narrows too. Measured: the payload is 122 bytes with a 20-byte identity, and the per-call line's `packedAddressAsUint` special case was removed by kernel-line `e5fd28bcc`. |
| 22 | `uses the authenticated proxy identity for address(this) and a nested caller beside its SCID anchor` (KernelPhysicalCallerWithScidCompose) | both operands at `ip 153` are 35-byte locks: the caller's logical/proxy SCID address lock (the anchor input's lock and the `expected` route param) against the co-spent minting master input's physical lock. `emitMsgSender` takes the category branch and `emitMsgSenderMintingVerification` returns the physical minting master's `OP_UTXOBYTECODE`; `emitLogicalMsgSenderAnchorVerification`, which binds the anchor's SCID record tail, is skipped because the handler has no `__internal__msgSenderAnchorIdx` (injected only under solidityImportCompat; `AUDIT_MSG_SENDER.md` F14 records its consumer as removed in `c78c135b7`). Audit F4/S3 — the deferred address representation. |
| 24, 25 | `does not materialize a forged proxy state when a conditional delegate edge is not taken`, `settles a not-taken spend that preserves state, and refuses one that writes` (MessageBusDelegateClassesE3) | the not-taken preserve can only be read from the conditional edge's runtime reachability, i.e. the VM trace. Reaching it needs `computed-output-repair.ts:canApplyRepairedNftCommitment` to stop skipping the preserve proposal and needs recipe mode's "VM validates only" finalization gate (`materialization-mode.ts`) opened for a state write. No published-metadata discriminator exists: `writesState === true` with `ownStateEvidence: []` and a `conditional` `lowLevelCalls[0]` also matches the green taken spend, and `sourceEffectOrder: 'unsupported-flow'` separates conditional from straight-line but not taken from not-taken. |
| 27 | `keeps a direct writer and delegated writer in separate continuation ranges` (KernelIndependentComputedChunks) | `KernelDirectComputedChunks.test.ts:30` pins `Store.update` `eligible === false` and is green; this title needs the atomic composer to batch that same row, which `encodeMessageBatch` refuses for a non-eligible row. Toggling the compiler admission makes the title pass and breaks four green pins (`KernelDirectComputedChunks` x2, `KernelDirectWitnessAbi`, `WitnessAbiPublication`) plus the `KernelLoopCompose` recursion-fold delete. This is the `ac4a136f2` trade-off returning. |

### Needs a compiler cost reduction, not a fix (6)

`AffineVoidRecursiveEvents` x5 and `KernelLoopCompose` `enforces the recursive event domain step and 64-frame
resource bound`. All six exceed the BCH-2026 operation-cost density budget (`800 * (41 + unlockingBytecode.length)`)
at the 64-frame bound `LowerTailRecursion.ts` publishes. Measured requirement, from a relaxed-budget probe VM that
reads `state.metrics.operationCost` at 64 frames:

| title | 64-frame cost | budget | needed cut |
|---|---|---|---|
| guarded tail-call stream | 3,833,233 | 2,640,000 | 31.1% |
| pre-only affine parameters | 9,396,044 | 2,991,200 | 68.2% |
| every pre-recursion frame | 3,696,688 | 2,672,000 | 27.7% |
| mixed pre-order and post-descent | 6,201,628 | 2,698,400 | 56.5% |
| affine-counter progression | 6,974,120 | 2,838,400 | 59.3% |
| recursive event domain step | 3,814,071 | 2,900,800 | 23.9% |

Why a reserve is not available: these are direct spends (`selector || args || redeem`), so the reserve would have
to be baked into the deployed script; and the only categorical artifact signal shared by the six
(`runtimeLoopEvents` with `maximumIterations: 64`) is also published by a green in-budget sibling measured at
+661,268 margin, so a gate on it would move an in-budget shape's address and unlocking length. The pre-only title
needs 9.40M against the 8.04M ceiling any single input can fund, so no reserve of any size reaches it.

Why a bounded cost reduction is not available either: at 64 frames the settlement is 95.9% instruction count
(36,590 instructions x 100), 2.8% pushed bytes and 1.3% hashing. Of 554 charged instructions per frame, 406 are
executed and 147.6 are charged-but-stepped-over (inactive arms inside the frame loop, which BCH-2025 charges).
The single frame-invariant block is the expected event locking bytecode (`emitExpectedEventLockingBytecode`, 22
executed instructions per record, of which a hoist could remove ~20): worth 128,000 units, 3.4% of the title's
cost, against a required 24-68%. Removing the unreachable effect-kind arms is net-negative: those bytes are part
of the density-control length, so dropping 49 charged instructions saves 4,900 cost and loses 39,200 budget
(-34,300 headroom). This is the compiler defect the repo already names in `424fea1b1`, and it is a restructuring
of the emitted per-frame settlement, not a bounded fix.

### Needs more work on a localized cause (4)

| # | title | state |
|---:|---|---|
| 11 | `preserves a pooled long mapping return across event-emitting writes` (AtomicMessageBusCompose) | consensus size interlock: input 1 is 13,179 bytes at this tip (the earlier 10,627 reading was taken at `9fd44ec92`), the callee artifact bytecode is 9,968, and `SOLIDC_DEBUG_NO_OUTLINE=1` only reaches 9,696. Needs a ~3.2 KB codegen reduction for this shape, or routing the callee participant through the verifier/delegate so its input stops pushing the whole contract (a participant-layout decision). |
| 12 | `advances past a reached conditional opaque-return row in a delegated root` (same file) | `address.code.length` boundary: the composer evaluates `addressCodeLength` on the native 35-byte lock (code present) while the route holds the 20-byte EVM identity (`size == 23 \|\| size == 35` is false), so the route takes the `else` arm and consumes a second `approve` row. Accepting size 20 removes that cause and exposes a second misalignment at `GenerateTargetTraversal.ts:23700-23707`, where the 2-byte frame `0164` is read as a u16le result length (25601). Two independent defects. |
| 13 | `learns computed ecrecover arguments under the shared atomic graph lock` (same file) | feature gap: `computeSideCarRecipesOf` authors compute recipes only from `func.externalCalls[].preCallRequires`, and `ComputedRecoverSink.recover` has none; the operand `bytes32(bytes(sourceHash).reverse())` also needs a `reverse` recipe operand that `replayable`/`evaluateComputeRecipeExpression` do not have. Body-level recipe authoring touches recipe-mode planner authority. |
| 5 | `settles a refund-like entry: a call, a mapping write in a later segment, and a dynamic write after the last call` (framed/call/write-segments-settlement) | the regression does enter at merge `1f818ffd0` (green at `d8166489d`, red at the merge), but the earlier localization is refuted: `emitPerCallSegmentClose`, the whole SDK `src/per-call/**`, and the `framedBatchWriteSegment` helpers are byte-identical across the merge, and reverting, `===`-ing or `!atEnd`-ing the `framedCallFollowsBatchWrite` term all leave it red. The defect is in the master head/witness machinery the merge rebuilt. Bisecting inside the merge needs the fixture compiled with each kernel-line revision (several intermediates do not `tsc -b`). |

## Verification on the merged tree

`yarn workspace solidcash test` at `13964264c` (the tree before `a9248461a`): `17 failed | 5372 passed | 167
skipped | 5 todo (5561)`. The 17 are exactly the non-e2e rows of the table above, in these files:
`AffineVoidRecursiveEvents` (5), `AtomicMessageBusCompose` (3), `LogicalIdentityPreservation` (2),
`MessageBusDelegateClassesE3` (2), `KernelLoopCompose` (2), `KernelPhysicalCallerWithScidCompose` (1),
`framed/call/write-segments-settlement` (1), `framed/call/plain-caller-identity` (1). Thirteen of the fourteen
titles fixed above are green in that run, and no file that was green before this sweep went red. `a9248461a`
(#19) landed after it, with the whole `KernelLoopCompose` file at `1 failed | 143 passed` (the one red being the
density title) and its four batch-predecessor sibling files green before and after.

## Not satisfied by this sweep

The instruction was "make all titles green individually, then run full e2e". 14 of 31 are green individually.
The other 17 are not blocked on effort: 7 need a product/representation decision, 6 need a compiler
per-frame-cost project, and 4 need either a design decision (11, 12) or more time on a localized cause
(5, 13). The release gate therefore remains the `W6_BASELINE.md` row set, now 17 rows instead of 31.
