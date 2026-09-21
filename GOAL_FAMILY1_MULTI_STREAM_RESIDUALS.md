# Goal — family-1 multi-stream residuals (A→B→C)

**Register with:** paste `/tmp/goal-family1-multi-stream-residuals.txt` into `/goal`.

**Worktree:** `.worktrees/kernel-comprehensive-fixtures`  
**Branch:** `grok/kernel-comprehensive-fixtures`  
**Baseline tip:** `3bf46da69`  
**Handoff:** family 1 — resource-indexed multi-stream metadata (after bool-param fixed-chunkable)

## Wedges

| ID | Residual | Minimum cell | Today |
|---|---|---|---|
| **A** | Heterogeneous loop streams | same `for` domain; `int` map + `bytes` map | `KERNEL_LAYOUT` |
| **B** | Same-iteration resource selection | `if (pick) a[i] else b[i]` in bounded `for` | `KERNEL_LAYOUT` |
| **C** | Events beside ≥2 mutation streams | two int maps + unconditional `emit` in same `for` | `KERNEL_LAYOUT` |

Already green (must not regress): homo dual-int loop; sequential dual loops; single-stream+event; `KernelMultiContinuationResourceCompose`; `KernelConditionalMultiContinuationCompose`.

## Proof object

One reusable **resource-indexed stream/claim** representation (owner, collection identity, key domain, value/carrier kind, stream index, optional activation/selection bit). Extend it for A, then B, then C — no three unrelated recognizers.

## Skeptic checklist

See `/tmp/goal-family1-multi-stream-residuals.txt` exit criteria 1–16.
