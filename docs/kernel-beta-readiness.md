# Kernel beta checkpoint

The kernel is a runtime row loop with reusable handlers behind `OP_INVOKE`; `messageBusKernel: false` retains the legacy unroll for comparison. The implementation boundary is frozen for this checkpoint. Admission must follow type, effect, flow, and authenticated-layout properties—not application names. The [kernel design](../packages/solidc/docs/message-bus-kernel.md) and [beta manifest](../scripts/kernel-beta-manifest.json) define the intended surface; this file records only the release decision.

## Current state

- 2026-09-28 integration checkpoint: `grok/message-bus-kernel-beta` contains the `solidcash_v0.13.1` tip and
  builds with `yarn build`. It has **not** been merged back into `solidcash_v0.13.1`.
- 2026-10-01 focused checkpoint: `yarn build` and the top-level `yarn lint` pass. ESLint reports zero
  errors or warnings across `packages/solidcash/src` (405 files) and `packages/solidcash/test` (1,004 files).
  The exact `KernelRepeatedMixedRouteWrite` titles for `Ledger` and `ILedger` each pass, including the alternate
  direct callee with the same ABI. The four historically red `KernelAdmission` titles (raw-call signature fence
  and three child-genesis 10,000-byte checks) pass individually, with their immediately preceding titles checked.
  No comprehensive test suite or beta gate was rerun for this checkpoint.
- 2026-10-01 static beta-fence checkpoint: the production added-line application-name check against the manifest
  census and the complete kernel-implementation file scan both have zero hits. Focused lint and `yarn build` pass
  after the final comment cleanup. The full beta gate was **not** invoked because it launches broad test suites;
  static-fence success does not establish a beta-gate pass. The legacy SDK compatibility adapter remains fenced
  separately from kernel planning.
- 2026-10-01 focused Marketplace checkpoint: after an 11-root iteration compile, the unchanged `take job > take job`
  title exposed a fused-return alias: a prior `balanceOf` read was provisionally seeded with the later writer's
  canonical-looking `true` word instead of its own precomputed balance. Two neutral return-ownership/seed
  regressions and their immediately preceding titles pass. The following BCH-2026 input-1352 refusal exposed a
  Solidity-compatible `uint160(address)` projection mismatch: the SDK's planned packed payload carried a 35-byte
  P2SH32 lock where the compiler emitted its 20-byte HASH160 identity. Both neutral packing/cast regressions and
  their immediately preceding titles now pass, and the unchanged Marketplace title advances through that VM
  comparison. It remains **red** at a later duplicate `whitelistWorkers` entry input in the routed `takeJob` block;
  the duplicate-input refusal is intact. The iteration artifact context remains stale by design and requires a
  normal project compile before any merge-readiness claim.
- 2026-10-01 selected-entry checkpoint: the duplicate `whitelistWorkers` proof was an inactive union lane whose
  key witness was shared with the selected `takeJob` read. The route now uses selector-exact operation activity
  to fund unselected entry slots, preserving the duplicate-input guard. The focused unit title and its adjacent
  title pass. The subsequent invocation-11 return mismatch was a stale isolated `balanceOf` seed after a same-
  participant `transferFrom`. Discovery no longer publishes such post-write seeds; the composed VM derives the
  actual value. The unchanged `take job > take job` title now **passes** (1 selected, 65 skipped). Its immediately
  preceding `take job > sanity checks` title is **red** at the Chai adapter's unsupported custom-error argument
  check for `ECDSAInvalidSignatureLength(0)`. No broader Marketplace run was made.
- 2026-10-01 rejection-verifier checkpoint: the relaxed-network Chai adapter was accepting any non-construction
  failure as a requested revert reason. It now requires the observed error message to match, with a focused red-to-
  green matcher regression and adjacent title. This exposed the earlier actual failure in the unchanged
  `take job > sanity checks` title: recipe-mode composition cannot materialize deferred compute for the
  `not whitelisted` rejection path. The custom-error argument case was not reached under the stronger matcher;
  no negative-path waiver or `devOracle` release behavior was introduced.
- The 2026-09-28 comprehensive run is **red**. With one Vitest worker per package, `utils` passed 358/358,
  `testing` 77/77, `solidhat` 69 passed/1 skipped, `create-solidhat` had no tests, and `testing-suite` passed
  27/27. `solidc` finished with 5,200 passed/143 failed (36 failing files). The non-root `solidcash` suite
  finished with 3,037 passed/206 failed/22 skipped/5 todo (82 failing files); the root e2e suite finished with
  2,693 passed/168 failed/37 skipped/3 todo (90 failing files). The SDK and e2e runs preceded several focused
  fixes below, so their counts are a recorded checkpoint, not a post-fix total. None of these results is a beta
  gate pass. The prior root lint run was also red (`utils` 15, `solidc` 401, `solidcash` 11,446 errors); lint was
  not rerun at this checkpoint. There is no current 66-title result or clean-env legacy/kernel timing comparison.
- Focused post-run repairs now pass for upgrade-verifier ABI arities, read-carrier ABI identity, direct value-chunk
  identity, VM unknown-opcode observation, active-body require-message attribution, and all-output signature
  enforcement for kernel version-1 as well as version-2 rows. The compiler now lowers
  default returns and empty bodies regardless of whether returns are named; the full compiler count above includes
  that repair. Remaining representative blockers include missing SDK helper exports after extraction, kernel VM
  `OP_VERIFY` failures, child-genesis bytecodes above the 10,000-byte limit, Solidity-compat compiler failures,
  and other stateful e2e failures. An oversized array-in-mapping loop now has a positive VM proof that writes the
  chunked value and reads every element back from both keys; the old fail-closed assertion had become stale.
  A direct-only mapping-array write previously lost its trailing predecessor to
  nested-call surplus cleanup; that cleanup is now gated by the compiler's fixed entry-slot layout, and both
  mapping-array e2e proofs pass unchanged. The artifact had no message-bus metadata despite the generic
  `messageBus:` preflight error prefix. The merged Chai event/revert test file passes all 14 tests. At that
  checkpoint, the kernel admission file had four failures (685/689 pass): a raw-call rejection-reason mismatch
  and three child-genesis routes over 10 KB.
  Cross-contract sorted INSERT with a `msg.sender` key now passes all three VM tests: the progressive probe keeps
  NEW at the fixed entry slot, finalization places P' at the declared trailing slot, and fee change preserves the
  structural funder's excess.
- The refused-selector compose proof now reaches its intended fail-closed assertion: the SDK accepts the exact
  kernel 10,000-byte batch ceiling while rejecting altered ceilings. Mixed routed/direct composition now has a
  V5 opaque-direct-participant path; the focused VM proof passes for both a concrete and interface-typed Ledger
  call. Its alternate direct callee is selected dynamically from the caller's state, without a bytecode pin.
  This is focused evidence, not a comprehensive mixed-route regression result.
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

Debug one known-red title at a time. Once it passes, run only its immediately preceding title for regression.
Do not launch comprehensive suites or the beta gate under the current testing instruction; record the exact
scope and result of each focused check.

1. Freeze the manifest. A successful fresh compile must have no hidden speculative stack/codegen failure, exactly one stable record per graph call, authenticated producer-result IDs, and the same `OP_INVOKE` boundary for graph handlers.
2. Build and affected compiler/SDK/BCH-2026 tests pass. Resolve the broad compiler baseline and remove application-name dependencies without waivers; skipped tests are not passes. Supported kernel and legacy cases must agree on observable state, events, and results, while a separate size test keeps kernel route growth proportional to row logic rather than maximum unrolled rows.
3. Measure cold time and byte size with optimised, clean-env artifacts and recorded options. Preserve the marketplace fixture before any compile that could replace it. A new unsupported edge case stays fail-closed behind a general `KERNEL_*` reason; it does not reopen beta scope solely because a marketplace title reaches it.

Superseded September progress logs and performance experiments are intentionally omitted from this checkpoint.
