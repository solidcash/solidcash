# Kernel beta checkpoint

The kernel is a runtime row loop with reusable handlers behind `OP_INVOKE`; `messageBusKernel: false` retains the legacy unroll for comparison. The implementation boundary is frozen for this checkpoint. Admission must follow type, effect, flow, and authenticated-layout properties—not application names. The [kernel design](../packages/solidc/docs/message-bus-kernel.md) and [beta manifest](../scripts/kernel-beta-manifest.json) define the intended surface; this file records only the release decision.

## Current state

- The last one-shot build, source-tree guard, and focused compiler/SDK/BCH-2026 regressions passed. A fresh
  four-job Marketplace compile completed all 22 sources with zero cache hits; this is not a full-suite or release
  result, and there is no current 66-title result or clean-env legacy/kernel timing comparison to claim.
- Useful `SOLIDC_*` probes remain available under the [diagnostic policy](kernel-diagnostics.md). Observation-only tracing must leave bytecode unchanged (covered for route-argument tracing). Flags that alter emitted code, witnesses, outlining, or optimisation are experiments, **not production measurements**. The cold gate now strips inherited switches. `SOLIDC_ROUTE_ABI_TAIL` is default-on behavior; `=0` is an A/B escape hatch.
- Focused self/foreign/proxy compose proofs cover mappings, dynamic values, events, sidecars, returns, and lifecycle operations. These are fixture evidence, not an expanded beta manifest. Fixed-state read-bearing split/merge and modifier-only fixed-state selfdestruct now publish explicit resource topology. Wider dynamic lifecycle layouts and detached `sig` leaves remain fenced.
- Source-tree build sidecars are removed; authored JavaScript and ambient declarations remain. Build into `dist/` and run `yarn check:source-tree` before committing.
- The SDK still has an explicitly legacy-fenced `JobEvent` compatibility adapter and historical internal names around
  chunked continuation bands. Do not extend those names into kernel decisions; retire them behind compiler-published
  resource metadata in a dedicated refactor, separately from capability work.
- The focused beta scenario is not green. Neutral regressions cover a producer-returned Solidity address resolving
  a unique P2SH32 participant and remaining authenticated as the full raw-call target behind `OP_INVOKE`. In fresh
  `approve result`, stable metadata correctly assigns the intermediate fixed-array producer to output 37 and its
  child results to outputs 38–40; output 37 nevertheless remains the provisional `00`. Reverse numeric derivation
  is not a dependency order after logical calls coalesce by physical owner: the collapsed graph contains a real
  callback cycle, so the intermediate producer is probed before the shared owner has materialized its child
  effects and is never retried. The next batch should add bounded, fail-closed semantic convergence over the
  compiler-authored physical dependency graph, with a neutral shared-owner callback regression; do not redirect
  the consumer to a child result or start a title ladder.

## Gate before the next leap

Debug one title at a time (at most one adjacent title), never a contract-wide ladder or full suite. After it
passes, validate a small set of affected compiler, SDK, and VM tests. Run comprehensive suites and the beta
gate only at major milestones; record their exact scope and results.

1. Freeze the manifest. A successful fresh compile must have no hidden speculative stack/codegen failure, exactly one stable record per graph call, authenticated producer-result IDs, and the same `OP_INVOKE` boundary for graph handlers.
2. Build and affected compiler/SDK/BCH-2026 tests pass. Resolve the broad compiler baseline or approve exact-name waivers; skipped tests are not passes. Supported kernel and legacy cases must agree on observable state, events, and results, while a separate size test keeps kernel route growth proportional to row logic rather than maximum unrolled rows.
3. Measure cold time and byte size with optimised, clean-env artifacts and recorded options. Preserve the marketplace fixture before any compile that could replace it. A new unsupported edge case stays fail-closed behind a general `KERNEL_*` reason; it does not reopen beta scope solely because a marketplace title reaches it.

Superseded September progress logs and performance experiments are intentionally omitted from this checkpoint.
