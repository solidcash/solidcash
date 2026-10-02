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
- 2026-10-01 deferred-compute rejection checkpoint: a selected handler can fail a compiler-mapped `require`
  before reading any unresolved compute value. Recipe mode now reports that source-level VM rejection without
  using the VM trace to plan a resource. It refuses this path if the active body is ambiguous or if execution
  reads a deferred sidecar unlocking script/output commitment. Focused safety tests and their adjacent title,
  build, and focused lint pass. The unchanged `take job > sanity checks` title advanced past `not whitelisted`,
  creator/arbitrator identity, and `not registered` checks; it remains red at the empty-signature custom-error
  case, where ecrecover is still deferred. The preceding marketplace title has not been rerun for this change
  because this title has not turned green.
- 2026-10-01 focused negative-path checkpoint: runtime custom-error argument sideband now reports the executed
  `ECDSAInvalidSignatureLength(0)` tuple, and the matcher checks that same rejected transaction. Exact active
  `OP_INVOKE` bodies retain source-require attribution in preflight. Address-returning recovery now returns the
  zero-address sentinel for an invalid `v` before reading recovery sidecars (empty native P2PKH address or 20-byte
  EVM address); this is compiler behavior, not a deferred-compute planner waiver. The unchanged Marketplace
  `take job > sanity checks` title **passes** (1 selected, 65 skipped), as does its immediately preceding
  `withdraw collateral > withdraw collateral` title. Focused custom-error, VM-diagnostic, and invalid-`v` tests
  pass; `yarn build` and targeted lint pass. This does not establish the remaining 66-title or broad beta gates.
- 2026-10-01 complete-compile checkpoint: root fixture dependencies `@sablier/lockup` and `@prb/math` are now
  declared. The subsequent 8 GB heap wall was isolated to `MockSablierLockup.sol` with its diamond import graph:
  whole-program snapshots expanded each shared subtree independently. Snapshot cloning now preserves graph aliases;
  local inlining still makes independent clones. The focused routed-import regression and its immediately preceding
  clone-alias title pass. A normal, complete Marketplace project compile now **passes** with a 4 GB Node heap and
  publishes the current artifact context. Its regenerated `takeJob` ABI and relevant executable bodies are byte-
  identical to the iteration artifacts used by the green focused Marketplace titles. This remains a focused
  checkpoint, not a comprehensive test or beta-gate pass.
- 2026-10-01 focused pay-start checkpoint: the unchanged `pay start job > sanity checks` title initially failed
  while planning a later `getArbitratorFee` call. Its compiler-published argument recursively referenced the
  struct rebuild that was still evaluating old fields after a sibling storage-pointer write. State-field
  provenance now looks through that self-referential write to the prior authenticated state read. A neutral
  compiler regression and its immediately preceding title pass. After `yarn build` and a normal complete
  Marketplace compile, the unchanged sanity-check title and its immediately preceding `take job multiple` title
  both pass individually (1 selected, 65 skipped each). The other Marketplace titles remain unverified here.
- 2026-10-01 focused message checkpoint: the unchanged `post thread message > sanity checks` title now passes
  individually (1 selected, 65 skipped), as does its immediately preceding `pay start job > pay start job` title.
  A consumed logical-identity NFT is relocated if its provisional output is reserved for a reverse suffix. When
  authoritative suffix commitments exist, finalization writes them in place rather than splicing an earlier
  chunk run across fixed participant output indices. The SDK also accepts an address-bearing signer in an
  address-typed ABI argument, matching the upstream negative-path call. The relevant focused regressions and
  adjacent checks pass. No comprehensive suite or beta gate was run for this checkpoint.
- 2026-10-01 focused deliver-result checkpoint: the unchanged `deliver result > sanity checks` title passes
  individually (1 selected, 65 skipped), as does its immediately preceding `post thread message > post thread
  message` title. Derived value chunks and learned delegate events can replace provisional funder/change outputs
  after the first conservation pass. Final-layout reassertion now returns that exposed surplus to the funder
  after those materializers settle, instead of treating nearly 200M sats as a fee. The fee cap and upstream test
  assertions were unchanged. This is focused evidence, not a comprehensive Marketplace or beta-gate result.
- 2026-10-01 focused refusal and branch-sync checkpoint: the unchanged `refuse arbitration > job taken` title
  passes individually (1 selected, 65 skipped), as does its immediately preceding `job not taken` title. A helper
  called with a constant-false branch guard had left a computed whitelist key in provisional route metadata even
  though its lowered handler had no entry access or physical slot. Late publication now omits only that inactive
  expression witness, preserving the argument witness checked by the route; the focused compiler regression and
  its preceding title pass. `yarn build` and repository `yarn lint` pass. The beta branch now contains the two
  documentation-only commits added to `solidcash_v0.13.1`; the message-bus reference generator is idempotent
  against the merged schema. A website build exposed one stale SolidHat deployment anchor; after correcting the
  link, the production website build passes without broken-anchor warnings. These are focused results, not a
  current 66-title or beta-gate pass.
- 2026-10-01 cold-compile spot check: two fresh, cache-disabled MarketplaceV1 kernel compiles agree exactly
  (19,367 route bytes, 262,494 full debug bytes, identical route/full/metadata hashes, zero caught compiler
  attempts; compiler times 8.15s and 7.94s). One fresh UnicrowClaim kernel compile produced a 2,640-byte route
  with zero caught attempts. The frozen beta manifest still pins 12,102 and 2,918 route bytes respectively, so
  its cold-baseline comparison is stale; do not repin it from a partial sample. A separate legacy Marketplace
  sample measured a 59,627-byte route but was not repeated for deterministic comparison. The cold profiler now
  verifies the compiler's certificate against assembled redeem-script bytes: current kernel certificates report
  264,015 bytes for MarketplaceV1 and 16,904 for UnicrowClaim, both over the 10,000-byte P2SH limit. The old
  manifest's route-only `deployability` field falsely asserted UnicrowClaim deployment; it is now explicitly a
  route-size screen, which cannot establish full-contract deployability. Manifest-only static validation passes
  without checking source fingerprints or running tests or cold compiles. The complete cold matrix and beta gate
  remain unrun.
- 2026-10-02 verifier-size checkpoint: the unchanged graph verifier/compute-sidecar size title now passes. For a
  fixed-state participant without collections, containers, upgrades, lifecycle, or a delegatecall resource slot,
  the detached verifier rejects nonzero resource modes instead of carrying the unreachable INSERT/DELETE/container/
  replacement parsers. Ordinary typed graph calls do not reserve that slot; the compiler computes the delegate-slot
  count once for both specialization and route layout. The
  mode-zero checks are retained, and the sidecar verifier's pure conjunctions are emitted as equivalent individual
  requirements. The measured graph verifier fell from 7,902 to 7,137 bytes; its same-source SHA256 control is
  6,806 bytes. The immediately preceding pure-returning-sink title passes. The separate scalar-master size title
  also passes after splitting ordered, side-effect-free binder requirements: composed size fell from 1,403 to
  1,372 bytes and framework tax from 1,263 to 1,232. Its exact-size drift pin was lowered accordingly; the
  1,400/1,250 ceilings were unchanged. That first title has no predecessor, so its immediate successor was the
  one regression check. No broad suite or beta gate was run.
- 2026-10-02 release-input checkpoint: `node scripts/kernel-beta-gate.mjs --sources-only --allow-dirty`
  validates the static manifest fences and both maintained source-plus-import-closure fingerprints without
  launching tests, builds, or cold compiles; it passes. The full gate now performs this inexpensive fingerprint
  check before its broad test commands. A single current UnicrowClaim kernel spot compile measured 16,875 redeem-
  script bytes (still over the 10,000-byte limit), 2,640 route bytes, and zero caught compiler attempts. This is
  not a deterministic cold-matrix result and does not repin the stale manifest baseline.
- 2026-10-02 size-breakdown follow-up: one fresh, single-root UnicrowClaim diagnostic compile still emits a
  16,875-byte redeem script. Its 2,640-byte route is not the dominant cost: five routed handler bodies total
  5,731 bytes (the two claim handlers are 2,651 and 2,606), while the route plus direct selector bodies total
  5,599 bytes (2,640 route plus 2,959 direct), and 163 outlined source spans total 2,426 bytes. Among 207 invoke
  bodies, exact duplicate bytecode accounts for at most 388 raw body bytes before dispatch overhead. Even
  hypothetically removing all direct selector bodies would leave 13,916 bytes, so neither selector deduplication
  nor identical-body sharing can close the 6,875-byte deployability gap. This is a spot diagnostic, not a cold-
  matrix result or manifest repin. A fresh single-root compile with compilation-speed optimization disabled
  emitted the same 16,875-byte script, so toggling that option does not recover the missing capacity.
- 2026-10-02 split-capacity follow-up: an isolated `compileFileSplit` of the same UnicrowClaim source with the
  current kernel options fails closed at `SPLIT_CLOSURE_CAPACITY`: its singleton `claim` closure measures 16,839
  bytes against the 10,000-byte shard limit. Entry-point facet packing therefore cannot deploy this contract;
  cutting the listed internal helpers would require authenticated argument/result transport (and a continuation
  for stateful cuts), not a different packing order. Its pre-semantic cut profile initially missed the typed
  calls in `calculateSplits`; source-side receiver tracking now reports `externalCalls: true` for that helper
  while `calculatePayments` remains false. The focused red diagnostic title and its immediately preceding title
  pass; a fresh single-root split still refuses the 16,839-byte closure. This profile is diagnostic evidence,
  not authorization to cut a helper without an authenticated transport design.
- 2026-10-02 arbitration-source size follow-up: a fresh single-root UnicrowArbitrator kernel compile emits
  18,761 redeem-script bytes, and `compileFileSplit` refuses its 16,267-byte singleton `arbitrate` closure at
  `SPLIT_CLOSURE_CAPACITY`. Both ends of the Unicrow arbitration callback path therefore need a deployability
  design before that exact path can receive a BCH consensus VM proof; the neutral callback proofs do not cover it.
- 2026-10-02 focused proxy-application checkpoint: the unchanged Marketplace `job posting > post job 1` title
  now reaches its event-data assertion but remains red (1 selected, 65 skipped). The proxy application's
  `abi.encodePacked(uint160(token_))` publishes a 20-byte identity, as the existing compiler cast test requires;
  its decoder reads 20 bytes while the test compares the result with the full 35-byte BCH P2SH32 locking
  bytecode from `fakeToken.getAddress()`. This is an application-port wire-format mismatch, not evidence for
  changing the compiler's narrowing cast or weakening the test. The observed 20 bytes are exactly `HASH160` of
  that P2SH32 locking bytecode. Solidity-compatible `abi.encodePacked(address)` also projects to 20 bytes, so
  removing the explicit `uint160` cast alone would not preserve the full BCH address; the testing shim
  intentionally does not equate an untyped hash with a native address. The proxy application was not modified.
  Individually retested titles from an older red compiler/SDK log passed, confirming that log is stale; they do
  not establish any broader suite status.
- 2026-10-02 focused whitelist follow-up: the unchanged Marketplace `job posting > post job with whitelist`
  title passes on the proxy branch (1 selected, 65 skipped). This does not resolve the separate `post job 1`
  event-format assertion or establish a 66-title result. After the active band-helper rename,
  `node scripts/kernel-beta-gate.mjs --sources-only --allow-dirty` still reports matched source fingerprints;
  that diagnostic skips all tests and cold compiles.
- 2026-10-02 fresh proxy update-job checkpoint: after a normal 22-source Marketplace compile, the unchanged
  `job updates > update job` title passes the earlier graph-emission VM comparison and reaches application event
  replay. Its authenticated planned Created-event payload is 155 bytes and its token field is the correct 20-byte
  `HASH160` identity of the P2SH32 token lock. The application's `decodeAddress` fallback advanced 21 bytes for
  that field, shifting subsequent fields into an invalid UTF-8 read. Advancing exactly 20 bytes fixes the cursor;
  a focused decoder regression and its preceding native-lock regression pass. The unchanged `update job` title
  now passes (1 selected, 65 skipped), as does its immediately preceding `should whitelist worker` title. The
  separate `post job 1` assertion still expects a full 35-byte lock from a 20-byte event identity, so the event's
  BCH wire format needs an explicit application decision. No Marketplace source or suite assertion was changed,
  and no broader Marketplace run was made.
- 2026-10-02 Created-event decoder follow-up: a focused regression showed that byte-prefix sniffing can mistake
  a valid 20-byte `uint160(token_)` identity plus later amount bytes for a 35-byte P2SH32 lock. Created-event
  replay now reads the token field at its declared 20-byte width; the exact collision title and its immediately
  preceding packed-identity title pass. The event-format decision for `post job 1` remains open. The root build
  passes. The app's independent TypeScript check originally reported a missing generated wagmi module, an obsolete
  cipher import, and two implicit-any callbacks outside these edited decoder files. The cipher import has since
  been replaced with WebCrypto nonce generation; its focused encrypted/unencrypted titles pass. At that
  checkpoint the missing wagmi module and two callback diagnostics remained. No broader tests were run.
- 2026-10-02 proxy app typecheck follow-up: the proxy application's source-level `MarketplaceDataV1` wagmi ABI
  was restored from the original proxy project after confirming its Solidity source SHA-256 matches the port
  exactly. This is the EVM-facing ABI used by the replay model, not the SolidCash artifact's hidden-argument
  execution ABI. The app TypeScript check now passes; focused ABI source-pin and read-method titles pass
  individually. The `post job 1` 20-byte versus 35-byte event-format decision remains open.
- 2026-10-02 typegen checkpoint (`91600bd8f`): a complete compile reproduced unrelated imported enum aliases
  in interface binding modules. Type generation now includes only enum names mentioned by the declaration's
  source (or the artifact's recorded source when that declaration file is unavailable), and its cache key tracks
  that selection.
  The exact new regression and its immediately preceding imported-error-interface title pass; `yarn build`,
  focused lint, the normal Marketplace compile, and the sources-only beta gate pass. Regenerated bindings remove
  unused aliases from six modules. This is not a comprehensive test or beta-gate result.
- 2026-10-02 automatic-selection checkpoint: a new regression exposed that a nested local declaration after a
  typed external call could make auto selection overlook that reachable graph edge. The source-level receiver
  survey now follows declaration order and block scope; the regression and its immediately preceding typed-state-
  receiver title pass individually. `yarn build`, lint for the changed compiler/test files, and the static
  sources-only beta gate pass. No broad compiler suite or beta gate was run.
- 2026-10-02 reachable free-helper checkpoint: auto selection now follows calls into reachable file-level
  functions without treating a same-signature function shadowed by a contract member as a graph edge. The
  external-call helper inliner also recognizes interface-instantiation method calls before semantic hidden
  parameters are added; otherwise the retained source-arity call failed type checking. The new reachable-helper
  and shadowed-helper titles each pass individually, with the immediately preceding title checked after each
  fix. `yarn build`, targeted lint, and the static sources-only gate pass; no broad tests or cold gate ran.
- 2026-10-02 graph-free library-call checkpoint: a reachable `Library.call(...)` helper was misread as an address
  `.call(data)` edge and enabled the default message bus. Source selection now recognizes declared library
  functions while conservatively retaining the graph interpretation if a value binding may shadow the library.
  Auto-narrowed graph-free contracts use the same direct lowering as an explicit `messageBus: false` compile.
  The focused new title and its immediately preceding local-helper title pass; `yarn build`, targeted lint, and
  the static sources-only gate pass. Regenerated GoldenToken and transfer-with-timeout scripts shrink from
  786 to 752 and 40 to 35 bytes respectively. No broad suite or cold beta gate ran.
- 2026-10-02 typed-state receiver checkpoint: the auto-selection survey missed a cross-contract call spelled
  `this.sink.note(...)` because it is a method call on a state-access node, not the namespaced call used by
  `sink.note(...)`. It now selects the graph route for an explicitly qualified interface-typed state receiver;
  the focused red-to-green title confirms one published external call and an available route. Its immediately
  preceding bare-state-receiver title passes. No broad compiler suite or beta gate was run.
- 2026-10-02 qualified low-level receiver follow-up: the same pre-semantic gap also narrowed
  `this.peer.call(data)` to direct-only code when `peer` was an ordinary address state field. Auto selection now
  recognizes qualified address-state `call` and `staticcall` while retaining the delegatecall exclusion. The
  focused red-to-green title proves both modes publish one external call on an available graph route; its
  immediately preceding typed-state-receiver title passes. No broad compiler suite or beta gate was run.
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
  resource metadata in a dedicated refactor, separately from capability work. The active band-width and
  band-range helpers now use chunkable-value names and an entry-chunk count; this is a naming change, not
  retirement of the remaining legacy adapter. The active continuation-lock field and SDK-internal callers now
  use value-chunk names; the historical getter/setter remain deprecated compatibility aliases. The band planner
  and placement module now expose value-chunk names as well; their legacy persistence backing remains fenced.
  The band planner reads the historical `jobEvents` collection only for the selected historical publisher; a
  renamed selected writer cannot inherit the name from another group, and multiple compiler-published collections
  fail closed. Both focused new
  regression titles and their immediately preceding titles pass; this does not establish a broad SDK gate.
- The focused `post two jobs` scenario is green after a fresh compile. A neutral BCH-2026 regression proves zero,
  one, and two repeated getter results whose exact affine domain consumes an authenticated earlier scalar result.
  The compiler preserves the source callsite-to-returned-array link before memory lowering; the SDK retains one
  physical callsite and resolves each reached occurrence from its planned arguments. This is a focused checkpoint,
  not evidence that the 66-title beta gate or the previously observed shared-owner callback cycle is resolved.
- A static audit of the same-owner callback path identifies two separate missing proofs: the physical-owner
  derivation plan deliberately declines cyclic components until authenticated convergence exists, while late
  transitive expansion searches only external-call groups for an existing owner and therefore cannot identify
  the transaction root as the physical carrier of an A→B→A callback. Removing the legacy circular-call refusal
  alone would leave a second spend of A's master UTXO; no callback acceptance change was made on this evidence.
  The source path to prove is `UnicrowArbitrator.arbitrate → UnicrowClaim.claim →
  UnicrowArbitrator.getArbitratorData`, with the getter observing the earlier `arbitrated = true` write.
- 2026-10-02 finite-callback follow-up: a neutral BCH-2026 A.run → B.relay → A.observe graph now passes
  through ordinary `send()` by discovering the compiler-described typed edges before legacy transitive
  derivation, then composing one physical A master with ordered logical A rows. A separate explicit-composer
  proof checks every VM input and the authenticated post-write return. A third focused title changes B's stored
  typed address to a separately compiled implementation while its interface registry still names A; the sent
  transaction follows the stored address and returns that implementation's value. All three titles passed
  individually; each formerly red natural-call title was followed by its immediate preceding title. This
  establishes the finite neutral callback and dynamic-target semantics, not the specific Unicrow source path,
  10KB deployability, or a broad Marketplace/beta-gate result. `build()` remains a preliminary builder for
  transparent atomic promotion;
  `send()` is the transaction-producing API for this path.
- 2026-10-02 result-guarded callback follow-up: a second neutral A callback reached only when B observes the
  authenticated result of the first was initially refused as an unresolved mandatory target. Source lowering
  retained the call's guard but published its occurrence as `once`; the compiler now publishes that guarded edge
  as conditional (zero or one row). The exact red title now passes through ordinary `send()`, with one A master,
  post-write state 7, and authenticated root return 14. Its preceding dynamic-target title passes. A focused
  compiler metadata title and its preceding predicate-call title pass as well. This does not prove the full
  Unicrow source path or 10KB deployability.
- 2026-10-02 guard-false follow-up: the same neutral A→B→A callback fixture also sends successfully when the
  first authenticated return is zero, omitting B's later conditional call to A. The focused new title and its
  immediately preceding guard-true title pass individually; no broad suite was run.
- The unchanged proxy Marketplace `arbitrate > arbitrate 80-20` title passes individually on mock BCH-2026
  (1 selected, 65 skipped; 411.56 seconds in the test body). It is not a reproduction of the same-owner
  callback gap above and does not establish the other arbitration titles or the 66-title gate. No predecessor
  regression title was run because this title was not red.
- Internally consumed repeated returns now use compact carriers only for a dense zero-based reached prefix; sparse
  source iterations and downstream graph consumers remain fail-closed without occurrence-qualified identities.
  Read-only argument-keyed entry handlers publish two authenticated fixed tuple lanes, independent of the route's
  maximum row count; a third distinct identity remains fail-closed. The focused invalid-tag Marketplace title and
  its adjacent unregistered-arbitrator title pass unchanged after a fresh four-job compile.
- 2026-10-02 auto-selection scope follow-up: the pre-semantic survey no longer lets a local binding in an
  unrelated or nested block turn `Library.call(...)` into a speculative low-level graph edge. It still selects a
  real scoped `address.call(data)` edge. The exact new title and its immediately preceding library-call title
  pass individually; no broad compiler suite was run.
- 2026-10-02 pointer-selection follow-up: an unused internal function-pointer declaration no longer expands
  source selection to unrelated dormant foreign-call helpers. The measured fixture previously auto-emitted
  2,141 bytes versus 687 direct bytes; it now matches the direct artifact, while an actual internal pointer
  invocation still keeps the conservative reachable-helper survey. The exact title and its predecessor pass.
  External function-pointer calls were a separate admission gap at this checkpoint; the follow-up below covers
  their compiler route and one runtime proof.
- 2026-10-02 external-pointer route follow-up: generated message-bus source now renders function-pointer types
  in parseable source syntax. Contracts with an external pointer input synthesize their route after pointer
  lowering, so the route uses the same `(address, bytes4)` transport shape and selector as the public ABI.
  A focused compiler title proves both lowered and unlowered parameter forms; its preceding title passes. The
  composer now accepts a compiler-identified function-pointer child descriptor, leaving the on-chain graph
  covenant to authenticate its runtime address and selector. A BCH-2026 proof stores a new pointer, co-spends
  a separately compiled callee with the selected method, and checks the original callee stays unchanged; a
  deliberately mismatched child is rejected by VM preflight. That exact title and its immediately preceding
  title pass individually. This is not a complete function-pointer matrix or broad beta-gate result.
- 2026-10-02 conditional-pointer follow-up: a reached conditional stored-pointer call initially left its
  prepared child unconsumed because the source ABI names the dynamic method `__call` while the prepared child
  names the selected method. Conditional occurrence matching now uses the compiler-published callsite ID for
  function-pointer edges; the later graph covenant still checks the concrete address and selector. The focused
  BCH-2026 conditional title and its immediately preceding runtime-pointer title pass individually. The fixture
  seeds the native locking bytecode as bytes, not as its ASCII hex spelling. A separate BCH-2026 title proves an
  untaken pointer edge is omitted while an always-reached sibling settles, then takes the same pointer edge in
  the next transaction and checks all three owners' state. That title and its immediately preceding conditional
  title pass individually. Wider pointer-table cases remain outside this focused proof.
- 2026-10-02 local-pointer target follow-up: an executable local pointer selecting between two different owners
  and methods was missing from an early route's graph survey. A correct child could settle, but a wrong-owner
  child also passed the BCH-2026 VM. Route synthesis now waits until an invoked local or state external pointer
  is lowered to a real foreign edge. A differing-receiver local pointer lowers to one dynamic target/selector
  call only when its branch condition and address operands are stable identifiers; the direct-call epilogue also
  checks the selected target. The focused VM title verifies both graph branches mutate only their selected owner,
  a wrong-owner child is refused at preflight, and a subsequent direct call settles. Its immediately preceding
  untaken-pointer title passes. This does not establish a general pointer-table or broad beta-gate result.

## Gate before the next leap

Debug one known-red title at a time. Once it passes, run only its immediately preceding title for regression.
Do not launch comprehensive suites or the beta gate under the current testing instruction; record the exact
scope and result of each focused check.

1. Freeze the manifest. A successful fresh compile must have no hidden speculative stack/codegen failure, exactly one stable record per graph call, authenticated producer-result IDs, and the same `OP_INVOKE` boundary for graph handlers.
2. Build and affected compiler/SDK/BCH-2026 tests pass. Resolve the broad compiler baseline and remove application-name dependencies without waivers; skipped tests are not passes. Supported kernel and legacy cases must agree on observable state, events, and results, while a separate size test keeps kernel route growth proportional to row logic rather than maximum unrolled rows.
3. Measure cold time and byte size with optimised, clean-env artifacts and recorded options. Preserve the marketplace fixture before any compile that could replace it. A new unsupported edge case stays fail-closed behind a general `KERNEL_*` reason; it does not reopen beta scope solely because a marketplace title reaches it.

Superseded September progress logs and performance experiments are intentionally omitted from this checkpoint.
