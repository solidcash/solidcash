# W4 wins: the framed convention and the marketplace path

A prioritized list of performance and artifact-size wins for the framed convention, derived by
reading the code at `feat/per-call` HEAD `a0ce264c7`. No instrumentation was added and no CPU
profile was run; the durable rule for this workstream is to judge by the shape of the code. Where a
number exists it is cited from the W1 to W3 docs in this directory.

The marketplace ladder is red at HEAD (`MARKETPLACE_RED_AT_HEAD.md`, `W4_STATUS.md`), so no timing
can be attributed to a candidate right now. Every candidate therefore carries a verification recipe
that does not need the ladder (a focused framed test, `compileFile`, or one of the `scripts/`
tools), plus the environment switch that proves the claim once the ladder is green.

## How this list is ranked

The slow no-proxy titles are VM bound: `PERF_KERNEL_VS_FRAMED.md` records 89.5 percent VM on the
worker profile (758756 of 847724 samples), 2.4 percent derivation and 6.1 percent garbage
collection, at `approve result and review / sanity checks` 1044.3 s and `refund / sanity checks`
718.8 s. That main share is not only the final verdict runs: the composer's own learning runs the
compiled master inside the VM, so its cost is counted in the VM bucket, not in derivation.

Candidates are ordered by expected effect on those titles first, then by artifact bytes. "Target"
is `perf`, `size`, or `both`. A candidate marked `carried` is repeated from an existing doc rather
than confirmed against the current code; the rest were read in the tree.

1. Batch the learned-value walk. `composer/draft.ts` `learnComputedValues`. Target perf. Read in code.
2. Build the VM transaction once per step. `composer/draft.ts` `transactionFor`, `unlockingFor`. Target perf. Read in code.
3. Cheap stop fingerprint. `composer/shipped-host.ts` `runOnce`, `fingerprintOf`. Target perf. Read in code.
4. Memoize `deployMaster`. `deploy/material.ts` `deployMaster`. Target perf. Read in code.
5. Index the mock category lookup. `network/MockNetworkProvider.ts` `getUtxosByTokenCategory`. Target perf. Read in code.
6. Cache refusal debug decoding. `composer/refusal.ts` `frameRevertReason`, `debugSkew`. Target perf. Read in code.
7. vmNumber conversion fast path. libauth `vmNumberToBigInt` and the SDK overrides. Target perf. Carried over.
8. Index placeholders to entries. `composer/draft.ts` `learnComputedValues` propagation. Target perf. Read in code.
9. Trim the master padding. `solidc/framed/master/master-program.ts` `padFramedMasterScript`. Target size. Read in code.
10. Outline repeated framed spans. `solidc/messageBusVerifierDedup.ts` `outlineRepeatedRun`. Target size. Read in code.

***

## 1. Batch the learned-value walk (perf, highest)

**File and symbol.** `packages/solidcash/src/framed/composer/draft.ts`, `learnComputedValues`, and
the reader it calls, `packages/solidcash/src/framed/deploy/declaration.ts`,
`readComputedDeclaration`.

**Mechanism.** A plan may leave a written record view unstated, and the body's own failing close (a
failed `OP_EQUALVERIFY` that leaves the declaration and the computed value on the stack) is the
only channel that hands the value back. `learnComputedValues` learns at most one value per
iteration; its loop bound is stated in the code as
`views.size + [...unlearnedWitnesses.values()].filter((witness) => witness.master === master).length`.
Each iteration calls `readComputedDeclaration`, which calls `machine.boundedDebug(program)` when the
machine offers it (the call path passes the provider machine into `composeDraft`, so it does). The
`boundedDebug` implementation in `packages/solidcash/src/network/createVirtualMachine.ts` steps the
whole master program from its start with `stateStepMutate` and returns only the state before and the
state at the first error. So each learned value pays one full stepped run of a master that can be
100 KB or more, and a frame with several unstated views pays several. `learnUnstatedViews`
(draft.ts) repeats this over every master, and `callInShape` in `call/call.ts` calls it again on each
learning pass.

**Evidence.** The loop bound and the `boundedDebug` call are in `learnComputedValues` (draft.ts).
`W4_STATUS.md` pins the cause: the machine's failed-close record is never kept on this path
(`SOLIDC_DEBUG_RECORDED_CLOSE=1` reports `close: "none"` on every evaluation), so each value pays a
re-run. The existing test `packages/solidcash/test/framed/composer/learned-write.test.ts` measures
exactly this count through a wrapped `boundedDebug` and asserts at most one traced reading per value.
The memory records `boundedDebug` at roughly 81 s of a 328 s profile, which is why this is ranked
first.

**Expected effect.** Perf, large on the slow no-proxy titles because the re-runs are full VM passes
of the biggest programs. It does not change emitted bytecode.

**Risk / semantic change.** High. The reading is one close per run today, and resuming past failed
verifies to collect more closes would change shipped behaviour. A safe version needs the VM to keep
every declaration close it passes in one stepped run (a bounded list keyed by the operand pair,
without resuming past a verify), and the composer to consume them all. The W4_STATUS doc records
that the cheap repair (a plain evaluation first to populate `recordedClose`) was tried and gave no
gain because the plain path never fails the verify the stepped path does. Batching is the change
that remains.

**Verification.** Extend the wrapped-machine count in `learned-write.test.ts` to a frame with
several unstated views and assert the count drops to one per master per pass. `FRAMED_HOP_TRACE=1`
(proxy/hop-trace.ts) prints the learned sequence per hop once the ladder is green.

## 2. Build the VM transaction once per step, not per evaluation (perf)

**File and symbol.** `packages/solidcash/src/framed/composer/draft.ts`, `transactionFor`,
`unlockingFor` and `transactionOutputs`; the encoder
`packages/utils/src/framed/witness-block.ts`, `buildMasterUnlockingBytecode`.

**Mechanism.** `programFor(master, block)` returns
`{ inputIndex, sourceOutputs, transaction: transactionFor(...) }`, and `transactionFor` maps over
every input and calls `unlockingFor`. For each master input that calls
`buildMasterUnlockingBytecode`, which pushes the whole witness block and re-encodes the redeem
script and every argument, then concatenates the parts. It also rebuilds the output list through
`transactionOutputs`, which walks every segment and runs `declaredChainEnd` each time.
`programFor` is called at least twice per stop site by the host (`runOnce` before and after the
fill) and once per learned value through `programOf`. `sourceOutputs` is already computed once and
reused; the transaction is not.

**Evidence.** Read in `draft.ts` (the `transactionFor` closure and `unlockingFor`), `shipped-host.ts`
(the `step` function and `runOnce`), and `witness-block.ts` (`concatBytes` of the block push,
argument pushes, and redeem-script push). `PERF_KERNEL_VS_FRAMED.md` records composed calls with a
largest unlocking script of 24937 bytes (proxied) and 135908 bytes (no-proxy), carried by six to
forty-five inputs, so each rebuild is a large allocation set.

**Expected effect.** Perf. Removes repeated large allocations and the repeated
`declaredChainEnd` walk; lowers GC, which is 6.1 percent of the no-proxy profile. No bytecode
change.

**Risk / semantic change.** Low. The only input whose unlocking bytecode changes between steps is
the one under evaluation (`override.master`), and outputs change only when a learned view changes a
record commitment. Memoize the other inputs and the outputs, invalidating on a learned view.

**Verification.** A counting wrapper over `buildMasterUnlockingBytecode` in a focused framed call
test, or `SOLIDCASH_TX_TRACE=1` for the composed transaction's bytes; the host step counters under
`SOLIDC_DEBUG_HOST_STEPS` show the run count.

## 3. Cheap stop fingerprint (perf)

**File and symbol.** `packages/solidcash/src/framed/composer/shipped-host.ts`, `runOnce` and its
local `fingerprintOf`.

**Mechanism.** `runOnce` decides whether a fill moved the program by comparing a stop fingerprint
built as `items.map((item) => binToHex(item)).join('|')` over the main and alternate stacks. A stop
can leave the whole witness block or a large record on the stack, so a fingerprint can allocate a
hex string of tens of kilobytes per run, on top of the `#`-joined pair. This runs on every step,
including the before-fill probe.

**Evidence.** Read in `shipped-host.ts` (`runOnce`, and `reachedFurther` which consumes the
fingerprint). The per-run hex join is unconditional whenever a stack is present.

**Expected effect.** Perf, moderate; it lowers transient allocation and GC rather than VM work.

**Risk / semantic change.** Low, but the comparison must stay exact: `reachedFurther` relies on the
fingerprint distinguishing two stops at the same instruction pointer (a repeated site) by the block
the walk consumed. Compare the `Uint8Array` items directly (length plus bytes) instead of their hex.

**Verification.** A focused repeated-site framed test (the loop tests under
`test/framed/conformance/`) must still pass; count allocations with a wrapper if needed.

## 4. Memoize `deployMaster` (perf)

**File and symbol.** `packages/solidcash/src/framed/deploy/material.ts`, `deployMaster`; helpers
`fillPlaceholders` (`solidc/framed/master/placeholders.ts`), `masterLock`, `validatorAddress` and
`validatorTemplateHash` (`packages/utils/src/framed/identity.ts`).

**Mechanism.** `deployMaster` derives the same result for the same `(artifact, category,
validatorProgram)` every time, but each call re-runs the checks and rebuilds the values:
`fillPlaceholders` copies the whole program (`Uint8Array.from(script)`), `masterLock` hashes the
whole filled program, and `validatorAddress` computes
`hash256(validatorRedeemScript(category, validatorTemplate))` over the validator program while
`validatorTemplateHash` is a `sha256` over the same program. The module already memoizes the
assembly (`assembledPrograms`, a `WeakMap` keyed by artifact and bytecode) but not the fill, the two
hashes, or the lock. It is called per entry, per payable recipient, per callee per hop plan
(`proxy/external-calls.ts`), and per read frame (`read/read.ts`).

**Evidence.** Read in `material.ts` (the `deployMaster` body and the `assembledPrograms` cache
comment), `placeholders.ts` (`fillPlaceholders` copies), and `identity.ts` (both hash helpers).

**Expected effect.** Both. Perf: removes a full script copy plus a full hash per call on programs
that are 20 KB to 135 KB. Size: none directly, but it is the same code path the size probes deploy
through.

**Risk / semantic change.** Low. Cache on `(artifact, category, validatorProgram)`; a changed
category or validator program must miss. `verifyMasterDeployment` stays as the check for callers
that want it.

**Verification.** A unit test that calls `deployMaster` twice with the same inputs and asserts one
fill (wrap `fillPlaceholders` or compare object identity), plus the existing
`test/framed/deploy/` suite.

## 5. Index the mock category lookup (perf)

**File and symbol.** `packages/solidcash/src/network/MockNetworkProvider.ts`,
`getUtxosByTokenCategory` and `liveUtxoEntries`.

**Mechanism.** `liveUtxoEntries` already rebuilds the flat live UTXO list only when the indexer's
store generation changes, but `getUtxosByTokenCategory` linearly scans that list on every call,
lowercasing each entry's category, and allocates a fresh `Utxo` (with a `.slice()` of the locking
bytecode and a spread of the token) per match. `readFramedDeployment` (`deploy/records.ts`,
`utxosOfCategory`) calls it once per category, and the call and hop planning call it per external
contract and per payable contract. Because the mock mines a block on every send, the live set grows
across a title.

**Evidence.** Read in `MockNetworkProvider.ts` (`getUtxosByTokenCategory` and the `liveUtxoEntries`
cache) and `deploy/records.ts` (`utxosOfCategory`). `test/unit/MockCategoryView.test.ts` already
pins the view-until-write behaviour.

**Expected effect.** Perf, marketplace-only (this is the test provider, not a production one), but
the marketplace titles run entirely on it, so it counts directly in their wall time.

**Risk / semantic change.** Low. Build a `Map` from category (both byte orders, lowercased) to
entries when the view is rebuilt, and return copies lazily. Must keep the generation check so a
write, a snapshot restore and a rewind invalidate the index.

**Verification.** `MockCategoryView.test.ts` plus a framed call test; count scans with a wrapper
over the storage snapshot.

## 6. Cache refusal debug decoding (perf)

**File and symbol.** `packages/solidcash/src/framed/composer/refusal.ts`, `frameRevertReason` and
`debugSkew`; `packages/utils/src/source-map.ts`, `sourceMapToLocationData`.

**Mechanism.** `reportCompositionRefusal` evaluates every master frame and, for each refusal, calls
`frameRevertReason`. That calls `debugSkew`, which runs
`decodeAuthenticationInstructions(program)` over the whole master program just to count
instructions, and then `sourceMapToLocationData(sourceMap)`, which splits and parses the entire
source map string into fresh objects on every call. Neither is cached.

**Evidence.** Read in `refusal.ts` (`reportCompositionRefusal`, `frameRevertReason`, `debugSkew`) and
`source-map.ts` (`sourceMapToLocationData` has no cache). The refusal path is exercised at every
intermediate probe of a refusing composition, which is what the red ladder hits today.

**Expected effect.** Perf on refusal paths and on titles that refuse and retry; no effect on a
clean success path, so ranked below the success-path wins. No bytecode change.

**Risk / semantic change.** Low. Memoize `debugSkew` per `(artifact, program)` identity or length and
`sourceMapToLocationData` per source map string at module scope.

**Verification.** A refusing framed test (for example under `test/framed/reverts/`) with a wrapper
counting `decodeAuthenticationInstructions` calls; `source-map.ts` has no test of its own today.

## 7. vmNumber conversion fast path (perf, carried over)

**File and symbol.** libauth `vmNumberToBigInt` and `bigIntToVmNumber`, reached from the framed
bodies and from the composer (`call/call.ts` decodes call amounts with `vmNumberToBigInt`); the SDK
override layer is `packages/solidcash/src/network/createVirtualMachine.ts`.

**Mechanism.** The plan's W4 lever list (`UPSTREAM_PLAN.md`) ranks this second at about 19 percent
self time: the small-number path still allocates (`BigInt(magnitude)` on read, `new Uint8Array` on
write). `PERF_LIBAUTH.md` records the fork's `OP_SPLIT` bigint-index override as the only VM
conversion change that mattered.

**Evidence.** Carried from `UPSTREAM_PLAN.md` (W4) and `PERF_LIBAUTH.md`; not re-measured here. The
plan notes the user postponed it once, so confirm before starting.

**Expected effect.** Perf, potentially large but broad (it is a libauth change, not a framed one),
so it is not specific to the framed convention. No bytecode change.

**Risk / semantic change.** Medium; it touches the VM's number handling, so it needs the libauth
suite as well as the framed suites.

**Verification.** The `PERF_LIBAUTH.md` micro-benchmark harness; re-run it after the change.

## 8. Index placeholders to entries for propagation (perf)

**File and symbol.** `packages/solidcash/src/framed/composer/draft.ts`, inside
`learnComputedValues` (the block after `views.delete(key)`).

**Mechanism.** After learning one value, the code scans every block, every segment and every entry
to replace the placeholder it carried on from, using `bytesEqual` per entry:
`for (const block of blocks.values()) for (const segment of block.segments) for (const other of segment)`.
With several learned values this is O(values times total entries).

**Evidence.** Read in `learnComputedValues`. `composeDraft` already walks every segment once while
building `normalizedSegments`, so the placeholder-to-entry map could be built there.

**Expected effect.** Perf, small next to candidates 1 and 2, but it is pure overhead on the same
path and is removed by the same batching work.

**Risk / semantic change.** Low. Build `Map<placeholderKey, entry[]>` at normalization and update it
when a value is learned.

**Verification.** `learned-write.test.ts` still passes and reports the same written views.

## 9. Trim the master padding (size, top size lever)

**File and symbol.** `packages/solidc/src/framed/master/master-program.ts`,
`padFramedMasterScript` and `FRAMED_MASTER_PADDING_BYTES` (1024); applied in
`packages/solidc/src/compiler.ts` at the end of framed codegen.

**Mechanism.** Every framed master program ends with a 1024-byte block of 512-byte pushes each
followed by `OP_DROP`. The comment explains why: an input's operation-cost budget is a density over
the bytecode that spends it, and a master that makes several calls runs out of budget without the
extra length, so the padding buys budget at about one byte's cost per chunk. The master program is
one artifact script per contract (the head and dispatcher serve every body), so the cost is a flat
1024 bytes per framed contract, emitted after the optimiser and outside the census retarget.

**Evidence.** Read in `master-program.ts` (`FRAMED_MASTER_PADDING_BYTES`, `PADDING_CHUNK_BYTES`,
`padFramedMasterScript`) and `compiler.ts` (the call site). `SIZE_KERNEL_VS_FRAMED.md` gives
MarketplaceV1 framed at 135056 bytes with 122499 of bodies and FakeToken at 24303. The padding is
1024 bytes, about 0.76 percent of MarketplaceV1 and about 4.2 percent of FakeToken.

**Expected effect.** Size only. It is the one guaranteed artifact-byte win found by reading: a
constant, measurable reduction, largest in relative terms on the smallest framed contracts.

**Risk / semantic change.** Medium. The padding exists for operation-cost density, and
`MOCK_CONSENSUS_LIMITS` deliberately keeps `operationCostBudgetPerByte` at 800 so a density failure
cannot hide. A safe version sizes the padding from the entry's worst-case call count (the comment
already says a one-call master fits its own budget and a several-call master does not), so a
call-free or single-call master gets little or none. A master that genuinely needs the room must
still get it.

**Verification.** `compileFile` a shaped contract and compare `asmToBytecode(...).length`;
`node scripts/compare-convention-sizes.mjs` for the paired view; and run the shaped framed test with
the real operation-cost budget so a density regression fails loudly.

## 10. Outline repeated framed spans (size, measure first)

**File and symbol.** `packages/solidc/src/messageBusVerifierDedup.ts`, `outlineRepeatedRun` and
`deduplicateMessageBusVerifierStackSuffix`; the framed bodies are emitted by
`packages/solidc/src/generation/GenerateTargetTraversal.ts` with `framedMaster` set.

**Mechanism.** `outlineRepeatedRun` rewrites an instruction-aligned repeated straight-line body (a
12-op `OP_SWAP`/`OP_TOALTSTACK` run, or 12 `OP_FROMALTSTACK`) into one `OP_DEFINE` body plus
`OP_INVOKE` sites, but only when the whole program shrinks. It is applied only to the message-bus
verifier program (`compiler.ts` calls it on `extractMessageBusVerifierProgram` output), not to the
framed master. Framed bodies dominate the artifact (122499 of 135056 bytes for MarketplaceV1), and
whether they contain the same repeated spans is not established here.

**Evidence.** Read in `messageBusVerifierDedup.ts` and the call sites in `compiler.ts`. The
byte-bucket breakdown tool is `scripts/size-composition.ts` (identifier pushes, `OP_DEFINE` and
`OP_INVOKE` opcodes, body length prefix, content); it currently walks the direct corpus, not framed.

**Expected effect.** Size, unknown magnitude. This is ranked last because it is conditional on a
measurement that has not been taken, and `SIZE_KERNEL_VS_FRAMED.md` shows framed is already smaller
than the kernel on all but one paired contract, and that one is named in `SIZE_KERNEL_VS_FRAMED.md`.

**Risk / semantic change.** Low if it only runs when the covenant shrinks and keeps every encoded
instruction intact, as the existing pass does. The framed semantics live in the emitted program, so a
byte-identical check of the rewritten program's behaviour is the gate.

**Verification.** Extend `scripts/size-composition.ts` to compile one framed marketplace contract
(or a corpus slice with `composition: 'framed'`) and report the buckets; act only if the repeated-run
bucket is large. Keep the existing `messageBusVerifierDedup` tests green.

***

## Size reality check

The size opportunity is smaller than the perf one. `SIZE_KERNEL_VS_FRAMED.md` shows framed
MarketplaceV1 at 135056 bytes against the kernel's 265204, and framed bodies (122499) dominate the
framed total, so head, dispatcher and padding together are about 12557 bytes. Every paired
application contract is over the 10000-byte per-input limit on both conventions, and the marketplace
titles pass only because the mock relaxes `maximumInputBytes`. Candidate 9 is the only guaranteed
byte win; candidate 10 is the only structural one, and it needs a measurement. No size candidate
should be traded against operation-cost density, which the plan's W4 note warns about.

## What is already optimized (do not redo)

- The host reuses the previous run's verdict per master (`lastStop` in `shipped-host.ts`), so a step
  is one fresh run per site rather than two.
- `composeDraft` already keeps `sourceOutputs` fixed across runs.
- `buildMasterHeadScript` is emitted once per contract, not per entry.
- libauth's function-table clone and `encodeDataPush` copy are libauth-side wins already measured in
  `PERF_LIBAUTH.md` and targeted for an upstream PR, not framed-side work.

## How to measure once the ladder is green

- `SOLIDCASH_TX_TRACE=1` prints one line per broadcast with bytes, inputs, outputs and fee; use it to
  attribute the composed transaction size.
- `FRAMED_HOP_TRACE=1` (proxy/hop-trace.ts) prints the per-hop stop and learned sequence; use it to
  count learned values per hop for candidate 1.
- `SOLIDC_DEBUG_RECORDED_CLOSE=1` (network/createVirtualMachine.ts) prints `recorded-close-declined`
  with `close: "none"`, which is the evidence that the composer path pays a re-run.
- `SOLIDC_DEBUG_HOST_STEPS` (shipped-host.ts `runOnce`) prints the per-step stop and the last steps
  of the probe trace.
- `SOLIDC_DEBUG_PREFLIGHT_TIMING=1` (MockNetworkProvider `sendRawTransaction`) splits submit from
  mine time.
- The `learned-write.test.ts` wrapped-machine count is the focused, ladder-free measurement for
  candidate 1.
