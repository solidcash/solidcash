---
title: Solidity Import Compatibility
---

`solidityImportCompat` lets `solidc` parse and lower real `.sol` source graphs. It is a **source compatibility
pipeline**, not an EVM emulator: accepted syntax is mapped onto Bitcoin Cash covenants, CashToken state and
co-spent calls. Code whose correctness depends on an EVM account, storage-slot or call-frame property still needs a
BCH-specific design review.

## Enable the pipeline

```ts
import { compileFileMulti } from 'solidc';

const artifacts = compileFileMulti('contracts/Router.sol', {
  solidityImportCompat: true,
});
```

SolidHat projects can make this the project default:

```ts
import { defineConfig } from 'solidhat/config';

export default defineConfig({
  compiler: {
    solidityImportCompat: true,
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

Bare Solidity state access is resolved through lexical scope:

```solidity
balanceOf[user] += amount;
totalSupply--;
```

Locals and parameters shadow outer declarations according to Solidity's rules. Compound assignments and
increment/decrement are lowered to the same authenticated state operations as explicit `this.` access.

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
an EVM call stack; the participating contract UTXOs still have to be registered and co-spent by the SDK.

An imported upgradeable implementation which uses an `initializer` or `reinitializer` modifier has its external
surface marked for delegate execution, including synthesized public getters. The compiler emits the proxy-context
build in artifact metadata; deployment and state-layout checks remain the SDK's proxy workflow. This inference is
not permission to trust an arbitrary implementation address.

## Defaults shared with native source

Many porting improvements are now ordinary language behavior because they add syntax without changing a sound
contract's storage protocol. They do not require the flag, including:

- hexadecimal literal coercion in integer contexts and string/hex literal right-padding for `bytesN`;
- declaration order flexibility, `uint`/`int` aliases and qualified `Library.Type` references;
- empty regular function bodies returning type defaults or a guarded no-op;
- ABI-only artifacts for interfaces, abstract/declaration-only units and inline-only libraries;
- uninitialized local declarations receiving their type default;
- named returns, tuple holes, local lexical shadowing and supported compound state assignment; and
- compile-time folding of literal `sha256` and real `keccak256` expressions.

The compiler still rejects a spend path which has neither a verification nor a state change unless
`enforceFinalRequire: false` is explicitly selected. Compatibility mode does not relax covenant safety defaults.

## Options which are separate

`solidityImportCompat` does not select EVM wire encoding. Enable `evmCompat` separately when the byte string must
match Ethereum ABI head/tail encoding and Keccak selectors:

```ts
import { compileFile } from 'solidc';

const artifact = compileFile('Bridge.sol', {
  solidityImportCompat: true,
  evmCompat: true,
});
```

Even then, SolidCash `address` remains variable-length BCH locking bytecode. Use an explicit `uint160` at an EVM
wire boundary. See [Data Encoding & ABI](/docs/language/abi-encoding).

Compatibility mode defaults bare Solidity `ecrecover(hash, v, r, s)` to the `evm` address projection unless an
explicit `ecrecover: 'p2pkh' | 'evm'` option overrides it. Recovery still executes through BCH computation
sidecars.

`block.chainid` comes from the separate `chainId` compiler option. Other supported `block.*` values use the block
oracle or documented BCH shims; the flag does not make EVM block context appear.

## Warnings and semantic walls

Treat warnings as migration work, not cosmetic output. Important examples include:

- `msg.sender`, `msg.value`, `payable`, `fallback` and `receive` have BCH call/value meanings;
- `try/catch` cannot recover from a failed Script opcode;
- `gasleft`, `block.gaslimit`, `block.prevrandao` and blob fields are shims, not EVM consensus values;
- `transient` cannot communicate between calls because BCH has no nested call frame;
- narrowing an `address` to `bytes20`/`uint160` discards the BCH locking-bytecode structure; and
- opaque low-level calldata currently has weaker selector/payload authentication than a typed call.

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
