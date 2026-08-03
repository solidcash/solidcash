# State journal and message bus

This is the user-oriented description of the two mechanisms SolidCash uses to make stateful contract calls feel
like ordinary program execution on Bitcoin Cash. The canonical specifications define exact behavior; this document
explains the model and public workflow.

## The short version

- The **state journal** remembers changes made while one contract function runs, then writes the final state once.
- The **message bus** lets several stateful contracts agree on one atomic transaction and exchange calls/results
  inside it.
- Both are compiler and SDK machinery. Contract authors write normal state assignments and external calls.
- There is no coordinator contract and no setup transaction. Verifier sidecars are created once when each contract
  is deployed and preserve themselves when used.

## Why a state journal exists

A stateful SolidCash contract stores data in CashToken NFT commitments. Bitcoin Script cannot update a commitment
in place: it validates a transaction which consumes the old NFT and creates its replacement.

A function can nevertheless update the same value several times, call helpers, take branches, and touch mapping or
array entries. The compiler therefore keeps a journal during evaluation:

1. A read sees the newest journaled value, or the input commitment if no write exists yet.
2. A write replaces the pending value for that state location.
3. At the end of the call, the journal is flushed into the contract's output commitments.
4. The covenant verifies that untouched state is preserved and changed state has exactly the computed value.

The journal is not an event log, database, extra NFT, or off-chain service. It is the generated execution strategy
inside the covenant. Only the final state appears on-chain.

## Why a message bus exists

One UTXO can be spent only once. A transaction in which contract A calls B twice cannot model those calls as two
independent spends of B's master UTXO. More complex call graphs also need every participant to agree about call
order, arguments, results, state inputs, and replacement outputs.

For those transactions the SDK builds one canonical transcript, called the message bus carrier. Each participating
contract checks the same typed transcript digest and verifies its own rows. The contracts therefore reach mutual
agreement without trusting a central controller.

Conceptually, a transaction contains:

```text
inputs:   funding | A state | B state | verifier sidecars (the final verifier carries the transcript)
calls:    A.entry -> B.methodOne -> B.methodTwo
outputs:  updated A state | updated B state | preserved verifier sidecars | change/events
```

Physical input positions are planned from typed participant blocks, not hard-coded absolute indices in contract
source. A participant's number of data NFTs can change without silently retargeting another participant's block.

## Direct calls remain direct

The message bus is an additional spending path. Stateless contracts and stateful functions which fit the ordinary
single-call layout retain their direct route.

The compiler option is deliberately one setting:

```ts
compileString(source);                       // infer support (recommended)
compileString(source, { messageBus: true }); // request support explicitly
compileString(source, { messageBus: false }); // require a direct-only artifact
```

If `false` is explicit and semantic analysis proves that the transaction shape needs the bus, compilation fails
with `MESSAGE_BUS_REQUIRED`. For example, repeated calls to the same state owner require one shared message-bus
transition because its master UTXO cannot be spent twice. There is no separate repeated-call batching option.

## Carrier and verifier lifetime

The carrier is an unlocking argument on the canonical final verifier input, so it is different for each
composition. Contract addresses do not depend on that data. The verifier program is static for a compiled contract
and is placed in self-preserving verifier covenants at deployment. Using a verifier consumes and recreates its UTXO
in the same transaction.

This gives the system three useful properties:

- no pre-call setup transaction;
- no per-interaction contract redeployment or address change;
- no controller with authority over all participants.

## Failure behavior

Planning is fail-closed. The compiler or SDK rejects unsupported call graphs, malformed carrier fields, capacity
overflow, missing participant capabilities, ambiguous state ownership, and any output layout which cannot preserve
the required state or verifier covenants. A failed participant invalidates the entire transaction; partial state
updates cannot be committed.

## Detailed references

- `layer3-single-transaction-bus-protocol.md` defines the canonical protocol.
- `state-journal-protocol.md` defines normative journal semantics.
- `layer3-coverage-matrix.md` records stable acceptance and security coverage.
- `layer3-external-audit-handoff-opus.md` gives an independent reviewer the threat model, code map, and
  reproducible production gates.
- `archive/journal-message-bus/` preserves dated implementation, benchmark, and audit evidence.
