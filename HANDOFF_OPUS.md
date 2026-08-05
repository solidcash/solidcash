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

## Current blocker: proxy logical identity in external-call verification

The unchanged focused test fails final preflight:

```text
messageBus: BCH-2026 preflight failed at input 3:
Program failed an OP_VERIFY operation.
```

Inside an outlined equality helper invoked from the MarketplaceV1 delegate implementation near body IP ~1344:
external-call identity verification.

- Callee master input/output index: `6` (the MarketplaceData proxy, category `e5ef7ec4...`)
- Physical callee master locking bytecode: `aa201b0ec407724317ed993e82d2216a7692db17...`
- Expected address from the implementation stack: `a914323844f5b0ce613ced9a025cb1dca82aa501...87`

`MarketplaceV1` stores `MarketplaceDataV1 public marketplaceData` and the test initializes it with
`await marketplaceData.getAddress()`, i.e. the proxy's stable logical P2SH20 CREATE address. The co-spent state
holder uses the physical BCH covenant, so `master bytecode == expected address` cannot hold. `upgrades.ts`
rewrites direct function-argument targets to physical bytecode, but this target is read from Marketplace state
on-chain and cannot be rewritten off-chain without changing what the contract stores.

### What has been implemented (d2cb1a73)

A second, authenticated identity proof, selected per slot by an SDK-filled witness:

- `SymbolTableTraversal` synthesizes `__internal__extcallAnchorIdx<slot>` for fixed-slot calls whose target is a
  value rather than a baked literal or tx-derived `msg.sender` (around the `__internal__extcallMasterIdx`
  synthesis, ~line 2600).
- `GenerateTargetTraversal.emitLogicalIdentityOrDirectIdentity` emits the existing direct equality when the
  witness is `-1`, and otherwise proves the binding from the callee's co-spent immutable SCID anchor:
  1. the anchor input's locking bytecode IS the expected logical address;
  2. the anchor is an immutable NFT (32-byte category, no capability byte) of the callee master's own category;
  3. its commitment's trailing root field is exactly the co-spent master's locking bytecode.
  Only the genuine contract can mint the anchor, so an unrelated P2SH20 cannot be paired with an unrelated
  master. `LOGICAL_IDENTITY_PREFIX` / `LOGICAL_IDENTITY_ROOT_OFFSET` must stay byte-identical to
  `encodeLogicalIdentityCommitment` in `packages/solidcash/src/stateful/logical-identity.ts`.
- The SDK fills the witness at all five sites: direct (`StatefulContract`, next to the `groupMasterIndices`
  fill), nested delegate (the `encoded` map), batch route (`bFinalArgs` loop), and both `loop-call.ts` sites.

It is `-1` everywhere so far, which reproduces the previous behavior exactly. 78 external-call e2e tests pass
unchanged, so the covenant path and the ABI change are regression-free.

### Remaining work: resolve real anchors

The SDK must, for a slot whose expected address is logical:

1. Detect it. The callee `StatefulContract` carries `_logicalAddress`; compare `addressToLockScript(_logicalAddress)`
   with the group's physical master locking bytecode, and confirm the expected value the covenant will compare
   against is the logical one (from `args` for an `addressParam`, or a caller state read for an `__extaddr_`
   state-var target).
2. Resolve the anchor with `resolveLogicalIdentity(provider, logicalAddress)` and co-spend
   `{ ...anchor, unlocker }`.
3. Recreate the anchor output. Its own redeem script is `<seed> OP_DROP OP_1` (permissionless), so a call that
   consumed it without recreating it would destroy the proxy's identity.
4. Pass its absolute input index into `externalCallAnchorIndices` (the map is already threaded into the direct
   fill).

Check (3) of the covenant proof is confirmed to line up: `ContractFactory` builds the anchor commitment with
`new Contract(artifact, constructorArgs, ...).address`, i.e. the deployed contract's own master locking
bytecode, and `upgrades.deployProxy` passes `logicalIdentity` to the PROXY deployment. So the commitment's root
field is the proxy master the caller co-spends, not the implementation.

Placement matters. Anchors must NOT sit inside an accounted band: the compiler's output math counts external
call outputs as `1 + requiredDataNftIndices.length` per slot, and whether a slot has an anchor is a RUNTIME
decision the compile-time count cannot express. Put them at the end, where `logicalIdentityUtxo` already goes
(`StatefulTransactionBuilder` appends it to `allInputs` in two places and emits its output before
`appendDynamicChunks`). That keeps the delegate dynamic-chunk suffix anchor
(`OP_TXOUTPUTCOUNT OP_1SUB - sum(chunks)`) valid.

The consequence is that the anchor index is not known when `finalArgs` is assembled, since that happens before
the builder exists. Follow the existing pattern for this: the nested path already re-creates callee unlockers
after building, from `nestedMasterIndices` derived from the built probe's actual outpoints. The caller's own
unlocker needs the same deferred re-creation, or the builder needs to expose a total-input count the fill can
use.

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
