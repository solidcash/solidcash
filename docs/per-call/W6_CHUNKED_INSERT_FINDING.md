# W6 finding: a graph-produced batch insert publishes a PredOut past its own frame

Status: measured, not fixed. File:
`packages/solidcash/test/journal-message-bus/e2e/KernelChunkedMappingStructCompose.test.ts`, title
`settles and returns a graph-produced oversized scalar struct insert` (1 of 5; the other 4 pass).

Reproduce with the shipped compile path and a targeted run:

    cd packages/solidcash
    ../../node_modules/.bin/vitest run test/journal-message-bus/e2e/KernelChunkedMappingStructCompose.test.ts \
      -t 'graph-produced oversized'

Result: `MessageBusDiagnosticError [L3_LAYOUT_INVARIANT]`, `layout-invariant pred-out-unresolved`, phase
`absoluteLayout`, participant 0, resource `vmapBatchPredOut_0`, detail
`applyParticipantAbsoluteWitnesses: PredOut slot present but witness missing`.

## Shape under test

A `Writer` contract with `mapping(uint256 => Record) records` / `struct Record { string note; uint256 value; }`
(chunkable value), whose `write(address probe, uint256 key)` first calls `IProbe(probe).read()` and then inserts
`Record(<oversized note>, <the external result>)` into that mapping. The composition is
`messageBus.compose({ preparedCalls: [writer.write(probe, 7n), probe.read()] })`, so the insert is
graph-produced: its key is static, but the record value depends on the external call result.

## Measured chain

1. The compiler plans the insert's predecessor output for the Writer's route as
   `blockBase + proofOwnerOffset` = `0 + 1` = `1`
   (`StatefulContract.ts`, the `singleTargetRowBatch` branch of the vmap batch witness derivation). The route
   frame's compiled geometry is `{ blockSize: 67, trailingBase: 3 }`; the handler frame is `{ blockSize: 3 }`.
2. During the participant build, `refreshTopLevelPredOutWitnesses`
   (`sc-construct-create-builder-transaction-builder.ts`) validates that planned coordinate: the output at 1 must
   carry the lock of the co-spent proof input *and* the exact predecessor commitment
   (`pred.slot || target.slot || pred.value`). It does not.
3. Its content search over `materialized.outputs` finds no output with that lock+content, and its structural
   candidate also fails. It then falls back to "restore the predecessor in a token-free alignment slot **after**
   the participant block": the pad search floor is
   `index >= masterIndex + (effectiveBlockLayout?.blockSize ?? 1)` = `0 + 67 = 67`, but the builder holds exactly
   67 outputs, so `free = -1` and the fallback appends a new output at index 67 (builder becomes 68 outputs) and
   writes `finalArgs[predOut] = 67`.
4. The composed participant frame does not keep that output. Measured on the frame the compose pass inspects:
   `inputs = 67`, `outputs = 67`, `predOut = 67`, and every output at index 7..66 is a disposable OP_TRUE (`0x51`)
   alignment pad paired with a dummy funder input. The compaction loop
   (`compose-assemble.ts`, `let actualSize = blockSize; while (actualSize > minimumActualSize)`) walks those pads
   down to `minimumActualSize = 7` and splices the frame to 7 slots, so the appended output is not part of the
   participant block and no output carries the predecessor commitment.
5. The PredOut discovery gate then has to classify `67`:
   `localLimit = local.outputs.length = 7`, `publishedBase = 0`, so `67` is neither `localCoordinate`
   (`< 7`) nor `absoluteCoordinate` (`[0, 7)`). The gate `continue`s, no claim is registered, and
   `applyParticipantAbsoluteWitnesses` throws `pred-out-unresolved` because `67` is not an inactive sentinel.

Diagnostics added for this (env-gated, both `SOLIDC_DEBUG_PREDOUT=1`):

- `compose-assemble.ts` -> `predout-skip`: participant, witness name/value, both coordinate verdicts,
  `localLimit`, `publishedBase`, `routeTrailingBase`, frame sizes, plan block size.
- `layout-resolver.ts` -> `predout-unresolved`: participant, witness name/value, claim count.

Measured output for the failing title:

    predout-skip {"participant":0,"contractName":"Writer","abiFunction":"__message_bus1",
      "name":"vmapBatchPredOut_0","value":"67","active":true,"pendingInsert":false,
      "localCoordinate":false,"absoluteCoordinate":false,"localLimit":7,"publishedBase":0,
      "routeTrailingBase":3,"localInputs":7,"localOutputs":7,"planBlockSize":67}

## Why the append is out of frame

`participantInputs` for the plan is `[0, 67]`, i.e. the plan carries the Writer's block at its compiled maximum
(67). The compose pass compacts each participant frame to its used span (7 here) before the discovery runs, and
`actualSizes` feeds back into the finalized graph so the packing uses the compacted span. The PredOut witness,
however, is expressed in the *uncompacted* build coordinates because `refreshTopLevelPredOutWitnesses` runs
inside the participant's own build, before compose compacts anything.

## Candidate fixes (not applied)

Both need the kernel author's intent for the single-target-row case, which is why they are not applied here:

1. **Place the predecessor inside the frame instead of appending past it.** In
   `refreshTopLevelPredOutWitnesses`, lower the disposable-pad search floor from
   `masterIndex + blockSize` to the start of the participant's trailing band, so the P' takes an in-frame
   `0x51` pad (here index 7). The frame would then compact to 8, the discovery would accept the witness as a
   local coordinate, and the layout authority would publish a real absolute. Risk: the value-chunk transport
   pass (`materializeTransportedContinuations`) also selects trailing slots and may want the same pad; the floor
   must exclude slots the plan reserves for continuations.
2. **Teach the compaction about active PredOuts.** Fold the active PredOut's physical slot into
   `minimumActualSize` (the same way computed value-chunk claims and pending value-chunk claims are folded in) and
   run the PredOut discovery before the splice, so a frame is never compacted below the output its own witness
   names. Risk: the witness here is already past `blockSize` (67 vs a 67-slot block), so this only works together
   with (1) - otherwise the append still exceeds the published maximum.

The single-target-row branch is the discriminating fact: for `batch.slotIndices.length === 1` the compiler
expects the predecessor republished at the *fixed entry* coordinate (`proofOwnerOffset`), and the built frame's
output at that coordinate does not satisfy the covenant's lock+content equality. Whether the compiler should have
planned the trailing lane (`batchPredOutputBase`, here 3) for a graph-produced single-row insert, or whether the
builder should have materialized the predecessor marker at the entry coordinate, is the design question to settle
before either fix is safe.
