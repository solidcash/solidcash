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

### Factory deploy (ethers/hardhat)

For a real genesis deploy, use the ethers/hardhat-style factory. A `Signer` runner auto-selects a genesis-valid
funding UTXO and funds+signs; the returned contract is ready to call and carries `deploymentTransaction()` +
`waitForDeployment()`:

```ts
// ethers ContractFactory:
const factory = new ContractFactory(artifact, signer);
const token = await factory.deploy(1000n);           // positional ctor args (+ optional trailing overrides)
await token.waitForDeployment();
await token.transfer(bob, 10n);

// hardhat shortcuts:
const token = await deployContract(artifact, [1000n], signer);
const factory = getContractFactory(artifact, signer);

// a NetworkProvider runner needs explicit funding:
await new ContractFactory(artifact, provider).deploy({ fundingUtxo, funder, changeAddress });
```

### `tx.wait()`

Every `.send()` / deploy result carries an ethers-style `wait()` - resolves once the provider knows the tx
(mined), `wait(n)` waits n confirmations. Instant on `MockNetworkProvider` (mined on send):

```ts
const tx = await token.transfer(bob, 10n);
await tx.wait();
```

### Pure covenant contracts: `forceStateful`

A contract with zero state variables (a pure covenant like `require(block.chainid == e)`) compiles stateless by
default, so `StatefulContract` can't wrap it. Compile it with `{ forceStateful: true }` and it becomes a
stateful contract with an **empty** `stateLayout` (`variables: []`) and the master-NFT self-preservation
covenant - then it spends with the short call, no dummy state field:

```ts
const artifact = compileString(src, { forceStateful: true });
const contract = new Contract(artifact, [], { provider });
const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {}, { saltContract: true });
const address = contract.withCategory(hexToBin(categoryId)).address;
const sc = new StatefulContract(address, artifact, provider);   // attach by address (category read from indexer)
await sc.check(expected);   // spend the covenant, self-preserving
```

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
await counter.increment();             // thenable: awaiting sends (== counter.increment().send())
await counter.count();                 // scalar getter (== counter.state.count()) - reads via getState()
await bank.balances(userPkh);          // mapping getter: entry value at the key, or undefined if absent
await bank.allowances(owner, spender); // nested mapping: one argument per key
```

A function call is a thenable, so `await sc.fn(args)` builds and sends in one step - the preferred short form.
`.send()` / `.buildUnsigned()` / `.withDelegatecall(...)` remain for when you need the intermediate builder.

**Solidity-getter parity.** `sc.<name>()` reads a public state variable (over `getState()`) and
`sc.<mapping>(...keys)` reads a mapping entry (over `getEntries()`), the parity forms for Solidity's
`contract.property()` / `contract.balances(key)`. A mapping getter returns the stored value or `undefined` when
no entry exists (rather than a zero-default), takes one argument per key for nested/composite mappings, and
UTF-8-encodes a string arg (mirroring `setEntry`) to match a `bytesN` key. Both are also reachable on the
explicit `sc.state.<name>` accessor. Array-collection indexed getters (`sc.<array>(i)`) are not yet wired - use
`getEntries('<array>')` for those.

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
