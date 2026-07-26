# Message-bus completion ledger

Status: ACTIVE IMPLEMENTATION LEDGER. This document prevents the bounded Layer-3 prototype from
being mistaken for completion of the general invocation-transcript design.

Target: the full synchronous message-bus semantics described by
`buffered-state-and-message-bus-research.md`, `compiler-hidden-batch-v1.md`,
`invocation-transcript-v1.md`, and `balanced-block-layout-composability.md`, excluding sharded/faceted
contracts as previously scoped. Although `invocation-transcript-v1.md` was originally marked a
deferred candidate, completing the full specification adopts its semantic requirements as the
implementation target. Wire bytes remain revisable until the measurement and review gates pass.

The implementation-grade continuation order, code anchors, invariants, and
definition of done are maintained in `message-bus-opus-completion-handoff.md`.
External review and product-demand evidence are graduation gates, not reasons
to stop the remaining technical implementation.

Evidence labels:

- **PROVEN**: implemented and covered by a hostile BCH-2026 VM test.
- **PARTIAL**: a bounded implementation exists, but it does not cover the normative semantic class.
- **MISSING**: no conforming implementation exists.
- **PROCESS**: cannot be established only by an in-repository implementation.

## 1. Owner-local journal and hidden batching

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| One authenticated owner authors each state output | PROVEN | Existing stateful covenant and journal VM suites. |
| Read-your-writes and exactly one final flush | PROVEN for shipped journal shapes | Scalar and collection journal suites. |
| Stateful helpers are callable without forced body duplication | PROVEN | Releases 1-3 compiler tests and size regressions. |
| Bounded direct/mutual recursion fails closed when unsupported or over budget | PROVEN | Release 2 compiler/VM diagnostics. |
| Mapping, fixed-array, bytes/string, dynamic-array and token-effect journal behavior | PARTIAL | Supported shapes pass; dynamic cold keys and runtime-varying aliases remain conservative. |
| Canonical local batch with exact row consumption | PROVEN for R4 eligibility | SCB1 positive and hostile VM tests. |
| One repeated external owner consumed once | PROVEN for R5 eligibility | Whole-blob positional binding and caller/callee tests. |
| Standard `msg.sender`-authorized ERC-20 allowance behavior | PROVEN for the admitted two-row class | `transferFrom` debits `allowance[from][msg.sender]` and `transfer` debits `balances[msg.sender]`, both keyed by the graph-authenticated caller with no spender parameter; substituting either witness fails in the BCH-2026 VM. Wider row counts and handler shapes remain out of the admitted class. |

## 2. General transcript agreement and authority

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| One canonical transcript shared by every participant | PROVEN for generated bounded layouts | Controller-attested execution root and participant reconstruction tests. |
| Owner input LBC/category/capability and exact executor are transaction-bound | PROVEN for current generators | Participant/controller hostile VM suites. |
| One physical owner input and settlement authority per logical owner | PROVEN for current generators | Duplicate/injected participant negatives. Must remain invariant under the general graph builder. |
| Authenticated parent-derived `msg.sender` | PROVEN for peer mode and current transcript rows | Co-spent caller-master VM tests. |
| Invocation/resource/effect/event exhaustiveness | PARTIAL | Current fixed layouts are exhaustive; the candidate's general tables and streaming parser are not implemented. |
| Exact participant-table, resource-table and row structural validation | PARTIAL | Generated fixed-shape covenants replace general parsing; no variable-table implementation exists. |
| Version negotiation and bounded immutable compatibility | MISSING | No deployed-version interoperability mechanism or measured retention bound. |

## 3. Handler execution semantics

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| Direct wrapper and transcript wrapper invoke the same compiled business handler | PROVEN for admitted graph handlers | `Layer3ReleaseA.test.ts` also pins state-layout equivalence between the direct and hidden-batch compilations of one contract.  The graph path executes the compiler-owned SCB1 route and original handler. Compiler-evaluated external-call expressions execute at their reached callsites and exact-row substitution fails in the BCH-2026 VM. |
| Arbitrary eligible scalar/mapping/collection method bodies execute against one journal | PARTIAL | Several handlers over one collection share one entry-slot union and journal pool (`Layer3 Release B`), with compiler-supplied entry identity. A cloned handler now threads scalar state and multiple collection values through one call without cross-journal corruption. Dynamic/chunked resource classes remain narrower than the normative class. |
| Modifiers, `require`, `revert`, and normal control flow preserve source semantics | PROVEN for the admitted handler class | `Layer3ReleaseA.test.ts` settles a `msg.sender`-authorizing modifier, string and custom-error `revert`, `while`, `do/while`, `break`, `continue` and early return on the BCH-2026 VM, each paired with a hostile case of identical transaction shape - a different authorized caller, a reached revert, or an off-by-one settlement. Handler shapes outside SCB1 eligibility are unchanged and still fail closed. |
| Calls dispatch by selector and canonical ABI arguments | PROVEN for the admitted non-returning static call class | Compiler-derived native rows bind exact selector/argument prefix. |
| Producer-authenticated ABI return values | PROVEN for one common scalar return | Compiled producer results are bound through return-event vectors and invocation bytes; forged producer commitments fail in the VM. Multiple/heterogeneous returns remain. |
| Result-dependent continuation and transitive result chains | PROVEN for the admitted scalar class | The compiled `A.plusOne -> B.twice` fixture consumes authenticated `4`, resumes A, and authenticates A's derived `5`. General native worklist derivation still rejects returns. |
| Logical callbacks and `A -> B -> A` execute each handler exactly once | PROVEN for admitted compiled scalar handlers | The stateful compiled cycle executes and flushes each physical owner once; forged post-state fails. General callback shapes remain narrower than the specification. |
| Staticcall snapshots and runtime-enforces no writes/effects | PROVEN by compile-time immutability for admitted staticcall | The compiler derives call mode and admits only a target proven read-only; the transcript binds that mode. Runtime dirty/effect snapshots for broader targets remain missing. |
| Existing pinned one-hop delegatecall semantics | MISSING from transcript mode | Transcript derivation rejects call modes. |
| Correct `msg.sig`, `msg.data`, `msg.value`, `outState`, and transaction introspection | PARTIAL | Logical `msg.sender`, `msg.sig`, canonical `msg.data`, and single-invocation settled `msg.value` are VM-proven. `outState`, aggregate value attribution, and the full introspection table remain. |

## 4. Compiler analysis and automatic derivation

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| Compiler emits handler IDs, state regions, calls, result dependencies, effects and boundedness | PARTIAL | Existing ABI metadata covers calls/arg sources and state footprints, not the complete transcript summary. |
| Impossible call/result cycles and duplicate authorities fail at compile time | PARTIAL | Existing physical resolver and supported Layer-3 shapes fail closed; no full SCC/result-dependency analysis. |
| SDK expands a graph, reuses owners, stabilizes resources and acquires each input once | PARTIAL | Fixed-layout/preorder native derivation exists; no general symbolic worklist. |
| Direct, repeated and transitive calls derive without hand-authored rows | PROVEN for admitted class | `deriveNativeExternalCalls` runtime-branded tables and VM tests. |
| Expressions, dynamic targets, loops, function pointers and batches | PARTIAL | Compiler-owned graph execution proves transformed expression arguments, conditionals, and counted-loop occurrence. `derive-native.ts` still rejects expressions, dynamic targets, loops, pointers, and batches. |
| Returning, opaque, signature-bearing and low-level calls | MISSING | Explicitly rejected or not representable. |
| Final complete VM probe for every input | PARTIAL | Individual builders/tests probe; no single production general-graph send gate. |

## 5. State, resources, effects and events

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| Every dirty resource has one authenticated transition; clean resources are preserved | PROVEN for current balanced typed resources | Hostile state/value/token/capability tests. |
| Mapping insertion/deletion and dynamic chunks use existing backend proofs | PARTIAL | Insertion on a cold key, nested mappings with dynamic keys, and `delete m[k]` are admitted; `Layer3ReleaseA.test.ts` settles a delete as the entry default and rejects a settlement that leaves the value in place. Scalar-plus-collection cloned handlers now settle with independent hostile checks for both post-state classes. Chunked values, dynamic arrays, token containers and runtime-varying aliases remain. |
| Ordered ERC-20 transfer/transferFrom/mint/burn/approve semantics | PROVEN for the admitted handler class | All five handlers settle through the compiled graph with hostile BCH-2026 negatives: `transfer`/`transferFrom`/`approve` on the caller key, `mint` on balance-versus-supply disagreement, `burn` on an insufficient holder balance. *Ordered* is now covered too: `Layer3CompiledGraphController.test.ts` settles two different handlers over one collection in one owner batch and rejects a batch that omits the second handler's effect. Handler shapes outside SCB1 eligibility still fail closed. |
| Satoshi/token effects bind recipient, value/category/capability/amount | PROVEN for current fixed effect slots | Balanced criteria and review regressions. |
| Event identity/topic/data and exact occurrence are authenticated | PARTIAL | Current bounded event rows and standard event NFT are proven, and `Layer3CompiledGraphController.test.ts` now settles a three-argument event and rejects both a reordering of its arguments and publication under a second declared topic of identical arity. Non-scalar argument types and more than one event per handler are still unproven. |
| Event NFT is a standard 1,000-satoshi balanced output and permissionlessly spendable after 144 blocks | PROVEN | Standard-policy and event lifecycle VM tests. |
| No OP_RETURN is required for journal transport | PROVEN as design/implementation choice | Balanced event-NFT layout. |

## 6. Balanced composability

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| Each contract block has equal input/output slot count | PROVEN for current generator | Balanced layout criteria suite. |
| Funding inputs fill output-only semantic slots | PROVEN | Balanced transaction builder tests. |
| Input-only proof slots pair with 1,000-satoshi change outputs | PROVEN for admitted slots | Balanced layout tests. |
| Final funding input covers the remaining fee and final output is change | PROVEN in fixtures | Standard-policy/regtest harness. |
| Blocks relocate and compose without global hard-coded indices | PARTIAL | Base arithmetic exists; all participants still share a precomputed global layout rather than independently relocatable artifacts. |
| Multiple heterogeneous blocks, cycles, resources, effects and events compose together | PARTIAL | Separate fixtures exist; no general builder proves arbitrary admitted combinations. |

## 7. Limits, deployment and review

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| BCH-2026 only and standard-policy compliant | PROVEN for current fixtures | BCHN regtest standard-policy suite. |
| Concrete parser/covenant overhead and realistic corpus fit measured | PARTIAL | Fixed generators have pinned costs, and cross-function outlining brought the caller-authorized token to 4,506 redeem bytes and the five-function corpus ERC-20 inside the 10,000-byte limit at 4,494. Op-cost density is now the closer constraint (N=8 participants sit at 36.5% of budget). The candidate variable transcript parser has still not been built or measured. |
| Participant-count contention/retry behavior measured | MISSING | No empirical stale-outpoint study. |
| Corpus demand justifies freezing the general protocol | MISSING/PROCESS | Requires product evidence, not only tests. |
| Independent covenant review | PROCESS | Review package exists; independent sign-off is absent. |
| Feature default-on | MISSING by design | Must remain experimental until every applicable gate above is closed. |

## 8. Implementation order

1. Reuse the compiler's existing stateful handler lowering as the transcript handler instead of
   generating an arithmetic-only application body.
2. Add a typed invocation-result slot and producer/consumer ABI byte equality, then permit returning
   calls.
3. Replace preorder fixed-slot derivation with an owner-reusing invocation worklist and explicit
   call/result dependency graph.
4. Connect mapping/chunk/container descriptors and runtime staticcall snapshots to the shared
   journal.
5. Lift call-shape exclusions one class at a time, with hostile VM tests for exhaustiveness and
   route equivalence.
6. Make balanced contract blocks independently relocatable and compose arbitrary admitted blocks.
7. Measure the resulting covenant/parser on the proving corpus and complete standard-policy,
   regtest, contention, compatibility, and independent-review gates.

The specification is complete only when every non-process row is **PROVEN**, every process gate has
its required external evidence, and the experimental/default-off marker can be removed without
weakening any invariant.

## 9. Implementation log

### 2026-07-26: Release C dynamic-state authority path measured

The `dynamic-state-batch-journal-not-enabled` boundary was tested by temporarily admitting a two-row
`string` replacement and driving it through the repeated-external-callee SDK on the BCH-2026 VM. Merely
removing the eligibility check is not correct.

Cloning the handler before `LowerDynamicStateJournalHelpers` successfully routes execution through the
existing value-threaded journal, but settlement still fails because an external callee group currently carries
only its master and data-NFT inputs/outputs. A dynamic write additionally requires:

- every old chunk input in canonical order;
- funding inputs for output-only chunk slots;
- the derived new chunk outputs;
- unused balanced slots returned as ordinary 1,000-satoshi change;
- all of those slots included in the callee block's relocation and input/output-base arithmetic.

The failure is covenant-side and fail-closed: the SDK's master/data-only candidate is rejected before it can
publish an incomplete dynamic state. The experiment was reverted rather than advertising an eligible route
which cannot settle.

This also exposes a specification interaction that the next implementation must resolve explicitly. Existing
dynamic storage uses a runtime-variable chunk run immediately after the core block, while balanced composability
requires a block with equal, independently relocatable input/output extent. Release C therefore needs a bounded
per-variable chunk region (or another equally explicit relocatable-span rule), not only an SDK fetch loop. The
mock provider's relaxed input, transaction-size, and operation limits may be used to choose a generous initial
bound; optimizing that bound is a later deployment task.

A second measured probe rules out treating fixed arrays as one scalar data-NFT value. In the current storage
model `T[N]` is a collection with one authenticated entry NFT per index. A route with runtime index `i` therefore
needs a per-row physical entry descriptor and canonical alias/dedup across equal indices. Cloning the handler
through the existing single-entry journal and unrolling the bounded route now implements the equal-index class:
two logical writes to index `i` consume one entry NFT, observe ordered read-your-writes, and flush the second
value once. A BCH-2026 SDK test proves settlement; a second test supplies two different indices and is rejected
as an ambiguous `__scb_key_slots_0` witness before construction. The remaining general class is the same
descriptor-union mechanism as mappings, extended from the current shared-plus-row-local two-entry shape to a
bounded per-row key table; scalarizing the whole array would change the established storage authority and is
rejected.

### 2026-07-26: scalar-plus-collection cloned handlers fixed

The previously guarded shape is now admitted and VM-proven. The callee returned the correct stack:

```text
top -> scalar context, recipient entry value, source entry value
```

The corruption occurred in `visitUserFunctionCall`. The runtime stack already held the declared return tuple
below the returned scalar-journal context, but compiler stack tracking did not add those declared returns until
after replacing caller-owned journal slots. Consequently `emitReplace(getStackIndex(originalName))` addressed
the original scalar slot too shallow by `targetFunc.returnTypes.length`, replaced a collection return, and left
the scalar value to be captured into an entry cache.

The replacement depth now includes the temporarily untracked declared-return count. The compiler-only guard
`cloned-handler-scalar-and-collection-journal-not-enabled` is removed. The corrected balanced fixture uses the
data-NFT-aware entry offset and proves:

- two rows update one scalar and three collection entries;
- a forged scalar post-state fails;
- a forged collection post-state fails.

`HiddenBatch.test.ts` passes 23/23 and `Layer3CompiledGraphController.test.ts` passes 41/41. Investigation
entries below are retained as audit history but are superseded wherever they describe this shape as guarded or
unsettleable.

### 2026-07-26: ROOT CAUSE PROVEN - the scalar value leaks into the entry commitment

`cloned-handler-scalar-and-collection-journal-not-enabled` now has a MECHANISM, established by controlled
experiment rather than by reading code.

Driving the BCH-2026 VM directly (`vm.debug({inputIndex, sourceOutputs, transaction})`, since `tx.debug()`
throws a formatted summary instead of returning states) and identifying the failing operands against known
locking bytecodes shows input 1 failing at state 5481/5483 comparing two 65-byte ENTRY COMMITMENTS for the
`first` key, `slot(first) || slot(second) || value`, identical except the final value byte:

    expected B = ...f340 0a     (0x0a = 10, the correct settled value for `first`)
    computed A = ...f340 51     (0x51 = 81)

The decisive step was varying the scalar counter's genesis and watching the byte track it:

    moves starts 0  ->  after row 0 moves = 1  ->  leaked byte 0x51  (OP_1)
    moves starts 7  ->  after row 0 moves = 8  ->  leaked byte 0x58  (OP_8)

So the entry commitment's VALUE field receives the SCALAR journal's post-row value, minimally script-encoded
as OP_N, instead of the collection journal's value. This is genuine two-journal interference in a cloned
handler. Note it is NOT the "flushes per row" story retracted earlier - nothing is flushed twice; the wrong
journal's value is written into the commitment.

The leak is SCRIPT-PUSH ENCODED, which localises it further. A third data point separates the encodings,
because minimal push encoding diverges from VM-number encoding above 16:

    moves after row 0 = 1   ->  `51`    (OP_1, one byte)
    moves after row 0 = 8   ->  `58`    (OP_8, one byte)
    moves after row 0 = 21  ->  `0115`  (push length 1, then 0x15 - commitment grows 65 -> 66 bytes)

A VM number 21 would be the single byte `15`; the observed `0115` is a minimal script push. That is the SAME
encoding SCB1 row arguments use. So the commitment's value field is concatenating a PUSH-ENCODED element, not
a numeric one.

It is also necessarily a RUNTIME mis-resolution rather than a compile-time literal: the leaked value tracks the
fixture's genesis counter, which the compiler cannot know. Something in the cloned handler's stack layout
resolves the entry value to a push-encoded scalar/journal element.

Where to look next: `emitSortedValueUpsert` in `GenerateTargetTraversal.ts` and its `emitValue` callback, which
visits the assignment RHS. In a cloned handler carrying BOTH journals, that read appears to resolve to the
wrong stack slot. The fix is not yet attempted, so this is a located defect, not a closed one.

This also finally settles `0x51`, which two earlier entries guessed at: it is 81 as a VM number AND OP_1 as a
push, and the ambiguity was real because the leaked value is script-encoded. Both readings were describing the
same byte from different ends.

LOCALISED FURTHER (same day): instrumenting `emitSortedValueUpsert` to dump the tracked stack right after
`emitValue()` shows the two paths diverge, and shows an adjacency that explains the leaked byte exactly.

Direct handler (`fn=move`), stack top-first:

    ["(value)", "(__upsert_hk)", "__internal__state_write_moves", "from", "to", "amount"]     depth 14 -> 15

Batch route (`fn=__scb1`):

    ["(value)", "(__upsert_hk)", "__scb_graph_msg_data", "rowArgs", "__scb_graph_caller",
     "__scb_graph_msg_data", "rowArgs", "rowSelector", "__scb_graph_caller", "__graph_owner_frame",
     "__scb_pushOpcode", "__scb_unlock", "__cj_cache_2", "__cj_cache_1",
     "__internal__state_write_moves", "__internal__graphTranscript", ...]                     depth 36 -> 36

Two facts fall out:

1. `__scb_graph_msg_data`, `rowArgs` and `__scb_graph_caller` each appear TWICE (indices 2/5, 3/6, 4/8). The
   route unrolls two rows and the per-row locals are never popped, so row 0's frame is still live while row 1
   runs. `getStackIndex` returns the FIRST match, so any consumer using a computed offset from these names is
   working against a frame one row deeper than it assumes.
2. `__cj_cache_1` sits at index 13 and `__internal__state_write_moves` at index 14 - ADJACENT. An off-by-one
   resolving the collection journal's cache local lands exactly on the scalar state-write local, which is
   pushdata-encoded. That is precisely the observed leak, and it explains why the value is the whole scalar RHS
   rather than a corrupted collection value.

PARTIAL RETRACTION of the paragraph that followed this in an earlier revision: I concluded from (1) that the
per-row locals are "never popped" and proposed scoping them as the fix. That sub-hypothesis is NOT supported.
`GenerateTargetTraversal` has no `visitBlock`; block-scoped locals deliberately persist until the function-end
`cleanStack`. So two live copies of a row frame in an unrolled route are EXPECTED, and their presence is not by
itself evidence of a bug. The generated source already wraps each unrolled row in its own `{ }`.

What survives from (1) and (2): the adjacency in (2) is a fact, and the leaked value is exactly the element one
slot deeper than `__cj_cache_1`. That is consistent with the tracked stack model holding one more entry than
the real VM stack at that point, which would make a name-based lookup resolve one slot short. But I did NOT
measure the real runtime depth against the model depth, so this remains a hypothesis with a mechanism, not a
demonstrated cause.

MEASUREMENT DONE - the leak is POSITIONAL, and this is now demonstrated rather than hypothesized. Adding a
SECOND scalar state variable to the same handler moves the leak to it:

    scalars: `moves` only        moves 20 -> +1 = 21   leaked `0115` (21)
    scalars: `moves` + `other`   other 40 -> +5 = 45   leaked `012d` (45)

The leaked value followed the newly adjacent scalar rather than staying bound to `moves`. So the collection
journal's cache-local read resolves ONE SLOT SHORT and picks up whichever `__internal__state_write_*` element
happens to sit at that position. It is a positional mis-resolution, not a mis-binding to a particular variable,
and not anything to do with `moves` specifically.

The follow-up measurement was then run, and it REFUTES the depth-divergence explanation offered here. Emitting
a magic marker plus `OP_DEPTH` at the upsert and reading it back out of the VM trace gives:

    compiler model depth at the upsert : 36
    OP_DEPTH from the running VM       : 37  ->  36 excluding the marker

The depths MATCH. There is no missing or extra tracked entry. So "the model holds one more entry than the real
stack" is false, and any fix built on that idea would have been wrong.

ORDERING REFUTED, AND THE REAL CAUSE FOUND. The paired probe was re-run correctly: each upsert emits a marker
carrying a per-call tag, and the compiler stashes its model record under the same tag on `globalThis` (the
compile runs in the test process), so a runtime frame is matched to exactly one model record with no guessing
about which function was caught. For `fn=__scb1`, modelDepth 36 and runtimeDepth 36:

    [9]  model=__scb_pushOpcode              runtime=4c                        (OP_PUSHDATA1)   MATCHES
    [10] model=__scb_unlock                  runtime=<5771-byte SCB1 blob>                      MATCHES
    [11] model=__cj_cache_2                  runtime=05
    [12] model=__cj_cache_1                  runtime=51
    [13] model=__cj_cache_0                  runtime=55
    [14] model=__internal__state_write_moves runtime=00                        (genesis 0)      MATCHES
    [15] model=__internal__graphTranscript   runtime=<1042-byte GRAPH1 blob>                    MATCHES
    [16] model=__internal__graphControllerIdx runtime=08                       (controller idx) MATCHES

The tracked stack model is CORRECT - both depth and ORDER. The ordering hypothesis is refuted, and the earlier
"indices 10-16 do not correspond" note was an off-by-one in the probe's own index arithmetic, not a compiler
fact. Three theories are now dead: per-row flush, missing block pop, depth divergence, plus this one.

The real cause is visible in the same dump. The cache locals hold:

    __cj_cache_0 = 55 = 85   correct settled value for `shared`
    __cj_cache_2 = 05 = 5    correct settled value for `second`
    __cj_cache_1 = 51 = 81   WRONG - `first` should settle to 10

So the stack lookup resolves correctly and `__cj_cache_1` simply CONTAINS the wrong value, which is the
pushdata encoding of the scalar's post-row value. This is a VALUE-THREADING bug in the collection journal
lowering, not stack indexing and not a codegen offset. It lives in `LowerCollectionJournalHelpers`, where the
wrapper threads values into the per-entry cache locals: one entry's local receives the scalar journal's value
instead of its own.

That also explains cleanly why the leak is positional (it follows whichever scalar is threaded, per the
second-scalar experiment) while depth and order are sound, which no previous theory managed to reconcile.

Two further pointers for the fix, both from the same dump:

1. The WRONG local is specifically the entry touched only in ROW 0. `shared` is written by both rows and
   settles correctly (85); `second` is written by row 1 only and settles correctly (5); `first` is written by
   row 0 only and is the one carrying the scalar's value. So the fault is row-0-specific, not generic to
   single-row entries, and any fix should be checked against a 3+ row batch where several entries are
   row-0-only.
2. The rewrite site is `LowerCollectionJournalHelpers` around the `currentMulti && statement instanceof
   MappingAssignNode` branch, which rewrites an entry write to `AssignNode(entry.journalName, expr)` with the
   entry resolved by `multiEntry(statement.name, statement.keys)`. The scalar write is a state assign and
   should never resolve to a journal entry there, so the two things to check first are whether `multiEntry`
   can return an entry for a non-matching statement, and whether the wrapper's capture of row 0's results is
   aligned with the locals it assigns into.

3. LEAD REFUTED BY MEASUREMENT (recorded so it is not chased again). The `multiEntry` name-collision idea is
   WRONG. Instrumenting the rewrite shows the two entry writes resolve to DISTINCT journal entries:

       balances[__scb_ek___scb_key_balances_0]      -> __cj___scb_resource_move_0
       balances[__scb_ek___scb_key_balances_0_row]  -> __cj___scb_resource_move_1

   `from` binds to the non-row-local key (the same address in both rows) and `to` binds to the row-local key,
   which is exactly right. No collision.

   The same probe surfaces the real asymmetry: the CALLEE has TWO journal entries while the WRAPPER allocates
   THREE cache locals (shared, first, second - deduped by key identity across both call sites). `rewriteMultiCall`
   maps them per call site, with `callLocals` ordered by `target.entries` and passed BOTH as leading arguments
   and as the tuple-assignment targets, so the per-call-site mapping is structurally sound.

   That leaves the callee's RETURN ordering as the next thing to measure: when a cloned handler threads scalar
   state ALONGSIDE its journal entries, does its returned tuple stay [entry_0, entry_1], or does the scalar
   value enter that tuple and shift one target? A returned [scalar, entry_0, entry_1] against two capture
   targets would put a scalar into a cache local, which is the observed symptom. MEASURE the returned tuple
   before patching - this is the fourth hypothesis in this investigation and three of the previous ones were
   wrong.

   Superseded text (the refuted idea, kept for auditability): `multiEntry` matches an entry by collection name
   plus KEY PARAMETER NAMES:

       entry.collection === collection
       && entry.keyParameters.length === keys.length
       && keys.every((key, i) => key instanceof IdentifierNode && key.name === entry.keyParameters[i])

   In a cloned handler the keys are the synthetic `__scb_ek_*` parameters introduced by
   `bindEntryKeyParameters`. If two distinct entry writes in one handler bind to the SAME synthetic parameter
   name, both resolve to the same `JournalEntry` and one entry's local never receives its own value. Checking
   this costs one instrumented compile: dump the cloned handler's parameter list and the resolved
   `entry.journalName` for each `MappingAssignNode`. DO NOT patch on this without running that check first.

The fix is NOT attempted. The remaining step is small in surface area but sits on the settlement path, so it
needs a hostile VM test alongside it, not just a green suite. Note the concrete reason that matters here: this
session committed a 38-line guard removal under a docs message and 62 green tests reported nothing, so a green
suite is not evidence that a settlement-path change is sound.

Superseded next step (kept so the reasoning is auditable): compare the tracked `this.stack.length` at the upsert
against the actual VM stack depth at the corresponding instruction pointer in a `vm.debug()` trace. If they
differ by one, the divergence point is the bug. Do not patch scoping on the strength of the duplicate frame
alone - that path is now checked and it is a dead end.

Still true and unchanged: this is stack-frame accounting in the batch route, not a journal-exit design problem,
so the fix should not change either journal's exit behaviour.

SECOND TRAP, worse than the first, and worth reading before any similar investigation: commit a6d602cc was
intended to be docs-only but ran `git add -A` while the guard was still temporarily lifted for probing. It
committed a 38-line REMOVAL of the guard from `compiler.ts` under a documentation message. The next commit then
ran `git checkout -- packages/solidc/src`, which reverted TO that state and made the removal permanent. The
suite stayed green throughout, because the fixture still fails to build for an unrelated reason, so nothing
signalled it. Restored in the following commit. Revert temporary source edits BEFORE staging, and never trust a
green suite to catch an unintended compiler change.

REPRODUCTION: lift the boundary in `synthesizeHiddenBatchRoute`, set `buildScalarPlusEntryBatchGraph`'s entry
offset to `slotIndex + 2`, send the transaction, then diff the operands at the failing state.

TRAP that cost several probes here: the fixture file has FOUR `tokenRouteArgs.push(decoded.slot, BigInt(...))`
sites. A `replace(..., 1)` edits the FIRST, which belongs to `buildCallerKeyedTransferGraph` - a working
fixture whose test was filtered out of the run, so the corruption was silent while the target fixture stayed
untouched. Edit the LAST occurrence, and assert the enclosing function name before editing.

**CURRENT STATE (read this before any entry below).** Entries are append-only and several were later
retracted, so an individual entry is NOT authoritative on its own. As of 2026-07-26:

- `cloned-handler-scalar-and-collection-journal-not-enabled` is OPERATIONALLY JUSTIFIED **and now EXPLAINED**:
  the scalar journal's value leaks into the entry commitment's value field. See the root-cause entry above,
  which supersedes the "traced to the router's first external call" note below (that attribution came from
  `tx.debug()`, whose input index is unreliable; the real failing input is the TOKEN, index 1).
  With the guard lifted and the fixture's entry offset corrected to `slotIndex + 2`, the shape still fails
  BCH-2026 with `mandatory-script-verify-flag-failed` / OP_VERIFY. Admitting it would emit unusable
  transactions, so the rejection is correct to keep.
- The failure is traced to the ROUTER's FIRST external-call verification (`tx.debug()` attributes it to
  `ScalarPlusEntryRouter.scash:3`), NOT conclusively to journal settlement. Calling this a two-journal
  limitation is unsupported by the evidence.
- It is therefore a compiler/codegen defect or an unsupported interaction awaiting investigation. It is NOT
  a fundamental BCH or platform limit, and must not be described as one.
- Recommended next step: trace the router's whole-blob / callee-binding operands before changing either
  journal's exit behaviour. Do not modify journal code on the strength of any diagnosis below.
- Retracted diagnoses are marked `[RETRACTED]` in their headings and preserved for the reasoning trail only.

**Release accounting** (against `message-bus-opus-completion-handoff.md`, which defines exactly ten releases
A-J): A and B are complete with hostile BCH-2026 evidence; C is partial; **D, E, F, G, H, I and J - SEVEN
releases - are unstarted.** An earlier session repeatedly reported "five unstarted", which was a miscount that
understated the remaining work. Some of D-J have partial foundations in the codebase, but none has been carried
to the ledger's PROVEN bar. Row totals as of this entry: 30 PROVEN / 14 PARTIAL / 6 MISSING, of which three
MISSING rows are PROCESS-labelled and cannot be closed by implementation at all.

The remaining work is unfinished but FINISHABLE. Nothing in this ledger establishes that D-J are blocked;
they are substantial engineering that has not been attempted.

### 2026-07-26: [SUPERSEDED] CORRECTION - the two-journal boundary rests on a broken fixture

Superseded: the fixture bug was real, but fixing it did NOT admit the shape. The boundary is justified.
See the current-state block above.

Tracing the VALUE the covenant rejects, instead of reasoning about structure for a fourth time, found the fault
in my own fixture rather than the compiler.

`buildScalarPlusEntryBatchGraph` passed each entry's input offset as `slotIndex + 1`, copied from a token with
no scalar state. This token HAS scalar state, so its data NFT occupies the slot between the owner's master and
its entries and the correct offset is `slotIndex + 2`. The covenant was being told to authenticate the wrong
inputs, and the first thing it rejected was an output-address comparison
(`aa200830e6...` against `aa20f8495d...`).

Correcting the offset moved the failure from VM state 518 of 520 to 5481 of 5483 - the covenant now executes
essentially to completion. That does not by itself prove the shape settles, and the remaining rejection was not
chased to ground before the instrumentation was reverted. What it does mean is that
`cloned-handler-scalar-and-collection-journal-not-enabled` was derived from a fixture that could never have
passed for reasons unrelated to journalling, so the boundary is SUSPECT.

Step 1 has since been run: with the corrected offset the fixture STILL fails, at state 5481 of 5483. So the
offset was one real bug in the fixture and there is a second, separate reason the shape does not settle. The
boundary is therefore not disproven - but it is also not established, because the evidence originally offered
for it was a transaction that could never have validated.

`0x51` was investigated further. The result CORRECTS the paragraph previously written here, which claimed a
specific mechanism on evidence that did not support it.

What is now established:

1. The boundary is JUSTIFIED. With the corrected `slotIndex + 2` offset and the boundary lifted, the shape still
   fails BCH-2026 validation: `mandatory-script-verify-flag-failed`, OP_VERIFY, input index 1. So this is a real
   unsupported shape and failing closed is correct, whatever the mechanism turns out to be.
2. Batch arguments encode as minimal SCRIPT pushes, not raw VM numbers. Verified against known values: the
   amounts 10 and 5 appear in the args blob as `0x5a` and `0x55`, which are `OP_10` and `OP_5`.
3. What `0x51` MEANS is still open. If that stack item is args-derived it is `OP_1`, the number 1. If it is a
   commitment value field it is the number 81, since commitments hold VM numbers rather than pushes. Neither 1
   nor 81 is an intended settled value (85, 10, 5) or the counter (2), so either way it is wrong - but the two
   readings imply different faults. The item sits beside a slot, an entry address and a next-key, which looks
   like a commitment, but that was not confirmed.

An earlier version of this section asserted reading (3) as OP_1 and concluded the scalar journal flushes per row.
That conclusion was retracted: the args decode in (2) is solid, but extending it to the stack item in (3) assumed
the item's provenance instead of checking it.

A later probe LOCATED the failure, which is a better starting point than the state number:

    built.tx.debug()  ->  ScalarPlusEntryRouter.scash:3, input 0, OP_VERIFY
                          IScalarPlusEntryToken(token).move(shared, first, a);

So the rejection is attributed to the ROUTER's verification of its FIRST external `move` call, not to the
token's scalar settle. Note `sendRawTransaction` reports input index 1 while `debug()` attributes input 0;
`debug()` raises on the first input it evaluates, so treat the index as unreliable and the SOURCE LINE as the
signal. This weakens the retracted per-row-flush story further: the first call is already unsatisfied, before
any second row could have flushed anything.

Two readings remain, and they are distinguishable by a cheap experiment: either the router's call-binding check
is itself wrong for this shape, or the callee settles a state the router then correctly refuses. Running the
SAME fixture with a ONE-row batch separates them - if one row also fails, the fault is in the binding for a
scalar-plus-collection callee and has nothing to do with batching at all.

The one-row experiment proposed above was ATTEMPTED and is NOT RUNNABLE on this fixture. Two build-time
constraints bound the shape, and both are worth recording because they narrow where the fault can live:

1. `SCB1 batch row count must be between 2 and 2`. This token's route is unrolled for exactly two rows, so a
   one-row control cannot be built at all. The proposed experiment is therefore dead as written, and any future
   version of it needs a token whose route admits a variable row count.
2. `SCB1 collection witness '__scb_key_balances_0' must identify one physical entry`. The fallback experiment -
   two rows touching DISJOINT entries, to separate journal accumulation from call binding - is also not
   runnable, because row-varying keys at the same key position are themselves an unsupported shape that fails
   closed at build time. This is the row-local key limitation, hit from a new direction.

So within what this fixture can express, the two-row shared-key case is the ONLY runnable shape, and it is the
one that fails at VM. Separating accumulation from binding needs a different fixture, not a different argument.

Not evidence: while running the above I also broke the two-row branch's router arity, which produced
`Incorrect number of arguments passed to function __scb1`. That line is an artifact of my own patch, not a
finding about the compiler. Recorded so nobody mines it later as a result.

Also worth recording as a trap, because it briefly produced a wrong "it settles" result: the fixture BUILDS a
transaction and returns it; VM validation only happens at `sendRawTransaction`. Wrapping the builder alone in a
try/catch passes while proving nothing. This is the construction-versus-validation confusion the handoff warns
about, reached from the positive direction.

Note the method: three rounds of reasoning about stack structure produced two retracted diagnoses, while two
rounds of dumping actual values produced first the offset bug and then this. Trace values.

The boundary is fail-closed, so leaving it in place while suspect costs expressiveness, not soundness. But it
should not be described as a known compiler limitation until step 1 is done. Recorded because I asserted the
opposite twice.

### 2026-07-26: [RETRACTED DIAGNOSIS] the call-site ordering diagnosis was wrong

The entry above claimed the caller's post-`OP_INVOKE` sequence
(`GenerateTargetTraversal.ts:5920`) consumes returned scalar journal copies from the top without accounting for
interleaved entry values. That is NOT what happens, and the claim is retracted.

Instrumenting the returning clone's stack at its return point shows:

```
__scb_resource_move  journalNames ["__internal__state_write_moves"]
stack (index 0 = top) ["__internal__state_write_moves", "(value)", "(value)"]
```

The scalar journal slot is already on top, with the two returned entry values beneath it - exactly the layout
the caller consumes. Callee and caller agree. A patch written against the wrong diagnosis (extending the
returning-subroutine path to "restore" that layout) dropped a real return value instead: route body 1,413 ->
1,362 bytes with the suite still green, which is precisely the silent off-by-N this code invites. Reverted.

Four hypotheses are now eliminated for `cloned-handler-scalar-and-collection-journal-not-enabled`:

1. the `delete` node type - a resource-shaped `move` with a counter fails identically;
2. subroutine-versus-inline settlement - relaxing the inlining exemption changed nothing;
3. the scalar journal failing to reach the caller - it reaches it;
4. return-value/journal-slot ordering at the call site - callee and caller already agree.

What remains unexamined is the VALUE, not the plumbing: which entry value the collection journal computes and
writes back when the same clone also mutates a threaded scalar slot in place. The next step is to trace the
settled entry commitment the covenant rejects against the one the journal intended, rather than to reason about
stack layout again - three of the four dead ends above came from reasoning about structure instead of
observing values.

### 2026-07-26: [RETRACTED] the two-journal bug, "characterised"

Retracted: this entry names a mechanism the evidence does not support. Kept for the reasoning trail.

Third pass on `cloned-handler-scalar-and-collection-journal-not-enabled`, this time with a mechanism rather
than another hypothesis.

Scalar journal slots are threaded to a clone as parameters and mutated IN PLACE on the shared stack -
`visitStateAssign`/`visitDeleteState` call `emitReplace(getStackIndex('__internal__state_write_<name>'))`, and
because BCH-2026 `OP_INVOKE` does not reset the stack, the caller observes the mutation and writes it back in
its epilogue. The clone itself never settles anything.

That is sound for a VOID clone, and the existing evidence agrees: Release A's modifier fixture is a graph clone
with a scalar write and no collection, and it settles. What the collection journal changes is that it makes the
clone RETURN its journalled entry values. So the failing combination is precisely:

> a clone that RETURNS collection journal values while also relying on in-place mutation of threaded scalar
> journal slots surviving that return.

Two fixes follow from this, and both are real work rather than a guard:

1. exclude threaded scalar journal slots from whatever the returning subroutine's return path does to the
   stack, so the in-place mutation still reaches the caller; or
2. widen the collection journal's value threading to carry scalar writes too, so one return carries both and
   nothing depends on in-place mutation.

Eliminated by the two earlier attempts, recorded above: the `delete` node type, and subroutine-versus-inline
settlement. The boundary stays fail-closed until one of the two fixes lands.

### 2026-07-26: second unsuccessful attempt at the two-journal exit (recorded)

Hypothesis: `InlineReturningStateHelpers` deliberately exempts `collectionJournal` helpers from inlining
because their entry writes are threaded as values and they have no settlement to lose. That stops holding when
such a helper ALSO writes scalar state - those writes settle in an epilogue a returning subroutine never
reaches. Relaxing the exemption for that case should make both journals settle in one place.

Result: no change. The full compiler suite stayed green, but the resource-shaped `move` with a counter is still
rejected by the covenant, and `__scb_resource_move` is still emitted as its own function. Either the relaxed
condition never selected the clone, or the call site was already inlining and inlining is simply not the fix.
Distinguishing those needs instrumentation of which call sites `InlineReturningStateHelpers` actually rewrote,
which is the next concrete step. Reverted rather than shipped as unproven change.

Two hypotheses are now eliminated for this bug: the delete node type (first attempt) and subroutine-versus-
inline settlement (this one). What remains is the scalar journal's epilogue write-back itself - the clone
threads `__internal__state_write_*` parameters, and how those reach settlement when the same function also
returns journalled entry values is the thing still unexamined.

### 2026-07-26: the delete boundary was mis-scoped, and admitted a failing shape

The two-row composer built for the mixed-batch proof answered the question the previous attempt could not.

A resource-shaped `move` that also increments a counter - no `delete` anywhere - settles no better than the
delete case: the covenant rejects it. So `scalar-write-with-collection-delete-not-enabled` was not describing
the real fault. It was too NARROW, and admitted handlers that compile but produce a transaction that cannot
settle. Delete was simply where the fault happened to be noticed first.

The rule is now `cloned-handler-scalar-and-collection-journal-not-enabled`: a handler that reaches its
collection through a batch clone runs those writes on the value-threaded collection journal while its scalar
writes stay on the scalar journal, and the two disagree at their exit. Handlers that are not cloned settle both
together, which is exactly why Release A's `mint` and `burn` write a supply counter beside a balance entry and
settle. Sharing one exit between the journals lifts the restriction.

Both the old and the new rule are fail-closed at the VM - the worst case is a transaction that will not
validate, never forged state accepted - but the old one let a user build that transaction believing it would
settle.

### 2026-07-26: Release B mixed batch settles on the VM

Two different handlers over one collection - `move(from,to,amount)` and `bump(who,amount)` - now settle in one
owner batch, and a batch whose shared entry settles as if only `move` had run is rejected. That was the last
piece of execution evidence Release B was missing, so the ordered-ERC-20 row moves from PARTIAL to PROVEN for
the admitted class.

Building it exposed a real SDK gap rather than a fixture problem. A handler with a single mapping access binds
only the shared entry, so an ordered mix leaves the other row's row-local slot unbound by construction - the
route still declares that slot and the covenant still requires it to address a real entry, but no invocation
names it. `encodeHiddenBatch` failed with "Missing SCB1 route witness". The SDK cannot derive that entry
because no row touches it, so `CompiledGraphParticipant` now takes `unboundRouteWitnesses` for exactly this
case. The entry is authenticated like any other; the caller only chooses which one it is.

### 2026-07-26: attempted lift of the scalar-write + collection-delete boundary (unsuccessful)

Recorded so the next attempt does not repeat it.

Hypothesis: since `m[k] = 0` settles beside a scalar write and `delete m[k]` does not, rewriting the delete to
a default-write *inside the batch clone only* should settle while leaving the direct entry point's real delete
(and therefore C2 list semantics) untouched.

Result: no change. The route body stayed 408 bytes against the assign form's 385, so the rewrite never reached
the delete node - at the point the batch route is synthesized the statement is evidently not the
`MappingDeleteNode` the eligibility walk matches later, or it is not reached as a direct child of a visited
block. The change was reverted rather than left in as dead code.

What this does establish: the fault is NOT the delete node type alone. The two candidate explanations left are
(a) the clone plus scalar-journal plus collection-journal combination, independent of delete, and (b) the
delete's condDelete/soft-delete slot allocation. Distinguishing them needs a fixture that puts a *resource-shaped*
handler beside a scalar write; the single-invocation composer cannot build one, because a resource-shaped route
requires exactly two rows. Building a two-row composer is the prerequisite for the next attempt.

`scalar-write-with-collection-delete-not-enabled` therefore stands. It is fail-closed: the worst case is a
transaction that will not validate, never forged state accepted.

### 2026-07-26: Release C - collection delete settles through the journal

`delete m[k]` reached code generation raw, and the C2 backend failed closed on a shape the value-threaded
journal can in fact represent: it rewrites a delete to a write of the collection's default. That lowering only
applies to internal handlers, so a delete-bearing handler is now cloned even when nothing else on the route
needs a clone. Delete settles on the VM and a settlement that leaves the old value in place is rejected.

Bisecting the failure was worth the time. Four shapes, one variable at a time:

| shape | result |
|---|---|
| `delete m[k]` alone | settles |
| `m[k] = 0` alone | settles |
| scalar write beside `m[k] = 0` | settles |
| scalar write beside `delete m[k]` | REJECTED by the covenant |

Since `m[k] = 0` is semantically the delete and settles fine beside a scalar write, the fault is in how the two
journals exit together when the delete keeps its `delete` form - not in delete itself. That combination is now
rejected at compile time under `scalar-write-with-collection-delete-not-enabled` rather than producing a
transaction that cannot settle. Sharing one exit between the scalar and collection journals removes the
restriction; that is the remaining work, and it is a real fix rather than a widened test.

### 2026-07-26: Release C start - resource backend frontier, measured

Probing each backend shape against the graph route rather than reading eligibility source gives the real
frontier:

| shape | status |
|---|---|
| mapping insert on a cold key | admitted |
| nested mapping with dynamic keys | admitted |
| `bytes32` overwrite | admitted |
| satoshi/token effect | admitted |
| mapping delete | fails closed (`SortedMappingCodegenPendingError`) |
| `string` state | rejected (`dynamic-state-batch-journal-not-enabled`) |
| dynamic array push | rejected |
| fixed array element | ABORTED code generation |

The fixed-array abort was a genuine crash, present at the Release A baseline and not introduced by the
multi-handler work: a state array element has no entry descriptor, so `emitEntryCovenantVerification` read
`.collection` of undefined. Two eligibility guards were tried first and neither fired - the shape is neither an
array-typed state variable nor an ArrayAccess on a named collection by the time the route is synthesized - so
the check now lives where the descriptor is actually consumed and names the function and slot. Skipping the
slot silently was rejected as an option: it would drop the write's covenant check.

Remaining Release C work is unchanged: insertion/deletion, chunked values, dynamic arrays, token containers,
and runtime-varying aliases still need real journal support rather than a fail-closed boundary.

### 2026-07-26: Release B complete - explicit entry identity lifts the cross-keyed boundary

The bounded lift recorded above is now unbounded. `cross-keyed-collection-route-requires-one-handler` is gone.

The obstacle was that the collection journal identified a pending value by the key EXPRESSION at the call
site. ERC-20 `transferFrom` keys `allowances[from][spender]` and `balances[from]` from one `from`, and one
parameter cannot carry two different canonical witness names, so a sibling handler over either entry produced
a second journal local and a second C2 slot for one entry NFT. Every fix that stayed with expression-derived
identity moved the duplicate rather than removing it.

Identity is now supplied by the compiler rather than inferred. Each batch clone takes one synthetic parameter
per physical entry key, named after that entry's canonical route input, and the clone's mapping keys are
rewritten to those parameters. The key expression at every call site is then the entry's identity by
construction, whatever source parameter originally carried the value. `msg.sender` keys are ordinary entry keys
in this scheme; the route still requires each to equal `__scb_graph_caller`.

The five-handler ERC-20 corpus token - `mint`, `approve`, `transferFrom`, `checkBalance`, `checkAllowance` -
now admits every handler in one route over exactly four entries: balances shared, allowances shared, and
balances row-local per row. Route body 1,272 -> 1,293 bytes and batch artifact 3,947 -> 4,003 for five handlers
instead of one.

One subtlety worth keeping: a handler with no batch clone has no entry-key parameters, and the journal hoists
its entry reads above the dispatch branch that declares `__scb_arg_*`. Those key positions must still be passed
as route witnesses, which are wrapper parameters and always in scope. Removing that substitution wholesale
produced `Undefined reference to symbol __scb_arg_0_0`.

A mixed batch still has no BCH-2026 settlement fixture, so the ordered-ERC-20 row remains PARTIAL on execution
evidence even though the structural restriction is lifted.

### 2026-07-26: Release B - entry-identity witnesses and a bounded multi-handler lift

`resource-shaped-route-requires-one-handler` is gone. Route key witnesses are now named by the physical entry
they address - collection, key position, and whether the entry is shared by every row or row-local - instead of
by the handler and its parameter names. Two handlers that touch one entry therefore resolve to one route input
and one C2 slot. `move(from,to,amount)` beside `bump(who,amount)` admits both handlers and keeps three entry
slots, where naively deleting the guard produced four for three physical entries.

Three layers had to agree, not one:

1. witness naming (compiler) - canonical per entry rather than per handler;
2. the collection journal's cache pool - it was per callee, so two handlers over one entry still allocated two
   locals and the SDK reported "C2 batch upsert contains a duplicate slot". The pool is now per wrapper, and a
   pooled handler touching a single entry captures a plain value rather than a one-element tuple;
3. invocation shape - the resource-shaped handler runs as an internal clone whose accesses the journal hoists,
   while a sibling invoked as its public self bypassed that entirely. Siblings are now cloned too.

The lift is deliberately bounded. A handler that keys two different collections from ONE parameter - ERC-20
`transferFrom`, whose `from` addresses both `allowances[from][spender]` and `balances[from]` - cannot share
canonical witnesses with siblings that key those collections independently: one parameter cannot carry two
witness names, and the journal identifies a pending value by the key expression at the call site. Those
contracts keep the single-handler route under the new reason
`cross-keyed-collection-route-requires-one-handler`. Lifting that last case needs the journal to take an
explicit compiler-supplied entry identity rather than inferring one from expressions.

Compiler regressions cover the union, the canonical witness list, and the fail-closed boundary. A mixed batch
has NOT been settled on the VM yet, so the ordered-ERC-20 row stays PARTIAL: this is compiler admission, not
execution proof.

### 2026-07-26: Release B scoping - the one-handler restriction is an aliasing problem

Removing `resource-shaped-route-requires-one-handler` experimentally is not enough. A two-handler contract over
one collection (`move(from,to,amount)` beside `bump(who,amount)`) does compile with the guard disabled, but the
route allocates FOUR entry slots where three physical entries exist: `move`'s resource-shaped witnesses
(`__scb_key_move_from_global`, `__scb_key_move_to_row`) and `bump`'s non-resource-shaped witness
(`__scb_key_balances_0`) name the same physical entries under different route inputs, so a batch that moved
from A and then bumped A would address A's single entry NFT through two independent slots.

Release B is therefore not "delete the guard": it needs canonical structural identity for entry descriptors,
a union across reached handlers, and alias resolution to one pending journal value per physical entry, exactly
as the handoff specifies. The guard stays until that exists - it is currently the only thing preventing an
unsound double-addressing of one entry.

### 2026-07-26: Release A - control flow and multi-argument events

`while`, `do/while`, `break`, `continue` and early return each settle their exact effect through the compiled
graph, and each is paired with an off-by-one settlement that the covenant rejects. `do/while` is the
interesting one: it must run its body once even when the guard is false at entry, which the fixture pins at
argument zero.

A three-argument event is authenticated per argument: reordering two of them keeps the payload length and the
topic identical and is still rejected, and publishing under a second declared event of identical arity is
rejected on topic. The first attempt at that second case used an undeclared signature and was refused by the
SDK during construction rather than by the VM, which would not have been covenant evidence.

Release A is complete apart from the deliberately excluded early-return journal shapes, which remain
fail-closed rather than exit-aware.

### 2026-07-26: Release A - mint and burn through balanced settlement

`mint` and `burn` now settle a collection entry and a scalar total in one balanced block, with negatives that
keep the honest shape: a mint whose supply disagrees with the minted balance, and a burn exceeding the holder
balance (rejected by the handler's own `require`, not by the SDK). Combined with the earlier caller-keyed
`transfer`, `transferFrom` and `approve` fixtures, every ERC-20 handler in the ledger row is now VM-settled;
only ordering them inside one batch remains, which Release B addresses.

### 2026-07-26: Release A - admitted handler semantics, and a corrupt graph handler frame

`Layer3ReleaseA.test.ts` composes a router that forwards one call into a scalar-state callee, and uses that
one shape to prove four handler classes on the BCH-2026 VM, each hostile case sharing the honest case's exact
transaction shape and claimed settlement so the rejection can only come from the covenant:

- a modifier whose `msg.sender` authorization holds, and the same graph rejected when the modifier names a
  different authorized caller;
- string and custom-error `revert`, both the non-reverting path and an argument that reaches the revert;
- a `while` loop settling its exact iteration count, and a settlement claiming one iteration too many.

Building it surfaced a real code-generation bug rather than a test problem. A handler that both reads
`msg.sender` and writes scalar state declared the hidden invocation context twice: once because it is a graph
emission handler, and again because it has journal slots. Callers push each context value exactly once, so the
handler frame sat one item deeper than reality and every later read was off by one, surfacing as an `OP_SPLIT`
on an empty stack item. Modifiers were never implicated - an inline `require(msg.sender == expected)` with a
state write failed identically. The journal branch now declares that context only when the graph branch has
not already done so.

Still open in Release A: `do/while`, `break`, `continue`, early-return journal shapes, multi-argument event
identity/count, and `mint`/`burn` through real balanced settlement.

### 2026-07-26: caller-keyed ERC-20 handlers and cross-function outlining

Two blockers closed the standard `msg.sender`-authorized ERC-20 class.

Structurally, a `msg.sender` mapping key kept `LowerCollectionJournalHelpers` from journalling the
batched clone, so it re-read and re-flushed one physical allowance entry per row: two rows demanded
two different post-states from one output, which no transaction can satisfy. Every caller key
witness is already required to equal `__scb_graph_caller` at each row, so the clone now takes the
spender as an ordinary parameter fed by that same witness. Authorization is unchanged and the direct
entry point still reads `msg.sender`.

Three eligibility/codegen gaps were found by probing the admitted frontier rather than reading the
eligibility source, each of which blocked a normative handler:

- `balances[msg.sender]` beside `balances[to]` was rejected outright, so plain ERC-20 `transfer`
  produced no hidden batch at all. Key alternatives map to distinct physical entries; only a
  *row-local* caller key is genuinely unsupported and it now has its own rejection reason.
- a nested collection under the dynamic `for row < rowCount` parser failed code generation, because a
  composite key is only resolvable against a statically known row. Nested-collection handlers now
  unroll their rows, which admits `approve`.
- `delete m[k]` aborted code generation with an internal stack assertion; it now fails closed with
  the designed C2 error.

Size was the other blocker, and it was not where the previous handoff predicted: the value-threaded
journal handler is about 64 bytes of arithmetic, while roughly 40% of the artifact was byte-identical
repeats of per-entry C2 covenant machinery. Cross-function outlining shares those spans behind
`OP_INVOKE`, taking the token from 10,511 to 4,506 redeem bytes and the honest graph input to 6,024.

`transfer`, `transferFrom` and `approve` now have hostile BCH-2026 negatives on the caller key.
`mint` and `burn` are admitted with compiler regressions but are NOT VM-settled, so section 5's
ERC-20 row is PARTIAL rather than PROVEN. Modifiers, `revert` (string and custom error), `while`
loops and multi-argument events are likewise admitted-and-regressed but lack VM negatives.

Ordering across a mixed ERC-20 batch is not merely untested: a resource-shaped route admits exactly
one handler (`resource-shaped-route-requires-one-handler`), so a single batch cannot interleave
`transfer` with `approve` today. That is a structural limit of the current route shape, not a gap in
coverage, and closing it means lifting the one-handler restriction rather than writing a fixture.

### 2026-07-25: canonical compiled-handler plan

`layer3.encodeHiddenBatch(artifact, invocations)` now produces the exact canonical SCB1 blob and
collection route witnesses without constructing a transaction. `StatefulContract.batch()` delegates
to this shared implementation. This is deliberately a foundation, not a completion claim:

- the graph planner can now commit the same bytes the real compiler-owned handler route executes;
- selector choice, ABI argument encoding, row order, occurrence, limits, and collection witnesses
  come from the artifact rather than a parallel Layer-3 application DSL;
- the existing owner-local VM suite still proves ordered execution and one-flush behavior after the
  refactor;
- the next step is to bind this plan into each participant projection and authenticate its result
  event, then replace the arithmetic-only `BalancedParticipantSpec.journal`.

### 2026-07-25: deployable root/projection split and authority correction

The compiled graph now uses two fixed, independently deployable covenants instead of one oversized
controller:

- the root controller authenticates the canonical participant frames, SCB1 blobs, result
  commitments, proof slots, tree structure, and one-shot controller burn;
- one projection proof input per owner streams the global invocation table and byte-compares every
  targeted row with that owner's exact compiler-generated SCB1 batch and reached results;
- both covenants are below the BCH 10,000-byte input-script limit (currently approximately 3.4 KB
  and 2.3 KB respectively), with compile-time regression gates;
- projection and controller proof inputs occupy authenticated token-free 1,000-satoshi paired
  outputs, preserving balanced input/output index space;
- duplicate/aliased projections, substituted proof code, malformed trees, local-batch
  substitution, forged result commitments, and forged post-state all fail in BCH-2026 VM tests.

The graph authority is now the pair `(controller locking bytecode, mint-once category)`. Application
artifacts bake and verify both. The generic controller code alone is intentionally not authority:
a hostile NFT category at identical code is VM-proven to fail. Controller initialization is an
authenticated empty-to-root transition before the one-shot graph spend.

This closes transcript agreement and deployment mechanics, not source-edge completeness. The
remaining load-bearing compiler task is to prove that every non-root row was actually emitted by
its parent's compiled external-call expression. Present SCB1 eligibility rejects such handlers, so
the existing manually planned structural graphs are execution-mechanism evidence and MUST NOT be
treated as full synchronous source-call semantics. Completion requires compiler-owned callsite
exhaustiveness and suspension/resumption (including callbacks) over the shared journal.

### 2026-07-25: logical context, balanced blocks, and reached source calls

The compiled graph now authenticates substantially more than a structural participant tree:

- participant frames commit compiler-owned block sizes, and the controller requires contiguous
  balanced blocks followed by one projection per participant, the controller, and the fee/change pair;
- parent identity supplies logical `msg.sender`; selector and canonical arguments supply `msg.sig` and
  `msg.data`; a one-invocation route binds `msg.value` to its settled satoshi-container delta;
- compiler-derived `call` versus read-only `staticcall` mode is committed in source emission and the row;
- conditionals and counted loops consume rows only at reached callsites, and transformed arguments such
  as `n + 1` are evaluated by the original handler and minimally encoded;
- scalar producer results resume parent computation, and a stateful `A -> B -> A` cycle settles one
  post-state per physical owner;
- ordinary event NFTs, satoshi effects, and an existing mapping-entry transition compose inside
  balanced blocks, with hostile substitution tests for each.

These results do not make parameter-authorized allowance examples equivalent to ERC-20
`msg.sender` authorization. The next bridge is a collection key derived from the graph-authenticated
logical caller. Merely enabling the non-graph repeated-callee route would be unsound: it can prove a
declared sender category is co-spent, but it does not independently prove that this owner emitted the
callee's complete batch.

### 2026-07-26: Release C — fixed-array entries and stateless caller derivation

Fixed-size state arrays use the existing entry-NFT collection authority; they are not scalar
commitment fields. The compiler now admits the bounded repeated-owner shape in which every row
addresses the same runtime array index. It unrolls the two-row route, invokes a compiler-owned
internal clone through the collection journal, reads the entry once, observes writes in order, and
flushes one final entry value. `RepeatedExternalBatchRelease5.test.ts` settles two writes to index
`1` and reads the final value through the ordinary array getter on the BCH-2026 VM.

The route deliberately has one global index witness. Two rows naming different indices are therefore
not silently aliased into one physical entry: SDK construction rejects the ambiguous witness before
the transaction is built. Supporting distinct per-row indices remains a wider resource-layout task,
not part of this admitted class.

The same fixture exposed and closes an SDK liveness bug. `hasNothingToDerive` previously ignored
external-call and external-`outState` groups, so a caller with no local state/effects skipped the
callee derivation probe and constructed stale post-state (which the covenant rejected). Those groups
now independently require derivation, and the positive fixture intentionally gives the caller no
local state. This proves external state settlement does not depend on an unrelated caller write.

This moves fixed arrays from unimplemented to PROVEN for the named same-entry repeated-call class.
It does not close the broader resource row: per-row array entries, dynamic chunks/arrays, token
containers, and runtime-varying aliases remain.

### 2026-07-26: Release D start — heterogeneous canonical result vectors

The compiler-owned SCB1 route no longer requires every eligible handler to return one common scalar
type. Each reached returning row appends its canonical `abi.encode` fields to one authenticated
result vector; void rows append nothing. The SDK decodes that vector against the compiler-authored
per-row type schema and requires exact byte consumption, so omission, truncation, and unchecked
suffixes fail closed.

`HiddenBatchRelease4.test.ts` executes one physical route containing `bigint`, `bool`,
`(bigint,bool)`, `bytes`, `string`, and a named struct result on the BCH-2026 VM and decodes the
authenticated return-event commitment. Synthesized routes carry the source and contract struct
declarations needed to type their capture locals; treating a named struct as an address placeholder
is no longer possible. `Layer3CompiledGraphController.test.ts` separately proves that the graph
controller binds the resulting participant vector and rejects a forged result.

SCB1 remains experimental and its version-1 format has not been frozen or enabled by default; this
change replaces the earlier inactive-default suffix representation before that freeze. Immutable
version interoperability remains a Release I requirement and this evidence MUST NOT be read as
support for silently changing a deployed protocol.

The compiled graph path now also consumes a producer-authenticated two-field return in its parent:
`CompiledReturningB.twice` returns `(int,int)`, the graph emission binds both canonical fields, and
`CompiledReturningA.plusOne` resumes only after tuple destructuring and an assertion over the second
field. The graph verifier parses the complete result frame, parks prefix fields on the alternate
stack while decoding the remainder, then restores the language's first-result-on-top tuple order.
The honest transaction and forged-result rejection both run on the BCH-2026 VM.

The planner now records invocation-level result dependencies separately from structural execution
and owner edges. It runs a complete directed-cycle check before returning a plan: duplicate/self,
out-of-range, and cyclic producer dependencies fail with an unavailable-future-result diagnostic.
The returning A→B fixture derives `A depends on B`, while the structural A→B→A owner-reuse fixture
has no artificial value cycle. This distinction is essential: physical-owner cycles are legal,
future-result cycles are not.

The Release D row remains PARTIAL. General nested/transitive heterogeneous chains and compiler
emission of dependencies beyond the currently derived parent/returning-child edges still need VM
evidence.
