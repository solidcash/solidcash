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
  not authorization to cut a helper without an authenticated transport design. A later source-namespace repair
  corrected another cut-profile omission: inherited `_nonReentrantBefore` reads and writes `_status`, and
  `_nonReentrantAfter` writes it. The focused inherited-state title went red-to-green, its preceding generic cut
  title passed, and the real Unicrow split still refuses the same 16,839-byte closure. A subsequent scoped-footprint
  regression showed that a later nested local shadow also hid an earlier bare state access. Footprint analysis now
  follows declaration order and block scope; that exact title and its immediately preceding inherited-state title
  pass. Build, focused lint, and the sources-only static fence pass. A fresh single-root UnicrowClaim split still
  refuses its 16,839-byte singleton `claim` closure; this does not change deployability. A forwarding internal
  helper also inherits the external-call effect of a typed callee in its cut profile; the exact transitive-call
  title and its immediately preceding direct-call title pass. This is still diagnostic only, not a helper-cut
  implementation.
- 2026-10-02 arbitration-source size follow-up: a fresh single-root UnicrowArbitrator kernel compile emits
  18,761 redeem-script bytes, and `compileFileSplit` refuses its 16,267-byte singleton `arbitrate` closure at
  `SPLIT_CLOSURE_CAPACITY`. At that checkpoint both ends needed a deployability design before the exact path
  could receive a BCH consensus VM proof; the later verifier-binding result below supersedes the arbitrator
  capacity finding but not the missing source-path VM proof.
- 2026-10-02 pre-binding UnicrowClaim cut-boundary check: the old split pipeline measured the unchanged `claim`
  singleton at 16,800 bytes. A diagnostic in-memory source variant replacing all three application helper bodies
  (`calculatePayments`, `calculateSplits`, and `claimPayments`) with trivial bodies still measured 14,226 bytes.
  The variant was intentionally not executable or committed. The verifier-binding change below supersedes its
  size conclusion; neither this old probe nor a hypothetical helper cut establishes deployability.
- 2026-10-02 split-facet verifier-binding follow-up: split facets previously bypassed the normal second compiler
  pass, so a facet with a detached verifier program still inlined roughly 6 KB of atomic verification into its
  own redeem script. Facets now run through the ordinary admission and exact verifier-binding pipeline, while
  preserving the source-wide function-pointer-array layout decision and refusing a lost branded-library AST.
  The focused compiler regression went red-to-green (a representative graph facet fell from 8,710 to 2,637
  redeem-script bytes); its immediately preceding getter-layout title passes. A focused BCH-2026 send also
  co-spends the bound split facet and a typed stateful peer, settles both writes, and passes its immediately
  preceding constructor title. The unchanged UnicrowClaim `claim` singleton estimate fell from 16,800 to
  10,256 bytes, including the compiler's spend reserve; its 9,090-byte redeem script fits alone, but the
  10,000-byte whole-spend gate still correctly refuses the shard by 256 bytes. The unchanged UnicrowArbitrator
  now passes `compileFileSplit` at the default whole-spend gate with a 2,749-byte root and three bound facets
  of 7,559, 8,523, and 7,362 redeem-script bytes. This is compiler capacity evidence, not a deployment or
  arbitration callback VM proof. UnicrowClaim remains refused; no broad suite or beta gate was run.
- 2026-10-02 UnicrowClaim capacity probes: the unchanged default split still refuses `claim` at 10,256 estimated
  whole-spend bytes. In a diagnostic, in-memory source variant, returning the existing fixed array directly
  instead of reconstructing it from all five indexed elements reduced the facet redeem script from 9,090 to
  8,917 bytes, only 173 of the required 256. Hoisting the two identical split-calculation array literals into
  the existing local produced a much smaller script only because kernel admission refused `claim` and omitted
  its graph route; that number is not deployability evidence. Adding an extra window-8 outlining attempt to the
  compiler increased the unchanged claim estimate to 10,293 bytes, so the experiment was reverted. Source,
  compiler, and generated artifacts are unchanged after these probes; `yarn build` passes. A real graph-preserving
  reduction, not a smaller spend reserve or an omitted route, remains necessary.
- 2026-10-02 local-array write reduction: element assignment now retains its already-decoded length prefix instead
  of reading and decoding the same local array a second time after replacing the element. A focused five-write
  compiler fixture fell from 1,446 to 1,119 emitted bytes; its exact red-to-green size title and immediately preceding
  local-delete byte-identity title pass. A BCH-2026 VM send checks all five resulting elements, and its immediately
  preceding bounded-array assignment title passes. `yarn build` and focused lint pass. The unchanged UnicrowClaim
  split still refuses `claim`: its measured whole-spend estimate fell only from 10,256 to 10,249 bytes, leaving
  249 bytes. No broad suite or beta gate was run.
- 2026-10-02 fresh fixed-array construction follow-up: the compiler now coalesces consecutive, ascending constant-
  index writes into a new bounded integer local when no right-hand side reads that local. Literal file/contract
  constants qualify only when no parameter or local binding shadows them; the first dependent write remains in
  place. A focused compiler size regression fell from 848 to 673 emitted bytes, then passed its immediately
  preceding array-write regression. A focused BCH VM send verifies all five values, including the dependent
  remainder; its immediately preceding on-chain array-write title passes. `yarn build` and focused lint pass.
  The unchanged UnicrowClaim split now refuses `claim` at 10,133 whole-spend bytes, down 116 but still 133 over
  the real 10,000-byte cap. An analysis-only over-cap facet retains an eligible `claim` graph handler and verifier.
  An in-memory *source* variant combining this construction with direct return of the existing array measures
  8,815 bytes with an eligible handler; at that checkpoint the second rewrite was not implemented or VM-proven.
  No broad suite or beta gate was run.
- 2026-10-02 fixed-array return/facet follow-up: a source-level external function that returns a complete,
  in-order projection of its own freshly constructed bounded integer array now forwards the array directly at
  the ABI boundary. Split preparation applies this before an external entry is demoted to a public delegate
  facet, avoiding the old source/split mismatch. The focused compiler projection test is byte-identical to
  explicit direct return; reordered and parameter-origin projections remain unoptimized. The focused split
  compiler test and its immediately preceding title pass. A BCH VM test deploys a split facet, statically reads
  all five returned amounts, and spends with the return channel; its immediately preceding graph-facet title
  passes. The unchanged proxy-application UnicrowClaim source now passes the default split whole-spend gate:
  root 2,565 redeem bytes; `claim`, `claimMultiple`, and update facets 8,815, 7,838, and 4,870 redeem bytes.
  The `claim` facet retains an eligible graph handler and detached verifier. This proves compiler capacity and
  a generic array-return VM path, not the real Unicrow cross-contract claim spend. No broad suite was run.
- 2026-10-02 focused proxy-application checkpoint: the unchanged Marketplace `job posting > post job 1` title
  now reaches its event-data assertion but remains red (1 selected, 65 skipped). The proxy application's
  `abi.encodePacked(uint160(token_))` publishes a 20-byte identity, as the existing compiler cast test requires;
  its decoder reads 20 bytes while the test compares the result with the full 35-byte BCH P2SH32 locking
  bytecode from `fakeToken.getAddress()`. This is an application-port wire-format mismatch, not evidence for
  changing the compiler's narrowing cast or weakening the test. The observed 20 bytes are exactly `HASH160` of
  that P2SH32 locking bytecode. Solidity-compatible `abi.encodePacked(address)` also projects to 20 bytes, so
  removing the explicit `uint160` cast alone would not preserve the full BCH address; the testing shim
  intentionally does not equate an untyped hash with a native address. The proxy application was not modified.
  Individually retested titles from an older red compiler/SDK log passed, confirming that log is stale. On
  2026-10-02, exact SDK titles for ABI argument-field updates, bounded probe traces, generic value-chunk
  construction, recursive EVM result layout, and independent same-category value-chunk resources each passed
  unchanged (one selected title per run). These checks do not establish any broader suite status or retire
  failures that have not been individually rechecked.
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
- 2026-10-02 using-for `call` follow-up: file-level `using Helpers for uint` and
  `using {Helpers.call} for uint` left `value.call()` at source-selection time, falsely treating a pure local
  extension as an address `.call(data)` edge. Auto selection now recognizes a type-matched, call-free pure library
  leaf while retaining graph selection for address receivers, nested calls, and assembly. Both exact red titles
  now pass with their immediately preceding regression titles; build and focused lint pass. A representative
  extension shrinks from 2,379 to 623 redeem-script bytes, matching explicit direct compilation. No broad suite
  or beta gate was run.
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
- 2026-10-02 interface-collection receiver checkpoint: an interface-valued mapping entry call
  `strategy[id].note(...)` also narrowed to direct-only code. The parser represents its receiver as an indexed
  array-access node rooted at the collection name. Auto selection now follows the declared terminal element
  type in its lexical-scope survey, so local declarations can still shadow the collection. The focused
  red-to-green title publishes an available graph route and one external call; its immediately preceding
  low-level state-address title passes. No broad compiler suite or beta gate was run.
- 2026-10-02 stored-struct receiver follow-up: `holders[id].target.note(...)`, with an interface field in a
  stored struct entry, likewise compiled direct-only by default. The scoped source survey now resolves declared
  types across indexes and struct fields before deciding whether a method call crosses a contract boundary.
  The focused red-to-green title confirms one external call on an available graph route; its immediately
  preceding mapping-value title passes. No broad compiler suite or beta gate was run.
- 2026-10-02 helper and literal-index receiver follow-up: `getSink().note(...)` and `sinks[0].note(...)`
  also compiled direct-only despite supported external-call lowering. The source survey now follows a reachable
  helper's single return type and the parser's literal-index node for an interface array. Each exact red title
  passed after its fix, followed only by its immediately preceding title. Build and focused lint pass; no broad
  test suite or beta gate was run.
- 2026-10-02 context-address receiver follow-up: `msg.sender.call(payload)` previously bypassed automatic
  graph selection even though its ABI published a raw external call. The pre-semantic survey now recognizes
  address-valued context globals as low-level call receivers. The original stateless probe could not enter
  route synthesis because it has no master NFT; its diagnostic now names that prerequisite rather than calling
  the handler unexamined. A stateful raw-call result consumer was initially refused in auto mode; the bounded
  admission follow-up below supersedes that refusal. The exact diagnostic title and its preceding stateful
  selection title passed at this checkpoint.
- 2026-10-02 bounded raw-call auto-admission follow-up: auto-selected kernel graphs now use the same authenticated
  continuation as explicit graphs for a finite, bounded low-level call. A declared-target BCH-2026 compose/send
  proof passes with byte-identical caller code in auto and explicit modes; its immediately preceding explicit
  proof passes. A separately prepared A→B→A graph passes every VM input with one A master while B calls
  `msg.sender` and requires A's authenticated post-write return; its immediately preceding typed callback proof
  passes. The focused compiler admission title and its preceding literal-index title pass. At this checkpoint,
  natural `.send()` discovery for the raw A→B→A form remained red at the legacy circular-call refusal; manual
  graph composition did not establish that automatic SDK path. No broad suite or beta gate was run.
- 2026-10-02 natural raw-callback follow-up: early graph discovery now resolves a bounded low-level call's
  concrete selector and arguments from its forwarded canonical payload, after selecting the runtime callee.
  The ordinary `a.call.run(payload).send()` path settles the `msg.sender` A→B→A callback and uses distinct
  outpoints; it does not bypass the legacy duplicate-owner guard. The exact natural-send title and its
  immediately preceding manual BCH-2026 VM proof pass. `yarn build`, focused lint, and the static sources-only
  beta gate pass. No broad suite or cold beta gate was run.
- 2026-10-02 forwarded-argument follow-up: a second focused natural-send proof selects a different callback
  handler from the runtime payload and passes its canonical `uint256` argument. The full A→B→A transaction
  settles with distinct outpoints; this checks that discovery is not limited to selector-only calldata. The
  exact new title and its immediately preceding selector-only title pass, and `yarn build` passes. No broad
  tests or cold beta gate were run.
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
  The active SDK continuation path now names its band-hole fill, pending predecessor placement, and persisted
  one-to-one reassertion for value chunks, including their host interfaces and diagnostic field. The historical
  JobEvents-named import shim remains explicitly deprecated, and the legacy persistence backing still needs its
  own metadata-driven retirement. This naming-only change passed `yarn build` and targeted lint; no tests were
  launched for the rename under the current exact-red-title testing instruction.
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
- 2026-10-02 real-source arbitration follow-up: the unchanged `UnicrowArbitrator`, `UnicrowClaim`, and `Unicrow`
  sources compile with the relaxed BCH-2026 semantic profile. An explicit eight-row composition of their
  direct compiled artifacts sends the real
  `arbitrate → settle → claim → getArbitratorData → arbitrationCalculation → setClaimed` path successfully;
  the claimant observes the arbitrator's preceding `arbitrated = true` mapping write, and the final Unicrow escrow
  is claimed with the 80/20 split. This is a semantic VM proof under relaxed capacity, not a proxy-carrier,
  10 KB, or relay claim.
- 2026-10-02 real-source natural-send follow-up: ordinary `arbitrator.call.arbitrate(...).send()` initially refused
  the mandatory `Unicrow.settle` edge with `L3_TARGET_UNRESOLVED`, because topology discovery could not form a
  complete candidate graph before receiving `getEscrow`'s result. Initial discovery now uses typed empty results
  only to enumerate candidate downstream rows. They are never prepared/authenticated return commitments: the
  composition must observe actual producer returns, rebuild result-dependent arguments and branch topology,
  then pass its complete VM preflight before send. The exact ordinary-send title now passes against the same three
  unchanged direct compiled sources and reads the arbitrator's post-write value through Claim. Its immediately
  preceding explicit-composition title passes individually. This is still not a proxy-carrier or production-
  capacity proof; no broad suite ran.
- 2026-10-02 real-source proxy follow-up: ordinary `arbitrator.forward('arbitrate', ...).send()` now composes
  the unchanged Arbitrator, Claim, and Unicrow sources through three state-holding proxy carriers under the
  relaxed BCH-2026 VM. The exact title checks the arbitrator's preceding mapping write and the final claimed
  80/20 escrow; the direct ordinary-send title passes as its focused predecessor. Proxy deployment needed an
  explicit implementation-constructor-arguments option. Early callback discovery now recognizes the built-in
  proxy's single delegate root, and composed compiler-routed delegates no longer append a second legacy executor
  output block beyond their published balanced span. This proves the real proxy callback semantics for this
  fixture, not the full Marketplace gate or standard-capacity deployment; no broad suite ran.
- 2026-10-02 nested-loop claim follow-up: the compiler now publishes separate, exact outer/inner affine domains
  for the unchanged `UnicrowClaim.claimMultiple` → `claimPayments` → `sendEscrowShare` edge, retaining the
  input-array-length domain added earlier. The SDK binds each exact outer induction coordinate before evaluating
  the inner loop, and a neutral VM title now executes four `Sink.record` rows across two outer occurrences; its
  immediately preceding one-outer title passes. At this checkpoint, repeated outer paths requiring producer
  results remained fail-closed; the later occurrence-qualified interleaving checkpoint below supersedes that
  limitation for an exact shared outer domain. The compiler withholds a nested domain if an inner bound mutates
  inside its outer loop. The unchanged proxy `claimMultiple([1])` title also
  passes with the seeded zero-amount escrow, including its immediately preceding arbitration title. A later
  funded claim also passes BCH-2026 preflight and sends 1,000 sats to the seller's P2PKH locking bytecode, with
  the zero-value claim checked as its preceding regression. That payout exposed three real gaps: the SDK compared
  the forwarded zero-currency address to numeric `address(0)` as unequal and left the transfer inactive; the proxy
  builder selected its forwarder ABI instead of the authenticated delegate route when loading the satoshi
  container; and compiler/SDK disagreed on the native payment script for a Solidity address identity. The fixes
  keep the bytecode/output covenant active and preserve complete native locking bytecode. This is a relaxed-
  conditions showcase proof, not a broad Marketplace gate or standard-capacity deployment claim.
- The unchanged proxy Marketplace `arbitrate > arbitrate 80-20` title passes individually on mock BCH-2026
  (1 selected, 65 skipped; 411.56 seconds in the test body). It is not a reproduction of the same-owner
  callback gap above and does not establish the other arbitration titles or the 66-title gate. No predecessor
  regression title was run because this title was not red.
- Internally consumed repeated returns used compact carriers only for a dense zero-based reached prefix at this
  checkpoint; sparse source iterations with downstream graph consumers were still fail-closed then, before the
  occurrence-qualified follow-up below.
  Read-only argument-keyed entry handlers publish two authenticated fixed tuple lanes, independent of the route's
  maximum row count; a third distinct identity remains fail-closed. The focused invalid-tag Marketplace title and
  its adjacent unregistered-arbitrator title pass unchanged after a fresh four-job compile.
- 2026-10-02 auto-selection scope follow-up: the pre-semantic survey no longer lets a local binding in an
  unrelated or nested block turn `Library.call(...)` into a speculative low-level graph edge. It still selects a
  real scoped `address.call(data)` edge. The exact new title and its immediately preceding library-call title
  pass individually; no broad compiler suite was run.
- 2026-10-02 finite typed-helper follow-up: a `using-for` helper with one typed foreign call published that edge,
  but automatic mode refused its handler while an explicit route admitted it. Automatic kernel admission now uses
  the same source-bounded, acyclic runtime row form for typed calls; raw calls and protocol-only bounds remain
  explicit-only. The exact compiler title went red-to-green and its preceding graph-free library title passed.
  A focused BCH-2026 composition and send proved the automatic caller against an explicitly prepared leaf,
  including the callee's state change; its immediately preceding VM title passed. Build, focused lint, and the
  source-only beta fence passed. No comprehensive suite or cold gate was run.
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
- 2026-10-02 unreachable-library opt-out follow-up: a direct-only UnicrowClaim split was refused first by
  imported, unused `SafeERC20.safePermit` because that helper repeats typed calls to one owner. The explicit
  `messageBus: false` guard now uses the same conservative free-function reachability as dead-helper pruning:
  unreachable helpers remain typechecked but do not impose a runtime graph requirement on the selected contract.
  The focused library title went red-to-green, its immediately preceding multi-artifact/split opt-out title passes,
  and a fresh direct-only UnicrowClaim probe advances to the legitimate `claimMultiple` repeated-owner refusal.
  This does not make either UnicrowClaim entry deployable or relax the reached-call safety check.
- 2026-10-02 unreachable-internal opt-out follow-up: the same runtime-only `MESSAGE_BUS_REQUIRED` guard also
  inspected dead internal contract methods. It now shares the conservative entry-root closure used by dead-method
  pruning. An unused internal repeated-call pair compiles direct-only by default and matches explicit direct
  bytecode; calling that helper still makes `messageBus: false` fail closed. The exact title went red-to-green and
  its immediately preceding unreachable-library title passes. No broad suite was run.
- 2026-10-02 ternary-interface target follow-up: `(choose ? left : right).note(amount)` now resolves a single
  same-interface ABI without pinning either receiver's bytecode. Automatic selection recognizes the reachable
  foreign edge, and the direct epilogue authenticates the runtime-selected locking bytecode only when the branch
  condition and both address operands are stable parameters. A post-call condition write is refused at compile
  time. The focused BCH-2026 proof accepts both branches with different callee bytecode and rejects a wrong-owner
  child; that title and its immediately preceding pointer title pass individually. The compiler selection title
  and its immediately preceding indexed-receiver title also pass individually. No broad suite was run.
- 2026-10-02 legacy value-chunk readiness follow-up: descriptor-free compatibility sends now record readiness by
  category rather than one mutable session-wide boolean. Clearing one category no longer makes a different
  category appear unready; both historical event-reassert paths use the selected publisher category when deciding
  whether to stamp an append timestamp. The neutral readiness name is available while the historical export stays
  as a compatibility alias. The exact new session title went red-to-green and its immediately preceding isolation
  title passes. This does not retire the remaining legacy schema adapter or establish a broad SDK gate.
- 2026-10-02 legacy writer-planning follow-up: the descriptor-free rematerialization and persisted-readiness
  decisions now use the selected publisher category, and an unresolved category has zero persisted width instead
  of borrowing another category's cached width. A focused title with an unrelated ready category went red-to-green;
  after recording the selected category it proves the update path can still proceed. Its immediately preceding
  legacy collection-fallback title passes. Three older nested-create/derive consumers still used an aggregate
  compatibility fallback at this checkpoint; the follow-up below narrows them.
- 2026-10-02 nested compatibility append follow-up: append width is now the ready continuation width for the
  category already used to stage the derived value, the resolved proxy callee, or the derive pass's selected
  writer. It cannot be borrowed from another ready category. The persisted-category resolver also prefers the
  selected proxy publisher over an unrelated cached predecessor; an unpaired delegate executor without a
  published state owner is not enough to infer a proxy from cache insertion order. The focused width, proxy
  priority, and unpaired-delegate titles each went red-to-green, with each immediately preceding title checked.
  A fresh unchanged proxy `job posting > post job 1` run (one selected, 65 skipped) reaches the same 20-byte
  identity versus 35-byte BCH lock assertion, without an earlier planning failure. That title remains red pending
  the application wire-format choice; this is not a broad SDK or Marketplace result.
- 2026-10-02 compatibility lock/value follow-up: a lock observed for one category no longer inherits the most
  recent value of another category when seeding observed state or a Created digest. Its own later value still pairs
  with the retained lock. The exact session title went red-to-green and its immediately preceding readiness title
  passes. A fresh single-root UnicrowClaim split diagnostic still refuses the 16,839-byte singleton `claim`
  closure; the unsplit script measured 16,854 bytes. This remains a deployability blocker, not a helper-cut proof.
- 2026-10-02 compatibility predecessor follow-up: restoration for a selected category now reads only that
  category's cached lock, value, spend outpoints, and unlock recipe. A different category's latest recipe no longer
  redirects the minting-master lookup. The focused restore title went red-to-green and its immediately preceding
  lock/value title passes. This removes one cross-category compatibility fallback; it is not a broad SDK result.
- 2026-10-02 compatibility recovery follow-up: legacy unlock-recipe recovery now requires the selected category's
  own value and lock to match its derived script. A successful value-chunk send no longer borrows the latest staged
  value from another category or broadcasts one committed value and recipe across all cached categories. Both new
  focused titles went red-to-green, each with its immediately preceding title passing. No broad suite was run.
- 2026-10-02 unselected compatibility owner follow-up: the SDK no longer reads the latest cached staged or
  committed value when descriptor-free planning cannot identify a category. An exact category lookup still works;
  compiler-described exact resources are unaffected. The focused title went red-to-green and its immediately
  preceding compatibility-band title passes. No broad suite was run.
- 2026-10-02 delegate persist-owner follow-up: an implementation-only legacy delegate group no longer selects
  a proxy owner from whichever unrelated persisted lock or recipe entered the settlement cache first. An explicit
  state-owner descriptor still selects the proxy, and a direct low-level call selects its own category. The
  focused title went red-to-green and its immediately preceding append-owner title passes. No broad suite ran.
- 2026-10-02 compatibility lock-derivation follow-up: a cached legacy unlock recipe must name the requested
  category before it can derive that category's P2SH32 lock. The focused title went red-to-green, also proves a
  correctly owned recipe still derives its lock, and its immediately preceding unselected-value title passes.
  This is a category-identity check, not a solution for the oversized Unicrow singleton closures.
- 2026-10-02 predecessor-fetch follow-up: continuation restoration now consults a legacy recipe only when its
  descriptor-free compatibility fallback is permitted. The token-aware address conversion also consumes libauth's
  successful `{ address }` result, so the allowed legacy route can actually query and place its mutable predecessor;
  the compiler-described route does neither. The exact title went red-to-green and its immediately preceding
  lock-derivation title passes. No broad suite or full beta gate was run.
- 2026-10-02 regtest predecessor follow-up: the same selected legacy predecessor fetch now uses the SDK's shared
  network-prefix mapping, so regtest queries `bchreg:` rather than `bchtest:` while chipnet keeps `bchtest:`.
  The exact title went red-to-green with both networks covered, and its immediately preceding lock-derivation
  title passes. No broad suite or full beta gate was run.
- 2026-10-02 continuation naming follow-up: the active derive pass and extracted restoration helper now use
  `ensurePersistedValueChunkInputs` and generic host hooks. The historical `JobEvents` builder method and module
  remain deprecated adapters for existing callers; legacy collection inference stays fenced inside the helper.
  The focused predecessor-fetch title and its immediately preceding lock-derivation title pass after the rename.
- 2026-10-02 provider category normalization follow-up: a fetched mutable predecessor with an uppercase hex
  category now matches the selected category and enters the builder with canonical lowercase text. The focused
  predecessor-fetch title went red-to-green and its immediately preceding lock-derivation title passes. No broad
  suite was run.
- 2026-10-02 cached predecessor category follow-up: a cached spend at the selected continuation script lock is
  restored only when its mutable NFT also has the selected category. Matching uppercase category text is
  normalized; a foreign token sent to the same lock cannot enter the selected writer's predecessor list. The
  exact new title went red-to-green and its immediately preceding fetch-gating title passes. `yarn build` and
  focused lint pass; no broad test suite was run.
- 2026-10-02 stored recipe category follow-up: a recipe cached under the selected writer cannot redirect
  predecessor restoration to a different token master named inside the recipe. The exact foreign-recipe title
  went red-to-green, and its immediately preceding cached-predecessor title passes. `yarn build` and focused
  lint pass; no broad test suite was run.
- 2026-10-02 compiler selection-test repair: the `this.state` receiver title was red because it referenced an
  undefined `source` in a negative target-mutation assertion. That assertion now runs against the existing
  same-interface ternary source it describes, preserving the intended fail-closed check. The formerly red title,
  its immediately preceding state-receiver title, and the moved-assertion ternary title pass individually;
  `yarn build` and focused lint pass. This is a test repair, not a compiler behavior change.
- 2026-10-02 literal-dead graph-edge follow-up: automatic message-bus selection previously routed a simple
  stateful contract solely because `if (false)` contained a typed foreign call (2,932-byte script versus 905
  bytes with explicit direct compilation in the initial probe). Its source-selection walkers now ignore only the
  unchosen arm of a literal boolean branch; normal type checking still inspects the source. In direct-only mode,
  call-slot collection and slot-index assignment use the same executable arm, so two dead calls do not spuriously
  demand a bus and a later live call retains exactly one slot. Explicit `messageBus: true` still retains the
  graph codegen's two slots for those source calls. The focused red-to-green title covers direct, helper, `else`,
  repeated-dead, dead-then-live, and explicit-opt-in cases, retains a live `if (true)` route, and requires auto
  bytecode to equal explicit direct bytecode. Its immediately preceding unreachable-helper title passes.
  `yarn build` and focused lint pass; no broad suite ran.
- 2026-10-02 zero-iteration loop follow-up: `while (false)` around a typed foreign call no longer selects
  `messageBus` automatically (2,809-byte bus script versus 691 bytes direct in the initial probe). Direct-only
  call-slot accounting also ignores repeated calls in that unreachable body, while explicit `messageBus: true`
  retains graph compilation. A `do ... while (false)` call still selects the bus because its body executes once.
  The exact loop-selection title and its immediately preceding literal-branch title pass individually; no broad
  test suite ran.
- 2026-10-02 repeated-return topology checkpoint under relaxed showcase capacity: a neutral Router loop exposed
  that the atomic worklist grouped both Reader occurrences before four dependent Sink occurrences, while the
  compiled handler executes Reader/Sink/Sink per outer iteration. The first response fail-closed instead of
  allowing the legacy builder to broadcast only the first Sink call. The follow-up now selects exact
  authenticated producer results by outer occurrence, interleaves compiler-discovered children only when they
  share the same published affine outer domain and source-effect ordinals, and feeds that ordered schedule to the
  symbolic worklist. The complete two-outer route passes BCH-2026 VM with Sink values 8/9/12/13 and count four;
  its immediately preceding one-outer title passes. Unqualified producer domains still refuse before broadcast.
  A second red fixture found that two sequential, identical-bound loops published a domain only for the first:
  the compiler's recurrence replay stopped at the earlier loop, and legacy send silently settled just its first
  call. Replay now crosses a prior loop only when its effects cannot change the later recurrence's inputs; the
  two separate domains remain in source order and both Sink owners settle two calls each in the VM. Its exact
  title and immediately preceding repeated-return title pass. A mutated-bound variant still cannot publish a
  later domain; its previously successful legacy fallback broadcast a partial first row. Automatic discovery now
  refuses any unresolved registered callback or repeated owner before that fallback. The exact refusal title and
  its immediately preceding sequential-loop title pass, with no Sink state change on refusal. No 10 KB limit or
  comprehensive suite was run.
- 2026-10-02 lexical loop-order follow-up: a third call before a repeated Reader-result/Sink pair in the same
  loop exposed an `OP_VERIFY` preflight failure: the worklist still grouped the earlier call's occurrences.
  The compiler now publishes a function-local lexical identity with each affine call domain, so the SDK can
  interleave all direct sibling effects in that one loop. Equal recurrences in separate loops retain distinct
  identities and cannot be conflated. Nested sibling interleaving still requires its narrower producer-result
  proof. The exact neutral three-call title went red-to-green in BCH-2026 VM; its immediately preceding
  separate-loop title passes. The build passes; no comprehensive suite or 10 KB gate ran.
- 2026-10-02 nested sibling-order follow-up: two callsites in the same inner loop were grouped by callsite
  across each outer producer occurrence, causing a BCH-2026 `OP_VERIFY` failure. Topology discovery now carries
  the reached inner coordinate and orders each compiler-identified inner block by iteration then effect; the
  symbolic worklist accepts that exact schedule for one or multiple outer reaches. The formerly red two-outer
  VM title passes with four calls to each Sink owner, its immediately preceding sibling-effect title passes,
  and a separate one-outer probe passes. No comprehensive suite or size gate ran.
- 2026-10-02 mixed scalar/loop order follow-up: scalar calls before and after a repeated two-call loop
  exposed another BCH-2026 `OP_VERIFY` failure because the planner required every child to share one loop
  domain. Topology discovery now treats each compiler-identified loop as one lexical source block among scalar
  effects, orders its reached rows by the published outer/inner coordinates, and offers the worklist a complete
  schedule only when every repeated child has authenticated source metadata. The exact formerly red neutral VM
  title and its immediately preceding two-outer sibling title pass; build/lint scope is recorded with the commit.
- 2026-10-02 producer-bound inner-loop follow-up: a loop whose inner bound came from the current outer
  Reader result had no compiler iteration domain. The compiler now replays only the enclosing block prefix
  for that inner recurrence and publishes the exact producer identity; a bound mutated inside the inner loop
  still has no domain in a focused compiler proof. SDK domain evaluation selects the authenticated outer
  occurrence before computing each inner count. The two-outer VM title now passes with three rows per Sink.
  A one-outer variant exposed a second, more serious gap: its initial graph contained only the Reader, so
  legacy fallback broadcast one inner row although the returned bound was two. Compiler-published deferred
  result domains now retain atomic composition through result propagation; the formerly red one-outer title
  passes with two rows per Sink, and its immediately preceding nested-skip title passes. Two focused
  conditional-row VM probes also pass. A scalar Reader result bounding a direct repeated call exposed the
  same partial legacy fallback (one broadcast row instead of two); graph retention now keys on any compiler-
  published result-dependent iteration domain, not just a nested domain. Its exact VM title went red-to-green,
  and its immediately preceding two-outer dynamic-bound title passes. No comprehensive suite or size gate ran.
- 2026-10-02 mixed outer-index/result bound follow-up: an inner count of `Reader.read(values[i]) + i`
  initially had no compiler domain because prefix replay lacked the validated outer induction binding. The
  compiler now publishes that binding as a symbolic loop-index source; the SDK substitutes the reached outer
  coordinate before inner-domain evaluation and refuses any unfrozen outer coordinate. The exact BCH-2026 VM
  title went red-to-green with four Sink rows across two outer iterations; its immediately preceding scalar
  result-bound title passes. Build and changed-file lint pass; no comprehensive suite or size gate ran.
- 2026-10-02 same-iteration state-bound follow-up: `this.bound = values[i]` before an inner loop previously
  broadcast only one Sink row across outer values `[1, 2]`, even though the Router ended with `bound = 2`.
  Recurrence replay now resolves direct state writes and indexed public-array values at that program point;
  the exact BCH-2026 title went red-to-green with three Sink rows, and its immediately preceding mixed
  index/result title passes. State writes inside the inner loop now invalidate that domain, with a focused
  red-to-green compiler title and adjacent check. A conditional outer state write copied through a local alias
  also cannot reuse the pre-call state snapshot: its exact compiler title went red-to-green and its preceding
  mutation title passes. A focused VM refusal confirms a changing inner state bound makes zero Router
  or Sink changes. No comprehensive suite or size gate ran.
- 2026-10-02 branch-complete state-bound follow-up: a state bound assigned in both arms of an outer
  branch previously had no compiler inner-domain certificate, so ordinary send refused it. Recurrence
  replay now accepts state writes contained in replayable outer-prefix branches, while a missing arm still
  cannot use the stale pre-call snapshot. The exact BCH-2026 title went red-to-green with three Sink rows;
  its immediately preceding producer-result-to-state title and the one-arm compiler refusal title pass.
  No comprehensive suite or size gate ran. For this relaxed showcase, the 10 KB deployment limit is not
  a semantic blocker; production-capacity measurement remains a separate gate.
- 2026-10-02 conditional-producer coordinate follow-up: a producer reached only at outer source iteration
  one has compact authenticated occurrence zero. When its result sets that iteration's inner-loop state bound,
  topology discovery now maps the compiler guard's reached source indices to result occurrences, and the
  symbolic worklist derives loop-index arguments from the certified source coordinate. The exact BCH-2026
  title went red-to-green with three Sink rows; its immediately preceding branch-complete title passes.
  Unsupported or unresolved mappings remain fail-closed, and no comprehensive suite or size gate ran.
  A separate focused BCH-2026 title also passes when both branch-local producer callsites use one physical
  Reader owner; the consumer selects the correct authenticated result for each outer reach.
- 2026-10-02 sparse forwarded-target follow-up: a producer reached only at source iteration one used its
  compact occurrence zero to validate `readers[0]`, even though the compiled call targets `readers[1]`.
  The worklist now validates the forwarded owner at the compiler-certified source coordinate. That exposed
  a separate SDK encoding gap: hex locking bytecodes inside `address[]` were serialized as UTF-8 text,
  unlike scalar addresses. Array leaves now share scalar address normalization, including nested arrays and
  zero addresses. Both regressions were reproduced by focused red titles and pass after the fixes; the new
  BCH-2026 route title settles ReaderB's result and all three Sink rows. Its immediately preceding branch-local
  title and the SDK unit title's preceding empty-array title pass. `yarn build` passes. No comprehensive suite
  or 10 KB gate ran.
- 2026-10-02 sparse repeated-return follow-up: two Reader returns at source iterations zero and two initially
  produced a provisional graph with only Reader rows; the Router rejected it at BCH-2026 `OP_VERIFY` before
  either dependent Sink row was included. Initial discovery now keeps typed-empty candidate results in distinct
  reached-occurrence lanes and maps source iteration two to compact occurrence one. These candidates only
  enumerate the complete graph; observed VM returns replace them before final admission. Incomplete or
  unresolved source-callsite selection publishes no candidate lanes. The exact red-to-green BCH-2026 title
  settles both Sink rows (total four, count two), its immediately preceding sparse-target title passes, and
  `yarn build` plus focused lint pass. No comprehensive suite or 10 KB gate ran.
- 2026-10-02 sparse return-guard follow-up: the later Reader result now selects whether its Sink row exists.
  The first focused run reached BCH-2026 with no Sink row and failed at an invalid `OP_SPLIT`: return probing had
  observed the actual values 1 and 3, but topology refresh reused unchanged Reader rows without restoring their
  source-iteration-to-occurrence map. The reuse path now preserves that map only from compiler-qualified prepared
  coordinates, allowing the authenticated second return to select the Sink row. The exact title went red-to-green
  with Sink total three/count one; its immediately preceding two-sparse-return title, `yarn build`, and focused
  lint pass. No comprehensive suite or size gate ran.
- 2026-10-02 sparse return-guard shrink check: the opposite guard direction begins with an extra candidate
  Sink row from the typed-empty result, then removes it after the authenticated later return is observed.
  The exact BCH-2026 title settles only the first Sink row (total one/count one), and its immediately preceding
  growth-direction title passes. This adds proof coverage without changing planner behavior or running a suite.
- 2026-10-03 repeated-entry capacity follow-up: the real Unicrow proxy route now has an explicit compiler option
  for its authenticated one-key entry pool; the default remains eight physical lanes. A nine-lane compile
  publishes nine actual entry proofs, and the focused BCH-2026 title pays nine distinct real escrows in one
  transaction with unique inputs, nine seller outputs, and nine claimed entries. The compiler title checks the
  default, the explicit capacity, and invalid capacities; its immediately preceding title passes. The adjacent
  seven-escrow BCH-2026 title also passes with the unchanged default eight-lane artifact. This does not bypass
  SDK duplicate-input checks or alter the lean default. No comprehensive suite or 10 KB gate ran.

## Gate before the next leap

Debug one known-red title at a time. Once it passes, run only its immediately preceding title for regression.
Do not launch comprehensive suites or the beta gate under the current testing instruction; record the exact
scope and result of each focused check.

1. Freeze the manifest. A successful fresh compile must have no hidden speculative stack/codegen failure, exactly one stable record per graph call, authenticated producer-result IDs, and the same `OP_INVOKE` boundary for graph handlers.
2. Build and affected compiler/SDK/BCH-2026 tests pass. Resolve the broad compiler baseline and remove application-name dependencies without waivers; skipped tests are not passes. Supported kernel and legacy cases must agree on observable state, events, and results, while a separate size test keeps kernel route growth proportional to row logic rather than maximum unrolled rows.
3. Measure cold time and byte size with optimised, clean-env artifacts and recorded options. Preserve the marketplace fixture before any compile that could replace it. A new unsupported edge case stays fail-closed behind a general `KERNEL_*` reason; it does not reopen beta scope solely because a marketplace title reaches it.

Superseded September progress logs and performance experiments are intentionally omitted from this checkpoint.
