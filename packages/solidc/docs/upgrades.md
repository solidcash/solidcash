# Upgradeable proxies (`upgrades.deployProxy`)

`upgrades.deployProxy` mirrors OpenZeppelin's hardhat-upgrades `upgrades.deployProxy(Factory, [initArgs])`: it
deploys an implementation, deploys a proxy that holds the live state, seeds the state, and returns a handle whose
method calls forward to the implementation through a **pinned delegatecall**.

```typescript
import { getContractFactory, upgrades } from 'solidcash';

const Impl = getContractFactory(implArtifact, signer);   // the delegate (logic)
const proxy = await upgrades.deployProxy(Impl, { counter: 5n });   // built-in proxy + initial state
await proxy.waitForDeployment();

await proxy.increment().send();          // forwards through the pinned delegatecall (counter 5 -> 6)
proxy.address;                           // the stable, state-holding proxy address
```

## Initial state: constructor style vs `initialize()`

OpenZeppelin upgradeable contracts initialize via an `initialize(...)` function, not a constructor, for two
EVM-specific reasons: an implementation's constructor runs in the *implementation's* storage (not the proxy's), so
it cannot set proxy state - init must run *through* the proxy via delegatecall; and `initialize` captures
`msg.sender` as the owner at call time. **Neither applies on Bitcoin Cash:** the proxy's state is its data NFT
commitments, seeded **directly at genesis** (no wrong-context problem), and the owner is a genesis value. So a
constructor/genesis seed is the native equivalent, and no `initialize()` is required.

`deployProxy` supports both, controlled by `options.initializer`:

- **Genesis seed (default when there is no `initialize`)** - the init args populate the proxy's state at genesis in
  one transaction. Pass a named record `{ counter: 5n }` or an OZ-style positional list `[5n]` (mapped to the
  implementation's state variables in declaration order).
- **`initialize()` flow (auto-detected, drop-in for ports)** - if the implementation has an `initialize` delegate
  function, `deployProxy` deploys the proxy at defaults then forwards `initialize(...initArgs)` through it (a second
  transaction, the Ethereum flow). Pass the init args as a positional list, exactly like OZ
  `upgrades.deployProxy(Factory, [a, b, ...])`.
- Set `options.initializer: false` to force the genesis seed even when an `initialize` exists, or
  `options.initializer: 'customName'` to run a differently-named initializer.

```typescript
// Ported OZ contract with `function initialize(int a_, int b_) delegate { ... }`:
await upgrades.deployProxy(getContractFactory(implArtifact, signer), [7n, 9n]);          // runs initialize(7, 9)
// Native SolidCash contract - seed state at genesis:
await upgrades.deployProxy(getContractFactory(implArtifact, signer), { a: 7n, b: 9n });  // genesis (no initialize)
```

## The built-in default proxy

You do **not** need to write a proxy. `deployProxy` uses a built-in `SolidCashProxy` unless you pass
`options.proxy`. On Ethereum a single generic proxy bytecode (EIP-1967) wraps any implementation because storage
is addressed by slot; on Bitcoin Cash the proxy and implementation are separate on-chain contracts whose state
layout must match (state lives in token NFT commitments). The default proxy sidesteps that: its forwarder never
reads its own state fields (the delegate authorizes state via `_proxyMasterIndex`; the epilogue's conservation +
master-preservation are dynamic `input == output` loops), so **one bytecode serves any layout**. At deploy,
`deployProxy` grafts the implementation's `stateLayout` onto the default proxy artifact and bakes the
implementation's address as an **immutable constructor arg**:

```solidity
pragma solidcash >=0.8.0;
contract SolidCashProxy(address implementation) {   // implementation baked at genesis (immutable)
  bigint __proxySlot;                               // placeholder; layout grafted from the implementation
  function __forward(bytes input) {
    implementation.delegatecall(input);             // forwards; the delegate authorizes the state
    require(input.length > 0);
  }
}
```

Because `implementation` is baked (not a call param), the co-spend pin binds the proxy to exactly that
implementation - a caller cannot substitute a malicious delegate. Forwarding is permissionless; the
implementation's `delegate` functions define who may do what (like a public mutating method on Ethereum). This is
the closest safe analog to EIP-1967 minus in-place upgrade (upgrading means deploying a new proxy and migrating
state; a standardized upgradeable shape can come later).

### Custom proxy

Pass `options.proxy` to use your own proxy contract. Its forwarding function is auto-detected:

- `f(bytes input)` (**baked mode**) - the implementation is a baked constructor arg (like the default).
- `f(bytes input, address impl, ...auth)` (**param mode**) - the implementation is a call param. This is
  flexible but **only as safe as its own auth**: because both `impl` and any `pubkey` are caller-supplied, the
  proxy must gate on a *baked* key/owner, not a param `pubkey`, or a caller can point it at a malicious delegate.
  Prefer the baked default.
- `__fallback()` (**fallback mode**) - the implementation is auto-derived from the co-spend (unpinned; emits the
  C1 warning).

A pinned forwarder forces + pins the delegate co-spend (finding C1): the covenant verifies a co-spent input whose
UTXO locking bytecode `== implementation` (identity) and whose forwarded calldata is `input` (which-function).
See `docs/delegatecall-security.md`.

## API

```typescript
upgrades.deployProxy(implementationFactory, initialState?, options)
```

- `implementationFactory` - a `ContractFactory` for the implementation (`getContractFactory(implArtifact, runner)`).
- `initialState` - the proxy's initial state: a named record `{ counter: 5n }`, or an OZ-style positional list
  `[5n]`. With an initializer these are its positional args; otherwise they map to the state variables in order.
- `options.initializer` - `string | false`. Default auto-detects an `initialize` delegate function (Ethereum flow);
  `false` seeds state at genesis (constructor style); a string names a different initializer. See above.
- `options.proxy` (optional) - a custom proxy artifact. Omit to use the built-in `SolidCashProxy`.
- `options.runner` - Signer/NetworkProvider to deploy + sign with (defaults to the factory's runner).
- `options.forwardFunction` - name a custom proxy's forwarding function explicitly (else auto-detected).
- `options.auth` - `(signer) => FunctionArgument[]` for a param-mode forwarder's trailing auth args
  (default `[signer.publicKey, new SignatureTemplate(signer.privateKey)]`; unused by the baked default).
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

## Regenerating the default proxy artifact

`packages/solidcash/src/stateful/defaultProxyArtifact.ts` is generated (it embeds the compiled `SolidCashProxy`
so the SDK needs no compiler at runtime). To regenerate after a compiler change, compile `DEFAULT_PROXY_SOURCE`
(exported from that file) with `compileString`, drop the volatile `updatedAt`, and `JSON.stringify` the artifact
back into the file (keep the `/* eslint-disable */` header). The bytecode is layout-independent, so it does not
depend on any specific implementation.
