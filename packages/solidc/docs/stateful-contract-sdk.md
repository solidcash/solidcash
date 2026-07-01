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

## ethers parity accessors

`StatefulContract` exposes the ethers `BaseContract` surface: `runner` (Signer when read-write, else the
NetworkProvider), `interface` (the artifact / ABI), `target` and `getAddress()` (the p2sh address), `connect(runner)`
(Signer binds funding+signing; NetworkProvider rebinds read-only), and `attach(target)` / `withProvider(runner)`.

`Signer` mirrors ethers: `provider`, `getAddress()`, `connect(provider)`, and `signMessage(message)` (standard
Bitcoin-signed-message: a base64 recoverable compact signature over `Signer.hashMessage(message)`). EVM-only
members that have no UTXO meaning - `getNonce`, `estimateGas`, `call`, `populateCall`/`populateTransaction`,
`resolveName` (ENS), `signTypedData` (EIP-712), `sendTransaction`/`signTransaction`, `populateAuthorization`/
`authorize` (EIP-7702) - are present for surface parity and throw a clear "no equivalent on Bitcoin Cash" error.

## Events (ethers `queryFilter` / `filters` / `on`)

BCH events are NFT commitments; the facade maps ethers' event API onto them (backed by `queryEvents` /
`StateReader`). `queryFilter` returns `EventLog`s (`args`, `eventName`, `eventSignature`, and `txid`/`vout` in
place of blockNumber/logIndex, since events are a UTXO set):

```ts
const logs = await sc.queryFilter('Transfer');          // by name or signature; '*' for all events
logs[0].args;                                           // { from, to, amount }

// filters build indexed-parameter filters (null = wildcard), exactly like ethers:
await sc.queryFilter(sc.filters.Transfer(alicePkh));    // Transfer where indexed `from` == alicePkh
await sc.queryFilter(sc.filters.Transfer(null, bobPkh)); // wildcard from, indexed `to` == bobPkh
sc.getEvent('Transfer');                                // the callable event handle

// on/once poll the indexer (BCH has no push events) at `sc.pollingInterval` ms and fire for new events:
await sc.on('Transfer', (log) => console.log(log.args));
await sc.once(sc.filters.Transfer(alicePkh), handler);
await sc.off('Transfer', handler);   // + removeAllListeners / listenerCount / listeners / add/removeListener
```

`fromBlock`/`toBlock` are accepted on `queryFilter` for ethers parity but ignored - the current UTXO set is
always returned.

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
