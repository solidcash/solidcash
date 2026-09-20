# Re-eval: closed work vs follow-ups (complete the scope)

Branch: `grok/kernel-comprehensive-fixtures`

## Closed this stream (do not reopen)

| Gap | Evidence | Note |
|-----|----------|------|
| Mapping RMW × keccak under compose | `KernelDualRuntimeKeccakCompose` single-key settle | `98ce12cd7` |
| `upgrades.upgradeProxy` (param-mode) | `KernelProxyUpgradeThenCompose` | `98ce12cd7` |
| DualRuntimeSet-width × keccak density | **Inherent** fence; not relaxed | `98ce12cd7` |
| Proxy×event / proxy×foreign×event compose (`tx.origin` pad) | EventFunder, ForeignRmwEvent | `e4c2d1135`, `6df8d10e0` |
| Fixed dual-key add+remove under compose | unique-target gate | `5e6757d9b` |
| Event-only default proxy `__forward` | Dispatch settle | `5e6757d9b` |
| Plain `.send()` external before entry slots | Dense path | `4900189f9` |
| Event-only deployProxy compose × Probe | Hold+writing `initialize` before route synthesis; SCID census exclusion | `c60eab5a8` |
| Unused-state emit-only compose × Probe | `resourceVerificationMode` when contract owns state/collections | `KernelProxyUnusedStateEventCompose` |

## Still open — classification

### A. Matrix landing (in progress)
Core topology×resource inventory is in READY. Highest-value remaining/landing cells: self→proxy vmap, proxy→foreign-proxy vmap, proxy-self string/chunk/struct, self fixed-struct write, self→foreign bytes RMW, proxy→foreign positive chunk write.

### B. Inherent fence (do not “fix”)
**DualRuntimeSet-width arrays × keccak density** (`trailingCapacity≈130`). Characterization stays in `KernelDualRuntimeKeccakCompose`.

### C. Out of scope / deferred
- Marketplace / `requiredKernelProofs` widen
- Plan-wave labels in fixture `.ts`
- Exhaustive lifecycle green (split/merge remain skipped fences; upgrade covered)
- Chipnet/regtest promotion
