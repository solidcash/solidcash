# State journal semantics

Status: normative compiler behavior.

The state journal is the generated, transaction-local representation of deferred state writes. It is not a wire
protocol, an event log, or a separately deployed object. The message bus may carry a journal's final effects across
a multi-participant composition, but it does not change these rules.

## Read and write model

For each state location, evaluation has one logical pending value:

1. The first read obtains the authenticated input value.
2. A write replaces the pending value.
3. A later read in the same execution observes that pending value.
4. Helper calls and control-flow paths operate on the same logical journal.
5. Successful teardown emits exactly one authenticated final transition for each changed location.
6. Untouched locations are preserved exactly; a failed script creates no outputs and flushes nothing.

Scalar fields are keyed by their compiler-assigned state slot. Collection entries are keyed by the collection and
the canonical runtime key. Dynamic values additionally own an authenticated trailing chunk region. Semantically
equivalent aliases accepted by the compiler must resolve to one cache key; shapes which cannot be canonicalized
soundly fail before code generation.

## Control flow and helpers

Journal lowering preserves source ordering. A return value is evaluated against the current pending state before
teardown writes are emitted. Branches may share journal state only when every admitted exit has a sound flush.
Unsupported early exits, unbounded recursion, dynamic cardinality, or ambiguous aliases receive positioned
compile-time diagnostics rather than a partially journaled route.

Internal helpers that mutate state are inlined or summarized into the caller's journal. Returning helpers retain
their returned value while their state and event effects are settled. Direct and mutual recursion are bounded by
compiler metadata and SDK resource preflight; an execution cannot silently exceed its published slots.

## Collections and dynamic state

Mapping and array entry NFTs are consumed at most once per physical resource. Repeated writes to the same logical
entry coalesce. Creation, update, and deletion preserve the authenticated collection topology and cannot mint,
duplicate, burn, or redirect unrelated entries. Dynamic values authenticate their length, every used chunk, and
the exact used trailing span. Unused trailing capacity is absent rather than padded.

## Effects and composition

Events, BCH transfers, token transfers, return events, and sidecars are effects adjacent to the journal, not journal
values. Their rows are emitted and consumed separately. In a message-bus transaction, each participant still owns
its local journal and the carrier authenticates the cross-participant ordering and settlement of those effects.

## Required evidence

The normative behavior is exercised by `packages/solidc/test/journal-message-bus` and
`packages/solidcash/test/journal-message-bus`. The dated discovery, remediation, and independent-review record is
archived at `archive/journal-message-bus/state-journal-audit-findings.md`.
