---
title: Solidity Import Compatibility
---

`evmCompat` lets `solidc` parse and lower real `.sol` source graphs. It is a **source compatibility
pipeline**, not an EVM emulator: accepted syntax is mapped onto Bitcoin Cash covenants, CashToken state and
co-spent calls. Code whose correctness depends on an EVM account, storage-slot or call-frame property still needs a
BCH-specific design review.

## Enable the pipeline

```ts
import { compileFileMulti } from '@solidcash/solidc';

const artifacts = compileFileMulti('contracts/Router.sol', {
  evmCompat: true,
});
```

SolidHat projects can make this the project default. A project created with `npm create @solidcash/solidhat`
already has it in `solidcash.config.ts`:

```ts
import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  compiler: {
    evmCompat: true,
  },
});
```

The mode accepts `pragma solidity ...` and known no-op compiler pragmas such as `abicoder`/`experimental`. The
requested solc version is syntax-checked but not matched against the SolidCash compiler version. Without the flag,
a Solidity pragma produces a diagnostic which names the option.

The filesystem resolver loads `.sol` imports, tries extension candidates and resolves package paths through the
project dependency tree:

```solidity
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
```

Browser builds must provide an `importResolver` and stable `rootFileId`; the compiler cannot read a package tree on
their behalf.

:::caution Experimental beyond the documented subset
The supported Solidity subset is what this page and [Coming from Solidity](/docs/basics/solidity-parity) describe.
Solidity source shapes outside it are experimental, even when the parser accepts them.
:::

## What the mode changes

The compatibility flag admits Solidity source forms and enables lowerings which would otherwise change native
SolidCash storage, ABI or validation behavior.

### Solidity declaration and type rules

The parser and semantic passes apply Solidity-facing rules for:

- C3 inheritance, base-constructor invocation, abstract implementation and `virtual`/`override` resolution;
- visibility, mutability, data-location and immutable/constant restrictions;
- overloaded functions/events/errors, named arguments, qualified events/errors and declaration namespaces;
- `memory`, `calldata` and `storage` reference parameters, including supported storage-pointer library helpers;
- `address payable`, external/internal function types, UDVT wrap/unwrap, enum and contract member types; and
- legacy-version syntax such as constructor visibility, `now` and pre-0.8 checked-math helper patterns where the
  source pragma makes that interpretation valid.

The compatibility mutability checker is stricter than native mode: `pure`/`view` effects are followed through
state and transient-state access, contract creation, low-level calls, function pointers and calls to less
restrictive functions.

### State syntax and layout bridges

Bare Solidity state access is not mode-specific: it compiles in both modes and is byte-identical to explicit
`this.` access (see [Defaults shared with native source](#defaults-shared-with-native-source)):

```solidity
balanceOf[user] += amount;
totalSupply--;
```

Under `evmCompat`, a parameter, local or named return may shadow a state variable or a function, as in Solidity;
natively that is a redefinition error. Compound assignments and increment/decrement are lowered to the same
authenticated state operations as explicit `this.` access.

Several storage-facing bridges are mode-specific:

- a supported bounded value-type array `T[N]` is represented as one contiguous packed state field rather than the
  native collection-backed form;
- public state variables and supported nested mapping/array terminals receive real callable getter entries, so
  another co-spent contract can invoke Solidity-style `token.balanceOf(owner)`;
- OpenZeppelin-style private `__gap` arrays are omitted because reserving EVM slots has no BCH effect and could
  consume many NFT commitments;
- `transient` state becomes a zero-initialized per-function local and never enters persisted state;
- supported `StorageSlot`/ERC-7201 pointer idioms are lowered to authenticated SolidCash storage (see
  [EVM Storage & ERC-7201 Compatibility](/docs/language/evm-storage-compat)); and
- `contract C layout at expression` is accepted but ignored, because NFT state has no EVM base slot.

Getter synthesis changes bytecode and ABI. Treat the emitted artifact, not an EVM ABI copied from another build,
as the deployment truth. Recursive or otherwise unmaterializable getter shapes are not fabricated; inspect the
artifact ABI and compiler diagnostics.

### Calls, function pointers and proxies

The pipeline lowers supported Solidity call syntax onto the co-spend model, including named call arguments,
call options, address/function-pointer arrays, typed loop dispatch, and low-level call forms. This does not create
an EVM call stack; the participating contract UTXOs still have to be registered and co-spent by the SDK. A typed
call that mutates another contract's state (composed external state mutation) is experimental.

An imported upgradeable implementation which uses an `initializer` or `reinitializer` modifier has its external
surface marked for delegate execution, including synthesized public getters. The compiler emits the proxy-context
build in artifact metadata; deployment and state-layout checks remain the SDK's proxy workflow. This inference is
not permission to trust an arbitrary implementation address. The stable deployment path is the built-in proxy
profile (`upgrades.deployProxy`); custom delegate forwarding beyond it is experimental.

## Defaults shared with native source

Many porting improvements are now ordinary language behavior because they add syntax without changing a sound
contract's storage protocol. They do not require the flag, including:

- hexadecimal literal coercion in integer contexts and string/hex literal right-padding for `bytesN`;
- bare state access (`totalSupply = v`, `balanceOf[a] += x`), byte-identical to `this.totalSupply = v`;
- declaration order flexibility, `uint`/`int` aliases and qualified `Library.Type` references;
- empty regular function bodies returning type defaults or a guarded no-op;
- ABI-only artifacts for interfaces, abstract/declaration-only units and inline-only libraries;
- uninitialized local declarations receiving their type default;
- named returns, tuple holes, local lexical shadowing and supported compound state assignment; and
- compile-time folding of literal `sha256` and real `keccak256` expressions.

The compiler still rejects a spend path which has neither a verification nor a state change unless
`enforceFinalRequire: false` is explicitly selected. Compatibility mode does not relax covenant safety defaults.

## EVM wire encoding

`evmCompat` also selects EVM wire encoding for the `abi.*` family: Ethereum ABI head/tail encoding and Keccak
selectors.

```ts
import { compileFile } from '@solidcash/solidc';

const artifact = compileFile('Bridge.sol', {
  evmCompat: true,
});
```

Even then, SolidCash `address` remains variable-length BCH locking bytecode. Use an explicit `uint160` at an EVM
wire boundary. See [Data Encoding & ABI](/docs/language/abi-encoding).

### The form of an address value: `addressForm`

An `address` value is its exact BCH locking bytecode; `addressForm` decides the form it takes where the compiler
turns it into bytes.

| form | `abi.encodePacked(<address>)` | a decoded address read |
| --- | --- | --- |
| `'hash'` | the 20-byte Solidity identity: the embedded payload of a standard P2PKH/P2SH20 lock, or `HASH160` of the lock | the 20-byte identity |
| `'bytecode'` | the whole locking bytecode (23, 25 or 35 bytes) | the exact lock the contract stored |

```ts
const artifact = compileFile('Bridge.sol', {
  evmCompat: true,
  addressForm: 'bytecode', // keep the whole lock where an address becomes bytes
});
```

`addressForm` is omitted by default: it resolves to `'hash'` under `evmCompat` and `'bytecode'` otherwise, so a
port keeps the identity it already had. What the option does **not** change:

- the narrowing casts. `uint160(a)` and `bytes20(a)` truncate to 20 bytes and `address(x)` stays a no-op in
  either form, because the cast is the narrowing; a cast that stopped truncating would hand a 35-byte lock to a
  20-byte type;
- a fixed-width EVM ABI **word**. `abi.encode(<address>)`, a word lane (the message-bus kernel's graph/argument
  row) and a word-encoded (`evm-abi-v1`) result carry the 20-byte identity in either form, because a 32-byte word
  cannot hold a variable-length lock.

An `address` *argument* on the [framed](/docs/guides/framed-composition) wire is not a word: it rides as its whole
locking bytecode, and the option decides the packing a body does with it. An explicitly chosen form is published on
the artifact (`compiler.options.addressForm`), and the SDK reads it back through `artifactAddressForm`
(`@solidcash/solidcash/stateful`) so its own derivation of a call's argument packs the same bytes the compiled body does. An
artifact that names no form keeps its previous shape and the mode decides it.

A packed payload that carries locks is longer than one that carries identities, which matters at the 128-byte
NFT commitment limit and for any offset arithmetic over the payload.

### Selectors, runtime signatures, and event arguments

A selector under `evmCompat` is `keccak256(canonicalSignature)[0:4]` over Solidity's canonical spelling: `uint256`
for `uint`, `int256` for `int`, `uint8` for an enum, the underlying type for a UDVT, a parenthesized tuple for a
struct, and `address` for a contract type or `address payable`. Entry dispatch, the artifact ABI selectors,
`type(I).interfaceId`, `fn.selector` / `error.selector` / `E.selector`, `msg.sig`, `abi.encodeCall` and the argument
matching of `abi.encodeWithSignature` all derive from that one spelling, so each matches solc. A native compile
keeps the platform spelling, with address payability erased.

`abi.encodeWithSignature` hashes the signature string it is handed, so a signature built at runtime is legal. Under
`evmCompat` it lowers to `abi.encodeWithSelector(bytes4(keccak256(bytes(sig))), ...)`, and the
[keccak256 side-car](/docs/language/computation-sidecars) supplies the digest.

An event's payload is one NFT commitment with no topic channel, so it cannot be a standard ABI tuple. A scalar
argument of statically known width is therefore written in the standard EVM notation - the bytes `abi.encodePacked`
produces at its natural width - and the artifact marks that parameter `notation: 'evm'`. A variable-width value, an
`address`, a struct, an array, a UDVT and a function pointer keep the platform frame. See
[Events & Errors](/docs/language/events-errors).

Compatibility mode defaults bare Solidity `ecrecover(hash, v, r, s)` to the `evm` address projection unless an
explicit `ecrecover: 'p2pkh' | 'evm'` option overrides it. Recovery still executes through BCH computation
sidecars.

`block.chainid` comes from the separate `chainId` compiler option. Other supported `block.*` values use the block
oracle or documented BCH shims; the flag does not make EVM block context appear.

## Warnings and semantic walls

Treat warnings as migration work, not cosmetic output. Important examples include:

- every read of `msg.sender` or `tx.origin`: both derive from the co-spent inputs, so authorize with `checkSig`;
- `fallback` and `receive` are compatibility features with a different call model on BCH;
- `try/catch` cannot recover from a failed Script opcode;
- `gasleft`, `block.gaslimit`, `block.prevrandao` and blob fields are shims, not EVM consensus values;
- `transient` cannot communicate between calls because BCH has no nested call frame;
- narrowing an `address` to `bytes20`/`uint160` discards the BCH locking-bytecode structure; and
- opaque low-level calldata currently has weaker selector/payload authentication than a typed call.

Some differences compile without any warning. `msg.value` is the net change of the contract's satoshi container,
and `payable` matters only where an address needs it for `.transfer` or `.send`. Review every use.

Unsupported inline assembly, storage pointers, recursive memory shapes, reflection, dynamic dispatch or external
call graphs fail with diagnostics rather than silently adopting EVM behavior. The usual remedy is to isolate a pure
library, replace account storage with vmaps/containers, declare an interface for a typed co-spend, or write a small
BCH-native adapter around the imported core.

## Recommended porting workflow

1. Compile the complete source graph with `compileFileMulti()` so every declaration and deployable contract is
   visible.
2. Fix parser/type errors without changing protocol behavior; keep source locations from imported diagnostics.
3. Review every compatibility warning and every use of address, block context, calls, assembly and storage.
4. Decide whether cross-chain bytes require `evmCompat`; do not enable it merely because the source is `.sol`.
5. Inspect each artifact's ABI, state layout, external-call metadata, sidecars and message-bus profile.
6. Test state transitions and adversarial substitutions in the BCH VM, then deploy through `ContractBundle` or
   the appropriate split/proxy factory.

See [Coming from Solidity](/docs/basics/solidity-parity) for the feature comparison and
[Platform Differences](/docs/basics/platform-differences) for the primitive changes which require redesign.
