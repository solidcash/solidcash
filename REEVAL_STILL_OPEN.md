# Re-eval

Branch: `grok/kernel-comprehensive-fixtures`

## Closed
- All non-lifecycle topology×resource cells **settle** (former dynamic honest fences fixed via foreign chunk RMW restage + proxy-callee ChunkNft mint).
- Lifecycle: upgrade + Yul create + resource-free **split/merge/selfdestruct** **settle** under `messageBus.compose` (selector-derived lifecycle authority; no V3 wire transcript).
- ~~Selfdestruct~~ **SETTLED**: resource-free modifier-only `kill()` under `messageBus.compose`
  (`KernelSelfdestructCompose`) — compact-binder soft-bind for token-free reclaim + zero-param
  lifecycle authorization (mode 3) on offloaded routes; detached verifier keeps mode-3 census.

## Residual
- DualRuntimeSet-width × keccak density — inherent (probe: max trailing 130; salt cannot clear margin)
- Collection/event/blockhash-bearing selfdestruct — still `KERNEL_LIFECYCLE` (honest; standalone
  `StatefulContract.destroy()` multi-tx batching remains the product path; locked negatives in
  `KernelSelfdestructStateCompose`)
- Detached `sig` leaves on lifecycle handlers — still `KERNEL_TX_SIGNATURE` (honest)
- ~~Read-bearing **merge** compose~~ **SETTLED** (`KernelAtomicMergeReadLifecycle`) — preserve
  `resourcePrefix`; merge-capable routes treat `__internal__lifecycleOwnerInput` as the participant
  block base so tails that share the unlocker decode/preserve the survivor dataNft, not a neighbour
- ~~proxy→foreign-proxy variable-width Item[] — non-delegate eligibility fence (int[] settles)~~
  **SETTLED**: `InlineStoragePointerCalls.applyRename` now skips `FieldAccessNode` member names
  (same guard as IRSH/IECH). `KernelProxyToProxyChunkedStructCompose` emits `delegateArtifact` for
  bare Item[] field-fill and settles dual-proxy Item[] empty→push compose alongside int[].
- ~~Selfdestruct product admit/settle~~ **SETTLED** (resource-free modifier-only)
- ~~Statement-form `selfdestruct(addr)`~~ **SETTLED** on master-only contracts under compose
  (`KernelSelfdestructStatementCompose`) — kernel pin uses active master slot; standalone keeps whole-tx pin
- ~~Lifecycle + V4 KTS~~ **SETTLED** (`KernelLifecycleV4SignatureCompose`) — V4 suffix stays neutral
  `mode=0,count=0`; selector-derived lifecycle beside signed siblings
- ~~Fixed-scalar state-bearing selfdestruct~~ **SETTLED** (`KernelSelfdestructStateCompose`)
  — consume dataNft prefix + destroy unlockers + token-free reclaim pads
- ~~Read-bearing split~~ **SETTLED** (`KernelAtomicSplitReadLifecycle`) — preserve dataNft prefix

## Next goal queue
Authoritative prioritized inventory: [`KERNEL_EXTENSION_INVENTORY.md`](./KERNEL_EXTENSION_INVENTORY.md).

- **Beta implement:** items 1–6 (caller identity, multi-continuation claims, multi-row argument framing, batched callsite identity, multi-producer results, multi computed writes).
- **Fence / post-beta:** items 7–18 unless a Marketplace title proves immediate need.
  Gate/fixture map: [`FENCE_MAP_7_18.md`](./FENCE_MAP_7_18.md) (also summarized under inventory “Post-beta / fenced admissions”).
- Cross-cutting matrix and architectural invariants are in that inventory.

## Out of scope
Marketplace / `requiredKernelProofs` / plan-wave labels / chipnet
