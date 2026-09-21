# Kernel beta candidate — historical detailed handoff

> Superseded for continuation by `HANDOFF_KERNEL_BETA_NEXT_AGENT.md`, which includes the latest compiler/SDK
> fixes, broader-test failures, and the completed bounded Marketplace timing run. Retain this file for earlier
> implementation history only.

Updated: 2026-09-15 (Europe/Berlin)

## Resume here

Work only in `/Code/cashscript/.worktrees/kernel-beta-candidate` on branch
`grok/message-bus-kernel-beta`, HEAD `6d24edb404aee62903f69cd59f7ea64ec43d19ba`.

The active goal is to make all 66 unchanged titles in
`examples/effectiveacceleration/test/marketplace.test.ts` green on mock BCH-2026 while preserving
`artifact.messageBus.convention === 'kernel-row-loop'` and the `OP_INVOKE` graph boundary.

Read this file before editing. `HANDOFF_NEXT_SESSION.md` is stale historical material.
`HANDOFF_KERNEL_BETA_NEXT_AGENT.md` is only a short pointer to this document.

The worktree is intentionally very dirty. The user explicitly owns all modified files. Hundreds of untracked
`.js`, `.js.map`, `.d.ts`, and `.tsbuildinfo` files are generated products: do not stage them wholesale and never
use `git add -A`. Stage only a coherent, reviewed source/test slice.

Planning context:

```text
/root/.grok/sessions/%2FCode%2Fcashscript/01a08719-2af7-7972-a026-bee8bc1bf3b3/goal/plan.md
/tmp/grok-goal-e3920f329cc4/implementer/beta-reach-extension-inventory.md
```

## Non-negotiable constraints and invariants

- Do not edit Marketplace/Unicrow Solidity sources or the Marketplace suite.
- No chipnet, Hardhat, 10k-P2SH escape hatch, beta-manifest widening, or cherry-picking.
- `OP_RETURN` is separator-only.
- Implement from type/effect/flow properties and stable metadata, never application, contract, function, or member names.
- Work one Marketplace title at a time. Parallel agents should investigate read-only; keep one compiler/SDK writer.
- Every graph call has exactly one stable callsite identity.
- Later calls consume authenticated producer-result IDs, never cloned `ExternalFunctionCallNode`s.
- Graph handlers stay behind the same `OP_INVOKE` boundary.
- A fresh successful compile must not hide speculative stack/codegen failures.
- Differential tests compare observable kernel/legacy semantics; proportional kernel-route size is a separate check.

Do not stage known unrelated/generated drift:

```text
examples/testing-suite/artifacts/golden_token.artifact.ts
examples/testing-suite/artifacts/golden_token.json
scripts/kernel-beta-manifest.json
solidcash.config.ts
```

`packages/utils/src/state.ts` is real source: its dirty `peekPushdataEncodedLength` helper is imported by the SDK
work and must accompany that consumer unless deliberately reverted.

### Genericity audit is a beta gate

The source still contains substantial historical application-shaped terminology and, in a few places, executable
name checks. Do not add to it. Before calling a kernel slice beta-ready, audit the changed lines with:

```bash
git diff -U0 -- packages/solidc/src packages/solidcash/src | \
  rg '^\+.*(Marketplace|jobs\b|publishJobPost|publishJobEvent|JobEvent|Unicrow|FakeToken)'
```

Current dirty changes still call legacy APIs such as `rememberJobEventsChunks` and
`bumpPublishJobEventsWidth`, although the new kernel branch is moving toward `resourceIdentity` metadata. Treat
those APIs as compatibility debt, not a model for new work. Existing executable fallbacks in
`StatefulTransactionBuilder.ts` that compare `functionName` to `publishJobPost`/`publishJobEvent` must not become
kernel authority; replace any touched path with descriptor/effect/layout properties and add neutral tests.

## What was completed and verified in the latest slice

### Exact fixed-chunkable replacement admission

The direct whole-replacement regression was fixed. A direct replacement is a semantic write and no longer has to
advertise a fake read operation.

`assignFunctionSourceEffectOrdinals` now assigns stable syntactic call/write IDs even when the containing function
retains `sourceEffectOrder: 'unsupported-flow'`. The fixed-write proof is separate from global reached-order
authority. Compiler admission now proves one unconditional, non-repeating whole chunkable write and publishes its
exact mutation ordinal. It rejects a conditional write and a write bypassable by an early successful return.

The artifact publishes a selector-scoped, max-one `fixedChunkableWritePolicy`; producer identity consumes that
explicit policy rather than treating all unsupported-flow handlers as ordered.

Fresh `Unicrow.sol` iteration compile now reports selector `21567622` (`pay`) as kernel eligible with a real
mutation ordinal `[8]`, while the function correctly remains globally `unsupported-flow`. The route remains
`kernel-row-loop`.

Verified commands:

```text
yarn workspace solidc build                                                     PASS
yarn workspace solidcash build                                                  PASS
yarn workspace solidc vitest run test/journal-message-bus/KernelAdmission.test.ts \
  -t 'unconditional bare chunkable|conditional chunkable|early-return-bypass|whole dynamic struct' PASS (4)
yarn workspace solidc vitest run test/journal-message-bus/RepeatedOwnerMessageBus.test.ts PASS (21)
yarn workspace solidcash vitest run test/unit/ValueChunkProducerIdentity.test.ts PASS (12)
yarn workspace solidcash vitest run test/journal-message-bus/e2e/KernelLoopCompose.test.ts \
  -t 'settles routed and direct scalar insertions with chunked mapping values' PASS
yarn workspace solidcash vitest run test/journal-message-bus/e2e/AtomicMessageBusCompose.test.ts \
  -t 'authenticates a created dynamic-state chunk inside the trailing region' PASS
yarn solidcash compile --iteration --skip-split Unicrow.sol                     PASS (fresh iteration)
```

Relevant files:

```text
packages/solidc/src/ast/AST.ts
packages/solidc/src/compiler.ts
packages/solidc/src/semantic/SymbolTableTraversal.ts
packages/solidc/test/journal-message-bus/KernelAdmission.test.ts
packages/solidc/test/journal-message-bus/RepeatedOwnerMessageBus.test.ts
packages/solidcash/src/stateful/ValueChunkProducerIdentity.ts
packages/solidcash/test/unit/ValueChunkProducerIdentity.test.ts
```

### Dynamic-chunk physical-base and active witness work

The SDK now provisionally supplies `-1n` for `__internal__dynamicChunkInputBase`, records actual dynamic-state read
chunk inputs, and refreshes the exact first chunk coordinate after transaction materialization. Nested pending
fills publish an absolute block coordinate. Delegate and dynamic-base refreshers are combined rather than one
overwriting the other.

The route-level entry-access union is no longer used for inactive handler slots. If an active-operation map exists,
an absent slot means no operation. This removed the observed `derived 3 value witnesses for 2 published ABI
positions` failure while preserving dense, selected-handler witness ordering.

Relevant file: `packages/solidcash/src/stateful/StatefulContract.ts`.

## Current state of the focused Marketplace title

Run exactly one title:

```bash
timeout 360s yarn vitest run --config vitest.marketplace.config.ts \
  -t 'take job take job$' --reporter=dot --no-file-parallelism
```

The latest run passed deployment/setup and did not reproduce the previous value-witness error, but consumed high
CPU and timed out after 360 seconds with exit code 124 and no further output. Treat this as a fixed-point/worklist
convergence or performance bug until evidence says otherwise. Do not simply increase the timeout.

Use one concise debug family at a time and retain the first repeated state/transition. Search existing debug flags
in `compose.ts`, `worklist.ts`, `message-bus.ts`, and `StatefulContract.ts`; avoid enabling every trace together.

## Immediate correctness blocker 1: dynamic-base propagation in the compiler

This focused regression still fails:

```bash
yarn workspace solidc vitest run test/DelegateInference.test.ts \
  -t 'bases routed dynamic outputs' --reporter=dot --no-file-parallelism
```

Observed invariant violation: the generated route carries `__internal__dynamicChunkInputBase`, but the direct
delegated `apply` ABI does not. The current late propagation block is in `compiler.ts` around lines 11804–11830;
parameter injection is in `SymbolTableTraversal.ts` around line 4446. The logical handler, route, and generated
`OP_INVOKE` clones need one stable pre-SymbolTable propagation authority. Do not blanket-mark chunkable mapping
getters: a sorted `mapping(K => DynamicValue)` read uses value witnesses and is not a top-level dynamic-state band.

Add/retain neutral regressions for:

- a direct delegate reading/writing a top-level dynamic state array/string: route and direct ABI both carry the base;
- a `mapping(uint => Item[])` length getter: value witness and return context, but no dynamic-state base.

## Immediate correctness blocker 2: proxy/route return identity

An independent audit isolated a general return-path bug in `_deriveReturnValue` near
`StatefulContract.ts:32031`. It conflates two identities:

- logical result schema: the selected handler/public ABI (for example one `uint256`);
- physical return carrier: `call.compilerRoute?.abiFunction`, whose `returnEvent` slot and
  `returnOutputIdx` describe the generated route transaction.

For the currently observed collection getter, the logical function's return slot is offset 4 while the promoted
kernel route physically writes it at offset 19. The generated route is intentionally removed from public ABI, and
the built-in proxy `__forward` has no logical outputs. Looking up only `call.functionName` can therefore either use
the wrong offset or lose the return schema entirely.

General fix direction: carry `{artifact, logicalResultFn, physicalReturnFn}` across the proxy/route boundary. Use
the physical function for layout, extraction slot, and return-output index; use the logical function for output
types and struct decoding. Resolve the logical handler via selector-stable `compilerRoute.rowArguments`, not names
or route aggregate `bytes` output.

Add a neutral proxy + compiler-route regression with a single returning collection getter. A suitable existing
home is `packages/solidcash/test/e2e/X1DelegateSlotAdjacency.test.ts`; keep multi-row result framing separate.

## Known bug in the new root dynamic-base refresher

The callback near `StatefulContract.ts:29830` double-adds `overrides.blockBase` when it receives a materialized
`TransactionBuilder`: `materialized.inputs.findIndex` is already an absolute input index. The assignment must
distinguish:

```text
materialized ? localIndex : blockBase + localIndex
```

This does not explain a standalone chunkable mapping getter, but it will break composed dynamic-state reads at a
nonzero block base. `DelegateMixedDynamicMappingWrite.test.ts` or `DynamicWriteBehavior.test.ts` is a suitable
neutral regression home.

## Required cleanup before commit

- Remove the temporary `SOLIDC_DEBUG_KERNEL_ADMISSION` block in `packages/solidc/src/compiler.ts` near line 6222.
- `git diff --check` currently passes.
- Do not retain application-specific debug/name logic.
- Do not commit generated JS/declaration/source-map output.
- Review the broad existing dirty diff and commit only a coherent verified slice.

## Recommended next sequence

1. Fix the compiler dynamic-base propagation regression and run the focused `DelegateInference` test.
2. Fix the SDK materialized-index double-add and cover it neutrally.
3. Separate logical result schema from physical route return carrier and run its neutral proxy getter regression.
4. Rebuild `solidc` and `solidcash`.
5. Re-run only `take job take job$`. If it still times out, instrument convergence and fix the first repeated
   worklist/layout state; do not relax correctness checks or increase limits.
6. Re-check the previously green `post job 1$`, then continue the inventory one title at a time.
7. Before a coherent commit: relevant one-shot suites, normal fresh compile (not only `--iteration`), `yarn build`,
   `git diff --check`, and explicit staged-file review.

## Meaningful beta pause point

Preferred stop is Marketplace 66/66 plus fresh kernel artifacts, neutral regressions, relevant suites/full build,
kernel/legacy observable equivalence, and proportional kernel-route size.

If 66/66 is not reached, pause only on an architectural slice: its generic regression is green; the corresponding
Marketplace title and earlier ladder are rechecked; fresh compilation has no hidden error; unsupported shapes are
explicitly fenced; no application-name special case exists; and the remaining blocker is documented with one
reproducer and one stable failing invariant.
