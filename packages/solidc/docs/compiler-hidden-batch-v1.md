# Compiler-hidden batch protocol v1

Status: EXPERIMENTAL IMPLEMENTATION, DEFAULT OFF. The scalar journal, hidden owner-local route, and
one-repeated-callee vertical slice are implemented and VM-tested against BCH 2026. The wire format
remains versioned experimental covenant surface until the independent Release 4 and Release 5
reviews and the remaining expansion gates below are complete.

Baseline: `codex/state-bus-research`, forked from `codex/solidhat-init` at `d36116aa`.

Implementation snapshot (2026-07-23):

- Releases 1-3 are compiler/SDK fast paths with scalar, one-entry mapping, and dynamic bytes/string
  journal tests. Unsupported aliases and dynamic cold keys retain the conservative legacy path.
- Release 4 is enabled only by `experimentalHiddenBatch`. It advertises `hiddenBatch.version == 1`,
  keeps `__scb1` out of the source ABI, and currently admits signature-free, route-stable scalar
  handlers. Collections, dynamic state, returns, events/effects, caller-sensitive introspection,
  and forward calls are explicitly rejected in capability metadata.
- Release 5 is enabled only by `experimentalRepeatedExternalBatch`. It groups one straight-line
  repeated callee, builds rows from the arguments actually evaluated by A, requires a compatible
  Release 4 capability from B, compares the exact positional second push byte-for-byte, and uses
  one physical B owner. The comparator accepts canonical direct pushes and `OP_PUSHDATA1`, and caps
  the complete blob at 223 bytes so the frozen eight-row maximum is constructible.
- Compiler and SDK tests cover opt-out compatibility, sequential state, malformed local blobs,
  omission, injection, argument reordering, target substitution, capability mismatch, and physical
  owner cardinality. Default enablement remains forbidden until the normative ship gates pass.
- The final validation snapshot passes 2,280 compiler tests and 3,229 SDK tests; the SDK total
  excludes the repository's existing 24 skips and 9 todos.

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
container operations execute in row order. V1 does not aggregate ERC-20 deltas.

The journal representation is selected by the Release 1 benchmark. The default candidate is
authenticated base values plus an append-only `(slot, value)` write log. Deep mutable stack-frame
replacement is not assumed.

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
| 3 | mapping, bytes/string, array, and token-state helper journals | none |
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
   MasterChef double mint before its capability is enabled by default.
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
