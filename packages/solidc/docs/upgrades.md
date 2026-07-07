# Upgradeable proxies (`upgrades.deployProxy`)

`upgrades.deployProxy` mirrors OpenZeppelin's hardhat-upgrades `upgrades.deployProxy(Factory, [initArgs])`: it
deploys an implementation, deploys a proxy that holds the live state, seeds the state, and returns a handle whose
method calls forward to the implementation through a **pinned delegatecall**.

```typescript
import { getContractFactory, upgrades, Signer } from 'solidcash';

const Impl = getContractFactory(implArtifact, signer);              // the delegate (logic)
const proxy = await upgrades.deployProxy(Impl, { counter: 5n }, {   // initial state
  proxy: proxyArtifact,                                            // the proxy (state)
});
await proxy.waitForDeployment();

await proxy.increment().send();          // forwards through the pinned delegatecall (counter 5 -> 6)
proxy.address;                           // the stable, state-holding proxy address
```

## Why a proxy artifact is required

On Ethereum a single generic proxy bytecode (EIP-1967) wraps any implementation, because storage is addressed by
slot and the implementation defines the layout. On Bitcoin Cash the proxy and implementation are **separate
on-chain contracts** with a compatible state layout (state lives in token NFT commitments, not per-account
storage), so the proxy is its own `.scash` contract. Pass its artifact in `options.proxy`.

A minimal pinned proxy:

```solidity
pragma solidcash >=0.8.0;
contract MyProxy() {
  bigint counter;                                                  // same layout as the implementation
  function up(bytes input, address impl, pubkey pk, sig s) external {
    require(checkSig(s, pk));
    impl.delegatecall(input);                                      // forwards; the delegate authorizes the state
    require(input.length > 0);
  }
}
```

The forwarding function is auto-detected: a pinned forwarder `f(bytes input, address impl, ...)` (preferred) or a
bare `__fallback()`. A pinned forwarder forces + pins the delegate co-spend (finding C1): the covenant verifies a
co-spent input at `impl` whose UTXO locking bytecode `== impl` (identity) and whose forwarded calldata is `input`
(which-function). See `docs/delegatecall-security.md`.

## API

```typescript
upgrades.deployProxy(implementationFactory, initialState?, options)
```

- `implementationFactory` - a `ContractFactory` for the implementation (`getContractFactory(implArtifact, runner)`).
- `initialState` - the proxy's initial state: a named record `{ counter: 5n }`, or an OZ-style positional list
  `[5n]` mapped to the implementation's declared state variables in order.
- `options.proxy` (**required**) - the proxy contract artifact.
- `options.runner` - Signer/NetworkProvider to deploy + sign with (defaults to the factory's runner).
- `options.forwardFunction` - name the proxy's forwarding function explicitly (else auto-detected).
- `options.auth` - `(signer) => FunctionArgument[]` for the forwarder's trailing auth args
  (default `[signer.publicKey, new SignatureTemplate(signer.privateKey)]`).
- `options.proxyOverrides` / `options.implementationOverrides` - per-genesis deploy overrides (funding, fee, ...).

The returned `ProxyContract` handle:

- `proxy.address` / `getAddress()` - the proxy (state-holding) address.
- `waitForDeployment()` - await both genesis transactions.
- `connect(runner)` - rebind the runner used to authorize forwarded calls (ethers `connect`).
- `proxy.<implFunction>(...args)` - forward an implementation function through the proxy (dispatch sugar), or the
  explicit `proxy.forward('<implFunction>', [args])`. Chain `.send()` to broadcast.
- `proxy.implementation` / `proxy.proxy` - the underlying deployed implementation / proxy contracts.

## Requirements

- The delegate must be **selector-dispatched** (`>= 2` functions) so its unlocking script leads with the
  selector the proxy pins. A single-function implementation has no selector and is rejected on the pinned path.
- The implementation's mutating logic is in `delegate` functions; they run against the proxy's state via the
  injected `_proxyMasterIndex`. The delegatecall function on the proxy must not write its own state (the delegate
  owns all writes).
