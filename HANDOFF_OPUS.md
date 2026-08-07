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

The abort is an `OP_EQUALVERIFY` whose stack carries index `0x72` = 114, i.e. block offset 8 if that is
an input index (block base 106). Entry offsets are `3 + slotIndex`, which would make it entry slot 5.
TREAT THAT MAPPING AS UNCONFIRMED: the lbc the covenant expected is `aa20a2d9fabc...87`, which is the
ARBITRATORS entry address (input 110 = slot 1), not the `users` address slot 5 would need. Either the
index on the stack is not the one used in the comparison, or the check belongs to slot 6
(`arbitrators_0_r0`). Establish which before acting. From
`delegateArtifact.messageBus.route.entryAccesses`:

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


### Entry-resolution measurements (`SOLIDC_DEBUG_ROUTE_CONCISE=1` -> `nested-entry-resolution`)

Live C2 lists at the time of the call:

```text
users        slots: 0000..(head), 3e16384e..(user1)
arbitrators  slots: 0000..(head)            <- only the head
```

Keys the SDK computed:

```text
users_sender_0      479d2968..   (msg.sender for the CALLEE is the CALLER CONTRACT's lbc, not user1)
users_0_r0          75def5fc..   (the zero-address filler 76a914+20 zero bytes+88ac)
users_0_r2          3e16384e..   (real: user1)
arbitrators_0_r0    75def5fc..   (same filler)
```

So `users_0_r0` (75def5fc) is ABSENT and its predecessor is `3e16384e` - the SAME UTXO
`users_0_r2` needs, and the same one `users_sender_0` (479d2968, also absent) resolves to. Three slots
want one entry UTXO and it can only be co-spent once; `runtimeAliasPriorSlots` exists for exactly this,
which is why some row slots legitimately stay placeholders. Whether the covenant agrees for a
WRITE-capable slot is the open question.


### THE CONFLICT, isolated (this is the concrete blocker)

Physical entry inputs actually placed in the callee block (all at the `users`/`arbitrators`/... entry
addresses, from the input dump):

```text
109  users        commitment 000000...   <- the HEAD sentinel   -> slot 0  (users_sender_0)
110  arbitrators  commitment 000000...   <- the HEAD sentinel   -> slot 1  (arbitrators_sender_0)
111  meceTags                                                   -> slot 2
112  jobEvents                                                  -> slot 3
113,114,115  aa20953ccf...  no token     <- balanced placeholders (slots 4,5,6)
116  userRatings                                                -> slot 7
117  userReviews                                                -> slot 8
123  users        commitment 3e16384e... <- user1's entry       -> slot 14 (users_0_r2)
```

`users` has exactly two live entries: the head `0000..` and user1 `3e16384e..`. Slot 5
(`users_0_r0`) has the absent filler key `75def5fc..`, whose bracketing predecessor is `3e16384e..` -
THE SAME UTXO slot 14 already consumes as its exact entry. One outpoint cannot be two inputs, so the
SDK left slot 5 a placeholder, and the covenant rejects the placeholder.

`runtimeAliasPriorSlots` is the escape hatch for exactly this, but slot 5 lists only `[0]` - the slot
holding the HEAD - not slot 14, which holds the UTXO it actually needs. The static prior-slot list is
computed from key SHAPES; the collision here is between a resolved-at-runtime predecessor and an exact
entry.

Two candidate resolutions:
- Make the alias admissible against whichever slot carries the needed entry (resolved UTXO), not a
  statically enumerated prior-slot list.
- Or have the SDK pick don't-care row-key witnesses so they collapse onto a slot already present. Slot
  5 is don't-care for row 0: row 0 is `arbitratorRegistered`, which reads `arbitrators` (slot 6), not
  `users`. Today the SDK fills every per-row key witness from the row's address argument, so a row that
  never touches `users` still pins a `users` key.

Note slot 6 (`arbitrators_0_r0`, same filler key) has the SAME shape: its predecessor is the
`arbitrators` head, which slot 1 already consumes. So a fix must handle both.

### Verified pre-existing failures in this worktree (do not chase)

Measured by neutralising the new frame IN PLACE (temporary `SC_LEGACY_NESTED_FRAME` switch, removed
again) and re-running - identical failures both ways:

```text
test/e2e/DelegateInferred.test.ts          6
test/e2e/MsgSender.test.ts                 3   (A->B, A->B->C, A->{B,C})
test/e2e/UpgradesDeployProxy.test.ts       2
test/e2e/X50DefaultProxyRegenerated.test.ts 2
```

They come from the worktree's UNCOMMITTED compiler + `utils/outline.ts` WIP (the outliner now treats
`OP_INVOKE` as a barrier, so the shipped default-proxy artifact no longer equals a fresh compile), not
from any SDK change. 71 other proxy / external-call / C2 / sorted / cross-contract e2e files pass, plus
61 in the C2/Cross/Entry/Mapping/Sorted/Composability sweep.

Also note: `yarn workspace solidcash build` cannot be used to check out a single earlier version of
`StatefulContract.ts` for a baseline - HEAD's copy does not typecheck against the uncommitted
`StatefulTransactionBuilder.ts` (which now requires `compilerRoute.logicalSelectors`). Neutralise in
place instead.

### Falsified this session (do not re-derive)

Making an UNBOUND per-row key witness take its declared `runtimeAliasPriorSlots` value instead of the
zero address. Implemented and measured: every unbound `users_0_r*` / `arbitrators_0_r*` witness became
the sender key `a9147a4e...87` (verified in `repeated-route-witnesses`), and NOTHING changed -
`progressive-route-entries` still reveals nothing for both groups and the focused test fails at the
identical OP_SPLIT. Reverted. So the covenant's rejection of the placeholder at that entry slot is not
a key-equality mismatch, and the "slot 5 needs a UTXO slot 14 already holds" story is at best
incomplete. Find the actual failing check by mapping the aborting 18-instruction outlined helper back
to its emitter before trying another witness-side fix.

### The aborting frame, decoded (this supersedes the slot-5 guess)

`progressive-route-entries` now prints `abortingFrame` - the complete instruction list of the aborting
program, which is what the artifact cannot give you (outlined helper bodies are NOT in the artifact;
`functionBodies` holds only selector-keyed bodies and the contract script contains ZERO `OP_DEFINE`s -
the SDK assembles them at spend time, so offline decoding is a dead end).

Group 0's aborting frame, 18 instructions, fails at index 5:

```text
0:OP_ADD  1:OP_DUP  2:OP_UTXOBYTECODE  3:OP_2  4:OP_PICK  5:OP_EQUALVERIFY  <-- HERE
6:OP_SWAP 7:OP_DROP 8:OP_UTXOTOKENCOMMITMENT 9:<0x20> 10:OP_SPLIT 11:<0x20> 12:OP_SPLIT
13:OP_2 14:OP_PICK 15:OP_4 16:OP_PICK 17:OP_EQUAL
```

That is a C2 entry read: compute the slot's input index (`OP_ADD`), require that input's locking
bytecode to be the entry-NFT address, then split its commitment into the two 32-byte key/next fields.
The expected lbc is `aa20a2d9fabc...87` = the ARBITRATORS entry address, so the slot is **6**
(`arbitrators_0_r0`), not 5. Correct the earlier note accordingly.

### Why it cannot be satisfied as composed

Row 0 is `arbitratorRegistered(address(0))`. Slot 6's key is BOUND (the handler declares
`__message_bus_key_arbitrators_0`, `perRow`), so it is the zero address - absent from `arbitrators`.
The live `arbitrators` C2 list contains EXACTLY ONE entry, the head `0000..`, so slot 6's absence
bracket is the head. Slot 1 (`arbitrators_sender_0`, key = the caller's address, also absent) brackets
to the SAME head and already co-spends it. One outpoint cannot be two inputs.

`runtimeAliasPriorSlots: [1]` on slot 6 is the intended escape, but the covenant still demanded the
entry - so the alias condition is not satisfied by two DIFFERENT keys that happen to share a bracket.
That is why the alias-key-witness experiment above changed nothing: it only rewrote UNBOUND keys, and
this slot's key is bound.

So the remaining work is one of:
- Make the route's entry-slot alias condition accept "resolves to the same bracketing entry" rather
  than "same key". Compiler-side, in whatever emits this 18-instruction check.
- Or stop emitting a batch row for a call whose off-chain guard is false (`arbitrator_ != address(0)`
  is false here). Blocked as written: `emitExternalBatchRowReturn` skips prior rows' return fields
  STATICALLY by `logicalIndex`, so dropping a row misaligns every later row's decode. Dropping the row
  therefore needs a matching conditional skip on the caller side.

### Falsified: the entry index is NOT the delegate `OP_INPUTINDEX` branch

`emitEntryInputIndex` (GTT ~16669) has three branches, and `emitTrailingBlockBase` (~21899) documents
that for a message-bus route the fixed entry/event/return/trailing slots "all begin at the proxy
master". The delegate branch nevertheless computes `OP_INPUTINDEX + offset`, which for a route running
at input 105 with its block rooted at 106 is one short. Changed it to `emitMasterInputIndex()` when
`currentFunction.messageBusRoute`, rebuilt solidc, wiped `.marketplace/cache/solidcash` and recompiled
the whole project: the aborting frame and the failing index are BYTE-IDENTICAL (`0x72` = 114 both
ways). Reverted, and the project has been recompiled again with the reverted compiler so the artifacts
match source.

So the failing index comes from the `sortedBatchInfo` branch (`emitMasterInputIndex` + a picked
`__internal__c2BatchProof_<slot>`), not the delegate branch. But the witnesses the SDK supplies to the
MarketplaceDataV1 route are

```text
c2BatchProof_0=2 _1=3 _2=4 _3=3 _4=3 _5=7 _6=2 _7=3 _8=10
```

and with the proxy master at 106 those give 108,109,110,109,109,113,108,109,116 - NONE of them is 114.
So either the base for that site is not 106, or the index is built somewhere else again. Resolve that
before touching any emitter: print the index-producing instructions the same way `abortingFrame` prints
the aborting ones (the span begins mid-expression, at `OP_ADD`, because the outliner cut it there).

---

## Session update (2026-08-07, third pass): entry slots now address the right input

### Landed: 32eb5ea8 - a message-bus route's entry slots are rooted at the PROXY master

`emitEntryInputIndex`'s delegate branch emitted a bare `OP_INPUTINDEX` as the entry base. Correct for an
ordinary delegate (implementation-relative slots), wrong for a compiler-owned route, which is the
implementation of a PROXY-owned block - `emitTrailingBlockBase` already documents that its fixed entry /
event / return / trailing slots "all begin at the proxy master". The route runs at input 105 with its
block rooted at 106, so every entry read was one slot short: slot 6 (`arbitrators_0_r0`, offset 9) was
read at 114 instead of 115. Verified byte-level (`c059` = `OP_INPUTINDEX OP_9` is gone; the bottom-
relative proxy pick appears 376x) and at runtime (the failing index moved 114 -> 115).

Regression evidence: `yarn test:fast` reproduces the documented baseline EXACTLY (15 failures across the
same 6 compiler files); the 75-file SDK subset reproduces its 13 pre-existing failures in the same 4
files.

### TRAP that cost two attempts at this exact fix

**A test run does NOT recompile the marketplace project just because `.marketplace/cache/solidcash` was
removed.** Both earlier attempts looked like no-ops because the test loaded artifacts built by the
previous compiler. Always force

```bash
node packages/solidhat/dist/cli.js compile --config solidcash.config.ts
```

and ASSERT the emitted bytes changed before concluding anything about a codegen edit.

### The remaining blocker, now measured rather than inferred

New diagnostic `nested-entry-pick` (SOLIDC_DEBUG_ROUTE_CONCISE) prints what each entry slot resolves to.
For the MarketplaceData route:

```text
arbitrators routeSlot=1  key=b514c397(caller)  exists=false  picked=5734899c3659:5
arbitrators routeSlot=6  key=e3b0c442(zero)    exists=false  picked=5734899c3659:5   <-- SAME UTXO
arbitrators routeSlot=13,15,17,19,21,23,25     exists=false  picked=5734899c3659:5   <-- SAME UTXO
users       routeSlot=5,12,16,18,...           exists=false  picked=73217b2db2ec:6   <-- SAME UTXO
users       routeSlot=14 key=3e16384e(user1)   exists=true   picked=73217b2db2ec:8
```

`arbitrators` holds exactly one live entry (the head), so EVERY absent key brackets to it. The SDK
resolves each slot independently and hands the same outpoint to eight slots; one outpoint can be one
input, so all but the first end up as balanced placeholders - and the covenant's READ path rejects a
placeholder.

Note the asymmetry that makes this fixable: the WRITE path already has the runtime-alias gate
(GTT ~15030 - it compares the slot's locking bytecode to the entry covenant address and SKIPS the
physical upsert when the slot is a funder, "an inactive slot is authenticated later by predOut=-2 iff its
slot hash duplicates an allowed prior identity"). The READ path has no equivalent, so it hard-fails.

Two candidate directions:
- Compiler: give the read path the same alias gate, with the same soundness obligation - on the alias
  arm it must still be PROVEN that some co-spent prior slot's entry brackets this key, otherwise a
  spender could claim "absent" for a key that exists by pointing the slot at a funder.
- SDK: only resolve an entry co-spend for a slot whose key witness is actually BOUND by a row in this
  batch, so the contended UTXO goes to the slot that needs it. In this batch NO row binds
  `__message_bus_key_arbitrators_sender_0` (slot 1) while row 0 DOES bind
  `__message_bus_key_arbitrators_0_r0` (slot 6) - the bound set is exactly `keyWitnessValues` in
  `_buildRepeatedRouteCall` (~12960), which would have to be threaded into the block-composition loop
  (~10730).

### PROOF BY CONSTRUCTION: the remaining blocker is a route design gap, not an SDK bug

`arbitrators` holds exactly ONE live entry (the head). This batch needs absence proofs for TWO distinct
absent keys in it:

```text
route slot 1  arbitrators_sender_0  key b514c397 (the caller's logical address)  absent -> brackets the head
route slot 6  arbitrators_0_r0      key e3b0c442 (address(0), row 0's argument)  absent -> brackets the head
```

One outpoint cannot be two inputs. Both assignments were BUILT AND RUN:

- Default (first-come): slot 1 takes the head -> slot 6 is a placeholder -> abort reading slot 6 at input
  115 (`0x73`), the failure this file has been tracking.
- With an SDK gate that only claims an entry for a slot an admitted row actually keys: slot 6 takes the
  head -> slot 0 (`users_sender_0`) is a placeholder -> abort reading slot 0 at input 109 (`0x6d`),
  which proves the canonical msg.sender slot is read UNCONDITIONALLY, not selector-gated.
- With that gate plus "a msg.sender-keyed slot always counts as keyed": slot 1 wins again -> back to the
  first failure.

So no assignment of the single head entry satisfies the covenant. The gate was reverted; it trades one
failure for another and changes co-spend selection broadly for no gain.

The fix has to be on the covenant side: let a slot prove ABSENCE by reference to another slot's co-spent
bracketing entry, the read-path analogue of the write path's runtime-alias gate (GTT ~15030). The
soundness obligation is the same one the write path already carries - the alias arm must still PROVE that
some co-spent prior slot's entry brackets this key, or a spender could claim "absent" for a key that
exists by pointing the slot at a funder. The write path's note says an inactive slot "is authenticated
later by predOut=-2 iff its slot hash duplicates an allowed prior identity"; the read path needs the same
treatment, and `runtimeAliasPriorSlots` already publishes the admissible prior slots per slot.

### Landed: 1580d629 - a C2 READ may fall back to a co-spent aliased entry

The read path now walks the slot's published `runtimeAliasPriorSlots` and selects, at runtime, the first
that actually holds an entry of this collection (`emitSortedSetRead`, GTT ~14537). Soundness is
unchanged: the chosen input is still bytecode-verified as a genuine entry, presence still requires ITS
key to equal OUR H(k), absence still requires OUR H(k) strictly inside ITS bracket. Only WHICH co-spent
entry supplies the proof is decided at runtime. This is the read-path analogue of the write path's
existing gate (GTT ~15030).

Regression evidence: `yarn test:fast` reproduces the documented baseline exactly (15 / same 6 files); a
64-file C2 / sorted / cross-contract / delegate / proxy / upgrade sweep reproduces its 11 pre-existing
failures in the same 3 files.

### NEXT FRONTIER: chunkable C2 values read inside a route have no value witness

With the entry band passable, the group-0 probe now aborts much deeper, and the aborting frame is
byte-for-byte `emitChunkableValueRead` (GTT 14398-14413), lines 14406-14409:

```text
PICK __internal__valueWitness_<slot> ; OP_DUP ; OP_SHA256 ; OP_2 ; OP_PICK ; OP_EQUALVERIFY  <-- HERE
```

That is the LONG form (stored length > 60): the entry commitment holds `root32 || headData28` and the
covenant requires `sha256(valueWitness) == root`. Stack at the abort carries the row payload
`177472f2` + the encoded user1 address (row 2 = `userRegistered(msg.sender)`) and the expected root
`aa1bf43494482a8a22b636150fdd78fc...`.

`users` values are `User` structs - chunkable - and `users[user1]` EXISTS, so the read takes the present
arm and needs the witness. The nested composition fills `__internal__valueWitness_<n>` from
`entryValueWitnesses[n] ?? new Uint8Array()` (StatefulContract ~11455), and for a nested callee that
array is empty, so the witness defaults to EMPTY - `sha256('')` = `e3b0c442..`, which is not the root.

So the next step is: resolve the callee's chunk data for a chunkable C2 value the route READS, and pass
it as that slot's value witness. The caller-side machinery for its own entries already exists
(`entryValueWitnesses`); it has to be produced for nested route callees from the callee's chunk UTXOs.

NOTE the user-visible result is UNCHANGED - `post job 1` still reports the same
`OP_SPLIT ... index -41` at input 102, because the return blob still cannot be derived
(`progressive-route-entries` still reveals nothing). All of the movement above is inside the derivation
probe.

### Landed: 5e1b7163 - a route callee's chunkable C2 value witnesses are rebuilt from ITS chunks

The nested delegate arg fill sourced `__internal__valueWitness_N` from the CALLER's
`entryValueWitnesses`, which describes the caller's own collections and is empty for a route, so the
witness defaulted to EMPTY and `sha256('')` failed the covenant's root check. The block composition now
rebuilds each witness from the callee's chunk UTXOs and publishes it on the route's `internalArgs`
(which is now attached whenever any internal args exist, not only for a sorted-batch WRITE). Verified:
the reconstructed 241-byte `User` value reaches the covenant. Regression-clean over a 77-file sweep.

### NEXT FRONTIER (measured, not fixed)

The group-0 probe now aborts INSIDE the int-decode subroutine (69 instructions) on an EMPTY blob. Its
caller is a 5-instruction outlined helper:

```text
0: push <0x96>   (helper id -22)
1: OP_INVOKE
2: OP_1NEGATE    (helper id -1 = the pushdata int-decode)
3: OP_INVOKE
4: OP_DROP
```

`<decode> ; OP_DROP` is `emitPushdataDecodeLastField`'s generic branch, so a LAST field is being decoded
out of a blob that has already been exhausted. On the stack at that point are the two reconstructed
payloads: 243 bytes `4cf100 1976a914c4841b..` and 241 bytes `4cef00 1976a914c4841b..` - i.e. a
PUSHDATA1-wrapped value whose inner blob begins `00` (an EMPTY first field) followed by `19 76a914..`.

`userRegistered` reads `users[address_].publicKey.length`, so this is the `User` struct field walk
(`address_, publicKey, name, bio, avatar, reputationUp, reputationDown`). A leading EMPTY field suggests
the reconstructed value and the struct schema disagree by one field - check whether the witness should be
the RAW value or the value MINUS its length/head framing before the struct decode consumes it, and
whether `joinValueChunks`' head slice (`tail.slice(36, 64)`) is the right head for this collection.

The user-visible failure has moved with this: `post job 1` now reports
`OP_SPLIT ... stack item length: 0; requested split index: 1` (was `length: 23; index: -41`).

### The struct-framing discrepancy, pinned

`callerFrame` now walks UP the invoke chain (an outlined helper's caller is usually another helper, so one
level was not enough). For the group-0 abort the chain is:

```text
[count=69  ip=2]  the pushdata int-decode, failing OP_SPLIT on an EMPTY blob
[count=5   ip=3]  push<-22> INVOKE ; OP_1NEGATE INVOKE ; OP_DROP      = decode-last-field
[count=7   ip=1]  OP_1NEGATE INVOKE ; OP_SWAP                          = decode-field
[count=509 ip=31] ... OP_2 OP_PICK push<-302> INVOKE OP_DROP ; OP_2 OP_PICK OP_TOALTSTACK ;
                  OP_7 OP_PICK OP_9 OP_PICK OP_1NEGATE INVOKE OP_DROP OP_EQUAL OP_VERIFY ;
                  OP_1 OP_PICK push<-20> INVOKE ; push<-3> INVOKE ; OP_2 OP_PICK push<-21> INVOKE
[count=50  ip=47] ... push<-2> INVOKE
```

The 509-instruction body is a struct field walk: pick, decode field, compare, decode next.

The value it walks is the one my witness fix now supplies, and the trace shows it as
`4cef00 1976a914c4841b..` - a PUSHDATA1 of 239 bytes whose content begins

```text
00                                            <- field 0 decodes as EMPTY
19 76a914c4841b8f5e6f10a38dc5e672e1..88ac     <- field 1 is user1's 25-byte address
```

**RETRACTED - that reading of the trace was wrong.** The `00` sits in the PUSHDATA framing shown by the
trace, not in the value. `nested-value-witness` (new debug) dumps the reconstruction, and
`users[user1]` is perfectly well-formed - len=106, root matches, and it decodes exactly against the
`User` schema:

```text
19 76a914c4841b..88ac                       address_   = user1
21 02ba5734d8f7091719471e7f7ed6b9df17..     publicKey  = 33 bytes
08 5465737455736572                         name       = "TestUser"
07 5465737442696f                           bio        = "TestBio"
1a 68747470733a2f2f6578616d706c652e636f6d2f617661746172   avatar
00 00                                       reputationUp / reputationDown = 0
```

So the value witness path is CORRECT and the struct schema agrees with the stored bytes. Whatever the
decode runs off the end of, it is NOT this value. The blob on the stack at the abort is 241 bytes
(`4cf1` = PUSHDATA1 241) beginning `00 19 76a914..` - i.e. something that CONTAINS the address but is
much larger than the 106-byte `User`, so identify that blob before assuming anything about framing.
Candidates: the route's `__message_bus_results` accumulator, or a row-args blob.

### The blob identified: the `publishJobEvent` row's `event_` argument is mis-encoded

Widening the trace stack dump identifies it. The item is a pushdata-encoded `JobEventData`:

```text
outer  4c f1  (PUSHDATA1 241)   -> stack item is 243 bytes, consistent
inner  4c ef  (PUSHDATA1 239)   -> 239 bytes of struct payload
payload:
  00                                          type_    = 0  (JobEventType.Created)   1 byte
  19 76a914c4841b..88ac                       address_ = abi.encodePacked(msg.sender) 26 bytes
  4c d3 <211 bytes>                           data_                                   213 bytes
  <timestamp_>                                uint32
```

1 + 26 + 213 = 240 with `timestamp_` still to come, but the payload is only 239 bytes - `data_` declares
211 and only 210 follow. THAT is what makes `emitPushdataDecodeLastField` run off the end.

Inside `data_` the pieces are visible:

```text
20 "Create a marketplace in solidity"                         encodeString(title_), 32 chars - correct
30 78 61 30 62 31 ...  = ASCII "0xa0b16ada95e7d6bd78efb91c368a3bd6d3b0f6b77cd3f27664475522ee138ae5"
```

That second run is the contentHash rendered as its 66-character ASCII HEX STRING, not the 32 raw bytes -
`0x30` there is the ASCII '0' of "0x...", not a length prefix. So the SDK's expression evaluation for
`abi.encodePacked(contentHash_)` is treating an ethers `bytes32` hex string as UTF-8 text.

Next step, concretely: in `_evaluateExternalExpression`, the `abiEncodePacked` / `bytesConcat` arms that
build this `JobEventData` (the artifact records the whole expression tree under
`publishJobPost`'s `externalCalls[0].batchInvocations[3].argSources[1]`) must hex-decode a `0x`-prefixed
`bytes32` argument instead of UTF-8-encoding it, and the length prefix that comes out one short needs to
be re-derived once that is fixed. Compare against how the DIRECT (non-batch) external-call path encodes
the same struct - `publishJobEvent` also has a direct callsite.

### Landed: the bytesN hex-string fix - and the off-by-one that survives it

`asBytes` in `_evaluateExternalExpression` UTF-8-encoded an ethers `bytesN` hex string, so
`abi.encodePacked(contentHash_)` packed 66 ASCII characters instead of 32 bytes. Fixed; the row argument
went from 243 to 209 bytes and now carries the hash verbatim. Regression-clean over 71 files.

A SEPARATE off-by-one survives, and it was present before the hex fix too. The encoded `JobEventData`
still does not add up:

```text
outer 4c cf (207)  ->  item is 209 bytes                     consistent
inner 4c cd (205)  ->  205 bytes of struct payload
  00                          type_      1
  19 + 25 bytes               address_  26   (cum 27)
  4c b1 (177) + 177 bytes     data_    179   (cum 206)  <-- ALREADY 1 PAST the 205-byte payload
  <timestamp_>                                          <-- no room at all
```

`data_`'s pushdata prefix declares 177 while only 176 bytes follow it, so every later field decode runs
off the end - which is the `emitPushdataDecodeLastField` abort. The pieces INSIDE `data_` are individually
correct (`20` + the 32-char title, the 32-byte contentHash, `00` multipleApplicants, `01 02 4456` for
`["DV"]`, ...), so the defect is in the length prefix or a dropped tail byte, not in the parts.

Next: dump the SDK-side `event_` value (the struct-constructor array from `_evaluateExternalExpression`)
and each `bytes.concat` part's length just before `encodeFunctionArgument`, and compare the sum against
the emitted `data_` prefix. The `timestamp_` field is the likely suspect - check whether it is being
evaluated at all, since the payload has no room for it.


### The SDK's encoding is CORRECT - the malformed item appears later

`row-encoded-args` (new debug) dumps each batch row's encoded arguments. For `publishJobEvent`
(`a826ee9c`):

```text
raw values : [ 0, bytes(25), bytes(177), 0 ]      = (type_, address_, data_, timestamp_)
encoded    : 207 bytes  00 | 19+25 | 4cb1+177 | 00
             1 + 26 + 179 + 1 = 207   <- adds up exactly, all FOUR fields present
```

So the struct the SDK builds is well-formed, and `pushdataEncode` of it is the 209-byte stack item
(`4c cf` + 207) also seen in the trace - also correct.

The item that does NOT add up is the OTHER one on that stack: 207 bytes of `4c cd` + 205, i.e. a
205-byte payload carrying the first 205 bytes of the same struct with its prefix rewritten to match.
That is a re-encoding, not the SDK's original. Two bytes short is suggestive: `publishJobEvent` assigns
`event_.timestamp_ = uint32(block.timestamp)`, so the route rebuilds the struct with a real 4-byte
timestamp in place of the `00` the SDK sent, and the rebuild is where the length goes wrong.

So the next investigation is COVENANT-side, in the route's reconstruction of `event_` after it overwrites
`timestamp_` - not in `_evaluateExternalExpression` or `encodeFunctionArgument`, both of which are now
confirmed correct by measurement.


### It is a TRUNCATION BY EXACTLY 2 BYTES, not a rebuild

Comparing the two stack items in full (trace stack dump widened to 460 hex chars):

```text
209 bytes  4c cf | <207-byte payload> ...30303030 0000     the SDK's value, correct
207 bytes  4c cd | <205-byte payload> ...303030303030      common prefix with the above = 205 bytes
```

The 205-byte payload is byte-for-byte the FIRST 205 bytes of the 207-byte payload. Nothing is rebuilt or
reordered - the value is simply cut short by 2, losing `timestamp_` (`00`) and the last byte of `data_`,
and then re-wrapped with a prefix that matches the truncated length (`4c cd`).

Two bytes is exactly the size of a PUSHDATA1 header (`4c XX`). That is the signature to chase: something
unwraps the 209-byte item, and instead of `split 2, drop header -> 207` it ends up with `207 - 2 = 205` -
a header-size subtraction applied one time too many, or applied to the payload rather than the item.

This retargets the search again, and narrowly: it is NOT the struct schema, NOT the field order, NOT the
`timestamp_` overwrite rebuilding anything. Look for where the route unwraps a PUSHDATA1-framed `bytes`
argument (the `AbiDecodeAtNode{data=id:rowArgs,...}` extraction of `event_` from the row args is the prime
candidate) and check its header-size arithmetic against the >=76-byte PUSHDATA1 case. A value under 76
bytes uses a 1-byte header and would hide this bug entirely, which is consistent with every existing test
passing.

### Landed: 2f758516 - a composite ARGUMENT is pushdata-framed; `abi.decodeAt` now unframes it

Root cause of the truncation signature above. `visitAbiDecodeAt` used the INLINE convention for a
struct/array target (`emitPushdataDecodeLastField` hands a struct back as-is;
`emitPushdataDecode` walks the struct's own fields to measure it). That is right for a STATE COMMITMENT,
where a struct is stored unframed, and wrong for an argument list, where every element - composites
included - carries its own pushdata frame. The still-framed blob was handed on as the struct, so the
first field access decoded the frame's PUSHDATA1 header as field 0, consumed the whole payload, and the
next field decoded an empty remainder.

A composite under 76 bytes carries a 1-byte frame and hides this completely, which is why the whole
existing suite passes. The marketplace's `JobEventData` is 207 bytes.

Regression-clean: `yarn test:fast` matches the documented baseline exactly; a 68-file SDK sweep matches
its 11 pre-existing failures.

### Current frontier

The group-0 probe's abort has moved off the struct walk. Its error is now `OP_VERIFY` (was `OP_SPLIT` on
a zero-length item) and the aborting frame is the 17-instruction C2 entry read:

```text
OP_DUP OP_UTXOBYTECODE OP_2 OP_PICK OP_EQUALVERIFY   <- the slot's locking bytecode check
OP_SWAP OP_DROP OP_UTXOTOKENCOMMITMENT <0x20> OP_SPLIT <0x20> OP_SPLIT OP_2 OP_PICK OP_4 OP_PICK OP_EQUAL
```

so an entry slot's input is again not the entry covenant the covenant expects - most likely the
`jobEvents` slot that `publishJobEvent`'s WRITE needs, since the three getter rows are now getting
through. `progressive-route-entries` still reveals nothing, so the return blob is still underived and
the user-visible failure is unchanged.

Use `nested-entry-pick` to see which slot resolves to what, and `abortingFrame`/`callerFrame` to confirm
which collection's address is on the stack at the EQUALVERIFY - that names the slot directly.

### THE STRUCTURAL FINDING: block addressing is unreachable from inside an OP_DEFINE'd sub-body

The abort after the unframe fix is entry slot 3 (`jobEvents`, the one `publishJobEvent`'s WRITE needs).
The caller chain names the emitter exactly:

```text
[count=509 ip=123]
  112: OP_INPUTINDEX  113: OP_UTXOTOKENCATEGORY  114: <0x20>  115: OP_SPLIT  116: OP_DROP
  117: push<-12>      118: OP_INVOKE                                  = emitSortedEntryAddress
  119: OP_INPUTINDEX  120: OP_6  121: OP_ADD                          = the entry slot index
  122: push<-242>     123: OP_INVOKE                                  = the 17-op C2 entry read
```

Both bases are a bare `OP_INPUTINDEX`, i.e. `emitMasterInputIndex` took its non-delegate arm. The route
runs at input 105 while its block is rooted at 106, so slot 3 is read at 111 where the block puts it at
112 - the SAME off-by-one 32eb5ea8 fixed for `emitEntryInputIndex`'s delegate branch, at a different
emitter.

**But it is not fixable the same way.** `emitMasterInputIndex` already prefers the proxy witness whenever
the executing FRAME carries it (that condition is in HEAD). It did not fire here, and the reason is
structural: this code is emitted inside an OP_DEFINE'd sub-body, where the tracked stack is the
SUBROUTINE's frame, not the route's ABI frame - `getStackIndex('__internal__proxyMasterIndex')` returns
-1, and `emitPickTrackedFromBottom`'s OP_DEPTH-relative addressing would be wrong there even if it did
not.

So a compiler-owned route CANNOT address its proxy-rooted block from inside any outlined / OP_DEFINE'd
body. That is the real remaining defect, and it is a design-level one: the proxy master index has to
reach those bodies - passed as a subroutine parameter, carried on the altstack across the invoke, or the
affected reads kept out of shared bodies. Every entry/event/return/trailing addressing bug this session
chased is an instance of it; fixing it at the source should close the class rather than one site at a
time.

An experiment preferring the witness frame-wide was run and produced byte-identical bytecode (the
condition cannot fire in a sub-body), so it is a no-op for this path, not a fix.

### Landed: d86e219d - the structural addressing gap is closed

The gap described above is fixed. `emitMasterInputIndex` now reaches the proxy-master witness from inside
a route-owned OP_DEFINE'd helper:

- OP_INVOKE runs a body on the SAME stack, so the route's ABI frame is still at the bottom inside a
  helper; only the per-body tracked model has lost sight of it.
- Unlocking arguments are reversed, so the route's final ABI parameter (the witness) is pushed FIRST and
  sits at the frame's PHYSICAL BOTTOM - exactly what the route prologue already reads with
  `OP_DEPTH OP_1SUB OP_PICK`. Helpers now read it the same way.
- Decided at CONTRACT level (a helper can be emitted before the route) and keyed on the WITNESS
  PARAMETER, not the DELEGATE modifier: measured, the route reports `external` during code generation
  while the artifact later shows `external,delegate`, so gating on the modifier never fires.

`SOLIDC_DEBUG_MASTER_BASE=1` prints every `emitMasterInputIndex` fallback with its function, modifiers and
`isDefineSubTraversal` - that is what identified the helper set (`__message_bus_entry_*`,
`__message_bus_handler_*`, `__message_bus_resource_*`, all `internal`, all `defineSub=true`, and ZERO
delegate-marked among them).

Effect: ~2400 fallback sites removed in the marketplace route; `OP_INPUTINDEX OP_6 OP_ADD` for the
`jobEvents` slot drops to 2 occurrences and 424 depth-1 picks appear. Regression-clean on both sides.

It does NOT make the test pass. The group-0 probe still aborts with `OP_VERIFY` and still reveals no
entry commitments, so the return blob stays underived and input 102 still reports the same
`OP_SPLIT ... length 0, index 1`. The next step is to re-run the frame chain (`callerFrame`) against the
NEW bytecode - the previous chain readings are stale now that 400+ bases moved - and identify which check
fails with the corrected addressing.

### Three follow-up attempts, all byte-identical - STOP AND MEASURE BEFORE THE NEXT ONE

After d86e219d the `jobEvents` entry read still emits `OP_INPUTINDEX OP_6 OP_ADD`. Three further changes
were made, compiled, and the emitted bytes compared - ALL THREE produced artifacts byte-identical to
d86e219d (`c05693` stayed at 2 occurrences, depth-picks stayed at 424). All were reverted:

1. Dropping the `__message_bus*` name gate in `emitMasterInputIndex`'s ordinal branch, on the theory that
   a route also emits its SOURCE handlers (`publishJobEvent`) as helper bodies.
2. Restructuring `emitMasterInputIndex` so the contract-level ordinal is consulted before the
   `currentFunctionIsDelegate` pick (which needs the witness in the per-body tracked model).
3. Widening `emitEntryInputIndex`'s delegate-branch admission from `currentFunction.messageBusRoute` to
   also accept `routeProxyMasterBottomOrdinal !== undefined`.

Byte-identical across all three means those two remaining sites are reached through NEITHER
`emitMasterInputIndex` NOR `emitEntryInputIndex`, and/or `routeProxyMasterBottomOrdinal` is UNDEFINED in
the compile that emits them - the contract-level probe
(`fn.messageBusRoute && fn.parameters.at(-1)?.name === '__internal__proxyMasterIndex'`) may run before the
witness parameter is injected.

DO NOT guess at a fourth variant. Establish first, with `SOLIDC_DEBUG_MASTER_BASE=1` plus a similar probe
on `emitEntryInputIndex`/`emitBlockSlotIndex`, (a) which emitter writes those two `OP_INPUTINDEX OP_6
OP_ADD` sequences, and (b) whether `routeProxyMasterBottomOrdinal` is set in that compile at that moment.
Both are one instrumented compile away; three uninstrumented attempts produced nothing.

### The two facts, measured (as this file instructed) - and what they show

`SOLIDC_DEBUG_ENTRY_SITE=1` prints every entry-slot base emission with its emitter, function, offset,
`routeProxyMasterBottomOrdinal` and the tracked-witness index.

```text
via                  fn              offset  ordinal    trackedWitness  flag
emitBlockSlotIndex   __message_bus1    6      undefined      -1          isDelegate=false   x78
emitEntryInputIndex  __message_bus1    8/9    undefined      90          mbRoute=true       x48
```

(a) The failing base comes from **`emitBlockSlotIndex`**, not `emitEntryInputIndex`, in a compile where
`currentFunctionIsDelegate` is FALSE and the witness is NOT on the frame.
(b) `routeProxyMasterBottomOrdinal` is `undefined` EVERYWHERE - the contract-level probe on the route's
parameter list never matched, because the witness parameter is not on the node at `visitContract` time.

A self-capturing variant (learn the ordinal from any emission that CAN still see the witness, reuse it in
bodies that cannot) was implemented and compiled: **byte-identical across the WHOLE artifact**
(`c05693` 10 -> 10, depth-picks 855 -> 855). Reverted.

MEASUREMENT CORRECTION worth carrying: count these patterns across `delegateArtifact.bytecode` AND every
`functionBodies` value. Counting only `functionBodies['53434231']` sees 2 of the 10 occurrences - the
OP_DEFINE'd helper bodies live in the contract-level bytecode.

### THE LEAD THAT EXPLAINS ALL OF IT

`delegate-function-selection` for the nested delegate group reports:

```text
groupLocalIdx: 1, contract: 'MarketplaceDataV1', functionName: '__message_bus1',
functionArgCount: 23, compilerRouteArgCount: 23, candidates: []
```

`candidates: []` means `bArt.abi` contains NO function named `__message_bus1` - i.e. `bArt` is the MAIN
MarketplaceDataV1 artifact, whose ABI has no route (only `delegateArtifact.messageBus` does). The route
ABI is being taken from `group.compilerRoute.abiFunction` while the CONTRACT resolved for the group is
the main one.

That matches the measurement exactly: the failing site is `emitBlockSlotIndex / __message_bus1 / offset 6
/ isDelegate=false`, which is the MAIN artifact's compile of the route - where addressing the block from
`OP_INPUTINDEX` is correct for a standalone call and wrong when the route runs as a proxy's
implementation. Every codegen fix applied to the DELEGATE VARIANT cannot move a site that executes from
the MAIN script.

NEXT: establish which SCRIPT input 105 actually carries - compare its locking bytecode against both the
main and the delegate-variant artifact for MarketplaceDataV1. If it is the main one, this is the
`_externalRegistry` resolution-order family recorded much earlier in this file (blocker B), not a codegen
bug, and the fix belongs in how the nested delegate group picks its contract.

---

## Merge: `solidcash_v0.13.1` -> `codex/effectiveacceleration-marketplace` (d3857be7)

9 incoming commits, all bytecode-size work (single-byte helper ids, OP_NUM2BIN wide constants,
contract-level outlining, helper-body peepholing, outlining window 7, subroutine probe for aggregates)
plus the optimiser cross-check memoisation. The dirty worktree was committed first (54964087) so the
merge started clean.

Two conflicts, both resolved:
- `GenerateTargetTraversal.ts` - incoming renamed the chosen outlining attempt to `outcome`; this branch
  had added a `shared-span-helper` debug over the same loop. Kept the debug, moved onto `outcome`.
- `defaultProxyArtifact.ts` - generated; took the incoming version, then regenerated with
  `npx tsx scripts/regenerate-default-proxy.ts` against the merged compiler.

### CORRECTION TO EVERY EARLIER "PRE-EXISTING FAILURE" CLAIM IN THIS FILE

The same SDK subset (C2 / Sorted / Cross / Delegate / Proxy / Upgrade / MsgSender / X50) run on a
PRISTINE `solidcash_v0.13.1` checkout is **62 files, 0 failures**. So the failures this file has been
calling "pre-existing" are pre-existing *in this worktree* - they are THIS BRANCH's, not upstream's.
Upstream is green there. Always baseline against `/Code/cashscript` (the branch's own checkout), not
against this worktree's previous state.

### The merge regressed that subset 11 -> 26

```text
before merge (this branch)   after merge
DelegateInferred            6      6
MsgSender                   3      3
UpgradesDeployProxy         2      9    <- +7
X50DefaultProxyRegenerated  2      2
DelegateMixedDynamicMappingWrite  -  1  <- new
ProxyEntryWriteRepro        -      5    <- new
```

The +7 is diagnosed exactly. `graftDefaultProxy` (`upgrades.ts` ~437) fails closed:

```ts
const strictTail = 'OP_0 OP_NUMEQUALVERIFY OP_2DROP OP_1';
if (impl.delegateProxyStateOutputCountPinned === true
  && !defaultProxyArtifact.bytecode.endsWith(strictTail)) throw ...
```

The built-in proxy's tail is now `... OP_1 OP_INVOKE OP_NUMEQUALVERIFY OP_2DROP OP_1` - upstream's
single-byte-helper-id work turned the literal `OP_0` into an invoked helper. The pristine branch has the
SAME tail and passes, because there `delegateProxyStateOutputCountPinned` is false; this branch's
compiler sets it true, which arms the guard.

DO NOT just bump `strictTail` (and `relaxedTail`) to the new shape. That guard exists so a
delegate-AUTHORIZED forwarder is only derived from the exact covenant shape it was certified against -
the shape genuinely changed, so the derived variant has to be re-verified against the new one before the
pin moves. That is a deliberate decision for whoever owns that certification, not a mechanical update.

`ProxyEntryWriteRepro` (+5) and `DelegateMixedDynamicMappingWrite` (+1) are NOT yet diagnosed.

### Merge regression recovered (a6b2c7f6), and what X50 still says

`graftDefaultProxy`'s pin was the whole cause of the +13. It sliced the built-in proxy's strict
output-count check off the end and appended the relaxed one, but pinned the WHOLE tail including the
operand (`OP_0`) - so it failed closed when upstream's outlining moved that operand into a helper
(`... OP_1 OP_CAT OP_1 OP_INVOKE OP_NUMEQUALVERIFY OP_2DROP OP_1`). The graft is a pure COMPARISON swap
and the operand is common to both sides, so the pin now covers only the comparison suffix. Subset back to
11 failures = this branch's pre-merge level; `ProxyEntryWriteRepro` and
`DelegateMixedDynamicMappingWrite` fully green again.

The 2 remaining X50 failures are NOT merge damage - they say something about this branch:

```text
asmByteLength(defaultProxyArtifact.bytecode)  expected 130, got 228
"accepts the same append when only the conservation opcode is relaxed" -> the relaxed graft is REJECTED
   by the VM at input 2 with OP_VERIFY
```

Upstream's proxy is 79 asm tokens; this branch's is 97. So THIS BRANCH's compiler work inflates the
built-in proxy by ~75% in bytes, which trips the size pin and (probably relatedly) makes the relaxed
variant fail verification.

MEASURED AND FALSIFIED: the `OP_INVOKE` outlining barrier this branch adds to `utils/outline.ts` is NOT
the cause - regenerating the proxy with the barrier removed gives the SAME 97 tokens. Do not re-test it.

Next suspect is the WIP `compiler.ts` (the early `autoMarkDelegateFunctions` pass, committed in 54964087).
An attempt to measure that was VOID - the `yarn workspace solidc build` in that run silently failed, so
the regenerated artifact came from a stale dist. Re-run it and CHECK THE BUILD SUCCEEDED before trusting
the number.

### Post-merge re-measure of the marketplace test

Re-run with a wiped `.marketplace/cache/solidcash` against the merged compiler: **identical failure**,
`OP_SPLIT ... stack item length: 0; requested split index: 1` at input 102. So the merge did not disturb
that path, and the pre-merge diagnostics in this file remain valid.

### DelegateInferred (6) - narrowed, two causes falsified

All six are the SAME defect: OVER-marking. The delegate variant marks functions the test expects to stay
plain, and one overload ends up duplicated:

```text
"marks exactly the state-writing externally-callable functions"  ['public','delegate'] should not include 'delegate'
"injects the proxy master index only on delegate functions"      a plain fn got __internal__proxyMasterIndex
"executes the delegate overload of an overloaded function"       Ambiguous call: set(bigint,bigint,bigint), set(bigint,bigint,bigint)
```

Tried and FALSIFIED - do not retry:
1. Gating this branch's EARLY `autoMarkDelegateFunctions` pass on `synthesizeBatchBeforeLowering` (it runs
   before inheritance / modifier / getter expansion, so on an ordinary contract it judges a pre-expansion
   surface). Implemented, built, re-run: still 6 failures. Reverted.
2. `attachDelegateVariant`'s `variantOptions` no longer forcing `messageBus: false` - NOT applicable here.
   `DelegateInferred.test.ts` never enables `messageBus`, so the variant synthesizes no route either way.

So the over-marking comes from somewhere else in this branch's WIP (54964087). Next: bisect that commit's
`compiler.ts` hunks against a DelegateInferred run - it is a single commit, so `git checkout
54964087^ -- packages/solidc/src/compiler.ts`, rebuild, and run the one file gives the answer in one
cycle. Remember upstream is GREEN on this file, so the cause is definitely in this branch.

### DelegateInferred bisected across the compiler-side files

Each branch-modified compiler file was swapped for its `solidcash_v0.13.1` version in turn, rebuilt, and
the one test file re-run:

```text
branch as-is                                6 failures
upstream packages/solidc/src/compiler.ts    5 failures   <- accounts for exactly ONE
upstream packages/utils/src/outline.ts      6 failures   <- not a cause
upstream .../generation/GenerateTargetTraversal.ts  6 failures   <- not a cause
```

So the WIP `compiler.ts` owns 1 of the 6; the other 5 are NOT in the compiler at all. The remaining
branch-vs-upstream deltas are SDK-side (`StatefulContract.ts`, `Contract.ts`, `message-bus/graph.ts`,
`utils/artifact.ts`, `upgrades.ts`). Bisect those next, the same way.

GIT TRAP that briefly lost the working tree here: `git checkout <branch> -- <path>` STAGES the fetched
version, so a following `git checkout -- <path>` restores from the INDEX (still the other branch's file),
not from HEAD. Use `git checkout HEAD -- <path>` to undo it, and verify with a grep for a known local
change before rebuilding.

### DelegateInferred root-caused - and the trade-off that blocks shipping the fix

Bisected properly this time. The earlier bisect swapped the wrong files: `git diff --name-only
solidcash_v0.13.1 -- packages/` shows this branch differs from upstream in **11 solidc src files**, not
the two I had been testing. (Note the pathspec: `-- 'packages/*/src'` matches NOTHING; use `-- packages/`.)

Swapping `packages/solidc/src/semantic/AutoMarkDelegateFunctions.ts` for its upstream version takes
DelegateInferred from **6 failures to 1**. Its 12-line delta is the cause:

```ts
-  FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.INTERNAL, ...   // VIEW removed
+  FunctionModifier.PURE, FunctionModifier.INTERNAL, ...
-  if (!reachableFrom(fn, callables).some(touchesProxyState)) return false;
+  if (!fn.modifiers.includes(FunctionModifier.VIEW)
+    && !reachableFrom(fn, callables).some(touchesProxyState)) return false;   // views skip the state test
   ...
+  if (fn.modifiers.includes(FunctionModifier.VIEW)) { fn.sourceReadOnly = true; strip VIEW; }
   fn.modifiers.push(FunctionModifier.DELEGATE);
```

The second hunk makes EVERY view eligible - including views that touch no state. They get marked delegate,
get `__internal__proxyMasterIndex` injected, and once VIEW is stripped a view overload collides with its
non-view twin (`Ambiguous call: set(bigint,bigint,bigint), set(bigint,bigint,bigint)`). That is all six
symptoms.

A tighter rule faithful to the stated intent - keep VIEW out of INELIGIBLE_MODIFIERS, but require
`touchesProxyState` of views TOO - was implemented and measured:

```text
DelegateInferred      6 -> 1        (same as upstream's file)
SDK proxy subset     11 -> 8
solidc project        unchanged (15 failures, same 6 files)
marketplace           REGRESSED: now fails at compile time with
                      "message bus verifier covenant is 12983 bytes; active consensus permits at most 10000"
                      instead of reaching BCH preflight
```

REVERTED on that last line: it moves the primary target backwards, from a preflight failure to a hard
capacity wall. The blanket-view marking is load-bearing for the route's verifier size - marking fewer
views changes route admission and inflates the verifier program past 10 KB.

So this is a genuine trade-off, not a bug to squash: the fix for 5 SDK tests needs to land TOGETHER with a
verifier-size mitigation for the marketplace route. Both halves are now precisely characterised; do not
land either alone.

### DelegateInferred is 5 STALE EXPECTATIONS + 1 REAL BUG, not 6 bugs

The e2e test's fixture contract contains

```solidity
function get() public view returns (bigint) { return counter; }   // a VIEW that READS state
```

and its first assertion is literally named **"marks exactly the state-WRITING externally-callable
functions"**, expecting `get` NOT to be delegate. This branch deliberately changed that rule so a view
that reads proxy-owned state IS delegate-marked. So those assertions encode the OLD rule.

Confirming it was deliberate and the e2e test was simply missed: `packages/solidc/test/
DelegateInference.test.ts` (the sibling COMPILER test) WAS updated by this branch (+27 lines) and its new
case asserts exactly the new behaviour - `memberCount()` and `registered(address)`, both `public view`,
are expected to be ELIGIBLE route handlers. `packages/solidcash/test/e2e/DelegateInferred.test.ts` is
byte-identical to upstream (0 diff).

Two predicates were tried for the view test and both measured:

```text
require the WRITE test of views    -> DelegateInferred 6->1, but marketplace regresses to a HARD
                                      verifier-size wall (12983 > 10000). `touchesProxyState` is
                                      write-only (`isStatefulOp` = assigns/deletes/pushes/emits/
                                      transfers), so this makes EVERY view ineligible.
require a READ test of views       -> DelegateInferred unchanged at 6. `get` reads state, so it stays
   (StateAccessNode/MappingAccessNode)  eligible - which is the intended behaviour.
```

Both reverted. So there is nothing to fix in the rule for 5 of the 6: the e2e test needs its expectations
brought in line with the change, the same way the compiler test already was. That is a product decision
about intent - do not do it silently.

THE ONE REAL BUG: `Ambiguous call to overloaded function 'set'. Use explicit signature:
set(bigint,bigint,bigint), set(bigint,bigint,bigint)`. Stripping `VIEW` (autoMarkDelegateFunctions ~171)
makes a `view` overload's signature IDENTICAL to its non-view twin. That is a genuine defect of the new
rule and must be fixed regardless of the test question - either keep the overloads distinguishable, or
refuse to mark a view whose stripped signature would collide with an existing one.

### TWO independent correct fixes are now blocked by ONE wall: the verifier size

The overload collision above was FIXED and measured, then reverted for the same reason as the view
predicate:

```text
guard: refuse to mark a VIEW that is overloaded at all
  DelegateInferred   6 -> 4    (both overload tests pass: "selects the overload by arity" and
                                "executes the delegate overload of an overloaded function")
  solidc project     unchanged (15 failures, same 6 files)
  marketplace        REGRESSED: MessageBusVerifierCapacityError, 12776 bytes > 10000
```

The guard is sound - `set(bigint)` (view) and `set(bigint,bigint)` both land on
`set(bigint,bigint,bigint)` after SymbolTableTraversal injects the covenant parameters, because a view
gains a DIFFERENT number of them than a writer (it also carries `__internal__returnOutputIdx`). The
post-injection shape is not knowable in `autoMarkDelegateFunctions`, so refusing to mark an overloaded
view is the conservative correct answer.

So BOTH candidate fixes for DelegateInferred - the view state-predicate and the overload guard - are
correct in isolation and BOTH trip the same wall:

```text
MessageBusVerifierCapacityError at packages/utils/src/message-bus-verifier.ts:131
  write-predicate variant -> 12983 bytes
  overload-guard variant  -> 12776 bytes
  limit                    10000
```

The pattern is now unambiguous: **MarketplaceDataV1's route sits right at the verifier ceiling, and ANY
reduction in the set of delegate-marked views pushes it over.** That makes the verifier size the single
blocking dependency, not a side issue - it gates the DelegateInferred fixes AND is presumably what the
route's admission set is being distorted to avoid.

NEXT, and it is now the highest-value target in this file: shrink
`buildMessageBusVerifierCovenantScript`, or reduce what the marketplace route asks of it
(`maximumRows` / `maximumParticipants` in the atomic message-bus capability drive its size). 2776 bytes
of headroom are needed - 22%. `packages/solidc/test/journal-message-bus/MessageBusVerifierSize.test.ts`
is one of the 6 baseline compiler failures and is probably measuring exactly this.

### The verifier ceiling is a WIRING gap, not a real consensus limit

`SOLIDC_DEBUG_VERIFIER_LIMIT=1` (new, at the deploy-path builder call) reports:

```text
verifier-limit { contract: 'UnicrowDispute', maximumInputBytes: 1000000,
                 hasLimits: true, providerCtor: 'MockNetworkProvider' }
```

So at THAT site the provider's limit is 1,000,000 - two orders of magnitude above the 12,776-byte
verifier. The `MessageBusVerifierCapacityError` therefore did NOT come from this call. Some OTHER site
built the verifier with the 10,000 DEFAULT.

Every builder invocation in `packages/solidcash/src` passes
`contract.provider.consensusLimits?.maximumInputBytes ?? 10_000`, so the failing one is a call whose
`contract` carries a provider WITHOUT `consensusLimits` - most likely an inner `Contract` constructed
during deploy without the configured provider. `messageBusVerifierCovenantHex` (utils ~140) is the one
export that drops the parameter entirely, but it has no callers in src, so it is not the path.

Second, separate discrepancy: `solidcash.config.ts` sets `maximumInputBytes: 10_000_000` and `hre.ts:42`
merges it (`{ ...MOCK_CONSENSUS_LIMITS, ...netCfg?.consensus }`), yet the provider reports **1,000,000**.
The configured value is not surviving into the provider either.

This reframes the whole blocker. The 10 KB "consensus ceiling" that blocks BOTH DelegateInferred fixes is
not consensus at all on this network - it is a default reached because a provider lost its limits. Fix
the wiring (find the Contract instance without `consensusLimits`, and why 10_000_000 becomes 1_000_000)
and the verifier headroom problem likely disappears, unblocking both fixes at once. That is a far cheaper
path than shrinking `buildMessageBusVerifierCovenantScript` by 22%.

To reproduce: re-apply either DelegateInferred fix (the view state-predicate or the overloaded-view
guard), run the focused marketplace test, and read the stack under `MessageBusVerifierCapacityError` -
it names the call site directly.


---

## CORRECTION: both "marketplace regressions" were STALE ARTIFACTS, not the fixes

Re-tested both DelegateInferred candidates with a clean recompile
(`rm -rf .marketplace/cache/solidcash` + a compile that actually COMPLETED). Neither produces
`MessageBusVerifierCapacityError`; both leave the marketplace at its usual BCH preflight failure.

The earlier capacity errors came from artifacts left by an INTERRUPTED compile (one run hit a 10-minute
command timeout mid-compile). Everything this file said about "the route sits at the verifier ceiling and
any reduction in delegate-marked views pushes it over" is therefore WRONG and is retracted. The verifier
ceiling is not blocking anything.

LESSON, and it cost several rounds: after any compiler change, confirm the marketplace compile REPORTED
`Compiled 9/9 file(s)` before trusting the test result. A timed-out compile leaves a half-written artifact
set that fails in ways that look like consequences of the change.

### Landed: 7d8082a0 - do not delegate-mark an overloaded view

Verified with clean artifacts: DelegateInferred 6 -> 4, solidc project unchanged (15 failures, same 6
files), marketplace unchanged. This is a genuine defect fix - a view's post-injection signature can
collide with a non-view overload's, and the post-injection shape is not knowable at marking time.

### NOT landed, deliberately: the view state-predicate

Requiring `touchesProxyState` (write-only) of views takes DelegateInferred 4 -> 1 and the SDK subset
11 -> 8, with the marketplace unchanged and the compiler baseline unchanged. It is measured and safe.

It is NOT landed because it does not fix a defect - it RESTORES THE OLD RULE (a view can never be
delegate), which is exactly the behaviour this branch deliberately changed, and whose sibling compiler
test was deliberately updated to the new behaviour. Landing it would silently revert a design decision to
make an un-updated e2e test pass.

The remaining 3 DelegateInferred failures are that decision, stated as a choice:
- keep the new rule (views that read proxy state are delegate) -> update
  `packages/solidcash/test/e2e/DelegateInferred.test.ts`'s expectations, as
  `packages/solidc/test/DelegateInference.test.ts` already was; or
- drop the new rule -> apply the one-line write-predicate above and the e2e test passes as written.

Either resolves them; both are one small change. It needs the owner of that design decision, not a guess.

### The marketplace blocker, stated exactly (all attribution now measured)

Every ambiguity from earlier rounds is resolved:

1. **Which artifact runs at input 105?** The DELEGATE VARIANT. `SOLIDC_DEBUG_IMPL_ARTIFACT=1` at the
   nested low-level group creation prints
   `impl-artifact { contract: 'MarketplaceDataV1', isDelegateVariant: true }`. (Discriminator: only the
   variant carries `messageBus`; neither artifact lists the route in `abi`, so `candidates: []` from
   `delegate-function-selection` proves nothing - an earlier note claiming it did is retracted.)
2. **Is the variant's route delegate-marked at codegen?** YES. `SOLIDC_DEBUG_ROUTE_DELEGATE=1` prints
   `contract: 'MarketplaceDataV1', isDelegateRoute: true, autoDelegate: true, eligible: 33,
   eligibleDelegateMarked: 33`.
3. **So why is the base still `OP_INPUTINDEX`?** Because the failing entry read is NOT emitted in the
   route function - it is emitted in a HANDLER BODY (`publishJobEvent` and friends), which the route emits
   as its own OP_DEFINE'd function. Those nodes are `internal`, so `currentFunctionIsDelegate` is false
   there and `emitMasterInputIndex` falls through to `OP_INPUTINDEX`.

The failing site is stable across every run: caller frame `... OP_INPUTINDEX OP_6 OP_ADD <-257> OP_INVOKE`
= entry slot 3 (`jobEvents`, block offset 6) read at input 111 where the block puts it at 112.

### What blocks the fix: EMISSION ORDER

`emitMasterInputIndex` can address the witness from a helper body - OP_INVOKE shares the stack, so the
route's ABI frame is at the bottom in absolute terms. What is missing is the frame-bottom ordinal in a
body whose own tracked model lacks it. Capturing that ordinal was attempted three ways:

```text
contract-level probe on the route's parameter list   -> never matches; the witness parameter is not on the
                                                        node at visitContract time
self-capture on any emission that CAN see it         -> byte-identical; the untracked sites are emitted first
capture at route FUNCTION ENTRY                      -> bytes changed slightly (c05693 10->9, picks 855->854)
                                                        but NOT at the jobEvents site
```

All reverted. The last result is the informative one: **the handler bodies are emitted BEFORE the route
function is visited**, so nothing captured at route entry can reach them.

So the fix has to make the ordinal available without depending on emission order. Options, in the order I
would try them:
1. Compute it from the route's ABI shape rather than the live stack - the witness is the route's FINAL
   parameter and unlocking arguments are reversed, so it sits at the frame's physical bottom, i.e. ordinal
   1 (the same `OP_DEPTH OP_1SUB OP_PICK` the route prologue already uses). The contract-level probe tried
   exactly this but tested `fn.parameters.at(-1)` too early - test it at a point where SymbolTableTraversal
   has already injected the parameter, or key on `fn.messageBusRoute && contract has a delegate variant`.
2. Visit the route function before its handler bodies.
3. Pass the witness into each handler body as an explicit parameter.

### Landed: 6f0deb6c - the frame ordinal now reaches extracted bodies

Root cause of the `OP_INPUTINDEX + offset` entry bases: a route emits its handler bodies as separate
OP_DEFINE'd functions, each generated by its OWN traversal instance, and those never run `visitContract`
- which is where `routeProxyMasterBottomOrdinal` is decided. The sub-traversal setup already copies
contract-level state for exactly this reason (its comment says so); the ordinal was missing from that set.
Copied at both construction sites, plus `emitEntryInputIndex`'s delegate branch widened and the
`__message_bus*` name gate dropped, since a route also emits its delegate-marked SOURCE handlers as
helper bodies.

Measured: `OP_INPUTINDEX OP_6 OP_ADD` (the `jobEvents` slot, read at 111 where the block puts it at 112)
9 -> 6 occurrences; depth-relative picks 854 -> 873; the group-0 abort moves OFF that site. Baselines
unchanged on both sides.

NOTE the three earlier failed attempts at this were all defeated by TRAVERSAL INSTANCING, not by emission
order as previously recorded here - that earlier conclusion is retracted.

### NEXT: the chunk-pin write path

The group-0 probe now aborts in a 29-instruction body that is unmistakably the chunkable-value chunk pin:

```text
OP_2 OP_NUM2BIN OP_8 OP_PICK OP_2 OP_PICK <126> OP_MUL <28> OP_ADD OP_SPLIT OP_NIP
OP_SIZE <126> OP_MIN OP_SPLIT OP_DROP OP_CAT OP_2 OP_PICK OP_2 OP_PICK OP_ADD
OP_DUP OP_6 OP_PICK OP_SWAP OP_OUTPUTBYTECODE OP_EQUALVERIFY   <-- HERE
```

126 = VALUE_CHUNK_SIZE, 28 = VALUE_HEAD_SIZE: it walks the value in 126-byte chunks after the 28-byte
head and requires each chunk OUTPUT's locking bytecode to match. It fails on the first one. On the stack
are a 128-byte payload beginning `00004cb1204372656174652061206d61726b6574706c61636520696e20736f6c6964697479a0b16a`
(the JobEventData being written) and `9100` = 145.

So this is `publishJobEvent`'s WRITE - `jobEvents[jobId_].push(event_)` - and the SDK is not materializing
the chunk outputs the covenant pins. That is the WRITE-side twin of 5e1b7163, which fixed the READ side by
rebuilding a route callee's chunkable value witnesses from its chunk UTXOs. The same composition path
needs to emit chunk OUTPUTS for a route's chunkable C2 write.

Start from `emitSortedValueChunkPin` (GTT ~14840) for what the covenant expects, and from the nested
block composition (`StatefulContract.ts` ~10730, where `childBlockInputs` is built) for where the outputs
must be added - `childBatchPredecessorOutputs` and `childPlannedEntryInserts` are the existing precedents
for adding route-owned outputs.

### What the chunk-pin frontier actually needs (scoped)

The caller-side machinery for this already exists, in two flavours (`StatefulContract.ts` ~12160-12185):

```ts
// value known off-chain -> mint the chunks directly
for (const mint of valueChunkMints) {
  const chunkAddr = getValueChunkAddress(this.inner, this.categoryId, mint.collection, mint.slot, mint.digest);
  mint.chunks.forEach((data, i) => builder.addValueChunkOutput({ to: chunkAddr, ... }));
}
// value COMPUTED on-chain -> register it and let auto-derivation extract the pinned commitments from the trace
for (const collectionName of computedValueChunkCollections) {
  builder.registerValueChunkVar(collectionName, DUMMY_FUNDER_LOCKING_BYTECODE);
}
```

The marketplace write needs the **computed** flavour: `publishJobEvent` does
`event_.timestamp_ = uint32(block.timestamp)` before `jobEvents[jobId_].push(event_)`, so the SDK cannot
know the stored bytes off-chain - only the VM trace has them. (`5e1b7163`, the READ-side fix, could
rebuild its value from existing chunk UTXOs; a WRITE has no such source.)

What is missing is that both paths are CALLER-scoped: `getValueChunkAddress(this.inner, this.categoryId, …)`
uses the caller's contract and category, and `registerValueChunkVar` is a single global map on the
builder. A route's chunks belong to the CALLEE (its contract, its category) and must land in that
callee's TRAILING band - the route block publishes 64 `trailing` slots at `trailingBase: 38` for exactly
this, and they are currently unused (`external-dynamic-plan` reports `dynamicStateValues: []`).

Note the existing `externalDynamicChunks` planner (`StatefulTransactionBuilder.ts` ~1835) fills that
trailing band already, but only for `stateLayout.variables` marked `dynamic` - i.e. dynamic STATE
VARIABLES, not chunkable C2 COLLECTION values. That loop is the natural place to extend, and
`childBatchPredecessorOutputs` is the precedent for route-owned outputs that the composition adds.

So the shape of the remaining work is: give the callee group a computed-value-chunk registration, derive
its commitments from the same progressive probe that already derives the callee's entry commitments, and
emit them into the callee's trailing slots. That is a feature, not a patch - budget accordingly.

## Round: route-owned computed value chunks (implemented)

The chunk-pin abort in `publishJobEvent` is a MISSING FEATURE, now built, not a patch.

**Why the caller-side paths did not cover it.** `jobEvents[jobId_].push(event_)` stores a value the handler
computes (`event_.timestamp_ = uint32(block.timestamp)`), so the write's `EntryAccessAbi.valueParam` is absent
and `valueChunkMints` cannot build the chunks off-chain. The read-side fix (5e1b7163) does not apply either: it
rebuilds a witness from chunk UTXOs that already exist, and a write has no such source.

**The circularity, and what breaks it.** The covenant verifies the chunk ADDRESS before the chunk COMMITMENT
(GenerateTargetTraversal.ts, "(a) locking bytecode == chunk address" then "(b) commitment == expected"), so with
no output present the probe aborts at (a) and never reveals the commitment that (a)'s output would need. The
established idiom here would be placeholder outputs (cf. `plannedEntryInserts`), costing a probe round-trip.
Not needed: the full new value is still a live stack item when the probe aborts, and the entry head names it
exactly - stored length, and sha256 == root. Recovering it by that root match is SELF-VERIFYING (a false match
would have to be a sha256 collision), and every chunk then follows deterministically.

**Implementation.**
- `deriveRouteValueChunks` (StatefulContract.ts, before `extractCommitmentMapFromTrace`), called from the
  `progressive-route-entries` loop. Reads the chunked entry heads the probe already revealed, recovers each
  value from the trace by root match (length-pruned, so the scan is cheap), and emits exact chunk commitments
  via `buildValueChunkCommitment`.
- Address via `getValueChunkLockingBytecode`, whose dead `contract` parameter was dropped: it needs no
  network/addressType, and a route's chunks belong to the CALLEE, so no caller contract would be correct.
- Placement into the callee's trailing band at `trailingBase`, advanced past any `plannedEntryInserts` slot
  (`emitTrailingBlockBase` uses base = master + trailingBase + isInsert; the INSERT's NEW node precedes chunks).
- New `ExternalCallUtxoGroup.derivedTrailingOutputs`, consumed in the builder's `kind === 'trailing'` branch
  ahead of the positional `externalDynamicChunks` queue.

**Scoped deliberately.** Route-only (`compilerRoute.abiFunction`, whose accesses match the block layout being
indexed) and gated on `operations.includes('write')` - a READ of a chunkable value also lacks `valueParam` and
pins no outputs, so without that gate it would place spurious outputs.

Verification of this round was still in flight at the context boundary: `yarn build` clean, marketplace
artifacts recompiling (a truncated compile leaves half-written artifacts - confirm `Compiled 9/9 file(s)`
before trusting any result), then the focused `post job 1` run, then the documented regression baselines
(solidc project: 15 failures / 6 files; SDK 64-file proxy+delegate subset: 11 failures).

### Correction to the section above, and where it actually stands

Two assumptions in the first implementation were wrong, both now measured rather than reasoned:

1. **The entry head is NOT available.** The probe aborts with `revealed: []` - the chunk pin is verified before
   any entry commitment - so there is no head to give (slot, root, length), and the sha256-root recovery it
   described cannot run. Retracted.
2. **There is no trailing band here.** This route's layout has `trailingBase` UNDEFINED, so
   `emitTrailingBlockBase` addresses chunks at `master + blockSize`, i.e. AFTER the whole callee block, not
   inside it. The `derivedTrailingOutputs` channel is kept (it is correct for a layout that does define
   `trailingBase`) but is not the path this contract takes.

**What works.** `extractRouteChunkPin` reads the pin straight out of the aborting frame, where the covenant has
already computed everything: output index 145, the chunk address `aa20 0d8e..87`, and the exact 128-byte
commitment (`0000` ++ the job bytes). It is guarded by the chunk-loop instruction signature
(`<126> OP_MUL <28> OP_ADD`) so it cannot fire on any other OP_OUTPUTBYTECODE pin, and by a p2sh32 shape check.
Confirmed stable across probe passes.

**What does not.** Placement. `addValueChunkOutput` appends at the very end, and the covenant wants absolute
index 145, which is ALREADY OCCUPIED by a different p2sh32 output. So this is not a missing output - it is a
geometry mismatch: either the SDK materializes fewer outputs for the callee block than `blockSize`, shifting
everything, or index 145 belongs to a slot the SDK is filling with something else.

**Next step is diagnosis, not code.** Dump the built output list around 140-150 with each output's origin and
compare against the callee's block geometry (master input index + blockSize + isInsert). That answers whether
the block is short or the base is off, and only then is the placement mechanism worth choosing. Do NOT add
another placement channel before that measurement - two have already been written against guessed geometry.

**Baselines re-confirmed this round:** solidc 15 failures / 6 files (unchanged). SDK subset run pending.
Marketplace artifacts do NOT need recompiling for SDK-only changes - `.marketplace/artifacts` is current, and
the working dir is `.marketplace` (run from repo root: `npx vitest --config vitest.solidhat.config.ts run -t ...`).
`examples/effectiveacceleration` is a DIFFERENT, broader target whose config compiles the whole upstream EACC
set and currently fails on MockSablierLockup/@prb-math; it is not this grind's path.

### Placement: third attempt also missed, and the exact open question

Keying the derived chunk by block position `si` (covering positions past the layout, where the block loop
emits a funder passthrough) did NOT replace output 145 either. So output 145 is not emitted by that loop at all.

**The one measurement that unblocks this.** `extractRouteChunkPin` reports `outputIndex: 145` and, with
`bOutputBase = 3`, `blockSlot 142`. The block loop keys on `si` against ITS own output base. Those two bases do
not correspond, and until that is resolved every placement attempt is a guess. Establish, in one run:
  1. which code path emits the output currently at absolute index 145 (it is `aa20953ccf..`, no token - the same
     bytecode as indices 38/39, so a funder/passthrough, NOT a covenant-managed slot), and
  2. what absolute index the block loop's `si` maps to, i.e. the loop's output base vs `bOutputBase`.
Log every emitted output with (absolute index, emitting branch) for the callee group and diff against the
covenant's expectation `master + blockSize + isInsert`. THEN choose the channel.

Three placement channels have now been written against inferred geometry and all three missed. The extraction
half is solid and verified; do not rewrite it. The next change should be the measurement above, not a fourth
channel.

### The measurement, and the actual crux

The `si -> absolute output` map (SOLIDC_DEBUG_CHUNK_GEOM=1, left in place) settled the geometry:

- Absolute output **145 is `si: 39, kind: 'trailing'`** - so the chunks DO land in the callee's trailing band,
  and `trailingBase` IS defined. The earlier "no trailing band / lands past the layout" conclusion was an
  artifact of keying by the wrong base (`bOutputBase` = 3 is not the block's output base) and is RETRACTED.
- si 39 = trailingBase(38) + 1, exactly the covenant's `master + trailingBase + isInsert`. The FIRST
  implementation's placement rule was right all along; it never ran because the wrong key made `kind` read
  `undefined`.
- **si 39 maps to absOut 42 in one build shape and 145 in another, 77 times each.** Absolute indices are NOT
  stable across the probe and final builds; block position is. Placement is therefore keyed by position, and
  the chunk's own index (the commitment's 2-byte LE prefix) fixes its offset within the band.

**The crux, unresolved.** With placement now position-correct and stable (pin fires exactly twice, no spurious
outputs), output 145 is still not what the covenant wants. The probe build the derivation runs against and the
build whose geometry produced index 145 are not the same shape - that is what the two `si 39` mappings mean.
Until the probe build reproduces the final build's output geometry, no placement key can satisfy the pin.

Next: find why the probe build has a different output count/shape than the final build for this route, and
whether the covenant's 145 was computed under the probe geometry or the final one. That is a question about
`route-probe-build-start/finish` vs the final `build()`, not about the chunk code, which is now correct as far
as it can be verified independently.

**Regression state:** solidc 15 failures / 6 files (baseline, unchanged). Full SDK suite was still running at
the context boundary - it MUST be checked before this branch is trusted, since the chunk placement touches the
shared block-output loop. `getValueChunkLockingBytecode` lost its unused `contract` parameter (1 call site).

### The placing group is NOT the owning group (root cause found), and where it stops

`block-loop-pos` with `groupIndex` settled it:

    groupIndex: 1, si: 39, absOut: 145   <- the block that OWNS output 145
    groupIndex: 0, si: 39, absOut: 42

The chunk pin is extracted while probing **group 0**, but the output it addresses (145) lives in **group 1's**
block - the covenant's base is the proxy master, so the probed group and the owning group differ. Every
per-group placement channel therefore stored the chunk where the builder would never look for it. That is the
single root cause behind all the earlier placement misses, and it is FIXED: the map now lives on the builder
(`setDerivedChunkOutput`), keyed by absolute output index, and the block loop matches it on
`builder.outputs.length` across every group.

**Proof the mechanism works:** the pin advanced 145 -> 146. Chunk 0 was accepted and the covenant moved on to
chunk 1. That is the first time this write has progressed at all.

**Where it stops.** It stops at 146: chunk 1's placement does not stick the way chunk 0's did, and two
chunk-shaped aborts remain. The probe budget was already extended (one pass per chunk, capped at
VALUE_CHUNK_MAX_COUNT) and that is not the limit being hit. Next: instrument what is actually emitted at 146 in
the build that follows the second placement - specifically whether replacing a second funder passthrough in the
same block shifts anything, and whether the abort at 146 is still check (a) (address) or has moved to check (b)
(commitment). The extractor only fires on (a), so if it has moved to (b) the pin will keep reporting (a)'s
index and look stuck when it is not.

**Regression state (IMPORTANT, unresolved):** the full SDK project run reports 53 failures / 21 files. The
documented baseline (11) is for a 64-file proxy/delegate SUBSET, not this project, so 53 is NOT yet attributable
either way - do not read it as a regression or as clean. Get a clean full-project baseline (stash and re-run)
before trusting this branch. solidc is unchanged at 15 failures / 6 files.

### Chunk placement CONFIRMED working; the remaining blocker is a different failure

`chunk-placed` (left in place behind SOLIDC_DEBUG_ROUTE_CONCISE=1) confirms both chunks are materialized in the
final builds, in the owning group:

    72 chunk-placed { groupIndex: 1, si: 39, absOut: 145 }
    71 chunk-placed { groupIndex: 1, si: 40, absOut: 146 }

The chunk-shaped aborts still visible in `progressive-route-entries` are from INTERMEDIATE derivation passes,
which is how progressive derivation is supposed to look - each pass reveals the next chunk. They are not the
final failure, and the earlier reading of them as "stuck at 145" was wrong: the extractor only fires on the
address check, so it keeps reporting that index while later passes move on.

**The remaining failure is not the chunk pin.** The final error is `preflight failed at input 102: OP_SPLIT
invalid index. stack item length: 0; requested split index: 1` - an OP_SPLIT on an EMPTY stack item, a different
signature from the chunk pin's OP_OUTPUTBYTECODE/OP_EQUALVERIFY. An empty item at a split points at an empty
WITNESS, which is the same family as the read-side bug fixed in 5e1b7163 (`childValueWitnesses` was empty
because the caller's `entryValueWitnesses` describes the caller's own collections). Start there: find which
witness feeds input 102's split and whether it is populated for the route's callee.

Do NOT keep instrumenting the chunk path - it is placing correctly. The next work is at input 102.

### Regression question RESOLVED: the 53 failures are pre-existing

Two-point comparison on a file the chunk change could plausibly touch (it exercises the same block-output loop):

    AtomicMessageBusCompose at HEAD           -> 12 failed | 7 passed
    same file at 1ef264cc~1 (pre-chunk work)  -> 12 failed | 7 passed

Identical, so the chunk work is inert there. That matches the code: `derivedChunkOutputs` is empty unless a
chunk pin was extracted, so `get()` returns undefined and the loop behaves exactly as before; the extended probe
budget only grows when a chunk is actually placed; and `getValueChunkLockingBytecode`'s dropped parameter was
unused with one internal call site.

Of the 21 failing files, 4 are the known subset baseline (DelegateInferred, MsgSender, UpgradesDeployProxy,
X50DefaultProxyRegenerated). The other 17 were never covered by the 64-file subset that produced the "11"
number - they are this branch's pre-existing state, not new. The full-project figure to carry forward as the
baseline is therefore **53 failures / 21 files**, and solidc **15 / 6**.

(Method note for re-running this: `git checkout <ref> -- <path>` STAGES what it fetches, so restore with
`git checkout HEAD -- <path>`, never a bare `git checkout -- <path>`, which would restore from the index and
silently wipe the working changes.)

### Next blocker: input 102, and what is already ruled out

The failing trace at input 102 iterates a body carrying a `53434231` ("SCB1") magic-prefixed item alongside a
`4b6685e7020000000000` value, and splits 1 byte off an item that is EMPTY.

Already ruled out: the `users` collection witness is populated and sound (`nested-value-witness` reports
`rootMatches: true`, storedLength 106), so this is NOT the read-side witness family fixed in 5e1b7163, despite
the empty-item signature suggesting it. Look instead for a SECOND witness/decode site whose source is empty on
an INSERT specifically - the marketplace path under test creates a brand-new job, so any decode that assumes a
pre-existing value will see nothing. `emitGenericPushdataDecode` is the likely shape (its length prefix is a
1-byte split, matching "requested split index: 1").

Suggested first move: dump input 102's unlocking-script arguments and identify which one is empty, rather than
reading the body - the body is shared and the empty ARGUMENT is the actual defect.

### Input 102: one hypothesis tested and FALSIFIED

Tested: on an INSERT the callee's chunkable collection has no prior entry, so the 5e1b7163 read-side fix sets no
witness at all, leaving a zero-length item where the covenant splits off a 1-byte prefix. Supplying the
canonical "zero length prefix" (`new Uint8Array([0])`) for the absent-entry case changed NOTHING - same error,
same input. Hypothesis falsified and the change REVERTED rather than left in as unverified behaviour.

What the arg dump shows: input 102 carries SEVERAL empty (`'0:'`) arguments, not one, interleaved with real
ones (`'4:51024456'`, `'25:76a914c4841b8f...'`, `'1:81'`). So "find the empty argument" is not selective enough
- most of them are legitimately empty. The next step must identify WHICH argument the failing OP_SPLIT consumes,
by mapping the failing instruction's stack depth back to an argument position, not by looking for emptiness.

Do not retry the absent-entry-witness idea; it is measured and dead.

### Input 102 narrowed to the exact failing site

    ip=1 op=0x7f depth=53 top=[20 01 <empty> 01]   <-- FAILS HERE   (520 trace lines into input 102)

`ip=1` means this is the SECOND instruction of its body, so the failure is inside a tiny OUTLINED DECODE HELPER
(`<1> OP_SPLIT` - read a 1-byte length prefix), not in the contract body. OP_SPLIT pops the index (`01`) and
splits the item below it, which is EMPTY.

That relocates the defect: the helper is fine and generic, and the empty item is an ARGUMENT passed in by its
caller. So the question is no longer "which witness is empty" but "which call site invokes this decode helper
with an empty operand, at stack depth 53". Recover the caller from the frame chain (the `callerFrame`
diagnostic already prints it for the route probes - extend the same capture to the final preflight, which
currently prints only the failing frame).

This also explains why the several empty arguments on input 102 were a red herring: most are legitimately
empty, and the one that matters is whichever reaches THIS helper.

### Caller capture: added to the WRONG dump path

Extended the preflight trace dump (StatefulTransactionBuilder.ts ~3234) with `callers:` / `callerOps:` frame
walking. It produced nothing, because the path that actually fires for this failure is the OTHER one (~3203),
which formats from a `ring` BUFFER of `{ip, opcode, depth, top}` steps and does NOT retain each step's
`instructions` array - so the enclosing frame cannot be recovered from it as written.

The added code is correct for the path it is on and is kept, but to identify the caller of the failing decode
helper the RING path needs the instruction array (or at least a body identity) captured per step. That is a
small change to what `ring` records, at its push site. Do that first; everything downstream of "which call site
passes the empty operand" is still blocked on it.

### ROOT CAUSE of input 102 found: an empty OP_UTXOTOKENCOMMITMENT

Adding `bodyLen` to the ring dump (frame identity) exposed the call site immediately:

    ip=693 op=0x01(2f) body=7503   <- push 0x2f (47)
    ip=694 op=0x79     body=7503   <- OP_PICK  (pick the input index at depth 47)
    ip=695 op=0xd2     body=7503   <- OP_UTXOTOKENCOMMITMENT  -> pushes an EMPTY item
    ip=697 op=0x8a     body=7503   <- OP_INVOKE helper 69
    ip=1   op=0x7f     body=69     <- <1> OP_SPLIT on that empty item   <-- FAILS

The decode helper is fine and the argument is fine in shape: the covenant read the token commitment of an INPUT
and got NOTHING. So an input the covenant expects to carry an NFT commitment is carrying none - the SDK has a
plain/funder input where a commitment-bearing NFT belongs.

**Prime suspect - and it is this round's own chunk work.** The block is 1:1 input/output. The chunk work
replaces funder passthrough OUTPUTS at 145/146 with chunk NFTs, but the INPUTS at the paired positions are
still funders with no token. If the covenant reads the UTXO commitment at a chunk position, it gets empty,
which is exactly this failure. On an INSERT there are no pre-existing chunk UTXOs to spend, so the input side
cannot simply mirror the output side - decide deliberately what the input at a NEW chunk position must be
(a funder is evidently not it).

Verify before building: re-run with the chunk placement disabled and see whether input 102 still fails. If it
passes without the chunks, the input pairing is the defect and it belongs to this feature. That is a cheap,
decisive test and it is the RIGHT next action.

### Attribution test run: the chunk work is NOT the cause of input 102

With chunk placement disabled at runtime (clean build, `chunk-placed` count = 0), input 102 fails IDENTICALLY:

    preflight failed at input 102: OP_SPLIT invalid index. stack item length: 0; requested split index: 1.

So the empty `OP_UTXOTOKENCOMMITMENT` is INDEPENDENT of the value-chunk feature - the "prime suspect" in the
previous section (chunk outputs paired with funder inputs) is FALSIFIED. The input carrying no commitment is
one the route needed regardless, and this defect was simply hidden behind the chunk-pin abort until the chunk
work let the probe get far enough to reach it.

That also means the chunk feature is not blocking, and the two are separable: input 102 can be worked without
touching chunks, and its fix is what `post job 1` now needs.

Next: identify WHICH input the covenant picks (the caller pushes `0x2f` = 47 and OP_PICKs, so the input index
is the stack item at depth 47 at that moment) and what the SDK placed there. `body=7503` is the main contract
script, ip 693-697, so the source position is recoverable from that artifact's source map.

### Input 102 ROOT CAUSE: an off-by-one in the input index the route picks

`[srcOutputs 118-126]` (kept, behind SOLIDC_DEBUG_INPUTS=1):

    118:PLAIN 119:PLAIN 120:PLAIN 121:PLAIN 122:PLAIN
    123:nft=3e16384e..926500..006a000000aa1bf434..a881976a914c4841b8f5e6f10a38dc5e672e183ffd9be0cd12f88ac2102
    124:PLAIN 125:PLAIN 126:PLAIN

The covenant PICKs input index `0x7a` = **122** and reads its token commitment. 122 is PLAIN. The entry NFT it
wants is at **123** - its commitment tail `1976a914c4841b8f..88ac2102` is exactly the `users` entry value
already confirmed sound by `nested-value-witness`.

So this is an OFF-BY-ONE between the input index the route's covenant computes and where the SDK actually
places that entry input. Not an empty witness, not a missing output, not the chunk work (all measured and
excluded). It is the same family as the fix recorded in
[[marketplace_route_index_frames_2026_08_07]] - "route delegate blocks need SEPARATE input/output index
frames" - so the remaining defect is very likely one more frame whose INPUT base is still being computed with
the wrong origin, in the same way the output base was.

Next: find which index frame produces 122 for this pick (the emitter computes it as master + offset; compare
against where the block loop actually placed the entry input at 123) and correct that one base. The output side
of this pair is already right, which is why entries and events resolve while this pick does not.

### Stopping point: do NOT blind-patch the off-by-one

The covenant's picked index (122) derives from the master index the SDK supplies via
`nestedMasterIndices[groupIdx] = nestedInputBase` (StatefulContract.ts ~11266). In route mode that base is
`lowLevelCallInputBase + allLowLevelInputCount`, computed on a completely different footing from the OUTPUT
base right below it (`1 + requiredNftIndices + externalReadUtxos + outState groups + iterationEntryInputs`).

A bare `+1` there is exactly the kind of guess that has already failed several times this session, and this
base feeds every route test, so a wrong nudge would trade one red test for many. Before changing it, confirm
which of the two is wrong by measuring where the callee's master input ACTUALLY lands versus
`nestedMasterIndices[groupIdx]`: if the master is right and only the entry pick is off, the defect is in the
entry OFFSET inside the block, not in the base, and patching the base would be wrong even though it would move
this particular test.

### The off-by-one is an EXTRA INPUT, not a wrong base (measured)

Full input dump around the failure (SOLIDC_DEBUG_INPUTS=1):

    102:nft=(empty)   <- the input being validated: the route MASTER
    103..112: nfts (data/state band)   113,114,115: PLAIN   116,117: nfts   118..122: PLAIN
    123:nft=3e16384e..1976a914c4841b8f..88ac2102   <- the users ENTRY the covenant wants

master = 102. The covenant picks 122 = **master + 20**. The entry is at 123 = **master + 21**.

So `nestedMasterIndices` is CORRECT - the master lands exactly where the covenant addresses it - and the
earlier "wrong input base" suspicion is FALSIFIED. The defect is that the SDK places ONE EXTRA INPUT inside the
block ahead of that entry, shifting every entry offset by one. This is why a `+1` on `nestedInputBase` would
have been the wrong fix even though it would have turned this test green: it would have moved the master too,
breaking the many route tests that currently pass.

Next: diff the block's INPUT composition against `blockLayout.slots` for this route - walk `group.blockInputs`
positions 1..21 and find which one has no corresponding slot (the extra). The `block-loop-pos` diagnostic
already prints the OUTPUT side per si; add the same for inputs and the surplus position falls straight out.
Candidates visible in the dump: the PLAIN runs at 113-115 and 118-122 are funder bands, and one of them is
evidently one longer than the layout expects.

### CORRECTION: not a surplus input either. It is entry-slot ASSIGNMENT, off by one.

    [blockInputs g0] n=102 slots=102 :: 0:master 1:dataNft 2:dataNft 3:entry/NFT ... 20:entry/plain 21:entry/plain
    [blockInputs g1] n=82  slots=82

Both groups have `blockInputs.length == slots.length`, so there is NO surplus input and the previous section's
conclusion is RETRACTED. With group 0's master at 102:

- block offset 20 (abs 122) IS an `entry` slot, but the SDK filled it with a PLAIN funder -> empty commitment
  -> the OP_SPLIT failure.
- the users entry NFT landed at offset 21 (abs 123), also an `entry` slot.

So the block geometry, the master, and the input count are all correct. The defect is the ENTRY-TO-SLOT
ASSIGNMENT: the entry the covenant reads at entry-slot N is being placed at entry-slot N+1, and the vacated
slot is backfilled with a funder (which is why it presents as "empty commitment" rather than "missing input").

That points at the routeSlot -> blockSlot mapping, the same mapping `nested-entry-pick` prints
(`blockSlot: 3, routeSlot: 0` / `blockSlot: 4, routeSlot: 1`). Compare, for the failing collection, the
covenant's expected entry ordinal against the `routeSlot` the SDK assigns; an entry that resolves to the
predecessor rather than the key itself (or an insert reserving a slot ahead of the read) would produce exactly
this one-slot skew.

Three suspects have now been falsified in order - wrong input base, surplus input, wrong witness - each by
direct measurement. Do not re-open them.

### Entry-slot mapping measured: `blockSlot = routeSlot + 3`, with GAPS

`nested-entry-pick` for group 0, all with `exists: false` (every key is new in this test):

    users/routeSlot 0 -> blockSlot 3    arbitrators/1 -> 4    meceTags/2 -> 5    jobEvents/3 -> 6
    users/routeSlot 5 -> blockSlot 8    arbitrators/6 -> 9    ...

The +3 offset is consistent, so the base is fine. But **routeSlot 4 is absent** - the SDK never picks it, and
blockSlot 7 is consequently backfilled with a funder (`7:entry/plain` in the block dump). The same shape
recurs at the failure: blockSlot 20 = routeSlot 17 holds a FUNDER, while the users entry the covenant wants
sits at blockSlot 21 = routeSlot 18.

`exists: false` is the thread to pull. For a non-existent key the SDK supplies the PREDECESSOR entry (the
absence-bracket proof); when the predecessor lookup yields nothing it falls back to a funder. So the question
is why routeSlot 17's access resolves to no predecessor while routeSlot 18's resolves to the users entry -
i.e. whether two accesses are competing for one entry and one of them is silently losing it. That would
explain both the skipped routeSlot 4 and the failure at 17, as the same bug appearing twice.

Start at the `nested-entry-pick` site: log the KEY each routeSlot resolves and the predecessor it finds, then
compare routeSlot 17 and 18. If they resolve the same key, the duplicate-access case is the bug.
