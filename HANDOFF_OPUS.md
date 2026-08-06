# Opus handoff: Effective Acceleration marketplace on native BCH

## Worktree and objective

Work only in this existing worktree:

```text
/Code/cashscript/.worktrees/effectiveacceleration-marketplace
```

Branch:

```text
codex/effectiveacceleration-marketplace
```

Objective: make `/Code/effectiveacceleration.ai/contract/.marketplace/project/test/marketplace.test.ts`
compile and run natively on BCH without modifying the marketplace source or its tests. The test project is
exposed in this worktree under `.marketplace/project`.

## User-authorized constraints

- Consensus checks for input count/size and transaction size may be bypassed temporarily. The mock provider
  supplies the relevant configuration.
- `solidcash_v0.13.1` has known pre-existing test failures. Ignore those for now; they are being fixed elsewhere.
- Do not alter the marketplace contracts or `marketplace.test.ts` to obtain a pass.

## State as of the mainline merge

The previously-dirty worktree is now committed and mainline is merged:

```text
d673e3e3 wip: native BCH marketplace port progress          (the prior session's uncommitted work)
ed8907b5 merge: integrate mainline solidcash_v0.13.1        (100 conflicts across 10 files)
1a244b35 fix: keep memory-located inline params on their own local
d2cb1a73 feat: add a proxy logical-identity path to external-call identity
```

`.marketplace/` and `artifacts/` are excluded via `.git/info/exclude`: they are a scratch scaffold of symlinks
into `/Code/effectiveacceleration.ai/contract` plus cache snapshots and logs, not source.

### Merge notes

Mainline refinements were adopted where they supersede the branch (`strictSolidityValidation` gating in
TypeCheckTraversal, split-facet flattening and the `compileString` recursion guard, `MessageBusVerifierCapacityError`,
per-iteration chunk-offset capture). Branch marketplace work was preserved where it is a superset (nested delegate
external composition, compiler-route unlockers, batch predecessor outputs, `getPhysicalChunkOutputBase`, raw batch
descriptor fields, logical identity UTXO preservation). Four resolutions are genuine combinations, listed in the
merge commit message.

### Merge regression found and fixed (1a244b35)

Mainline added a value-parameter aliasing optimization to `InlineReturningStateHelpers` that renames a read-only
parameter to the caller local supplying it and skips the binding statement. For a MEMORY-located argument that
local can be relocated into the shared buffer by the memory lowering, so the alias names a variable that no longer
exists at codegen. This broke the MarketplaceDataV1 project-root compile with:

```text
Expected variable '__inl11_approvalCall' does not exist on the stack
```

(OZ `SafeERC20.forceApprove` -> `_callOptionalReturnBool(token, approvalCall)`, whose assembly reads the aliased
`bytes memory` local.) The fix restricts the optimization to parameters that are neither declared `memory` nor a
dynamic reference type.

Note the project cache key covers sources and options but NOT compiler code, so a stale
`.marketplace/cache/solidcash` hides compiler regressions. Delete that directory when validating a compiler change.

## Solved: proxy logical identity in external-call verification

`MarketplaceV1` stores `MarketplaceDataV1 public marketplaceData` and the test initializes it with
`await marketplaceData.getAddress()`, i.e. the proxy's stable logical P2SH20 CREATE address, while the co-spent
state holder uses the physical BCH covenant. `master bytecode == expected address` could not hold, and
`upgrades.ts` only rewrites direct function-ARGUMENT targets, so this state-read target could not be rewritten
off-chain.

Fixed by a second, authenticated identity proof selected per slot by an SDK-filled witness
(`__internal__extcallAnchorIdx<slot>`):

- `-1` keeps the existing direct equality.
- Otherwise `emitLogicalIdentityOrDirectIdentity` proves the binding from the callee's co-spent immutable SCID
  anchor: the anchor's locking bytecode IS the expected logical address; it is an immutable NFT (32-byte
  category, no capability byte) of the callee master's own category; and its commitment's trailing root field is
  exactly that master's locking bytecode. Only the genuine contract can mint the anchor, so an unrelated P2SH20
  cannot be paired with an unrelated master.

`LOGICAL_IDENTITY_PREFIX` / `LOGICAL_IDENTITY_ROOT_OFFSET` in `GenerateTargetTraversal` must stay byte-identical
to `encodeLogicalIdentityCommitment` in `packages/solidcash/src/stateful/logical-identity.ts`.

SDK side (`StatefulTransactionBuilder` + `StatefulContract`):

- `externalIdentityAnchorUtxos` is a band appended after every layout-driven band and recreated as outputs. The
  anchor redeem script is `<seed> OP_DROP OP_1` (permissionless), so consuming one without recreating it would
  destroy that contract's logical identity.
- Callee anchors sit BEFORE the caller's own `logicalIdentityUtxo`. `emitLogicalMsgSenderAnchorResolution`
  resolves the caller's identity from `OP_TXINPUTCOUNT OP_1SUB`, so the tail input must stay the caller's;
  getting this wrong makes msg.sender resolution pick a callee anchor.
- `getIdentityAnchorInputIndex` reads the materialized input list; `_refreshInputs` re-runs assembly after the
  carrying unlocker is replaced.
- The delegate forward path maps an anchored slot with `nestedGroups[slot]` - the SAME positional mapping the
  `__internal__extcallMasterIdx` fill uses. A callsite-keyed lookup names the wrong contract, because several
  logical callsites share one physical group.
- The witness is filled AFTER funder assignment (`setFunderUtxos`), which is what fixes the input positions the
  index refers to. Filling it at builder-construction time yields stale indices.

Three traps cost real time and are worth remembering: the tail-input assumption above, the stale index before
funders, and the slot-to-group mapping.

## Current blocker: one callee, several unbatched calls

The focused test now passes identity verification and fails later, at a selector check: the co-spent
MarketplaceData input is composed for `publishJobEvent` (`a826ee9c`) while a slot expects `arbitratorRegistered`
(`9bd3de95`).

`publishJobPost` has six external-call slots:

```text
0 MarketplaceDataV1.arbitratorRegistered  argSources [forward]                batched=false
1 MarketplaceDataV1.meceTags              argSources [arrayElement]           batched=false
2 IERC20.balanceOf                        argSources [msgSender]              batched=TRUE
3 MarketplaceDataV1.userRegistered        argSources [msgSender]              batched=false
4 MarketplaceDataV1.publishJobEvent       argSources [expression, expression] batched=false
5 MarketplaceDataV1.publishJobEvent       argSources [expression, expression] batched=false
```

Five distinct calls target one contract, and a master NFT can be spent only once per transaction, so they must
share ONE physical input. The composition currently produces five logical groups all pointing at master input 6
(`__forward`), and each slot then bakes its own compile-time selector check against that single input, which at
most one can satisfy. The sound answer is the batch envelope the compiler already builds for slot 2: batched
slots skip the ordinary selector check and are authenticated by `emitExternalBatchBlobVerification` instead.

### Prototyping the delegate route: what it actually exposes

CORRECTION: an earlier revision of this file claimed nested dynamic-array state was the innermost blocker. That
was inferred, and it is wrong. Instrumenting the refusal shows `nested-dynamic-array-route-not-enabled` never
fires for this contract.

Enabling route synthesis in the DELEGATE variant is a two-line prototype:

```text
compiler.ts ~968   if (compilerOptions.autoDelegate) disallowedModifiers.delete(FunctionModifier.DELEGATE);
compiler.ts ~567   variantOptions keeps `messageBus` instead of forcing it false
```

Dropping DELEGATE only in that variant is defensible: there EVERY handler already executes in the proxy's state
context, so the route is itself a delegate route rather than an ordinary edge advertising a delegate executor -
the uniform frame is what the general refusal protects. With it, synthesis proceeds and hits ordinary compiler
defects one at a time:

1. `cannot uniquely map collection 'jobEvents' to its physical route entry slot` - FIXED and landed
   (commit 2e4a33f4, kept independently of the prototype). The mapper narrowed on collection + key-param COUNT
   only; a handler's keys are compiler-owned entry keys named after the route input that supplies them, so the
   key NAME identifies the slot. Narrowing on it also repaired the pre-existing `BoundedCollectionIteration`
   failure.
2. Next, and where the prototype now stops:

```text
Found parameters (address,address,bytes32) in call to function '__message_bus_entry_userRefunded'
where parameters (address,address,bytes32,bytes) were expected
  ... a position in the message-bus route generated for 'MarketplaceDataV1', NOT in your file.
  ... This is a compiler defect.
```

An arity mismatch between the generated route's call site and the entry wrapper `bindEntryKeyParameters`
produced for `userRefunded(address)` (which writes `users[address_].reputationDown`). The compiler labels it a
defect itself.

The useful conclusion is that this is a QUEUE OF ORDINARY BUGS in a path that has never been exercised for this
contract, not a protocol wall. Route synthesis for a 46-handler upgradeable contract simply has not been run
before. Each iteration is about 5 minutes (`dvar.mjs`-style `compileFileMulti` on MarketplaceDataV1.sol reading
`artifact.delegateArtifact.messageBus`).

Whether the delegate-route prototype should become the real design is still a decision worth making
deliberately - but "delegate handlers can never host a route" is NOT what the evidence says.

### Why batching is required for CORRECTNESS, not just to satisfy a check

Worth stating plainly, because it rules out the tempting shortcut. The SDK already collapses the five logical
calls onto ONE physical input (`sharedGroupIndex`; groups 0/1/3/4 all resolve to master input 6). That input
executes exactly ONE function. So if the per-slot selector check were relaxed - by using the
`__internal__externalCallSelector` witness instead of the baked constant, which the SDK already pins to the
composed selector - the transaction would be accepted while FOUR of the five calls silently never happened.

That is strictly worse than the current failure. The covenant refusing is correct: the composition really is
wrong. The batch envelope is the only construction in which all five calls actually execute, so handler
admission is not a formality standing between us and a green test - it is the mechanism that makes the
transaction mean what the source says.

The same reasoning kills relaxing `DELEGATE` in `disallowedModifiers`: it would publish a route whose rows
execute in a frame the callManifest does not verify, which the compiler states "would authorize the wrong
owner/output context".

### Is the delegate marking itself wrong? No.

`compiler.ts` ~3930 marks the whole external surface `delegate` for any `solidityImportCompat` contract carrying
an `initializer`. That is not an accident of timing: an OZ upgradeable contract is only usable behind a proxy,
so its main artifact legitimately IS the implementation. `MarketplaceDataV1` is therefore a delegate
implementation by construction, and the question is not "why is it marked" but "can a delegate implementation
host a message-bus route". Today it cannot: the variant compile that owns delegate marking explicitly disables
the message bus (`variantOptions = { ...opts, autoDelegate: true, messageBus: false }`) because route synthesis
would otherwise clone handlers before their covenant shape is rewritten, "producing an invalid hybrid artifact".

### Measured: what actually blocks batching

Everything below is measured, not inferred. Experiments were reverted; only the one real fix was kept.

**Gap 1 - caller-side eligibility (open).** The `eligible` predicate feeding `batchInvocations` in
`SymbolTableTraversal` (~line 2290) refuses these slots. Relaxing ONLY the expression-argument clause changes
nothing. The deciding clause is:

```text
&& (directCalls.has(slot.sourceCallNode!) || (slot.addressSource && slot.hasReturnValues))
```

`directCalls` is built from `node.body.statements` alone, so it admits only unconditional TOP-LEVEL statement
calls. Every MarketplaceData call here sits inside a `require(...)`, an `if`, or a loop, and none has an
`addressSource`. Relaxing that clause (with the expression clause) does produce exactly the composition the
transaction needs:

```text
0 MarketplaceDataV1 arbitratorRegistered  batch=true rows=5   <- all five collapse into one envelope
1 IERC20            balanceOf             batch=true rows=3
```

Whether conditional calls are sound to batch still needs a decision. The caller's covenant accumulates the blob
along the executed path (`externalBatchAccumulator`), which suggests conditional rows are representable, but
that was not verified.

**Gap 2 - callee-side route synthesis (FIXED, commit 02f1db00).** `MarketplaceDataV1` previously had no
`messageBus` capability at all: every admitting rung of the ladder died on OZ SafeERC20's
`address(token).functionCall(data)`. Root cause was `InlineReturningStateHelpers` collecting `freeFnRefs` from
`FunctionCallNode` only, so a `using L for T` member call (a `MethodCallNode`) left no reference and
`Address.functionCall` was dropped. `visitUsingForDirective` then treats a known library with no registrable
functions as a NO-OP binding, so the receiver could not resolve. Invisible in a direct compile, where
`_callOptionalReturn` is itself inlined away; fatal once a route makes it survive. The route now synthesizes.

**Gap 3 - handler admission (open, and this is the real wall).** The route exists, but only 1 of 46 handlers is
admitted. The four `publishJobPost` needs:

```text
publishJobEvent      lifecycle-or-unsafe-handler
userRegistered       lifecycle-or-unsafe-handler
arbitratorRegistered lifecycle-or-unsafe-handler
meceTags             collection-state-getter-route-not-enabled
```

Histogram over all 46: `lifecycle-or-unsafe-handler` 30, `collection-state-getter-route-not-enabled` 8,
`batched-handler-forward-call-not-enabled` 3, `collection-helper-route-not-enabled` 2,
`collection-route-requires-one-parameter-keyed-entry-per-collection` 1, `not-examined-by-route-synthesis` 1,
eligible 1.

`lifecycle-or-unsafe-handler` fires because those functions carry the auto-inferred `delegate` modifier
(MarketplaceDataV1 is an upgrade-proxy implementation) and `FunctionModifier.DELEGATE` is in
`disallowedModifiers` (`compiler.ts` ~line 968). The compiler states the reason for the neighbouring delegate
refusal explicitly: "A delegate executor shares the proxy's state authority rather than owning an independent
participant block. Until the atomic callManifest publishes and verifies that execution frame, advertising the
proxy handler as an ordinary graph edge would authorize the wrong owner/output context."

`collection-state-getter-route-not-enabled` is likewise deliberate: "collection getters remain available as
ordinary entry points; message-bus routes batch state-changing handlers rather than synthesizing a second
getter surface."

**Where the `delegate` modifier actually comes from.** Not `AutoMarkDelegateFunctions` (that runs only in the
variant compile, `autoDelegate: true`, which also sets `messageBus: false`). It comes from `compiler.ts` ~3930,
in the MAIN compile:

```text
if (solidityImportCompat && contract has any function with an `initializer`/`reinitializer` custom modifier) {
  for every externally callable function: strip view/pure, push FunctionModifier.DELEGATE
}
```

`MarketplaceDataV1 is OwnableUpgradeable` with an `initializer`, so EVERY public function is force-marked
delegate - including the `view` ones, whose VIEW modifier is stripped and replaced by `sourceReadOnly`. Since
`DELEGATE` sits in the message-bus `disallowedModifiers`, the consequence is categorical: **an OZ-upgradeable
contract can never advertise message-bus handlers.** That is an interaction between two features, not a single
deliberate decision, and it is the reason 30 of 46 handlers are refused.

### Three candidate paths, in increasing order of how much they change

1. **Treat the read-only calls as external READS, not calls.** Three of the five (`arbitratorRegistered`,
   `userRegistered`, `meceTags`) are declared `public view` in the source; only `publishJobEvent` writes, and
   its two callsites share one selector and one `requiredDataNftIndices`, so they group as an ordinary 2-row
   batch. If cross-contract public-getter reads lowered to the existing external-read machinery
   (`externalReadSlots` / `emitExternalReadVerification`, a read-only co-spend that verifies commitments without
   the callee executing anything) rather than to external CALLS, the whole conflict dissolves. Note the
   force-marking above strips their `view` modifier, so this path likely needs `sourceReadOnly` respected at the
   call site. This is the most promising path and the least protocol surface.
2. **Admit delegate handlers as message-bus rows.** Needs the atomic callManifest to publish and verify the
   delegate execution frame; the compiler's own comment says advertising them without it "would authorize the
   wrong owner/output context". Do not simply remove `DELEGATE` from `disallowedModifiers` - that produces a
   route that authorizes the wrong owner.
3. **Admit collection/mapping state getters as rows** (`collection-state-getter-route-not-enabled`), needed for
   `meceTags` if path 1 is not taken.

Paths 2 and 3 are both required together if path 1 is not viable, since a master NFT is spendable once.

**Path 1 was prototyped and does NOT work as stated - measured, then reverted.** Inferring
`ExternalCallMode.STATICCALL` for a call whose resolved callee is read-only (checking `sourceReadOnly` plus
`view`/`pure`, since the OZ rewrite strips `view`) is sound on its face: `emitStaticCallCommitmentPreservation`
pins the callee's master commitment AND every required data-NFT commitment across the spend, the selector check
is skipped for STATICCALL by design, and the return-event covenant encodes `_Return_<fn>` so the method identity
stays bound. But it moves the conflict rather than removing it:

```text
before: 2 IERC20 balanceOf  batch=true rows=3
after:  2 IERC20 balanceOf  batch=false          <- now three separate IERC20 co-spends
```

`balanceOf` is itself `view`, so it becomes a staticcall and drops out of its own working batch, recreating the
one-spend-per-master problem for the token. Any version of path 1 has to keep read-only calls batchable rather
than diverting them out of the batch path - most likely by making staticcall slots to the SAME callee share one
physical group, which is the same grouping problem as gap 1 in a different place.

Because `publishJobEvent` also WRITES MarketplaceData in the same transaction, note that a staticcall slot and a
writing slot on one shared physical input are mutually contradictory anyway: staticcall demands the callee's
commitments be identical input-to-output, and the write changes them. So the read calls cannot simply be
staticcalls on the shared input; they need to be rows of the same envelope as the write, which is gap 3.

To reproduce the admission picture (about 5 minutes):

```bash
node -e "import('.../packages/solidc/dist/index.js').then(m => {
  const a = m.compileFileMulti('.../.marketplace/contracts/MarketplaceDataV1.sol', {solidityImportCompat:true});
  for (const h of a.MarketplaceDataV1.messageBus.handlers) console.log(h.name, h.eligible, h.rejectionReason);
})"
```

## Build/recompile commands

```bash
yarn workspace solidc build
yarn workspace solidcash build
rm -rf .marketplace/cache/solidcash            # compiler code is NOT in the cache key
node packages/solidhat/dist/cli.js compile --config solidcash.config.ts
```

Marketplace compilation takes 10-15 minutes from a cold cache. Never rebuild `solidc` while a compile or bench
is running: they import `packages/solidc/dist` live.

Faster inner loop for compiler changes that only need the failing root (about 2.5 minutes):

```bash
node -e "import('/Code/cashscript/.worktrees/effectiveacceleration-marketplace/packages/solidc/dist/index.js')
  .then(m => { m.compileFileMulti('<abs path>/.marketplace/contracts/MarketplaceDataV1.sol',
  { solidityImportCompat: true }); })"
```

The focused test is:

```bash
env NODE_OPTIONS=--max-old-space-size=2048 SOLIDC_DEBUG_ROUTE_CONCISE=1 \
  node node_modules/vitest/vitest.mjs run \
  --config vitest.solidhat.config.ts --no-file-parallelism -t 'post job 1'
```

## Known baseline failures (reproduce on the pre-merge branch commit, unrelated to the merge)

- `test/solidity-compat/yul-evm.test.ts`: 2 failures, both `external call target address must be a
  constructor/function parameter or self-pinned state value (target '__raw__.__raw__')`. A standalone contract
  calling `SafeERC20.forceApprove` hits the same wall; the marketplace only gets past it through message-bus
  route admission.
- `test/journal-message-bus/`: 3 failures (`BoundedCollectionIteration`, `MessageBusVerifierSize`,
  `ScalarJournal`).
- `test/e2e/UpgradesDeployProxy.test.ts`: 2 failures (delegated C2 mapping INSERT refusal, returning external
  call from a delegated implementation). The neighbouring `materializes a returning external call to another
  deployed proxy` is skipped and is the small-scale form of the proxy composition this branch needs.

## Temporary diagnostics to remove before completion

- `packages/solidcash/src/stateful/StatefulTransactionBuilder.ts`: VM trace ring widened from 16 to 520; restore it.
- `packages/solidcash/src/stateful/StatefulContract.ts`: `route-derive-start`, `root-dynamic-chunk-scan`,
  repeated-route witnesses, `fake-token-data-after-send`, and other `SOLIDC_DEBUG_ROUTE*` diagnostics.
- `packages/solidc/src/generation/GenerateTargetTraversal.ts`: route/batch diagnostics, including the
  `publishJobPost`-specific ones in `emitSlotMasterIndex` and `emitExternalCallVerification`.

```bash
rg -n "SOLIDC_DEBUG_ROUTE|root-dynamic-chunk-scan|route-derive-start|fake-token-data-after-send" \
  packages/solidc packages/solidcash
```

## Completion criteria

- The original marketplace source and tests remain unchanged.
- The focused `post job 1` test passes natively on BCH.
- The full unchanged `.marketplace/project/test/marketplace.test.ts` suite passes, aside from explicitly
  unrelated baseline failures if any are encountered and documented precisely.
- Temporary tracing is removed and the trace ring restored.
- Relevant package builds pass.
