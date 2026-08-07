---
title: Atomic Calls with the Message Bus
---

The SolidCash **message bus** lets several stateful contracts participate in one Bitcoin Cash transaction. It is
used when a call graph cannot be represented as independent contract spends—for example, when contract A calls the
same contract B more than once but B has only one state UTXO to spend.

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

The itinerary is the **message envelope**, containing a canonical **call manifest** supplied to the transaction's final
verification input. It
identifies the participants and calls, their typed arguments and results, and the state/output commitments they
agree to. Each contract verifies the same call-manifest digest and checks the rows that belong to it.

No controller approves the transaction. If A, B, or Token sees a different call manifest or an invalid replacement
output, that input fails and the entire transaction is rejected.

## No setup transaction

The message envelope changes per interaction, but contract addresses do not. Compact verification inputs are deployed once
with each contract and preserve themselves whenever used. A composed call therefore needs only its final atomic
transaction—no pre-call setup, temporary controller, or redeployment.

## Direct calls are preserved

The ordinary spending path remains available for simple functions. The message bus is a special composition path,
not a replacement for every call. Stateless contracts do not advertise a stateful participant route.

## Transaction layout

At a high level, a composed transaction contains the old state inputs for each participant, their verifier
verification inputs, one canonical message envelope, and the corresponding updated state and preserved verifier outputs. The SDK plans
typed participant blocks rather than relying on absolute indices baked into source code, so one contract's variable
number of collection-entry NFTs does not shift another contract's meaning.

The SDK rejects malformed message envelopes, unsupported call graphs, missing participant capabilities, and transactions
which exceed the published participant, row, byte, or standardness limits before broadcast.

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

The funder is the terminal bare-P2PKH fee input and authenticates the root invocation's `tx.origin`. Applications
supply calls and funding; the compiler artifacts and SDK derive participant identities, local slots, effects, and
all absolute transaction positions.

At deployment, `messageBusVerificationInputCount: N` creates `N` independently spendable verifier instances. One is the default
for artifacts with a verifier program. They are genesis resources and self-preserve, so no deployment or setup is
performed between contract creation and composition.

## Offline construction

`build()` finalizes the same composition without broadcasting it:

```ts
const builder = await composition.build();
const transaction = builder.buildLibauthTransaction();
```

The participant table, call manifest, effects, block layout, and message envelope are fixed before signatures are produced.
Use this path for inspection, offline signing, and mutation tests.

## Admission and limits

Unsupported recursion, dynamic cardinality, call options, delegate contexts, introspection, or effect shapes fail
with a named compiler or SDK diagnostic. There is no legacy-controller fallback. The current limits and the exact
`Artifact.messageBus` fields are generated from the compiler schema in the
[Message Bus Artifact Reference](../reference/message-bus-artifact.md).

For local state semantics, see [How the State Journal Works](./state-journal.md).
