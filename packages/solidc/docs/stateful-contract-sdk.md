# StatefulContract SDK (ethers-v6 flavored)

`StatefulContract` mirrors ethers.js v6 ergonomics on top of BCH's UTXO/CashToken model: a lean constructor, an
`at()` attach-by-address, a provider/signer runner, Proxy method dispatch, and a `getFunction()` escape hatch.

## Creating an instance

```ts
// ethers `new Contract(address, abi, runner)` - sync, the token category is resolved lazily from the indexer on
// the first async op (getState / a send). NetworkProvider runner => read-only-first; Signer => funding+signing.
const counter = new StatefulContract(address, artifact, provider, { constructorArgs: [step] });
await counter.getState();   // <- resolves the category here (getUtxos), then reads

// at() is the same thing, but resolves eagerly so the category/id is available immediately after `await`:
const counter = await StatefulContract.at(address, artifact, signer, { constructorArgs: [step] });

// A 64-char category id may be passed instead of an address anywhere above (used directly, no lookup). Classic
// paths are unchanged:
const counter = StatefulContract.withCategory(new Contract(artifact, [step], { provider }), categoryId);
```

### Why `constructorArgs`, and lazy resolution

An EVM address lets you call because the bytecode lives on-chain. A BCH p2sh address is a *hash of the redeem
script*, so **spending needs the redeem script = bytecode (artifact) + constructor args** - they can't be
recovered from the address. Omit them for a no-arg contract or read-only use; provide them to spend. The token
**category** is not part of that irreducible input: it is read from the indexer (`getUtxos(address)`). Like
ethers, the constructor is sync and hits the network lazily (on the first `getState` / send); `at()` resolves
eagerly. See [multi-contract-artifacts.md](multi-contract-artifacts.md) s13.

## Runner: provider vs signer

- **`NetworkProvider`** - read-only-first. `getState()` / `state.x()` / view reads work. Sends still work when
  the contract/covenant self-funds (as they always have), but there is no bound signer to auto-fund/sign.
- **`Signer`** - read-write. Carries its own provider and funds + signs sends. Equivalent to
  `sc.connect(signer)`.

## Proxy dispatch (v6)

Every instance is wrapped in a Proxy, so the ABI function / state getter is reachable on the **bare name**:

```ts
await counter.increment().send();   // same as counter.call.increment().send()
await counter.count();              // same as counter.state.count()
```

A framework member wins a name collision (so `counter.connect`, `counter.state`, `counter.getState` stay the
framework members). A contract function that is shadowed by a framework name stays reachable via the escape
hatch:

```ts
counter.getFunction('connect')(...args).send();   // the ABI function named `connect`
```

Internal class methods bind to the underlying target, so dispatch never affects the framework's own behavior.

### Typing

Both `new StatefulContract(category, artifact, runner)` and `StatefulContract.at(...)` return a
`ConnectedStatefulContract<T>`, so bare-name calls are fully typed from an `as const` artifact - no cast:

```ts
counter.increment(5n);            // typed: (by: bigint) => StatefulFunctionCall
counter.increment(5n).send();     // -> Promise<TransactionDetails>
await counter.count();            // typed state getter -> bigint
counter.increment(true);          // type error
counter.frobnicate();             // type error - not a function on the contract
```

The constructor is typed via a construct-signature cast on the export (`type-inference` strips the class's
generated construct signature and re-declares the lean + legacy forms as returning `ConnectedStatefulContract`),
since a class constructor otherwise yields the bare class type. Argument types come from the ABI via
`AbiToFunctionMap` (`int -> bigint`, `address`/`bytesN` -> `Uint8Array | string`, `T[]` -> arrays, etc.).
