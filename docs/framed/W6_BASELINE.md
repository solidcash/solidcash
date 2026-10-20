# W6 step 1: sequential suite baseline

Log `w6-baseline.log`. `BASELINE_HEAD 295f6eed61c2e554c6d7c4835f5dc984398e8589`.
`BASELINE_START 2026-10-05T11:26:27Z`. `BASELINE_DONE 2026-10-05T13:24:55Z`.
Parents: kernel `d7f3c7ad6`, framed `d8166489d`. Parent suites were not re-run.
Merge-caused means the test passes on one parent's pre-merge commit. That was not shown,
so nothing below is marked merge-caused.

## What actually ran

Yarn 1 dropped every `--` flag passed to `yarn workspace <pkg> exec vitest run`.
Vitest's own argument list was `run`. solidc and solidcash configs already set
`maxWorkers: 3`, which is inside the 2-or-3 limit. Positional filters were kept:
`vitest run test/e2e` and `vitest run test/framed` ran those directories.
`--config vitest.framed.config.ts` did not arrive, so the solidc, solidcash, and
testing framed configs were not selected. `--exclude test/e2e/**` did not arrive,
so the solidcash step ran the full package, including e2e and journal tests.
`--passWithNoTests` did not arrive, so create-solidhat exited 1 with no test files.

| step | exit | result |
|---|---:|---|
| tsc | 0 | tsc -b, already fresh |
| utils | 0 | 480 passed |
| testing | 1 | 3 failed, 94 passed |
| solidhat | 0 | 71 passed, 1 skipped |
| create-solidhat | 1 | no test files |
| solidc | 1 | 47 failed, 6788 passed |
| solidc-framed | 1 | same 47 titles as solidc |
| solidcash | 1 | 197 failed, 8382 passed, 1 failed suite |
| solidcash-framed | 1 | first solidcash set, plus one StaticCall test |
| testing-framed | 1 | the 3 testing failures, plus physical-identity |
| solidcash-e2e | 1 | 88 titles from the first solidcash run, plus StaticCall |
| utils-framed | 0 | 119 passed in test/framed |

## Commits that landed while the script ran

solidc finished at 11:43Z, before any of these. The first solidcash pass started at
11:43Z on `295f6eed6` and ended at 12:23:59Z. Docs-only commits do not affect tests.

- 12:15:13Z `920cf4ad8` hashes a vmap numeric key in `StatefulContract.ts`.
- 12:20:17Z `84e349830` reads a multi-output view as a named tuple.
- 12:22:58Z `bdcef843d` anchors the dynamic-chunk band. solidc was not re-run after it.
- 12:28:46Z `1c63087ed` and 12:30:25Z `c3b274eb5` land during the second solidcash pass.
  `c3b274eb5` adds `packages/testing/test/physical-identity.test.ts`.
- 13:22:35Z `bb01e8fdc` lands during the e2e pass. Its new test file was not discovered.

The first solidcash pass discovered files at 11:43Z, so tests added later are absent
from it. `test/e2e/StaticCall.test.ts` passed 12/12 on that pass. The repeat and the
e2e pass fail the tuple pin: the call resolves `[ 5n, 9n ]` instead of rejecting.
That pin is unchanged since `295f6eed6`. The failure tracks `84e349830`, not a flake.
Individual solidcash files have no timestamps, so a test that imported
`StatefulContract.ts` after 12:15Z may have executed the newer SDK. The assertion
text of every first-pass failure is the text at `295f6eed6`.

## Classes

The 14 section 0 titles keep the classes in `W6_KNOWN_FAILURES.md`. Every other
failure is classed from the test file at `295f6eed6`:

- pre-existing kernel: the file is only on the kernel parent, or the baseline file
  matches that parent, or it matches both and the path is not `test/framed/`.
- pre-existing framed: the file is only on the framed parent, or the baseline
  file matches that parent and not the kernel parent, or the path is `test/framed/`.
- environment: create-solidhat, a harness miss, not a product assertion.
- flaky: none. The solidc repeat matched title for title.
- port-during-baseline: not one of the five merge classes. The failure was not red
  at `295f6eed6`. It is not merge-caused, not flaky, and not environment.

## testing

- pre-existing kernel | `packages/testing/test/chai-event-args.test.ts`
  compares a Solidity event address string with the exact P2SH32 CashAddress identity
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/testing/test/chai-typed-address.test.ts`
  does not loosen untyped bytes or native address equality
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/testing/test/chai-typed-address.test.ts`
  uses the Solidity P2SH32 identity without treating an arbitrary hash as an address
  file absent on the framed parent. AssertionError

Subtotal: pre-existing kernel 3.

## solidc

- pre-existing framed | `packages/solidc/test/CompileCacheDisk.test.ts`
  cold Map loads from disk and re-attaches lazy delegateArtifact with bytecode parity
  baseline file matches the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/DelegateInference.test.ts`
  reads state-pinned external-call targets from proxy storage, not executor-adjacent NFTs
  section 0 list. AssertionError
- pre-existing kernel | `packages/solidc/test/DynamicEntryOutputPrefix.test.ts`
  counts only dynamic-state chunks at [ 2, 53 ] bytes (depth 5, route true)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/DynamicEntryOutputPrefix.test.ts`
  counts only dynamic-state chunks at [ +0, 60 ] bytes (depth +0, route false)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/DynamicEntryOutputPrefix.test.ts`
  counts only dynamic-state chunks at [ 61, 120 ] bytes (depth 5, route false)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/DynamicEntryOutputPrefix.test.ts`
  counts only dynamic-state chunks at [ 121, 241 ] bytes (depth +0, route true)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/Events.test.ts`
  counts only 33-byte minting category+capability outputs
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidc/test/ExternalArrayIndexExpression.test.ts`
  preserves the expression for values[SECOND]
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/ExternalCalls.test.ts`
  publishes the live arithmetic progression for a loop-dependent argument
  section 0 list. AssertionError
- pre-existing kernel | `packages/solidc/test/ExternalCalls.test.ts`
  routes a method call on a tuple-ternary-destructured interface var (CSAMM shape)
  section 0 list. SolidcDiagnosticError
- pre-existing kernel | `packages/solidc/test/ExternalCalls.test.ts`
  does not publish a lowered constant placeholder around a returning external call
  section 0 list. AssertionError
- pre-existing kernel | `packages/solidc/test/ExternalCalls.test.ts`
  publishes a replayable necessary conjunct before a later call
  section 0 list. AssertionError
- pre-existing framed | `packages/solidc/test/ExternalCalls.test.ts`
  compiles a LOCAL-indexed struct-field chain via the array co-spend loop
  section 0 list. AssertionError
- pre-existing kernel | `packages/solidc/test/FixedTransferStructProjection.test.ts`
  joins a changed field in source order while retaining its sibling
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/KernelAdmissionCatalog.test.ts`
  compileString still refuses early-return journal shapes with KERNEL_LAYOUT
  baseline file matches the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/LargeContractSplitting.test.ts`
  forwards the proxy master witness across calls between delegate facet entries
  section 0 list. AssertionError
- pre-existing kernel | `packages/solidc/test/SequentialStateKeySource.test.ts`
  does not claim one source-order projection across multiple state writes
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/StoredValueSource.test.ts`
  tracks an assignment in an unconditional require before the whole-value write
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidc/test/StructsMappings.test.ts`
  conditional local pointer m = c?a:b: publishes the same authenticated entry route as branch/ternary
  section 0 list. AssertionError
- pre-existing framed | `packages/solidc/test/generation/UnpublishableLoopGuard.test.ts`
  reads an ERC-20 transfer loop with an inlined arm a preceding revert decides
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/generation/UnpublishableLoopGuard.test.ts`
  reads an ERC-20 transfer loop with a journal flush the body always reaches
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/generation/UnpublishableLoopGuard.test.ts`
  reads an ERC-20 transfer loop with the same arm without the revert
  file absent on the kernel parent. AssertionError
- pre-existing kernel | `packages/solidc/test/generation/generation.test.ts`
  should compile msg_sig_data.scash to correct Script and artifact
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/FixedLocalArrayKeyVector.test.ts`
  replays one exact dominating definition for every fixed-vector element
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/FixedLocalArrayKeyVector.test.ts`
  preserves an exact fixed vector through one memory alias
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/FixedLocalArrayKeyVector.test.ts`
  replays a complete fixed vector returned by one acyclic pure helper
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/FixedLocalArrayKeyVector.test.ts`
  expands one exactly resolved pure scalar helper without cloning its call node
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/KernelAdmission.test.ts`
  admits one unconditional chunkable replacement beside unrelated conditional effects
  baseline file differs from both parents; not marked merge-caused. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/KernelAdmission.test.ts`
  lowers an affine varying-key mapping delete to an authenticated rank stream
  baseline file differs from both parents; not marked merge-caused. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/KernelDominatedStateBranchAdmission.test.ts`
  ignores scalar update arms excluded by dominating terminal guards
  section 0 list. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/KernelLoopRoute.test.ts`
  keeps 'exact fixed local key-vector rows' proportional to row logic rather than the configured row ceiling
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/KernelLoopRoute.test.ts`
  keeps 'immutable fixed key-vector alias rows' proportional to row logic rather than the configured row ceiling
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/KernelLoopRoute.test.ts`
  keeps 'pure fixed key-vector producer rows' proportional to row logic rather than the configured row ceiling
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidc/test/journal-message-bus/RepeatedOwnerMessageBus.test.ts`
  publishes fixed-array element assignments in pure-helper programs
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidc/test/solidity-compat/calls-abi.test.ts`
  encodes a self external-function member stored in a struct blob
  section 0 list. InvalidParameterTypeError
- pre-existing framed | `packages/solidc/test/solidity-compat/libraries-imports.test.ts`
  mixes a using-for external-call method and a genuine interface method on the same field
  section 0 list. AssertionError
- pre-existing framed | `packages/solidc/test/solidity-compat/libraries-imports.test.ts`
  using-for method spelling this.m[k].addElastic(e), both positions
  section 0 list. DirectStaleReadError
- pre-existing kernel | `packages/solidc/test/solidity-compat/storage-collections.test.ts`
  compiles a single-tail-return external-call helper with a field-name-colliding local (Unicrow calculateSplits)
  section 0 list. UnboundReturnCallError
- pre-existing framed | `packages/solidc/test/solidity-compat/storage-collections.test.ts`
  returning bare totals[k].addElastic(e), statement + expression (public mapping)
  section 0 list. DirectStaleReadError
- pre-existing framed | `packages/solidc/test/framed/master/branched-call-entry.test.ts`
  accepts the spend, over the one record and two segments its execution declares
  file absent on the kernel parent. SolidcDiagnosticError
- pre-existing framed | `packages/solidc/test/framed/master/branched-call-entry.test.ts`
  refuses a frame declaring the descriptor list's count instead of the execution's
  file absent on the kernel parent. SolidcDiagnosticError
- pre-existing framed | `packages/solidc/test/framed/master/direct-path-identity.test.ts`
  emits the pinned bytecode for a stateful contract with a signature check
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/framed/master/direct-path-identity.test.ts`
  emits the pinned bytecode for a stateful contract that reads msg.sender
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/framed/master/entry-append-source.test.ts`
  folds the fields a rebuild writes into the element the append states
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/framed/master/inlined-literal-branch.test.ts`
  serves the entry that passes false, and its body no longer writes the whitelist
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/framed/master/inlined-literal-branch.test.ts`
  keeps the arm when the argument is not a literal, so the write stays refused
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidc/test/framed/master/mapping-delete-write.test.ts`
  publishes the removal as the default write, under the same layout and ABI as writing the default
  file absent on the kernel parent. AssertionError

Subtotal: pre-existing kernel 30, pre-existing framed 17.

## solidcash

197 failed tests plus one failed suite. The failed suite is counted here.

- pre-existing framed | `packages/solidcash/test/e2e/AssemblyReturnHalts.test.ts`
  failed suite (the file did not load a test result)
  file absent on the kernel parent. UnsupportedReturnError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  keeps a caller-prepared result strict and an SDK-learned result a provisional seed
  baseline file differs from both parents; not marked merge-caused. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  derives lifecycle wire geometry from metadata and invocation args, never a caller transcript
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  derives V4 signature provenance from handler policy and refuses row or protocol drift
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  uses the authenticated physical owner identity for nested callers
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  uses the authenticated state owner as the nested high-level caller identity
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  uses the authenticated state owner as caller for a nested raw call
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  resolves a published CREATE caller identity at the identity-anchor offset
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  derives participant bases, identities, policies, and exact invocation rows
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  activates a published return slot only for a selected returning invocation
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  changes the participant identity table when code identity or category changes
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  authenticates a participant output identity independently of its consumed identity
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  admits canonical event, value, token-container, and token-settlement rows
  baseline file differs from both parents; not marked merge-caused. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  binds compiler-published sparse event sites without requiring a rectangular row frame
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  admits only event slots owned by selected graph-effect rows
  baseline file differs from both parents; not marked merge-caused. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  encodes a mutable-resource replacement with independent input and output covenants
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  binds a compiler-published child deployment to one exact genesis output span
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/AtomicMessageBusGraph.test.ts`
  orders and exactly covers multiple heterogeneous deployment sites in one row window
  baseline file differs from both parents; not marked merge-caused. TypeError
- pre-existing kernel | `packages/solidcash/test/e2e/ArrayExternalCall.test.ts`
  co-spends and verifies every subscriber in the array
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/ArrayExternalCall.test.ts`
  co-spends an array spanning multiple chunks (4 subscribers, 2 chunks)
  baseline file matches both parents; parent suites were not re-run
- pre-existing framed | `packages/solidcash/test/e2e/ChunkReadsBesideExternalCall.test.ts`
  received fn-ptr broadcast from a block wider than its planned base, beside two read-only arrays
  file absent on the kernel parent
- pre-existing framed | `packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts`
  builds the table via push then co-spends every callee through fns[i]()
  baseline file matches the framed parent
- pre-existing framed | `packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts`
  refuses a broadcast that leaves an element callee out
  baseline file matches the framed parent
- pre-existing framed | `packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts`
  co-spends every callee with its OWN registered method (inc vs dec)
  baseline file matches the framed parent
- pre-existing framed | `packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts`
  dispatches each received pointer to its OWN method (inc vs dec, stateful callees)
  baseline file matches the framed parent
- pre-existing framed | `packages/solidcash/test/e2e/FnPtrDispatchTables.test.ts`
  dispatches HETEROGENEOUS callees (different data-NFT counts - impossible for any fixed stride)
  baseline file matches the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/PackedArrayExternalCall.test.ts`
  co-spends and verifies every element of a packed address[2]
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StatefulComputedLoopDispatch.test.ts`
  auto-fills __internal__viewReturn0 from each co-spent pair state; the covenant reads it
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StatefulComputedLoopDispatch.test.ts`
  reads each callee return-event, typed-decodes it, accumulates the returns
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StatefulComputedLoopDispatch.test.ts`
  autoderives the witness + co-spends the registered instances; each is called
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StatefulComputedLoopDispatch.test.ts`
  scales to a 3-hop route (3 co-spent instances, path.length 4)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StatefulComputedLoopDispatch.test.ts`
  fills the witness correctly when the interface is multi-method (selector param follows in the ABI)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StructFieldArrayExternalCall.test.ts`
  decodes the FIRST field as the co-spend target (MasterChef lpToken layout)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StructFieldArrayExternalCall.test.ts`
  skips a preceding field, then decodes the target field
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  pass_function_types_internally: internal fn-ptr passed to a helper dispatches
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  ternary_contract_internal_function: qualified C.f/C.g ternary dispatches per branch
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  function_delete_stack: calling a deleted fn-ptr reverts (matches Solidity FAILURE)
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  memory array out-of-bounds access reverts (Solidity Panic 0x32)
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  runtime division by zero reverts
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  runtime modulo by zero reverts
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  assert(false) reverts, assert(true) does not
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  && and || short-circuit: the RHS (a would-revert div) is skipped
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`
  a wrong expectation reverts (dispatch is real per-index, not constant-folded)
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing framed | `packages/solidcash/test/e2e/DelegateEntryPresence.test.ts`
  checks every target of a guarded batch through a proxy
  file absent on the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/DelegateMappingProbe.test.ts`
  a delegated mapping UPDATE settles and lands the value
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/DelegateMappingProbe.test.ts`
  a direct zero-value register is enough to make later delegated writes settle
  baseline file matches both parents; parent suites were not re-run
- pre-existing framed | `packages/solidcash/test/e2e/DynamicWriteBesideReturningCalls.test.ts`
  settles with one chunk run whether the calls run or are skipped, and refuses a duplicated or moved chunk
  file absent on the kernel parent
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  derives crossed multi-NFT assignments without one-pin-per-probe
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  matches ABI argument names onto state fields before probing
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a set prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a from prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips an old prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a val prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a tmp prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a src prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips an init prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a the prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a dest prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/OptimisticMultiPinDerivation.test.ts`
  strips a prev prefix when matching ABI argument names
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/VMapRuntimeSlotAlias.test.ts`
  settles when the three keys are distinct (control)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/VMapRuntimeSlotAlias.test.ts`
  refuses when the sender IS the owner, rather than dropping a write
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/DelegateVerifiedMappingWrite.test.ts`
  rejects an appended fabricated entry node at the proxy input
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/ExternalCallAutoDerive.test.ts`
  should auto-derive A->B->C with connect-time binding
  baseline file matches both parents; parent suites were not re-run. DeferredTransitiveReturnProbeError
- pre-existing kernel | `packages/solidcash/test/e2e/ExternalCallAutoDerive.test.ts`
  should auto-wire A->B->C chain with externalContracts
  baseline file matches both parents; parent suites were not re-run. DeferredTransitiveReturnProbeError
- pre-existing kernel | `packages/solidcash/test/e2e/ExternalCallAutoDerive.test.ts`
  should auto-derive A->B->C with withExternalCall on A
  baseline file matches both parents; parent suites were not re-run. DeferredTransitiveReturnProbeError
- pre-existing kernel | `packages/solidcash/test/e2e/ExternalCallAutoDerive.test.ts`
  should auto-derive A->B->C with simplified withExternalCall
  baseline file matches both parents; parent suites were not re-run. DeferredTransitiveReturnProbeError
- pre-existing kernel | `packages/solidcash/test/e2e/ExternalCallAutoDerive.test.ts`
  should throw error for circular A->B->A auto-resolution
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/FaithfulDerivationPathGate.test.ts`
  reports an operation-cost refusal raised inside the probe instead of swallowing it
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/InlineLoopDispatch.test.ts`
  co-spends N witness targets + mints N return events (staticcall)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/InlineLoopDispatch.test.ts`
  rejects a co-spent input whose bytecode != the claimed target[i] (identity binding)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/InlineLoopDispatch.test.ts`
  the real solidity-by-example MultiCall verifies end-to-end (returns bytes[])
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/InlineLoopDispatch.test.ts`
  contract.multiCall(targets, data, ctx) - Solidity-faithful, auto-derives callerUtxo
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/InlineLoopDispatch.test.ts`
  contract.multiCall(targets, data) - fully internal via registerLoopTargets / registerLoopFunder
  baseline file matches both parents; parent suites were not re-run
- pre-existing framed | `packages/solidcash/test/e2e/InternalConstructorSender.test.ts`
  records the deployer as the owner, and only the owner passes the owner check
  file absent on the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelAbsentReadBesideWrite.test.ts`
  preserves an absent profile while appending a different collection ({"populated":false,"optimizeForCompilationSpeed":true})
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelAbsentReadBesideWrite.test.ts`
  preserves an absent profile while appending a different collection ({"populated":true,"optimizeForCompilationSpeed":true})
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelAbsentReadBesideWrite.test.ts`
  preserves an absent profile while appending a different collection
  ({"populated":false,"optimizeForCompilationSpeed":false})
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelAbsentReadBesideWrite.test.ts`
  preserves an absent profile while appending a different collection ({"populated":true,"optimizeForCompilationSpeed":false})
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelDelegateDynamicShrink.test.ts`
  retires a tail chunk while updating a co-spent contract (230 payload bytes)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelDelegateDynamicShrink.test.ts`
  retires a tail chunk while updating a co-spent contract (350 payload bytes)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelForwardedTargetIdentity.test.ts`
  authenticates a forwarded 20-byte address in the full VM
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/KernelIndependentComputedChunks.test.ts`
  keeps a direct writer and delegated writer in separate continuation ranges
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelMappingFixedTransfer.test.ts`
  authenticates captured entry operands via transfer after a write
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/KernelMappingFixedTransfer.test.ts`
  authenticates captured entry operands via callvalue after a write
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/KernelMixedEntryInsert.test.ts`
  inserts a scalar entry (false/false)
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/KernelMixedEntryInsert.test.ts`
  inserts a scalar entry (true/false)
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/KernelMixedEntryInsert.test.ts`
  inserts a scalar entry (true/true)
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/KernelRepeatedMixedRouteWrite.test.ts`
  preserves an earlier mapping update and both later appends via Ledger
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/KernelResultTopology.test.ts`
  selects the branch after an earlier write (choice: true)
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/e2e/KernelTypedStateArrayGetter.test.ts`
  projects indexed nested addresses through proxy state getters
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/MasterChefDeposit.test.ts`
  approve then deposit
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/MasterChefPoolInfoPush.test.ts`
  approve bob and chef after MasterChef.add
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/MinimalNativeToken.test.ts`
  keeps full ERC20 allowances and immediate BchNative below 6.5 KB
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/NativeUsdtInherited.test.ts`
  partitions the over-limit contract into shards that all fit
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/NestedApproveInsert.test.ts`
  uses the delegated state owner for a returning msg.sender-keyed write
  baseline file matches the kernel parent
- pre-existing kernel | `packages/solidcash/test/e2e/NestedStructArrayWrite.test.ts`
  the same write is over the real operation-cost budget at its natural size
  baseline file differs from both parents; not marked merge-caused. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/OzBchNativeInheritance.test.ts`
  composes with the unmodified OZ 5.0.2 implementation below 9 KB
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/SortedUpsertLoop.test.ts`
  fails closed on delete of a nonexistent key (nothing to nullify)
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/SplitLayoutAgreementX162.test.ts`
  SPENDS: a facet-resident write and a root-resident write both settle on one shared state
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/StatefulContractV6.test.ts`
  read-write: a lean instance sends and mutates state (count += step)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/StatefulContractV6.test.ts`
  read-write from an ADDRESS: lazy resolution then send (count += step)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/e2e/VMapBatchAdversarial.test.ts`
  rejects forged proof, successor, and predecessor-output witnesses
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/e2e/X121StrictPreflightDecision.test.ts`
  2. FAIL-OPEN on recursion: Measurement A falsified, gate and decider both refuse
  baseline file matches the kernel parent. TypeError
- pre-existing kernel | `packages/solidcash/test/e2e/X121StrictPreflightDecision.test.ts`
  2b. the same refusal holds with dust ON, so the regime is not what produces it
  baseline file matches the kernel parent. TypeError
- pre-existing kernel | `packages/solidcash/test/e2e/X50DefaultProxyRegenerated.test.ts`
  matches a fresh compile field for field, including debug.bytecode and fingerprint
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/ComposeConstraintIsolation.test.ts`
  does not let a rejected attempt poison a later attempt with identical initial claims
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/ComposeConstraintIsolation.test.ts`
  isolates overlapping attempts across await boundaries
  file absent on the framed parent. TypeError
- pre-existing kernel | `packages/solidcash/test/unit/ComposeConstraintIsolation.test.ts`
  still refuses a genuine claim cycle within a single build
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/DeployabilityCertificate.test.ts`
  kernel-beta-manifest no longer uses stringly deployability not-asserted
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/ExternalCallPredicate.test.ts`
  omits an empty loop without dropping a sibling loop that reaches its callee
  baseline file differs from both parents; not marked merge-caused
- pre-existing kernel | `packages/solidcash/test/unit/KernelReadCarrierBatchPreflight.test.ts`
  accepts one exact ordered completed-descriptor manifest beside the released carrier capability
  baseline file matches the kernel parent
- pre-existing kernel | `packages/solidcash/test/unit/LateTransitiveCalls.test.ts`
  prepares only reached result-dependent branches and loop calls (choice true)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/LateTransitiveCalls.test.ts`
  prepares only reached result-dependent branches and loop calls (choice false)
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/LegacyJobEventHelpersAdapter.test.ts`
  legacy JobEvent naming retirement: JobEvent-branded aliases are deleted from STB / adapter / index
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/LogicalIdentityPreservation.test.ts`
  preserves FakeToken.json identity across the marketplace fixture transfer/approve sequence
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/LogicalIdentityPreservation.test.ts`
  preserves FakeToken.json identity across transfer to another account
  baseline file matches the kernel parent
- pre-existing kernel | `packages/solidcash/test/unit/SemanticClaimSeedingOrder.test.ts`
  restores prior resource claims before probing a return hidden behind that resource check
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/SortedMappingProofInputCoordinate.test.ts`
  co-spends the bracketing entry NFT at the distance the covenant adds to the master input
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/unit/WorklistTargetIdentity.test.ts`
  binds forwarded canonical address words to the registered owner identity
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineRecursiveMappingStreams.test.ts`
  settles a bounded requirement-only unwind and rejects a hostile read witness
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineRecursiveMappingStreams.test.ts`
  authenticates only the taken path of a nested unwind requirement
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineRecursiveMappingStreams.test.ts`
  authenticates false predicates and outputs in post-recursion unwind order
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  settles a guarded tail-call stream with an inert unwind suffix in recursive source order
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  reconstructs multiple affine parameters for a pre-only stream and enforces exact termination
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  reconstructs independent affine parameters during non-void unwind
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  settles every pre-recursion frame, rejects a forged event, and enforces the frame bound
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  settles mixed pre-order and post-descent events in recursive source order
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AffineVoidRecursiveEvents.test.ts`
  settles affine-counter progression in exact pre-order and unwind order at the 64-frame boundary
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCapacity.test.ts`
  fits a 2-participant 'kernel' chain under stock BCH-2026 limits
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCapacity.test.ts`
  fits a 2-participant 'legacy' chain under stock BCH-2026 limits
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCapacity.test.ts`
  classifies a 4-participant 'kernel' chain at the stock operation-density boundary
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCapacity.test.ts`
  classifies a 5-participant 'kernel' chain at the stock operation-density boundary
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  materializes row-varying scalar, enum, and nested fixed-struct constructor genesis recipes
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  preserves a pooled long mapping return across event-emitting writes
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  advances past a reached conditional opaque-return row in a delegated root
  baseline file matches the kernel parent
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  learns computed ecrecover arguments under the shared atomic graph lock
  baseline file matches the kernel parent
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts`
  decodes each authenticated dynamic Solidity return in a repeated caller graph loop
  baseline file matches the kernel parent. TypeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/FixedConditionalTransferSecurity.test.ts`
  binds true/false and if/else paths, neutral padding, exact recipes, row cardinality, and container debit
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/FixedConditionalTransferSecurity.test.ts`
  executes address.transfer from its typed fixed-effect descriptor
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/FixedConditionalTransferSecurity.test.ts`
  executes address.send from its typed fixed-effect descriptor
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/FixedLocalArrayKeyAlias.test.ts`
  matches legacy alias order and preserves runtime index bounds
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/FixedLocalArrayKeyVector.test.ts`
  matches legacy element order and preserves runtime index bounds
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelChunkedMappingStructCompose.test.ts`
  settles an existing chunked struct fixed-array update before a wide external result
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelDefaultEmissionBandCompose.test.ts`
  keeps a non-prefix stream aligned across deep fixed-array frames before a void row
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelDelegateDualRuntimeSet.test.ts`
  materializes compiler-owned keys inside the delegated balanced route
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelDualRuntimeKeccakCompose.test.ts`
  settles fixed dual-key add+remove under compose
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLateTransitiveConditionalGraphCompose.test.ts`
  resolves a late P2SH32 target from an authenticated producer address result
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLateTransitiveConditionalGraphCompose.test.ts`
  resolves producer-derived branch true and fixed-array arguments before adding late callees
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLateTransitiveConditionalGraphCompose.test.ts`
  resolves producer-derived branch false and fixed-array arguments before adding late callees
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLateTransitiveSparseLoopCompose.test.ts`
  preserves zero, sparse, and full source order for a direct inferred-delegate loop
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLateTransitiveSparseLoopCompose.test.ts`
  requires target resources only for rows that are actually reached
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLegacyObservableParity.test.ts`
  preserves payload event effects across fresh route compiles
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  settles affine varying-key recursive sets and deletes through rank streams
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  cleans up multi-chunk bytes for an invariant-key mapping delete in a recursion fold
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  executes an invariant mapping-field update in a recursion fold
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  detaches and reconstructs nested struct and struct-array signature leaves
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  settles selected counter domains and freezes mixed collection/effect domains
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  settles a lazy returning-helper event in a scalar-state continuation
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts`
  enforces the recursive event domain step and 64-frame resource bound
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelMultiContinuationResourceCompose.test.ts`
  builds and sends two cold keys in one chunkable collection through typed discovery
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelMultiContinuationResourceCompose.test.ts`
  routes typed cold-key inserts to the runtime-selected callee bytecode
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelNestedFixedArrayReturnMaterialization.test.ts`
  materializes an intermediate stateful return after consuming a child result
  baseline file matches the kernel parent. DeferredTransitiveReturnProbeError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelNestedReturnSlotCoordinates.test.ts`
  keeps participant blocks local while return witnesses use absolute output indices
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelNestedReturningGraphArgCompose.test.ts`
  settles a nested returning address into a later graph call beside address(this)
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelNestedReturningStructAddressCompose.test.ts`
  settles a nested returning address inside a later struct graph argument
  baseline file matches the kernel parent
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelPhysicalCallerWithScidCompose.test.ts`
  uses the authenticated proxy identity for address(this) and a nested caller beside its SCID anchor
  baseline file matches the kernel parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelProjectedTargetCompose.test.ts`
  authenticates a 20-byte target (canonical=true) against the exact P2SH32 participant identity
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelSegmentedHandlerReturnWidths.test.ts`
  round-trips an unchanged non-empty segment bank through idempotent rows
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelSegmentedHandlerReturnWidths.test.ts`
  preserves a multi-segment journal through repeated void, one-value, and two-value handler invokes
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelStructAddressTargetDiscovery.test.ts`
  discovers a transitive ABI-word struct target (raw call: false)
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelStructAddressTargetDiscovery.test.ts`
  discovers a transitive ABI-word struct target (raw call: true)
  file absent on the framed parent
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelTwoHopReturnProbe.test.ts`
  derives zero, one, and two looped getter results from an authenticated scalar result
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  selects an overloaded upgrade by canonical signature and preserves its selector identity
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  authenticates one final upgrade row and preserves the master NFT geometry
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  appends canonical new fields after the post-row old state and rejects suffix tampering
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeCompose.test.ts`
  defaults omitted appended fields and rejects initializers for an existing field
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeSignature.test.ts`
  authenticates two detached aggregate signatures through one exact helper body
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeSignature.test.ts`
  accepts SIGHASH_ALL and rejects weaker authorization and output tampering in the BCH-2026 VM
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/KernelUpgradeSignature.test.ts`
  allows an all-output-signed ordinary leaf in a graph containing another participant upgrade
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/MessageBusDelegateClassesE3.test.ts`
  does not materialize a forged proxy state when a conditional delegate edge is not taken
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/MessageBusDelegateClassesE3.test.ts`
  settles a not-taken spend that preserves state, and refuses one that writes
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/OutlinedArrayReadRoute.test.ts`
  reads a non-empty chunk from the route trailing run
  file absent on the framed parent. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/OverloadedPureInternalCall.test.ts`
  keeps the exact overload through a fixed return on the legacy direct path
  baseline file matches both parents; parent suites were not re-run. AssertionError
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/OverloadedPureInternalCall.test.ts`
  keeps the exact overload through a fixed return on the kernel batch path
  baseline file matches both parents; parent suites were not re-run
- pre-existing kernel | `packages/solidcash/test/journal-message-bus/e2e/PureFixedKeyVectorProducer.test.ts`
  matches legacy producer results and preserves returned-array bounds
  baseline file matches the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/conformance/loop-turns-beside-calls.test.ts`
  the hop settles a post with an allowlist made twice, the second over the first post's chunks
  file absent on the kernel parent. FramedProxyDeployError
- pre-existing framed | `packages/solidcash/test/framed/call/branch-predicate-after-arm-write.test.ts`
  publishes the predicate as it stands where the branch starts
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/call/branch-predicate-after-arm-write.test.ts`
  accepts the plan the published predicate gives: the arm's call is placed and every input accepted
  file absent on the kernel parent. FramedProxyDeployError
- pre-existing framed | `packages/solidcash/test/framed/call/plain-caller-identity.test.ts`
  carries the caller's reported address whole inside a long packed payload, to the receipt and the chain
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/call/proxy-external-calls-published.test.ts`
  states one call per published site the caller's own facts reach
  file absent on the kernel parent. ShippedHostError
- pre-existing framed | `packages/solidcash/test/framed/call/skipped-batch-write.test.ts`
  publishes the condition each balance write runs under
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/call/skipped-batch-write.test.ts`
  mints, transfers and burns, the balances and the total supply read back
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/call/write-segments-settlement.test.ts`
  settles a refund-like entry: a call, a mapping write in a later segment, and a dynamic write after the last call
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/edges/aliased-keys-edge.test.ts`
  refuses by name a callee read of the node its own push spends, under another name
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/edges/written-local-sources.test.ts`
  publishes an array local written element by element as the element it holds, packed as an address
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/deploy/genesis.test.ts`
  refuses a write whose value the artifact publishes no source for
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/toys/identity.test.ts`
  resolves the plan's exact shape at compile: the self-call takes the callee's declared parameters
  file absent on the kernel parent. AssertionError
- pre-existing framed | `packages/solidcash/test/framed/toys/identity.test.ts`
  cannot yet lay the sweep out: the frame the callee writes in declares records its own layout omits
  file absent on the kernel parent. AssertionError

Subtotal: pre-existing kernel 175, pre-existing framed 23.

## create-solidhat

- environment | `packages/create-solidhat`
  No test files. `--passWithNoTests` never reached Vitest. Not a product failure.

## Repeats

- solidc-framed reproduced the same 47 titles in the same order. Not flaky.
- solidcash-framed reproduced the first 198 FAIL lines and added one:
  port-during-baseline | `packages/solidcash/test/e2e/StaticCall.test.ts`
  multi-value (tuple) reads fail closed with a clear message (not yet supported).
  First pass passed. Repeat and e2e received `[ 5n, 9n ]`. See `84e349830`.
- testing-framed reproduced the 3 testing failures and added one:
  port-during-baseline | `packages/testing/test/physical-identity.test.ts`
  addresses a deployment by its own lock when the project asks for the physical form.
  File added by `c3b274eb5` after the first testing pass. The address did not match.
- solidcash-e2e is `vitest run test/e2e`: 88 failed tests whose titles are in the
  first solidcash list, plus the StaticCall failure above. 3115 passed.
- utils-framed is `vitest run test/framed`: 119 passed, exit 0.

## Counts on the first pass, plus create-solidhat

- environment: 1
- pre-existing kernel: 208
- pre-existing framed: 40
- merge-caused: 0
- flaky: 0

The two port-during-baseline rows in Repeats are extra. They are not in the counts
above. Adding them does not create a merge-caused failure.

