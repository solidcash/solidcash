# Opus handoff: Effective Acceleration marketplace on native BCH

## Worktree — use this exact checkout

```text
/Code/cashscript/.worktrees/effectiveacceleration-marketplace
```

```text
branch: codex/effectiveacceleration-marketplace
HEAD:   35cef2a4
```

Do not work in `/Code/cashscript`. The worktree above is intentionally dirty and contains the accumulated implementation. Preserve all existing edits.

## Objective and constraints

Make this test compile and run unchanged, natively on BCH:

```text
/Code/effectiveacceleration.ai/contract/.marketplace/project/test/marketplace.test.ts
```

The project is exposed inside the worktree as `.marketplace/project`.

- Do not modify marketplace contracts or tests.
- The user temporarily permits bypassing consensus checks for input count/size and transaction size; the mock provider has the configuration.
- Ignore pre-existing `solidcash_v0.13.1` test failures; they are being fixed elsewhere.
- Compiler implementation changes are not represented in the project cache key. Move `.marketplace/cache/solidcash` aside before recompiling after compiler edits.

## Current status (2026-08-06)

The focused unchanged `post job 1` test constructs the complete transaction and reaches final BCH VM preflight. Its current failure is:

```text
messageBus: BCH-2026 preflight failed at input 3:
Program failed an OP_VERIFY operation.
```

Earlier failures involving proxy/delegate resolution, repeated logical calls, route argument counts, missing low-level unlockers, invalid VM numbers, incorrect delegate trailing-block bases, and delegate-route dynamic-state metadata contamination have been cleared.

The generated `MarketplaceDataV1.delegateArtifact.messageBus.route` has now been verified to contain no `dynamicReads` or `dynamicWrites`. The route executes far enough to expose a new stack-frame bug described below.

## Latest diagnosis and immediate next patch

The nested delegate implementation is input `108`; its proxy master is input `6`. The generated delegate prologue originally enforced ordinary delegate adjacency:

```text
proxyMasterIndex == OP_INPUTINDEX - (1 + dataNftCount)
```

That is invalid for compiler-owned message-bus routes because the implementation follows the complete 102-input proxy block. `GenerateTargetTraversal.ts` now skips only this adjacency equation for `node.messageBusRoute`, while retaining proxy minting capability, locking-bytecode preservation, and proxy/delegate inequality checks. An explicit `OP_DROP` was also added because the skipped equation normally consumed a duplicated proxy index. The existing `X1DelegateSlotAdjacency.test.ts` suite still passes 8/8.

The current concise trace reaches the route body, then an outlined preservation helper compares the nested implementation locking bytecode at input `108` against root Marketplace output `3`. The helper is preserving index `3`, even though SDK encoding proves `__internal__proxyMasterIndex` was passed as `6n`:

```text
delegate-encoded-args {
  groupLocalIdx: 1,
  functionName: '__message_bus1',
  masterInputIndex: 108,
  { name: '__internal__proxyMasterIndex', type: 'bigint', value: 6n }
}
```

The likely cause is now localized to positional message-bus frame removal.

`createCompilerRouteUnlocker` in `packages/solidcash/src/Contract.ts` detects routes whose final ABI input is `__internal__proxyMasterIndex`. Since unlocking arguments are reversed, it inserts the positional batch blob and empty message-envelope placeholder after the first pushed argument. The physical stack bottom is therefore:

```text
proxyMasterIndex, positionalBlob, envelopePlaceholder, remaining reversed args...
```

But `GenerateTargetTraversal.visitFunctionDefinition` removes two positional values with:

```text
OP_DEPTH OP_1SUB OP_ROLL OP_DROP
```

twice. That removes the physical bottom twice, dropping the proxy witness first. Later bottom-relative access reads another ABI value (`3`) as `__internal__proxyMasterIndex`.

Patch the message-bus positional removal so delegate routes preserving a bottom proxy witness remove the item immediately above the bottom twice:

```text
OP_DEPTH OP_2 OP_SUB OP_ROLL OP_DROP
```

For non-delegate routes retain the existing bottom-item removal:

```text
OP_DEPTH OP_1SUB OP_ROLL OP_DROP
```

A suitable condition is that the final parameter is named `__internal__proxyMasterIndex` and the function is delegate-marked/currently delegate. The compiler stack tracker intentionally excludes both positional values, so this removal remains untracked.

After applying the patch, rebuild `solidc`, move the SolidCash project cache aside, compile, and rerun the focused unchanged test.

## Focused validation

From the worktree:

```bash
env NODE_OPTIONS=--max-old-space-size=3072 \
  node node_modules/vitest/vitest.mjs run \
  --config vitest.solidhat.config.ts --no-file-parallelism -t 'post job 1'
```

For the route trace:

```bash
SOLIDC_DEBUG_ROUTE_CONCISE=1 NODE_OPTIONS=--max-old-space-size=3072 \
  node node_modules/vitest/vitest.mjs run \
  --config vitest.solidhat.config.ts --no-file-parallelism -t 'post job 1' \
  2>&1 | rg 'progressive-route-entries' -A80
```

If piping through `tail` or `rg`, remember the pipeline status may report the filter's success rather than Vitest's failure.

After a compiler change, force a fresh compile:

```bash
yarn workspace solidc build
mv .marketplace/cache/solidcash /tmp/marketplace-cache-<unique-name>
node packages/solidhat/dist/cli.js compile --config solidcash.config.ts
```

## Important fixes already present

- Compiler route metadata now carries `logicalSelectors`.
- Duplicate logical calls covered by an existing physical compiler route no longer overwrite/replan it.
- Proxy route selection uses the implementation target function rather than proxy `__forward` metadata.
- Proxy external child unlocking uses proxy `__forward`; the compiler route unlocker belongs to the implementation.
- Low-level delegate function selection uses the compiler route ABI function when appropriate.
- Proxied return/state derivation probes the implementation master input.
- Delegate route positional blob/envelope placement preserves the proxy master argument at the physical bottom of the declared frame.
- Delegate message-bus route trailing-block calculation now uses the proxy/master input base rather than the implementation input index.
- Delegate message-bus admission now excludes handlers reaching dynamic storage, preventing refused handlers from leaking route-wide dynamic settlement metadata.
- Automatic delegate marking happens before early message-bus synthesis, with the late marking pass retained additively.
- The final transaction byte gate permits non-relayable size only when the provider advertises `maximumTransactionBytes > 100_000`.
- Shared outlining treats `OP_INVOKE` as a barrier; message-bus blob handling supports the required larger stack item.

Do not revert these while continuing from the delegate-route fix.

## Temporary diagnostics to remove before completion

At least these traces are diagnostic-only:

- `delegate-function-selection` in `StatefulContract.ts`
- `nested-batch-entry-lock` in `StatefulContract.ts`
- `stateful-inputs-missing-unlockers` in `StatefulTransactionBuilder.ts`
- temporary tracing in `message-bus/preflight.ts`
- `external-dynamic-plan` and `append-dynamic-chunks` in `StatefulTransactionBuilder.ts`
- `route-probe-output-window`, `route-entry-output-window`, and `route-entry-libauth-output-44` in `StatefulContract.ts`
- existing `SOLIDC_DEBUG_ROUTE*` logging added during this work, unless it is deliberately retained behind clean debug gates

## Modified files

At handoff, `git status --short` reports changes in:

```text
HANDOFF_OPUS.md
packages/solidc/src/compiler.ts
packages/solidc/src/generation/GenerateTargetTraversal.ts
packages/solidc/test/DelegateInference.test.ts
packages/solidcash/src/Contract.ts
packages/solidcash/src/message-bus/graph.ts
packages/solidcash/src/message-bus/preflight.ts
packages/solidcash/src/stateful/StatefulContract.ts
packages/solidcash/src/stateful/StatefulTransactionBuilder.ts
packages/utils/src/artifact.ts
packages/utils/src/outline.ts
packages/utils/test/outline.test.ts
solidcash.config.ts
```

## Completion sequence

## 2026-08-07 latest continuation status

- Worktree remains `/Code/cashscript/.worktrees/effectiveacceleration-marketplace` on
  `codex/effectiveacceleration-marketplace`.
- Root compiler-route delegates now materialize the complete route block before the implementation. The focused
  publish call has route `blockSize=102`; both the proxy witness and the builder now agree that the MarketplaceV1
  implementation is input `102` (previously witness `102`, physical input `187`, and originally both were `3`).
- This is implemented by selecting the compiler route's layout as the proxy's effective block layout and the new
  `compilerRouteDelegateBlock` builder mode. Ordinary delegate adjacency remains unchanged.
- A fresh zero-cache marketplace compile completed after these changes. `yarn workspace solidc build` and
  `yarn workspace solidcash build` pass.
- The unchanged focused `post job 1` still fails BCH preflight at input `102`. The proxy input now passes, so this
  is inside the MarketplaceV1 implementation route. The VM objection is OP_VERIFY; debug reports an outlined
  program with `instructionCount=6923`, failing after `OP_NUMEQUALVERIFY` at local `ip=112`, comparing empty/zero
  against script number `0x63` (99). A locking bytecode `17a914323844...87` is directly below those count values.
  This now looks like a route count/frame selection error, not physical delegate placement.
- `GenerateTargetTraversal`'s ordinary adjacency guard was made robust to both `node.messageBusRoute` and
  `this.currentFunction.messageBusRoute`. Compile instrumentation confirmed Marketplace `__message_bus1` has both
  flags true; the remaining `0 vs 99` comparison is therefore not that prologue adjacency equation.
- Remove no marketplace files: `.marketplace/project/test/marketplace.test.ts` and marketplace sources remain
  unchanged.

Next: map the outlined 6923-instruction helper/count check to its generator (likely a route-wide UTXO-count or
frame PICK), correct its bottom-relative tracked selection for delegate routes, then rerun the focused test.

1. Fix delegate-route positional removal so it preserves the bottom proxy-master witness.
2. Build `solidc`, force a fresh marketplace compile, and rerun focused unchanged `post job 1`.
3. Continue from any newly exposed VM failure until the focused test passes.
4. Run the full unchanged marketplace test file.
5. Remove temporary diagnostics.
6. Run relevant package builds/tests and `git diff --check`.
7. Ignore only the user-approved unrelated `solidcash_v0.13.1` baseline failures.

Do not declare completion merely because transaction construction succeeds; the unchanged marketplace test must pass BCH preflight and execution.

---

## Session update (2026-08-07): two fixes landed, failure moved twice

Starting point this session: the focused `post job 1` test failed at input 3 (fixture setup). It now gets all
the way through fixture setup and into `publishJobPost` with NO diagnostic bypasses. The composition is real:
`route-inputs` shows `MarketplaceDataV1.__message_bus1` at input 105 and `FakeToken.__message_bus1` at 208.

The "immediate next patch" described earlier in this file (positional removal,
`OP_DEPTH OP_2 OP_SUB OP_ROLL OP_DROP`) was ALREADY APPLIED when I picked this up. Do not re-apply it.

### Landed: 654e813f - adjacency exemption for batch-originating delegates

`MarketplaceV1.publishJobPost` runs at input 102 while its proxy master is input 0, because the SDK lays out the
caller's proxy block, then the route composition, then the implementation. The prologue's
`proxyMasterIndex == OP_INPUTINDEX - (1 + dataNftCount)` therefore compared `0` against `99` and failed. The
route function was already exempt for exactly this reason; the exemption now also covers the function that
BUILDS the batch, scoped to `slot.batchInvocations.length > 1` so ordinary delegates keep the positional
binding. Minting-capability, LBC self-preservation and proxy-not-delegate checks all still run.

### Landed: 7318ea89 - EVM zero address encodes as `address(0)`

`address(0)` compiles to EMPTY bytes (a BCH address is a variable-length locking bytecode; the zero address has
no script). ethers passes `ethers.ZeroAddress` as 20 zero bytes, so `arbitrator_ != address(0)` was TRUE and the
value was then decoded as a locking bytecode. `Argument.ts` now normalises an all-zero hex address to empty
bytes. Confirmed in the trace: the 20 zero bytes became the empty item the covenant expects.

### Current failure: empty memory slot in `checkParams`

```text
messageBus: BCH-2026 preflight failed at input 102:
OP_SPLIT with an invalid index. stack item length: 0; requested split index: 1
```

Input 102 is `MarketplaceV1.publishJobPost`; the first thing it does is
`checkParams(title_, tags_, amount_, arbitrator_, msg.sender)`. The trace shows the caller push a 2-byte helper
id `b681` and `OP_INVOKE` a SIX-instruction body `OP_DROP OP_1 OP_SPLIT ...`, entered with `<0x20> <empty>` on
top. `0x20` is the memory word size, so this is a memory read decoding a length prefix from an EMPTY slot.

`checkParams` takes `string memory title_` while `publishJobPost` declares `string calldata title_`, so the
suspect is the calldata->memory materialization of that string (the `__yulmem` buffer). The ARGUMENTS
themselves are correct - `delegate-encoded-args` shows `title_` = 'Create a marketplace in solidity',
`amount_` = 100000000000000000000n, `tags_` = ['DV'] - so this is not an argument-passing problem.

### Baselines (measured, do not chase)

`yarn test:fast`: 15 failures across 6 COMPILER test files - `ExternalCalls`, `InlineAssemblyYul`,
`generation/generation`, `journal-message-bus/MessageBusVerifierSize`, `journal-message-bus/ScalarJournal`,
`solidity-compat/yul-evm`. Verified pre-existing by disabling the new adjacency condition IN PLACE and
re-running: identical 15/6. `UpgradesDeployProxy` has 2 pre-existing failures, likewise verified.

TRAP that cost me a cycle: `git stash push <path>` on an ALREADY-COMMITTED file stashes nothing and a following
`git stash pop` then pops the USER'S stash (`user WIP bytecode/parser work`). Verify a baseline by editing the
condition in place, not by stashing. The user's stash entry is intact.

### Diagnostic added

`SOLIDC_DEBUG_ROUTE_INPUTS=1` prints `route-inputs`: the contract and function behind every co-spent input,
with the failing index starred. Essential here - the composition places participants far from their proxies.

### Current failure, identified to the emitter

The six-instruction body is NOT hand-written code: it is the `OP_PUSHDATA1` branch of the pushdata decode
subroutine in `GenerateTargetTraversal.ts` (~2878):

```text
OP_DROP OP_1 OP_SPLIT OP_SWAP <0x00> OP_CAT     // exactly 6 elements
```

That span is byte-identical to the `OP_PUSHDATA2` branch's shape and gets OUTLINED into a shared helper
(invoked here as id `b681`), which is why the failing body is six instructions rather than the whole decoder.

Semantics: the decoder saw a leading `0x4c` (PUSHDATA1), dropped it, and tried to split off the 1-byte length -
but nothing followed. So the value being decoded is an EMPTY or TRUNCATED pushdata blob.

NOT caused by the zero-address fix: the identical failure (same input 102, same `instructionCount: 6`, same
`ip: 3`) was present before that change, when `arbitrator_` was still 20 zero bytes.

Next question to answer, by instrumentation: WHICH value reaches the pushdata decoder empty. The decoder is
used for reading pushdata-encoded state/memory values, and the stack carries `0x20` (the memory word size)
directly beneath, so a `__yulmem` read is the leading candidate - consistent with `checkParams` taking
`string memory title_` from `publishJobPost`'s `string calldata title_`. Confirm which read it is before
changing anything; the arguments themselves are verified correct.

The decoder is `emitIntDecodeSubroutine` (GTT ~2824): "returns [raw_bytes, remainder]... Handles OP_0,
OP_1NEGATE, OP_1-OP_16, PUSHDATA1/2, and standard pushdata (1-75)". It decodes successive pushdata-encoded
fields out of a STATE COMMITMENT blob, each call consuming one field and returning the remainder.

An EMPTY blob therefore means the decode ran PAST THE END of the commitment: the implementation is reading more
state fields than the co-spent commitment actually carries. Input 102 is the implementation executing in the
PROXY's state context, and the proxy's data NFTs are inputs 1-2 (`DataNft_cb3a64c1`). So the concrete next
check is: how many fields does `MarketplaceV1`'s state layout expect, versus how many the proxy's commitment
holds at inputs 1/2 - i.e. a proxy/implementation state-layout width mismatch, not a memory problem.

(Supersedes the `__yulmem` guess above: `0x20` on the stack is incidental, the decoder is a state reader.)

---

## Session update (2026-08-07, later): the nested route now returns real values

### Landed: 2b8d0866 - compiler-route delegate block gets its own input/output frames

Root cause of BOTH remaining symptoms was one thing: `nestedMasterIndices` in `StatefulContract.ts`
(~11040) is a DENSE frame - one input per resource - and under `compilerRouteDelegateBlock` neither the
input nor the output layout is dense.

Measured physical layout for the focused `post job 1` (`SOLIDC_DEBUG_ROUTE_INPUTS=1`):

```text
0        SolidCashProxy.__forward          (Marketplace proxy master)
1,2      DataNft_cb3a64c1                  (its state)
3..101   funders                           (route block padding, blockSize=102)
102..104 MarketplaceV1.publishJobPost      (low-level delegate group 0)
105      MarketplaceDataV1.__message_bus1  (low-level delegate group 1)
106..207 SolidCashProxy.__forward + block  (external group 0)
208..    FakeToken.__message_bus1          (external group 1)
```

`nestedMasterIndices[0]` was `6` (1 + 2 dataNfts + 3 delegate inputs). Two witnesses read it:

1. `__internal__proxyMasterIndex` = 6, so the route prologue
   (`OP_DEPTH OP_1SUB OP_PICK; OP_1 OP_ADD; OP_UTXOTOKENCOMMITMENT`) read an empty commitment and the
   pushdata decoder died at `OP_1 OP_SPLIT`. The base is now
   `lowLevelCallInputBase + all low-level inputs` = 106, and an associated delegate takes its rank in
   the contiguous implementation band (`_buildInputs` puts EVERY low-level input right after the block,
   ahead of the callee band - it does NOT interleave, unlike the legacy `delegateEntriesAfterLowLevel`
   path). `masterInputIndex` and `__internal__delegateInputIndex` follow the same band.
2. `physicalReturnIndexForGroup` = `nestedMasterIndices + returnSlot.offset` = 43, but an in-block
   return event is an OUTPUT offset. Output positions are NOT stretched by the block (funder slots
   produce no outputs), so a separate `nestedOutputBases` now gives 3 + 37 = 40. 43 was an ENTRY NFT
   whose leading 32 zero bytes decoded as an EMPTY return value rather than failing - that is where the
   "return event carries zeros" symptom came from. It was never a missing derivation step: phase-1
   return derivation DOES run for nested groups (`route-return-derivation` fires for both).

Legacy (non-route-block) layouts keep the established input-base reading, so nothing else moves.

### Regression evidence

`UpgradesDeployProxy` (2), `DelegateInferred` (6) and `X50DefaultProxyRegenerated` (2) fail IDENTICALLY
with the new frame disabled in place (temporary `SC_LEGACY_NESTED_FRAME` switch, since removed), so all
10 are pre-existing in this worktree - they come from the uncommitted compiler/`utils/outline.ts` WIP,
not from this change. The other 20 proxy/external-call e2e files pass.

### Current failure, and what it actually is

```text
messageBus: BCH-2026 preflight failed at input 102:
OP_SPLIT with an invalid index. stack item length: 23; requested split index: -41
```

Input 102 is `MarketplaceV1.publishJobPost` inside `checkParams`. It now reads output 40 (the real
return event), unwraps the route's outer `bytes`, skips one prior row's bool, and decodes - but the
blob content is wrong: `1976a914a55476015c13afb8afb92160329a8cde976f1f2e88ac` = `abi.encode(<the
MarketplaceData owner address>)`, not the packed `[bool][string][bool]` row results.

That value comes from `extractPendingReturnCommitment` (`StatefulContract.ts` ~735), the FALLBACK the
return derivation takes when the primary extraction finds nothing. It scans the last 32 trace steps for
any canonical-pushdata stack item, and here it grabbed the owner address off an aborted probe. The same
heuristic gives FakeToken `1976a914c4841b...88ac` (user1's address) - also implausible as a
`balanceOf`/`approve` result. The heuristic fires wrongly and should fail loudly instead.

The reason the primary extraction finds nothing: the group-0 probe ABORTS before the return-event
comparison, inside row 0 of the batch. `progressive-route-entries` shows `revealed: []` and the abort
is an `OP_EQUALVERIFY` of `aa20953ccfa596...87` (a balanced-slot placeholder at block slot 8, input
114) against `aa20a2d9fabc...87` (an entry NFT lbc), with `9bd3de9500` (the `arbitratorRegistered`
selector) on the stack.

So: row 0 is `arbitratorRegistered(address(0))`. In source that call is CONDITIONAL -
`if (arbitrator_ != address(0))` - and `arbitrator_` IS the zero address in this test, so it must not
execute. The SDK batched it anyway (the artifact records `"occurrence": "conditional"`), the callee
route executes it, and proving `arbitrators[address(0)]` absent in a SORTED (C2) mapping needs the
bracketing entry co-spent, which is not there.

NEXT: this is the conditionally-executed-row soundness question the earlier notes flagged. Either the
SDK must not emit a row for a call whose guard is false off-chain (it already evaluates caller state -
`_evaluateExternalExpression`), or the route must carry the bracketing entry for an absent sorted key.
Confirm which by checking whether `arbitrators` is sorted in MarketplaceDataV1's `stateLayout.collections`
and whether the 7 co-spent EntryNfts include a bracketing pair for the empty key.

### The blocking check, pinned to a slot

The abort is an `OP_EQUALVERIFY` at block-layout INPUT offset 8. Entry offsets are `3 + slotIndex`, so
that is entry slot 5 of the route's 26. From `delegateArtifact.messageBus.route.entryAccesses`:

```text
slot 5 = { collection: 'users', keyParams: ['__message_bus_key_users_0_r0'],
           operations: ['read','write'], runtimeAliasPriorSlots: [0] }
```

The SDK co-spent entries at offsets 3,4,5,6,10,11,17 = slots 0,1,2,3,7,8,14
(`users_sender`, `arbitrators_sender`, `meceTags`, `jobEvents`, `userRatings`, `userReviews`,
`users_0_r2`). Slot 5 got a balanced-slot placeholder (`aa20953ccf...87`, no token), and the covenant
compared that against the entry-NFT lbc `aa20a2d9fabc...87`.

Note WHICH slots were skipped without complaint: 12-25 are all `operations: ['read']` alias slots.
Slots 5 and 6 are the only row-0 slots with `['read','write']`. So a read-only alias slot may stay a
placeholder, a write-capable one may not - and slot 5's key is
`__message_bus_key_users_0_r0` = `76a914` + 20 zero bytes + `88ac`, the zero-address FILLER the SDK
uses for unused row keys.

All six MarketplaceDataV1 collections are `sorted: true` (C2), so an absent key needs its bracketing
entry co-spent; a filler key has none.

Two candidate directions, not yet tested:
- Make the row-0 slot requirement selector-conditional in the generated route, so a row whose handler
  never touches `users` does not force slot 5 to be materialized. (The abort carries `9bd3de9500` =
  `arbitratorRegistered`, which reads `arbitrators` - slot 6 - not `users`.)
- Or stop emitting a batch row for a call whose off-chain guard is false (`"occurrence": "conditional"`
  is already in the artifact; `arbitrator_ == address(0)` here so the call must not run). CHECK FIRST
  whether the caller's `emitExternalBatchRowReturn` prior-row skip is guarded by the same condition -
  it iterates `physicalSlot.batchInvocations` STATICALLY by `logicalIndex`, so dropping a row would
  misalign every later row's decode unless that skip is conditional too.

### Diagnostics added this session (in `_logCovenantFailureTrace`)

`SOLIDC_TRACE_ITEMS` (stack items per step, default 4), `SOLIDC_TRACE_RING` (steps kept, default 520),
`SOLIDC_TRACE_COMMITMENT` (commitment hex width, default 24). The trace now also prints push DATA per
instruction and the complete final stack - that is what identified the decoded values by content.
