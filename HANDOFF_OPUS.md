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

So the remaining work is TWO message-bus protocol features, both explicitly deferred by design rather than
broken:

1. admit delegate (proxy-implementation) handlers as message-bus rows, which needs the atomic callManifest to
   publish and verify the delegate execution frame;
2. admit collection/mapping state getters as rows.

Both are needed: `meceTags` is a mapping getter, so closing only the delegate gap still leaves one of the five
calls outside the envelope, and a master NFT is spendable once.

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
