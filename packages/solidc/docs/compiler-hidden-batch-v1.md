# Compiler-hidden batch protocol v1

Status: EXPERIMENTAL IMPLEMENTATION, DEFAULT OFF. The scalar and parameter-keyed multi-entry
journals, hidden owner-local route, and
one-repeated-callee vertical slice are implemented and VM-tested against BCH 2026. The wire format
remains versioned experimental covenant surface until the independent Release 4 and Release 5
reviews and the remaining expansion gates below are complete.

Baseline: `codex/state-bus-research`, forked from `codex/solidhat-init` at `d36116aa`.

Implementation snapshot (2026-07-23):

- Releases 1-3 are compiler/SDK fast paths with scalar, parameter-keyed multi-entry mapping,
  fixed-array element, dynamic bytes/string, and chunk-backed dynamic-array journal tests.
  A repeated parameter-authorized, ERC-20-shaped transfer threads sender balance, recipient balance, and nested allowance
  through one tuple; MasterChef-style dependent accumulators use the same reduction. A dynamic-array handler
  value-threads both its encoded length field and tight element blob, then the physical wrapper
  flushes its chunks once. Runtime-varying aliases and dynamic cold keys retain the conservative path.
- Release 4 is enabled only by `experimentalHiddenBatch`. It advertises `hiddenBatch.version == 1`,
  keeps `__scb1` out of the source ABI, and admits either signature-free route-stable scalar
  handlers, handlers sharing one parameter-keyed mapping entry, or the exact two-row
  resource-shaped mapping route described below. The mapping routes bind every decoded row key to
  hidden physical-route witnesses. A separate bounded route
  mode commits one common return type per row into an eight-slot result blob; event and satoshi-value
  modes allocate one conditional effect slot per row and materialize only the reached prefix. Mixed
  route modes, dynamic state, heterogeneous/multiple returns or effects, caller-sensitive
  introspection, and forward calls remain explicitly rejected in capability metadata.
- Release 5 is enabled only by `experimentalRepeatedExternalBatch`. It groups one straight-line
  repeated callee, builds rows from the arguments actually evaluated by A, requires a compatible
  Release 4 capability from B, compares the exact positional second push byte-for-byte, and uses
  one physical B owner. The comparator accepts canonical direct pushes and `OP_PUSHDATA1`, and caps
  the complete blob at 223 bytes so the frozen eight-row maximum is constructible. Multiple
  repeated owners and repeated chains which are conditional or otherwise not exhaustively
  resolvable fail during compilation rather than falling back to contending physical call slots.
- Compiler and SDK tests cover opt-out compatibility, sequential state, malformed local blobs,
  omission, injection, argument reordering, unchecked suffixes, count substitution, the positional
  blob locator, target and output substitution, capability mismatch, duplicate physical inputs,
  atomic rollback, and physical owner cardinality. Executable topology slices cover TreasurySplit,
  Marketplace reward distribution, MasterChef double mint, and a mapping-backed
  `transferFrom(from,to,spender,amount)` pair. This fixture shares sender balance and allowance across rows,
  uses distinct existing recipient entries, and settles through one token owner. Repeated physical
  entry aliases and cold recipient insertion fail before construction in v1.
- Final full-suite totals are recorded in the review handoff after validation.

Release 0 compiler-size measurement (BCH 2026 code generation, zero-argument `ping()` fixture):

| covenant | direct bytes | batch bytes | batch delta |
|---|---:|---:|---:|
| B parser/dispatcher | 369 | 1,477 | +1,108 |
| A, 2 rows | 407 | 518 | +111 |
| A, 3 rows | 426 | 542 | +116 |
| A, 8 rows | 518 | 662 | +144 |
| parameter-authorized `transferFrom`, exact 2-row route | 3,047 | 9,775 | +6,728 |

`BatchCostRegression.test.ts` freezes these deployed-byte measurements, the 1,020-byte scalar
hidden route body, and the 6,532-byte multi-entry route body. The fixture has only 225 bytes of
headroom below the 10,000-byte P2SH limit, so any growth is release-significant. These are compiler
footprint evidence, not a substitute for transaction-specific VM metrics:
the final Release 0 gate still records evaluated instruction cost, pushed bytes, stack/memory peaks,
unlocking sizes, and complete transaction sizes from constructed 2/3/8-row transactions.

Constructed Release 5 transactions are pinned under `BCH_2026_05`. UNVERIFIED AT HEAD (row X108): the B
figures below match neither the pre-X105 nor the post-X105 values that
`RepeatedExternalBatchRelease5.test.ts` measures (2 rows: 2,492 instructions / 273,265 op cost there versus
2,743 / 316,607 here), and the transaction sizes differ too, so this is a different fixture stale by an
unattributed amount. It has not been re-measured and must not be cited as current.

| rows | tx bytes | A instructions | A op cost / budget | A peak items/bytes | A unlock | B instructions | B op cost / budget | B peak items/bytes | B unlock |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2 | 5,915 | 1,079 | 138,080 / 1,636,800 | 12 / 3,022 | 2,005 | 2,743 | 316,607 / 2,338,400 | 20 / 5,834 | 2,882 |
| 3 | 5,943 | 1,202 | 150,798 / 1,637,600 | 13 / 3,088 | 2,006 | 3,424 | 386,913 / 2,359,200 | 20 / 5,912 | 2,908 |
| 8 | 6,055 | 952 | 127,276 / 1,635,200 | 10 / 3,374 | 2,003 | 5,461 | 610,442 / 2,452,000 | 17 / 6,259 | 3,024 |

The VM tests additionally freeze pushed bytes, hash iterations, and both data-NFT input projections.
Peak figures combine the main and alternate stacks and sum resident item bytes at every debug-trace
step; this closes the Release 0 stack/memory measurement requirement for the frozen fixtures.
The caller cost is not monotonic because the eight-row zero-argument fixture is simpler than the
two/three-row argument-bearing handlers.

This is the first deployable composition protocol. It covers:

- several local/public handlers executed by one state owner;
- a loop or recursion over stateful owner-local handlers;
- one caller invoking the same external state owner several times;
- ordered arguments, returns, events, and read-your-writes state.

It deliberately does not cover a general participant graph, callbacks, or `A -> B -> A`.

## 1. Design rule

Reuse existing covenant identity and call machinery. V1 does not introduce a participant table,
carrier input, global transcript, resource table, or new logical-owner representation.

For:

```text
A.root -> B.f(x)
       -> B.g(y)
       -> B.f(z)
```

the transaction contains one physical A owner input and one physical B owner input. A uses the
existing external-call target pinning to verify B's actual locking bytecode, state category,
self-pinned lineage, and input/output block. B executes three logical handlers against one local
journal and flushes once.

Only one logical external caller may contribute rows to a B batch in v1. Calls from two independent
caller owners to the same B require the deferred graph protocol.

## 2. Compiler-hidden route

`__batch` is not source grammar or ABI. A transcript-capable artifact may expose the reserved physical
selector `0x53434231` (`SCB1`) as compiler plumbing. The compiler rejects a source-selector collision.

The artifact retains every ordinary source selector and direct wrapper. The SDK chooses:

- direct wrapper for one logical invocation;
- `SCB1` for two or more logical invocations of that owner.

A later artifact may support several batch protocol versions. Artifact metadata lists supported
versions and selectors. SDK construction selects the highest intersection understood by caller and
callee; a newer artifact can remain composable with deployed v1 callers by retaining its v1 route.
No transaction silently translates between formats. An immutable artifact cannot gain a version:
if peers have no exact common version, construction fails. Compatibility is bounded because an
artifact is never required to retain an unbounded set of historical routes.

`MAX_BATCH_PROTOCOLS_PER_ARTIFACT` is 2. Every retained route's full byte/op cost is charged to the
artifact which retains it and measured against the 10,000-byte limit. Retention is optional: an
artifact may support only its current route and fail composition with older peers. Raising this cap
requires a new measured specification; metadata alone cannot bypass it.

The current implementation advertises exactly version 1 and retains no legacy route. Unknown
versions, selectors, or missing exact capabilities fail before transaction construction. The cap of
two is a compatibility ceiling for a future artifact, not permission for the current SDK to infer,
translate, or emulate another version.

## 3. Local batch encoding

The candidate v1 batch route has this exact logical push layout:

```text
push(bytes4("SCB1")) push(batchBlob) [compiler-declared wrapper pushes...] push(redeemScript)
```

The selector is the first push and `batchBlob` is the second push. Both use the shortest valid
pushdata encoding. A and B MUST locate the blob as the second push after first verifying the first
push is exactly the `SCB1` selector. They MUST NOT scan for magic bytes or select a push by content.
The final push is the redeem script for P2SH forms; any intervening wrapper pushes are fixed by
artifact metadata and are never parsed as application rows.

The blob itself is:

```text
magic[4]            // "SCB1"
version:u8          // 1
flags:u8            // 0
invocationCount:u8
invocations...
```

`invocationCount` MUST be in `1..MAX_BATCH_ROWS`, MUST equal the number of completely parsed rows,
and MUST fit the measured byte/op budget. Release 0 freezes `MAX_BATCH_ROWS`; the initial target is
8, not the wire type's theoretical limit of 255.

Each invocation is:

```text
selector:bytes4
callsiteId:u32
occurrence:u16
argsLength:u16
args:bytes
```

Rows are in execution order. For each callsite, occurrences begin at zero and are contiguous.
Integers are little-endian, lengths are exact, pushes are minimal, and trailing bytes are rejected.

Application arguments, including signatures, are decoded from rows. Physical layout/index arguments
remain compiler-owned. The final byte order and maximum count are frozen only after Release 0 measures
the parser and realistic corpus batches under `BCH_2026_05`.

The blob is deliberately colocated with the covenant which parses it. Under `BCH_2026_05`, an
input's operation budget is `800 * (41 + |own unlocking bytecode|)`, while reading a byte costs one.
An N-byte blob therefore gives its parsing input approximately `800N` additional budget while
costing approximately `N` to read. A separate carrier would grant that budget to the wrong input.
For a future multi-participant protocol, replicate a small blob beside each parser while
`participantCount * blobSize` is cheap; consider a shared source only when replication approaches
the standard transaction-size constraint and its additional authentication surface is justified.

## 4. Authentication

### 4.1 Self/local batch

For a user-requested local batch, the physical owner controller:

- authenticates its ordinary state lineage and output block;
- authenticates the transaction origin using the existing direct-call rules;
- parses every row;
- dispatches only source-public/external handlers marked batch-eligible;
- executes every row exactly once;
- proves complete blob consumption and one final flush.

Internal/private helper invocations are normal handler/subroutine calls and are not independent batch
rows.

### 4.2 Repeated external callee

The caller compiler groups external callsites by concrete target slot. If one target resolves to the
same physical owner more than once:

1. the SDK supplies one B owner block;
2. A's existing external-call covenant verifies B's actual locking bytecode/category and that B's
   unlocking bytecode selects `SCB1`;
3. as A executes, it appends the canonical row bytes for every external callsite actually reached,
   including conditional and loop occurrences;
4. at A's epilogue, A constructs the canonical header with the final reached-row count and MUST
   assert exactly once that `expectedCompleteBlob == actualCompleteBlob` using byte equality, where
   `actualCompleteBlob` is the second minimally encoded push in B's actual unlocking bytecode;
   partial comparison, prefix equality, and unchecked trailing bytes are forbidden;
5. B verifies its immediate caller from A's actual co-spent owner input using the existing
   `msg.sender`/target-pinning model;
6. B executes the same rows and flushes once.

The whole-blob byte equality is the exhaustiveness proof. It makes omission, injection, reordering,
argument substitution, count substitution, decoy pushes, and trailing rows fail even when A is a
legitimate co-spent caller. B independently applies the same positional extraction rule, then
requires canonical complete parsing and exact consumption. The protocol therefore reuses caller
identity without mistaking that identity for authorization of arbitrary rows.

Grouping occurs before physical external-call layout allocation. All grouped callsites share one B
owner input/output block; per-call return/event/effect slots remain distinct inside that block.
Merely changing the selector after allocating duplicate B inputs would remain invalid and is not the
implementation.

If the target remains unresolved or two target expressions might alias, the compiler emits an alias
constraint and the SDK decides after resolving concrete locking bytecodes/categories.

## 5. Ordering and journal semantics

The owner-local journal supplies sequential semantics:

```text
load(slot)       -> newest write or authenticated pre-state
store(slot, v)   -> append ordered write
flush()          -> one authenticated backend transition per dirty resource
```

Scalar assignments, bytes/string replacement, mappings, arrays, balances, allowances, supply, and
container operations execute in row order when their physical resource shape is eligible. V1 does
not aggregate ERC-20 deltas. In addition to the shared-entry route, the compiler implements one
exact two-row resource route: the first observed key alternative for each collection is global and
subsequent alternatives are row-local. For `transferFrom`, sender balance and nested allowance are
loaded once and journaled across both rows, while each distinct recipient has one physical entry.
The route advertises exactly two rows; it is not a general resource-table protocol.

The journal representation is selected by the Release 1 benchmark. The default candidate is
authenticated base values plus an append-only `(slot, value)` write log. Deep mutable stack-frame
replacement is not assumed.

`load(slot)` above is honoured for handlers that only READ a slot as of X105. It previously was not: the
journal closure required a function to WRITE a slot before joining, so a pure reader reached as an
`OP_INVOKE` subroutine had no pending writes and read the input NFT commitment - the pre-transaction value -
even when an earlier row of the same batch had written it. That admitted a guard bypass rather than a state
forgery, since the post-state stayed authenticated; a router-enforced guard row is not the spender's choice,
so `withdraw(80)` followed by `assertFloor(50)` settled against a balance the same transaction was reducing.
`Layer3ReadYourWritesX105.test.ts` and `Layer3DynamicChunksS3.test.ts` pin both directions.

One residual boundary: a read-only handler that also emits or transfers still reads the pre-state. Graph
emission clones are deliberately excluded from the closure because their frame is owned by the effect-frame
protocol, and extra journal slots leave it one item deeper than the caller pushes. This boundary cannot be
diagnosed at compile time - route-closure membership is not route-composition membership, and a per-slot
compile-time refusal was measured to false-refuse the C2 capstone entirely. Diagnosing it belongs to
graph-planning time.

## 6. Returns, events, and value

V1 reuses existing physical mechanisms:

- each returning external call keeps its existing authenticated return-event/output slot;
- each emitted event keeps its existing event-output covenant;
- transfer/container effects keep existing authenticated output slots;
- `msg.sender`, `tx.origin`, and transaction introspection keep current physical meanings.

The compiler groups these slots under one B owner block but preserves their logical row order. B
verifies each result/event/effect as its handler executes; A verifies every return it consumes.

Self/local batches may return an ordered result vector to SDK `staticCall()`. A state-changing
transaction materializes only source-requested return events, matching current behavior.

### 6.1 Introspection in a batch

| expression | batch meaning |
|---|---|
| `msg.sig` | logical source selector of the current row |
| `msg.data` | canonical logical selector and arguments of the current row, not physical `SCB1` bytes |
| `msg.sender` | existing authenticated origin for a local batch; actual co-spent A locking bytecode for Release 5 |
| `tx.origin` | unchanged existing physical meaning |
| `this.activeInputIndex` | B's one physical owner input for every B row |
| `tx.*`, input/output introspection | the actual shared batch transaction |

A handler whose behavior intentionally depends on physical direct-wrapper `msg.data`, selector
position, input multiplicity, or per-invocation active input is batch-ineligible unless the compiler
has a separately reviewed lowering which preserves its source semantics.

### 6.2 Signature route binding

BCH transaction signatures do not commit input unlocking bytecode, and the direct and `SCB1` routes
use the same redeem script. Therefore merely reusing an ordinary `sig` argument does not prove that
the signer authorized batch dispatch.

Initially, a handler which consumes `sig`, calls `checkSig`, or transitively depends on such a
modifier is batch-ineligible unless its authorization is independently bound to:

- the `SCB1` protocol version;
- the complete canonical batch blob;
- the intended contract identity/category; and
- the transaction being authorized.

The binding may use a compiler-defined data-signature challenge or a transaction commitment proven
equivalent in the Release 4 security review. Ordinary transaction signatures remain valid for their
existing direct route; the compiler MUST NOT infer route authorization from them.

## 7. Eligibility

Initially eligible:

- fixed scalar/register state;
- internal/private/public helper calls after journal lowering;
- bounded loops and recursion within VM limits;
- ordinary `require`, signature-free modifiers, events, and returns.

Enabled only after their journal/backend gate:

- C2 mappings and sets;
- dynamic chunks and collections;
- satoshi/CashToken containers.

Rejected in v1:

- callbacks or any physical participant cycle;
- more than one external caller owner contributing to one batch;
- more than one repeated external callee in one Release 5 root invocation;
- combining an R4 owner-local batch with an R5 repeated-callee batch;
- a batched B handler making a stateful call to a further D participant;
- `delegatecall`, lifecycle, `unsafe`, and arbitrary foreign failure catching;
- signature-consuming handlers without the route binding in section 6.2;
- handlers with unresolved direct-versus-batch introspection divergence;
- a batch requiring more than one existing split facet;
- unresolved dynamic storage witnesses or over-limit batches.

Admitted but carrying the section 5 residual, not rejected:

- a read-only handler that also emits an event or transfers value reads the pre-transaction value of any
  slot another row writes. Compile-time refusal is not available for this shape (section 5).

### 7.1 Mapping-backed transfer resource route

The implemented proving fixture takes `spender` as an explicit argument. It demonstrates one shared
sender balance, one shared nested allowance, and
one recipient balance per logical row. A prototype which placed the union of every possible entry
slot into one SCB1 route was rejected after VM construction exposed two structural problems:

- repeated sender/allowance aliases need one live journal over one physical predecessor, rather than
  duplicate entry transitions; and
- entry slots belonging to inactive handler/row branches still carry physical covenant
  locking-bytecode and preservation obligations, so unauthenticated dummy inputs cannot safely fill
  them.

The implemented replacement is resource-shaped: its capability describes only the exact global and
per-row physical resources used by one eligible handler. The SDK resolves concrete keys, supplies
one predecessor per advertised slot, and iteratively derives each authenticated entry output.
The VM fixture proves shared sender and nested allowance read-your-writes, two distinct recipients,
ordered debit/credit semantics, one token owner, and one output per dirty entry.

It does not demonstrate standard ERC-20 authorization: a genuine `transferFrom` keys allowance by
the authenticated `msg.sender`, and `msg.sender`-sensitive handlers remain batch-ineligible because
their direct and SCB1 contexts diverge. The accepted v1 shape is therefore deliberately described
as a parameter-authorized multi-entry transfer:

- both recipient entries must already exist;
- the two recipient entries must be physically distinct;
- neither recipient may alias the sender entry; and
- the route has exactly two rows.

Cold-entry predecessor creation and physical aliases fail before transaction construction. These
are capability boundaries, not fallback semantics. Same-recipient and sender-equals-recipient
could later be supported by separately advertised shapes which collapse the aliases into one live
journal; cold inserts require authenticated predecessor planning. Neither may be inferred from the
current route.

The stripped resource-route fixture is 9,775 bytes; the corpus token with mint, approve, and check
helpers is 10,600 bytes and is not deployable without reduction or splitting. The library compiler
emits a `contract-size-limit` error diagnostic for artifacts above 10,000 bytes. Independent review remains required before
default enablement, with particular attention to key classification, global/per-row witness
binding, alias rejection, iterative output derivation, and the 225-byte size margin.

## 8. Split contracts

The state-owning split root remains the logical owner. All handlers in one batch must execute in one
physical settlement context:

- root-local handlers may batch together;
- moved handlers may batch only when the splitter colocates their complete batch closure in one
  settlement facet;
- root-local and moved handlers, or handlers in two facets, cannot share one v1 batch unless the
  compiler emits a new single settlement artifact containing the whole closure.

Failure to fit reports the measured closure and remains a compile error.

## 9. Metadata

Artifacts add:

```ts
interface HiddenBatchProtocolV1 {
  version: 1;
  selector: '53434231';
  handlers: readonly {
    handlerId: number;
    selector: string;
    eligible: boolean;
    rejectionReason?: string;
    reads: readonly AccessRegion[];
    writes: readonly AccessRegion[];
    effects: readonly string[];
  }[];
  callsites: readonly {
    callsiteId: number;
    callerHandlerId: number;
    targetSource: string;
    selector?: string;
  }[];
  constraints: readonly InvocationConstraint[];
  measured?: {
    parserBytes: number;
    fixedControllerBytes: number;
    maximumRows: number;
    maximumBlobBytes: number;
  };
}
```

This metadata is additive and off-chain. On-chain identity continues to be the actual pinned locking
bytecode and state category.

## 10. Incremental delivery gates

The batch is not one large feature flag. It is the last two releases in a sequence where every
earlier release is independently useful:

| release | independently shippable benefit | batch dependency |
|---|---|---|
| 0 | early call-chain/contention diagnostics and shared split footprints | measure parser only |
| 1 | de-inlined scalar state helpers in multiple sites and loops | none |
| 2 | bounded recursive state handlers with full handler context | none |
| 3 | mapping, bytes/string, and array journals; sequential token-effect helpers | none |
| 4 | several handlers on one owner in one transaction | local batch route |
| 5 | one caller invokes one external owner repeatedly while consuming it once | repeated-callee route |

Detailed tasks and ship gates are normative in section 8 of
`buffered-state-and-message-bus-research.md`. Additionally:

1. Release 0 MUST separately measure B's hand-emitted positional parser/dispatcher and A's
   expected-blob accumulator plus positional extraction/direct whole-blob comparator under
   `BCH_2026_05` with 2, 3, 8, and candidate-maximum rows. Measurements include controller bytes,
   operation cost, pushed bytes, stack/memory, unlocking size, and complete transaction size.
2. Release 4 MUST prove owner-local malformed-row rejection, ordering, results, and one flush before
   its artifact capability is enabled by default.
3. Release 5 MUST prove caller/callee binding with TreasurySplit, Marketplace reward triple, and
   MasterChef double mint, then prove a mapping-backed parameter-authorized transfer resource shape as specified
   in section 7.1, before its capability is enabled by default.
4. Every release MUST measure deployed bytecode impact on relevant Effective Acceleration and split
   corpus artifacts; a regression belongs to the release which introduces it.
5. Releases 4 and 5 each require an independent adversarial review before default enablement.

During hardening, each new capability remains internal/experimental. A completed earlier release is
not held back merely because a later batch or graph release is unfinished.

## 11. Release invariants

1. One physical owner input and one settlement authority per batched state owner.
2. Existing external target/category/self-pinning checks remain authoritative.
3. One authenticated immediate caller; no caller identity supplied by the batch blob.
4. Every row executes exactly once in order and is checked by its emitter and target.
5. Caller and callee use the same positional second-push locator and compare complete canonical blob
   bytes directly; content scanning, prefix-only comparison, and unchecked trailing rows are
   impossible.
6. Read-your-writes and one final backend transition per dirty resource.
7. Artifacts which do not advertise batching remain byte-identical; the ordinary one-call wrapper
   and transaction semantics remain unchanged in batch-capable artifacts.
8. Unsupported cycles, aliases, facets, effects, and limits fail closed.
