# Stateful callable handlers, batching, and cross-contract invocation transcripts

Status: RESEARCH / IMPLEMENTATION PROPOSAL - NOT SCHEDULED.

This note records the conclusions of the state-journal and message-bus research, updated after
reviewing the MistSwap and Effective Acceleration contract corpora. It deliberately separates three
features which were previously discussed together:

1. an owner-local write-back journal;
2. multiple callable handlers inside one physical contract evaluation;
3. an auto-derived, transaction-local invocation transcript across physical participants.

The first two deliver substantial value without a cross-contract bus. The third generalizes them to
repeated callees and finite circular call graphs. Nothing here changes current compiler behaviour.

Related: `subroutine-extraction.md`, `verified-mappings.md`, `mapping-loop-writes.md`,
`dynamic-storage.md`, `evm-storage-parity.md`, `delegatecall.md`, `auto-derivation.md`,
`external-contract-calls.md`, `unified-linear-memory.md`, and `deferrals.md`.

Scope: this document covers ordinary stateful contracts, delegatecall, and cross-contract calls.

---

## 1. Decision summary

The proposed architecture is:

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
one physical input            one physical input
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

`OP_INVOKE` shares the data and alternate stacks across frames. A storage context on the altstack can
therefore survive calls and recursion. It should be the single persistent altstack resident and
contain at least:

```text
controllerMasterIndex
current logical invocation context
prefetched values
dirty set / dirty values
result registers
```

This must respect the combined stack/altstack/function memory limit. Transient altstack users must
unwind around the context.

### 3.2 Persistence backends

The journal does not replace existing state soundness mechanisms:

| logical state | journal key | flush backend |
|---|---|---|
| scalar / packed field | field slot | existing commitment reconstruction |
| mapping entry | `(mapping, key)` | existing entry/vmap covenant |
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
6. Continue until no invocation or logical state changes.
7. Reject non-termination, inconsistent results, or a non-unique/oscillating solution.
8. Canonicalize, acquire each participant's physical state once, derive final states, build, and
   perform the existing VM probe.

Auto-derivation is therefore not just an ergonomic helper. It is the off-chain witness solver. It may
discover runtime targets, repeated callees, finite loops, callbacks, and ordered result dependencies.
On-chain checks must nevertheless make omission, substitution, reordering, and forged results fail.

### 5.3 Agreement, authenticity, and completeness

Every participant must bind the same versioned transcript digest and verify:

- its exact physical identity, state category, and permitted code/proxy identity;
- the complete contiguous range of logical invocations targeted at it;
- the complete range of outbound invocations produced by its handlers;
- caller identity derived from the authenticated parent invocation, not supplied as a free argument;
- selector, calldata, callsite, occurrence, results, and canonical order;
- one execution per invocation ID and no duplicate row key;
- one final output for every owned dirty state object.

The baseline wire format should favour an explicit length-prefixed canonical table, not a Merkle
scheme. A designated transaction witness input or an equivalent common transcript carrier must be
VM-proven before choosing the exact encoding. Compact roots/range proofs are later optimisations and
must prove equivalent exhaustiveness.

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
| reducible optimisation | numeric delta, token balance/supply delta, allowance spend | aggregate only when equivalent to ordered handler execution |
| conditional/exclusive write | compare-and-swap, independent replacement proposals | verify the expected pre-state or reject conflicting writers |

Large bytes/string values remain ordinary byte payloads. A transcript record may carry a payload
digest and an authenticated witness/chunk reference, but the owner must verify and materialise the
actual bytes. The discarded bigint encoding is not part of the implementation.

ERC-20-style participants are an important optimised case. A finite ordered batch may be reduced to
`balanceDelta[account]`, `allowanceSpend[(owner, spender)]`, and a supply delta, provided the token
verifies the immediate logical caller and produces the same result as sequential handler execution.
Absolute `approve` mixed with spending remains ordered; it must not be silently folded as a delta.

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
- handler and result dependencies define a finite deterministic order, or a separately proven unique
  fixed point;
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
| `A.result` depends on future `B.result` while `B.result` depends on future `A.result` | cyclic value dependency with no proven unique solution |
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

### 6.1 Recommended proving ladder from the corpus

1. **TreasurySplit**: smallest repeated same-token call; no loop, cycle, or result chain.
2. **Marketplace reward triple**: three calls and repeated sender balance.
3. **MasterChef double mint**: shared `totalSupply` plus recipient balances.
4. **BentoBox local batch**: ordered read-your-writes and per-invocation results.
5. **Kashi cook subset**: dynamic action list and results feeding later actions.
6. **Unicrow release/claim**: first real `A -> B -> A` state cycle.
7. **Uniswap flash swap**: multi-party cyclic settlement with final invariant.
8. **Bounded claimMultiple/multi-hop**: scale, repeated mappings, and participant grouping.

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
3. **No finite unique transcript.** Non-termination, no fixed point, multiple inconsistent fixed
   points, or an application conflict with no defined order has no canonical state to derive.
4. **Consensus resource ceilings.** A finite batch can still exceed transaction, input bytecode,
   script, operation, stack, or state-UTXO limits and must be split across transactions.
5. **Mutually baked P2SH addresses.** The Unicrow/Claim constructor topology creates a hash fixed
   point if both peer addresses are baked into redeem scripts. Use late-bound state, a registry,
   proxy, factory identity, or one-way immutable reference.
6. **Cross-transaction hot-state contention.** One transaction can batch many logical writes to a
   hot slot; two competing transactions still conflict on its current UTXO and one must retry.

The bus must not claim that BCH literally acquires an EVM cross-input call stack. The supportable
promise is stronger and more precise: a finite graph of authenticated logical invocations can be
atomically verified, with every physical state owner evaluated and flushed once.

---

## 8. Implementation plan

Each phase is independently valuable and gated by VM tests. Do not begin the next protocol layer
until the preceding state invariant is proven against hand-built hostile transactions.

### Phase 0 - measurement and IR boundary

- Add focused regression sources for: recursive scalar writer, state helper in a loop, helper with
  two calls to the same B, and `A -> B -> A` touching one A slot.
- Record current compile failure/byte size/duplicate-input failure as baselines.
- Introduce internal logical `StateSlot`, `StateAccess`, `CallableHandler`, `InvocationId`, and
  `ParticipantId` representations without changing generated bytecode.
- Add conservative per-handler read/write/external-call summaries and strongly connected call-graph
  analysis.
- Add an `InvocationConstraint`/diagnostic model for possible target aliasing, state-owner contention,
  cyclic result dependencies, unsupported handler modes, and boundedness.

**Gate:** metadata is deterministic and existing compiler/SDK suites remain byte-identical.

### Phase 1 - scalar storage context and journal

- Implement a compact scalar storage context shared across `OP_INVOKE` frames.
- Prefetch scalar read sets at the physical wrapper.
- Lower scalar state reads/writes in eligible handlers to journal operations.
- Flush dirty scalars once through byte-identical existing commitment/covenant code.
- Retain the current direct-write fast path for trivial functions where it is smaller.
- Integrate delegate mode by placing `controllerMasterIndex` in the context header rather than as a
  competing persistent altstack value.

**Gate:** recursive scalar writer and loop-called scalar helper execute correctly; direct scalar
fixtures and SDK auto-derivation remain unchanged; stack/op budgets are measured.

### Phase 2 - callable stateful handlers

- Separate eligible functions into reusable handler bodies and ordinary entry wrappers.
- Stop inline-and-drop for scalar-only state helpers whose access sets are prefetchable.
- Preserve logical `msg.sig`, `msg.data`, and caller context in handler calls.
- Support direct/mutual recursion and handler calls inside loops within VM limits.
- Add a cost model so one-use trivial helpers may remain inline.

**Gate:** one handler is emitted once, invoked from multiple sites and a loop, and recursively updates
state with read-your-writes; malformed context calls fail.

### Phase 3 - local batch dispatcher

- Add compiler-generated internal batch dispatch with selector-to-handler routing; expose no new
  grammar and preserve the source ABI.
- Add artifact metadata which lets the SDK select the hidden batch route without depending on its
  internal function name or selector.
- Define canonical local invocation rows and per-invocation result registers.
- Execute multiple handlers in order against one journal and flush once.
- Start with all-or-nothing failure; do not implement generic soft catch.
- Keep ordinary one-call ABI and bytecode paths unchanged unless batching is enabled.

**Gate:** port a bounded BentoBox-style self batch and prove ordered state/results, duplicate-row
rejection, caller-context correctness, and one physical state output.

### Phase 4 - repeated external participant batching

- Change SDK planning from “external call slot = physical group” to logical invocations grouped by
  unique participant identity.
- Lower external calls inside reusable handlers to authenticated logical-invocation emission; do not
  leak physical external-call block offsets into the handler.
- When A calls B twice, automatically select B's compiler-generated batch route once and supply two
  authenticated rows.
- Bind A's outbound rows to B's inbound rows and the common transcript digest.
- Derive and verify a distinct result for every logical invocation.
- Implement participant/callsite/occurrence canonicalisation and completeness checks.

**Gate:** TreasurySplit, Marketplace triple transfer, and MasterChef double mint work with one token
input/state transition; omission, duplication, reordering, target substitution, caller forgery, and
result substitution all fail in VM tests.

### Phase 5 - mappings, collections, and token ledgers

- Extend prefetch/access analysis and the journal to concrete mapping keys and collection indices.
- Deduplicate required state entries across all invocations of a participant.
- Flush through the existing vmap/entry/dynamic-storage backends; do not duplicate their authenticity
  logic.
- Support ordered bytes/string and dynamic-array writes through authenticated payload/chunk data,
  including replacement, append, delete, and disjoint-index updates.
- Add optimised built-in ledgers for ERC-20 balances/allowances/supply and BentoBox shares while
  preserving ordered-handler semantics as the reference oracle.
- Keep deep dynamically discovered cold keys fail-closed until authenticated runtime entry lookup is
  proven.

**Gate:** repeated `transferFrom` spends aggregate allowance correctly; same-key overspend fails;
MasterChef pool loops and a bounded BentoBox deposit/transfer/withdraw batch match a sequential
reference model.

### Phase 6 - transitive auto-derived transcripts

- Replace the current bounded tree/back-edge rejection with the invocation worklist/fixed-point
  planner.
- Resolve targets from arguments, state, registries, function pointers, and available artifacts.
- Carry logical results into later arguments and derive intermediate participant journal states.
- Add deterministic convergence, oscillation, size, and unresolved-artifact diagnostics.
- Resolve compiler-emitted alias/contention constraints against concrete participants and state keys;
  reject impossible schedules before fetching/building duplicate physical inputs.
- VM-prove the explicit canonical transcript carrier and exhaustiveness protocol before optimising
  its encoding.

**Gate:** a bounded Kashi `cook` subset with repeated BentoBox calls and result chaining derives
automatically and matches a sequential oracle.

### Phase 7 - circular participant graphs

- Permit a back-edge to an existing participant as a new logical invocation rather than a new input.
- Compute strongly connected participant components and require a finite unique transcript.
- Verify every participant's inbound/outbound ranges and results against one digest.
- Preserve exactly one physical state controller/output per category and reject two settlement
  authorities for the same state object.

**Gate:** port the Unicrow release/claim callback using late-bound deployment references. Then prove
a Uniswap-style flash swap by final token deltas and `K` invariant. Attack missing callbacks,
fabricated repayment, circular result inconsistency, participant substitution, and transcript
truncation.

### Phase 8 - scaling, write policies, and cooperative failure

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

### Phase 9 - asynchronous messages (separate protocol)

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

---

## 9. Release invariants

These must hold for raw hostile transactions, not only SDK-generated ones:

1. A category owner is the only physical author of its state outputs.
2. Every physical participant appears at most once and is pinned to the intended address/category and
   permitted code/proxy identity.
3. Every logical invocation is authenticated by its caller and processed exactly once by its target.
4. Caller identity and call context are derived from the transcript relation, never trusted witness
   fields in isolation.
5. All participants bind one protocol version and transcript digest.
6. Every declared outbound invocation has one matching inbound invocation; no undeclared invocation
   affects state or results.
7. Canonical order, callsite occurrences, arguments, and results are verified in script.
8. Each owned dirty slot/entry/chunk has exactly one final output, flushed through its existing
   soundness backend.
9. Unsupported dynamic access, unresolved artifacts, ambiguous/non-convergent cycles, conflicts, and
   over-budget batches fail closed with precise diagnostics.
10. Contracts not using handlers/batching retain the current fast path and security properties.
11. If asynchronous intents are enabled, delivery and cancellation are mutually exclusive, sender
    identity and destination are authenticated, and every nonce is consumed at most once.
12. No accepted transcript relies on cross-input intermediate state, contains two settlement
    authorities for one state object, or expands an unbounded invocation cycle.

---

## 10. Principal risks and open decisions

- Exact transcript carrier and parsing cost under BCH input/script limits.
- Exhaustiveness proof cost for many participants and invocations.
- Compact journal layout within the combined 1000-slot memory budget.
- Prefetch/access analysis for deep dynamic mapping keys and storage pointers.
- Dynamic selector dispatch size and whether large contracts require extracted dispatch helpers.
- Logical `msg.sender`, `msg.value`, `msg.data`, origin, and proxy/delegate context parity.
- Return-event compatibility and migration to per-invocation logical result records.
- Auto-derivation convergence when target/argument discovery depends on prior logical results.
- Async nonce, expiry, cancellation, relayer-funding, and liveness policy.
- Keeping the direct single-call path byte- and performance-stable.
- Independent security review comparable to vmap before enabling cross-participant cycles.

---

## 11. Final conclusion

The immediate architectural win is not a generic message bus. It is making stateful functions real
callable handlers through an owner-local journal, then letting the compiler imply one physical batch
route when a derived call graph needs several handlers on one participant. Auto-derivation can
subsequently group repeated callees and build a finite cross-contract transcript, including circular
graphs, without consuming any participant state twice.

The surveyed contracts provide a practical progression from two token transfers to BentoBox/Kashi
batching and finally Unicrow/flash-swap cycles. Most observed operations are solvable; the narrow
irreducible boundaries are arbitrary catchable covenant failure, absence of a finite unique
transcript, consensus resource ceilings, mutually baked deployment fixed points, and hot-state
contention across competing transactions. Persistent asynchronous intents remain an optional,
separately versioned protocol after synchronous settlement is proven.
