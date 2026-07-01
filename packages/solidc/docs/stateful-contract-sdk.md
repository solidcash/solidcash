# StatefulContract SDK (ethers-v6 flavored)

`StatefulContract` mirrors ethers.js v6 ergonomics on top of BCH's UTXO/CashToken model: a lean constructor, an
`at()` attach-by-address, a provider/signer runner, Proxy method dispatch, and a `getFunction()` escape hatch.

## Creating an instance

```ts
// Lean constructor - you already know the token category (64-char hex):
//   NetworkProvider runner => read-only-first; Signer runner => adds funding + signing.
const counter = new StatefulContract(categoryId, artifact, provider, { constructorArgs: [step] });

// Attach by ADDRESS (ethers `new Contract(address, abi, runner)`). Async because BCH maps address -> category
// through the indexer (getUtxos); a 64-char category id passed here is used directly.
const counter = await StatefulContract.at(address, artifact, signer, { constructorArgs: [step] });

// Classic paths are unchanged and still supported:
const counter = StatefulContract.withCategory(new Contract(artifact, [step], { provider }), categoryId);
```

### Why `constructorArgs`, and why `at()` is async

An EVM address lets you call because the bytecode lives on-chain. A BCH p2sh address is a *hash of the redeem
script*, so **spending needs the redeem script = bytecode (artifact) + constructor args** - they can't be
recovered from the address. Omit them for a no-arg contract or read-only use; provide them to spend. The token
**category** is not part of that irreducible input: it is read from the indexer (`getUtxos(address)`), which is
why `at(address, ...)` is async. See [multi-contract-artifacts.md](multi-contract-artifacts.md) s13.

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

### Typing note

`StatefulContract.at(...)` returns a `ConnectedStatefulContract<T>`, so bare-name calls (`counter.increment(...)`)
are fully typed from an `as const` artifact. A direct `new StatefulContract(category, artifact, runner)` returns
the base `StatefulContract<T>` type; use `at()` (works with a category id too), the classic statics, or
`counter.call.increment(...)` for typed bare-name dispatch, or annotate the result as
`ConnectedStatefulContract<typeof artifact>`.
