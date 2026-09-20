# Re-eval: closed work vs follow-ups (complete the scope)

Branch: `grok/kernel-comprehensive-fixtures`

## Closed this stream (do not reopen)

| Gap | Evidence | Note |
|-----|----------|------|
| Event-only / unused-state compose × Probe | EventOnly + UnusedStateEvent | `c60eab5a8`, `953f6d397` |
| self→proxy × vmaps / events | `KernelSelfToProxyVmapRmwCompose`, `KernelSelfToProxyEventCompose` | settle |
| proxy→foreign-proxy × vmaps | `KernelProxyToProxyVmapRmwCompose` | settle |
| proxy-self × strings / chunks | String/Bytes StateCompose | settle |
| self × fixed struct write | `KernelSelfStructStateWriteCompose` (compose×Probe) | `5e00c83fa` |
| self→foreign × chunks (first write) | `KernelForeignBytesRmwCompose` empty→append | settle |
| proxy→foreign × chunks (first write) | `KernelProxyForeignBytesCompose` empty→append | settle |

## Still open — classification

### A. Honest fences / thin residuals
- Foreign bytes **nonempty** append under compose (chunk OP_EQUALVERIFY ~ip 5/13) — fenced in `KernelForeignBytesRmwCompose`
- DualRuntimeSet-width × keccak density — **inherent**
- proxy-self nested fixed-int leaf assign — compile fence
- Optional lifecycle green beyond upgrade/create — deferred

### B. Out of scope
Marketplace / `requiredKernelProofs` / plan-wave labels in `.ts` / chipnet promotion
