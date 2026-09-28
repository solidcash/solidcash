# Kernel beta checkpoint

The kernel is a runtime row loop with reusable handlers behind `OP_INVOKE`; `messageBusKernel: false` retains the legacy unroll for comparison. The implementation boundary is frozen for this checkpoint. Admission must follow type, effect, flow, and authenticated-layout properties—not application names. The [kernel design](../packages/solidc/docs/message-bus-kernel.md) and [beta manifest](../scripts/kernel-beta-manifest.json) define the intended surface; this file records only the release decision.

## Current state

- 2026-09-28 integration checkpoint: `grok/message-bus-kernel-beta` contains the `solidcash_v0.13.1` tip and
  builds with `yarn build`. It has **not** been merged back into `solidcash_v0.13.1`.
- The formal `yarn test:kernel-beta` gate stops at its application-name fence before running tests: the production
  diff since the manifest census still contains application-specific planning names and literals. This requires a
  semantic generalization of the legacy adapter boundary, not a waiver or a test-only rename.
- The 2026-09-28 comprehensive run is **red**. With one Vitest worker per package, `utils` passed 358/358,
  `testing` 77/77, `solidhat` 69 passed/1 skipped, `create-solidhat` had no tests, and `testing-suite` passed
  27/27. `solidc` finished with 5,200 passed/143 failed (36 failing files). The non-root `solidcash` suite
  finished with 3,037 passed/206 failed/22 skipped/5 todo (82 failing files); the root e2e suite finished with
  2,693 passed/168 failed/37 skipped/3 todo (90 failing files). The SDK and e2e runs preceded several focused
  fixes below, so their counts are a recorded checkpoint, not a post-fix total. None of these results is a beta
  gate pass. The prior root lint run was also red (`utils` 15, `solidc` 401, `solidcash` 11,446 errors); lint was
  not rerun at this checkpoint. There is no current 66-title result or clean-env legacy/kernel timing comparison.
- Focused post-run repairs now pass for upgrade-verifier ABI arities, read-carrier ABI identity, direct value-chunk
  identity, VM unknown-opcode observation, and active-body require-message attribution. The compiler now lowers
  default returns and empty bodies regardless of whether returns are named; the full compiler count above includes
  that repair. Remaining representative blockers include missing SDK helper exports after extraction, kernel VM
  `OP_VERIFY` failures, child-genesis bytecodes above the 10,000-byte limit, Solidity-compat compiler failures,
  and other stateful e2e failures, including an oversized array-in-mapping loop whose fail-closed expectation
  currently resolves instead of rejecting. A direct-only mapping-array write previously lost its trailing predecessor to
  nested-call surplus cleanup; that cleanup is now gated by the compiler's fixed entry-slot layout, and both
  mapping-array e2e proofs pass unchanged. The artifact had no message-bus metadata despite the generic
  `messageBus:` preflight error prefix. The repeated mixed-route BCH-2026 proof still fails at input 2 with
  `OP_VERIFY`; the merged Chai event/revert test file passes all 14 tests.
- The refused-selector compose proof now reaches its intended fail-closed assertion: the SDK accepts the exact
  kernel 10,000-byte batch ceiling while rejecting altered ceilings. The mixed-route proof remains unresolved.
  A diagnostic grouped build passed the caller and proxy selector checks, then failed because standalone
  `forward(...).send()` supplies no atomic manifest at the second-to-last input. `messageBus.compose` supplies that
  manifest but currently rejects the deliberately direct-only participant, so mixed-participant composition needs
  a real implementation; neither skipping the verifier nor changing the test to all-kernel is acceptable.
- Useful `SOLIDC_*` probes remain available under the [diagnostic policy](kernel-diagnostics.md). Observation-only tracing must leave bytecode unchanged (covered for route-argument tracing). Flags that alter emitted code, witnesses, outlining, or optimisation are experiments, **not production measurements**. The cold gate now strips inherited switches. `SOLIDC_ROUTE_ABI_TAIL` is default-on behavior; `=0` is an A/B escape hatch.
- Focused self/foreign/proxy compose proofs cover mappings, dynamic values, events, sidecars, returns, and lifecycle operations. These are fixture evidence, not an expanded beta manifest. Fixed-state read-bearing split/merge and modifier-only fixed-state selfdestruct now publish explicit resource topology. Wider dynamic lifecycle layouts and detached `sig` leaves remain fenced.
- Source-tree build sidecars are removed; authored JavaScript and ambient declarations remain. Build into `dist/`
  and review `git status` before committing. The previously documented `check:source-tree` script is not present.
- The SDK still has an explicitly legacy-fenced `JobEvent` compatibility adapter and historical internal names around
  chunked continuation bands. Do not extend those names into kernel decisions; retire them behind compiler-published
  resource metadata in a dedicated refactor, separately from capability work.
- The focused `post two jobs` scenario is green after a fresh compile. A neutral BCH-2026 regression proves zero,
  one, and two repeated getter results whose exact affine domain consumes an authenticated earlier scalar result.
  The compiler preserves the source callsite-to-returned-array link before memory lowering; the SDK retains one
  physical callsite and resolves each reached occurrence from its planned arguments. This is a focused checkpoint,
  not evidence that the 66-title beta gate or the previously observed shared-owner callback cycle is resolved.
- Internally consumed repeated returns now use compact carriers only for a dense zero-based reached prefix; sparse
  source iterations and downstream graph consumers remain fail-closed without occurrence-qualified identities.
  Read-only argument-keyed entry handlers publish two authenticated fixed tuple lanes, independent of the route's
  maximum row count; a third distinct identity remains fail-closed. The focused invalid-tag Marketplace title and
  its adjacent unregistered-arbitrator title pass unchanged after a fresh four-job compile.

## Gate before the next leap

Debug one title at a time (at most one adjacent title), never a contract-wide ladder or full suite. After it
passes, validate a small set of affected compiler, SDK, and VM tests. Run comprehensive suites and the beta
gate only at major milestones; record their exact scope and results.

1. Freeze the manifest. A successful fresh compile must have no hidden speculative stack/codegen failure, exactly one stable record per graph call, authenticated producer-result IDs, and the same `OP_INVOKE` boundary for graph handlers.
2. Build and affected compiler/SDK/BCH-2026 tests pass. Resolve the broad compiler baseline and remove application-name dependencies without waivers; skipped tests are not passes. Supported kernel and legacy cases must agree on observable state, events, and results, while a separate size test keeps kernel route growth proportional to row logic rather than maximum unrolled rows.
3. Measure cold time and byte size with optimised, clean-env artifacts and recorded options. Preserve the marketplace fixture before any compile that could replace it. A new unsupported edge case stays fail-closed behind a general `KERNEL_*` reason; it does not reopen beta scope solely because a marketplace title reaches it.

Superseded September progress logs and performance experiments are intentionally omitted from this checkpoint.
