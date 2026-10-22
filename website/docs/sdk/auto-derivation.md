---
title: Transaction Auto-Derivation
---

`StatefulContract` turns a source-level call into a complete UTXO transaction. The application normally writes:

```ts
await vault.call.withdraw(ownerSig, recipient, amount).send();
```

The resulting transaction may need the contract master, selected data NFTs, vmap proofs, array chunks, token or
satoshi containers, event funding, external callees, return carriers, compute sidecars and a fee input. None of
those UTXOs are implicit on Bitcoin Cash. **Auto-derivation** is the compiler/SDK protocol which discovers them,
computes the authenticated post-state, and places each input and output at the index the covenants expect.

## The compiler and SDK split

The compiler publishes two complementary pieces for every ABI function:

- a position-aware covenant whose variable regions are addressed through SDK-filled `__internal__*` witness
  parameters; and
- effect metadata such as `blockLayout`, `requiredNftIndices`, `entryAccesses`, `collectionIterations`,
  `dynamicReads`, `dynamicWrites`, `externalCalls`, `emits`, transfers, deployments and sidecars.

Synthetic parameters are present in the artifact ABI because they are part of the unlocking protocol, but normal
call methods hide and fill them. Do not pass them as user arguments.

The SDK reads that metadata, discovers the required UTXOs through the provider and registered dependencies, builds
a candidate transaction, and evaluates the **actual compiled covenant** in the local BCH VM. It extracts computed
commitments and effects from the trace, rebuilds the candidate, and repeats until the transaction converges. This
is deliberately not an off-chain TypeScript reimplementation of the contract: the emitted script remains the one
definition of the state transition.

## What is derived

Depending on the function, one pending call can derive:

- the current master thread and only the data NFTs read or written by that route;
- vmap membership/non-membership proofs, insert/update/default-value commitments and long-value chunks;
- dynamic string, bytes and array chunk reads, replacements and orphan bounds;
- current and output state for authenticated external reads;
- typed call, low-level call, delegate-library and child-deployment groups;
- ordinary events, authenticated return-event NFTs, satoshi transfers and CashToken-container transfers;
- blockhash, Keccak, recovery and script-library sidecars; and
- signer funding, change, finalized fees, locktime and input sequences where the route requires them.

The artifact's `blockLayout` gives fixed slots a common coordinate system. Runtime-length regions use synthetic
base/count parameters and one shared running offset, so a mapping iteration, chunk write and external call can
coexist without each feature assuming it owns the same index.

## Dependency discovery

On-chain checks authenticate every selected UTXO, but the SDK still needs enough off-chain information to find it.
BCH cannot infer an artifact, constructor arguments or live category from an arbitrary locking bytecode alone.
Provide that context once at connection or registration time:

```ts
const app = StatefulContract.withCategory(appInner, appCategory, {
  externals: { ICounter: counter },
});

app.registerExternalArray('ISubscriber', subscribers);
app.registerLibrary('MathState', deployedLibrary);
app.registerChild(childArtifact);
```

`ContractBundle` carries a complete multi-artifact graph and can remove several manual registrations. For a single
dynamic edge, `.withExternalCall(target)` or `.withExternalCall(target, functionName, args)` supplies the concrete
instance and invocation on the pending call.

Verified-mapping value iteration needs no raw keys. Key or entry iteration does, because the chain stores only
hashed slots:

```ts
app.setIterationKeys('balances', knownCanonicalKeyBytes);
await app.call.sumKnownAccounts().send();
```

The supplied order is irrelevant; the SDK matches encoded keys to the sorted chain. See
[Verified Mappings](/docs/language/verified-mappings#mapping-iteration) for encoding, completeness, and
single-key-dimension rules.

## Convergence

Most routes converge in a few probes. `maxDerivationIterations` defaults to 20:

```ts
app.maxDerivationIterations = 32;
await app.call.route(seed, amount).send();
console.log(app.lastDerivationIterations); // VM evaluations the last derivation ran
```

Increase it only when a large transition has a genuine chain of interdependent commitments. A failure to converge
usually indicates missing context, an unsupported cyclic shape, a wrong manual override, or a bug, not a reason to
set an unbounded retry count. Some compiler-recognized loop-write routes internally receive a higher safety floor,
and message-bus kernel artifacts use the pass ceiling the compiler publishes instead.

A derivation failure throws an error named `AutoDerivationError`, which carries the underlying failure as `cause`
when there is one. Common fixes are:

- register the external target, loop array, child artifact or library instance named by the error;
- supply raw vmap keys for key/entry iteration;
- provision the sidecar address and required number of instances;
- make the fee/signature only after the full transaction shape is known; or
- replace a source shape which the compiler reports as unbounded or ambiguous.

## Manual overrides

Overrides fill information the SDK cannot reconstruct. They do not weaken a covenant and they do not authorize a
different transition:

```ts
await app.call.route(seed, amount)
  .withEntryKey(0, derivedLogicalKey)
  .setState('cachedTotal', expectedTotal)
  .emitEvent('Routed', recipient, amount)
  .transfer(recipientLockingBytecode, amount)
  .tokenContainerTransfer(category, recipientLockingBytecode, tokenAmount)
  .send();
```

Use these as narrow escape hatches:

| Override | When it is needed |
| --- | --- |
| `.withEntryKey(slot, key)` | A compiler-authored vmap access uses a key expression the SDK cannot reconstruct |
| `.withExternalEntryKey(slot, key)` | An external mapping read must select the entry with this exact key |
| `.setState(name, value)` | Trace extraction cannot determine an otherwise covenant-checked post-state |
| `.emitEvent(name, ...args)` | Event arguments are not inferable from parameters and trace values |
| `.transfer(to, amount)` | A satoshi-transfer output cannot be inferred |
| `.tokenContainerTransfer*()` | A fungible/NFT container transfer cannot be inferred |
| `.withExternalCall(...)` / `.withCall(...)` | A dynamic typed or low-level target/invocation needs explicit context |

If a supplied value is wrong, local preflight or network validation rejects the transaction. Never treat an
override as a way to bypass state, identity, category or amount checks.

## `build()`, `debug()` and `send()`

A stateful pending call's `build()` is asynchronous because it may query UTXOs and run several VM probes. The
pending call has no `debug()` of its own: build it, then debug the returned `TransactionBuilder`.

```ts
const pending = app.call.withdraw(sig, recipient, amount);
const builder = await pending.build();
const usage = builder.getVmResourceUsage();
const trace = builder.debug();
const sent = await pending.send();
```

The lower-level stateless `TransactionBuilder.build()` and `debug()` cannot perform asynchronous dependency
discovery. Call helpers such as `addRequiredSidecars()` first when building those transactions manually.

Auto-derivation improves ergonomics; it is not a trust boundary. The final transaction is valid only because each
input's covenant verifies its own identity, category, pre-state, post-state and effects. A malicious or buggy SDK
can at worst propose a transaction which those checks reject, unless the contract source itself uses an `unsafe`
route or omits the relevant authorization.

## Related concepts

- [State Storage & Data Encoding](/docs/language/storage-model) explains the UTXOs being assembled.
- [Cross-Contract Calls & Results](/docs/language/cross-contract-calls) covers registered callees and returns.
- [Stateful Contracts](/docs/sdk/stateful-contracts) is the full connected-contract API.
- [Debugging](/docs/guides/debugging) covers local VM traces and resource diagnostics.
