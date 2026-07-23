# Stateful callable handlers, batching, and cross-contract invocation transcripts

Status: LAYERS 1-2 READY FOR IMPLEMENTATION SUBJECT TO THEIR MEASUREMENT GATES. THE GENERAL
MULTI-PARTICIPANT TRANSCRIPT IS DEFERRED RESEARCH, NOT A RELEASE TARGET.

Implementation baseline: branch `codex/state-bus-research`, forked from
`codex/solidhat-init` at `d36116aa`. All implementation and further research must be performed
against that worktree unless the baseline is deliberately rebased and this note is re-audited.

This note records the conclusions of the state-journal and message-bus research, updated after
reviewing the MistSwap and Effective Acceleration contract corpora. It deliberately separates three
features which were previously discussed together:

1. an owner-local write-back journal;
2. multiple callable handlers inside one physical contract evaluation;
3. an auto-derived, transaction-local invocation transcript across physical participants.

The first two, together with a narrow repeated-callee protocol, deliver the first four corpus rungs
without a general cross-contract bus. The third generalizes them to finite multi-participant and
circular call graphs, but its covenant cost, versioning, and liveness case is not yet established.
Nothing here changes current compiler behaviour.

Related: `subroutine-extraction.md`, `sorted-mapping-c2.md`, `mapping-loop-writes.md`,
`dynamic-storage.md`, `evm-storage-parity.md`, `delegatecall.md`, `auto-derivation.md`,
`external-contract-calls.md`, `unified-linear-memory.md`, and `deferrals.md`.

Immediate implementation protocol: `compiler-hidden-batch-v1.md`. The detailed
`invocation-transcript-v1.md` is a deferred design candidate for a possible general graph protocol;
it is not normative for the initial implementation and its wire format MUST NOT be frozen or
deployed yet.

Scope: this document covers ordinary stateful contracts, delegatecall, and cross-contract calls. The
`solidcash-split-v1` root/facet implementation is treated as an existing compatibility constraint and
source of reusable analysis. Multi-facet execution is not silently included in the first bus release.

## 0. Readiness audit against the SolidHat/split baseline

The baseline materially improves the starting point:

- `compileStringSplit` already computes complete internal call closures and conservative
  `SplitStateFootprint` read/write/effect regions, including wildcard widening for dynamic collection
  keys. The bus analysis must generalize this code rather than introduce an unrelated footprint
  system.
- Split contracts already separate one logical identity from a physical root and physical facets.
  Participant identity therefore cannot be defined as just an address or category; it needs an
  explicit logical owner plus the physical inputs which authenticate and execute it.
- The split root is already the sole application-state owner. Branded `delegateOnly` facets are
  execution authorities, not independent state owners.
- Split deployment already validates state-layout fingerprints, pins facet bytecode, routes selectors,
  authenticates return events, and measures constructed scripts. These mechanisms should be reused.

The same baseline also exposes a protocol boundary. `solidcash-split-v1` deliberately selects exactly
one facet per logical call and supports only one delegate hop. Two separately evaluated facets cannot
share a journal or sequentially authorize one root transition. Therefore the ordinary
one-participant batch wrapper described below is directly applicable only when all selected handlers
execute in one physical covenant context. A future multi-facet batch needs either:

1. compiler colocation into one facet;
2. a newly generated settlement facet which alone executes/authenticates the complete transition; or
3. authenticated facet intents consumed by one settlement authority.

Merely co-spending several current facets is unsound and remains rejected.

### 0.1 Go/no-go result

The shared analysis, scalar journal, callable handlers, local batches, and narrow repeated-callee
batch may start in the order specified by `compiler-hidden-batch-v1.md`. These features reuse the
existing external-call identity and target-pinning model and do not require the general carrier.

The detailed graph semantics remain useful research, but the general transcript is not ready to
implement. It must first pass measured covenant-overhead, immutable-version interoperability,
multi-UTXO contention, and demonstrated-demand gates. In particular, no five-table format, carrier
controller, or general cycle route is frozen by this note.

General multi-facet settlement is deliberately not part of v1. The resolved v1 behavior is compiler
colocation into one settlement artifact when it fits and a measured compile error otherwise. This is
a closed scope boundary rather than an implementation ambiguity.

The initial protocol must require a finite invocation expansion and an acyclic result-dependency
order. General “unique fixed point” execution is deferred; handlers are not repeatedly executed
until state converges.

---

## 1. Decision summary

The long-term architecture under research is:

```text
concrete call arguments + connected contracts
                    |
                    v
          SDK transcript derivation
                    |
        unique physical participants
        + ordered logical invocations
                    |
      +-------------+-------------+
      |                           |
      v                           v
participant A                 participant B
one owner input               one owner input
N callable handlers           M callable handlers
one shared journal            one shared journal
one state flush               one state flush
```

The load-bearing rules are:

- A state UTXO is consumed at most once. Repeated calls become logical handler invocations, not
  repeated physical inputs.
- The owner of a category is the sole physical writer of that category's state. A caller invokes a
  typed handler; it never sends a raw foreign-slot write.
- Calls within one participant execute in a defined order against a read-your-writes journal.
- The SDK may discover and propose the finite transcript, but every covenant verifies the relevant
  identities, order, arguments, results, completeness, and final state.
- Existing one-selector entry points remain the fast path. Batching is additive and fail-closed.

The earlier idea of a synchronous NFT outbox carrying `{op, slot, value, nonce}` is not the preferred
design. It exposes storage layout, grants overly broad write-shaped authority, adds token lifecycle
machinery, and is unnecessary for same-transaction composition. Persistent outbox NFTs remain a
possible *asynchronous* protocol, separate from the synchronous transcript protocol.

The discarded idea of representing strings/bytes as big integers also does not affect this design.
It changes representation without resolving write conflicts, ordering, payload size, or persistence.

The BCH 2026 increase to 128-byte NFT commitments improves ordinary state packing, but an input state
commitment is pre-state and cannot carry the current transaction's transcript without a preparatory
state transition. The initial hidden batch needs no carrier. A future graph-protocol spike may
compare carrier and compact nulldata encodings, without implying either is selected.

---

## 2. Current behaviour and the actual gap

Pure internal/private/public functions already compile once as `OP_DEFINE` subroutines and direct
calls emit `OP_INVOKE`. Pure direct and mutual recursion and calls in loops work within VM limits.

Functions are force-inlined and sometimes dropped when they touch state/covenants, including state
and storage-reference operations, external/low-level calls, and mapping-storage returns. The root
cause is that physical state reads, external-call groups, and write covenants depend on entry-point
`blockLayout`; a standalone subroutine has no such layout.

This causes four distinct failures:

| failure | current consequence | required layer |
|---|---|---|
| stateful helper reused/called in a loop | inlining, code bloat, bespoke lowering | journal + callable handler |
| recursive state-writing helper | inline/drop cannot close the recursion | journal + callable handler |
| same stateful callee invoked twice | two call slots attempt to consume one callee state | batch dispatcher + journal |
| `A -> B -> A` | physical-call tree repeats A; auto-resolution rejects it | invocation transcript + batch dispatch |

---

## 3. Layer 1: owner-local write-back journal

The entry point becomes the storage controller. Callable handlers operate only on logical state;
the controller performs physical prefetch and flush:

```text
entry wrapper
    prefetch required state
    initialize storage context + journal
    OP_INVOKE selected handler(s)
    flush every dirty slot once
    emit the existing state covenants

handler
    journalLoad(logicalSlot)
    compute
    journalStore(logicalSlot, value)
```

`journalLoad` must implement read-your-writes. Ordinary owner-local program order therefore retains
normal assignment semantics; no reducer is required merely because a value is written twice.

### 3.1 Substrate

`OP_INVOKE` shares the data and alternate stacks across frames. The normative journal is a
read-your-writes vector; Release 1 selects its measured VM representation. The default candidate uses
authenticated base values plus an append-only `(slot, value)` write log, avoiding quadratic
deep-frame replacement. Its context contains:

```text
controllerMasterIndex
current logical invocation context
prefetched values
dirty set / dirty values
result registers
```

This must respect the combined stack/altstack/function memory limit. Transient altstack users must
be balanced on every handler return.

### 3.2 Persistence backends

The journal does not replace existing state soundness mechanisms:

| logical state | journal key | flush backend |
|---|---|---|
| scalar / packed field | field slot | existing commitment reconstruction |
| mapping entry | `(mapping, key)` | existing entry/C2 covenant |
| collection/chunk | `(collection, index/chunk)` | dynamic-storage covenant |
| nested lvalue | composite logical slot | corresponding existing backend |

The first phase should cover scalars only. Mapping and collection support follows after the controller
can conservatively prefetch the concrete keys/chunks required by the derived invocation sequence.
A cold dynamic key first discovered deep inside a handler remains the narrow hard case: surface it
through access analysis, pass an authenticated entry table/storage context, or fail closed until the
runtime lookup protocol is proven.

### 3.3 Auto-derivation compatibility

Physical output covenants stay in the top-level wrapper. This avoids the current trace scanner's
`ip === 0` ambiguity across `OP_INVOKE` frames and permits byte-identical flush covenants. The first
journal phases must prove existing direct-call bytecode/derivation remains unchanged where the fast
path is selected.

---

## 4. Layer 2: callable handlers and compiler-implied batch dispatch

An externally callable function is separated into a reusable handler and physical wrappers:

```text
DEFINE doSomethingHandler(args, logicalCallContext)
    validate function conditions
    update journal
    return logical result

ordinary doSomething wrapper
    initialize journal
    invoke handler once
    flush

compiler-generated batch wrapper (internal artifact detail)
    initialize journal
    for each invocation targeted at this participant:
        establish logical msg.sender / msg.sig / msg.data
        dispatch selector to handler
        record result
    flush once
```

Thus:

```solidity
function helper() internal {
    B(b).doSomething();
    B(b).doSomething();
}
```

does **not** spend the ordinary `doSomething` selector twice. Auto-derivation builds two logical
invocations, while one physical B input selects the compiler-generated batch route; B invokes the
handler twice and writes its state once.

Handlers still execute every business `require`. A failed handler invalidates an all-or-nothing
batch. The state-preservation/covenant epilogue executes once after all handlers. Return values are
keyed by logical invocation ID rather than requiring an indistinguishable return event per call.

Batching is not a grammar construct, source-level modifier, or public API that developers call. The
compiler may emit an internal dispatcher and artifact metadata for it; the SDK chooses that physical
route while preserving the source ABI and ordinary `B(b).doSomething()` syntax. The internal name or
selector is reserved compiler plumbing and is not a stable ABI promise.

The compiler/SDK should imply batch dispatch when the concrete derived invocation graph requires
more than one logical invocation of the same physical participant, including a back-edge which
revisits an existing participant. A single logical invocation continues to use the current direct
wrapper. The compiler may also lower a source-level loop or an ordinary user-defined batch function
to the same machinery when analysis proves the target set and access requirements; the source does
not opt in by naming the dispatcher. If batching is required but a handler, dynamic access, target,
or resource bound cannot be proven, compilation/construction fails with the callsites that forced
batching rather than asking the developer to invoke a magic function.

---

## 5. Layer 3: transaction-local invocation transcript

The synchronous “bus” is best understood as a finite verified execution transcript, not a queue and
not foreign storage writes.

This section records possible layer 3 semantics, not an implementation commitment. Layers 1-2 use
the smaller protocol in `compiler-hidden-batch-v1.md`. General callbacks and multi-participant
cycles remain rejected until the layer 3 go/no-go gates in section 8 are met.

### 5.1 Logical model

The transcript contains a participant table and ordered invocation table. A baseline invocation is:

```ts
interface Invocation {
  id: bigint;
  targetParticipant: bigint;
  callerInvocation: bigint | Origin;
  selector: bytes4;
  args: bytes;
  callsiteId: bigint;
  occurrence: bigint;
}
```

Repeated loop calls use a compiler-assigned `callsiteId` and contiguous `occurrence` values. A
synchronous replay nonce is unnecessary because consuming participant state already makes the whole
transaction non-replayable. Persistent asynchronous messages would require their own nonce scheme.

The transcript may also carry logical results and intermediate commitment digests where a downstream
invocation consumes an earlier result. Payloads larger than the transcript medium use hash-bound
witness/chunk data; hashing does not remove their linear transaction and verification cost.

### 5.2 Auto-derivation becomes graph construction

The current external-call resolver builds a physical call tree and rejects a back-edge. It should
instead build a graph:

```text
participants = unique by contract identity
invocations  = unique by logical invocation identity
```

Worklist derivation:

1. Seed the root invocation from the user call.
2. Resolve concrete targets and arguments from parameters, state, registries, function pointers, and
   known artifacts.
3. Symbolically/VM-execute the handler against its participant's current logical journal state.
4. Append newly discovered logical invocations and results.
5. Reuse an existing participant when an address/category repeats; never add its UTXO twice.
6. Continue until no new invocation is discovered; execute each logical invocation exactly once.
7. Reject non-termination, duplicate logical identities with inconsistent contents, or cyclic
   result dependencies.
8. Canonicalize, acquire each participant's physical state once, derive final states, build, and
   perform the existing VM probe.

Auto-derivation is therefore not just an ergonomic helper. It is the off-chain witness solver. It may
discover runtime targets, repeated callees, finite loops, callbacks, and ordered result dependencies.
On-chain checks must nevertheless make omission, substitution, reordering, and forged results fail.

### 5.3 Agreement, authenticity, and completeness

Every participant must parse the same versioned carrier transcript, verify its mandatory signed
`SCBH` commitment output, and verify:

- its exact physical identity, state category, and permitted code/proxy identity;
- the complete contiguous range of logical invocations targeted at it;
- the complete range of outbound invocations produced by its handlers;
- caller identity derived from the authenticated parent invocation, not supplied as a free argument;
- selector, calldata, callsite, occurrence, results, and canonical order;
- one execution per invocation ID and no duplicate row key;
- one final output for every owned dirty state object.

The deferred candidate uses the explicit canonical table and carrier described in
`invocation-transcript-v1.md`. That encoding is intentionally unfrozen. A future decision must
compare it with smaller encodings and prove equivalent exhaustiveness under measured BCH 2026 cost.

### 5.4 Ordered writes and conflicts

Because handlers execute in transcript order against an owner-local journal, normal assignments,
bytes/string overwrites, and result-dependent operations are well-defined within one participant.
The bus does not expose `SET foreign.slot` messages.

Conflicts remain only where the transcript does not define a valid order/authority, for example two
independent proposed replacements with no handler semantics. These must be rejected or expressed by
an explicit handler policy such as compare-and-swap. Reducers remain useful optimisations for token
balance deltas and counters, but are not the universal semantic model.

State operations therefore fall into three implementation classes:

| class | examples | rule |
|---|---|---|
| ordered journal operation | assignment, bytes/string replacement, result-dependent update | execute the owning handler in transcript order |
| future reducible optimisation | numeric delta, token balance/supply delta, allowance spend | deferred beyond v1 |
| conditional/exclusive write | compare-and-swap, independent replacement proposals | verify the expected pre-state or reject conflicting writers |

Large bytes/string values remain ordinary byte payloads. A transcript record may carry a payload
digest and an authenticated witness/chunk reference, but the owner must verify and materialise the
actual bytes. The discarded bigint encoding is not part of the implementation.

ERC-20-style participants remain an important proving case, but v1 executes transfers, allowance
spends, approvals, minting, and burning in logical order. Delta aggregation is deferred beyond v1;
at the initial two- and three-call corpus rungs it does not justify making a compiler equivalence
proof part of deployed semantics. Absolute `approve` mixed with spending remains ordered.

### 5.5 Impossible-chain detection

Batch dispatch is not a fallback which makes every call graph valid. The toolchain must reject a
graph before transaction construction when it cannot be represented as one finite, deterministic
transition per physical state owner.

Detection has two stages:

1. **Compiler analysis** operates on possible targets, handler call/effect summaries, state-access
   regions, return dependencies, and strongly connected components. It rejects shapes which are
   impossible for every runtime binding and records conditional constraints for unresolved aliases.
2. **SDK derivation analysis** operates on concrete addresses/categories, arguments, loop counts,
   mapping keys, connected artifacts, and discovered callbacks. It discharges the compiler's
   constraints, groups repeated participants, or rejects the concrete invocation graph.

A chain is admissible only if all of these hold:

- every repeated physical participant can be represented by one implied batch route;
- every state object has exactly one physical settlement authority;
- handler invocations define a finite deterministic order and result dependencies are acyclic;
- every intermediate read is available from that participant's ordered journal or an authenticated
  preceding result, rather than an imagined cross-input intermediate state;
- every state access required by the handlers can be prefetched/authenticated and flushed once;
- lifecycle, delegate, unsafe, failure-catching, and low-level-call semantics used by the chain are
  supported by batch execution;
- the derived graph and transaction fit the consensus resource limits.

The following are compile/derivation errors, not runtime retries:

| impossible shape | reason |
|---|---|
| external recursion/cycle whose concrete invocation expansion does not terminate | no finite transaction transcript |
| `A.result` depends on future `B.result` while `B.result` depends on future `A.result` | cyclic value dependency; fixed-point execution is not part of the initial protocol |
| two physical settlement paths attempt to consume or author the same state UTXO | UTXO state contention / multiple authorities |
| a handler requires another input's unsettled intermediate post-state | reentrancy-like semantics unavailable across evaluations |
| repeated target lacks a valid compiler-generated batch route | one physical input cannot dispatch the required handlers |
| dynamic target/artifact or dynamic storage access remains unresolved at the derivation boundary | completeness and target identity cannot be proven |
| an invocation expects to catch arbitrary failure of a co-spent covenant | any failing input invalidates the transaction |
| the canonical transcript is ambiguous, oscillates, or exceeds limits | no unique valid atomic settlement |

Diagnostics must report the shortest relevant call chain/SCC, the repeated physical participant, the
contended state resource or cyclic result edge, and the source callsites. For example:

```text
Cannot atomically resolve A.start -> B.process -> A.callback:
  A.start's result requires B.process.result,
  but B.process.result requires A.start.result.
  Cyclic result dependency has no proven unique solution.
```

Conservative uncertainty must fail closed only at the latest safe boundary. The compiler should not
reject a potentially valid graph merely because two interface-typed targets might alias; it records
the alias constraint, and concrete auto-derivation decides after resolving their identities.

---

## 6. What the surveyed contracts tell us

The review covered the Solidity contracts under `../mistswap` and
`../effectiveacceleration.ai/contract`. It found that repeated stateful participants are common, not
just a circular-call edge case.

| proving case | observed pattern | required milestone |
|---|---|---|
| `TreasurySplit.split` | same token `transfer` twice | repeated-callee batch |
| Marketplace reward distribution | same EACC token `transfer` three times | token batch/ledger |
| `MasterChef.updatePool` | same SushiToken `mint` twice | token batch + shared supply journal |
| `MasterChef.massUpdatePools` | stateful helper in a loop | callable state handlers + mapping journal |
| `BentoBox.batch` | ordered self-`delegatecall` loop | implied local batch dispatch + journal |
| `KashiPair.cook` | ordered local actions, repeated BentoBox, result chaining | ordered transcript + journals |
| Kashi liquidation | BentoBox before/after a swapper | participant grouping + transcript |
| Unicrow release/claim | `Unicrow -> Claim -> Unicrow`, then repeated payouts | cyclic transcript |
| `UnicrowClaim.claimMultiple` | repeated Unicrow/token/reward participants in a loop | dynamic finite transcript |
| BentoBox flash loan | transfer out, callback, repayment condition | cyclic final settlement |
| Uniswap V2 flash swap | transfer out, callback, final balance/K check | cyclic token ledger |
| router multi-hop | intermediate token participates in adjacent hops | group by unique token/pair |
| `Multicall2.aggregate` | arbitrary finite all-or-nothing calls | dynamic transcript |
| `Multicall2.tryAggregate(false, ...)` | continue after arbitrary foreign failure | residual hard boundary |

These operations are **solvable**, subject to finite resource limits and participant support. They
all admit one pre-state and one post-state per owner, sometimes through ordered journal execution and
sometimes through an aggregate ledger. The table names implementation gates, not blockers.

The first three rows are not literally single-participant transactions: the application and token
are distinct physical owners. They are nevertheless narrow one-caller/one-repeated-callee cases, so
existing target pinning can authenticate them without the general participant graph.

### 6.1 Recommended proving ladder from the corpus

| rung | proving case | planning envelope before measurement |
|---|---|---|
| 1 | **TreasurySplit**: repeated same-token call | about 2 participants / 3 invocations / 3-5 resources |
| 2 | **Marketplace reward triple** | about 2 participants / 4 invocations / 4-6 resources |
| 3 | **MasterChef double mint** | about 2 participants / 3 invocations / 3-6 resources |
| 4 | **BentoBox local batch** | 1 participant; bound actions to 8 initially |
| 5 | **Kashi cook subset** | target 2-4 participants / 8-16 invocations / 12-24 resources |
| 6 | **Unicrow release/claim** | target 3-5 participants / 8-16 invocations |
| 7 | **Uniswap flash swap** | target 3-5 participants / 8-16 invocations / up to 24 resources |
| 8 | **Bounded claimMultiple/multi-hop** | may exceed the candidate 8/24/24 envelope; cap or split explicitly |

These are planning estimates, not protocol promises. Release 0 establishes the measurement harness;
the release owning each rung records its actual encoded bytes and VM cost before shipping. A rung
which exceeds its envelope is bounded more tightly or split across transactions.

This ladder is preferable to beginning with a generic N-to-N bus or persistent outboxes.

---

## 7. What remains genuinely fundamental

Auto-derivation removes many apparent blockers: runtime targets, repeated participants, callbacks,
finite loops, and result-dependent sequences can all be discovered and supplied as a witness. The
remaining hard boundaries are narrower:

1. **Arbitrary catchable foreign failure.** If a co-spent foreign covenant fails, the transaction is
   invalid. `Multicall2.tryAggregate(false, ...)` cannot soundly turn an arbitrary target's consensus
   failure into `success=false` unless the target cooperatively returns a soft failure or supplies a
   verifiable failure proof.
2. **Duplicate physical consumption.** One UTXO cannot be spent twice. The architecture must always
   collapse calls to one transition, partition ownership explicitly, or use multiple transactions.
3. **No finite unique transcript.** Non-termination, cyclic result dependencies, inconsistent
   duplicate invocations, or an application conflict with no defined order has no canonical state
   to derive. Fixed-point execution is outside the initial protocol.
4. **Consensus resource ceilings are the primary format constraint.** A finite batch can still
   exceed transaction, input bytecode, script, operation, hashing, stack/memory, or state-UTXO
   limits. The BCH 2026 cost model drives the streaming format and frozen maxima; an over-limit graph
   must be bounded or split across transactions.
5. **Mutually baked P2SH addresses.** The Unicrow/Claim constructor topology creates a hash fixed
   point if both peer addresses are baked into redeem scripts. Use late-bound state, a registry,
   proxy, factory identity, or one-way immutable reference.
6. **Cross-transaction hot-state contention.** One transaction can batch many logical writes to a
   hot slot; two competing transactions still conflict on its current UTXO and one must retry.
   For an N-owner graph, success requires every selected outpoint to remain current, so practical
   success probability compounds across owners. The SDK must revalidate all outpoints immediately
   before signing/broadcast and expose deterministic retry/re-derivation; this mitigates but cannot
   eliminate contention.

The bus must not claim that BCH literally acquires an EVM cross-input call stack. The supportable
promise is stronger and more precise: a finite graph of authenticated logical invocations can be
atomically verified, with every physical state owner evaluated and flushed once.

---

## 8. Implementation plan

The approved work is organized as independently releasable vertical slices. Every release must give
users a concrete benefit, preserve the prior fast paths, and be safe to stop at permanently. Later
releases may depend on earlier ones, but no release exists only as dormant scaffolding for a final
bus.

### Release 0 - analysis, diagnostics, and cost evidence

**Immediate benefit:** impossible repeated-owner chains, target aliases, recursion, and split
colocation failures produce early source-level diagnostics instead of late duplicate-input or
bytecode failures. The extracted footprint service also removes duplicated split/compiler analysis.

- Add regression sources and record current failure modes and byte sizes.
- Extract split call-closure and `SplitStateFootprint` analysis into a shared compiler service.
- Add state-access, external-result, alias/contention, boundedness, and strongly-connected-component
  summaries.
- Emit actionable diagnostics with the shortest call chain, repeated owner, conflicting resource,
  and required colocation closure.
- Hand-measure journal primitives, B's positional second-push parser/dispatcher, A's canonical
  expected blob accumulator, and A's positional actual-blob extraction/direct byte comparison under
  `BCH_2026_05`; this does not enable batch codegen.

**Ship gate:** existing artifacts remain byte-identical; diagnostics are deterministic; measured
results and rejected examples are checked into tests. This release contains no new covenant surface.

### Release 1 - scalar stateful subroutines

**Immediate benefit:** internal/private scalar state helpers stop being force-inlined. The same
helper can be called from several sites or a bounded loop, reducing contract size without any SDK or
transaction-format change.

- Introduce an owner-local scalar context and benchmark append-only versus explicitly threaded
  journal representations.
- Prefetch scalar reads, lower helper reads/writes to read-your-writes operations, and flush through
  the existing direct covenant epilogue.
- Emit eligible stateful helper bodies once as `OP_DEFINE`/`OP_INVOKE`; retain inline lowering when
  the cost model says it is smaller.
- Preserve the current source selector, `msg` context, SDK call path, and physical transaction.

**Ship gate:** multi-site and loop-called scalar helpers are smaller or no worse than baseline,
match sequential execution, and pass hostile output-substitution tests. Users benefit even if
recursion and batching are never shipped.

### Release 2 - bounded scalar recursion and complete handler ABI

**Immediate benefit:** direct and mutual recursive state algorithms become expressible when the
compiler proves a static bound or the VM/resource estimator proves the concrete bound.

- Finish reusable handler context for arguments, returns, modifiers, `msg.sig`, `msg.data`, and
  caller identity.
- Support bounded recursion with one shared journal and deterministic over-budget diagnostics.
- Integrate delegate mode only after its context does not conflict with existing altstack users.

**Ship gate:** recursive scalar writers and mutually recursive handlers match a sequential oracle;
unbounded or over-budget recursion fails before transaction construction. Release 1 remains usable
for contracts that do not opt into recursion.

### Release 3 - mappings, bytes, and collection journals

**Immediate benefit:** stateful helpers and loops can safely update real application state rather
than only scalars, including ERC-20 balances/allowances and MasterChef-style mappings.

- Extend access analysis to concrete mapping keys, collection indices, and authenticated dynamic
  chunks.
- Deduplicate witnessed entries and flush once through existing C2/entry/dynamic-storage backends.
- Implement ordered replacement, append, delete, and disjoint-index updates for bytes, strings, and
  arrays.
- Keep dynamically discovered cold keys fail-closed until runtime lookup is independently proven.
- Execute token operations sequentially; do not add delta aggregation.

**Ship gate:** helper loops over mappings, repeated `transferFrom`, same-key overspend, and
MasterChef-style updates match a sequential reference model. This release still uses ordinary
single-entry transactions.

### Covenant protocol boundary

Releases 0-3 change compiler analysis and lowering but add no transaction-visible authorization
protocol. Releases 4-5 introduce immutable covenant surface: failure can mean accepting a hostile
transaction rather than rejecting source. Before Release 4 begins, the frozen encoding, positional
extraction rule, parser, direct whole-blob exhaustiveness check, signature route binding,
introspection semantics, version behavior, and byte/op budgets require a dedicated security review.
Release 4 and Release 5 each require a separate adversarial review before default enablement.

### Release 4 - owner-local hidden batch

**Immediate benefit:** one transaction can execute several public handlers of the same contract in
order with one owner input and one state flush, enabling a bounded BentoBox-style batch while source
syntax and ABI remain unchanged.

- Freeze the small batch encoding only after Release 0 measurements.
- Add the compiler-hidden dispatcher and artifact capability metadata; no grammar or developer-named
  `__batch` function is introduced.
- Have the SDK select the route for several owner-local invocations and preserve the direct wrapper
  for one invocation.
- Support ordered results/events and all-or-nothing failure.

**Ship gate:** scalar and mapping-backed two/three/eight-row local batches reject malformed,
duplicated, omitted, and reordered rows and author exactly one post-state. This release has no
cross-contract batch protocol. An independent adversarial review MUST cover parser ambiguity,
unchecked suffixes, row-count substitution, selector confusion, output substitution, and limit
bypass before default enablement.

### Release 5 - one repeated external callee

**Immediate benefit:** ordinary source such as two `B(b).doSomething()` calls consumes B once.
TreasurySplit, Marketplace reward distribution, and MasterChef double mint become constructible
without a general bus.

- Group resolved external callsites by physical owner before allocating transaction layout.
- Reuse existing target/category/self-pinning and immediate-caller authentication.
- Make A accumulate the canonical rows actually reached and compare the complete expected blob by
  direct byte equality with the positional second push extracted from B; make B apply the same
  locator, require canonical complete consumption, and execute it once; retain distinct
  return/event/effect slots.
- Reject multiple independent callers, more than one repeated callee, R4+R5 composition, forwarding
  from batched B to D, callbacks, participant cycles, and unresolved aliases.

**Ship gate:** the three corpus cases pass with one callee transition; caller forgery, target
substitution, omission, duplication, reordering, result substitution, and duplicate physical B
inputs all fail. An independent adversarial review MUST cover conditional injection, unchecked
suffixes, count substitution, blob extraction position/decoys, signature route confusion,
introspection divergence, target aliasing, and output/effect substitution.
This is the final approved synchronous scope.

### Implementation checkpoint (2026-07-23)

The releases now deliver value independently as intended:

| release | implemented increment | current boundary |
|---|---|---|
| R1 | reusable scalar write-back handlers and one final authenticated flush | conservative fallback for ineligible closures |
| R2 | bounded direct/mutual recursion, hidden invocation context, SDK VM preflight | concrete over-budget/signature cases fail closed |
| R3 | one-entry mapping value threading plus dynamic bytes/string replacement, append, and delete | dynamic cold keys and multi-resource aliases remain conservative |
| R4 | opt-in hidden SCB1 scalar route and SDK `batch()` construction | default off; collections, returns/events/effects, signatures, and route-sensitive context rejected |
| R5 | opt-in one-owner repeated external grouping, exact caller/callee blob binding, and one B settlement | default off; graph composition, callbacks, forwarding, and blobs over 223 bytes rejected |

The compiler suite passes 2,280 tests. The SDK suite passes 3,229 tests (with the repository's
existing 24 skips and 9 todos) after using the documented `getFunction(name)` escape hatch for a
source contract whose own ABI function is named `batch`.
The repository-wide lint target still reports the pre-existing branch-wide backlog, so lint is not
a release gate claimed by this checkpoint. Neither experimental covenant option may be enabled by
default merely from this implementation checkpoint; the independent adversarial reviews remain
normative.

### Release discipline

Each release has its own artifact capability bit/version, compiler option during hardening, hostile
transaction suite, byte/op regression budget, migration note, and changelog example. A compiler or
SDK may consume only capabilities advertised by the deployed artifact. No release emits witness
fields which are ignored until a later release, and no later protocol may silently change the
semantics of an earlier artifact.

### Deferred release A - acyclic multi-participant transcripts

This release MUST NOT begin merely because Releases 0-5 pass. It additionally requires every layer 3
go/no-go gate below. If adopted, it must ship bounded acyclic graph composition without waiting for
cycles.

- Replace the current bounded tree/back-edge rejection with a finite invocation worklist which
  deduplicates physical participants without re-executing logical invocations.
- Resolve targets from arguments, state, registries, function pointers, and available artifacts.
- Carry logical results into later arguments and derive intermediate participant journal states.
- Add deterministic termination, cyclic-result, duplicate-identity, size, and unresolved-artifact
  diagnostics.
- Resolve compiler-emitted alias/contention constraints against concrete participants and state keys;
  reject impossible schedules before fetching/building duplicate physical inputs.
- VM-prove the explicit canonical transcript carrier and exhaustiveness protocol before optimising
  its encoding.

**Gate:** a bounded Kashi `cook` subset with repeated BentoBox calls and result chaining derives
automatically and matches a sequential oracle.

### Deferred release B - circular participant graphs

This is separately adoptable after release A. Acyclic graph users must not wait for, pay for, or
parse cycle support.

- Permit a back-edge to an existing participant as a new logical invocation rather than a new input.
- Compute strongly connected participant components and require a finite unique transcript.
- Verify every participant's inbound/outbound ranges and results against one digest.
- Preserve exactly one physical state controller/output per category and reject two settlement
  authorities for the same state object.

**Gate:** port the Unicrow release/claim callback using late-bound deployment references. Then prove
a Uniswap-style flash swap by final token deltas and `K` invariant. Attack missing callbacks,
fabricated repayment, circular result inconsistency, participant substitution, and transcript
truncation.

### Deferred release C - scaling, write policies, and cooperative failure

Each scaling or write policy should be feature-gated and released when independently useful; it is
not one required bundle.

- Exercise bounded `claimMultiple`, router multi-hop, and larger `cook`/batch inputs.
- Add budget estimation and actionable multi-transaction diagnostics.
- Consider compact transcript commitments only after equivalence to the explicit table is proven.
- Add explicit ordered replacement, compare-and-swap, bytes/string payload, and overlapping-write
  conflict tests.
- Add cooperative typed soft-failure handlers; never present them as catchable arbitrary covenant
  failure.

**Gate:** ordered and optimised executions match the same reference interpreter; conflicting writes,
payload substitution, and false soft-failure claims fail in VM tests; oversized batches fail before
construction with a deterministic continuation boundary.

### Separate future product - asynchronous messages

- Introduce persistent outbox/intent NFTs only for calls intentionally processed in later
  transactions; do not reuse them for synchronous transcripts.
- Bind protocol version, sender identity, destination owner, selector, arguments/payload digest,
  nonce, expiry, and optional cancellation policy.
- Require the destination owner to consume each intent at most once and advance replay state before
  authoring its post-state.
- Define liveness and recovery explicitly: who may relay, who funds processing, when the sender may
  cancel, and what happens to expired or permanently failing intents.
- Keep asynchronous results as new authenticated messages rather than pretending the original
  transaction resumes.

**Gate:** delivery, replay, duplicate, wrong-destination, payload substitution, cancellation race,
expiry, and relayer-substitution attacks fail; synchronous contracts and their transcript format are
unchanged.

### Additional go/no-go gates for layer 3

The general graph protocol remains rejected unless all of these hold:

1. **Observed need:** shipped layers 1-2 encounter real, bounded `A -> B -> A` or multi-caller
   workloads which cannot be expressed by the narrow batch.
2. **Measured frozen cost:** a complete parser, validator, and transaction-binding implementation is
   measured under `BCH_2026_05`. The target is at most roughly 800 bytes of fixed redeem-script
   overhead per participant; any higher result requires an explicit security/utility review rather
   than silently consuming 15-30% of the contract budget.
3. **Real-corpus fit:** the overhead is measured on Effective Acceleration contracts and split
   artifacts near the 10,000-byte wall. A protocol which makes the relevant artifacts undeployable
   does not pass.
4. **Version interoperability:** artifacts advertise supported protocol versions; construction uses
   an exact common version; and the design explains how newer contracts retain old routes or how
   incompatible immutable deployments fail predictably. A version byte alone is not a migration
   strategy, and requiring every contract to carry unbounded legacy parsers is unacceptable.
5. **Contention/liveness:** benchmarks measure stale-input and retry behavior as participant count
   grows. Default participant limits are selected from those results, not only consensus capacity.
6. **Security review:** participant binding, caller authentication, owner uniqueness, exhaustive
   streaming validation, and cycle semantics pass an independent hostile-transaction review.

Failure of a gate leaves layer 3 disabled. It does not block or weaken the journal and hidden batch.

---

## 9. Release invariants

Each invariant asserts one property and is tagged with the first release that requires it. The same
tags MUST generate the per-release implementation checklist and hostile-transaction suite; they are
not an informal partition.

| first applies | invariant |
|---|---|
| R1 | Only the authenticated category owner authors its state output. |
| R1 | Every dirty scalar has exactly one final value flushed through the existing covenant backend. |
| R1 | Read-your-writes order matches sequential source execution. |
| R1 | Contracts not using the new lowering retain their prior fast path and security properties. |
| R2 | Unsupported or over-budget recursion fails closed before construction. |
| R3 | Every dirty entry/chunk has exactly one authenticated final output. |
| R3 | Unsupported dynamic access and unresolved storage witnesses fail closed. |
| R4 | The local blob is canonical, completely consumed, and contains no unchecked suffix. |
| R4 | Every local row executes exactly once in canonical order with authenticated arguments and results. |
| R4 | One batch has only one physical owner input and one settlement authority. |
| R5 | The callee is pinned to its intended actual locking bytecode, category, and permitted lineage. |
| R5 | The immediate caller is derived from an actual authenticated co-spent input, never a witness identity. |
| R5 | A and B locate the blob as the same positional second push; magic bytes are never a locator. |
| R5 | Direct whole-blob byte equality covers every row actually reached and all bytes B will execute. |
| R5 | Every A outbound invocation has exactly one B inbound row; no omitted or injected row affects state. |
| R5 | Canonical order, occurrence, selector, arguments, results, events, and effects are verified in script. |
| R5 | A repeated callee has exactly one physical owner input and settlement authority. |
| R5 | Unsupported aliases, multiple callers, callbacks, and cycles fail closed. |
| Graph A | Every participant validates the same complete graph witness under the selected future format. |
| Graph A | No accepted graph relies on visibility of foreign cross-input intermediate state. |
| Graph B | Invocation expansion is finite and contains no future-result dependency. |
| Async | Delivery and cancellation are mutually exclusive. |
| Async | Sender, destination, payload, and nonce are authenticated, and each nonce is consumed at most once. |

---

## 10. Resolved initial decisions and residual research risks

The initial implementation resolves:

- an abstract read-your-writes journal, with representation selected by measurement;
- reusable stateful handlers and a compiler-hidden batch route;
- one caller plus one repeated external callee using existing target/self pinning;
- ordered rows without ERC-20 delta aggregation;
- split-handler colocation or fail-closed rejection;
- ordinary direct calls as the unchanged fast path.

The general transcript retains design risks and is deliberately not implementation-ready:

- fixed parser/projection/exhaustiveness overhead may be uneconomic or exceed real contract budgets;
- immutable protocol-version interoperability has no accepted design;
- multi-owner UTXO contention may make large atomic graphs impractical;
- projected callbacks and participant cycles require independent security review;
- the selected journal representation still must be proven across nested `OP_INVOKE` and existing
  transient altstack users.

Asynchronous intents remain a separately versioned future protocol. Their nonce, expiry,
cancellation, relayer funding, and liveness policy do not affect the initial batch.

---

## 11. Final conclusion

The immediate architectural win is not a generic message bus. It is making stateful functions real
callable handlers through an owner-local journal, then letting the compiler imply one physical batch
route when a derived call graph needs several handlers on one participant. Auto-derivation can
subsequently group repeated callees and build a finite cross-contract transcript, including circular
graphs, without consuming any participant state twice.

The surveyed contracts justify implementing through the first four proving rungs now: repeated token
calls and owner-local BentoBox-style batching. Kashi, Unicrow, and flash-swap graphs remain evidence
for layer 3 research, not justification for freezing it today. Most observed operations have sound
abstract semantics; deployability and liveness remain empirical gates.

The narrow irreducible boundaries are arbitrary catchable covenant failure, absence of a finite
unique transcript, consensus resource ceilings, mutually baked deployment fixed points, and
hot-state contention across competing transactions. Persistent asynchronous intents remain an
optional, separately versioned protocol after synchronous settlement is proven.
