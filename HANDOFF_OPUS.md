# Opus handoff: Effective Acceleration marketplace on native BCH

## Worktree and objective

Work only in this existing worktree:

```text
/Code/cashscript/.worktrees/effectiveacceleration-marketplace
```

Branch:

```text
codex/effectiveacceleration-marketplace
```

Objective: make `/Code/effectiveacceleration.ai/contract/.marketplace/project/test/marketplace.test.ts`
compile and run natively on BCH without modifying the marketplace source or its tests. The test project is
exposed in this worktree under `.marketplace/project`.

## User-authorized constraints

- Consensus checks for input count/size and transaction size may be bypassed temporarily. The mock provider
  supplies the relevant configuration.
- `solidcash_v0.13.1` has known pre-existing test failures. Ignore those for now; they are being fixed elsewhere.
- Do not alter the marketplace contracts or `marketplace.test.ts` to obtain a pass.

## State as of the mainline merge

The previously-dirty worktree is now committed and mainline is merged:

```text
d673e3e3 wip: native BCH marketplace port progress          (the prior session's uncommitted work)
ed8907b5 merge: integrate mainline solidcash_v0.13.1        (100 conflicts across 10 files)
1a244b35 fix: keep memory-located inline params on their own local
d2cb1a73 feat: add a proxy logical-identity path to external-call identity
```

`.marketplace/` and `artifacts/` are excluded via `.git/info/exclude`: they are a scratch scaffold of symlinks
into `/Code/effectiveacceleration.ai/contract` plus cache snapshots and logs, not source.

### Merge notes

Mainline refinements were adopted where they supersede the branch (`strictSolidityValidation` gating in
TypeCheckTraversal, split-facet flattening and the `compileString` recursion guard, `MessageBusVerifierCapacityError`,
per-iteration chunk-offset capture). Branch marketplace work was preserved where it is a superset (nested delegate
external composition, compiler-route unlockers, batch predecessor outputs, `getPhysicalChunkOutputBase`, raw batch
descriptor fields, logical identity UTXO preservation). Four resolutions are genuine combinations, listed in the
merge commit message.

### Merge regression found and fixed (1a244b35)

Mainline added a value-parameter aliasing optimization to `InlineReturningStateHelpers` that renames a read-only
parameter to the caller local supplying it and skips the binding statement. For a MEMORY-located argument that
local can be relocated into the shared buffer by the memory lowering, so the alias names a variable that no longer
exists at codegen. This broke the MarketplaceDataV1 project-root compile with:

```text
Expected variable '__inl11_approvalCall' does not exist on the stack
```

(OZ `SafeERC20.forceApprove` -> `_callOptionalReturnBool(token, approvalCall)`, whose assembly reads the aliased
`bytes memory` local.) The fix restricts the optimization to parameters that are neither declared `memory` nor a
dynamic reference type.

Note the project cache key covers sources and options but NOT compiler code, so a stale
`.marketplace/cache/solidcash` hides compiler regressions. Delete that directory when validating a compiler change.

## Solved: proxy logical identity in external-call verification

`MarketplaceV1` stores `MarketplaceDataV1 public marketplaceData` and the test initializes it with
`await marketplaceData.getAddress()`, i.e. the proxy's stable logical P2SH20 CREATE address, while the co-spent
state holder uses the physical BCH covenant. `master bytecode == expected address` could not hold, and
`upgrades.ts` only rewrites direct function-ARGUMENT targets, so this state-read target could not be rewritten
off-chain.

Fixed by a second, authenticated identity proof selected per slot by an SDK-filled witness
(`__internal__extcallAnchorIdx<slot>`):

- `-1` keeps the existing direct equality.
- Otherwise `emitLogicalIdentityOrDirectIdentity` proves the binding from the callee's co-spent immutable SCID
  anchor: the anchor's locking bytecode IS the expected logical address; it is an immutable NFT (32-byte
  category, no capability byte) of the callee master's own category; and its commitment's trailing root field is
  exactly that master's locking bytecode. Only the genuine contract can mint the anchor, so an unrelated P2SH20
  cannot be paired with an unrelated master.

`LOGICAL_IDENTITY_PREFIX` / `LOGICAL_IDENTITY_ROOT_OFFSET` in `GenerateTargetTraversal` must stay byte-identical
to `encodeLogicalIdentityCommitment` in `packages/solidcash/src/stateful/logical-identity.ts`.

SDK side (`StatefulTransactionBuilder` + `StatefulContract`):

- `externalIdentityAnchorUtxos` is a band appended after every layout-driven band and recreated as outputs. The
  anchor redeem script is `<seed> OP_DROP OP_1` (permissionless), so consuming one without recreating it would
  destroy that contract's logical identity.
- Callee anchors sit BEFORE the caller's own `logicalIdentityUtxo`. `emitLogicalMsgSenderAnchorResolution`
  resolves the caller's identity from `OP_TXINPUTCOUNT OP_1SUB`, so the tail input must stay the caller's;
  getting this wrong makes msg.sender resolution pick a callee anchor.
- `getIdentityAnchorInputIndex` reads the materialized input list; `_refreshInputs` re-runs assembly after the
  carrying unlocker is replaced.
- The delegate forward path maps an anchored slot with `nestedGroups[slot]` - the SAME positional mapping the
  `__internal__extcallMasterIdx` fill uses. A callsite-keyed lookup names the wrong contract, because several
  logical callsites share one physical group.
- The witness is filled AFTER funder assignment (`setFunderUtxos`), which is what fixes the input positions the
  index refers to. Filling it at builder-construction time yields stale indices.

Three traps cost real time and are worth remembering: the tail-input assumption above, the stale index before
funders, and the slot-to-group mapping.

## Current blocker: one callee, several unbatched calls

The focused test now passes identity verification and fails later, at a selector check: the co-spent
MarketplaceData input is composed for `publishJobEvent` (`a826ee9c`) while a slot expects `arbitratorRegistered`
(`9bd3de95`).

`publishJobPost` has six external-call slots:

```text
0 MarketplaceDataV1.arbitratorRegistered  argSources [forward]                batched=false
1 MarketplaceDataV1.meceTags              argSources [arrayElement]           batched=false
2 IERC20.balanceOf                        argSources [msgSender]              batched=TRUE
3 MarketplaceDataV1.userRegistered        argSources [msgSender]              batched=false
4 MarketplaceDataV1.publishJobEvent       argSources [expression, expression] batched=false
5 MarketplaceDataV1.publishJobEvent       argSources [expression, expression] batched=false
```

Five distinct calls target one contract, and a master NFT can be spent only once per transaction, so they must
share ONE physical input. The composition currently produces five logical groups all pointing at master input 6
(`__forward`), and each slot then bakes its own compile-time selector check against that single input, which at
most one can satisfy. The sound answer is the batch envelope the compiler already builds for slot 2: batched
slots skip the ordinary selector check and are authenticated by `emitExternalBatchBlobVerification` instead.

### Prototyping the delegate route: what it actually exposes

CORRECTION: an earlier revision of this file claimed nested dynamic-array state was the innermost blocker. That
was inferred, and it is wrong. Instrumenting the refusal shows `nested-dynamic-array-route-not-enabled` never
fires for this contract.

Enabling route synthesis in the DELEGATE variant is a two-line prototype:

```text
compiler.ts ~968   if (compilerOptions.autoDelegate) disallowedModifiers.delete(FunctionModifier.DELEGATE);
compiler.ts ~567   variantOptions keeps `messageBus` instead of forcing it false
```

Dropping DELEGATE only in that variant is defensible: there EVERY handler already executes in the proxy's state
context, so the route is itself a delegate route rather than an ordinary edge advertising a delegate executor -
the uniform frame is what the general refusal protects. With it, synthesis proceeds and hits ordinary compiler
defects one at a time:

1. `cannot uniquely map collection 'jobEvents' to its physical route entry slot` - FIXED and landed
   (commit 2e4a33f4, kept independently of the prototype). The mapper narrowed on collection + key-param COUNT
   only; a handler's keys are compiler-owned entry keys named after the route input that supplies them, so the
   key NAME identifies the slot. Narrowing on it also repaired the pre-existing `BoundedCollectionIteration`
   failure.
2. Next, and where the prototype now stops:

```text
Found parameters (address,address,bytes32) in call to function '__message_bus_entry_userRefunded'
where parameters (address,address,bytes32,bytes) were expected
  ... a position in the message-bus route generated for 'MarketplaceDataV1', NOT in your file.
  ... This is a compiler defect.
```

An arity mismatch between the generated route's call site and the entry wrapper `bindEntryKeyParameters`
produced for `userRefunded(address)` (which writes `users[address_].reputationDown`). The compiler labels it a
defect itself.

Bug 2 was then diagnosed precisely. The entry clone's final signature is:

```text
__message_bus_entry_userRefunded(
  address address_,
  address __message_bus_ek___message_bus_key_users_0,
  bytes32 __internal__msgSenderCategory,
  bytes   __internal__valueWitness_0)          <- the route's call site does not pass this
```

`__internal__valueWitness_0` is injected by the chunkable-value READ path in `SymbolTableTraversal` (~2129)
because `users[address_]` has a chunkable value type. TypeCheck DOES have a forwarding mechanism for exactly
this - `canForwardByName` (TypeCheckTraversal ~2253) threads `__internal__valueWitness_*` from the caller - but
only when the CALLER declares a same-named parameter. The generated route never touches that collection itself,
so it declares no witness and the call is one argument short.

Bug 2 is now FIXED and landed (commit 048f2886), in three coordinated parts:

- `forwardInternalReturnOutputIdx` refused to forward anything unless the call site passed EXACTLY the visible
  args. The generated route writes `__internal__msgSenderCategory` itself, so that guard tripped and nothing was
  forwarded. It now forwards the remaining SUFFIX of synthetics.
- the route declares the witness so `canForwardByName` resolves it (the route never touches that collection);
- `visitParameter` accepts the `__internal__valueWitness_` prefix as compiler-owned.

Getting there required instrumenting the throw itself: the call-site probes never fired because
`expectParameters` is reached from the "single overload resolved" path (`TypeCheckTraversal` ~1741), and
`forwardInternalReturnOutputIdx` returned early at its arity guard before any of the interesting logic ran.

A follow-up correction landed as 68aa65a5: the first version of that forwarding counted positionally and
double-forwarded when a route writes a synthetic AND omits a visible argument (it regressed a transient-slot
layout test). The rule now forwards exactly the trailing synthetics needed to reach the callee's arity and
refuses when one of them is already an argument, so the ordinary arity error surfaces instead of being masked.

### Bug 3, the next one in the queue

```text
Found parameters (string,string,string,bytes32,bytes32) in call to '__message_bus_entry_updateMeceTag'
where parameters (string,string,string,string,bytes32) were expected
```

Same argument COUNT, wrong types: the route passes three visible strings and then two `bytes32`, while the clone
expects a FOURTH string. With the corrected forwarding the call is `(string,string,string,bytes32)` against an expected
`(string,string,string,string,bytes32)` - one VISIBLE argument short, not a synthetic problem.

Measured at the bind site, the clone for `updateMeceTag(string shortForm, string longForm)` is:

```text
bind time:  [string shortForm, string longForm, string __message_bus_ek___message_bus_key_meceTags_0]
            ordered = [meceTags/__message_bus_key_meceTags_0]        (ONE key)
route args: sourceCallArgs = 2 decoded strings, physicalEntryArgs = [__message_bus_key_meceTags_0]
final:      the clone ends up with FOUR visible params - a SECOND string entry key added after bind
```

The missing argument is NOT a second entry key. Dumping the clone's final signature shows the extra parameter is
PREPENDED, not appended:

```text
string  __cj___message_bus_entry_updateMeceTag_0     <- prepended collection-journal pool parameter
string  shortForm
string  longForm
string  __message_bus_ek___message_bus_key_meceTags_0
bytes32 __internal__msgSenderCategory
```

The entry clone sets `forceCollectionJournalPool = true`, which sends it down the `multiCandidates` branch of
`LowerCollectionJournalHelpers` (~line 260) and gives it a `__cj_<fnName>_<n>` journal parameter in leading
position. The generated route's call site is never rewritten to supply it, so the call is one leading argument
short. A `parameters.push` interceptor on the clone caught nothing, which is what pointed at a prepend/reassign
rather than an append.

Chasing it further shows the cause is SYSTEMIC rather than one missing rewrite. `LowerCollectionJournalHelpers`
keys everything on `name/arity`:

```text
registration      multiCandidates.set(`${fn.name}/${fn.parameters.length}`, ...)      (~261)
function side     multiCandidates.get(`${fn.name}/${fn.parameters.length}`)           (~295)
cache             activeMultiCaches.get(`${fn.name}/${fn.parameters.length}`)         (~601)
call site         multiCandidates.get(`${call.identifier.name}/${call.parameters.length}`)  (~365, ~468)
```

Arity MUTATES as synthetic parameters are injected, and a compiler-generated route writes some synthetics at the
call site itself. Measured for `updateMeceTag`:

```text
registered key:  __message_bus_entry_updateMeceTag/3
call-site key:   __message_bus_entry_updateMeceTag/4     -> exact lookup misses
```

so the callee gains a leading `__cj_` journal parameter that its call site never supplies. Making the call-site
lookup fall back to a name-unique match clears the arity error and then trips
`Missing function-scoped collection journal`, because `activeMultiCaches` is keyed the same stale way; pointing
the function-side lookup at the same resolver does not help either, since the cache key is built while visiting
the CALLER.

FIXED and landed (commit fccd6143): one resolver per candidate map - exact key first, then a by-name match when
the name identifies exactly one candidate AND the call carries at least as many arguments as the registered
arity. That second condition is what keeps an under-supplied call failing (it is malformed for another reason),
and the per-function cache is now keyed by the function NODE, which cannot go stale. Compiler suites unchanged
at the 4-failure baseline.

### Bugs 4 and 5 - FIXED and landed (commit b79a7cee)

- `__internal__proxyMasterIndex` was not in TypeCheck's `FORWARDABLE` set, so a generated route could not call
  ANY delegate-marked getter (`owner()` arrived with no arguments against a two-parameter definition). It is
  constant within a delegate execution, exactly like the entries already there.
- entry clones received the route's block layout only when `graphEmissionHandler` was set, which happens only
  for clones whose source carries an effect. An effect-free state writer (`userRefunded`) reached codegen with
  no layout. The assignment is now keyed on the `__message_bus_entry_` name instead.

### Caller-side batching: measured state after 0830cd5e

`publishJobPost` external-call slots, as compiled today:

```text
0 MarketplaceDataV1 arbitratorRegistered  batch=TRUE rows=3   (arbitratorRegistered + meceTags + userRegistered)
1 IERC20            balanceOf             batch=TRUE rows=3
2 MarketplaceDataV1 publishJobEvent       batch=false          <- conditional, occurrence: conditional max=1
3 MarketplaceDataV1 publishJobEvent       batch=false          <- occurrence: loop, no proven bound
```

Three of the five MarketplaceData calls now share one envelope. The two `publishJobEvent` sites do not, and a
master NFT is spendable once, so the transaction still cannot be built.

What blocks each, measured by relaxing one clause at a time:

- BOTH are refused by the expression-argSource clause. Relaxing it (measurement only, reverted) moves the batch
  to `rows=4`, absorbing the `conditional` one. The covenant side is already capable here:
  `emitCompleteExternalBatchBlob` passes `row.parameters[i]` - the AST expression - to
  `emitExternalBatchArgSource`, so it encodes live values. The gap is that the SDK must build the SAME bytes
  off-chain and `_resolveExternalArgs` has no `expression` case.
- The remaining site is `occurrence: loop` with no proven bound (`maximumOccurrences: undefined`), so even with
  expressions admitted it stays out of the group.

Do NOT land the expression relaxation on its own: the compiler would emit a batch the SDK cannot construct,
turning a clean refusal into "expression-based argSources that cannot be auto-resolved" at build time.

The SDK-side answer is trace-derived blobs, and the shape is already established in this codebase. The covenant
compares its accumulator against the callee's input push with `OP_EQUALVERIFY` inside
`emitExternalBatchBlobVerification`, so a probe carrying a placeholder blob leaves the EXPECTED blob as the
other operand - exactly how `extractCommitmentMapFromTrace` reads an expected commitment beside the actual one.
A new `extractBatchBlobFromTrace` plus a rebuild pass would close it. There is no such path today (searched).

Concrete anchors for that work, all confirmed:

```text
StatefulContract.ts ~8988   throws "expression-based argSources that cannot be auto-resolved"
                            -> must instead build a PLACEHOLDER-arg row and flag the route for derivation
StatefulContract.ts ~9147   createCompilerRouteUnlocker(route.abiFunction, route.selector)(...route.args)
                            -> the rebuild point once the real blob is known
GTT ~21648                  emitExternalBatchBlobVerification: the accumulator is compared against the
                            callee's input push; a probe carrying a wrong-size placeholder still leaves the
                            EXPECTED blob as the other operand, because the caller computes it from live values
                            regardless of what the callee input carries
```

Blob size is variable (expression args have unknown encoded length), so unlike a 32-byte commitment the
placeholder cannot be pre-sized. That is fine for derivation - the caller's computed value does not depend on
the callee's input - but it does mean the rebuild changes transaction size, so the derive/rebuild loop has to
re-run funding like the other derivation passes do.

IMPORTANT: the SDK feature and the compiler's expression-clause relaxation must land TOGETHER. Either alone
makes things worse - the compiler alone emits batches the SDK cannot build, the SDK alone is unreachable code.

### The dependency that splits this problem in two (found while implementing)

Blob derivation alone is NOT sufficient, and this is the thing to design around. Row arguments do more than fill
blob bytes: `handler.batchKeyWitnesses` reads entry keys straight out of the resolved `args`
(`StatefulContract.ts` ~12784). Those keys decide WHICH entry NFTs the SDK co-spends. A placeholder argument
therefore co-spends the wrong entry, and no amount of after-the-fact blob derivation repairs that - the
transaction was assembled around the wrong UTXOs.

But the two roles separate cleanly, and for this contract they fall on different arguments:

```text
publishJobEvent(uint256 jobId_, JobEventData memory event_)
  arg0  jobId_  = jobs.length - 1        -> feeds the jobEvents[jobId_] ENTRY KEY. Must be known off-chain.
  arg1  event_  = JobEventData(...)      -> only blob bytes. Contains encodeString(...), a contract call.
```

arg0 is a PURE expression over caller state - `binary(-, unary(.length, state('jobs')), literal(1))` - and the
serialized argSource already carries that AST (`{kind:'binary', operator:'-', left:{kind:'unary',
operator:'.length', expression:{kind:'state', name:'jobs'}}, right:{kind:'literal', ...}}`). A small evaluator
over the pure node kinds (state/.length/literal/binary/cast/source) resolves it from state the SDK can read.
arg1 needs `encodeString`, a contract function, and can only come from the trace.

So the real shape is:

1. evaluate the PURE subset of expression argSources off-chain, which is what entry-key selection needs;
2. derive the remaining blob bytes from the probe (the extractor sketched above - scan for the `SCB1` magic,
   take the longest match, skip the placeholder);
3. refuse a batch only when a KEY-feeding argument falls outside the pure subset.

That last rule is what keeps it sound: an unresolvable key is a genuine refusal, not something to paper over.

### CURRENT FRONTIER: the transaction composes; a source-level `require` now fails

As of 3b12109c all five MarketplaceData calls share ONE envelope and the focused test reaches a different
failure. The trace is no longer a covenant structural check:

```text
ip=3 OP_ROLL   ip=4 OP_NOT   ip=5 OP_IF   ip=6 OP_0   ip=7 OP_VERIFY   <-- fails
     stack carries the signer's P2PKH (76a914a554...)
```

`OP_NOT; OP_IF; OP_0; OP_VERIFY` is the lowering of a source `require(cond)` whose condition was FALSE. So the
batch executes and the contract's own logic rejects it - the machinery is composing correctly and something in
the batched RESULT is wrong.

The likely candidate is `require(marketplaceData.userRegistered(msg.sender), "not registered")`
(MarketplaceV1.sol:309): the test registers `user1` first via `registerPublicKey`, so that require should pass.
A batched call returns its value through `__message_bus_results`, so the thing to check first is whether the
result decoding lines up with the row order now that five rows share the envelope - a shifted or mis-decoded
result would read `false` for a registered user.

Reading further into the trace pins it down. Just before the require:

```text
ip=37 OP_1   ip=38 OP_SPLIT   ip=39 OP_SWAP   ip=40 <push 0x51>   ip=41 OP_EQUAL   -> FALSE
     the value being split is 00000000, so the decoded byte is 00 against an expected 0x51
```

So a batched row's BOOLEAN RESULT decodes to zero. The require is not rejecting a legitimately false value - the
result slot is unset. A neighbouring `ffffffffffffffff00` on the stack reads like a -1/unset sentinel.

`__message_bus_results` is produced by the CALLEE route, which concatenates `abi.encode(...)` per row
(`compiler.ts` ~2777-2793); the caller decodes it by offset. There is no `resultConsumers` handling anywhere in
`packages/solidcash/src` - the consumption is entirely covenant-side, so the value has to arrive through the
callee's return event.

That points at derivation: the SDK precomputes a return commitment only for a NON-writing callee
(`nested.hasReturnValues && !childWritesState` -> `_deriveReturnValue`). A five-row envelope that includes
`publishJobEvent` writes state, so `childWritesState` is true and no precomputed return is produced - leaving
the return event carrying zeros, which is exactly what the decode sees.

Next step: derive the batch RESULTS BLOB for a state-writing envelope from a VM probe (the same trace pattern
used for commitments) instead of skipping the return-value derivation whenever the callee writes. Check
`StatefulContract.ts` around the `precomputedReturnCommitment` computation.

### What remains, in dependency order

**1. `meceTags` - the last of the five calls. Both routes are FEATURES, measured:**

- Admitting keyed mapping getters (deleting the `collection || ...` exclusion in `compiler.ts` ~1848 for
  parameterised mapping getters) looks like a pure cost decision from its comment. Route synthesis then fails
  with `Expected variable '__internal__state_write_jobs' does not exist on the stack`.

  IMPORTANT, and it changes the shape of this item: that failure is in **MarketplaceV1's** route synthesis, not
  in MarketplaceDataV1's. Confirmed by tagging the rung diagnostic with the primary contract
  (`primary: 'MarketplaceV1'`), and `jobs` is `JobPost[] public jobs` on MarketplaceV1 (MarketplaceDataV1 has no
  `jobs`). So the getter admission does not break the getter's own contract - it widens admission enough that a
  SEPARATE, pre-existing codegen fragility in MarketplaceV1 fires, and the ladder then falls back far enough to
  drop MarketplaceDataV1's route too.

  Mechanism, traced (`GenerateTargetTraversal` ~3196):

```text
candidateJournalSlots = journalSlotsByFunctionId[fn.functionId]
invokesJournalHandler = any invoked id has journal slots
activeJournalSlots    = isDefineSubTraversal || invokesJournalHandler ? candidateJournalSlots : []
journalSettlementActive = !isDefineSubTraversal && activeJournalSlots.length > 0
```

An ORDINARY entry point that merely INVOKES a journal handler therefore takes journal context and settles it at
the end. `emitExternalCallVerification` runs in the EPILOGUE - after that settlement has popped
`__internal__state_write_<table>` - and `emitReadStateArrayBlob` then asks for a slot that is gone. Widening
admission gives MarketplaceV1 more journal handlers to invoke, so an entry point that both journals `jobs` and
carries a loop-array external call over it crosses that boundary.

The fix is an ORDERING question in GTT (verify external calls before journal settlement, or keep a table the
epilogue re-reads out of the settled frame), not a predicate tweak. Do not patch it blind: getting this wrong
produces a covenant that reads the wrong stack slot rather than a compile error. Tried the admission and
reverted it.
- Serving the read as a cross-contract STATE READ instead of a call would be the principled shape (a pure read
  should not consume the callee master's single spend - external reads co-spend DATA NFTs read-only). But
  `ExternalOutStateAbi` carries only `requiredDataNftIndices`: there is no cross-contract C2 mapping ENTRY read.
  Adding one needs the entry-NFT co-spend plus its inclusion proof against the callee category.

**2. Caller-side `directCalls` gate - the answer is now definitive: these calls are genuinely CONDITIONAL.**

Widening the collection to every unconditionally-evaluated call (walk each top-level statement, never descend
into `BranchNode`/`WhileNode`/`DoWhileNode`) does NOT admit them, and the source says why:

```solidity
if (arbitrator_ != address(0)) {                       // MarketplaceV1.sol:236
    require(marketplaceData.arbitratorRegistered(arbitrator_), ...);
}
for (uint8 i = 0; i < tags_.length; i++) {             // :250
    if (bytes(marketplaceData.meceTags(tags_[i])).length != 0) { ... }
}
```

So the gate is doing its job, and the earlier "relaxing it yields rows=5" measurement was relaxing it PAST the
conditionality guarantee, not merely past an AST-position quirk. Batching these needs **conditional batch
rows**: a row the envelope may or may not carry.

CORRECTION to an earlier claim in this file: the accumulator is NOT path-sensitive. Reading
`emitCompleteExternalBatchBlob` (GTT ~21510) settles it - the blob is built ONCE from the STATIC row list, with
`rows.length` emitted as a constant header byte and `for (const row of rows)` emitting every row's prefix and
args at a single site (`canRebuildExternalBatch` even short-circuits to `logicalIndex !== 0` so later source
sites append nothing). So the covenant always builds the full N-row blob, and the callee must always execute all
N rows. An untaken branch does not "contribute no row" - it contributes a row whose arguments were never
computed.

That makes conditional rows a real envelope feature, not SDK-side prediction:

- `arbitratorRegistered` is only reached when `arbitrator_ != address(0)`. Forcing the row always is arguably
  harmless for a view, but its argument must still be materialized on the untaken path.
- `meceTags` is called once per `tags_[i]` inside a `for` over a RUNTIME length, so the row COUNT is dynamic.
  The envelope header encodes the count as a compile-time constant, so this cannot be expressed at all today.

Closing this needs a dynamic/conditional row encoding in the v1 envelope (runtime row count, per-row presence),
which is protocol work on both the covenant and the SDK. The `directCalls` widening prototype was reverted: it
is a real improvement for calls in a `require(...)` or an initializer, but it does not advance this test.

**3. SDK must use the callee's DELEGATE-variant route** when the callee is a proxy. The route now exists on
`artifact.delegateArtifact.messageBus`, not on the main artifact, and `_buildRepeatedExternalBatch` reads
`externalContract.inner.artifact.messageBus`.

### The callee-side wall is BROKEN (commit 5d68713e)

`MarketplaceDataV1` now builds its delegate variant WITH a message-bus route and **31 of 46 handlers eligible**,
up from 1. Of the four `publishJobPost` needs:

```text
publishJobEvent       eligible
userRegistered        eligible
arbitratorRegistered  eligible
meceTags              collection-state-getter-route-not-enabled   <- last one
```

Two changes, both now landed rather than prototyped:

- drop `DELEGATE` from `disallowedModifiers` ONLY when `autoDelegate` is set, and let the variant compile keep
  the caller's `messageBus` setting. In that variant every handler already executes in the proxy's state
  context, so the route is itself a delegate route - the uniform frame is exactly what the general refusal
  protects against losing.
- `keyBase` in the entry-slot mapper strips the `_r<n>` per-row suffix as well as the entry-key wrapper, and
  several matches resolve to the LOWEST slot, which is the canonical member of a runtime-alias family.

### Bug 6 - resolved by the above, kept here for the reasoning

```text
Message-bus handler '__message_bus_entry_userRefunded' cannot uniquely map collection 'users'
  handler entry:  key __message_bus_ek___message_bus_key_users_0   ops [read, write]
  candidate 0:    key __message_bus_key_users_sender_0             ops [read, write]   (msg.sender keyed)
  candidates 5..23: keys __message_bus_key_users_0_r0 .. _r7       ops [read]          (per-row, READ only)
```

`userRefunded(address address_)` is `onlyMarketplace` and writes `users[address_]` - keyed by a PARAMETER. The
route reserved exactly one write-capable `users` slot and it is keyed by `msg.sender` (planned from a different
handler, e.g. `registerUser`), plus eight read-only per-row slots. None of them is a param-keyed WRITE slot, so
no normalization of key names can resolve this: the route genuinely did not plan a slot for this access shape.

This is entry-slot PLANNING in `synthesizeMessageBusRoute`, not the mapper. Do not extend `keyBase` normalization
to paper over it - stripping the `_r\d+` suffix would make eight read-only candidates collapse into one match and
silently bind a WRITE to a READ slot.

```text
Found parameters () in call to function 'owner' where parameters (bigint,bigint) were expected
  at Line 116 - a position in the message-bus route generated for 'MarketplaceDataV1'
```

`owner()` is OwnableUpgradeable's getter, called with no arguments, against a definition that now takes two
`bigint`s - the shape of a journal-rewritten signature. Confirmed NOT caused by the fix above: the error is
byte-identical with the by-name fallback constrained off. The likely cause is that a value-returning journal
candidate called in EXPRESSION position is not rewritten - `rewriteStatement` and `visitFunctionCallStatement`
both key off `FunctionCallStatementNode`, while `owner()` appears as a value.

The useful conclusion is that this is a QUEUE OF ORDINARY BUGS in a path that has never been exercised for this
contract, not a protocol wall. Route synthesis for a 46-handler upgradeable contract simply has not been run
before. Each iteration is about 5 minutes (`dvar.mjs`-style `compileFileMulti` on MarketplaceDataV1.sol reading
`artifact.delegateArtifact.messageBus`).

Whether the delegate-route prototype should become the real design is still a decision worth making
deliberately - but "delegate handlers can never host a route" is NOT what the evidence says.

### Why batching is required for CORRECTNESS, not just to satisfy a check

Worth stating plainly, because it rules out the tempting shortcut. The SDK already collapses the five logical
calls onto ONE physical input (`sharedGroupIndex`; groups 0/1/3/4 all resolve to master input 6). That input
executes exactly ONE function. So if the per-slot selector check were relaxed - by using the
`__internal__externalCallSelector` witness instead of the baked constant, which the SDK already pins to the
composed selector - the transaction would be accepted while FOUR of the five calls silently never happened.

That is strictly worse than the current failure. The covenant refusing is correct: the composition really is
wrong. The batch envelope is the only construction in which all five calls actually execute, so handler
admission is not a formality standing between us and a green test - it is the mechanism that makes the
transaction mean what the source says.

The same reasoning kills relaxing `DELEGATE` in `disallowedModifiers`: it would publish a route whose rows
execute in a frame the callManifest does not verify, which the compiler states "would authorize the wrong
owner/output context".

### Is the delegate marking itself wrong? No.

`compiler.ts` ~3930 marks the whole external surface `delegate` for any `solidityImportCompat` contract carrying
an `initializer`. That is not an accident of timing: an OZ upgradeable contract is only usable behind a proxy,
so its main artifact legitimately IS the implementation. `MarketplaceDataV1` is therefore a delegate
implementation by construction, and the question is not "why is it marked" but "can a delegate implementation
host a message-bus route". Today it cannot: the variant compile that owns delegate marking explicitly disables
the message bus (`variantOptions = { ...opts, autoDelegate: true, messageBus: false }`) because route synthesis
would otherwise clone handlers before their covenant shape is rewritten, "producing an invalid hybrid artifact".

### Measured: what actually blocks batching

Everything below is measured, not inferred. Experiments were reverted; only the one real fix was kept.

**Gap 1 - caller-side eligibility (open).** The `eligible` predicate feeding `batchInvocations` in
`SymbolTableTraversal` (~line 2290) refuses these slots. Relaxing ONLY the expression-argument clause changes
nothing. The deciding clause is:

```text
&& (directCalls.has(slot.sourceCallNode!) || (slot.addressSource && slot.hasReturnValues))
```

`directCalls` is built from `node.body.statements` alone, so it admits only unconditional TOP-LEVEL statement
calls. Every MarketplaceData call here sits inside a `require(...)`, an `if`, or a loop, and none has an
`addressSource`. Relaxing that clause (with the expression clause) does produce exactly the composition the
transaction needs:

```text
0 MarketplaceDataV1 arbitratorRegistered  batch=true rows=5   <- all five collapse into one envelope
1 IERC20            balanceOf             batch=true rows=3
```

Whether conditional calls are sound to batch still needs a decision. The caller's covenant accumulates the blob
along the executed path (`externalBatchAccumulator`), which suggests conditional rows are representable, but
that was not verified.

**Gap 2 - callee-side route synthesis (FIXED, commit 02f1db00).** `MarketplaceDataV1` previously had no
`messageBus` capability at all: every admitting rung of the ladder died on OZ SafeERC20's
`address(token).functionCall(data)`. Root cause was `InlineReturningStateHelpers` collecting `freeFnRefs` from
`FunctionCallNode` only, so a `using L for T` member call (a `MethodCallNode`) left no reference and
`Address.functionCall` was dropped. `visitUsingForDirective` then treats a known library with no registrable
functions as a NO-OP binding, so the receiver could not resolve. Invisible in a direct compile, where
`_callOptionalReturn` is itself inlined away; fatal once a route makes it survive. The route now synthesizes.

**Gap 3 - handler admission (open, and this is the real wall).** The route exists, but only 1 of 46 handlers is
admitted. The four `publishJobPost` needs:

```text
publishJobEvent      lifecycle-or-unsafe-handler
userRegistered       lifecycle-or-unsafe-handler
arbitratorRegistered lifecycle-or-unsafe-handler
meceTags             collection-state-getter-route-not-enabled
```

Histogram over all 46: `lifecycle-or-unsafe-handler` 30, `collection-state-getter-route-not-enabled` 8,
`batched-handler-forward-call-not-enabled` 3, `collection-helper-route-not-enabled` 2,
`collection-route-requires-one-parameter-keyed-entry-per-collection` 1, `not-examined-by-route-synthesis` 1,
eligible 1.

`lifecycle-or-unsafe-handler` fires because those functions carry the auto-inferred `delegate` modifier
(MarketplaceDataV1 is an upgrade-proxy implementation) and `FunctionModifier.DELEGATE` is in
`disallowedModifiers` (`compiler.ts` ~line 968). The compiler states the reason for the neighbouring delegate
refusal explicitly: "A delegate executor shares the proxy's state authority rather than owning an independent
participant block. Until the atomic callManifest publishes and verifies that execution frame, advertising the
proxy handler as an ordinary graph edge would authorize the wrong owner/output context."

`collection-state-getter-route-not-enabled` is likewise deliberate: "collection getters remain available as
ordinary entry points; message-bus routes batch state-changing handlers rather than synthesizing a second
getter surface."

**Where the `delegate` modifier actually comes from.** Not `AutoMarkDelegateFunctions` (that runs only in the
variant compile, `autoDelegate: true`, which also sets `messageBus: false`). It comes from `compiler.ts` ~3930,
in the MAIN compile:

```text
if (solidityImportCompat && contract has any function with an `initializer`/`reinitializer` custom modifier) {
  for every externally callable function: strip view/pure, push FunctionModifier.DELEGATE
}
```

`MarketplaceDataV1 is OwnableUpgradeable` with an `initializer`, so EVERY public function is force-marked
delegate - including the `view` ones, whose VIEW modifier is stripped and replaced by `sourceReadOnly`. Since
`DELEGATE` sits in the message-bus `disallowedModifiers`, the consequence is categorical: **an OZ-upgradeable
contract can never advertise message-bus handlers.** That is an interaction between two features, not a single
deliberate decision, and it is the reason 30 of 46 handlers are refused.

### Three candidate paths, in increasing order of how much they change

1. **Treat the read-only calls as external READS, not calls.** Three of the five (`arbitratorRegistered`,
   `userRegistered`, `meceTags`) are declared `public view` in the source; only `publishJobEvent` writes, and
   its two callsites share one selector and one `requiredDataNftIndices`, so they group as an ordinary 2-row
   batch. If cross-contract public-getter reads lowered to the existing external-read machinery
   (`externalReadSlots` / `emitExternalReadVerification`, a read-only co-spend that verifies commitments without
   the callee executing anything) rather than to external CALLS, the whole conflict dissolves. Note the
   force-marking above strips their `view` modifier, so this path likely needs `sourceReadOnly` respected at the
   call site. This is the most promising path and the least protocol surface.
2. **Admit delegate handlers as message-bus rows.** Needs the atomic callManifest to publish and verify the
   delegate execution frame; the compiler's own comment says advertising them without it "would authorize the
   wrong owner/output context". Do not simply remove `DELEGATE` from `disallowedModifiers` - that produces a
   route that authorizes the wrong owner.
3. **Admit collection/mapping state getters as rows** (`collection-state-getter-route-not-enabled`), needed for
   `meceTags` if path 1 is not taken.

Paths 2 and 3 are both required together if path 1 is not viable, since a master NFT is spendable once.

**Path 1 was prototyped and does NOT work as stated - measured, then reverted.** Inferring
`ExternalCallMode.STATICCALL` for a call whose resolved callee is read-only (checking `sourceReadOnly` plus
`view`/`pure`, since the OZ rewrite strips `view`) is sound on its face: `emitStaticCallCommitmentPreservation`
pins the callee's master commitment AND every required data-NFT commitment across the spend, the selector check
is skipped for STATICCALL by design, and the return-event covenant encodes `_Return_<fn>` so the method identity
stays bound. But it moves the conflict rather than removing it:

```text
before: 2 IERC20 balanceOf  batch=true rows=3
after:  2 IERC20 balanceOf  batch=false          <- now three separate IERC20 co-spends
```

`balanceOf` is itself `view`, so it becomes a staticcall and drops out of its own working batch, recreating the
one-spend-per-master problem for the token. Any version of path 1 has to keep read-only calls batchable rather
than diverting them out of the batch path - most likely by making staticcall slots to the SAME callee share one
physical group, which is the same grouping problem as gap 1 in a different place.

Because `publishJobEvent` also WRITES MarketplaceData in the same transaction, note that a staticcall slot and a
writing slot on one shared physical input are mutually contradictory anyway: staticcall demands the callee's
commitments be identical input-to-output, and the write changes them. So the read calls cannot simply be
staticcalls on the shared input; they need to be rows of the same envelope as the write, which is gap 3.

To reproduce the admission picture (about 5 minutes):

```bash
node -e "import('.../packages/solidc/dist/index.js').then(m => {
  const a = m.compileFileMulti('.../.marketplace/contracts/MarketplaceDataV1.sol', {solidityImportCompat:true});
  for (const h of a.MarketplaceDataV1.messageBus.handlers) console.log(h.name, h.eligible, h.rejectionReason);
})"
```

## Build/recompile commands

```bash
yarn workspace solidc build
yarn workspace solidcash build
rm -rf .marketplace/cache/solidcash            # compiler code is NOT in the cache key
node packages/solidhat/dist/cli.js compile --config solidcash.config.ts
```

Marketplace compilation takes 10-15 minutes from a cold cache. Never rebuild `solidc` while a compile or bench
is running: they import `packages/solidc/dist` live.

Faster inner loop for compiler changes that only need the failing root (about 2.5 minutes):

```bash
node -e "import('/Code/cashscript/.worktrees/effectiveacceleration-marketplace/packages/solidc/dist/index.js')
  .then(m => { m.compileFileMulti('<abs path>/.marketplace/contracts/MarketplaceDataV1.sol',
  { solidityImportCompat: true }); })"
```

The focused test is:

```bash
env NODE_OPTIONS=--max-old-space-size=2048 SOLIDC_DEBUG_ROUTE_CONCISE=1 \
  node node_modules/vitest/vitest.mjs run \
  --config vitest.solidhat.config.ts --no-file-parallelism -t 'post job 1'
```

## Known baseline failures (reproduce on the pre-merge branch commit, unrelated to the merge)

- `test/solidity-compat/yul-evm.test.ts`: 2 failures, both `external call target address must be a
  constructor/function parameter or self-pinned state value (target '__raw__.__raw__')`. A standalone contract
  calling `SafeERC20.forceApprove` hits the same wall; the marketplace only gets past it through message-bus
  route admission.
- `test/journal-message-bus/`: 3 failures (`BoundedCollectionIteration`, `MessageBusVerifierSize`,
  `ScalarJournal`).
- `test/e2e/UpgradesDeployProxy.test.ts`: 2 failures (delegated C2 mapping INSERT refusal, returning external
  call from a delegated implementation). The neighbouring `materializes a returning external call to another
  deployed proxy` is skipped and is the small-scale form of the proxy composition this branch needs.

## Temporary diagnostics to remove before completion

- `packages/solidcash/src/stateful/StatefulTransactionBuilder.ts`: VM trace ring widened from 16 to 520; restore it.
- `packages/solidcash/src/stateful/StatefulContract.ts`: `route-derive-start`, `root-dynamic-chunk-scan`,
  repeated-route witnesses, `fake-token-data-after-send`, and other `SOLIDC_DEBUG_ROUTE*` diagnostics.
- `packages/solidc/src/generation/GenerateTargetTraversal.ts`: route/batch diagnostics, including the
  `publishJobPost`-specific ones in `emitSlotMasterIndex` and `emitExternalCallVerification`.

```bash
rg -n "SOLIDC_DEBUG_ROUTE|root-dynamic-chunk-scan|route-derive-start|fake-token-data-after-send" \
  packages/solidc packages/solidcash
```

## Completion criteria

- The original marketplace source and tests remain unchanged.
- The focused `post job 1` test passes natively on BCH.
- The full unchanged `.marketplace/project/test/marketplace.test.ts` suite passes, aside from explicitly
  unrelated baseline failures if any are encountered and documented precisely.
- Temporary tracing is removed and the trace ring restored.
- Relevant package builds pass.
