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
