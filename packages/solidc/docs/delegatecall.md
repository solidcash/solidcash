# Delegatecall (proxy / upgrade pattern)

`delegatecall` lets a **proxy** contract hold persistent state while forwarding its logic to a separate,
swappable **delegate** (implementation) contract. It mirrors Ethereum's proxy pattern: the state lives at a
stable address, and the code that mutates it can be upgraded by pointing the proxy at a new delegate.

> **Security:** delegatecall is power-user machinery with BCH-specific rules that differ from Ethereum. Read
> [delegatecall-security.md](./delegatecall-security.md) before deploying one. This document describes the
> mechanism; that one describes how to keep it safe.

## The two contracts

### Delegate (implementation)

An implementation is an **ordinary contract** — there is no keyword, exactly as in Solidity:

```solidity
pragma solidcash >=0.8.0;

contract Counter() {
    bigint counter;

    function increment() public {
        this.counter = this.counter + 1;
    }
}
```

BCH has no shared execution context, so "writes its own state" and "writes a co-spent proxy's state" are
different scripts and the choice cannot be deferred to runtime. The compiler therefore builds this contract
twice: the standalone artifact, plus a **delegate build** carried as `artifact.delegateArtifact`, in which
`this.<field>` targets the proxy's state (a `_proxyMasterIndex` parameter is injected and every state access is
retargeted through it). The SDK reaches the second build with `contract.asDelegate()`.

A function gets a delegate build when it is externally callable, touches state the proxy owns (a state write,
an `emit`, or a low-level call), and carries none of `view`, `pure`, `internal`, `private`, `unsafe`, `upgrade`,
`deploy`, `selfdestruct`, `split`, `merge`. It must also not issue a delegatecall itself. Functions that do not
qualify are still present in the delegate build, but in their ordinary form.

Two forms are excluded because they do not currently execute in delegate mode - the delegate input fails its
covenant:

- **value transfers** (`payable(r).transfer(...)`), and
- **token-container operations** (`this.tokens[cat].transfer(...)`).

This is a limitation of the delegate codegen, not of inference: the same function fails identically with a
hand-written `delegate` modifier. A transfer poisons the whole function, so a state write alongside one is
excluded too. Excluding them means `asDelegate()` throws at build time instead of the transaction reverting at
broadcast. A contract whose only mutating functions transfer gets no delegate build at all.

Typed external calls (`IFoo(addr).bar()`) do not make a function eligible either: an external call mutates the
**callee's** state, never the proxy's, so there is nothing to delegate.

The delegate build runs against a co-spent proxy whose master has minting capability and preserves itself; both
are checked automatically.

> The `delegate` modifier still parses and forces a function into delegate mode in the primary artifact. It is
> deprecated: it is no longer needed, and it makes the contract non-deployable on its own.

### Proxy

The proxy declares the **same state layout** as the delegate and forwards to it via `impl.delegatecall(input)`.
The idiomatic entry point is the fallback (the default branch for any unmatched selector):

```solidity
pragma solidcash >=0.8.0;

contract CounterProxy() {
    bigint counter;   // same layout as Counter

    fallback(bytes input) external {
        address impl = address(0x....);   // the delegate's address
        impl.delegatecall(input);
        require(input.length > 0);
    }
}
```

The proxy and delegate state layouts must match; the SDK checks this (`assertDelegateLayoutCompatible`) and the
compiler enforces layout guards.

Constraints on a delegatecall-issuing function:
- **It must not mutate its own state** (`this.x = ...`) — the delegate owns all writes (see the security doc).
  A self-write in a delegatecall function is a compile-time error.
- The delegate is the sole authority over the proxy's state on this path; the proxy just forwards.

## How a state change executes on-chain

State lives in token NFTs, so a delegatecall state change is a single transaction that co-spends the proxy and
the delegate and re-creates the proxy's data NFTs with the new commitments:

```
in0:  proxy master        (self-preserved)
in1..: proxy data NFTs     (re-created with the delegate-computed commitments)
inK:  delegate master      (co-spent; runs the `delegate` function against _proxyMasterIndex = 0)
inK+..: delegate data NFTs  (self-preserved)
out0: proxy master         (preserved)
out1..: proxy data NFTs     (new commitments, e.g. counter + 1)
outK:  delegate master      (self-preserved)
```

The `delegate` function, executing on the delegate's input, reconstructs and pins the proxy's data-NFT output
commitments via `_proxyMasterIndex`. That is what authorizes the proxy's new state.

## Building the transaction (SDK)

Use `withDelegatecall` on the proxy's fallback call to auto-derive the whole layout — proxy UTXOs, delegate
co-spend, calldata, and the return wiring:

```ts
import { StatefulContract } from 'solidcash';

const proxy = StatefulContract.withCategory(proxyContract, proxyCategoryId);
// asDelegate() selects the delegate build. It is a different script, so deploy THIS one as the
// implementation - it has a different address than the standalone contract.
const impl  = StatefulContract.withCategory(counterContract.asDelegate(), implCategoryId);

const tx = await proxy.call['__fallback']()
  .withDelegatecall(impl, 'increment', [])   // (impl, delegateFunction, args)
  .send();
```

`withDelegatecall(impl, functionName, args, proxyMasterIndex?)`:
- `impl` — the delegate as a connected `StatefulContract`;
- `functionName` — which `delegate` function to run (`'increment'`);
- `args` — that function's user arguments (e.g. `[pk, sig]` if it takes them);
- `proxyMasterIndex?` — the proxy master's input index (defaults to `0`; override for nested compositions).

It asserts the delegate's state layout matches the proxy's, forwards the encoded selector + args as the
fallback's `input`, and co-spends the delegate so its `delegate` function authorizes the proxy's new state.

## Upgrading

Because the state lives on the proxy's NFTs and the logic lives on the delegate, you upgrade by pointing new
transactions at a different delegate (a new implementation with the same state layout) — the proxy's data NFTs
carry the accumulated state across the switch. The proxy's `impl` address is what selects the delegate; make it
a value you can change through your governance/upgrade path (and see the security doc for pinning it safely).

## Relationship to Ethereum

Same intent (state at a stable address, upgradeable logic), but the enforcement model differs. On Ethereum,
`delegatecall` runs the delegate's bytecode in the proxy's storage context, and storage can *only* be written by
executing code with authority over the account. On BCH there is no shared execution context: the delegate is a
**co-spent input** whose covenant authorizes the proxy's data-NFT outputs. The delegate must therefore be
genuinely present in the transaction, and the proxy must be written so that presence is required — which is the
subject of [delegatecall-security.md](./delegatecall-security.md).

## Related

- `delegate` modifier, `_proxyMasterIndex` injection — `packages/solidc/src/generation/GenerateTargetTraversal.ts`
- Library contracts reuse the same delegate machinery under `L.f()` sugar — see `library-contracts.md`.
- Security model and hardening rules — `delegatecall-security.md`.
