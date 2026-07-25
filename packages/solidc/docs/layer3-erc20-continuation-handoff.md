# Layer-3 implementation continuation handoff

## Repository state

- Worktree: `/Code/cashscript/.worktrees/layer3-binding-spike`
- Branch: `codex/layer3-binding-spike`
- Last clean commit: `33c25344 feat(layer3): derive allowance keys from logical callers`
- The worktree is intentionally dirty. Do not commit it without completing the checks below.
- Uncommitted files:
  - `packages/solidc/src/compiler.ts`
  - `packages/solidcash/test/e2e/Layer3CompiledGraphController.test.ts`
  - this handoff

The clean committed baseline already proves:

1. compiler-authenticated graph callers and `msg.data`;
2. conditional/loop call reachability and computed arguments;
3. balanced compiler blocks, mapping resources, events, effects, returns, and an
   authentic stateful `A -> B -> A` cycle;
4. `msg.sender` mapping keys are graph-only route witnesses and are filled by
   the SDK planner from the authenticated parent locking bytecode.

The last item is commit `33c25344`. It proves caller-key derivation at compiler
and planner level, but it does **not** yet prove a complete, deployable,
`msg.sender`-authorized ERC-20 settlement on the BCH-2026 VM.

## Current objective

Close the ledger item:

> Two repeated `transferFrom` calls debit balances and
> `allowance[from][msg.sender]` under one balanced graph, with the caller
> derived from the authenticated parent participant, and fit every input under
> BCH's 10,000-byte input-script limit.

Do not weaken this to a caller-supplied `spender` parameter. That older corpus
case is useful journal evidence but is not standard ERC-20 authorization.

## New end-to-end fixture

`Layer3CompiledGraphController.test.ts` contains an uncommitted helper named
`buildCallerAuthorizedTransferGraph` and two tests:

- honest two-row `transferFrom` settlement;
- substituted allowance-spender witness rejection.

The fixture uses:

- `balances[bytes20]`;
- nested `allowance[bytes20][address]`;
- actual `msg.sender`;
- two calls from one router;
- four C2 entry NFTs;
- a balanced 10-slot transaction;
- the real `createVirtualMachineBch2026` for the deployability check.

The fixture initially had two bugs which are already corrected in the dirty
file:

1. the router was compiled against the token's unbranded locking bytecode;
2. recipient post-state values 10 and 20 were reversed.

The fixture still contains temporary instrumentation:

- `ALLOWANCE_SIZE`;
- `ALLOWANCE_DEBUG`;
- `createVirtualMachineBch2026` and `generateLibauthSourceOutputs` imports;
- a `builder` return used only by the trace.

Remove this instrumentation once the positive test passes. Do not accept the
hostile test as evidence while the honest input is oversized: both can reject
before covenant execution.

## Measured blocker

On the clean compiler baseline, the honest token measured:

- artifact/redeem bytecode: approximately 10,844 bytes;
- complete token unlocking bytecode: 12,311 bytes.

The BCH-2026 VM rejected input 1 before execution:

```text
The provided unlocking bytecode exceeds the maximum bytecode length.
Maximum bytecode length: 10000 bytes.
Unlocking bytecode length: 12311 bytes.
```

This is a real consensus/deployability failure, not a mock-provider issue or a
state mismatch. The relaxed mock provider otherwise reports it misleadingly as
an `OP_VERIFY` failure, which is why the explicit BCH-2026 trace is necessary.

## Current compiler experiment

The dirty compiler has two related size reductions.

### Shared parsing helpers

The synthesized route now places repeated SCB1 row parsing and graph-caller
frame parsing in internal pure functions. With two static call sites, normal
`OP_DEFINE`/`OP_INVOKE` lowering shares these bodies while leaving the two
resource handler invocations statically visible to C2 analysis.

This compiled successfully and reduced the measurement to:

- artifact/redeem bytecode: approximately 10,569 bytes;
- complete token unlocking bytecode: 12,029 bytes.

This is sound in shape but insufficient on its own. It has not yet received the
full HiddenBatch/graph regression run.

Do not replace the two static parser/handler sites with a loop. That experiment
was tried and reverted: `LowerCollectionJournalHelpers` requires two statically
visible fixed-batch invocations, and the loop correctly failed closed with
`SortedMappingCodegenPendingError`.

### Duplicate resource/graph clone removal

The latest, not-yet-tested one-line change skips creation of
`__scb_graph_transferFrom` when the same source handler already produced
`__scb_resource_transferFrom`.

Before this change, resource-shaped graph-tail handlers were cloned twice even
though dispatch uses the resource clone. This may remove a complete unused
journal-handler body and is the most promising immediate saving.

Run the measurement before making further changes. If it does not materially
reduce the artifact, inspect whether unreachable internal functions are already
pruned and then remove/revert the ineffective line.

## Exact next commands

```bash
cd /Code/cashscript/.worktrees/layer3-binding-spike
yarn workspace solidc build
yarn workspace solidcash build
yarn workspace solidcash test Layer3CompiledGraphController.test.ts \
  -t 'ERC-20|allowance spender'
```

Read `ALLOWANCE_SIZE` and the BCH-2026 trace. Required outcome:

- honest path resolves;
- hostile caller-witness substitution rejects for a covenant reason;
- every input is at most 10,000 bytes.

If the size crosses the limit, remove all temporary logging and run:

```bash
yarn workspace solidc test HiddenBatch.test.ts
yarn workspace solidcash test Layer3CompiledGraph.test.ts
yarn workspace solidcash test Layer3CompiledGraphController.test.ts
yarn workspace solidcash test RepeatedExternalBatchCorpus.test.ts
yarn workspace solidc build
yarn workspace solidcash build
yarn lint
git diff --check
```

Also add a focused compiler regression proving:

- resource+graph-tail synthesis contains only one handler clone;
- parser helper factoring does not change row count, exact exhaustion,
  positional SCB1 binding, caller cursor exhaustion, or unknown-selector
  rejection;
- the measured honest token input remains below 10,000 bytes with a small
  explicit headroom budget, rather than merely below it accidentally.

Commit compiler factoring and the VM fixture separately with detailed messages.

## If the duplicate-clone removal is insufficient

Proceed in this order:

1. Measure generated function-body sizes and confirm which bodies remain in the
   final artifact. Do not optimize from source length.
2. Share the direct public `transferFrom` implementation with the internal
   journal handler. Today the source entry point and the synthesized resource
   clone may retain equivalent state logic. The safe architecture is:
   - one value-threaded internal journal handler;
   - a direct public wrapper which loads/authenticates C2 entries, invokes it
     once, and flushes once;
   - the SCB1 wrapper which loads/authenticates the same entries, invokes it
     twice, and flushes once.
3. Preserve direct-route byte-identical behavior with a regression. The direct
   and graph wrappers may differ, but their single-row state transition must be
   identical.
4. Only after code sharing is exhausted, consider reducing graph witness size.
   Any projection/Merkle redesign changes covenant authentication and must not
   be smuggled in as a byte optimization.

Do not solve the size problem by:

- changing `msg.sender` back to a user parameter;
- dropping allowance or balance checks;
- relying on the relaxed mock VM;
- marking the positive test as skipped while claiming the ledger item proven;
- permitting oversized artifacts through an SDK-only warning;
- moving fixed-batch handler calls into dynamic control flow that C2 cannot
  analyze.

## Remaining broader work after this milestone

The implementation ledger still has gaps beyond ERC-20:

1. remaining handler/result/callback and resource/effect/event combinations;
2. general compiler auto-derivation of graph edges and relocatable balanced
   composition;
3. general transcript/version-retention and measured encoding limits;
4. BCH-2026 standard-policy, corpus byte budgets, contention, and immutable
   version-interoperability gates;
5. final requirement-by-requirement completion audit.

Do not state that the entire message-bus specification is implemented until the
ledger is re-audited against executable evidence for each normative item.
