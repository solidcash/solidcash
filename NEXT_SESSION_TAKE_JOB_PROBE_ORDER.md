# `take job`: why the return probe has no external-call groups (Q1-Q5)

Read-only analysis, worktree `/Code/cashscript/.worktrees/kernel-beta-candidate` @ `73159f330` + the WIP files.
No source edited, nothing built, no test run. All SDK line numbers are the current worktree state. Prior-session
probe logs under `/tmp` are cited as `log:line`; they are evidence from earlier runs here, not re-measured now.
(Note: `packages/solidcash/src/message-bus/preflight.ts` gained 2 lines from the concurrent agent while I worked;
I cite no preflight line.)

## Q1. Ordering: where the failing derivation happens vs. where the callee's groups are made

Failing chain (outer = the proxy-forward/route build of `takeJob`):

1. `_createBuilder`'s nested-call planning loop (`StatefulContract.ts:24605`+) resolves, per published nested call: the condition lane `24719-24745` -> `_resolveExternalExpressionReturns(..., allowProvisional = false)` at **24727** (literal `false`), activity decided `24735-24745`, throw at `24746-24751`; the argument lane `24879-24888` with `allowProvisional = preparedAtomicNodes !== undefined` (**24885**); the graph lane `24938-24946` (`true`, 24943) only when `preparedAtomicNodes && needsExpressionReturns`.
2. `_resolveExternalExpressionReturns` (`34308`) walks `producerResult` (`34466-34479`); for callsite 3, `resolveProducer` (`34395`) recurses into sources referencing callsite 7 `IUnicrow.pay` (`34430`), and `derive` (`34362`) calls `registered._deriveReturnValue('pay', values)` at **34384**.
3. `_deriveReturnValue` builds the probe at **34052-34054** (`{ emitReturn: true, returnProbeOnly: true, calls, abiFunction }`; `calls` is only a return-ABI hint) and reads the blob at **34060** -> `_deriveReturnBlob` (`33519-33526`: `builder.build()` / `buildLibauthTransaction()` / `evaluateProbeTrace`).

**Ordering barrier.** The probe is a *new builder* on the callee. It never receives the outer build's groups: `_createBuilder`'s override type is `{..., externalCalls?: ExternalCallInfo[], calls?: CallInfo[], ...}` (`17990-18013`) and the probe passes neither. In that new builder `externalCallUtxoGroups` starts empty (`22636`) and is filled only from `overrides.externalCalls` (`22648`) or the callee instance's registry (`22649-22685`).
The outer build's nested groups appear much later, at `26909` / `27945` (loop from `24754`, callee master loaded at `25008`), i.e. after both resolution lanes. So no reordering inside the outer build can precede the probe with the callee's groups: they belong to another builder, and here the outer materialization *depends on* the probe result.

Why the probe resolves nothing: `_externalRegistry.get(ec.interfaceName)` at **22656** is name-keyed. `Unicrow.pay`'s calls (`.marketplace/artifacts/solidcash/Unicrow.json`, abi `pay.externalCalls`) are `IERC20.balanceOf` x2 (`addressSource` = `input.currency`), `__raw__.__raw__` (`argSources` = `{kind:'expression', expression:{kind:'unsupported', name:'AbiEncodeWithSelectorNode'}}`) and `IUnicrowArbitrator.setArbitrator`.
No name registration -> `canAutoResolve = false; break;` at **22657-22660** (silent), so `resolvedExternalCalls` stays `undefined` and the materialization block gated at **22700** never runs. `IERC20` appears nowhere in the prior-session log (`/tmp/rb.log`): nothing was even attempted.

## Q2. What the placeholder transaction is seeded with, and where groups must land

Geometry measured in the prior-session probe log (`/tmp/rb.log:11553-11660`, `SOLIDC_DEBUG_COLLECTION_FETCH=1`, `return-blob-trace-tail`): **7 inputs / 8 outputs**, error `Program attempted to read from an invalid transaction output index. Transaction output count: 8; requested index: -1.`
* The 7 inputs are exactly `Unicrow.pay`'s own block: `master@0, dataNft@1..3, entry@4` plus funders for the `event@5` / `returnEvent@6` slots (`Unicrow.json` abi `pay.blockLayout.slots`); output 6 is the `returnEvent` placeholder `_deriveReturnBlob` reads (`33574-33575`, `extractPendingReturnCommitmentAtOutput`).
* The single category `0000..1014` is **not** an SDK-synthesised dummy: it is the real `Unicrow` deployment's category here (`/tmp/rb.log`: `collection-entry-fetch { contract: 'Unicrow', categoryId: '0000..1014' }`), i.e. a MockNetworkProvider synthetic funding txid (`MockNetworkProvider.ts:641` `fundingNonce = 0x1000`, `647-648` `nextFundingTxid()`), which every deployment in this suite has. One category is expected: the probe co-spends only the callee it probes.
* The failing instruction is **not** "ip 2 / opcode 188". `describeReturnProbeFailure` prints `instructions[last.ip].opcode` (`33500`), the *post-failure* ip. The log's `failedProgram` is the 6-instruction body `[121 OP_PICK, 210 OP_OUTPUTTOKENCOMMITMENT, 188 OP_REVERSEBYTES, 1 00, 126 OP_CAT, 129]`, and the recorded operand on the stack is `81` = script number **-1**. That byte string is `debug.invokeDebug['113']` (`bytecode 79d2bc01007e81`, `sourceMap 152:33:152:80` = `IERC20(input.currency).balanceOf(address(this))`). So the abort is `OP_OUTPUTTOKENCOMMITMENT(-1)` reading **the `balanceOf` child's result output coordinate**, not an input landmark (`OP_UTXOTOKEN*` would report an input index).
* That coordinate is `__internal__externalReturnOutputIdx0`: `23811-23826` fills it only when a child group with `hasReturnValues` exists and `returnEventIndexMap` has an entry (`23684-23699`); else it falls through to `defaultInternalFunctionArg` (**23848-23850**), which returns `-1n` for any `*OutputIdx*` name (`773-788`, rule `784-785`). The later physical pass agrees: `28752-28768` returns `-1n` when `childNestedGroupIndexForSlot(slot)` is undefined (`28587-28597`).

**Where groups must be injected** so that coordinate resolves: populate `resolvedExternalCalls` before `22700` - via `overrides.externalCalls` from `_deriveReturnValue` (`34052`) or by address-based auto-resolution inside `22649-22685`; the group must then set `hasReturnValues` in `allGroupEcSlots` so `23692-23696` reserves its return output, and be reachable through `allGroupParentIndices` (`22642`, `23551-23556`) so `28587-28597` maps slot -> group.

## Q3. Candidate hooks on this path

* **`_setResultDependentArgumentRefresher` (`StatefulTransactionBuilder.ts:7210`), consumed at `22267` - NOT
  reachable.** Registered only at `33155`, inside the promotion block, and only when
  `preparedAtomicNodes.some(n => n.refreshArgsFromResults)` (`33154`); it maps `preparedAtomicNodeByExternalGroup`
  to real groups (`33157-33166`). `preparedAtomicNodes` is created solely by successful delegate promotion
  (`24615-24667`, node at `24655`), which this suite refuses (`24634-24648`: "delegate forwarding payload does not
  select exactly one implementation ABI function"). It also runs *during convergence* on the assembled outer builder,
  rewriting later callee **arguments**; it cannot undo a probe that ran at planning time and is not an activity channel.
* **`propagateResultDependentArguments` (`compose.ts:2107-2182`) - NOT reachable.** Requires
  `descriptor.resolveArgsFromResults` (`2155`; logged at `2141-2153`), and descriptors come from `preparedCalls`
  (`compose.ts:154`). The public batch descriptor returns only `{contract, functionName, selector, args,
  upgradeTarget}` (`StatefulContract.ts:36536-36567`); the route-payload delegate path (`7709-7729`,
  `_withCompilerRouteDelegatecall` / `__message_bus1`) creates no nodes. It propagates arguments only, never row
  activity.
* **`preparedAtomicNodes` / `resolveArgsFromResults` - NOT reachable** (`preparedAtomicNodes === undefined`,
  `callInfo.compilerRoute === undefined`; gating re-verified above). It is the only existing authenticated-result
  rewrite channel, but adding a root node for the proxy-route case still leaves the condition lane at `24727`.
* **`allowProvisional` lane (`34316`, catch `34387-34393`)** is reachable only through the argument lane, where it is
  `false` (`24885`); the graph lane (`24943`) is dead here. It defers *arguments* by returning `provisionalValue`
  placeholders (`34339-34343`) that a resolver must replace. On the condition lane it is unsound (a placeholder
  selects row activity), and without a registered resolver it commits placeholders (handoff Session-3 `1404-1406`).
* **Composer deferred compute (`compose.ts:2556, 2683, 3163-3186, 3684-3686`)** operates on an existing `local`
  builder and only for published keccak/ecrecover side-car offsets matched by `callManifest` kind-6 rows
  (`3684-3686`) - a runtime side-car resolver, not a planning-time group source.

## Q4. Smallest general change (diff sketches; not applied)

Both are SDK-only (no compiler rebuild or fixture recompile - Round 11 measured the iteration asymmetry). Neither is
proven; each names the measurement that settles it.

**(4.1) Make the probe self-sufficient for its own child calls** (the "groups before the probe" direction, done
inside the probe's builder rather than by reordering the outer one):

```diff
--- a/packages/solidcash/src/stateful/StatefulContract.ts   (inside _createBuilder, ~22649)
+++ b/packages/solidcash/src/stateful/StatefulContract.ts
@@
       for (let eci = 0; eci < externalCalls.length; eci++) {
         const ec = externalCalls[eci];
         if (presetResolved?.[eci]) { autoResolved.push(presetResolved[eci]!); continue; }
-        const registered = this._externalRegistry.get(ec.interfaceName);
-        if (!registered) { canAutoResolve = false; break; }
+        // A Solidity interface call whose target is an address-valued callee input (`IERC20(input.currency)`)
+        // has no connect-time registration under the interface name. Bind it like the delegate nested path:
+        // evaluate the published addressSource against THIS function's own argument frame, then look the
+        // deployment up by address. Never fall back to a same-named instance for an address-pinned call.
+        const registered = this._externalRegistry.get(ec.interfaceName) ?? resolveByAddress(ec);
+        if (!registered) {
+          if (!overrides?.allowUnresolvedExternalCalls) { canAutoResolve = false; break; }
+          autoResolved.push({ externalContract: undefined, functionName: ec.functionName,
+            args: [], placeholder: true });        // explicit neutral block, never a silent skip
+          continue;
+        }
@@ (materialization loop 22739-22959 / transitive 23457-23558 / 23731 / 28573)
+        // A placeholder keeps its physical slot (funder block, no token, no return value) so every
+        // extcallMasterIdx / externalReturnOutputIdx witness stays a REAL index, and the callee's own
+        // covenant fails closed at that callsite instead of reading index -1.
+        if (callInfo.placeholder) { bBlockInputs = [await makeFunder()]; }
@@ (in _deriveReturnValue, 34052)
-      functionName, args, { emitReturn: true, returnProbeOnly: true, calls, abiFunction },
+      functionName, args, { emitReturn: true, returnProbeOnly: true, calls, abiFunction,
+        allowUnresolvedExternalCalls: true },
```

Sites that must tolerate an absent `externalContract`: `22704-22726` (funder count), `22772` (`getFullState`),
`22826-22829` (callee ABI), `23460-23468` (transitive expansion), `23731` (child ABI), `28573` (child ABI), hence a
*medium* change, not a one-liner. Falsifiable outcome: the focused test either passes the `Could not derive the
return value of 'pay'` point or fails at the `__raw__` callsite's own comparison, which decides whether a probe with
an honest placeholder can still reach `pay`'s return-event band. Session-3 measured the partial form (address
resolution without the placeholder branch): it engaged, cleared `balanceOf`, then hit `External call at slot 1
(__raw__.__raw__) not provided via withExternalCall() or connect-time externals` (`22743-22748`) because the
unresolved slot was left `undefined` instead of represented.

**(4.2) Defer the derivation instead** (smaller diff, larger surface): raise a typed error from `_deriveReturnValue`
(callee + unresolved child callsite), catch it in `derive` (`34387`) and in the condition/argument lanes (`24719`,
`24879`), and for a composed/route participant record the nested call as `activity: 'unresolved'` instead of throwing
(`24746-24751`), leaving the decision to the composer. Sound only together with a composer-side activity pass:
defaulting to active or inactive without an authenticated decision silently changes which rows execute.

**Invariants that must stay fail-closed.** (i) `derive`'s catch keeps requiring *both* `allowProvisional` and a
registered refresher (`34387-34393`); never set `allowProvisional` on the condition lane (`24727`).
(ii) `_deriveReturnBlob` keeps extracting an *observed* commitment (`33574-33575`), never the materialised
placeholder output (`outputs[6].commitment = '00'` in the probe log) - that would publish a fabricated result.
(iii) `defaultInternalFunctionArg`'s `-1n` sentinels (`784-785`) must stay distinguishable from "resolved to -1";
if 4.1 is taken, add the `-1` case to the existing `SOLIDC_DEBUG_NESTED_PAY` dump (`28750-28765`) so nothing is
silently substituted.

**Verification.** `npx vitest run --config vitest.marketplace.config.ts -t 'take job$'` (~65 s). An SDK-only change
uses the fixture artifacts as they are (bytecode `f144d98d41f0c7ec`, 108269 bytes); if a compiler file changed, a
cold recompile first (`rm -rf .marketplace/cache/solidcash && SOLIDC_COMPILE_CACHE=0 node --max-old-space-size=8192
packages/testing/dist/cli.js compile --jobs 4`, ~6 min) or the run proves nothing. Green means planning no longer
derives `pay`, the `takeJob` composition assembles, preflight accepts it, and `checkJobFromStateDiffs` passes - the
whole chain, not just the vanished error string. Red with a *different* error still proves the probe barrier was
crossed and names the next one; red with the same `Could not derive the return value of 'pay'` proves the change
never reached `22649-22700`.

## Q5. Is there a small change? No.

The stated direction ("build the probe after the groups' UTXO materialization") is unreachable by reordering: the
probe is a separate builder (Q1) and, for this shape, the outer materialization consumes the probe's result. The
cheap-looking patches are measured dead: neutral-slot auto-resolution without a placeholder branch
(`22743-22748`), provisional on the condition lane (`24727`, unsound), root atomic node for the proxy-route case
(no effect). Ranked viable designs:

1. **Composer-owned row activity (SDK-only).** Planning marks producer-dependent guards `unresolved` instead of
   throwing; the composer decides activity from the authenticated trace and re-converges. Most general (removes
   every planning-time dependence on unprobeable producers), medium disturbance: `24719-24751` + `24879-24911` plus
   `compose.ts` row planning/activity; cheapest to iterate, compiler and artifacts untouched.
2. **Probe self-sufficiency (SDK-only, medium, 4.1).** Address-bound child resolution plus honest placeholder
   blocks. General for any read-only derivation of a callee that itself calls externals, and it keeps the
   planning-time answer *real* rather than deferred; disturbs the materialization block (`22636-23558`) and
   `_deriveReturnValue`, and can still be defeated by a callee that consumes an unresolvable child's result.
3. **Compiler publishes callsite dependency order (compiler + SDK + fixture recompile).** An artifact-level
   topological order (or explicit "guard depends on callsites [...]") lets the SDK probe producers before consumers -
   the honest version of "materialize first". Most general, most disturbing: `Artifact.ts`, symbol/type traversal,
   the route planner, plus a ~6 min recompile per attempt.

## What I did not verify

* No test, build, or compile was run (a concurrent agent owns those), so "fails at `_deriveReturnBlob`" is the
  handoff's measurement plus prior-session logs, not re-measured here.
* The `-1` provenance is inferred: the failing bytecode (`invokeDebug['113']`, source 152) and the `81` operand are
  measured, and `__internal__externalReturnOutputIdx0` is the only `*OutputIdx*` witness on that expression; I did
  not disassemble the whole `pay` body to exclude another output coordinate there.
* I did not verify that `resolvedExternalCalls` is fully `undefined` in the *current* tree (the log that shows zero
  groups came from an earlier revision that carried a temporary probe).
* I did not settle which of `24719` / `24879` is the live failing lane: the handoff's last measurement says the
  condition lane, while `/tmp/ret.log:12022-12051` shows `_createBuilder:24880`. Both are pre-materialization.
* I did not test whether a placeholder group lets `pay`'s trace reach the return-event band (that is the 4.1
  experiment).
* `/tmp/rb.log`, `/tmp/ret.log` are untracked scratch from earlier sessions and may be rotated away.
