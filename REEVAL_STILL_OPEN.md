# Re-eval: closed work vs follow-ups (complete the scope)

Branch: `grok/kernel-comprehensive-fixtures`

## Closed this stream (do not reopen)

| Gap | Evidence | Commit / note |
|-----|----------|---------------|
| Mapping RMW × keccak under compose | `KernelDualRuntimeKeccakCompose` single-key settle | `98ce12cd7` |
| `upgrades.upgradeProxy` (param-mode) | `KernelProxyUpgradeThenCompose` | `98ce12cd7` |
| DualRuntimeSet-width × keccak density | **Inherent** fence documented; not relaxed | `98ce12cd7` |
| Proxy×event / proxy×foreign×event compose (`tx.origin` pad) | `KernelProxyEventFunderCompose`, `KernelProxyForeignRmwEventCompose` | `e4c2d1135`, `6df8d10e0` |
| Fixed dual-key add+remove under compose | `singleTargetRowBatch` gated on unique target; settle proof | `5e6757d9b` |
| Event-only default proxy `__forward` (no `__proxySlot`) | Dispatch `.send()` settles | `5e6757d9b` |
| Plain `.send()` external before entry slots | Dense path without funder requirement | `4900189f9` |
| Event-only deployProxy compose × Probe MessageBusVerifier | Hold+state-writing `initialize` injected before route synthesis; SCID census exclusion | this commit; `KernelProxyEventOnlyCompose` settle |

## Still open — classification

### A. Related residual (not event-only)
**Unused-state emit-only without a state-writing initialize**

Hand-written `int unused` + emit (no `initialize`, or `initialize` that only `require(true)`) still MessageBusVerifier-fails under compose. Event-only contracts are closed by synthetic `__messageBusHold` + `initialize() { this.__messageBusHold = 0; }`. Workarounds: write state in the emit path, or declare a writing `initialize`.

### B. Inherent fence (do not “fix”)
**DualRuntimeSet-width arrays × keccak density** (`trailingCapacity≈130` / op-cost wall).  
Keep characterization in `KernelDualRuntimeKeccakCompose`; closable dual-runtime×sidecar remains single-key mapping×keccak.

### C. Out of scope / deferred (explicit)
- Marketplace / `requiredKernelProofs` widen
- Plan-wave labels in fixture `.ts`
- Pre-fix proxies still carrying `__proxySlot` bytecode
- Non-kernel / legacy INSERT+external predecessor-node edge cases (ordering closed; separate satoshi/PredOut paths may remain)
