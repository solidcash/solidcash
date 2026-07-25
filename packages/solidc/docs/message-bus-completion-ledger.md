# Message-bus completion ledger

Status: ACTIVE IMPLEMENTATION LEDGER. This document prevents the bounded Layer-3 prototype from
being mistaken for completion of the general invocation-transcript design.

Target: the full synchronous message-bus semantics described by
`buffered-state-and-message-bus-research.md`, `compiler-hidden-batch-v1.md`,
`invocation-transcript-v1.md`, and `balanced-block-layout-composability.md`, excluding sharded/faceted
contracts as previously scoped. Although `invocation-transcript-v1.md` was originally marked a
deferred candidate, completing the full specification adopts its semantic requirements as the
implementation target. Wire bytes remain revisable until the measurement and review gates pass.

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
| Standard `msg.sender`-authorized ERC-20 allowance behavior | MISSING | Existing R5 route rejects route-sensitive `msg.sender`; parameter-authorized spender is not equivalent. |

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
| Direct wrapper and transcript wrapper invoke the same compiled business handler | MISSING | Layer 3 generates a separate bounded arithmetic covenant. |
| Arbitrary eligible scalar/mapping/collection method bodies execute against one journal | MISSING | Current Layer-3 journal is one eight-byte `add/sub/mul` field. |
| Modifiers, `require`, `revert`, and normal control flow preserve source semantics | MISSING in Layer 3 | Available in direct compilation, not connected to transcript replay. |
| Calls dispatch by selector and canonical ABI arguments | PROVEN for the admitted non-returning static call class | Compiler-derived native rows bind exact selector/argument prefix. |
| Producer-authenticated ABI return values | MISSING | `deriveNativeExternalCalls` rejects `hasReturnValues` and `opaqueReturn`. |
| Result-dependent continuation and transitive result chains | MISSING for compiled calls | Prototype result rows do not execute ordinary returning methods. |
| Logical callbacks and `A -> B -> A` execute each handler exactly once | PARTIAL | Structural cycle and arithmetic-journal fixtures pass; general compiled callbacks do not. |
| Staticcall snapshots and runtime-enforces no writes/effects | MISSING | No general dirty/effect cursor snapshot implementation. |
| Existing pinned one-hop delegatecall semantics | MISSING from transcript mode | Transcript derivation rejects call modes. |
| Correct `msg.sig`, `msg.data`, `msg.value`, `outState`, and transaction introspection | PARTIAL | Current generated paths cover only a subset; full compatibility table is not implemented. |

## 4. Compiler analysis and automatic derivation

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| Compiler emits handler IDs, state regions, calls, result dependencies, effects and boundedness | PARTIAL | Existing ABI metadata covers calls/arg sources and state footprints, not the complete transcript summary. |
| Impossible call/result cycles and duplicate authorities fail at compile time | PARTIAL | Existing physical resolver and supported Layer-3 shapes fail closed; no full SCC/result-dependency analysis. |
| SDK expands a graph, reuses owners, stabilizes resources and acquires each input once | PARTIAL | Fixed-layout/preorder native derivation exists; no general symbolic worklist. |
| Direct, repeated and transitive calls derive without hand-authored rows | PROVEN for admitted class | `deriveNativeExternalCalls` runtime-branded tables and VM tests. |
| Expressions, dynamic targets, loops, function pointers and batches | MISSING | Explicitly rejected by `derive-native.ts`. |
| Returning, opaque, signature-bearing and low-level calls | MISSING | Explicitly rejected or not representable. |
| Final complete VM probe for every input | PARTIAL | Individual builders/tests probe; no single production general-graph send gate. |

## 5. State, resources, effects and events

| Requirement | Status | Current evidence / remaining work |
|---|---|---|
| Every dirty resource has one authenticated transition; clean resources are preserved | PROVEN for current balanced typed resources | Hostile state/value/token/capability tests. |
| Mapping insertion/deletion and dynamic chunks use existing backend proofs | MISSING from general Layer 3 | Current typed transition does not integrate arbitrary backend descriptors. |
| Ordered ERC-20 transfer/transferFrom/mint/burn/approve semantics | MISSING as a general handler property | Corpus-specific arithmetic examples are not general compiled execution. |
| Satoshi/token effects bind recipient, value/category/capability/amount | PROVEN for current fixed effect slots | Balanced criteria and review regressions. |
| Event identity/topic/data and exact occurrence are authenticated | PARTIAL | Current bounded event rows and standard event NFT are proven; arbitrary event arguments/counts are not. |
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
| Concrete parser/covenant overhead and realistic corpus fit measured | PARTIAL | Fixed generators have pinned costs; the candidate variable transcript parser has not been built or measured. |
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
