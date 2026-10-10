---
title: Atomic Calls with the Message Bus
---

The SolidCash **message bus** is the framework that makes a multi-contract interaction on Bitcoin Cash **trustless
and verifiable**. It lets several stateful contracts participate in one atomic transaction, each independently
proving the same typed description of what is being executed: the participants, the calls, their arguments and
results, and the state inputs and replacement outputs they agree to.

It is used when a call graph cannot be represented as independent contract spends — for example, when contract A
calls the same contract B more than once but B has only one state UTXO to spend. It is not a general-purpose
messaging or RPC layer, and it is not an extra service: its whole purpose is composition that any participant can
check for itself.

:::note
The bus is a composition framework, not a runtime. It introduces no trusted component: every participant
authenticates the same call manifest with its own covenant, so the SDK's proposed layout is a claim the scripts
either prove or reject.
:::

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

## Why the bus exists

Two properties of Bitcoin Cash turn "A calls B" into a transaction-shape problem rather than an instruction.

**There is no call opcode, and no nested execution.** A transaction is validated as one flat atomic snapshot, so a
cross-contract call is a **co-spend plus introspection**: the caller and the callee are both inputs of the same
transaction, and each input's covenant asserts predicates over it. See
[Cross-Contract Calls & Results](/docs/language/cross-contract-calls).

**A UTXO can be spent only once.** A transaction in which A calls B twice cannot model those calls as two
independent spends of B's state UTXO, and a cycle `A -> B -> A` repeats A in the physical call tree. See
[Contention](/docs/basics/platform-differences#contention).

The bus closes that gap, and it does so without introducing anything to trust. Every participating contract
verifies the same canonical **call manifest** digest and checks only the rows that belong to it. Real transaction
inputs and outputs carry the identities, the order, the arguments, the results, and the final state, so no
participant has to take the SDK's, the transaction builder's, or a coordinator's word for any of them.

What it removes, concretely:

| Without the bus | Consequence |
| --- | --- |
| A stateful helper is reused or called in a loop | forced inlining and code bloat |
| A recursive state-writing helper | inlining cannot close the recursion |
| The same stateful callee is invoked twice | two call slots try to consume one callee state UTXO |
| `A -> B -> A` | the physical call tree repeats A, and resolution rejects it |

## What it is not

The bus does not give BCH an EVM cross-input call stack. What is true is narrower and stronger: a finite graph of
**authenticated logical invocations** is verified atomically, with every physical state owner evaluated and flushed
exactly once. The bus never claims otherwise, and the compiler refuses a graph it cannot represent that way.

It also does not make arbitrary foreign failure catchable. If a co-spent covenant fails, the transaction is
invalid; there is no `try`/`catch` across a contract boundary, and a soft failure has to be something the callee
deliberately returns.

## Compared with the EVM

BCH has no equivalent of the EVM's `CALL` family, so this is not one call mechanism against another; it is one
arbitration mechanism against another.

| Concern | EVM | SolidCash message bus |
| --- | --- | --- |
| How a call happens | `CALL` / `STATICCALL` / `DELEGATECALL` transfer control; the callee runs nested and returns data | No call opcode. Caller and callee are co-spent inputs, each evaluated once, each asserting predicates over the transaction |
| Execution model | Nested frames on a call stack; re-entrancy is possible | One flat atomic snapshot; re-entrancy is structurally impossible |
| Ordering | Implied by the call stack | Authenticated: every participant verifies the same canonical call manifest |
| Failure inside a call | The outer frame can catch an inner revert and continue | A failed participant invalidates the entire transaction; partial state updates cannot be committed |
| Who defines and enforces the call | The EVM runtime, uniformly for everyone | The locking scripts. The SDK assembles transactions but enforces nothing |
| Authority | The EVM is the sole arbiter | No coordinator and no controller; each participant authenticates the others itself |
| Contention | One account can be touched by many transactions per block | One state UTXO, one spend; concurrency comes from `split` / `merge` threads instead |

The same shift — no re-entrancy, no call stack, script-enforced integrity — runs through the whole language. See
[Platform Differences](/docs/basics/platform-differences) for the broader comparison.

## The alternatives

Several designs solve part of this, and each stops somewhere. Naming them makes the bus's scope explicit: every
row but the last is an alternative to having a bus at all; the last is an alternative convention of the bus itself.

| Alternative | What it gives you | Where it stops |
| --- | --- | --- |
| **Direct co-spend composition** (the ordinary path) | Independent participants, each spending its own state UTXO | Any owner invoked twice, or a cycle, needs one shared transition |
| **A controller (coordinator) contract** | One contract sequences the others | It adds an authority over every participant and does not remove the bottleneck: the controller's own state UTXO becomes the contention point |
| **Asynchronous outbox or intent NFTs** | Calls carried across separate transactions | Exposes storage layout, grants broad write-shaped authority, and adds token lifecycle machinery; retained only as a separate asynchronous protocol |
| **Threads (`split` / `merge`)** | More concurrency across transactions | It is a throughput tool; it does not let one transaction invoke the same owner twice |
| **Restructure the source** | Nothing new to trust | You must avoid the repeated call or the cycle by hand |
| **Refuse to compile** (`messageBus: false`) | Fail-closed behavior with no artifact to mis-spend | You cannot build the interaction at all; the compiler reports `MESSAGE_BUS_REQUIRED` |
| **Legacy clone/unroll route** (`messageBusKernel: false`) | Reproduces historical ABIs | Route size grows with the unrolled row ceiling; it is a compatibility hatch, and kernel refusals never fall back to it |

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
import * as messageBus from 'solidcash/message-bus';

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

## Compiler options

| Option | Meaning |
| --- | --- |
| `messageBus` | `undefined` (default) infers support from the source's atomic call-graph edges; `true` requests a route even for a graph-free contract, still falling back to direct-only when none can be built; `false` requests a direct-only artifact and is rejected with `MESSAGE_BUS_REQUIRED` when analysis finds a shape that needs one shared bus |
| `messageBusHandlers` | Restricts which entry points are cloned into the authenticated route — a name (every overload) or an exact name-plus-selector reference. Omitted means all eligible entry points; large compatibility projects narrow it to avoid cloning dozens of unrelated handlers |
| `messageBusGraphContext` | Compiles an otherwise graph-free participant with the atomic graph envelope, for leaf participants reached from different parents in one composed transaction |
| `messageBusKernel` | Selects the calling convention. Omitted or `true` uses the kernel row loop; `false` reproduces the historical clone/unroll route for compatibility. The resolved convention is published on `artifact.messageBus.convention` |

Related options that shape a bus build without being bus-specific: `optimizeForCompilationSpeed` skips the
speculative admission rungs and compiles the conservative route directly; `maximumInputBytes` sets the validation
ceiling (10,000 bytes by default) that also decides whether a resource-shaped batch may use eight rows instead of
two; `enforceFunctionParameterTypes`, `enforceFinalRequire`, and `enforceLocktimeGuard` apply to route bodies just
as they do to direct entry points.

## Admission and limits

Unsupported recursion, dynamic cardinality, call options, delegate contexts, introspection, or effect shapes fail
with a named compiler or SDK diagnostic. There is no legacy-controller fallback. The exact limits and the complete
`Artifact.messageBus` field list are generated from the compiler schema in the
[Message Bus Artifact Reference](../reference/message-bus-artifact.md).

The default calling convention is the **kernel row loop**: each admitted handler is one `OP_DEFINE` body, and the
route wrapper (`selector` `53434231`) is the only layout owner. `artifact.messageBus.convention` is
`kernel-row-loop`. Handlers the kernel cannot represent are published ineligible with a `KERNEL_*` reason; they
are not compiled as historical per-row clones. Pass `messageBusKernel: false` only to reproduce that older
unroll for compatibility tests.

Each artifact publishes the ceilings of its own route. A kernel row loop batches up to the BCH-2026 stack-item
ceiling (10,000 bytes) with a one-byte row count, so `maximumBlobBytes` is 10,000 and `maximumRows` is 255. An
individual argument, effect frame, or resource budget can reach its own limit sooner. A legacy unrolled route
keeps the historical 520-byte envelope and eight rows; a compact resource batch publishes two (`minimumRows`).

## Reading the artifact

The **admission stamp** (`admittedHandlerIds`, `refusedHandlerIds`, `admissionSource`) states which handlers
analysis admitted and how that decision was produced, independently of the published `handlers[].eligible` flags.
On the kernel path `admissionSource` is `attribution-spans`, and an artifact whose admission analysis is missing
fails closed rather than falling back.

`resourceBudgets` publishes the compiler's worst-case bound for every resource axis, including the
`maximumSemanticDerivationPasses` budget that participant auto-derivation spends while it discovers a graph's
mutable claims. Composition prefers these published budgets over SDK constants and fails closed on the kernel path
when the field is absent.

`deployability` turns "does this route fit on chain" into a written claim. `status` is `asserted` when the measured
route bytecode fits `P2SH_BYTECODE_LIMIT` (10,000 bytes) and `over-budget` when it does not, alongside the measured
size and the limit. `utils.assertDeployabilityCertificate()` fails closed for a missing certificate as well as an
over-budget one, so an artifact that carries no certificate is never treated as deployable.

`capabilitySchema` records one concrete status per optional capability (`asserted`, `legacy`, `unsupported`,
`inactive`, `incomplete`), so `undefined` never has to be guessed at; read it with
`utils.resolveKernelCapability()` / `utils.assertKernelCapabilityStatus()`. `kernelExecutionPlans` commits each
admitted handler's plan digest into the route bytecode, which
`messageBus.assertReadableKernelExecutionPlans()` checks before a reader trusts the plan.

This convention is experimental in 0.13.1. Compose only `eligible` handlers from an `available` artifact, and check
the deployability certificate before treating a compiled route as safe to broadcast. The frozen proof inventory is
`scripts/kernel-beta-manifest.json`.

For local state semantics, see [How the State Journal Works](./state-journal.md).
