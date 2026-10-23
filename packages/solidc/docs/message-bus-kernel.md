# Message-bus kernel (compiler calling convention)

Status: normative and default for message-bus contracts. The on-wire envelope remains
[`atomic-message-bus-protocol.md`](./atomic-message-bus-protocol.md). Journal read/write/flush rules remain
[`state-journal-protocol.md`](./state-journal-protocol.md). This document is the compiler convention that
sits between those two: how a handler is an `OP_DEFINE` body, how the route wrapper is the only layout
owner, and which shapes are refused with a closed reason set.

Unsupported handlers are refused independently with the closed `KERNEL_*` catalog below; they do not move the
whole artifact back to the historical implementation. `messageBusKernel: false` is the explicit compatibility
escape hatch for reproducing the **legacy** clone/unroll convention and its old rejection strings. Legacy is not
extended with new clone families or admission flags.

Related: [`journal-and-message-bus.md`](./journal-and-message-bus.md),
`archive/docs:packages/solidc/docs/buffered-state-and-message-bus-research.md`,
[`call-model.md`](./call-model.md), [`message-bus-coverage-matrix.md`](./message-bus-coverage-matrix.md).

---

## 1. What this is for

Bitcoin Cash has no nested `CALL`. A state UTXO is spent once. Several logical invocations of one owner
therefore share one physical input, one journal, and one flush. Cross-owner composition authenticates a
single call manifest. That is the protocol.

The kernel is how the **compiler** expresses it:

- A **handler** is a reusable subroutine. It does not own `blockLayout`.
- A **route wrapper** (artifact selector `53434231`) is the only function with a block layout. It
  prefetches, loops rows, invokes handlers, concatenates results, appends effects, flushes, and binds
  the verifier.
- `maximumRows` is a **runtime** bound (`require(rowCount <= maximumRows)`). It is not an AST unroll
  count.

The interpreter to grow is the loop `assembleMessageBusRowStatements` emits for every admitted kernel
surface:

```text
for (bigint row = 0; row < rowCount; row = row + 1) {
  parseOneRow(row);
}
```

Kernel work extends that loop to results and effects. It does not introduce a new bytecode format, a
new envelope domain, or a new `artifact.messageBus` version. Additive handler metadata is allowed.

### Beta checkpoint and stopping rule

The beta checkpoint is an architectural and regression gate, not an attempt to admit every source shape.
Further admission widening pauses once the candidate satisfies all of these invariants:

1. Every graph call has exactly one stable callsite-metadata record.
2. A later call consumes an authenticated producer-result identity (including its explicit result index), never a
   cloned `ExternalFunctionCallNode`; field and index projections remain ordinary expressions over that identity.
3. Every graph handler remains behind the same authenticated `OP_INVOKE` boundary; lowering and inlining may not
   move its body into the route.
4. A successful fresh compile has no suppressed speculative stack or code-generation error. Retry behavior must
   start from a pristine source AST and must not turn a failed attempt into hidden compiler state.
5. Admission, refusal, and lowering are determined only by type, effect, flow, and authenticated-layout properties.
   Contract, function, state-variable, and application names are never evidence.
6. Differential tests compare kernel and legacy observable semantics for their shared supported surface. Separate
   scaling tests establish that kernel route size is proportional to row logic and does not grow with the maximum
   unrolled row count.

A beta candidate may be cut when those invariants have focused regressions, fresh cold compiles of the maintained
corpus complete without hidden diagnostics, the kernel admission/cutover/row-loop suites and the one-shot build
pass, the differential corpus agrees, and the route-scaling check passes. Any invariant violation, semantic
difference, nondeterministic fresh compile, suppressed codegen failure, or route growth proportional to maximum
rows blocks the checkpoint.

The stabilization census is frozen when the current known-failure ledger has been classified. The positive proofs
enumerated in `scripts/kernel-beta-manifest.json` define the advertised beta surface; the broader compiler and SDK
suites remain regression gates but do not silently widen that surface. The beta gate runs the enumerated proofs from
a clean checkout. A failing positive proof is a release blocker until either the represented type/effect/flow family
works end to end, or that family is moved behind a general `KERNEL_*` fence and the proof is replaced by a negative
admission regression. Record the census commit and proof inventory in the beta release notes; later tests do not
silently move that boundary.

A finding after the census blocks the beta only when it demonstrates a soundness, determinism, hidden-recovery,
identity, `OP_INVOKE`, scaling, or observable-semantics defect in the frozen surface. A new source combination which
needs a representation not promised by the frozen surface is ordinary post-beta feature work, even if nearby
combinations are supported. Application-name exceptions, test-only quarantines, and stale generated JavaScript
which shadows TypeScript do not define the release surface.

At that point, pause general edge-case expansion and keep unsupported handlers fail-closed behind the published
`KERNEL_*` reasons. Post-beta work on a frozen shape is not release-critical unless it fixes a soundness defect,
regression, nondeterminism, or one of the invariants above. Promoting an additional shape is separately scoped work
with its own representation argument and differential/scaling coverage; the existence of an experimental lowering
does not by itself move the beta boundary.

For the beta cut, feature scope freezes at this checkpoint. After the release gates above pass, do not start another
admission family in the release branch. A candidate widening that has compiler or SDK unit coverage but fails its
transaction-level proof returns to the frozen table; it does not extend the stabilization window. Release work may
still fix blockers, improve diagnostics, and add negative or differential coverage without widening admission.

The finite stop procedure is:

1. Classify every failure in the frozen census as an implementation defect in an admitted family or as one of the
   six general fences below. Do not leave crashes, raw stack errors, hidden recovery, or application-shaped rules.
2. Require compiler metadata coverage and a successful VM transaction with exact post-state/effects for every
   implementation fix. Security-sensitive identities and settlements also require a hostile-witness rejection.
3. From a clean checkout, run the compiler and SDK journal/message-bus suites, kernel-versus-legacy differential
   tests, maintained fresh-compile corpus, route-scaling check, and the one-shot build. Repeat only a failed or
   nondeterministic gate; an open-ended soak is not part of the beta criterion. `yarn test:kernel-beta` is the
   executable gate, with its frozen census, required proof titles, and source digests in
   `scripts/kernel-beta-manifest.json`. A required proof which is removed, renamed, skipped, or does not pass fails
   the gate even if the surrounding suite remains green. The `test:kernel-beta:local` variant intentionally omits
   cold-corpus evidence and is diagnostic only.
4. Record the census commit, commands, pass counts, cold compile times, and route/full artifact sizes in the beta
   release notes. Performance numbers are evidence; only loss of row-loop scaling or an agreed hard platform limit
   is a blocker.
5. Treat a corpus compile above the platform limit as compatibility evidence, not deployability evidence. Every
   contract advertised as deployable must prove that its actual executable root and every split facet, including
   constructor and widest-call overhead, fit BCH's 10,000-byte per-input limit.
6. Cut the beta and move all remaining fenced shapes and newly proposed admission families to the post-beta
   backlog. Resume the release branch only for a blocker defined above.

Post-beta work stays off this release branch. It includes: extending the released internal-read-carrier / dense
final-flush protocol beyond its authenticated fixed-width shared-carrier profile; remaining `KERNEL_*` families
(`split`/`merge`/`selfdestruct`, constructed-key replay without an authenticated route binding, selected or
early-terminated events beside mutation, runtime transfers beside mutation);
collapsing `messageBusKernel` / `messageBusGraphContext` once legacy unroll has no callers; and extra
hostile-witness pins that do not change the frozen catalog. `grok/message-bus-kernel` may continue those
families. `grok/message-bus-kernel-beta` accepts only a blocker defined above.

The conservative beta boundary currently keeps these shapes frozen:

| Code | Frozen beta examples |
| --- | --- |
| `KERNEL_UNBOUNDED_KEY` | Counter loops with `continue` or `break` when a permutation of the full domain cannot represent the reached-key set; runtime-constructed key arrays without a bounded replay proof |
| `KERNEL_LAYOUT` | Indirectly state-backed or recursive dynamic aggregates, recursive mappings, runtime read streams combined with mutation outside the shared carrier/read-set profile, journal values carried through runtime locals, mutation streams in one execution group unless they are homogeneous fixed-width scalar writes to distinct collections over one unconditional compiler-owned key schedule, unauthenticated constructed-array resize/multi-arm/cross-array/nested-helper-return key replay, same-iteration mutable selection, selected or early-terminated runtime events beside journal mutation, runtime transfers beside journal mutation, and child creation (`new Child` / `create2`) without authenticated row geometry |
| `KERNEL_TX_SIGNATURE` | Transaction-signature values or `checkSig` / `checkMultiSig` execution in a row when the signature cannot be detached and finalized without circularity |
| `KERNEL_OPAQUE_EFFECT` | Yul or native `assembly { OP_* }` whose stack and effects have no complete static summary |
| `KERNEL_FOREIGN_DELEGATE` | A foreign `delegatecall` executing as the participant owner |
| `KERNEL_LIFECYCLE` | State-bearing `selfdestruct`, state/effect-bearing `split`/`merge`, or `unsafe` tiers without required preservation guarantees as a bus row without explicit authenticated lifecycle geometry |

This table defines the beta release boundary, not a claim that every other program is implemented. Section 5
remains the normative meaning of each refusal category; uncertain or unrepresented cases fail closed.

---

## 2. Handler ABI

A kernel handler is compiled as an internal function (`OP_DEFINE` / `OP_INVOKE`). Documented on
`artifact.messageBus.handlers[]` the same way as today (`name`, `selector`, `inputs`, `outputs`,
`eligible`, footprints). The body must not require its own authenticated input/output template.

Stack / value convention (logical; codegen may use the existing value-threaded journal lowering):

```text
in:  logical caller / msg.sig / msg.data / msg.value when the handler uses them
     user arguments decoded from the row blob (not from __message_bus_*_rN route parameters)
     pending journal values for the entries this handler may touch
out: updated pending values in the same order
     optional ABI result (the wrapper concatenates abi.encode(...) into __message_bus_results)
     optional effect records appended to the wrapper's effect table
```

Keys for mapping/collection entries come from **row arguments** or a published non-row-indexed witness
(for example a single `msg.sender` that every row shares). They do not become `_r${row}` parameters on
the route ABI.

`external` handlers may be invoked through one internal alias whose body is the same define. The kernel
does not emit `__message_bus_graph_*`, `__message_bus_array_*`, `__message_bus_resource_*`, or
per-row cloned bodies.

---

## 3. Route wrapper (controller)

Selector `53434231` (`SCB1`). Inputs remain `batchBlob` plus the existing compact-binder /
graph / msg.sender-category parameters. Kernel routes **omit** compile-time `_r${row}` key and signature
bands. Each transaction-signature leaf in a finite source shape contributes an aligned route witness with one
additional outer array dimension (`sig` becomes `sig[]`, `sig[]` becomes `sig[][]`, and a signature field nested
through struct/ABI-tuple and array layers preserves those array dimensions). The row retains an ABI-valid copy of
the composite with empty signature leaves; the route restores each detached leaf before invocation. Transaction
signatures stay outside the committed row blob and the runtime loop selects element `row`.
SolidCash has no source-level anonymous tuple parameter type: Solidity ABI tuple parameters are represented by
their struct type, and the SDK accepts either named-field objects or positional arrays for that same ABI value.
Both forms use the identical compiler-derived leaf paths and detached witnesses.

Execution order:

1. Parse `batchBlob` with the existing `__message_bus_parse_row` helper (and graph caller stream when
   the contract is a graph participant).
2. Prefetch authenticated state for the published footprint (the journal wrapper already does this for
   parameter-keyed mapping helpers and scalar internals).
3. `require(rowCount <= maximumRows)` with `maximumRows` from the artifact. Kernel batches use the BCH-2026
   10,000-byte stack-item ceiling, not the old 520-byte publication cap. The one-byte row count limits a batch
   to 255 rows; effect frames and resource budgets reserve that same row ceiling. Actual arguments, modes,
   values, or total input size can reach their limits sooner. Explicit smaller compiler row ceilings remain
   valid. Legacy unrolled routes retain the 520-byte envelope and eight-row ceiling (two for compact batches).
4. For each `row` in `[0, rowCount)`:
   - bind logical `msg.sender` / `msg.sig` / `msg.data` / `msg.value` from the row;
   - dispatch `rowSelector` to a handler `OP_INVOKE` (unknown selector → `revert("unknown batch selector")`);
   - concatenate ABI results into one `bytes` accumulator when any selected handler returns;
   - append events / BCH transfers / token effects to the wrapper's effect table.
5. Flush each dirty journal location once; emit the existing state and effect covenants.
6. Bind the participant verifier (compact binder + `artifact.messageBus.verifierProgram`).

SDK participant auto-derivation uses the compiler-published `maximumSemanticDerivationPasses` budget,
as graph settlement does. The legacy default of twenty probes must not truncate larger kernel effect frames.
Graph settlement sums each participant's mutable-claim allowance, with one shared assembly/confirmation pair;
the first participant's budget alone cannot bound the complete graph.
Unchanged-program and cycle checks still stop probes early; final VM validation is unchanged.

Generated locals inside the loop are **reused across iterations**. Codegen must not bake `rowIndex`
into names such as `__message_bus_value_${rowIndex}_${handlerIndex}_${field}`. That naming is why
legacy `resultMode` unrolls `if (rowCount > i)` copies.

`parseOneRow` already accepts a runtime `rowExpression`. Kernel dispatch always passes `'row'` (the
loop variable), never a compile-time integer.

---

## 4. Eligibility

A contract with a message-bus route uses the kernel calling convention by default. An explicit
`messageBusKernel: true` selects the same behavior. Admission is decided **per handler**:
kernel-shaped handlers are dispatched by the row loop and
unsupported siblings remain published with a `KERNEL_*` refusal:

- every finite `sig` input shape, including leaves nested through struct/ABI-tuple and array fields, is an aligned
  positional route witness and is finalized recursively against the selected handler body;
- no dedicated resource-shaped handler that owns a fixed per-row physical frame as route ABI
  (param-keyed `from`/`to` alternatives journal as two slots of the same row);
- no `_r${row}` witnesses required for soundness (`msg.sender` is a shared published identity;
  argument and expression keys are decoded from the row);
- results and effects (events, BCH, token-container, **typed external calls**) can be appended in
  the loop (concat / effect table / authenticated emission context on one `OP_INVOKE`);
- no frozen-forbidden construct (section 5).

`messageBusKernel: false` keeps the **legacy** path as a temporary compatibility escape hatch:
current clones, current unroll, and current `messageBusRejectionReason` strings. A handler is
kernel-eligible when each of its resources, results, and effects has a sound row-loop representation.
Under the kernel convention, an unsupported sibling is refused without demoting eligible siblings.

The default kernel convention requires kernel admission. Ineligible handlers publish
`KERNEL_*` reasons instead of the legacy admission catalog. The resolved convention is published as
`artifact.messageBus.convention` (`legacy-unroll` | `kernel-row-loop`) and
`artifact.messageBus.available` (false when every handler is refused). `this.activeBytecode` /
`this.activeInputIndex` are stable owner introspection on the kernel path only.

---

## 5. Frozen forbidden reasons

Kernel-path toys and `messageBusKernel: true` compiles may only refuse bus admission with the following six
codes (plus ordinary SolidCash type/parse errors). These are protocol and representation categories, not blanket
syntax bans: a source construct belongs behind a fence only when its authenticated kernel representation is missing.
Do not add a new code without changing this document and every kernel toy.

| Code | Means | Not this |
| --- | --- | --- |
| `KERNEL_LIFECYCLE` | A lifecycle operation whose participant topology or conservation rule has no authenticated row representation, currently including write/effect/collection-bearing `split`/`merge` rows, collection/event/blockhash-bearing or statement-form state-bearing `selfdestruct`, unsafe tiers without the required preservation guarantees, a deploy route with no materializable typed child site, or an `upgrade` whose replacement identity/state suffix cannot use the authenticated in-place append layout | Resource-free `split`/`merge` with selector-derived lifecycle authority; read-only fixed-scalar `split`/`merge` with a preserved `dataNft` prefix (`lifecycleTopology.resourcePrefix.mode = 'preserve'`); resource-free modifier-only and statement-form master-only `selfdestruct` retirement geometry; modifier-only fixed-scalar `selfdestruct` with a consumed `dataNft` prefix (`resourcePrefix.mode = 'consume'`); lifecycle beside V4 KTS with neutral suffix; replayable typed child deployments with compiler-owned child geometry; an in-place append `upgrade` with compiler-authored replacement bytecode/state-suffix channels; topology-preserving `unsafe(2)`; implementation functions that run in this participant's delegate/proxy frame |
| `KERNEL_TX_SIGNATURE` | A transaction-signature check with no signature parameter that can be finalized and bound outside the committed message blob, a participant-changing lifecycle row with any detached `sig` leaf, or a returned signature leaf whose value participates in signing this transaction and would therefore circularly change its own signed output preimage | Any finite input `sig` shape on an ordinary row (one aligned outer row dimension per detached leaf, preserving nested array dimensions and the non-signature fields of struct/ABI tuples); a `datasig` row value; a data-only `sig` constructed from ordinary bytes, including inside an array, struct/ABI tuple, or multi-result tuple; `ecrecover` / ECDSA over **data** |
| `KERNEL_UNBOUNDED_KEY` | A locally constructed key array whose length is not derivable within the bounded replay model; a counter-keyed mapping loop whose exact iteration domain is not one of the canonical forms; mutation of its counter or a bound mutation which cannot be reduced to a finite source expression; nested-loop control flow or a predicate with unsupported/mutated provenance | Parameter-keyed, `msg.sender`-keyed, expression-keyed (`m[records.length-1]`), parameter-array loop (`m[k][xs[i]]`), bounded locally constructed arrays whose replayable dominating writes reduce to direct authenticated key expressions, canonical ascending `for (int i = S; i < n; i = i + D)` / `i = D + i` / `i <= n` and descending `for (int i = S; i > n; i = i - D)` / `i >= n` domains for positive constant or replayable runtime `D`, plus `i != n` when the signed step reaches the endpoint exactly (also through replayable straight-line or finite conditional bound assignments, and with either comparison operand orientation), or equivalent canonical source `while` and `do-while` forms over `m[i]` / nested `m[k][i]`, multiple sequential loops whose runtime keys are disjoint (including loops over one physical collection), fixed-key reads from independent collections, a stable depth-one scalar entry keyed by a public parameter/literal/`msg.sender`/`tx.origin` or a pure expression over public arguments beside those counter writes, or those rewrites beneath serializable outer and inner `if`/`else`/`switch`/`continue`/`break`/`return` paths and the reachable body of `try`/`catch`; loop predicates may consume scalar state updated by replayable straight-line, finite `if`/`else`, or finite `switch` assignments before the loop; typed calls and supported path-predicated effects remain in source order |
| `KERNEL_FOREIGN_DELEGATE` | `delegatecall` to a foreign executor treated as this participant's owner | `delegate` on this contract's own implementation |
| `KERNEL_OPAQUE_EFFECT` | Native assembly which is not statically isolated and stack-neutral (including active-bytecode/signature context), unsupported Yul which cannot be lowered, or a low-level call the journal cannot summarize as a call/effect row | Isolated pure/read-only BCH assembly, including transaction inspection whose operands are block-local, balanced `OP_IF`/`OP_NOTIF` arms whose main and alt stacks converge, and `OP_BEGIN`/`OP_UNTIL` loops which restore both loop-entry stack heights after consuming their block-local condition; Yul translated to ordinary typed operations before admission; after Solidity-compat lowering to `call` plus returndata |
| `KERNEL_LAYOUT` | The handler needs physical or flow topology the row wrapper cannot publish, such as a runtime read stream consumed beside mutation outside one shared fixed-width carrier/read-set pair, a journal value carried through a runtime local, mutation streams in one execution group which do not share one unconditional compiler-owned key schedule and homogeneous fixed-width scalar operation/type across distinct collections, an unauthenticated constructed-array resize recurrence (including transient push/pop history) or multi-arm/cross-array/nested-helper-return key replay, a same-iteration mutable selection, early-return-bypassed or dynamically topology-selected runtime events beside journal mutation, both-arms non-loop chunkable selection, BCH/token/NFT transfers beside runtime journal mutation without non-shifting span descriptors, dynamic-bytes + token-container co-layout lacking `tokenContainer` block slots, a child deployment whose row geometry cannot be replayed (including runtime-count deploy loops), a non-normalizable recursive effect domain, an indirectly state-backed or recursive dynamic aggregate, or a result with no canonical route encoding | Single-stream journaled state accessed through the wrapper; one distinct fixed-width scalar read and `set` stream sharing the exact execution group, permutation, key projection, iteration domain, and old-value vector; fixed-key reads beside counter writes; sequentially grouped collection streams; homogeneous fixed-width scalar mutation streams over one unconditional compiler-owned key schedule; unconditional runtime events beside one mutation stream in one row; unconditional and bool-param-activated multi-resource fixed chunkable whole-entry writes (empty else; activation published on the entry access); heterogeneous fixed-width or journal-authenticated chunkable mutation streams over one shared counter-key schedule (compose settles inline ≤60B and external ≥61B loop-nested chunkable tails once the route publishes `__internal__valueChunkOutputBase` and a balanced trailing band); bool-param same-iteration resource selection across distinct collections; unconditional runtime events beside multiple authenticated mutation streams in one row; bool-param-selected emit beside a journaled mapping write (`KernelSelectedEventCompose`); constructed keys from dominating writes, binary joins, `hash160(pubkey)` locals, stable prefixes, authenticated monotone-pop prefix counts, or canonical helper fills with nonnegative literal starts and positive constant steps; independently indexed dynamic bytes beside an int mapping (`KernelMixedBytesMappingJournal`); public fixed-layout structs and direct nonrecursive state-backed or runtime-constructed dynamic struct-array results within the cumulative result envelope; ordinary nested mappings; affine pre- and post-recursion mapping streams; replayable straight-line and finite-conditional child deployments with fixed-layout scalar, enum, fixed-point, or nested-struct genesis state; `new LockingBytecodeP2PKH` / `P2SH20` / `P2SH32` / `NullData` constructors |

Legacy `messageBusRejectionReason` strings (`dynamic-and-collection-route-not-enabled`,
`atomic-delegate-context-unpreservable`, …) remain on the legacy path only so existing diagnostics
stay stable.

The frozen catalog is not a list of features supplied by legacy. Legacy also refuses transaction-signature
arrays, lifecycle/unsafe rows (including the kernel-supported in-place append upgrade), opaque assembly, and foreign delegate execution (under its older diagnostic
names). The compatibility escape exists for bytecode/ABI reproduction and for the small set of historically
admitted clone-owned layouts; it is not a general fallback for a kernel refusal. In particular, default kernel
compilation never silently emits the legacy unroll: if an admitted survivor cannot use the row loop, that is an
internal compiler invariant violation.

Resource-free modifier-only and statement-form `selfdestruct(addr)` on a master-only contract publish retirement
topology: consume the sole minting master, reclaim its satoshis to a compose-supplied recipient, and leave no
category minting outputs. The detached verifier authenticates that census under selector-derived lifecycle mode 3.
Standalone `selfdestruct(addr)` still pins the whole transaction to exactly one recipient output and a fee floor.
Under `messageBus: true`, the statement pin is participant-local (`outputs[INPUTINDEX]`).

Lifecycle participants may publish an additive fixed `resourcePrefix` beside the minting tail:

- `fixedSize = 1 + D` (master + compact `dataNft` slots from `requiredNftIndices` / full state for selfdestruct)
- split/merge `balancedSpan = 1 + D + count`; selfdestruct `balancedSpan = 1 + D`
- `resourcePrefix.mode = 'preserve'` for read-only fixed-scalar split/merge (commitments bit-identical on the survivor)
- `resourcePrefix.mode = 'consume'` for modifier-only fixed-scalar selfdestruct (token-free reclaim pads per slot)
- minting `categoryCensus` stays capability-filtered (`cat\|\|0x02` only); mutable data NFTs are not minting

Collection-, event-, blockhash-, or write/effect-bearing lifecycle, statement-form selfdestruct on state-bearing
contracts, and state-clone onto created split children stay behind `KERNEL_LIFECYCLE` (writes/events on split/merge
are also a language error). Lifecycle may share a V4 callManifest with KTS-signed siblings while the V4 participant
suffix stays neutral (`mode=0,count=0`); detached `sig` leaves on the lifecycle handler itself remain
`KERNEL_TX_SIGNATURE`.

If a toy needs a capability that is not in this table, change **this spec** and the toys. Do not add
`__message_bus_*` clone families or admission-ladder flags.

---

## 6. Journal

[`state-journal-protocol.md`](./state-journal-protocol.md) is unchanged: one pending value per
location, read-your-writes, one authenticated flush, untouched locations preserved.

Kernel handlers use the existing value-threaded lowering where it already applies:

- scalar internals stored once and `OP_INVOKE`d (`ScalarJournal`);
- parameter-keyed mapping helpers that receive and return the pending entry
  (`LowerCollectionJournalHelpers`).

When a compiler-owned pooled entry helper also reads or mutates chunk-backed state (dynamic arrays, unbounded
`bytes`, or `string`), the helper receives and returns each complete value beside its pending mapping-entry tuple.
The route owns one cache per dynamic value for the whole row loop and flushes it once, so later rows observe earlier
writes while the fixed entry or token-container slot remains independently authenticated. The mapping leg retains
its existing physical-identity rule: rows sharing one fixed entry journal must still agree on that route entry unless
a separately published row-local entry layout exists.

The route wrapper (or an ordinary physical entry such as `apply`) remains the layout owner that
performs the authenticated read and the single write-back. A kernel handler must not reach a raw
`MappingAssign` / dynamic chunk write with no journal frame; that is `KERNEL_LAYOUT` or the existing
split diagnostic when dynamic storage and a collection do not share one exit.

Effects (events, BCH, FT/NFT) stay **adjacent** to the journal, not journal values. The kernel
appends them from the outer message-row loop; it does not unroll one covenant site per compile-time row index.
An unconditional event site inside an admitted counter-keyed inner loop uses a separate bounded trailing stream.
The hidden authenticated permutation gives the exact trip count, but it does not reorder the event: each source
iteration pushes one bounded `commitment || event-locking-bytecode` record. Unconditional event sites before and
after the loop join that same stream as exact one-repeat segments, so output/log order remains source order across
the loop boundary. The handler epilogue binds the complete stream to a contiguous event-output family after the
runtime mapping entries and before dynamic chunks. Static `emits` slots exclude every migrated site. The route
threads the exact absolute half-open event span through invoked handlers so the own-category immutable-NFT census
grants authority only to that family; the neutral zero-trip sentinel grants no range. Multiple sites and
sequential loops reserve the sum of their mapping/event capacities, with each repeated part under the existing
64-iteration proof and each fixed segment counted exactly once.

The cardinality must be known before VM derivation. Events and counter journals beneath nested `if`/`else` paths
carry serialized predicates; the SDK evaluates them from public arguments, immutable local aliases, the source
counter, scalar state, and authenticated mapping entries which the handler does not mutate. This plans the exact
direct or routed output/journal stream while the covenant independently counts and binds only sites actually
reached. Unplanned event sites beneath another runtime loop, an unreachable catch arm, or a predicate with
unsupported/mutated provenance remain `KERNEL_LAYOUT`; counter journals whose domain cannot be bounded remain
`KERNEL_UNBOUNDED_KEY`. Stable `switch` paths and the reachable body of `try` use the same serialized path plan as
`if`/`else`. Event arguments may use ordinary expressions, resource-free builtins, and
returning helpers. An internally invoked returning helper which itself emits, including a transitive helper chain,
is beta-reduced at an unconditional call site (while a public definition remains dispatchable) so its events join
the caller's stream at their exact source positions. Lazy helper calls in `&&`, `||`, and ternary values are also
reduced when their enclosing continuation is a local declaration/assignment, scalar-state assignment, `require`,
or branch predicate: compiler-owned branch-local results keep the event inside the arm which evaluates it. Mapping
and array lvalues, returns, call arguments, and repeated loop conditions remain fenced until their key, argument,
or continuation order has an equivalent explicit representation. After helper inlining, an effectful helper body and its result definition remain
adjacent to the event in the source-order physical loop, so consuming that already-computed local neither duplicates
nor permutes the helper effect. BCH and fungible-token transfer operands use the same rule and the same authenticated,
source-ordered runtime effect span. A mapping value may also consume an effectful helper result when inlining leaves
a resource-free, replayable result expression: the helper effects and original result definition remain in source
order, while only that pure result expression is replayed against the authenticated logical key. Results which still
depend on an opaque effect or resource remain refused. Repeated NFT transfer uses the same authenticated stream. A
minting-capability container may produce several NFT outputs; a non-minting
container may reach at most one selected NFT site because one input NFT cannot authorize duplication. The SDK
rejects a concrete non-minting plan which reaches more than one site.

One row may combine a single mutation stream with unconditional runtime events: its authenticated journal cursor
places the source-ordered event segment after that row's dense settlement band. A batch containing more than one
event-bearing mutation row is frozen for beta because later rows can extend the global journal band beyond the
earlier row's event base. The SDK refuses that composition until journal and event effects share one route-wide
authenticated ordinal model. Selected event sites and early-terminated mutation domains remain compiler-fenced.

The handler ABI keeps each permutation as `int[]`. The kernel route adds one outer row dimension (`int[][]`) and
selects `permutation[row]` inside the physical row loop. Empty elements represent rows dispatched to other
handlers. This prevents two occurrences of one handler from silently sharing a bound or topology witness while
the settlement planner is still deciding whether their physical journal segments can coexist.

---

## 7. Wire and artifact compatibility

Unchanged:

- envelope domain `L3C1`, call-manifest domain `L3BUS1\0\0`, verifier commitment prefix `L3V1`;
- selector `53434231`;
- `artifact.messageBus.version === 1`;
- participant blocks, verifier NFTs, fee/change tail as in the atomic protocol;
- SDK-derived absolute indices; application source still supplies none.

Kernel artifacts should not require `_r${row}` route inputs. Row arguments stay in the manifest
`arguments` bytes; transaction signatures of any finite array depth are the deliberate exception and use one
aligned `_rows` array per handler parameter because committing them into the manifest would be circular. Return `position` in
the manifest remains the logical row index; only redeem bytecode becomes a loop.

`messageBusRootEnvelope: true` is an opt-in transport for direct-root atomic compositions whose duplicated
verifier-input envelopes would breach BCH's 10,000-byte input-script limit. It does not change the manifest
wire codec or the default V1–V4 transport. The root SCB1 input carries the one canonical envelope after its
selector; all verifier programs read that input and their unlockers omit the envelope copy. The changed
verifier program has a new covenant address, so existing deployments need new verifier NFTs. The SDK rejects
mixed transports and roots that cannot carry the envelope. This mode does not yet support proxy roots or
standalone input-0 SCB1 batches.

`messageBusProxyForwardEnvelope: true` separately enables an authenticated envelope for atomic compositions
rooted at a baked `__forward(bytes)` proxy. The proxy forwards the SCB1 selector and envelope to its co-spent
implementation; the verifier checks both root frames and removes the repeated verifier-envelope pushes. The
existing proxy bytecode is unchanged, but the opt-in verifier program has a new address. The two envelope
options are mutually exclusive. By itself, this does not admit direct-only participants into a kernel graph.

`messageBusDirectParticipant: true` independently opts routed artifacts into the V5 mixed-authority manifest.
It admits a separately compiled direct-only callee for one void leaf invocation with one scalar argument and a
fixed state block, while the routed caller authenticates the runtime target and delivered calldata. Direct
participants have no verifier NFT; their own covenant executes normally. Unrepresented nested calls fail
closed, and dynamic contract-typed addresses are not pinned to a particular implementation. This profile
rejects direct methods dependent on `msg.sender` or `msg.data` until caller-slot and hidden-calldata semantics
are certified. It requires one of the authenticated root-envelope carriers above and is otherwise unavailable
by default.

---

## 8. Tests (kernel toys)

Compiler: `packages/solidc/test/journal-message-bus/KernelLoopRoute.test.ts` (loop vs
`if (rowCount > i)` copies; returning scalar plus void `add`; unknown selector; `maximumRows`).

Journal: existing `ScalarJournal.test.ts` and `CollectionJournal.test.ts` remain the controller
evidence; kernel work must not regress them.

SDK: `packages/solidcash/test/journal-message-bus/e2e/KernelLoopCompose.test.ts` composes two logical
calls through the existing envelope and `vm.evaluate`, including selected scalar and nested signature-array rows,
and unsigned sibling-only batches that must not request an unrelated signer.

The broad journal/message-bus suites remain the regression gate for the default convention. Tests that describe
the historical wire implementation must opt into it with `messageBusKernel: false`.

---

## 9. Cutover

Kernel toys now cover the designed eligibility class:

- returning ERC-20-shaped mapping handlers (`return true` after a parameter-keyed write);
- satoshi transfers, events, and token-container FT/NFT transfers appended from the row loop
  (X29 site = runtime `row`; one co-spent `tokenContainer` input plus `sites × tokenTransferWidth`
  `tcTransfer` outputs);
- `msg.sender` as a mapping key without `_r${row}` ABI;
- `delegate` implementation functions in this participant's owner frame.

Compiler evidence: `KernelLoopRoute.test.ts`, `KernelCutoverRoute.test.ts`. SDK: `KernelLoopCompose.test.ts`,
`KernelCutoverCompose.test.ts`. Transaction `sig` rows of any finite array depth use aligned route witnesses;
unbound signature checks remain `KERNEL_TX_SIGNATURE`. Foreign `delegatecall` remains
`KERNEL_FOREIGN_DELEGATE`. The legacy convention
retains its historical admission behavior and diagnostic names, but does not make these unsafe shapes admissible.
Native BCH assembly is admitted by opcode semantics rather than contract shape: a block may use values it pushes
itself, balance both stacks, and perform pure operations or read-only transaction/token inspection. Conditional arms
must converge on both stack heights. A loop may change loop-carried values, but after `OP_UNTIL` consumes its local
condition it must restore both loop-entry heights; conditionals and loops may nest with proper structural pairing.
CLTV and CSV thresholds and indexed-inspection operands must also be block-local. `OP_PICK` is admitted only when its
exact depth is statically known and selects another block-local value. An immediately discarded
`OP_ACTIVEBYTECODE OP_DROP` read is neutral and admitted; copying, hashing, transforming, or otherwise consuming the
active-bytecode value remains `KERNEL_OPAQUE_EFFECT`, as do transaction-signature checks, dynamic stack reach,
underflow, malformed control flow, and unknown opcodes. Those shapes either depend on the invocation/signature context
or cannot be proven isolated by the static stack walk.
Typed external calls, collection-plus-typed-call handlers (a mapping journal clone promoted
onto the graph `OP_INVOKE` frame), interface-typed state receivers (`this.data.userRegistered(..)`),
literal `new T[](N)` key arrays, counter-keyed `m[i]` loops,
cross-handler `msg.sender` / argument keys, public mapping getters, expression-keyed second
alternatives, nested-branch / helper-inlined expression keys (`if (byMember) m[id][record.member]`),
mapping field writes, complete fixed-array `T[N]` identity sets, mapping-of-array values (`m[k][i]`,
`m[k].push`; a `T[N]` value journals the entry `m[k]`, and `m[k][i]` is a whole-entry
read-modify-write before clone/journal), packed and nested dynamic arrays, returning resizes,
N satoshi transfers, typed `{value:}` calls, token-container transfers without a prior
`tokenAmount` read (including two categories as two container slots), `blockhash(n)` with a
mapping write, `this.activeBytecode`, `new LockingBytecode*` constructors
including NullData, mixed event widths and non-emitting siblings on an event route, typed call
plus `emit`, native `I(cat).fn.call()` / `.staticcall()` including one-arg statement form,
enumerable mapping iteration, `try`/`catch` around a typed call, public dynamic-array getters,
`delete this.items[i]`, `fallback`/`receive` (including `msg.value`, satoshi transfer, typed
call, and fallback that both writes a mapping of `msg.sig` and makes a typed call), Solidity
`address.transfer` / `.send` (the same satoshi-transfer effect as `this.transfer`),
if/else and finite-switch satoshi transfers (including typed joins of replayable predicates, recipients, and
amounts), fixed transfers whose activation/recipient/amount follows an exact dominating scalar-state assignment or
an exhaustive finite state join, and fixed transfer operands returned by an exactly resolved internal/private
`pure` helper or a straight-line `view` helper over authenticated scalar state. View-helper replay uses the scalar's
value at that source position: replayable prior writes replace the pre-state recipe, while opaque or helper-owned
writes invalidate it. Fixed transfers after a structurally proven zero-or-one-pass local `while` whose condition is cleared on
every successful path, `address.transfer` inside an internal helper, UDVT `wrap`/`unwrap`
then a mapping write, typed calls with a struct-array argument (`I.r(Rec[])`),
library-wrapped IERC20 transfer (`using SafeTransfer for IERC20`),
mapping-of-struct-array field writes (`m[k][i].x = v`), modifier-keyed mapping RMW
(`onlyOwner(id)` plus `ownerOf[id] = ...`), `ecrecover`,
library `Address.sendValue` (`to.transfer` inside a free/library helper, including
`using Address for address payable; to.sendValue(...)`),
returning a user-defined value type (`returns (TokenId)`),
counter-keyed `delete this.m[i]` (and two mapping writes in one counter loop),
`fallback` that wraps a UDVT mapping key,
an invariant parameter key written inside `while (true) { ...; break; }`,
mapping values of `pubkey` / `datasig` / `fixedMxN` / `ufixedMxN`, public fixed-layout whole-struct getters
(captured as their Solidity field tuple), and runtime-constructed dynamic arrays of structs or enums returned through
the recursive EVM ABI encoder (journal cache defaults are type-correct empty/`0` rather than `int` 0). The recursive
encoder applies one cumulative 10,000-byte envelope to the complete result graph, including mixed multi-results and
top-level dynamic values. A nonrecursive dynamic struct array loaded directly from state uses the same authenticated,
ordered chunk run as other dynamic state reads. A whole flattened state struct containing dynamic leaves uses one
authenticated read for each flattened value, including the ordered chunk run for each dynamic array, `bytes`, or
`string` leaf; the recursive result encoder then reconstructs the declared aggregate without trusting result bytes.
Fixed-point scalar, array, and struct-field results use their scaled signed/unsigned integer representation in that
same recursive encoder.
Native `pubkey` and `datasig` results use compact ABI framing. A data-only `sig` value constructed from ordinary
bytes uses the same compact framing, but returning a transaction-participating signature remains refused because
committing it into an output would change the transaction preimage signed by that value.
Straight-line and finite `if`/`else`/`switch` child deployments publish compiler-owned frames for replayable
constructor, value, and salt expressions. Arm-local values and post-control-flow joins use typed conditional
recipes with implicit unchanged paths and switch first-match semantics. Folded genesis state supports scalar,
enum, fixed-point, recursively nested fixed-layout struct and fixed-array values, including a replayable ternary
which selects a complete aggregate. Internal/private pure constructor helpers may build those values from
straight-line initialized locals and a terminal single-value return; helper effects, guards, state/transaction/message
reads, ambiguous overloads, and recursive helper call graphs fail closed. Exact counter loops of at most 64 iterations
are expanded before topology assignment, giving every deployment a distinct source-ordered authenticated span and
literal-substituted constructor recipe. Dynamic leaves, cyclic aggregates, runtime-count or escaping deployment loops,
and opaque constructor state remain `KERNEL_LAYOUT`. Straight-line constructor `require` predicates are replayed before
the child locking-bytecode temporaries are created when they reduce to the same pure parent-context expression grammar;
state/transaction/message reads, transaction signatures, effectful helpers, and control-dependent predicates remain
fenced. The child layout digest authenticates variable and collection topology, including reachable nested struct field
names, types, and order. Each active deployment envelope carries that digest and the pinned verifier checks it against
the compiler-owned deployment-site registry, so the SDK cannot reinterpret the same output transcript with different
child geometry. A constructor may create several top-level fixed-size scalar-array entries at literal indices. The
compiler publishes typed key/value recipes, duplicate writes to the same index collapse to the final value, the SDK
materializes the exact entry NFTs, and both the participant and pinned verifier authenticate every output. The entry
covenant address is reconstructed once per collection; later outputs of that collection are bound to the first
authenticated address, avoiding verifier growth from repeated covenant reconstruction. Distinct collection addresses
use the same name-neutral reconstruction machinery. The two-distinct-entry kernel fixture remains below the
10,000-byte consensus input-script limit. Top-level scalar mappings with a single replayable key, or with
compile-time-distinct literal keys, use the same entry pipeline. Fixed arrays and scalar-keyed mappings may store
fixed-layout struct values; their existing aggregate recipes and authenticated struct definitions drive the same
compiler and SDK codec, and repeated provably identical mapping keys collapse to the final value. Potentially
colliding distinct runtime keys, dynamic key/value types, collection-valued entries (including nested arrays and
mappings), dynamic or cyclic aggregates, and recursive collection shapes remain `KERNEL_LAYOUT`.
Constructing a zero-state child without a value option is only a redeem-script/address expression: it mints no
category or participant block and therefore executes directly in the row without reserving a deployment span.
Adding `{value: ...}` makes the same expression a real BCH effect. It is admitted when the compiler publishes the
derived recipient (pinned child body, constructor arguments, and optional salt) and a replayable amount recipe;
otherwise it remains fenced.
Compiler-owned public entry points are finalized before kernel admission. In particular, a contract using an
oracle-backed `block.*` register publishes `__updateBlockOracle` as an ordinary eligible row with its detached
transaction-signature witness; it is not appended later as an unexamined ABI-only function. Public state getters
follow the same synthesis boundary.
Conservative named or unnamed result tuples and void tail recursion are normalized to their ordinary loop before closure admission.
Homogeneous mutually tail-recursive functions—matching parameter and result frames, with no overloaded target—are
lowered as one program-counter loop for each callable entry, including cycles longer than two. Self-recursive
functions also support explicit value-returning and void base-case `return` statements nested in pre-existing source
loops. The kernel therefore executes the finite source transition without cloning a recursive route frame. Resource-free
non-tail recursion remains an ordinary `OP_INVOKE` recursion and is also row-safe. Affine post-recursion mapping/event
streams use the authenticated unwind domain described below. Other recursive continuations which cannot be normalized
to one finite source-ordered resource stream, heterogeneous/overloaded recursion cycles, and result types the wrapper
cannot encode stay `KERNEL_LAYOUT`. Enum scalar results
and public enum getters use `int` locals; enum arrays encode each element as an unsigned ABI word.
Canonical value-returning and void self-recursion may publish pre-recursion events over one affine parameter. The
event domain includes the base frame, preserves source order, and is capped at 64 frames; multiple varying parameters,
and non-affine steps remain fenced.
For canonical post-descent effects, value-returning and void recursion instead publish an unwind rank from the
innermost retained frame outward. A void recursion with replayable event trees on both sides of its direct self-call
publishes two consecutive domains—descending frames including the base, then ascending retained frames—rather than
merging their opposite orders. Effects interleaved between the base and recursive call and state-dependent event
arguments or predicates remain fenced.
Counter-keyed mapping loops with zero or direction-mismatched steps, mutated bounds, or extra counter mutations
stay `KERNEL_UNBOUNDED_KEY`. A runtime step may be any replayable expression over public arguments, immutable
local aliases, and straight-line or finite conditional dominating assignments; the route proves that its signed
value advances toward the bound and the SDK rejects zero or wrong-
direction values before construction. Deterministic bound expressions over
public arguments and immutable local aliases are serialized for SDK replay. A constant-start,
constant- or runtime-step domain is represented by the exact ascending or descending arithmetic progression, with a maximum of 64 iterations;
the authenticated permutation is over those logical counter values rather than assuming `0..n-1`, and its ABI element type
matches a signed or unsigned source counter. Canonical source `while` / `do-while` tails and their matching
pre-`continue` steps may use prefix or postfix `++` / `--` as well as assignment form. Canonical post-test
domains support constant starts and non-zero
constant or replayable runtime steps in the comparison's direction, including
`int i = 0; do { ...; i = i + 1; } while (i < n)`. Canonical `for` updates may equivalently use prefix or
postfix `++` / `--`, in addition to assignment form, including descending/ranged forms. An `i != bound`
condition additionally proves that the directional distance is an exact
multiple of the signed step; the SDK performs the same check before transaction construction. A pre-test loop may
start at its bound and execute zero times, while a post-test loop must reach its bound after at least one step.
Post-test crossing comparisons authenticate the exact progression with at least the mandatory first iteration;
an immutable local affine-alias chain such as
`requested = n; limit = 1 + (requested - 2)` and nonlinear forms such as `limit = n * scale` preserve the exact
authenticated domain. Straight-line dominating reassignments of public bounds and local aliases, plus finite
`if`/`else` assignment joins, are replayed from their point-in-time value. Nested-control, loop-local, and otherwise
non-dominating reassignments remain refused.
Noncanonical `while` / `do-while` domains remain refused. A source `while` or `do-while` continuation is supported
when the `continue` is immediately preceded by the same canonical counter step as the loop tail. The lowering
removes that duplicate source step, executes the retained tail step on the continuation path, and advances any
already-consumed selected settlement cursors before jumping. A `continue` which omits or changes the canonical
step can repeat a logical value and remains refused. Equivalent additive spellings such as `i = d + i`,
`i = i + d`, and unit `++i` / `i++` are treated as the same step. A desugared `for` already runs its update on `continue` and
is supported. A non-progressing `continue` is also harmless when a restricted affine-domain proof establishes its
guard is false at every reachable counter value: direct counter comparisons against a literal or canonical bound,
and literal modulo congruence whose step preserves the incompatible residue. Dynamic/state predicates and reachable
guards remain refused because they would change the reached-key set.
Literal-bounded mapping loops may instead expand to ordinary static entry sites. Before expansion, the compiler
substitutes each exact induction value and replays `continue` and `break` in source order. Expansion proceeds only
when every reached escape condition becomes a compile-time boolean; a runtime-selected escape leaves the loop on
the bounded row-loop path or fails closed when no exact row representation exists.
A handler may contain multiple unconditional top-level counter loops in source order,
including loops over the same physical collection. The compiler threads exact accumulated input and output widths
between those loops, and the SDK publishes their predecessor and commitment runs in the same order. If their
concrete runtime keys overlap, the SDK rejects the repeated predecessor as requiring a read-your-writes topology
derived from the earlier pending output.
Every runtime-keyed mapping/array write in that loop must have at least one direct counter key component. Repeated
direct components such as `m[i][scope][i]` share the same authenticated logical value. Additional serializable
components may derive from it (`m[i + 1][i]`, including non-zero starts and steps): the artifact publishes either
the repeated positions or complete component recipes so the SDK derives the full composite slot. Collections
with the same complete key expression and selected iteration set share one authenticated permutation; collections
with different invariant components (for example `a[left][i]` plus `b[right][i]`) receive independent permutations
so each follows its own full composite-key slot order. Different selected iteration subsets across collections also
receive independent permutations and cursors. Distinct key shapes in the same physical collection (for example
`m[i * 2]` plus `m[i * 2 + 1]`) likewise receive independent permutations and compiler-owned exact physical
input/output widths. Those widths partition the shared trailing journal without trusting an address scan that cannot
distinguish the streams; the collection-wide cardinality witness still binds their sum to the physical transaction.
Concrete overlap between streams remains a planning-time read-your-writes refusal. A scalar mapping entry whose
complete key tuple consists of stable public
parameters, literals, `msg.sender`, `tx.origin`,
or pure expressions over public arguments may coexist: it is read once,
mutated as a local in source order, and flushed through one authenticated fixed-entry transition after the loop.
The same fixed-entry journal may also provide a read-only source for a runtime write stream in that physical
collection (`base = m[source]; m[i] = base + i`). The fixed and runtime slots remain independently authenticated;
if a concrete runtime key aliases the fixed source, construction refuses the duplicate co-spend as requiring a
read-your-writes transition.
Straight-line scalar assignments and finite `if`/`else` assignment joins before that loop are replayed as immutable
snapshots, so the authenticated key is the value at the source write boundary rather than the function-entry value.
A constructed local array may also pop once under a monotone literal comparison over a constant-step affine
counter: the compiler derives the exact first satisfying occurrence and authenticates the closed prefix count.
For an immutable public runtime threshold and compiler-proven constant step, the compiler instead publishes an
authenticated prefix-boundary trace of exactly `N + 1` counts: the first value is zero and every source-order iteration
proves that the next value advances by exactly the original predicate. The permutation still affects mapping keys only.
Runtime steps, mutable or loop-carried thresholds, selected write domains, unauthenticated resize recurrences, unequal
conditional pop widths outside this single-pop monotone form, and pop-then-push mutation of a pre-existing suffix
remain fenced.
A stable,
serializable per-iteration write guard (including an immutable loop-local alias) publishes the exact selected
logical subset: the SDK sorts only selected keys, while the covenant proves range, uniqueness, predicate
completeness, and source-order cursor consumption. Multiple `if`/`else` write paths are combined as their
logical disjunction. `continue` contributes its exact fall-through predicate. A stable `break` predicate is
published separately: SDK domain replay stops after the first taken iteration, and the covenant's final cursor
equality binds that terminated domain. Runtime event planning replays the full source domain rather than the
selected mapping subset, applies each site's fall-through predicate, and stops at that same break condition.
Both void and value-returning `return` use the same terminated-domain representation after the compiler lowers
the return to a stashed result/flag and break. The post-loop return is captured through the ordinary result channel,
while the mapping cursor proves the exact terminated iteration domain.
Loop-carried guards with straight-line, unconditional, replayable assignments are closed over the logical counter.
For example, `if (take) m[i] = i; take = i % 3 == 0` publishes `take` as the initializer at rank zero and the
previous counter's expression thereafter; a use between assignments publishes the latest expression evaluated at
the current counter. An exhaustive top-level `if`/`else`
or `switch` assignment to the same local is collapsed to its exact ternary expression for subsequent guards and
mapping values when every arm is independently replayable. Exhaustive nested branches and switches are reduced
recursively. Straight-line loop-carried values used before and after an assignment receive separate per-site
recipes for mapping guards, mapping values, runtime-effect predicates, and early-exit fallthrough: each atomic path
term is expanded at its own source statement before the terms are composed. Event-only loops also serialize closed
per-iteration local assignments as event-argument recipes. A top-level scalar-state recurrence of the form
`state = state +/- invariantDelta` derives each event value from authenticated pre-state and logical rank; the executable
event still reads the real source state, independently binding the SDK-planned commitment. Counter-dependent deltas,
loop-mutated delta locals, coupled or conditional state recurrences, incomplete joins, self-dependent local arms, and
recurrences other than these closed forms remain fenced. When a loop also writes counter-keyed mappings, the original
event expressions stay in its faithful source-order effect trace; only mapping keys use the physical permutation.
Counter-derived reads whose key or value cannot be represented by an independent runtime stream, and write values
derived through unreplayable mutable/loop-carried locals or scalar state mutated by the loop, remain
`KERNEL_UNBOUNDED_KEY`. Integer, fixed-point, boolean, fixed-byte, address, public-key,
and data-signature
same-entry expressions are supported generally: for example,
`m[i] = max(m[i] * 2, m[i] + i)` evaluates with an SDK-supplied old-value vector whose elements are verified
against the authenticated entries (or against the value type's exact default for an insertion). The compact
`m[i] + rhs` / `m[i] - rhs` forms continue to read the old value directly from the runtime journal and need no
additional witness. Fixed-point witnesses carry their canonical scaled integer, while boolean expressions use a
typed `bool[]` witness and the insertion default `false`. Raw scalar witnesses are compared byte-for-byte rather
than normalized as Script numbers; fixed bytes and public keys use their fixed-width zero value, while addresses
and data signatures use the empty-byte default.
Direct same-entry struct expressions are authenticated through a typed old-value vector, including the exact
zero-valued struct for an absent key; the VM-derived output commitment therefore supports ordinary constructor and
field expressions without requiring the source to spell a temporary read/rebuild/write sequence. Expressions that
read another entry at a counter-derived key use an independent authenticated read-only runtime journal when the
source and destination have the same value type and that type has a complete state/ABI representation. The entries
may belong to the same mapping or to different mappings. This includes numeric and
fixed-byte scalars, dynamic bytes and strings, arrays, and structs. The source and destination may use different key
recipes (for example `destination[i] = source[i + 1]`); each recipe receives its own permutation and cursor. Present
source nodes are reproduced unchanged. A long source value authenticates its existing digest without consuming or
reminting its continuation chunks; a long destination value receives its own slot-pinned chunk family.
For absent keys the first read reproduces its real predecessor unchanged, and later sorted keys in that authenticated
predecessor's successor gap reuse the same proof without duplicate co-spends.
If that absence predecessor is also consumed by another read/write stream, construction refuses the physical
overlap even when the requested logical keys are distinct; supporting it requires a pending-output journal transition.
For source-authored counter loops, a direct requirement that reads a counter-derived key from the same collection
as a keyed write is rejected before route admission. Permuting the write and replaying the requirement in source
order cannot preserve read-before-write or read-after-write semantics without a sequenced row IR; independently
authenticated read collections remain supported. Compiler-owned affine-recursion loops retain their separately
proven read/write domains.
An immutable, direct loop-local value definition is expanded into the mapping value before permutation, so
`int value = i + 10; m[i] = value` has the same representation as the direct expression.

Mixed typed external calls and genuinely invariant `if`/`switch` in the same counter loop stay on the
row loop: only direct uses of the counter in mapping keys and mapping values are rewritten to `perm[i]`;
this includes values computed by explicitly `pure` internal helpers and resource-free builtins such as
`max`. Calls keep source order. One unconditional runtime event stream may accompany one collection-mutation stream
in a single row; only mapping keys and direct counter uses inside mapping values follow the permutation. Multiple
event-bearing mutation rows remain composition-fenced until the dense journal band and event stream share one
route-wide authenticated output-ordinal model. Runtime BCH and token transfers beside collection
mutation also remain fenced until their effect and
journal outputs have independent authenticated settlement identities. Fixed token effects retain their existing
planning: each container conservation equation subtracts only matching authenticated outputs. Graph-frame token slots use the same rule:
inactive and unowned slots are tokenless, and NFT capability relaxation records the reached site per physical
container rather than applying a route-wide flag. Events before or after the loop join the same ordered runtime
stream, including supported conditional sites. Fixed BCH and token-container effects remain supported before or
after the loop.
Nested counter keys `m[k][i]` permute the inner key only.
Parameter-array keys use the same compiler-owned logical-index permutation: `m[keys[i]]` becomes
`m[keys[perm[i]]]` only at journaled mapping accesses. The public `keys` array is never reordered or replaced;
calls, events, transfers, and other source expressions continue to observe `keys[i]` in logical source order.
Likewise, `m[keys[i]] = values[i]` selects `values[perm[i]]` only for the physical journal write; the public
`values` array remains unchanged for every other source expression. Equal derived slots retain logical occurrence
order. Repeated counter-derived keys therefore preserve source last-write-wins SET semantics, accumulate every
`+=`/`-=` occurrence, and apply repeated deletes without duplicate co-spends. Chunkable per-key values use the same route:
values larger than 60 bytes are committed by digest and the covenant pins each trailing chunk output by its complete
slot-specific address, without assuming a distinct runtime input for every physical iteration.
The SDK sorts `perm` by the complete derived slot recipe, so cross-mapping reads and writes over the same
`keys[i]` domain share one physical order without changing ABI-visible arguments.
At transaction construction time, selected rows with independent pre-state journals may share one envelope. The
compiler threads predecessor and output cursors across physical rows, and the SDK emits each row's collection and
event segments in the same order. Disjoint keys may share one physical collection: the route authenticates its
transaction-wide input/output cardinality, threads a mutable remainder through the selected handlers, and requires
zero after the last row.
If two rows require the same predecessor or existing-entry UTXO, construction
fails closed: the later row needs a read-your-writes transition from the earlier row's pending output. This includes
byte-identical absolute `set`/`delete` rows; executing both row segments cannot be represented by reusing one
physical settlement. Multiple rows with runtime-derived values may compose across disjoint journals, including
disjoint key ranges in one physical collection; each row owns its authenticated predecessor and output segment.
The beta exception is any batch spanning more than one event-bearing mutation row, which fails closed until the
event and journal segments have one cross-row authenticated settlement identity.
Rows whose physical inputs overlap remain fenced until the planner can build a complete journal from pending row
transitions. Multiple collections in one admitted loop share a permutation only when their complete key expression
and selected domain are identical.
Affine post-recursion mapping assignments may consume authenticated mapping values during unwind. The read must
use the same `counter +/- literal` key grammar as the destination stream. A post-recursion `require` may also own
an authenticated read-only stream, including in a requirement-only recursion with no mapping write or event anchor;
each exact AST occurrence is bound to its source-order read so an equivalent expression in another predicate cannot
consume it accidentally. Nested `if`/`else` requirements and switches with pairwise-distinct literal case labels
publish compact selected-source witnesses. Switch arms retain first-match semantics by including every preceding
non-match predicate. Dynamic case labels, reads in event arguments or destination keys, and state- or
mapping-derived path predicates remain fenced. A read of the destination's
exact entry is an ordinary authenticated read-modify-write. Other streams sharing a collection are admitted only
when a constant positive recursion stride proves their complete 64-frame affine domains disjoint. Runtime strides
and intersecting domains fail closed rather than relying on transaction construction to discover an alias.
The runtime-entry closure now reserves a pending-journal record count beside its input cursor and threads that count
through every `OP_INVOKE` copy-in/copy-out frame, including void, returning, and neutral shared-caller paths.
Individual bounded records will reside on the shared altstack rather than one concatenated byte item, so the legal
row/iteration surface does not exceed BCH's per-item size limit. Physical entries still initialize the count to zero
and the SDK continues to reject overlap until the upsert verifier owns the record codec and final-flush pass; the
carrier is not treated as evidence that an overlap has settled.
The canonical entry record is
`0x05 || flags || collectionHash20 || slot32 || nextKey32 || valueTail`, where the four low flag bits mean
authenticated-input, dirty, tombstone, and synthetic-node. The value tail is at most 64 bytes, matching the entry
NFT commitment limit, so a complete record is at most 150 bytes. The SDK codec rejects unknown flags, malformed
identities, records which are neither authenticated nor synthetic, authenticated+synthetic records, value-bearing
tombstones, and non-canonical clean synthetic records. A clean synthetic tombstone with a zero successor is the
only canonical initial record for an absent read target: it proves no physical input existed and requests no final delete.
Each logical mutation stream has one compact access program
`0x06 || count8 || count * (flags8 || targetRecordOrdinal16le || predecessorRecordOrdinal16le)`.
The access flags publish presence-before, presence-after, whether the predecessor ordinal is present, whether
the compiler-derived operation may mutate the value or topology, and whether this access first consumes the
physical target or predecessor record. All six bits are covenant-bound: the row path derives the authentication
selector from the physical NFT it actually consumes, then compares that NFT's complete `slot || next || value`
commitment with the selected pre-state record. Pending and cached paths must publish neither bit. `0xffff` is the canonical absent-predecessor
sentinel. At five bytes per operation, a canonical 64-iteration stream is 322
bytes and remains one BCH stack item. The codec rejects oversized programs, unknown flags, reserved ordinals,
non-canonical predecessor sentinels, topology/predecessor disagreement, presence-changing reads, and
target/predecessor aliasing. Multiple streams remain separate items owned
by the selected row, so the total contract surface is not constrained to one 520-byte concatenation.
Every `sortedUpsertLoopInfo` entry publishes its stable `journalAccessStreamIndex`; the SDK and covenant therefore
address the selected row's stream vector without reconstructing compiler traversal order from collection names.
It also publishes an opaque `journalExecutionGroup` shared by streams emitted from the same source loop. This is
the structural control-flow identity the SDK uses to interleave streams once per physical iteration, even when
independently sorted mapping expressions address different collections. Groups are scoped by their selected row;
neither scheduling nor record assignment depends on contract, function, or collection names.
Each stream also publishes a `settlementIdentity` recipe. It binds the compiler stream index to access-program
order, declares `recordOrdinalScope: global-journal`, and names the target and conditional-predecessor roles in
that transaction-wide first-touch domain. Its `recordDispositionSource` separately identifies an authenticated
input carrier or a mutation-authorized output; newly compiled streams must publish that phase and the SDK rejects a
role/phase mismatch. The SDK scopes that tuple by the selected frame, requires an exact dense
access-ordinal sequence, and assigns final
disposition authority to the last mutating access for each record. A delete may own a tombstone disposition and
therefore does not imply that an output exists. Mixed described/undescribed stream sets, a stream-index mismatch,
an unsupported recipe or ordinal scope, duplicate or reordered access ordinals, and mutation-role disagreement fail before
construction. This metadata establishes stable record-to-settlement ownership. The compiler and SDK emit the
physical trailing output band as the dense present-record subsequence in global record-ordinal order; clean
synthetic absence and tombstone records do not create holes. Runtime reads combined with writes and row-local
aggregate carriers remain `KERNEL_LAYOUT`. Multiple mutation streams in one execution group are admitted only for
homogeneous fixed-width scalar writes to distinct collections over one unconditional compiler-owned key schedule;
all other multi-stream shapes remain fenced until their complete composition has a positive transaction proof and
hostile settlement-identity rejection.
The source handler carries that vector as the compiler-owned `bytes[] __internal__kernelJournalAccessStreams`
context. The kernel route adds only its outer row dimension (`bytes[][]`) and selects `[row]` in the physical
dispatcher, instead of adding one dynamic ABI band for every stream. The SDK initializes every handler vector as
a dense ordinal-indexed set of canonical empty `0x06 0x00` programs; duplicate, missing, or out-of-range compiler
ordinals fail before transaction construction rather than aliasing two logical streams.
Each selected handler authenticates its stream tag and fixed-width framing, rejects unknown flags, reserved target
ordinals, non-canonical predecessor sentinels, and target/predecessor aliasing, and requires its encoded operation
count to equal the compiler-owned permutation length for that stream. This makes the access carrier part of the
covenant boundary without granting its otherwise structurally valid record ordinals authority before the shared
record loader exists.
The SDK's sorted-list model exposes ordered `planJournaledUpserts` / `planJournaledMutations` reference planners:
repeated logical slots reduce against their pending values, delete/reinsert observes pending absence, original
entries and shared predecessors are selected once, and the final linked-list commitments are emitted once. The
`planKernelEntryJournalStreams` adapter flattens every row/loop stream for one collection into that single ordered
transition, then restores source stream boundaries only for the compact access programs. This gives later streams
read-your-writes semantics without deriving behavior from contract, collection, or function names. The
planner also publishes the final nodes and tombstones in first-touch record order, independently of its legacy
sorted-output view. Each source operation publishes the stable target and optional predecessor record ordinals,
plus its before/after presence state and mutation intent; predecessor selection follows the evolving pending topology
rather than the immutable pre-state list. The record list can be encoded directly into the canonical `0x05` carrier. The covenant
can therefore reproduce load/store selection and flush order without sorting dynamic slots on-chain.
The reference plan separately identifies the first source access which consumes each authenticated physical record.
Synthetic insertions and later cached or pending uses have no physical-authentication entry; a deletion may authenticate
both its target and predecessor in the same access. This schedule is derived solely from record identity and evolving
topology and provides an unambiguous input for route-wide record-body authentication.
The topology planner emits the truthful initial `0x05` record vector in that same ordinal space. Existing nodes
carry their exact authenticated pre-state slot, successor, and value; absent targets are represented only as clean
synthetic tombstones, never as caller-asserted final values. The active transaction path now carries that vector
into the covenant. Each row selects its target and optional predecessor ordinal, binds both records to the row's
compile-owned collection and the exact slots used by its physical, pending, fixed-entry, or cached-read proof path,
binds the access program's before/after presence and mutation flags to the transition branch and operation which
actually executed, and
consumes the stream with exact tag/count/framing checks. The SDK assigns carrier ordinals in execution-group order;
the covenant advances one shared dense first-touch prefix through every row invocation and finally requires that
prefix to cover the complete record vector. Coherent carrier reordering, skipped ordinals, and unused record
suffixes therefore fail even when every rewritten reference still names the expected slot. The row journal
receives the exact physical entry commitment through a tracked per-iteration register; pending duplicates and
cached absence proofs instead carry an explicit empty marker. This avoids retaining data across branch-sensitive
altstack operations and provides the stable input needed to bind record bodies before executing pending record value
transitions and the final flush directly from this authenticated vector. Cross-phase read-plus-mutation settlement
remains fenced: publishing disposition phases makes the blocker explicit but does not grant one phase authority over
the other or relax the row loop's existing physical transition rules.
Different key expressions over the same selected domain receive independent row-owned permutations. Separate
disjoint loops use separate permutations and separate accumulated physical segments. Counter-keyed mapping-array
element writes, pushes, and pops authenticate the complete old array through a typed row witness, perform the
mutation in the covenant, and publish the resulting whole-entry value through the same inline/chunked journal as
fixed-key mapping-array mutations. Repeated physical keys are chained through the row's authenticated pending value,
so every mutation observes the preceding source occurrence without a duplicate co-spend. The SDK independently
derives the expected value and rejects empty pops and out-of-range element writes before construction.
Sidecars (indexed by live `row`) use the row loop (`__message_bus_handler_*` / `__message_bus_entry_*`
DEFINE, not `__message_bus_graph_*`). A contract whose every handler is refused still publishes
`messageBus.handlers` with `KERNEL_*` reasons. Runtime-constructed key arrays are admitted when their bounded
length and every reached element write reduce to a direct route-replayable expression with an existing authenticated
entry identity. Merely enumerating finite key alternatives is not sufficient: replay-expanded runtime remainders and
other selected identities remain `KERNEL_LAYOUT` until the row carries an authenticated old/absence settlement
record for the selected entry. A binary `if`/`else` element join becomes a ternary recipe; stable-prefix reads and
single-stream path-balanced transient resizes remain admitted. More-than-binary branch-merged element definitions,
multi-stream transient schedules, and historical push/pop length recurrences remain
`KERNEL_LAYOUT` until their selected key identity is independently authenticated. The monotone single-pop runtime-
threshold form described above is the exception because it carries an explicit closed or witnessed prefix count.
Passing an element value to a helper does not escape the array, and passing the whole array through a
transitively read-only `pure` helper preserves its symbolic plan. A unique `pure` helper may also write elements
through explicit `memory` parameters: scalar parameters and helper locals are substituted into each caller
array's symbolic plan; straight-line and binary-join writes retain the compiler's pass-by-reference memory model,
while a multi-arm constructed-key join remains fenced. Several array parameters can be analyzed together, but a key
history which reads a distinct mutable array identity remains fenced until that cross-array dependency has an
authenticated replay identity. When several formals receive the same caller
array, they share one canonical history so writes and reads retain ordinary memory-reference alias semantics. A
helper which does not rebind a replayed parameter may also push and pop through the shared alias; those operations
advance the symbolic length at their exact source point. This replay composes through uniquely resolved `pure`
helpers which forward explicit `memory` parameters: each callee receives the caller's canonical plans, scalar
arguments are resolved at the call site, and recursive or ambiguous call graphs remain fenced. Value-copied array
parameters receive isolated plan histories, so their callee mutations can feed later reads and memory-parameter
writes within the call without leaking into the caller. This also covers mixed value/reference formals which receive
the same caller array. A direct pure-helper call used as a variable initializer or assignment replays these array
effects too; capturing its ordinary return value does not invalidate the constructed-array plan. A nested void helper
may forward the same array history, but a nested helper which both mutates that forwarded array and returns a captured
value remains `KERNEL_LAYOUT`; the combined key provenance is not independently authenticated. Pure memory
helpers with several branch returns are normalized to one flag-backed terminal return before kernel admission, so
the planner and executable row share the same continuation form. The flag-backed rewrite descends through finite
switches, unchecked blocks, and try/catch arms. Returns inside loops run through their ordinary loop-exit protocol
before kernel admission, so symbolic replay and executable code generation observe the same control flow.
Literal-bounded pure helper loops are replayed symbolically without rewriting the loop itself. Ascending and
descending `for`, `while`, and `do-while` progressions with a nonzero literal step are supported when their
comparison has a literal endpoint. Counter-resolved `break`, `continue`, and `return` paths are replayed directly.
Runtime-selected `continue` paths merge at the next fixed iteration. Finite branch-selected `break` paths carry a
cumulative stopped predicate across later iterations, including the source counter's exact exit value; a return
using that loop-exit protocol merges its ordinary result at the post-loop join.
Reversed comparison operands and exact `!=` endpoints use the same replay. A shared 256-iteration budget covers
nested loops and nested helper calls; exceeding it conservatively leaves the handler `KERNEL_UNBOUNDED_KEY`.
For a constructed array filled by a canonical helper loop, the symbolic plan publishes the exact reachable key
domain. A post-test loop includes its mandatory first iteration and public-bound prefix; for a nonnegative literal
start it uses `i >= start && (i == start || i < bound) && (i - start) % step == 0`. A pre-test `while` or normalized
`for` uses `i >= start && i < bound && (i - start) % step == 0` for a nonnegative literal start and positive literal
step. Runtime-selected or mutated steps remain `KERNEL_UNBOUNDED_KEY` until their constructed-array domain has an
equivalent authenticated proof.
Direct source assignments use the same point-in-time resolver, including literal and runtime array indices.
Mixed push/pop paths which restore their entry length without popping into the pre-existing prefix are replayed
independently per logical iteration, including finite `if`/`else` and `switch` paths, when their downstream mapping
mutation remains one authenticated stream. Several mapping mutation sites selecting distinct replayed suffix keys in
one execution group remain `KERNEL_LAYOUT`. Other mixed push/pop
operations in a counter-dependent resize recurrence, a push value derived
from the array itself or from a loop-carried local without a closed current-counter recipe, a counter-dependent
unequal-width resize schedule, passing the array to a mutating, external, ambiguous, or otherwise unprovable call,
loop-dependent control assignments, and writes whose index/value cannot be replayed stay `KERNEL_UNBOUNDED_KEY` without aborting
sibling handlers.

The legacy convention is intentionally unchanged: it does not acquire this runtime event family and continues to
refuse the corresponding bus handler with its historical route-generation diagnostic. The same function remains
usable as a direct call. Kernel compilation admits one unconditional event-bearing mutation row; selected events,
early-terminated mutation domains, and multi-row composition remain fail-closed at their respective boundaries.
