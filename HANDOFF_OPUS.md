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

The gate is in `SymbolTableTraversal` (the `eligible` predicate that feeds `batchInvocations`, around line
2290):

```text
&& (decodedRaw || !(slot.argSources ?? []).some((source) => source.kind === 'expression'))
```

`publishJobEvent` passes an inline-built struct, so its arg sources are `expression` and it is refused. Slots 0,
1 and 3 have resolvable sources and should already group; confirm whether `directCalls` admits them, since the
grouping key is `${identity}|${requiredDataNftIndices}`.

The direction that fits the existing design is to let the envelope carry expression-sourced arguments - the
compiler already builds the aggregate request encoding on-chain for a batch - rather than making the SDK resolve
them (it deliberately refuses: "expression-based argSources that cannot be auto-resolved").

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
