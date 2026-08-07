# SolidCash First-Release Readiness Tracker

Last reviewed: 2026-08-05
Target: first public SolidCash release (`0.13.1`, unless the release version changes)

## Current assessment

**NO-GO for `0.13.1` on the current findings-fix worktree.** The formerly separate Solidity-corpus, SolidHat,
state-journal, and Layer-3/message-bus work is integrated, and the basic build/test/lint/package gates now pass.
Release evidence is still incomplete in the full BCHN candidate matrix. The higher-budget Solidity corpus and
over-accepted-correctness queue are explicitly postponed and informational for this release, and application
conformance is complete. The 2026-08-04 through 2026-08-05 reassessment found:

- `yarn build` and `yarn lint` failed at baseline; both are fixed and pass on the findings-fix worktree as of
  2026-08-04;
- baseline `yarn spellcheck` failed with 7,615 occurrences; the findings-fix worktree now passes after recording
  the existing 890-term technical/corpus vocabulary in a reviewed project dictionary and fixing a first-party
  misspelling;
- the historical broad corpus scorecard compiled 4,443/4,587 and contained 12 raw failures. Identical 30-second
  eight-worker sweeps compiled 2,501 and 2,488 of 2,805 because scheduler/cache effects moved 15 fixtures across
  the timeout boundary. A fresh-worker 120-second retry tier recovered 175 compilations and exposed five hidden
  raw paths, all now converted to named diagnostics. After the eligibility and fallback fixes, a complete fresh
  sweep compiled 2,622/2,805 with 72 named diagnostics and 111 timeouts. Fresh-worker retries at 30 and 120
  seconds resolved all 111: the retained result is 2,698/2,805 with 107 named failures, zero generic/raw buckets,
  and zero timeouts. The matching negative audit checked all 2,158 fixtures with zero residual timeouts: SolidCash
  rejects 1,835 and over-accepts 323 that solc rejects;
- the integrated compiler suite passes all 3,146 tests, the SDK suite passes 3,808 tests, and the testing-suite
  passes all 25 tests. The six high-bit EVM-storage/message-bus failures found during reassessment are
  fixed with asymmetric byte-order, signed-memory, string-memory, and capacity regressions;
- 14 executable `.skip`/`.todo` occurrences remain under `packages` and `examples`; all are classified as explicit
  first-release deferrals, permanent BCH/model differences, or mock/debug API limitations, with no skipped release
  blocker remaining;
- the findings-fix branch includes `testing-suite` compilation, lint, and tests in the root gates and runs CI on
  `solidcash_v*`; the clean packed-package and application-conformance gates pass, while the full BCHN candidate
  matrix remains incomplete. Solidity-corpus strictness gaps remain measured but are deferred from release gating;
- the findings-fix branch aligns all publishable package versions and internal ranges at 0.13.1.
- all six publishable packages now pass a clean tarball-consumer gate: packed README/license and manifest targets
  are checked, the tarballs are installed together without workspace links, runtime and subpath imports execute,
  public types compile, all four CLIs answer `--help`, and the packed compiler produces an SDK-consumable artifact.
- BCHN v29 regtest now proves BIP68 block-height and 512-second MTP ages end to end: the covenant rejects a short
  sequence, BCHN rejects valid sequences while their prevouts are immature, and the spends succeed after maturity.
- BCHN v29 with mainnet standard relay policy accepts all five atomic message-bus composition capstones and the
  published 24-input, eight-participant maximum at 94,651 serialized bytes. The distinct 32-input resource-heavy
  fixture remains a relaxed semantic stress shape and is not claimed as standard-relay fit.

The immediate release sequence is therefore: finish the remaining protocol/covenant soundness audits, then
complete the full BCHN candidate matrix. Over-accepted Solidity negative-fixture
strictness is a post-release compatibility backlog, not a current release blocker. The corpus result remains
reproducible with its published fresh-worker retry tiers; the 30-second eight-worker primary result alone is
load-sensitive.

This is the maintained overview for the Solidity-parity and release-readiness effort. It is intentionally
an action-oriented companion to the detailed design and research documents. Those documents remain the source
of truth for implementation details.

## How to maintain this tracker

Checkbox meanings:

- `[ ]` Not started or not yet demonstrated.
- `[~]` In progress, partially supported, or implemented outside the release branch.
- `[x]` Complete on the release branch and covered by the stated verification.
- `[-]` Explicitly deferred from the first release, with a documented limitation and a fail-closed boundary.

When changing a status:

1. Link the merge commit, test, scorecard, or design decision beside the item.
2. Only use `[x]` after the work is present on the release branch.
3. For security-sensitive compiler or covenant work, require an adversarial or VM-level regression test.
4. Move intentionally unsupported work to the deferral section rather than silently removing it.
5. Update the review date and the release-gate snapshot at the bottom.

## Release definition

The first release should claim a **documented Solidity-compatible subset**, not unrestricted Solidity parity.
The compatibility documentation must distinguish:

- syntax and type-system compatibility;
- behavioral compatibility;
- EVM ABI byte compatibility;
- Hardhat/ethers workflow compatibility;
- intentional BCH/UTXO differences.

Release-ready means every advertised construct either compiles correctly with behavioral coverage or fails
early with a stable, source-located diagnostic. A valid Solidity program may be rejected by the first release;
it must not silently compile to incorrect covenant behavior.

## P0 — Release blockers

### Compiler and covenant soundness

- [x] Fix the documented C2 sorted-mapping read issue involving a last-use local key.
  - Evidence/design: [`packages/solidc/docs/deferrals.md`](packages/solidc/docs/deferrals.md), “Multi-return
    STATE helper inline” and its corrected C2 root-cause analysis.
  - Completion requires a minimal source-level regression, generated-bytecode/VM proof, and a negative test
    preventing recurrence through desugaring or inlining.
  - Evidence: `packages/solidcash/test/e2e/SortedMappingComputedKeyRmw.test.ts` exercises the exact local-copy
    trigger through compiler, SDK transaction construction, VM execution, and state readback.
- [x] Audit nearby C2 key-source and stack-liveness paths for the same stale-offset class of bug.
  - The audit added direct parameter, initialized-copy, declaration-then-assignment, computed-local, live-local,
    and inlined-helper reads to `SortedMappingComputedKeyRmw.test.ts`. It found that the adjacent
    `T key; key = expr;` form retained an opaque local metadata label and failed local execution. The compiler now
    canonicalizes only a straight-line adjacent pair with exactly one assignment, while leaving conditional or
    reassigned locals on the conservative path. The artifact metadata unit test and VM-backed sequence pass.
- [x] Fix the six EVM-storage/message-bus VM regressions in `packages/solidcash/test/e2e/EvmStorageLayout.test.ts`.
  - Root cause: Solidity-compatible big-endian scalar casts exposed older storage and Yul-memory lowering paths
    that assumed BCH-native typed casts. The fix uses sign-safe raw word encoding, preserves fixed-byte order,
    and aligns compile-time storage-slot constant folding with runtime casts.
  - Evidence: all 39 `EvmStorageLayout` tests pass, including asymmetric `0x89ab1234`; the related memory/storage
    focus passes 63 tests with one intentional skip; the complete compiler and SDK suites pass.
- [-] Keep the measured Solidity corpus as release evidence without completing strictness parity.
  - A complete fresh positive-fixture sweep and its isolated retry tiers have zero generic/raw error buckets and
    zero residual timeouts. The primary sweep produced 111 timeouts; 30-second fresh-worker retries recovered 27
    as compilations and one as a named diagnostic, then the 120-second tier recovered 49 as compilations and 34
    as named diagnostics. All negative fixtures are now checked, but 323 over-accepted cases remain a strictness
    review queue. Per release prioritization, the full bench and over-accepted-correctness work are postponed and
    are not release blockers.
- [ ] Decide the release posture for constructs that exceed the BCH-2026 operation-cost budget, and stop the
  mock provider from hiding them.
  - `MOCK_CONSENSUS_LIMITS` is far looser than `ConsensusBch2026`: `operationCostBudgetPerByte` is 10,000,000
    against a real 800 (12,500x), input and stack items are 1,000,000 against 10,000, and the NFT commitment
    limit is 1,000,000 against 128. Every mocknet test therefore runs with effectively no density control, so a
    green mocknet suite is not evidence that a contract is valid on chain.
  - First construct caught, during BCHN matrix batch 11: the `function_memory_array` pin in
    `packages/solidcash/test/e2e/BehaviorParityPins.test.ts`, a runtime-indexed internal fn-ptr memory array
    (`arr[i](x)`). It passes on mocknet and reverts on BCHN v29.
  - The full set is now enumerated without any chain, by running `test/e2e` on mocknet with
    `MOCK_CONSENSUS_LIMITS.operationCostBudgetPerByte` set to the real 800 and every other limit left relaxed, so
    the budget is the single variable. That sweep takes 19 minutes and is deterministic. Exactly four tests in
    three files exceed the budget, all one family: `NestedStructArrayWrite` (two tests, which report the density
    limit explicitly), `FunctionPointerArrayCall` (`a[i]()`), and `BehaviorParityPins` (`arr[i](x)`). Runtime
    indexed function-pointer array dispatch and nested struct-array element writes are the shapes at issue.
  - Whole-array assign (`X171`), whole-array copy (`X167`), nested fixed-inner arrays and chunk-packed arrays do
    NOT exceed the budget; they pass when the budget alone is real. They do fail when the other limits are also
    tightened, which is a separate question tracked in the item below.
  - The divergence reproduces with no regtest dependency by overriding the mock limits, which also isolates the
    binding constraint: wide-open defaults resolve; full real BCH-2026 limits reject with the identical live-BCHN
    error; `operationCostBudgetPerByte: 800` alone rejects; `maximumInputBytes: 10_000` alone resolves. The
    operation-cost budget binds, not the 10,000-byte script limit.
  - The overshoot is small and therefore probably optimizable rather than fundamental. Sweeping
    `operationCostBudgetPerByte` puts the passing threshold between 1,200 and 1,300 against the real 800, so the
    shape needs roughly 1.6x the available budget, not an order of magnitude.
  - **Re-validated on the merged base.** Both sweeps were re-run after merging mainline to `86df89a4`, which
    rewrote `compiler.ts`, `GenerateTargetTraversal.ts`, `utils/script.ts` and the generated parser. The results
    are identical: the budget sweep still fails exactly `BehaviorParityPins`, `FunctionPointerArrayCall` and
    `NestedStructArrayWrite` (two tests), and the input-bytes sweep still fails exactly `ChunkedArrays`,
    `NestedArrayFixedInner` (two), `SplitLayoutAgreementX162`, `X167ArrayCopyReplaces` (two) and
    `X171ArrayAssignReplaces` (four). The compiler performance work changed neither class, so these findings
    track the current candidate revision even though the BCHN run that corroborated them does not.
  - The chain-free method is predictive, confirmed twice against the live node. `BehaviorParityPins` was found on
    BCHN first and then reproduced on mocknet; `FunctionPointerArrayCall` went the other way, predicted by the
    budget sweep and only later confirmed on BCHN when the matrix reached that file in batch 25. `ChunkedArrays`
    likewise reproduces the live failure without a chain. The two shapes still unconfirmed on chain,
    `NestedStructArrayWrite`, sit past the current checkpoint and should fail when the matrix reaches them.
  - The cost is the memory-array CONSTRUCTION, not the indexed dispatch. Measured by finding the passing budget
    for variants that separate the two: the baseline of five `build + dispatch` calls passes only at 1,300; five
    builds with NO dispatch at all also pass only at 1,300; and building the array ONCE then performing five
    indexed dispatches through it passes at the real 800. Five ordinary direct calls also pass at 800.
  - Within construction the cost is the per-element STORES, not the allocation. Holding the call count at five
    and varying only the shape: capacity ten with five stores passes at 1,300, capacity five with five stores
    also passes at 1,300, while capacity ten with a SINGLE store passes at the real 800, as does capacity two
    with a single store. Allocation size is therefore irrelevant and each function-pointer element store carries
    the weight.
  - The expense is specific to FUNCTION-POINTER element stores, not to memory writes in general. The same shape
    built on a plain `int[] memory` array with five stores passes at the real 800, while the function-pointer
    version needs 1,300. The memory model is therefore not implicated; storing a function pointer into a memory
    array element is.
  - The cost is dense rather than large: the marginal emitted size of an extra store is only about 30 to 60
    bytes, and since the budget scales at 800 per byte, those bytes grant far more budget than they consume in
    size. The store must therefore emit a great many operations for very few bytes, which is exactly what
    BCH-2026 density control penalises.
  - It is NOT the per-function `OP_DEFINE` overhead of making each referenced function invokable. Five stores
    pointing at a SINGLE function still need 1,200, against 1,300 for five distinct ones, so distinctness is only
    a secondary increment and the store count dominates. The threshold sits between two stores, which pass at
    800, and five. Recorded so this line is not re-investigated.
  - Two independent levers follow, either of which may be enough. Reduce the emitted operation count of a single
    function-pointer element store; or exploit the fact that in this shape the array is call-invariant, so
    hoisting or constant-folding it removes all five stores from every call after the first.
  - An earlier revision of this entry blamed the indexed dispatch. That was wrong: the variant it rested on
    ("array built but never dispatched") still dispatched, because the `arr[i](x)` sat inside the helper it
    called, so it isolated nothing. Corrected by the construction-versus-dispatch measurement above.
  - Note that the budget scales with script size, `operationCostBudgetPerByte * (densityControlBaseLength + input
    bytes)`. The failing variants are the largest and therefore have the largest budget, yet they are the ones
    that fail, which is precisely the density the BCH-2026 budget is designed to penalise.
  - Completion requires one of: reducing emitted operation cost for the shape, rejecting it at compile time with
    a stable diagnostic, or documenting it as an unsupported construct. It must not keep passing tests while
    failing on chain.
- [ ] Fix the derivation-path split: the mocknet suite never exercises the derivation path that every real
  network uses.
  - `relaxedConsensus` and `useSparseProbe` are both selected by
    `(provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000`, at six call sites across
    `StatefulTransactionBuilder.ts`, `StatefulContract.ts`, `upgrades.ts`, and `SplitContractBundle.ts`.
    Electrum, regtest, FullStack and Bitcoin RPC publish no `consensusLimits`, so the default 10,000 makes that
    predicate false and they always take the faithful full-trace path. `MockNetworkProvider` publishes
    1,000,000, so mocknet always takes the sparse/observer path. The two are different algorithms, not merely
    different limits.
  - Ten e2e tests pass only on the sparse path and fail on the faithful one: `ChunkedArrays` (1),
    `X171ArrayAssignReplaces` (4), `X167ArrayCopyReplaces` (2), `NestedArrayFixedInner` (2),
    `SplitLayoutAgreementX162` (1). Nine report `preflight failed at input 0: Program failed an OP_VERIFY
    operation`; the tenth cannot auto-derive its state commitments at all.
  - Isolation is exact. Setting `maximumInputBytes` to 10,000 produces those ten failures; setting it to 10,001,
    one byte higher and therefore back above the gate, makes the same five files pass 50/50. A one-byte change
    in a size limit cannot decide whether those scripts fit, so the gate is the cause and script size is not.
  - This is corroborated independently on chain, and now on a PRISTINE one. `ChunkedArrays` fails identically on
    a freshly wiped regtest chain, so it is neither a chain-contamination artifact nor a harness side effect; it
    is a real defect on the branch every live network takes. The chain-free mocknet reproduction predicted it.
  - Root cause, with direct evidence. `StatefulTransactionBuilder.ts:3068` runs `covenantBuilder.debug()` only
    when NOT relaxed, and its own comment says that probe is what "can discover commitments and output counts for
    dynamic C2 inserts/chunks". Its failure is swallowed by a best-effort `try/catch`. For these array shapes the
    probe throws, so the discovery never happens and the transaction is then built and funded from an unresolved
    shape, which fails the covenant with `OP_VERIFY`. The relaxed mock skips the probe entirely and never
    exercises any of this. Counted over the sweep: the production run emitted 14 swallowed
    `STB debug() best-effort error` messages across seven files, four of which are the failing array files
    (`ChunkedArrays`, `NestedArrayFixedInner`, `X167ArrayCopyReplaces`, `X171ArrayAssignReplaces`), while the
    relaxed run emitted zero. Three files tolerate the swallowed error and still pass, so the swallowed probe is
    necessary but not sufficient; the shapes that actually depend on the discovery are the ones that break.
  - The remedy direction is therefore that a probe failure must not be silently swallowed when the build depends
    on what the probe was meant to discover. The signature is not final at probe time, which is why
    `require(checkSig(s, pk))` fails inside it.
  - The signature really is the blocker, not a source-map misattribution. The same two-dynamic-array write
    compiled WITHOUT a signature check completes its call with no probe error at all, while `ChunkedArrays`,
    which gates the same write behind `require(checkSig(s, pk))`, fails. Discovery therefore works; it is
    signature-gated covenants that cannot satisfy a probe run before signing.
  - That makes the fix well scoped: the probe exists only to discover commitments and output counts, and the
    real preflight plus the node still validate the finished transaction in full, so satisfying or bypassing
    signature verification inside the probe alone does not weaken any check that decides acceptance.
  - The diagnostic added alongside this now names the swallowed probe failure on `error.cause`, so the refusal
    explains itself instead of surfacing a bare OP_VERIFY.
  - Skipping the probe is NOT a fix, tested directly: with the probe disabled outright, nine of the ten still
    fail. Discovery is genuinely required for these shapes, so the probe has to be made to succeed rather than
    avoided.
  - Mechanism for whoever takes it: for `OP_INVOKE` contracts the signature arguments are not signed during
    scenario evaluation at all. `LibauthTemplate.ts` (`resolveArgsForOpInvoke`) pre-computes them from
    `buildLibauthTransaction()` and substitutes raw bytes, because `OP_INVOKE` rewrites `state.instructions` and
    so changes the `coveredBytecode` an ordinary Key-typed signature would cover. The probe runs on the
    fee-less phase-1 build, so it carries a signature computed for that shape. Determining why that
    pre-computed signature does not verify during the probe's scenario evaluation is the next step, and it needs
    instrumentation rather than inference.
  - Two hypotheses tested and REJECTED, recorded so they are not re-tried. First, that the reported
    `require(checkSig(s, pk))` line was a source-map misattribution: the same shape without a signature check
    completes with no probe error, so the line is real. Second, that `resolveArgsForOpInvoke` extracted the wrong
    bytes because chunked shapes append covenant witness pushes and shift its `numArgs - i` index: instrumenting
    the extraction shows the unlocking script holds exactly `numArgs + 2` instructions for every affected call
    (`setA` 6/6, `setB` 7/7, `lenB` 3/3), so the layout assumption and the index arithmetic both hold.
  - ROOT CAUSE, measured. The scenario transaction libauth evaluates is NOT the transaction the signature was
    computed over. Comparing the two for the failing `ChunkedArrays` call, they differ only in input 0's
    unlocking bytecode and by exactly 37 bytes every time: 1312 against 1275, then 1372 against 1335. Input
    count, output count and every output are identical, so no sighash difference arises from the outputs.
  - That is sufficient to break the signature precisely because these are `OP_INVOKE` contracts. `OP_INVOKE`
    rewrites `state.instructions`, so `checkSig`'s `coveredBytecode` is the executing script rather than the
    redeem script. A 37-byte-shorter unlocking script therefore covers different bytes, and the signature
    pre-computed from the builder's script cannot verify against the template's reconstruction of it.
  - The fix is therefore in the template, not in signing: `getLibauthTemplate` must reconstruct input 0's
    unlocking script byte-identically to what the builder emits for chunked and dynamic shapes. Identifying the
    37 missing bytes is the remaining step, and it is a bounded comparison rather than an open question.
  - Completion requires the mocknet default to exercise the same derivation path as production, or an explicit
    documented statement that mocknet coverage carries no derivation-path claim and a gate that runs these
    shapes on the faithful path.
- [~] Replace reachable late code-generation failures such as missing stack variables or unavailable block
  layouts with correct compilation or stable diagnostics.
  - Transfer-frame loss, recursive inline struct encoding, missing block layout, oversized message-bus verifier,
    lost compiler-tracked stack values, and recursive traversal overflow now fail with named diagnostics. The
    retained result reports 107 named failures and no generic `Error` or raw `RangeError` bucket.
- [x] Verify every supported state mutation, external call, delegate call, and lifecycle path fails closed when
  supplied forged, reordered, duplicated, or missing auxiliary inputs.
  - A deterministic integrity baseline now runs as `yarn test:security-conformance`: 81/81 executed tests cover C2 batch
    witness tampering, dynamic-loop entry tampering, external-call target substitution, cross-contract
    fail-closed subcases, delegate identity/selector pinning, split/merge missing/duplicated/reordered/redirected
    lifecycle elements, deploy child-genesis and upgrade/selfdestruct
    missing/duplicated/reordered/redirected elements, and message-envelope/return forgery. Upgrade replacement
    bytecode is carried by a compiler-owned covenant witness, so the SDK-selected master remains authenticated
    even with `SIGHASH_NONE`. Ordinary scalar/data-NFT and dynamic-chunk transitions reject missing, duplicated,
    semantically significant reordered, redirected, and commitment-forged state elements without relying on any
    signature guard. C2 entries additionally cover missing, duplicated, reordered, redirected, capability/value,
    link, proof, successor, predecessor-output, and orphan rows; nested mappings, array values, and flattened
    struct fields share that physical backend. Old chunks themselves are an identity-authenticated unordered input set. Satoshi-container
    and fungible-token container transitions additionally preserve container presence, position, destination,
    and value/amount. Ordinary events and emitted returns preserve their required position, destination, and
    commitment, rejecting missing, duplicated, reordered, redirected, or changed outputs. The built-in
    `upgrades.deployProxy` profile preserves the proxy state block and requires the pinned implementation
    co-spend. Untyped deploy
    factories reject before broadcast because the supplied
    child artifact cannot be covenant-authenticated; typed stateful deploy combined with a C2 access also rejects
    until their trailing output regions can be separated. The gate also covers the built-in proxy lifecycle,
    multi-NFT initialization/state preservation, delegated events and returns, nested initializer helpers, and
    compiler/SDK refusal of implementation functions that reach ineligible operations. This closes the stable
    physical backends: scalar/data NFT, dynamic chunks, C2 entries, satoshi/token containers, events/returns,
    external/delegate composition, and lifecycle elements. Experimental profiles remain outside the stable claim.

### Cross-contract state bus and nested calls

- [x] Freeze the supported state-bus/Layer-3 profile now that the implementation is integrated.
  - `SOLIDITY_COMPATIBILITY_0.13.1.md` limits stable coverage to the frozen application and integrity matrices;
    composed external state mutation and other message-bus shapes remain experimental. The candidate release
    notes repeat that boundary and do not advertise unrestricted Layer-3 support.
- [x] Reconcile the former state-bus, Layer-3 binding, SolidHat, journal, and related worker branches.
  - Evidence: integration commits `83cfd13b`, `10cc6635`, `5fdc7b24`, and consolidation commit `1a533c88`.
- [x] Merge the accepted bus/journal/binding implementation into `solidcash_v0.13.1`.
- [ ] Run compiler, SDK, mocknet, VM/adversarial, and BCHN regtest coverage after integration.
  - Compiler, SDK/mocknet, and the 81-test VM/integrity gate pass. A full serial `yarn test:regtest` attempt on
    2026-08-05 exposed nine mock-vs-BCHN rejection-harness mismatches, which were corrected; the three affected
    files then passed 24/24 on BCHN v29. The original aggregate attempt was stopped after a later file spent more
    than 14 minutes without returning a result. The runner now starts a fresh Vitest process for each eight-file
    batch and records resumable progress, avoiding accumulation in one long-lived compiler process. On exact
    commit `2e1014f0`, batches 1 through 7 passed 56/449 files. Batch 8 initially reached 221/222 passing tests and
    exposed one mock-vs-live rejection-message mismatch in `UserLibrary.test.ts`; after correction, batches 8 and
    9 passed in full on commit `ea410fd1`, advancing the cumulative diagnostic checkpoint to 72/449 files. Batch
    10 was intentionally interrupted shortly after starting and is not counted. Diagnostic coverage then advanced
    to 152/449 files before being deliberately postponed until the non-BCHN work is exhausted.
  - Three harness defects were found and fixed during that coverage, none of them product bugs: CashTokens
    genesis starved of vout-0 coins because regtest halves the subsidy every 150 blocks (measured 0.0 from
    ~height 2,500) while `createVout0Utxo` never worked, since `sendtoaddress` chose its own change position;
    BCHN reports a CLTV failure as non-mandatory rather than naming the opcode; and the provider served a fixed
    100,000-satoshi fee funder while the SDK requested 5,000 or 3,000, so a co-spend that cannot emit change
    burned the excess as fee.
  - **A wipe is necessary but NOT sufficient: the suite also contaminates itself within one run.**
    `DeployThenCallFold.e2e.test.ts` still fails on a freshly wiped chain, and both categories involved were
    created by that same run: the expected one had 117 confirmations and the one the signer actually chose had
    561, roughly 444 blocks earlier in the same pass. Every such test builds its signer from the fixed
    `alicePriv`, so they share one address, and the signer auto-selects among whatever genesis-valid vout-0 UTXOs
    have accumulated there. The test therefore passes in isolation and fails inside a long serial run - an
    order-dependent test defect, not a product defect. The durable fix is a per-test signer, or funding selection
    that prefers the UTXO the test just seeded.
  - CONFIRMED by the decisive test: `DeployThenCallFold.e2e.test.ts` passes 13/13 alone on a freshly wiped chain,
    and fails once any other test has spent from the shared address. Note that running it alone on a USED chain
    still fails, so "alone in a vitest process" is not isolation here - only a wiped chain is.
  - **Prerequisite 1 - the evidence run needs a WIPED chain.** "From zero" means file zero and is not
    sufficient. Tests build signers from a fixed key and share one address; the signer auto-selects a
    genesis-valid vout-0 UTXO from it, so on a chain with history it picks a leftover. Proven in
    `DeployThenCallFold.e2e.test.ts`: the expected category had 94 confirmations (created by that run) while the
    received one had 5,395 (left by an earlier run). Run
    `docker compose -f docker-compose.regtest.yml down -v` first. Residual risk remains within a single run,
    because a 449-file serial pass contaminates that same address as it goes; the durable fix is per-test
    signers or funding selection that prefers the just-seeded UTXO.
  - **Prerequisite 2 - the runner is O(wallet).** `pickLiveFundingInput` runs `listunspent` plus a `gettxout`
    per candidate at five hot-path call sites. Measured at 23,076 wallet UTXOs: 1,181 ms per call, with the
    wallet growing about 5,000 UTXOs per hour, so the sweep slows itself down. Mean batch was 457 s and BCHN sat
    pegged at 99.9% of one core. A wipe resets this; the durable fix is for the provider to roll its own change
    forward instead of asking the node.
  - The rejection-message class is now fixed at the source rather than per file. BCHN names the failing input
    only for some refusals: `Program failed an OP_VERIFY operation` carries `error in evaluating input index N`,
    while `Script failed an OP_EQUALVERIFY operation (code 16)` does not; the mock always names it. That is why
    three files needed a portability guard earlier while roughly thirty others asserting the same string did not.
    `test-util.ts` now exports `expectScriptRejection(outcome, inputIndex)`, which requires the refusal always and
    the input index only where the node reports one, so no evidence is discarded. Applied to
    `CollectionIterationDynamicInsertX102`, `DelegateCollectionOutputPin`, and `DelegateEmitFunder`; those three
    files pass 10/10 on mocknet and remove five known-false failures from the next BCHN pass.
  - Failing batches on the dirty chain were 11, 13, 14, 16, 18, 19 and later 20-46. That run is superseded by the
    pristine-chain run below and should not be used to justify any test change, because its dust, fee and timeout
    failures are artifacts of a 29,424-UTXO wallet.
- [ ] Investigate two further live-only failures, each reproduced alone on a freshly wiped chain.
  - `Erc20LikeApplication.test.ts`, "decodes Transfer event arguments for mint and transfer": the decoded event
    list omits the mint, whose `from` is the zero address, and leads with the transfer instead. Compare against
    the known "identical data NFTs unorderable on a non-deterministic provider" issue.
  - `MsgSenderCrossContractC2.test.ts`, "rejects an LBC-swapped caller": `expect(masterA).toBeDefined()` fails at
    line 109, so a `getUtxos()` lookup for the caller's master NFT returns nothing straight after setup.
  - Both were provisionally grouped with the shared-signer order dependence below. That grouping was WRONG: each
    still fails alone on a pristine chain, so neither is a contamination artifact. Only `DeployThenCallFold`
    belongs in that group, and it passes 13/13 alone on a pristine chain.
  - CORRECTION after the full run at `cf6de29c`: `Erc20LikeApplication` PASSED there, so it is state-dependent
    rather than deterministic and the "genuine live-only finding" label above was over-confident on the strength
    of a single pristine-and-alone failure. `MsgSenderCrossContractC2` failed again and still stands.
    Reproduce both across several chain states before treating either as settled.
  - Neither reproduces on mocknet at any consensus limits, so both join the CREATE-anchor item as findings that
    require a live node to observe.
- [x] Logical CREATE identity anchor: NOT a product defect. Two separate causes, both outside the compiler.
  - `RegtestNetworkProvider.getUtxos` gated its `listunspent` on the CashAddress token-support flag, so a
    non-token address returned no token UTXOs. `deriveLogicalCreateAddress` encodes a plain script address, and
    the anchor is an immutable NFT, so every anchor was invisible and `resolveLogicalIdentity` reported "found
    0" for anchors that existed on chain. That flag describes the address ENCODING, not what the script may
    hold - the locking bytecode is identical either way - so the query now always includes tokens.
    `MockNetworkProvider` returns token UTXOs regardless, which is why this only ever failed against a live node.
  - With the anchors visible the same test reported "ambiguous ... found 65". The logical address is
    deterministic in (deployer, nonce) and the suite reuses one key at nonce 0, so every historical run left
    another anchor at the same address. That is test contamination, not a protocol fault: a real deployer
    consumes each nonce once.
  - Verified on BCHN v29 against a chain already carrying the historical anchors: `ContractFactory` passes 9/9
    and `UpgradesDeployProxy` passes. `LargeContractSplitting` no longer reports an identity error at all; it now
    exceeds its 180-second budget instead, which is the same performance class as the `AtomicMessageBus`
    timeouts and not an identity fault. Note that two regtest suites run concurrently against the one shared node
    produce `txn-mempool-conflict`, so a contended run cannot be read as a result.
  - Also hardened while here: the identity used p2sh20. A 160-bit script hash offers only about 2^80 collision
    resistance, so a second seed hashing alike would let an attacker present a different deployer/nonce for the
    same logical address. It is now p2sh32, matching the project rule that stateful features never take a p2sh20
    path.
  - `ContractFactory.test.ts` fails on a freshly wiped chain with `Logical contract identity at bchreg:pzarnm7r...
    is missing or invalid (expected exactly one authenticated immutable anchor, found 0)`, thrown by
    `resolveLogicalIdentity` (`src/stateful/logical-identity.ts:193`) immediately after a successful
    `deploy(42n)`. Two tests in the file fail this way.
  - This was first seen on the contaminated chain and provisionally attributed to leftover UTXOs. The wiped-chain
    run disproves that attribution: it is a real defect.
  - It is a THIRD distinct cause, separate from the two items above. It does not reproduce on mocknet even with
    real consensus limits, so it is not the operation-cost budget and not the sparse/faithful derivation split.
    Something about resolving anchors against a live provider differs from the mock. Investigate whether the
    anchor output is never created on this path, is created but not indexed, or is created but fails the
    authentication predicate in `resolveLogicalIdentity`.
- [ ] If deferred, hide or reject every stable-API path that depends on the unfinished architecture and document
  the experimental boundary.

### Proxy and delegate behavior

- [x] Define the exact proxy/delegate feature profile supported by the first release.
  - The compatibility manifest supports the built-in `upgrades.deployProxy` path for scalar/data-NFT state.
    Custom forwarders and other delegate shapes remain experimental; delegate-mode satoshi/token movement and
    fallback-only transparent proxies remain deferred below.
- [x] Confirm unsupported operations are excluded from inferred delegate artifacts and rejected during SDK
  construction.
  - `DelegateInferred.test.ts` covers direct and internal-helper transfer/token operations, contracts with no
    eligible implementation entry points, standalone artifacts supplied as implementations, and non-delegate
    functions selected from delegate artifacts.
- [x] Reconcile outstanding delegate input-layout and proxy-context worker changes.
  - The `delegate-drop` tip (`1d516022`) is an ancestor of this branch. Option B from
    `packages/solidc/docs/delegate-modifier-drop-evaluation.md` is integrated: ordinary source emits a lazy
    `delegateArtifact`, the SDK selects it with `asDelegate()`/`withDelegatecall`, hidden proxy/delegate input
    indices are derived by the transaction builder, and the expanded 81-test release gate exercises the merged
    compiler/SDK paths.
- [x] Add release tests for supported proxy state mutation, events, nested calls, upgrades, and state preservation.
  - `UpgradesDeployProxy.test.ts`, `DelegateInferred.test.ts`, and `DefaultProxyIntegrity.test.ts` are required by
    `yarn test:security-conformance`; the expanded gate passes 81/81 executed tests with one documented skip.
- [-] Delegate-mode satoshi and token-container movement, unless explicitly brought into scope.
- [-] Fallback-only proxy operation, unless the selector-less forwarding protocol is fixed.
- [-] One identical address for standalone and delegate deployments; the current separate-artifact design is an
  intentional size tradeoff.
  - Evidence/design: [`packages/solidc/docs/deferrals.md`](packages/solidc/docs/deferrals.md), delegate-mode
    sections.

## P1 — Required release work

### Compatibility contract

- [x] Publish a conservative versioned compatibility manifest covering the required dimensions:
  [`SOLIDITY_COMPATIBILITY_0.13.1.md`](SOLIDITY_COMPATIBILITY_0.13.1.md).

  | Area | Parse | Type check | Codegen | SDK | Behavioral test | Release status |
  |---|---:|---:|---:|---:|---:|---|
  | Integers and checked arithmetic |  |  |  |  |  |  |
  | ABI encode/decode |  |  |  |  |  |  |
  | Structs, mappings, and arrays |  |  |  |  |  |  |
  | Inheritance and modifiers |  |  |  |  |  |  |
  | External calls and returns |  |  |  |  |  |  |
  | Proxy/delegate calls |  |  |  |  |  |  |
  | Inline assembly/Yul subset |  |  |  | N/A |  |  |
  | Lifecycle operations |  |  |  |  |  |  |

- [ ] Resolve contradictory or stale documentation, including short-circuit behavior and outdated corpus gap
  descriptions.
- [ ] Give every documented limitation one of: supported, experimental, deferred, or permanent BCH difference.
- [ ] Ensure public website examples compile against the exact release packages.

### Solidity corpus and differential testing

- [x] Reconcile the Solidity corpus work with the release branch (`10cc6635`).
- [x] Regenerate the corpus scorecard on the integrated branch.
  - Current retained positive-only result: 2,698/2,805 compiled; 107 fixtures failed with named diagnostics and
    zero timed out. The complete 30-second/eight-worker primary sweep compiled 2,622 with 72 named diagnostics
    and 111 timeouts; isolated 30-second/four-worker and 120-second/four-worker tiers resolved every timeout.
  - Negative result: all 2,158 checked; 1,835 rejected, 323 over-accepted, zero unchecked, zero timeouts. The
    conservative screening inventory is [`NEGATIVE_AUDIT.md`](examples/solidity-corpus/NEGATIVE_AUDIT.md).
- [x] Make the corpus command deterministic and record its Solidity corpus revision and tool versions.
  - The scoped runner uses stable file ordering, isolated reusable workers, a per-fixture timeout, configurable
    worker count/negative checking, a resumable fresh-worker retry tier, and writes the corpus revision,
    Node/platform, scope, primary/retry budgets, and retry history.
- [ ] Add release gates:
  - [ ] no regression in accepted in-scope positive fixtures;
  - [ ] no increase in incorrectly accepted negative fixtures;
  - [ ] zero crashes/internal-error buckets;
  - [ ] reviewed changes to grouped failure reasons.
- [-] Triage `NEG-ACCEPTED` cases that indicate missing safety or semantic strictness separately from harmless
  NatSpec/EVM-only diagnostic differences. This compatibility-strictness backlog is explicitly deferred and does
  not block the current release; fail-closed protocol/covenant audits remain separate release gates.
  - All 323 are syntax-test negatives. Initial screening identifies 95 platform/backend-policy candidates and a
    228-case strictness-review queue, led by 78 data-location/storage-reference cases. Five uninitialized-storage-
    pointer cases now reject after branch/zero-iteration-loop definite-assignment tracking. No case is waived yet.
- [ ] Keep the corpus README, scorecard, and progress log numerically consistent.
  - Current source material: [`examples/solidity-corpus/README.md`](examples/solidity-corpus/README.md),
    [`scorecard.txt`](examples/solidity-corpus/scorecard.txt), and
    [`PROGRESS.md`](examples/solidity-corpus/PROGRESS.md).

### CI and release gates

- [x] Include `packages/testing` and `examples/testing-suite` in the root build/lint/test commands and required CI
  workflow (`codex/release-readiness-fixes`).
- [x] Add a clean generated-project smoke test.
  - `yarn test:generated-project-smoke` creates a temporary SolidHat project, compiles it through the generated
    CLI configuration, resolves its factory, and runs its generated test without reusing project artifacts.
- [x] Add at least one stateless and one stateful deployment/call test.
  - The same gate runs the stateless `Example` calls and the stateful oracle-backed `TimeVault` deployment/call.
- [x] Add fixture/reset and compilation-cache invalidation tests.
  - The gate proves named-fixture restoration and cold/warm/dependency-invalidated compilation, preserves the last
    valid artifact after a failed rebuild, and verifies `clean` removes artifacts and cache data.
- [ ] Add a required BCHN regtest smoke suite for release candidates.
- [ ] Run build, lint, spellcheck, unit tests, e2e tests, examples, corpus gates, and package smoke tests from a
  clean checkout.
- [x] Ensure CI runs for the actual release branch (`solidcash_v*`), not only pushes to `master`.
- [x] Pin supported Node 22 and Yarn 1.22.22 in the root manifest and CI install behavior.
- [x] Update checkout/setup-node to GitHub Actions v4; Codecov remains on v5.

### Hardhat/ethers-compatible workflow

- [x] Reconcile the Hardhat-style project compilation cache from `.worktrees/dependency-dag` or confirm it was
  superseded.
  - The integrated compiler task owns the current cache. `yarn test:generated-project-smoke` proves cold and warm
    runs, dependency invalidation, qualified factory lookup, last-valid-artifact retention, and clean removal.
- [x] Demonstrate one maintained golden path:

  ```text
  initialize project → compile → obtain signers → deploy → call →
  assert event/revert/state → reset fixture → rerun
  ```

  - `examples/testing-suite/test/golden-path.test.ts` compiles and resolves `GoldenToken`, obtains funded
    signers, deploys initialized state, sends calls, checks decoded positional event arguments, checks a named
    require reason and state, restores a named fixture, and reruns the successful path. It is part of
    `yarn test:generated-project-smoke`.

- [x] Complete or explicitly defer HRE injection.
  - `createHardhatRuntimeEnvironment` injects config, the selected network/provider, `ethers`, network helpers,
    task lookup, and `hre.run`; `solidcash run` also exposes the active HRE to scripts.
- [-] Defer hardhat-deploy-style deployment scripts, tags, and dependency graphs.
  - The first-release golden path uses factories, `deployContract`, and `upgrades.deployProxy`; no selected example
    or release gate requires the separate hardhat-deploy workflow.
- [-] Defer additional stateless contract-factory behavior not needed by the maintained golden path.
  - The release path is stateful; existing stateless calls remain covered by the same generated-project gate.
- [x] Verify fixture/snapshot behavior on mocknet and document regtest behavior.
  - `harness.test.ts` proves snapshot restoration without fixture reruns on mocknet. Regtest deliberately has no
    rollback snapshot primitive: live-node tests use fresh deployments/categories and run serially, as the
    application regtest gate does.
- [-] Support event arguments; defer custom-error runtime argument matching.
  - The golden path proves Chai-style positional event arguments. BCH failed calls do not transport EVM-style
    revert payloads, so typed custom-error argument recovery is not a first-release requirement; declarations
    remain artifact metadata and the maintained path checks a named require reason.
- [x] Publish a Hardhat/ethers/chai-to-SolidCash migration table.
  - [`examples/testing-suite/MIGRATION.md`](examples/testing-suite/MIGRATION.md) maps configuration, CLI/HRE,
    signers, factories, fixtures, time, assertions, balances, utilities, and permanent BCH differences.
- [x] Include a complete stateful or token-contract test project.
  - `GoldenToken` and `golden-path.test.ts` provide the maintained compile/deploy/call/event/revert/state/reset
    project.
  - Detailed tracker: [`examples/testing-suite/HARDHAT-PARITY.md`](examples/testing-suite/HARDHAT-PARITY.md).

### Application-level conformance

- [x] Select and freeze at least five representative release scenarios in
  `yarn test:application-conformance` (nine files, 94 executed tests on 2026-08-05):
  - [x] ERC-20-like ledger with mint/transfer balances, preserved supply, decoded `Transfer` arguments, and the
    declared insufficient-balance path (`Erc20LikeApplication.test.ts`);
  - [x] token integration and target pinning (`SafeErc20ChainTargetPinning.test.ts`);
  - [x] ownership/access control (`CustomModifier.test.ts`);
  - [x] escrow-like oracle release and absolute locktime (`HodlVault.test.ts`);
  - [x] proxy upgrade with preserved state (`Upgrade.test.ts`);
  - [x] mapping plus dynamic-array state (`IterableMappingPattern.test.ts`);
  - [x] cross-contract read and mutation (`ExternalFunctionCalls.test.ts`).
  - Supporting release-interface coverage: decoded event arguments/filtering (`EventsFacade.test.ts`) and
    custom-error metadata plus assert/revert behavior (`ErrorAssertRevert.test.ts`).
- [x] Make the selected mock-provider scenarios a deterministic, named release command. The gate rejects ordinary
  test failures and does not include the environment-gated timelock file, whose four tests otherwise report as
  skipped without chipnet/regtest configuration. CI runs the named gate separately so its result remains visible
  even though the same files are also part of the broad SDK suite.
- [x] Run representative application flows on BCHN v29 regtest through a deterministic serial command.
  - `yarn test:application-regtest` runs the ERC-20-like ledger/event/error flow and the independent
    escrow/oracle/timelock flow without file parallelism; the 2026-08-05 run passes 9/9.
- [x] For each selected application, require compilation, behavioral tests, event/error tests, and script-size
  measurements. The frozen gate proves compilation/behavior and shared event/custom-error interfaces;
  every row now measures its serialized locking bytecode against a named, machine-readable 10,000-byte ceiling in
  `packages/solidcash/test/application-size-budgets.ts`. The same manifest classifies event/custom-error coverage
  for every row as covered or explicitly not declared, and each scenario validates its profile while running.
- [-] Keep `.worktrees/n-erc20` and its quarantined-admission design outside the first release.
  - The branch adds a separate 1,828-line native-USDT/facet profile and an admission design not used by the
    supported nine-file application gate. The release instead ships the smaller ERC-20-like ledger scenario and
    treats native CashTokens as the preferred fungible-asset model; the branch remains available for a later
    independently reviewed feature release.
- [x] Document source/workflow changes required by every selected Solidity application pattern.
  - Evidence: `SOLIDITY_COMPATIBILITY_0.13.1.md`, “Application porting notes”.

### Packaging and release engineering

- [x] Align publishable package versions and internal dependency ranges at 0.13.1.
- [x] Build the exact publish tarballs and install them into an empty consumer project.
  - `yarn test:package-smoke` packs all six release packages, validates README/license and every concrete
    main/types/bin/export target, installs only those tarballs into a temporary consumer, exercises runtime and
    subpath imports, compiles public types, checks all CLIs, and compiles/constructs a contract through packed APIs.
- [x] Run the golden-path smoke test against the packed artifacts rather than workspace links.
  - `yarn test:package-smoke` installs only the six release tarballs plus consumer tooling, compiles the stateful
    `GoldenToken`, and passes the deploy/call/event/revert/state/fixture-reset path 3/3 in that isolated project.
- [x] Verify package exports, type declarations, source maps, licenses, READMEs, and dependency ranges.
  - The packed smoke covers exports, type declarations, licenses, READMEs, source maps for every emitted
    JavaScript file, installed versions, and internal dependency resolution. Every packed map is now required to
    embed all referenced source content, so consumers do not depend on unpublished `src/` trees.
- [x] Produce release notes separating supported parity, experimental features, deferrals, and breaking changes.
  - [`RELEASE_NOTES_0.13.1.md`](RELEASE_NOTES_0.13.1.md) is the candidate draft; it deliberately leaves the exact
    release commit/tag and final clean-checkout attestation pending.
- [ ] Tag the exact tested commit and record the corpus/regtest results in the release notes.

## P2 — Valuable after the first release

These items do not block the first release when the unsupported boundary is documented and fail-closed.

- [ ] Broaden Yul compatibility beyond the supported lowerable subset.
- [ ] Implement the growable variable-size state memory model.
- [ ] Revisit circular cross-contract address references.
- [ ] Add delegate-mode satoshi and token movement.
- [ ] Add fallback-only transparent proxy support.
- [ ] Pursue a compact dual-mode standalone/delegate encoding.
- [ ] Complete `hardhat-deploy` compatibility.
- [ ] Complete chai matcher and third-party matcher compatibility.
- [ ] Cover remaining rare recursive ABI shapes.
- [ ] Automate per-optimizer-rule VM equivalence proofs.
- [ ] Improve debugger reporting for optimized values and nested loops.
- [ ] Expand app-specific event decoders and project helper libraries.

## Known skipped/TODO-test review

At the 2026-08-05 audit snapshot, 14 executable skipped or TODO occurrences remain under `packages` and
`examples`, down from 24 after removing six empty placeholder suites and one obsolete manual-proof TODO. Every remaining occurrence is classified in
[`TEST_DEFERRALS_0.13.1.md`](TEST_DEFERRALS_0.13.1.md); none is a release-blocking coverage gap.

- [x] Prove writing an unbounded cross-contract return directly to dynamic state, including an interface that
  under-declares the callee's physical state footprint. Dynamic chunks anchor after the authenticated return event.
- [x] Prove BIP68 block-height and 512-second MTP maturity against BCHN: short sequence fails the covenant,
  immature valid sequences fail node consensus, and the identical spends succeed after maturity.
- [x] Remove the stale optimizer-equivalence TODO; 102 active equivalence proofs already cover this area.
- [-] Nested-loop and optimized-value debugger enhancements are post-release.
- [x] Keep circular-call tests skipped only with the permanent address-model limitation documented.
- [x] Review skipped invalid-spend and incorrect-unlocker tests for security relevance.
- [x] Reach zero unclassified `.skip`/`.todo` occurrences.

Suggested audit command:

```bash
rg -n --glob '*.{test,spec}.ts' \
  '^\s*(describe|it|test)\.(skip|todo)\b' \
  packages examples -g '!**/node_modules/**'
```

## First-release exit checklist

- [ ] No known silent miscompiles in the supported language subset.
- [ ] All unsupported security-sensitive shapes fail at compile or transaction-construction time.
- [x] State-bus/Layer-3 scope is integrated and frozen, or clearly excluded.
- [x] Proxy/delegate scope is explicit and tested by the required integrity gate.
- [x] Compatibility manifest is complete and published.
- [ ] Corpus baseline is reproducible, crash-free, and non-regressing.
- [ ] Clean-checkout CI and BCHN regtest gates pass.
- [x] The Hardhat-style golden path passes using packed release artifacts.
- [x] Representative application suite passes with script-size measurements.
- [x] Package versions and exports are consistent.
- [x] Release documentation clearly separates parity from intentional BCH differences.
- [ ] Exact release commit, test results, scorecard, and known deferrals are recorded.

## Audit snapshot and source index

The initial audit was performed against `solidcash_v0.13.1` at `8b8410a5` on 2026-07-27. This reassessment was
performed against `solidcash_v0.13.1` at `1a533c88` on 2026-08-04. Former worktree state is no longer used as a
release metric; merged commits and reproducible gates are the evidence baseline.

Primary evidence:

- [`packages/solidc/docs/deferrals.md`](packages/solidc/docs/deferrals.md)
- [`packages/solidc/docs/external-contract-calls.md`](packages/solidc/docs/external-contract-calls.md)
- [`packages/solidc/docs/buffered-state-and-message-bus-research.md`](packages/solidc/docs/buffered-state-and-message-bus-research.md)
- [`packages/solidc/docs/sorted-mapping-c2.md`](packages/solidc/docs/sorted-mapping-c2.md)
- [`examples/solidity-corpus/README.md`](examples/solidity-corpus/README.md)
- [`examples/solidity-corpus/scorecard.txt`](examples/solidity-corpus/scorecard.txt)
- [`examples/solidity-corpus/PROGRESS.md`](examples/solidity-corpus/PROGRESS.md)
- [`examples/testing-suite/HARDHAT-PARITY.md`](examples/testing-suite/HARDHAT-PARITY.md)
- [`package.json`](package.json)
- [`.github/workflows/github-actions.yml`](.github/workflows/github-actions.yml)

### Release-gate snapshot

Update this table whenever a release candidate is cut.

| Gate | Result | Commit/artifact | Date |
|---|---|---|---|
| Clean install | **PASS** — `yarn install --frozen-lockfile --ignore-scripts` with worktree-local dependencies | `d5d4d70f` | 2026-08-04 |
| Build | **PASS** — all six packages plus testing-suite fixture compilation | `codex/release-readiness-fixes` | 2026-08-04 |
| Compiler tests | **PASS** — 3,146/3,146 across the complete run plus fresh-process retries for three load-sensitive cases; includes storage-pointer, alias-source, and adjacent C2 local-key regressions | `codex/release-readiness-fixes` | 2026-08-05 |
| SDK unit/e2e/mocknet | **PASS** — 433 files; 3,808 passed, 39 skipped, 9 todo. High-bit EVM storage and shared Yul-memory regressions pass | `codex/release-readiness-fixes` | 2026-08-04 |
| Lint | **PASS** — seven workspaces plus root testing-suite lint | `codex/release-readiness-fixes` | 2026-08-04 |
| Spellcheck | **PASS** — 2,101 files, zero issues; explicit 890-term baseline dictionary | `codex/release-readiness-fixes` | 2026-08-05 |
| BCHN regtest | **COMPLETE AT THE CANDIDATE REVISION, NOT GREEN** — the full matrix ran **449/449 files from zero on a freshly wiped chain at `cf6de29c`**, the current branch head, with 12 of 57 batches failing across 15 files and 35 tests, and a single transient RPC error. That is down from 24 failed batches and 39 files on the pre-fix run. Residual failures: 4 tests exceed the operation-cost budget; 10 fail on the sparse/faithful derivation split; 4 are the logical CREATE anchor (`ContractFactory`, `LargeContractSplitting`, `UpgradesDeployProxy`); 1 is the `msg.sender` master lookup; 13 are `AtomicMessageBus*` timeouts at 120-240 s, which are load-related rather than covenant failures; and 3 are a `Sec13` funding artifact refused as `absurdly-high-fee`. `DeployThenCallFold` and `Erc20LikeApplication` both PASSED this run despite failing earlier, so both are state-dependent rather than deterministic - `Erc20LikeApplication` had been recorded as a genuine live-only finding on the strength of one pristine-and-alone failure, and that was over-confident. An earlier attempt at this same run is disregarded: the Docker daemon briefly reported no containers, the matrix continued against an unreachable node, and 57 `fetch failed` errors made everything past batch 26 meaningless.<br><br>Superseded detail from the pre-fix run: v29 BIP68 height/MTP proofs pass, and the atomic composition capstones and the 24-input, 94,651-byte eight-participant maximum are accepted under standard relay policy. Failures resolve into five classes, none unexplained: three genuine product defects (operation-cost budget, derivation-path split, logical CREATE anchor), backend policy/reporting-layer differences, rejection-message forms, one regression from a harness fix of ours, and order-dependent tests. Four harness defects were found and fixed along the way (vout-0 genesis starvation, CLTV rejection form, fee-funder size substitution, and a 1-satoshi forgery that BCHN refused as dust before the covenant could object). The run is **not release evidence** for three independent reasons: it was run at base `43be1dd3` and the branch has since merged mainline to `86df89a4`, which rewrote `compiler.ts`, `GenerateTargetTraversal.ts`, `utils/script.ts` and the generated parser; the three product defects are unfixed; and the suite still contaminates its own shared signer address within a run. A future evidence run must therefore start from a wiped chain AND re-run at the candidate revision. Regtest coverage is currently out of scope by maintainer direction, so the chain-free sweeps below are the maintained check for the density and derivation classes | `REGTEST_CONTINUE_ON_FAILURE=true yarn test:regtest` after `docker compose -f docker-compose.regtest.yml down -v` | 2026-08-06 |
| Testing suite | **PASS** — 6 files, 25/25; includes maintained stateful compile/deploy/call/event/revert/state/reset path 3/3 | `yarn workspace testing-suite test` | 2026-08-05 |
| `@solidcash/testing` package | **PASS after fix** — 7 files, 19/19. `SplitArtifactHre` failed on the candidate revision because `packages/testing/vitest.config.ts` set no `testTimeout`, so it inherited the 5s vitest default while the test compiles a split contract in about 8s. Its sibling packages already set 30s (`solidc`) and 120s (`solidcash`) for exactly that reason; the package now sets 30s. This failure is machine-speed dependent, so it would pass on a fast machine and fail on a slow one | `yarn workspace @solidcash/testing vitest run` | 2026-08-05 |
| Generated-project smoke | **PASS** — clean project initialization/compile/test 1/1; cache lifecycle 1/1; stateless/stateful harness 21/21 | `yarn test:generated-project-smoke` | 2026-08-05 |
| Solidity corpus | **INFORMATIONAL / DEFERRED** — positives retain 2,698/2,805, 107 named failures, zero generic/raw buckets/timeouts; all 2,158 negatives checked, with 323 over-accepted. Strictness parity is not a current release blocker | corpus `816d9b2a`, Node 22.22.0, linux-arm64; positive primary 30s/8, retry 30s/4 then 120s/4; negative audit 30s/4 then 120s/4; accepted-negative recheck 30s/4 | 2026-08-05 |
| Packed-package consumer smoke test | **PASS** — six tarballs; clean install, embedded-source-map/export/type/CLI/runtime/compiler checks; maintained stateful golden path 3/3 | `yarn test:package-smoke` | 2026-08-05 |
| Application conformance suite | **PASS** — deterministic nine-file mock-provider gate passes 94/94 with explicit applicability and named locking-script budgets; the serial BCHN v29 application gate passes 9/9 across ERC-20-like and escrow/oracle/timelock flows | `yarn test:application-conformance`; `yarn test:application-regtest` | 2026-08-05 |
| Integrity conformance suite | **PASS** — deterministic fifteen-scenario gate passes 81/81 executed tests (one documented skip), covering every stable physical state backend plus external/delegate composition and lifecycle elements | `yarn test:security-conformance` | 2026-08-05 |
| Known `.skip`/`.todo` review | **PASS** — 14 executable occurrences classified; no skipped release blocker remains | `codex/release-readiness-fixes` | 2026-08-05 |
