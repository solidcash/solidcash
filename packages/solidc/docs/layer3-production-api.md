# Layer 3 single-transaction composition API

Layer 3 composes existing stateful contract UTXOs into one Bitcoin Cash transaction. There is no controller,
execution-root preparation, projection proof, setup transaction, or confirmation step.

## Compose and send

Prepare calls from category-bound `StatefulContract` instances, then pass them in compiler-authored
depth-first execution order:

```ts
import { layer3 } from 'solidcash';

const composition = layer3.compose({
  calls: [
    caller.call.prepare(next),
    callee.call.settle(next),
  ],
  funder: feeUtxo,
  changeAddress,
});

const { txid } = await composition.send();
```

`funder` must be one bare P2PKH input. It is the terminal fee input and authenticates the root invocation's
`tx.origin`. Every participant before it contributes one complete compiler-published balanced block.

## Offline build and signing

Use `build()` to inspect, mutate-test, or sign the same transaction offline:

```ts
const builder = await composition.build();
const transaction = builder.buildLibauthTransaction();
```

The composer finalizes the participant table, transcript rows, effects, block layout, and canonical carrier
before any input signature is produced. The carrier is stored once in participant zero's SCB1 unlocking
bytecode; every participant verifier reads that physical byte region.

## Admission and refusals

Applications supply calls and ordinary transaction funding—not global indices or protocol identities. The
compiler publishes admitted selectors, call modes, schemas, occurrence bounds, block slots, and effect bounds;
the SDK derives the physical layout and transcript from those artifacts. Contract artifacts commit fixed
prefixes and maximum trailing capacity; each transaction commits actual trailing use. Later participant bases
are prefix sums of those authenticated actual spans, so chunk cardinality never becomes an application-supplied
absolute index and unused capacity consumes no transaction slots.

Unsupported recursion, dynamic cardinality, call options, delegate contexts, introspection, or effect shapes
fail with a named compiler or SDK diagnostic. A refusal must be resolved in the application shape; there is no
legacy mode or controller-backed fallback.

## Limits

Version 2 admits at most five physical participants and 24 transcript rows. Repeated invocations of the same
physical contract do not consume another participant. The five-participant ceiling is the largest measured
representative returning chain below stock BCH-2026 operation density; the adjacent six-participant chain is
refused. `layer3.SINGLE_TX_BUS_CAPACITY` publishes this limit. Exact finalized-byte and VM preflight still apply
to every graph because resource-heavy local verification can bind earlier. See
`layer3-single-tx-capacity-bch2026.json` for measurements, `layer3-single-transaction-bus-protocol.md` for the
wire grammar, and `layer3-single-transaction-bus-requirements.md` for security invariants.
