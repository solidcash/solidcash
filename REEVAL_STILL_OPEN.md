# Re-eval: closed work vs follow-ups (complete the scope)

Branch: `grok/kernel-comprehensive-fixtures`

## Closed this stream (do not reopen)

| Gap | Evidence | Note |
|-----|----------|------|
| Mapping RMW × keccak under compose | `KernelDualRuntimeKeccakCompose` | prior |
| `upgrades.upgradeProxy` (param-mode) | `KernelProxyUpgradeThenCompose` | prior |
| DualRuntimeSet-width × keccak density | **Inherent** fence | prior |
| Proxy×event / proxy×foreign×event | EventFunder, ForeignRmwEvent | prior |
| Dual-key add+remove / event-only dispatch / DirectSend order | DualRuntime, EventOnly dispatch, DirectSend | prior |
| Event-only compose × Probe | Hold+writing initialize | `c60eab5a8` |
| Unused-state emit-only compose × Probe | `resourceVerificationMode` + state ownership | `953f6d397` / `KernelProxyUnusedStateEventCompose` |
| self→proxy × vmaps | `KernelSelfToProxyVmapRmwCompose` | `2cc242679` |
| proxy→foreign-proxy × vmaps | `KernelProxyToProxyVmapRmwCompose` | `9ef8f10ef` |
| proxy-self × strings / chunks | `KernelProxyStringStateCompose`, `KernelProxyBytesStateCompose` | `98db8191b`, `6e7b77772` |
| self × fixed struct write | `KernelSelfStructStateWriteCompose` | `a8a446766` |

## Still open — classification

### A. Deferred thin matrix (not blocking)
self→foreign bytes RMW; proxy→foreign positive chunk write; proxy-self nested struct leaf assign (compile fence); optional lifecycle beyond upgrade/create.

### B. Inherent fence (do not “fix”)
**DualRuntimeSet-width arrays × keccak density** — `KernelDualRuntimeKeccakCompose`.

### C. Out of scope
Marketplace / `requiredKernelProofs` / plan-wave labels in `.ts` / chipnet promotion.
