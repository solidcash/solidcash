---
title: Atomic Calls with the Message Bus
---

The SolidCash **message bus** lets several stateful contracts participate in one Bitcoin Cash transaction. It is
used when a call graph cannot be represented as independent contract spends—for example, when contract A calls the
same contract B more than once but B has only one master UTXO to spend.

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

The itinerary is the **carrier**, a canonical transcript supplied to the transaction's final verifier input. It
identifies the participants and calls, their typed arguments and results, and the state/output commitments they
agree to. Each contract verifies the same transcript digest and checks the rows that belong to it.

No controller approves the transaction. If A, B, or Token sees a different transcript or an invalid replacement
output, that input fails and the entire transaction is rejected.

## No setup transaction

The carrier changes per interaction, but contract addresses do not. Compact verifier sidecars are deployed once
with each contract and preserve themselves whenever used. A composed call therefore needs only its final atomic
transaction—no pre-call setup, temporary controller, or redeployment.

## Direct calls are preserved

The ordinary spending path remains available for simple functions. The message bus is a special composition path,
not a replacement for every call. Stateless contracts do not advertise a stateful participant route.

## Transaction layout

At a high level, a composed transaction contains the old state inputs for each participant, their verifier
sidecars, one canonical carrier, and the corresponding updated state and preserved verifier outputs. The SDK plans
typed participant blocks rather than relying on absolute indices baked into source code, so one contract's variable
number of collection-entry NFTs does not shift another contract's meaning.

The SDK rejects malformed carriers, unsupported call graphs, missing participant capabilities, and transactions
which exceed the published participant, row, byte, or standardness limits before broadcast.

For local state semantics, see [How the State Journal Works](./state-journal.md).
