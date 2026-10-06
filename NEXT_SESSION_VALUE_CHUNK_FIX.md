# Next session: fix the promoted-flow value-chunk lane (marketplace `take job`)

## UPDATE (round 29): the chunkable caller state also works - the remaining deltas are proxy/delegate and the intermediate participant

Extended the round-28 fixture with the delta-1 case (chunkable caller state):

* coordinator now has `bytes public stored;` and writes
  `abi.encodePacked(next, next, next, next, next, next, next, next)` (8 packed 32-byte words, 256 B, so the
  state write is chunkable and the compiler's value-chunk pin is in play), composed with **no** provisional seed
  so the result must be discovered from a VM trace.
* Result: **GREEN** for `kernel-row-loop` and `legacy-unroll` (3 cases in the file, all passing, ~9.5 s total):
  the published chunkable state is the exact 8-word value `...0010` repeated, and every input evaluates under
  BCH-2026.

So deltas 1 (chunkable) and the flat two-contract shape are both ruled out. What remains between this fixture and
the failing `take job` graph:

1. **Proxy/delegate caller.** `MarketplaceV1` is a proxy: its handler body executes as a delegate execution
   against the implementation while its state lives in the DataNft entries, and the failing input is its own
   `__message_bus1` route. Build the fixture caller as a proxy + implementation pair (the composer's
   `descriptor.executor` / `executionArtifact` path) whose `apply` stores the producer result, and repeat the
   three cases. Templates already in the tree for the proxy/delegate composition shape:
   `packages/solidcash/test/journal-message-bus/e2e/KernelDelegateDualRuntimeSet.test.ts:113` and
   `KernelDelegateInactiveDynamicWrite.test.ts:89` (both pass `executor: deployed.implementation`), plus
   `AtomicMessageBusCompose.test.ts:1875` for the `preparedCalls` form with `executionArtifact` + `executor`.
2. **Intermediate participant.** In the marketplace the value crosses three participants
   (`Unicrow.pay` produces -> the root proxy stores it -> `MarketplaceDataV1` publishes the JobEvent entry in a
   shared route), whereas the fixture has two contracts and one direct edge. Add a middle contract that is
   called by the coordinator and/or owns the collection being written.
3. Only after one of those reproduces should the marketplace family be run again (4 min per run).

Note the fixture now also proves the *positive* half of the objective's invariant generally: a caller may keep an
authenticated (seeded or trace-discovered) producer result in its own scalar or chunkable state, and the composed
atomic transaction publishes it identically under `kernel-row-loop` and `legacy-unroll`.

## UPDATE (round 28): the flat "caller stores a discovered result" lane WORKS - the difference is structural

New generic regression written this round (untracked, passing):
`packages/solidcash/test/journal-message-bus/e2e/KernelResultStateWriteParity.test.ts` - `ScalarSource.read(seed)
returns uint`, `StoreCoordinator.apply(seed)` does `uint next = IScalarSource(source).read(seed);
this.stored = next;`, composed through `messageBus.compose({ preparedCalls })` under both conventions, with
BCH-2026 evaluation of every input plus a state assertion. Two cases, both GREEN:

* with `provisionalResultCommitment` on the producer call: `stored == 16n` for `kernel-row-loop` and
  `legacy-unroll`;
* **without** any provisional seed (the composer has to discover the result from a VM trace, which is the
  marketplace's situation - `pay` has `provisional None`): also `stored == 16n` for both conventions.

So the round-26 hypothesis ("the SDK has no lane that refreshes the caller's own state with an authenticated
producer result") is **too broad**: the flat caller-store lane is implemented and correct, seeded or discovered.

The remaining structural differences between that passing fixture and the failing `take job` graph - test these
in this order, each is a small delta on the new fixture:

1. **Chunkable stored value.** The fixture stores a scalar `uint`; the marketplace writes a *chunkable* mapping
   entry (`jobs[jobId]` struct) and the failing check sits inside the compiler's value-chunk pin. Give the
   coordinator a `bytes`/mapping state var long enough to chunk (> 60 B) and assert the published value.
2. **Proxy/delegate caller.** `MarketplaceV1` is a proxy whose state lives in DataNft entries and whose handler
   body runs as a delegate execution against the implementation; the fixture's coordinator is a plain contract.
   Wrap the coordinator in the proxy/delegate shape and repeat.
3. **Intermediate participant.** In the marketplace graph the result travels `Unicrow.pay -> (root proxy write)`
   while the row itself is executed inside a third participant's shared route; the fixture is two contracts with
   one direct edge.

The fixture is ~1.5 s per case, versus ~4 min for the marketplace family, so it is the right loop for (1)-(3);
only re-run `npx vitest run --config vitest.marketplace.config.ts -t 'take job$'` once a fixture case reproduces.

## UPDATE (round 27): the uncovered general case is "caller stores a callee result in its own state"

Findings this round, no new code change:

* Existing generic regressions already cover the lane this round's resolver fixed (a result forwarded into
  another call's arguments): `packages/solidcash/test/journal-message-bus/e2e/KernelMultiResultGraphParity.test.ts`
  ("forwards authenticated tuple lanes with kernel and legacy observable parity") does
  `(left, right) = IPairSource(source).read(seed); IPairSink(sink).accept(left, right);` and passes.
* **No test covers the caller keeping the result in its own state** (`(uint v) = ISource(src).read(seed);
  this.stored = v;`). That is exactly what `take job` needs for `jobs[jobId].escrowId`, and it is the only
  difference between the passing parity fixture and the failing marketplace graph.
* Therefore the cheapest correct next step is *not* another marketplace run: add a minimal fixture with a
  producer contract returning a scalar, a coordinator that stores that value in its own state **and** forwards it
  to a sink, compose the atomic/kernel transaction, and assert (a) the coordinator's published state carries the
  produced value, (b) the forwarded argument carries it, (c) BCH-2026 evaluates every input. `take job` should
  then be a re-run, not the debugging loop.
* Trace-gate lessons for whoever repeats the input-127 investigation (both cost a run this round):
  `SOLIDC_DEBUG_STACK_BODY_*` requires `instructionCount === SOLIDC_DEBUG_STACK_BODY_LENGTH`; the length gate now
  accepts `< 0` (patched, env-gated probe only) but `SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX` must always be paired
  with `SOLIDC_DEBUG_STACK_BODY_OPCODE` - leaving the opcode unset makes `signatureMatches` compare against `-1`
  and the trace never fires. `frameWindow.instructionCount` is the *outer* control-stack frame (1733 for input
  127), **not** the evaluated program's length, so it is not a usable gate either.

## UPDATE (round 26): the caller's own post-state is the lane that never changes

New measurements (same A/B, `SOLIDC_DEBUG_ATOMIC_PROMOTION=1` / `SOLIDC_DEBUG_ATOMIC_GRAPH=1`, logs
`/tmp/r33-diag.log`, `/tmp/r33-ab-off.log`, `/tmp/r33-ab-on.log`):

* `atomic-promotion` node dump for the 12-node `take job` graph: the `pay` node has **no
  `provisionalResultCommitment`** (`provisional None`) while `userRegistered` (1), `eventsLength` (2) and
  `getArbitratorFee` (100) all have one. So the root handler's own derivation has no seed for the pay result.
* `atomic-local-placement` for **participant 0** (`MarketplaceV1`) is byte-identical between OFF and ON: all 129
  local outputs, including every entry/value-chunk output that carries the root's post-state
  (`jobs[jobId].escrowId`, `jobs[jobId].state`, output 1's 207-byte DataNft commitment, outputs 63/64 chunk rails).
  Only participant 1 changed (JobEvent entry 145, collection root 132, chunk lane 211-213).
* The test's own later assertion is `expect(job.escrowId).to.equal(escrowId)` after
  `const job = await marketplace.jobs(jobId)`, i.e. the root's post-state must carry the escrow id as well.
* `compose.ts:2137` never calls a descriptor's `resolveArgsFromResults` for an invocation with `parent === null`
  (`siblingResults` is `undefined`, so the resolver is never invoked). The promoted root node is exactly such a
  descriptor (`parent: null`, created at `StatefulContract.ts:24655`). So the SDK has **no lane at all** that
  refreshes the caller's own state derivation with an authenticated producer result - the only existing lane is
  the legacy builder-level refresher at `:33099+`, which iterates `preparedAtomicNodeByExternalGroup` and only
  handles nodes that carry `refreshArgsFromResults` (attached exclusively by the nested path at `:27183`).

Conclusion: the resolver landed this round fixed the *callee-side* artefacts (JobEvent row vector, entry, chunk
lane, emissions witness - all measured carrying `...0001`), but the *caller's* post-state (`jobs[...]`) is still
derived from the pre-result plan, while the compiled root program derives it from the pay result it reads at
runtime. That is the mismatch behind `input 127: Program failed an OP_VERIFY operation` (`ip 514`, right after the
`ip 513 OP_EQUALVERIFY`).

Fix direction (general, not application-specific): give the promoted caller the same authenticated-result epoch
the callee rows get. Concretely, one of:

1. seed the producer node with the authenticated result the graph already has (`provisionalResultCommitment` for
   `pay` is missing even though the composer's trace authenticates it), so the builder-level derivation
   (`_deriveFullTransactionState` / `__derivedState`, the path the root's state goes through) sees the same value
   the rows do; or
2. attach a result refresher to the root/promoted node and invoke it from the composer for parent-null
   invocations as well (today `compose.ts:2137` short-circuits them), re-running the caller's write derivation in
   the refreshed epoch.

Either way the acceptance check is cheap: participant 0's local placement must change in the same way participant
1's did (the `jobs` entry carrying `escrowId`), and only then can `input 127` preflight be expected to pass.

## UPDATE (round 25): the round-24 resolver is IMPLEMENTED and works; the failure moved into the program's own derivation

Landed in the working tree (`StatefulContract.ts`, uncommitted, SDK built):

1. `resolveGraphNestedReturns(results)` at `:24953` - one authenticated result epoch per callsite (the
   `externalReturnsForCallsites(...)` map plus the caller arguments it re-resolves). `resolveGraphNestedArgs` is
   now `resolveGraphNestedReturns(results)?.nextArgs`, so nothing else changed for the single-node branch.
2. `replanChildRoute(resolved)` right after `childCompilerRoute` (`:24992`): re-runs `_buildRepeatedExternalBatch`
   with the same inputs **plus** the authenticated `externalReturns`.
3. The ROW branch (`:27023-27110`, `runtimeRows = childCompilerRoute?.rowArguments ?? directInvocationRows`)
   now attaches `resolveArgsFromResults: (results) => resolveRowArgsFromResults(row, results)`:
   * with a compiled batch route it re-plans and adopts the row matched by `selector` + `sourceCallsiteId` +
     `sourceLogicalIndex` + `occurrenceIndex`;
   * **without** one (this is the case that actually fires for `take job`, verified by probe: `hasReplan:false`
     for every `publishJobEvent`/`pay`/`eventsLength`/`getArbitratorFee` node) it re-resolves the reached
     occurrence's arguments from the same epoch, i.e. `_resolveExternalArgs(nestedSources, delegateVisibleArgs,
     ..., resolved.externalReturns, occurrenceIndex, ...)`, and returns `resolved.nextArgs` for occurrence 0.
4. Temporary A/B gate `SOLIDC_SKIP_ROW_RESULT_RESOLVER=1` disables all of (3) and reproduces the previous state
   exactly. Keep it while the defect below is open; remove it with the probes before the final commit.

### Verified effect (A/B, `-t 'take job$'`, same tree, only that env var differs)

The propagation itself is correct and complete on the SDK side. With the resolver ON, for the `take job` send:

* manifest row 11 (owner 0 -> consumer 1, selector `a826ee9c`, 57 B) now ends `...0001` instead of 32 zero bytes;
* the same 57-byte vector inside `verifier-batch-blob` (participant 1) ends `...0001`;
* the published JobEvent **entry** commitment changed (final output 145: `...0020<32 zero>` -> `...0020<31 zero>01`);
* the value-chunk lane changed: participant 1 transports 388 B / 3 chunks, `sha256(value)` `e5559480def4f047...`
  -> `c33dd5801ecebc74...`, and the three continuation outputs (211-213) changed lock
  `aa209fb7da6a861a67db912e...` -> `aa20d4989e4f1c5eae1b1836...`;
* the root participant's `__internal__graphEmissions` witness (input 127) carries the same `...0001` row vector;
* the SDK's published state is consistent too: output 132 (128 B collection root) carries
  `sha256(value)` `e5559480def4f047...` -> `c33dd5801ecebc74...`, output 145 (61 B) carries the row vector with
  `...0001`, and outputs 211-213 (the three continuation chunks) changed their covenant lock.

So the `escrowId == 0n` assertion is no longer the SDK's problem: every SDK-derived artefact (row vector in the
manifest, batch blob, emissions witness, entry commitments, collection root, value-chunk lane) now carries the
escrow id. What the compiled program rejects is therefore its own comparison, not a stale SDK value - which is why
the first thing the next session should do is identify the operands of the failing `OP_EQUALVERIFY` at input 127
(`ip 513`, error surfaces at `ip 514 OP_VERIFY`) rather than assume another stale lane.

### The new blocker (only with the resolver ON)

    Error: messageBus: BCH-2026 preflight failed at input 127: Program failed an OP_VERIFY operation.

Input 127 = `MarketplaceV1.__message_bus1` (the ROOT participant's composed aggregate route). Measured:

* failure `ip 514` = `OP_VERIFY`, immediately after `ip 513 OP_EQUALVERIFY`; `SOLIDC_DEBUG_FAILURE_POINT`'s
  `ipWindow` around it is `496 OP_PICK, 497 OP_3, 498 OP_OUTPUTBYTECODE, 499 OP_OUTPUTTOKENCOMMITMENT,
  500 push 0x20, 501 OP_SPLIT, 502 OP_DROP, 503 push 0x15, 504 OP_PICK, 505 OP_16, 506 OP_PICK, 507 OP_2,
  508 OP_PICK, 509 OP_1, 510 OP_1ADD-ish, 511 push 0x13, 512 OP_PICK, 513 OP_EQUALVERIFY, 514 OP_VERIFY` -
  i.e. inside the compiler's chunk/output covenant region, not the test's assertion.
* the stack at failure ends `... 84:35:aa2068ab0d...87, 85:35:aa20e61fa6...87, 86:35:aa200865f9...87,
  89:1:01, 90:32:3dd604beef890f21a13c881952407d7f7266a824fd7bafb613a0f00ae4c0d7c6` (participant covenants
  plus one 32-byte digest). The compared item is picked 19 deep and is an empty value, which is consistent with
  a frame/operand mismatch rather than a plain value inequality.
* with the resolver OFF the same composition passes preflight and dies later at `expected 0n to not deeply equal 0n`
  (test line 1993). So the program accepts the pre-result value and rejects the authenticated one.

Working hypothesis (not yet proven): the program's own derivation of the `jobEvents` post-state still evaluates the
row's `JobEventData.data_` from a lane that is **not** the refreshed one - the emissions witness and the entry
outputs were updated, but the program's re-encoded aggregate value (or the frame built from it) still corresponds
to the pre-result vector `e5559480def4f047...`. The program's `producerResult{callsiteId:7}` is SDK-evaluated
metadata (`MarketplaceV1.takeJob.externalCalls[8].argSources[1]` = `JobEventData(uint8 1, msgSender,
abiEncodePacked(producerResult(7,0)), 0)`), so whatever the program reads for it must be a value the SDK placed
into a witness.

### Next experiments (cheapest first)

1. **Leading candidate**: the caller's own state writes. The row arguments (JobEventData) come from the SDK's
   `argSources` resolver, but `this.jobs[jobId].escrowId = pay(...)` is a *store write* inside the root handler and
   is derived by the SDK's own state derivation, which the round-22 note already flags: the root/direct path at
   `:22753` calls `_buildRepeatedExternalBatch` **without** `externalReturns`, and the root node is the one whose
   derivation still sees the pre-result value. Check output 145 (61 B, the JobEvent vector) against the `jobs`
   entry output in the same admitted builder (probe prints outputs 120-230; widen it): if the JobEvent vector is
   `...0001` while the `jobs` entry still encodes `escrowId = 0`, the compiled program (which re-derives the row
   vector from `__internal__graphEmissions`, measured `...0001`) is right and the SDK's own write is stale. The
   general fix is then to run the caller's write derivation in the same authenticated result epoch - i.e. attach
   the result refresher to the root/promoted node too, not only to the row nodes.
2. Dump the final transaction's outputs 300-330 (Unicrow participant, base 304) plus each prepared call's
   `provisionalResultCommitment` and check whether the **pay return event commitment** really encodes the escrow
   id; the program may be reading a return lane that still holds 0.
3. Compare `__internal__graphEmissions` (input 127, 997 B) field-by-field between OFF and ON: the row vector is
   updated, but check the *leading push* / per-row framing the program re-encodes from it.
4. Probe the row-branch refreshers: `resolveValueChunkProductionsFromArgs` in the row branch (`:27090-27106`)
   **discards** the `internalArgs` that `refreshChunkableRouteWitnesses` returns (the single-node branch at
   `:27178-27191` does too, while `refreshArgsFromResults` at `:27172-27195` applies them to
   `logicalGroup.internalArgs`). Note the composer (`compose.ts`, `graph.ts`) never reads `internalArgs`, so this
   is only relevant if the promoted path reaches the legacy group.

### Probes added this round (all env-gated, default off)

* `SOLIDC_DEBUG_ATOMIC_PUSH=1` - `atomic-node-push` per push site (`SINGLE` row branch, `SINGLE` else branch,
  `LATE`) with `hasSources`/`hasReturns`/`hasReplan`/`hasResolver`.
* `SOLIDC_DEBUG_FINAL_OUTPUTS=1` - `message-bus-final-outputs` for outputs 120-230 of the admitted builder.
* `SOLIDC_DEBUG_ATOMIC_GRAPH=1` - `atomic-production-digests` / `atomic-production-output-hits` before preflight.
* `SOLIDC_SKIP_ROW_RESULT_RESOLVER=1` - A/B off switch for the new resolver.

## UPDATE (round 24): the row branch simply omits the resolver its sibling branch attaches

The two branches that create nodes from a composed child route differ in exactly one line:

* `:27003` (rows of the callee route, `runtimeRows = childCompilerRoute?.rowArguments ?? directInvocationRows`)
  attaches only `refreshRouteDerivedArguments` - NO `resolveArgsFromResults`;
* `:27886-27912` (single composed node) attaches `resolveArgsFromResults: resolveGraphChildArgs`.

`resolveGraphChildArgs` is built at `:27394-27412` from `graphChildSources` + `parentFn.externalCalls` +
`parentFn.resultConsumers` + `graphParentArgs`/`parentState`/`parentOutgoingSelfAddress`, i.e. from the CALLER's
context - all of which is in scope in that region. The row branch can therefore attach the same resolver, but it
must map the corrected CALL args onto the ROW's args: the rows come from a `childCompilerRoute` built earlier
(`:24972` and its scope ends around `:25150`), so the construction inputs (`delegateVisibleArgs`,
`delegateVisibleInputs`, `calleeRouteArtifact`, `delegateSelfAddress`, `delegateCallerIdentity`,
`onChainState.state`) are NOT in scope at `:27003`. Implementation shape that avoids that scope problem:
capture `replanChildRoute(nextCallArgs) = this._buildRepeatedExternalBatch(<same inputs as the original build>,
nextCallArgs, ..., externalReturns)` at the construction site, thread it to `:27003`, and have the row resolver
call it and return the args of the row with the same `selector` + `sourceCallsiteId` + `sourceLogicalIndex` +
`occurrenceIndex`. Verify with `SOLIDC_DEBUG_RESULT_PROPAGATION=1`: the `publishJobEvent` descriptor must flip to
`hasResolver: true` and `SOLIDC_DEBUG_GRAPH_EMISSIONS=1` must show the escrow id (non-zero) in its row args.

## UPDATE (round 22): the row-args re-plan is already supported by `_buildRepeatedExternalBatch`

Verified by reading the builder (`StatefulContract.ts:35301-35339`): `_buildRepeatedExternalBatch(externalCall,
functionArgs, externalContract, callerArtifact, callerState, calleeRouteArtifact, callerInputs,
callerStateIncludesPriorWrites, callerSelfAddress, externalReturns, callerIdentity, producerPathForRow)` ALREADY
takes `externalReturns?: ReadonlyMap<string, FunctionArgument>` and returns `rowArguments` with stable row
identities (`selector`, `sourceCallsiteId`, `sourceLogicalIndex`, `occurrenceIndex`, `sourceEffectOrdinal`).

So the fix at the row-node push (`:27003`) is a re-plan, not a substitution:

1. capture the inputs already in scope (`ec`/nested external call, `args`, `this.inner.artifact`,
   `callerStateSnapshot ?? onChainState.state`, `abiFunction?.inputs`, `publicSelfAddress`/identity);
2. build `externalReturns` from the authenticated sibling results with
   `externalReturnsForCallsites(ec.argSources, results, abiFunction.externalCalls,
   { callsiteId: ec.callsiteId, resultConsumers: abiFunction.resultConsumers })`;
3. re-run `_buildRepeatedExternalBatch(...)` with those `externalReturns` (and the re-resolved call args from
   `_resolveExternalArgs`) and return the args of the SAME row, matched by `selector` + the row identity fields;
4. attach the result as the row node's `resolveArgsFromResults`, keeping `refreshRouteDerivedArguments`
   (`refreshChunkableRouteWitnesses`) so the value-chunk productions follow the new args.

Note the root/direct path at `:22753` calls `_buildRepeatedExternalBatch` WITHOUT `externalReturns` (the delegate
path at `:24955` passes it), which is why the root participant's rows are the ones that keep zero-valued
result-dependent arguments. Round 20's blind `args[argument] = value` substitution must not be retried: it
corrupted the argument vector and `encodeLeadingRouteArrayPushes` raised
`Cannot evaluate compiler-authenticated stored element for 'jobEvents'`.

## UPDATE (round 19): implementation plan for the row-descriptor resolver (no code change this round)

Confirmed by reading the metadata paths (no run needed):

* `plan.invocations[]` carry both `consumerCallsiteId` and `sourceCallsiteId` (`graph.ts:72,127,2181,2250-2289`),
  and `propagateResultDependentArguments` already builds `resultsByParent` keyed by `consumerCallsiteId`
  (`compose.ts:2112-2131`), so the producer value for a callsite is already available there.
* The recipe lives on the CALLER's ABI entry (`artifact.abi[].resultConsumers`, e.g. `MarketplaceV1.takeJob`),
  whose entries are `{consumerCallsiteId, argument?, condition?, producerCallsiteId, resultIndex}`.
* `plan.invocations[index].parent` names the caller invocation, so the recipe owner is reachable as
  `plan.participants[plan.invocations[parent].callee].artifact.abi` matched by
  `selectorHex`/`function` - the same lookup the composer already performs for `descriptor.artifact.messageBus
  ?.handlers`.

Planned edit (single site): in `compose.ts`'s `propagateResultDependentArguments`, next to
`const resolved = siblingResults && descriptor.resolveArgsFromResults?.(siblingResults);` (`compose.ts:2139`),
build a fallback resolver for descriptors that have none:

1. take `parentIndex = plan.invocations[index].parent`; if absent, skip;
2. look up the parent invocation's artifact ABI entry by selector (fall back to name) and read
   `resultConsumers`;
3. keep the bindings with `consumerCallsiteId === invocation.consumerCallsiteId && argument !== undefined`;
4. the resolver copies `siblings.get(producerCallsiteId)` into `args[argument]` (using the `resultIndex` when the
   producer returns a vector) and returns `undefined` when nothing changed, so the existing fixed point
   (`propagated` flag + `resultPropagationDepth` guard) re-runs assembly exactly as it does for nested calls.

Then: `npx tsc -p tsconfig.build.json` (solidcash only - no compiler change), run `-t 'take job'`, and expect the
`JobEventData.data_` word in the `publishJobEvent` row args to become the `pay` escrow id (`SOLIDC_DEBUG_GRAPH_
EMISSIONS=1` shows the row args, `SOLIDC_DEBUG_RESULT_PROPAGATION=1` shows the propagation).

## UPDATE (round 18): route-row descriptors have NO result resolver at all

New env-gated probe `atomic-result-descriptor` (in `propagateResultDependentArguments`, `compose.ts`, same
`SOLIDC_DEBUG_RESULT_PROPAGATION` gate) prints every invocation descriptor. For the `takeJob` composition:

    publishJobEvent  hasResolver: false   siblingCallsites: [0, 1, 3, 6, 7]
    pay              hasResolver: false   siblingCallsites: [0, 1, 3, 6, 7]
    eventsLength     hasResolver: false   ...
    getArbitratorFee hasResolver: false   ...
    balanceOf/transferFrom/setArbitrator  hasResolver: true   (the NESTED calls only)

So the route ROW descriptors never receive `resolveArgsFromResults`: only the nested/delegate composition paths at
`StatefulContract.ts:27400-27412` (`resolveGraphChildArgs`) and `:24953-24968` (`resolveGraphNestedArgs`) attach it,
and the outer route rows (Marketplace -> MarketplaceData `publishJobEvent`, which must consume the `pay` result)
are built elsewhere. That is why the `JobEventData.data_` word stays zero even though the artifact publishes the
recipe (`MarketplaceV1.takeJob.resultConsumers` = `6 -> 7(argument 3) -> 8(argument 1)`) and the graph result for
`pay` is correct (`…0001`).

**Round-19 fix direction:** attach the same resolver to the route-row descriptors, using the recipe from the ROW
HANDLER that owns the callsite (`messageBusRowArguments[].handler.resultConsumers`, reachable exactly where the row
descriptors/nodes are produced), and let the existing `propagateResultDependentArguments` fixed point rewrite the
consumer args. This is the same "later passes consume authenticated producer-result metadata" invariant the other
session's compose patch already follows for events.

## UPDATE (round 17): the `data_ = 0` blocker is the CALL-RESULT -> sibling-ARGUMENT plumbing for a route row

Measured (light probes only):

* `SOLIDC_DEBUG_GRAPH_RESULTS=1`: the `pay` invocation's authenticated result IS correct -
  `row 6 pay owner 0 consumer 3 resultHex …0001` (the escrow id), so the callee result is fine.
* `SOLIDC_DEBUG_GRAPH_EMISSIONS=1` (`verifier-manifest-row`): the `publishJobEvent` row's arguments (57 B) END
  WITH 32 ZERO BYTES - the `JobEventData.data_` word - so the consumer argument was built before the producer
  result was known and was never refreshed.
* `SOLIDC_DEBUG_RESULT_PROPAGATION=1` (`atomic-result-argument-resolution`): the propagation probe fires only for
  `balanceOf` / `transferFrom` / `setArbitrator`, NEVER for `publishJobEvent` - i.e. that descriptor has no
  `resolveArgsFromResults` (or no sibling results), so `propagateResultDependentArguments` cannot rewrite its args.
* The recipe does exist in the artifact: `MarketplaceV1.takeJob.resultConsumers` =
  `[{consumer 2, argument 1, producer 1}, {consumer 4, condition, producer 3}, {consumer 5, condition, producer 3},
    {consumer 7, argument 3, producer 6}, {consumer 8, argument 1, producer 7}]` - the chain 6 (pay) -> 7 (arg 3)
  -> 8 (arg 1) that carries the escrow id into the job event.

Wiring to inspect next: `externalReturnsForCallsites(..., { callsiteId, resultConsumers: parentFn.resultConsumers })`
at `StatefulContract.ts:27400-27412` (child/delegate calls) and `:24953-24968` (nested calls), with `parentFn`
resolved BY NAME from the parent artifact ABI at `:27321`. For a kernel row-loop route the parent that owns the
callsite is the concrete ROW HANDLER (which carries `resultConsumers`), not the synthesized route entry, so the
lookup probably yields no recipe and the resolver is never attached. Fix = take the recipe from the row handler
that owns this callsite (available through `messageBusRowArguments[].handler`), generally for every parent shape.

## UPDATE (round 16): `predOut` sentinel fixed - both `take job` titles now pass PREFLIGHT and reach the test's
## own assertions

After round 15's compiler frame fix the failure moved to
`input 304: Program attempted to read from an invalid transaction output index. Transaction output count: 469;
requested index: -1.` The failing window was `OP_PICK/OP_CAT/OP_SWAP/OP_OUTPUTTOKENCOMMITMENT/OP_EQUALVERIFY`
(the batch-row/witness verification), and the stack held the escrows target key `4bf5122f…` plus `next` = 0 - i.e.
the program was reading the **predecessor witness coordinate** (`predOut`) that the SDK passed as the round-9
sentinel `-1`.

Fix (SDK, `StatefulContract.ts`, batch planning): for the single-target-row batch `predOut` now names the
coordinate where that predecessor is actually published - the entry coordinate of the lane whose co-spent NFT *is*
the proof entry:

```ts
const proofOwner = entryNfts.find((candidate) => candidate.utxo !== undefined && proof.utxo !== undefined
  && candidate.utxo.txid === proof.utxo.txid && candidate.utxo.vout === proof.utxo.vout);
const proofOwnerOffset = proofOwner === undefined ? undefined
  : entryAbiFunction!.blockLayout?.slots.find((candidate) =>
    candidate.kind === 'entry' && candidate.slotIndex === proofOwner.slotIndex)?.offset;
const predOut = predOrdinal < 0 || !firstLinearPred ? -1n
  : singleTargetRowBatch
    ? proofOwnerOffset === undefined ? -1n : BigInt((overrides?.blockBase ?? 0) + proofOwnerOffset)
    : BigInt(batchPredOutputBase + predOrdinal);
```

A single-row batch has no trailing predecessor lane, so `-1` was never a readable coordinate there; the
predecessor is republished at its own entry slot (measured: the head rewrite `0000…‖4bf5122f…` at local offset 4,
absolute 308) and that is what the witness must name.

**Verified** (SDK rebuilt with `npx tsc -p tsconfig.build.json`, all marketplace sources recompiled with the
round-15 compiler):

    ✓ take job > sanity checks                     (unchanged, still green)
    × take job > take job       37167ms  -> AssertionError: expected 0n to not deeply equal 0n
    × take job > take job multiple       -> AssertionError: expected not to emit 'JobEvent'

Both red titles now pass the whole composed preflight (no VM failure) and fail only inside the test's own
assertions - the first time this session that the marketplace test's own expectations are reached.

**Round-17 next steps:** (a) `take job` line 1993: the second `JobEvent` (`type_ = Taken`) carries `data_ = 0`; the
test expects the escrow id returned by `IUnicrow(…).pay(…)`, so the `pay` call's RESULT is not reaching the
MarketplaceData `jobEvents` write (graph result / computed-argument plumbing, `row.resultHex`/`provisionalResults`
in `compose.ts`); (b) `take job multiple`: an unexpected `JobEvent` is emitted (`expected not to emit`), i.e. an
event claim/relocation is over-eager for a call that must not emit - check the round-15 frame fix and the existing
compose event-relocation patch together.

## UPDATE (round 15): COMPILER FIX LANDED - stale `graphEffectFrame` offsets (event pin read the wrong slot)

Root cause of the round-13/14 event coordinate drift, found and fixed in `SymbolTableTraversal.ts`:

* `shareRouteLayoutWithLoopEntryHandlers` APPENDS extra entry lanes contributed by the loop-entry handlers and
  then recomputes `route.blockLayout = this.computeBlockLayout(route)` - but it never refreshed
  `route.graphEffectFrame`'s cached offsets. Codegen addresses effect sites through those offsets
  (`emitLoopRowEffectSlotIndex` / `emitGraphEffectSlotIndex`: `frame.eventOffset`), so for Unicrow the compiled
  program kept addressing the event frame at the pre-append offset **6** while the published layout (and therefore
  the SDK) puts events at **7..14** - the program read the third entry lane's output, whose commitment the SDK had
  not materialized, and rejected its own event.
* Fix: new `refreshGraphEffectFrameOffsets(frame, route)` helper (extracted from the existing inline block),
  called after that recompute as well; a kind the refreshed layout does not carry KEEPS its cached offset (a shared
  frame must not lose an offset that was valid when it was built - an unconditional overwrite produced
  `requested index: -1` in the next run).

Verified after `tsc -p tsconfig.build.json` (solidc) + `--iteration` recompiles of Unicrow, MarketplaceV1/V2/V3,
MarketplaceDataV1, FakeToken, EACCToken, UnicrowArbitrator/Dispute/Claim, TreasurySplit:

* `messageBus.route.graphEffectFrame.eventOffset` is now **7** (was 6) and matches the layout's first event slot;
* the Unicrow participant's local output 7 (absolute **311**) now carries the event covenant lock
  (`aa20aef2c7302943…`, capability none) with the **235-byte `Pay` payload commitment** `51045ffb5565…` - i.e. the
  program's event check and the composed assembly now agree;
* the focused failure MOVED: `take job > take job` no longer stops at `ip 1240`; it now stops at
  `input 304: Program attempted to read from an invalid transaction output index. Transaction output count: 469;
  requested index: -1.` (failure-point record: body `ic 5214`, fp `ip 5234`, opcode 116 = `OP_DEPTH`, control
  stack `[{ip: 875, ic: 875}, true, true]`).

**Round-16 next step:** the `-1` is a *later* check reading an effect site the concrete layout does not carry -
codegen falls back to `getBlockSlotOffset(kind, base)`, which returns `-1` for a missing slot. Dump that body's
window/stack with the light flags (`SOLIDC_DEBUG_STACK_BODY_LENGTH=5214 SOLIDC_DEBUG_STACK_BODY_FROM=5180
SOLIDC_DEBUG_STACK_BODY_TO=5250`, plus `SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX` if needed; avoid
`SOLIDC_DEBUG_FAILURE_RING`, which perturbs timing enough to resurrect the assembly flake), identify the effect
kind, and either publish the site (SDK) or reconcile the frame (compiler).

## UPDATE (round 14 follow-up): the unmaterialized coordinate is the THIRD `escrows` LANE (local offset 6)

New probe `SOLIDC_DEBUG_ENTRY_PLACEMENT=1` (temporary, in `_createBuilder` next to the builder construction)
prints, per build, the layout entry slots, the runtime `entryAccesses`, the entry NFTs and the batch target
placeholders. For the Unicrow participant (`__message_bus1`, block base 304):

    layout   ['4:0','5:1','6:2']
    accesses ['0:escrows','1:escrows','2:escrows']        (artifact: slot 2 is WRITE-ONLY, alias prior [0,1],
                                                           valueSource `call:Escrow(...)`)
    nfts     ['0:escrows:present','1:escrows:absent','2:escrows:absent']
    targets  ['0:4bf5122f344554c5']                        (the single target lane, published trailing)

and the participant's own local placement (`SOLIDC_DEBUG_ATOMIC_GRAPH=1`, `atomic-local-placement`) is:

    4  = entry, 64 B `0000…‖4bf5122f…`   (P′ head rewrite, correct)
    5  = bare `51` placeholder           <-- second escrows lane, unmaterialized
    6  = bare `51` placeholder           <-- THIRD escrows lane, unmaterialized  (the program reads this one)
    7  = event covenant lock, EMPTY commitment; 8..14 bare placeholders (the reserved event frame)
    16 = escrows TARGET (128 B, round-11 fix), 17/18 = value chunks, 80 = participant tail

The round-13 read trace (`otc-read idx=310 ip=1239/1305`, then `eq ip=1240 top=0 below=470 hex`) is therefore the
covenant verifying the THIRD lane's entry output, whose expected commitment the program computes itself (235 B -
a legal BCH-2026 commitment size, and *not* a vmap node) and which is adjacent to the read, i.e. already the TIGHT
`<expected> <index> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY` shape that `extractCommitmentMapFromTrace` and the
entry derivation understand. Nothing about this lane reaches the graph (no resource row in the manifest), which is
why the composed assembly leaves a plain placeholder.

**Round-15 outcome:** superseded - the disagreement was a stale compiler frame offset, fixed in round 15 (see the
top section); the artifact itself published the disagreement. For this route
(`messageBus.route`):

    graphEffectFrame = { sites: 8, eventBase: 0, eventWidth: 1, eventOffset: 6, ... }
    blockLayout      = master 0 | dataNft 1-3 | entries 4,5,6 | events 7,8,9,10,11,12,13,14 | returnEvent 15 | trailing 16+

The program's event pin reads **offset 6** (its own `graphEffectFrame.eventOffset`), while the SDK - correctly
following `blockLayout` - reserves events at **7..14** and puts the event covenant at 7. Both cannot be right:
the program's other reads (data NFTs 305-307 = offsets 1-3, escrows target 320 = offset 16, value chunks 321/322 =
offsets 17/18) all agree with `blockLayout`, so the event site is the single drifting coordinate. Either the
compiler must address the event pin at the layout's event base (7) - the likely general fix, in the same family as
the round-4/round-10 entry-frame offset reconciliations in `GenerateTargetTraversal.ts` - or the SDK must place the
event frame at `graphEffectFrame.eventOffset`. `compose.ts` already reads `graphEffectFrame` for
`eventLockingBytecodeAtOffset`, so the frame metadata is the natural authority to reconcile against.
Evidence trail: `otc-read idx=310 ip=1239/1305` + `eq ip=1240 top=0 below=470 hex` (the 235-byte payload is the
route's computed `Pay` payload, built by CATs from the `pay` row arguments visible as the 243-byte stack item 50),
and the placement dump above.

**Round-15b (entry lanes):** still open. Lanes 1/2 of the `escrows` batch (offsets 5 and 6) are bare `51`
placeholders in the participant's own placement, so any check the covenant performs on those coordinates fails. Materializing them (same `slot ‖ next` seed path that lane 0 uses, note
`runtimeAliasPriorSlots: [0,1]` says all three share one predecessor) is the second half of the fix.

## UPDATE (round 13): the `ip 1240` compare is a TIGHT entry-output check at absolute output 310 (local offset 6)

Measured with a temporary trace probe inside `_messageBusEventCommitmentsFromTransaction` (helper already
evaluates the participant's program), the failing input 304 program reads, in order:

    otc-read idx=304 ip=156/330     otc-read idx=466 ip=293/330
    otc-read idx=321 ip=928/1305    otc-read idx=322 ip=928/1305
    otc-read idx=308 ip=1028/1305   otc-read idx=320 ip=1059/1305      (data NFT, escrows TARGET)
    otc-read idx=310 ip=1239/1305   <-- immediately followed by the equality
    eq       ip=1240/1305 depth=75  top=0 bytes   below=470 hex (235 bytes)

So the failing check reads **output 310** = participant base 304 + **local offset 6** and compares it against a
235-byte handler-computed payload. Per `messageBus.route.blockLayout` the Unicrow block is master 0, dataNft 1-3,
entries 4/5/6, events 7-14, returnEvent 15, trailing 16+ - so offset 6 is the third **entry** (route
`entryAccesses` slot 2, the write-only `escrowArbitrator` collection), not an event. In the failing transaction
that output is a bare `51` placeholder (no token, no commitment), so the read yields empty and the covenant
rejects its own value.

Consequences for the fix:
1. The SDK never materializes that entry output for the composed participant (no seed, no placeholder, no derived
   commitment), so the route's own entry check fails *and* the graph never sees the write.
2. The read/compare pattern is already the TIGHT one (`<expected> <index> OP_OUTPUTTOKENCOMMITMENT
   OP_EQUALVERIFY`), so `extractCommitmentMapFromTrace` / the entry derivation can learn it as soon as the output
   exists in the probe transaction - the missing piece is placing/seeding that entry coordinate at all
   (`batchTargetPlaceholders` / `sortedInserts` / `entryRawCommitments` never covered slot 2; round 11-12
   registered only pending VALUE TAILS and completed only the trailing lane).
3. The round-11 experiment that DID rewrite the entry placeholder was reverted because it shifted a later upgrade
   transaction's participant span; the fix therefore has to place the entry with its *own* seed first (a
   `slot || next` node plus its derived commitment), not by rewriting an existing placeholder.

Two speculative round-13 changes were measured and **reverted** (tree is back to the round-12 state, focused test
still deterministic at input 304): collecting route-row handler emits into `emitInfos` (it does make the builder
place event-covenant outputs, verified by probe, but is inert for this failure because the composed assembly
rebuilds the participant's outputs and the graph has no kind-2 row), and a deferred (non-adjacent)
event-commitment extractor. Both belong to the *event* path, which is not this blocker.

## UPDATE (round 12): input 304 is now DETERMINISTIC, and the `ip 1240` blocker is identified as the
## chunkable-value WITNESS check

### 1. The flaky `balanced assembly` failure was caused by the round-11 entry-placeholder rewrite - removed

`completePendingEntryValueTail` originally also rewrote the in-block ENTRY placeholder
(`entryRawCommitments[slotIndex]`) when it still held the seed. That made ~all runs die in a *small* (12-19
input) `__forward` + `initialize` send long before the takeJob composition, with

    balanced assembly: participant region ends at 17, but 2 verifier slots plus fee require tail start 16

Measured with `SOLIDC_DEBUG_BLOCK_ASSEMBLY=1`: the failing transaction had masters at 0 (`__forward`,
blockSize 3) and 3 (`initialize`, blockSize 14), 19 inputs and **zero** `MessageBusVerifier_*` inputs, while the
passing runs' compositions (308 / 469 inputs) carry one verifier per participant
(`verifiers=[304,305,306]` resp. `[463,464,465,466,467]`). With the entry rewrite removed (the lane rewrite is
kept - it is the fix that makes `ip 1060` pass) the focused test now fails **deterministically at input 304**
(6+ consecutive runs, no env gate). Note `SOLIDC_DEBUG_FAILURE_RING=1` still perturbs the timing enough to
re-trip the assembly error occasionally, so use `SOLIDC_DEBUG_FAILURE_POINT=1` for traces instead.

### 2. `ip 1240` identified: the ROUTE'S FIXED EVENT OUTPUTS are not materialized at all

`SOLIDC_DEBUG_FAILURE_POINT=1` (probe `message-bus-failure-point`) gives the failing stack with absolute indices
(highest = top) and the instruction window, and `SOLIDC_DEBUG_FAILURE_POINT_FULL=1` gives every output. Together:

* failing input: 304, `functionName: __message_bus1`, selector `53434231` ("SCB1" route entry), ip `1240`
  (`OP_EQUALVERIFY`), stack `[71] = 0 bytes (EMPTY)` vs `[72] = 235 bytes (TOP, program-computed)`:
  `51045ffb5565 23aa204c40...(35) bafcb055d0392487 0135011b5100 1976a91447d9fe52...88ac 045ffb5565
   140000000000000000000000000000000000beef 028b 07 04574d5765 23aa20e61f...(35) ... 102700 8b
   07 00 45000000 26 454143432023... (38-byte EACC token name) 1976a914c4ad89cd...88ac 0164` -
  exactly the `Pay(uint256,uint256,Escrow,address,uint256,uint256)` event payload (`pay` handler
  `emits: [{eventName: 'Pay', emitIndex: 0}]`), i.e. **the route's event commitment check**;
* the route arguments at that input are otherwise complete (`graphEmissions 463B`, `graphCallers 37B`,
  `graphSettlementTable 205B`, batch slots/proofs/next/predOut), and `__internal__valueWitness_0/1` and
  `__internal__leadingPushValue_0/1` are all 0 B - legitimately: the `escrows` slot 0 proof entry is the
  zero-key head (`chunkable-read-witness`: `present: false`, `proofSlot: 0000...`, `tailBytes: 0`,
  `witnessBytes: 0`), so the empty witness is correct and the witness is NOT this blocker (an experimental
  precedence change for empty seeds was reverted unverified);
* the Unicrow participant block (base 304) in the failing transaction has outputs 309-318 with locking bytecode
  `51` (a bare `OP_1` placeholder) and no token at all - the entire **event frame (layout offsets 7..14 =
  outputs 311..318) is unmaterialized**, while 320/321/322 carry the fixed escrows target (128 B, the round-11
  fix) and its two value chunks. The covenant reads the event slot's commitment (empty, no token) and rejects it
  against the 235-byte `Pay` payload.

**Round-13 fix direction (general):** for a kernel message-bus route, map the route ROWS' handler emits
(`messageBusRowArguments[].handler.emits` / `messageBus.handlers[].emits`, with their `emitIndex`) onto the
route's fixed event slots from `messageBus.route.blockLayout` (kind `event`), materialize those event NFT
outputs, and derive each reached commitment from the VM trace (the program computes it; the existing
`extractCommitmentMapFromTrace`/`extractExpectedOutputCommitmentFromTrace` machinery already used for external
call events at `StatefulContract.ts:14385-14480` and for fixed emits at `:17026-17071` is the model). Today the
SDK only assembles `emitInfos` from `abiFunction?.emits` plus delegate-call groups
(`StatefulContract.ts:30114-30130`), so a route whose emits live on its row handlers publishes placeholders.

**Traps confirmed this round:** the entry-placeholder rewrite must stay out (it shifts a later upgrade
transaction's participant span); `SOLIDC_DEBUG_FAILURE_RING` perturbs timing enough to resurrect the assembly
flake; the takeJob composition in a *passing* run is 469 inputs with Unicrow at input 304 (`__message_bus1`,
blockSize 81), MarketplaceDataV1 at 214, FakeToken at 216, verifiers at 463-467, and its deployment
compositions are 308 inputs with verifiers at 304-306.

## UPDATE (round 11): batch TARGET value tail FIXED (ip 1060 passes); next blocker is `ip 1240` in the
## synthesized message-bus verifier body

**Applied and verified (uncommitted, 4th coherent fix): the batch target's value tail is completed from the value
the covenant itself authenticates.** New plumbing:

* `StatefulTransactionBuilder.registerPendingEntryValueTail({slotIndex, collection, slot, seed, next, chunkable})`
  + `completePendingEntryValueTail(collection, slot, value)` - rewrites only a commitment that is still equal to
  the published seed (loop-entry lane by index, and the entry placeholder by slot index), returning whether
  anything changed so the caller can re-probe.
* `StatefulContract._createBuilder` batch planning (`~19664`): when `resolvedWholeValue === undefined` the lane is
  pushed into `pendingEntryValueTails` (seed = `out.commitment`, `next` = its successor link, `chunkable` = the
  collection flag) and registered on the builder after it exists (`~31340`). A compiler-authenticated
  `transportedProductions` entry for that exact `(collection, write.keySlot)` completes it immediately when the
  atomic graph carries one (measured: `jobEvents`, 233/388 B values, entry placeholder path).
* `_deriveFullTransactionState` value-chunk run (`~16876`): the trace-authenticated value `matched` (whose
  value-chunk address the covenant itself builds) now ALSO completes the registered target
  (`stb.completePendingEntryValueTail(vcv.collection, vcv.slot, matched)`, `commitmentProgress += 1`).

**Verified with probes** (`SOLIDC_DEBUG_PENDING_VALUE_TAIL=1` + `SOLIDC_DEBUG_FAILURE_RING=1`): for
`escrows` (`singleTargetRowBatch: true`, key `4bf5122f344554c5…`) the completion fires through the trace path with
`valueBytes: 197`, `lane: 0`, `commitmentBytes: 128`, tail `…0c8d49675c23ad10 23aa204c4025…`. The failing compare
at `ip 1060` (ic 1305) is now **equal on both sides**:

    left = right = 4bf5122f…451a ‖ 0(32) ‖ c5000000 ‖ 21d20f545e982358300b98d915fe69d9bf7579d7ae9b787e0c8d49675c23ad10 ‖ 23aa204c4025…

so the escrows INSERT target node is exactly what the covenant checks. `take job > sanity checks` still passes.

**New blocker (same test, same input 304, same program `ic 1305`): the failure moved later to `ip 1240`**
(`message-bus-large-equals`, last entry):

    left  (235 B): 51 045ffb5565 23aa204c40…(35) bafcb055d0392487 0135 011b 5100 1976a91447d9fe52…88ac
                   045ffb5565 14 0000…beef 028b 07 04574d5765 23aa20e61f…(35) 00 52000000 0100 00 54000000
                   102700 8b 07 00 45000000 26 454143432023…  1976a914c4ad89cd…88ac 0164 03f85101
    right (0 B):   <empty>

Facts measured about it:
* The operand is a **pushdata-serialized value** (1-byte push prefixes: `04`, `23`, `14`, `07`, `09`, `26`), not a
  manifest-framed blob (an emissions blob must start with a 2-byte LE length, so this is *not*
  `suppliedEmissions`).
* Its content mixes escrow fields (marketplace lock, `5ffb5565`, buyer P2PKH `47d9fe52…`), the EACC token name
  string `26 4541434320…` ("&EACC #…", 38 B), the arbitrator lock `aa20e61f…`, `102700` (=10000) and `0164`.
* `message-bus-output-bytecode-reads` for `ic 1305` shows: a full sweep of outputs 286…468 comparing each
  `OP_OUTPUTBYTECODE` against the value-chunk covenant lock `aa206e6b04baa172…` (ip 922/924), then the escrows
  target checks (ips 1014…1060), then ips 1087…1240 (large `OP_PICK`s of items whose heads are
  `045ffb5565`, `76a914c4ad89cd…`, `23aa204c4025…`, `51045ffb5565…`).
* Body identification: `messageBus.verifierProgram.functions` for Unicrow has `__message_bus_verify_atomic` =
  6243 instructions, the envelope entry body `53434231` = 6368 (`message-bus-input-reads` shows input 304 read at
  `ip 353` of `ic 6368`), and no artifact body has 1305 instructions - so `ic 1305` is a *synthesized* body
  (verifier/route sub-body), not directly present in an artifact.
* The SDK's per-participant graph context was measured with the new `verifier-route-context` probe: participant 3
  (the failing one, Unicrow, block base 304) gets `graphEmissions 463`, `graphCallers 37`,
  `graphCompletionPositions 2`, `graphSettlementTable 205`, `graphSizes 81` - all non-empty, so a *missing arg* on
  the SDK side is not yet proven; the empty operand may be a program-side expectation such as the compiler's
  `hex""` placeholders in `__invoke_message_bus_verifier_program` (compiler.ts:10616-10618).
* The compiler's `expectedEmissions` rule (compiler.ts:9915) is
  `kind == 0 && row > 0 && __message_bus_row_owner == activeParticipant` versus the SDK's
  `graphRouteContext` filter `row.kind === 0 && row.parent !== 0xffff && row.owner === participant`. For the
  `takeJob` composition participant 3 owns rows `balanceOf, transferFrom, balanceOf, setArbitrator` (463 B); the two
  `balanceOf` staticcall rows account for exactly 228 B, and 463 − 228 = **235 B**, which is the failing operand's
  length. The framing of that operand (1-byte pushes) does not match the compiler's `toPaddedBytes(len, 2)` concat,
  so verify the exact `require` before acting on this coincidence.

**Next steps for round 12**
0. Strongest lead, refined from the operand's *shape*: the 235-byte operand is **pushdata-serialized** (1-byte push
   prefixes `04/07/09/14/23/26/51`), so it is a *stored value / witness script*, not an ABI args blob (243 B for the
   `pay` row) and not a manifest blob (2-byte framing). The program compares it against an EMPTY operand, i.e. an
   SDK-supplied counterpart was empty. Prime candidates, in order:
   (a) `require(rowArguments == localBatch.slice(batchArgsStart, batchArgsStart + batchArgsLength))`
       (compiler.ts:9944) - then the SDK's **`localBatch`/batch blob for the failing participant has an
       empty/misaligned arguments region** (the batch blob is the "SCB1" payload; for input 304 it is 272 B and does
       start with `53434231 02 01 01 21567622 … f3(243)`, so check the *cursor* and per-row widths against the
       manifest's rows rather than assuming the args are absent);
   (b) an entry-NFT input's value witness script for the `escrows` write (the same root cause as the round-11 fix,
       one level down: the *input* side's witness was still built while the value was unresolved);
   (c) the compiler's `hex""` placeholders in `__invoke_message_bus_verifier_program` (compiler.ts:10616-10618)
       reaching a real invocation.
   To disambiguate cheaply, dump the SDK's `localBatch` (batch blob) hex next to the manifest rows for the failing
   participant and diff the row layouts, or add a temporary probe printing each entry NFT input's generated
   unlocking bytecode length (`unlocker.generateUnlockingBytecode(...)`) for the pending-tail slot.
1. Dump the executed body at the failure with the existing probe pair
   `SOLIDC_DEBUG_STACK_BODY_LENGTH=1305 SOLIDC_DEBUG_STACK_BODY_FROM=1180 SOLIDC_DEBUG_STACK_BODY_TO=1245` (plus
   `SOLIDC_DEBUG_STACK_BODY_OPCODE_INDEX` if the length alone selects the wrong body) and locate the comparison by
   its constants (e.g. `4c334331`, `4c3342555331`, the `4d` envelope check) inside the compiler's generated
   verifier/route templates (`compiler.ts` ~9280-10640).
2. Decide whether the missing/empty value must be supplied by the SDK (then fix the plumbing/arg name or the
   per-participant attachment) or whether the SDK must *exclude* rows the program excludes (staticcall rows) from a
   blob it currently over-fills - re-derive `expectedEmissions` for participant 3 by hand from the manifest
   (target lbc + mode + selector + framed args + framed result per stateful row) and compare byte-for-byte with the
   235-byte operand.
3. Flaky alternate failure to keep in mind (appears in ~1/3 of runs, seemingly when heavy probes slow the run):
   `balanced assembly: participant region ends at 17, but 2 verifier slots plus fee require tail start 16` (19-input
   composition). Check against a probe-free run whether it is mock-provider funding nondeterminism (extra input)
   rather than a consequence of the value-tail fix - it reproduced both with and without the entry-placeholder
   rewrite (`SOLIDC_SKIP_ENTRY_TAIL=1` A/B).
4. Temporary probes added this round (all env-gated; remove before handoff):
   `SOLIDC_DEBUG_PENDING_VALUE_TAIL`, `SOLIDC_DEBUG_GRAPH_EMISSIONS` (`graph-emissions`, `verifier-route-context`),
   `SOLIDC_DEBUG_BLOCK_ASSEMBLY` (`block-assembly-inputs`), plus the temporary A/B gate `SOLIDC_SKIP_ENTRY_TAIL`
   in `completePendingEntryValueTail`.

## UPDATE (round 9): single-source-row batch fix APPLIED and verified; only the target's value tail remains

Discriminator measured with the extended `vmap-batch-trailing-plan` probe (now also printing per batch: lane
target slots, handler-managed slots and the source rows feeding the collection):

    Unicrow  __message_bus1: escrows   slots [0,1] targetSlots [4bf5122f…, 4bf5122f…] rows: [pay]            (ONE row)
    FakeToken __message_bus1: _allowances slots [2,3] targetSlots [16c75ca3…, 16c75ca3…] rows: [approve, transferFrom] (TWO rows)

So "all lanes resolve to one target key" alone is not the criterion (round 8's regression), but **one source row
feeding every lane of the batch** is: that is the route's alias-arm shape, compiled as a single INSERT. The fix is
applied in `StatefulContract.ts` (batch planning loop):

* `batchSourceRows` = the route rows whose handler writes this batch's collection;
  `singleTargetRowBatch = predOutputs.length > 0 && batch.slotIndices.length > 1 && batchSourceRows.length === 1`;
* for such a batch `predOut = -1n` (predecessor verified in-block at its fixed entry coordinate);
* after the lane loop the shared trailing lane is published with the batch **target** commitment
  (`batchPredCommitments.set(collection, [target])`), keeping `batchTrailingCount = 1`.

**Verified:** participant 3 (Unicrow) local output 16 now holds the target node
(`4bf5122f…451a ‖ 0000…`, i.e. `slot ‖ next`) instead of the duplicated head rewrite, and the failure stays at
input 304 (no earlier-participant regression - the previously passing `sanity checks` and the rest of the family
are unaffected so far). The failing comparison at `ip 1060` is now:

    left  (program expects, 128 B): Hk32 ‖ 0(32) ‖ c5000000 ‖ 21d20f54…ad10 ‖ 23aa204c4025…   (slot ‖ next ‖ value tail)
    right (SDK placed,      64 B): Hk32 ‖ 0(32)                                          (slot ‖ next only)

**Remaining gap:** the SDK's target commitment carries no value tail, because `resolvedWholeValue` is undefined for
this row, so `targetCommitment = out.commitment` (the structural node from the list plan) instead of
`encodeEntryCommitment(slot, nextKey, encodeChunkableValueTail(value))`
(`StatefulContract.ts:19650-19659`; the value-source resolution chain is at `:19530-19648`:
`struct(...)`/`ternary(...)`/`arrset(...)`/`entryDelta`). Strong lead: the build already mints the escrow value
chunks for exactly this value (`17/18 = 0000bafcb0…`, `01004500…`, from the value-chunk plan /
`computedValueChunkRuns`), so the encoded tail is derivable inside the same build - complete the target tail from
that plan (or resolve the row's escrow struct) rather than from a new trace pass.

## UPDATE (round 8): the round-7 candidate change was tried and REVERTED - negative result

Applied (SDK, `StatefulContract.ts:19423-19438`, `:19668-19670`, `:19680-19688`): for a batch whose lanes all
resolve to one target key, force `predOut = -1n` (predecessor in-block) and publish the batch **target** into the
trailing lane (`batchPredCommitments.set(collection, [target])`), keeping `batchTrailingCount = 1`.

Result (focused `take job` title): **regression** - the failure moved *earlier*, to input 216 (FakeToken):
`Program attempted to read from an invalid transaction output index. Transaction output count: 469; requested
index: -1.` So at least one batch in the FakeToken build that also has all lanes on one target key genuinely
expects `predOut >= 0` (a trailing predecessor). The change was reverted in full and the baseline re-verified:
`singleTargetBatch` no longer exists in the tree and the title is back to failing at input 304 with the OP_VERIFY
reported in round 5.

Conclusion: "every lane resolves to the same target key" is **not** the compiler's alias-gating criterion. Either
the two-row batch with coincidentally equal runtime keys must keep the trailing predecessor, or a second signal is
needed. Next candidate discriminators to test (all readable from the compiled route metadata, no app names):
`messageBusHandlerManagedEntrySlots` membership, the number of *source rows* feeding the batch (`batchLogicalIndex`
/`sourceLogicalIndex` distribution across the lanes), and whether the route published `vmapBatch*` witnesses for
that collection in the failing statement. Cheap test order: instrument `entry-placement-plan` to also print those
three facts for both the Unicrow (needs target-trailing) and FakeToken (needs pred-trailing) builds, then gate the
change on the field that actually separates them.

## UPDATE (round 7): the disagreement is a target/predecessor *swap*, with the discriminator identified

Round 6's plan is confirmed by reading the placement code, and the two models are now exactly opposed:

* SDK batch model: the **target** (NEW node) is installed at the *layout entry slot*
  (`batchTargetPlaceholders` -> `builder.setEntryRawCommitment(slotIndex, commitment)` +
  `requireEntryOutputSlot`, `StatefulContract.ts:31195-31212`), and the **predecessor** is pinned into the trailing
  band (`batchPredCommitments` -> `setLoopEntryCommitments` + `pinLoopEntry`, `:31279-31282`, placed at
  `getLoopEntryOutputBase()` = the trailing base);
* compiled route for this statement: the **predecessor** is verified at the *fixed entry slot*
  (`emitEntryOutputIndex` -> owner+4 = 308, passes) and the **target** at the *trailing base*
  (`emitTrailingBlockBase` -> owner+16 = 320, fails with the head-rewrite commitment).

Discriminator available to the SDK: for the failing batch **all lanes resolve to the same target slot** -
`entry-placement-plan` prints `targetSlots: [{0:"4bf5122f…"},{1:"4bf5122f…"},{2:"4bf5122f…"}]` (the route's
`entryAccesses` slot 1 carries `runtimeAliasPriorSlots:[0]`, slot 2 is write-only). Batches whose lanes target
*distinct* keys (FakeToken `_balances`/`_allowances`, the marketplace collections) keep the current trailing
predecessor model and pass today, so the change must be gated on "one target for the whole batch".

Candidate minimal change (SDK, general - not yet applied): in the batch planning loop
(`StatefulContract.ts:19640-19681`), when every lane's `batchTargetSlots` value is identical and
`predOutputs.length > 0`, publish the batch's **target** commitment (`batchTargetPlaceholders` for the batch's
first lane, computed at `:19653`) in place of the predecessor list for that collection (via
`batchPredCommitments.set(collection, [targetCommitment])`), leaving `batchTrailingCount = 1` so the trailing
width is unchanged. Then the trailing lane carries the node the compiled route addresses, the predecessor stays at
its fixed entry coordinate (the state/derivation already produces the head rewrite there), and the value chunks
follow at +1 as they do today. Verify with the `take job` family only; if it advances, generalise the condition to
the compiler's own alias gating (a batch whose lanes can only ever write one node) rather than to this contract.

## UPDATE (round 6): SDK plan vs compiled route - trailing predecessor displaces the batch TARGET

New probe `entry-placement-plan` (in `StatefulContract.ts` next to the `batchPredCommitments` placement, gated by
`SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER=1`) prints the SDK's own plan for each build. For the failing build
(`functionName: "__message_bus1"`, participant 3 Unicrow) it emits:

    batchPred:        [{collection:"escrows", commitments:["0000…00"]}]      <- rewritten predecessor (head, seeded)
    targetPlaceholders:[{slotIndex:0, commitment:"4bf5122f344554c5…"}]       <- the batch TARGET = the NEW node (slot = Hk)
    targetSlots:      [{0:"4bf5122f…"},{1:"4bf5122f…"},{2:"4bf5122f…"}]      <- all three lanes target the same key
    sortedLoop: []

Combined with the round-5 placement dump (`4 = head rewrite 0‖Hk`, `5/6 = OP_TRUE`, `16 = head rewrite 0‖Hk`,
`17/18 = value chunks`) and the runtime reads (`ip 1014 -> output 308` = the fixed entry slot, the predecessor
check; `ip 1042 -> output 320` = the trailing base, the NEW check expecting `Hk‖0‖value`):

* the compiled route verifies the **predecessor at the fixed entry slot** and the **target/NEW at the trailing
  base** - i.e. for this shape the predecessor is *in-block* (`PredOut = -1`, trailing width 0);
* the SDK treats the same batch as a *trailing* predecessor batch: `batchPredCommitments` pins the head at
  `getLoopEntryOutputBase()` (local 16), which is exactly where the program looks for the NEW target, and the
  target placeholder (`Hk‖…`) is never materialised at any coordinate.

The route's entry metadata explains the shape: `entryAccesses` slot 0 read+write, slot 1 read+write with
`runtimeAliasPriorSlots:[0]`, slot 2 write-only - i.e. the batch's lanes **alias one another** and the compiler
compiles the statement as a single insert (alias lanes gated by `emitAliasConditionalWriteVerification`), not as a
trailing-predecessor batch.

Next fix (SDK, general): make the batch predecessor placement follow the compiled alias gating - when the batch's
lanes resolve to one authenticated target (alias lanes / `runtimeAliasPriorSlots`), the predecessor is verified
in-block and must not take a trailing output; the trailing band then starts with the batch target commitment.
Anchors: `StatefulContract.ts:19405-19470` (`predOutputs`, `firstLinearPred`, `predOut`, `batchTrailingCount`),
`:31279-31282` (`batchPredCommitments` placement), `StatefulTransactionBuilder.ts:15526`/`:15948`
(`getChunkOutputBase`/`getLoopEntryOutputBase`). Verify with the new `entry-placement-plan` probe plus
`atomic-local-placement` and the `take job` family.

## UPDATE (round 5): the missing NEW node - both sides now measured

Full-block placement dump (probe `atomic-local-placement`, `SOLIDC_DEBUG_ATOMIC_GRAPH=1`, now printing every output)
for the failing participant 3 (`Unicrow`, base 304, layout: master 0, dataNft 1-3, entries 4/5/6, events 7-14,
returnEvent 15, trailingBase 16, blockSize 80):

    0  master (minting, aa20a19440…)
    1-3 dataNft (005151 / 5123aa205e… / 5221 00…)
    4  entry lock aa20a158… commitment 000…0(32) || 4bf5122f…451a      <- head rewrite (slot 0, next = Hk)
    5  (OP_TRUE, empty)                                                <- batch target lane 1 never materialised
    7  event (aa20aef2…)
    15 returnEvent (51, 2000…)
    16 entry lock aa20a158… commitment 000…0(32) || 4bf5122f…451a      <- SAME head rewrite again
    17 chunk NFT aa206e6b04… 0000bafcb055d039…
    18 chunk NFT aa206e6b04… 01004500000026454143432023…
    80 change/sidecar

The program (measured at `ip 1042`/`ip 1060`) verifies the **predecessor** at the *fixed* entry slot
(`emitEntryOutputIndex(slotIndex, loc, 5)` -> owner+4 = 308, which passes) and the **NEW node** at the *trailing
base* (`emitTrailingBlockBase(blockSize, loc, undefined, 5)` -> owner+16 = 320) whose expected commitment is
`Hk32 || next32(0) || value` (128 B, value = the 64-byte `c5000000…` tail). At 320 the SDK placed the head
rewrite, not the NEW node, so the commitment compare fails.

So the current state is exactly: **the NEW node (`Hk || 0 || value`) is materialised nowhere**, the head rewrite is
materialised twice (4 and 16), and the route batch's second target lane (slot 1 -> local 5) is empty.

Relevant compiler model for this statement (`emitSortedInsertBody`, `GenerateTargetTraversal.ts:20749-20797`):
P' at the *fixed* entry slot (`emitEntryOutputIndex`, now offset 5 after the round-4 fix), NEW at
`emitTrailingBlockBase` + returnEvent/dynamic-output counters - i.e. the trailing band starts with the NEW;
the trailing predecessor belongs at the layout entry slot, not the trailing band.

Route metadata that drives the SDK side (`Unicrow.json`): `messageBus.route.sortedBatchInfo = [{escrows,
slotIndices:[0,1]}]` (non-linear), `route.entryAccesses` slots 0/1 read+write, slot 2 write-only; the `pay`
handler itself publishes no batch metadata.

Next probes/anchors (SDK): the batch plan and its placement for this route - `planBatchUpsert` outputs,
`batchTargetSlots`, `batchPredCommitments` and `sortedInserts`/`entryLoopWrites` handling
(`StatefulContract.ts:19405-19470` batch planning, `:31220-31295` `sortedInserts`/`batchPredCommitments`/
`computedValueUpdateCollections` placement), the loop-entry materialisation
(`StatefulTransactionBuilder.ts:15196-15215`, `:15730-15800`, `:18402-18530`, `:18560+`), and the value-chunk
placement (`composedChunkBase = trailing[trailing.length - total]` at `:31298-31327`). Debug gates already in the
tree: `SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER`, `SOLIDC_DEBUG_LOOP_ENTRY_LIFECYCLE`, `SOLIDC_DEBUG_ATOMIC_GRAPH`.
Open question to settle first: for a non-linear batch insert with a chunked value, is the tail order
`[pred, NEW, chunks…]` (compiler's batch model, NEW index must then include the pred width) or
`[NEW, chunks…]` with the pred only at the layout entry slot (what this single-insert body emits)? The compiler's
own dynamic-chunk epilogue adds `__internal__vmapBatchTrailingCount` while this NEW index does **not**, which is
the concrete inconsistency to resolve.

## UPDATE (round 4): compiler frame-offset fix landed - input 304 advances past the P' verification

**Change (compiler, general):** `packages/solidc/src/generation/GenerateTargetTraversal.ts`, the sorted-INSERT
branch of the mapping write body (`emitSorted*` ~line 20760): the P' output-index computation passed
`emitEntryOutputIndex(slotIndex, loc, 6)` while the runtime has only **five** raw vmap working fields live above the
tracked frame at that point - the same five the very next owner reference in the same branch declares
(`emitMasterInputIndex(loc, 5)` at ~20764, and the code's own comment at ~20782 "Five untracked vmap fields remain
above the tracked frame here"). The extra +1 made the owner pick (`PUSH <owner+6>; OP_PICK`) read an unrelated
empty item, so the P' entry was verified at output coordinate 4 instead of 308/320. Changed to
`emitEntryOutputIndex(slotIndex, loc, 5)` with a comment recording the authority.

**Evidence chain:**
- runtime (probes from round 3, `SOLIDC_DEBUG_FAILURE_RING=1 SOLIDC_DEBUG_ROUTE_INPUT_INDEX=304`): owner pick at
  `ip 1010 depth 20` read an empty item while the live frame had the owner (`2:3001` = 304) at depth 19 -
  one item too deep;
- compiler (`SOLIDC_DEBUG_COMPUTE_BASE=1`, focused `compile --iteration unicrow/Unicrow.sol` after clearing
  `.marketplace/cache/solidcash`): 400 `branch: 'owner'` records, all at the same model state
  (`index 14, modelLen 29`) emit totals 15/16/**20**/21/**20**/21/**19** for extras 1/2/**6**/7/**6**/7/**5** -
  the two extra-6 sites are the UPDATE branch's non-repoint P' (`:20743`) and the INSERT branch's P' (`:20760`),
  and the extra-5 site is the INSERT branch's NEW-address lookup (`:20764`) at the same raw depth.

**Measured effect (same focused title):** the P' verification now passes - the failing program reads
`ip 1042 OP_OUTPUTBYTECODE index 320 -> aa20a158…` (the `escrows` entry covenant, local 16) instead of index 4.
`take job > sanity checks` still passes; the failure moved *inside* the same statement.

**New blocker (same participant, next check):** `message-bus-large-equals` last entry at `ip 1060`
(1305-instruction program): expected (left, 128 B)
`4bf5122f…451a || 000…0 || c500000021d20f54…` = `Hk32 || next32 || value` (the NEW entry node), actual (right,
64 B) `000…0 || 4bf5122f…451a` = `slot=0 || next=Hk` (the rewritten list HEAD = the P' node). So the program's
NEW-node coordinate equals the P' coordinate: `emitTrailingBlockBase(blockSize, …, 5)` yields the trailing base
(16) which is also where the P' sits, and the SDK's local block has the entry-lock output only at local 16
(`atomic-local-placement`, probe `SOLIDC_DEBUG_ATOMIC_GRAPH=1`) with value-chunk NFTs after it. Next: decide the
intended tail order for a single-key sorted INSERT with a chunked value (`[P', NEW, chunks…]` per the batch model,
where the SDK reserves `batchPredOutputBase` first) and either (a) make the compiler's NEW index account for the
rewritten predecessor the same way the batch path does (`vmapBatchTrailingCount`), or (b) make the SDK place the
NEW node at the coordinate the compiler addresses. Measure with `atomic-local-placement` over a *full* block (the
probe currently caps at 28 outputs) and the convergence probe (`SOLIDC_DEBUG_CONVERGE_OWNERS=1`).

**Build state:** `packages/solidc` rebuilt from source, `unicrow/Unicrow.sol` recompiled into
`.marketplace/artifacts` (iteration compile - a full cold project compile is still required before handoff).

## UPDATE (round 2, later): input-216 blocker FIXED - failure advanced to input 304 (Unicrow)

**Fix (general, one guard):** the conditional-lane cleanup in `_deriveFullTransactionState` deleted a collection's
loop-entry commitments whenever a conditional entry lane proved absent. That is right for a *speculative* seed,
but a **pinned** family is compiler-authenticated geometry (the rewritten vmap-batch predecessors the route
covenant addresses by absolute trailing coordinate), so clearing it removes those outputs and shifts every later
trailing family down by their width. `packages/solidcash/src/stateful/StatefulContract.ts` (~line 16334):

    if (collection && !stb.isLoopEntryPinned(collection)
      && !stb.hasRuntimeLoopEntrySegments(collection)) {
      stb.setLoopEntryCommitments(collection, []);
    }

Root-cause evidence (probe `SOLIDC_DEBUG_LOOP_ENTRY_LIFECYCLE=1`, logging `setLoopEntryCommitments` with
requested/required/pinned/previous counts and a stack):

    _allowances requested 1 prev 0 pinned False      <- seeded from batchPredCommitments
    _allowances requested 0 prev 1 pinned True       <- cleared by the conditional-lane cleanup
    _allowances requested 1 prev 0 pinned False      <- re-seeded next pass
    _allowances requested 0 prev 0 pinned True       <- cleared again, so the final layout lost it

The stack pointed at `StatefulContract.ts:16335` through `_deriveFullTransactionState` <- `_createBuilder` <-
`_applyOverrides` <- `build` <- `assemble (compose.ts)`.

**Verified:** `atomic-local-placement` (`SOLIDC_DEBUG_ATOMIC_GRAPH=1`, probe in `compose.ts`) for participant 2
now shows `22 = returnEvent`, `23 = aa2008351196…` (`_allowances` pinned predecessor), `24 = _name` chunk,
`25 = _symbol` chunk - exactly the geometry the program verifies - and `take job > take job` now fails at
**input 304** instead of 216.

## New blocker: input 304 = participant 3 `Unicrow` (`0000…1014`)

- Failing helper: `debug.invokeDebug["-162 outlined source span -162"]`, ops
  `[PICK, EQUALVERIFY, DUP, OUTPUTTOKENCATEGORY, DUP, 1, INVOKE, 1, EQUALVERIFY, …]`, source span
  `207:8:207:35` = `escrows[escrowId] = escrow;` (`Unicrow.json` source line 207). It is the collection write
  verification for `escrows:mapping(uint256 => Escrow)`, which is `chunkableValue: true`.
- Failing comparison (`message-bus-large-equals` last entry, ip 1 of a 12-instruction helper):
  left/actual `aa20e932c48ff89e3522e9b9f02f1d64f5f34a144ec4c583b35312399a572972065287` vs
  right/expected `aa20a158aa5971843b79ac1cdbc80010bb769c32a78f97a826e41a60d8bb695b3fc387`.
  The actual lock is an **ecrecover sidecar** output (category `9e47d0fc96ee9ef9…`, `slot {kind:
  ecrecoverSideCar, offset: 4, slotIndex: 0}`) that the sidecar dump attributes to **participant 0**'s build;
  the expected lock is Unicrow's `EntryNft_00000000` entry covenant.
- `atomic-lane-bind` for participant 3: `transportedChunkCount 0` (no value-chunk lane), while participant 1
  transports its 388-byte lane. Participant 3's own carried outputs (probe, passes 1-4 stable):
  `0 master, 1-3 DataNft_00000000, 4 entry aa20a158…, 7 event, 15 returnEvent, 16 entry aa20a158…,
  17-18 aa206e6b04baa172 (mutable, commitments 0000bafcb0… / 0100450000…)`, rest OP_TRUE up to 27.

Next measurements (cheap, gates already in the tree): (a) extend `atomic-local-placement` past index 28 so
participant 3's whole block is visible, or print only non-OP_TRUE outputs; (b) `SOLIDC_DEBUG_VALUE_CHUNKS=1`
to see whether the `escrows` value derivation runs at all for the `pay` row (if the value is long, the same
promoted-flow lane defect would apply to participant 3); (c) check whether the program's index for that check is
block-relative (`masterInput + offset`) or absolute - the actual operand currently looks like participant 0's
sidecar output, so the first question is whether the failing coordinate is inside participant 3's block at all.

## UPDATE (round 3): input-304 blocker is a compiler base-coordinate drift in the entry epilogue

(a)-(c) above are answered by runtime measurement, not inference. Probes added to the failure-ring hook in
`packages/solidcash/src/message-bus/preflight.ts` (env `SOLIDC_DEBUG_FAILURE_RING=1`
`SOLIDC_DEBUG_ROUTE_INPUT_INDEX=304`): `message-bus-output-bytecode-reads` (records every
`OP_OUTPUTBYTECODE`/`OP_UTXOBYTECODE`/`OP_UTXOTOKENCATEGORY`/large `OP_PICK` with its index/frame) and
`message-bus-instruction-window` (last 60 executed instructions of programs > 1000 instructions).

**Measured sequence for the failing input 304 (Unicrow route, 1305-instruction program):**

    ip 970  OP_PICK depth 15 -> "3001" (= 304, the owner)             correct
    ip 971  OP_UTXOTOKENCATEGORY input 304 -> category 0000…1014      correct
    ip 977  OP_PICK depth 16 -> "3001" (= 304, the owner)             correct
    ip 1010 OP_PICK depth 20 -> empty item                            WRONG by exactly one
    ip 1011..1014  OP_4; OP_ADD; OP_DUP; OP_OUTPUTBYTECODE index 4 -> aa20e932…  (participant 0's sidecar)
    ip 1014 OP_EQUALVERIFY vs expected aa20a158… (Unicrow entry lock) -> FAIL

The runtime frame dumped at ip 1010 (top-down, ordinal 0 = the pick depth operand) places the owner
`2:3001` at ordinal **20**, i.e. at depth **19** after the depth operand pops:
`0:1:14, 1:0:, 2:32:000…, 3:32:000…, 4:35:aa20a158…(expected entry lock), 5:32:4bf5122f3445…, 6:64:c500…,
7:197:23aa204c4025…, 8:1:01, 9..16: assorted 35-byte locks, 17:1:64, 18:1:01, 19:1:01, 20:2:3001, 21:0:, 22:0:,
23:2:4101`. So the compiler's model over-counts the items above `__internal__messageBusOwnerInput` by exactly
one at this site; `emitMasterInputIndex` therefore emits `PUSH 20; OP_PICK` and reads an empty item, and
`emitBlockSlotIndex('entry', 0)` adds the block offset 4 -> output index 4 instead of 308.

The window also shows the failing check sits behind an `OP_IF` at ip 981 that evaluated **false** (the VM jumped
straight to `OP_ELSE` at ip 1006), then `PUSH 65; OP_INVOKE` (helper 65 = `emitSlotExistsCheck`, 24 instructions of
`PICK`/`BOOLAND`/`VERIFY`), then the owner pick + `OP_4` + `OP_OUTPUTBYTECODE` + `OP_EQUALVERIFY`. That is the
shape of `emitAliasConditionalWriteVerification` (`GenerateTargetTraversal.ts:27114-27204`, its
`runtimeStructuralGate` branch `:27128-27136` ends with `this.stack = tracked`) or
`emitConditionalDeleteVerification` (`:27205-27258`), both of which call `emitEntryOutputIndex(slotIdx, loc, 0)`
in their entry-lock part (`:27160`, `:27167`, `:27170`, `:27180`, `:27223`, `:27230`, `:27233`, `:27251`) - while
the equivalent checks elsewhere in the same program (ip 970/977) pick the owner correctly at depths 15/16.

**Next step (compiler-side, general - do NOT switch the addressing form globally; the compiler's own note at
`GenerateTargetTraversal.ts:32380-32386` says the two forms compensate for opposite frame mismatches and that the
MODEL or the specific base emitter must be corrected):** compile Unicrow alone with `SOLIDC_DEBUG_COMPUTE_BASE=1`
(add `SOLIDC_DEBUG_COMPUTE_BASE_MARKERS=1` and a `[vm-stack]` run to map site ordinals to ips) and compare the
`DBG-COMPUTE-BASE` record for the site that precedes the failing ip with the runtime frame; then give that
emitter the correct `extraStackOffset` (or drop the stale model item) at the exact conditional-gate branch. The
same drift should be reproducible with a small contract that writes a sorted mapping inside a conditional branch
and then verifies the entry output lock, so a fixture regression is cheap.

**Round-3 refinement - the failing emitter is now named.** The failing frame is the outlined helper `-162`
(`PUSH` of the signed script number `a280` = -162 immediately precedes `OP_INVOKE` at main ip 1016-1017), whose
body is `emitVerifySortedValueOutputInline` (`GenerateTargetTraversal.ts:20341-20364`): `OP_DUP;
OP_OUTPUTBYTECODE; <addrDepth> OP_PICK; OP_EQUALVERIFY` (the failing compare), then
`OP_DUP; OP_OUTPUTTOKENCATEGORY; OP_DUP; OP_DROP_FIRST32; OP_1; OP_EQUALVERIFY`,
`emitVerifyCatBaseEqMaster` (the `OP_INVOKE` at helper ip 6) and the commitment compare - i.e. the
`escrows[escrowId] = escrow;` value-write verification (helper source span `207:8:207:35`). Its `outIdx` is
produced by the caller's `emitEntryOutputIndex(slotIndex, loc, N)`, and the failing owner pick is that emitter's
`emitMasterInputIndex(loc, N)`.

Inside the sorted-insert body (`:20749-20797`) the NEW-output check is
`emitAddDynamicOutputsBeforeEntries(loc, 5)` (`:20784`) followed by
`emitVerifySortedValueOutput(loc, 1, 6, 3, 7, 6)` (`:20785`) and the P' check earlier is
`emitEntryOutputIndex(slotIndex, loc, 6)` + `emitVerifySortedValueOutput(loc, 4, 3, 5, 1, 6)` (`:20760-20761`).
The trace shows the P'-side owner pick correct (depth 16) and the NEW-side pick one too deep (model 20 vs
runtime 19) **within the same statement**, so the drift is introduced between them - prime suspects are the
`hasReturnEventSlot` / returnOutputIdx adjustment block at `:20769-20781` and
`emitAddDynamicOutputsBeforeEntries` (`:29960-29987`), which are conditioned on message-bus-owner mode and on a
materialized returnEvent slot. Next measurement: compare each emitted push/pop of that stretch against the depths
passed at `:20785` (addr 1, f1 6, f2 3, f3 7, untracked 6) with `SOLIDC_DEBUG_COMPUTE_BASE=1`; the fix is a
corrected model/offset at that emitter, not a global addressing change.

**Temporary probes added this round (all env-gated; revert before committing):** `value-chunk-derive` +
`dynamic-chunk-input-order` + `dynamic-chunk-root-base` + `dynamic-chunk-master-state`
(`SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER`), `vmap-batch-trailing-plan` (`SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER`),
`atomic-lane-bind` + `atomic-local-placement` (`SOLIDC_DEBUG_ATOMIC_GRAPH`), `loop-entry-set`
(`SOLIDC_DEBUG_LOOP_ENTRY_LIFECYCLE`), `message-bus-participant-masters` + `message-bus-output-bytecode-reads` +
`message-bus-instruction-window` (`SOLIDC_DEBUG_FAILURE_RING`).


## UPDATE (round 1, this session): value-chunk lane FIXED in the tree, next blocker is dynamic chunks

**Tree state:** clean at `4c29074cd` except two modified files (uncommitted, SDK `dist` rebuilt from them):

- `packages/solidcash/src/stateful/StatefulContract.ts`
- `packages/solidcash/src/message-bus/compose.ts` (temporary probe only - revert before committing)

**The fix (general, no application naming):** `_createBuilder` now re-derives a participant's chunkable-value
production once per `(owner, resource)` over every reached writer row of that owner, in graph order, instead of
trusting the framedsite derivation that only saw its own row. Added:

- `PreparedAtomicNode.deriveRouteValueChunkProductions(rows)` - attached in both prepared-node construction
  branches; re-runs `refreshChunkableRouteWitnesses` with an explicit complete row list.
- a pass inside the promotion block (`if (requiresAtomicPromotion && allRoutesEligible)`) that groups reached
  nodes by owner + `valueChunkWriteResourceIdentity`, builds the writer rows for the resource from
  `orderedNodes`, derives the terminal production, drops superseded partial productions, re-homes the lane onto
  the node whose producer path owns the derived terminal claim, and re-points every writer row's
  `resolveValueChunkProductionsFromArgs` at the same complete row list.
- Temporary probes (env-gated, keep for the next rounds, revert before commit):
  `SOLIDC_DEBUG_VALUE_CHUNKS=1` -> `value-chunk-derive` (rows + pre/leading/current/next/digest);
  `SOLIDC_DEBUG_ATOMIC_GRAPH=1` -> `atomic-lane-bind` (per participant transported lane).

**Measured effect (`npx vitest run --config vitest.marketplace.config.ts -t 'take job$'`):**

- before: participant 1 transported `{bytes 293, chunks 3}` (or 233 in earlier runs); program expects the 388-byte
  post-state; preflight failed at input 214.
- after: `value-chunk-derive ... rows [a826ee9c/cs2, a826ee9c/cs8] ... next 388 digest e5559480def4f047` - the exact
  digest the compiled program verifies - and `atomic-lane-bind {"participant":1,"transportedChunkCount":3,
  "transported":[{"bytes":388,"chunks":3,"digest":"e5559480def4f047"}],"base":211}`.
- `take job > sanity checks` still passes; `take job > take job multiple` unchanged (`expected not to emit
  'JobEvent'`); `take job > take job` advanced from **input 214 to input 216**.

**New blocker (input 216, participant 2 = FakeToken, category `b1303bbb...`):** the participant's dynamic-string
chunks (`_name`/`_symbol`, `route.dynamicReads = route.dynamicWrites = ["_name","_symbol"]`, trailing band base 23)
are verified by the program against the wrong output. Evidence from `SOLIDC_DEBUG_FAILURE_RING=1
SOLIDC_DEBUG_ROUTE_INPUT_INDEX=216`:

- failing instruction is the outlined dynamic-chunk epilogue check (a): `outIdx OP_DUP OP_OUTPUTBYTECODE
  <dyn_chunkaddr> OP_EQUALVERIFY` (compiler `emitDynamicWriteVerification`, ~`GenerateTargetTraversal.ts:27540`);
- `message-bus-large-equals` last entry: left `aa202994...` (= `_symbol`'s ChunkNft address) vs right
  `aa20aacfe7...` (= `_name`'s) at ip 1 of a 5-instruction helper;
- lock -> role map from the ring: `aa20aacfe7...` = `ChunkNft_b1303bbb` inputs/outputs [239], `aa202994...` =
  inputs/outputs [240]; local offsets 23/24 with participant input base 216.
- Read: the program verifies `_symbol`'s chunk 0 at `trailingBase + ceil(size(_name_value)/CHUNK) + 0`; getting
  `_name`'s slot means the program's `_name` value was empty (size 0), i.e. its trailing-chunk read produced
  nothing. **Two measurements already rule out the obvious candidates** (`SOLIDC_DEBUG_DYNAMIC_CHUNK_ORDER=1`,
  probes in `StatefulContract.ts` - revert before commit):
  - `dynamic-chunk-input-order {"functionName":"__message_bus1","dynamicWrites":["_name","_symbol"],
    "activeDynamicWrites":[],"vars":[_name,_symbol],"inputs":[<vout 240 commit 000454657374 "Test">,
    <vout 241 commit 0003545354 "TST">]}` - the SDK's dynamic chunk input order and geometry match the route's
    published `dynamicWrites` order exactly;
  - `dynamic-chunk-root-base {"functionName":"__message_bus1","blockBase":216,"localIndex":23,
    "target":"...:240","value":"239","readChunks":0,"writeChunks":2}` - `__internal__dynamicChunkInputBase` is
    **239** (participant-local 23), i.e. it points at the `_name` chunk, so the read run starts correctly;
  - `atomic-local-return-layout` for participant 2 shows the returnEvent slot at offset 22 materialized, so
    trailingBase 23 stands (no ±1 compaction).
- Remaining hypothesis to test next: the participant *master state* the SDK supplies carries the dynamic string
  length fields wrong/zeroed (`stateLayout.variables` = `_totalSupply`(field 0), `_name`(field 1, dynamic),
  `_symbol`(field 2, dynamic)), so the program's read loop reassembles an empty `_name`, its chunk count becomes
  0, and `_symbol`'s expected output index shifts onto `_name`'s chunk. Next probe: print participant 2's master
  input/output commitment (aggregate input 216 and its output) plus the inline dynamic length fields the SDK
  encodes (`_deriveFullTransactionState`, `stateLayout.variables[].fieldIndex`) and compare with the deployed
  master commitment. Only three candidates remain: master field encoding, the program's read-loop chunk-count
  source, or an output-band offset inside the FakeToken block (entries / vmap-batch trailing count).

## UPDATE (round 2): input-216 blocker ROOT-CAUSED - a trailing vmap-batch predecessor output is lost in later passes

The master-state/read-loop hypotheses above are **ruled out**; the real defect is output placement. Measured:

- Failing instruction is the dynamic-write epilogue check (a) `outIdx OP_DUP OP_OUTPUTBYTECODE <dyn_chunkaddr>
  OP_EQUALVERIFY` (`GenerateTargetTraversal.ts:27530-27560`). Operand polarity (from the emitted sequence, and
  the ring's failure state showing the expected commitment `6:000454657374` = `_name` chunk 0 live on the stack):
  **the program expected `_name`'s chunk and found `_symbol`'s** - i.e. it computed `outIdx = local 24` while the
  final aggregate has `_name` at local 23.
- The SDK's own plan agrees with the program: `vmap-batch-trailing-plan {"functionName":"__message_bus1",
  "batchTrailingCount":1,"batchPredOutputBase":240,...}` (initial base 239 = blockBase 216 + trailingBase 23), so
  `__internal__vmapBatchTrailingCount = 1`: one trailing predecessor entry belongs at local 23 and the dynamic
  chunks at local 24/25. `getChunkOutputBase()`/`getLoopEntryOutputBase()` encode exactly that model
  (`StatefulTransactionBuilder.ts:15526`, `:15948`).
- `atomic-local-placement` (new probe in `compose.ts`, `SOLIDC_DEBUG_ATOMIC_GRAPH=1`) over the passes of the one
  failing send, participant 2 (`base 216`), local 22/23/24/25:
  - passes 1-5: `22:51:4c6000…`, **`23:aa200835119626:c740b88f…` (`_allowances` entry = the pinned batch
    predecessor)**, `24:aa20aacfe7d3dc:000454657374` (`_name` chunk), `25:aa20299479a69c:0003545354`
    (`_symbol` chunk) - correct, matching the program;
  - passes 6-9 (final): `22:51:0fa1960c…`, **`23:aa20aacfe7d3dc:000454657374`**, `24:aa20299479a69c:0003545354`,
    `25:51` - the predecessor output is gone and both chunks shifted down by one, which is exactly the failure.
- So a later derivation/rebuild pass drops (or fails to re-materialize) the pinned trailing predecessor, and the
  dynamic chunks then take its coordinate. Same class as the handoff's event-relocation defect: later passes must
  consume authenticated placement, not rediscover it.

Next probe (already wired, just run it): `SOLIDC_DEBUG_LOOP_ENTRY_LIFECYCLE=1` logs every
`setLoopEntryCommitments(collection, …)` with requested/required/pinned/previous counts
(`StatefulTransactionBuilder.ts:15814`). Expect the `_allowances` (or `_balances`) entry to go to 1 and then back
to 0/absent in a later pass. Candidate sites: the pinned-skip branch in the loop-entry derivation
(`StatefulContract.ts:16548-16590`, `if (stb.isLoopEntryPinned(...)) { loopOffset += count; continue; }`), the
`batchPredCommitments` application (`StatefulContract.ts:31273-31276`), and the final output passes
(`_applyDerivedValueChunks` / `_reassertStagedValueChunkOutputs` / `_reconcileMaterializedPredOutWitnesses`,
`StatefulTransactionBuilder.ts:19490-19505`). A general fix re-materializes a pinned loop-entry commitment at
`getLoopEntryOutputIndex(collection, i)` in every pass and re-derives `getChunkOutputBase()` from that same
placement - not a special case for this contract.



State: `take job > take job` fails at input 214 (`MarketplaceDataV1` participant) with
`Program failed an OP_VERIFY operation`. Everything below is measured; the long-form evidence is in
`HANDOFF_MAPPING_WRITE_ADMISSION.md` (rounds 228-245).

## What is already fixed and committed

- `4c29074cd` (compiler): `address(this)` now resolves from the authenticated participant owner under a delegate
  execution (`GenerateTargetTraversal.visitUnaryOp` + `selfLockingBytecodeNamesParticipantOwner`). This fixed the
  input-127 failure and is verified: `take job > sanity checks` passes, MarketplaceV1 debug bytecode 130587 -> 130738.

## The remaining defect, in one paragraph

The failing program is participant 1's (`MarketplaceDataV1`) composed route. It executes the compiler's
write-time value-chunk pin (`GenerateTargetTraversal.ts:20430-20477`): scan every output for the value-chunk
covenant of collection `jobEvents`, verify each commitment, then require `matches == expectedCount`. The program
chunks the on-chain post-state: **388 bytes, 3 chunks**, digest `e5559480def4f0476c3eedcf9eb37a890c4e46b45e6a419f59fcd916705c31eb`,
covenant `aa209fb7da6a861a67db912e57a5f4d30ead21588c61b44092e6491857a5411d8790` - which reproduces byte-for-byte
from the SDK's own helpers (`buildEntryNftCovenantScript` + `computeCollectionHash(valueChunkSignature('jobEvents'))`
+ `hash256('value-chunk' || ch || slot || sha256(value))`), so the program is right and the domain path is right.

The promoted atomic send transports the wrong value: measured `transportedChunkCount 2` with
`transported [{bytes 233, chunks 2}]`, base 212 (`/tmp/r245-lane.log`, probe print before
`internalRouteWitnesses` in `compose.ts`). 233 is *stale* - it is what an earlier send's single-row derivation
produced (`empty pre + leading 205 + element 28`). With 2 chunks reserved, the program's third covenant can never
exist, so its scan matches nothing and `matches == 0` fails.

Root cause of the staleness: the promoted (`__preparedAtomicCalls`) flow never derives the write for **this**
transaction's rows. Each `publishJobEvent` row is composed as its own prepared call, and the value it carries was
derived one row at a time; the plain flow instead derives with the whole row list and accumulates
(`encodeLeadingRouteArrayPushes(rowArguments)` + `deriveChunkableArrayValueChannels`,
`StatefulContract.ts:26171-26201`), which is what produces `pre 233 + e1 95 + e2 60 = 388`.

## Fix plan

1. In the promoted flow, derive the resource's value for the **route's whole row list**
   (`childCompilerRoute.rowArguments`, which carries every row with `args`/`internalArgs`) and publish it as the
   terminal production, exactly as the plain path does. Anchors: the derivation block guarded at
   `StatefulContract.ts:25567` (`refreshChunkableRouteWitnesses`, staging at `:26269` via `stageOwned`/`:26295` via
   `stageValueChunkWrite`, binding published at `:26311`), the prepared-node construction at `:26832-26910`, and the
   freeze at `:32924-32948`.
2. Make sure the composer cannot transport a value that does not correspond to the rows it is rebuilding:
   `compose.ts:2668-2745` (collection + terminal selection) and `:2760-2796` (band sizing + the
   `__internal__valueChunkOutputBase` witness).

Guardrails that must not break (the code says so itself): a shared compiler route must stay "shared logical groups
only" - no second master and no invented trailing insert slot (`StatefulContract.ts:25131-25141`), and the routed
builder accepts exactly one terminal claim per resource (`compose.ts:2775-2780`).

## How to verify (respect the objective's rules)

- Only the `take job` family while red:
  `npx vitest run --config vitest.marketplace.config.ts -t 'take job'` (3 titles, ~3 min).
- Useful gates (all default-off): `SOLIDC_DEBUG_LANE_BIND`, `SOLIDC_DEBUG_STAGE_TRACE`, `SOLIDC_DEBUG_CONVERGE`,
  `SOLIDC_DEBUG_ATOMIC_GRAPH`, `SOLIDC_DEBUG_ATOMIC_PROMOTION`, `SOLIDC_DEBUG_PRODUCTION_VALUE` (the last three
  prints were temporary probes - re-add them only if needed, and revert before committing).
- Compiler change -> cold fixture compile (symlinks `node_modules/@sablier/lockup`, `node_modules/@prb/math`;
  `rm -rf .marketplace/cache/solidcash`; `SOLIDC_COMPILE_CACHE=0 node --max-old-space-size=8192
  packages/testing/dist/cli.js compile --jobs 4`; remove the links afterwards).
- SDK change -> `cd packages/solidcash && npx tsc -p tsconfig.build.json`.
- Run the full ladder only after `take job` and `take job multiple` are green (the objective's rule).

## Known traps recorded in the handoff

- The 32-byte expected lock hash is `9fb7da6a861a67db912e57a5f4d30ead21588c61b44092e6491857a5411d8790`; earlier notes
  compared against a string with the P2SH32 `87` suffix byte still attached, which made every equality test a false
  negative (round 242).
- `PUSH <n>` before `OP_INVOKE` is a signed CScriptNum (`8680` = -134), and composed-program ids are renumbered by
  the composer - never compare them to artifact `invokeDebug` ids.
- The failing program is embedded in the failing input's redeem as a top-level data push (top #418, 28099 bytes,
  22869 instructions); `[vm-stack]` gate ip == instruction index in that body.
