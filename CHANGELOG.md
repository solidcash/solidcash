# Changelog

## Unreleased

### Security

- An expression-form delegatecall, `(bool ok, bytes data) = impl.delegatecall(input)`, was not pinned to its
  implementation (DELEGATE-1, in 0.51.0 and, by reading, 0.50.x). A spender could co-spend other code, or none, and
  set the calling contract's state at will. It is now pinned as the statement form `impl.delegatecall(input);` always
  was. A contract that uses the expression form compiles to new bytes: recompile and redeploy it. The same pin now
  covers the forwarder through which a split contract's read-only function returns from its facet. The statement
  form, library calls and the SDK's default proxy were not affected.

### Fixed

- A low-level call made after a write of its target in the same function now pins and pays the written value, as
  the EVM calls it (TARGET-6). Before, `payee = p; payee.call{value: v}("")` paid the old payee, and
  `token = t; token.call(p)` required the old token. A call the compiler cannot read at its site is refused
  (`ENTRY_TARGET_WRITTEN_BEFORE_CALL`). A message-bus route binds such a call too. A framed or constructor call
  through a target written first is refused by name, and the SDK refuses to auto-wire such a callee. A write is
  judged by field path, so a write to another field of the same entry leaves the target current.
- A root call under a guard the SDK cannot decide, with no caller edge to guard it, is refused by name
  (`CallGuardUndecidedError`). Before, a raw call to a callee that reads no `msg.sender` was made on a guess, and the
  callee was spent with the guard false.
- A call in the right operand of `&&` or `||` inside a branch or a ternary arm now publishes the branch with its
  operand. It was published with the operand alone, so the SDK made the call with the branch false.
- The late pass refuses a call under a guard no frame can decide. Discovery refuses a looped call whose number of
  turns it cannot plan, unless a caller edge guards it.

- On the direct convention, a nested callee's external call under a false guard on `block.number` or
  `block.timestamp` no longer spends the callee. The SDK now gives the guard the block clock when it works out which
  calls a called contract makes, read from the pool coin that contract's run reads. Without it the guard stayed
  unresolved, the call was kept, and the callee was spent with its state changed. Arguments of such a call that read
  `block.number` or `block.timestamp` now resolve too.
- A called contract whose only call is conditional, and not made in a run, is now stated as not making it, as a
  root function is. Such runs were refused before, whatever the guard read.
- A keccak256 chain beside a collection walk, a dynamic-state write, a mapping loop, per-turn payments or events is
  now refused at compile time (`keccak-chain-shares-trailing-band`), as the keccak256 loop already was beside a walk
  or a write. The other run counts its coins from the block's end without the chain's side-cars, so no transaction
  could spend the function. A keccak256 loop placed after a loop over a mapping, beside dynamic state the function
  only reads, is refused for the same reason (`keccak-loop-shares-trailing-band`).
- The SDK now lays out the dynamic-state chunks a function only reads after its keccak256 side-cars, where the
  contract reads them. This covers a keccak256 chain, a keccak256 loop beside a mapping loop, per-turn payments or
  events, and either one beside a fixed sorted write. Such functions compiled but could not be spent. A keccak256
  loop beside read chunks and an external call is refused by the SDK by name.
- A called contract's call under a guard the SDK cannot decide is now refused by name before anything is sent
  (`CallGuardUndecidedError`). Before, the call was made on a guess, which spent the callee when the guard was false.
  The SDK decides a called contract's guard in that contract's own frame, with the block clock, the mapping entries
  the guard reads and the results of its earlier calls. The late pass and the delegatecall path now read the block
  clock too, and state a skipped single call as not made.

### Changed

- An external call in the ABI carries `conditionUnpublished: true` when it runs under a guard the compiler cannot
  write down, so the SDK can tell it from a call inside an `if` condition. No bytecode changes.

## 0.51.1

A patch release of all six packages for one fix in the SDK. The compiler changes nothing but its version, so every
contract keeps its bytecode and its address.

### Fixed

- A contract created through a deployer coin (a `new` of a stateful contract, through its `Deploy<C>`) can now be
  created from a wallet the SDK holds no key for, a WalletConnect session or a browser extension. Every such creation
  failed before, at three points:
  - `buildDeployerPreps` took the child's category from a prep whose wallet input still held the signature's
    placeholder.
  - The creation's check before broadcast verified that placeholder and refused it ("error in evaluating input index
    3: Program failed an OP_VERIFY operation").
  - A creating call given its preps still asked the signer for a vout-0 coin it never spent.

  The wallet now signs each prep and then the creation, before anything is broadcast, so a wallet that declines leaves
  nothing on chain.

## 0.51.0

All six packages move to 0.51.0 together. Source files need `pragma solidcash ^0.51.0`: a caret range on 0.x pins the
minor version, so the compiler refuses `^0.50.0`. Like 0.50, this is a beta; it has had no outside audit.

Every stateful contract on the direct convention compiles to new bytecode, so its address changes: deploy a new
category. Measured against 0.50.1, a minimal counter grows from 1,231 to 1,416 bytes and a Solidity ERC20 from 4,880 to
5,184. Stateless contracts (the repository's examples) and a framed contract without key recovery keep their bytes.

### New

- `new` of a stateful contract on the direct convention goes through a one-shot deployer coin, `Deploy<C>`, which pins
  the child's code, constructor arguments, records and value. A constructor can call other contracts, write mappings
  and arrays, emit events, publish BCMR metadata, read block fields and its token container, and receive value; a
  `new` can sit in a branch or a loop, within limits the compiler names. See
  [Contract creation](https://solidcash.org/docs/language/contract-creation).
- `pragma satoshicontainer single` keeps a contract's satoshis in one coin and `pragma tokencontainer single` each token
  container in one coin, so a call has one shape however much the contract holds. `this.payMinerFee` lets a container
  pay the fee by omission, with no owner or relayer.
- A constant-bound loop whose turns pay or emit is unrolled, so each turn has its own output.
- A direct program within 1,000 bytes of the input limit gets an outlining pass that shares its repeated spans: the
  NativeUsdt and OpenZeppelin ERC20 test ports, whose spending inputs were over the 10,000-byte limit, now fit.
- A default compile takes the direct build when the message-bus build is over the input limit, and the SDK refuses to
  deploy code that no input can spend.

### Changed

- Every arm of a direct stateful contract opens with an exact-stack check, and a contract whose records are sound
  carries a genesis-call marker (`genesisCalls` is on by default; a message-bus compile takes none).
- A raw call with a payload must co-spend its target, which runs the call; a payload naming a returning function
  (`abi.encodeCall`, `abi.encodeWithSelector(I.f.selector, ...)`) also reads the callee's record, so the caller sees a
  `false`. A plain send, with an empty payload, answers `(true, "")` only. An opaque `bytes` payload or
  `abi.encodeWithSignature` still reads no record.
- `x.call{value: v}(...)` pays its target, or is refused by name; before, the expression form paid nothing. Under
  `evmCompat`, `transfer` and `send` pay the P2PKH lock of a 20-byte address rather than a lock of the raw bytes.
- A call to a target the contract computes (a CREATE2 address, a keccak256 result) still takes the spender's witness for
  its callee, and now compiles with a `[computed-call-target-unverified]` warning.
- `ecrecoverEvm` answers `address(0)` where the EVM's precompile does (an r or s outside [1, n), an off-curve r, a key
  at infinity, an invalid v), and a refused recovery compares equal to `address(0)`.
- `new C{code, template}`, unreleased since 0.50.1, is gone: a direct `new` goes through `Deploy<C>`.

### Fixed

Each fix has a hostile test; `docs/security/security-audit-2026-10-16.md` lists them with their commits.

- A call through a target holding `address(0)` accepted whatever contract the spender co-spent. It fails now, as it
  reverts on the EVM.
- A call was bound to its target's final value, so a function that rewrote its target after the call let the spender
  choose the callee. A call is bound where it runs.
- In a loop, the callee witness of a parameter-array element and a view call's answer were the spender's to choose.
  Only a keccak256-computed loop target keeps them, with the warning above; other targets are checked or refused.
- A payment from a runtime loop, and a message-bus kernel route's payment, did not count every coin at the satoshi
  container, so a spender could drain a second container coin.
- A callee's `msg.sender` could name any contract co-spent beside it; it now names a caller whose run made the call,
  through an edge the caller pins. A direct call's arguments, and the method of a call through a single-function
  interface, are bound to the callee's run.
- A record written blind (every field written, none read) left its tag unchecked, so a sibling record could be
  duplicated.
- `m[k] = m[7] + 1` in a sorted-loop write compiled as `m[k] += 1`.
- A Solidity-compat call to a stateful callee co-spends the callee's whole block (MasterChef's deposit goes through).
- The direct path asks an external wallet to sign: preflight had skipped such inputs, so a wrong-key signature passed
  on the mock.
- A payment to a framed contract's validator address, or to a stateful master's lock, where the coin would be stuck,
  is refused.

### Known issues

- Carried from 0.50.0 and not re-checked: on the direct convention, a nested callee's external call under a false guard
  on `block.number` or `block.timestamp` spends the callee anyway, and `block.number` in a nested callee's external-call
  arguments is unresolved.
- A raw value-only send after a write of its target pays the value the target had when the function started; the SDK
  refuses to fill that callee in and asks for `withExternalCall`.
- A keccak256 chain beside a collection walk or a dynamic-state write cannot be spent, and the compiler does not refuse
  it yet.
- Refused by name rather than built: a constructor that writes its call target after the call, two calls through one
  variable reassigned between them, a payment from a direct-only message-bus participant, and a typed `{value:}` call to
  a co-spent callee.

## 0.50.1

`@solidcash/solidcash` only; the other packages stay at 0.50.0, whose `^0.50.0` ranges take it.

- A deployment's metadata probe signs with placeholders. The probe genesis, which reads a token's name, symbol, decimals
  and supply before the registry is built, is held and never broadcast, yet it asked a wallet that funds the deployment
  to sign it, so the wallet saw two geneses for one. A wallet now signs once, for the genesis that goes out; a local key
  signs the probe as before.

## 0.50.0

SolidCash's version numbers now depart from CashScript's: 0.50.0 follows 0.14.0-beta.1 and tracks no CashScript release.
Source files need `pragma solidcash ^0.50.0`, and all six packages move together.

- The framed validator is 4,906 bytes. Every framed address differs from an earlier build's, so deploy a new category.
- A facet recreates itself, so a stranger cannot sweep the coins every composition of a build shares.
- A record is named by its input if it is spent, and by its output, or kept at its index, if it is created.
- An internal helper must be of the caller's context category.
- A call takes a deployment's pools in an order of its own, and a frame leaves unspent the data records it only counts.
- A slow server or a node's refusal ends a call's plan search with that error, rather than another plan's refusal.
- A send keeps the relay rules when its provider publishes relaxed limits, as a mock and a devnet do. It had lost them, so
  a below-dust output settled there.
- A returning call that omits an argument its record binds is refused by name, where it crashed the compiler.
- A parent's local no longer resolves into a child's body when a deploy folds, and the direct path orders address keys as
  framed does.
- An external call's arguments and guards can read `block.number` on a root call.

### Known issues

- On the direct convention, a nested callee's external call under a false guard on `block.number` or `block.timestamp`
  spends the callee anyway and lands the wrong state, because the guard is not published on those paths. A false guard on
  state or a constant fails closed there. Root calls and the framed convention are not affected.
- `block.number` in a nested callee's external-call arguments is still unresolved on the direct convention.

## 0.14.0-beta.1

Release-candidate notes: see [`docs/release/0.14.0/RELEASE_NOTES_0.14.0.md`](docs/release/0.14.0/RELEASE_NOTES_0.14.0.md).
Solidity compatibility: see
[`docs/release/0.14.0/SOLIDITY_COMPATIBILITY_0.14.0.md`](docs/release/0.14.0/SOLIDITY_COMPATIBILITY_0.14.0.md).

### Supported in this release

- Solidity-style integer types and checked/unchecked arithmetic, structs, fixed and dynamic arrays, mappings,
  inheritance, modifiers, events, declared errors, ABI helpers, and the documented lowerable Yul subset.
- Stateful contracts backed by CashToken NFT commitments, including entry-backed mappings, chunked arrays,
  events, and the documented deploy, upgrade, destroy, split, and merge builders.
- The built-in proxy profile for scalar and data-NFT state, deployed through `upgrades.deployProxy`.
- A Hardhat-style project workflow through `@solidcash/testing` and SolidHat.
- Six aligned 0.14.0-beta.1 packages with verified exports, declarations, embedded-source maps, CLIs, and installation
  from release tarballs.

### Experimental profiles

- Composed external state mutation and custom delegate-forwarding shapes beyond the built-in proxy profile.
- Message-bus **kernel** composition. Shapes outside the frozen proof inventory stay fail-closed.
- Solidity source shapes outside the compatibility-manifest rows.

Experimental behavior is not part of the stable compatibility promise; construction must stop with a named
diagnostic when the required transaction shape cannot be produced.

### Kernel beta (message-bus calling convention)

- A compiler convention, not a second protocol; the envelope (`L3C1` / `L3BUS1`) and journal rules are unchanged.
- Admitted handlers compile as `OP_DEFINE` bodies behind one row-loop wrapper
  (`selector 53434231`, `artifact.messageBus.convention === 'kernel-row-loop'`).
- Executable surface is exactly `scripts/kernel-beta-manifest.json`; `yarn test:kernel-beta` is the gate.
- Beta limits: MarketplaceV1's kernel route is compile-compatibility evidence only (12,102 bytes over the
  10,000-byte per-input limit); dormant `0x11` read-carrier / dense final-flush publication is off; `split` /
  `merge` / `selfdestruct` / `unsafe(0|1)` / foreign `delegatecall` remain `KERNEL_*`.
