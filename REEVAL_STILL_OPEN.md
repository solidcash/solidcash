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
- State/effect-bearing split/merge/selfdestruct — still `KERNEL_LIFECYCLE` (graph requires master-only
  `blockSize===1`; needs journal-bound topology + verifier census beyond mode-1/2/3 master-only arms)
- Detached `sig` leaves on lifecycle handlers — still `KERNEL_TX_SIGNATURE` (honest)
- ~~proxy→foreign-proxy variable-width Item[] — non-delegate eligibility fence (int[] settles)~~
  **SETTLED**: `InlineStoragePointerCalls.applyRename` now skips `FieldAccessNode` member names
  (same guard as IRSH/IECH). `KernelProxyToProxyChunkedStructCompose` emits `delegateArtifact` for
  bare Item[] field-fill and settles dual-proxy Item[] empty→push compose alongside int[].
- ~~Selfdestruct product admit/settle~~ **SETTLED** (resource-free modifier-only)
- ~~Statement-form `selfdestruct(addr)`~~ **SETTLED** on master-only contracts under compose
  (`KernelSelfdestructStatementCompose`) — kernel pin uses active master slot; standalone keeps whole-tx pin
- ~~Lifecycle + V4 KTS~~ **SETTLED** (`KernelLifecycleV4SignatureCompose`) — V4 suffix stays neutral
  `mode=0,count=0`; selector-derived lifecycle beside signed siblings

## Out of scope
Marketplace / `requiredKernelProofs` / plan-wave labels / chipnet
