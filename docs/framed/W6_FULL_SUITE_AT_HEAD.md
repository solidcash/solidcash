# W6: the full non-marketplace suites at HEAD

## Scope and revision

- Worktree `/Code/cashscript/.worktrees/per-call`, branch `feat/per-call`.
- Revision at the start of the runs: `3fc4c2fe9` (`perf(framed): keep a 30-minute marketplace cap,
  the 20-minute target is unmet`). The tree was clean.
- Two docs-only commits landed while the runs were in flight: `0bf4c4241` at 19:02Z
  (`docs/framed/W6_HEAD_STATUS.md`) and `eb8f193d5` at 19:35Z (`docs/framed/W4_*`). No source or test
  file changed, so every command below exercised the same code as `3fc4c2fe9`. Head at report time:
  `eb8f193d5`.
- Log directory: `/tmp/grok-goal-4b830698eeec/implementer/w6full/`.

## The two required commands

| # | command | wall | exit |
|---|---|---:|---:|
| 1 | `yarn test` | 2799 s | 1 |
| 2 | `yarn test:e2e` | 1024 s | 1 |

### Command 1: `yarn test`

`yarn test` is `lerna run test --ignore solidcash-examples && yarn workspace testing-suite test`.
Lerna printed `Executing command in 7 packages` and ran them concurrently (utils started 18:27:33Z,
solidcash 18:27:39Z). The captured stream holds three package blocks and ends after the solidcash error:

- `@solidcash/utils`: `Test Files  24 passed (24)` / `Tests  480 passed (480)`, exit 0.
- `solidc`: lerna logged the script done in 1449.4 s, but that block's stdout was cut off before its
  summary, so this block is not usable for solidc. See the recovery run below.
- `solidcash`: `Test Files  28 failed | 877 passed | 25 skipped (930)` /
  `Tests  53 failed | 5331 passed | 167 skipped | 5 todo (5556)`.
- `lerna ERR! yarn run test exited 1 in 'solidcash'` then `error Command failed with exit code 1`.

No output appears for `@solidcash/solidhat`, `@solidcash/create-solidhat`, `@solidcash/testing` or
`testing-suite`: the stream ends when solidcash fails, so those suites were not reached, and the
`&& yarn workspace testing-suite test` tail never ran. Those four suites were therefore run once each
afterwards to obtain their summaries; that recovery block follows.

Log: `yarn-test.log`.

### Recovery runs (suites command 1 did not reach, plus solidc's lost summary)

Each was run once, from the worktree root. Commands:

- `yarn workspace solidc test`
- `yarn workspace @solidcash/solidhat test`
- `yarn workspace @solidcash/create-solidhat test`
- `yarn workspace @solidcash/testing test`
- `yarn workspace testing-suite test`

| suite | wall | exit | Test Files | Tests |
|---|---:|---:|---|---|
| solidc | 510 s | 1 | `4 failed \| 360 passed (364)` | `4 failed \| 6835 passed (6839)` |
| `@solidcash/solidhat` | 23 s | 0 | `11 passed (11)` | `71 passed \| 1 skipped (72)` |
| `@solidcash/create-solidhat` | 1 s | 0 | no test files | n/a |
| `@solidcash/testing` | 19 s | 0 | `20 passed (20)` | `99 passed (99)` |
| `testing-suite` | 18 s | 0 | `7 passed (7)` | `27 passed (27)` |

Logs: `solidc.log`, `solidhat.log`, `create-solidhat.log`, `testing.log`, `testing-suite.log`.

`@solidcash/testing` is the package the root script names `testing-suite`; the `testing-suite` row is the
separate `examples/testing-suite` workspace, which the root script also runs.

Under `yarn test` the truncated solidc block additionally showed
`test/journal-message-bus/KernelLoopRoute.test.ts` and `test/journal-message-bus/KernelAdmission.test.ts`
as `1 failed` each. Both pass in the isolated run above (the concurrent run was about 3x slower). These
two are not reproducible in isolation and are read as load-induced, not product failures.

### Command 2: `yarn test:e2e`

`yarn test:e2e` is `yarn workspace solidcash test:e2e` (`vitest run test/e2e`).

- `Test Files  7 failed | 462 passed | 4 skipped (473)`.
- `Tests  13 failed | 3200 passed | 24 skipped | 3 todo (3240)`.
- Wall 1024 s, exit 1.

Log: `yarn-test-e2e.log`.

## Class codes

- `pre-existing kernel` / `pre-existing framed`: named as a row in `W6_BASELINE.md` (the row is the test
  title under the file). The 14 rows of `W6_KNOWN_FAILURES.md` are all solidc files; none of those files
  fails here.
- `port-during-baseline`: recorded in `W6_BASELINE.md`'s Repeats section.
- `NEW`: no row in `W6_KNOWN_FAILURES.md` or `W6_BASELINE.md`. The file existed at `295f6eed6` and the
  title is absent from that run's failure list.

## solidc failures (4, all new)
- `packages/solidc/test/ComputeSideCarRecipes.test.ts`
  - test: binds nested Keccak operands to source call ordinals and the exact producer result
  - class: NEW
    message: AssertionError: expected undefined to be 1 // Object.is equality
- `packages/solidc/test/InlineAssemblyYul.test.ts`
  - test: ends the path of a switch arm that reverts, so the return in the other arm is the function's
  - class: NEW
    message: AssertionError: expected 'OP_DUP OP_DUP 21 OP_NUM2BIN 20 OP_SPL...' to be 'OP_DUP OP_DUP 21 OP_NUM2BIN 20
    OP_SPL...' // Object.is equality
- `packages/solidc/test/WitnessAbiPublication.test.ts`
  - test: does not invent fold witnesses on a direct writer (message bus: true)
  - class: NEW
    message: AssertionError: expected true to be false // Object.is equality
- `packages/solidc/test/solidity-compat/yul-evm.test.ts`
  - test: does not treat a switch without a default as definite initialization
  - class: NEW
    message: AssertionError: expected [Function] to throw an error

## solidcash failures (53: 40 baseline rows, 13 new)
- `packages/solidcash/test/unit/ExternalCallPredicate.test.ts`
  - test: resolves a field from its dominating mapping state struct write without application names
  - class: NEW
    message: AssertionError: expected '[{"kind":"expression","expression":{"...' not to contain 'stateAccess'
- `packages/solidcash/test/unit/ExternalCallPredicate.test.ts`
  - test: preserves a dominating field type for packed external-call arguments
  - class: NEW
    message: AssertionError: expected undefined to deeply equal [ Uint8Array[ 0, 2 ] ]
- `packages/solidcash/test/unit/LogicalIdentityPreservation.test.ts`
  - test: preserves FakeToken.json identity across the marketplace fixture transfer/approve sequence
  - class: pre-existing kernel
    message: Error: Failed to derive initial state commitments from constructor. Ensure the constructor writes all state
    variables. VM error at instruction 15/2763: Program failed an OP_VERIFY operation. (stack: 545354, 54657374,
    000000000000000000000000000000000000000000000000000000000000000002)
- `packages/solidcash/test/unit/LogicalIdentityPreservation.test.ts`
  - test: preserves FakeToken.json identity across transfer to another account
  - class: pre-existing kernel
    message: Error: Failed to derive initial state commitments from constructor. Ensure the constructor writes all state
    variables. VM error at instruction 15/2763: Program failed an OP_VERIFY operation. (stack: 545354, 54657374,
    000000000000000000000000000000000000000000000000000000000000000002)
- `packages/solidcash/test/framed/call/branch-predicate-after-arm-write.test.ts`
  - test: publishes the predicate as it stands where the branch starts
  - class: pre-existing framed
    message: AssertionError: expected { Object (kind, operator, ...) } to strictly equal { Object (kind, operator, ...) }
- `packages/solidcash/test/framed/call/branch-predicate-after-arm-write.test.ts`
  - test: accepts the plan the published predicate gives: the arm's call is placed and every input accepted
  - class: pre-existing framed
    message: FramedProxyDeployError: the implementation's "close" entry did not settle through the proxy: frame
    "implementation-master" of Root.close() at line 1: no source message (Program called an OP_SPLIT operation with an
    invalid index. stack item length: 187; requested split index: 512.), and the run it declares for dynamic "jobs" is 1
    chunk(s), sized from the length the record's own declaration states
- `packages/solidcash/test/framed/call/plain-caller-identity.test.ts`
  - test: carries the caller's reported address whole inside a long packed payload, to the receipt and the chain
  - class: pre-existing framed
    message: AssertionError: expected '2dc0030097d6999495a069c3a217b2e37dcb8...' to be
    'aa200ec9a7654f028350e80111d46933a6d98...' // Object.is equality
- `packages/solidcash/test/framed/call/proxy-external-calls-published.test.ts`
  - test: states one call per published site the caller's own facts reach
  - class: pre-existing framed
    message: ShippedHostError: FRAMED_HOST_STOP_SITES_UNPUBLISHED: the artifact publishes no framed stop-site table
- `packages/solidcash/test/framed/call/skipped-batch-write.test.ts`
  - test: publishes the condition each balance write runs under
  - class: pre-existing framed
    message: AssertionError: expected 1 to be 2 // Object.is equality
- `packages/solidcash/test/framed/call/skipped-batch-write.test.ts`
  - test: mints, transfers and burns, the balances and the total supply read back
  - class: pre-existing framed
    message: AssertionError: expected +0 to be 1 // Object.is equality
- `packages/solidcash/test/framed/call/write-segments-settlement.test.ts`
  - test: settles a refund-like entry: a call, a mapping write in a later segment, and a dynamic write after the last call
  - class: pre-existing framed
    message: FramedProxyDeployError: the implementation's "refund" entry did not settle through the proxy: frame
    "implementation-master" of Impl.refund() at line 1: no source message (Program failed an OP_VERIFY operation.)
- `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  - test: settles a guarded tail-call stream with an inert unwind suffix in recursive source order
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Auto-derivation produced incomplet..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  - test: reconstructs multiple affine parameters for a pre-only stream and enforces exact termination
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Auto-derivation produced incomplet..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  - test: settles every pre-recursion frame, rejects a forged event, and enforces the frame bound
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Auto-derivation produced incomplet..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  - test: settles mixed pre-order and post-descent events in recursive source order
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Auto-derivation produced incomplet..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  - test: settles affine-counter progression in exact pre-order and unwind order at the 64-frame boundary
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Auto-derivation produced incomplet..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  - test: preserves a pooled long mapping return across event-emitting writes
  - class: pre-existing kernel
    message: AssertionError: unlocking scripts must meet the BCH-2026 per-input byte limit: expected [ { index: 1, bytes:
    10627 } ] to deeply equal []
- `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  - test: advances past a reached conditional opaque-return row in a delegated root
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 3: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  - test: learns computed ecrecover arguments under the shared atomic graph lock
  - class: pre-existing kernel
    message: Error: materialization: recipe mode forbids deferred-compute VM discovery as planner authority; unresolved
    participant(s) 1 (keccak 0/0, ecrecover 1/1) (opt into materializationMode=devOracle for diagnostic discovery)
- `packages/solidcash/test/journal-message-bus/e2e/ExactAdditiveRecurrenceSecurity.test.ts`
  - test: authenticates scalar state, preserves checked source order, rejects tampering, and caps rank at 64
  - class: NEW
    message: Error: Test timed out in 120000ms.
- `packages/solidcash/test/journal-message-bus/e2e/FixedConditionalTransferSecurity.test.ts`
  - test: binds true/false and if/else paths, neutral padding, exact recipes, row cardinality, and container debit
  - class: pre-existing kernel
    message: AssertionError: expected undefined to be defined
- `packages/solidcash/test/journal-message-bus/e2e/FixedConditionalTransferSecurity.test.ts`
  - test: executes address.transfer from its typed fixed-effect descriptor
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/FixedConditionalTransferSecurity.test.ts`
  - test: executes address.send from its typed fixed-effect descriptor
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelChunkedMappingStructCompose.test.ts`
  - test: settles and returns a graph-produced oversized scalar struct insert
  - class: NEW
    message: AssertionError: promise rejected "MessageBusDiagnosticError: messageBus [L3... { ...(3) }" instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/KernelChunkedMappingStructCompose.test.ts`
  - test: settles an existing chunked struct fixed-array update before a wide external result
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: messageBus: BCH-2026 preflight fai... { ...(2) }" instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/KernelComposeLayoutWitnesses.test.ts`
  - test: fills Store unlocker valueChunk (+PredOut when active) matching one layout resolve
  - class: NEW
    message: AssertionError: expected -1 to be -2 // Object.is equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelLegacyObservableParity.test.ts`
  - test: preserves payload event effects across fresh route compiles
  - class: pre-existing kernel
    message: AssertionError: input 0: expected 'Program attempted an operation that w...' to be true // Object.is equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  - test: settles affine varying-key recursive sets and deletes through rank streams
  - class: pre-existing kernel
    message: AssertionError: input 0: expected 'Program failed an OP_VERIFY operation.' to be true // Object.is equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  - test: settles selected counter domains and freezes mixed collection/effect domains
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: messageBus: BCH-2026 preflight fai... { ...(2) }" instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  - test: settles a lazy returning-helper event in a scalar-state continuation
  - class: pre-existing kernel
    message: AssertionError: marked input 0: expected 'Program attempted an operation that w...' to be true // Object.is
    equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  - test: enforces the recursive event domain step and 64-frame resource bound
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Auto-derivation produced incomplet..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/KernelMixedArrayMappingJournal.test.ts`
  - test: rejects a forged mapping entry output on BCH-2026
  - class: NEW
    message: AssertionError: expected true not to be true // Object.is equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelMultiContinuationResourceCompose.test.ts`
  - test: builds and sends two cold keys in one chunkable collection through typed discovery
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Transaction fee of 33353 satoshis ..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/KernelMultiContinuationResourceCompose.test.ts`
  - test: routes typed cold-key inserts to the runtime-selected callee bytecode
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: Transaction fee of 33352 satoshis ..." instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/KernelMultiProducerResultCompose.test.ts`
  - test: binds two producer IDs into one sink and rejects swapped lanes
  - class: NEW
    message: AssertionError: promise resolved "TransactionBuilder{ ...(7) }" instead of rejecting
- `packages/solidcash/test/journal-message-bus/e2e/KernelMultiResultGraphParity.test.ts`
  - test: forwards authenticated tuple lanes with kernel and legacy observable parity
  - class: NEW
    message: AssertionError: promise resolved "TransactionBuilder{ ...(7) }" instead of rejecting
- `packages/solidcash/test/journal-message-bus/e2e/KernelPhysicalCallerWithScidCompose.test.ts`
  - test: uses the authenticated proxy identity for address(this) and a nested caller beside its SCID anchor
  - class: pre-existing kernel
    message: AssertionError: promise rejected "Error: messageBus: BCH-2026 preflight fai... { ...(2) }" instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/KernelSchemaNameIsolation.test.ts`
  - test: evaluates the exact stored-element recipe with a same-typed decoy
  - class: NEW
    message: AssertionError: expected false to be true // Object.is equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelSchemaNameIsolation.test.ts`
  - test: does not give historical function or schema names special kernel authority
  - class: NEW
    message: AssertionError: expected false to be true // Object.is equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelSchemaNameIsolation.test.ts`
  - test: evaluates a typed bigint left shift in a stored-element recipe
  - class: NEW
    message: AssertionError: expected false to be true // Object.is equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelSegmentedHandlerReturnWidths.test.ts`
  - test: preserves a multi-segment journal through repeated void, one-value, and two-value handler invokes
  - class: pre-existing kernel
    message: AssertionError: batch input 0: expected 'Program failed an OP_VERIFY operation.' to be true // Object.is
    equality
- `packages/solidcash/test/journal-message-bus/e2e/KernelSelfdestructStateCompose.test.ts`
  - test: admits and settles kill() with fixed dataNft under messageBus.compose
  - class: NEW
    message: Error: messageBus: BCH-2026 preflight failed at input 1: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  - test: selects an overloaded upgrade by canonical signature and preserves its selector identity
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 1: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  - test: authenticates one final upgrade row and preserves the master NFT geometry
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  - test: appends canonical new fields after the post-row old state and rejects suffix tampering
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  - test: defaults omitted appended fields and rejects initializers for an existing field
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeSignature.test.ts`
  - test: authenticates two detached aggregate signatures through one exact helper body
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 1: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeSignature.test.ts`
  - test: accepts SIGHASH_ALL and rejects weaker authorization and output tampering in the BCH-2026 VM
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 1: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeSignature.test.ts`
  - test: allows an all-output-signed ordinary leaf in a graph containing another participant upgrade
  - class: pre-existing kernel
    message: Error: messageBus: BCH-2026 preflight failed at input 3: Program failed an OP_VERIFY operation.
- `packages/solidcash/test/journal-message-bus/e2e/MessageBusDelegateClassesE3.test.ts`
  - test: does not materialize a forged proxy state when a conditional delegate edge is not taken
  - class: pre-existing kernel
    message: AssertionError: expected 'messageBus: BCH-2026 preflight failed...' to be 'ACCEPTED counter=5' // Object.is
    equality
- `packages/solidcash/test/journal-message-bus/e2e/MessageBusDelegateClassesE3.test.ts`
  - test: settles a not-taken spend that preserves state, and refuses one that writes
  - class: pre-existing kernel
    message: AssertionError: expected [ ...(2) ] to include 'messageBus: BCH-2026 preflight failed...'
- `packages/solidcash/test/journal-message-bus/e2e/MessageBusEventIdentity.test.ts`
  - test: binds the selected event covenant when route branches share one emit slot
  - class: NEW
    message: AssertionError: promise rejected "Error: messageBus: BCH-2026 preflight fai... { ...(2) }" instead of resolving
- `packages/solidcash/test/journal-message-bus/e2e/OutlinedArrayReadRoute.test.ts`
  - test: reads a non-empty chunk from the route trailing run
  - class: pre-existing kernel
    message: AssertionError: direct input 0: expected 'Program failed an OP_VERIFY operation.' to be true // Object.is
    equality

## solidcash e2e failures (13: 1 baseline row, 12 new)
- `packages/solidcash/test/e2e/DynamicWriteBehavior.test.ts`
  - test: conditional array-element re-write: arr[0]=1; if(c){arr[0]=5}
  - class: NEW
    message: AssertionError: expected 1 to be 5 // Object.is equality
- `packages/solidcash/test/e2e/KernelDirectComputedChunks.test.ts`
  - test: publishes a computed 219-byte value for a co-spent non-routed writer
  - class: NEW
    message: AssertionError: expected true to be false // Object.is equality
- `packages/solidcash/test/e2e/KernelDirectComputedChunks.test.ts`
  - test: publishes a computed 400-byte value for a co-spent non-routed writer
  - class: NEW
    message: AssertionError: expected true to be false // Object.is equality
- `packages/solidcash/test/e2e/KernelDirectWitnessAbi.test.ts`
  - test: keeps caller identity coordinates aligned for a non-routed chunkable writer
  - class: NEW
    message: AssertionError: expected true to be false // Object.is equality
- `packages/solidcash/test/e2e/KernelDistinctEntryRows.test.ts`
  - test: preserves distinct recipients, repeated recipients, and self transfers (4n)
  - class: NEW
    message: AssertionError: expected -1n to be 1n // Object.is equality
- `packages/solidcash/test/e2e/KernelResultTopology.test.ts`
  - test: refuses an unproven later loop before broadcasting any earlier row
  - class: NEW
    message: AssertionError: promise resolved "{ inputs: [ { ...(4) }, ...(8) ], ...(6) }" instead of rejecting
- `packages/solidcash/test/e2e/StaticCall.test.ts`
  - test: multi-value (tuple) reads fail closed with a clear message (not yet supported)
  - class: port-during-baseline
    message: AssertionError: promise resolved "[ 5n, 9n ]" instead of rejecting
- `packages/solidcash/test/e2e/Upgrade.test.ts`
  - test: should upgrade from V1 to V3 and initialise new field with default
  - class: NEW
    message: Error: mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 0:
    Program failed an OP_VERIFY operation.)
- `packages/solidcash/test/e2e/Upgrade.test.ts`
  - test: should use V3 logic after upgrade (incrementWithBonus)
  - class: NEW
    message: Error: mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 0:
    Program failed an OP_VERIFY operation.)
- `packages/solidcash/test/e2e/Upgrade.test.ts`
  - test: should chain V1 -> V2 -> V3 upgrade preserving state throughout
  - class: NEW
    message: Error: mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 0:
    Program failed an OP_VERIFY operation.)
- `packages/solidcash/test/e2e/Upgrade.test.ts`
  - test: should mint new data NFT when state overflows to second NFT
  - class: NEW
    message: Error: mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 0:
    Program failed an OP_VERIFY operation.)
- `packages/solidcash/test/e2e/Upgrade.test.ts`
  - test: should use V2 logic with new data NFT after overflow upgrade
  - class: NEW
    message: Error: mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 0:
    Program failed an OP_VERIFY operation.)
- `packages/solidcash/test/e2e/Upgrade.test.ts`
  - test: settles under SIGHASH_ALL, and refuses a new data NFT off the covenant, a gap, a
    detached extra, or an old one left unspent
  - class: NEW
    message: AssertionError: promise rejected "Error: mandatory-script-verify-flag-faile..." instead of resolving


## Environment and load notes

- The box was loaded by a separate marketplace ladder throughout; the task says not to judge by timing.
  The solidcash `KernelLoopCompose.test.ts` file alone took 354 s and `AtomicMessageBusCompose.test.ts`
  362 s inside command 1.
- `test/journal-message-bus/e2e/ExactAdditiveRecurrenceSecurity.test.ts` failed with
  `Error: Test timed out in 120000ms.` Under this load that is plausibly an environment timeout; it is
  listed as new because it is not in either baseline doc, but its cause is not established here.
- `create-solidhat` reports `No test files found` and exits 0 (its script passes
  `--passWithNoTests`). Not a product failure.

## Verdict

W6's non-marketplace gate is NOT green at HEAD.

- `yarn test` exits 1. `solidcash` is 53 failed / 5331 passed; `solidc` is 4 failed / 6835 passed;
  `utils`, `solidhat`, `create-solidhat`, `testing` and `testing-suite` are green.
- `yarn test:e2e` exits 1 with 13 failed / 3200 passed.

What is left, by the classification the task asks for:

- Matched to `W6_BASELINE.md` rows: 40 solidcash tests (33 pre-existing kernel, 7 pre-existing framed)
  and 1 e2e test (the `port-during-baseline` StaticCall row). These are the same classes recorded on
  2026-10-05, many now with smaller counts.
- Matched to a `W6_KNOWN_FAILURES.md` row: none. The 14 rows are solidc files and all are green here.
- NEW (no row anywhere): 4 solidc, 13 solidcash, and 12 e2e tests, 29 in total.
  The solidc four have their own section below; the solidcash and e2e lists carry the `NEW` class inline.

The most consequential residuals, because they are new and not attributed by any baseline note: the four
new solidc codegen assertions (`yul-evm`, `InlineAssemblyYul`, `ComputeSideCarRecipes`,
`WitnessAbiPublication`), the six `Upgrade.test.ts` e2e failures, and the new kernel e2e families
(`KernelDirectComputedChunks`, `KernelDirectWitnessAbi`, `KernelDistinctEntryRows`, `DynamicWriteBehavior`).
W6 should either fix these or add them to `W6_KNOWN_FAILURES.md` with a class before the gate can be called
green.
