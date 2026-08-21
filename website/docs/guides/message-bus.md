---
title: Atomic Calls with the Message Bus
---

The SolidCash **message bus** lets several stateful contracts participate in one Bitcoin Cash transaction. It is
used when a call graph cannot be represented as independent contract spends—for example, when contract A calls the
same contract B more than once but B has only one state UTXO to spend.

The bus is not asynchronous messaging and does not leave a queue for another transaction. "Message" means the
canonical call transcript carried by one atomic transaction.

You normally do not enable anything. The compiler infers message-bus support for eligible stateful contracts, and
the SDK chooses the appropriate transaction layout.

```ts
compileString(source); // recommended: infer message-bus support
```

An explicit direct-only build is available for applications which require it:

```ts
compileString(source, { messageBus: false });
```

If semantic analysis proves the contract needs a bus, that build fails with `MESSAGE_BUS_REQUIRED` instead of
producing an artifact from which no valid transaction can be built. There is no separate batching switch.

## A useful mental model

Imagine every participating contract receiving the same sealed itinerary:

```text
A.run
  -> Token.transfer
  -> B.update
  -> Token.transfer
```

The itinerary is the **message envelope**. It contains a canonical **call manifest** supplied through the final
participant verifier input. The manifest identifies participants and calls, typed arguments and results, and the
state/resource/effect commitments they agree to. Each contract verifies the same manifest digest and the rows it
owns or consumes.

No controller approves the transaction. If A, B, or Token sees a different manifest or an invalid replacement
output, that input fails and the entire transaction is rejected.

## When the bus is needed

Use the direct cross-contract path when each physical state owner is invoked once and the graph fits one ordinary
balanced layout. The bus becomes necessary when one physical UTXO owner must represent several logical calls, or
when the graph needs one authenticated transcript to settle shared state and results.

```text
logical calls:       A -> B.deposit(10) -> B.withdraw(4)
physical spends:     A once, B once
participant journal: B applies deposit then withdraw, flushes one final state
```

Because one outpoint cannot occur twice in a transaction's inputs, modeling the two B calls as independent spends
is impossible. The compiler-owned bus route executes both rows against B's one local journal.

You still write ordinary typed calls in SolidCash. `artifact.invocationAnalysis` records the call/resource closure,
and eligible artifacts publish an `artifact.messageBus` route and verifier program. There is no source-level
`message bus` statement or modifier.

## Direct calls are preserved

The ordinary spending path remains available for simple functions. The message bus is an additional composition
path, not a replacement for every call. Stateless contracts do not advertise a stateful participant route.

Direct and bus routes enforce the same application policy. The difference is how a bounded multi-invocation graph
is represented and settled physically.

## No setup transaction

The message envelope changes per interaction, but contract addresses do not. Compact verifier inputs are deployed
once with each contract and preserve themselves whenever used. A composed call therefore needs only its final
atomic transaction—no pre-call setup, temporary controller, or redeployment.

Verifier **instances** do constrain concurrency. Each in-flight composition spends one verifier NFT per physical
participant and recreates it on confirmation. Deploying `N` instances lets that contract reserve up to `N`
independently spendable verifiers; it does not allow its one unsplit master state outpoint to be double-spent. Use
contract threads when application state itself needs parallel spends.

## Transaction layout

At a high level, a composed transaction contains the old state inputs for each participant, their verifier inputs,
one canonical message envelope, and the corresponding updated state and preserved verifier outputs. The SDK plans
typed participant blocks rather than relying on absolute indices baked into source code, so one contract's variable
number of collection-entry NFTs does not shift another contract's meaning.

Participant input and output blocks use the same local slot plan. Each block has a fixed prefix and may use a
bounded contiguous trailing region for runtime-sized entries, chunks, or side-cars. The call manifest records actual
span sizes; absolute positions are derived from authenticated participant bases and local offsets. Unused trailing
capacity is omitted, not padded into the transaction.

After the participant blocks come one self-preserving verifier input/output per participant, followed by the fee
and change tail. Every verifier authenticates the same canonical envelope, while each participant binder commits to
its verifier, arguments, category, position, and local batch.

The SDK rejects malformed envelopes, unsupported call graphs, missing participant capabilities, and transactions
which exceed published semantic, byte, policy, or VM limits before broadcast.

## Compose and send

Prepare calls from category-bound `StatefulContract` instances in compiler-authored depth-first execution order:

```ts
import { messageBus } from 'solidcash';

const composition = messageBus.compose({
  calls: [
    caller.call.prepare(next),
    callee.call.settle(next),
  ],
  funder: feeUtxo,
  changeAddress,
});

const { txid } = await composition.send();
```

The `calls` array is the concrete logical invocation list, not merely a target registry. Include the root first,
then every reached call in exact depth-first order. Repeat the same connected instance when one physical owner is
called more than once:

```ts
const composition = messageBus.compose({
  calls: [
    caller.call.run(7n),
    sink.call.ping(7n),
    sink.call.ping(9n),
  ],
  funder: feeUtxo,
  changeAddress,
});
```

The composer compares names and canonically encoded arguments with the compiler-derived graph. Missing,
reordered, extra, or disagreeing prepared calls fail before signing.

The funder is the terminal bare-P2PKH fee input and authenticates the root invocation's `tx.origin`. Applications
supply calls and funding; compiler artifacts and the SDK derive participant identities, local slots, effects, and
all absolute transaction positions.

### Composition requirements

- Supply at least two prepared `StatefulFunctionCall` objects.
- Every participant must use the same `NetworkProvider`.
- Every participant must have a resolved category and an eligible compiler-published bus route.
- The fee funder must be an ordinary bare P2PKH input.
- Connect/register the external graph before preparing the calls.
- Do not attach imperative builder overrides—manual state or entry values, extra inputs/outputs, transfers, manual
  events, `emitReturn()`, split/merge settings, or explicit external-call overrides—to a prepared call. The composer
  derives effects from compiler metadata and refuses mutable call configuration which would change transcript
  semantics.

Composition never weakens ordinary external-target identity checks. A registered instance must still match the
self-pinned address used by the contract expression.

## Provision verifier instances

At deployment, `messageBusVerificationInputCount: N` creates `N` independently spendable verifier instances. One
is the default for an artifact with a verifier program. They are genesis resources and self-preserve, so there is
no deployment or setup between contract creation and composition.

```ts
const deployed = await StatefulContract.deploy(
  artifact,
  constructorArgs,
  {
    provider,
    fundingUtxo,
    funder,
    changeAddress,
    messageBusVerificationInputCount: 2,
  },
);
```

Set the count to the expected number of simultaneous reservations, considering confirmation latency. A zero count
leaves the contract without a verifier UTXO and therefore unable to join a bus composition until a lifecycle path
explicitly provisions one.

## Offline construction

`build()` finalizes the same composition without broadcasting it:

```ts
const builder = await composition.build();
const transaction = builder.buildLibauthTransaction();
```

Use this path for inspection, offline signing, fee analysis, and adversarial mutation tests. `build()` and `send()`
each construct a complete final shape. The composer snapshots the caller-owned `calls` array at creation, so later
array mutation cannot change the graph.

The participant table, manifest, effects, block layout, envelope, and fee tail are fixed before signatures are
produced. This avoids circularity between transaction signatures and the transcript they authorize.

## Manifest contents

The canonical manifest binds:

- two to eight physical participants by locking bytecode, category, fixed layout, and actual span;
- up to 24 typed invocation, resource, and effect rows;
- owner and consumer identities;
- call mode, selector, arguments, authenticated result bytes, parent/depth order, and completion position;
- state resources, vmap entries, chunks, events, BCH transfers, token effects, and oracle/compute side-cars; and
- the local return slot when a participant produces an authenticated result.

Rows use participant-local offsets. Unknown row kinds, non-canonical lengths, trailing bytes, invalid parents,
future result consumption, or disagreeing participant projections fail closed.

The exact wire identifiers and field grammar are protocol internals. Applications should use the compiler artifact
and `messageBus.compose()` rather than serializing a manifest themselves. Artifact consumers can inspect the
[Message Bus Artifact Reference](../reference/message-bus-artifact.md).

## State, results, and effects

Each physical participant has one local journal. Multiple rows owned by that participant observe pending writes in
manifest order and settle one final scalar, vmap, or chunk transition. Journals are not shared across participants.

Return values are derived, encoded, and authenticated before a consumer row can use them. The planner rejects a
row which depends on a future producer or creates a cyclic or ambiguous result dependency. Event outputs, BCH and
CashToken transfers, entry/chunk resources, blockhash reads, and cryptographic side-cars receive distinct effect
claims; the relevant owner covenant still verifies each concrete output.

See [How the State Journal Works](./state-journal.md#journal-semantics-in-the-message-bus),
[Verified Mappings](/docs/language/verified-mappings#cross-contract-reads-and-calls), and
[Cross-Contract Calls & Results](/docs/language/cross-contract-calls#return-event-nfts).

## Admission and limits

Unsupported recursion, dynamic cardinality, call options, delegate contexts, introspection, or effect shapes fail
with a named compiler or SDK diagnostic. There is no legacy-controller fallback. The current constants and exact
`Artifact.messageBus` fields are generated from the compiler's shared schema in the
[Message Bus Artifact Reference](../reference/message-bus-artifact.md).

The participant and row counts are protocol ceilings, not promises that every smaller graph fits. Finalized
preflight also separates and enforces:

- the 100,000-byte default relay-policy transaction ceiling and the 1,000,000-byte consensus ceiling;
- output dust and locking-bytecode policy;
- push-only and maximum-size unlocking bytecode rules;
- 10,000-byte stack-item and message-envelope bounds; and
- BCH-2026 per-input operation-density and VM validity.

A resource-heavy graph may hit one of these before reaching eight participants or 24 rows.

## Diagnostics

Compiler diagnostics explain why a function was excluded from the bus route—for example, an unsupported construct,
unbounded external recursion, a future-result dependency, duplicate settlement authority, foreign intermediate
state, or an effect shape which cannot be summarized.

SDK planning failures use stable `MessageBusDiagnosticError.code` values for participant/invocation limits,
unresolved targets or resources, duplicate outpoints, artifact conflicts, malformed metadata, invalid result
dependencies, and finalized byte or VM limits. The error context can include call chains, callsite locations,
participant identities, measurements, and raw VM reasons:

```ts
try {
  await composition.build();
} catch (error) {
  if (error instanceof messageBus.MessageBusDiagnosticError) {
    console.error(error.code, error.context);
  }
  throw error;
}
```

Do not catch one of these errors and fall back to a hand-built transaction which omits the rejected binding. The
diagnostic means the compiler/SDK could not prove the requested atomic semantics.

## Security model

- There is no universal bus signer or controller. Each participant independently authenticates the shared
  envelope and its owned and consumed rows.
- The root P2PKH funder authenticates `tx.origin`; nested `msg.sender` values come from manifest call edges, not
  arbitrary co-presence.
- Verifier programs and instances are artifact/category-bound and self-preserving.
- State categories, locking bytecodes, exact local positions, results, and effect claims are committed together.
- Signatures and complete unlocking bytecodes are outside the manifest digest so signing is not circular; the final
  transaction still validates every signature normally.
- Any participant failure invalidates the whole BCH transaction. There is no partial settlement or recovery path.

For general call identity and direct-call behavior, see
[Cross-Contract Calls & Results](/docs/language/cross-contract-calls). For local state semantics, see
[How the State Journal Works](./state-journal.md).
