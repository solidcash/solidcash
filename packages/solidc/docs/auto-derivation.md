# Transaction auto-derivation

How SolidCash gives an EVM-style `contract.fn(args).send()` experience on a UTXO chain where a covenant spend
normally has to be hand-assembled. This is the unifying mechanism behind the per-feature docs (external calls,
dynamic storage, collection iteration, deploys, events, transfers); read this first.

## 1. The problem

On the EVM you call a function and the VM mutates global storage. On BCH there is no global storage and no
implicit "call": a stateful contract is a set of UTXOs (a minting master NFT + data NFTs), and to advance its
state the spender must build a transaction by hand - decide which UTXOs to **co-spend**, which **outputs** to
recreate, compute each output's **NFT commitment** (the new state), and place every co-spent callee / event /
chunk / child at exactly the index the covenant checks. Get any index or commitment wrong and the script fails.

SolidCash hides all of that. The developer writes `await sc.transfer(to, amount).send()`; the SDK **derives** the
whole transaction. The novelty is the split that makes this possible.

## 2. The split: position-independent covenant + metadata + SDK derivation

The compiler emits two things per function:

1. **A position-independent covenant.** The generated script never hardcodes the index of a co-spent input or a
   created output. Instead it reads each one through a **runtime base parameter** (a synthetic `__internal__*`
   arg pushed in the unlocking script) plus a compile-time offset, e.g. `OP_PICK __internal__externalCallInputBase
   + computedOffset + i*stride`. The covenant says *"my callee is at base+offset"*; the SDK decides what base is.
2. **ABI metadata describing every UTXO-level effect** of the function (section 3), so the SDK knows what to
   place without parsing bytecode.

The SDK then:

3. Reads the metadata, runs a **VM probe** to compute the post-execution state (section 4),
4. **Assembles** the transaction - master + data NFTs, then a uniform *trailing* region of co-spends/outputs in a
   fixed order (section 5),
5. **Fills the base parameters** so the covenant finds everything at runtime (section 6).

Neither half hardcodes positions; they meet at the base parameters. That is what lets independent features
(an external call *and* a collection iteration *and* a dynamic-storage write in one function) compose.

## 3. The metadata

`buildFunctionAbiMetadata` (`packages/solidc/src/artifact/Artifact.ts`) attaches, per `AbiFunction`, only the
effects that function actually has:

- `requiredNftIndices` - which of the contract's own data NFTs this function touches (co-spend + recreate).
- `entryAccesses` - mapping/collection entry reads/writes (the entry NFT + key sources + operations).
- `collectionIterations` - `for (x in collection)` (mode + which iteration slot).
- `dynamicReads` / `dynamicWrites` - unbounded `string`/`bytes`/dynamic-array chunk vars read/written.
- `externalCalls` - `IFoo(addr).m()` / opaque `addr.call(...)` (address source, callee data-NFT count,
  return-event signature, `computedOffset`, `callMode`, `loopArrayVar`, `argSources`).
- `externalReads` / `externalOutStateReads` - cross-contract state reads.
- `emits` - events (output index per event).
- `transferInfos` / `tokenContainerAccesses` - value/token sends.
- `deployTargets` - children created via `new`/create2 (master + data-NFT counts).
- `libraryDelegateCalls`, `lowLevelCalls`, `blockhashReads`, `usesMsgSender`, `externalLibraries`, `blockLayout`.

`blockLayout` is the precomputed compile-time offset table; the rest tell the SDK *what* to co-spend/create.

## 4. The VM probe: deriving the new state

The SDK does not re-implement the contract off-chain to know the next state. `_deriveFullTransactionState`
(`StatefulContract.ts:2898`) builds a candidate transaction, runs the **actual covenant** in a libauth VM
(`vm.debug`, ~`:2300`), and extracts the resulting NFT output commitments from the trace
(`extractCommitmentsFromTrace`). The script itself computes the new state; the SDK just reads it back out. It
also recovers derived transfers / token-container transfers the covenant produced. So a function's state
transition is defined once, in the contract, and the SDK derives the outputs by executing it.

## 5. Transaction layout and the shared trailing counter

A spend is laid out as:

```
inputs:  [0] master   [1..D] data NFTs   | <trailing region>     [last] fee funder
outputs: [0] master'  [1..D] data NFTs'  | <trailing region>           change
```

The **trailing region** holds everything a function co-spends/creates beyond its own state, in one fixed order
(collection-iteration entries -> dynamic-read chunks -> external-call callees + return events -> deploy children
-> ...). Each group's **base** is the running sum of the counts of all earlier groups - the *shared trailing
counter*. For example `externalCallInputBase += iterationEntryInputs.length` (`StatefulContract.ts:4413`) and
`returnEventOutputBase = baseOutputOffset + entryOutputCount + iterationEntryInputs.length` (`:4467`); dynamic
chunks accumulate `chunkOffset += nNew` (`:3281`). Because every feature offsets from the same accumulating
counter, adding a feature shifts the later groups by a known amount instead of conflicting - this is why the
features stack.

## 6. The base parameters (the covenant <-> SDK contract)

The synthetic `__internal__*` args the SDK fills (`StatefulContract.ts:4521-4566`) are the interface between the
two halves:

- `__internal__externalCallInputBase` - first co-spent callee input index.
- `__internal__externalReturnOutputIdx[N]` - first return-event output index.
- `__internal__returnOutputIdx` - the function's own return-event output (or `-1` to skip, `:4936`).
- per-iteration `__internal__collectionIterCount_N`, the dynamic-chunk base (`getChunkOutputBase`),
  `__internal__blockhashInputIndex`, `_proxyMasterIndex` (delegatecall), etc.

The covenant reads these at runtime via `OP_PICK`, so the same compiled script works regardless of where the SDK
ultimately placed the inputs/outputs (forward or backward call direction, extra co-spends, etc.).

## 7. Resolving *which* contracts to co-spend (the registry)

For effects whose target is another contract (external calls, delegate libraries, opaque `multiCall`), the SDK
must know the actual instances. It resolves them from a **unified, address-keyed external-target registry** on the
base `Contract` (`registerExternalTarget` / `getExternalTargetByAddress` / `getExternalTargetInstancesByInterface`),
populated by `registerExternalArray` (typed `IFoo(arr[i]).m()`, by interface) and `registerLoopTargets` (opaque
`multiCall`, by address). Given an instance it derives the co-spend itself: UTXO via the category-pinned address,
unlocker from the artifact, return from on-chain state (`deriveOpaqueLoopCoSpends`, `loop-call.ts`). BCH cannot
recover a contract's artifact from an address, so this registration is the one thing the caller must supply; the
rest is derived. See `external-contract-calls.md` and `call-model.md`.

## 8. Why this is novel

Hand-written BCH covenants pin their inputs/outputs to fixed indices, so the spender's transaction shape is
welded to the script and every feature combination is bespoke. SolidCash instead compiles a covenant that is
*position-independent* (reads its world through base parameters), carries *machine-readable effect metadata*, and
derives both the next state (by executing the real script in a VM) and the full transaction (by metadata + a
shared trailing counter). The result is EVM-ergonomics - `contract.fn(args).send()` - on a UTXO chain, with
features that compose because they share one offset model.

## 9. API surface

- `sc.fn(args).send()` / `sc.functions.fn(args)` -> a `StatefulTransactionBuilder` (`_createBuilder`,
  `StatefulContract.ts:3505`).
- `.withCall(target, fn, args)` / `.withCall(rawUtxo)` - supply an external callee explicitly.
- `registerExternalArray` / `registerExternal` / `registerLoopTargets` / `registerLoopFunder` - register targets.
- `contract.multiCall(targets, data, ctx?)` - opaque loop dispatch (the stateless analogue; `loop-call.ts`).

## 10. Anchors

- Metadata: `packages/solidc/src/artifact/Artifact.ts` (`buildFunctionAbiMetadata`).
- Derivation: `packages/solidcash/src/stateful/StatefulContract.ts:3505` (`_createBuilder`),
  `:2898` (`_deriveFullTransactionState` probe), `:4413,:4467,:3281` (shared trailing counter),
  `:4521-4566` (base-parameter filling).
- Registry / opaque derivation: `packages/solidcash/src/loop-call.ts`,
  `packages/solidcash/src/Contract.ts` (registry API).
- Companion docs: `external-contract-calls.md`, `call-model.md`, `dynamic-storage.md`,
  `array-external-calls.md`, `deploy-then-call-fold.md`.
