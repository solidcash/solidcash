---
title: Cross-Contract Calls & Results
---

Bitcoin Cash has no EVM-style `CALL` instruction and does not execute another UTXO by naming it. A SolidCash
external call is instead one atomic transaction that **co-spends** the caller and callee. Each input runs its own
covenant, and transaction introspection binds their identities, state replacements, effects, and return data.
Typed calls also bind the compiler-known dispatch shape. Opaque low-level calldata has narrower guarantees,
described below.

That difference explains the whole call model: contract calls are synchronous and atomic, but every participating
contract and auxiliary result must be represented by real transaction inputs or outputs. There is no call stack and
no re-entrancy. A failing callee invalidates the whole transaction, so `try`/`catch` compiles but its catch bodies
never run.

## Define an interface

Interfaces declare the callable functions and public state layout the caller needs:

```solidity
interface ICounter {
    public uint256 count;
    function add(uint256 amount) external returns (uint256);
}

contract Counter() is ICounter {
    uint256 count;

    function add(uint256 amount) public returns (uint256) {
        this.count += amount;
        return this.count;
    }
}
```

The target value is a contract `address`: its self-pinned master locking bytecode. It may come from a constructor
argument, function argument, state variable, struct or mapping field, array element, function pointer, or a value
returned by another authenticated call.

```solidity
interface ICounter {
    function add(uint256 amount) external returns (uint256);
}

contract CounterUser(address counter) {
    uint256 last;

    function update(uint256 amount) public {
        this.last = ICounter(counter).add(amount);
    }
}
```

The caller compares the co-spent callee master with that value, so the target must be a value the compiler can
bind: a parameter, state, a literal, or one of the forms above. Any other target expression fails with
`UnpinnedExternalCallTargetError`. Interface-typed handles work as well, for example `contract C(ICounter counter)`.

Older code may declare the handle as `bytes`; the value is still the target locking bytecode. A 32-byte CashToken
category by itself is not the external-call address.

## Typed calls

A typed call uses ordinary Solidity syntax:

```solidity
uint256 next = ICounter(counter).add(5);
```

The compiler knows the interface, selector, argument types, return types, required callee state NFTs, and call
mode. The SDK resolves the deployed instance and lays its UTXOs into the transaction. On chain, the caller and
callee enforce the relationship rather than trusting that SDK resolution.

The explicit member forms remain available when choosing a mode without consuming a typed return:

```solidity
ICounter(counter).add.call(5);
ICounter(counter).add.staticcall(5);
```

Use ordinary typed invocation unless an explicit mode is needed.

:::caution Experimental
Composed external state mutation, a typed call that changes the callee's state, is experimental in this release.
Interface state reads, `outState` reads, and read-only `staticcall` are not affected by this label.
:::

### What is authenticated

For a stateful typed call, the generated covenants bind at least these properties:

1. The callee master input's locking bytecode equals the target address.
2. The callee master carries the required minting capability and self-pins its category.
3. The selected function/selector and arguments agree with the co-spent callee's invocation.
4. The caller and callee replacement outputs obey their respective state covenants.
5. A typed return comes from the callee's call record: a category-bound return-event output that names the call it
   answers, the only one of its kind the callee admits in the transaction.

The SDK is responsible for discovery, not enforcement. Passing a different instance through
`withExternalCall()` cannot make a mismatched target valid because the caller compares it with the address used by
the contract expression.

## Bind deployed instances in the SDK

When the target cannot be inferred solely from deployment metadata, register the connected instance by interface
name:

```ts
const counter = StatefulContract.withCategory(counterInner, counterCategory);

const user = StatefulContract.withCategory(userInner, userCategory, {
  externals: { ICounter: counter },
});

await user.call.update(5n).send();
```

For a one-off or dynamically selected target, attach it to the pending call:

```ts
await user.call.update(5n)
  .withExternalCall(counter)
  .send();
```

If compiler metadata cannot derive forwarded arguments, use the explicit overload:

```ts
await user.call.update(5n)
  .withExternalCall(counter, 'add', [5n])
  .send();
```

Nested call graphs require registrations on the contract that owns each edge. If A calls B and B calls C, B must
be connected to C as well as A being connected to B. The `externalContracts` connection option can build this
registry graph from artifacts, categories, and constructor arguments.

## Current state and output state

An interface can expose public scalar state and mappings. A direct property read observes the co-spent input state:

```solidity
uint256 before = ICounter(counter).count;
```

`outState` reads the authenticated replacement output in the same transaction:

```solidity
ICounter(counter).add(1);
uint256 afterValue = ICounter(counter).outState.count;
```

External reads are not remote node queries during Script execution. The target data/entry NFTs are included in the
transaction, the caller pins their locking bytecode to the target address, their own covenants self-pin their
category, and read-only inputs are preserved. Mapping reads also carry their vmap membership or non-membership
proof.

For an off-chain UI read, do not create a transaction merely to mimic an EVM multicall. Fetch the UTXOs and call
`getState()`, a generated getter, or `staticCall()` locally.

## Return-event NFTs

Bitcoin Script has no returndata buffer shared between inputs. A stateful callee with a value needed by another
contract serializes that value into a **return-event NFT output**.

The NFT is the **call record** of the call it answers. Its commitment is:

- a 31-byte digest of the call: the SHA256 of the function selector and each argument, numbers minimally encoded
  (signatures are not part of it), cut to 31 bytes;
- one form byte; and
- the canonical encoded return blob when it fits in 96 bytes (form 1), or else its SHA256 (form 2), in which case
  the caller's unlocking carries the blob and the caller checks it against the hash.

The callee computes the digest of the call it executed, and verifies that the output:

- has the callee master's base token category with `none` capability;
- has zero fungible-token amount;
- carries that call record as its NFT commitment;
- uses `OP_TRUE` locking bytecode; and
- contains no more than 1,200 satoshis.

It also requires the transaction to hold no other `OP_TRUE` return carrier of its category: exactly its record for a
returning call, and none when it runs a function that returns nothing.

The caller computes the digest of the call it makes, from its own selector and arguments, verifies the carrier
against the actually co-spent callee, and accepts it only when the record's digest is its own. Then it decodes the
declared type or tuple. A callee run on other arguments answers a different call, so its record is refused. Two
identical reads of one view in a function share its one record.

```text
callee input ── verifies state + return blob ──▶ callee state output
                                             └▶ return-event NFT
caller input ── verifies callee identity + reads/decodes that NFT ──▶ caller state output
```

A return-event NFT is a transport value, not a durable event log. Its `OP_TRUE` output is intentionally disposable.

### Standalone return functions

A standalone returning entry function can be spent without creating a return NFT. Use the SDK according to the
result you need:

```ts
const current = await counter.call.readCount().staticCall();

// Send the stateful call and publish its authenticated return carrier.
const receipt = await counter.call.readCount().emitReturn().send();

// Force a normal send without publishing a return value.
await counter.call.readCount().send();
```

`staticCall()` runs a read-only local VM probe and returns the decoded single value without broadcasting. A plain
`await contract.readCount()` may use the ethers-style pure-read shortcut; `.staticCall()` and `.send()` make the
intent unambiguous. Multi-value `staticCall()` decoding is currently not supported; use single-value view functions
or read the underlying state.

## `call`, `staticcall`, and `delegatecall`

| Mode | State/effect model |
| --- | --- |
| Typed/default call | Co-spends the callee and permits the state/effects its covenant authorizes |
| `staticcall` | Co-spends the target read-only and requires its relevant commitments to be preserved |
| `delegatecall` | Runs implementation logic against the proxy's state layout; implementation state is not used as application state |

`delegatecall` uses the compiler-generated `artifact.delegateArtifact`. The implementation and proxy must place
every accessed field at the same layout position with the same name and type. The SDK checks this compatibility,
and the delegate path independently verifies the proxy/implementation relationship. See
[Upgrades, Proxies & Delegatecall](./upgrades-proxies.md).

## Low-level calls

Addresses expose Solidity-compatible low-level members:

```solidity
bytes payload = abi.encodeWithSignature("ping(uint256)", value);
bool ok, bytes data = target.call(payload);
require(ok);
```

The statement forms of `call` and `staticcall` bind the co-spent target. The expression form can read an
identity/category-bound opaque return blob. `success` is always `true`: a target or integrity failure invalidates
the whole transaction rather than returning `false` as an EVM frame would.

The current opaque path does **not** prove on chain that the payload bytes equal the unlocking arguments selected
for the co-spent function, and it does not pin a dynamic selector the way a typed call does. The SDK needs the
concrete function and arguments to build the target unlocker, but SDK choice is not covenant authentication. Use a
typed interface when dispatch identity matters, or have the callee independently bind the payload/result in its
own covenant.

:::caution
Low-level opaque dispatch gives up compile-time return typing. Authenticate or otherwise constrain a dynamic target
before using its data in state, transfer, or validation decisions. Integrity proves "this target returned these
bytes"; it does not prove that the target is trustworthy.
:::

The explicit SDK binding supplies the concrete function and arguments when opaque calldata cannot be resolved from
the caller artifact:

```ts
await caller.call.forward(payload)
  .withExternalCall(targetContract, 'ping', [value])
  .send();
```

## Calls in loops and dispatch tables

A loop call expands to a runtime-length run of real co-spent targets. The covenant verifies the target locking
bytecode at every iteration and pins the run length; the SDK supplies the matching instances in the same order.

### State or parameter arrays

The notify-all form is supported for a void typed call:

```solidity
address[] subscribers;

function notify(address from, address to, uint256 amount) public {
    for (uint256 i = 0; i < this.subscribers.length; i++) {
        ISubscriber(this.subscribers[i]).onTransfer(from, to, amount);
    }
}
```

Register the connected instances in array order before building the stateful call:

```ts
publisher.registerExternalArray('ISubscriber', [aliceSubscriber, bobSubscriber]);
await publisher.call.notify(from, to, amount).send();
```

An `address` element is the target's full locking bytecode, not a 20-byte account identifier. The compiler reads
and authenticates the state array (including every required chunk), checks each co-spent master against the decoded
element, and preserves or advances each callee under its own covenant. A wrong order, skipped element or substituted
contract fails validation.

Function-pointer arrays use the same machinery. `fns[index](args)` outside a loop calls just that element and can
return a value. `fns[i](args)` in the compiler-recognized loop form is a broadcast and must be void. For a varying-
method table, pass the method names aligned with the instances:

```ts
router.registerExternalArray('IHandler', handlers, ['deposit', 'withdraw']);
```

### Computed per-iteration targets

Router-style targets such as `IPair(pairFor(factory, path[i], path[i + 1])).swap(...)` cannot be recomputed by the
SDK from arbitrary source expressions. The compiler rewrites supported forms to a hidden `address[]` witness. The
stateful SDK fills that witness from the instances registered with `registerExternalArray()` and the covenant
still compares every witness element with the corresponding co-spent target.

This witness is caller-selected, not an author-defined allowlist. It is sound for routing the caller's own
operation because every selected target enforces its own covenant; protocols which require a fixed factory or pair
set must authenticate that set separately. Supported view-then-mutate loop shapes reuse one target co-spend and
derive view witnesses from its authenticated input state. Ambiguous receiver reuse, unbounded occurrence counts and
value-returning broadcasts fail closed.

For a stateless caller, use the explicit helpers:

```ts
import { buildTypedLoopCallTransaction, deriveTypedLoopCoSpends } from '@solidcash/solidcash/loop-call';

const { targets, cospends } = await deriveTypedLoopCoSpends([
  { contract: pair0, fn: 'swap', args: pair0Args },
  { contract: pair1, fn: 'swap', args: pair1Args },
]);

const tx = buildTypedLoopCallTransaction({
  provider,
  contract: router,
  functionName: 'route',
  userArgs: [encodedPath, amount],
  targets,
  callerUtxo,
  cospends,
  funder,
  // selector is required when the target interface exposes several methods
});
```

`buildTypedLoopCallTransaction()` is the fully resolved, synchronous builder. `viewReturns` supplies any explicit
per-iteration view witnesses in ABI order, and `selector` supplies the four-byte method selector when the artifact
requests it.

### Opaque `multiCall`

A stateless Solidity-style `multiCall(address[] targets, bytes[] data)` can use the direct fluent method generated
from its ABI. Register the concrete co-spends and a fee/return-output funder once:

```ts
caller.registerLoopTargets([
  { contract: target0, fn: 'cospend', args: target0Args },
  { contract: target1, fn: 'cospend', args: target1Args },
]);
caller.registerLoopFunder(funderUtxo, funderUnlocker);

const builder = await caller.multiCall(targets, payloads);
await builder.send();
```

The lower-level equivalents are `deriveOpaqueLoopCoSpends()` and `buildOpaqueLoopCallTransaction()`. Each target
must carry a minting NFT so the transaction can create its category-bound return carrier, and the funder pays the
return dust plus fee. The target and data arrays must have equal non-zero length.

Opaque loop payloads are currently advisory in the same sense as other low-level calldata: target identity and
return category are bound, but the payload/selector is not proven against the target unlocker. The `returnData`
field can also override the derived commitment. Do not use opaque loop results for authorization, state or value
decisions unless the target covenant independently authenticates the claimed result. Prefer typed dispatch where
possible.

## Call options and value

`{value: amount}` creates an authenticated BCH transfer output to the target. It is not an in-memory balance
transfer. `gas` is accepted for source compatibility but has no EVM meaning; BCH applies transaction and per-input
operation-density limits. Deployment `salt` belongs to contract-creation flows.

```solidity
IPayee(payee).deposit{value: amount}();
```

### How `msg.sender` is derived

Inside a callee, `msg.sender` is the calling contract's address: the locking bytecode of its master, which the
callee checks is co-spent in the same transaction. When no contract calls the function, `msg.sender` is
`tx.origin`, the locking bytecode of the first P2PKH input that holds no tokens. A message-bus row's `msg.sender` is
the caller recorded in the bus manifest.

The value comes from the transaction's inputs, which the transaction builder chooses, not from a call frame.
Co-presence of another contract in a transaction is not by itself caller authorization; generated call bindings or
the message bus transcript establish the call edge. Authorize with `checkSig`, `checkMultiSig`, or
`checkDataSig` rather than with `msg.sender` alone.

## Repeated calls and the message bus

A UTXO can appear as an input only once. If an invocation graph calls the same physical contract repeatedly, a
naive layout cannot spend its master once per logical call. Eligible contracts therefore receive a compiler-owned
message-bus route. The bus executes multiple logical rows against one participant journal and settles one final
replacement state atomically. Message-bus composition is experimental in this release.

Use [Atomic Calls with the Message Bus](/docs/guides/message-bus) for graph composition, participant limits, and
diagnostics. Direct calls remain the simpler path when every physical participant is used once. The framed
convention (`composition: 'framed'`) is a separate, also experimental, composition model; see
[Framed Composition](/docs/guides/framed-composition).

## Practical limits

- Every stateful participant adds real inputs, outputs, unlocking bytecode, and VM work.
- Dynamic call loops require a compiler-proven or runtime-authenticated occurrence shape and can hit transaction
  size before source-level loop limits.
- Recursive or circular graphs are accepted only where the compiler/SDK can derive a bounded, unambiguous physical
  transaction; otherwise compilation or preflight fails closed.
- Signature-bearing calls must be signed only after the complete transaction layout is final.
- `staticcall` preserves the target but still pays the cost of co-spending and recreating it.

See [Interfaces & Imports](./imports-interfaces.md) for declarations, [Data Encoding & ABI](/docs/language/globals#abi-encoding-and-decoding)
for payload construction, and [State Storage & Data Encoding](./storage-model.md) for the UTXOs carried by a call.
