# Handoff: mapping-entry write admission (rounds 203-204)

Worktree `/Code/cashscript/.worktrees/kernel-beta-candidate`, branch `grok/message-bus-kernel-beta`.
Ladder baseline for this work: **43/66** marketplace titles under the kernel row loop (`OP_INVOKE`).

## What landed (code, all verified against the ladder)

1. `770d1a8b4` — `solidc: coalesce a mapping entry field write that reads its own entry`
   `CoalesceMappingEntryFieldWrites` refused a run whose value reads the same entry
   (`m[k].f = m[k].f + 1`, `m[k].f += 1`, `m[k].f++`). The handler kept a `MappingFieldAssign`, and kernel
   route admission (compiler.ts:5018-5025, "untransported chunkable write") refused the whole handler, so a
   *route* call to it silently dropped the write. The pass now routes those reads through the entry snapshot it
   already takes (and through the expressions the run already wrote for the fields it reads), producing the
   read-once/write-once whole-entry shape the route transports. The same commit publishes the pass-local
   admission reason under `SOLIDC_DEBUG_ADMISSION_REASONS=1`, because the frozen catalog mapping replaces it and
   `KERNEL_LAYOUT` alone cannot tell a layout bound from an unsupported construct.

2. `94d77ebc3` — `solidc: accept transaction reads as mapping keys in the field-write coalescer`
   `isPure` accepted only names/literals and `exprEqual` had no case for `NullaryOpNode`, so
   `m[msg.sender].f = v` never coalesced while the parameter-keyed twin did. Both tests now accept a
   transaction/environment read.

Measured effect on `MarketplaceDataV1` handler admission: 9 ineligible → 3 (`initialize`, `removeMeceTag`,
`addReview`). Newly admitted: `arbitratorRefused`, `arbitratorSettled`, `userRefunded`, `userDelivered`,
`updateUser`, `updateArbitrator`. `MarketplaceV1`'s own handler set and its 130587-byte debug bytecode are
unchanged, so the `OP_SPLIT` frame below is untouched.

No regressions measured: `register user` 2/2, `register arbitrator` 2/2, `mece tags` 3/3,
`refuse arbitration > job closed`, `post thread message > post thread message` all still pass
(logs `/tmp/r204b-*.log`, `/tmp/r204-mece-tags.log`, `/tmp/r204-register-*.log`).

## Two new blockers found (both measured, neither fixed)

### A. Silent drop → loud refusal: one computed chunkable lane per graph

`refuse arbitration > job not taken` now fails with

    messageBus: participant 1 'MarketplaceDataV1' failed to build its balanced block:
    Kernel chunkable-value output placement requires one exact compiler-published resource lane.

thrown by `resolveKernelValueChunkResourceLane` (`packages/solidcash/src/stateful/StatefulContract.ts:3064`,
called at 32428). `MarketplaceV1.refuseArbitration` calls **two** computed chunkable writers —
`arbitratorRefused` (`arbitrators[key].refusedCount+1`) and `userRefunded` (`users[key].reputationDown+1`) — and
the kernel graph carries exactly one `__internal__valueChunkOutputBase` witness, so two lanes cannot both be
authenticated. Before the fix above, the handler was ineligible and the write was **silently dropped** instead
(transaction accepted, `JobEvent` emitted, `refusedCount` stayed 0). Failing loudly is the honest outcome; the
title can only pass once the protocol can authenticate a second lane.

### B. Key lane for a loop-varying read

`job posting > post job with invalid mece tags` fails with

    messageBus [L3_RESOURCE_UNRESOLVED]: message-bus batch collection witness
    '__message_bus_key_meceTags_0' must identify one physical entry

(`packages/solidcash/src/message-bus/message-bus.ts:887`). `MarketplaceV1.checkParams` loops
`marketplaceData.meceTags(tags_[i])` (callsite `occurrence: 'loop'`, `argSources: [{kind:'arrayElement',
paramIndex:3, indexStepValue:1}]`), so one graph reads two distinct keys; the callee route publishes a single
`__message_bus_key_meceTags_0` input (no `_row`, no `_alt` — `users` does have `_alt`). The route needs a
second/row-local lane for an argument-keyed read that a caller may invoke with different keys.

## The complete failure map (measured this session)

43 pass / 23 fail, and every failure is now attributed. The counts fit the baseline exactly:

| cause | titles |
| --- | --- |
| `OP_SPLIT` frame drift (below) | `take job` ×2, `dispute` ×4 (only `sanity checks closed job` passes), `deliver result` ×2, `refund` ×2, `arbitrate` ×4, `post thread message > sanity checks`, `refuse arbitration > job taken` = **16** |
| two computed chunkable lanes (blocker A) | `refuse arbitration > job not taken` = **1** |
| meceTags key lane (blocker B) | `job updates > update job tags`, `job posting > post job with invalid mece tags` = **2** |
| `OP_VERIFY` at input 127 (`pay start job > pay start job`; caller code is byte-identical to baseline, callee route only gained entry slots) = **1** |
| not yet measured, both behind a taken job | `approve result and review` ×2, `integration test` = **3** |

Blocker B is pre-existing, not a regression: the baseline `MarketplaceDataV1` artifacts under
`.marketplace/iteration/` (09-15 22:42) publish the *same* route key lanes as the current one, i.e.
`__message_bus_key_meceTags_0` with no `_row`/`_alt` sibling.

## `OP_SPLIT` drift: measured precisely (round 205)

`messageBus [L3_VM_RESOURCE_LIMIT]: ... invalid index. stack item length: 0; requested split index: 32.`
Blocks the 16 titles listed above.

### What the VM shows (hard measurement, no debug build needed)

The failing read is in the **DEFINE body `__message_bus_entry_takeJob`, functionId 59, 5073 instructions** — the
only 5073-instruction pushdata blob of `MarketplaceV1.json`'s `debug.bytecode` (blob 222). Instruction 461 emits
`push 0x14 (20); OP_PICK`, instruction 463 pushes `7d81` and invokes the outlined keccak fragment. The physical
stack at ip 461 (depth 91) is

    d12 dcj(0x3b, 225B)  d13 cj flag(01)  d14 jobId(00)  d15 signature(65B)  d16 ek0(00)
    d17 ek1(25B)  d18 logical_caller(25B)  d19 OWNER(00)  d20 chunkBase(0x3f = 63)  d21 recoveryA(04)

so the emitted pick of 20 hands **63** to the fragment instead of the owner **0**; the fragment reads
`outputs[63 + 3].nftCommitment[32:64]` (padding, empty) and `OP_SPLIT 32` aborts. At ip 25 — the neighbouring
pick of the same emitted index 20 — the physical frame sits one slot lower (`d13` dcj … `d20` owner, `d21`
chunkBase), so the same coordinate reads the owner there. Between ip 25 and ip 461 the physical frame moves one
slot up while the emitted coordinate does not follow: the divergence is in the body's *temporary* accounting
above the frame, not in the frame itself.

### Recipe (works on the shipped artifact)

    SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=127 \
    SOLIDC_DEBUG_STACK_BODY_LENGTH=5073 \
    SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX=461 SOLIDC_DEBUG_STACK_BODY_OPCODE=1 SOLIDC_DEBUG_STACK_BODY_DATA=14 \
    SOLIDC_DEBUG_STACK_BODY_FROM=0 SOLIDC_DEBUG_STACK_BODY_TO=5073 SOLIDC_DEBUG_STACK_DEPTH=26 \
    npx vitest run --config vitest.marketplace.config.ts -t 'take job take job'

`state.ip` is body-local and `_DATA=14` pins the push of index 20. The trace stops at ip≈463 because the
transaction aborts there. The body's pick list is recovered statically (decode the blob, match `<push k>;
OP_PICK`): `2:19 25:20 61:22 80:17 123:18 130:19 141:25 185:18 192:19 203:25 301:18 308:19 319:25 361:18
368:19 379:25 431:20 461:20 465:19 495:19 503:21 511:19 522:20 546:18 …` (219 picks).

### Two instruments ruled out (measured)

1. **`DBG-COMPUTE-BASE` records do not describe the shipped body.** Every site appears 4× with identical
   `index`/`modelLength`/`outputLength`; the recorded `index` values (13, 14, 18, …, 20) match no emitted pick
   index in the body (those are 17…31), and `outputLength` (983/1020) matches no pick ip. They come from the
   probe/cheap-admission traversals. The earlier inference "the model is one item taller (model index 20 vs
   physical 19)" therefore does not follow from these records — the symptom itself is now measured directly
   instead. Any future use of these records must first prove which traversal they describe.
2. **Marker builds are useless as implemented.** `SOLIDC_DEBUG_COMPUTE_BASE_MARKERS=1` emits
   `OP_DEPTH; push <site>; OP_DROP; OP_DROP` and the optimiser removes all of them: a small contract compiles
   byte-identically with and without the flag, and the marketplace bytecode holds 1152 bare `OP_DEPTH` and zero
   marker sequences. A marker that survives must be non-foldable *and* self-identifying — e.g.
   `push <site>; OP_DEPTH; push <model>; OP_NUMEQUAL; OP_VERIFY; OP_DROP`, whose failure the existing
   `message-bus-failed-verifies` dump captures together with its stack (`SOLIDC_DEBUG_FAILURE_RING=1`).

Also still true and not to be repeated: a model-versus-emission stack oracle and an invoke-arity check were both
implemented and measured in round 204 (16282 / 298 reports on a *correct* small contract; 758 of 1958 call sites
legitimately differ) and reverted — the model holds virtual markers, and an entry body deliberately reads the
route frame below its declared parameters, so neither equality is an invariant.

### Next step

Only `emitMasterInputIndex` / `emitComputeBaseSidecarBlockBase` know each pick's *intent* (owner vs chunk base vs
outlined block base vs delegate executor). Publish that intent per **emission order** — a side table
`{functionId, ordinal, branch, index}` in `artifact.debug`, or a body-local monotone counter — and line it up
against the static pick list in the same order. Then compare each emitted index with the physical owner position
(dcj depth + 7) from the VM dump: the first coordinate that disagrees localises the span, and the instruction in
that span whose physical effect differs from the model's is the emitter to fix.

## Round 206: the drift is one instruction inside the deferred-compute decoder

Progress on the same body, all measured.

1. **Outlining is ruled out.** `SOLIDC_DEBUG_NO_OUTLINE=1` (new env-gated diagnostic in
   `capturedSubroutineIsProfitable`) inlines every captured subroutine — `MarketplaceV1` grows from 130587 to
   586353 bytes — and `take job > take job` fails *identically* (`OP_SPLIT 32`, input 127, handler
   `__message_bus1`). So the outlined-helper call-site accounting is not the cause.

2. **The drift is inside a 30-instruction window** of the clone body. Reading the *value* each emitted
   `push <k>; OP_PICK` actually fetches at runtime:

   | ip | emitted pick | value fetched | frame at that moment |
   | --- | --- | --- | --- |
   | 25 | 20 | `0B` = owner | dcj@13 … owner@20 |
   | 431 | 20 | `0B` = owner | dcj@13 … owner@20 |
   | 461 | 20 | `1B:3f` = **63** (chunkBase) | dcj@12 … owner@19 |

   The repeated constructs at ips 123/130/141, 185/192/203, 301/308/319, 361/368/379 all read consistent values,
   so model and physical agree everywhere up to ip 431 and break inside 431..461. Every per-instruction physical
   delta in that window is canonical (`Δowner == Δdepth` at every step), so exactly one instruction's **model**
   accounting is off by one; the model believes one item above the owner is still present that physics has already
   consumed.

3. **What that window is.** Disassembling ips 425..470 with libauth's opcode names (from the clone body of
   `/tmp/redeem3.hex`) gives `PICK`(base) · `OP_3 OP_ADD`(side-car slot) · `TOALTSTACK … EQUALVERIFY/DROP …
   FROMALTSTACK` (the member loop) · `NUMEQUALVERIFY` · `TOALTSTACK FROMALTSTACK` · `PUSHBYTES_2 a680 INVOKE` ·
   `PUSHBYTES_1 14 PICK` · `PUSHBYTES_2 7d81 INVOKE`. That is the deferred-compute side-car input decoder:
   `emitKeccakComputeCall` (`GenerateTargetTraversal.ts:9877-10020`; the ECDSA sibling decoder sits near 10191).
   Its **entire** model accounting is the hand-written pair at 10014-10015

       this.popFromStack(1);
       this.pushToStack('(value)');

   i.e. the decoder is modelled as net 0 — consume the preimage argument, produce one value — while for the shipped
   call shape the physical region shifts the frame by −1. The comment at 9965-9968 ("without making message-bus
   owner or outlined-base picks one slot shallow") shows this same placement was already suspected of it.

4. **Next step.** Count the decoder's physical net for the shipped shape (its `batchWidth`, `withinBatch`,
   `keccakLoopActive` values are all computed at 9894-9904) and correct that hand-written accounting — a local,
   general fix that must hold for every call shape, not just this one. A cheap way to see it: log
   `this.stack.length` immediately before `this.visit(node.parameters[0])` (9957) and after 10015, then compare
   with the physical depth at the matching ips from the trace recipe above.


## Loop and recipes

- Fast compiler loop: edit → `cd packages/solidc && npx tsc -p tsconfig.build.json` (≈14 s) → in-process
  `compileString(src, { forceStateful: true, messageBus: true, messageBusKernel: true })` and read
  `artifact.messageBus.handlers[].eligible` (probe scripts `/tmp/repro203b-e.mjs`).
- Cold fixture compile (≈4 min): create `node_modules/@sablier/lockup` and `node_modules/@prb/math` symlinks to
  `/Code/effectiveacceleration.ai/contract/node_modules/...`, `rm -rf .marketplace/cache/solidcash`,
  `SOLIDC_COMPILE_CACHE=0 node --max-old-space-size=8192 packages/testing/dist/cli.js compile --jobs 4`, then
  remove the links. The tests read prebuilt artifacts, so a compiler change needs this before any title run.
- Title runs: `npx vitest run --config vitest.marketplace.config.ts -t '<describe words> <it words>'`
  (`-t` joins the describe path with spaces, ≈60-100 s per family).

## Round 207: the keccak decoder desync is FIXED — the OP_SPLIT signature is gone

Commit `480d3bcf5` (`solidc: reconcile the keccak decoder's preimage argument at its bind`).

The decoder consumes its preimage argument inside the member loop (the selected member's `OP_EQUALVERIFY` binds
it against the decoded preimage) but the tracker only removed it at the very end of the decoder, so every
top-relative coordinate emitted in between was one slot too deep — exactly the diagnosis of round 206. The
ecrecover decoder below already reconciled at its own bind, with a comment naming this failure mode; the keccak
decoder now does the same (`popFromStack(1)` inside the `member === withinBatch` arm, deferred pop removed).

Verified:

- The shipped clone body's pick list changes exactly where predicted: `… 431:20 **461:19** 465:19 **495:18** …`
  (it read `461:20 495:19` before). 19 is the participant owner's physical depth at that point, 20 held the
  dynamic chunk input base (63).
- `take job > take job` no longer reports `OP_SPLIT`. The VM trace of the clone body (gate recipe above, now with
  `_DATA=13`) runs to ip 4590 instead of aborting at ip ≈463.
- `take job > sanity checks` (the ±1 neighbour of the current test) still passes.

### What the current test fails with now

`take job > take job`: `BCH-2026 preflight failed at input 127: Program failed an OP_VERIFY operation.` The
clone body's trace stops at **ip 4590**, which is `PUSHBYTES_2 8680; OP_INVOKE` inside the last keccak-call
branch (ips 4560-4600: `IF … ELSE DUP 1NEGATE NUMEQUAL IF … PUSH2 b480 INVOKE IF PUSH2 b580 INVOKE ELSE PUSH1
82 INVOKE ENDIF … CAT PUSH1 fd INVOKE DUP SIZE NIP PUSH1 2b PUSH2 8680 INVOKE PUSH2 7181 INVOKE BEGIN …`), so the
failing `OP_VERIFY` is inside helper `8680`. The failing input's witness dump shows
`__internal__returnOutputIdx = -1`, and the trailing outputs of that participant are all `OP_TRUE` padding.

`take job multiple`: `expected not to emit 'JobEvent'` — an assertion, not a VM abort (it passed the point that
used to abort).

Neither is explained by the decoder fix (the model count after the decoder is unchanged, so post-decoder
coordinates are identical); both look like the next defect that the early abort used to hide.

Next step: gate the trace on helper `8680`'s body (its instruction count is visible in
`artifact.debug.invokeDebug[32128].bytecode`-style entries, or by decoding the `PUSH2 8680; OP_DEFINE` blob) and
find which `OP_VERIFY` fails and which frame slot feeds it. `SOLIDC_DUMP_FAILING_REDEEM=1` also works and gives
the whole program.

## Round 208: the OP_VERIFY is the ecrecover side-car preimage bind

Found it, by resolving the invoke chain at clone-body ip 4590 from the `OP_DEFINE` sites (a small scanner is
enough: decode `debug.bytecode`, take every `OP_DEFINE`, read the id pushed before it and the body pushed before
that; `ids 32902 → 26`):

- `PUSH2 8680` is id **32902**, body = `PUSH1 26; OP_INVOKE; OP_2; OP_SPLIT; OP_SWAP; OP_BIN2NUM; OP_SPLIT`
  (7 instructions).
- id **26** is `OP_PICK; OP_SWAP; OP_SPLIT; OP_SWAP; OP_ROT; OP_EQUALVERIFY` (6 instructions) — a structural
  “pick a blob at depth 43, split it twice and require the two pieces to be identical” helper.

Gating the trace on that 6-instruction body (`SOLIDC_DEBUG_STACK_BODY_LENGTH=6`,
`SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX=5`, `SOLIDC_DEBUG_STACK_BODY_OPCODE=136` (OP_EQUALVERIFY),
`SOLIDC_DEBUG_STACK_DEPTH=8`) stops exactly at its ip 5, and the two operands are:

    287B  2300aa2037bea4b75216d00136034950543a009fc3de88588985e7d32447952059fa8794870021567622f30023aa20b…  (d0)
    287B  2300aa2037bea4b75216d001360349543a009fc3de88588985e7d32447952059fa8794870021567622f30023aa20b…  (d1)

They are byte-identical except for the 32-byte token category embedded at byte 83 (d0 carries
`862c6518…249d1c`, d1 carries `baa8e3df…0d5455`); neither category, nor the shared 287-byte template, appears
anywhere in the compiled program, so both values are runtime covenants. This is the ecrecover decoder’s
`bind argBlob_A == argBlob` check (“bind” comment at `GenerateTargetTraversal.ts:10191` region), and the two
covenants come from the participant block’s side-car slots (`push 14; INVOKE` / `push 15; INVOKE` at clone ips
4505-4510 read slot 14 and 15).

So the transaction is refused by a genuine integrity check: the two side-car preimages the block supplies carry
**different categories**. Decide next whether the compiler read the wrong slot pair or the composition put a
different participant’s covenant in one of them; either way the check itself is fail-closed and not the bug.

### Round 209 correction and the real lead: the side-cars were never composed

Correction to the paragraph above: the two values do not differ in a “category”. Decoding them against the run
log shows each embeds a **20-byte address hash**: d0’s appears in the composition as
`unlockerLockingBytecode: 'aa20862c6518…'` / `redeemHash: '862c6518…'`, d1’s appears inside state NFT
commitments (`0023aa20baa8e3df…`). So the bind compares covenants of two *different addresses*, and the
`push 14; INVOKE` / `push 15; INVOKE` pairs at clone ips 4505-4510 are helper ids 14/15 (slot readers), not slot
indices — the slot indices come from the helper chain before them.

The real lead is one switch away. `SOLIDC_DEBUG_ECRECOVER_READINESS=1` prints nothing for this composition, and
that dump is guarded only by `deferredBlocks.length > 0` (`compose.ts:3512`). So the composer classified **no
deferred-compute block at all** for the take-job transaction. From `compose.ts:3068-3097`:

    publishedComputeOffsets = blockLayout.slots.filter(kind is keccakSideCar|ecrecoverSideCar).map(offset)
    computeOffsets = publishedComputeOffsets.filter(offset => local.inputs[offset]?.token?.nft?.capability === 'mutable')
    controller = local.__messageBusDeferredCompute; if (controller?.hasUnresolved()) deferredBlocks.push(...)

`MarketplaceV1`’s route does publish the slots (`ecrecoverSideCar` at offsets 10-19, slotIndex 6-15), so either no
local input at those offsets carries a **mutable** NFT or the builder’s deferred-compute controller never
registered anything — i.e. the ecrecover side-car NFTs for this delegate/graph execution were never materialised,
and the program then read whatever the layout left there (two unrelated covenants). That also explains why this
path never passed: the only ecrecover users on the ladder are the `take job` family, and every other green title
skips signature verification.

Next step: find where the builder registers deferred compute (`__messageBusDeferredCompute` in
`StatefulTransactionBuilder.ts`) and why it stays empty for a graph route whose handler verifies a signature —
start from the ABI’s `ecrecoverArgParams` / `keccakPreimageParams` and the delegate execution kind.

Pointer chain for that step (already established):

- `compose.ts:3083` reads `local.__messageBusDeferredCompute`; the property is only defined when
  `stb.hasUnresolvedDeferredKeccakPreimages() || stb.hasUnresolvedDeferredEcrecoverArguments()`
  (`StatefulContract.ts:36665`).
- `hasUnresolvedDeferredEcrecoverArguments()` is just
  `this.deferredEcrecoverCompute?.argBlobs.some((argBlob) => argBlob === null) === true`
  (`StatefulTransactionBuilder.ts:12277`), and the field is only set from the builder options
  (`StatefulTransactionBuilder.ts:7031`).
- The options are declared in the call builder at `StatefulContract.ts:22404`
  (`deferredEcrecoverCompute: { salt, argBlobs, evmKeccakPreimageIndices }`), so the next thing to read is the
  assignment that fills it — for the take-job delegate/graph call it is evidently never populated (or always
  populated with resolved blobs), which is why the side-car NFTs are absent and the two bind operands are
  unrelated covenants.

`take job multiple` no longer fails in the VM at all — it fails an assertion (`expected not to emit 'JobEvent'`),
so both titles are now past the former abort point.

Layout fact and hypothesis for the next round. `MarketplaceV1.messageBus.route.blockLayout` has
`ecrecoverSideCar` slots at offsets 10-19 (slotIndex 6-15), so reading slots 14 and 15 is what the program should
do; both belong to the same participant and are expected to carry the same covenant. `takeJob`’s modifiers are
`['public', 'delegate']`, i.e. this execution is a delegate execution of the implementation body over the owner
participant’s block, so the likely mismatch is which participant’s category the two side-car covenants were
composed from (owner vs delegate executor). Check `slotIdx`/side-car composition for delegate executions in
`packages/solidcash/src/message-bus/compose.ts` and the block-layout slot reader in `StatefulContract.ts`.

## Round 210: the side-cars are resolved but the owner block gets funders instead

Two env-gated diagnostics were added and committed (`a12eefe28`, `9ca8049e0`):
`ecrecover-build-entry` / `ecrecover-build-resolution` in `StatefulContract.ts` (does the build reach the
recovery branch, and what did the resolution produce) and `composer-compute-slots` in `compose.ts` (per
participant: cache-hit/controller state, published compute offsets, mutable compute offsets, and each slot’s
input/output capability and category). Both run under `SOLIDC_DEBUG_ECRECOVER_READINESS=1`.

Measured on the failing `take job` transaction:

    ecrecover-build-resolution { function: 'takeJob', delegatedEcrecover: true, argBlobs: 1,
                                unresolvedArgs: 1, coSpends: 2, recreates: 2, deferred: true }
    ecrecover-build-resolution { function: '__message_bus1', … same … }
    composer-compute-slots { participant: 0, cacheHit: false, controllerDefined: false,
                             publishedComputeOffsets: [3 … 19], computeOffsets: [],
                             slots: [ { offset: 3, inputCapability: null, outputCapability: null } … ] }

So the builder **does** resolve and defer the recovery side-cars (2 co-spends, 2 recreates, one unresolved
argument), while the block the composer holds for participant 0 has **nothing** at any of its 17 compute
offsets. `StatefulTransactionBuilder.ts:7332-7341` shows why that matters: the slot-positioning loop takes
`this.keccakComputeCoSpendUtxos[..]` / `this.ecrecoverComputeCoSpendUtxos[..]` and otherwise **falls back to a
funder**, which is exactly the pair of unrelated covenants the delegate body then compares.

The delegate routing explains the split. `delegatedEcrecover: true` sets `delegateComputeResources`
(`StatefulContract.ts:29847`, `29918`), and the builder’s delegate branch places compute resources only for
*legacy* geometry (`this.delegateComputeResources && !this.compilerRouteDelegateBlock`,
`StatefulTransactionBuilder.ts:16947`); it states that “a compiler-route delegate’s side-cars are slots of the
proxy-owned balanced route and were recreated at those route offsets above”. The route/owner block is therefore
where they must land — and that is the placement that is missing.

Next step: find why participant 0’s **route** build has empty co-spend arrays while the handler build resolves
them (same call built twice? cached resolution? `entryArgs` vs `args`?): log the same
`ecrecover-build-resolution` record from inside the participant build path the composer uses (or tag it with
`peekBuildId()`), then follow whichever of the two builds the composer keeps.

## Round 211: correction — the failing composition DOES carry its side-cars

Round 210's “the owner block gets funders instead” was a mis-attribution. Ordering every
`composer-compute-slots` dump in `/tmp/r210-slots.log` against the failure events shows the transaction under
test is composed **four times, each with three mutable compute slots** (`inputCapability: 'mutable'` at offsets
3/4/5 — the keccak side-car plus the ecrecover A/B pair, exactly `takeJob`'s own layout:
`keccakSideCar:3#0 ecrecoverSideCar:4#0 ecrecoverSideCar:5#1`), and the `OP_VERIFY` failure happens *after*
those. The nine `mutable=0` dumps belong to the *other* transactions of the same titles (publishJobPost etc.,
which never verify a signature), so they are correct behaviour, not the bug.

`controllerDefined` is false in all of them, which is also fine: the ecrecover arguments resolved, so nothing is
deferred and `deferredBlocks` is legitimately empty.

So the remaining question is the content of the side-car preimages, not their placement. Both operands of the
failing bind come out of **one frame slot**: helper 26 is `PICK 43; SWAP; SPLIT; SWAP; ROT; EQUALVERIFY` — it
picks a deep blob and compares two 287-byte pieces *extracted from that same blob*, which differ only in an
embedded 20-byte address hash. That blob is built by the SDK (the side-car unlock/preimage encoding), so the
mismatch is in what the composer encoded there, provided the compiler really expects those two pieces to be
identical.

Next step: read the ecrecover/keccak side-car unlock construction in the SDK (the `sharedBlob` / A-side preimage
that carries the two covenant copies) and check which covenant each copy is built from; a cheap way to see it in
one run is to raise the preflight dump's 256-character hex cap (`packages/solidcash/src/message-bus/preflight.ts`,
`hex: binToHex(item).slice(0, 256)`) so both 287-byte operands print in full and can be matched against the
composition's input/output locking bytecodes by address.

Done (commit `3b4d701a8`, `SOLIDC_DEBUG_STACK_HEX_BYTES`): the two operands print in full and differ in exactly
the 20-byte address embedded at byte 83 (`…0023aa20` + `862c651813ae124e7b48b9e50a1834a243249d1c` vs the same
prefix with `baa8e3dfd4537d5e204b1e28770d5455c10f7315`) plus 19 further nibbles. In the composition the first
address appears as an `unlockerLockingBytecode`/`redeemHash` and the second inside state NFT commitments, so the
blob carries the covenants of **two different contracts** where the program requires the same covenant twice.
With `takeJob` being `public delegate`, the prime suspect is an owner/executor (proxy vs implementation) mixup in
the preimage or in the co-spent side-car’s lock.

## Round 212: it is not the ecrecover argBlob bind — it is a covenant-equality check

Read the compiler’s recovery decoder (`GenerateTargetTraversal.ts:10136-10180`): step 1 collapses the four
recovery arguments into `argBlob = hash || v || r || s`, and step 2 is commented “side-car A: bind ITS argBlob ==
ours, then integrity-check its covenant”. That bind is a **97-byte** comparison — the SDK agrees
(`StatefulTransactionBuilder.ts:12207` only accepts `argBlob.length === 97`), while the operands measured at the
failure are **287 bytes**. So the failing `OP_EQUALVERIFY` is a different check.

What it is: at clone ips 4505-4510 the body calls helper 14 and helper 15 (the “read input bytecode at this slot”
helpers, ids pushed before) and then helper id 32902 → 26, whose body is
`PICK 43; SWAP; SPLIT; SWAP; ROT; EQUALVERIFY` — i.e. it reads two block slots’ locking bytecodes and requires
them equal. That is a **covenant-equality (preservation) check between two slots of the participant block**, and
it fails because those two slots hold covenants of different contracts (different embedded address hashes).

Where the two covenants come from is now the only question. The ecrecover pair itself is built by
`buildEcrecoverComputeSidecars` (`solidcash/src/ecrecover/ecrecoverComputeSidecar.ts:21-76`): A and B have
*different* locks by construction — `ecrecoverComputeLockingBytecode(salt, 'A')` vs `(salt, 'B')` — and their
unlocks are `[pad, argBlob, shared, aBlob|Cblob, zinv?, redeem]`. So two *different* A/B covenants are expected
everywhere; a check that requires equality must be comparing a covenant with its **preserved copy** (input vs
output, or the two copies of the same role), which points back at an owner/executor (proxy vs implementation)
address mixup when the delegate body preserves a slot.

Next probes, in order:

1. Disassemble clone ips ~4400-4505 and read the slot-index arithmetic feeding helpers 14/15 (it is built from the
   compute-block base plus a fixed offset) — that names the two slots being compared.2. Extend the `composer-compute-slots` dump to print each published slot’s input/output locking bytecode prefix,
   then check whether one of the two compared slots was composed with the implementation’s lock instead of the
   owner’s (or the reverse) — the delegate branch that decides this is
   `StatefulTransactionBuilder.ts:16945-16983` (`compilerRouteDelegateBlock` vs legacy geometry).

Refinement after disassembling that region: the failing comparison sits inside a **state/chunk decode loop**, not
the ecrecover decoder — the surrounding instructions read `OP_UTXOTOKENCOMMITMENT`, compare a 4-byte magic
(`PUSHBYTES_4 83084af9`), `OP_CAT` fragments and loop `OP_BEGIN … OP_UNTIL`, and the checks are emitted through
the same structural helper (32902 → 26) that requires two pieces of one blob to be equal. So the two 287-byte
covenants are most plausibly a **state/entry (or value-chunk) covenant and its preserved copy**, differing in the
address embedded at byte 83 — again an owner/executor (proxy vs implementation) address mixup, but on the state
resource rather than on the recovery side-car. Probe 1 should therefore read which of the block’s state slots
feeds helpers 14/15, and probe 2 should compare that slot’s composed lock against the covenant the delegate body
expects.

## Round 213: the composed blocks are internally consistent

Probe 2 is done and returns a negative (commit `9d3737dde`, `SOLIDC_DEBUG_SLOT_LOCKS=1`): the composer now prints
every block slot whose input lock and output lock differ, with the first differing byte and a window around it.
Across the whole `take job` run — all 56 per-participant dumps, every participant — **no slot has two
state-sized locks that disagree**. The only mismatches are inactive compute slots: input = the sidecar lock
(`aa20…`, 35 bytes), output = `OP_TRUE` padding (1 byte), which is what the layout intends.

So “the delegate body preserves a slot at the wrong address” is ruled out: the composed blocks preserve their
locks exactly. The two 287-byte covenants the program compares therefore both come out of a **witness blob** (a
parameter the SDK builds), not from two slots of the block. The failing helper picks that blob at frame depth 43
and compares two 287-byte pieces of it, so the next probe is to identify that blob:

- raise `SOLIDC_DEBUG_STACK_DEPTH` past 43 with the body-26 gate and read the frame around the picked blob (the
  surrounding items are recognisable: the 225-byte `dcj`, the 65004-byte witness blobs, the 65-byte signature);
- or, equivalently, dump the clone body at ip 4590 with depth 48 and match the picked slot against the route
  ABI’s `__internal__…` parameter list (`__internal__valueWitness_*`, `__internal__vmapBatchProof_*`,
  `__internal__leadingPushValue_*`, `__internal__dynamicChunkInputBase`, …), then read where the SDK fills that
  parameter and which contract’s covenant it embeds twice.

### Round 214: the frame at the failing invoke, dumped

Recipe that works (no rebuild; `/tmp/r214-clone2.log` holds the full 48-item frame with the two addresses
marked): `SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=127 SOLIDC_DEBUG_STACK_HEX_BYTES=400
SOLIDC_DEBUG_STACK_BODY_LENGTH=5073 SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX=4589 SOLIDC_DEBUG_STACK_BODY_OPCODE=2
SOLIDC_DEBUG_STACK_BODY_DATA=8680 SOLIDC_DEBUG_STACK_BODY_FROM=4589 SOLIDC_DEBUG_STACK_BODY_TO=4590
SOLIDC_DEBUG_STACK_DEPTH=48`. Note the push of the helper id is at ip **4589** (not 4590 — 4590 is the
`OP_INVOKE`).

What the frame shows at ip 4590 (depth 111, top 48 items):

    d0 2B 8680        d1 1B 2b (43)      d2 2B 1f01 (287)     d3 287B covenant carrying BOTH addresses
    d7 179B A-addr    d45 424B B-addr     d41/d40 = 04 / 3f (recoveryA / chunkBase)
    d36/d37 25B addr   d34 65B signature  d32 250B dcj-ish    d46/d47 36B category pushes

`PICK 43` inside helper 26 pops the index and then counts from the new top (the 287-byte item), so the picked
blob is the **424-byte item at d45** — the one carrying `baa8e3df…`; the 287-byte operand at d3 carries *both*
addresses and d7 (179B) carries `862c6518…`. The 424-byte blob’s hex prefix appears in no composition log, so it
is a witness value the SDK supplies rather than a slot’s lock.

Next: name that witness. Its 424 = 287 + 137 shape and position 43 below the top should identify it against the
route ABI parameter list and the composer’s witness values (extend one of the existing dumps to print, per
participant, the witness entries whose byte length is in that range, or dump the route args with
`SOLIDC_DEBUG_ARG_ORDER=1` and match by length/prefix).

### Round 215: the two differing bytes are hash-lock fragments, and the blob is not a route argument

`SOLIDC_DEBUG_WITNESS_SIZES=min,max` (commit `5c87661ce`) prints every route witness entry whose byte length falls
in the window, with its name. With `300,600` on the take-job transaction **nothing matches**, so the 424-byte blob
is not a route argument: it is derived inside the participant build (journal/proof material), which is why no
composition log contains its bytes either.

Re-reading the differing bytes also changes the picture. The first difference is at byte 83, where both operands
carry the fragment

    … 87 23 aa20 <20 bytes> …

i.e. a `OP_HASH256 <20-byte digest> OP_EQUAL` hash-lock fragment (0xaa = OP_HASH256, 0x87 = OP_EQUAL) serialized
inside the covenant bytes — with a *different 20-byte digest* in each operand, plus 19 further differing nibbles.
So the two covenants are not the same template for two contracts: they are covenant-shaped scripts embedding
**different hash-locks**. The other copy’s digest (`baa8e3df…`) also appears inside state NFT commitments in the
composition, and `862c6518…` appears as an `unlockerLockingBytecode`/`redeemHash`.

Next: read the entry/value-chunk covenant builders in the compiler (`buildEntryNftCovenantScript`,
`buildDataNftCovenantScript`, `VALUE_CHUNK_DOMAIN_TAG` users in `@solidcash/utils`) and find which one emits a
`OP_HASH256 <digest> OP_EQUAL` fragment plus a second embedded address, then decide which of the two digests the
program should have received — the value comes out of a builder-derived 424-byte blob, so the answer is in
`StatefulTransactionBuilder`’s journal/proof assembly, not in the composer’s witness vector.

### Round 216: the differing field is a nested P2SH32 address

Correction to the paragraph above: `aa20` is **two opcodes**, not `OP_HASH256` + a 20-byte push — `0xaa` =
OP_HASH256 and `0x20` = PUSHBYTES_32 (`GenerateTargetTraversal.ts:342`,
`const P2SH32_LBC_PREFIX = hexToBin('aa20')`). The differing field is therefore a full **32-byte P2SH32 redeem
hash** embedded as a nested contract address: `862c651813ae124e7b48b9e50a1834a243249d1c6100f82fbc59aa01027a56e9`
— the same value the composition logs as `redeemHash`/`unlockerLockingBytecode` — versus `baa8e3df…` for the other
copy. So the two compared covenants are covenant-shaped scripts that each reference a **different contract**.

Which builder embeds such a nested address: the value-chunk covenant path computes a tagged domain hash and then
materialises the nested lock

    … OP_CAT … OP_HASH256  |  P2SH32_LBC_PREFIX (aa20)  P2SH32_LBC_SUFFIX (87)

at `GenerateTargetTraversal.ts:~28620-28660` (`emitP2sh32FromCovenant` and its caller), where the hashed material
is `VALUE_CHUNK_DOMAIN_TAG || collectionHash || <tracked category> || <tracked slot> || <tracked root>`. The
tracked **category** is one of those inputs, so an owner-vs-delegate category disagreement inside the journal
blob would change exactly this 32-byte field and nothing else — which is what the diff shows.

### Round 217: one copy embeds participant 0’s own lock, the other a different contract’s

`SOLIDC_DEBUG_PARTICIPANT_CATEGORIES=1` (commit `f2f5daac0`) dumps the plan’s participants with category,
execution kind and locking-bytecode prefix. On the take-job transaction:

    participant 0  kind 1 (delegate)  category a3cef944…083e  locking aa20 baa8e3dfd453…
    participant 1  kind 1             category ee643a16…0af0  locking aa20 2c5c35b2…
    participant 2  kind 0             category 0db0a70e…8547  locking aa20 5c3accc6…

The 35-byte fragment inside the failing covenants is `aa20 baa8e3dfd453…b27b3b 87` — **verbatim participant 0’s
locking bytecode** (P2SH32 lock) — in one copy, and `aa20 862c6518…a56e9 87` in the other. So one copy is built
for participant 0 (the delegate participant whose block hosts the state) and the other for a contract that is not
any of the three participants; `862c6518…` shows up in the same run as an `unlockerLockingBytecode`, i.e. as the
lock of a contract that is co-spent but not in the plan’s participant list (most likely the delegate
implementation artifact’s lock).

Next probe: extend the same dump to print, per participant, the implementation/proxy locking bytecodes (the
delegate artifact’s lock and `outputLockingBytecode`), so `862c6518…` can be attributed to a specific contract;
then read where the journal/proof covenant is built and which of the two identities it is handed — that is the
one place where the substitution goes wrong.

Next probe: print the category each participant writes into the journal/chunk material and compare it with the
category the co-spent chunk/entry NFTs actually carry (the composer already reports slot categories in
`composer-compute-slots`); a mismatch there names the fix, and the delegate branch that picks the category is the
same `compilerRouteDelegateBlock` geometry as above.

Confirmed by reading the builder: `emitP2sh32FromCovenant` (`GenerateTargetTraversal.ts:28658-28690`) builds the
covenant from a template whose **32-byte category placeholder** (`00 01 … 1f`, reversed for display) is
substituted at runtime with the tracked category, and the resulting `OP_HASH256 <32> OP_EQUAL` lock is the
covenant's nested address. The differing field is therefore the **category** — the same conclusion round 208
reached from the raw bytes before round 215 mis-sliced it. So the marketplace failure is an
**owner-vs-delegate category disagreement** inside the builder-derived 424-byte journal/proof blob: one copy of
the covenant was minted under the owner participant's category and the other under the delegate executor's.

### Round 218: both identities are now named

The SDK already prints the failing input, and it closes the attribution:

    message-bus-failing-input {
      inputIndex: 127,
      unlockerContract: 'MarketplaceV1',
      unlockerLockingBytecode: 'aa20862c651813ae124e7b48b9e50a1834a243249d1c6100f82fbc59aa01027a56e987',
      redeemHash: '862c651813ae124e7b48b9e50a1834a243249d1c6100f82fbc59aa01027a56e9',
      redeemBytes: 130624,
    }

So the second embedded lock, `aa20 862c6518…a56e9 87`, is the **executor**: the contract whose composed 130624-byte
kernel redeem is running at input 127. The first, `aa20 baa8e3dfd453…b27b3b 87`, is **plan participant 0**, whose
`executionKind` is 1 (delegate) and whose category is `a3cef944…083e` — i.e. the **owner** participant that hosts
the state block (`participantInputs[0] = 0`).

That split is by design — a delegate execution runs the implementation body at the executor input while the block
belongs to the owner — so one copy of the journal/proof covenant is built with the owner identity and the other
with the executor identity. The failure is that the program requires them equal.

Next step, and it is now narrow: find the two build sites that embed these locks — the owner-side covenant comes
from the participant build (`StatefulTransactionBuilder`’s delegate branch, which knows
`compilerRouteDelegateBlock`), the executor-side one from whatever materialises the executor’s copy — and make the
journal/proof covenant use the owner identity on both sides. `message-bus-failing-input` already names the
executing contract, and `SOLIDC_DEBUG_PARTICIPANT_CATEGORIES=1` names the owner, so a single extra print of which
identity each copy is built from will identify the wrong site.

### Round 219: the two copies are the owner and the executor, and an existing dump says so

No new instrumentation needed — `SOLIDC_DEBUG_ATOMIC_GRAPH=1` already prints `delegate-participant-identity`
(`compose.ts:1163-1172`), and on the take-job transaction it gives all three identities for participant 0:

    logicalLockingBytecode:  aa20083560b686fab28b272d2ba1f04128f0af805ff4a827d666730629ff090e6b6887
    ownerLockingBytecode:    aa20baa8e3dfd4537d5e204b1e28770d5455c10f7315f330463e42e7283f31b27b3b87
    executorLockingBytecode: aa20862c651813ae124e7b48b9e50a1834a243249d1c6100f82fbc59aa01027a56e987
    represented: false

The failing pair of covenants embeds exactly the **owner** lock in one copy and the **executor** lock in the other
(the logical address, a third identity, appears in neither). So a delegate execution builds the same
journal/proof covenant material under two different identities, and the program then requires the two copies
equal. The owner is `descriptor.contract.inner.lockingBytecode`, the executor is
`descriptor.executor.inner.lockingBytecode`; the plan carries both (`ownerParticipantArtifact` vs
`delegateParticipantArtifact`, `effectiveArtifact` at `compose.ts:1141-1143`), which is the seam to follow next:
whichever side materialises the journal/proof copy is using the executor artifact’s identity instead of the
owner’s.

### Round 220: the compiler-side identity split, for whoever picks this up next

One more candidate site, read but not yet proven: `emitCode` (`GenerateTargetTraversal.ts:34791-34839`) resolves
the redeem script of a locking bytecode with two paths — a **fast path** that fires when the address equals the
*currently executing* input’s lock and simply returns `OP_ACTIVEBYTECODE`, and a **slow path** that scans the
inputs for a matching locking bytecode and extracts the redeem from that input’s unlocking bytecode. Under a
delegate execution the executing input is the **executor**, so the fast path yields the executor’s code while the
slow path yields whichever identity was actually asked for. Any covenant built from an “own code” read therefore
differs between owner and executor exactly as the failing pair does, and the builder-derived journal is the place
the second copy comes from.

Concrete next step: find which emitter feeds the journal/proof covenant material with an own-code read (search for
`emitCode` callers and for `OP_ACTIVEBYTECODE` users in the journal/chunk paths, plus the
`usesDelegateExecutorBlockBase()` branches), and make a delegate execution take the owner path — the owner’s
master input is the block base, so `OP_INPUTBYTECODE` at that coordinate is the owner’s code while
`OP_ACTIVEBYTECODE` is the executor’s. Verifying is one fixture compile plus the `take job` family run.

### Round 221: it is not `.code`, it is an entry/chunk covenant

`emitCode` has exactly one caller (`GenerateTargetTraversal.ts:14978`), the `address.code` member access, and that
path already handles delegation correctly: for an authenticated external-call slot it returns the slot master’s
`OP_UTXOBYTECODE`, and the fast `OP_ACTIVEBYTECODE` path only fires when the asked-for address equals the
*current input’s* lock, otherwise the slow scan finds the matching input. So `.code` is not the source of the
mismatch.

More importantly, the compared operands are **287-byte covenants**, while a `.code` result for this contract is
the 130624-byte composed program — two orders of magnitude apart. So the pair being compared are entry/value-chunk
**covenant scripts** (~287 bytes, as the layout’s entry covenants are), each embedding a lock that must be
substituted at run time (a compile-time constant would be identical in both copies, and it is not). The
substitution machinery is the one already read in round 216 (`emitP2sh32FromCovenant`, template placeholders) plus
whatever tracked value supplies the nested lock — and that tracked value is where the owner/executor identity is
picked.

Next probe: at the failing comparison, find which tracked frame entry supplies the nested lock (walk the emitters
that fill the entry-covenant template: the category placeholder is one, the nested-lock placeholder is the other),
then check its source against `usesDelegateExecutorBlockBase()` — that branch is the only place where the
executing input and the owner block base can be confused.

### Round 222: the operands are data blobs, not covenant scripts

Decoding both 287-byte operands from the full-hex trace (`/tmp/r211-full.log`, switch
`SOLIDC_DEBUG_STACK_HEX_BYTES=700`) with libauth gives 28 and 18 "instructions" full of `OP_UNKNOWN…` and stray
pushes — i.e. they are **not scripts at all**, they are data blobs that happen to contain serialized lock
bytecodes (`aa20 <32-byte hash> 87`) as data. That also explains why the known covenant builders are irrelevant:
`buildEntryNftCovenantScript(categoryId, collectionHash)` and `buildDataNftCovenantScript(categoryId)` take only a
category, so neither can be the source of a pair differing in a lock.

The reliable facts from rounds 208-219 therefore stand as: the failing `OP_EQUALVERIFY` (helper 26, reached from
clone ip 4590) compares two runtime blobs whose 32-byte field at byte 83 is the **owner** lock’s redeem hash
(`aa20baa8e3df…b27b3b87`, plan participant 0, `executionKind 1` delegate) in one copy and the **executor** lock’s
redeem hash (`aa20862c6518…a56e7987`, the contract executing at input 127) in the other. Both are embedded as
`aa20<32>87` data, so the pair is a stored-lock comparison — most plausibly two entries of a journal/blob that is
supposed to list one identity.

Next probe (cheap, no run needed to start): take the frame item at depth 45 from `/tmp/r214-clone2.log` and the two
operands, and dump their byte layout side by side (offsets of every `aa20…87` fragment and every length prefix) —
that shows which entry of the blob is the owner lock and which the executor lock, and therefore which builder
wrote a copy with the wrong identity. Raise `SOLIDC_DEBUG_STACK_HEX_BYTES` to ~2500 for the ip-4589 gate to see the
whole 424-byte item in one run.

### Round 223: the record layout, and which field differs

Done offline from the two logs. Each operand is the **same 287-byte record**; the locks inside it sit at fixed
offsets:

    operand d1 (287B):  byte 47  aa20 <owner-lock hash> 87        byte 83  aa20 <owner-lock hash> 87
    operand d0 (287B):  byte 47  aa20 <owner-lock hash> 87        byte 83  aa20 <executor-lock hash> 87

Both records also carry the same P2PKH lock at byte 115 (`19 76a91447d9fe52…88ac`). So the only difference is the
**second lock field**: the owner’s lock in one copy, the executor’s in the other. The record is therefore a
serialized “who owns/preserves this” entry with two lock slots, and one producer filled the second slot with the
executing contract’s identity instead of the participant owner’s.

That is exactly the identity split rounds 219-220 pointed at, now attached to a concrete field: whatever builds
this record must take the lock from the **owner/block base**, not from the active (executing) input. In a delegate
execution the active input is the executor (input 127, `aa20862c…`), while the block base input is the owner
(`aa20baa8…`, plan participant 0).

Next probe, and it should be short: grep the compiler for the emitter that writes a 287-byte record with two
`aa20<32>87` slots (search the emitters that build state/journal records, e.g. anything emitting `OP_CAT`s of a
serialized lock, and the `usesDelegateExecutorBlockBase()` / `emitMasterInputIndex` branches), and check which
identity each slot is filled from. The fix is one substitution: the second slot must use the owner identity under
delegation.

### Round 224: it is the SDK-supplied record that carries the executor lock

Full-frame dump (same recipe, `SOLIDC_DEBUG_STACK_HEX_BYTES=2500`, log `/tmp/r224-frame.log`) maps where each lock
lives at the failing invoke:

    d3   287B  OWNER@47  EXECUTOR@83   <- the record the program COMPARES AGAINST (supplied, not built here)
    d45  424B  OWNER@47                <- the blob helper 26 picks and splits (287B record with OWNER@83 inside)
    d7   179B  EXECUTOR@3

So the two operands are: a **supplied** 287-byte record with the executor lock in its second slot, and a
**runtime-built** record with the owner lock there. The program is right and the supplied record is wrong — this
is an SDK/builder defect, not a compiler one.

It is also absent from the route witness vector: `SOLIDC_DEBUG_WITNESS_SIZES=250,320` prints nothing on this
transaction, and the earlier `300,600` window was empty too, so the record is **derived inside the participant
build** (matching round 214’s conclusion from the logs).

Next probe: read the builder code that serialises records embedding `aa20<32>87` blobs — the parser at
`StatefulTransactionBuilder.ts:9569-9570` (“Proxy/data commitments embed contract addresses as 35-byte aa20..87
blobs”) shows the format exists on the read side, so the write side is nearby; the substitution there must use the
participant **owner** lock (`descriptor.contract.inner.lockingBytecode`) and not the delegate executor’s
(`descriptor.executor.inner.lockingBytecode`) — both are already available in the plan (`compose.ts:1141-1183`).

Where the identity is actually chosen: `graph.ts:2486` picks, per frame, either
`parentExecution.executorLockingBytecode` or `parentExecution.lockingBytecode`, and that value is carried into
`KernelDelegateForwarding.ts` (`executorLockingBytecode` on the frame, consumed at `:270-315`). A delegate record
that must name the state’s owner while the frame names the executor is exactly this choice made the wrong way —
start the next session there, and check every consumer of the frame’s `executorLockingBytecode` that writes a lock
into serialized material rather than using it to identify the executing input.

### Round 226: the record is not an entry commitment

`buildEntryCommitment` (`packages/utils/src/state.ts:1314-1336`) encodes an entry as
`encodePushdata(key) ++ encodePushdata(value)` — key first, then the pushdata-encoded value. The 287-byte record
that fails does not match that shape (two bare `aa20<32>87` locks at fixed offsets plus a P2PKH lock, no key
prefix), so it is not an NFT commitment and not the `slot||next||value` chunk format either. Together with round
215 (not a route witness) and round 224 (the program side is the consistent one), the record is a **kernel witness
record the SDK builds inside the participant build**.

Next probe: find the writer of that record by grepping the SDK for code that concatenates **two** serialized
P2SH32 locks (`aa20…87`) with a P2PKH lock into one blob — the parser at `StatefulTransactionBuilder.ts:9569-9570`
shows the read side, so the write side is nearby — and check which identity it substitutes for the second lock
under delegation.

## Round 228: SOLVED — `address(this)` named the delegate executor, not the participant owner

The round-224 polarity was **backwards**, and that is why the SDK search kept coming up empty. Round 224 read the
frame's `d3` (287 B) as "supplied" and the 424-byte blob at `d45` as "built"; the emitted code says the opposite.

### 1. The pushed invoke operand is a SIGNED script number, not an offset

`PUSH2 8680; OP_INVOKE` at body instruction #4589-4590 pushes `0x8680` little-endian = **-134**, not 32902. Artifact
`debug.invokeDebug` keys ARE those signed ids (MarketplaceV1: -425..127), so every call site can be resolved to a
named body plus its source location. Decoding recipe (kept in `/tmp/trace.mjs`, `/tmp/callers.mjs`,
`/tmp/selfaddr.mjs`): CScriptNum-decode the push before each `OP_INVOKE`, then look the id up in `invokeDebug`.

    span 26  = PICK SWAP SPLIT SWAP ROT EQUALVERIFY        (6 instrs, "outlined source span 26")
    span -134 = PUSH 26; INVOKE; 2; SPLIT; SWAP; BIN2NUM; SPLIT
    span -125 = DUP; SIZE; NIP; 2; NUM2BIN; SWAP; CAT; CAT   (append `u16le(len(B))||B` to A)

So `#4583 PUSH -125; INVOKE` **builds** `R` (the 287-byte record) and `#4589 PUSH -134; INVOKE` requires
`deepBlob[0:len(R)] == R` (span 26 picks the 424-byte item at frame depth 43 and SPLITs it at `len(R)`).

### 2. Which side is which (measured, not inferred)

`SOLIDC_DUMP_FAILING_REDEEM=1` + the `message-bus-failing-input` record give the real witness:
input 127's `unlockingBytecode` (5000 B) contains the 287-byte record **with the owner lock**
(`aa20baa8e3df…`) at byte offset 1942 and **zero** occurrences of the executor lock (`862c6518…`). The program's
own `R` carried the executor lock. Both compared items are therefore program/witness records whose byte-83 field
must be the **participant owner** — the SDK is consistent, the compiler was not.

Exact record layout (287 B, four `aa20<32>87` locks): locks at 2, 45, 81, 167; P2PKH at 117; the two records
differ ONLY at bytes 83..114 = the hash of the lock at 81.

### 3. The emit site

`__message_bus_entry_takeJob` (invokeDebug[59], 5073 instrs — the trace's "clone body") instruction **#3290** is
`OP_INPUTINDEX; OP_UTXOBYTECODE` with source line **725** = `address(this), // owner address` inside the
`EscrowInput(...)` literal. `address(this)` is `Cast(address, tx.inputs[this.activeInputIndex].lockingBytecode)`
(see `LowerSelfLowLevelCalls.isSelfAddressExpr`), i.e. the **executing** input's locking bytecode — under a
delegate execution that is the implementation (executor). The *direct* `unicrow.pay(address(this), …)` argument one
field earlier uses the compiler's owner lane (`GenerateTargetTraversal.ts:18949-18956`, `source.kind ===
'selfAddress'` → `emitMasterInputIndex(); OP_UTXOBYTECODE`) and was correct — hence two `address(this)` values in
one record with two identities.

### 4. Fix (general)

`GenerateTargetTraversal.visitUnaryOp`: when the operator is `INPUT_LOCKING_BYTECODE` over the active-input nullary
and `selfLockingBytecodeNamesParticipantOwner()` (`usesMessageBusOwnerBlockBase() || usesProxyStateBlockBase()`),
emit `emitMasterInputIndex(); OP_UTXOBYTECODE` instead of visiting the operand + `OP_UTXOBYTECODE`. Every
`address(this)` use now resolves through the same authenticated owner authority the `selfAddress` argument lane
already used. For a non-delegated participant owner == active input, so direct routes are byte-for-byte equivalent
apart from one extra `PICK`.

Affected sites in MarketplaceV1 (all `address(this)`, all previously `OP_INPUTINDEX`): lines 300 and 314
(`publishJobPost`: ERC20 spender / transfer recipient), 400 (`updateJobPost`), 577 (`reopenJob`), 725 (`takeJob`),
788 (`payStartJob`). The last one is the `pay start job` failure of the same family. MarketplaceV1 debug bytecode
130587 -> 130738 bytes; no `OP_INPUTINDEX; OP_UTXOBYTECODE` site with an `address(this)` source line remains (the
three that remain are the compiler's own input-preservation helper -4 and two spans).

### 5. Result

`take job > sanity checks` still passes; `take job > take job` no longer fails at input 127 — the record check now
passes and the transaction advances to **input 214**, where a different `OP_VERIFY` fails. Next: run the same
failure-ring recipe with `SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214` (`/tmp/r228-i214.log`) and resolve the failing
instruction with the signed-id decode above before touching any code.

### 6. The next failure (input 214), measured

After the fix the take-job transaction passes input 127 and fails inside input **214** (`MarketplaceDataV1`,
lock `aa20d8b6b264cf07…aa737287`, unlocker redeem 71775 B) with the same raw reason
(`Program failed an OP_VERIFY operation`). Failure-ring recipe that names the instruction in one run:
`SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214 SOLIDC_DUMP_FAILING_REDEEM=1`. The ring is a
40-entry buffer reset on every program switch, so the LAST ring printed before `message-bus-prior-program-ring`
is the failing program's tail.

    failing program: 22869 instructions (the composed MarketplaceDataV1 participant route, not an artifact body:
    no MarketplaceDataV1 invokeDebug entry has that count; the largest is __message_bus_handler_getJobs = 711)
    failing instruction: ip 19254 = OP_EQUALVERIFY
    stack there (top first): [], 03, 35B lock aa209fb7…d879087, 388B record 54001471782e…, 03, 35B lock aa209fb7…,
                            32B e3b0c442…(= sha256 of empty), 32B e5559480…, 388B record …
    => OP_EQUALVERIFY compares the EMPTY item against 0x03 and fails

The loop that precedes it is the compiler's "scan outputs for my covenant" reader
(`OP_DUP OP_TXOUTPUTCOUNT OP_LESSTHAN OP_IF OP_DUP OP_OUTPUTBYTECODE <n> OP_PICK OP_EQUAL OP_IF OP_1 OP_ENDIF
OP_UNTIL OP_DROP OP_EQUALVERIFY`; 24 occurrences in MarketplaceDataV1's bytecode, byte pattern
`76c49f6376cd5479876376d25279528056795479017e95011c937f7782…68667588`), i.e. a state/entry read that produced
**empty** because no output carried the covenant it built.

`aa209fb7da6a861a67db912e57a5f4d30ead21588c61b44092e6491857a5411d879087` is computed by the PROGRAM (it appears
in no artifact, in no composition log, and in no transaction input/output — checked against
`message-bus-locking-groups` and `message-bus-output-summary` of the same run). Tried and failed to reproduce it
offline as `p2sh32(buildEntryNftCovenantScript(cat, collectionHash))` for the five participants' categories
(`a3cef944…`, `ee643a16…`, `b1303bbb…`, `0000…1014`, `2c62df0f…`) crossed with the hashes seen on the stack and in
commitments (`e2a4aac2…`, `e3b0c442…`, `e5559480…`, `cabb7b58…`, 32 zeros) and their 20-byte prefixes, so the
collection hash comes from a signature that has not been guessed yet — enumerate
`computeCollectionHash(dynamicChunkSignature(varName, varType))` over MarketplaceDataV1's `stateLayout` next,
rather than guessing hashes.

Facts that will decide the next step:
- the failing input's own lock is preserved input->output (214 -> 214, contract `MarketplaceDataV1`), so the
  participant block itself is placed correctly;
- nearby groups in the same transaction: `EntryNft_ee643a16` (135->135), `ChunkNft_ee643a16` (150->150, 151->151),
  `ValueChunkNft_ee643a16` (212, 213 -> no outputs), i.e. the delegate participant `ee643a16` is the one whose
  state NFTs the failing read is scanning for;
- the empty hash `e3b0c442…` on the stack (`sha256("")`) means a chunk/collection hash was computed over an empty
  preimage at some point before ip 19205 — widen the `[vm-stack]` gate window (`FROM=19000`) to see which read
  returned empty and whether it is the owner-index pick (`PICK <__internal__messageBusOwnerInput>`) that this
  round's fix introduced at the affected sites.

Decision needed next session: whether the program's computed covenant or the composition's placed output is the
wrong one. `SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=214
SOLIDC_DEBUG_STACK_BODY_LENGTH=22869 SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX=19254 SOLIDC_DEBUG_STACK_BODY_OPCODE=136
SOLIDC_DEBUG_STACK_BODY_FROM=19205 SOLIDC_DEBUG_STACK_BODY_TO=19254 SOLIDC_DEBUG_STACK_DEPTH=60
SOLIDC_DEBUG_STACK_HEX_BYTES=300` reproduces the loop trace used above (`/tmp/r228-i214-stack.log`); add
`SOLIDC_DEBUG_PARTICIPANT_CATEGORIES=1 SOLIDC_DEBUG_SLOT_LOCKS=1` for the participant/slot view
(`/tmp/r228-cats.log`).

### 7. Covenant-identification searches already done (all negative — do not repeat)

Offline reproductions of `9fb7da6a…` = `p2sh32(script)`, computed with the SDK's own builders
(`packages/utils/dist`: `buildEntryNftCovenantScript`, `buildDataNftCovenantScript`,
`buildValueChunkCovenantScript`, `computeCollectionHash`, `dynamicChunkSignature`, `valueChunkSignature`):

- entry covenant for the 6 `MarketplaceDataV1` collections (`jobEvents`, `users`, `arbitrators`, `userRatings`,
  `userReviews`, `meceTags`) and the 1 `MarketplaceV1` collection (`whitelistWorkers`) x all six categories seen
  in the composition (`a3cef944…`, `ee643a16…`, `b1303bbb…`, `0000…1014`, `2c62df0f…`, `3770ad41…`): no match;
- chunk covenants (`dynamicChunkSignature(varName, varType)`) for all 23 state variables of both artifacts x the
  same categories: no match (the method itself is proven live: `userAddresses:address[]` on `ee643a16…` gives
  `aa20e755f2eb65c2ca67…`, which IS transaction input/output 150, `ChunkNft_ee643a16`);
- value-chunk covenants (`valueChunkSignature(collection, slot, root)`) for every var x every pair of the 32-byte
  values seen on the failing frame (`e2a4aac2…`, `e3b0c442…`, `e5559480…`, `cabb7b58…`): no match;
- data-NFT covenants (`buildDataNftCovenantScript`) x the same categories: no match (the method is live too:
  `a3cef944…` gives `aa20f28bad5628c9995c…`, which is `MarketplaceV1`'s own mutable output lock in
  `builder-own-mutable-outputs`);
- `hash256` of every item on the failing 60-item frame: no match.

Also worth knowing before re-deriving the frame: it contains compiler slot placeholders
(`d47` = ASCII `__solidcash_inactive_3d27ed7ae64f857…`) and length-prefixed records in the round-228 format
(`d41` = 205 B starting `23 00 aa20 4c4025f8…`, i.e. participant 0's lock inside a `u16 len || payload` record).
The last frame of the failing check is three-field groups `[lock aa209fb7…][03][value]`: one group carries the
388-byte job record, the group above it carries an EMPTY value, and the `OP_EQUALVERIFY` at ip 19254 is comparing
across the two groups (0x03 vs empty) - i.e. a read that returned nothing, not a value mismatch.

### 8. What the failing read actually builds (round 228, last probe)

`SOLIDC_DEBUG_STACK_BODY_FROM=19050 TO=19212` (`/tmp/r228-i214-wide.log`) shows the covenant being assembled two
instructions before the loop:

    ip 19199  d0 = 31B  76616c75652d6368756e6b b67931b1d91f2263cef8ba12c080d9f5a897ace4
                        = "value-chunk" (VALUE_CHUNK_DOMAIN_TAG, utils/src/state.ts:1813) || 20-byte collection hash
              d1 = 33B  20 f00aca91e9869520a2058881f06d5bb672faf00fe40f483353befb71163a64ee   (push32 fragment)
              d2 = 32B  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855   (= sha256(""))
              d3 = 32B  e5559480def4f0476c3eedcf9eb37a890c4e46b45e6a419f59fcd916705c31eb
    ip 19200  PUSH 1B:a5 (-91); OP_INVOKE   -> returns the 35B covenant at 19201 with d0 = 0x03 (slot 3)
    ip 19201  d1 = 35B aa209fb7…  d0 = 03      <- the covenant the following loop searches outputs for

`computeCollectionHash(signature)` is `sha256(utf8(signature))[:20]`, so the 20-byte part is a *collection hash*.
Brute force over 186 candidate signatures - the 6 `MarketplaceDataV1` collections, the 1 `MarketplaceV1`
collection, all 23 dynamic-chunk signatures, and every `${signature}$valuechunks` variant - produced no match for
`b67931b1d91f2263cef8ba12c080d9f5a897ace4`, and neither did `hash256(tag||ch20)`, `hash256(tag||ch20||slot||root)`
nor the reversed forms equal `f00aca91…`, so the collection/domain preimage is still unnamed. The next probe should
decode the span invoked at ip 19200 (id **-91**) and read which arguments it consumes; that body builds the
covenant and will name the collection directly.

For orientation, the 388-byte value both groups carry is the serialized `JobPost` (title "Create a marketplace in
solidity", token category `e61fa6c6…`, worker P2PKH `c4ad89cd…`, state byte 04, delivery method "digital"), i.e.
the take-job state the participant is reading/writing - so the failing read is about *that* job's value chunks.

## Round 229: input 214 named — the `jobEvents` value-chunk outputs were never materialized

### Reusable tool (this is what made it tractable)

The failing program is NOT an artifact body: it is the SDK-composed **aggregate route body for the
`MarketplaceDataV1` participant**, and it is embedded in the failing input's *redeem* as a top-level data push.
Recipe (offline, no test run): take `/tmp/r228-redeem214.hex` (from `SOLIDC_DUMP_FAILING_REDEEM=1`), decode the
top level, and for every push whose payload decodes to ~20k instructions print `(push index, instruction count)`:

    top #418 push 28099B -> 22869 instrs   <== the failing program
    node /tmp/nested.mjs /tmp/r228-redeem214.hex        # finder
    node /tmp/bigbody.mjs <from> <to>                   # read any ip of that body
    node /tmp/toplevel.mjs                              # <body push> <id push> OP_DEFINE table of the redeem

**`[vm-stack]` gate ip == instruction index in that body**, verified instruction for instruction, so the gate's
stack dumps and the disassembly can be read side by side. The route body's ids are NOT the artifact's
`invokeDebug` ids (the composer renumbers; e.g. composed id -91 is not artifact span -91), so resolve behaviour
from the *local* push/INVOKE pattern plus the trace, not from artifact ids.

### The failing check itself

Instructions #19200-19254 of that body are exactly the compiler's `emitSortedValueChunkPin`
(`GenerateTargetTraversal.ts:20430-20477`): scan every output for the value-chunk covenant, verify each matching
output's commitment (`slot || digest || pushdata(i) || data`), count the matches, then require
`matches == expectedCount`.

    #19209 OP_BEGIN ... #19218 OP_EQUAL (outputs[i].lockingBytecode == expected chunk covenant)
    ... commitment verification #19242 OP_EQUALVERIFY
    #19247 OP_1ADD (i += 1)      #19252 OP_UNTIL
    #19253 OP_DROP               #19254 OP_EQUALVERIFY   <== FAILS: matches == expectedCount

Measured at the failure (frame dumped with the loop window): the scan index reached **469** (`d501` = 0x01d5) and
`matches` is still the initial `OP_0` (the EMPTY item), while `expectedCount` is **3**. So **three value-chunk
outputs were expected for this value and none of the 469 outputs carries the covenant** - the loop never matched
once (a lock match with a bad commitment would abort at #19242, not here).

### Why the covenant is right (so the composition is what is missing)

`SOLIDC_DEBUG_STACK_BODY_FROM=19050 TO=19212` (`/tmp/r228-i214-wide.log`) catches the covenant being built two
instructions earlier: `PUSH31 "value-chunk" || b67931b1d91f2263cef8ba12c080d9f5a897ace4` at ip 19198, then
`PUSH -91; OP_INVOKE` returns the 35-byte covenant (+ the expected count). The 20-byte constant is the compiler's
`computeCollectionHash(valueChunkSignature(collectionName))`
(`GenerateTargetTraversal.ts:20388`), and it matches **`computeCollectionHash('jobEvents$valuechunks')`** exactly
(verified numerically). The SDK's `getValueChunkLockingBytecode` (`covenant-helpers.ts:235-241`) uses the very same
formula, so program and SDK agree on the covenant; the outputs are simply not there.

`convergeMessageBusComputedValueChunkOutputs` (`message-bus/computed-value-chunks.ts`) cannot help: it only
*repairs* locking bytecode/commitment of outputs whose absolute index is already inside a band nominated by the
`__internal__valueChunkOutputBase` witness (`owners`, lines 32-74), and returns early when that set is empty
(line 75). No owned outputs = nothing placed = this failure.

### Next step (one question, then a fix)

Why does this participant build have no published value-chunk output band for the take-job `jobEvents` append?
Look at `compose.ts:2213` (`participant.routeInputs.some(... '__internal__valueChunkOutputBase')`), `:2791` (where
the base is bound), `:3319` (where the ABI input is looked up), and the builder side
`StatefulTransactionBuilder.ts:6448-6463`, `13886-13889`, `14396-14454`, `14617-14620`, `14822-14830`, `14942`
(absolute/materalized base chain). This is the same "one exact compiler-published resource lane" gap that also
produces `refuse arbitration > job not taken`, so fixing the lane publication should move both.

### Round 229b: the two collection hashes for `jobEvents` (do not confuse them)

`SOLIDC_DEBUG_ATOMIC_GRAPH=1` (`/tmp/r229-graph.log`) prints `atomic-computed-value-chunk-span` for participant 1
(the `MarketplaceDataV1` delegate, base 129): `spanClaimCount: 0`, `materializedClaimCount: 2`, claims at absolute
offsets 212/213 with parts `chunk:0`/`chunk:1` and

    resourceIdentity = ee643a16…:3b2d866bd1609f8e5ecba9237c8ed605816d1946:e3b0c442…(sha256(""))

Those two offsets are exactly the `ValueChunkNft_ee643a16` **inputs** 212/213 of the same transaction (they have no
outputs), i.e. they are the *predecessor* chunks of the value being overwritten. The program under investigation
expects **3** chunks to be *created* (`expectedCount` = 3) and finds none, so the write-side run is the one that
was never materialized.

Numeric identification of the three candidate preimages (all via `computeCollectionHash` = `sha256(utf8(s))[:20]`):

    'jobEvents$valuechunks'                                  -> b67931b1d91f2263cef8ba12c080d9f5a897ace4   (value-chunk domain, used by the covenant)
    'jobEvents:mapping(uint256 => JobEventData[])'           -> 3b2d866bd1609f8e5ecba9237c8ed605816d1946   (entry/chunk collection; also the constant in invokeDebug['6'])
    'jobEvents:mapping(uint256 => JobEventData[])$valuechunks' -> 758cc1fff0ca06e4f34a1dbbd1cdd8201d9a2421 (nobody uses this)

Where each side stands:
- on-chain verification: `GenerateTargetTraversal.ts:20388` `computeCollectionHash(valueChunkSignature(collectionName))` = `b67931b1…`, and the SDK's covenant helpers agree when given the *name* (`covenant-helpers.ts:235-241`, `createValueChunkUnlocker`);
- SDK write-descriptor bookkeeping: `StatefulTransactionBuilder.ts:1368-1370` builds `ValueChunkWriteDescriptor`
  resource identities from `write.collectionHash`, and `validValueChunkWriteIdentity` (`:1374-1381`) *requires*
  `collectionHash === computeCollectionHash(write.collectionSignature)` - i.e. the identity label is derived with
  the **entry** formula (`3b2d866b…`), not the value-chunk formula (`b67931b1…`).

Next question (one read, no run): is `ValueChunkWriteDescriptor.collectionHash` ever used to *derive the covenant
lock* of the outputs a write run materializes, or only as a bookkeeping key? If it derives a lock, that is the
whole input-214 bug (a resource whose identity is computed with the entry formula while the contract's own
verification uses the value-chunk formula). If it is only a key, the missing piece is instead the *write-side*
continuation lane for the delegate participant (`compose.ts:2791` binds `__internal__valueChunkOutputBase` only
when `transportedChunkCount > 0`, and `computed-value-chunks.ts` refuses to place anything outside an owned band).

### Round 229c: the descriptor hash is NOT the value-chunk covenant source (one question closed)

`persistUpdateDigestLock` (`StatefulTransactionBuilder.ts:5259-5275`) is the only place a lock is derived from
`write.collectionHash`: it builds the **entry-NFT** covenant (`buildEntryNftCovenantScript`) with
`computeCollectionHash(write.collectionSignature)` - correct for entry NFTs, and consistent with
`invokeDebug['6']`. Value-chunk covenants never see that field: they are built from the *collection name* through
`valueChunkSignature` on both sides (`GenerateTargetTraversal.ts:20388`,
`covenant-helpers.ts:235-241`). So the two-collection-hash observation above is a naming trap, not the bug.

What remains for input 214 is therefore the *write-side* run: the participant that appends the job event publishes
no `__messageBusComputedValueChunkSpanClaims` entry for the new value (spanClaimCount 0, only the two read-side
claims at inputs 212/213), and `convergeMessageBusComputedValueChunkOutputs` can only repair outputs inside a
nominate band - with no band it places nothing, and the program's write-time pin (`matches == expectedCount`, 3)
fails having scanned all 469 outputs. Trace the claim producer next:
`StatefulContract.ts:36612` / `:36682` (where the two metadata arrays are attached) and the value-chunk write
descriptors that feed them (`StatefulTransactionBuilder.ts:26250-26276`, `30896`).

## Round 230: the lane exists in the artifact; the *width* and the *staged value* are what is missing

### Positive finding: the compiler publishes the lane for the failing writer

The artifact's ABI entries that carry the hidden `__internal__valueChunkOutputBase` parameter are, verbatim from
`.marketplace/artifacts/solidcash/MarketplaceDataV1.json`: `initialize`, **`publishJobEvent`**, `registerUser`,
`updateUser`, `userRefunded`, `userDelivered`, `registerArbitrator`, `updateArbitrator`, `arbitratorRefused`,
`arbitratorSettled`, `updateMeceTag`, `addReview`, and `messageBus.route`. So the parameter-injection gate
(`SymbolTableTraversal.ts:4092-4112`, "writes a sorted chunkable mapping value") **does** fire for
`publishJobEvent`, and the SDK only binds it when `transportedChunkCount > 0` (`compose.ts:2791`). The compiler side
of this lane is therefore not the gap; the composition is.

### What is actually missing in the failing participant build (provable from the code paths + measurements)

`StatefulContract.ts:36550-36610` builds the two metadata arrays from `stb.getValueChunkWriteDescriptors()`:

    span claims:        skipped exactly when `write.outputBase < 0 || write.outputCount === 0`   (=> spanClaimCount 0)
    materialized claims: `Math.max(1, write.outputCount, commitments.length)` per chunk          (=> count 2)

Measured for participant 1 (the `MarketplaceDataV1` delegate, base 129) in every composition of the failing
transaction: `spanClaimCount: 0`, `materializedClaimCount: 2` at absolute offsets **212/213**, resource
`ee643a16…:3b2d866b…:e3b0c442…`. Reading those two lines together gives the state of the descriptor:

    outputBase  = 212   (resolved)
    outputCount = 0     (UNRESOLVED WIDTH)
    staged raw commitments = 2

With `outputCount === 0` no span claim is published, so `minimumActualSizeForComputedValueChunkClaims` reserves
nothing, the convergence pass finds no owned outputs (`computed-value-chunks.ts:74-75` returns early) and nothing is
materialized. `SOLIDC_DEBUG_VALUE_CHUNKS=1` corroborates: `append-value-chunks` never fires anywhere in the
transaction, i.e. no value chunks are ever staged into a build.

### The two candidate root causes, and why the second one explains `matches = 0`

1. **Width**: `getChunkableValueWriteBand()` (`StatefulTransactionBuilder.ts:8606-8775`) derives `nNew` from
   `computePublishJobEventsBand({ plannedWidth, jobEventsCount, liveWidth })` for the writer selected by
   `_chunkableValueWriteExecution()` / `_chunkableValueWriteGroups()` (`:8293-8360`, which pick among
   low-level/external call groups with `allowCompilerDescribed: composedParticipant === true`). If the selected
   group's planned width is 0 for an *append* whose new length is only known at runtime, `outputCount` stays 0.
2. **Stale staged value** (explains the failing *count* as well): the program's own arithmetic gives
   `nNew = ceil((size(v) - 28) / 56)` and it computed **3**, i.e. the value it writes is > 140 bytes; the SDK's
   staging reports **2** chunks, which is exactly the range `84 < size <= 140`. Because the chunk covenant's domain
   includes the value digest, pre-value chunks have *different* locks, so the program's scan does not even see the
   2 staged chunks - matching the measured `matches` still being the initial `OP_0` after scanning 469 outputs.
   Pursuing this: `stagedValueChunkWrite(write, stagingSession)` / `getValueChunkRawCommitments` for the
   `publishJobEvent` append - does the staged value include the appended `JobEventData`?

Recommended next probe: instrument-free, one run - `SOLIDC_DEBUG_VALUE_CHUNKS=1 SOLIDC_DEBUG_ATOMIC_GRAPH=1` plus
`SOLIDC_DEBUG_ENTRY_COUNTS=1 SOLIDC_DEBUG_CHUNK_SHIFT=0` shows the band computations for the writer, and comparing
`stagedValueChunkWrite`'s blob length against the program's `expectedCount` (3) distinguishes cause 2 from cause 1
in a single measurement.

### Round 230b: the arithmetic settles it - the SDK's derived value is missing the appended event

The emitted pin uses `VALUE_HEAD_SIZE` = 0x1c = **28** and `VALUE_CHUNK_SIZE` = 0x7e = **126**
(`utils/src/state.ts:1434-1436`: `VALUE_CHUNK_SIZE = 128 - VALUE_CHUNK_INDEX_SIZE(2)`), and the SDK uses the same
constants, so the two sides chunk identically: `nNew = ceil((len - 28) / 126)`.

Reading the failing frame against the emitted frame layout `[i, matches, nNew, address, value]` gives
`i = 0x01d5 = 469`, `matches = OP_0` (empty), `nNew = 3`, `address = aa209fb7…`, and the **value is the 388-byte
record** (`54001471782e…`): `ceil((388-28)/126) = ceil(2.857) = 3` - exactly the program's `expectedCount`. That
record is the serialized `jobEvents[jobId_]` array (five `5efb5565` entry tags, three `47d9fe52…` address fields and
the 65-byte `bedae1ac…` signature handed to `takeJob`), i.e. the *post-append* events array.

The SDK, for the same write, reports **2** chunk claims: `2 <= 28 + 2*126 = 280 < 388`, so the value it
derived/staged for that resource is the **pre-append** array. Because the chunk covenant's domain includes the
value digest, the pre-value chunks do not even match the program's expected locks - which is why the scan ends with
`matches` still at its initial empty value rather than at 2.

Conclusion: the program is right and the SDK's *derived continuation value* for the callee-side `jobEvents` append
is stale by one event. Next probe, no new instrumentation needed: `extractAllRouteValueChunks`
(`StatefulContract.ts:2373-2430`, candidates: `stagedValueChunkWrite(write, stagingSession)` then the VM-tail
candidates) - check whether the staged blob for `publishJobEvent` includes the appended `JobEventData`, and where
the pre-value wins (`stagedCandidates` vs `producerAuthenticatedCandidate` vs the tail reconstruction).

### Round 230c: the compiler metadata for the append is complete - the loss is at runtime

The SDK derives the transported continuation value from
`deriveChunkableArrayValueChannels({ preValueWitness, storedPreValue, leadingMutation, currentElement })`
(`StatefulContract.ts:1875-1896`): `postValue = storedPreValue (+leadingMutation) (+currentElement)`, and
`currentElement` is only produced when

    terminalStored?.rowAccess.arrayMutation === 'push'
      && terminalStored.rowAccess.storedElementSource?.version === 1     (StatefulContract.ts:26186-26195)

with `terminalStored = storedRows.at(-1)` and `storedRows` built from `effectiveRowArguments` x handlers'
`entryAccesses` for this collection. The artifact side is **complete**: the `jobEvents` entry access carries
`"operations": ["read","write"]`, `"chunkableArrayValue": true`,
`"storedElementSource": { "version": 1, "mutationEffectOrdinal": 1, "elementType": "JobEventData", "expression": { kind: "call", name: "JobEventData", ... } }`
and a sibling `"arrayMutation": "push"` (`.marketplace/artifacts/solidcash/MarketplaceDataV1.json`, byte offsets
~13824/15583), and `atomic-transported-value-productions` does fire for participant 1 with `count: 1` for exactly
this resource. So the write *is* recognised and transported; only its **value len** is short (2 chunks instead of 3,
i.e. `postValue` lost the appended `JobEventData`).

Decisive next probe (one temporary, uncommitted print + one build + one run, then revert): at
`StatefulContract.ts:26202` log `{ storedRows: storedRows.length, arrayMutation: terminalStored?.rowAccess.arrayMutation,
storedElementSourceVersion: terminalStored?.rowAccess.storedElementSource?.version,
currentElementBytes: currentElement?.length, postValueBytes: nextValue.length, preValueBytes: storedPreValue.length }`.
`postValueBytes <= 280` with `currentElementBytes === undefined` and `storedRows === 0` means the *row attribution*
(`effectiveRowArguments` for the delegate participant's `publishJobEvent` call) is empty; `storedRows > 0` with a
non-`push` mutation or a missing recipe version means the compiler/SDK operation naming drifted instead.

### Round 230d: MEASURED - the derivation is correct; the SDK's *pre-value* for the resource lags the chain

One temporary print at `StatefulContract.ts:26202` (uncommitted, reverted and rebuilt afterwards) captured every
chunkable-array derivation in the failing title:

    {"collection":"jobEvents","storedRows":1,"arrayMutation":"push","storedElementSourceVersion":1,
     "currentElementBytes":204,"postValueBytes":205,"preValueBytes":1,"chunkCount":2}
    {"collection":"jobEvents","storedRows":2,"arrayMutation":"push","storedElementSourceVersion":1,
     "currentElementBytes":28,"postValueBytes":233,"preValueBytes":1,"leadingBytes":205,"chunkCount":2}
    {"collection":"jobEvents","storedRows":1,"arrayMutation":"push","storedElementSourceVersion":1,
     "currentElementBytes":60,"postValueBytes":293,"preValueBytes":233,"chunkCount":3}
    {"collection":"jobEvents","storedRows":1,"arrayMutation":"push","storedElementSourceVersion":1,
     "currentElementBytes":95,"postValueBytes":328,"preValueBytes":233,"chunkCount":3}

So `currentElement` IS produced (row attribution and the compiler recipe are both fine) and the SDK's own chain of
`jobEvents` values is internally consistent: 205 -> 233 -> 293 -> 328 bytes across the successive builds. The
program under test, however, chunks a **388-byte** value. The difference is 60 bytes, i.e. exactly one
`JobEventData` element (the second record's `currentElementBytes` is 60), so the SDK's *pre-value*
(`childStoredValues.get(routeSlot)`, `storedPreValue`) is one appended event behind the state the executing program
reads. Both values happen to span 3 chunks, so the *counts* agree while the **digests - and therefore the chunk
covenants - differ**, which is exactly why the program's scan matches nothing and fails `matches == expectedCount`
(0 vs 3), and why `atomic-computed-value-chunk-span` reported `materializedClaimCount: 2` for an unrelated
2-chunk staging earlier in the run.

Next probe: find who assembles `storedPreValue` for the `jobEvents` route slot (`childStoredValues`, the
read-side chunk assembly behind `getValueChunkRawCommitments` / `chunksFromValue`) and why it is one event behind
the chain - most likely the *entry/chunk read* used to seed the value, not the append derivation itself (which this
round measured to be correct).

## Round 231: the program is self-consistent; the failing composition never derives the write at all

### The 388-byte value is the `jobEvents` value, digest and all

Re-extracted the 388-byte item from the failing frame (`/tmp/r228-i214-wide.log`, ip 19199, the 388-byte item;
saved as `/tmp/jobevents-value.hex`) and hashed it:

    sha256(value) = e5559480def4f0476c3eedcf9eb37a890c4e46b45e6a419f59fcd916705c31eb

which is exactly the 32-byte item the program carries next to the covenant (`e5559480…`, see round 229b), i.e. the
program chunks *this* value and builds the `jobEvents` value-chunk covenant from *this* digest - the on-chain side
is fully self-consistent (`ceil((388-28)/126) = 3` chunks, matching `expectedCount = 3`).

### The failing composition derives nothing for that write

Two temporary prints (uncommitted, reverted, SDK rebuilt clean; logs `/tmp/r230-append.log`,
`/tmp/r231-scan.log`) show that the caller-side chunkable-value derivation
(`StatefulContract.ts:26136-26202`, the loop over `selectedFn.entryAccesses` for `write` accesses with
`collection.chunkableValue`) runs for `publishJobEvent`/`jobEvents` only **three times in the whole test**:

    log line  5697  publishJobEvent jobEvents  storedRows 1  pre   1  elem 204  post 205   2 chunks
    log line  5700  publishJobEvent jobEvents  storedRows 2  pre   1  elem  28  post 233   2 chunks  (leading 205)
    log line 18340  publishJobEvent jobEvents  storedRows 1  pre 233  elem  60  post 293   3 chunks
    log line 19113  publishJobEvent jobEvents  storedRows 1  pre 233  elem  95  post 328   3 chunks
    log line 18639  fn 'pay'        escrows    storedRows 1                                (Unicrow, unrelated)

All four are in *earlier* sends. The failing send's composition logs start far later (`builder-own-mutable-outputs`
records at ~37k, failure at ~39.5k in the same log), and no derivation or access-scan record belongs to it. Its
participant 1 prints an `atomic-computed-value-chunk-span` record with `spanClaimCount: 0` and only a
**materialized read-side claim** (`chunk:0` at offset 213, i.e. the predecessor chunk being consumed), so the
build reserves no write band, `convergeMessageBusComputedValueChunkOutputs` has no owned outputs, and nothing is
materialized - which is exactly what the program's pin then reports as `matches == expectedCount` (0 vs 3).

So the earlier framing "the SDK's derived value is stale" was wrong: the SDK derives **nothing** for the failing
send. The write lane is only ever derived for the *non-delegated* sends; the delegated take-job send never reaches
that path.

Next probe: find which composition path handles a `publishJobEvent` row when the *caller/callee participants are
delegates* (`executionKind 1`, `compilerRouteDelegateBlock` geometry) and why it skips the chunkable-value
derivation - i.e. compare the call that produced the records at 18340/19113 with the failing send's equivalent
call (same source call, different participant geometry). The `childLayout.collections` /
`selectedFn.entryAccesses` pair used by that loop is the thing to compare between the two sends.

## Round 232: ROOT CAUSE of input 214 - the promoted atomic-graph path never derives the chunkable-value write

`SOLIDC_DEBUG_ATOMIC_PROMOTION=1` on the failing title (`/tmp/r232-promo.log`) prints nine `atomic-promotion`
records. The first eight (all the *earlier*, working sends) read

    {"root":"__forward","requiresAtomicPromotion":false,"allRoutesEligible":true, ...}

and the **ninth and last one - the take-job send that fails at input 214 - reads**

    {"root":"__forward","requiresAtomicPromotion":true,"allRoutesEligible":true,
     "nodes":[takeJob@MarketplaceV1, userRegistered@MarketplaceDataV1, eventsLength@MarketplaceDataV1,
              publishJobEvent@MarketplaceDataV1, approve@FakeToken, getArbitratorFee@MarketplaceDataV1,
              pay@Unicrow, balanceOf@FakeToken, transferFrom@FakeToken, balanceOf@FakeToken,
              setArbitrator@UnicrowArbitrator, publishJobEvent@MarketplaceDataV1]}

with two `publishJobEvent` rows ✓. The code path that follows from that flag explains every measurement of rounds
229-231:

- `requiresAtomicPromotion: true` builds `preparedAtomicNodes` (`StatefulContract.ts:24526`, set from
  `resolvePreparedKernelDelegateExecution` - i.e. exactly the delegate/proxy-forwarding case);
- the plain nested-external-call composition - `for (const nested of publishedNestedExternalCalls)`
  (`:24583`), which contains the chunkable-value derivation and both staging calls
  (`stageOwned` `:26269`, `stageValueChunkWrite` `:26295`) - sits inside `if (!preparedAtomicNodes && abiFunction)`
  (`:24486`) and is therefore **skipped entirely**;
- the prepared path (`:26832+`) has its own value-chunk plumbing (`valueChunkProductionsForPath(producerPath)`,
  producer epochs, physical groups) but publishes no claim for this write - measured: participant 1's record is
  `spanClaimCount: 0` with only a read-side materialized claim, and no derivation/access-scan record belongs to
  the failing send;
- with no band reserved, `convergeMessageBusComputedValueChunkOutputs` has no owned outputs and materializes
  nothing, so the on-chain pin (`matches == expectedCount`, 3 expected, 0 matched over 469 outputs) fails.

This is why every earlier `post job`/`update job`/`refund` send derives and materializes its chunks correctly while
the delegated take-job send does not: those sends have `requiresAtomicPromotion: false` and take the plain path.

**Fix locus (general, not marketplace-specific):** make the promoted/prepared path publish the chunkable-value
write lane. Either have it perform the same derivation and staging as the plain path (the shared helpers are
`deriveChunkableArrayValueChannels` + `stageValueChunkWrite` / `stageOwned`, with the geometry the plain path
already computes from `selectedFn.entryAccesses`), or let chunkable-value writes keep composing through the
derivation path when the graph is promoted. Any chunkable-value state write inside a promoted atomic graph loses
its value-chunk outputs today, so this is a kernel-level gap rather than a marketplace quirk.

## Round 233: line-level root cause - a shared compiler route covers the call and drops the write lane

Correction to round 232: the derivation is NOT skipped because of `preparedAtomicNodes` directly (that guard at
`:24486` closes at `:24538`). The real gate is

    :25141  const sharedCompilerRouteCoversCall = sharedGroupIndex >= 0
              && logicalSelector !== undefined
              && externalCallUtxoGroups[sharedGroupIndex].compilerRoute?.logicalSelectors
                   .includes(logicalSelector) === true;
    :25157  if (!proxyCallee && !sharedCompilerRouteCoversCall) childWritesState ||= selectedFn?.writesState === true;
    :25160  if (sharedCompilerRouteCoversCall) childWritesState = false;      // <== forces the flag off
    :25567  if ((sharedGroupIndex < 0 || childWritesState) && selectedLayout && selectedLayout.blockSize > 1) {
    :26112    refreshChunkableRouteWitnesses = (...) => { ... }               // the chunkable-value derivation
    :26136      for (const [routeSlot, access] of (selectedFn?.entryAccesses ?? []).entries()) { ... }
    :26311      publishRouteValueChunkProducerBinding(...claims, stateOwner, productions...)   // <== the lane
    :26321    const refreshed = refreshChunkableRouteWitnesses(...) }

With a shared route covering the call, `sharedGroupIndex >= 0` and `childWritesState === false`, so the block at
`:25567` never runs: the closure is never assigned, the derivation never executes, `publishRouteValueChunkProducerBinding`
is never called, and the prepared path's `valueChunkProductionsForPath(producerPath)` (`:26851`) - which filters
`latestRouteValueChunkProducerBinding.productions` - returns `[]`. No productions -> no claims -> no reserved band ->
`convergeMessageBusComputedValueChunkOutputs` places nothing -> the on-chain pin fails
(`matches == expectedCount`, 0 of 3 over 469 outputs).

Why the failing send and not the earlier ones: the promoted graph pre-plans the whole transaction, so *every*
call is already covered by the pre-created shared route (`takeJob`'s two `publishJobEvent` rows, the `approve`
branches, etc.), whereas the non-promoted sends create the route from the first logical call and derive the write
there. The artifact is fine (`publishJobEvent` has `writesState: true`, `blockLayout`, and the `jobEvents` entry
access carries the complete append recipe).

The code's own intent comment (`:25131-25137`) says what must NOT break: covered calls are deliberately
"shared logical groups only", because "planning their ordinary handler layouts again would require a second master
and, for an absent vmap key, invent a trailing insert slot that the direct handler deliberately does not have."

**Fix plan (narrow and general):** keep the shared-logical-group behaviour for masters/insert slots, but still run
the chunkable-value derivation for the route's rows and publish the producer binding. Concretely: extract the
`for (const [routeSlot, access] of (selectedFn?.entryAccesses ?? []).entries())` derivation (currently inside
`refreshChunkableRouteWitnesses`) into a helper that does not touch funders/childBlockInputs/witness refresh, and
call it for the covered case with `childCompilerRoute.rowArguments` as the rows, publishing via
`publishRouteValueChunkProducerBinding`. Verify with the `take job` family only (`append-value-chunks`,
`atomic-transported-value-productions`, `atomic-computed-value-chunk-span` should then report the write lane).

### Round 233b: the route has the room (so the fix is only about publishing the claim)

`MarketplaceDataV1`'s shared route `__message_bus1` publishes
`blockSize 85, trailingBase 21, trailingCapacity 64` with `trailing@21 … trailing@84`, i.e. **64 reserved
continuation slots**. The per-handler layouts are much smaller (`publishJobEvent`: `blockSize 5`, slots
`master@0, dataNft@1, dataNft@2, entry@3, event@4`, no trailing band), which is exactly why the covered call must
not re-plan a handler layout (round 233's intent comment) but *can* publish its value-chunk claim against the
route's already-reserved trailing band. So the fix does not need new geometry: it needs the derivation to run for
the route's rows and publish the producer binding, and then the existing convergence pass will materialise the
chunks into the route's trailing slots.

## Round 234: correction - the PLANNER does produce the write; the loss is in the prepared-call composition

Two results this round, both narrowing the fix.

**1. The one-line probe failed.** Keeping `childWritesState = true` for `sharedCompilerRouteCoversCall` (i.e. letting
the `:25567` block run) changed nothing: `take job` still fails at input 214 with the same `OP_VERIFY`, `sanity
checks` still passes. So the failing call never reaches the nested-call composition at all - consistent with the
promoted send going `__preparedAtomicCalls` -> `compose({ preparedCalls })`
(`StatefulContract.ts:37384-37433`), bypassing that whole path. The probe was reverted.

**2. The planner already knows about both appends.** The `atomic-promotion` record for the failing send (printed by
`StatefulContract.ts:32893-32930`) carries `valueChunkProductionCount` per node:

    publishJobEvent@MarketplaceDataV1  callsiteId 2  valueChunkProductionCount 1
    publishJobEvent@MarketplaceDataV1  callsiteId 8  valueChunkProductionCount 1
    (every other node in the transaction: 0)

and the prepared-call freeze at `:32924-32940` copies `node.valueChunkProductions` into
`__preparedAtomicCalls` ✓. So round 231's "the failing send derives nothing" was about the *composition-path*
derivation only - the productions exist and are handed to the composer.

Therefore the loss is downstream, in `message-bus/compose.ts`'s prepared-call handling:
`valueChunkProductions` -> `valueChunkProductions` map (`:2680-2740`, identity/terminal-producer selection) ->
`transportedValueChunks` + `transportedChunkCount` (`:2760-2770`) -> `valueChunkSlots = trailing slots`
(`:2758`) -> `internalRouteWitnesses.__internal__valueChunkOutputBase = participantInputs + selectedValueChunkSlots[0].offset`
(`:2791`) -> callee rebuild -> `convergeMessageBusComputedValueChunkOutputs`.

Next probe (one run, all existing gates): `SOLIDC_DEBUG_ATOMIC_GRAPH=1` and look for
`atomic-transported-value-productions` for participant 1 in the *failing* composition - round 229 recorded
`count: 1` for participant 1, so check whether the *count* and the resource identity there match the planner's two
productions (one per `publishJobEvent` row), whether `__internal__valueChunkOutputBase` is bound for that
participant (the `atomic-computed-value-chunk-span` record prints only when claims exist *or* the route input is
present), and whether the convergence pass then reports repairs for the claimed offsets. The likely gap is the
terminal-producer selection at `:2715-2740`: it keeps the highest mutation ordinal per resource, and both rows
write the *same* resource (`category:3b2d866b…:<slot>`), so one of the two productions may be dropped before
`transportedChunkCount` is computed - which would size the band for one append instead of two.

## Round 235: the productions are threaded through `_batchRaw`; check the per-row value accumulation

Plumbing traced: `_batchRaw(...)` (`StatefulContract.ts:7151`) takes `valueChunkProductions` as an option (`:7162`)
and hands it to both the route builder options (`:7692`) and the `StatefulFunctionCall` options (`:7699`), together
with `rowArguments` carrying each row's own `args`/`internalArgs` (`:7674-7681`). That is the path by which the
planner's per-row productions (round 234: `valueChunkProductionCount: 1` on *each* of the two
`publishJobEvent` nodes) reach the prepared call and then the composer.

The accumulation helpers `createValueChunkProducerArgumentEpoch` / `advanceValueChunkProducerArgumentEpoch` /
`valueChunkProducerArgumentsInEpoch` are defined in `stateful/ValueChunkProducerIdentity.ts:39-70` and are called
from exactly one place in the whole SDK: the prepared path's route refresh
(`StatefulContract.ts:26845-26881`). The plain composition path instead accumulates leading rows through
`leadingMutation`/`encodeLeadingRouteArrayPushes` + `deriveChunkableArrayValueChannels` (`:26171-26201`).

**Hypothesis to test next (matches the measured 60-byte digest gap exactly):** for a batch of two appends to the
same resource, the planner emits one production per row, each computed from the same pre-value with only its own
element, and the composer's terminal-producer selection (`compose.ts:2715-2740`, highest mutation ordinal per
resource) then keeps the *terminal* production whose value lacks the *sibling* row's element. The program (which
reads the real pre-state and appends both) chunks 388 bytes; the terminal production would chunk 328 - same chunk
count (3), different digest, hence different value-chunk covenants, hence `matches == 0` at the pin.

Next probe: find the `_batchRaw` caller in the planning walk that passes `valueChunkProductions` and read how it
computes each row's production value (does it use the argument-epoch accumulation, or does each row start from the
same pre-value?), then compare the terminal production's byte length against the program's 388.

## Round 236: the productions DO reach the composer with a refresher - only the terminal value is in question

Plumbing completed (all read, no code changes):

- the builder factory `_createBuilder(...)` accepts `valueChunkProductions` overrides and stages each one into a
  fresh `ValueChunkWriteStagingSession` through `stageOwned` (`StatefulContract.ts:18003-18017`), throwing if the
  production cannot be staged for its exact resource;
- the route/wrapper plumbing passes them on (`:7692`, `:7699`, and `:38865`
  `valueChunkProductions: this.compilerRoute.valueChunkProductions`);
- the prepared-call freeze copies both the productions **and** the refresher
  (`:32939-32948`, `resolveValueChunkProductionsFromArgs: node.resolveValueChunkProductionsFromArgs`), so nothing
  is dropped at freeze time;
- `compose.ts:236-245` (`rebuildPreparedInvocation`) recomputes productions from changed args through that
  refresher and **throws** if args changed without one - so there is no silent loss there either;
- `compose.ts:2672-2715` collects them into a map keyed by resource identity and `:2715-2740` keeps the highest
  mutation ordinal per resource by design ("only the terminal write persists").

So the two rows' productions both arrive, one is selected as terminal (correct by design), and the lane binding
depends only on the terminal production's `value`: `chunksFromValue(production.value, …)` ->
`transportedChunkCount` -> `valueChunkSlots` -> `__internal__valueChunkOutputBase` (`compose.ts:2760-2791`).

**Decisive next probe (one temporary print, one run):** at `compose.ts:2676`, log
`{ invocationIndex, resource: valueChunkWriteResourceIdentity(production.write), valueBytes: production.value.length,
chunkCount: chunksFromValue(production.value, …).length, ordinal: production.claim.producer.mutationSourceEffectOrdinal }`
for every production, and after the terminal selection log the surviving production's `valueBytes`. Compare with the
program's 388 bytes (digest `e5559480…`). `valueBytes === 388` means the value is right and the loss is in the band/
lane binding or the convergence pass (check `__internal__valueChunkOutputBase` for participant 1 and the repair
rounds); `valueBytes === 328` (or anything < 388) confirms the multi-row accumulation hypothesis of round 235 and
the fix belongs in the planner's per-row production value (accumulate the sibling rows, as the plain path does with
`leadingMutation` / `createValueChunkProducerArgumentEpoch`).

## Round 237: MEASURED - every production value is short; the terminal one must be 388

One temporary print at `compose.ts:2676` (uncommitted, reverted, SDK rebuilt; log `/tmp/r237-prod.log`) printed
every production the composer sees:

    {"participant":1,"invocationIndex":3, "resource":"ee643a16…:3b2d866b…:e3b0c442…","valueBytes":328,"ordinal":1}
    {"participant":1,"invocationIndex":11,"resource":"ee643a16…:3b2d866b…:e3b0c442…","valueBytes":293,"ordinal":1}
    {"participant":1,"invocationIndex":7, "resource":"ee643a16…:3b2d866b…:e3b0c442…","valueBytes":205,"ordinal":1}
    {"participant":1,"invocationIndex":8, "resource":"ee643a16…:3b2d866b…:e3b0c442…","valueBytes":233,"ordinal":1}

Key facts, all measured:

- **Never 388.** The largest production is 328; the program on chain chunks **388** (digest `e5559480…`, verified by
  hashing the frame value in round 231). So no production can ever produce the chunk covenants the program
  verifies - the pin fails with `matches == 0`, exactly as observed.
- **Both rows of a batch carry the same resource identity and `ordinal: 1`**, so the terminal selection
  (`compose.ts:2715-2740`, strictly-greater comparison) keeps whichever is processed last, and there is no
  "post-state after both rows" value anywhere.
- **The arithmetic closes exactly**: pre 233 (`233 + 95 = 328`, `233 + 60 = 293`) while the program's value is
  `233 + 95 + 60 = 388`. Both rows therefore produce `pre + ownElement` and neither includes the sibling's element.
  Round 235's hypothesis is confirmed with numbers.

Where the per-row value is produced is still open, but the shape is now unambiguous: the two rows of one batch share
one producer path, and the value handed to each production must accumulate the *sibling* rows (pre + every
element), not just its own. Next probe: read `_encodeStoredElementSource` / `appendEncodedArrayElement` and the
epoch helpers' use at `StatefulContract.ts:26845-26896` (`createValueChunkProducerArgumentEpoch(runtimeRows…)` does
receive *all* rows, so inspect what `valueChunkProducerArgumentsInEpoch(epoch, producerPath)` /
`valueChunkProductionsForPath(producerPath)` return for two rows that resolve to the *same* path - the collapse to
one path is the likely reason each row ends up with only its own element), then make the terminal production for a
resource equal the post-state of every row that writes it.

## Round 238: why each row sees only its own element - the rows are derived one call at a time

The derivation in the prepared path is invoked per **call**, with that call's rows only:

    :26832  if (preparedAtomicNodes) {
    :26834    const runtimeRows = childCompilerRoute?.rowArguments ?? directInvocationRows;
    :26845    let routeArgumentEpoch = createValueChunkProducerArgumentEpoch(
    :26846      runtimeRowsWithProducerPaths.map(({ row, producerPath }) => ({ producerPath, args: row.args })),
    :26851    const rowValueChunkProductions = valueChunkProductionsForPath(producerPath);

and `valueChunkProductionsForPath` filters the published binding's productions by the *canonical producer path*
(`:25544-25556`), while the epoch is keyed by that same path and **refuses duplicate paths**
(`ValueChunkProducerIdentity.ts:39-53`, "duplicate producer path"). The two `publishJobEvent` rows of one batch have
*different* callsite ids (2 and 8) and therefore different paths, so they are composed as two independent logical
calls - each with `runtimeRows` = one row - and each derives `pre + its own element` (measured 328 and 293 from the
same pre 233). No code path ever sees both rows together for this resource, so the terminal production is never the
post-state of the whole batch (388).

The plain composition path does accumulate, because it is handed the whole row list and uses
`encodeLeadingRouteArrayPushes(rowArguments)` + `deriveChunkableArrayValueChannels({ storedPreValue, leadingMutation,
currentElement })` (`:26171-26201`): row *k*'s value is `pre + e_1 + … + e_k`. The prepared path never calls it with
more than one row.

**Fix plan:** in the prepared/planner path, derive the value-chunk production for the **route's whole row list**
once per route (`childCompilerRoute.rowArguments` already carries every row, each with `args` and
`internalArgs`), so the terminal row's value accumulates its siblings - i.e. reuse
`encodeLeadingRouteArrayPushes(allRows)` + `deriveChunkableArrayValueChannels` exactly as the plain path does, and
publish one binding whose terminal production for the resource is `pre + e_1 + … + e_n`. The composer's terminal
selection (`compose.ts:2715-2740`) then keeps a production whose digest matches what the program verifies
(`e5559480…`, 388 bytes, 3 chunks).

## Round 239: producer stacks - the values come from single-row derivations, and the failing send stages a stale one

Temporary traces in `ValueChunkWriteStagingSession.stage` / `stageOwned`
(`SOLIDC_DEBUG_STAGE_TRACE=1`, uncommitted, reverted, SDK rebuilt; log `/tmp/r239-stage.log`) captured both the
sizes and the producing stacks:

    stage-trace {"kind":"stageOwned","valueBytes":205,"stack":"refreshChunkableRouteWitnesses StatefulContract.ts:26269
      <- _createBuilder StatefulContract.ts:26321 <- StatefulFunctionCall._applyOverrides :38848
      <- _sendWithoutLogicalNonce :37381"}
    (same stack for 233, 293 and 328 - one value per ordinary send, each produced by the PLAIN-path derivation
     `refreshChunkableRouteWitnesses` with a single-row call)
    stage-trace {"kind":"stageOwned","valueBytes":233,"stack":"Proxy._createBuilder StatefulContract.ts:18013
      <- Proxy._batchRaw :7691 <- assemble compose.ts:2796 <- AtomicMessageBusComposition._build :4159"}
    (the composer's participant rebuild re-staging the transported production through the
     `__internal__valueChunkOutputBase` path - see compose.ts:2796)

Two conclusions:

1. Every derived value is produced by a **single-row** invocation of the plain-path derivation
   (`refreshChunkableRouteWitnesses` at `:26269`), i.e. `pre + own element`; the batch's rows are never derived
   together. This is the round-238 defect, now confirmed at the producer level.
2. In the **failing** send the composer's rebuild stages **233** bytes for the resource - a value produced by an
   *earlier* send's single-row derivation (233 = empty pre + leading 205 + element 28), while the program on chain
   chunks **388** (= 233 + 95 + 60, both of this send's appends). So the transported production for the terminal
   resource is not merely "pre + one element" but can be an outright stale value from a previous send.

Fix direction unchanged, now with the producer named: make the derivation that feeds
`valueChunkProductions`/`stageOwned` run over the **route's whole row list** (`childCompilerRoute.rowArguments`,
which carries every row with its `args`/`internalArgs`) so the terminal production for a resource is
`pre + e_1 + … + e_n`, and make the composer's rebuild (compose.ts:2796 -> `_batchRaw`) prefer that terminal
production over any earlier send's value.

## Round 240: the derivation IS batch-aware where it runs - the promoted flow just never runs it

Re-read of the round-231 scan records (`/tmp/r231-scan.log`, probe `append-access-scan`) settles the last
ambiguity:

    {"fn":"publishJobEvent","access":"jobEvents","rowArguments":2,"discoveredRows":2,"storedValues":[]}
    {"fn":"publishJobEvent","access":"jobEvents","rowArguments":2,"discoveredRows":2,"storedValues":[233]}

In every *ordinary* send the derivation block is handed **both** rows of the batch (`rowArguments: 2`) together with
the read-side pre-value (`storedValues: [233]`), and `encodeLeadingRouteArrayPushes(rowArguments)` +
`deriveChunkableArrayValueChannels` then produce the accumulated value per row (`pre + e_1 + … + e_k`) - i.e. the
mechanism that yields the program's 388 already exists and is exercised.

What the promoted take-job send does differently is that it never reaches that block for this resource: the graph is
pre-planned (`__preparedAtomicCalls`), each row is composed as its own prepared call, and the composer's rebuild
(`compose.ts:2796` -> `_batchRaw`) stages whatever the frozen descriptors carry - measured 233 bytes in the failing
send, a value that does not correspond to this transaction's two appends at all (the program expects 388).

So the remaining work is exactly two things, both now evidenced rather than hypothesised:

1. run the same derivation for the promoted flow, over the route's whole row list, so each row's production (and in
   particular the terminal one) is the accumulated post-state - the code to reuse is the block guarded at
   `StatefulContract.ts:25567` (`refreshChunkableRouteWitnesses`, which calls
   `encodeLeadingRouteArrayPushes(rowArguments)` at `:26171-26175` and `deriveChunkableArrayValueChannels` at
   `:26196`), fed with `childCompilerRoute.rowArguments` (which carries every row with `args`/`internalArgs`) and
   the read-side `storedPreValue`;
2. stop the composer's rebuild from staging a production whose value does not correspond to the rows it is
   rebuilding - i.e. recompute (or validate) the transported production for the participant against the frozen
   rows, so a stale/one-element value can never win the terminal selection at `compose.ts:2715-2740`.

## Round 241: attempted a composer-side chain reconstruction - negative, do not repeat it

Implemented (evaluated, then reverted; tree clean, SDK rebuilt) a reconstruction in `compose.ts` just before the
terminal selection (`:2716`): group the participant's productions by resource, and when every value for one resource
extends a shared prefix of at least 28 bytes (VALUE_HEAD_SIZE), replace each with
`prefix ++ (suffix_1 ++ … ++ suffix_n)` in `participant.invocations` order - i.e. rebuild the chain's terminal value
that no single production carries. For the failing resource that computes exactly `233 ++ 95 ++ 60 = 388`.

Result: **no change** - `take job` still fails at input 214 with the same `OP_VERIFY`, `take job multiple` still
fails with `expected not to emit 'JobEvent'`, `sanity checks` still passes. Since 328 and 293 do share the 233-byte
prefix, the reconstruction must have applied; the transported value therefore is NOT what decides the failing
covenants, or the value the composer ends up using for the participant's outputs comes from a different source than
`valueChunkProductions` (recall `/tmp/r239-stage.log`: the rebuild staged 233 through
`_createBuilder :18013 <- _batchRaw :7691 <- assemble :2796`).

So the value-chain hypothesis is *not* sufficient on its own. Before retrying any value-side change, prove which
value actually reaches the output placement: instrument the output the participant emits for the resource
(lock + commitment) and compare its chunk covenants against the program's expected `aa209fb7…` - if they differ in
the *collection* (not the digest), the problem is the collection hash/domain path of round 229/230 rather than the
value; if they differ only in the digest prefix, the value path is confirmed and the fix must cover the producer of
the value the rebuild stages (not the composer's post-selection value).

## Round 242: the discriminator resolves it - the program's covenant IS the SDK formula on the 388-byte value

Offline derivation (no run needed) of `p2sh32(buildEntryNftCovenantScript(cat, hash256('value-chunk' ||
collectionHash || slot || sha256(value))))` with

    cat            = ee643a16… (the MarketplaceDataV1 participant)
    collectionHash = computeCollectionHash(valueChunkSignature('jobEvents')) = b67931b1d91f2263cef8ba12c080d9f5a897ace4
    slot           = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    value          = the program's 388-byte value (/tmp/jobevents-value.hex), sha256 = e5559480…

gives

    9fb7da6a861a67db912e57a5f4d30ead21588c61b44092e6491857a5411d8790

- **64/64 hex characters equal to the hash the program expects.** So the collection, domain and covenant paths are
  *identical* between the contract and the SDK's own helpers, and the only thing that differs is the **value**: the
  program is right, and the SDK must place chunks for the batch's accumulated post-state (388), not for a
  single-row (328/293) or stale (233) value.

**TYPO CORRECTION - earlier negatives in this file are invalid.** Several rounds compared hashes against a
"target" string that still carried the P2SH32 trailing byte: `…d879087` instead of `…d8790` (the real hash is the
64-character `9fb7da6a861a67db912e57a5f4d30ead21588c61b44092e6491857a5411d8790`; the `87` belongs to the enclosing
`aa20…87` lock). Every equality test written that way is a false negative - this affects **round 229's covenant
searches** (186 candidate signatures, entry/data/value-chunk variants), round 230's `hash256(tag||ch20||slot||root)`
comparisons against `f00aca91…` only insofar as they used the same constant, and any other `=== target` check in
this file. Re-derive identities with the corrected 64-character hash before trusting those negatives.

**What this leaves:** the value is the only wrong input, and round 241 showed that fixing the *composer's* view of
the value alone changes nothing - so the next probe must find where the participant's outputs actually get their
lock/commitment (the ownership band path: `transportedChunkCount` vs `valueChunkSlots` at `compose.ts:2760-2791`, and
the convergence repairs in `computed-value-chunks.ts`), i.e. instrument the emitted outputs (lock + commitment) for
participant 1 and check whether they are repaired toward `aa209fb7…` at all.

## Round 243: MEASURED - the failing participant owns no output for the lane at all

Temporary instrumentation of `convergeMessageBusComputedValueChunkOutputs`'s two returns
(`SOLIDC_DEBUG_CONVERGE=1`, reverted, SDK rebuilt; log `/tmp/r243-converge.log`) printed, for the whole title:

    5 x converge-result {"repairs":0,"rounds":0,"ownedOutputs":[],"changedOutputs":[],"note":"no-owned-outputs"}
    5 x converge-result {"repairs":0,"rounds":1,"ownedOutputs":[320,321],"changedOutputs":[]}

Read against the code (`computed-value-chunks.ts`): `ownedOutputs` is derived from the participant's
`__internal__valueChunkOutputBase` witness plus the block's trailing interval, and a non-empty set means the pass
then re-runs the VM to collect proposals from the tight `OP_OUTPUTBYTECODE`/`OP_OUTPUTTOKENCOMMITMENT` equality
sites. Both measured shapes are broken for this transaction:

- the **failing** composition owns **no** outputs at all (`no-owned-outputs`), so nothing can be repaired or placed
  in that participant's band - the program's pin has nothing to find;
- the other composition owns exactly **2** consecutive outputs (`[320,321]`) while the program expects **3** chunks,
  and it collects **no proposals** (`repairs: 0`), so those two outputs keep whatever placeholder lock the builder
  gave them.

`compose.ts:2760-2795` binds the lane only when `transportedChunkCount > 0` and clamps it to
`valueChunkSlots.slice(-transportedChunkCount)`, so the band size is whatever the trailing slots say; nothing there
can compensate for a participant whose build publishes no owned outputs.

Conclusion: the remaining defect is the **ownership/placement path**, not the value (round 241's value-side fix could
not have helped, and round 242 confirmed the covenant derivation is already exactly right for the 388-byte value).
Next probe: instrument who does *not* get a band - compare the failing composition's participant 1 against the
composition that owns `[320,321]`: the route input (`__internal__valueChunkOutputBase`), the trailing interval
(`blockLayout.trailingBase`..`blockSize` of the derived assembly), and whether the participant's outputs in that
interval carry the mutable-NFT chunk commitments the pass requires (`valueChunkIndexFromCommitment` contiguous from
0).

## Round 244: two lane shapes measured; p1's productions survive but no lane reaches its inputs

Two more temporary probes (both reverted, SDK rebuilt):

**(a) owner scan** (`SOLIDC_DEBUG_CONVERGE_OWNERS=1`, inside `computed-value-chunks.ts`'s band loop - print the
`__internal__valueChunkOutputBase` value and the output it points at), whole title:

    inputIndex 304, outputBase 320, window [320,385), capability mutable, amount 0, chunkIndex 0,
      lock aa206e6b04baa172f135dbeb…            <-- healthy: this is the composition that owns [320,321]
    inputIndex 385, outputBase 399, window [398,463), lock "51" (= OP_1), no token  <-- placeholder never materialised
    (nothing at all for participant 1, base 129)

**(b) producer canonicalisation** (`SOLIDC_DEBUG_PRODUCER_CANON=1`, in the terminal-selection loop): participant 1's
productions are all canonical and survive selection (producer defined, ordinal 1, values 205/233/293/328) - so the
round-243 hypothesis "the terminal selection silently deletes p1's lane" is **wrong**.

Put together: p1 has surviving productions, yet no `__internal__valueChunkOutputBase` witness ever reaches its
inputs (owner scan prints nothing for base 129) and the convergence pass reports `no-owned-outputs`. So the break is
between "productions exist for the participant" (`compose.ts:2672-2740`) and "the witness is bound and passed to the
participant's build" (`:2760-2800`): either `transportedChunkCount` is 0 for p1, or `internalRouteWitnesses` is not
the argument set used for p1's call (note the two `_batchRaw` shapes: the proxy-forward/assemble path at `:2796`
versus the plain route call, and note inputIndex 385's lane *is* bound but its first output is an `OP_1` placeholder,
i.e. two different failure modes coexist in this one transaction).

Next probe: log, for each participant, `{ participant, transportedChunkCount, valueChunkSlots.length,
selectedValueChunkSlots[0]?.offset, hasWitness: 'valueChunkOutputBase' in internalRouteWitnesses }` immediately
before its `_batchRaw`/assemble call, so the p1-vs-385 comparison is direct.

## Round 245: the lane IS bound - with a stale 2-chunk value, so the band is too small

`SOLIDC_DEBUG_LANE_BIND=1` (temporary print immediately before `internalRouteWitnesses` in `compose.ts`, reverted,
SDK rebuilt; log `/tmp/r245-lane.log`), grouped over the whole title:

    participant 1: transportedChunkCount 2, valueChunkSlots 64, selected [83,84], transported [{bytes 233, chunks 2}], base 212   (x5)
    participant 1: transportedChunkCount 3, valueChunkSlots 64, selected [82,83,84], transported [{bytes 293, chunks 3}], base 211 (x4)
    participants 0,2,3,4: transportedChunkCount 0 (no lane - expected, they write no chunkable value)

This corrects rounds 243/244: participant 1 **does** get its `__internal__valueChunkOutputBase` bound (base 211 or
212, inside the 64-slot trailing band), so the owner-scan silence was an artifact of the assembly the convergence
pass walks, not a missing witness.

The real defect is the *value* the lane is sized and materialised from:

- the failing composition transports **233 bytes = 2 chunks**, so the band reserves 2 chunk outputs and the program -
  which chunks the on-chain post-state **388 bytes = 3 chunks** - can never find its three covenants;
- 233 is a *stale* value: it is the value an earlier send's single-row derivation produced (`empty pre + leading 205
  + element 28`, round 230's records), i.e. the production the promoted send hands the composer was derived before
  this transaction's two appends existed.

This also explains round 241's null result: with a **single** production for the resource in that composition there
was nothing to chain, so the N>=2 reconstruction was a no-op.

So the fix is exactly what rounds 233/238/240 identified, now with end-to-end proof of its effect: the promoted flow
must derive the resource's value for **this** route's rows (`pre 233 + e1 95 + e2 60 = 388`, three chunks) instead of
transporting a value left over from an earlier send's derivation - and with 3 chunks bound the program's scan
(`matches == expectedCount`) has the outputs it verifies.

## Round 249: DO NOT avoid promotion - the ordinary path cannot compose this graph

Tried the shortcut of keeping graphs that carry a chunkable-value write on the ordinary (non-promoted) derivation
path: added `carriesChunkableValueWrite = orderedNodes.some((node) => (node.valueChunkProductions?.length ?? 0) > 0)`
to the promotion decision at `StatefulContract.ts:32923` (`if (requiresAtomicPromotion && allRoutesEligible && ...)`).
Evaluated, then reverted (tree clean, SDK rebuilt). Result: strictly worse - **all three** titles fail, and now at
**input 3** (`Program failed at input 3: Program failed an OP_VERIFY operation`), i.e. the transaction cannot even be
assembled without promotion:

    × take job > sanity checks      -> preflight failed at input 3
    × take job > take job           -> preflight failed at input 3
    × take job > take job multiple  -> preflight failed at input 3

So promotion is *required* for this graph (multiple invocations per owner: `requiresAtomicPromotion: true`), and the
fix must make the promoted flow derive/transport the right value **in place**. The "skip promotion" shortcut is
ruled out - do not retry it.
